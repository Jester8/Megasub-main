import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav from './components/BottomNav';
import ReceiptModal from './components/ReceiptModal';
import { useTheme } from '../../contexts/ThemeContext';
import { fetchTransactions } from '../../lib/api';
import { detectTransactionLogo } from '../../lib/logos';
import { CATEGORY_STYLE, DEFAULT_STYLE, STATUS_LABELS, formatDateShort, toDateParam } from '../../lib/transactionMeta';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const BRAND = '#4A55DD';
const VISIBLE_COUNT = 8;
const WINDOW_DAYS = 30;

function ActivityItem({ tx, colors, onPress }) {
  const visual = CATEGORY_STYLE[tx.transaction_category] || DEFAULT_STYLE;
  const statusLabel = STATUS_LABELS[tx.status] || 'Unknown';
  const amount = Number(tx.amount || tx.discounted_amount || 0);
  const logo = detectTransactionLogo(tx);
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
        <Text style={[styles.txTitle, { color: colors.text }]} numberOfLines={1}>{tx.description || 'Transaction'}</Text>
        <Text style={[styles.txSubtitle, { color: colors.textMuted }]}>{formatDateShort(tx.created_at)}</Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: colors.text }]}>₦{amount.toLocaleString()}</Text>
        <Text style={[styles.txStatus, { color: colors.textFaint }]}>{statusLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function Wallet({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTx, setSelectedTx] = useState(null);

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
          </View>
        </LinearGradient>

        <View style={styles.headerRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Activity</Text>
          <TouchableOpacity onPress={() => navigate && navigate('history')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.listCard, { backgroundColor: colors.card }]}>
          {loading ? (
            <ActivityIndicator color={BRAND} style={styles.loader} />
          ) : error ? (
            <View style={styles.emptyState}>
              <Feather name="wifi-off" size={28} color="#B7BCEF" />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{error}</Text>
            </View>
          ) : transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={28} color="#B7BCEF" />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No recent activity</Text>
              <Text style={[styles.emptySubtext, { color: colors.textFaint }]}>
                Your top-ups and purchases will show up here.
              </Text>
            </View>
          ) : (
            transactions.map((tx, index) => (
              <View key={tx.id}>
                <ActivityItem tx={tx} colors={colors} onPress={() => setSelectedTx(tx)} />
                {index < transactions.length - 1 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <BottomNav
        activeTab="wallet"
        onTabPress={(tab) => {
          if (tab === 'wallet') return;
          navigate && navigate(tab);
        }}
      />

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
  headerTitle: { fontFamily: FONTS.extrabold, fontWeight: '800', fontSize: 20, color: '#0B0D1A' },

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
});
