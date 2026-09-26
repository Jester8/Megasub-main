import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
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
import { fetchCardKycStatus, submitCardKyc } from '../../lib/api';
import { requireNetworkOrShowError } from '../../lib/network';
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

// 1990-01-01 style — digits only, hyphens inserted as the user types.
function formatDobInput(text) {
  const d = String(text || '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}

// Real calendar date (rejects 1990-02-31), in the past, and 18 or older.
function validateDob(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Enter your date of birth as YYYY-MM-DD';
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return 'Enter a valid date of birth';
  }
  const eighteen = new Date(y + 18, m - 1, d);
  if (eighteen.getTime() > Date.now()) return 'You must be at least 18 years old';
  return null;
}

// Backend validation replies look like { message, errors: { field: [msg] } };
// the first specific message reads better than the generic summary line.
function firstValidationMessage(error) {
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
      <View
        style={[
          styles.inputCard,
          { backgroundColor: colors.card, borderColor: error ? '#D94F4F' : colors.border },
        ]}
      >
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

export default function CardKYC({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [status, setStatus] = useState(null); // verified | pending | rejected | ... | null
  const [unavailableMessage, setUnavailableMessage] = useState(null);

  const [bvn, setBvn] = useState('');
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone_number || '');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const json = await fetchCardKycStatus(user?.id);
      setUnavailableMessage(null);
      setStatus(json?.data?.status || null);
    } catch (error) {
      // Provider not live yet: the form would just fail on submit, so it is
      // hidden behind a "coming soon" notice instead of offered.
      if (error.isUnavailable) setUnavailableMessage(error.message);
      else Alert.alert('Network Error', error.message || 'Could not load your verification status.');
    } finally {
      setLoadingStatus(false);
    }
  };

  const validate = () => {
    const e = {};
    if (!/^\d{11}$/.test(bvn.trim())) e.bvn = 'BVN must be 11 digits';
    if (!firstName.trim()) e.firstName = 'First name is required';
    if (!lastName.trim()) e.lastName = 'Last name is required';
    const dobError = validateDob(dob);
    if (dobError) e.dob = dobError;
    if (!/\S+@\S+\.\S+/.test(email.trim())) e.email = 'Enter a valid email address';
    const cleanPhone = phone.replace(/\s+/g, '');
    if (!/^0?\d{10}$/.test(cleanPhone)) e.phone = 'Enter a valid 11-digit phone number';
    if (!street.trim()) e.street = 'Street address is required';
    if (!city.trim()) e.city = 'City is required';
    if (!stateName.trim()) e.stateName = 'State is required';
    if (!postalCode.trim()) e.postalCode = 'Postal code is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!(await requireNetworkOrShowError())) return;

    const cleanPhone = phone.replace(/\s+/g, '');
    setSubmitting(true);
    try {
      const json = await submitCardKyc({
        user_id: user?.id,
        bvn: bvn.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: cleanPhone.startsWith('0') ? cleanPhone : `0${cleanPhone}`,
        date_of_birth: dob,
        street: street.trim(),
        city: city.trim(),
        state: stateName.trim(),
        country: 'NG',
        postal_code: postalCode.trim(),
      });
      setStatus(json?.data?.status || 'pending');
    } catch (error) {
      if (error.isUnavailable) setUnavailableMessage(error.message);
      else Alert.alert('Verification Failed', firstValidationMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const showForm = !loadingStatus && !unavailableMessage && status !== 'verified' && status !== 'pending';
  const rejected = status === 'rejected' || status === 'failed';

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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loadingStatus ? (
          <LogoLoader centered />
        ) : unavailableMessage ? (
          <UnavailableNotice
            title="Verification Coming Soon"
            message={unavailableMessage}
            icon="shield"
            colors={colors}
          />
        ) : status === 'verified' ? (
          <View style={[styles.statusCard, styles.statusVerified]}>
            <View style={[styles.statusIconWrap, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
              <Ionicons name="shield-checkmark" size={22} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: colors.text }]}>Verified</Text>
              <Text style={[styles.statusSub, { color: colors.textMuted }]}>
                Your identity has been verified. You can create and fund virtual cards.
              </Text>
            </View>
          </View>
        ) : status === 'pending' ? (
          <View style={[styles.statusCard, styles.statusPending]}>
            <View style={[styles.statusIconWrap, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
              <Ionicons name="time-outline" size={22} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: colors.text }]}>Under Review</Text>
              <Text style={[styles.statusSub, { color: colors.textMuted }]}>
                Your details were submitted and are being reviewed. You will be able to create a card once they are
                approved.
              </Text>
            </View>
          </View>
        ) : (
          <>
            <View style={[styles.statusCard, rejected ? styles.statusRejected : styles.statusPending]}>
              <View
                style={[
                  styles.statusIconWrap,
                  { backgroundColor: rejected ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)' },
                ]}
              >
                <Ionicons
                  name={rejected ? 'alert-circle-outline' : 'shield-outline'}
                  size={22}
                  color={rejected ? '#EF4444' : '#F59E0B'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusTitle, { color: colors.text }]}>
                  {rejected ? 'Verification Not Approved' : 'Verify Your Identity'}
                </Text>
                <Text style={[styles.statusSub, { color: colors.textMuted }]}>
                  {rejected
                    ? 'Your last submission was not approved. Check your details and try again.'
                    : 'Card providers may need to confirm who you are before issuing a card. Your BVN is only used for that.'}
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Identity</Text>
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
              label="First Name"
              value={firstName}
              onChangeText={(t) => { setFirstName(t); clearError('firstName'); }}
              placeholder="First name"
              autoCapitalize="words"
              error={errors.firstName}
              colors={colors}
            />
            <Field
              label="Last Name"
              value={lastName}
              onChangeText={(t) => { setLastName(t); clearError('lastName'); }}
              placeholder="Last name"
              autoCapitalize="words"
              error={errors.lastName}
              colors={colors}
            />
            <Field
              label="Date of Birth"
              value={dob}
              onChangeText={(t) => { setDob(formatDobInput(t)); clearError('dob'); }}
              placeholder="YYYY-MM-DD"
              keyboardType="number-pad"
              maxLength={10}
              error={errors.dob}
              colors={colors}
            />

            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Contact</Text>
            <Field
              label="Email"
              value={email}
              onChangeText={(t) => { setEmail(t); clearError('email'); }}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.email}
              colors={colors}
            />
            <Field
              label="Phone Number"
              value={phone}
              onChangeText={(t) => { setPhone(t); clearError('phone'); }}
              placeholder="08012345678"
              keyboardType="phone-pad"
              error={errors.phone}
              colors={colors}
            />

            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Address</Text>
            <Field
              label="Street"
              value={street}
              onChangeText={(t) => { setStreet(t); clearError('street'); }}
              placeholder="House number and street"
              autoCapitalize="words"
              error={errors.street}
              colors={colors}
            />
            <Field
              label="City"
              value={city}
              onChangeText={(t) => { setCity(t); clearError('city'); }}
              placeholder="City"
              autoCapitalize="words"
              error={errors.city}
              colors={colors}
            />
            <Field
              label="State"
              value={stateName}
              onChangeText={(t) => { setStateName(t); clearError('stateName'); }}
              placeholder="State"
              autoCapitalize="words"
              error={errors.stateName}
              colors={colors}
            />
            <Field
              label="Postal Code"
              value={postalCode}
              onChangeText={(t) => { setPostalCode(t); clearError('postalCode'); }}
              placeholder="e.g. 100001"
              keyboardType="number-pad"
              error={errors.postalCode}
              colors={colors}
            />
            <View style={styles.countryRow}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted, marginBottom: 0 }]}>Country</Text>
              <Text style={[styles.countryValue, { color: colors.text }]}>Nigeria</Text>
            </View>
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
                <Text style={styles.continueText}>Submit for Verification</Text>
                <Feather name="arrow-right" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : !loadingStatus && (status === 'verified' || status === 'pending') ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={styles.continueBtn}
            activeOpacity={0.85}
            onPress={() => navigate && navigate('virtual-card')}
          >
            <Text style={styles.continueText}>Go to Virtual Cards</Text>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#0B0D1A',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 16, color: '#0B0D1A' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },
  sectionLabel: { fontFamily: FONTS.semibold, fontSize: 13, marginTop: 24, marginBottom: 10 },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    marginTop: 4,
  },
  statusPending: { backgroundColor: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.25)' },
  statusVerified: { backgroundColor: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.25)' },
  statusRejected: { backgroundColor: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.25)' },
  statusIconWrap: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontFamily: FONTS.bold, fontSize: 14.5, marginBottom: 4 },
  statusSub: { fontFamily: FONTS.regular, fontSize: 12.5, lineHeight: 18 },

  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontFamily: FONTS.medium, fontSize: 12.5, marginBottom: 6 },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 54,
    borderWidth: 1.5,
  },
  input: { flex: 1, fontFamily: FONTS.semibold, fontSize: 14.5 },
  errorText: { fontFamily: FONTS.regular, fontSize: 11.5, color: '#D94F4F', marginTop: 5, marginLeft: 4 },
  countryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingHorizontal: 4 },
  countryValue: { fontFamily: FONTS.semibold, fontSize: 14 },

  footer: { paddingHorizontal: 20, paddingTop: 12 },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND,
    borderRadius: 18,
    height: 56,
    gap: 8,
    shadowColor: BRAND,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  continueBtnDisabled: { backgroundColor: '#B7BCEF', shadowOpacity: 0, elevation: 0 },
  continueText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },
});
