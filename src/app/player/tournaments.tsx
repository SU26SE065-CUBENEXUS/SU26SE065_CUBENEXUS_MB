import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Image,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { formatEventLabel } from '@/utils/eventFormatter';
import { useLocalSearchParams } from 'expo-router';
import {
  fetchCompetitorRegistrations,
  fetchPublicTournaments,
  registerForTournament,
} from '@/services/competitorService';
import { RegistrationDto, TournamentDetailDto, EventDetailDto } from '@/types/competitor';

type TabSegment = 'MY_REGS' | 'OPEN_TOURS' | 'PAST_TOURS';

// ─── Skeleton shimmer card shown while data loads ───────────────────────────
function SkeletonCard({ colors }: { colors: any }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
      {/* Banner placeholder */}
      <Animated.View style={{ height: 100, backgroundColor: colors.border, opacity }} />
      <View style={{ padding: 14, gap: 8 }}>
        <Animated.View style={{ height: 10, width: '45%', borderRadius: 5, backgroundColor: colors.border, opacity }} />
        <Animated.View style={{ height: 14, width: '80%', borderRadius: 5, backgroundColor: colors.border, opacity }} />
        <Animated.View style={{ height: 10, width: '60%', borderRadius: 5, backgroundColor: colors.border, opacity }} />
        <Animated.View style={{ height: 5, borderRadius: 3, backgroundColor: colors.border, opacity, marginTop: 4 }} />
      </View>
      <View style={{ height: 48, borderTopWidth: 1, borderColor: colors.border, margin: 0, backgroundColor: colors.backgroundElement }} />
    </View>
  );
}

export default function TournamentsScreen() {
  const colors = useTheme();
  const { user, accessToken } = useAuth();
  const params = useLocalSearchParams();

  const [activeSegment, setActiveSegment] = useState<TabSegment>('MY_REGS');

  useEffect(() => {
    if (params.segment) {
      setActiveSegment(params.segment as TabSegment);
    }
  }, [params.segment]);
  const [registrations, setRegistrations] = useState<RegistrationDto[]>([]);
  const [publicTournaments, setPublicTournaments] = useState<TournamentDetailDto[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal states
  const [selectedReg, setSelectedReg] = useState<RegistrationDto | null>(null);
  const [selectedTour, setSelectedTour] = useState<TournamentDetailDto | null>(null);

  const [showQrModal, setShowQrModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [submittingReg, setSubmittingReg] = useState(false);

  // Selected events for registration form
  const [selectedEventIds, setSelectedEventIds] = useState<Record<string, boolean>>({});

  const CACHE_KEY = '@tournaments_public_cache';

  const loadData = useCallback(async (showIndicator = true) => {
    // Stale-while-revalidate: try to load from AsyncStorage cache first for instant display
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as TournamentDetailDto[];
        const filtered = parsed.filter(t => t.statusCode !== 'DRAFT');
        setPublicTournaments(filtered);
        // Don't show spinner if we have cached data
        if (showIndicator) setIsLoading(false);
      } else if (showIndicator) {
        setIsLoading(true);
      }
    } catch {
      if (showIndicator) setIsLoading(true);
    }

    try {
      // 1. Fetch fresh public tournaments in background
      const tours = await fetchPublicTournaments();
      const filteredTours = tours.filter(t => t.statusCode !== 'DRAFT');
      setPublicTournaments(filteredTours);
      // Cache fresh data for next launch
      try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(tours)); } catch { /* ignore */ }

      // 2. Fetch registrations if authenticated
      if (accessToken) {
        const regs = await fetchCompetitorRegistrations(accessToken);
        setRegistrations(regs);
      }
    } catch (err) {
      console.warn('Error loading tournaments screen data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData(false);
  };

  const handleOpenQr = (reg: RegistrationDto) => {
    if (reg.tournamentStatusCode === 'COMPLETED') {
      Alert.alert('Ticket Expired', 'This tournament has ended. QR ticket is no longer valid.');
      return;
    }
    if (reg.statusCode === 'CANCELLED') {
      Alert.alert('Ticket Invalid', 'This registration has been cancelled.');
      return;
    }
    setSelectedReg(reg);
    setShowQrModal(true);
  };

  const handleOpenSchedule = (reg: RegistrationDto) => {
    setSelectedReg(reg);
    setShowScheduleModal(true);
  };

  const handleOpenDetail = (tournamentId: string) => {
    // Data is already in publicTournaments — no need for an extra API call
    const detail = publicTournaments.find(t => t.id === tournamentId) ?? null;
    if (detail) {
      setSelectedTour(detail);
      setSelectedEventIds({});
      setShowDetailModal(true);
    } else {
      Alert.alert('Lỗi', 'Không tìm thấy thông tin giải đấu.');
    }
  };

  const handleToggleEventSelection = (eventId: string) => {
    setSelectedEventIds(prev => ({
      ...prev,
      [eventId]: !prev[eventId]
    }));
  };

  const handleRegisterSubmit = async () => {
    if (!accessToken || !selectedTour) return;

    const eventIds = Object.keys(selectedEventIds).filter(id => selectedEventIds[id]);
    if (eventIds.length === 0) {
      Alert.alert('Selection Required', 'Please select at least one event to register.');
      return;
    }

    setSubmittingReg(true);
    try {
      await registerForTournament(accessToken, selectedTour.id, eventIds);
      Alert.alert('Success', 'Registered successfully!');
      setShowDetailModal(false);
      loadData(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      Alert.alert('Registration Failed', msg);
    } finally {
      setSubmittingReg(false);
    }
  };

  const isRegistrationTimelineOpen = (tour: TournamentDetailDto) => {
    const now = new Date();
    const openAt = new Date(tour.registrationOpenAt);
    const closeAt = new Date(tour.registrationCloseAt);
    return now >= openAt && now <= closeAt;
  };

  // Check if competitor is already registered for a tournament
  const getRegistrationForTournament = (tourId: string) => {
    return registrations.find(r => r.tournamentId === tourId);
  };

  const isTourOpenForRegistration = (tour: TournamentDetailDto) => {
    return tour.statusCode === 'PUBLISHED' && isRegistrationTimelineOpen(tour);
  };

  // Group listings
  // A tournament is open for registration if its status code is PUBLISHED and registration timeline is open
  const openTournamentsFiltered = publicTournaments.filter(
    (t) => isTourOpenForRegistration(t) && !getRegistrationForTournament(t.id)
  );

  // My registrations segment shows active registrations
  const myActiveRegistrations = registrations.filter(
    (r) => r.tournamentStatusCode !== 'COMPLETED'
  );

  // Past segment shows completed tournaments or cancelled registrations
  const completedRegistrations = registrations.filter(
    (r) => r.tournamentStatusCode === 'COMPLETED'
  );

  const completedPublicTournaments = publicTournaments.filter(
    (t) => t.statusCode === 'COMPLETED' && !getRegistrationForTournament(t.id)
  );

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
  const getRegStatusLabel = (tourId: string) => {
    const reg = getRegistrationForTournament(tourId);
    if (!reg) return 'Not Registered';
    return reg.statusCode;
  };

  const getRegStatusColor = (status: string) => {
    switch (status) {
      case 'CHECKED_IN': return colors.success;
      case 'CONFIRMED': return colors.primary;
      case 'PENDING': return colors.accent;
      case 'CANCELLED': return '#ef4444';
      default: return colors.textSecondary;
    }
  };

  const getStatusColor = getRegStatusColor;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>

        {/* Header Title */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Tournament Hub</Text>
        </View>

        {/* Segmented Control Selector */}
        <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.tabItem, activeSegment === 'MY_REGS' && { borderBottomColor: colors.primary }]}
            onPress={() => setActiveSegment('MY_REGS')}
          >
            <Text style={[styles.tabLabel, { color: activeSegment === 'MY_REGS' ? colors.primary : colors.textSecondary }]}>
              My Registrations
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeSegment === 'OPEN_TOURS' && { borderBottomColor: colors.primary }]}
            onPress={() => setActiveSegment('OPEN_TOURS')}
          >
            <Text style={[styles.tabLabel, { color: activeSegment === 'OPEN_TOURS' ? colors.primary : colors.textSecondary }]}>
              Open Tournaments
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeSegment === 'PAST_TOURS' && { borderBottomColor: colors.primary }]}
            onPress={() => setActiveSegment('PAST_TOURS')}
          >
            <Text style={[styles.tabLabel, { color: activeSegment === 'PAST_TOURS' ? colors.primary : colors.textSecondary }]}>
              Past
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {isLoading ? (
            // Skeleton shimmer loading cards
            <View style={styles.listContainer}>
              {[1, 2, 3].map((i) => (
                <SkeletonCard key={i} colors={colors} />
              ))}
            </View>
          ) : (
            <View style={styles.listContainer}>

              {/* SEGMENT 1: MY REGISTRATIONS */}
              {activeSegment === 'MY_REGS' && (
                <View style={styles.section}>
                  {myActiveRegistrations.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <MaterialCommunityIcons name="ticket-outline" size={60} color={colors.border} />
                      <Text style={[styles.emptyText, { color: colors.text }]}>No active registrations</Text>
                      <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
                        Go to the "Open Tournaments" tab to find active events and register.
                      </Text>
                    </View>
                  ) : (
                    myActiveRegistrations.map((reg) => (
                      <View
                        key={reg.registrationId}
                        style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
                      >
                        <View style={styles.cardHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.cardDate, { color: colors.primary }]}>
                              {formatDates(reg.tournamentStartDate, reg.tournamentEndDate)}
                            </Text>
                            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                              {reg.tournamentName}
                            </Text>
                          </View>
                          <View style={[styles.statusBadge, { borderColor: getStatusColor(reg.statusCode) + '30', backgroundColor: getStatusColor(reg.statusCode) + '12' }]}>
                            <Text style={[styles.statusBadgeText, { color: getStatusColor(reg.statusCode) }]}>
                              {reg.statusCode}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.detailsRow}>
                          <View style={styles.detailItem}>
                            <MaterialCommunityIcons name="cube-outline" size={14} color={colors.textSecondary} />
                            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                              {reg.registeredEvents.length} Events Registered
                            </Text>
                          </View>
                        </View>

                        {/* Actions */}
                        <View style={[styles.actionsRow, { borderTopColor: colors.border }]}>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.borderBtn, { borderColor: colors.border, backgroundColor: colors.backgroundSelected }]}
                            onPress={() => handleOpenSchedule(reg)}
                          >
                            <MaterialCommunityIcons name="calendar-text" size={16} color={colors.text} />
                            <Text style={[styles.actionBtnText, { color: colors.text }]}>
                              Assignments
                            </Text>
                          </TouchableOpacity>

                          {reg.statusCode !== 'CANCELLED' && (
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.solidBtn, { backgroundColor: colors.primary }]}
                              onPress={() => handleOpenQr(reg)}
                            >
                              <MaterialCommunityIcons name="qrcode" size={16} color="#fff" />
                              <Text style={[styles.actionBtnText, { color: '#fff' }]}>
                                QR Ticket
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* SEGMENT 2: OPEN TOURNAMENTS */}
              {activeSegment === 'OPEN_TOURS' && (
                <View style={styles.section}>
                  {openTournamentsFiltered.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <MaterialCommunityIcons name="calendar-remove-outline" size={60} color={colors.border} />
                      <Text style={[styles.emptyText, { color: colors.text }]}>Không có giải đấu đang mở</Text>
                      <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
                        Hiện tại chưa có giải đấu nào đang nhận đăng ký. Vui lòng quay lại sau!
                      </Text>
                    </View>
                  ) : (
                    openTournamentsFiltered.map((tour) => {
                      const maxCap = tour.maxParticipants || 40;
                      const regCount = tour.currentParticipants ?? 0;
                      const fillPct = maxCap > 0 ? Math.min(100, Math.round((regCount / maxCap) * 100)) : 0;

                      return (
                        <View
                          key={tour.id}
                          style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
                        >
                          {/* Top Banner Image if available */}
                          {tour.bannerUrl ? (
                            <View style={styles.cardBannerContainer}>
                              <Image source={{ uri: tour.bannerUrl }} style={styles.cardBannerImage} resizeMode="cover" />
                              <View style={styles.cardBannerOverlay} />
                              <View style={styles.cardCapacityBadge}>
                                <Text style={styles.cardCapacityBadgeText}>
                                  👥 {regCount} / {maxCap} thí sinh
                                </Text>
                              </View>
                            </View>
                          ) : null}

                          <View style={styles.cardHeader}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.cardDate, { color: colors.primary }]}>
                                {formatDates(tour.startDate, tour.endDate)}
                              </Text>
                              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                                {tour.name}
                              </Text>
                            </View>
                            <View style={[styles.statusBadge, { borderColor: colors.success + '30', backgroundColor: colors.success + '12' }]}>
                              <Text style={[styles.statusBadgeText, { color: colors.success }]}>
                                {tour.statusCode}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.detailsRow}>
                            <View style={styles.detailItem}>
                              <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.textSecondary} />
                              <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
                                {tour.location || 'TP. Hồ Chí Minh, Việt Nam'}
                              </Text>
                            </View>
                            <View style={[styles.detailItem, { width: '100%', marginTop: 2 }]}>
                              <MaterialCommunityIcons name="account-group-outline" size={14} color={colors.accent} />
                              <Text style={[styles.detailText, { color: colors.accent, fontWeight: '700' }]}>
                                Đã đăng ký: {regCount} / {maxCap} thí sinh ({fillPct}%)
                              </Text>
                            </View>
                            {/* Capacity Bar */}
                            <View style={styles.capacityBarBg}>
                              <View
                                style={[
                                  styles.capacityBarFill,
                                  {
                                    width: `${fillPct}%`,
                                    backgroundColor: fillPct > 90 ? '#ef4444' : colors.accent,
                                  },
                                ]}
                              />
                            </View>
                          </View>

                          <View style={[styles.actionsRow, { borderTopColor: colors.border }]}>
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.solidBtn, { backgroundColor: colors.primary, flex: 1 }]}
                              onPress={() => handleOpenDetail(tour.id)}
                            >
                              <MaterialCommunityIcons name="clipboard-text-play-outline" size={16} color="#fff" />
                              <Text style={[styles.actionBtnText, { color: '#fff' }]}>
                                Xem Chi Tiết & Đăng Ký
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              )}

              {/* SEGMENT 3: PAST */}
              {activeSegment === 'PAST_TOURS' && (
                <View style={styles.section}>
                  {completedRegistrations.length === 0 && completedPublicTournaments.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <MaterialCommunityIcons name="history" size={60} color={colors.border} />
                      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No historical archives</Text>
                    </View>
                  ) : (
                    <View style={{ gap: 12 }}>
                      {/* Past registrations */}
                      {completedRegistrations.map((reg) => (
                        <View
                          key={reg.registrationId}
                          style={[styles.card, styles.cardCompleted, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
                        >
                          <View style={styles.cardHeader}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
                                {formatDates(reg.tournamentStartDate, reg.tournamentEndDate)}
                              </Text>
                              <Text style={[styles.cardTitle, { color: colors.textSecondary }]} numberOfLines={2}>
                                {reg.tournamentName}
                              </Text>
                            </View>
                            <View style={[styles.statusBadge, { borderColor: colors.border, backgroundColor: colors.border }]}>
                              <Text style={[styles.statusBadgeText, { color: colors.textSecondary }]}>
                                {reg.statusCode}
                              </Text>
                            </View>
                          </View>

                          <View style={[styles.actionsRow, { borderTopColor: colors.border }]}>
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.borderBtn, { borderColor: colors.border }]}
                              onPress={() => Alert.alert('Summary', `Historical profile for ${reg.tournamentName} is archived.`)}
                            >
                              <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>View Summary</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}

                      {/* Past public tournaments not registered */}
                      {completedPublicTournaments.map((tour) => (
                        <View
                          key={tour.id}
                          style={[styles.card, styles.cardCompleted, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
                        >
                          <View style={styles.cardHeader}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
                                {formatDates(tour.startDate, tour.endDate)}
                              </Text>
                              <Text style={[styles.cardTitle, { color: colors.textSecondary }]} numberOfLines={2}>
                                {tour.name}
                              </Text>
                            </View>
                            <View style={[styles.statusBadge, { borderColor: colors.border, backgroundColor: colors.border }]}>
                              <Text style={[styles.statusBadgeText, { color: colors.textSecondary }]}>
                                {tour.statusCode}
                              </Text>
                            </View>
                          </View>

                          <View style={[styles.actionsRow, { borderTopColor: colors.border }]}>
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.borderBtn, { borderColor: colors.border, flex: 1 }]}
                              onPress={() => Alert.alert('Results', `Tournament results for ${tour.name} are completed.`)}
                            >
                              <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>View Results</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

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
                <Text style={[styles.modalTitle, { color: colors.text }]}>QR Competitor Ticket</Text>
                <TouchableOpacity onPress={() => setShowQrModal(false)} style={styles.modalCloseBtn}>
                  <MaterialCommunityIcons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              {selectedReg && (
                <View style={styles.modalBody}>
                  <Text style={[styles.modalTourName, { color: colors.text }]} numberOfLines={2}>
                    {selectedReg.tournamentName}
                  </Text>
                  <Text style={[styles.modalCompName, { color: colors.primary }]}>
                    {user?.displayName}
                  </Text>

                  <View style={[styles.modalBadge, { backgroundColor: getStatusColor(selectedReg.statusCode) + '15', borderColor: getStatusColor(selectedReg.statusCode) + '30' }]}>
                    <Text style={[styles.modalBadgeText, { color: getStatusColor(selectedReg.statusCode) }]}>
                      STATUS: {selectedReg.statusCode}
                    </Text>
                  </View>

                  <View style={styles.qrContainer}>
                    <Image
                      source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(selectedReg.qrToken)}` }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                  </View>

                  <Text style={[styles.qrHelperText, { color: colors.textSecondary }]}>
                    Show this to check-in staff or judge at the solving station.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* Assignments Schedule Modal */}
        <Modal
          visible={showScheduleModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowScheduleModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowScheduleModal(false)} />
            <View style={[styles.modalContent, { backgroundColor: colors.backgroundElement, borderColor: colors.border, maxWidth: 380 }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Schedule & Assignments</Text>
                <TouchableOpacity onPress={() => setShowScheduleModal(false)} style={styles.modalCloseBtn}>
                  <MaterialCommunityIcons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              {selectedReg && (
                <ScrollView contentContainerStyle={styles.scheduleBody}>
                  <Text style={[styles.modalTourName, { color: colors.text, marginBottom: 12 }]} numberOfLines={2}>
                    {selectedReg.tournamentName}
                  </Text>

                  {/* Registered events listing with Assignments */}
                  <Text style={[styles.scheduleSectionHeading, { color: colors.text, marginBottom: 8 }]}>
                    Registered Events ({selectedReg.registeredEvents.length})
                  </Text>

                  <View style={styles.eventsListContainer}>
                    {selectedReg.registeredEvents.map((evt) => (
                      <View key={evt.registrationEventId} style={[styles.eventListItemBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
                        <View style={styles.eventListItemHeader}>
                          <View>
                            <Text style={[styles.eventListName, { color: colors.text }]}>
                              {formatEventLabel(evt)}
                            </Text>
                            <Text style={[styles.eventListSub, { color: colors.textSecondary }]}>
                              Format: {evt.eventFormatCode}
                            </Text>
                          </View>
                          <View style={[styles.eventListBadge, { backgroundColor: colors.backgroundSelected }]}>
                            <Text style={[styles.eventListBadgeText, { color: colors.text }]}>
                              {evt.statusCode}
                            </Text>
                          </View>
                        </View>

                        {/* Smart Multi-Round Timeline */}
                        {(() => {
                          const assignments = evt.assignments;
                          if (!assignments || assignments.length === 0) {
                            return (
                              <View style={[styles.assignmentPendingContainer, { borderTopColor: colors.border }]}>
                                <MaterialCommunityIcons name="help-circle-outline" size={14} color={colors.textSecondary} />
                                <Text style={[styles.assignmentPendingText, { color: colors.textSecondary }]}>
                                  Ban Tổ Chức chưa phân nhóm thi đấu
                                </Text>
                              </View>
                            );
                          }


                          return (
                            <View style={{ gap: 6, marginTop: 8 }}>
                              {assignments.map((a, idx) => {
                                const isLast = idx === assignments.length - 1;
                                const isCompleted = a.groupStatusCode === 'COMPLETED';
                                const isOngoing = a.groupStatusCode === 'ONGOING';
                                const isPending = a.groupStatusCode === 'PENDING';
                                const isCurrentActive = isLast && (isOngoing || isPending);

                                const dotColor = isCompleted
                                  ? '#6b7280'
                                  : isOngoing
                                    ? colors.success
                                    : colors.accent;

                                const bgColor = isCurrentActive
                                  ? (isOngoing ? colors.success + '15' : colors.accent + '12')
                                  : 'transparent';

                                const borderColor = isCurrentActive
                                  ? (isOngoing ? colors.success + '30' : colors.accent + '25')
                                  : colors.border;

                                return (
                                  <View key={a.groupId} style={{ flexDirection: 'row', gap: 10 }}>
                                    {/* Timeline dot + line */}
                                    <View style={{ alignItems: 'center', width: 18 }}>
                                      <View style={{
                                        width: 10, height: 10, borderRadius: 5,
                                        backgroundColor: dotColor,
                                        marginTop: 10,
                                      }} />
                                      {!isLast && (
                                        <View style={{ width: 2, flex: 1, backgroundColor: colors.border, marginTop: 2 }} />
                                      )}
                                    </View>

                                    {/* Round card */}
                                    <View style={[{
                                      flex: 1, borderRadius: 10, borderWidth: 1,
                                      padding: 10, marginBottom: 2,
                                      backgroundColor: bgColor, borderColor,
                                    }]}>
                                      {/* Round header */}
                                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <Text style={{ fontSize: 12, fontWeight: '800', color: isCompleted ? colors.textSecondary : colors.text }}>
                                          Vòng {a.roundNumber}
                                          {isCurrentActive && isOngoing ? '  ĐANG THI' : ''}
                                          {isCurrentActive && isPending ? '  SẮP BẮT ĐẦU' : ''}
                                        </Text>
                                        <View style={{
                                          paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5,
                                          backgroundColor: isCompleted
                                            ? '#37415133'
                                            : isOngoing
                                              ? colors.success + '25'
                                              : colors.accent + '20',
                                        }}>
                                          <Text style={{
                                            fontSize: 9, fontWeight: '800',
                                            color: isCompleted ? colors.textSecondary : isOngoing ? colors.success : colors.accent,
                                          }}>
                                            {isCompleted ? 'HOÀN THÀNH' : isOngoing ? 'ĐANG THI' : 'CHUẨN BỊ'}
                                          </Text>
                                        </View>
                                      </View>

                                      {/* Group + Station */}
                                      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                          <MaterialCommunityIcons name="account-group-outline" size={13} color={isCompleted ? colors.textSecondary : colors.primary} />
                                          <Text style={{ fontSize: 11, color: isCompleted ? colors.textSecondary : colors.text, fontWeight: '600' }}>
                                            {a.groupName}
                                          </Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                          <MaterialCommunityIcons name="seat" size={13} color={isCompleted ? colors.textSecondary : colors.primary} />
                                          <Text style={{ fontSize: 11, color: isCompleted ? colors.textSecondary : colors.text, fontWeight: '600' }}>
                                            Bàn thi: {a.stationNumber ?? 'TBD'}
                                          </Text>
                                        </View>
                                      </View>

                                      {/* Eliminated note */}
                                      {isLast && isCompleted && (
                                        <Text style={{ fontSize: 10, color: '#f59e0b', marginTop: 4, fontWeight: '600' }}>
                                          Kết thúc hành trình tại vòng này
                                        </Text>
                                      )}
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          );
                        })()}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* Tournament Detail & Registration Modal */}
        <Modal
          visible={showDetailModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowDetailModal(false)}
        >
          <View style={styles.detailModalContainer}>
            <SafeAreaView style={[styles.detailModalContent, { backgroundColor: colors.backgroundElement }]} edges={['bottom']}>
              <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 2 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' }} />
              </View>
              <View style={[styles.detailModalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.detailModalTitle, { color: colors.text }]} numberOfLines={1}>
                  Tournament Details
                </Text>
                <TouchableOpacity onPress={() => setShowDetailModal(false)} style={styles.modalCloseBtn}>
                  <MaterialCommunityIcons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              {selectedTour && (
                <View style={{ flex: 1 }}>
                  <ScrollView contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>

                    {/* Banner Image in Detail Modal */}
                    {selectedTour.bannerUrl ? (
                      <View style={{ height: 160, borderRadius: 16, overflow: 'hidden', marginBottom: 14, backgroundColor: '#000' }}>
                        <Image source={{ uri: selectedTour.bannerUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      </View>
                    ) : null}

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.detailTourName, { color: colors.text, marginBottom: 0 }]}>
                          {selectedTour.name}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { borderColor: getRegStatusColor(getRegStatusLabel(selectedTour.id)) + '30', backgroundColor: getRegStatusColor(getRegStatusLabel(selectedTour.id)) + '12' }]}>
                        <Text style={[styles.statusBadgeText, { color: getRegStatusColor(getRegStatusLabel(selectedTour.id)) }]}>
                          {getRegStatusLabel(selectedTour.id)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailMetaRow}>
                      <MaterialCommunityIcons name="map-marker" size={16} color={colors.primary} />
                      <Text style={[styles.detailMetaText, { color: colors.textSecondary }]}>
                        {selectedTour.location || 'TP. Hồ Chí Minh, Việt Nam'}
                      </Text>
                    </View>

                    <View style={styles.detailMetaRow}>
                      <MaterialCommunityIcons name="calendar" size={16} color={colors.primary} />
                      <Text style={[styles.detailMetaText, { color: colors.textSecondary }]}>
                        {formatDates(selectedTour.startDate, selectedTour.endDate)}
                      </Text>
                    </View>

                    <View style={styles.detailMetaRow}>
                      <MaterialCommunityIcons name="account-group" size={16} color={colors.accent} />
                      <Text style={[styles.detailMetaText, { color: colors.accent, fontWeight: '700' }]}>
                        Sức chứa tối đa: {selectedTour.maxParticipants || 40} thí sinh
                      </Text>
                    </View>

                    <View style={styles.detailMetaRow}>
                      <MaterialCommunityIcons name="clock-outline" size={16} color={colors.primary} />
                      <Text style={[styles.detailMetaText, { color: colors.textSecondary }]}>
                        Mở Đăng Ký: {formatDates(selectedTour.registrationOpenAt, selectedTour.registrationCloseAt)}
                      </Text>
                    </View>

                    {selectedTour.description && (
                      <View style={[styles.descriptionBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
                          {selectedTour.description}
                        </Text>
                      </View>
                    )}

                    <Text style={[styles.detailHeading, { color: colors.text, marginTop: 20 }]}>
                      Available Events
                    </Text>

                    <View style={styles.eventsRegisterList}>
                      {selectedTour.events.map((evt) => {
                        const isSelected = !!selectedEventIds[evt.id];
                        const isRegistered = getRegistrationForTournament(selectedTour.id);
                        return (
                          <TouchableOpacity
                            key={evt.id}
                            style={[
                              styles.eventRegisterItem,
                              { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: colors.background }
                            ]}
                            onPress={() => {
                              if (!isRegistered) {
                                handleToggleEventSelection(evt.id);
                              }
                            }}
                            disabled={!!isRegistered}
                            activeOpacity={0.7}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.eventRegisterName, { color: colors.text }]}>
                                {formatEventLabel(evt)}
                              </Text>
                              <Text style={[styles.eventRegisterDetails, { color: colors.textSecondary }]}>
                                Format: {evt.eventFormatCode} • Solves: {evt.solveCount}
                              </Text>
                            </View>

                            {!isRegistered && (
                              <MaterialCommunityIcons
                                name={isSelected ? "checkbox-marked" : "checkbox-blank-outline"}
                                size={22}
                                color={isSelected ? colors.primary : colors.textSecondary}
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                  </ScrollView>

                  {/* Submit bar */}
                  <View style={[styles.detailSubmitBar, { borderTopColor: colors.border, backgroundColor: colors.backgroundElement }]}>
                    {getRegistrationForTournament(selectedTour.id) ? (
                      <View style={[styles.submitRegisterBtn, { backgroundColor: colors.backgroundSelected, borderWidth: 1, borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="check-decagram" size={18} color={colors.success} />
                        <Text style={[styles.submitRegisterBtnText, { color: colors.text }]}>Already Registered</Text>
                      </View>
                    ) : isRegistrationTimelineOpen(selectedTour) ? (
                      <TouchableOpacity
                        style={[styles.submitRegisterBtn, { backgroundColor: colors.primary }]}
                        onPress={handleRegisterSubmit}
                        disabled={submittingReg}
                      >
                        {submittingReg ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <MaterialCommunityIcons name="check-bold" size={18} color="#fff" />
                            <Text style={styles.submitRegisterBtnText}>Confirm Registration</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.submitRegisterBtn, { backgroundColor: colors.border }]}>
                        <MaterialCommunityIcons name="lock-outline" size={18} color={colors.textSecondary} />
                        <Text style={[styles.submitRegisterBtnText, { color: colors.textSecondary }]}>
                          Registration Closed
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </SafeAreaView>
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
    paddingHorizontal: 16,
    height: 56,
    justifyContent: 'center',
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.2 },

  // Tabs Bar
  tabBar: { flexDirection: 'row', height: 44, borderBottomWidth: 1 },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabLabel: { fontSize: 12, fontWeight: '800' },

  scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40 },
  listContainer: { gap: 14 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },

  // Cards
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', elevation: 1 },
  cardCompleted: { opacity: 0.62 }, // Grayscale visual style for completed tournaments
  cardBannerContainer: {
    height: 135,
    width: '100%',
    position: 'relative',
    backgroundColor: '#000',
  },
  cardBannerImage: {
    width: '100%',
    height: '100%',
  },
  cardBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  cardCapacityBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  cardCapacityBadgeText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '900',
  },
  capacityBarBg: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    marginTop: 6,
    width: '100%',
  },
  capacityBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 14, gap: 10 },
  cardDate: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  cardTitle: { fontSize: 15, fontWeight: '700', marginTop: 2, lineHeight: 20 },
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, borderWidth: 1,
  },
  statusBadgeText: { fontSize: 8.5, fontWeight: '700', letterSpacing: 0.5 },

  detailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 14, paddingBottom: 14 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: 12, fontWeight: '600' },

  // Actions
  actionsRow: { flexDirection: 'row', padding: 12, borderTopWidth: 1, gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'row', height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  borderBtn: { borderWidth: 1 },
  solidBtn: {},
  actionBtnText: { fontSize: 12, fontWeight: '700' },

  // Loading / Empty
  loadingContainer: { paddingVertical: 60, alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13, fontWeight: '600' },
  emptyContainer: { paddingVertical: 80, alignItems: 'center', gap: 10, paddingHorizontal: 20 },
  emptyText: { fontSize: 16, fontWeight: '800' },
  emptySubText: { fontSize: 12, textTransform: 'none', textAlign: 'center', lineHeight: 18 },

  // Modal QR
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 340, borderRadius: 22, borderWidth: 1, padding: 20, elevation: 6 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  modalCloseBtn: { padding: 4 },
  modalBody: { alignItems: 'center' },
  modalTourName: { fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 6, lineHeight: 20 },
  modalCompName: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  modalBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, marginBottom: 16 },
  modalBadgeText: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.5 },
  qrContainer: { padding: 12, backgroundColor: '#fff', borderRadius: 16, marginBottom: 14 },
  qrImage: { width: 180, height: 180 },
  qrHelperText: { fontSize: 11, textAlign: 'center', lineHeight: 16 },

  // Schedule modal
  scheduleBody: { paddingHorizontal: 4 },
  scheduleSectionHeading: { fontSize: 13, fontWeight: '800' },
  eventsListContainer: { marginTop: 8, gap: 10 },
  eventListItemBox: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 10 },
  eventListItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventListName: { fontSize: 13, fontWeight: '700' },
  eventListSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  eventListBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  eventListBadgeText: { fontSize: 8.5, fontWeight: '700' },

  // Real Assignments
  assignmentDetailsContainer: { borderTopWidth: 0.5, paddingTop: 8, gap: 6 },
  assignmentGroupBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, marginBottom: 2 },
  assignmentGroupBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  assignmentDetailsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  assignmentDetailsText: { fontSize: 12, fontWeight: '600' },
  assignmentPendingContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 0.5, paddingTop: 8 },
  assignmentPendingText: { fontSize: 11, fontWeight: '500', flex: 1 },

  // Tournament Detail & Registration Modal
  detailModalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  detailModalContent: { height: '86%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  detailModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 56, borderBottomWidth: 1 },
  detailModalTitle: { fontSize: 16, fontWeight: '800' },
  detailScrollContent: { padding: 16 },
  detailTourName: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  detailMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  detailMetaText: { fontSize: 13, fontWeight: '500' },
  descriptionBox: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12 },
  descriptionText: { fontSize: 12.5, lineHeight: 18, fontWeight: '400' },
  detailHeading: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  eventsRegisterList: { gap: 10 },
  eventRegisterItem: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 12, gap: 12 },
  eventRegisterName: { fontSize: 13, fontWeight: '700' },
  eventRegisterDetails: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  detailSubmitBar: { borderTopWidth: 1, padding: 16 },
  submitRegisterBtn: { flexDirection: 'row', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8 },
  submitRegisterBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
