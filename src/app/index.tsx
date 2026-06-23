import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, useColorScheme, StatusBar, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function WelcomeScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'dark']; // Force dark mode for a premium aesthetic
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Visual background glows */}
      <View style={styles.glowContainer}>
        <View style={[styles.glowBall, { backgroundColor: colors.primary, top: -100, left: -50, opacity: 0.15 }]} />
        <View style={[styles.glowBall, { backgroundColor: colors.accent, bottom: -150, right: -50, opacity: 0.1 }]} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        {/* Header Section aligned with Web FE */}
        <View style={styles.header}>
          <View style={[styles.logoContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Image
              source={require('@/assets/images/logoCube.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

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

        {/* Portal Selection Cards */}
        <View style={styles.portalsContainer}>

          {/* Competitor Card */}
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
            activeOpacity={0.8}
            onPress={() => router.push('/player')}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(255, 90, 54, 0.1)' }]}>
                <MaterialCommunityIcons name="timer-outline" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Competitor Portal</Text>
            </View>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
              Show your competitor QR code to judges, practice with the integrated Rubik's cube timer, and track your session statistics.
            </Text>
            <View style={[styles.button, { backgroundColor: colors.primary }]}>
              <Text style={styles.buttonText}>Enter Competitor Portal</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* Judge Card */}
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
            activeOpacity={0.8}
            onPress={() => router.push('/judge')}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(255, 209, 102, 0.1)' }]}>
                <MaterialCommunityIcons name="qrcode-scan" size={32} color={colors.accent} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Judge Station</Text>
            </View>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
              Scan competitors' QR codes, verify details, input stackmat times, select penalties, and collect signatures.
            </Text>
            <View style={[styles.button, { backgroundColor: 'rgba(255, 209, 102, 0.2)', borderWidth: 1, borderColor: colors.accent }]}>
              <Text style={[styles.buttonText, { color: colors.accent }]}>Access Judge Station</Text>
              <MaterialCommunityIcons name="shield-account-outline" size={18} color={colors.accent} />
            </View>
          </TouchableOpacity>

        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            CubeNexus Mobile Platform • Sync Active
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  glowContainer: {
    ...StyleSheet.absoluteFill,
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
    paddingHorizontal: 24,
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  logoContainer: {
    width: 76,
    height: 76,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#ff5a36',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  brandText: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  sloganRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  sloganText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  greenDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#22c55e',
  },
  redDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#ef4444',
  },
  portalsContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  iconWrapper: {
    padding: 8,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  cardDescription: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 16,
  },
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    height: 48,
    borderRadius: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});
