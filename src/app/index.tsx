import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, StatusBar, Image, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

export default function GatekeeperScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'dark']; // Force dark mode for a premium aesthetic
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || !user) {
        router.replace('/login');
      } else {
        const role = user.role.toUpperCase();
        if (role === 'COMPETITOR') {
          router.replace('/player');
        } else if (role === 'JUDGE' || role === 'ADMIN' || role === 'MANAGER') {
          router.replace('/judge');
        } else {
          // If role is invalid, redirect to login
          router.replace('/login');
        }
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Visual background glows */}
      <View style={styles.glowContainer}>
        <View style={[styles.glowBall, { backgroundColor: colors.primary, top: -100, left: -50, opacity: 0.15 }]} />
        <View style={[styles.glowBall, { backgroundColor: colors.accent, bottom: -150, right: -50, opacity: 0.1 }]} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Logo container */}
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

          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Initializing Secure Session...
            </Text>
          </View>
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
    zIndex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    width: 80,
    height: 80,
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
    marginBottom: 40,
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
  loaderContainer: {
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 8,
  },
});

