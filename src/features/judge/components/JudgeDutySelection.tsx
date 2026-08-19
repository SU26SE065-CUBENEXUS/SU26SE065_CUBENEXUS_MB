import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/AuthContext';
import { JudgeDutyMode } from '../types';

interface Props {
  onSelectDuty: (mode: JudgeDutyMode) => void;
  onLogout: () => void;
}

export default function JudgeDutySelection({ onSelectDuty, onLogout }: Props) {
  const colors = useTheme();
  const { user } = useAuth();
  const roleUpper = (user?.role || '').toUpperCase();
  const isCheckInRole = roleUpper.includes('CHECK_IN') || roleUpper.includes('CHECKIN') || roleUpper.includes('RECEPTION');
  const isJudgeRole = roleUpper.includes('JUDGE') || roleUpper.includes('STATION') || roleUpper.includes('ADMIN') || roleUpper.includes('MANAGER');

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
            <Text style={[styles.brandRole, { color: colors.textSecondary }]}>  ·  {user?.displayName || user?.role || 'JUDGE'}</Text>
          </View>
          <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
            <MaterialCommunityIcons name="logout" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Tournament Banner Card */}
          <View style={[styles.tournamentCard, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '35' }]}>
            <View style={[styles.tournamentIconWrap, { backgroundColor: colors.primary + '20' }]}>
              <MaterialCommunityIcons name="trophy-award" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tournamentLabel, { color: colors.primary }]}>GIẢI ĐẤU ĐƯỢC PHÂN CÔNG</Text>
              <Text style={[styles.tournamentName, { color: colors.text }]} numberOfLines={1}>
                {user?.assignedTournamentName || 'Chưa chọn giải đấu'}
              </Text>
            </View>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>Chọn Nhiệm Vụ Trọng Tài</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Xin chào {user?.displayName || 'Trọng tài'}! Nhiệm vụ chính: <Text style={{ color: colors.primary, fontWeight: '800' }}>{user?.judgeRoleCode === 'CHECKIN_JUDGE' ? 'Trọng tài Check-in' : user?.judgeRoleCode === 'STATION_JUDGE' ? 'Trọng tài Bàn thi' : (user?.role || 'JUDGE')}</Text>.
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
              <Text style={[styles.dutyTitle, { color: colors.text }]}>Quầy Điểm Danh & Đón Tiếp</Text>
              <Text style={[styles.dutyDesc, { color: colors.textSecondary }]}>
                Quét mã QR vé thi đấu của thí sinh tại quầy đón tiếp.{'\n'}
                Đánh dấu thí sinh đã có mặt điểm danh tham gia giải.
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
              <Text style={[styles.dutyTitle, { color: colors.text }]}>Trọng Tài Bàn Thi Đấu</Text>
              <Text style={[styles.dutyDesc, { color: colors.textSecondary }]}>
                Xác nhận thí sinh tại bàn thi, xem danh sách lượt thi,{'\n'}
                chụp ảnh tờ ghi điểm và ghi nhận kết quả lượt thi.
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Footer note */}
        <View style={styles.footer}>
          <MaterialCommunityIcons name="information-outline" size={12} color={colors.textSecondary} />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Bạn có thể đổi nhiệm vụ bất cứ lúc nào trong cài đặt ứng dụng.
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
    paddingTop: 24,
    gap: 14,
  },
  tournamentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    marginBottom: 4,
  },
  tournamentIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tournamentLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  tournamentName: {
    fontSize: 14,
    fontWeight: '800',
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
