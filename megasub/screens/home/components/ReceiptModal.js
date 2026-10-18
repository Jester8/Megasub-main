import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useReceiptShare from '../../../lib/useReceiptShare';
import Receipt from './Receipt';
import ShareButtons from './ShareButtons';
import { CATEGORY_STYLE, DEFAULT_STYLE, isResultCheckerTransaction, STATUS_LABELS, formatDate } from '../../../lib/transactionMeta';
import { detectNetworkFromPhone } from '../../../lib/networkDetect';
import { useResultCheckerTransactionsQuery, useSavedResultCheckerHistoryQuery } from '../../../lib/queries';
import {
  extractResultCheckerPins,
  findMatchingResultCheckerRecord,
  resultCheckerExamType,
} from '../../../lib/resultCheckerHistory';

// Same logos Airtime/Data/Bulk already show on their own confirm/success
// screens — duplicated here rather than shared since each of those files
// already keeps its own local copy.
const NETWORK_LOGOS = {
  MTN: require('../../../assets/networks/mtn.png'),
  AIRTEL: require('../../../assets/networks/airtel.png'),
  GLO: require('../../../assets/networks/glo.png'),
  '9MOBILE': require('../../../assets/networks/9mobile.png'),
};

const FONTS = {
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  extrabold: 'Montserrat_800ExtraBold',
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
  result_checker: 'Result Checker',
};

// Result checker purchases: fetch_transactions has neither the PINs nor the
// RC reference/quantity. fetch_result_checker_transactions returns them
// (data[].pins, matched by transaction_id); PINs saved on this device at
// purchase time cover a history response that doesn't carry them.
function getResultCheckerRows(transaction, serverRecord, savedRecord, statusLabel) {
  const serverPins = extractResultCheckerPins({ pins: serverRecord?.pins });
  const pins = serverPins.length > 0 ? serverPins : extractResultCheckerPins({ pins: savedRecord?.pins });
  const exam = resultCheckerExamType(transaction) || resultCheckerExamType(serverRecord);
  const quantity = serverRecord?.quantity ?? savedRecord?.quantity;
  const reference = serverRecord?.reference || transaction.txn_reference || savedRecord?.reference;

  return [
    { label: 'Type', value: 'Result Checker' },
    ...(exam ? [{ label: 'Exam', value: exam }] : []),
    ...pins.flatMap((entry, index) => {
      const suffix = pins.length > 1 ? ` ${index + 1}` : '';
      return [
        ...(entry.pin ? [{ label: `PIN${suffix}`, value: entry.pin, multiline: true }] : []),
        ...(entry.serial ? [{ label: `Serial${suffix}`, value: entry.serial, multiline: true }] : []),
      ];
    }),
    ...(pins.length === 0 && String(transaction.status) === '1'
      ? [{ label: 'PIN', value: 'Not available yet', multiline: true }]
      : []),
    ...(quantity ? [{ label: 'Quantity', value: String(quantity) }] : []),
    { label: 'Status', value: statusLabel },
    ...(reference ? [{ label: 'Reference', value: String(reference), multiline: true }] : []),
    { label: 'Date', value: formatDate(transaction.created_at) },
  ];
}

// Full-screen receipt for a past transaction, tapped open from
// TransactionHistory/Recent — same visual receipt and share actions as a
// fresh SuccessView, just built from the transaction's own recorded fields.
export default function ReceiptModal({ visible, transaction, onClose, colors }) {
  const insets = useSafeAreaInsets();
  const { receiptRef, sharing, handleShareImage } = useReceiptShare();
  const isResultChecker = !!transaction && isResultCheckerTransaction(transaction);
  const userId = transaction?.user_id;
  const { data: serverRecords } = useResultCheckerTransactionsQuery(userId, { enabled: visible && isResultChecker });
  const { data: savedRecords } = useSavedResultCheckerHistoryQuery(userId, { enabled: visible && isResultChecker });

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
  const category = isResultChecker ? 'Result Checker' : CATEGORY_LABEL[transaction.transaction_category] || 'Transaction';
  const recipient = transaction.phone_number || transaction.smart_card_number || transaction.metre_number;
  // fetch_transactions has no dedicated network field — product_plan_name
  // (e.g. "MTN 500MB 3 MONTH") carries it as free text, but the recipient
  // number is the same reliable source Airtime/Data's contact-picker fix
  // already uses, so it's reused here instead of parsing the plan name.
  const isAirtimeOrData = transaction.transaction_category === 'airtime' || transaction.transaction_category === 'data';
  const network = isAirtimeOrData ? detectNetworkFromPhone(transaction.phone_number) : null;

  const genericRows = [
    { label: 'Type', value: category },
    ...(recipient ? [{ label: 'Recipient', value: recipient }] : []),
    ...(network ? [{ label: 'Network', value: network, logo: NETWORK_LOGOS[network] }] : []),
    // Server doesn't return which coupon (if any) was used on a past
    // transaction, only the resulting discount — "Discount" covers both a
    // coupon and a network-side bonus honestly, where "Bonus" specifically
    // would mislabel a coupon-discounted purchase.
    ...(bonus > 0
      ? [
          { label: 'Amount Paid', value: `₦${charged.toLocaleString()}` },
          { label: 'Discount', value: `₦${bonus.toLocaleString()}` },
        ]
      : []),
    { label: 'Status', value: statusLabel },
    ...(transaction.txn_reference ? [{ label: 'Reference', value: transaction.txn_reference }] : []),
    { label: 'Date', value: formatDate(transaction.created_at) },
  ];
  const rows = isResultChecker
    ? getResultCheckerRows(
        transaction,
        findMatchingResultCheckerRecord(serverRecords, transaction),
        findMatchingResultCheckerRecord(savedRecords, transaction),
        statusLabel
      )
    : genericRows;

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
