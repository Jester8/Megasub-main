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
  RefreshControl,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../../contexts/ThemeContext';
import {
  updateReferralCode,
  fetchReferralSummary,
  fetchReferredUsers,
  fetchReferralRewards,
} from '../../lib/api';
import { formatNaira } from '../../lib/format';

const FONTS = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  extrabold: 'Montserrat_800ExtraBold',
};

const BRAND = '#4A55DD';
const USER_KEY = 'megasub_user_data';
// Backend rule: 3-50 characters, letters / numbers / underscore / hyphen.
const CODE_PATTERN = /^[A-Za-z0-9_-]{3,50}$/;
const PREVIEW_ROWS = 10;

// The list endpoints are paginated; depending on the serializer the rows sit
// at data, data.data or data.items. Normalise so the screen never crashes on
// a shape difference.
const toList = (json) => {
  const data = json?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

const toTotal = (json, fallback) => {
  const data = json?.data;
  return data?.total ?? data?.meta?.total ?? json?.meta?.total ?? fallback;
};

const personName = (row) =>
  row?.name ||
  row?.full_name ||
  [row?.first_name, row?.last_name].filter(Boolean).join(' ') ||
  row?.username ||
  'Customer';

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
};

const prettify = (value) =>
  String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const naira = (value) => `₦${formatNaira(value)}`;

const STATUS_COLORS = { credited: '#16A34A', pending: '#D97706', reversed: '#DC2626' };

export default function ReferEarn({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('rewards');

  const summaryQuery = useQuery({ queryKey: ['referral-summary', user?.id], queryFn: fetchReferralSummary });
  const usersQuery = useQuery({
    queryKey: ['referral-users', user?.id],
    queryFn: () => fetchReferredUsers({ perPage: PREVIEW_ROWS }),
  });
  const rewardsQuery = useQuery({
    queryKey: ['referral-rewards', user?.id],
    queryFn: () => fetchReferralRewards({ perPage: PREVIEW_ROWS }),
  });

  const summary = summaryQuery.data?.data;
  const referralCode = summary?.referral_code || user?.referral_code || '';
  const referralLink = summary?.referral_link || '';
  const enabled = summary ? summary.enabled !== false : true;
  const rewards = summary?.rewards || {};
  const referredUsers = toList(usersQuery.data);
  const rewardRows = toList(rewardsQuery.data);
  const unavailable = summaryQuery.error?.isUnavailable;

  const shareMessage = referralCode
    ? `Join me on Megasub for fast, reliable airtime, data, and bill payments! Use my referral code ${referralCode} when you sign up${referralLink ? `: ${referralLink}` : '.'}`
    : '';

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([summaryQuery.refetch(), usersQuery.refetch(), rewardsQuery.refetch()]);
    setRefreshing(false);
  };

  const handleCopy = async () => {
    if (!referralCode) return;
    await Clipboard.setStringAsync(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleShare = async () => {
    if (!shareMessage) return;
    try {
      await Share.share({ message: shareMessage });
    } catch (error) {
      console.error(error);
    }
  };

  const handleChangeCode = (text) => {
    setCustomCode(text);
    if (codeError) setCodeError('');
  };

  const handleSaveCode = async () => {
    const trimmed = customCode.trim();
    if (!CODE_PATTERN.test(trimmed)) {
      setCodeError('Use 3-50 characters: letters, numbers, underscores or hyphens.');
      return;
    }

    setSaving(true);
    try {
      const json = await updateReferralCode({ referralCode: trimmed });
      const saved = json?.data?.referral_code || trimmed;
      queryClient.setQueryData(['referral-summary', user?.id], (old) => ({
        ...(old || {}),
        data: { ...(old?.data || {}), ...(json?.data || {}), referral_code: saved },
      }));
      // Keep the cached user record in step so other screens see the new code.
      try {
        const raw = await SecureStore.getItemAsync(USER_KEY);
        if (raw) await SecureStore.setItemAsync(USER_KEY, JSON.stringify({ ...JSON.parse(raw), referral_code: saved }));
      } catch {
        // Best-effort cache; the server is the source of truth.
      }
      setCustomCode('');
      Alert.alert('Referral Code Updated', `Your referral code is now ${saved}.`);
    } catch (error) {
      if (error.fieldMessage) setCodeError(error.fieldMessage);
      else Alert.alert('Could Not Update Code', error.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderRewardRow = (row, index) => {
    const status = String(row?.status || '').toLowerCase();
    return (
      <View key={row?.id ?? index} style={[styles.row, { borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
            {prettify(row?.service_type || row?.reward_kind || 'Reward')}
          </Text>
          <Text style={[styles.rowSub, { color: colors.textFaint }]} numberOfLines={1}>
            {[row?.referred_user_name || row?.referred_user?.name, formatDate(row?.created_at)].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.rowAmount, { color: colors.text }]}>{naira(row?.amount ?? row?.reward_amount ?? 0)}</Text>
          {status ? (
            <Text style={[styles.rowStatus, { color: STATUS_COLORS[status] || colors.textFaint }]}>{prettify(status)}</Text>
          ) : null}
        </View>
      </View>
    );
  };

  const renderUserRow = (row, index) => (
    <View key={row?.id ?? index} style={[styles.row, { borderColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>{personName(row)}</Text>
        <Text style={[styles.rowSub, { color: colors.textFaint }]}>
          {formatDate(row?.joined_at || row?.created_at)}
        </Text>
      </View>
    </View>
  );

  const activeQuery = tab === 'rewards' ? rewardsQuery : usersQuery;
  const activeRows = tab === 'rewards' ? rewardRows : referredUsers;

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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={BRAND} />}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="gift" size={26} color="#FFFFFF" />
          </View>
          <Text style={styles.heroTitle}>Invite Friends, Earn Rewards</Text>
          <Text style={styles.heroSub}>
            {summary?.minimum_qualifying_amount
              ? `Earn when friends you refer buy ${(summary.eligible_services || ['data', 'airtime']).join(' or ')} worth ${naira(summary.minimum_qualifying_amount)} or more.`
              : "Share your referral code with friends. When they sign up using it, they're linked to your account."}
          </Text>
        </View>

        {unavailable ? (
          <Text style={[styles.hintText, { color: colors.textFaint, marginTop: 14 }]}>
            Referral rewards aren't available yet. Please check back soon.
          </Text>
        ) : null}
        {summary && !enabled ? (
          <Text style={[styles.hintText, { color: colors.textFaint, marginTop: 14 }]}>
            The referral programme is currently paused. You can still share your code, but new rewards aren't being credited.
          </Text>
        ) : null}

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Your Referral Code</Text>
        <View style={[styles.codeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {summaryQuery.isLoading ? (
            <ActivityIndicator color={BRAND} />
          ) : (
            <Text style={[styles.codeText, { color: BRAND }]} numberOfLines={1}>{referralCode || 'Not set'}</Text>
          )}
          <TouchableOpacity onPress={handleCopy} activeOpacity={0.7} style={styles.copyBtn} disabled={!referralCode}>
            <Feather name={copied ? 'check' : 'copy'} size={16} color={BRAND} />
          </TouchableOpacity>
        </View>
        {summaryQuery.error && !unavailable ? (
          <Text style={[styles.hintText, { color: colors.textFaint }]}>
            {summaryQuery.error.message} Pull down to retry.
          </Text>
        ) : null}

        <TouchableOpacity
          style={[styles.shareBtn, !shareMessage && styles.saveBtnDisabled]}
          activeOpacity={0.85}
          onPress={handleShare}
          disabled={!shareMessage}
        >
          <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
          <Text style={styles.shareBtnText}>Share Invite Link</Text>
        </TouchableOpacity>

        {summary ? (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Your Earnings</Text>
            <View style={styles.statsGrid}>
              {[
                ['Referred', String(summary.referred_users_count ?? 0)],
                ['Earned', naira(rewards.credited_amount ?? 0)],
                ['Pending', naira(rewards.pending_amount ?? 0)],
              ].map(([label, value]) => (
                <View key={label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Customize Your Code</Text>
        <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: codeError ? '#DC2626' : colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="e.g. SAMUEL2026"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={50}
            value={customCode}
            onChangeText={handleChangeCode}
          />
        </View>
        {codeError ? <Text style={[styles.hintText, { color: '#DC2626' }]}>{codeError}</Text> : null}
        <TouchableOpacity
          style={[styles.saveBtn, (!customCode.trim() || saving) && styles.saveBtnDisabled]}
          activeOpacity={0.85}
          onPress={handleSaveCode}
          disabled={!customCode.trim() || saving}
        >
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveBtnText}>Save New Code</Text>}
        </TouchableOpacity>

        <View style={styles.tabs}>
          {[['rewards', 'Rewards'], ['users', 'Referred Friends']].map(([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => setTab(key)}
              activeOpacity={0.8}
              style={[styles.tab, { backgroundColor: tab === key ? BRAND : colors.card, borderColor: colors.border }]}
            >
              <Text style={[styles.tabText, { color: tab === key ? '#FFFFFF' : colors.textMuted }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {activeQuery.isLoading ? (
            <ActivityIndicator color={BRAND} style={{ marginVertical: 20 }} />
          ) : activeQuery.error ? (
            <Text style={[styles.emptyText, { color: colors.textFaint }]}>
              {activeQuery.error.isUnavailable ? 'Not available yet.' : activeQuery.error.message}
            </Text>
          ) : activeRows.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textFaint }]}>
              {tab === 'rewards' ? 'No rewards yet. Share your code to start earning.' : "Nobody has signed up with your code yet."}
            </Text>
          ) : (
            activeRows.map(tab === 'rewards' ? renderRewardRow : renderUserRow)
          )}
        </View>
        {!activeQuery.isLoading && activeRows.length >= PREVIEW_ROWS ? (
          <Text style={[styles.hintText, { color: colors.textFaint }]}>
            Showing your latest {PREVIEW_ROWS} of {toTotal(activeQuery.data, activeRows.length)}.
          </Text>
        ) : null}
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
  heroTitle: { fontFamily: FONTS.extrabold, fontSize: 17, color: '#FFFFFF', textAlign: 'center', marginBottom: 8 },
  heroSub: { fontFamily: FONTS.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 18 },

  codeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 16, height: 56,
    borderWidth: 1.5, borderColor: '#ECEDF6', borderStyle: 'dashed',
  },
  codeText: { flex: 1, fontFamily: FONTS.extrabold, fontSize: 16, letterSpacing: 1, marginRight: 10 },
  copyBtn: { padding: 4 },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center' },
  statValue: { fontFamily: FONTS.extrabold, fontSize: 15 },
  statLabel: { fontFamily: FONTS.medium, fontSize: 11, marginTop: 4 },
  tabs: { flexDirection: 'row', gap: 10, marginTop: 26, marginBottom: 12 },
  tab: { flex: 1, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: FONTS.semibold, fontSize: 13 },
  listCard: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowTitle: { fontFamily: FONTS.semibold, fontSize: 13.5 },
  rowSub: { fontFamily: FONTS.regular, fontSize: 11.5, marginTop: 2 },
  rowAmount: { fontFamily: FONTS.bold, fontSize: 13.5 },
  rowStatus: { fontFamily: FONTS.semibold, fontSize: 11, marginTop: 2 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 12.5, textAlign: 'center', paddingVertical: 22 },
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
