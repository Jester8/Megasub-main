import React, { useRef, useState } from 'react';
import {
  View,
  Text,
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
import { requestEmailVerification, confirmEmailVerification, setSignupStep } from '../lib/api';

const COLORS = {
  primary: '#4A55DD',
  bg: '#FFFFFF',
  border: '#E2E4ED',
  text: '#0B0D1A',
  muted: 'rgba(11,13,26,0.45)',
};

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

// Required onboarding step (per the updated API): register() auto-sends a
// 6-digit email OTP and creates the account as unverified — this confirms
// it before the user can proceed to phone verification / PIN setup. Runs
// between signup.jsx's handleSignup success and the existing verify.jsx step.
export default function EmailVerify({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const inputs = useRef([]);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const userId = user?.id;
  const email = user?.email || '';
  const otp = code.join('');

  function handleChangeText(text, index) {
    const next = [...code];
    const cleanText = text.slice(-1);
    next[index] = cleanText;
    setCode(next);

    if (cleanText && index < 5) {
      inputs.current[index + 1]?.focus();
    } else if (!cleanText && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  function handleKeyPress(e, index) {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  async function handleConfirm() {
    if (otp.length !== 6) {
      Alert.alert('Enter the Code', 'Enter the 6-digit code sent to your email.');
      return;
    }

    setLoading(true);
    try {
      await confirmEmailVerification({ userId, otp });
      // Email confirmed — a resume after this point should land on phone
      // verification/PIN setup, not back at email entry.
      await setSignupStep('verify');
      navigate && navigate('verify', user);
    } catch (error) {
      Alert.alert('Verification Failed', error.message || 'That code was not accepted. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await requestEmailVerification({ userId });
      Alert.alert('Code Sent', `A new code was sent to ${email}.`);
    } catch (error) {
      Alert.alert('Could Not Resend Code', error.message || 'Please try again.');
    } finally {
      setResending(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.iconWrap}>
            <Ionicons name="mail-outline" size={44} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Verify Your Email</Text>
          <Text style={styles.subtitle}>
            {email
              ? `Enter the 6-digit code we sent to ${email}.`
              : 'Enter the 6-digit code we sent to your email.'}
          </Text>

          <View style={styles.codeRow}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputs.current[index] = ref)}
                style={[styles.codeBox, digit ? styles.codeBoxFilled : null]}
                keyboardType="number-pad"
                maxLength={1}
                value={digit}
                onChangeText={(text) => handleChangeText(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                textAlign="center"
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.verifyBtn, (loading || otp.length !== 6) && styles.verifyBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleConfirm}
            disabled={loading || otp.length !== 6}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.verifyBtnText}>Verify Email</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.resendBtn} activeOpacity={0.8} onPress={handleResend} disabled={resending}>
            <Text style={styles.resendText}>{resending ? 'Sending…' : 'Resend Code'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 24, alignItems: 'center', flexGrow: 1 },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#F0F1FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { fontFamily: FONTS.bold, fontSize: 24, color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 8, marginBottom: 32 },
  codeBox: {
    flex: 1,
    height: 54,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    backgroundColor: '#F5F6FA',
  },
  codeBoxFilled: { borderColor: COLORS.primary, backgroundColor: '#EEF0FB' },
  verifyBtn: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  verifyBtnDisabled: { opacity: 0.6 },
  verifyBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },
  resendBtn: { paddingVertical: 8 },
  resendText: { fontFamily: FONTS.semibold, fontSize: 14, color: COLORS.primary },
});
