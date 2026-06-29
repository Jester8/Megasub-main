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
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

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
};

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

// ─── Reusable Input ───────────────────────────────────────────────
function FormInput({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
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

// ─── Main Login Screen ─────────────────────────────────────────────
export default function LoginScreen({ navigate }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bioBusy, setBioBusy] = useState(false);
  const [hasSavedSession, setHasSavedSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    // ✅ Only check if session exists for biometric login, but DO NOT auto-login
    checkSavedSession();
  }, []);

  async function checkSavedSession() {
    try {
      const token = await SecureStore.getItemAsync(SESSION_KEY);
      setHasSavedSession(!!token);
      
      // ✅ Just check if session exists, but do NOT auto-navigate
      if (token) {
        const userData = await SecureStore.getItemAsync(USER_KEY);
        if (userData) {
          try {
            const user = JSON.parse(userData);
            console.log('✅ Session found for biometric login:', user.first_name);
            // ✅ Don't auto-login - just show fingerprint option
          } catch (e) {
            console.log('Error parsing user data:', e);
          }
        }
      }
    } catch (err) {
      console.log('Error checking saved session:', err);
      setHasSavedSession(false);
    }
  }

  // ✅ NEW: Fetch full user profile
  async function fetchUserProfile(userId, token) {
    try {
      console.log('📤 Fetching user profile for:', userId);
      const res = await fetch(`${BASE_URL}/user/profile?user_id=${userId}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      
      const json = await res.json();
      console.log('📥 User profile response:', JSON.stringify(json, null, 2));
      
      if (json.status && json.data) {
        return json.data;
      }
      return null;
    } catch (err) {
      console.error('Error fetching user profile:', err);
      return null;
    }
  }

  async function handleLogin() {
    // Validate inputs
    const e = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      console.log('📤 Sending login request:', { email, password });

      const res = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          device_name: Platform.OS === 'ios' ? 'iOS Device' : 'Android Device',
        }),
      });

      const json = await res.json();
      console.log('📥 Full API Response:', JSON.stringify(json, null, 2));

      // Handle validation errors (422 status code)
      if (res.status === 422 && json.errors) {
        const errorMessages = [];
        Object.keys(json.errors).forEach((field) => {
          const messages = json.errors[field];
          if (Array.isArray(messages)) {
            errorMessages.push(`${field}: ${messages.join(', ')}`);
          } else {
            errorMessages.push(`${field}: ${messages}`);
          }
        });
        const errorMessage = errorMessages.join('\n');
        Alert.alert('Validation Error', errorMessage);
        return;
      }

      // Check for API errors
      if (!res.ok) {
        Alert.alert('Login Failed', json.message || 'Invalid credentials. Please try again.');
        return;
      }

      // Check if status is explicitly false
      if (json.status === false) {
        Alert.alert('Login Failed', json.message || 'Invalid credentials. Please try again.');
        return;
      }

      // ✅ Extract token and user ID from login response
      const token = json.data?.token || json.access?.token;
      const userId = json.data?.user; // This is the user ID string

      console.log('🔑 Extracted token:', token ? '✅ Present' : '❌ Missing');
      console.log('🆔 Extracted user ID:', userId);

      if (!token || !userId) {
        console.error('❌ Missing token or user ID in response:', json);
        Alert.alert('Error', 'Unexpected response from server. Please try again.');
        return;
      }

      // ✅ Fetch full user profile using the token and user ID
      console.log('📤 Fetching full user profile...');
      const userProfile = await fetchUserProfile(userId, token);

      if (!userProfile) {
        console.error('❌ Failed to fetch user profile');
        Alert.alert('Error', 'Could not fetch user profile. Please try again.');
        return;
      }

      // ✅ Combine user ID with profile data
      const userData = {
        id: userId,
        ...userProfile,
        phone_verification: userProfile.phone_verification || 0,
        phone_number: userProfile.phone_number || '',
        first_name: userProfile.first_name || userProfile.name || 'User',
        last_name: userProfile.last_name || '',
        email: userProfile.email || email,
        username: userProfile.username || '',
      };

      console.log('📦 Final user data:', JSON.stringify(userData, null, 2));
      console.log('👤 User first_name:', userData.first_name);
      console.log('👤 User last_name:', userData.last_name);
      console.log('👤 User email:', userData.email);
      console.log('👤 User ID:', userData.id);
      console.log('📱 Phone verification:', userData.phone_verification);

      // ✅ Save complete user data to SecureStore
      await SecureStore.setItemAsync(SESSION_KEY, token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(userData));
      setHasSavedSession(true);

      // ✅ Verify the data was saved correctly
      const savedUser = await SecureStore.getItemAsync(USER_KEY);
      console.log('💾 Verified saved user data:', savedUser);
      if (savedUser) {
        const parsedSavedUser = JSON.parse(savedUser);
        console.log('💾 Saved first_name:', parsedSavedUser.first_name);
      }

      // ✅ CHECK: Is phone number verified?
      const isPhoneVerified = userData.phone_verification === 1;

      console.log('📱 Phone verification status:', {
        phone_verification: userData.phone_verification,
        phone_number: userData.phone_number,
        isPhoneVerified
      });

      if (!isPhoneVerified) {
        console.log('📱 Phone not verified, redirecting to verification...');
        Alert.alert(
          'Phone Verification Required',
          'Please verify your phone number to continue.',
          [
            {
              text: 'Verify Now',
              onPress: () => {
                navigate && navigate('verify', userData);
              }
            },
            {
              text: 'Skip',
              onPress: () => {
                console.log('⏭️ Skipping verification, going to home with:', userData);
                navigate && navigate('home', userData);
              }
            }
          ]
        );
        return;
      }

      // Phone is verified - proceed to home
      console.log('✅ Login successful! Navigating to home with user:', userData);
      console.log('👤 First name being passed to home:', userData.first_name);
      navigate && navigate('home', userData);
      
    } catch (err) {
      console.error('❌ Network Error:', err);
      Alert.alert('Network Error', 'Could not connect to the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleGoogle() {
    console.log('Google sign in');
    const mockUser = { 
      first_name: 'Google User', 
      email: 'user@gmail.com',
      id: 'google_user_id'
    };
    navigate && navigate('home', mockUser);
  }

  async function handleFingerprintLogin() {
    try {
      setBioBusy(true);

      const savedToken = await SecureStore.getItemAsync(SESSION_KEY);
      if (!savedToken) {
        Alert.alert('Not Set Up', 'Please log in with email first to enable fingerprint login.');
        return;
      }

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Alert.alert('Not Available', 'Biometrics are not available on this device.');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Log in to Megasub',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        console.log('Biometric login success, restoring session');
        const userData = await SecureStore.getItemAsync(USER_KEY);
        if (userData) {
          try {
            const user = JSON.parse(userData);
            
            // ✅ Check if phone is verified
            const isPhoneVerified = user.phone_verification === 1;
            
            if (!isPhoneVerified) {
              Alert.alert(
                'Phone Verification Required',
                'Please verify your phone number to continue.',
                [
                  {
                    text: 'Verify Now',
                    onPress: () => {
                      navigate && navigate('verify', user);
                    }
                  },
                  {
                    text: 'Skip',
                    onPress: () => {
                      navigate && navigate('home', user);
                    }
                  }
                ]
              );
              return;
            }
            
            navigate && navigate('home', user);
          } catch (e) {
            console.log('Error parsing user data');
            navigate && navigate('home', { first_name: 'Returning User' });
          }
        } else {
          navigate && navigate('home', { first_name: 'Returning User' });
        }
      } else {
        console.log('Biometric login failed or cancelled:', result.error);
      }
    } catch (err) {
      console.error('Biometric error:', err);
      Alert.alert('Error', 'An error occurred during biometric verification.');
    } finally {
      setBioBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Soft background glow */}
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
          {/* Logo */}
          <View style={styles.logoWrap}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Heading */}
          <Text style={styles.heading}>Welcome back to Megasub</Text>
          <Text style={styles.subheading}>
            Log in to continue where you left off
          </Text>

          {/* Google button */}
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogle}
            activeOpacity={0.8}
          >
            <View style={styles.googleIconWrap}>
              <Image
                source={require('../assets/google.png')}
                style={styles.googleIconImg}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.googleText}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or log in with email</Text>
            <View style={styles.dividerLine} />
          </View>

          <FormInput
            label="Email Address"
            placeholder="john@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            error={errors.email}
          />

          <FormInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
            error={errors.password}
          />

          {/* Forgot password */}
          <TouchableOpacity
            style={styles.forgotRow}
            onPress={() => navigate && navigate('reset')}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Login button */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={styles.loginBtnText}>Log In</Text>
            )}
          </TouchableOpacity>

          {/* Fingerprint login — greyed out until a session has been saved */}
          <TouchableOpacity
            style={[
              styles.fingerprintBtn,
              !hasSavedSession && styles.fingerprintBtnDisabled,
            ]}
            onPress={handleFingerprintLogin}
            activeOpacity={0.8}
            disabled={bioBusy || !hasSavedSession}
          >
            <Ionicons
              name="finger-print-outline"
              size={20}
              color={hasSavedSession ? COLORS.primary : COLORS.muted}
            />
            <Text
              style={[
                styles.fingerprintText,
                !hasSavedSession && styles.fingerprintTextDisabled,
              ]}
            >
              {bioBusy ? 'Verifying...' : 'Use your fingerprint'}
            </Text>
          </TouchableOpacity>

          {/* Signup link */}
          <View style={styles.signupRow}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigate && navigate('signup')}>
              <Text style={styles.signupLink}>Create one here</Text>
            </TouchableOpacity>
          </View>

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
    paddingTop: 64,
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
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.google,
    borderWidth: 0.2,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 24,
    gap: 10,
  },
  googleIconWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconImg: {
    width: 22,
    height: 22,
  },
  googleText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: COLORS.text,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.muted,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginBottom: 24,
    marginTop: -2,
  },
  forgotText: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: COLORS.primary,
  },
  loginBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.white,
  },
  fingerprintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 20,
  },
  fingerprintText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: COLORS.primary,
  },
  fingerprintBtnDisabled: {
    opacity: 0.7,
  },
  fingerprintTextDisabled: {
    color: COLORS.muted,
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.muted,
  },
  signupLink: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
  },
});