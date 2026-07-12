import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { JudgeLaneConfig, JudgeStationCompetitor } from '../../types';

function extractQrToken(data: string): string | null {
  if (!data || data.length < 10) {
    return null;
  }

  let raw = data.trim();
  if (raw.toLowerCase().startsWith('%7b') || raw.toLowerCase().startsWith('%22') || raw.toLowerCase().startsWith('%257b')) {
    try {
      raw = decodeURIComponent(raw);
    } catch {
      return null;
    }
  }

  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.RegistrationId || parsed.registrationId) {
        return raw;
      }
    } catch {
      return null;
    }
  }

  if (raw.length >= 20 && !raw.includes('<') && !raw.includes('/') && !raw.includes(' ') && !raw.includes(':')) {
    return raw;
  }

  return null;
}

interface Props {
  laneConfig: JudgeLaneConfig | null;
  token: string | null;
  isHubConnected: boolean;
  hubConnection: any;
  activeEvent: any;
  onVerified: (competitor: JudgeStationCompetitor) => void;
  onSelectForScoring: (competitor: JudgeStationCompetitor) => void;
  verifyCompetitorInRoster: (qrToken: string, config: JudgeLaneConfig, token: string) => Promise<{
    success: boolean;
    message: string;
    competitor?: JudgeStationCompetitor;
    errorCode?: string;
  }>;
}

interface ScanResult {
  success: boolean;
  message: string;
  errorCode?: string;
  competitor?: JudgeStationCompetitor;
}

export default function JudgeScanTab({
  laneConfig,
  token,
  isHubConnected,
  hubConnection,
  activeEvent,
  onVerified,
  onSelectForScoring,
  verifyCompetitorInRoster,
}: Props) {
  const colors = useTheme();
  const [showCamera, setShowCamera] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isVerifying, setIsVerifying] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const isVerifyingRef = useRef(false);
  const lastScannedQrRef = useRef<string | null>(null);
  const lastScannedTimeRef = useRef<number>(0);

  const laserAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (showCamera) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(laserAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [laserAnim, showCamera]);
  const laserY = laserAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 150] });

  const handleBarcodeScanned = useCallback(({ data }: { data: string }) => {
    if (isVerifyingRef.current || !laneConfig || !token) return;

    const qrToken = extractQrToken(data);
    if (!qrToken) return;

    const now = Date.now();
    if (lastScannedQrRef.current === qrToken && now - lastScannedTimeRef.current < 4000) {
      return;
    }

    isVerifyingRef.current = true;
    setIsVerifying(true);
    setScanResult(null);
    lastScannedQrRef.current = qrToken;
    lastScannedTimeRef.current = now;

    verifyCompetitorInRoster(qrToken, laneConfig, token).then(result => {
      setScanResult(result);

      if (result.success && result.competitor) {
        onVerified(result.competitor);
        if (hubConnection && isHubConnected) {
          hubConnection.invoke(
            'UpdateStationState',
            laneConfig.eventId,
            laneConfig.roundNumber,
            laneConfig.stationNumber,
            'VERIFIED',
            result.competitor.competitorName
          ).catch(() => undefined);
        }
      }
    }).finally(() => {
      setTimeout(() => {
        setIsVerifying(false);
        isVerifyingRef.current = false;
      }, 1800);
    });
  }, [hubConnection, isHubConnected, laneConfig, onVerified, token, verifyCompetitorInRoster]);

  const scanHandlerRef = useRef(handleBarcodeScanned);
  useEffect(() => {
    scanHandlerRef.current = handleBarcodeScanned;
  }, [handleBarcodeScanned]);

  const stableBarcodeScanned = useCallback((event: { data: string }) => {
    scanHandlerRef.current(event);
  }, []);

  const openCamera = async () => {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) return;
    }

    setScanResult(null);
    isVerifyingRef.current = false;
    lastScannedQrRef.current = null;
    setCameraKey(prev => prev + 1);
    setShowCamera(true);
  };

  const closeCamera = () => {
    setShowCamera(false);
    isVerifyingRef.current = false;
    lastScannedQrRef.current = null;
    setCameraKey(prev => prev + 1);
  };

  if (!laneConfig) {
    return (
      <View style={styles.notConfigured}>
        <MaterialCommunityIcons name="connection" size={36} color={colors.border} />
        <Text style={[styles.notConfiguredTitle, { color: colors.textSecondary }]}>Station Not Configured</Text>
        <Text style={[styles.notConfiguredSub, { color: colors.textSecondary }]}>
          Go to the Station tab and register your lane connection first.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={[styles.contextChip, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="timer-check-outline" size={12} color={colors.primary} />
        <Text style={[styles.contextChipText, { color: colors.textSecondary }]}>
          Round {laneConfig.roundNumber} | Group {laneConfig.groupNumber} | Station {laneConfig.stationNumber}
        </Text>
        {activeEvent && (
          <Text style={[styles.contextChipText, { color: colors.primary }]}>
            | {activeEvent.puzzleTypeName}
          </Text>
        )}
      </View>

      <View style={[styles.viewfinder, { borderColor: colors.border }]}>
        {showCamera && cameraPermission?.granted ? (
          <CameraView
            key={`station-camera-${cameraKey}`}
            style={StyleSheet.absoluteFillObject}
            facing="back"
            onBarcodeScanned={stableBarcodeScanned}
          />
        ) : (
          <View style={styles.cameraPlaceholder}>
            <MaterialCommunityIcons name="camera-outline" size={36} color="rgba(255,255,255,0.12)" />
            <Text style={styles.cameraPlaceholderText}>CAMERA STANDBY</Text>
          </View>
        )}
        {showCamera && (
          <Animated.View
            style={[styles.laser, { backgroundColor: colors.primary, transform: [{ translateY: laserY }] }]}
          />
        )}
      </View>

      <TouchableOpacity
        style={[styles.scanBtn, { backgroundColor: showCamera ? '#dc2626' : colors.primary }]}
        onPress={showCamera ? closeCamera : openCamera}
        disabled={isVerifying}
      >
        {isVerifying ? (
          <>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.scanBtnText}>Verifying...</Text>
          </>
        ) : (
          <>
            <MaterialCommunityIcons name={showCamera ? 'camera-off' : 'qrcode-scan'} size={16} color="#fff" />
            <Text style={styles.scanBtnText}>{showCamera ? 'Cancel Scan' : 'Scan Competitor QR'}</Text>
          </>
        )}
      </TouchableOpacity>

      {scanResult && (
        <View style={[
          styles.resultBox,
          {
            backgroundColor: scanResult.success ? '#10b98112' : '#ef444412',
            borderColor: scanResult.success ? '#10b98140' : '#ef444440',
          },
        ]}>
          <View style={styles.resultHeader}>
            <MaterialCommunityIcons
              name={scanResult.success ? 'check-circle' : 'alert-circle'}
              size={20}
              color={scanResult.success ? '#10b981' : '#ef4444'}
            />
            <Text style={[styles.resultTitle, { color: scanResult.success ? '#10b981' : '#ef4444' }]}>
              {scanResult.success ? 'Competitor Verified' : 'Verification Failed'}
            </Text>
            <TouchableOpacity onPress={() => setScanResult(null)} style={{ marginLeft: 'auto' }}>
              <MaterialCommunityIcons name="close" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {scanResult.success && scanResult.competitor ? (
            <>
              <Text style={[styles.resultName, { color: colors.text }]}>{scanResult.competitor.competitorName}</Text>
              <Text style={[styles.resultMeta, { color: colors.textSecondary }]}>
                {scanResult.competitor.groupName} | Station {scanResult.competitor.stationNumber} | {scanResult.competitor.solveProgress}
              </Text>
              <TouchableOpacity
                style={[styles.scoreBtn, { backgroundColor: colors.primary }]}
                onPress={() => onSelectForScoring(scanResult.competitor!)}
              >
                <MaterialCommunityIcons name="timer-play-outline" size={14} color="#fff" />
                <Text style={styles.scoreBtnText}>Open Score Sheet</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.resultMessage, { color: colors.textSecondary }]}>{scanResult.message}</Text>
              {(scanResult.errorCode === 'NOT_CHECKED_IN' || scanResult.message.includes('NOT_CHECKED_IN')) && (
                <View style={[styles.noteBox, { backgroundColor: '#ef444412', borderColor: '#ef444430' }]}>
                  <MaterialCommunityIcons name="information-outline" size={12} color="#ef4444" />
                  <Text style={styles.noteText}>Competitor must visit Check-in Desk before scoring.</Text>
                </View>
              )}
              {scanResult.errorCode === 'NOT_IN_ROSTER' && (
                <View style={[styles.noteBox, { backgroundColor: '#ef444412', borderColor: '#ef444430' }]}>
                  <MaterialCommunityIcons name="alert-outline" size={12} color="#ef4444" />
                  <Text style={styles.noteText}>QR is valid, but this competitor is not assigned to the active Group/Station roster.</Text>
                </View>
              )}
            </>
          )}
        </View>
      )}

      <View style={[styles.instructionBox, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
        <Text style={[styles.instructionTitle, { color: colors.textSecondary }]}>Station Scan Rules</Text>
        <Text style={[styles.instructionLine, { color: colors.textSecondary }]}>- Scan only verifies a competitor already loaded from backend roster.</Text>
        <Text style={[styles.instructionLine, { color: colors.textSecondary }]}>- Backend must validate QR, registration, check-in, event, round, group, and station.</Text>
        <Text style={[styles.instructionLine, { color: colors.textSecondary }]}>- If competitor is outside this roster, scoring must stay blocked.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 12, gap: 12 },
  notConfigured: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 24 },
  notConfiguredTitle: { fontSize: 14, fontWeight: '700' },
  notConfiguredSub: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
  contextChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  contextChipText: { fontSize: 10, fontWeight: '700' },
  viewfinder: { height: 210, borderRadius: 14, borderWidth: 1, overflow: 'hidden', backgroundColor: '#0a0a0f', justifyContent: 'center', alignItems: 'center' },
  cameraPlaceholder: { alignItems: 'center', gap: 6 },
  cameraPlaceholderText: { color: 'rgba(255,255,255,0.15)', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  laser: { position: 'absolute', left: 10, right: 10, top: 10, height: 2, opacity: 0.85 },
  scanBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 10 },
  scanBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  resultBox: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultTitle: { fontSize: 13, fontWeight: '800' },
  resultName: { fontSize: 16, fontWeight: '900' },
  resultMeta: { fontSize: 11, lineHeight: 15 },
  resultMessage: { fontSize: 11, lineHeight: 15 },
  scoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 38, borderRadius: 8, marginTop: 4 },
  scoreBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, borderRadius: 8, borderWidth: 1, padding: 8, marginTop: 4 },
  noteText: { fontSize: 11, color: '#ef4444', lineHeight: 15, flex: 1 },
  instructionBox: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 4 },
  instructionTitle: { fontSize: 9, fontWeight: '800', marginBottom: 4 },
  instructionLine: { fontSize: 10, lineHeight: 15 },
});
