import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';
import { useResponsive } from '../../../lib/responsive';

const FONTS = {
  regular: 'Manrope_400Regular',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

export default function WelcomeHeader({ userName, userData, onNotifPress, notifCount = 0 }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isTablet, content } = useResponsive();

  const displayName = userData?.first_name || userName || userData?.username || 'there';

  const getGreeting = () => 'Welcome back';

  const getInitials = () => {
    if (userData?.first_name && userData?.last_name)
      return `${userData.first_name.charAt(0)}${userData.last_name.charAt(0)}`;
    if (userData?.first_name) return userData.first_name.charAt(0);
    if (userName) return userName.charAt(0);
    return 'U';
  };

  return (
    // The bar keeps its full-width background and divider; only the row of
    // content inside it is pulled into the tablet column.
    <View style={[styles.container, { paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.divider }]}>
      <View style={[styles.row, content]}>
        <View style={styles.left}>
          <View style={styles.greetingRow}>
            <Text style={[styles.greeting, { color: colors.textMuted }]}>{getGreeting()} 👋</Text>
            {/*  */}
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{displayName}</Text>
          <Text style={[styles.sub, { color: colors.textMuted }]}>How can we help you today?</Text>
        </View>

        <TouchableOpacity
          style={[styles.notifBtn, isTablet && styles.notifBtnTablet]}
          onPress={onNotifPress}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications-outline" size={isTablet ? 17 : 19} color="#4A55DD" />
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  left: { flex: 1 },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  greeting: {
    fontFamily: FONTS.regular,
    fontSize: 11.5,
    color: 'rgba(11,13,26,0.45)',
  },
  userInitials: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4A55DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  name: {
    fontFamily: FONTS.extrabold,
    fontWeight: '800',
    fontSize: 18,
    color: '#0B0D1A',
    marginBottom: 2,
  },
  sub: {
    fontFamily: FONTS.regular,
    fontSize: 11.5,
    color: 'rgba(11,13,26,0.45)',
  },
  notifBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(74,85,221,0.08)',
    borderWidth: 1, borderColor: 'rgba(74,85,221,0.2)',
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
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