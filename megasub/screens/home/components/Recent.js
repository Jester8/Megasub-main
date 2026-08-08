import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTheme } from '../../../contexts/ThemeContext';
import { useResponsive } from '../../../lib/responsive';
import { fetchTransactions } from '../../../lib/api';
import { CATEGORY_STYLE, DEFAULT_STYLE, formatDateShort, toDateParam } from '../../../lib/transactionMeta';
import ReceiptModal from './ReceiptModal';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};

const PADDING = 20;
const CARD_PADDING = 16;
const VISIBLE_COUNT = 4;
const WINDOW_DAYS = 30;

function TransactionItem({ tx, colors, onPress, isTablet }) {
  const visual = CATEGORY_STYLE[tx.transaction_category] || DEFAULT_STYLE;
  const amount = Number(tx.amount || tx.discounted_amount || 0);
  return (
    <TouchableOpacity style={styles.txItem} activeOpacity={0.75} onPress={onPress}>
      <View style={[styles.iconWrap, isTablet && styles.iconWrapTablet, { backgroundColor: visual.bg }]}>
        <Ionicons name={visual.icon} size={isTablet ? 18 : 20} color={visual.color} />
      </View>
      <View style={styles.txInfo}>
        <Text style={[styles.txTitle, { color: colors.text }]} numberOfLines={1}>{tx.description || 'Transaction'}</Text>
        <Text style={[styles.txSubtitle, { color: colors.textMuted }]}>{formatDateShort(tx.created_at)}</Text>
      </View>
      <Text style={[styles.txAmount, { color: colors.text }]}>₦{amount.toLocaleString()}</Text>
    </TouchableOpacity>
  );
}

export default function RecentTransactions({ user, onSeeAllPress, refreshSignal }) {
  const { colors } = useTheme();
  const { isTablet } = useResponsive();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTx, setSelectedTx] = useState(null);

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
        if (!cancelled) setError(err.message || 'Could not load your transactions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (user?.id) load();
    else setLoading(false);

    return () => {
      cancelled = true;
    };
  }, [user?.id, refreshSignal]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Transactions</Text>
        <TouchableOpacity onPress={onSeeAllPress}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        {loading ? (
          <ActivityIndicator color="#4A55DD" style={styles.loader} />
        ) : error ? (
          <View style={styles.emptyState}>
            <Feather name="wifi-off" size={28} color="#B7BCEF" />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>{error}</Text>
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="inbox" size={28} color="#B7BCEF" />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No transactions yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.textFaint }]}>
              Your airtime, data and bill payments will show up here.
            </Text>
          </View>
        ) : (
          transactions.map((tx, index) => (
            <View key={tx.id}>
              <TransactionItem tx={tx} colors={colors} isTablet={isTablet} onPress={() => setSelectedTx(tx)} />
              {index < transactions.length - 1 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
            </View>
          ))
        )}
      </View>

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
  container: {
    paddingHorizontal: PADDING,
    marginTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#0B0D1A',
  },
  seeAll: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: '#4A55DD',
  },
  card: {
    backgroundColor: 'rgb(255, 255, 255)',
    borderRadius: 20,
    padding: CARD_PADDING,
    minHeight: 84,
  },
  loader: { paddingVertical: 20 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20, gap: 4 },
  emptyText: { fontFamily: FONTS.semibold, fontSize: 13, marginTop: 8 },
  emptySubtext: { fontFamily: FONTS.regular, fontSize: 11.5, textAlign: 'center', paddingHorizontal: 20 },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconWrapTablet: { width: 38, height: 38, borderRadius: 19 },
  txInfo: {
    flex: 1,
    paddingRight: 8,
  },
  txTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13.5,
    color: '#0B0D1A',
    marginBottom: 2,
  },
  txSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 11.5,
    color: 'rgba(11,13,26,0.45)',
  },
  txAmount: {
    fontFamily: FONTS.bold,
    fontSize: 13.5,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(11,13,26,0.06)',
    marginVertical: 2,
  },
});
