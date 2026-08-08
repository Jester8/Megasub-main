import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};

// Sourced from the Terms and Conditions doc's own Contact Information
// section (Samuel, 2026-08-04) — the placeholder all-zeros number this
// replaced is exactly what QA flagged (Screenshot #5). The same number is
// used for both WhatsApp and Call since the source docs only list one; if
// there's a separate WhatsApp-specific line, swap it in here.
const SUPPORT_PHONE = '+2348134745216';
const SUPPORT_EMAIL = 'support@mega-sub.com';

const CHANNELS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    sub: 'Chat with us, usually replies in minutes',
    icon: 'logo-whatsapp',
    color: '#25D366',
    bg: 'rgba(37,211,102,0.1)',
    getUrl: () => `whatsapp://send?phone=${SUPPORT_PHONE}&text=${encodeURIComponent('Hi, I need help with my Megasub account.')}`,
  },
  {
    id: 'email',
    label: 'Email',
    sub: SUPPORT_EMAIL,
    icon: 'mail-outline',
    color: '#4A55DD',
    bg: 'rgba(74,85,221,0.1)',
    getUrl: () => `mailto:${SUPPORT_EMAIL}`,
  },
  {
    id: 'phone',
    label: 'Call Us',
    sub: SUPPORT_PHONE,
    icon: 'call-outline',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.1)',
    getUrl: () => `tel:${SUPPORT_PHONE}`,
  },
];

export default function ContactSupport({ navigate }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const handleOpen = async (channel) => {
    const url = channel.getUrl();
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Not Available', `${channel.label} isn't available on this device.`);
      }
    } catch (error) {
      Alert.alert('Error', `Could not open ${channel.label}.`);
      console.error(error);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card }]}
          onPress={() => navigate && navigate('profile')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Contact Support</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.intro, { color: colors.textMuted }]}>Choose how you'd like to reach us. Our team is available 8am – 10pm daily.</Text>

        <View style={[styles.listCard, { backgroundColor: colors.card }]}>
          {CHANNELS.map((channel, index) => (
            <View key={channel.id}>
              <TouchableOpacity style={styles.row} onPress={() => handleOpen(channel)} activeOpacity={0.75}>
                <View style={[styles.rowIconWrap, { backgroundColor: channel.bg }]}>
                  <Ionicons name={channel.icon} size={19} color={channel.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>{channel.label}</Text>
                  <Text style={[styles.rowSub, { color: colors.textMuted }]}>{channel.sub}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textFaint} />
              </TouchableOpacity>
              {index < CHANNELS.length - 1 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#0B0D1A',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 16, color: '#0B0D1A' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },
  intro: { fontFamily: FONTS.regular, fontSize: 13, color: 'rgba(11,13,26,0.55)', lineHeight: 19, marginBottom: 20 },

  listCard: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, gap: 12 },
  rowIconWrap: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontFamily: FONTS.bold, fontSize: 13.5, color: '#0B0D1A', marginBottom: 2 },
  rowSub: { fontFamily: FONTS.regular, fontSize: 11.5, color: 'rgba(11,13,26,0.45)' },
  divider: { height: 1, backgroundColor: 'rgba(11,13,26,0.06)', marginHorizontal: 8 },
});
