import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, useColorScheme, StatusBar, Animated, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { getPublicTournaments, getTournamentById, verifyJudgeStation } from '@/constants/api';
import { API_BASE_URL } from '@/constants/config';
import * as signalR from '@microsoft/signalr';

export default function JudgeDashboard() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'dark']; // Force dark mode
  const router = useRouter();
  const { logout, accessToken } = useAuth();

  // ─── Setup States ──────────────────────────────────────────
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [roundNumber, setRoundNumber] = useState('1');
  const [stationNumber, setStationNumber] = useState('4');

  const [activeTournament, setActiveTournament] = useState<any | null>(null);
  const [activeEvent, setActiveEvent] = useState<any | null>(null);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);

  // ─── SignalR Hub States ────────────────────────────────────
  const [hubConnection, setHubConnection] = useState<signalR.HubConnection | null>(null);
  const [isHubConnected, setIsHubConnected] = useState(false);
  const [hubStatus, setHubStatus] = useState('Disconnected');

  // ─── Verification States ───────────────────────────────────
  const [manualQr, setManualQr] = useState('');
  const [statusMessage, setStatusMessage] = useState('Please select tournament, event, round, station & click Register Station.');
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Recent judgements list
  const [recentJudgements, setRecentJudgements] = useState<any[]>([
    { id: '1', name: 'Nguyen Hoang Nam', time: '10.42s', status: 'Submitted' },
    { id: '2', name: 'Tran Minh Tu', time: '9.88s (+2)', status: 'Submitted' },
  ]);

  const handleLogout = () => {
    if (hubConnection) {
      hubConnection.stop().catch(() => undefined);
    }
    logout();
    router.replace('/login');
  };

  // Scanning laser animation
  const laserAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(laserAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(laserAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [laserAnim]);

  const translateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 180],
  });

  // Load public tournaments
  useEffect(() => {
    async function loadTournaments() {
      try {
        const tournList = await getPublicTournaments();
        setTournaments(tournList);
        if (tournList.length > 0) {
          setSelectedTournamentId(tournList[0].id);
        }
      } catch (err) {
        console.error('Failed to load tournaments:', err);
      } finally {
        setIsLoadingInitial(false);
      }
    }
    loadTournaments();
  }, []);

  // Fetch selected tournament detail
  useEffect(() => {
    if (!selectedTournamentId) return;
    async function loadDetail() {
      try {
        const detail = await getTournamentById(selectedTournamentId);
        setActiveTournament(detail);
        if (detail.events && detail.events.length > 0) {
          setSelectedEventId(detail.events[0].id);
          setActiveEvent(detail.events[0]);
        } else {
          setSelectedEventId('');
          setActiveEvent(null);
        }
      } catch (err) {
        console.error('Error fetching tournament detail:', err);
      }
    }
    loadDetail();
  }, [selectedTournamentId]);

  // Update active event
  useEffect(() => {
    if (!selectedEventId || !activeTournament) {
      setActiveEvent(null);
      return;
    }
    const ev = activeTournament.events?.find((e: any) => e.id === selectedEventId);
    setActiveEvent(ev || null);
  }, [selectedEventId, activeTournament]);

  // Connect SignalR
  const handleRegisterStation = async () => {
    if (hubConnection) {
      await hubConnection.stop().catch(() => undefined);
      setHubConnection(null);
      setIsHubConnected(false);
    }

    if (!selectedEventId || !roundNumber || !stationNumber) {
      setStatusMessage('Missing lane configurations.');
      return;
    }

    const hubUrl = `${API_BASE_URL}/hubs/tournament`;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect()
      .build();

    connection.on('ReceiveStationCommand', (payload: any) => {
      console.log('[Mobile Hub Command RECEIVED]', payload);
      if (payload.command === 'LOCK_STATION') {
        setStatusMessage('Lane locked by tournament administrators.');
      }
    });

    connection.onreconnecting((error) => {
      setIsHubConnected(false);
      setHubStatus('Reconnecting...');
      console.warn('SignalR reconnecting:', error);
    });

    connection.onreconnected(() => {
      setIsHubConnected(true);
      setHubStatus('Connected');
      connection.invoke('RegisterJudgeStation', selectedEventId, Number(roundNumber), Number(stationNumber))
        .catch(console.error);
    });

    connection.onclose(() => {
      setIsHubConnected(false);
      setHubStatus('Disconnected');
    });

    try {
      setHubStatus('Connecting...');
      await connection.start();
      setHubConnection(connection);
      setIsHubConnected(true);
      setHubStatus('Connected');
      
      await connection.invoke('RegisterJudgeStation', selectedEventId, Number(roundNumber), Number(stationNumber));
      setStatusMessage(`Registered at Station ${stationNumber}. Scan QR to begin.`);
      setErrorMessage('');
    } catch (err: any) {
      setHubStatus('Failed');
      setIsHubConnected(false);
      setStatusMessage(`SignalR registration failed: ${err.message || err}`);
    }
  };

  const handleVerify = async (qrCode: string) => {
    if (!qrCode.trim()) {
      setErrorMessage('Please scan or enter a competitor QR code.');
      return;
    }
    if (!isHubConnected) {
      setErrorMessage('Please register the station first before verifying.');
      return;
    }
    if (!accessToken) {
      setErrorMessage('Session expired. Please log in again.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');
    setStatusMessage('Verifying competitor details...');

    try {
      const res = await verifyJudgeStation({
        qrToken: qrCode.trim(),
        eventId: selectedEventId,
        roundNumber: Number(roundNumber),
        stationNumber: Number(stationNumber)
      }, accessToken);

      if (res.success && res.groupCompetitorId) {
        setStatusMessage('Competitor verified. Loading scoring lane.');
        
        // Emit status to hub
        if (hubConnection && isHubConnected) {
          await hubConnection.invoke('UpdateStationState', selectedEventId, Number(roundNumber), Number(stationNumber), 'VERIFIED', res.groupName || 'Competitor');
        }

        // Navigate to scoring
        router.push({
          pathname: '/judge/scoring',
          params: {
            playerQr: qrCode.trim(),
            groupCompetitorId: res.groupCompetitorId,
            eventId: selectedEventId,
            roundNumber: roundNumber,
            stationNumber: stationNumber,
            competitorName: res.groupName, // Used for displaying display name
            nextSolveNumber: String(res.nextSolveNumber || 1),
            solveCount: String(res.solveCount || 5),
            scrambleId: res.currentScramble?.scrambleId || '',
            scrambleSequence: res.currentScramble?.sequence || '',
            formatType: activeEvent?.eventFormatCode || 'TRADITIONAL'
          },
        });
      } else {
        setErrorMessage(res.message || 'Verification failed.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification error.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleLogout} style={styles.backButton}>
            <MaterialCommunityIcons name="logout" size={22} color={colors.text} />
          </TouchableOpacity>
          
          <View style={styles.headerLogoRow}>
            <Image
              source={require('@/assets/images/logoCube.png')}
              style={styles.miniLogo}
              resizeMode="contain"
            />
            <View style={styles.miniBrandRow}>
              <Text style={[styles.miniBrandText, { color: colors.text }]}>CUBE</Text>
              <Text style={[styles.miniBrandText, { color: colors.accent }]}>NEXUS</Text>
            </View>
          </View>

          <View style={[styles.connectionBadge, { backgroundColor: isHubConnected ? 'rgba(6, 214, 160, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
            <Text style={[styles.connectionBadgeText, { color: isHubConnected ? colors.success : '#ef4444' }]}>
              {hubStatus}
            </Text>
          </View>
        </View>

        {isLoadingInitial ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Loading Tournaments...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Lane Configuration Selection */}
            <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <Text style={[styles.manualTitle, { color: colors.accent }]}>LANE CONFIGURATION</Text>
              
              <Text style={[styles.inputLabel, { color: colors.text }]}>Select Tournament</Text>
              <View style={[styles.pickerWrapper, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tournTabRow}>
                  {tournaments.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.tournTab,
                        selectedTournamentId === t.id && { backgroundColor: colors.primary }
                      ]}
                      onPress={() => setSelectedTournamentId(t.id)}
                    >
                      <Text style={[styles.tournTabText, { color: colors.text }]}>{t.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={[styles.inputLabel, { color: colors.text, marginTop: 12 }]}>Select Event</Text>
              <View style={[styles.pickerWrapper, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tournTabRow}>
                  {activeTournament?.events?.map((e: any) => (
                    <TouchableOpacity
                      key={e.id}
                      style={[
                        styles.tournTab,
                        selectedEventId === e.id && { backgroundColor: colors.primary }
                      ]}
                      onPress={() => setSelectedEventId(e.id)}
                    >
                      <Text style={[styles.tournTabText, { color: colors.text }]}>
                        {e.puzzleTypeName} ({e.eventFormatCode})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Round</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    keyboardType="numeric"
                    value={roundNumber}
                    onChangeText={setRoundNumber}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Station</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    keyboardType="numeric"
                    value={stationNumber}
                    onChangeText={setStationNumber}
                  />
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.registerBtn, { backgroundColor: colors.primary }]}
                onPress={handleRegisterStation}
              >
                <Text style={styles.verifyButtonText}>Register Lane Connection</Text>
              </TouchableOpacity>
            </View>

            {/* Scanner Viewfinder Box */}
            <View style={[styles.card, styles.scannerCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Scan Competitor QR Code</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                Position the competitor's app QR code within the frame to verify.
              </Text>

              {/* Simulated Viewfinder */}
              <View style={styles.viewfinderContainer}>
                <View style={[styles.corner, styles.topLeft, { borderColor: colors.primary }]} />
                <View style={[styles.corner, styles.topRight, { borderColor: colors.primary }]} />
                <View style={[styles.corner, styles.bottomLeft, { borderColor: colors.primary }]} />
                <View style={[styles.corner, styles.bottomRight, { borderColor: colors.primary }]} />

                <View style={styles.cameraFill}>
                  <MaterialCommunityIcons name="qrcode-scan" size={64} color="rgba(255,255,255,0.15)" />
                  <Text style={styles.scannerStatus}>ALIGN QR CODE</Text>
                </View>

                {/* Animated Laser Line */}
                <Animated.View style={[styles.laser, { backgroundColor: colors.primary, transform: [{ translateY }] }]} />
              </View>

              {/* Status information message block */}
              <View style={styles.statusBox}>
                <Text style={{ color: colors.text, fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
                  {statusMessage}
                </Text>
              </View>

              {/* Quick Simulators for Easy Testing */}
              <Text style={[styles.simLabel, { color: colors.textSecondary }]}>QUICK SIMULATION SHORTCUTS</Text>
              <View style={styles.simButtonsContainer}>
                <TouchableOpacity 
                  style={[styles.simButton, { backgroundColor: colors.backgroundSelected }]}
                  onPress={() => handleVerify('QR-428761')}
                  disabled={isVerifying || !isHubConnected}
                >
                  <Text style={[styles.simButtonText, { color: colors.text }]}>Scan Hoang Nam (QR-428761)</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.simButton, { backgroundColor: colors.backgroundSelected }]}
                  onPress={() => handleVerify('QR-109283')}
                  disabled={isVerifying || !isHubConnected}
                >
                  <Text style={[styles.simButtonText, { color: colors.text }]}>Scan Minh Tu (QR-109283)</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Manual Input Fallback */}
            <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <Text style={[styles.manualTitle, { color: colors.text }]}>Manual Competitor Search</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  placeholder="Enter Competitor QR Code"
                  placeholderTextColor={colors.textSecondary}
                  value={manualQr}
                  onChangeText={setManualQr}
                  autoCapitalize="characters"
                />
                <TouchableOpacity 
                  style={[styles.verifyButton, { backgroundColor: colors.primary }]}
                  onPress={() => handleVerify(manualQr)}
                  disabled={isVerifying || !isHubConnected}
                >
                  {isVerifying ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.verifyButtonText}>Verify</Text>
                  )}
                </TouchableOpacity>
              </View>
              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            </View>

          </ScrollView>
        )}
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
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  connectionBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  pickerWrapper: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
  },
  tournTabRow: {
    gap: 8,
  },
  tournTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#262938',
  },
  tournTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  registerBtn: {
    marginTop: 14,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  scannerCard: {
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  viewfinderContainer: {
    width: 220,
    height: 180,
    backgroundColor: '#000',
    borderRadius: 20,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cameraFill: {
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  scannerStatus: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 10,
    opacity: 0.6,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderWidth: 4,
  },
  topLeft: {
    top: 10,
    left: 10,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 10,
    right: 10,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 10,
    left: 10,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 10,
    right: 10,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 8,
  },
  laser: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 10,
    height: 3,
  },
  statusBox: {
    width: '100%',
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 16,
  },
  simLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 8,
  },
  simButtonsContainer: {
    width: '100%',
    gap: 10,
  },
  simButton: {
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  simButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  manualTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  verifyButton: {
    width: 80,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
});
