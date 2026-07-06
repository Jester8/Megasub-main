import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../contexts/ThemeContext';

const FONTS = {
  regular: 'Manrope_400Regular',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};

const PADDING = 20;
const CARD_PADDING = 16;

const TRANSACTIONS = [
  {
    id: '1',
    title: 'Airtime Recharge',
    subtitle: 'MTN • Today, 10:24 AM',
    amount: '-₦1,000',
    type: 'debit',
    icon: 'call',
    color: '#4A55DD',
    bg: 'rgba(74,85,221,0.1)',
  },
  {
    id: '2',
    title: 'Wallet Funding',
    subtitle: 'Bank Transfer • Today, 9:02 AM',
    amount: '+₦15,000',
    type: 'credit',
    icon: 'arrow-down-circle',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.1)',
  },
  {
    id: '3',
    title: 'Electricity Bill',
    subtitle: 'Ikeja Electric • Yesterday',
    amount: '-₦5,500',
    type: 'debit',
    icon: 'flash',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.1)',
  },
  {
    id: '4',
    title: 'Data Subscription',
    subtitle: 'Airtel • Yesterday',
    amount: '-₦2,000',
    type: 'debit',
    icon: 'wifi',
    color: '#00C9A7',
    bg: 'rgba(0,201,167,0.1)',
  },
];

function TransactionItem({ tx, colors }) {
  const isCredit = tx.type === 'credit';
  return (
    <TouchableOpacity style={styles.txItem} activeOpacity={0.75}>
      <View style={[styles.iconWrap, { backgroundColor: tx.bg }]}>
        <Ionicons name={tx.icon} size={20} color={tx.color} />
      </View>
      <View style={styles.txInfo}>
        <Text style={[styles.txTitle, { color: colors.text }]}>{tx.title}</Text>
        <Text style={[styles.txSubtitle, { color: colors.textMuted }]}>{tx.subtitle}</Text>
      </View>
      <Text style={[styles.txAmount, isCredit ? styles.txAmountCredit : { color: colors.text }]}>
        {tx.amount}
      </Text>
    </TouchableOpacity>
  );
}

export default function RecentTransactions({ onSeeAllPress }) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Transactions</Text>
        <TouchableOpacity onPress={onSeeAllPress}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        {TRANSACTIONS.map((tx, index) => (
          <View key={tx.id}>
            <TransactionItem tx={tx} colors={colors} />
            {index < TRANSACTIONS.length - 1 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: PADDING,
    marginTop: 28,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  },
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
  txInfo: {
    flex: 1,
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
  txAmountCredit: {
    color: '#10B981',
  },
  txAmountDebit: {
    color: '#0B0D1A',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(11,13,26,0.06)',
    marginVertical: 2,
  },
});