import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';
import { useResponsive } from '../../../lib/responsive';

const FONTS = {
  regular: 'Montserrat_400Regular',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  extrabold: 'Montserrat_800ExtraBold',
};

// Avatar gradients; the pair is picked from the user's name so each person
// keeps the same colours every time the app opens.
const AVATAR_GRADIENTS = [
  ['#7C3AED', '#4A55DD'],
  ['#EC4899', '#F59E0B'],
  ['#0EA5E9', '#10B981'],
  ['#F97316', '#EF4444'],
  ['#4A55DD', '#06B6D4'],
  ['#10B981', '#84CC16'],
];

function gradientFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

export default function WelcomeHeader({ userName, userData, onNotifPress, notifCount = 0 }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { isTablet, content } = useResponsive();
  const [tipVisible, setTipVisible] = useState(false);
  const tipTimer = useRef(null);

  const displayName = userData?.first_name || userName || userData?.username || 'there';

  // A phone has no hover, so pressing and holding the avatar or name is the
  // equivalent: it shows "Welcome <name>" for two seconds.
  const showTip = () => {
    setTipVisible(true);
    clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => setTipVisible(false), 2000);
  };
  useEffect(() => () => clearTimeout(tipTimer.current), []);

  return (
    // The bar keeps its full-width background and divider; only the row of
    // content inside it is pulled into the tablet column.
    <View style={[styles.container, { paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.divider }]}>
      <View style={[styles.row, content]}>
        <Pressable style={styles.left} onLongPress={showTip} delayLongPress={250}>
          <LinearGradient colors={gradientFor(displayName)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <Ionicons name="person" size={22} color="#FFFFFF" />
            <View style={[styles.onlineDot, { borderColor: colors.card }]} />
          </LinearGradient>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>

          {tipVisible && (
            <View style={styles.tip}>
              <Text style={styles.tipText}>Welcome {displayName}</Text>
            </View>
          )}
        </Pressable>

        <TouchableOpacity
          style={[styles.notifBtn, isTablet && styles.notifBtnTablet]}
          onPress={onNotifPress}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications-outline" size={isTablet ? 17 : 19} color={isDark ? '#FFFFFF' : '#4A55DD'} />
          {notifCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{notifCount > 9 ? '9+' : notifCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(11,13,26,0.08)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
  },
  name: {
    flexShrink: 1,
    fontFamily: FONTS.extrabold,
    fontSize: 18,
    color: '#0B0D1A',
  },
  tip: {
    position: 'absolute',
    left: 0,
    top: 48,
    backgroundColor: '#0B0D1A',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    zIndex: 10,
  },
  tipText: { fontFamily: FONTS.semibold, fontSize: 12, color: '#FFFFFF' },
  notifBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(74,85,221,0.08)',
    borderWidth: 1, borderColor: 'rgba(74,85,221,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  notifBtnTablet: { width: 34, height: 34, borderRadius: 17 },
  badge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#FF4D6D', alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  badgeText: {
    fontFamily: FONTS.semibold,
    fontSize: 9, color: '#FFFFFF', lineHeight: 12,
  },
});