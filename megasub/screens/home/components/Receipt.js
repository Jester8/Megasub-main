import React, { forwardRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const LOGO = require('../../../assets/logo.png');

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

// The visual receipt card shared by SuccessView (fresh purchase) and
// ReceiptModal (past transaction) — forwards its ref so the parent can
// capture it as an image/PDF via useReceiptShare.
// rows: [{ label, value }]
const Receipt = forwardRef(function Receipt(
  { iconName = 'checkmark', iconColor = '#10B981', iconBg = 'rgba(16,185,129,0.12)', title, subtitle, amount, rows, colors },
  ref
) {
  return (
    <View ref={ref} collapsable={false} style={[styles.receipt, { backgroundColor: colors.background }]}>
      <Image source={LOGO} style={styles.logo} resizeMode="contain" />

      <View style={[styles.iconOuter, { backgroundColor: iconBg }]}>
        <View style={[styles.iconInner, { backgroundColor: iconColor, shadowColor: iconColor }]}>
          <Ionicons name={iconName} size={38} color="#FFFFFF" />
        </View>
      </View>

      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}

      {amount != null ? (
        <Text style={styles.amount}>₦{Number(amount).toLocaleString()}</Text>
      ) : null}

      {rows && rows.length > 0 ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {rows.map((row, index) => (
            <View
              key={row.label}
              style={[
                styles.row,
                index < rows.length - 1 && [styles.rowDivider, { borderBottomColor: colors.divider }],
              ]}
            >
              <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{row.label}</Text>
              <View style={styles.rowValueWrap}>
                {row.logo ? <Image source={row.logo} style={styles.rowLogo} /> : null}
                <Text style={[styles.rowValue, { color: colors.text }]} numberOfLines={1}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.footer, { borderTopColor: colors.divider }]}>
        <Text style={[styles.footerBrand, { color: colors.text }]}>Megasub</Text>
        <Text style={[styles.footerText, { color: colors.textFaint }]}>support@mega-sub.com</Text>
        <Text style={[styles.footerText, { color: colors.textFaint }]}>Thank you for using Megasub</Text>
      </View>
    </View>
  );
});

export default Receipt;

const BRAND = '#4A55DD';

const styles = StyleSheet.create({
  receipt: { width: '100%', alignItems: 'center' },
  logo: { width: 100, height: 40, marginBottom: 18 },
  iconOuter: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  iconInner: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  title: { fontFamily: FONTS.extrabold, fontWeight: '800', fontSize: 20, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontFamily: FONTS.medium, fontSize: 13.5, textAlign: 'center', lineHeight: 20, paddingHorizontal: 10 },
  amount: { fontFamily: FONTS.extrabold, fontWeight: '800', fontSize: 32, color: BRAND, marginTop: 18 },

  card: {
    width: '100%', borderRadius: 18, borderWidth: 1.5, padding: 16, marginTop: 26,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, gap: 12 },
  rowDivider: { borderBottomWidth: 1 },
  rowLabel: { fontFamily: FONTS.medium, fontSize: 13 },
  rowValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  rowLogo: { width: 18, height: 18, borderRadius: 9 },
  rowValue: { fontFamily: FONTS.semibold, fontSize: 13.5, flexShrink: 1, textAlign: 'right' },

  footer: { alignItems: 'center', marginTop: 24, paddingTop: 18, borderTopWidth: 1, width: '100%' },
  footerBrand: { fontFamily: FONTS.extrabold, fontWeight: '800', fontSize: 15, marginBottom: 4 },
  footerText: { fontFamily: FONTS.regular, fontSize: 11.5, lineHeight: 17 },
});
