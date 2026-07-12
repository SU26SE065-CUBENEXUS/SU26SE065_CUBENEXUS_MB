import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { JudgeDutyMode } from '../types';

interface Props {
  onSelectDuty: (mode: JudgeDutyMode) => void;
  onLogout: () => void;
}

export default function JudgeDutySelection({ onSelectDuty, onLogout }: Props) {
  const colors = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.brandRow}>
            <Image
              source={require('@/assets/images/logoCube.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.brandCube, { color: colors.text }]}>CUBE</Text>
            <Text style={[styles.brandNexus, { color: colors.accent }]}>NEXUS</Text>
            <Text style={[styles.brandRole, { color: colors.textSecondary }]}>  ·  JUDGE</Text>
          </View>
          <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
            <MaterialCommunityIcons name="logout" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>Select Your Duty</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Choose your role for this session. You can switch at any time.
          </Text>

          {/* Check-in Desk Card */}
          <TouchableOpacity
            style={[styles.dutyCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
            onPress={() => onSelectDuty('CHECK_IN')}
            activeOpacity={0.8}
          >
            <View style={[styles.dutyIconWrap, { backgroundColor: '#10b98115', borderColor: '#10b98130' }]}>
              <MaterialCommunityIcons name="account-check-outline" size={32} color="#10b981" />
            </View>
            <View style={styles.dutyText}>
              <Text style={[styles.dutyTitle, { color: colors.text }]}>Check-in Desk</Text>
              <Text style={[styles.dutyDesc, { color: colors.textSecondary }]}>
                Scan competitor QR tickets at reception.{'\n'}
                Mark competitors as checked in for the tournament.
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.border} />
          </TouchableOpacity>

          {/* Station Judge Card */}
          <TouchableOpacity
            style={[styles.dutyCard, { backgroundColor: colors.backgroundElement, borderColor: colors.primary + '50' }]}
            onPress={() => onSelectDuty('STATION')}
            activeOpacity={0.8}
          >
            <View style={[styles.dutyIconWrap, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
              <MaterialCommunityIcons name="timer-check-outline" size={32} color={colors.primary} />
            </View>
            <View style={styles.dutyText}>
              <Text style={[styles.dutyTitle, { color: colors.text }]}>Station Judge</Text>
              <Text style={[styles.dutyDesc, { color: colors.textSecondary }]}>
                Verify competitors at your station, manage{'\n'}
                the roster, and record official solve results.
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Footer note */}
        <View style={styles.footer}>
          <MaterialCommunityIcons name="information-outline" size={12} color={colors.textSecondary} />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Duty mode is local only — not sent to the server.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 52,
    borderBottomWidth: 1,
  },
  brandRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  logo: { width: 20, height: 20, borderRadius: 5, marginRight: 6 },
  brandCube: { fontSize: 13, fontWeight: '900', letterSpacing: -0.3 },
  brandNexus: { fontSize: 13, fontWeight: '900', letterSpacing: -0.3 },
  brandRole: { fontSize: 10, fontWeight: '700' },
  logoutBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 36,
    gap: 14,
  },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, marginBottom: 2 },
  subtitle: { fontSize: 12, lineHeight: 17, marginBottom: 8 },
  dutyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  dutyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dutyText: { flex: 1 },
  dutyTitle: { fontSize: 15, fontWeight: '900', marginBottom: 4 },
  dutyDesc: { fontSize: 11, lineHeight: 16 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 20,
    paddingBottom: 20,
    justifyContent: 'center',
  },
  footerText: { fontSize: 10 },
});
