import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyProfile, updateMyProfile, UserProfileDto } from '@/services/profileService';

export default function ProfileScreen() {
  const colors = useTheme();
  const router = useRouter();
  const { user, accessToken, logout, updateUserLocalState } = useAuth();

  // Account Settings Modal state
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form input fields
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [profileData, setProfileData] = useState<UserProfileDto | null>(null);

  const getInitials = (name?: string) => {
    if (!name) return 'C';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const initials = getInitials(user?.displayName);

  // ─── Fetch real user profile when opening modal ─────────────────────────────
  const loadProfileDetails = useCallback(async () => {
    if (!accessToken) return;
    setIsFetchingProfile(true);
    try {
      const data = await fetchMyProfile(accessToken);
      setProfileData(data);
      setDisplayName(data.displayName || user?.displayName || '');
      setPhone(data.phone || '');
      setAddress(data.address || '');
    } catch (err: any) {
      console.warn('Failed to load profile details:', err);
      // Fallback to local auth context info
      setDisplayName(user?.displayName || '');
    } finally {
      setIsFetchingProfile(false);
    }
  }, [accessToken, user]);

  const handleOpenAccountSettings = () => {
    setShowAccountModal(true);
    loadProfileDetails();
  };

  // ─── Handle Saving Profile ──────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      Alert.alert('Validation Error', 'Display Name cannot be empty.');
      return;
    }

    if (!accessToken) {
      Alert.alert('Auth Error', 'You must be logged in to update your profile.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateMyProfile(accessToken, {
        displayName: displayName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
      });

      // Update AuthContext state instantly
      updateUserLocalState({
        displayName: updated.displayName || displayName.trim(),
        phone: updated.phone,
        address: updated.address,
      });

      Alert.alert('Success', 'Your account profile has been updated successfully!');
      setShowAccountModal(false);
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Unable to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out from CubeNexus?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/login');
          }
        }
      ]
    );
  };

  const handleSettingPress = (settingName: string) => {
    if (settingName === 'Account Settings') {
      handleOpenAccountSettings();
    } else {
      Alert.alert(
        settingName,
        `${settingName} features are active and managed via your CubeNexus profile.`
      );
    }
  };

  const settingsOptions = [
    { name: 'Account Settings', icon: 'account-cog-outline', badge: 'EDIT PROFILE' },
    { name: 'App Notification & Alerts', icon: 'bell-outline' },
    { name: 'Timer Metronome / Sounds', icon: 'volume-high' },
    { name: 'CubeNexus Help & Support', icon: 'help-circle-outline' },
    { name: 'Terms & Privacy Policy', icon: 'file-document-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>My Profile & Settings</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Avatar & Header Card */}
          <View style={styles.profileHeaderCard}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={[styles.profileName, { color: colors.text }]}>
              {user?.displayName || 'Competitor'}
            </Text>
            <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
              {user?.email || 'competitor@cubenexus.com'}
            </Text>
            
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <View style={[styles.roleBadge, { borderColor: colors.primary + '40', backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.roleBadgeText, { color: colors.primary }]}>
                  {(user?.role || 'COMPETITOR').toUpperCase()}
                </Text>
              </View>
              {user?.phone && (
                <View style={[styles.roleBadge, { borderColor: colors.accent + '40', backgroundColor: colors.accent + '15' }]}>
                  <Text style={[styles.roleBadgeText, { color: colors.accent }]}>
                    VERIFIED PHONE
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Quick Edit Profile Banner */}
          <TouchableOpacity
            style={[styles.editProfileBanner, { backgroundColor: colors.backgroundElement, borderColor: colors.primary + '40' }]}
            onPress={handleOpenAccountSettings}
            activeOpacity={0.8}
          >
            <View style={[styles.bannerIconBox, { backgroundColor: colors.primary + '15' }]}>
              <MaterialCommunityIcons name="account-edit-outline" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: colors.text }]}>Edit Profile Details</Text>
              <Text style={[styles.bannerSub, { color: colors.textSecondary }]}>
                Update display name, contact phone & address
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primary} />
          </TouchableOpacity>

          {/* Settings Section */}
          <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>
            App Settings
          </Text>

          <View style={[styles.settingsContainer, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
            {settingsOptions.map((opt, idx) => (
              <TouchableOpacity
                key={opt.name}
                style={[
                  styles.settingItem,
                  { borderBottomColor: colors.border },
                  idx === settingsOptions.length - 1 && { borderBottomWidth: 0 }
                ]}
                onPress={() => handleSettingPress(opt.name)}
                activeOpacity={0.7}
              >
                <View style={styles.settingLeft}>
                  <MaterialCommunityIcons name={opt.icon as any} size={20} color={colors.primary} />
                  <Text style={[styles.settingName, { color: colors.text }]}>{opt.name}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {opt.badge && (
                    <View style={[styles.actionTag, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
                      <Text style={[styles.actionTagText, { color: colors.primary }]}>{opt.badge}</Text>
                    </View>
                  )}
                  <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sign Out CTA */}
          <TouchableOpacity
            style={[styles.logoutBtn, { borderColor: '#ef4444' + '40', backgroundColor: '#ef4444' + '10' }]}
            onPress={handleLogout}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons name="logout" size={20} color="#ef4444" />
            <Text style={styles.logoutBtnText}>Sign Out Account</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>

      {/* ─── ACCOUNT SETTINGS EDIT MODAL ────────────────────────────────────────── */}
      <Modal
        visible={showAccountModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAccountModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="account-cog" size={22} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.text }]}>Account Settings</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAccountModal(false)} p-2>
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {isFetchingProfile ? (
              <View style={styles.modalLoadingBox}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.modalLoadingText, { color: colors.textSecondary }]}>
                  Loading account profile...
                </Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.modalFormContent} showsVerticalScrollIndicator={false}>
                
                {/* Email Read-only Field */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>ACCOUNT EMAIL (READ-ONLY)</Text>
                  <View style={[styles.readOnlyInput, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="email-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.readOnlyText, { color: colors.textSecondary }]}>
                      {user?.email || 'competitor@cubenexus.com'}
                    </Text>
                  </View>
                </View>

                {/* Display Name Input */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>FULL DISPLAY NAME *</Text>
                  <View style={[styles.inputBox, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="account-outline" size={18} color={colors.primary} />
                    <TextInput
                      style={[styles.inputField, { color: colors.text }]}
                      value={displayName}
                      onChangeText={setDisplayName}
                      placeholder="Enter full display name..."
                      placeholderTextColor={colors.textSecondary + '80'}
                    />
                  </View>
                </View>

                {/* Phone Number Input */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>PHONE NUMBER</Text>
                  <View style={[styles.inputBox, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="phone-outline" size={18} color={colors.primary} />
                    <TextInput
                      style={[styles.inputField, { color: colors.text }]}
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="Enter contact phone number..."
                      placeholderTextColor={colors.textSecondary + '80'}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                {/* Address Input */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>CITY / LOCATION ADDRESS</Text>
                  <View style={[styles.inputBox, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.primary} />
                    <TextInput
                      style={[styles.inputField, { color: colors.text }]}
                      value={address}
                      onChangeText={setAddress}
                      placeholder="Enter city or address (e.g. Ho Chi Minh City)"
                      placeholderTextColor={colors.textSecondary + '80'}
                    />
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: colors.border }]}
                    onPress={() => setShowAccountModal(false)}
                    disabled={isSaving}
                  >
                    <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                    onPress={handleSaveProfile}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="content-save-outline" size={18} color="#ffffff" />
                        <Text style={styles.saveBtnText}>Save Profile Changes</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

              </ScrollView>
            )}

          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    height: 56,
    justifyContent: 'center',
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.2 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 40 },
  
  // Profile Header Card
  profileHeaderCard: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  profileName: { fontSize: 18, fontWeight: '800' },
  profileEmail: { fontSize: 13, fontWeight: '500', marginTop: 3 },
  roleBadge: {
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1,
  },
  roleBadgeText: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.8 },

  // Edit Profile Banner
  editProfileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  bannerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTitle: { fontSize: 14, fontWeight: '800' },
  bannerSub: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  // Settings
  sectionTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  settingsContainer: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1 },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingName: { fontSize: 13, fontWeight: '600' },
  actionTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  actionTagText: { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.5 },

  // Logout
  logoutBtn: {
    flexDirection: 'row', height: 46, borderRadius: 12, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 28,
  },
  logoutBtnText: { fontSize: 13, fontWeight: '700', color: '#ef4444' },

  // ─── Modal Styles ─────────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 56,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: '900' },
  modalLoadingBox: { paddingVertical: 50, alignItems: 'center', gap: 10 },
  modalLoadingText: { fontSize: 13, fontWeight: '600' },

  modalFormContent: { paddingHorizontal: 20, paddingTop: 20, gap: 16 },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  inputField: { flex: 1, fontSize: 13.5, fontWeight: '600' },
  readOnlyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    opacity: 0.8,
  },
  readOnlyText: { fontSize: 13.5, fontWeight: '600' },

  modalActionRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 13.5, fontWeight: '700' },
  saveBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnText: { color: '#ffffff', fontSize: 13.5, fontWeight: '800' },
});
