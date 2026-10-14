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
import { useTheme } from '../../contexts/ThemeContext';
import { forgotPassword, resetPassword } from '../../lib/api';

const FONTS = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  extrabold: 'Montserrat_800ExtraBold',
};

const BRAND = '#4A55DD';
const RESEND_SECONDS = 30;

function Field({ label, value, onChangeText, error, colors, secureTextEntry, right, ...inputProps }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: error ? '#D94F4F' : colors.border }]}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholderTextColor={colors.textFaint}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          {...inputProps}
        />
        {right}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// Email is already known (the signed-in user), so this skips straight to
// sending the code, then confirms that code together with the new password
// in one call — the backend no longer emails a reset link.
export default function ChangePassword({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const email = user?.email || '';

  const [step, setStep] = useState('intro'); // 'intro' -> 'confirm' -> 'done'
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const sendCode = async () => {
    if (!email) {
      Alert.alert('No Email On File', 'We could not find an email address on your account. Please contact support.');
      return;
    }
    setLoading(true);
    try {
      await forgotPassword({ email });
      setStep('confirm');
      setCountdown(RESEND_SECONDS);
    } catch (error) {
      Alert.alert('Could Not Send Code', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    const e = {};
    if (!/^\d{4,6}$/.test(otp.trim())) e.otp = 'Enter the code we emailed you';
    if (password.length < 8) e.password = 'Password must be at least 8 characters';
    else if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleConfirm = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await resetPassword({ email, otp: otp.trim(), password });
      setStep('done');
    } catch (error) {
      const isCodeError = /otp|code|invalid|expired/i.test(error.message || '');
      if (isCodeError) setErrors({ otp: error.message });
      else Alert.alert('Could Not Change Password', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card }]}
          onPress={() => (step === 'confirm' ? setStep('intro') : navigate && navigate('profile'))}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Change Password</Text>
        <View style={{ width: 38 }} />
      </View>

      {step === 'intro' ? (
        <>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.iconWrap, { backgroundColor: colors.card }]}>
              <Feather name="lock" size={28} color={BRAND} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Change Your Password</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {email
                ? `We'll send a 6-digit code to ${email}. Enter it here together with your new password.`
                : 'We could not find an email address on your account.'}
            </Text>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background }]}>
            <TouchableOpacity
              style={[styles.continueBtn, (loading || !email) && styles.continueBtnDisabled]}
              activeOpacity={0.85}
              onPress={sendCode}
              disabled={loading || !email}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.continueText}>Send Code</Text>}
            </TouchableOpacity>
          </View>
        </>
      ) : step === 'confirm' ? (
        <>
          <ScrollView contentContainerStyle={styles.scrollContent2} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[styles.subtitle, { color: colors.textMuted, marginBottom: 20 }]}>
              Enter the code sent to <Text style={{ color: colors.text, fontFamily: FONTS.semibold }}>{email}</Text>
            </Text>

            <Field
              label="Verification Code"
              value={otp}
              onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              error={errors.otp}
              colors={colors}
            />
            <Field
              label="New Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              error={errors.password}
              colors={colors}
              right={
                <TouchableOpacity onPress={() => setShowPassword((s) => !s)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color={colors.textFaint} />
                </TouchableOpacity>
              }
            />
            <Field
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter your new password"
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              error={errors.confirmPassword}
              colors={colors}
              right={
                <TouchableOpacity onPress={() => setShowConfirm((s) => !s)}>
                  <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={19} color={colors.textFaint} />
                </TouchableOpacity>
              }
            />

            <TouchableOpacity
              style={styles.resendBtn}
              onPress={() => countdown <= 0 && sendCode()}
              activeOpacity={0.8}
              disabled={countdown > 0 || loading}
            >
              <Text style={[styles.resendText, { color: countdown > 0 ? colors.textFaint : colors.brandText }]}>
                {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend Code'}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background }]}>
            <TouchableOpacity
              style={[styles.continueBtn, loading && styles.continueBtnDisabled]}
              activeOpacity={0.85}
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.continueText}>Change Password</Text>}
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.iconWrap, { backgroundColor: colors.card }]}>
              <Ionicons name="checkmark-circle-outline" size={30} color="#10B981" />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Password Changed</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Your password has been updated. Use it the next time you log in.
            </Text>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background }]}>
            <TouchableOpacity
              style={styles.continueBtn}
              activeOpacity={0.85}
              onPress={() => navigate && navigate('profile')}
            >
              <Text style={styles.continueText}>Done</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
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
  scrollContent: { paddingHorizontal: 20, paddingTop: 40, alignItems: 'center' },
  scrollContent2: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24 },

  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: { fontFamily: FONTS.bold, fontSize: 18, color: '#0B0D1A', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontFamily: FONTS.regular, fontSize: 14, color: '#6B7088', textAlign: 'center', lineHeight: 21, paddingHorizontal: 8 },

  fieldWrap: { marginTop: 14 },
  fieldLabel: { fontFamily: FONTS.medium, fontSize: 12.5, marginBottom: 6 },
  inputCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 16, height: 54, borderWidth: 1.5 },
  input: { flex: 1, fontFamily: FONTS.semibold, fontSize: 14.5 },
  errorText: { fontFamily: FONTS.regular, fontSize: 11.5, color: '#D94F4F', marginTop: 5, marginLeft: 4 },

  resendBtn: { alignItems: 'center', marginTop: 18, paddingVertical: 6 },
  resendText: { fontFamily: FONTS.semibold, fontSize: 13 },

  footer: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#F7F8FC' },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: BRAND, borderRadius: 18, height: 56, gap: 8,
    shadowColor: BRAND, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  continueBtnDisabled: { backgroundColor: '#B7BCEF', shadowOpacity: 0, elevation: 0 },
  continueText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },
});
