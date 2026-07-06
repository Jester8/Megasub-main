import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav from './components/BottomNav';
import { useTheme } from '../../contexts/ThemeContext';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const BRAND = '#4A55DD';

const WALLET_ACTIVITY = [
  {
    id: '1',
    title: 'Wallet Funding',
    subtitle: 'Bank Transfer • Today, 9:02 AM',
    amount: '+₦15,000',
    type: 'credit',
    icon: 'arrow-down-circle',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.1)',
  },
  {
    id: '2',
    title: 'Airtime Recharge',
    subtitle: 'MTN • Today, 10:24 AM',
    amount: '-₦1,000',
    type: 'debit',
    icon: 'call',
    color: '#4A55DD',
    bg: 'rgba(74,85,221,0.1)',
  },
  {
    id: '3',
    title: 'Cable Subscription',
    subtitle: 'DStv Compact • Yesterday',
    amount: '-₦19,000',
    type: 'debit',
    icon: 'tv',
    color: '#EC4899',
    bg: 'rgba(236,72,153,0.1)',
  },
  {
    id: '4',
    title: 'Wallet Funding',
    subtitle: 'Bank Transfer • 2 days ago',
    amount: '+₦5,000',
    type: 'credit',
    icon: 'arrow-down-circle',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.1)',
  },
];

function ActivityItem({ item, colors }) {
  const isCredit = item.type === 'credit';
  return (
    <View style={styles.txItem}>
      <View style={[styles.txIconWrap, { backgroundColor: item.bg }]}>
        <Ionicons name={item.icon} size={20} color={item.color} />
      </View>
      <View style={styles.txInfo}>
        <Text style={[styles.txTitle, { color: colors.text }]}>{item.title}</Text>
        <Text style={[styles.txSubtitle, { color: colors.textMuted }]}>{item.subtitle}</Text>
      </View>
      <Text style={[styles.txAmount, isCredit ? styles.txAmountCredit : { color: colors.text }]}>
        {item.amount}
      </Text>
    </View>
  );
}

export default function Wallet({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(false);

  const walletBalance = user?.main_wallet ? parseFloat(user.main_wallet) : 0.0;
  const formatted = '₦' + walletBalance.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

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
          {WALLET_ACTIVITY.map((item, index) => (
            <View key={item.id}>
              <ActivityItem item={item} colors={colors} />
              {index < WALLET_ACTIVITY.length - 1 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
            </View>
          ))}
        </View>
      </ScrollView>

      <BottomNav
        activeTab="wallet"
        onTabPress={(tab) => {
          if (tab === 'wallet') return;
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

  listCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16 },
  txItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  txIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txInfo: { flex: 1 },
  txTitle: { fontFamily: FONTS.bold, fontSize: 13.5, color: '#0B0D1A', marginBottom: 2 },
  txSubtitle: { fontFamily: FONTS.regular, fontSize: 11.5, color: 'rgba(11,13,26,0.45)' },
  txAmount: { fontFamily: FONTS.bold, fontSize: 13.5 },
  txAmountCredit: { color: '#10B981' },
  txAmountDebit: { color: '#0B0D1A' },
  divider: { height: 1, backgroundColor: 'rgba(11,13,26,0.06)', marginVertical: 2 },
});
