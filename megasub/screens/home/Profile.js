import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  StatusBar,
  Switch,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import BottomNav from './components/BottomNav';
import { useTheme } from '../../contexts/ThemeContext';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const BRAND = '#4A55DD';
const SESSION_KEY = 'megasub_session_token';
const USER_KEY = 'megasub_user_data';

function Row({ icon, color, bg, label, value, onPress, destructive, colors, rightElement }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.rowIconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.rowLabel, { color: colors.text }, destructive && styles.rowLabelDestructive]}>{label}</Text>
      {rightElement ? (
        rightElement
      ) : (
        <>
          {value ? <Text style={[styles.rowValue, { color: colors.textFaint }]}>{value}</Text> : null}
          {!destructive && <Feather name="chevron-right" size={18} color={colors.textFaint} />}
        </>
      )}
    </TouchableOpacity>
  );
}

function Section({ title, colors, children }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>{children}</View>
    </View>
  );
}

export default function Profile({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();

  const displayName =
    (user?.first_name && user?.last_name && `${user.first_name} ${user.last_name}`) ||
    user?.first_name ||
    user?.username ||
    'Guest User';
  const contact = user?.email || user?.phone_number || 'Not set';

  const getInitials = () => {
    if (user?.first_name && user?.last_name) return `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`;
    if (user?.first_name) return user.first_name.charAt(0);
    if (user?.username) return user.username.charAt(0);
    return 'U';
  };

  const handleRateApp = () => {
    Alert.alert('Rate Megasub', "Thanks for the love! We'll open the store listing once the app is live there.");
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync(SESSION_KEY);
          await SecureStore.deleteItemAsync(USER_KEY);
          navigate && navigate('login');
        },
      },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: colors.text }]}>{displayName}</Text>
            <Text style={[styles.profileContact, { color: colors.textMuted }]}>{contact}</Text>
          </View>
          <TouchableOpacity
            style={styles.editBtn}
            activeOpacity={0.75}
            onPress={() => navigate && navigate('edit-profile')}
          >
            <Feather name="edit-2" size={14} color={BRAND} />
          </TouchableOpacity>
        </View>

        <Section title="Appearance" colors={colors}>
          <Row
            icon={isDark ? 'moon' : 'moon-outline'}
            color="#6C76F5"
            bg="rgba(108,118,245,0.14)"
            label="Dark Mode"
            colors={colors}
            rightElement={
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: '#D6D9EC', true: BRAND }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </Section>

        <Section title="Account" colors={colors}>
          <Row
            icon="person-outline"
            color={BRAND}
            bg="rgba(74,85,221,0.1)"
            label="Edit Profile"
            colors={colors}
            onPress={() => navigate && navigate('edit-profile')}
          />
          <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />
          <Row
            icon="shield-checkmark-outline"
            color="#10B981"
            bg="rgba(16,185,129,0.1)"
            label="KYC Verification"
            value={user?.kyc_status === 'verified' ? 'Verified' : 'Pending'}
            colors={colors}
            onPress={() => navigate && navigate('kyc')}
          />
          <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />
          <Row
            icon="keypad-outline"
            color="#F59E0B"
            bg="rgba(245,158,11,0.1)"
            label="Change Transaction PIN"
            colors={colors}
            onPress={() => navigate && navigate('change-pin')}
          />
          <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />
          <Row
            icon="lock-closed-outline"
            color="#EF4444"
            bg="rgba(239,68,68,0.1)"
            label="Change Password"
            colors={colors}
            onPress={() => navigate && navigate('change-password')}
          />
        </Section>

        <Section title="Wallet & Transactions" colors={colors}>
          <Row
            icon="wallet-outline"
            color={BRAND}
            bg="rgba(74,85,221,0.1)"
            label="My Wallet"
            colors={colors}
            onPress={() => navigate && navigate('wallet')}
          />
          <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />
          <Row
            icon="receipt-outline"
            color="#06B6D4"
            bg="rgba(6,182,212,0.1)"
            label="Transaction History"
            colors={colors}
            onPress={() => navigate && navigate('history')}
          />
          <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />
          <Row
            icon="gift-outline"
            color="#EC4899"
            bg="rgba(236,72,153,0.1)"
            label="Refer & Earn"
            colors={colors}
            onPress={() => navigate && navigate('refer-earn')}
          />
        </Section>

        <Section title="Support" colors={colors}>
          <Row
            icon="help-circle-outline"
            color="#7C3AED"
            bg="rgba(124,58,237,0.1)"
            label="Help Center"
            colors={colors}
            onPress={() => navigate && navigate('help-center')}
          />
          <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />
          <Row
            icon="chatbubble-ellipses-outline"
            color="#00C9A7"
            bg="rgba(0,201,167,0.1)"
            label="Contact Support"
            colors={colors}
            onPress={() => navigate && navigate('contact-support')}
          />
          <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />
          <Row
            icon="star-outline"
            color="#F59E0B"
            bg="rgba(245,158,11,0.1)"
            label="Rate the App"
            colors={colors}
            onPress={handleRateApp}
          />
        </Section>

        <Section title="Others" colors={colors}>
          <Row
            icon="document-text-outline"
            color="#6B7088"
            bg="rgba(107,112,136,0.1)"
            label="Terms & Privacy Policy"
            colors={colors}
            onPress={() => navigate && navigate('terms-privacy')}
          />
          <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />
          <Row icon="log-out-outline" color="#EF4444" bg="rgba(239,68,68,0.1)" label="Log Out" destructive colors={colors} onPress={handleLogout} />
        </Section>
      </ScrollView>

      <BottomNav
        activeTab="profile"
        onTabPress={(tab) => {
          if (tab === 'profile') return;
          navigate && navigate(tab);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitle: { fontFamily: FONTS.extrabold, fontWeight: '800', fontSize: 20 },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, padding: 16, marginBottom: 24, gap: 14,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: BRAND,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: FONTS.extrabold, fontWeight: '800', fontSize: 20, color: '#FFFFFF', textTransform: 'uppercase' },
  profileName: { fontFamily: FONTS.bold, fontSize: 15.5, marginBottom: 3 },
  profileContact: { fontFamily: FONTS.regular, fontSize: 12.5 },
  editBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(74,85,221,0.08)', borderWidth: 1, borderColor: 'rgba(74,85,221,0.2)',
  },

  section: { marginBottom: 22 },
  sectionTitle: { fontFamily: FONTS.semibold, fontSize: 12.5, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  sectionCard: { borderRadius: 18, paddingHorizontal: 6 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, gap: 12 },
  rowIconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontFamily: FONTS.semibold, fontSize: 13.5 },
  rowLabelDestructive: { color: '#EF4444' },
  rowValue: { fontFamily: FONTS.medium, fontSize: 12, marginRight: 4 },
  rowDivider: { height: 1, marginHorizontal: 10 },
});
