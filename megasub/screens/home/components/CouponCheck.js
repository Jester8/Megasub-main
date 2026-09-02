import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { checkCouponQualification, fetchActiveCoupons } from '../../../lib/api';
import { formatNaira } from '../../../lib/format';

const FONTS = {
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};

const BRAND = '#4A55DD';

// The check-qualification endpoint takes only user_id + coupon_code (no
// network/plan), and a qualifying coupon's discount is reflected server-side
// via each transaction's own discounted_amount — there's no field to submit
// a coupon_code into buy_airtime/buy_data. So this is purely an upfront
// "will I get a discount" check, not something that changes the payload.
export default function CouponCheck({ userId, colors, productSlug, onApplied }) {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);

  const [activeCoupons, setActiveCoupons] = useState([]);
  const [loadingCoupons, setLoadingCoupons] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const json = await fetchActiveCoupons(userId);
        if (cancelled) return;
        const list = (json.data || []).filter((c) => c.product_slug === productSlug && c.status === '1');
        setActiveCoupons(list);
      } catch (error) {
        // Silent — the manual code entry below still works without this list.
      } finally {
        if (!cancelled) setLoadingCoupons(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, productSlug]);

  const runCheck = async (couponCode) => {
    const trimmed = couponCode.trim();
    if (!trimmed) return;

    setChecking(true);
    setResult(null);
    onApplied && onApplied(null);
    try {
      const json = await checkCouponQualification({ userId, couponCode: trimmed });
      const data = json.data || {};
      const qualified = !!data.qualified;
      setResult({
        qualified,
        amount: data.coupon_amount,
        message: json.message,
      });
      if (qualified) {
        onApplied && onApplied({ code: trimmed, amount: Number(data.coupon_amount) || 0 });
      }
    } catch (error) {
      setResult({ qualified: false, message: error.message || 'Could not check this code right now.' });
    } finally {
      setChecking(false);
    }
  };

  const handleSelectCoupon = (coupon) => {
    setCode(coupon.code);
    runCheck(coupon.code);
  };

  return (
    <View style={styles.wrap}>
      {loadingCoupons ? null : activeCoupons.length > 0 ? (
        <>
          <Text style={[styles.label, { color: colors.textMuted }]}>Active Coupons</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.couponScroll}>
            {activeCoupons.map((coupon) => {
              const networkName = coupon.product_plan_category?.network?.network_name;
              const categoryName = coupon.product_plan_category?.product_plan_category_name;
              const active = code.trim().toUpperCase() === coupon.code.toUpperCase();
              return (
                <TouchableOpacity
                  key={coupon.id}
                  style={[
                    styles.couponCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    active && { borderColor: BRAND },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleSelectCoupon(coupon)}
                >
                  <View style={styles.couponCardTop}>
                    <Text style={[styles.couponCode, { color: BRAND }]} numberOfLines={1}>{coupon.code}</Text>
                    <Text style={styles.couponAmount}>₦{formatNaira(coupon.amount)} off</Text>
                  </View>
                  <Text style={[styles.couponMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {[networkName, categoryName].filter(Boolean).join(' • ') || coupon.title}
                  </Text>
                  {coupon.slots_remaining != null ? (
                    <Text style={[styles.couponSlots, { color: colors.textFaint }]}>{coupon.slots_remaining} left</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      <Text style={[styles.label, { color: colors.textMuted, marginTop: activeCoupons.length > 0 ? 14 : 0 }]}>
        Have a coupon code?
      </Text>
      <View style={styles.row}>
        <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Enter coupon code"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            value={code}
            onChangeText={(text) => {
              setCode(text);
              setResult(null);
              onApplied && onApplied(null);
            }}
          />
        </View>
        <TouchableOpacity
          style={[styles.checkBtn, (!code.trim() || checking) && styles.checkBtnDisabled]}
          activeOpacity={0.85}
          onPress={() => runCheck(code)}
          disabled={!code.trim() || checking}
        >
          {checking ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.checkBtnText}>Check</Text>}
        </TouchableOpacity>
      </View>

      {result ? (
        <View style={[styles.resultBox, { backgroundColor: result.qualified ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.08)' }]}>
          <Feather
            name={result.qualified ? 'check-circle' : 'x-circle'}
            size={14}
            color={result.qualified ? '#16A34A' : '#DC2626'}
          />
          <Text style={[styles.resultText, { color: result.qualified ? '#16A34A' : '#DC2626' }]}>
            {result.qualified
              ? `You qualify! ₦${formatNaira(result.amount)} off will be applied automatically at checkout.`
              : result.message || 'This code is not valid right now.'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16 },
  label: { fontFamily: FONTS.semibold, fontSize: 12.5, marginBottom: 8 },

  couponScroll: { gap: 10, paddingBottom: 2 },
  couponCard: {
    width: 168, borderRadius: 14, borderWidth: 1.5, padding: 12,
  },
  couponCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  couponCode: { fontFamily: FONTS.bold, fontSize: 13.5, flex: 1, marginRight: 6, letterSpacing: 0.5 },
  couponAmount: { fontFamily: FONTS.bold, fontSize: 11.5, color: '#16A34A' },
  couponMeta: { fontFamily: FONTS.medium, fontSize: 11 },
  couponSlots: { fontFamily: FONTS.medium, fontSize: 10, marginTop: 4 },

  row: { flexDirection: 'row', gap: 10 },
  inputCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14,
    paddingHorizontal: 14, height: 48, borderWidth: 1.5, borderColor: '#ECEDF6',
    justifyContent: 'center',
  },
  input: { fontFamily: FONTS.medium, fontSize: 13.5 },
  checkBtn: {
    width: 76, height: 48, borderRadius: 14, backgroundColor: BRAND,
    alignItems: 'center', justifyContent: 'center',
  },
  checkBtnDisabled: { backgroundColor: '#B7BCEF' },
  checkBtnText: { fontFamily: FONTS.bold, fontSize: 13, color: '#FFFFFF' },
  resultBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, padding: 12, marginTop: 10,
  },
  resultText: { flex: 1, fontFamily: FONTS.medium, fontSize: 12, lineHeight: 17 },
});
