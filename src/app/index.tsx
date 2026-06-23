import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, useColorScheme, StatusBar } from 'react-native';
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
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <MaterialCommunityIcons name="cube-outline" size={64} color={colors.primary} />
          </View>
          <Text style={[styles.brandText, { color: colors.text }]}>CUBE<Text style={{ color: colors.primary }}>NEXUS</Text></Text>
          <Text style={[styles.subtitleText, { color: colors.textSecondary }]}>
            COMPETITION HUB & TIMER
          </Text>
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
            CubeNexus Mobile Platform • Consistent with Web FE
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
    marginTop: 40,
    marginBottom: 40,
  },
  logoContainer: {
    marginBottom: 12,
    shadowColor: '#ff5a36',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  brandText: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
  },
  subtitleText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 4,
    marginTop: 6,
  },
  portalsContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
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
    marginBottom: 10,
  },
  iconWrapper: {
    padding: 8,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
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
    fontSize: 11,
    fontWeight: '600',
  },
});
