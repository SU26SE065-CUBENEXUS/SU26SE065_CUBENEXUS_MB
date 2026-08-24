import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, FlatList, ScrollView, useColorScheme, StatusBar, Vibration, Image, Modal, Platform, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '@/contexts/AuthContext';
import { connectMobileTimer, submitMobileTimerTime, getCurrentPracticeAttempt, finalizePracticeAttempt, createPracticeAttempt, handsOnPracticeAttempt, readyPracticeAttempt, handsOffPracticeAttempt, abortPracticeAttempt, getPracticeSessionDetail, connectPracticeSession, disconnectPracticeSession, apiFetch } from '@/constants/api';
import { API_BASE_URL } from '@/constants/config';
import * as signalR from '@microsoft/signalr';
import * as Device from 'expo-device';

type TimerStatus = 'idle' | 'holding' | 'ready' | 'running' | 'stopped';

interface Solve {
  id: string;
  time: number; // in ms
  timeString: string;
  scramble: string;
  date: Date;
}

function generateScramble() {
  const moves = ['U', 'D', 'L', 'R', 'F', 'B'];
  const modifiers = ['', "'", '2'];
  const scramble: string[] = [];
  let lastMove = '';
  for (let i = 0; i < 20; i++) {
    let move = moves[Math.floor(Math.random() * moves.length)];
    while (move === lastMove) {
      move = moves[Math.floor(Math.random() * moves.length)];
    }
    const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
    scramble.push(move + modifier);
    lastMove = move;
  }
  return scramble.join(' ');
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${seconds}.${centiseconds.toString().padStart(2, '0')}`;
}

export default function PracticeTimer() {
  const scheme = useColorScheme();
  const colors = useTheme();
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [status, setStatus] = useState<TimerStatus>('idle');
  const [time, setTime] = useState<number>(0);
  const [scramble, setScramble] = useState<string>('');
  const [solves, setSolves] = useState<Solve[]>([]);

  // Online Arena / Practice State
  const [isOnlineMode, setIsOnlineMode] = useState(false);
  const [isPracticeMode, setIsPracticeMode] = useState(false); // true = Practice remote, false = PvP Arena
  const [isFreeMode, setIsFreeMode] = useState(false); // true = Free local practice without Web sync
  const [matchId, setMatchId] = useState('');
  const [deviceSessionToken, setDeviceSessionToken] = useState('');
  const [mobileTimerSessionId, setMobileTimerSessionId] = useState('');
  const [practiceScramble, setPracticeScramble] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [hasSavedSession, setHasSavedSession] = useState(false);
  const [lastCompletedTime, setLastCompletedTime] = useState<number | null>(null);
  const [completedSolveCount, setCompletedSolveCount] = useState<number>(0);

  const timerIntervalRef = useRef<any>(null);
  const startTimestampRef = useRef<number>(0);
  const armingTimeoutRef = useRef<any>(null);
  const isScanningRef = useRef(false);
  const activeAttemptIdRef = useRef<string | null>(null);
  const isActionLockRef = useRef(false);
  const isStoppingRef = useRef(false);
  // statusRef: lets polling closure read current status without stale closure
  const statusRef = useRef<string>('idle');
  useEffect(() => { statusRef.current = status; }, [status]);

  // Generate initial scramble (offline only)
  useEffect(() => {
    setScramble(generateScramble());
  }, []);

  const clearSavedArenaPairing = async () => {
    const userId = user?.id || 'default';
    try {
      await AsyncStorage.removeItem(`@session_type_${userId}`);
      await AsyncStorage.removeItem(`@practice_session_id_${userId}`);
      await AsyncStorage.removeItem(`@practice_qr_${userId}`);
      await AsyncStorage.removeItem(`@arena_pairing_active_${userId}`);
      await AsyncStorage.removeItem(`@arena_match_id_${userId}`);
      await AsyncStorage.removeItem(`@arena_device_session_token_${userId}`);
      await AsyncStorage.removeItem(`@arena_mobile_timer_session_id_${userId}`);
      setHasSavedSession(false);
    } catch (e) {
      console.error('[Mobile Timer] Error clearing AsyncStorage:', e);
    }
  };

  // Restore pairing state on mount (when authenticated)
  useEffect(() => {
    const restoreArenaPairing = async () => {
      if (!accessToken || !user?.id) return;

      const userId = user.id;
      const keyActive = `@arena_pairing_active_${userId}`;
      const keyType = `@session_type_${userId}`;

      try {
        const savedPracticeId = await AsyncStorage.getItem(`@practice_session_id_${userId}`);
        const savedArenaToken = await AsyncStorage.getItem(`@arena_device_session_token_${userId}`);

        // Proactively check if savedPracticeId is actually still an open session
        if (savedPracticeId) {
          try {
            const sessions = await apiFetch<any[]>('/api/practice/sessions?page=1&pageSize=1', accessToken);
            if (sessions && sessions.length > 0) {
              const latest = sessions[0];
              if (latest.endedAt || latest.id !== savedPracticeId) {
                await clearSavedArenaPairing();
                setHasSavedSession(false);
              } else {
                setHasSavedSession(true);
              }
            } else {
              await clearSavedArenaPairing();
              setHasSavedSession(false);
            }
          } catch (_) {
            setHasSavedSession(true);
          }
        } else if (savedArenaToken) {
          setHasSavedSession(true);
        } else {
          setHasSavedSession(false);
        }

        const isActive = await AsyncStorage.getItem(keyActive);
        const sessionType = (await AsyncStorage.getItem(keyType)) || 'practice';

        if (isActive === 'true') {
          if (sessionType === 'practice' && savedPracticeId) {
            console.log('[Mobile Timer] Restoring Practice Session:', savedPracticeId);
            setIsConnecting(true);
            try {
              await connectPracticeSession(savedPracticeId, accessToken);
              try {
                const details = await getPracticeSessionDetail(savedPracticeId, accessToken);
                if (details?.solves) setCompletedSolveCount(details.solves.length);
              } catch (_) {}

              let currentAttempt = await getCurrentPracticeAttempt(savedPracticeId, accessToken);
              if (!currentAttempt?.id) {
                currentAttempt = await createPracticeAttempt(savedPracticeId, accessToken);
              }
              if (currentAttempt?.id) activeAttemptIdRef.current = currentAttempt.id;
              if (currentAttempt?.scrambleSequence) setPracticeScramble(currentAttempt.scrambleSequence);

              setMobileTimerSessionId(savedPracticeId);
              setIsPracticeMode(true);
              setIsOnlineMode(true);
              setIsFreeMode(false);
              setHasSavedSession(true);
            } catch (err: any) {
              console.warn('[Mobile Timer] Practice restore failed:', err);
              await clearSavedArenaPairing();
              setHasSavedSession(false);
            } finally {
              setIsConnecting(false);
            }
          } else if (sessionType === 'arena' && savedArenaToken) {
            const savedMatchId = await AsyncStorage.getItem(`@arena_match_id_${userId}`);
            const savedSessionId = await AsyncStorage.getItem(`@arena_mobile_timer_session_id_${userId}`);

            if (savedMatchId && savedSessionId) {
              console.log('[Mobile Timer] Restoring Arena connection for user:', userId);
              setIsConnecting(true);
              try {
                const devInfo = `${Device.brand || 'Device'} ${Device.modelName || 'Model'} (${Platform.OS})`;
                const res = await connectMobileTimer({
                  qrSessionCode: savedArenaToken,
                  deviceInfo: devInfo,
                }, accessToken);

                setMatchId(res.matchId);
                setDeviceSessionToken(savedArenaToken);
                setMobileTimerSessionId(res.sessionId);
                setIsPracticeMode(false);
                setIsOnlineMode(true);
                setIsFreeMode(false);
                setHasSavedSession(true);
              } catch (err: any) {
                console.warn('[Mobile Timer] Arena restore failed:', err);
                if (err.status === 404 || err.status === 400 || err.status === 409 || err.status === 403 || err.status === 401) {
                  await clearSavedArenaPairing();
                }
              } finally {
                setIsConnecting(false);
              }
            }
          }
        }
      } catch (e) {
        console.error('[Mobile Timer] Error restoring pairing from AsyncStorage:', e);
      }
    };

    restoreArenaPairing();
  }, [accessToken, user?.id]);

  // ── Real-time SignalR Synchronization for Mobile ──
  useEffect(() => {
    if (!accessToken) return;

    let isMounted = true;
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/online-arena`, {
        accessTokenFactory: () => accessToken,
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .build();

    conn.on('PracticeSessionEnded', async (payload: any) => {
      console.log('[Mobile SignalR] Practice Session Ended on Web:', payload);
      await clearSavedArenaPairing();
      setHasSavedSession(false);

      if (isPracticeMode) {
        setIsOnlineMode(false);
        setIsPracticeMode(false);
        setIsFreeMode(false);
        setPracticeScramble(null);
        setMobileTimerSessionId('');
        setTime(0);
        Vibration.vibrate([0, 100, 50, 100]);
        Alert.alert('Session Ended', 'This practice session was ended on Web.');
      }
    });

    conn.on('PracticeMobileDisconnected', async (payload: any) => {
      console.log('[Mobile SignalR] Practice Mobile Disconnected:', payload);
      await clearSavedArenaPairing();
      setHasSavedSession(false);
    });

    conn.start()
      .then(() => {
        if (isMounted) console.log('[Mobile SignalR] Connected to online-arena hub');
      })
      .catch((err) => {
        console.warn('[Mobile SignalR] Connection failed:', err);
      });

    return () => {
      isMounted = false;
      conn.stop().catch(() => {});
    };
  }, [accessToken, isPracticeMode]);

  // Poll practice session to keep scramble in sync with Web
  useEffect(() => {
    if (!isPracticeMode || !mobileTimerSessionId || !accessToken) return;

    const fetchScramble = async () => {
      try {
        const attempt = await getCurrentPracticeAttempt(mobileTimerSessionId, accessToken);
        console.log('[Practice Poll] attempt:', JSON.stringify(attempt));
        if (attempt?.id && statusRef.current !== 'running' && statusRef.current !== 'stopped') {
          activeAttemptIdRef.current = attempt.id;
        }
        // Only update scramble if user is NOT in 'stopped' state (they need to tap first)
        if (attempt && attempt.scrambleSequence && statusRef.current !== 'stopped') {
          setPracticeScramble(attempt.scrambleSequence);
        }
      } catch (err) {
        // silently ignore
      }
    };

    fetchScramble(); // fetch immediately on connect
    const pollInterval = setInterval(fetchScramble, 3000);
    return () => clearInterval(pollInterval);
  }, [isPracticeMode, mobileTimerSessionId, accessToken]);

  const startTimer = useCallback((explicitStartMs?: number) => {
    setStatus('running');
    // Use explicitStartMs if provided (for accurate sync with BE startedAt)
    startTimestampRef.current = explicitStartMs ?? Date.now();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setTime(Date.now() - startTimestampRef.current);
    }, 30);
  }, []);

  const stopTimer = useCallback(async (exactFinalTime?: number) => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    const finalTime = exactFinalTime ?? (Date.now() - startTimestampRef.current);
    setTime(finalTime);
    setStatus('stopped'); // Synchronously transition to 'stopped' so spam taps won't re-trigger stopTimer

    if (isOnlineMode && accessToken) {
      setIsUploading(true);
      try {
        if (isPracticeMode) {
          let attemptId = activeAttemptIdRef.current;
          if (!attemptId && mobileTimerSessionId) {
            try {
              const curr = await getCurrentPracticeAttempt(mobileTimerSessionId, accessToken);
              if (curr?.id) {
                attemptId = curr.id;
                activeAttemptIdRef.current = curr.id;
              }
            } catch (_) {}
          }

          if (attemptId) {
            // Fire instant stop to server and Web
            handsOnPracticeAttempt(attemptId, accessToken).catch(() => {});

            await finalizePracticeAttempt(attemptId, {
              timeMs: finalTime,
              penalty: 'OK'
            }, accessToken);

            console.log('[Mobile Timer] Practice Solve finalized:', finalTime);
            setLastCompletedTime(finalTime);
            setCompletedSolveCount((prev) => prev + 1);
            activeAttemptIdRef.current = null;
          } else {
            console.warn('[Mobile Timer] No active attempt ID found to finalize');
          }
        } else {
          // Standard PvP Online Match Flow
          await submitMobileTimerTime({
            matchId,
            mobileTimerSessionId,
            deviceSessionToken,
            timeMs: finalTime,
            isDnf: false,
            stoppedAt: new Date().toISOString(),
          }, accessToken);
          setLastCompletedTime(finalTime);
        }
        Vibration.vibrate(80);
      } catch (err: any) {
        console.warn('[Mobile Timer] Solve time upload warning:', err);
        if (!isPracticeMode && err.status === 404) {
          setIsOnlineMode(false);
          setMatchId('');
          setDeviceSessionToken('');
          setMobileTimerSessionId('');
          await clearSavedArenaPairing();
        }
      } finally {
        setIsUploading(false);
        isStoppingRef.current = false;
      }
    } else {
      // Add to offline solves history
      const newSolve: Solve = {
        id: Math.random().toString(),
        time: finalTime,
        timeString: formatTime(finalTime),
        scramble: scramble,
        date: new Date(),
      };
      setSolves((prev) => [newSolve, ...prev]);
      setScramble(generateScramble());
      isStoppingRef.current = false;
    }
  }, [scramble, isOnlineMode, isPracticeMode, matchId, mobileTimerSessionId, deviceSessionToken, accessToken]);

  // Touch handlers — sequential async to guarantee BE state machine transitions
  const handleTouchStart = async () => {
    if (isActionLockRef.current) {
      console.log('[Mobile Timer] TouchStart ignored — action in progress');
      return;
    }

    if (status === 'running') {
      const now = Date.now();
      const finalTime = now - startTimestampRef.current;
      // Freeze timer immediately on the exact millisecond of touch
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setTime(finalTime);
      setStatus('stopped');
      stopTimer(finalTime);
      return;
    }

    // Tap ONCE after solve finished to reset clock to 0.000s, create next attempt & fetch new scramble, and enter idle state
    if (status === 'stopped') {
      isActionLockRef.current = true;
      setTime(0);
      setStatus('idle');
      Vibration.vibrate(30);

      // User tapped to start next solve -> create next attempt now!
      if (isPracticeMode && mobileTimerSessionId && accessToken) {
        try {
          const nextAttempt = await createPracticeAttempt(mobileTimerSessionId, accessToken);
          if (nextAttempt?.scrambleSequence) {
            setPracticeScramble(nextAttempt.scrambleSequence);
            activeAttemptIdRef.current = nextAttempt.id;
            console.log('[Mobile Timer] Created & set new scramble after tap:', nextAttempt.scrambleSequence);
          }
        } catch (err: any) {
          console.warn('[Mobile Timer] Error creating attempt on tap:', err);
          if (err.status === 400 || err.status === 404 || err.code === 'SESSION_ENDED') {
            setIsOnlineMode(false);
            setIsPracticeMode(false);
            setIsFreeMode(false);
            setPracticeScramble(null);
            setMobileTimerSessionId('');
            setTime(0);
            await clearSavedArenaPairing();
            setConnectionError('This practice session was ended on Web.');
          }
        } finally {
          isActionLockRef.current = false;
        }
      } else {
        isActionLockRef.current = false;
      }
      return;
    }

    if (status !== 'idle') return;

    // Immediately enter holding state (Red) with zero network lag
    setStatus('holding');
    if (armingTimeoutRef.current) clearTimeout(armingTimeoutRef.current);
    armingTimeoutRef.current = setTimeout(() => {
      setStatus('ready');
      Vibration.vibrate(50);

      // Sync ready transition to BE in background
      if (isPracticeMode && accessToken && activeAttemptIdRef.current) {
        readyPracticeAttempt(activeAttemptIdRef.current, accessToken).catch((err) => {
          console.warn('[Practice Sync] ready in background:', err);
        });
      }
    }, 700);

    if (isPracticeMode && accessToken) {
      // Sync hands-on transition to BE in background
      (async () => {
        try {
          let attemptId = activeAttemptIdRef.current;
          if (!attemptId) {
            const attempt = await getCurrentPracticeAttempt(mobileTimerSessionId, accessToken);
            if (attempt?.id) {
              attemptId = attempt.id;
              activeAttemptIdRef.current = attempt.id;
            } else {
              const newAttempt = await createPracticeAttempt(mobileTimerSessionId, accessToken);
              if (newAttempt?.id) {
                attemptId = newAttempt.id;
                activeAttemptIdRef.current = newAttempt.id;
                if (newAttempt.scrambleSequence) setPracticeScramble(newAttempt.scrambleSequence);
              }
            }
          }
          if (attemptId) {
            await handsOnPracticeAttempt(attemptId, accessToken);
          }
        } catch (err) {
          console.warn('[Practice Sync] hands-on in background:', err);
        }
      })();
    }
  };

  const handleTouchEnd = async () => {
    if (status === 'holding') {
      if (armingTimeoutRef.current) {
        clearTimeout(armingTimeoutRef.current);
        armingTimeoutRef.current = null;
      }
      setStatus('idle');
      // Released too early: Keep current attempt and scramble!
      console.log('[Practice] Early release before ready — keeping current scramble and attempt');
    } else if (status === 'ready') {
      if (armingTimeoutRef.current) {
        clearTimeout(armingTimeoutRef.current);
        armingTimeoutRef.current = null;
      }

      // Step 3: Ready → Solving: Start local clock IMMEDIATELY on UI
      const localStartMs = Date.now();
      startTimestampRef.current = localStartMs;
      startTimer(localStartMs);

      // Fire hands-off in background
      if (isPracticeMode && accessToken && activeAttemptIdRef.current) {
        const attemptId = activeAttemptIdRef.current;
        handsOffPracticeAttempt(attemptId, accessToken).catch((err) => {
          console.warn('[Practice Sync] hands-off in background:', err);
        });
      }
    }
  };

  // Barcode / QR scanner handler
  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (isScanningRef.current) return;
    isScanningRef.current = true;
    setIsConnecting(true);
    setConnectionError(null);

    try {
      const scannedCode = data.trim();

      // Check if QR code is Practice Remote Session
      if (scannedCode.startsWith('CUBENEXUS_PRACTICE:')) {
        const sessionId = scannedCode.replace('CUBENEXUS_PRACTICE:', '');
        setMobileTimerSessionId(sessionId);
        setIsPracticeMode(true);
        setIsOnlineMode(true);
        setIsFreeMode(false);
        setShowScanner(false);
        setPracticeScramble(null);
        Vibration.vibrate([0, 100, 50, 100]);
        console.log('[Mobile Practice Timer] Connected to Web Session:', sessionId);

        const userId = user?.id || 'default';
        await AsyncStorage.setItem(`@session_type_${userId}`, 'practice');
        await AsyncStorage.setItem(`@practice_session_id_${userId}`, sessionId);
        await AsyncStorage.setItem(`@practice_qr_${userId}`, scannedCode);
        await AsyncStorage.setItem(`@arena_pairing_active_${userId}`, 'true');
        setHasSavedSession(true);

        // Notify server & web immediately so web closes the enlarged QR modal instantly!
        if (accessToken) {
          try {
            await connectPracticeSession(sessionId, accessToken);
            console.log('[Mobile Practice Timer] connectPracticeSession acknowledged');
          } catch (connErr) {
            console.warn('[Mobile Practice Timer] connect ping failed:', connErr);
          }

          // Sync existing session data so completedSolveCount reflects actual history
          try {
            const details = await getPracticeSessionDetail(sessionId, accessToken);
            if (details?.solves) {
              setCompletedSolveCount(details.solves.length);
              console.log('[Mobile Practice Timer] Synced solve count:', details.solves.length);
            }
            // Also set current scramble immediately & assign activeAttemptId
            let currentAttempt = await getCurrentPracticeAttempt(sessionId, accessToken);
            if (!currentAttempt?.id) {
              currentAttempt = await createPracticeAttempt(sessionId, accessToken);
            }
            if (currentAttempt?.id) {
              activeAttemptIdRef.current = currentAttempt.id;
            }
            if (currentAttempt?.scrambleSequence) {
              setPracticeScramble(currentAttempt.scrambleSequence);
              console.log('[Mobile Practice Timer] Loaded scramble & attempt ID:', currentAttempt.scrambleSequence, currentAttempt.id);
            }
          } catch (syncErr) {
            console.warn('[Mobile Practice Timer] Failed to sync session data:', syncErr);
          }
        }
        return;
      }

      const devInfo = `${Device.brand || 'Device'} ${Device.modelName || 'Model'} (${Platform.OS})`;

      console.log('[Mobile Timer] Connecting with token:', scannedCode);
      const res = await connectMobileTimer({
        qrSessionCode: scannedCode,
        deviceInfo: devInfo,
      }, accessToken || '');

      setMatchId(res.matchId);
      setDeviceSessionToken(scannedCode);
      setMobileTimerSessionId(res.sessionId);
      setIsPracticeMode(false);
      setIsOnlineMode(true);
      setIsFreeMode(false);
      setShowScanner(false);
      Vibration.vibrate([0, 100, 50, 100]); // Success pattern vibration

      // Save pairing details in AsyncStorage
      const userId = user?.id || 'default';
      await AsyncStorage.setItem(`@session_type_${userId}`, 'arena');
      await AsyncStorage.setItem(`@arena_pairing_active_${userId}`, 'true');
      await AsyncStorage.setItem(`@arena_match_id_${userId}`, res.matchId);
      await AsyncStorage.setItem(`@arena_device_session_token_${userId}`, scannedCode);
      await AsyncStorage.setItem(`@arena_mobile_timer_session_id_${userId}`, res.sessionId);
      setHasSavedSession(true);

    } catch (err: any) {
      console.error('[Mobile Timer] Connection failed:', err);
      setConnectionError('Unable to connect. Please check your QR code or connection and try again.');
      // Allow another scan attempt after 1.5 seconds if failed
      setTimeout(() => {
        isScanningRef.current = false;
      }, 1500);
    } finally {
      setIsConnecting(false);
    }
  };

  const startScannerFlow = async () => {
    setConnectionError(null);
    isScanningRef.current = false; // Reset lock when opening scanner
    if (!cameraPermission?.granted) {
      const r = await requestCameraPermission();
      if (!r.granted) {
        setConnectionError('Camera permissions are required to scan the pairing QR code.');
        return;
      }
    }
    setShowScanner(true);
  };

  const handleDisconnect = async () => {
    const currentSessionId = mobileTimerSessionId;
    const wasPractice = isPracticeMode;

    const performDisconnect = async () => {
      if (wasPractice && currentSessionId && accessToken) {
        disconnectPracticeSession(currentSessionId, accessToken).catch((err) => {
          console.warn('[Mobile Timer] Disconnect API error:', err);
        });
      }

      setIsOnlineMode(false);
      setIsPracticeMode(false);
      setIsFreeMode(false);
      setPracticeScramble(null);
      setMatchId('');
      setDeviceSessionToken('');
      setMobileTimerSessionId('');
      setTime(0);
      Vibration.vibrate(100);
      setHasSavedSession(true); // Keep reconnect available
      const userId = user?.id || 'default';
      try {
        await AsyncStorage.setItem(`@arena_pairing_active_${userId}`, 'false');
      } catch (e) {
        console.error('[Mobile Timer] Error saving pairing active state to false:', e);
      }
    };

    const title = isPracticeMode ? "Exit Practice Session?" : "Exit Arena?";
    const message = isPracticeMode
      ? "Are you sure you want to disconnect from this practice session?"
      : "Are you sure you want to exit the Online Arena? You can reconnect later using the Reconnect button.";

    if (Platform.OS === 'web') {
      const ok = confirm(message);
      if (ok) performDisconnect();
    } else {
      Alert.alert(
        title,
        message,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Exit", style: "destructive", onPress: performDisconnect }
        ]
      );
    }
  };

  const handleQuickReconnect = async () => {
    if (!accessToken) {
      console.log('[Mobile Timer] Reconnect aborted: missing accessToken');
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);

    try {
      const userId = user?.id || 'default';
      const sessionType = (await AsyncStorage.getItem(`@session_type_${userId}`)) || 'practice';

      if (sessionType === 'practice') {
        const practiceSessionId = await AsyncStorage.getItem(`@practice_session_id_${userId}`);
        if (!practiceSessionId) {
          setHasSavedSession(false);
          setIsConnecting(false);
          setConnectionError('No saved practice session found. Please scan QR on Web.');
          return;
        }

        console.log('[Mobile Timer] Reconnecting to Practice Session:', practiceSessionId);
        try {
          await connectPracticeSession(practiceSessionId, accessToken);
          try {
            const details = await getPracticeSessionDetail(practiceSessionId, accessToken);
            if (details?.solves) setCompletedSolveCount(details.solves.length);
          } catch (_) {}

          let currentAttempt = await getCurrentPracticeAttempt(practiceSessionId, accessToken);
          if (!currentAttempt?.id) {
            currentAttempt = await createPracticeAttempt(practiceSessionId, accessToken);
          }
          if (currentAttempt?.id) activeAttemptIdRef.current = currentAttempt.id;
          if (currentAttempt?.scrambleSequence) setPracticeScramble(currentAttempt.scrambleSequence);

          setMobileTimerSessionId(practiceSessionId);
          setIsPracticeMode(true);
          setIsOnlineMode(true);
          setIsFreeMode(false);
          setHasSavedSession(true);
          Vibration.vibrate([0, 100, 50, 100]);
        } catch (practiceErr: any) {
          console.warn('[Mobile Timer] Practice Reconnect failed:', practiceErr);
          await clearSavedArenaPairing();
          setHasSavedSession(false);
          setConnectionError('This practice session has ended. Please scan QR on Web for a new session.');
        }
      } else {
        const savedToken = await AsyncStorage.getItem(`@arena_device_session_token_${userId}`);
        if (!savedToken) {
          setHasSavedSession(false);
          setIsConnecting(false);
          setConnectionError('No saved arena match found. Please scan QR.');
          return;
        }

        console.log('[Mobile Timer] Reconnecting to Arena match token:', savedToken);
        const devInfo = `${Device.brand || 'Device'} ${Device.modelName || 'Model'} (${Platform.OS})`;
        const res = await connectMobileTimer({
          qrSessionCode: savedToken,
          deviceInfo: devInfo,
        }, accessToken);

        setMatchId(res.matchId);
        setDeviceSessionToken(savedToken);
        setMobileTimerSessionId(res.sessionId);
        setIsPracticeMode(false);
        setIsOnlineMode(true);
        setIsFreeMode(false);
        setHasSavedSession(true);
        Vibration.vibrate([0, 100, 50, 100]);
      }
    } catch (err: any) {
      console.error('[Mobile Timer] Quick reconnect failed:', err);
      if (err.status === 404 || err.status === 400 || err.status === 409 || err.status === 403 || err.status === 401) {
        setConnectionError('This session has ended or is no longer active.');
        await clearSavedArenaPairing();
        setHasSavedSession(false);
      } else {
        setConnectionError('Failed to reconnect. Check your internet connection.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Stats calculation
  const getBestTime = () => {
    if (solves.length === 0) return '-';
    const times = solves.map((s) => s.time);
    return formatTime(Math.min(...times)) + 's';
  };

  const getAverage = () => {
    if (solves.length === 0) return '-';
    const sum = solves.reduce((acc, s) => acc + s.time, 0);
    return formatTime(sum / solves.length) + 's';
  };

  const getAo5 = () => {
    if (solves.length < 5) return '-';
    const lastFive = solves.slice(0, 5).map((s) => s.time);
    const sorted = [...lastFive].sort((a, b) => a - b);
    const middleThree = sorted.slice(1, 4);
    const sum = middleThree.reduce((acc, t) => acc + t, 0);
    return formatTime(sum / 3) + 's';
  };

  const getTimerColor = () => {
    switch (status) {
      case 'holding':
        return '#ef4444'; // Red (holding)
      case 'ready':
        return '#06d6a0'; // Emerald Green (ready to release)
      case 'running':
        return '#06d6a0'; // Emerald Green (running timer - matches web green)
      case 'stopped':
        return '#06d6a0'; // Emerald Green (completed solve time - matches web green)
      case 'idle':
      default:
        return '#ca8a04'; // Amber Gold (0.00 ready for new solve)
    }
  };

  const clearSession = () => {
    setSolves([]);
    setTime(0);
  };

  const isTimerActive = isOnlineMode;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea}>

        {/* ── VIEW 1: PRE-TIMER HUB (Minimalist English) ── */}
        {!isTimerActive && (
          <View style={styles.hubContainer}>
            {/* Hub Header */}
            <View style={[styles.hubHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.headerLogoRow}>
                <Image
                  source={require('@/assets/images/logoCube.png')}
                  style={styles.miniLogo}
                  resizeMode="contain"
                />
                <View style={styles.miniBrandRow}>
                  <Text style={[styles.miniBrandText, { color: colors.text }]}>CUBE</Text>
                  <Text style={[styles.miniBrandText, { color: scheme === 'dark' ? colors.accent : colors.primary }]}>NEXUS</Text>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: colors.backgroundSelected }]}>
                <Text style={[styles.statusBadgeText, { color: colors.success }]}>● READY</Text>
              </View>
            </View>

            <View style={styles.hubContent}>
              {/* Minimal Hero */}
              <View style={styles.hubHero}>
                <View style={[styles.hubIconCircle, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
                  <MaterialCommunityIcons name="qrcode-scan" size={36} color={colors.primary} />
                </View>
                <Text style={[styles.hubTitle, { color: colors.text }]}>Mobile Timer</Text>
                <Text style={[styles.hubSubtitle, { color: colors.textSecondary }]}>
                  Scan QR code on Web to pair device
                </Text>
              </View>

              {/* Main Primary Action: Scan QR Button */}
              <TouchableOpacity
                style={[styles.bigScanButton, { backgroundColor: colors.primary }]}
                activeOpacity={0.88}
                onPress={startScannerFlow}
              >
                <MaterialCommunityIcons name="camera-outline" size={18} color="#fff" />
                <Text style={styles.bigScanTitle}>Scan QR Code</Text>
              </TouchableOpacity>

              {/* Quick Reconnect if previously paired */}
              {hasSavedSession && (
                <TouchableOpacity
                  style={[styles.quickReconnectBtn, { borderColor: '#06d6a0', backgroundColor: 'rgba(6, 214, 160, 0.08)' }]}
                  activeOpacity={0.85}
                  onPress={handleQuickReconnect}
                  disabled={isConnecting}
                >
                  {isConnecting && (
                    <ActivityIndicator size="small" color="#06d6a0" style={{ marginRight: 6 }} />
                  )}
                  <Text style={[styles.quickReconnectText, { color: '#06d6a0' }]}>
                    {isConnecting ? 'Reconnecting...' : 'Reconnect Previous Session'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── VIEW 2: ACTIVE TIMER SCREEN (Toàn bộ code và UI timer gốc khi đã kết nối Online/Practice) ── */}
        {isTimerActive && (
          <>
            {/* Navigation Header */}
            {status !== 'running' && (
              <View style={[styles.header, { borderBottomColor: colors.border }]}>
                {isConnecting ? (
                  <View style={styles.connectLoadingBtn}>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={[styles.connectBtnText, { color: colors.accent, marginLeft: 4 }]}>Linking...</Text>
                  </View>
                ) : (
                  <TouchableOpacity onPress={handleDisconnect} style={[styles.disconnectBtn, isPracticeMode && { borderColor: '#f59e0b' }]}>
                    <MaterialCommunityIcons name="lan-disconnect" size={20} color={isPracticeMode ? '#f59e0b' : '#ef4444'} />
                    <Text style={[styles.disconnectBtnText, isPracticeMode && { color: '#f59e0b' }]}>
                      {isPracticeMode ? 'Exit Practice' : 'Exit Arena'}
                    </Text>
                  </TouchableOpacity>
                )}

                <View style={styles.headerLogoRow}>
                  <Image
                    source={require('@/assets/images/logoCube.png')}
                    style={styles.miniLogo}
                    resizeMode="contain"
                  />
                  <View style={styles.miniBrandRow}>
                    <Text style={[styles.miniBrandText, { color: colors.text }]}>CUBE</Text>
                    <Text style={[styles.miniBrandText, { color: scheme === 'dark' ? colors.accent : colors.primary }]}>NEXUS</Text>
                  </View>
                </View>

                {isOnlineMode ? (
                  <View style={{ width: 40 }} />
                ) : (
                  <TouchableOpacity onPress={clearSession} style={styles.clearButton}>
                    <MaterialCommunityIcons name="refresh" size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Practice Mode Banner + Scramble */}
            {isOnlineMode && isPracticeMode && status !== 'running' && (
              <View style={[styles.arenaBanner, { borderLeftColor: '#f59e0b', borderLeftWidth: 3 }]}>
                <View style={styles.arenaRow}>
                  <View style={[styles.arenaIndicator, { backgroundColor: '#f59e0b' }]} />
                  <Text style={[styles.arenaText, { color: '#f59e0b' }]}>🎯 PRACTICE MODE – SYNCED WITH WEB</Text>
                </View>
                {practiceScramble ? (
                  <Text style={[styles.scrambleText, { color: colors.text, marginTop: 8, textAlign: 'center', fontSize: 15 }]}>
                    {practiceScramble}
                  </Text>
                ) : (
                  <Text style={[styles.arenaSubtext, { color: colors.textSecondary }]}>
                    Fetching scramble sequence from Web...
                  </Text>
                )}
              </View>
            )}

            {/* Arena Online Banner (PvP - no scramble on mobile) */}
            {isOnlineMode && !isPracticeMode && status !== 'running' && (
              <View style={styles.arenaBanner}>
                <View style={styles.arenaRow}>
                  <View style={styles.arenaIndicator} />
                  <Text style={styles.arenaText}>⚔️ ARENA ONLINE MODE ACTIVE</Text>
                </View>
                <Text style={[styles.arenaSubtext, { color: scheme === 'dark' ? 'rgba(255,255,255,0.4)' : colors.textSecondary }]}>
                  Look at PC screen for scramble sequence.
                </Text>
              </View>
            )}

            {/* Scramble Display (Offline Only) */}
            {!isOnlineMode && status !== 'running' && (
              <View style={styles.scrambleContainer}>
                <Text style={[styles.scrambleLabel, { color: colors.primary }]}>SCRAMBLE</Text>
                <Text style={[styles.scrambleText, { color: colors.text }]}>{scramble}</Text>
              </View>
            )}

            {/* Timer Trigger & Visual Display Area */}
            <TouchableOpacity
              style={[
                styles.timerArea,
                isOnlineMode && styles.arenaTimerArea,
                status === 'holding' && styles.areaHolding,
                status === 'ready' && styles.areaReady
              ]}
              activeOpacity={1}
              onPressIn={handleTouchStart}
              onPressOut={handleTouchEnd}
            >
              <View style={styles.timerDisplayWrapper}>
                {status === 'idle' && isOnlineMode && !isPracticeMode && !isUploading && (
                  <MaterialCommunityIcons name="sword-cross" size={24} color="rgba(255, 137, 17, 0.4)" style={{ marginBottom: 8 }} />
                )}
                {/* Badge for latest solve if previous solves completed and waiting for new solve */}
                {lastCompletedTime !== null && status === 'idle' && isPracticeMode && (
                  <View style={{ backgroundColor: 'rgba(6, 214, 160, 0.15)', borderColor: '#06d6a0', borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 16, alignItems: 'center' }}>
                    <Text style={{ color: '#06d6a0', fontWeight: '800', fontSize: 13 }}>
                      ✓ Solved #{completedSolveCount}: {formatTime(lastCompletedTime)}s
                    </Text>
                  </View>
                )}

                {/* Giant Timer Display - ALWAYS INSTANT, NEVER BLOCKED BY SPINNER */}
                <Text
                  style={[
                    styles.timerText,
                    {
                      color:
                        status === 'holding'
                          ? '#ef4444'
                          : status === 'ready'
                          ? '#06d6a0'
                          : status === 'running'
                          ? '#06d6a0'
                          : status === 'stopped'
                          ? '#06d6a0'
                          : '#ca8a04',
                    },
                  ]}
                >
                  {formatTime(time)}
                </Text>

                {status === 'stopped' && (
                  <Text style={[styles.helperText, { color: '#06d6a0' }]}>
                    {isUploading
                      ? '💾 SYNCING WITH WEB...'
                      : isPracticeMode
                      ? 'TAP SCREEN TO START NEXT SOLVE (RESET TO 0)'
                      : 'TAP TO RESET TIMER TO 0'}
                  </Text>
                )}
                {status === 'idle' && (
                  <Text style={[styles.helperText, { color: isOnlineMode && !isPracticeMode ? colors.accent : colors.textSecondary }]}>
                    {isPracticeMode
                      ? 'TOUCH AND HOLD TO ARM TIMER'
                      : isOnlineMode
                      ? 'ONLINE DUEL: PRESS & HOLD TO START'
                      : 'TOUCH AND HOLD TO ARM TIMER'}
                  </Text>
                )}
                {status === 'holding' && (
                  <Text style={[styles.helperText, { color: '#ef4444' }]}>
                    {isPracticeMode ? '⏳ HOLD ON... WAIT FOR GREEN LIGHT' : 'WAIT FOR GREEN...'}
                  </Text>
                )}
                {status === 'ready' && (
                  <Text style={[styles.helperText, { color: '#06d6a0' }]}>
                    {isPracticeMode ? '🟢 RELEASE TO START SOLVING!' : 'RELEASE TO START'}
                  </Text>
                )}
                {status === 'running' && (
                  <Text style={[styles.helperText, { color: '#06d6a0' }]}>
                    {isPracticeMode ? '⏱️ TAP SCREEN TO STOP TIMER' : 'TAP ANYWHERE TO STOP'}
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            {/* Session Stats & Solve History (Offline Only) */}
            {status !== 'running' && !isOnlineMode && (
              <View style={[styles.historySection, { backgroundColor: colors.backgroundElement, borderTopColor: colors.border }]}>

                {/* Quick Stats */}
                <View style={[styles.statsBar, { borderBottomColor: colors.border }]}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Ao5</Text>
                    <Text style={[styles.statValue, { color: scheme === 'dark' ? colors.accent : colors.primary }]}>{getAo5()}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Session Avg</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>{getAverage()}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Best</Text>
                    <Text style={[styles.statValue, { color: colors.success }]}>{getBestTime()}</Text>
                  </View>
                </View>

                {/* Solves History */}
                <View style={styles.historyListWrapper}>
                  <View style={styles.historyHeader}>
                    <Text style={[styles.historyTitle, { color: colors.text }]}>
                      Solves List ({solves.length})
                    </Text>
                  </View>

                  {solves.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <MaterialCommunityIcons name="cube-outline" size={48} color={colors.border} />
                      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No solves recorded yet in this session.
                      </Text>
                    </View>
                  ) : (
                    <FlatList
                      data={solves}
                      keyExtractor={(item) => item.id}
                      showsVerticalScrollIndicator={false}
                      renderItem={({ item, index }) => (
                        <View style={[styles.solveItem, { borderBottomColor: colors.border }]}>
                          <View style={styles.solveNumberWrapper}>
                            <Text style={[styles.solveIndex, { color: colors.textSecondary }]}>
                              #{solves.length - index}
                            </Text>
                            <Text style={[styles.solveTime, { color: colors.text }]}>
                              {item.timeString}s
                            </Text>
                          </View>
                          <Text style={[styles.solveScramble, { color: colors.textSecondary }]} numberOfLines={1}>
                            {item.scramble}
                          </Text>
                        </View>
                      )}
                    />
                  )}
                </View>

              </View>
            )}

            {/* Online Arena / Practice Info display */}
            {isOnlineMode && status !== 'running' && (
              <View style={[styles.historySection, styles.arenaHistorySection, { backgroundColor: colors.backgroundElement }]}>
                <MaterialCommunityIcons
                  name={isPracticeMode ? "target" : "sword-cross"}
                  size={48}
                  color={isPracticeMode ? '#f59e0b' : colors.accent}
                  style={{ opacity: 0.8, marginBottom: 12, transform: [{ scale: 1.1 }] }}
                />
                <Text style={[styles.arenaActiveHeader, { color: isPracticeMode ? '#f59e0b' : colors.accent }]}>
                  {isPracticeMode ? 'PRACTICE SESSION CONNECTED' : 'MATCH ARENA CONNECTED'}
                </Text>
                <Text style={[styles.arenaActiveText, { color: colors.textSecondary }]}>
                  {isPracticeMode
                    ? 'Your mobile timer is synchronized with the Web practice session. Solve times and scrambles are updated in real-time.'
                    : 'Your mobile timer is securely linked to the PC arena match. Solving times are instantly transmitted to the server when you stop the timer.'}
                </Text>
                {connectionError && (
                  <Text style={styles.errorText}>{connectionError}</Text>
                )}
              </View>
            )}
          </>
        )}

        {/* QR Scanner Modal */}
        <Modal
          visible={showScanner}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowScanner(false)}
        >
          <View style={styles.scannerContainer}>
            {cameraPermission?.granted ? (
              <CameraView
                style={StyleSheet.absoluteFillObject}
                onBarcodeScanned={handleBarcodeScanned}
              />
            ) : (
              <View style={styles.permissionContainer as any}>
                <Text style={styles.permissionText as any}>Camera permission required.</Text>
              </View>
            )}

            {/* Overlay Viewfinder */}
            <View style={styles.overlayContainer as any}>
              <View style={styles.scanTargetBox as any} />
              <Text style={styles.scanLabel as any}>Scan Pairing QR Code from PC setup page</Text>

              {isConnecting && (
                <View style={styles.connectingBanner as any}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.connectingText as any}>Registering Mobile Timer...</Text>
                </View>
              )}

              {connectionError && (
                <View style={styles.errorBanner as any}>
                  <Text style={styles.errorText as any}>{connectionError}</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={() => setShowScanner(false)}
                style={styles.cancelBtn as any}
              >
                <Text style={styles.cancelBtnText as any}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
  },
  headerLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniLogo: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  miniBrandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  miniBrandText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  clearButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 137, 17, 0.2)',
    backgroundColor: 'rgba(255, 137, 17, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  connectBtnText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  disconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  disconnectBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ef4444',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  connectLoadingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 137, 17, 0.2)',
    backgroundColor: 'rgba(255, 137, 17, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  arenaTimerArea: {
    borderWidth: 2,
    borderColor: 'rgba(255, 137, 17, 0.4)',
    backgroundColor: 'rgba(255, 137, 17, 0.03)',
  },
  arenaHistorySection: {
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 137, 17, 0.3)',
    backgroundColor: 'rgba(255, 137, 17, 0.01)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arenaBanner: {
    backgroundColor: 'rgba(255, 137, 17, 0.06)',
    borderColor: 'rgba(255, 137, 17, 0.2)',
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
  },
  arenaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  arenaIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff8911',
  },
  arenaText: {
    color: '#ff8911',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  arenaSubtext: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 9,
    fontWeight: '700',
  },
  scrambleContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrambleLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  scrambleText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  timerArea: {
    flex: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  areaHolding: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  areaReady: {
    backgroundColor: 'rgba(6, 214, 160, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(6, 214, 160, 0.2)',
  },
  timerDisplayWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: 72,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  helperText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 12,
    textAlign: 'center',
  },
  historySection: {
    flex: 1,
    borderTopWidth: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 20,
  },
  styles: {}, // dummy style to keep object clean
  statsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingBottom: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  historyListWrapper: {
    flex: 1,
  },
  historyHeader: {
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  solveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  solveNumberWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  solveIndex: {
    fontSize: 12,
    fontWeight: '600',
    width: 32,
  },
  solveTime: {
    fontSize: 15,
    fontWeight: '700',
  },
  solveScramble: {
    fontSize: 12,
    maxWidth: '60%',
  },
  arenaActiveHeader: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  arenaActiveText: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scanTargetBox: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: '#ff8911',
    borderRadius: 24,
    marginBottom: 20,
  },
  scanLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 40,
  },
  connectingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1f212e',
    borderColor: '#ff8911',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 20,
  },
  connectingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#ef4444',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 20,
    maxWidth: '80%',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 10,
  },
  cancelBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cancelBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  reconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(6, 214, 160, 0.2)',
    backgroundColor: 'rgba(6, 214, 160, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  reconnectBtnText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hubContainer: {
    flex: 1,
  },
  hubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 56,
    borderBottomWidth: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  hubContent: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  hubHero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  hubIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  hubTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 4,
    textAlign: 'center',
  },
  hubSubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  bigScanButton: {
    width: '100%',
    maxWidth: 290,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  bigScanTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  quickReconnectBtn: {
    width: '100%',
    maxWidth: 290,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 10,
  },
  quickReconnectText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
