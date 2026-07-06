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
import * as SecureStore from 'expo-secure-store';

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

export default function VerifyScreen({ navigate, route }) {
  const userData = route?.params || {};

  const token = userData.token || null;
  const userId = userData.id || userData.userId || null;
  const phone_number = userData.phone_number || '';

  const [modalVisible, setModalVisible] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(phone_number || '');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone');
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
    if (!otp.trim()) e.otp = 'OTP code is required';
    else if (otp.trim().length < 4) e.otp = 'Enter a valid OTP';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // 1. Initial Request to Send verification OTP
  async function handleSendOTP() {
    if (!validatePhone()) return;
    
    setLoading(true);
    try {
      console.log('📤 Sending phone number validation request to:', `${BASE_URL}/phone_verification`);
      
      const res = await fetch(`${BASE_URL}/phone_verification`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          // Pass authorization token if needed by external endpoint gateway setup
          Authorization: userToken ? `Bearer ${userToken}` : '',
        },
        body: JSON.stringify({
          phone_number: phoneNumber.trim(),
        }),
      });

      const json = await res.json();
      console.log('📥 Send OTP Response Status:', res.status);
      console.log('📥 Send OTP Response JSON:', json);

      if (!res.ok || json.status === false) {
        Alert.alert('Error', json.message || 'Failed to send verification code. Please check your number.');
        return;
      }
      
      setStep('otp');
      setCountdown(60);
      setResendDisabled(true);
      Alert.alert('OTP Sent', json.message || `A verification code has been sent to ${phoneNumber.trim()}`);
      
    } catch (err) {
      console.error('❌ Send OTP Network Error:', err);
      Alert.alert('Network Error', 'Could not connect to server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  // 2. Secondary confirmation of OTP
  async function handleVerifyOTP() {
    if (!validateOTP()) return;
    
    setLoading(true);
    try {
      console.log('📤 Confirming verification OTP via:', `${BASE_URL}/confirm_phone_verification`);

      const res = await fetch(`${BASE_URL}/confirm_phone_verification`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: userToken ? `Bearer ${userToken}` : '',
        },
        body: JSON.stringify({
          phone_number: phoneNumber.trim(),
          otp_code: otp.trim(), // matches verification backend key maps
        }),
      });

      const json = await res.json();
      console.log('📥 Confirm OTP Response Status:', res.status);
      console.log('📥 Confirm OTP Response JSON:', json);

      if (!res.ok || json.status === false) {
        Alert.alert('Verification Failed', json.message || 'Invalid or expired OTP code. Please try again.');
        return;
      }
      
      // Update data record mapping layout blocks locally
      const updatedUser = {
        ...savedUserData,
        phone_verification: 1,
        phone_number: phoneNumber.trim(),
      };
      
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(updatedUser));
      
      if (userToken) {
        await SecureStore.setItemAsync(SESSION_KEY, userToken);
      }

      Alert.alert('Success', 'Phone number verified successfully!', [
        {
          text: 'Continue to Dashboard',
          onPress: () => {
            setModalVisible(false);
            navigate && navigate('home', updatedUser);
          }
        }
      ]);

    } catch (err) {
      console.error('❌ Confirm OTP Network Error:', err);
      Alert.alert('Network Error', 'Verification service unreachable. Check network status.');
    } finally {
      setLoading(false);
    }
  }

  function handleDemoFill() {
    setPhoneNumber('08168509044');
  }

  function handleDemoOTP() {
    setOtp('1234');
  }

  function handleSkip() {
    navigate && navigate('home', savedUserData);
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
          contentContainerStyle={styles.scroll}
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

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleSkip}
            activeOpacity={0.8}
          >
            <Text style={styles.skipBtnText}>Skip for now</Text>
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
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity
                    style={styles.modalCloseIcon}
                    onPress={() => {
                      if (step === 'otp') {
                        setStep('phone');
                        setOtp('');
                        setErrors({});
                      } else {
                        setModalVisible(false);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-outline" size={28} color={COLORS.text} />
                  </TouchableOpacity>
                  <Text style={styles.modalHeaderTitle}>
                    {step === 'phone' ? 'Verify Phone' : 'Enter OTP'}
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
                        name={step === 'phone' ? 'call-outline' : 'shield-checkmark-outline'} 
                        size={60} 
                        color={COLORS.primary} 
                      />
                    </View>

                    <Text style={styles.modalTitle}>
                      {step === 'phone' ? 'Add Your Phone Number' : 'Verify Your Code'}
                    </Text>
                    <Text style={styles.modalSubtitle}>
                      {step === 'phone' 
                        ? 'We\'ll send a verification code to your phone number' 
                        : `Enter the 4-digit code sent to ${phoneNumber}`}
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
                            <Text style={styles.modalBtnText}>Send Verification Code</Text>
                          )}
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <View style={styles.otpContainer}>
                          <FormInput
                            label="Enter OTP"
                            placeholder="Enter 4-digit code"
                            value={otp}
                            onChangeText={setOtp}
                            keyboardType="number-pad"
                            maxLength={6}
                            error={errors.otp}
                          />
                        </View>

                        <TouchableOpacity
                          style={styles.demoFillBtn}
                          onPress={handleDemoOTP}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.demoFillBtnText}>Use demo OTP: 1234</Text>
                        </TouchableOpacity>

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
                    )}

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
    paddingTop: 64,
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
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipBtnText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.muted,
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