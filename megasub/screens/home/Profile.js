import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  StatusBar,
  Switch,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import BottomNav from './components/BottomNav';
import { useTheme } from '../../contexts/ThemeContext';
import { clearCachedVirtualAccounts, deleteAccount, updateFingerprintOption } from '../../lib/api';

const BIOMETRIC_LABEL = Platform.OS === 'ios' ? 'Face ID' : 'Fingerprint';

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
const BIOMETRIC_KEY = 'megasub_biometric_enabled';

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
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const isGoogleAccount = user?.auth_provider === 'google';
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(true);

  useEffect(() => {
    (async () => {
      const [hasHardware, isEnrolled, storedFlag] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        SecureStore.getItemAsync(BIOMETRIC_KEY),
      ]);
      setBiometricAvailable(hasHardware && isEnrolled);
      setBiometricEnabled(storedFlag === 'true');
    })();
  }, []);

  // Enabling requires proving the enrolled face/fingerprint actually works
  // right now, rather than just flipping a switch — avoids silently locking
  // the user out later with a biometric that was never actually confirmed.
  const handleToggleBiometric = async (value) => {
    if (!value) {
      await SecureStore.setItemAsync(BIOMETRIC_KEY, 'false');
      setBiometricEnabled(false);
      // Best effort — the local flag is what actually gates the app, so a
      // failed sync here shouldn't block the user from turning it off.
      updateFingerprintOption({ userId: user?.id, enabled: false }).catch(() => {});
      return;
    }

    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) {
      setBiometricAvailable(false);
      Alert.alert(
        `${BIOMETRIC_LABEL} Not Available`,
        `Set up ${BIOMETRIC_LABEL} in your device settings first, then try again here.`
      );
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Confirm ${BIOMETRIC_LABEL} to enable app lock`,
      disableDeviceFallback: false,
    });
    if (result.success) {
      await SecureStore.setItemAsync(BIOMETRIC_KEY, 'true');
      setBiometricEnabled(true);
      updateFingerprintOption({ userId: user?.id, enabled: true }).catch(() => {});
    }
  };

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
          // Only the session token gets cleared, same as handleUnauthorized
          // in App.js. USER_KEY holds phone_number/pin_set — there's no
          // server field for either, so wiping it here would erase that
          // memory and force the user through phone + PIN setup again on
          // every single re-login.
          await SecureStore.deleteItemAsync(SESSION_KEY);
          // A different person may log in next on this device — the cached
          // account list belongs to whoever just logged out.
          clearCachedVirtualAccounts();
          navigate && navigate('login');
        },
      },
    ]);
  };

  // DELETE /delete_account permanently removes the account server-side.
  // Google-created accounts may have no password on file, so it's sent only
  // when we know the account has one. Local data is only cleared after the
  // server confirms the delete — a wrong password or network failure must
  // not leave the device thinking the account is gone when it isn't.
  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') return;
    if (!isGoogleAccount && !deletePassword) {
      Alert.alert('Password Required', 'Enter your password to confirm account deletion.');
      return;
    }

    setDeleteLoading(true);
    try {
      await deleteAccount({
        userId: user?.id,
        password: isGoogleAccount ? undefined : deletePassword,
      });

      await SecureStore.deleteItemAsync(SESSION_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
      clearCachedVirtualAccounts();
      setDeleteModalVisible(false);
      setDeleteConfirmText('');
      setDeletePassword('');
      navigate && navigate('login');
    } catch (error) {
      Alert.alert('Could Not Delete Account', error.message || 'Please check your password and try again.');
    } finally {
      setDeleteLoading(false);
    }
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

        <Section title="Security" colors={colors}>
          <Row
            icon={Platform.OS === 'ios' ? 'scan-outline' : 'finger-print-outline'}
            color="#4A55DD"
            bg="rgba(74,85,221,0.1)"
            label={`${BIOMETRIC_LABEL} Login`}
            colors={colors}
            rightElement={
              <View style={styles.biometricRight}>
                {!biometricAvailable ? (
                  <Text style={[styles.rowValue, { color: colors.textFaint }]}>Unavailable</Text>
                ) : null}
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleToggleBiometric}
                  disabled={!biometricAvailable}
                  trackColor={{ false: '#D6D9EC', true: BRAND }}
                  thumbColor="#FFFFFF"
                />
              </View>
            }
          />
        </Section>

        <Section title="Account" colors={colors}>
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
          <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />
          <Row
            icon="trash-outline"
            color="#EF4444"
            bg="rgba(239,68,68,0.1)"
            label="Delete Account"
            destructive
            colors={colors}
            onPress={() => setDeleteModalVisible(true)}
          />
        </Section>
      </ScrollView>

      <BottomNav
        activeTab="profile"
        onTabPress={(tab) => {
          if (tab === 'profile') return;
          navigate && navigate(tab);
        }}
      />

      <Modal
        visible={deleteModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.overlayTouch} onPress={() => setDeleteModalVisible(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.divider }]} />
            <View style={styles.deleteIconWrap}>
              <Ionicons name="warning-outline" size={30} color="#EF4444" />
            </View>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Delete Account</Text>
            <Text style={[styles.deleteWarning, { color: colors.textMuted }]}>
              This permanently deletes your account and data from Megasub's servers. This cannot be undone.
            </Text>
            {!isGoogleAccount && (
              <>
                <Text style={[styles.deleteLabel, { color: colors.textMuted }]}>Enter your password</Text>
                <TextInput
                  style={[styles.deleteInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="Password"
                  placeholderTextColor={colors.textFaint}
                  secureTextEntry
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                />
              </>
            )}
            <Text style={[styles.deleteLabel, { color: colors.textMuted }]}>Type DELETE to confirm</Text>
            <TextInput
              style={[styles.deleteInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="DELETE"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="characters"
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
            />
            <TouchableOpacity
              style={[
                styles.deleteBtn,
                (deleteConfirmText.trim().toUpperCase() !== 'DELETE' ||
                  (!isGoogleAccount && !deletePassword) ||
                  deleteLoading) &&
                  styles.deleteBtnDisabled,
              ]}
              activeOpacity={0.85}
              onPress={handleDeleteAccount}
              disabled={
                deleteConfirmText.trim().toUpperCase() !== 'DELETE' ||
                (!isGoogleAccount && !deletePassword) ||
                deleteLoading
              }
            >
              <Text style={styles.deleteBtnText}>{deleteLoading ? 'Deleting…' : 'Delete My Account'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              activeOpacity={0.8}
              onPress={() => {
                setDeleteModalVisible(false);
                setDeleteConfirmText('');
                setDeletePassword('');
              }}
            >
              <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  section: { marginBottom: 22 },
  sectionTitle: { fontFamily: FONTS.semibold, fontSize: 12.5, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  sectionCard: { borderRadius: 18, paddingHorizontal: 6 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, gap: 12 },
  rowIconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontFamily: FONTS.semibold, fontSize: 13.5 },
  rowLabelDestructive: { color: '#EF4444' },
  rowValue: { fontFamily: FONTS.medium, fontSize: 12, marginRight: 4 },
  rowDivider: { height: 1, marginHorizontal: 10 },
  biometricRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  overlay: { flex: 1, backgroundColor: 'rgba(11,13,26,0.4)' },
  overlayTouch: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 24,
    paddingBottom: 30,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 18,
  },
  deleteIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  sheetTitle: {
    fontFamily: FONTS.extrabold,
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 10,
  },
  deleteWarning: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  deleteLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 12.5,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  deleteInput: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontFamily: FONTS.semibold,
    fontSize: 14,
    marginBottom: 18,
  },
  deleteBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  deleteBtnDisabled: { opacity: 0.5 },
  deleteBtnText: { fontFamily: FONTS.bold, fontSize: 14, color: '#FFFFFF' },
  cancelBtn: { paddingVertical: 12 },
  cancelBtnText: { fontFamily: FONTS.semibold, fontSize: 13.5 },
});
