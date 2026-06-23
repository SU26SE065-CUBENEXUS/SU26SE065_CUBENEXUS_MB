import React, { useState, useMemo, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, useColorScheme, StatusBar, Alert, PanResponder, GestureResponderEvent, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Penalty = 'None' | '+2' | 'DNF';

interface Point {
  x: number;
  y: number;
}

export default function JudgeScoring() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'dark']; // Force dark mode
  const router = useRouter();
  const params = useLocalSearchParams();

  // Scanned QR code
  const playerQr = (params.playerQr as string) || 'QR-428761';

  // Mock Database Lookup based on QR Code
  const competitorInfo = useMemo(() => {
    const database: Record<string, { name: string; id: string; event: string }> = {
      'QR-428761': { name: 'Nguyen Hoang Nam', id: '2024NAMH01', event: '3x3x3 Cube' },
      'QR-109283': { name: 'Tran Minh Tu', id: '2025TUMT02', event: '3x3x3 Cube' },
    };

    return database[playerQr] || { name: 'Guest Competitor', id: '2026GUES01', event: '3x3x3 Cube' };
  }, [playerQr]);

  const [round, setRound] = useState('Solve 1');
  const [attempt, setAttempt] = useState('1');
  const [stackmat, setStackmat] = useState('');
  const [penalty, setPenalty] = useState<Penalty>('None');
  const [signName, setSignName] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  // E-Signature Pad Drawing State
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);

  // Calculate Final Result
  const finalTime = useMemo(() => {
    if (penalty === 'DNF') return 'DNF';
    const parsed = parseFloat(stackmat);
    if (isNaN(parsed) || parsed <= 0) return '0.00s';
    const adjusted = penalty === '+2' ? parsed + 2 : parsed;
    return `${adjusted.toFixed(2)}s`;
  }, [penalty, stackmat]);

  // Touch drawing handlers
  const handleTouchDraw = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    // Add point to drawing
    setDrawingPoints((prev) => [...prev, { x: locationX, y: locationY }]);
  };

  const clearSignature = () => {
    setDrawingPoints([]);
    setSignName('');
  };

  const handleSubmit = () => {
    if (!stackmat.trim() || isNaN(parseFloat(stackmat))) {
      Alert.alert('Missing Info', 'Please enter a valid Stackmat time.');
      return;
    }
    if (drawingPoints.length === 0 && !signName.trim()) {
      Alert.alert('Signature Required', 'Please collect competitor signature or enter their name before submitting.');
      return;
    }

    setIsSubmitted(true);
  };

  const handleFinish = () => {
    // Navigate back to the judge home
    router.replace('/judge');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
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

          <View style={{ width: 40 }} />
        </View>

        {!isSubmitted ? (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Competitor Details */}
            <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <Text style={[styles.cardHeaderTitle, { color: colors.primary }]}>VERIFIED COMPETITOR</Text>
              <View style={styles.competitorDetailRow}>
                <View style={styles.detailItem}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Name</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{competitorInfo.name}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>WCA ID</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{competitorInfo.id}</Text>
                </View>
              </View>
              <View style={[styles.competitorDetailRow, { marginTop: 12 }]}>
                <View style={styles.detailItem}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Event</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{competitorInfo.event}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Round / Attempt</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{round} / #{attempt}</Text>
                </View>
              </View>
            </View>

            {/* Score Entry */}
            <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <Text style={[styles.cardHeaderTitle, { color: colors.accent }]}>RESULT ENTRY</Text>
              
              <Text style={[styles.inputLabel, { color: colors.text }]}>Stackmat Time (seconds)</Text>
              <TextInput
                style={[styles.timeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                keyboardType="numeric"
                placeholder="e.g. 8.42"
                placeholderTextColor={colors.textSecondary}
                value={stackmat}
                onChangeText={setStackmat}
              />

              <Text style={[styles.inputLabel, { color: colors.text, marginTop: 16 }]}>Penalty Status</Text>
              <View style={styles.penaltyRow}>
                {(['None', '+2', 'DNF'] as Penalty[]).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.penaltyBtn,
                      { borderColor: colors.border },
                      penalty === p && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setPenalty(p)}
                  >
                    <Text style={[styles.penaltyBtnText, { color: penalty === p ? '#fff' : colors.text }]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Real-time Computed Total */}
              <View style={[styles.resultCard, { backgroundColor: colors.background }]}>
                <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>Live Computed Result</Text>
                <Text style={[styles.resultValue, { color: penalty === 'DNF' ? '#ef4444' : colors.success }]}>
                  {finalTime}
                </Text>
              </View>
            </View>

            {/* E-Signature Pad */}
            <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <View style={styles.signatureHeader}>
                <Text style={[styles.cardHeaderTitle, { color: colors.text }]}>COMPETITOR E-SIGNATURE</Text>
                <TouchableOpacity onPress={clearSignature}>
                  <Text style={[styles.clearBtnText, { color: colors.primary }]}>Clear</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                Ask the competitor to sign inside the box below to authorize the score submission.
              </Text>

              {/* Pure React Native Drawing Pad */}
              <View 
                style={[styles.signaturePad, { backgroundColor: colors.background, borderColor: colors.border }]}
                onTouchStart={handleTouchDraw}
                onTouchMove={handleTouchDraw}
              >
                {drawingPoints.map((pt, index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.drawPoint, 
                      { 
                        left: pt.x - 2, 
                        top: pt.y - 2, 
                        backgroundColor: colors.text 
                      }
                    ]} 
                  />
                ))}
                {drawingPoints.length === 0 && (
                  <View style={styles.signPlaceholder}>
                    <MaterialCommunityIcons name="gesture-double-tap" size={24} color={colors.border} />
                    <Text style={[styles.signPlaceholderText, { color: colors.textSecondary }]}>
                      Draw signature here
                    </Text>
                  </View>
                )}
              </View>

              <TextInput
                style={[styles.nameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Competitor Initials / Name Confirmation"
                placeholderTextColor={colors.textSecondary}
                value={signName}
                onChangeText={setSignName}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: colors.success }]}
              onPress={handleSubmit}
            >
              <MaterialCommunityIcons name="cloud-upload-outline" size={22} color="#fff" />
              <Text style={styles.submitButtonText}>Submit to Live Leaderboard</Text>
            </TouchableOpacity>

          </ScrollView>
        ) : (
          /* Submission Success State */
          <View style={styles.successContainer}>
            <View style={styles.successIconWrapper}>
              <MaterialCommunityIcons name="check-decagram" size={96} color={colors.success} />
            </View>
            <Text style={[styles.successTitle, { color: colors.text }]}>Result Submitted!</Text>
            <Text style={[styles.successMessage, { color: colors.textSecondary }]}>
              The result of <Text style={{ color: colors.text, fontWeight: '700' }}>{finalTime}</Text> has been successfully saved for competitor <Text style={{ color: colors.text, fontWeight: '700' }}>{competitorInfo.name}</Text>.
            </Text>
            
            <View style={[styles.successDetailsBox, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <View style={styles.successDetailRow}>
                <Text style={[styles.successDetailLabel, { color: colors.textSecondary }]}>Competitor ID</Text>
                <Text style={[styles.successDetailValue, { color: colors.text }]}>{competitorInfo.id}</Text>
              </View>
              <View style={styles.successDetailRow}>
                <Text style={[styles.successDetailLabel, { color: colors.textSecondary }]}>Attempt</Text>
                <Text style={[styles.successDetailValue, { color: colors.text }]}>{round} / attempt {attempt}</Text>
              </View>
              <View style={styles.successDetailRow}>
                <Text style={[styles.successDetailLabel, { color: colors.textSecondary }]}>Status</Text>
                <Text style={[styles.successDetailValue, { color: colors.success, fontWeight: '800' }]}>Synced Live</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={handleFinish}
            >
              <Text style={styles.primaryButtonText}>Scan Next Competitor</Text>
              <MaterialCommunityIcons name="qrcode-scan" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
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
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  competitorDetailRow: {
    flexDirection: 'row',
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  timeInput: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '700',
  },
  penaltyRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  penaltyBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  penaltyBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  resultCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  resultValue: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
  signatureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  signaturePad: {
    height: 120,
    borderWidth: 1,
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 12,
  },
  drawPoint: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  signPlaceholder: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  signPlaceholderText: {
    fontSize: 12,
    fontWeight: '600',
  },
  nameInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  submitButton: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    shadowColor: '#06d6a0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  successIconWrapper: {
    marginBottom: 20,
    shadowColor: '#06d6a0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  successDetailsBox: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginBottom: 32,
  },
  successDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  successDetailLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  successDetailValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    width: '100%',
    shadowColor: '#ff5a36',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
