import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';
import { useResponsive } from '../../../lib/responsive';

const FONTS = {
  medium: 'Manrope_500Medium',
  bold: 'Manrope_700Bold',
};

const TABS = [
  { id: 'home',    label: 'Home',    icon: 'home' },
  { id: 'history', label: 'History', icon: 'file-text' },
  { id: 'wallet',  label: 'Wallet',  icon: 'credit-card' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

function TabButton({ tab, isActive, isTablet, colors, onPress }) {
  return (
    <TouchableOpacity key={tab.id} style={styles.tab} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.iconArea, isTablet && styles.iconAreaTablet]}>
        <Feather
          name={tab.icon}
          size={isTablet ? 20 : 22}
          color={isActive ? colors.brand : colors.textFaint}
          fill={isActive ? colors.brand : 'none'}
          strokeWidth={isActive ? 2.4 : 2}
        />
      </View>
      <Text style={[styles.tabLabel, { color: isActive ? colors.brand : colors.textFaint }, isActive && styles.tabLabelActive]}>
        {tab.label}
      </Text>
    </TouchableOpacity>
  );
}

export default function BottomNav({ activeTab, onTabPress }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { isTablet, content } = useResponsive();

  // iOS gets Apple's current "glass" tab-bar material (translucent blur,
  // rounded floating pill) — Android keeps the existing solid full-width bar
  // untouched below. Deliberately stays in normal document flow (not
  // position: absolute) so it still occupies its own layout space exactly
  // like the Android bar does — every screen's existing ScrollView bottom
  // padding was already sized around that, and floating it over content
  // would need re-tuning padding across every screen that renders this.
  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.iosOuterWrap, { paddingBottom: insets.bottom + 10 }]}>
        <View style={[styles.iosPill, content]}>
          <BlurView
            intensity={isDark ? 60 : 80}
            tint={isDark ? 'systemThickMaterialDark' : 'systemChromeMaterialLight'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.iosPillTint,
              { backgroundColor: isDark ? 'rgba(20,20,26,0.35)' : 'rgba(255,255,255,0.35)' },
            ]}
          />
          <View style={[styles.iosPillBorder, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(11,13,26,0.08)' }]} />
          <View style={styles.container}>
            {TABS.map((tab) => (
              <TabButton
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
                isTablet={isTablet}
                colors={colors}
                onPress={() => onTabPress && onTabPress(tab.id)}
              />
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    // The bar spans the screen, but the tabs themselves stay in the content
    // column instead of drifting to the far corners of a tablet.
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + 14, backgroundColor: colors.card, borderTopColor: colors.divider }]}>
      <View style={[styles.container, content]}>
        {TABS.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            isActive={activeTab === tab.id}
            isTablet={isTablet}
            colors={colors}
            onPress={() => onTabPress && onTabPress(tab.id)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(11,13,26,0.08)',
  },
  container: {
    flexDirection: 'row',
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  iconArea: {
    width: 42,
    height: 34,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconAreaTablet: { width: 38, height: 30 },
  tabLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: 'rgba(11,13,26,0.4)',
  },
  tabLabelActive: {
    fontFamily: FONTS.bold,
    color: '#4A55DD',
  },

  // iOS-only floating-look glass pill — still in normal flow (see comment
  // above), just styled with side margins so it reads as a floating pill.
  iosOuterWrap: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  iosPill: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#0B0D1A',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  iosPillTint: { borderRadius: 32 },
  iosPillBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    borderWidth: 1,
  },
});
