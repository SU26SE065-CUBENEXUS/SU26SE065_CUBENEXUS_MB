import React, { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalSearchParams } from 'expo-router';
import {
  fetchCompetitorRegistrations,
  fetchPublicTournaments,
  fetchTournamentById,
  registerForTournament,
} from '@/services/competitorService';
import { RegistrationDto, TournamentDetailDto, EventDetailDto } from '@/types/competitor';

type TabSegment = 'MY_REGS' | 'OPEN_TOURS' | 'PAST_TOURS';

export default function TournamentsScreen() {
  const colors = Colors.dark;
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

  const loadData = useCallback(async (showIndicator = true) => {
    if (showIndicator) setIsLoading(true);
    try {
      // 1. Fetch public tournaments
      const tours = await fetchPublicTournaments();
      // Hide DRAFT tournaments
      const filteredTours = tours.filter(t => t.statusCode !== 'DRAFT');
      setPublicTournaments(filteredTours);

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

  const handleOpenDetail = async (tournamentId: string) => {
    setIsLoading(true);
    try {
      const detail = await fetchTournamentById(tournamentId);
      if (detail) {
        setSelectedTour(detail);
        // Clear checkboxes
        setSelectedEventIds({});
        setShowDetailModal(true);
      } else {
        Alert.alert('Error', 'Failed to retrieve tournament details.');
      }
    } catch {
      Alert.alert('Error', 'Could not query tournament information.');
    } finally {
      setIsLoading(false);
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
      <StatusBar barStyle="light-content" />
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
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading tournament lists...
              </Text>
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
                      <Text style={[styles.emptyText, { color: colors.text }]}>No open tournaments</Text>
                      <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
                        Check back later. There are no tournaments currently accepting registrations.
                      </Text>
                    </View>
                  ) : (
                    openTournamentsFiltered.map((tour) => (
                      <View
                        key={tour.id}
                        style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
                      >
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
                              {tour.location || 'Online / TBD'}
                            </Text>
                          </View>
                        </View>

                        <View style={[styles.actionsRow, { borderTopColor: colors.border }]}>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.solidBtn, { backgroundColor: colors.primary, flex: 1 }]}
                            onPress={() => handleOpenDetail(tour.id)}
                          >
                            <MaterialCommunityIcons name="clipboard-text-play-outline" size={16} color="#fff" />
                            <Text style={[styles.actionBtnText, { color: '#fff' }]}>
                              View Details & Register
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
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
                              {evt.puzzleTypeName}
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

                        {/* Real Backend Assignment Checks */}
                        {(() => {
                          const a = evt.assignment;
                          // Group DB statuses: Group.StatusCode = PENDING|ONGOING|LOCKED|COMPLETED
                          // isPublished = group.StatusCode != "PENDING" (set by backend)
                          if (a && a.isPublished) {
                            // Group is ONGOING/LOCKED/COMPLETED → show full assignment
                            return (
                              <View style={styles.assignmentDetailsContainer}>
                                <View style={[styles.assignmentGroupBadge, { backgroundColor: colors.success + '15', borderColor: colors.success + '30' }]}>
                                  <MaterialCommunityIcons name="account-group" size={13} color={colors.success} />
                                  <Text style={[styles.assignmentGroupBadgeText, { color: colors.success }]}>
                                    {a.groupStatusCode}
                                  </Text>
                                </View>
                                <View style={styles.assignmentDetailsRow}>
                                  <MaterialCommunityIcons name="layers-outline" size={14} color={colors.primary} />
                                  <Text style={[styles.assignmentDetailsText, { color: colors.text }]}>
                                    Round {a.roundNumber} • {a.groupName}
                                  </Text>
                                </View>
                                <View style={styles.assignmentDetailsRow}>
                                  <MaterialCommunityIcons name="seat" size={14} color={colors.primary} />
                                  <Text style={[styles.assignmentDetailsText, { color: colors.text }]}>
                                    Station: {a.stationNumber ?? 'TBD'}
                                  </Text>
                                </View>
                              </View>
                            );
                          } else if (a && !a.isPublished) {
                            // Group record EXISTS in DB but Group.StatusCode = PENDING
                            // Manager has generated groups but not started/published yet
                            return (
                              <View style={styles.assignmentDetailsContainer}>
                                <View style={[styles.assignmentGroupBadge, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '30' }]}>
                                  <MaterialCommunityIcons name="clock-outline" size={13} color={colors.accent} />
                                  <Text style={[styles.assignmentGroupBadgeText, { color: colors.accent }]}>
                                    PREPARING
                                  </Text>
                                </View>
                                <View style={styles.assignmentDetailsRow}>
                                  <MaterialCommunityIcons name="layers-outline" size={14} color={colors.textSecondary} />
                                  <Text style={[styles.assignmentDetailsText, { color: colors.text }]}>
                                    Round {a.roundNumber} • {a.groupName}
                                  </Text>
                                </View>
                                <View style={styles.assignmentDetailsRow}>
                                  <MaterialCommunityIcons name="seat" size={14} color={colors.textSecondary} />
                                  <Text style={[styles.assignmentDetailsText, { color: colors.textSecondary }]}>
                                    Station: {a.stationNumber ?? 'TBD'} · Waiting for manager to start
                                  </Text>
                                </View>
                              </View>
                            );
                          } else {
                            // assignment = null → No GroupCompetitor record yet
                            return (
                              <View style={styles.assignmentPendingContainer}>
                                <MaterialCommunityIcons name="help-circle-outline" size={14} color={colors.textSecondary} />
                                <Text style={[styles.assignmentPendingText, { color: colors.textSecondary }]}>
                                  Groups have not been assigned yet
                                </Text>
                              </View>
                            );
                          }
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
                        {selectedTour.location || 'TBD'}
                      </Text>
                    </View>

                    <View style={styles.detailMetaRow}>
                      <MaterialCommunityIcons name="calendar" size={16} color={colors.primary} />
                      <Text style={[styles.detailMetaText, { color: colors.textSecondary }]}>
                        {formatDates(selectedTour.startDate, selectedTour.endDate)}
                      </Text>
                    </View>

                    <View style={styles.detailMetaRow}>
                      <MaterialCommunityIcons name="clock-outline" size={16} color={colors.primary} />
                      <Text style={[styles.detailMetaText, { color: colors.textSecondary }]}>
                        Reg: {formatDates(selectedTour.registrationOpenAt, selectedTour.registrationCloseAt)}
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
                                {evt.puzzleTypeName}
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
  assignmentDetailsContainer: { borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 8, gap: 6 },
  assignmentGroupBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, marginBottom: 2 },
  assignmentGroupBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  assignmentDetailsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  assignmentDetailsText: { fontSize: 12, fontWeight: '600' },
  assignmentPendingContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 8 },
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
