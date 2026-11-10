import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav from './components/BottomNav';
import ReceiptModal from './components/ReceiptModal';
import { useTheme } from '../../contexts/ThemeContext';
import { fetchTransactions, fetchNairaFundingTransactions } from '../../lib/api';
import { getSessionFunding, setSessionFunding, isFundingSuccessful } from '../../lib/fundingSession';
import CodeInput from './components/CodeInput';
import { useBalanceHidden } from '../../lib/balanceVisibility';
import { detectTransactionLogo } from '../../lib/logos';
import {
  CATEGORY_STYLE,
  DEFAULT_STYLE,
  STATUS_LABELS,
  formatDateShort,
  isWalletFundingTransaction,
  transactionAmount,
  toDateParam,
} from '../../lib/transactionMeta';

import LogoLoader from './components/LogoLoader';
import { SHOW_WITHDRAW } from '../../lib/featureAvailability';
const FONTS = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  extrabold: 'Montserrat_800ExtraBold',
};

const BRAND = '#4A55DD';
const VISIBLE_COUNT = 8;
const WINDOW_DAYS = 30;

// A bank transfer into the wallet. These come from a separate, PIN-gated
// endpoint, so they're drawn here rather than through ActivityItem.
function FundingItem({ funding, colors }) {
  const ok = isFundingSuccessful(funding);
  const amount = Number(funding.amount_settled || funding.amount_paid || 0);
  return (
    <View style={styles.txItem}>
      <View style={[styles.txIconWrap, { backgroundColor: '#E8F7EE' }]}>
        <Ionicons name="wallet-outline" size={20} color="#16A34A" />
      </View>
      <View style={styles.txInfo}>
        <Text style={[styles.txTitle, { color: colors.text }]} numberOfLines={1}>Wallet Funded</Text>
        <Text style={[styles.txSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
          {formatDateShort(funding.created_at)}
          {funding.bank_name ? ` · ${String(funding.bank_name).toUpperCase()}` : ''}
        </Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: '#16A34A' }]}>+₦{amount.toLocaleString()}</Text>
        <Text style={[styles.txStatus, { color: colors.textFaint }]}>{ok ? 'Successful' : 'Failed'}</Text>
      </View>
    </View>
  );
}

function ActivityItem({ tx, colors, onPress }) {
  const visual = CATEGORY_STYLE[tx.transaction_category] || DEFAULT_STYLE;
  const isFunding = isWalletFundingTransaction(tx);
  const statusLabel = STATUS_LABELS[tx.status] || 'Unknown';
  const amount = transactionAmount(tx);
  const logo = detectTransactionLogo(tx);
  const bank = tx.bank_name || tx.bank;
  const reference = tx.reference || tx.transaction_reference;
  const subtitle = [formatDateShort(tx.created_at), bank, reference].filter(Boolean).join(' · ');
  return (
    <TouchableOpacity style={styles.txItem} activeOpacity={0.75} onPress={onPress}>
      <View style={[styles.txIconWrap, { backgroundColor: visual.bg }]}>
        {logo ? (
          <Image source={logo} style={styles.txLogo} />
        ) : (
          <Ionicons name={visual.icon} size={20} color={visual.color} />
        )}
      </View>
      <View style={styles.txInfo}>
        <Text style={[styles.txTitle, { color: colors.text }]} numberOfLines={1}>
          {tx.description || (isFunding ? 'Wallet Funded' : 'Transaction')}
        </Text>
        <Text style={[styles.txSubtitle, { color: colors.textMuted }]} numberOfLines={1}>{subtitle}</Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: isFunding ? '#16A34A' : colors.text }]}>
          {isFunding ? '+' : ''}₦{amount.toLocaleString()}
        </Text>
        <Text style={[styles.txStatus, { color: colors.textFaint }]}>{statusLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function Wallet({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [hidden, setHidden] = useBalanceHidden();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTx, setSelectedTx] = useState(null);

  // Funding credits need the transaction PIN to read (see lib/fundingSession).
  const [funding, setFunding] = useState(() => getSessionFunding());
  const [pinVisible, setPinVisible] = useState(false);
  const [pin, setPin] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState(null);

  const unlockFunding = async () => {
    if (pin.length < 4) return;
    setPinBusy(true);
    setPinError(null);
    try {
      const json = await fetchNairaFundingTransactions({ userId: user?.id, pin });
      setFunding(json.data || []);
      setSessionFunding(json.data || []);
      setPinVisible(false);
      setPin('');
    } catch (err) {
      setPinError(err.message || 'Could not verify your PIN. Please try again.');
    } finally {
      setPinBusy(false);
    }
  };

  const feedFunding = transactions.filter(isWalletFundingTransaction);
  const feedFundingKeys = new Set(
    feedFunding.flatMap((item) => [
      item.id != null ? `id:${item.id}` : null,
      (item.reference || item.transaction_reference)
        ? `ref:${String(item.reference || item.transaction_reference).trim().toLowerCase()}`
        : null,
    ].filter(Boolean))
  );
  const legacyFunding = (funding || []).filter((item) => {
    const idKey = item.id != null ? `id:${item.id}` : null;
    const reference = item.reference || item.transaction_reference || item.reference_number;
    const referenceKey = reference ? `ref:${String(reference).trim().toLowerCase()}` : null;
    return ![idKey, referenceKey].filter(Boolean).some((key) => feedFundingKeys.has(key));
  });

  // Purchases and funding credits in one list, newest first. New funding rows
  // arrive through fetch_transactions without a PIN; the separate PIN route
  // remains only as a compatibility fallback while the backend is upgraded.
  const activity = [
    ...transactions.map((tx) => ({ kind: 'tx', key: `tx-${tx.id}`, at: tx.created_at, tx })),
    ...legacyFunding.map((f, index) => ({ kind: 'funding', key: `fund-${f.id || f.reference || index}`, at: f.created_at, funding: f })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, VISIBLE_COUNT);

  const walletBalance = user?.main_wallet ? parseFloat(user.main_wallet) : 0.0;
  const formatted = '₦' + walletBalance.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const dateTo = new Date();
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - WINDOW_DAYS);

        const json = await fetchTransactions({
          userId: user?.id,
          dateFrom: toDateParam(dateFrom),
          dateTo: toDateParam(dateTo),
        });

        if (cancelled) return;
        const list = [...(json.data || [])]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, VISIBLE_COUNT);
        setTransactions(list);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load your recent activity.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (user?.id) load();
    else setLoading(false);

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Wallet</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#2A35C4', '#4A55DD', '#1E2A9E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={styles.circle1} />
          <View style={styles.circle2} />

          <Text style={styles.cardLabel}>Available Balance</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceText}>{hidden ? '₦ ••••••' : formatted}</Text>
            <TouchableOpacity onPress={() => setHidden(!hidden)} style={styles.eyeBtn}>
              <Ionicons
                name={hidden ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color="rgba(255,255,255,0.7)"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.85}
              onPress={() => navigate && navigate('topup')}
            >
              <Ionicons name="add-circle" size={16} color="#4A55DD" />
              <Text style={styles.actionBtnText}>Fund Wallet</Text>
            </TouchableOpacity>
            {/* Withdrawals have no backend yet; iOS hides the placeholder
                button (App Review 2.1), Android keeps the notice. */}
            {SHOW_WITHDRAW && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnOutline]}
                activeOpacity={0.85}
                onPress={() =>
                  Alert.alert('Coming Soon', 'Withdrawals aren\'t available yet — check back soon.')
                }
              >
                <Feather name="arrow-up-right" size={16} color="#FFFFFF" />
                <Text style={[styles.actionBtnText, styles.actionBtnTextOutline]}>Withdraw</Text>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        <View style={styles.headerRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Activity</Text>
          <TouchableOpacity onPress={() => navigate && navigate('history')}>
            <Text style={[styles.seeAll, colors.mode === 'dark' && { color: '#FFFFFF' }]}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.listCard, { backgroundColor: colors.card }]}>
          {loading ? (
            <LogoLoader size={44} />
          ) : error ? (
            <View style={styles.emptyState}>
              <Feather name="wifi-off" size={28} color="#B7BCEF" />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{error}</Text>
            </View>
          ) : activity.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={28} color="#B7BCEF" />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No recent activity</Text>
              <Text style={[styles.emptySubtext, { color: colors.textFaint }]}>
                Your top-ups and purchases will show up here.
              </Text>
            </View>
          ) : (
            activity.map((item, index) => (
              <View key={item.key}>
                {item.kind === 'funding' ? (
                  <FundingItem funding={item.funding} colors={colors} />
                ) : (
                  <ActivityItem tx={item.tx} colors={colors} onPress={() => setSelectedTx(item.tx)} />
                )}
                {index < activity.length - 1 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
              </View>
            ))
          )}
        </View>

        {!funding && feedFunding.length === 0 && (
          <TouchableOpacity
            style={[styles.fundingRow, { backgroundColor: colors.card }]}
            activeOpacity={0.8}
            onPress={() => {
              setPinError(null);
              setPinVisible(true);
            }}
          >
            <Ionicons name="wallet-outline" size={18} color={colors.brandText || BRAND} />
            <Text style={[styles.fundingRowText, { color: colors.text }]}>Show wallet funding</Text>
            <Text style={[styles.fundingRowHint, { color: colors.textFaint }]}>PIN required</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <BottomNav
        activeTab="wallet"
        onTabPress={(tab) => {
          if (tab === 'wallet') return;
          navigate && navigate(tab);
        }}
      />

      <Modal visible={pinVisible} transparent animationType="fade" onRequestClose={() => !pinBusy && setPinVisible(false)}>
        <View style={styles.pinOverlay}>
          <View style={[styles.pinCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Enter Transaction PIN</Text>
            <Text style={[styles.pinSubtitle, { color: colors.textMuted }]}>Needed to show your wallet funding</Text>
            <CodeInput
              length={4}
              value={pin}
              onChange={setPin}
              colors={{ text: colors.text, card: colors.cardAlt || colors.background, border: colors.border }}
              secure
              autoFocus
              containerStyle={styles.pinRow}
              boxStyle={styles.pinBox}
            />
            {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}
            <TouchableOpacity
              style={[styles.pinConfirm, (pin.length < 4 || pinBusy) && { opacity: 0.5 }]}
              onPress={unlockFunding}
              disabled={pin.length < 4 || pinBusy}
              activeOpacity={0.85}
            >
              {pinBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.pinConfirmText}>Confirm</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.pinCancel} onPress={() => !pinBusy && setPinVisible(false)}>
              <Text style={[styles.pinCancelText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ReceiptModal
        visible={!!selectedTx}
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FC' },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitle: { fontFamily: FONTS.extrabold, fontSize: 20, color: '#0B0D1A' },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },

  card: {
    borderRadius: 20,
    padding: 22,
    overflow: 'hidden',
    marginBottom: 24,
    elevation: 10,
    shadowColor: '#4A55DD',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  circle1: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.05)', top: -60, right: -40,
  },
  circle2: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.04)', bottom: -30, left: -20,
  },
  cardLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 },
  balanceText: { fontFamily: FONTS.extrabold, fontSize: 30, color: '#FFFFFF', letterSpacing: -0.5 },
  eyeBtn: { padding: 4 },

  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 12, gap: 6,
  },
  actionBtnOutline: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },
  actionBtnText: { fontFamily: FONTS.bold, fontSize: 13, color: '#4A55DD' },
  actionBtnTextOutline: { color: '#FFFFFF' },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { fontFamily: FONTS.bold, fontSize: 15, color: '#0B0D1A' },
  seeAll: { fontFamily: FONTS.semibold, fontSize: 13, color: BRAND },

  listCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, minHeight: 84 },
  loader: { paddingVertical: 20 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20, gap: 4 },
  emptyText: { fontFamily: FONTS.semibold, fontSize: 13, marginTop: 8 },
  emptySubtext: { fontFamily: FONTS.regular, fontSize: 11.5, textAlign: 'center', paddingHorizontal: 20 },

  txItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  txIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden' },
  txLogo: { width: 44, height: 44, borderRadius: 22 },
  txInfo: { flex: 1, paddingRight: 8 },
  txTitle: { fontFamily: FONTS.bold, fontSize: 13.5, color: '#0B0D1A', marginBottom: 2 },
  txSubtitle: { fontFamily: FONTS.regular, fontSize: 11.5, color: 'rgba(11,13,26,0.45)' },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontFamily: FONTS.bold, fontSize: 13.5 },
  txStatus: { fontFamily: FONTS.regular, fontSize: 10.5, marginTop: 2 },
  divider: { height: 1, backgroundColor: 'rgba(11,13,26,0.06)', marginVertical: 2 },

  fundingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginTop: 12 },
  fundingRowText: { flex: 1, fontFamily: FONTS.semibold, fontSize: 13.5 },
  fundingRowHint: { fontFamily: FONTS.regular, fontSize: 11.5 },
  pinOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  pinCard: { width: '86%', borderRadius: 24, padding: 22 },
  pinSubtitle: { fontFamily: FONTS.regular, fontSize: 12, marginTop: 4, marginBottom: 16 },
  pinRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  pinBox: { flex: 1, height: 50, borderWidth: 2, borderRadius: 12, fontSize: 20, fontWeight: '700' },
  pinError: { fontFamily: FONTS.medium, fontSize: 12, color: '#EF4444', marginTop: 8, textAlign: 'center' },
  pinConfirm: { backgroundColor: BRAND, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  pinConfirmText: { fontFamily: FONTS.bold, fontSize: 14, color: '#FFFFFF' },
  pinCancel: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  pinCancelText: { fontFamily: FONTS.semibold, fontSize: 13.5 },
});
