import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';
import { useResponsive } from '../../../lib/responsive';

const FONTS = {
  medium: 'Montserrat_500Medium',
  bold: 'Montserrat_700Bold',
};

// Active tabs use the filled icon, inactive tabs the outline.
const TABS = [
  { id: 'home',    label: 'Home',    icon: 'home-variant', iconOutline: 'home-variant-outline', set: 'material' },
  { id: 'history', label: 'History', icon: 'document-text', iconOutline: 'document-text-outline' },
  { id: 'wallet',  label: 'Wallet',  icon: 'card',          iconOutline: 'card-outline' },
  { id: 'profile', label: 'Profile', icon: 'person',        iconOutline: 'person-outline' },
];

function TabButton({ tab, isActive, isTablet, colors, isDark, onPress }) {
  // White reads best on the dark glass; the brand colour is used on light.
  const activeColor = isDark ? '#FFFFFF' : colors.brand;
  // Dark-mode text is all white, so inactive tabs are dimmed to keep the active one obvious.
  const inactiveColor = isDark ? 'rgba(255,255,255,0.5)' : colors.textFaint;
  // 0 = inactive, 1 = active. Drives the icon lift and scale.
  const progress = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  // Brief squeeze while the finger is down.
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: isActive ? 1 : 0,
      friction: 6,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [isActive, progress]);

  const squeeze = (to) =>
    Animated.spring(press, { toValue: to, friction: 5, tension: 220, useNativeDriver: true }).start();

  const Icon = tab.set === 'material' ? MaterialCommunityIcons : Ionicons;

  const iconScale = Animated.multiply(
    progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }),
    press
  );
  const iconLift = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });

  return (
    <Pressable
      style={styles.tab}
      onPress={onPress}
      onPressIn={() => squeeze(0.86)}
      onPressOut={() => squeeze(1)}
    >
      <View style={[styles.iconArea, isTablet && styles.iconAreaTablet]}>
        <Animated.View style={{ transform: [{ translateY: iconLift }, { scale: iconScale }] }}>
          <Icon
            name={isActive ? tab.icon : tab.iconOutline}
            size={isTablet ? 22 : 25}
            color={isActive ? activeColor : inactiveColor}
          />
        </Animated.View>
      </View>
      <Text style={[styles.tabLabel, { color: isActive ? activeColor : inactiveColor }, isActive && styles.tabLabelActive]}>
        {tab.label}
      </Text>
    </Pressable>
  );
}

export default function BottomNav({ activeTab, onTabPress }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { isTablet, content } = useResponsive();

  return (
    <View style={[styles.outerWrap, { paddingBottom: insets.bottom + 10 }]}>
      <View style={[styles.pill, content]}>
        {/* Frosted glass look: blur, a faint tint, and a light edge. */}
        <BlurView
          intensity={isDark ? 55 : 45}
          tint={isDark ? 'dark' : 'light'}
          experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? 'rgba(20,20,26,0.28)' : 'rgba(255,255,255,0.28)' },
          ]}
        />
        <View
          style={[
            styles.pillBorder,
            { borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.75)' },
          ]}
        />
        <View style={styles.container}>
          {TABS.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              isTablet={isTablet}
              colors={colors}
              isDark={isDark}
              onPress={() => onTabPress && onTabPress(tab.id)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Sits in normal layout flow at the bottom of the screen, so content ends
  // above it instead of scrolling underneath.
  outerWrap: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  pill: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#0B0D1A',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  pillBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    borderWidth: 1,
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
    width: 52,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconAreaTablet: { width: 46, height: 30 },
  tabLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
  },
  tabLabelActive: {
    fontFamily: FONTS.bold,
  },
});
