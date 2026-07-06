import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav from './components/BottomNav';
import { fetchTransactions } from '../../lib/api';
import { useTheme } from '../../contexts/ThemeContext';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const BRAND = '#4A55DD';
const FILTERS = ['This Month', 'Category', 'Status'];
const HISTORY_WINDOW_DAYS = 90;

const CATEGORY_STYLE = {
  airtime: { icon: 'call-outline', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
  data: { icon: 'wifi-outline', color: '#00C9A7', bg: 'rgba(0,201,167,0.08)' },
  utility_bills: { icon: 'flash-outline', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  cable_subscription: { icon: 'tv-outline', color: '#EC4899', bg: 'rgba(236,72,153,0.08)' },
};
const DEFAULT_STYLE = { icon: 'briefcase-outline', color: '#4A55DD', bg: 'rgba(74,85,221,0.08)' };

const STATUS_LABELS = { '1': 'Successful', '0': 'Pending', '-1': 'Failed' };

function formatDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  const day = date.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  const month = date.toLocaleDateString('en-NG', { month: 'long' });
  return `${time} ${day}${suffix} ${month}, ${date.getFullYear()}`;
}

function toDateParam(date) {
  return date.toISOString().slice(0, 10);
}

function TransactionRow({ tx, colors }) {
  const visual = CATEGORY_STYLE[tx.transaction_category] || DEFAULT_STYLE;
  const statusLabel = STATUS_LABELS[tx.status] || 'Unknown';
  return (
    <View style={[styles.txCard, { backgroundColor: visual.bg }]}>
      <View style={styles.txIconWrap}>
        <Ionicons name={visual.icon} size={20} color={visual.color} />
      </View>
      <View style={styles.txInfo}>
        <Text style={[styles.txTitle, { color: colors.text }]}>{tx.description || 'Transaction'}</Text>
        <Text style={[styles.txSubtitle, { color: colors.textMuted }]}>{formatDate(tx.created_at)}</Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: colors.text }]}>₦{Number(tx.discounted_amount || tx.amount || 0).toLocaleString()}</Text>
        <Text style={[styles.txStatus, { color: colors.textFaint }]}>{statusLabel}</Text>
      </View>
    </View>
  );
}

export default function TransactionHistory({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async ({ isRefresh = false } = {}) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const dateTo = new Date();
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - HISTORY_WINDOW_DAYS);

      const json = await fetchTransactions({
        userId: user?.id,
        dateFrom: toDateParam(dateFrom),
        dateTo: toDateParam(dateTo),
      });

      const list = [...(json.data || [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setTransactions(list);
    } catch (error) {
      Alert.alert('Network Error', error.message || 'Could not load your transaction history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Transaction History</Text>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity key={f} style={[styles.filterPill, { backgroundColor: colors.card, borderColor: colors.border }]} activeOpacity={0.8}>
            <Text style={[styles.filterText, { color: colors.text }]}>{f}</Text>
            <Feather name="chevron-down" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.body}>
        {loading ? (
          <ActivityIndicator color={BRAND} style={styles.loader} />
        ) : (
          <ScrollView
            style={styles.scrollFlex}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => loadTransactions({ isRefresh: true })} tintColor={BRAND} />
            }
          >
            {transactions.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="inbox" size={40} color="#B7BCEF" />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No transactions in the last {HISTORY_WINDOW_DAYS} days.</Text>
              </View>
            ) : (
              transactions.map((tx) => <TransactionRow key={tx.id} tx={tx} colors={colors} />)
            )}
          </ScrollView>
        )}
      </View>

      <BottomNav
        activeTab="history"
        onTabPress={(tab) => {
          if (tab === 'history') return;
          navigate && navigate(tab);
        }}
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
  headerTitle: { fontFamily: FONTS.extrabold, fontWeight: '800', fontSize: 20, color: '#0B0D1A' },

  filterRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 6 },
  filterPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#ECEDF6',
  },
  filterText: { fontFamily: FONTS.semibold, fontSize: 12.5, color: '#0B0D1A' },

  body: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollFlex: { flex: 1 },
  list: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 12, flexGrow: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontFamily: FONTS.medium, fontSize: 13, color: '#9CA0B8', marginTop: 14, textAlign: 'center' },

  txCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 14,
  },
  txIconWrap: {
    width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  txInfo: { flex: 1, paddingRight: 8 },
  txTitle: { fontFamily: FONTS.bold, fontSize: 13, color: '#0B0D1A', marginBottom: 3 },
  txSubtitle: { fontFamily: FONTS.regular, fontSize: 11, color: 'rgba(11,13,26,0.45)' },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontFamily: FONTS.bold, fontSize: 13.5, color: '#0B0D1A' },
  txStatus: { fontFamily: FONTS.regular, fontSize: 10.5, color: 'rgba(11,13,26,0.4)', marginTop: 2 },
});
