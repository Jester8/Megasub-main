import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useReceiptShare from '../../../lib/useReceiptShare';
import Receipt from './Receipt';
import ShareButtons from './ShareButtons';
import { CATEGORY_STYLE, DEFAULT_STYLE, STATUS_LABELS, formatDate } from '../../../lib/transactionMeta';
import { detectNetworkFromPhone } from '../../../lib/networkDetect';

const FONTS = {
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const STATUS_ICON = {
  '1': { name: 'checkmark', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  '0': { name: 'time', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  '-1': { name: 'close', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
};

const CATEGORY_LABEL = {
  airtime: 'Airtime',
  data: 'Data',
  utility_bills: 'Electricity',
  cable_subscription: 'Cable TV',
};

// Full-screen receipt for a past transaction, tapped open from
// TransactionHistory/Recent — same visual receipt and share actions as a
// fresh SuccessView, just built from the transaction's own recorded fields.
export default function ReceiptModal({ visible, transaction, onClose, colors }) {
  const insets = useSafeAreaInsets();
  const { receiptRef, sharing, handleShareImage } = useReceiptShare();

  if (!transaction) return null;

  const statusIcon = STATUS_ICON[transaction.status] || STATUS_ICON['0'];
  const statusLabel = STATUS_LABELS[transaction.status] || 'Unknown';
  // `amount` is the face value actually purchased (e.g. ₦100 airtime);
  // `discounted_amount` is what was charged from the wallet (e.g. ₦98).
  // The headline shows what the customer bought, with the charge and the
  // bonus/discount broken out as their own rows when they differ.
  const faceValue = Number(transaction.amount || 0);
  const charged = Number(transaction.discounted_amount || transaction.amount || 0);
  const amount = faceValue || charged;
  const bonus = faceValue > charged ? faceValue - charged : 0;
  const category = CATEGORY_LABEL[transaction.transaction_category] || 'Transaction';
  const recipient = transaction.phone_number || transaction.smart_card_number || transaction.metre_number;
  // fetch_transactions has no dedicated network field — product_plan_name
  // (e.g. "MTN 500MB 3 MONTH") carries it as free text, but the recipient
  // number is the same reliable source Airtime/Data's contact-picker fix
  // already uses, so it's reused here instead of parsing the plan name.
  const isAirtimeOrData = transaction.transaction_category === 'airtime' || transaction.transaction_category === 'data';
  const network = isAirtimeOrData ? detectNetworkFromPhone(transaction.phone_number) : null;

  const rows = [
    { label: 'Type', value: category },
    ...(recipient ? [{ label: 'Recipient', value: recipient }] : []),
    ...(network ? [{ label: 'Network', value: network }] : []),
    ...(bonus > 0
      ? [
          { label: 'Amount Paid', value: `₦${charged.toLocaleString()}` },
          { label: 'Bonus', value: `₦${bonus.toLocaleString()}` },
        ]
      : []),
    { label: 'Status', value: statusLabel },
    ...(transaction.txn_reference ? [{ label: 'Reference', value: transaction.txn_reference }] : []),
    { label: 'Date', value: formatDate(transaction.created_at) },
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.card }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Feather name="x" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Receipt</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}
          showsVerticalScrollIndicator={false}
        >
          <Receipt
            ref={receiptRef}
            iconName={statusIcon.name}
            iconColor={statusIcon.color}
            iconBg={statusIcon.bg}
            title={transaction.description || 'Transaction'}
            amount={amount}
            rows={rows}
            colors={colors}
          />

          <View style={styles.shareWrap}>
            <ShareButtons sharing={sharing} onShareImage={handleShareImage} colors={colors} />
          </View>
        </ScrollView>
      </View>
    </Modal>
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
  closeBtn: {
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
  scrollContent: { paddingHorizontal: 24, paddingTop: 20 },
  shareWrap: { width: '100%', marginTop: 24 },
});
