import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, useColorScheme, StatusBar, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function JudgeDashboard() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'dark']; // Force dark mode
  const router = useRouter();

  const [manualQr, setManualQr] = useState('');
  const [station, setStation] = useState('Station 04');
  const [event, setEvent] = useState('3x3x3 Cube - Round 1');
  const [errorMessage, setErrorMessage] = useState('');

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
    outputRange: [0, 180], // Distance to slide within the camera box
  });

  const handleVerify = (qrCode: string) => {
    if (!qrCode.trim()) {
      setErrorMessage('Please scan or enter a competitor QR code.');
      return;
    }
    setErrorMessage('');
    // Route to scoring and pass the scanned QR code as a parameter
    router.push({
      pathname: '/judge/scoring',
      params: { playerQr: qrCode },
    });
  };

  // Mock list of recent judgements
  const recentJudgements = [
    { id: '1', qr: 'QR-428761', name: 'Nguyen Hoang Nam', time: '10.42s', status: 'Submitted' },
    { id: '2', qr: 'QR-109283', name: 'Tran Minh Tu', time: '9.88s (+2)', status: 'Submitted' },
    { id: '3', qr: 'QR-887361', name: 'Lee Jae Won', time: 'DNF', status: 'Submitted' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/')} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Judge Station</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Active Station Information */}
          <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
            <View style={styles.stationRow}>
              <View>
                <Text style={[styles.stationTitle, { color: colors.text }]}>{station}</Text>
                <Text style={[styles.eventTitle, { color: colors.textSecondary }]}>{event}</Text>
              </View>
              <View style={[styles.activeBadge, { backgroundColor: 'rgba(6, 214, 160, 0.1)' }]}>
                <Text style={[styles.activeBadgeText, { color: colors.success }]}>ACTIVE</Text>
              </View>
            </View>
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

            {/* Quick Simulators for Easy Testing */}
            <Text style={[styles.simLabel, { color: colors.textSecondary }]}>QUICK SIMULATION SHORTCUTS</Text>
            <View style={styles.simButtonsContainer}>
              <TouchableOpacity 
                style={[styles.simButton, { backgroundColor: colors.backgroundSelected }]}
                onPress={() => handleVerify('QR-428761')}
              >
                <Text style={[styles.simButtonText, { color: colors.text }]}>Scan Hoang Nam (QR-428761)</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.simButton, { backgroundColor: colors.backgroundSelected }]}
                onPress={() => handleVerify('QR-109283')}
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
                placeholder="Enter Competitor QR Code (e.g. QR-428761)"
                placeholderTextColor={colors.textSecondary}
                value={manualQr}
                onChangeText={setManualQr}
                autoCapitalize="characters"
              />
              <TouchableOpacity 
                style={[styles.verifyButton, { backgroundColor: colors.primary }]}
                onPress={() => handleVerify(manualQr)}
              >
                <Text style={styles.verifyButtonText}>Verify</Text>
              </TouchableOpacity>
            </View>
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          </View>

          {/* Recent Submissions */}
          <Text style={[styles.historyTitleText, { color: colors.text }]}>Recent Judgements</Text>
          <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border, padding: 0 }]}>
            {recentJudgements.map((item, idx) => (
              <View key={item.id} style={[styles.historyRow, { borderBottomColor: idx < recentJudgements.length - 1 ? colors.border : 'transparent' }]}>
                <View style={styles.historyLeft}>
                  <Text style={[styles.competitorName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.competitorQr, { color: colors.textSecondary }]}>{item.qr}</Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={[styles.solveTime, { color: colors.primary }]}>{item.time}</Text>
                  <View style={styles.submittedBadge}>
                    <MaterialCommunityIcons name="check-circle" size={14} color={colors.success} />
                    <Text style={[styles.submittedText, { color: colors.success }]}>{item.status}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

        </ScrollView>
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
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
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
  stationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stationTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  activeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
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
    height: 220,
    backgroundColor: '#000',
    borderRadius: 20,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
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
    shadowColor: '#ff5a36',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 4,
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
    fontWeight: '700',
    fontSize: 14,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  historyTitleText: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
    marginTop: 8,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  historyLeft: {
    gap: 4,
  },
  competitorName: {
    fontSize: 14,
    fontWeight: '700',
  },
  competitorQr: {
    fontSize: 12,
    fontWeight: '600',
  },
  historyRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  solveTime: {
    fontSize: 15,
    fontWeight: '800',
  },
  submittedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  submittedText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
