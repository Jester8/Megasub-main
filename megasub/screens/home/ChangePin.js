import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { forgotPin, resetPin } from '../../lib/api';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const BRAND = '#4A55DD';

// Per-digit box input shared by the OTP (length 6) and PIN (length 4)
// fields below — same auto-advance-forward/backward behavior as every other
// PIN/OTP input in the app.
function CodeInput({ length, value, onChange, colors, secure }) {
  const inputs = useRef([]);

  const handleChangeText = (text, index) => {
    const digits = value.split('');
    while (digits.length < length) digits.push('');
    const cleanText = text.slice(-1);
    digits[index] = cleanText;
    const next = digits.join('').slice(0, length);
    onChange(next);

    if (cleanText && index < length - 1) {
      inputs.current[index + 1]?.focus();
    } else if (!cleanText && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !value[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={[styles.codeRow, length > 4 && styles.codeRowSix]}>
      {Array.from({ length }).map((_, index) => (
        <TextInput
          key={index}
          ref={(ref) => (inputs.current[index] = ref)}
          style={[
            styles.codeBox,
            length > 4 && styles.codeBoxSmall,
            { borderColor: colors.border, color: colors.text, backgroundColor: colors.card },
            value[index] ? styles.codeBoxFilled : null,
          ]}
          keyboardType="number-pad"
          maxLength={1}
          secureTextEntry={secure}
          value={value[index] || ''}
          onChangeText={(text) => handleChangeText(text, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          textAlign="center"
        />
      ))}
    </View>
  );
}

// PIN recovery is its own OTP flow, separate from password reset (its own
// "Reset PIN" email) — forgot_pin sends the code, reset_pin confirms it and
// sets the new PIN in one call. Two steps: request the code, then enter it
// alongside the new PIN.
export default function ChangePin({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [step, setStep] = useState('request'); // 'request' | 'reset'
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const email = user?.email || '';

  const pinsMatch = pin.length === 4 && pin === confirmPin;

  const handleSendCode = async () => {
    if (!email) {
      Alert.alert('No Email On File', 'We could not find an email address on your account. Please contact support.');
      return;
    }

    setLoading(true);
    try {
      await forgotPin({ email });
      setStep('reset');
    } catch (error) {
      Alert.alert('Could Not Send Code', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPin = async () => {
    if (otp.length !== 6) {
      Alert.alert('Enter the Code', 'Enter the 6-digit code sent to your email.');
      return;
    }
    if (!pinsMatch) {
      Alert.alert('PINs Don’t Match', 'Your new PIN and confirmation must match.');
      return;
    }

    setLoading(true);
    try {
      await resetPin({ email, otp, pin });
      Alert.alert('PIN Updated', 'Your transaction PIN has been changed.');
      navigate && navigate('profile');
    } catch (error) {
      Alert.alert('Could Not Reset PIN', error.message || 'That code may be wrong or expired. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card }]}
          onPress={() => (step === 'reset' ? setStep('request') : navigate && navigate('profile'))}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Change Transaction PIN</Text>
        <View style={{ width: 38 }} />
      </View>

      {step === 'request' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.iconWrap, { backgroundColor: colors.card }]}>
            <Feather name="lock" size={28} color={BRAND} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Reset Your PIN</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {email
              ? `We'll email a 6-digit code to ${email} to confirm it's you before setting a new PIN.`
              : 'We could not find an email address on your account.'}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Enter the 6-digit code sent to {email}</Text>
          <CodeInput length={6} value={otp} onChange={setOtp} colors={colors} />

          <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 28 }]}>New PIN</Text>
          <CodeInput length={4} value={pin} onChange={setPin} colors={colors} secure />

          <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 22 }]}>Confirm New PIN</Text>
          <CodeInput length={4} value={confirmPin} onChange={setConfirmPin} colors={colors} secure />

          {confirmPin.length === 4 && !pinsMatch ? (
            <Text style={styles.errorText}>New PIN and confirmation don't match</Text>
          ) : null}

          <TouchableOpacity style={styles.resendBtn} onPress={handleSendCode} activeOpacity={0.8} disabled={loading}>
            <Text style={styles.resendText}>Resend Code</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background }]}>
        {step === 'request' ? (
          <TouchableOpacity
            style={[styles.continueBtn, (loading || !email) && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleSendCode}
            disabled={loading || !email}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.continueText}>Send Code</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.continueBtn, (loading || otp.length !== 6 || !pinsMatch) && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleResetPin}
            disabled={loading || otp.length !== 6 || !pinsMatch}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.continueText}>Reset PIN</Text>}
          </TouchableOpacity>
        )}
      </View>
    </View>
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
  scrollContent: { paddingHorizontal: 20, paddingTop: 40, alignItems: 'center', paddingBottom: 30 },

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

  sectionLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: '#6B7088', textAlign: 'center', marginBottom: 14 },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', width: '80%', alignSelf: 'center', gap: 12 },
  codeRowSix: { width: '95%', gap: 8 },
  codeBox: { width: 50, height: 50, borderWidth: 2, borderColor: '#ECEDF6', borderRadius: 12, fontSize: 20, fontWeight: '700', color: '#0B0D1A', backgroundColor: '#FFFFFF' },
  codeBoxSmall: { width: 40, height: 46, fontSize: 18 },
  codeBoxFilled: { borderColor: BRAND },

  errorText: { fontFamily: FONTS.medium, fontSize: 12.5, color: '#EF4444', textAlign: 'center', marginTop: 12 },

  resendBtn: { alignItems: 'center', marginTop: 18 },
  resendText: { fontFamily: FONTS.semibold, fontSize: 13.5, color: BRAND },

  footer: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#F7F8FC' },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: BRAND, borderRadius: 18, height: 56, gap: 8,
    shadowColor: BRAND, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  continueBtnDisabled: { backgroundColor: '#B7BCEF', shadowOpacity: 0, elevation: 0 },
  continueText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },
});
