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
  Modal,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useResponsive } from '../lib/responsive';
import {
  requestPhoneVerification,
  confirmPhoneVerified,
  markPhoneLinked,
  fetchNairaFundingOptions,
  generateNairaVirtualAccount,
  pickFundingOption,
  resolveGenerationBank,
  clearSignupStep,
  saveAccountSetupStatus,
} from '../lib/api';

const { width, height } = Dimensions.get('window');

// Connected production base URL path
const BASE_URL = 'https://mega-sub.com/api/v1/external';
const SESSION_KEY = 'megasub_session_token';
const USER_KEY = 'megasub_user_data';

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
  google: '#FFFFFF',
  error: '#D94F4F',
  success: '#34C759',
};

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

function FormInput({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  error,
  maxLength,
}) {
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);

  return (
    <View style={inputStyles.wrapper}>
      <Text style={inputStyles.label}>{label}</Text>
      <View
        style={[
          inputStyles.box,
          focused && inputStyles.boxFocused,
          error && inputStyles.boxError,
        ]}
      >
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
            <Ionicons
              name={shown ? 'eye-off-outline' : 'eye-outline'}
              size={19}
              color={COLORS.muted}
            />
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
  eyeBtn: { paddingLeft: 10 },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: 11.5,
    color: COLORS.error,
    marginTop: 4,
    marginLeft: 2,
  },
});

export default function VerifyScreen({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { column, dialog } = useResponsive();
  const userData = user || {};
  // A user routed back here for a missing phone (not a fresh signup) already
  // has a PIN on the backend — this step re-collects it rather than setting
  // a new one, since there's no standalone "verify my PIN" endpoint and the
  // account-generation call needs the real value in hand either way.
  const isReturningUser = !!userData.pin_set;

  const token = userData.token || null;
  const userId = userData.id || userData.userId || null;
  const phone_number = userData.phone_number || '';

  const [modalVisible, setModalVisible] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(phone_number || '');
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  // A phone number already on file (from a previous verification, echoed
  // back by /login or /dashboard) means this account cleared that step
  // already — starting back at 'phone' would force re-entry/re-OTP for
  // no reason. Only PIN is still outstanding in that case.
  const [step, setStep] = useState(phone_number ? 'pin' : 'phone');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [userToken, setUserToken] = useState(token);
  const [userIdState, setUserIdState] = useState(userId);
  const [countdown, setCountdown] = useState(0);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [savedUserData, setSavedUserData] = useState(userData || {});

  useEffect(() => {
    if (userIdState) {
      setModalVisible(true);
    }
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setResendDisabled(false);
    }
  }, [countdown]);

  function validatePhone() {
    const e = {};
    if (!phoneNumber.trim()) e.phoneNumber = 'Phone number is required';
    else if (phoneNumber.trim().length < 10) e.phoneNumber = 'Enter a valid phone number';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateOTP() {
    const e = {};
    if (!otp.trim()) e.otp = 'Verification code is required';
    else if (otp.trim().length < 4) e.otp = 'Enter the code you received';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validatePin() {
    const e = {};
    if (!pin.trim() || pin.trim().length !== 4) e.pin = 'Enter a 4-digit PIN';
    if (confirmPin.trim() !== pin.trim()) e.confirmPin = "PINs don't match";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // Shared tail of both the automatic and the manual code path. The
  // successful confirm is the only available proof — this API exposes no way
  // to read a phone number back, so there is nothing further to check.
  async function finishPhoneVerified() {
    // Top-up calls ensurePhoneOnFile before generating; without this it would
    // text the user a second code for a number just verified.
    markPhoneLinked(userIdState, phoneNumber.trim());

    const updatedUser = {
      ...savedUserData,
      phone_verification: 1,
      phone_number: phoneNumber.trim(),
    };

    setSavedUserData(updatedUser);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(updatedUser));
    // Recorded per-account (keyed by id), not just in the single-slot
    // USER_KEY — otherwise this is invisible to login.jsx/googleAuth.js the
    // next time a DIFFERENT account is signed into on this device, since
    // that overwrites USER_KEY with the other account's data.
    saveAccountSetupStatus(userIdState, { phone_number: phoneNumber.trim() });

    // Phone is linked, but the account has no transaction PIN yet — that's
    // required before any purchase can go through, so it's the next
    // mandatory step rather than a trip straight to the dashboard.
    setErrors({});
    setStep('pin');
  }

  // 1. Put the phone number on the account server-side, then ask for the
  // code Termii just texted to it.
  async function handleSendOTP() {
    if (!validatePhone()) return;

    setLoading(true);
    try {
      if (userToken) await SecureStore.setItemAsync(SESSION_KEY, userToken);

      const json = await requestPhoneVerification({
        userId: userIdState,
        phoneNumber: phoneNumber.trim(),
      });
      console.log('📤 phone_verification accepted:', JSON.stringify(json));

      // Re-verifying a known number answers "This number has already been
      // verified" with status true — there is no code left to confirm.
      const alreadyVerified = /already been verified/i.test(json.message || '');

      if (alreadyVerified) {
        await finishPhoneVerified();
        return;
      }

      setStep('otp');
      setCountdown(60);
      setResendDisabled(true);
      Alert.alert(
        'Verification Code',
        json.message || `Enter the code sent to ${phoneNumber.trim()}.`
      );
    } catch (err) {
      Alert.alert('Could Not Verify Phone', err.message || 'Please check the number and try again.');
    } finally {
      setLoading(false);
    }
  }

  // 2. Manual fallback: confirm the code the user actually received.
  async function handleVerifyOTP() {
    if (!validateOTP()) return;

    setLoading(true);
    try {
      const verified = await confirmPhoneVerified({ userId: userIdState, otp: otp.trim() });
      if (!verified) {
        setErrors({ otp: 'That code was not accepted. Please check it and try again.' });
        return;
      }
      await finishPhoneVerified();
    } catch (err) {
      Alert.alert('Verification Failed', err.message || 'The code was not accepted. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // 3. Set the transaction PIN used to authorize every purchase (airtime,
  // data, cable, electricity) — required before the dashboard is reachable.
  async function handleSetPin() {
    if (!validatePin()) return;

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/set_transaction_pin`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: userToken ? `Bearer ${userToken}` : '',
        },
        body: JSON.stringify({
          user_id: userIdState,
          pin: pin.trim(),
          confirm_pin: confirmPin.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok || json.status === false) {
        Alert.alert('Could Not Set PIN', json.message || 'Please try again.');
        return;
      }

      const updatedUser = { ...savedUserData, pin_set: true };
      setSavedUserData(updatedUser);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(updatedUser));
      // Same per-account reasoning as finishPhoneVerified() above — this
      // must survive a later switch to a different account on this device.
      saveAccountSetupStatus(userIdState, { pin_set: true });
      // Onboarding is genuinely complete now — a resumed session should go
      // straight to Home from here on, not back through this flow.
      await clearSignupStep();

      // The PIN the generate call needs only exists at this exact point in
      // the app — at login there is nothing but an email and a password — so
      // this is the app's one chance to have the account ready before the
      // user ever opens Top-up. Fired without awaiting: the user is not held
      // on this screen if the provider is slow or failing, and the backend
      // creates the account at login anyway if this doesn't land.
      createFundingAccount();

      setModalVisible(false);
      navigate && navigate('home', updatedUser);
    } catch (err) {
      Alert.alert('Network Error', 'Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  // 4. Create the funding account while the PIN is still in hand: pick Secure
  // Wave out of the funding options and generate on Kolomoni (bank code 1).
  //
  // Deliberately best effort and never awaited. Nothing here is required for
  // the user to reach the dashboard — if it fails, the backend creates the
  // account at login, and Top-up generates on demand as a last resort. The
  // phone was verified moments ago in this same flow, so it is NOT re-sent
  // here: that would text the user a second code for no reason.
  async function createFundingAccount() {
    try {
      const optJson = await fetchNairaFundingOptions(userIdState);
      const option = pickFundingOption(optJson.data || []);
      if (!option) {
        console.log('⚠️ No funding provider available at signup.');
        return;
      }

      const bank = resolveGenerationBank(option);
      console.log('🏦 Generating on', option.funding_option_name, JSON.stringify(bank));

      await generateNairaVirtualAccount({
        user_id: userIdState,
        bank_code: bank.code,
        pin: pin.trim(),
        funding_option_id: option.id,
      });
      console.log('✅ Funding account created at signup.');
    } catch (err) {
      // "already have an account generated" means the backend beat us to it.
      if (/already have an account/i.test(err.message || '')) {
        console.log('✅ Funding account already exists.');
        return;
      }
      console.log('⚠️ Not created at signup, leaving it to login/Top-up:', err.message);
    }
  }

  function handleDemoFill() {
    setPhoneNumber('08168509044');
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24 }, column]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoWrap}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.heading}>Phone Verification</Text>
          <Text style={styles.subheading}>
            Please verify your phone number to continue
          </Text>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={24} color={COLORS.primary} />
            <Text style={styles.infoText}>
              You need to verify your phone number before accessing the dashboard.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.verifyBtn}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="call-outline" size={22} color={COLORS.white} />
            <Text style={styles.verifyBtnText}>Verify Phone Number</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.modalContainer, dialog]}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity
                    style={styles.modalCloseIcon}
                    onPress={() => {
                      if (step === 'otp') {
                        setStep('phone');
                        setOtp('');
                        setErrors({});
                      } else if (step === 'phone') {
                        setModalVisible(false);
                      }
                      // No way to close out of 'pin' — a transaction PIN is
                      // mandatory before Home.
                    }}
                    activeOpacity={0.7}
                  >
                    {step !== 'pin' && (
                      <Ionicons name="close-outline" size={28} color={COLORS.text} />
                    )}
                  </TouchableOpacity>
                  <Text style={styles.modalHeaderTitle}>
                    {step === 'phone'
                      ? 'Verify Phone'
                      : step === 'otp'
                      ? 'Enter OTP'
                      : (isReturningUser ? 'Confirm Transaction PIN' : 'Set Transaction PIN')}
                  </Text>
                  <View style={{ width: 28 }} />
                </View>

                <ScrollView
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.modalBody}>
                    <View style={styles.modalIconContainer}>
                      <Ionicons
                        name={
                          step === 'phone'
                            ? 'call-outline'
                            : step === 'otp'
                            ? 'shield-checkmark-outline'
                            : 'lock-closed-outline'
                        }
                        size={60}
                        color={COLORS.primary}
                      />
                    </View>

                    <Text style={styles.modalTitle}>
                      {step === 'phone'
                        ? 'Add Your Phone Number'
                        : step === 'otp'
                        ? 'Verify Your Code'
                        : (isReturningUser ? 'Confirm Your Transaction PIN' : 'Set Your Transaction PIN')}
                    </Text>
                    <Text style={styles.modalSubtitle}>
                      {step === 'phone'
                        ? 'Your number is registered with Megasub — it\'s required before your funding account can be created.'
                        : step === 'otp'
                        ? `Enter the verification code to confirm ${phoneNumber}`
                        : (isReturningUser
                            ? 'Enter your existing 4-digit transaction PIN to continue.'
                            : 'Choose a 4-digit PIN. You\'ll use it to authorize every purchase, and to open Top-up.')}
                    </Text>

                    {step === 'phone' ? (
                      <>
                        <FormInput
                          label="Phone Number"
                          placeholder="08123456789"
                          value={phoneNumber}
                          onChangeText={setPhoneNumber}
                          keyboardType="phone-pad"
                          maxLength={11}
                          error={errors.phoneNumber}
                        />

                        <TouchableOpacity
                          style={styles.demoFillBtn}
                          onPress={handleDemoFill}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.demoFillBtnText}>Use demo number: 08168509044</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.modalBtn, loading && styles.modalBtnDisabled]}
                          onPress={handleSendOTP}
                          activeOpacity={0.85}
                          disabled={loading}
                        >
                          {loading ? (
                            <ActivityIndicator color={COLORS.white} size="small" />
                          ) : (
                            <Text style={styles.modalBtnText}>Verify Phone & Continue</Text>
                          )}
                        </TouchableOpacity>
                      </>
                    ) : step === 'otp' ? (
                      <>
                        <View style={styles.otpContainer}>
                          <FormInput
                            label="Enter Verification Code"
                            placeholder="Enter the code you received"
                            value={otp}
                            onChangeText={setOtp}
                            keyboardType="number-pad"
                            maxLength={6}
                            error={errors.otp}
                          />
                        </View>

                        <TouchableOpacity
                          style={[styles.modalBtn, loading && styles.modalBtnDisabled]}
                          onPress={handleVerifyOTP}
                          activeOpacity={0.85}
                          disabled={loading}
                        >
                          {loading ? (
                            <ActivityIndicator color={COLORS.white} size="small" />
                          ) : (
                            <Text style={styles.modalBtnText}>Verify Code</Text>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.resendBtn}
                          onPress={() => {
                            if (!resendDisabled) {
                              handleSendOTP();
                            }
                          }}
                          activeOpacity={0.8}
                          disabled={resendDisabled}
                        >
                          <Text style={[styles.resendBtnText, resendDisabled && styles.resendBtnDisabled]}>
                            {resendDisabled ? `Resend OTP in ${countdown}s` : 'Resend Code'}
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : step === 'pin' ? (
                      <>
                        <FormInput
                          label={isReturningUser ? 'Your 4-Digit PIN' : '4-Digit PIN'}
                          placeholder="••••"
                          value={pin}
                          onChangeText={setPin}
                          keyboardType="number-pad"
                          secureTextEntry
                          maxLength={4}
                          error={errors.pin}
                        />
                        <FormInput
                          label="Confirm PIN"
                          placeholder="••••"
                          value={confirmPin}
                          onChangeText={setConfirmPin}
                          keyboardType="number-pad"
                          secureTextEntry
                          maxLength={4}
                          error={errors.confirmPin}
                        />

                        <TouchableOpacity
                          style={[styles.modalBtn, loading && styles.modalBtnDisabled]}
                          onPress={handleSetPin}
                          activeOpacity={0.85}
                          disabled={loading}
                        >
                          {loading ? (
                            <ActivityIndicator color={COLORS.white} size="small" />
                          ) : (
                            <Text style={styles.modalBtnText}>
                              {isReturningUser ? 'Confirm & Continue' : 'Save PIN & Continue'}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </>
                    ) : null}

                    {step !== 'pin' && (
                    <TouchableOpacity
                      style={styles.modalBackBtn}
                      onPress={() => {
                        if (step === 'otp') {
                          setStep('phone');
                          setOtp('');
                          setErrors({});
                        } else {
                          setModalVisible(false);
                          navigate && navigate('login');
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.modalBackText}>
                        {step === 'otp' ? '← Change Phone Number' : 'Cancel'}
                      </Text>
                    </TouchableOpacity>
                    )}
                  </View>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    paddingHorizontal: 24,
    flexGrow: 1,
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
    fontWeight: '600',
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
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F1FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 28,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 20,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 10,
    marginBottom: 16,
  },
  verifyBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 28,
    width: width * 0.92,
    maxHeight: height * 0.85,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalCloseIcon: {
    padding: 4,
  },
  modalHeaderTitle: {
    fontFamily: FONTS.semibold,
    fontSize: 16,
    color: COLORS.text,
  },
  modalScrollContent: {
    flexGrow: 1,
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  modalIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  modalBtnDisabled: {
    opacity: 0.6,
  },
  modalBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.white,
  },
  modalBackBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  modalBackText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.muted,
  },
  demoFillBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  demoFillBtnText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.primary,
  },
  resendBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  resendBtnText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.primary,
  },
  resendBtnDisabled: {
    color: COLORS.muted,
  },
  otpContainer: {
    marginBottom: 4,
  },
});
