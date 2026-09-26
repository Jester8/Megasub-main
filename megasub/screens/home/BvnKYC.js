import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchKycStatus, verifyBvn } from '../../lib/api';
import { requireNetworkOrShowError } from '../../lib/network';
import { formatNaira, formatUsd, toLocalNigerianPhone, extractBvnProfile } from '../../lib/format';
import { useTheme } from '../../contexts/ThemeContext';
import UnavailableNotice from './components/UnavailableNotice';

import LogoLoader from './components/LogoLoader';
const FONTS = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  extrabold: 'Montserrat_800ExtraBold',
};

const BRAND = '#4A55DD';

const MATCH_LEVELS = {
  very_high: 'Very high',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  very_low: 'Very low',
};

// Backend validation replies look like { message, errors: { field: [msg] } };
// the first specific message reads better than the generic summary line.
function firstMessage(error) {
  const errors = error?.payload?.errors;
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).flat()[0];
    if (first) return String(first);
  }
  return error?.message || 'Please check your details and try again.';
}

function Field({ label, value, onChangeText, error, colors, ...inputProps }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: error ? '#D94F4F' : colors.border }]}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholderTextColor={colors.textFaint}
          value={value}
          onChangeText={onChangeText}
          {...inputProps}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// Standalone BVN verification (SecureWave), separate from the card-issuing
// identity form in CardKYC.js. The backend calls the provider only for a user
// who isn't verified yet and answers from its saved result afterwards.
export default function BvnKYC({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [kyc, setKyc] = useState(null);
  const [unavailableMessage, setUnavailableMessage] = useState(null);

  const [bvn, setBvn] = useState('');
  const [phone, setPhone] = useState(toLocalNigerianPhone(user?.phone_number));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  // Outcome of the verification the user just ran: { verified, message, score, level }.
  const [result, setResult] = useState(null);
  // Details returned by the verification that just ran. Kept in memory only for
  // this screen's lifetime; nothing personal is stored on the device.
  const [sessionDetails, setSessionDetails] = useState(null);
  // Shown once the account is confirmed verified, instead of a details card.
  const [verifiedPopup, setVerifiedPopup] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (!loading && (kyc?.verified === true || kyc?.status === 'verified')) setVerifiedPopup(true);
  }, [loading, kyc]);

  const loadStatus = async () => {
    try {
      const json = await fetchKycStatus();
      setUnavailableMessage(null);
      setKyc(json?.data || null);
    } catch (error) {
      if (error.isUnavailable) setUnavailableMessage(error.message);
      else Alert.alert('Network Error', error.message || 'Could not load your verification status.');
    } finally {
      setLoading(false);
    }
  };

  const settings = kyc?.settings || {};
  const verified = kyc?.verified === true || kyc?.status === 'verified';
  const disabled = settings.enabled === false;
  const attempts = Number(kyc?.attempts) || 0;
  const maxAttempts = Number(settings.max_attempts) || 0;
  const attemptsLeft = maxAttempts ? Math.max(0, maxAttempts - attempts) : null;
  const locked = maxAttempts > 0 && attempts >= maxAttempts;
  const fee = Number(settings.verification_fee) || 0;
  const minScore = Number(settings.minimum_match_score) || 0;

  // What this check will cost, stated before the user commits to it.
  const feeText = (() => {
    if (fee <= 0) return 'Free';
    if (settings.free_first_verification && attempts === 0) return 'Your first verification is free';
    const amount = settings.wallet === 'usd_wallet' ? formatUsd(fee) : `₦${formatNaira(fee)}`;
    const wallet = settings.wallet === 'usd_wallet' ? 'USD wallet' : 'main wallet';
    return `${amount} is charged from your ${wallet}`;
  })();

  // Name, photo and contact details of the verified person, whichever of the
  // status reply or the verification reply carries them.
  const profile = extractBvnProfile(kyc, sessionDetails);

  const validate = () => {
    const e = {};
    if (!/^\d{11}$/.test(bvn)) e.bvn = 'BVN must be 11 digits';
    if (!/^0\d{10}$/.test(phone)) e.phone = 'Enter your 11-digit phone number';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!(await requireNetworkOrShowError())) return;

    setSubmitting(true);
    setResult(null);
    try {
      const json = await verifyBvn({ phone, bvn });
      const data = json?.data || {};
      const isVerified = data.status?.verified === true || data.status?.status === 'verified';
      setResult({
        verified: isVerified,
        message: json?.message,
        score: data.profile_match?.score,
        level: data.profile_match?.level,
      });
      setBvn('');
      if (isVerified) setSessionDetails(data);
      await loadStatus();
    } catch (error) {
      if (error.isUnavailable) {
        setUnavailableMessage(error.message);
        return;
      }
      // A dropped connection is ambiguous: the check may have run (and used an
      // attempt or a fee). Refresh the real state instead of guessing.
      if (error.isNetworkError) {
        Alert.alert(
          'Check Your Status',
          'We lost connection before getting a response. Your verification may have gone through, so your status is being refreshed.'
        );
      } else {
        Alert.alert('Verification Failed', firstMessage(error));
      }
      await loadStatus();
    } finally {
      setSubmitting(false);
    }
  };

  const showForm = !loading && !unavailableMessage && !verified && !disabled && !locked;
  const clearError = (key) => setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card }]}
          onPress={() => navigate && navigate('home')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>KYC Verification</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {loading ? (
          <LogoLoader centered />
        ) : unavailableMessage ? (
          <UnavailableNotice title="Verification Unavailable" message={unavailableMessage} icon="shield" colors={colors} />
        ) : disabled ? (
          <UnavailableNotice
            title="Verification Is Off"
            message="Identity verification is not being offered right now. Please check back later."
            icon="shield-off"
            colors={colors}
          />
        ) : (
          <>
            {result ? (
              <View style={[styles.statusCard, result.verified ? styles.cardGood : styles.cardBad]}>
                <View style={[styles.iconWrap, { backgroundColor: result.verified ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }]}>
                  <Ionicons
                    name={result.verified ? 'shield-checkmark' : 'alert-circle-outline'}
                    size={22}
                    color={result.verified ? '#10B981' : '#EF4444'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusTitle, { color: colors.text }]}>
                    {result.verified ? 'Verification successful' : 'Verification not completed'}
                  </Text>
                  <Text style={[styles.statusSub, { color: colors.textMuted }]}>
                    {result.score !== undefined && result.score !== null
                      ? `Profile match: ${result.score}%${MATCH_LEVELS[result.level] ? ` (${MATCH_LEVELS[result.level]})` : ''}. `
                      : ''}
                    {result.verified
                      ? 'Your identity is verified.'
                      : `${minScore ? `A ${minScore}% match is needed. ` : ''}Make sure your name, phone number and email on Megasub match your BVN records.`}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Verified details card (name, photo, contact) is switched off until the
                backend returns those fields from fetch_kyc_status. Re-enable by
                restoring this block; the styles and extractBvnProfile are kept.

              <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }, result ? { marginTop: 12 } : null]}>
                <View style={styles.detailsTop}>
                  <View style={styles.photoWrap}>
                    {profile?.image ? (
                      <Image source={{ uri: profile.image }} style={styles.photo} />
                    ) : (
                      <Ionicons name="person" size={34} color="#FFFFFF" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailsName, { color: colors.text }]} numberOfLines={2}>
                      {profile?.fullName || 'BVN verified'}
                    </Text>
                    <View style={styles.verifiedPill}>
                      <Ionicons name="shield-checkmark" size={13} color="#10B981" />
                      <Text style={styles.verifiedPillText}>Verified</Text>
                    </View>
                  </View>
                </View>

                {[
                  ['BVN', kyc?.bvn],
                  ['Phone', profile?.phone],
                  ['Email', profile?.email],
                  ['Date of birth', profile?.dob],
                ]
                  .filter(([, value]) => !!value)
                  .map(([label, value]) => (
                    <View key={label} style={[styles.detailRow, { borderTopColor: colors.divider }]}>
                      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
                    </View>
                  ))}
              </View>
            */}
            {verified ? null : (
              <>
                <View style={[styles.statusCard, styles.cardWarn, result ? { marginTop: 12 } : null]}>
                  <View style={[styles.iconWrap, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                    <Ionicons name="shield-outline" size={22} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.statusTitle, { color: colors.text }]}>
                      {locked ? 'No attempts left' : 'Verify your identity'}
                    </Text>
                    <Text style={[styles.statusSub, { color: colors.textMuted }]}>
                      {locked
                        ? 'You have used all your verification attempts. Please contact support for help.'
                        : `Confirm your BVN to verify your identity.${minScore ? ` Your BVN details must match your Megasub profile (${minScore}% needed).` : ''}`}
                    </Text>
                  </View>
                </View>

                {showForm ? (
                  <>
                    <View style={[styles.infoRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Cost</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>{feeText}</Text>
                      </View>
                      {attemptsLeft !== null ? (
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Attempts left</Text>
                          <Text style={[styles.infoValue, { color: colors.text }]}>{attemptsLeft} of {maxAttempts}</Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={[styles.payNotice, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Ionicons name="information-circle-outline" size={20} color="#F59E0B" style={{ marginTop: 1 }} />
                      <Text style={[styles.payNoticeText, { color: colors.textMuted }]}>
                        To verify, send ₦100 to your Megasub virtual account (see Top Up). Send it from a commercial
                        bank account only, such as GTBank, Access, Zenith, UBA or First Bank. Transfers from
                        microfinance banks and fintech apps like OPay, PalmPay, Moniepoint or Kuda are not accepted.
                      </Text>
                    </View>

                    <Field
                      label="BVN"
                      value={bvn}
                      onChangeText={(t) => { setBvn(t.replace(/\D/g, '').slice(0, 11)); clearError('bvn'); }}
                      placeholder="11-digit BVN"
                      keyboardType="number-pad"
                      maxLength={11}
                      error={errors.bvn}
                      colors={colors}
                    />
                    <Field
                      label="Phone Number"
                      value={phone}
                      onChangeText={(t) => { setPhone(toLocalNigerianPhone(t) || t.replace(/\D/g, '').slice(0, 11)); clearError('phone'); }}
                      placeholder="08012345678"
                      keyboardType="phone-pad"
                      maxLength={11}
                      error={errors.phone}
                      colors={colors}
                    />
                    <Text style={[styles.note, { color: colors.textFaint }]}>
                      Dial *565*0# on the phone number linked to your BVN if you are unsure which number it is.
                    </Text>
                  </>
                ) : null}
              </>
            )}
          </>
        )}
      </ScrollView>

      {showForm ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.continueBtn, submitting && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.continueText}>Verify BVN</Text>
                <Feather name="shield" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
      {/* Footer Done button for a verified account is switched off: only the
          Account Verified popup shows.
      {!loading && verified ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background }]}>
          <TouchableOpacity style={styles.continueBtn} activeOpacity={0.85} onPress={() => navigate && navigate('home')}>
            <Text style={styles.continueText}>Done</Text>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : null}
      */}
      <Modal visible={verifiedPopup} transparent animationType="fade" onRequestClose={() => setVerifiedPopup(false)}>
        <View style={styles.popupOverlay}>
          <View style={[styles.popupCard, { backgroundColor: colors.card }]}>
            <View style={styles.popupIcon}>
              <Ionicons name="shield-checkmark" size={38} color="#10B981" />
            </View>
            <Text style={[styles.popupTitle, { color: colors.text }]}>Account Verified</Text>
            <Text style={[styles.popupText, { color: colors.textMuted }]}>
              Your identity has been verified. You can now create virtual dollar cards.
            </Text>
            <TouchableOpacity
              style={[styles.continueBtn, styles.popupBtn]}
              activeOpacity={0.85}
              onPress={() => {
                setVerifiedPopup(false);
                navigate && navigate('home');
              }}
            >
              <Text style={styles.continueText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    elevation: 2, shadowColor: '#0B0D1A', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 16, color: '#0B0D1A' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },

  statusCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 18, padding: 16, borderWidth: 1.5, marginTop: 4 },
  cardGood: { backgroundColor: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.25)' },
  cardWarn: { backgroundColor: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.25)' },
  cardBad: { backgroundColor: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.25)' },
  iconWrap: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontFamily: FONTS.bold, fontSize: 14.5, marginBottom: 4 },
  statusSub: { fontFamily: FONTS.regular, fontSize: 12.5, lineHeight: 18 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1.5, padding: 14, marginTop: 16, marginBottom: 6 },
  infoLabel: { fontFamily: FONTS.medium, fontSize: 11.5, marginBottom: 3 },
  infoValue: { fontFamily: FONTS.semibold, fontSize: 13 },

  payNotice: { flexDirection: 'row', gap: 10, borderRadius: 14, borderWidth: 1.5, padding: 14, marginTop: 10 },
  payNoticeText: { flex: 1, fontFamily: FONTS.medium, fontSize: 12, lineHeight: 18 },

  detailsCard: { borderRadius: 18, borderWidth: 1.5, padding: 16, marginTop: 4 },
  detailsTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  photoWrap: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: BRAND,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  photo: { width: 76, height: 76 },
  detailsName: { fontFamily: FONTS.extrabold, fontSize: 17, marginBottom: 6 },
  verifiedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 9,
  },
  verifiedPillText: { fontFamily: FONTS.semibold, fontSize: 11.5, color: '#10B981' },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    gap: 12, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth,
  },
  detailLabel: { fontFamily: FONTS.medium, fontSize: 12.5 },
  detailValue: { fontFamily: FONTS.semibold, fontSize: 13, flexShrink: 1, textAlign: 'right' },

  popupOverlay: { flex: 1, backgroundColor: 'rgba(11,13,26,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  popupCard: { width: '100%', maxWidth: 380, borderRadius: 24, padding: 24, alignItems: 'center' },
  popupIcon: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(16,185,129,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  popupBtn: { alignSelf: 'stretch' },
  popupTitle: { fontFamily: FONTS.extrabold, fontSize: 19, marginBottom: 8 },
  popupText: { fontFamily: FONTS.medium, fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 22 },

  fieldWrap: { marginTop: 14 },
  fieldLabel: { fontFamily: FONTS.medium, fontSize: 12.5, marginBottom: 6 },
  inputCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 16, height: 54, borderWidth: 1.5 },
  input: { flex: 1, fontFamily: FONTS.semibold, fontSize: 14.5 },
  errorText: { fontFamily: FONTS.regular, fontSize: 11.5, color: '#D94F4F', marginTop: 5, marginLeft: 4 },
  note: { fontFamily: FONTS.regular, fontSize: 11.5, lineHeight: 16, marginTop: 12, marginLeft: 4 },

  footer: { paddingHorizontal: 20, paddingTop: 12 },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND, borderRadius: 18, height: 56, gap: 8,
    shadowColor: BRAND, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  continueBtnDisabled: { backgroundColor: '#B7BCEF', shadowOpacity: 0, elevation: 0 },
  continueText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },
});
