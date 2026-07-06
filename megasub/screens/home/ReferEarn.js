import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const BRAND = '#4A55DD';

export default function ReferEarn({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);

  const referralCode = user?.referral_code || `MEGA-${(user?.username || user?.id || 'GUEST').toString().slice(0, 6).toUpperCase()}`;
  const shareMessage = `Join me on Megasub for fast, reliable airtime, data, and bill payments! Use my referral code ${referralCode} when you sign up.`;

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

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigate && navigate('profile')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color="#0B0D1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refer & Earn</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="gift" size={26} color="#FFFFFF" />
          </View>
          <Text style={styles.heroTitle}>Invite Friends, Earn Rewards</Text>
          <Text style={styles.heroSub}>
            Share your referral code with friends. When they sign up and make their first transaction, you both earn a bonus.
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Total Referrals</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>₦0.00</Text>
            <Text style={styles.statLabel}>Total Earnings</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Your Referral Code</Text>
        <View style={styles.codeCard}>
          <Text style={styles.codeText}>{referralCode}</Text>
          <TouchableOpacity onPress={handleCopy} activeOpacity={0.7} style={styles.copyBtn}>
            <Feather name={copied ? 'check' : 'copy'} size={16} color={BRAND} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.shareBtn} activeOpacity={0.85} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
          <Text style={styles.shareBtnText}>Share Invite Link</Text>
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

  statsRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#ECEDF6' },
  statValue: { fontFamily: FONTS.extrabold, fontWeight: '800', fontSize: 18, color: '#0B0D1A', marginBottom: 4 },
  statLabel: { fontFamily: FONTS.medium, fontSize: 11.5, color: '#9CA0B8' },

  codeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 16, height: 56,
    borderWidth: 1.5, borderColor: '#ECEDF6', borderStyle: 'dashed',
  },
  codeText: { fontFamily: FONTS.extrabold, fontWeight: '800', fontSize: 16, color: BRAND, letterSpacing: 1 },
  copyBtn: { padding: 4 },

  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: BRAND, borderRadius: 18, height: 56, gap: 8, marginTop: 22,
    shadowColor: BRAND, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  shareBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },
});
