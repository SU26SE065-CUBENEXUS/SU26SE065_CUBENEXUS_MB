import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getApiBaseUrl,
  saveCustomApiBaseUrl,
  resetCustomApiBaseUrl,
  DEFAULT_API_BASE_URL,
} from '@/constants/config';

export default function LoginScreen() {
  const colors = useTheme();
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // ── Secret Server Switcher (Tap logo 5 times) ──
  const [serverModalVisible, setServerModalVisible] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [currentApiUrl, setCurrentApiUrl] = useState(getApiBaseUrl());
  const [tapCount, setTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);

  const handleLogoTap = () => {
    const now = Date.now();
    if (now - lastTapTime > 2000) {
      setTapCount(1);
    } else {
      const next = tapCount + 1;
      setTapCount(next);
      if (next >= 5) {
        setCustomUrlInput(getApiBaseUrl());
        setCurrentApiUrl(getApiBaseUrl());
        setServerModalVisible(true);
        setTapCount(0);
      }
    }
    setLastTapTime(now);
  };

  const handleSaveCustomUrl = async () => {
    const trimmed = customUrlInput.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      Alert.alert('URL không hợp lệ', 'Địa chỉ URL phải bắt đầu bằng http:// hoặc https://');
      return;
    }
    try {
      const saved = await saveCustomApiBaseUrl(trimmed);
      setCurrentApiUrl(saved);
      setServerModalVisible(false);
      Alert.alert('Thành công', `Đã áp dụng Server API mới:\n\n${saved}`);
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không thể lưu URL Server');
    }
  };

  const handleResetDefault = async () => {
    try {
      const def = await resetCustomApiBaseUrl();
      setCustomUrlInput(def);
      setCurrentApiUrl(def);
      setServerModalVisible(false);
      Alert.alert('Khôi phục', `Đã quay về Server mặc định:\n\n${def}`);
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không thể khôi phục URL');
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await login(email.trim(), password);
      // Login successful! Redirect to gatekeeper index which handles role-based routing.
      router.replace('/');
    } catch (err: any) {
      console.error('Login error details:', err);
      setError(err.message || 'Incorrect email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* Background glow effects */}
      <View style={styles.glowContainer}>
        <View style={[styles.glowBall, { backgroundColor: colors.primary, top: -100, left: -50, opacity: 0.12 }]} />
        <View style={[styles.glowBall, { backgroundColor: colors.accent, bottom: -150, right: -50, opacity: 0.08 }]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.innerContainer}>
              {/* Header Section */}
            <View style={styles.header}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleLogoTap}
                style={[styles.logoContainer, { backgroundColor: colors.background, borderColor: colors.border }]}
              >
                <Image
                  source={require('@/assets/images/logoCube.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </TouchableOpacity>

              <View style={styles.brandRow}>
                <Text style={[styles.brandText, { color: colors.text }]}>CUBE</Text>
                <Text style={[styles.brandText, { color: colors.accent }]}>NEXUS</Text>
              </View>

              <View style={styles.sloganRow}>
                <Text style={[styles.sloganText, { color: colors.textSecondary }]}>SOLVE</Text>
                <View style={styles.greenDot} />
                <Text style={[styles.sloganText, { color: colors.textSecondary }]}>COMPETE</Text>
                <View style={styles.redDot} />
                <Text style={[styles.sloganText, { color: colors.textSecondary }]}>INSPIRE</Text>
              </View>
            </View>

            {/* Login Card Container */}
            <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Sign In</Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                Competitor & Judge Mobile Portal
              </Text>

              {/* Error Banner */}
              {error ? (
                <View style={[styles.errorBanner, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }]}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#ef4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Email Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Email Address</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: colors.background,
                      borderColor: emailFocused ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="email-outline"
                    size={20}
                    color={emailFocused ? colors.accent : colors.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={(val) => {
                      setEmail(val);
                      if (error) setError('');
                    }}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    editable={!isLoading}
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Password</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: colors.background,
                      borderColor: passwordFocused ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="lock-outline"
                    size={20}
                    color={passwordFocused ? colors.accent : colors.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="Enter password"
                    placeholderTextColor={colors.textSecondary}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={password}
                    onChangeText={(val) => {
                      setPassword(val);
                      if (error) setError('');
                    }}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    disabled={isLoading}
                  >
                    <MaterialCommunityIcons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: colors.primary, opacity: isLoading ? 0.8 : 1 },
                ]}
                activeOpacity={0.8}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>Sign In</Text>
                    <MaterialCommunityIcons name="arrow-right" size={18} color="#ffffff" />
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                CubeNexus Mobile Platform
              </Text>
            </View>

            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* ── Secret Server Switcher Modal (Chạm 5 lần logo) ── */}
      <Modal
        visible={serverModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setServerModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="server-network" size={24} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>Server API Switcher</Text>
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Thay đổi địa chỉ Backend để kết nối tới ngrok, máy LAN hoặc server cloud mà không cần build lại APK.
            </Text>

            <View style={[styles.activeUrlBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.activeUrlLabel, { color: colors.textSecondary }]}>URL đang dùng:</Text>
              <Text style={[styles.activeUrlText, { color: colors.primary }]} numberOfLines={1} ellipsizeMode="middle">
                {currentApiUrl}
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Nhập URL Backend mới:</Text>
              <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="https://...ngrok-free.dev"
                  placeholderTextColor={colors.textSecondary}
                  value={customUrlInput}
                  onChangeText={setCustomUrlInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                {customUrlInput ? (
                  <TouchableOpacity onPress={() => setCustomUrlInput('')} style={styles.eyeButton}>
                    <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* Quick preset buttons */}
            <View style={styles.quickPresetRow}>
              <TouchableOpacity
                style={[styles.quickPresetBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={() => setCustomUrlInput('https://perfectly-detail-gory.ngrok-free.dev')}
              >
                <Text style={[styles.quickPresetText, { color: colors.accent }]}>⚡ Dán Ngrok</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickPresetBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={() => setCustomUrlInput(DEFAULT_API_BASE_URL)}
              >
                <Text style={[styles.quickPresetText, { color: colors.textSecondary }]}>☁️ Mặc định Railway</Text>
              </TouchableOpacity>
            </View>

            {/* Action buttons */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setServerModalVisible(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveCustomUrl}
              >
                <Text style={styles.saveBtnText}>Lưu & Áp dụng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  glowContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 0,
  },
  glowBall: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  safeArea: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  innerContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 70,
    height: 70,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#ff5a36',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  logoImage: {
    width: 54,
    height: 54,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  brandText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  sloganRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  sloganText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
  },
  greenDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#22c55e',
  },
  redDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ef4444',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    marginBottom: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12.5,
    fontWeight: '500',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    height: '100%',
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 4,
  },
  submitButton: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    shadowColor: '#ff5a36',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
    paddingVertical: 10,
  },
  footerText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 16,
  },
  activeUrlBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  activeUrlLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  activeUrlText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  quickPresetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  quickPresetBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPresetText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    elevation: 2,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
