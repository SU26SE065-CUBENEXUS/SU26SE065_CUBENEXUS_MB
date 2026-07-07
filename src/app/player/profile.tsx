import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileScreen() {
  const colors = Colors.dark;
  const router = useRouter();
  const { user, logout } = useAuth();

  const getInitials = (name: string) => {
    if (!name) return 'C';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const initials = user ? getInitials(user.displayName) : 'C';

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
    Alert.alert('Setting Option', `${settingName} settings will be configurable in a future update.`);
  };

  const settingsOptions = [
    { name: 'Account Settings', icon: 'account-cog-outline' },
    { name: 'App Notification & Alerts', icon: 'bell-outline' },
    { name: 'Timer Metronome / Sounds', icon: 'volume-high' },
    { name: 'CubeNexus Help & Support', icon: 'help-circle-outline' },
    { name: 'Terms & Privacy Policy', icon: 'file-document-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>My Profile</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Avatar Area */}
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
            
            <View style={[styles.roleBadge, { borderColor: colors.primary + '40', backgroundColor: colors.primary + '15' }]}>
              <Text style={[styles.roleBadgeText, { color: colors.primary }]}>
                {(user?.role || 'COMPETITOR').toUpperCase()}
              </Text>
            </View>
          </View>

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
                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
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
  profileHeaderCard: { alignItems: 'center', marginBottom: 28 },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  profileName: { fontSize: 18, fontWeight: '800' },
  profileEmail: { fontSize: 13, fontWeight: '500', marginTop: 3 },
  roleBadge: {
    marginTop: 10, paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1,
  },
  roleBadgeText: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.8 },

  // Settings
  sectionTitle: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  settingsContainer: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1 },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingName: { fontSize: 13, fontWeight: '600' },

  // Logout
  logoutBtn: {
    flexDirection: 'row', height: 46, borderRadius: 12, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 28,
  },
  logoutBtnText: { fontSize: 13, fontWeight: '700', color: '#ef4444' },
});
