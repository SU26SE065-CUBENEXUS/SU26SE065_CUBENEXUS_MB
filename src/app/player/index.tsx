import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, useColorScheme, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function PlayerDashboard() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'dark']; // Force dark mode for premium look
  const router = useRouter();

  // Mock data matching the FE project
  const competitor = {
    name: 'Nguyen Hoang Nam',
    wcaId: '2024NAMH01',
    qrCode: 'QR-428761', // Matches the default scanned code in FE Page
    bestTime: '8.42s',
    ao5: '10.56s',
    totalSolves: 124,
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/')} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Competitor Portal</Text>
          <View style={{ width: 40 }} /> {/* Spacer */}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Profile Card */}
          <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
            <View style={styles.profileRow}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>NH</Text>
              </View>
              <View>
                <Text style={[styles.profileName, { color: colors.text }]}>{competitor.name}</Text>
                <Text style={[styles.wcaId, { color: colors.primary }]}>WCA ID: {competitor.wcaId}</Text>
              </View>
            </View>
          </View>

          {/* QR Code Verification Card */}
          <View style={[styles.card, styles.qrCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Competitor QR Code</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
              Show this code to the judge at the scoring station to verify your details.
            </Text>

            <View style={styles.qrContainer}>
              {/* Outer glowing border */}
              <View style={[styles.qrWrapper, { borderColor: colors.primary }]}>
                {/* Mock QR Code details */}
                <MaterialCommunityIcons name="qrcode" size={160} color={colors.text} />
              </View>
              <Text style={[styles.qrCodeText, { color: colors.text }]}>{competitor.qrCode}</Text>
            </View>
          </View>

          {/* Quick Action Button */}
          <TouchableOpacity 
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
            onPress={() => router.push('/player/timer')}
          >
            <MaterialCommunityIcons name="timer-outline" size={22} color="#fff" />
            <Text style={styles.primaryButtonText}>Launch Practice Timer</Text>
          </TouchableOpacity>

          {/* Stats Section */}
          <View style={styles.statsHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Performance</Text>
            <MaterialCommunityIcons name="chart-bar" size={20} color={colors.primary} />
          </View>

          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Best Time</Text>
              <Text style={[styles.statValue, { color: colors.success }]}>{competitor.bestTime}</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Avg of 5 (Ao5)</Text>
              <Text style={[styles.statValue, { color: colors.accent }]}>{competitor.ao5}</Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border, marginTop: 12 }]}>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="cube-send" size={20} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.text }]}>Total Registered Puzzles: 3 (3x3, Skewb, Pyraminx)</Text>
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
  },
  wcaId: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  qrCard: {
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
  },
  qrContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  qrWrapper: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    shadowColor: '#ff5a36',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  qrCodeText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  primaryButton: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
    shadowColor: '#ff5a36',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  statsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
