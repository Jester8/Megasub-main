import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import useReceiptShare from '../../../lib/useReceiptShare';
import Receipt from './Receipt';
import ShareButtons from './ShareButtons';

const FONTS = {
  bold: 'Manrope_700Bold',
};

const BRAND = '#4A55DD';

function formatDateTime(date) {
  return date.toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Shared "purchase complete" screen for Airtime/Data/Cable/etc — replaces
// the plain native Alert with a proper in-app receipt that can be shared
// as an image or PDF.
// details: [{ label, value }]
export default function SuccessView({ title, subtitle, amount, details, onDone, colors }) {
  const { receiptRef, sharing, handleShareImage } = useReceiptShare();

  const rows = [...(details || []), { label: 'Date', value: formatDateTime(new Date()) }];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.wrap}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <Receipt
        ref={receiptRef}
        title={title}
        subtitle={subtitle}
        amount={amount}
        rows={rows}
        colors={colors}
      />

      <View style={styles.shareWrap}>
        <ShareButtons sharing={sharing} onShareImage={handleShareImage} colors={colors} />
      </View>

      <TouchableOpacity style={styles.doneBtn} activeOpacity={0.85} onPress={onDone}>
        <Text style={styles.doneText}>Back to Home</Text>
        <Feather name="arrow-right" size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, width: '100%' },
  wrap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  shareWrap: { width: '100%', marginTop: 24 },
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: BRAND, borderRadius: 18, height: 56, width: '100%',
    marginTop: 16,
    shadowColor: BRAND, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  doneText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },
});
