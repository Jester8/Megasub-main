import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Alert,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import BottomNav from './components/BottomNav';
import ReceiptModal from './components/ReceiptModal';
import { fetchTransactions } from '../../lib/api';
import { useTheme } from '../../contexts/ThemeContext';
import { detectTransactionLogo } from '../../lib/logos';
import {
  CATEGORY_STYLE,
  DEFAULT_STYLE,
  STATUS_LABELS,
  STATUS_COLOR,
  STATUS_BG,
  CATEGORY_OPTIONS,
  STATUS_OPTIONS,
  formatDate,
  toDateParam,
} from '../../lib/transactionMeta';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const BRAND = '#4A55DD';
const DATE_FILTER_OPTIONS = ['This Month', 'Last Month', 'This Week', 'Last Week', 'Custom'];
// Covers "Last Month" (worst case ~62 days back) through today in one fetch,
// so switching between the preset filters is instant and needs no refetch.
const FETCH_WINDOW_DAYS = 62;

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getFilterRange(filter, customRange, now = new Date()) {
  if (filter === 'Custom' && customRange) return customRange;
  if (filter === 'This Week') {
    return { from: startOfWeek(now), to: endOfDay(now) };
  }
  if (filter === 'Last Week') {
    const thisWeekStart = startOfWeek(now);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart.getTime() - 1);
    return { from: lastWeekStart, to: lastWeekEnd };
  }
  if (filter === 'Last Month') {
    const thisMonthStart = startOfMonth(now);
    const lastMonthEnd = new Date(thisMonthStart.getTime() - 1);
    const lastMonthStart = startOfMonth(lastMonthEnd);
    return { from: lastMonthStart, to: lastMonthEnd };
  }
  // 'This Month'
  return { from: startOfMonth(now), to: endOfDay(now) };
}

// These cards keep a light pastel background (STATUS_BG) in both light and
// dark mode, so their text must stay fixed-dark too — following colors.text
// would turn near-white in dark mode and disappear against the light card.
const CARD_TEXT = '#0B0D1A';
const CARD_TEXT_MUTED = 'rgba(11,13,26,0.55)';

function TransactionRow({ tx, colors, onPress }) {
  const visual = CATEGORY_STYLE[tx.transaction_category] || DEFAULT_STYLE;
  const statusLabel = STATUS_LABELS[tx.status] || 'Unknown';
  const statusColor = STATUS_COLOR[tx.status] || colors.textFaint;
  // Card background reflects status (green/red/yellow), not the service —
  // whether it's airtime, data, cable or electricity is shown by the icon.
  const cardBg = STATUS_BG[tx.status] || visual.bg;
  const logo = detectTransactionLogo(tx);
  return (
    <TouchableOpacity style={[styles.txCard, { backgroundColor: cardBg }]} activeOpacity={0.75} onPress={onPress}>
      <View style={styles.txIconWrap}>
        {logo ? (
          <Image source={logo} style={styles.txLogo} />
        ) : (
          <Ionicons name={visual.icon} size={20} color={visual.color} />
        )}
      </View>
      <View style={styles.txInfo}>
        <Text style={[styles.txTitle, { color: CARD_TEXT }]}>{tx.description || 'Transaction'}</Text>
        <Text style={[styles.txSubtitle, { color: CARD_TEXT_MUTED }]}>{formatDate(tx.created_at)}</Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: CARD_TEXT }]}>₦{Number(tx.amount || tx.discounted_amount || 0).toLocaleString()}</Text>
        <Text style={[styles.txStatus, { color: statusColor }]}>{statusLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function TransactionHistory({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customLoading, setCustomLoading] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);

  const [selectedFilter, setSelectedFilter] = useState('This Month');
  const [appliedCustomRange, setAppliedCustomRange] = useState(null);
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [customFromDate, setCustomFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [customToDate, setCustomToDate] = useState(new Date());
  const [pickerTarget, setPickerTarget] = useState(null); // null | 'from' | 'to'
  const [customError, setCustomError] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const [activeSheet, setActiveSheet] = useState(null); // 'date' | 'category' | 'status'

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

  const handlePickerChange = (event, selected) => {
    if (Platform.OS === 'android') setPickerTarget(null);
    if (event.type === 'dismissed' || !selected) return;

    if (pickerTarget === 'from') setCustomFromDate(selected);
    else setCustomToDate(selected);
  };

  const applyCustomRange = async () => {
    const from = customFromDate;
    const to = endOfDay(customToDate);

    if (from > to) {
      setCustomError('The start date must be on or before the end date.');
      return;
    }
    setCustomError(null);

    const range = { from, to };
    setAppliedCustomRange(range);
    setSelectedFilter('Custom');
    setCustomModalVisible(false);

    // If the custom range reaches further back than what's already cached,
    // fetch that extra window and merge it in so future switches stay instant.
    const cachedFrom = new Date();
    cachedFrom.setDate(cachedFrom.getDate() - FETCH_WINDOW_DAYS);
    if (from < cachedFrom) {
      setCustomLoading(true);
      try {
        const json = await fetchTransactions({
          userId: user?.id,
          dateFrom: toDateParam(from),
          dateTo: toDateParam(to),
        });
        const incoming = json.data || [];
        setTransactions((prev) => {
          const ids = new Set(prev.map((t) => t.id));
          const merged = [...prev, ...incoming.filter((t) => !ids.has(t.id))];
          return merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        });
      } catch (error) {
        Alert.alert('Network Error', error.message || 'Could not load transactions for that range.');
      } finally {
        setCustomLoading(false);
      }
    }
  };

  const filteredTransactions = useMemo(() => {
    const { from, to } = getFilterRange(selectedFilter, appliedCustomRange);
    return transactions.filter((tx) => {
      const created = new Date(tx.created_at).getTime();
      const inRange = created >= from.getTime() && created <= to.getTime();
      const matchesCategory = selectedCategory === 'all' || tx.transaction_category === selectedCategory;
      const matchesStatus = selectedStatus === 'all' || String(tx.status) === selectedStatus;
      return inRange && matchesCategory && matchesStatus;
    });
  }, [transactions, selectedFilter, appliedCustomRange, selectedCategory, selectedStatus]);

  const dateLabel = selectedFilter === 'Custom' && appliedCustomRange
    ? `${toDateParam(appliedCustomRange.from)} → ${toDateParam(appliedCustomRange.to)}`
    : selectedFilter;
  const categoryLabel = CATEGORY_OPTIONS.find((c) => c.id === selectedCategory)?.label || 'All Categories';
  const statusLabel = STATUS_OPTIONS.find((s) => s.id === selectedStatus)?.label || 'All Status';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Transaction History</Text>
      </View>

      <ScrollView
        horizontal
        style={styles.filterScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <TouchableOpacity
          style={[styles.filterPill, { backgroundColor: colors.card, borderColor: colors.border }]}
          activeOpacity={0.8}
          onPress={() => setActiveSheet('date')}
        >
          <Feather name="calendar" size={14} color={colors.textMuted} />
          <Text style={[styles.filterText, { color: colors.text }]} numberOfLines={1}>{dateLabel}</Text>
          <Feather name="chevron-down" size={14} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterPill,
            { backgroundColor: colors.card, borderColor: colors.border },
            selectedCategory !== 'all' && { borderColor: BRAND },
          ]}
          activeOpacity={0.8}
          onPress={() => setActiveSheet('category')}
        >
          <Feather name="tag" size={14} color={selectedCategory !== 'all' ? BRAND : colors.textMuted} />
          <Text style={[styles.filterText, { color: selectedCategory !== 'all' ? BRAND : colors.text }]} numberOfLines={1}>
            {categoryLabel}
          </Text>
          <Feather name="chevron-down" size={14} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterPill,
            { backgroundColor: colors.card, borderColor: colors.border },
            selectedStatus !== 'all' && { borderColor: BRAND },
          ]}
          activeOpacity={0.8}
          onPress={() => setActiveSheet('status')}
        >
          <Feather name="filter" size={14} color={selectedStatus !== 'all' ? BRAND : colors.textMuted} />
          <Text style={[styles.filterText, { color: selectedStatus !== 'all' ? BRAND : colors.text }]} numberOfLines={1}>
            {statusLabel}
          </Text>
          <Feather name="chevron-down" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      </ScrollView>

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
            {customLoading ? (
              <ActivityIndicator color={BRAND} style={{ marginBottom: 12 }} />
            ) : null}
            {filteredTransactions.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="inbox" size={40} color="#B7BCEF" />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No matching transactions.</Text>
              </View>
            ) : (
              filteredTransactions.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} colors={colors} onPress={() => setSelectedTx(tx)} />
              ))
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

      <ReceiptModal
        visible={!!selectedTx}
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
        colors={colors}
      />

      <Modal
        visible={activeSheet === 'date'}
        animationType="fade"
        transparent
        onRequestClose={() => setActiveSheet(null)}
      >
        <View style={styles.centerOverlay}>
          <Pressable style={styles.centerOverlayTouch} onPress={() => setActiveSheet(null)} />
          <View style={[styles.centerCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Filter By Date</Text>
            {DATE_FILTER_OPTIONS.map((option) => {
              const active = option === selectedFilter;
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.sheetItem, { borderBottomColor: colors.divider }]}
                  onPress={() => {
                    if (option === 'Custom') {
                      setActiveSheet(null);
                      setCustomError(null);
                      setCustomModalVisible(true);
                      return;
                    }
                    setSelectedFilter(option);
                    setActiveSheet(null);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.sheetItemLabel, { color: active ? BRAND : colors.text }]}>
                    {option === 'Custom' ? 'Custom Range' : option}
                  </Text>
                  {active ? <Ionicons name="checkmark" size={18} color={BRAND} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      <Modal
        visible={customModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomModalVisible(false)}
      >
        <View style={styles.centerOverlay}>
          <Pressable style={styles.centerOverlayTouch} onPress={() => setCustomModalVisible(false)} />
          <View style={[styles.customModalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Custom Date Range</Text>

            <Text style={[styles.customLabel, { color: colors.textMuted }]}>From</Text>
            <TouchableOpacity
              style={[styles.dateField, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
              onPress={() => setPickerTarget('from')}
              activeOpacity={0.8}
            >
              <Feather name="calendar" size={15} color={colors.textMuted} />
              <Text style={[styles.dateFieldText, { color: colors.text }]}>{toDateParam(customFromDate)}</Text>
            </TouchableOpacity>

            <Text style={[styles.customLabel, { color: colors.textMuted }]}>To</Text>
            <TouchableOpacity
              style={[styles.dateField, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
              onPress={() => setPickerTarget('to')}
              activeOpacity={0.8}
            >
              <Feather name="calendar" size={15} color={colors.textMuted} />
              <Text style={[styles.dateFieldText, { color: colors.text }]}>{toDateParam(customToDate)}</Text>
            </TouchableOpacity>

            {customError ? <Text style={styles.customError}>{customError}</Text> : null}

            <TouchableOpacity style={styles.applyBtn} activeOpacity={0.85} onPress={applyCustomRange}>
              <Text style={styles.applyBtnText}>Apply Range</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {pickerTarget && Platform.OS === 'android' ? (
        <DateTimePicker
          value={pickerTarget === 'from' ? customFromDate : customToDate}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={handlePickerChange}
        />
      ) : null}

      <Modal
        visible={Platform.OS === 'ios' && !!pickerTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerTarget(null)}
      >
        <View style={styles.centerOverlay}>
          <Pressable style={styles.centerOverlayTouch} onPress={() => setPickerTarget(null)} />
          <View style={[styles.pickerCard, { backgroundColor: colors.card }]}>
            {pickerTarget ? (
              <DateTimePicker
                value={pickerTarget === 'from' ? customFromDate : customToDate}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={handlePickerChange}
                themeVariant={isDark ? 'dark' : 'light'}
              />
            ) : null}
            <TouchableOpacity style={styles.applyBtn} activeOpacity={0.85} onPress={() => setPickerTarget(null)}>
              <Text style={styles.applyBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={activeSheet === 'category'}
        animationType="fade"
        transparent
        onRequestClose={() => setActiveSheet(null)}
      >
        <View style={styles.centerOverlay}>
          <Pressable style={styles.centerOverlayTouch} onPress={() => setActiveSheet(null)} />
          <View style={[styles.centerCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Filter By Category</Text>
            {CATEGORY_OPTIONS.map((option) => {
              const active = option.id === selectedCategory;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.sheetItem, { borderBottomColor: colors.divider }]}
                  onPress={() => {
                    setSelectedCategory(option.id);
                    setActiveSheet(null);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.sheetItemLabel, { color: active ? BRAND : colors.text }]}>{option.label}</Text>
                  {active ? <Ionicons name="checkmark" size={18} color={BRAND} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      <Modal
        visible={activeSheet === 'status'}
        animationType="fade"
        transparent
        onRequestClose={() => setActiveSheet(null)}
      >
        <View style={styles.centerOverlay}>
          <Pressable style={styles.centerOverlayTouch} onPress={() => setActiveSheet(null)} />
          <View style={[styles.centerCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Filter By Status</Text>
            {STATUS_OPTIONS.map((option) => {
              const active = option.id === selectedStatus;
              const dotColor = option.id === 'all' ? colors.textFaint : STATUS_COLOR[option.id];
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.sheetItem, { borderBottomColor: colors.divider }]}
                  onPress={() => {
                    setSelectedStatus(option.id);
                    setActiveSheet(null);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={styles.statusOptionLeft}>
                    <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
                    <Text style={[styles.sheetItemLabel, { color: active ? BRAND : colors.text }]}>{option.label}</Text>
                  </View>
                  {active ? <Ionicons name="checkmark" size={18} color={BRAND} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
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

  // Bounded like BottomNav's own container (no flex:1) so this horizontal
  // ScrollView can't expand to fill the space between the header and list.
  filterScroll: { flexGrow: 0, flexShrink: 0, height: 50, marginBottom: 6 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20 },
  filterPill: {
    // Matches BottomNav's iconArea sizing (height: 34, borderRadius: 14) so
    // tappable containers stay visually consistent across the app.
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 34, paddingHorizontal: 14, borderRadius: 14,
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
    overflow: 'hidden',
  },
  txLogo: { width: 42, height: 42, borderRadius: 14 },
  txInfo: { flex: 1, paddingRight: 8 },
  txTitle: { fontFamily: FONTS.bold, fontSize: 13, color: '#0B0D1A', marginBottom: 3 },
  txSubtitle: { fontFamily: FONTS.regular, fontSize: 11, color: 'rgba(11,13,26,0.45)' },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontFamily: FONTS.bold, fontSize: 13.5, color: '#0B0D1A' },
  txStatus: { fontFamily: FONTS.semibold, fontSize: 10.5, marginTop: 2 },

  // All filter dialogs (date/category/status and the custom range picker)
  // are centered popups rather than bottom sheets.
  centerOverlay: { flex: 1, backgroundColor: 'rgba(11,13,26,0.4)', justifyContent: 'center', alignItems: 'center' },
  centerOverlayTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  centerCard: {
    borderRadius: 24, paddingVertical: 18, paddingHorizontal: 20,
    marginHorizontal: 24, alignSelf: 'center', width: '86%',
  },
  sheetTitle: {
    fontFamily: FONTS.extrabold,
    fontWeight: '800',
    fontSize: 17,
    marginBottom: 8,
  },
  sheetItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1,
  },
  sheetItemLabel: { fontFamily: FONTS.semibold, fontSize: 14 },
  statusOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 9, height: 9, borderRadius: 4.5 },

  customLabel: { fontFamily: FONTS.medium, fontSize: 12, marginBottom: 6, marginTop: 10 },
  customError: { fontFamily: FONTS.medium, fontSize: 12, color: '#DC2626', marginTop: 8 },
  applyBtn: {
    backgroundColor: BRAND, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginTop: 16,
  },
  applyBtnText: { fontFamily: FONTS.bold, fontSize: 14, color: '#FFFFFF' },

  customModalCard: {
    borderRadius: 24, padding: 20, marginHorizontal: 24, alignSelf: 'center', width: '86%',
  },
  dateField: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14,
  },
  dateFieldText: { fontFamily: FONTS.medium, fontSize: 14 },
  pickerCard: {
    borderRadius: 24, padding: 12, marginHorizontal: 24, alignSelf: 'center', width: '86%',
  },
});
