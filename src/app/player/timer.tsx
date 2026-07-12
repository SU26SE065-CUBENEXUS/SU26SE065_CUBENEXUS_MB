import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, FlatList, useColorScheme, StatusBar, Vibration, Image, Modal, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '@/contexts/AuthContext';
import { connectMobileTimer, submitMobileTimerTime } from '@/constants/api';
import * as Device from 'expo-device';

type TimerStatus = 'idle' | 'holding' | 'ready' | 'running';

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
  const { accessToken } = useAuth();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [status, setStatus] = useState<TimerStatus>('idle');
  const [time, setTime] = useState<number>(0);
  const [scramble, setScramble] = useState<string>('');
  const [solves, setSolves] = useState<Solve[]>([]);

  // Online Arena State
  const [isOnlineMode, setIsOnlineMode] = useState(false);
  const [matchId, setMatchId] = useState('');
  const [deviceSessionToken, setDeviceSessionToken] = useState('');
  const [mobileTimerSessionId, setMobileTimerSessionId] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const timerIntervalRef = useRef<any>(null);
  const startTimestampRef = useRef<number>(0);
  const armingTimeoutRef = useRef<any>(null);

  // Generate initial scramble
  useEffect(() => {
    setScramble(generateScramble());
  }, []);

  const startTimer = useCallback(() => {
    setStatus('running');
    startTimestampRef.current = Date.now();
    timerIntervalRef.current = setInterval(() => {
      setTime(Date.now() - startTimestampRef.current);
    }, 10);
  }, []);

  const stopTimer = useCallback(async () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    const finalTime = Date.now() - startTimestampRef.current;
    setTime(finalTime);
    
    if (isOnlineMode && accessToken) {
      // Automatically upload solve time to online match arena
      setIsUploading(true);
      try {
        await submitMobileTimerTime({
          matchId,
          mobileTimerSessionId,
          deviceSessionToken,
          timeMs: finalTime,
          isDnf: false,
          stoppedAt: new Date().toISOString(),
        }, accessToken);
        console.log('[Mobile Timer] Solve time uploaded:', finalTime);
        Vibration.vibrate(80); // Quick success confirmation
      } catch (err: any) {
        console.error('[Mobile Timer] Solve time upload failed:', err);
        Vibration.vibrate([100, 100, 100]); // 3 vibrates for error warning
      } finally {
        setIsUploading(false);
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
    }
    setStatus('idle');
  }, [scramble, isOnlineMode, matchId, mobileTimerSessionId, deviceSessionToken, accessToken]);

  // Touch handlers
  const handleTouchStart = () => {
    if (status === 'running') {
      stopTimer();
    } else if (status === 'idle') {
      setStatus('holding');
      armingTimeoutRef.current = setTimeout(() => {
        setStatus('ready');
        Vibration.vibrate(50); // Light haptic feedback
      }, 700); // 700ms holding to arm
    }
  };

  const handleTouchEnd = () => {
    if (status === 'holding') {
      if (armingTimeoutRef.current) {
        clearTimeout(armingTimeoutRef.current);
      }
      setStatus('idle');
    } else if (status === 'ready') {
      startTimer();
    }
  };

  // Barcode / QR scanner handler
  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (isConnecting) return;
    setIsConnecting(true);
    setConnectionError(null);

    try {
      const scannedCode = data.trim();
      const devInfo = `${Device.brand || 'Device'} ${Device.modelName || 'Model'} (${Platform.OS})`;
      
      console.log('[Mobile Timer] Connecting with token:', scannedCode);
      const res = await connectMobileTimer({
        qrSessionCode: scannedCode,
        deviceInfo: devInfo,
      }, accessToken || '');

      setMatchId(res.matchId);
      setDeviceSessionToken(scannedCode);
      setMobileTimerSessionId(crypto.randomUUID());
      setIsOnlineMode(true);
      setShowScanner(false);
      Vibration.vibrate([0, 100, 50, 100]); // Success pattern vibration
    } catch (err: any) {
      console.error('[Mobile Timer] Connection failed:', err);
      setConnectionError(err.message || 'Connection failed.');
    } finally {
      setIsConnecting(false);
    }
  };

  const startScannerFlow = async () => {
    setConnectionError(null);
    if (!cameraPermission?.granted) {
      const r = await requestCameraPermission();
      if (!r.granted) {
        setConnectionError('Camera permissions are required to scan the pairing QR code.');
        return;
      }
    }
    setShowScanner(true);
  };

  const handleDisconnect = () => {
    setIsOnlineMode(false);
    setMatchId('');
    setDeviceSessionToken('');
    setMobileTimerSessionId('');
    setTime(0);
    Vibration.vibrate(100);
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
        return '#ef4444'; // Red
      case 'ready':
        return '#06d6a0'; // Green
      case 'running':
        return colors.text; // Dynamic theme text color
      default:
        return colors.text;
    }
  };

  const clearSession = () => {
    setSolves([]);
    setTime(0);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea}>
        
        {/* Navigation Header */}
        {status !== 'running' && (
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            {isOnlineMode ? (
              <TouchableOpacity onPress={handleDisconnect} style={styles.disconnectBtn}>
                <MaterialCommunityIcons name="lan-disconnect" size={20} color="#ef4444" />
                <Text style={styles.disconnectBtnText}>Exit Arena</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={startScannerFlow} style={styles.connectBtn}>
                <MaterialCommunityIcons name="qrcode-scan" size={16} color={scheme === 'dark' ? colors.accent : colors.primary} />
                <Text style={[styles.connectBtnText, { color: scheme === 'dark' ? colors.accent : colors.primary }]}>Pair PC Arena</Text>
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

        {/* Online Active Banner */}
        {isOnlineMode && status !== 'running' && (
          <View style={styles.arenaBanner}>
            <View style={styles.arenaRow}>
              <View style={styles.arenaIndicator} />
              <Text style={styles.arenaText}>ARENA ONLINE MODE ACTIVE</Text>
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
            status === 'holding' && styles.areaHolding,
            status === 'ready' && styles.areaReady
          ]}
          activeOpacity={1}
          onPressIn={handleTouchStart}
          onPressOut={handleTouchEnd}
        >
          <View style={styles.timerDisplayWrapper}>
            {isUploading ? (
              <ActivityIndicator size="large" color={colors.accent} />
            ) : (
              <Text style={[styles.timerText, { color: getTimerColor() }]}>
                {formatTime(time)}
              </Text>
            )}
            
            {status === 'idle' && !isUploading && (
              <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                TOUCH AND HOLD TO ARM TIMER
              </Text>
            )}
            {status === 'holding' && (
              <Text style={[styles.helperText, { color: '#ef4444' }]}>
                WAIT FOR GREEN...
              </Text>
            )}
            {status === 'ready' && (
              <Text style={[styles.helperText, { color: '#06d6a0' }]}>
                RELEASE TO START
              </Text>
            )}
            {status === 'running' && (
              <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                TAP ANYWHERE TO STOP
              </Text>
            )}
            {isUploading && (
              <Text style={[styles.helperText, { color: colors.accent }]}>
                UPLOADING TIME TO ARENA...
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

        {/* Online Arena Info display */}
        {isOnlineMode && status !== 'running' && (
          <View style={[styles.historySection, { backgroundColor: colors.backgroundElement, borderTopColor: colors.border, justifyContent: 'center', alignItems: 'center' }]}>
            <MaterialCommunityIcons name="sword-cross" size={64} color={colors.accent} style={{ opacity: 0.15, marginBottom: 12 }} />
            <Text style={[styles.arenaActiveHeader, { color: colors.text }]}>MATCH ARENA CONNECTED</Text>
            <Text style={[styles.arenaActiveText, { color: colors.textSecondary }]}>
              Session is linked to the browser match page. Time will be submitted automatically upon stopping the timer.
            </Text>
            {connectionError && (
              <Text style={styles.errorText}>{connectionError}</Text>
            )}
          </View>
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
    borderWidth: 0.5,
    borderColor: '#1f212e',
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
  arenaBanner: {
    backgroundColor: 'rgba(6, 214, 160, 0.06)',
    borderColor: 'rgba(6, 214, 160, 0.2)',
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
    backgroundColor: '#06d6a0',
  },
  arenaText: {
    color: '#06d6a0',
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
});
