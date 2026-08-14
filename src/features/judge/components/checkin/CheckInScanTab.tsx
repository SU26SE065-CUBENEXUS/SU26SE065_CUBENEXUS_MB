import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  ActivityIndicator, ScrollView
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CheckInRecord } from '../../types';

interface Props {
  isScanning: boolean;
  lastResult: { success: boolean; isAlreadyCheckedIn?: boolean; message: string; record?: CheckInRecord } | null;
  onScan: (qrToken: string) => Promise<void>;
  onClearResult: () => void;
}

/**
 * Validate that scanned data looks like a CubeNexus competitor QR token.
 * Accepts:
 *   - JSON string: {"RegistrationId":"...","Token":"...","ExpiresAt":"..."}
 *   - URL-encoded JSON starting with %7B
 * Rejects: plain URLs, barcodes, random strings, etc.
 */
function extractQrToken(data: string): string | null {
  console.log('[CheckIn extractQrToken] Input data:', data);
  if (!data || data.length < 10) {
    console.log('[CheckIn extractQrToken] Rejected: data too short');
    return null;
  }
  let raw = data.trim();
  // Decode URL encoding (handles both lowercase %7b and uppercase %7B)
  if (raw.toLowerCase().startsWith('%7b') || raw.toLowerCase().startsWith('%22') || raw.toLowerCase().startsWith('%257b')) {
    try { 
      raw = decodeURIComponent(raw);
      console.log('[CheckIn extractQrToken] URL-decoded raw:', raw);
    } catch (e: any) { 
      console.log('[CheckIn extractQrToken] URL-decode error:', e.message);
      return null; 
    }
  }
  
  // Double-check if decoded string still has encoded wrappers
  if (raw.toLowerCase().startsWith('%7b') || raw.toLowerCase().startsWith('%22')) {
    try {
      raw = decodeURIComponent(raw);
    } catch {}
  }

  // Case 1: JSON payload
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      console.log('[CheckIn extractQrToken] Successfully parsed JSON. Keys:', Object.keys(parsed));
      if (parsed.RegistrationId || parsed.registrationId) {
        return raw;
      } else {
        console.log('[CheckIn extractQrToken] Rejected: missing RegistrationId property');
      }
    } catch (e: any) { 
      console.log('[CheckIn extractQrToken] JSON parse error:', e.message);
    }
  } 

  // Case 2: Raw string token (like f278516635684b5592b364d881057afc seed tokens)
  if (raw.length >= 20 && !raw.includes('<') && !raw.includes('/') && !raw.includes(' ') && !raw.includes(':')) {
    console.log('[CheckIn extractQrToken] Accepted raw token format:', raw.substring(0, 8) + '...');
    return raw;
  }

  console.log('[CheckIn extractQrToken] Rejected: raw string is neither JSON nor a valid raw token. Value:', raw.substring(0, 30));
  return null;
}

export default function CheckInScanTab({ isScanning, lastResult, onScan, onClearResult }: Props) {
  const colors = useTheme();
  const [showCamera, setShowCamera] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Cooldown ref — prevents multiple rapid fires from expo-camera
  const isHandlingRef = useRef(false);
  // Track last scanned QR and time to prevent duplicate triggers for the same person
  const lastScannedQrRef = useRef<string | null>(null);
  const lastScannedTimeRef = useRef<number>(0);

  // Camera session key — changing this forces CameraView to fully remount
  const [cameraKey, setCameraKey] = useState(0);

  const laserAnim = useRef(new Animated.Value(0)).current;
  const laserAnimRef = useRef<any>(null);

  useEffect(() => {
    if (showCamera) {
      laserAnimRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(laserAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ])
      );
      laserAnimRef.current.start();
    } else {
      laserAnimRef.current?.stop();
      laserAnim.setValue(0);
    }
  }, [showCamera, laserAnim]);

  const laserY = laserAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 140] });

  const handleBarcodeScanned = useCallback(({ data }: { data: string }) => {
    // Guard 1: already handling a scan or API call in progress
    if (isHandlingRef.current || isScanning) return;

    // Guard 2: validate QR format before proceeding
    const qrToken = extractQrToken(data);
    if (!qrToken) {
      return;
    }

    // Guard 3: prevent duplicate scans of the same QR within 4 seconds
    const now = Date.now();
    if (lastScannedQrRef.current === qrToken && now - lastScannedTimeRef.current < 4000) {
      return;
    }

    // Lock immediately — synchronous, before any async work
    isHandlingRef.current = true;
    lastScannedQrRef.current = qrToken;
    lastScannedTimeRef.current = now;

    console.log('[CheckIn] Valid QR payload accepted, processing check-in...');

    // Call API without closing the camera for continuous scanning
    onScan(qrToken).finally(() => {
      // Cooldown of 1.8 seconds before allowing the next competitor scan
      setTimeout(() => {
        isHandlingRef.current = false;
      }, 1800);
    });

    // Safety timeout fallback: force release lock after 8 seconds if API hangs/fails silently
    setTimeout(() => {
      if (isHandlingRef.current) {
        isHandlingRef.current = false;
        console.log('[CheckIn] Safety lock release triggered due to timeout.');
      }
    }, 8000);
  }, [isScanning, onScan]);

  // Stable callback reference to avoid native event listener drops on re-renders
  const scanHandlerRef = useRef(handleBarcodeScanned);
  useEffect(() => {
    scanHandlerRef.current = handleBarcodeScanned;
  }, [handleBarcodeScanned]);

  const stableBarcodeScanned = useCallback((event: { data: string }) => {
    scanHandlerRef.current(event);
  }, []);

  const openCamera = async () => {
    if (!cameraPermission?.granted) {
      const r = await requestCameraPermission();
      if (!r.granted) return;
    }
    onClearResult();
    isHandlingRef.current = false; // always reset on new open
    lastScannedQrRef.current = null;
    setCameraKey(prev => prev + 1); // Force a clean remount of native camera every time it opens
    setShowCamera(true);
  };

  const closeCamera = () => {
    setShowCamera(false);
    isHandlingRef.current = false;
    lastScannedQrRef.current = null;
    setCameraKey(prev => prev + 1); // Force remount on next open
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Instruction banner */}
      <View style={[styles.instructionBanner, { backgroundColor: '#10b98112', borderColor: '#10b98130' }]}>
        <MaterialCommunityIcons name="account-check-outline" size={20} color="#10b981" />
        <View style={styles.instructionText}>
          <Text style={styles.instructionTitle}>Điểm Danh Thí Sinh Tại Quầy</Text>
          <Text style={[styles.instructionSub, { color: colors.textSecondary }]}>
            Quét mã QR trên vé thi đấu của thí sinh để hoàn tất thủ tục điểm danh.
          </Text>
        </View>
      </View>

      {/* Camera / Viewfinder */}
      <View style={[styles.viewfinder, { borderColor: colors.border }]}>
        {showCamera && cameraPermission?.granted ? (
          <CameraView
            key={`camera-${cameraKey}`}
            style={StyleSheet.absoluteFillObject}
            facing="back"
            onBarcodeScanned={stableBarcodeScanned}
          />
        ) : (
          <View style={styles.cameraPlaceholder}>
            <MaterialCommunityIcons name="camera-outline" size={36} color="rgba(255,255,255,0.15)" />
            <Text style={styles.cameraPlaceholderText}>SẴN SÀNG MỞ CAMERA</Text>
          </View>
        )}
        {showCamera && (
          <Animated.View
            style={[styles.laser, { backgroundColor: '#10b981', transform: [{ translateY: laserY }] }]}
          />
        )}
        {/* Scan frame corners */}
        {showCamera && (
          <>
            <View style={[styles.corner, styles.cornerTL, { borderColor: '#10b981' }]} />
            <View style={[styles.corner, styles.cornerTR, { borderColor: '#10b981' }]} />
            <View style={[styles.corner, styles.cornerBL, { borderColor: '#10b981' }]} />
            <View style={[styles.corner, styles.cornerBR, { borderColor: '#10b981' }]} />
          </>
        )}
      </View>

      {/* Camera toggle button */}
      <TouchableOpacity
        style={[styles.cameraBtn, { backgroundColor: showCamera ? '#dc2626' : '#10b981' }]}
        onPress={showCamera ? closeCamera : openCamera}
        disabled={isScanning}
      >
        {isScanning ? (
          <>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.cameraBtnText}>Đang xử lý điểm danh…</Text>
          </>
        ) : (
          <>
            <MaterialCommunityIcons name={showCamera ? 'camera-off' : 'camera'} size={16} color="#fff" />
            <Text style={styles.cameraBtnText}>
              {showCamera ? 'Tắt Camera' : 'Mở Quét Mã QR'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Result feedback */}
      {lastResult && (() => {
        const isAlreadyChecked = lastResult.isAlreadyCheckedIn || lastResult.record?.statusCode === 'ALREADY_CHECKED_IN';
        const boxBg = !lastResult.success ? '#ef444412' : isAlreadyChecked ? '#f59e0b14' : '#10b98112';
        const boxBorder = !lastResult.success ? '#ef444440' : isAlreadyChecked ? '#f59e0b40' : '#10b98140';
        const iconName = !lastResult.success ? 'alert-circle' : isAlreadyChecked ? 'alert-circle' : 'check-circle';
        const iconColor = !lastResult.success ? '#ef4444' : isAlreadyChecked ? '#f59e0b' : '#10b981';
        const titleText = !lastResult.success
          ? 'Điểm Danh Thất Bại'
          : isAlreadyChecked
            ? 'Thí Sinh Đã Điểm Danh'
            : 'Điểm Danh Thành Công';

        return (
          <View style={[styles.resultBox, { backgroundColor: boxBg, borderColor: boxBorder }]}>
            <View style={styles.resultRow}>
              <MaterialCommunityIcons name={iconName as any} size={20} color={iconColor} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.resultTitle, { color: iconColor }]}>
                  {titleText}
                </Text>
                <Text style={[styles.resultMessage, { color: colors.textSecondary }]}>
                  {lastResult.message}
                </Text>
                {lastResult.record && lastResult.record.competitorName !== '—' && (
                  <Text style={[styles.resultName, { color: colors.text }]}>
                    {lastResult.record.competitorName}
                  </Text>
                )}
                {lastResult.record && (
                  <Text style={[styles.resultMeta, { color: colors.textSecondary }]}>
                    {new Date(lastResult.record.checkedInAt).toLocaleTimeString()}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={onClearResult} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <MaterialCommunityIcons name="close" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        );
      })()}

      {/* Scan hint */}
      <View style={[styles.hintBox, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="information-outline" size={11} color={colors.textSecondary} />
        <Text style={[styles.hintText, { color: colors.textSecondary }]}>
          Chỉ chấp nhận mã QR vé thi đấu CubeNexus chính thức của giải. Mỗi thí sinh có một mã QR điểm danh duy nhất.
        </Text>
      </View>
    </ScrollView>
  );
}

const CORNER_SIZE = 18;
const CORNER_THICKNESS = 2.5;

const styles = StyleSheet.create({
  scrollContent: { padding: 16, gap: 12 },
  instructionBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 12, borderRadius: 12, borderWidth: 1, padding: 12,
  },
  instructionText: { flex: 1 },
  instructionTitle: { fontSize: 13, fontWeight: '800', color: '#10b981', marginBottom: 2 },
  instructionSub: { fontSize: 11, lineHeight: 15 },
  viewfinder: {
    height: 220, borderRadius: 14, borderWidth: 1,
    overflow: 'hidden', backgroundColor: '#0a0a0f',
    justifyContent: 'center', alignItems: 'center',
  },
  cameraPlaceholder: { alignItems: 'center', gap: 6 },
  cameraPlaceholderText: {
    color: 'rgba(255,255,255,0.2)', fontSize: 9, fontWeight: '800', letterSpacing: 1,
  },
  laser: { position: 'absolute', left: 10, right: 10, top: 10, height: 2, opacity: 0.85 },
  // Corner frame markers
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE },
  cornerTL: { top: 12, left: 12, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
  cornerTR: { top: 12, right: 12, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
  cornerBL: { bottom: 12, left: 12, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
  cornerBR: { bottom: 12, right: 12, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
  cameraBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 46, borderRadius: 10,
  },
  cameraBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  resultBox: { borderRadius: 12, borderWidth: 1, padding: 12 },
  resultRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  resultTitle: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  resultMessage: { fontSize: 11, lineHeight: 15 },
  resultName: { fontSize: 14, fontWeight: '900', marginTop: 4 },
  resultMeta: { fontSize: 10, marginTop: 2 },
  hintBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 5, borderRadius: 8, borderWidth: 1, padding: 8,
  },
  hintText: { fontSize: 10, lineHeight: 14, flex: 1 },
});
