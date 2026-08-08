import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Share,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../../contexts/ThemeContext';
import { updateReferralCode } from '../../lib/api';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const BRAND = '#4A55DD';
const USER_KEY = 'megasub_user_data';

export default function ReferEarn({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(user || {});

  // A custom referral_code, once set, takes priority over the phone number
  // as the identifier others use to sign up under this account.
  const referralCode = currentUser?.referral_code || currentUser?.phone_number || 'Not set';
  // mega-sub.com is the only confirmed public domain in this app (it's the
  // live API host) — there's no app-store listing yet ("Rate Megasub" is
  // still a placeholder) and no custom URL scheme configured, so this is the
  // best available invite destination until a dedicated landing/store page
  // exists. Swap this for the real store/landing link once one is live.
  const inviteLink = `https://mega-sub.com?ref=${encodeURIComponent(referralCode)}`;
  const shareMessage = `Join me on Megasub for fast, reliable airtime, data, and bill payments! Use my referral code ${referralCode} when you sign up: ${inviteLink}`;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: shareMessage });
    } catch (error) {
      console.error(error);
    }
  };

  const handleSaveCode = async () => {
    const trimmed = customCode.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      await updateReferralCode({ userId: currentUser?.id, referralCode: trimmed });
      const updatedUser = { ...currentUser, referral_code: trimmed };
      setCurrentUser(updatedUser);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(updatedUser));
      setCustomCode('');
      Alert.alert('Referral Code Updated', `Your referral code is now ${trimmed}.`);
    } catch (error) {
      Alert.alert('Could Not Update Code', error.message || 'Please try again.');
    } finally {
      setSaving(false);
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Refer & Earn</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="gift" size={26} color="#FFFFFF" />
          </View>
          <Text style={styles.heroTitle}>Invite Friends, Earn Rewards</Text>
          <Text style={styles.heroSub}>
            Share your referral code with friends. When they sign up using it, they're linked to your account.
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Your Referral Code</Text>
        <View style={[styles.codeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.codeText, { color: BRAND }]} numberOfLines={1}>{referralCode}</Text>
          <TouchableOpacity onPress={handleCopy} activeOpacity={0.7} style={styles.copyBtn}>
            <Feather name={copied ? 'check' : 'copy'} size={16} color={BRAND} />
          </TouchableOpacity>
        </View>
        {!currentUser?.referral_code ? (
          <Text style={[styles.hintText, { color: colors.textFaint }]}>
            You haven't set a custom code yet, so your phone number works as your referral code for now.
          </Text>
        ) : null}

        <TouchableOpacity style={styles.shareBtn} activeOpacity={0.85} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
          <Text style={styles.shareBtnText}>Share Invite Link</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Customize Your Code</Text>
        <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="e.g. SAMUEL2026"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            value={customCode}
            onChangeText={setCustomCode}
          />
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, (!customCode.trim() || saving) && styles.saveBtnDisabled]}
          activeOpacity={0.85}
          onPress={handleSaveCode}
          disabled={!customCode.trim() || saving}
        >
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveBtnText}>Save New Code</Text>}
        </TouchableOpacity>
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
  sectionLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: '#6B7088', marginTop: 22, marginBottom: 10 },

  heroCard: {
    backgroundColor: BRAND, borderRadius: 20, padding: 22, alignItems: 'center',
  },
  heroIconWrap: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  heroTitle: { fontFamily: FONTS.extrabold, fontWeight: '800', fontSize: 17, color: '#FFFFFF', textAlign: 'center', marginBottom: 8 },
  heroSub: { fontFamily: FONTS.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 18 },

  codeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 16, height: 56,
    borderWidth: 1.5, borderColor: '#ECEDF6', borderStyle: 'dashed',
  },
  codeText: { flex: 1, fontFamily: FONTS.extrabold, fontWeight: '800', fontSize: 16, letterSpacing: 1, marginRight: 10 },
  copyBtn: { padding: 4 },
  hintText: { fontFamily: FONTS.regular, fontSize: 11.5, marginTop: 8, lineHeight: 16 },

  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: BRAND, borderRadius: 18, height: 56, gap: 8, marginTop: 22,
    shadowColor: BRAND, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  shareBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },

  inputCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1.5, borderColor: '#ECEDF6',
  },
  input: { flex: 1, fontFamily: FONTS.semibold, fontSize: 15 },

  saveBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: BRAND, borderRadius: 18, height: 56, marginTop: 14,
  },
  saveBtnDisabled: { backgroundColor: '#B7BCEF' },
  saveBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },
});
