import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { fetchTransactions, fetchNairaFundingTransactions } from '../../lib/api';
import ReceiptModal from './components/ReceiptModal';
import {
  CATEGORY_STYLE,
  DEFAULT_STYLE,
  STATUS_LABELS,
  STATUS_COLOR,
  STATUS_BG,
  formatDateShort,
  formatDate,
  toDateParam,
} from '../../lib/transactionMeta';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};

const BRAND = '#4A55DD';
const WALLET_VISUAL = { icon: 'wallet-outline', color: '#16A34A' };
const FETCH_WINDOW_DAYS = 62;

function isFundingSuccessful(funding) {
  return funding.status === 'SUCCESSFUL' || funding.funding_status === 'success';
}

// This card keeps a light pastel background (STATUS_BG) in both light and
// dark mode, so its text must stay fixed-dark too — following colors.text
// would turn near-white in dark mode and disappear against the light card.
const CARD_TEXT = '#0B0D1A';
const CARD_TEXT_MUTED = 'rgba(11,13,26,0.55)';

function NotificationRow({ item, colors, onPress }) {
  const bg = STATUS_BG[item.status] || DEFAULT_STYLE.bg;
  const statusColor = STATUS_COLOR[item.status] || colors.textFaint;
  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: bg }]} activeOpacity={0.75} onPress={onPress}>
      <View style={styles.iconWrap}>
        <Ionicons name={item.icon} size={20} color={item.iconColor} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.title, { color: CARD_TEXT }]} numberOfLines={1}>{item.title}</Text>
        <Text style={[styles.subtitle, { color: CARD_TEXT_MUTED }]} numberOfLines={1}>
          {formatDateShort(item.createdAt)}{item.subtitle ? ` • ${item.subtitle}` : ''}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: CARD_TEXT }]}>₦{item.amount.toLocaleString()}</Text>
        <Text style={[styles.status, { color: statusColor }]}>{item.statusLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function Notifications({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [fundingTx, setFundingTx] = useState([]);
  const [fundingUnlocked, setFundingUnlocked] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pin, setPin] = useState('');
  const [fundingLoading, setFundingLoading] = useState(false);
  const [fundingError, setFundingError] = useState(null);
  const pinInputs = useRef([]);

  const [selectedTx, setSelectedTx] = useState(null);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async ({ isRefresh = false } = {}) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const dateTo = new Date();
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - FETCH_WINDOW_DAYS);

      const json = await fetchTransactions({
        userId: user?.id,
        dateFrom: toDateParam(dateFrom),
        dateTo: toDateParam(dateTo),
      });
      setTransactions(json.data || []);
    } catch (error) {
      // Silent — an empty feed is a reasonable fallback for a notifications
      // page, and TransactionHistory already surfaces load errors loudly.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleUnlockFunding = async () => {
    if (pin.length < 4) return;
    setFundingLoading(true);
    setFundingError(null);
    try {
      const json = await fetchNairaFundingTransactions({ userId: user?.id, pin });
      setFundingTx(json.data || []);
      setFundingUnlocked(true);
      setPinModalVisible(false);
      setPin('');
    } catch (error) {
      setFundingError(error.message || 'Could not verify your PIN. Please try again.');
    } finally {
      setFundingLoading(false);
    }
  };

  const notifications = useMemo(() => {
    const txItems = transactions.map((tx) => {
      const visual = CATEGORY_STYLE[tx.transaction_category] || DEFAULT_STYLE;
      return {
        id: `tx-${tx.id}`,
        kind: 'transaction',
        raw: tx,
        icon: visual.icon,
        iconColor: visual.color,
        title: tx.description || 'Transaction',
        subtitle: null,
        amount: Number(tx.amount || tx.discounted_amount || 0),
        status: String(tx.status),
        statusLabel: STATUS_LABELS[tx.status] || 'Unknown',
        createdAt: tx.created_at,
      };
    });

    const fundingItems = fundingTx.map((f) => {
      const ok = isFundingSuccessful(f);
      return {
        id: `fund-${f.id}`,
        kind: 'funding',
        raw: f,
        icon: WALLET_VISUAL.icon,
        iconColor: WALLET_VISUAL.color,
        title: 'Wallet Funded',
        subtitle: f.bank_name ? f.bank_name.toUpperCase() : 'Bank transfer',
        amount: Number(f.amount_settled || f.amount_paid || 0),
        status: ok ? '1' : '-1',
        statusLabel: ok ? 'Successful' : 'Failed',
        createdAt: f.created_at,
      };
    });

    return [...txItems, ...fundingItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [transactions, fundingTx]);

  const handlePressItem = (item) => {
    if (item.kind === 'transaction') {
      setSelectedTx(item.raw);
      return;
    }
    const f = item.raw;
    Alert.alert(
      'Wallet Funding',
      `Amount: ₦${item.amount.toLocaleString()}\nBank: ${f.bank_name ? f.bank_name.toUpperCase() : '—'}\nAccount: ${f.account_number || '—'}\nReference: ${f.transaction_reference || '—'}\nDate: ${formatDate(f.created_at)}`
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card }]}
          onPress={() => navigate && navigate('home')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={BRAND} style={styles.loader} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadTransactions({ isRefresh: true })} tintColor={BRAND} />
          }
        >
          {!fundingUnlocked ? (
            <TouchableOpacity
              style={[styles.unlockCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              activeOpacity={0.8}
              onPress={() => setPinModalVisible(true)}
            >
              <View style={styles.unlockIconWrap}>
                <Ionicons name="wallet-outline" size={18} color={BRAND} />
              </View>
              <View style={styles.info}>
                <Text style={[styles.title, { color: colors.text }]}>Show wallet funding activity</Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>Enter your PIN to include funding credits</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textFaint} />
            </TouchableOpacity>
          ) : null}

          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="notifications-outline" size={32} color={BRAND} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No notifications yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                Your transactions and wallet funding activity will show up here.
              </Text>
            </View>
          ) : (
            notifications.map((item) => (
              <NotificationRow key={item.id} item={item} colors={colors} onPress={() => handlePressItem(item)} />
            ))
          )}
        </ScrollView>
      )}

      <ReceiptModal
        visible={!!selectedTx}
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
        colors={colors}
      />

      {pinModalVisible ? (
        <View style={styles.pinOverlay}>
          <View style={[styles.pinCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.title, { color: colors.text, marginBottom: 4 }]}>Enter Transaction PIN</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted, marginBottom: 16 }]}>
              Needed to view wallet funding history
            </Text>
            <View style={styles.pinInputRow}>
              {[0, 1, 2, 3].map((index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (pinInputs.current[index] = ref)}
                  style={[styles.pinBox, { color: colors.text, backgroundColor: colors.cardAlt, borderColor: colors.border }]}
                  keyboardType="number-pad"
                  maxLength={1}
                  secureTextEntry
                  value={pin[index] || ''}
                  onChangeText={(text) => {
                    const digits = pin.split('');
                    digits[index] = text.slice(-1);
                    const next = digits.join('').slice(0, 4);
                    setPin(next);
                    if (text && index < 3) pinInputs.current[index + 1]?.focus();
                  }}
                  textAlign="center"
                />
              ))}
            </View>
            {fundingError ? <Text style={styles.pinError}>{fundingError}</Text> : null}
            <TouchableOpacity
              style={[styles.pinConfirmBtn, (pin.length < 4 || fundingLoading) && styles.pinConfirmBtnDisabled]}
              activeOpacity={0.85}
              onPress={handleUnlockFunding}
              disabled={pin.length < 4 || fundingLoading}
            >
              {fundingLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.pinConfirmText}>Confirm</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pinCancelBtn}
              activeOpacity={0.8}
              onPress={() => {
                setPinModalVisible(false);
                setPin('');
                setFundingError(null);
              }}
            >
              <Text style={[styles.pinCancelText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
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
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#0B0D1A',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 16 },

  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 30, gap: 12 },

  unlockCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1.5, padding: 14, marginBottom: 4,
  },
  unlockIconWrap: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(74,85,221,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },

  card: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 14,
  },
  iconWrap: {
    width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  info: { flex: 1, paddingRight: 8 },
  title: { fontFamily: FONTS.bold, fontSize: 13 },
  subtitle: { fontFamily: FONTS.regular, fontSize: 11, marginTop: 3 },
  right: { alignItems: 'flex-end' },
  amount: { fontFamily: FONTS.bold, fontSize: 13.5 },
  status: { fontFamily: FONTS.semibold, fontSize: 10.5, marginTop: 2 },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 20 },
  emptyIconWrap: {
    width: 76, height: 76, borderRadius: 38, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontFamily: FONTS.bold, fontSize: 17, marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontFamily: FONTS.medium, fontSize: 13.5, textAlign: 'center', lineHeight: 20 },

  pinOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(11,13,26,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  pinCard: { width: '86%', borderRadius: 24, padding: 22 },
  pinInputRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  pinBox: { flex: 1, height: 50, borderWidth: 2, borderRadius: 12, fontSize: 20, fontWeight: '700' },
  pinError: { fontFamily: FONTS.medium, fontSize: 12, color: '#EF4444', marginTop: 8, textAlign: 'center' },
  pinConfirmBtn: {
    backgroundColor: BRAND, borderRadius: 16, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  pinConfirmBtnDisabled: { opacity: 0.5 },
  pinConfirmText: { fontFamily: FONTS.bold, fontSize: 14, color: '#FFFFFF' },
  pinCancelBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  pinCancelText: { fontFamily: FONTS.semibold, fontSize: 13.5 },
});
