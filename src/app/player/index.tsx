import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Image,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCompetitorRegistrations } from '@/services/competitorService';
import { RegistrationDto } from '@/types/competitor';

export default function PlayerHome() {
  const colors = Colors.dark;
  const router = useRouter();
  const { user, accessToken } = useAuth();

  const [registrations, setRegistrations] = useState<RegistrationDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const getInitials = (name: string) => {
    if (!name) return 'C';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const initials = user ? getInitials(user.displayName) : 'C';

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const data = await fetchCompetitorRegistrations(accessToken);
      setRegistrations(data);
    } catch (err) {
      console.warn('Failed loading home data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Find the active tournament registration: tournament is PUBLISHED or ONGOING (not yet completed)
  const activeTournament = registrations.find(
    (reg) => reg.tournamentStatusCode === 'ONGOING' || reg.tournamentStatusCode === 'PUBLISHED'
  );

  // Find first active published event assignment
  const activeEventWithAssignment = activeTournament?.registeredEvents?.find(
    (evt) => evt.assignment && evt.assignment.isPublished
  );
  const activeAssignment = activeEventWithAssignment?.assignment;

  // Format tournament dates
  const formatDates = (startStr?: string | null, endStr?: string | null) => {
    if (!startStr) return '';
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : null;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const startFormatted = `${months[start.getMonth()]} ${start.getDate()}`;
    if (end && start.getMonth() === end.getMonth()) {
      return `${startFormatted} - ${end.getDate()}, ${start.getFullYear()}`;
    } else if (end) {
      return `${startFormatted} - ${months[end.getMonth()]} ${end.getDate()}, ${start.getFullYear()}`;
    }
    return `${startFormatted}, ${start.getFullYear()}`;
  };

  // Safe parsing of QR payload
  const getQrTokenValue = (rawToken?: string) => {
    if (!rawToken) return 'Unavailable';
    try {
      if (rawToken.trim().startsWith('{')) {
        const parsed = JSON.parse(rawToken);
        return parsed.Token || rawToken;
      }
    } catch {}
    return rawToken;
  };

  const qrCodeData = activeTournament ? getQrTokenValue(activeTournament.qrToken) : '';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        
        {/* Header Branding */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
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
          <View style={[styles.headerStatusText, { backgroundColor: colors.backgroundSelected }]}>
            <Text style={[styles.headerStatusLabel, { color: colors.success }]}>● ONLINE</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Greeting */}
          <View style={styles.welcomeSection}>
            <Text style={[styles.welcomeSub, { color: colors.textSecondary }]}>Welcome Back,</Text>
            <Text style={[styles.welcomeTitle, { color: colors.text }]}>
              {user?.displayName || 'Competitor'}
            </Text>
          </View>

          {/* Profile Quick Summary */}
          <View style={[styles.profileCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
            <View style={styles.profileRow}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
                  {user?.email || 'competitor@cubenexus.com'}
                </Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { borderColor: colors.primary + '30', backgroundColor: colors.primary + '15' }]}>
                    <Text style={[styles.badgeText, { color: colors.primary }]}>
                      {(user?.role || 'COMPETITOR').toUpperCase()}
                    </Text>
                  </View>
                  <View style={[styles.badge, { borderColor: colors.success + '30', backgroundColor: colors.success + '15' }]}>
                    <Text style={[styles.badgeText, { color: colors.success }]}>
                      COMPETITOR
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Practice Timer Quick CTA */}
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
            onPress={() => router.push('/player/timer')}
          >
            <MaterialCommunityIcons name="timer-outline" size={22} color="#fff" />
            <Text style={styles.primaryButtonText}>Launch Practice Timer</Text>
          </TouchableOpacity>

          {/* My Active Registration Section */}
          <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>
            My Registration
          </Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : activeTournament ? (
            <View style={[styles.tournamentCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <View style={styles.tournamentHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tournamentDate, { color: colors.primary }]}>
                    {formatDates(activeTournament.tournamentStartDate, activeTournament.tournamentEndDate)}
                  </Text>
                  <Text style={[styles.tournamentName, { color: colors.text }]} numberOfLines={2}>
                    {activeTournament.tournamentName}
                  </Text>
                </View>
                {/* Show tournament lifecycle status */}
                <View style={[styles.statusIndicator, {
                  backgroundColor: activeTournament.tournamentStatusCode === 'ONGOING' ? colors.success + '15' : colors.primary + '15',
                  borderColor: activeTournament.tournamentStatusCode === 'ONGOING' ? colors.success + '30' : colors.primary + '30',
                }]}>
                  <Text style={[styles.statusIndicatorText, {
                    color: activeTournament.tournamentStatusCode === 'ONGOING' ? colors.success : colors.primary,
                  }]}>
                    {activeTournament.tournamentStatusCode === 'ONGOING' ? '● ONGOING' : activeTournament.tournamentStatusCode}
                  </Text>
                </View>
              </View>

              {/* Registration Status Row */}
              <View style={[styles.regStatusRow, {
                backgroundColor: activeTournament.statusCode === 'CONFIRMED' ? colors.primary + '10' :
                  activeTournament.statusCode === 'CHECKED_IN' ? colors.success + '10' :
                  activeTournament.statusCode === 'CANCELLED' ? '#ef444415' : colors.background,
                borderColor: activeTournament.statusCode === 'CONFIRMED' ? colors.primary + '30' :
                  activeTournament.statusCode === 'CHECKED_IN' ? colors.success + '30' :
                  activeTournament.statusCode === 'CANCELLED' ? '#ef444430' : colors.border,
              }]}>
                <MaterialCommunityIcons
                  name={
                    activeTournament.statusCode === 'CONFIRMED' ? 'check-circle-outline' :
                    activeTournament.statusCode === 'CHECKED_IN' ? 'qrcode-scan' :
                    activeTournament.statusCode === 'CANCELLED' ? 'close-circle-outline' : 'clock-outline'
                  }
                  size={15}
                  color={
                    activeTournament.statusCode === 'CONFIRMED' ? colors.primary :
                    activeTournament.statusCode === 'CHECKED_IN' ? colors.success :
                    activeTournament.statusCode === 'CANCELLED' ? '#ef4444' : colors.textSecondary
                  }
                />
                <Text style={[styles.regStatusText, {
                  color: activeTournament.statusCode === 'CONFIRMED' ? colors.primary :
                    activeTournament.statusCode === 'CHECKED_IN' ? colors.success :
                    activeTournament.statusCode === 'CANCELLED' ? '#ef4444' : colors.textSecondary
                }]}>
                  Registration: {
                    activeTournament.statusCode === 'CONFIRMED' ? 'Confirmed' :
                    activeTournament.statusCode === 'CHECKED_IN' ? 'Checked In' :
                    activeTournament.statusCode === 'PENDING' ? 'Pending Confirmation' :
                    activeTournament.statusCode === 'CANCELLED' ? 'Cancelled' :
                    activeTournament.statusCode
                  }
                </Text>
              </View>

              {/* Group / Assignment section — per event */}
              {activeTournament.registeredEvents && activeTournament.registeredEvents.length > 0 && (
                <View style={{ gap: 8 }}>
                  <Text style={[styles.assignmentTitle, { color: colors.textSecondary, letterSpacing: 0.8, fontSize: 10 }]}>
                    EVENT ASSIGNMENTS
                  </Text>
                  {activeTournament.registeredEvents.map((evt) => {
                    const a = evt.assignment;
                    // groupStatusCode in DB: PENDING | ONGOING | LOCKED | COMPLETED
                    const hasGroup = a != null;
                    const isAssignmentPublished = hasGroup && a!.isPublished;
                    return (
                      <View key={evt.registrationEventId} style={[styles.assignmentArea, {
                        backgroundColor: colors.background,
                        borderColor: isAssignmentPublished ? colors.primary + '40' : colors.border,
                        borderStyle: isAssignmentPublished ? 'solid' : 'dashed',
                      }]}>
                        <View style={styles.assignmentHeader}>
                          <MaterialCommunityIcons
                            name={isAssignmentPublished ? 'bell-ring-outline' : 'information-outline'}
                            size={14}
                            color={isAssignmentPublished ? colors.accent : colors.textSecondary}
                          />
                          <Text style={[styles.assignmentTitle, { color: isAssignmentPublished ? colors.accent : colors.textSecondary }]}>
                            {evt.puzzleTypeName.toUpperCase()}
                          </Text>
                        </View>

                        {isAssignmentPublished ? (
                          <>
                            <Text style={[styles.assignmentEvent, { color: colors.text }]}>
                              Round {a!.roundNumber} • {a!.groupName}
                            </Text>
                            <Text style={[styles.assignmentDetail, { color: colors.textSecondary }]}>
                              Station {a!.stationNumber ?? 'TBD'} • Group: {a!.groupStatusCode}
                            </Text>
                          </>
                        ) : hasGroup ? (
                          // Group exists in DB but status is PENDING → manager generated groups but not published yet
                          <>
                            <Text style={[styles.assignmentEvent, { color: colors.textSecondary, fontSize: 13 }]}>
                              Round {a!.roundNumber} • {a!.groupName}
                            </Text>
                            <Text style={[styles.assignmentDetail, { color: colors.textSecondary }]}>
                              Assignment being prepared · Please wait for manager
                            </Text>
                          </>
                        ) : (
                          // No GroupCompetitor record at all
                          <Text style={[styles.assignmentDetail, { color: colors.textSecondary }]}>
                            Groups have not been assigned yet
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* CTA for QR */}
              {activeTournament.statusCode !== 'CANCELLED' && (
                <TouchableOpacity
                  style={[styles.qrCtaButton, { backgroundColor: colors.backgroundSelected, borderColor: colors.border }]}
                  onPress={() => setShowQrModal(true)}
                >
                  <MaterialCommunityIcons name="qrcode" size={20} color={colors.primary} />
                  <Text style={[styles.qrCtaText, { color: colors.text }]}>Open QR Check-In Ticket</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={40} color={colors.textSecondary + '60'} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No Active Registrations</Text>
              <Text style={[styles.emptySubText, { color: colors.textSecondary, marginBottom: 12 }]}>
                You are not currently registered for any ongoing or upcoming tournament.
              </Text>
              <TouchableOpacity
                style={[styles.qrCtaButton, { backgroundColor: colors.primary, borderColor: colors.primary, width: '100%' }]}
                onPress={() => router.push('/player/tournaments?segment=OPEN_TOURS')}
              >
                <MaterialCommunityIcons name="compass-outline" size={20} color="#fff" />
                <Text style={[styles.qrCtaText, { color: '#fff' }]}>Browse Open Tournaments</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>

        {/* QR Code Ticket Modal */}
        <Modal
          visible={showQrModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowQrModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowQrModal(false)} />
            <View style={[styles.modalContent, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Competitor Ticket</Text>
                <TouchableOpacity onPress={() => setShowQrModal(false)} style={styles.modalCloseBtn}>
                  <MaterialCommunityIcons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>
              
              {activeTournament && (
                <View style={styles.modalBody}>
                  <Text style={[styles.modalTourName, { color: colors.text }]} numberOfLines={2}>
                    {activeTournament.tournamentName}
                  </Text>
                  <Text style={[styles.modalCompName, { color: colors.primary }]}>
                    {user?.displayName}
                  </Text>
                  
                  <View style={[styles.modalBadge, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
                    <Text style={[styles.modalBadgeText, { color: colors.primary }]}>
                      STATUS: {activeTournament.statusCode}
                    </Text>
                  </View>

                  <View style={styles.qrContainer}>
                    <Image
                      source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeData)}` }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                  </View>

                  <Text style={[styles.qrHelperText, { color: colors.textSecondary }]}>
                    Show this to check-in staff or judge at the station.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
  },
  headerLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniLogo: { width: 28, height: 28, borderRadius: 6 },
  miniBrandRow: { flexDirection: 'row', alignItems: 'baseline' },
  miniBrandText: { fontSize: 14, fontWeight: '900', letterSpacing: -0.2 },
  headerStatusText: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerStatusLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 40 },

  // Welcome section
  welcomeSection: { marginBottom: 16 },
  welcomeSub: { fontSize: 13, fontWeight: '600' },
  welcomeTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },

  // Profile Card
  profileCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 16 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  profileEmail: { fontSize: 12.5, fontWeight: '500' },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  badge: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 20, borderWidth: 1,
  },
  badgeText: { fontSize: 8.5, fontWeight: '700', letterSpacing: 0.8 },

  // Primary Action Button
  primaryButton: {
    flexDirection: 'row', height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
    gap: 8, marginBottom: 26,
    shadowColor: '#ff5a36', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Tournament Card
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  tournamentCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 14 },
  tournamentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  tournamentDate: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  tournamentName: { fontSize: 16, fontWeight: '700', marginTop: 2, lineHeight: 22 },
  statusIndicator: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 0.5,
  },
  statusIndicatorText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },

  // Assignment Area
  assignmentArea: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 4 },
  assignmentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  assignmentTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  assignmentEvent: { fontSize: 14, fontWeight: '700' },
  assignmentDetail: { fontSize: 11.5, fontWeight: '500', marginTop: 2 },

  // Registration Status
  regStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  regStatusText: { fontSize: 12, fontWeight: '700' },

  // QR CTA
  qrCtaButton: {
    flexDirection: 'row', height: 44, borderRadius: 10, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  qrCtaText: { fontSize: 13, fontWeight: '700' },

  // Empty state
  emptyCard: {
    borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', padding: 28, alignItems: 'center', gap: 8,
  },
  emptyText: { fontSize: 14, fontWeight: '600' },
  emptySubText: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  loadingContainer: { paddingVertical: 20, alignItems: 'center' },

  // Modal QR
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', maxWidth: 340, borderRadius: 20, borderWidth: 1, padding: 20, elevation: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  modalCloseBtn: { padding: 4 },
  modalBody: { alignItems: 'center' },
  modalTourName: { fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 6, lineHeight: 20 },
  modalCompName: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  modalBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, marginBottom: 18 },
  modalBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  qrContainer: { padding: 12, backgroundColor: '#fff', borderRadius: 16, marginBottom: 14 },
  qrImage: { width: 180, height: 180 },
  qrHelperText: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
});
