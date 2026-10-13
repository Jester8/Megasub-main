import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '../lib/responsive';
import { forgotPassword, resetPassword } from '../lib/api';

const COLORS = {
  primary: '#4A55DD',
  primaryDark: '#3340B8',
  bg: '#FFFFFF',
  border: '#E2E4ED',
  borderFocus: '#4A55DD',
  white: '#FFFFFF',
  text: '#0B0D1A',
  muted: 'rgba(11,13,26,0.45)',
  label: 'rgba(11,13,26,0.7)',
  inputBg: '#F5F6FA',
  error: '#D94F4F',
};

const FONTS = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  extrabold: 'Montserrat_800ExtraBold',
};

const RESEND_SECONDS = 30;

function FormInput({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  maxLength,
  error,
}) {
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);

  return (
    <View style={inputStyles.wrapper}>
      <Text style={inputStyles.label}>{label}</Text>
      <View style={[inputStyles.box, focused && inputStyles.boxFocused, error && inputStyles.boxError]}>
        <TextInput
          style={inputStyles.input}
          placeholder={placeholder}
          placeholderTextColor={COLORS.muted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !shown}
          keyboardType={keyboardType || 'default'}
          autoCapitalize={autoCapitalize || 'none'}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShown(!shown)} style={inputStyles.eyeBtn}>
            <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={19} color={COLORS.muted} />
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={inputStyles.errorText}>{error}</Text> : null}
    </View>
  );
}

const inputStyles = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.label,
    marginBottom: 6,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
  },
  boxFocused: {
    borderColor: COLORS.borderFocus,
    backgroundColor: '#EEF0FB',
  },
  boxError: {
    borderColor: COLORS.error,
    backgroundColor: '#FFF5F5',
  },
  input: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.text,
    height: '100%',
  },
  eyeBtn: { padding: 4 },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: 11.5,
    color: COLORS.error,
    marginTop: 4,
    marginLeft: 2,
  },
});

// Two steps: request a code by email, then confirm that code together with
// the new password in one call. The backend no longer emails a reset link.
export default function ResetPasswordScreen({ navigate }) {
  const insets = useSafeAreaInsets();
  const { column } = useResponsive();

  const [step, setStep] = useState('request'); // 'request' -> 'confirm' -> 'done'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  function validateEmail() {
    const e = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateConfirm() {
    const e = {};
    if (!/^\d{4,6}$/.test(otp.trim())) e.otp = 'Enter the code we emailed you';
    if (password.length < 8) e.password = 'Password must be at least 8 characters';
    else if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function sendCode() {
    if (!validateEmail()) return;
    setLoading(true);
    try {
      await forgotPassword({ email: email.trim().toLowerCase() });
      setStep('confirm');
      setCountdown(RESEND_SECONDS);
    } catch (error) {
      Alert.alert('Could Not Send Code', error.message || 'Please check the email and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!validateConfirm()) return;
    setLoading(true);
    try {
      await resetPassword({ email: email.trim().toLowerCase(), otp: otp.trim(), password });
      setStep('done');
    } catch (error) {
      // A wrong or expired code is the most likely rejection here.
      const isCodeError = /otp|code|invalid|expired/i.test(error.message || '');
      if (isCodeError) setErrors({ otp: error.message });
      else Alert.alert('Could Not Reset Password', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24 }, column]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => (step === 'confirm' ? setStep('request') : navigate && navigate('login'))}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </TouchableOpacity>

          <View style={styles.logoWrap}>
            <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          </View>

          {step === 'request' ? (
            <>
              <Text style={styles.heading}>Reset your password</Text>
              <Text style={styles.subheading}>
                Enter the email linked to your account and we'll send you a 6-digit code to reset your password.
              </Text>

              <FormInput
                label="Email Address"
                placeholder="john@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                error={errors.email}
              />

              <TouchableOpacity
                style={[styles.sendBtn, (!email || loading) && styles.sendBtnDisabled]}
                onPress={sendCode}
                activeOpacity={email && !loading ? 0.85 : 1}
                disabled={loading || !email}
              >
                {loading ? <ActivityIndicator color={COLORS.white} size="small" /> : (
                  <Text style={styles.sendBtnText}>Send Code</Text>
                )}
              </TouchableOpacity>
            </>
          ) : step === 'confirm' ? (
            <>
              <Text style={styles.heading}>Enter the code</Text>
              <Text style={styles.subheading}>
                We sent a 6-digit code to{'\n'}
                <Text style={styles.emailHighlight}>{email}</Text>
              </Text>

              <FormInput
                label="Verification Code"
                placeholder="123456"
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                error={errors.otp}
              />
              <FormInput
                label="New Password"
                placeholder="At least 8 characters"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                error={errors.password}
              />
              <FormInput
                label="Confirm New Password"
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                error={errors.confirmPassword}
              />

              <TouchableOpacity
                style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
                onPress={handleConfirm}
                activeOpacity={loading ? 1 : 0.85}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color={COLORS.white} size="small" /> : (
                  <Text style={styles.sendBtnText}>Reset Password</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendBtn}
                onPress={() => countdown <= 0 && sendCode()}
                activeOpacity={0.8}
                disabled={countdown > 0 || loading}
              >
                <Text style={[styles.resendBtnText, countdown > 0 && styles.resendBtnDisabled]}>
                  {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend Code'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.successWrap}>
              <View style={styles.successIconBox}>
                <Ionicons name="checkmark-circle-outline" size={34} color={COLORS.primary} />
              </View>

              <Text style={styles.heading}>Password reset</Text>
              <Text style={styles.subheading}>Your password has been changed. Log in with your new password.</Text>

              <TouchableOpacity
                style={styles.backBtn2}
                onPress={() => navigate && navigate('login')}
                activeOpacity={0.85}
              >
                <Ionicons name="arrow-back" size={16} color={COLORS.white} />
                <Text style={styles.backBtn2Text}>Back to log in</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'request' && (
            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Remembered your password? </Text>
              <TouchableOpacity onPress={() => navigate && navigate('login')}>
                <Text style={styles.loginLink}>Log in</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    overflow: 'hidden',
  },
  scroll: {
    paddingHorizontal: 24,
  },
  glowTop: {
    position: 'absolute',
    top: -120,
    left: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#4A55DD',
    opacity: 0.16,
    shadowColor: '#4A55DD',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 100,
    elevation: 0,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -140,
    right: -100,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: '#4A55DD',
    opacity: 0.13,
    shadowColor: '#4A55DD',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 110,
    elevation: 0,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 110,
    height: 44,
  },
  heading: {
    fontFamily: FONTS.bold,
    fontSize: 27,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subheading: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  sendBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 8,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.white,
  },
  resendBtn: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 6,
  },
  resendBtnText: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: COLORS.primary,
  },
  resendBtnDisabled: {
    color: COLORS.muted,
  },
  successWrap: {
    alignItems: 'center',
  },
  successIconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#EEF0FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emailHighlight: {
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
  },
  backBtn2: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 12,
  },
  backBtn2Text: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.white,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  loginText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.muted,
  },
  loginLink: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
  },
});
