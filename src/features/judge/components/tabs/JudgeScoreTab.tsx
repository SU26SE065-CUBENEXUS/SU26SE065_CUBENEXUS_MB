import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  GestureResponderEvent,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { JudgeStationCompetitor, PenaltyMode } from '../../types';
import { useJudgeScoring } from '../../services/judgeService';
import { getActiveEvent, getActiveTournament, getLaneConfig } from '../../services/judgeStore';

interface Props {
  selectedCompetitor: JudgeStationCompetitor | null;
  token: string | null;
  onGoToRoster: () => void;
  onScoreComplete: () => void;
  onGoToScan: () => void;
}

interface Point {
  x: number;
  y: number;
}

export default function JudgeScoreTab({
  selectedCompetitor,
  token,
  onGoToRoster,
  onScoreComplete,
  onGoToScan,
}: Props) {
  const colors = useTheme();
  const laneConfig = getLaneConfig();
  const tournament = getActiveTournament();
  const event = getActiveEvent();
  const formatType = event?.eventFormatCode || 'TRADITIONAL';

  const groupCompetitorId = selectedCompetitor?.groupCompetitorId || '';

  const {
    activeSolveNumber,
    totalSolveCount,
    submittedSolveCount,
    currentScramble,
    stackmat,
    setStackmat,
    penalty,
    setPenalty,
    signName,
    setSignName,
    isSubmitted,
    isSubmitting,
    drawingPoints,
    setDrawingPoints,
    medleySolves,
    setMedleySolves,
    isLoading,
    evidencePhotos,
    setEvidencePhotos,
    addEvidencePhoto,
    removeEvidencePhoto,
    submitScore,
    prepareNextSolve,
    leaveScoreScreen,
  } = useJudgeScoring(groupCompetitorId, token, formatType);

  const convertAssetToBase64 = async (asset: ImagePicker.ImagePickerAsset): Promise<string | null> => {
    const rawMime = (asset.mimeType || '').toLowerCase();
    // Normalize iPhone HEIC/HEIF/QuickTime formats to standard image/jpeg
    const mimeType = rawMime.includes('heic') || rawMime.includes('heif') || rawMime.includes('quicktime') || !rawMime
      ? 'image/jpeg'
      : asset.mimeType;

    // Pass 1: Expo ImagePicker base64 property
    if (asset.base64 && asset.base64.length > 0) {
      return `data:${mimeType};base64,${asset.base64}`;
    }

    if (!asset.uri) return null;

    // Pass 2: expo-file-system readAsStringAsync
    try {
      const b64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: 'base64' as any,
      });
      if (b64 && b64.length > 0) {
        return `data:${mimeType};base64,${b64}`;
      }
    } catch (fsErr) {
      console.warn('[JudgeScoreTab] FileSystem.readAsStringAsync failed:', fsErr);
    }

    // Pass 3: fetch API + FileReader blob conversion (handles Android content:// and iOS ph:// URIs)
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const dataUri = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          if (res && res.startsWith('data:image')) {
            resolve(res);
          } else if (res && res.includes(',')) {
            resolve(`data:${mimeType};base64,${res.split(',')[1]}`);
          } else {
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
      if (dataUri) return dataUri;
    } catch (fetchErr) {
      console.warn('[JudgeScoreTab] fetch blob conversion failed:', fetchErr);
    }

    return null;
  };

  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Quyền máy ảnh', 'Ứng dụng cần quyền sử dụng máy ảnh để chụp ảnh minh chứng.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const dataUri = await convertAssetToBase64(result.assets[0]);
        if (dataUri) {
          addEvidencePhoto(dataUri);
        } else {
          Alert.alert('Lỗi ảnh', 'Không thể đọc dữ liệu ảnh chụp. Vui lòng thử chọn lại.');
        }
      }
    } catch (err: any) {
      Alert.alert('Lỗi máy ảnh', err.message || 'Không thể mở máy ảnh.');
    }
  };

  const handlePickMultiplePhotos = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Quyền truy cập', 'Ứng dụng cần quyền truy cập thư viện ảnh để đính kèm minh chứng.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.7,
        base64: true,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        for (const asset of result.assets) {
          try {
            const dataUri = await convertAssetToBase64(asset);
            if (!dataUri) {
              console.warn('[JudgeScoreTab] Could not convert photo to base64, skipping:', asset.uri);
              Alert.alert('Lỗi ảnh', 'Không thể đọc tệp ảnh này. Vui lòng chọn ảnh khác.');
              continue;
            }
            addEvidencePhoto(dataUri);
          } catch (assetErr) {
            console.warn('[JudgeScoreTab] Failed to process photo asset:', assetErr);
          }
        }
      }
    } catch (err: any) {
      if (typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.onchange = (e: any) => {
          const files: File[] = Array.from(e.target.files || []);
          files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                addEvidencePhoto(event.target.result as string);
              }
            };
            reader.readAsDataURL(file);
          });
        };
        input.click();
      } else {
        Alert.alert('Lỗi chọn ảnh', err.message || 'Không thể mở thư viện ảnh.');
      }
    }
  };

  const handleSelectPhotoSource = () => {
    Alert.alert(
      'Đính Kèm Ảnh Minh Chứng',
      'Vui lòng chọn nguồn ảnh:',
      [
        { text: '📷 Chụp Ảnh Trực Tiếp', onPress: handleTakePhoto },
        { text: '🖼️ Chọn Từ Thư Viện', onPress: handlePickMultiplePhotos },
        { text: 'Hủy', style: 'cancel' },
      ]
    );
  };

  const finalTime = useMemo(() => {
    if (penalty === 'DNF') return 'DNF';
    const parsed = parseFloat(stackmat);
    if (isNaN(parsed) || parsed <= 0) return '0.00s';
    return `${(penalty === '+2' ? parsed + 2 : parsed).toFixed(2)}s`;
  }, [penalty, stackmat]);

  const medleyResult = useMemo(() => {
    if (medleySolves.some((solve: any) => solve.penalty === 'DNF')) return 'DNF';
    const total = medleySolves.reduce((sum: number, solve: any) => {
      const parsed = parseFloat(solve.time || '0');
      return sum + (isNaN(parsed) ? 0 : parsed + (solve.penalty === '+2' ? 2 : 0));
    }, 0);
    return `${total.toFixed(2)}s`;
  }, [medleySolves]);

  const isFormValid = useMemo(() => {
    const timeOk = formatType === 'MEDLEY'
      ? medleySolves.length > 0 && !medleySolves.some((solve: any) => !solve.time.trim() || isNaN(parseFloat(solve.time)) || parseFloat(solve.time) <= 0)
      : (stackmat.trim() && !isNaN(parseFloat(stackmat)) && parseFloat(stackmat) > 0) || penalty === 'DNF';
    const signOk = drawingPoints.length > 0 || signName.trim().length > 0;
    return timeOk && signOk;
  }, [drawingPoints, formatType, medleySolves, penalty, signName, stackmat]);

  const hasNextSolve = Boolean(selectedCompetitor?.canSubmit && selectedCompetitor?.nextSolveNumber);

  const handleTouchDraw = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    setDrawingPoints((prev: Point[]) => [...prev, { x: locationX, y: locationY }]);
  };

  const clearSignature = () => {
    setDrawingPoints([]);
    setSignName('');
  };

  const handleSubmit = async () => {
    if (!isFormValid) {
      Alert.alert('Missing Fields', 'Please complete score duration and competitor signature.');
      return;
    }
    const result = await submitScore();
    if (!result.success) {
      Alert.alert('Submission Failed', result.message || 'An error occurred during submission.');
    }
  };

  const handleSaveContinue = async () => {
    await prepareNextSolve();
  };

  const handleBackToRoster = () => {
    leaveScoreScreen();
    onScoreComplete();
  };

  const handleBackToScan = () => {
    leaveScoreScreen();
    onGoToScan();
  };

  const updateMedleySolve = (index: number, field: string, value: string) => {
    setMedleySolves((current: any[]) => current.map((solve: any, solveIndex: number) => (
      solveIndex === index ? { ...solve, [field]: value } : solve
    )));
  };

  if (!selectedCompetitor) {
    return (
      <View style={styles.emptyWrap}>
        <MaterialCommunityIcons name="timer-off-outline" size={40} color={colors.border} />
        <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Chưa Chọn Thí Sinh Chấm Điểm</Text>
        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
          Vui lòng quét mã QR hoặc chọn thí sinh từ mục Danh Sách để tiến hành nhập điểm.
        </Text>
        <TouchableOpacity style={[styles.goRosterBtn, { borderColor: colors.border }]} onPress={onGoToRoster}>
          <Text style={[styles.goRosterText, { color: colors.primary }]}>Mở Danh Sách Thí Sinh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loaderText, { color: colors.textSecondary }]}>Đang nạp thông tin lượt thi…</Text>
      </View>
    );
  }

  if (selectedCompetitor.backendStatus === 'DONE' && !isSubmitted) {
    return (
      <View style={styles.emptyWrap}>
        <MaterialCommunityIcons name="check-decagram" size={40} color="#10b981" />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Thí Sinh Đã Hoàn Thành Các Lượt Thi</Text>
        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
          Hệ thống ghi nhận thí sinh đã hoàn thành {selectedCompetitor.submittedSolveCount}/{selectedCompetitor.totalSolveCount} lượt thi.
        </Text>
        <TouchableOpacity style={[styles.goRosterBtn, { borderColor: colors.border }]} onPress={handleBackToRoster}>
          <Text style={[styles.goRosterText, { color: colors.primary }]}>Trở Về Danh Sách Thí Sinh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isSubmitted) {
    return (
      <View style={styles.successWrap}>
        <MaterialCommunityIcons name="check-decagram" size={64} color="#10b981" />
        <Text style={[styles.successTitle, { color: colors.text }]}>Đã Lưu Kết Quả Thi Đấu</Text>
        <Text style={[styles.successSub, { color: colors.textSecondary }]}>
          Kết quả lượt thi đã được xác nhận và lưu vào hệ thống thành công.
        </Text>

        <View style={[styles.successBox, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.successRow}>
            <Text style={[styles.successLabel, { color: colors.textSecondary }]}>Đấu Thủ</Text>
            <Text style={[styles.successVal, { color: colors.text }]}>{selectedCompetitor.competitorName}</Text>
          </View>
          <View style={styles.successRow}>
            <Text style={[styles.successLabel, { color: colors.textSecondary }]}>Tiến Trình</Text>
            <Text style={[styles.successVal, { color: colors.text }]}>{submittedSolveCount}/{totalSolveCount} lượt thi</Text>
          </View>
        </View>

        <View style={{ gap: 10, width: '100%' }}>
          {hasNextSolve && (
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleSaveContinue}>
              <Text style={styles.primaryBtnText}>Lưu & Chấm Lượt Tiếp Theo</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border }]} onPress={handleBackToRoster}>
            <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Lưu & Trở Về Danh Sách Thí Sinh</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border }]} onPress={handleBackToScan}>
            <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Lưu & Quét Thí Sinh Tiếp Theo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.topActions}>
        <TouchableOpacity style={[styles.topActionBtn, { borderColor: colors.border }]} onPress={handleBackToRoster}>
          <MaterialCommunityIcons name="arrow-left" size={14} color={colors.text} />
          <Text style={[styles.topActionText, { color: colors.text }]}>Danh Sách</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.topActionBtn, { borderColor: colors.border }]} onPress={handleBackToScan}>
          <MaterialCommunityIcons name="qrcode-scan" size={14} color={colors.text} />
          <Text style={[styles.topActionText, { color: colors.text }]}>Quét Mã</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.ctxCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
        <Text style={[styles.ctxTournament, { color: colors.primary }]}>{tournament?.name || 'Giải Thi Đấu'}</Text>
        <Text style={[styles.ctxLine, { color: colors.text }]}>
          {event?.puzzleTypeName || 'Hạng Mục'} | Vòng {laneConfig?.roundNumber || 1} | Station {laneConfig?.stationNumber || 1}
        </Text>
        <View style={styles.ctxSep} />
        <View style={styles.ctxRow}>
          <View>
            <Text style={styles.ctxLabel}>ĐẤU THỦ</Text>
            <Text style={[styles.ctxValue, { color: colors.text }]}>{selectedCompetitor.competitorName}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.ctxLabel}>LƯỢT THI</Text>
            <Text style={[styles.ctxValue, { color: colors.accent }]}>Lượt {activeSolveNumber}/{totalSolveCount}</Text>
          </View>
        </View>
      </View>

      {formatType !== 'MEDLEY' && currentScramble.sequence ? (
        <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="cube-outline" size={14} color={colors.accent} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>MÃ TRÁO CẦU THI ĐẤU (SCRAMBLE)</Text>
          </View>
          <View style={[styles.scrambleBox, { backgroundColor: colors.background }]}>
            <Text style={styles.scrambleText}>{currentScramble.sequence}</Text>
          </View>
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="timer-outline" size={14} color={colors.accent} />
          <Text style={[styles.cardTitle, { color: colors.accent }]}>NHẬP THỜI GIAN THI ĐẤU</Text>
        </View>

        {formatType !== 'MEDLEY' ? (
          <View>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Thời gian Stackmat (giây)</Text>
            <TextInput
              style={[styles.timeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              value={stackmat}
              onChangeText={value => { if (!value.includes('-')) setStackmat(value); }}
            />
            <Text style={[styles.fieldLabel, { color: colors.text, marginTop: 12 }]}>Hình phạt WCA (Penalty)</Text>
            <View style={styles.penaltyRow}>
              {(['None', '+2', 'DNF'] as PenaltyMode[]).map(mode => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.penaltyBtn, { borderColor: colors.border }, penalty === mode && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setPenalty(mode)}
                >
                  <Text style={[styles.penaltyBtnText, { color: penalty === mode ? '#fff' : colors.text }]}>{mode}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[styles.resultCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>Thời Gian Quyết Định</Text>
              <Text style={[styles.resultValue, { color: penalty === 'DNF' ? '#ef4444' : colors.primary }]}>{finalTime}</Text>
            </View>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {medleySolves.map((solve: any, index: number) => (
              <View key={solve.medleyPuzzleId} style={styles.medleyRow}>
                <Text style={[styles.medleyLabel, { color: colors.text }]}>{solve.puzzleName}</Text>
                <TextInput
                  style={[styles.medleyInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  keyboardType="numeric"
                  placeholder="Thời gian"
                  placeholderTextColor={colors.textSecondary}
                  value={solve.time}
                  onChangeText={value => { if (!value.includes('-')) updateMedleySolve(index, 'time', value); }}
                />
                <View style={{ flexDirection: 'row', gap: 3 }}>
                  {(['None', '+2', 'DNF'] as PenaltyMode[]).map(mode => (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.medleyPenBtn, { borderColor: colors.border }, solve.penalty === mode && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => updateMedleySolve(index, 'penalty', mode)}
                    >
                      <Text style={{ fontSize: 9, fontWeight: '800', color: solve.penalty === mode ? '#fff' : colors.text }}>{mode}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
            <View style={[styles.resultCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>Tổng Thời Gian Medley</Text>
              <Text style={[styles.resultValue, { color: medleyResult === 'DNF' ? '#ef4444' : colors.primary }]}>{medleyResult}</Text>
            </View>
          </View>
        )}
      </View>

      {/* EVIDENCE PHOTOS & SCORE SHEET CARD */}
      <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
        <View style={styles.signatureHeader}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="camera-outline" size={14} color={colors.accent} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>ẢNH MINH CHỨNG & TỜ GHI ĐIỂM</Text>
          </View>
          {evidencePhotos.length > 0 && (
            <TouchableOpacity onPress={() => setEvidencePhotos([])}>
              <Text style={[styles.clearText, { color: '#ef4444' }]}>Xóa Tất Cả ({evidencePhotos.length})</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.signSubtitle, { color: colors.textSecondary }]}>
          Đính kèm ảnh minh chứng tờ ghi điểm hoặc ảnh chụp kết quả thi đấu (cho phép chọn nhiều ảnh).
        </Text>

        {/* Photo Thumbnails Preview */}
        {evidencePhotos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {evidencePhotos.map((photoUri, index) => (
                <View key={index} style={{ position: 'relative' }}>
                  <Image
                    source={{ uri: photoUri }}
                    style={{ width: 70, height: 70, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
                  />
                  <View style={{ position: 'absolute', top: 3, left: 3, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800' }}>#{index + 1}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeEvidencePhoto(index)}
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      backgroundColor: '#ef4444',
                      borderRadius: 10,
                      width: 20,
                      height: 20,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 1.5,
                      borderColor: colors.backgroundElement,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Add Photo Button */}
        <TouchableOpacity
          style={[styles.photoAddBtn, { borderColor: colors.primary, backgroundColor: colors.background }]}
          onPress={handleSelectPhotoSource}
        >
          <MaterialCommunityIcons name="camera-plus-outline" size={16} color={colors.primary} />
          <Text style={[styles.photoAddBtnText, { color: colors.primary }]}>
            {evidencePhotos.length === 0 ? '📷 Chụp / Chọn Ảnh Tờ Ghi Điểm Minh Chứng' : `+ Thêm Ảnh Khác (${evidencePhotos.length} ảnh đã chọn)`}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
        <View style={styles.signatureHeader}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="signature" size={14} color={colors.accent} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>XÁC NHẬN CHỮ KÝ THÍ SINH</Text>
          </View>
          <TouchableOpacity onPress={clearSignature}>
            <Text style={[styles.clearText, { color: colors.primary }]}>Xóa Ký Tên</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.signSubtitle, { color: colors.textSecondary }]}>
          Thí sinh ký tên vào khung bên dưới để xác nhận kết quả lượt thi đấu.
        </Text>
        <View
          style={[styles.signPad, { backgroundColor: colors.background, borderColor: colors.border }]}
          onTouchStart={handleTouchDraw}
          onTouchMove={handleTouchDraw}
        >
          {drawingPoints.map((point: Point, index: number) => (
            <View
              key={index}
              style={[styles.drawPoint, { left: point.x - 2, top: point.y - 2, backgroundColor: colors.text } as any]}
            />
          ))}
          {drawingPoints.length === 0 && (
            <View style={styles.signPlaceholder as any}>
              <MaterialCommunityIcons name="gesture-double-tap" size={14} color={colors.border} />
              <Text style={[styles.signPlaceholderText, { color: colors.textSecondary }]}>Thí sinh ký tên tại đây</Text>
            </View>
          )}
        </View>
        <TextInput
          style={[styles.nameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
          placeholder="Hoặc nhập tên viết tắt thí sinh"
          placeholderTextColor={colors.textSecondary}
          value={signName}
          onChangeText={setSignName}
        />
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: isFormValid ? '#10b981' : colors.border, opacity: isFormValid ? 1 : 0.5 }]}
        onPress={handleSubmit}
        disabled={isSubmitting || !isFormValid}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#fff" />
            <Text style={styles.submitBtnText}>XÁC NHẬN VÀ LƯU KẾT QUẢ</Text>
          </View>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 24 },
  emptyTitle: { fontSize: 14, fontWeight: '700' },
  emptySub: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
  goRosterBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 8, marginTop: 8 },
  goRosterText: { fontSize: 12, fontWeight: '800' },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loaderText: { fontSize: 12, fontWeight: '600' },
  scroll: { padding: 14, gap: 12, paddingBottom: 30 },
  topActions: { flexDirection: 'row', gap: 8 },
  topActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topActionText: { fontSize: 11, fontWeight: '800' },
  ctxCard: { borderRadius: 14, borderWidth: 1, padding: 14 },
  ctxTournament: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  ctxLine: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  ctxSep: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 10 },
  ctxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ctxLabel: { fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: '800' },
  ctxValue: { fontSize: 14, fontWeight: '900', marginTop: 1 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cardTitle: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  scrambleBox: { borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#262938' },
  scrambleText: { fontSize: 12, fontFamily: 'monospace', color: '#10b981', lineHeight: 16, fontWeight: '700', textAlign: 'center' },
  fieldLabel: { fontSize: 10, fontWeight: '800', marginBottom: 4 },
  timeInput: { height: 42, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 15, fontWeight: '800' },
  penaltyRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  penaltyBtn: { flex: 1, height: 34, borderRadius: 6, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  penaltyBtnText: { fontSize: 11, fontWeight: '800' },
  resultCard: { marginTop: 12, padding: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  resultLabel: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  resultValue: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  medleyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  medleyLabel: { fontSize: 10, fontWeight: '800', flex: 1.2 },
  medleyInput: { flex: 1, height: 32, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, fontSize: 11, fontWeight: '800' },
  medleyPenBtn: { width: 28, height: 24, borderRadius: 5, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  signatureHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  clearText: { fontSize: 11, fontWeight: '800' },
  signSubtitle: { fontSize: 10, lineHeight: 14, marginBottom: 8 },
  photoAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 42,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  photoAddBtnText: { fontSize: 11, fontWeight: '800' },

  signPad: { height: 90, borderWidth: 1, borderRadius: 8, position: 'relative', overflow: 'hidden', marginBottom: 8 },
  drawPoint: { position: 'absolute', width: 3, height: 3, borderRadius: 1.5 },
  signPlaceholder: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', gap: 2 },
  signPlaceholderText: { fontSize: 10, fontWeight: '800' },
  nameInput: { height: 34, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, fontSize: 11 },
  submitBtn: { flexDirection: 'row', height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', gap: 6 },
  submitBtnText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingTop: 30 },
  successTitle: { fontSize: 18, fontWeight: '900', marginTop: 8, marginBottom: 4 },
  successSub: { fontSize: 11, textAlign: 'center', lineHeight: 16, marginBottom: 16 },
  successBox: { width: '100%', borderRadius: 12, borderWidth: 1, padding: 12, gap: 8, marginBottom: 20 },
  successRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  successLabel: { fontSize: 10, fontWeight: '700' },
  successVal: { fontSize: 12, fontWeight: '800' },
  primaryBtn: { flexDirection: 'row', height: 42, borderRadius: 8, justifyContent: 'center', alignItems: 'center', gap: 6, width: '100%' },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  secondaryBtn: { borderWidth: 1, height: 42, borderRadius: 8, justifyContent: 'center', alignItems: 'center', width: '100%' },
  secondaryBtnText: { fontWeight: '800', fontSize: 12 },
});
