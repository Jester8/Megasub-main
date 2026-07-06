import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';

const FONTS = {
  regular: 'Manrope_400Regular',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const DEMO_NOTIFICATIONS = [
  {
    id: '1',
    title: 'Payment successful',
    message: 'Your airtime recharge of ₦1,000 was successful.',
    time: '2m ago',
    icon: 'checkmark-circle',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.1)',
  },
  {
    id: '2',
    title: 'KYC Approved',
    message: 'Your verification has been approved. You can now create requests.',
    time: '1h ago',
    icon: 'shield-checkmark',
    color: '#4A55DD',
    bg: 'rgba(74,85,221,0.1)',
  },
  {
    id: '3',
    title: 'New promo available',
    message: 'Get 5% cashback on all electricity bill payments this week.',
    time: '3h ago',
    icon: 'pricetag',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.1)',
  },
  {
    id: '4',
    title: 'Reminder',
    message: 'Your data subscription expires tomorrow. Renew now to stay connected.',
    time: '1d ago',
    icon: 'time',
    color: '#EC4899',
    bg: 'rgba(236,72,153,0.1)',
  },
];

export default function WelcomeHeader({ userName, userData, onNotifPress, notifCount = 0 }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  const handleOpen = () => {
    setVisible(true);
    onNotifPress && onNotifPress();
  };

  const displayName = userData?.first_name || userName || userData?.username || 'there';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getInitials = () => {
    if (userData?.first_name && userData?.last_name)
      return `${userData.first_name.charAt(0)}${userData.last_name.charAt(0)}`;
    if (userData?.first_name) return userData.first_name.charAt(0);
    if (userName) return userName.charAt(0);
    return 'U';
  };

  return (
    <>
      <View style={[styles.container, { paddingTop: insets.top + 16, backgroundColor: colors.card, borderBottomColor: colors.divider }]}>
        <View style={styles.left}>
          <View style={styles.greetingRow}>
            <Text style={[styles.greeting, { color: colors.textMuted }]}>{getGreeting()} 👋</Text>
            {userData && (
              <View style={styles.userInitials}>
                <Text style={styles.initialsText}>{getInitials()}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{displayName}</Text>
          <Text style={[styles.sub, { color: colors.textMuted }]}>How can we help you today?</Text>
        </View>

        <TouchableOpacity style={styles.notifBtn} onPress={handleOpen} activeOpacity={0.8}>
          <Ionicons name="notifications-outline" size={22} color="#4A55DD" />
          {notifCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{notifCount > 9 ? '9+' : notifCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.overlayTouch} onPress={() => setVisible(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Notifications</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.list}
            >
              {DEMO_NOTIFICATIONS.map((n) => (
                <View key={n.id} style={styles.notifItem}>
                  <View style={[styles.notifIconWrap, { backgroundColor: n.bg }]}>
                    <Ionicons name={n.icon} size={18} color={n.color} />
                  </View>
                  <View style={styles.notifContent}>
                    <View style={styles.notifTopRow}>
                      <Text style={[styles.notifTitle, { color: colors.text }]}>{n.title}</Text>
                      <Text style={[styles.notifTime, { color: colors.textFaint }]}>{n.time}</Text>
                    </View>
                    <Text style={[styles.notifMessage, { color: colors.textMuted }]}>{n.message}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(11,13,26,0.08)',
  },
  left: { flex: 1 },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  greeting: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: 'rgba(11,13,26,0.45)',
  },
  userInitials: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4A55DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  name: {
    fontFamily: FONTS.extrabold,
    fontWeight: '800',
    fontSize: 23,
    color: '#0B0D1A',
    marginBottom: 3,
  },
  sub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: 'rgba(11,13,26,0.45)',
  },
  notifBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(74,85,221,0.08)',
    borderWidth: 1, borderColor: 'rgba(74,85,221,0.2)',
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
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
  overlay: { flex: 1, backgroundColor: 'rgba(11,13,26,0.4)' },
  overlayTouch: { flex: 1 },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    maxHeight: '75%',
    minHeight: '50%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(11,13,26,0.12)',
    alignSelf: 'center', marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: FONTS.extrabold,
    fontWeight: '800',
    fontSize: 18,
    color: '#0B0D1A',
  },
  seeAll: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: '#4A55DD',
  },
  list: { paddingBottom: 30, gap: 14 },
  notifItem: { flexDirection: 'row', gap: 12 },
  notifIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  notifContent: { flex: 1 },
  notifTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  notifTitle: {
    fontFamily: FONTS.bold, fontWeight: '700',
    fontSize: 13.5, color: '#0B0D1A',
  },
  notifTime: {
    fontFamily: FONTS.regular,
    fontSize: 11, color: 'rgba(11,13,26,0.4)',
  },
  notifMessage: {
    fontFamily: FONTS.regular,
    fontSize: 12.5, color: 'rgba(11,13,26,0.55)', lineHeight: 18,
  },
});