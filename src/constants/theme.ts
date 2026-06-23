/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0e1118',
    background: '#f8f9fa',
    backgroundElement: '#ffffff',
    backgroundSelected: '#e9ecef',
    textSecondary: '#6c757d',
    primary: '#ff5a36', // Rubik orange-red
    accent: '#ffd166',  // Rubik yellow
    success: '#06d6a0', // Rubik green
    border: '#e2e8f0',
    card: '#ffffff',
  },
  dark: {
    text: '#f8f9fa',
    background: '#0a0b10', // Deep space dark
    backgroundElement: '#12131a', // Dark slate surface
    backgroundSelected: '#1c1e29', // Selected/active item background
    textSecondary: '#9fa2b2',
    primary: '#ff5a36',
    accent: '#ffd166',
    success: '#06d6a0',
    border: '#1f212e',
    card: '#12131a',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
