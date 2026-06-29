import React, { useState } from 'react';
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
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'https://mega-sub.com/api/v1/external';
const USER_KEY = 'megasub_user_data';
const SESSION_KEY = 'megasub_session_token';

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

export default function SignupScreen({ navigate }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referral, setReferral] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    if (!firstName.trim()) e.firstName = 'First name is required';
    if (!lastName.trim()) e.lastName = 'Last name is required';
    if (!username.trim()) e.username = 'Username is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Password must be at least 8 characters';
    if (!agreed) e.agreed = 'You must agree to the Terms and Conditions';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSignup() {
    if (!validate()) return;
    setLoading(true);
    try {
      const requestBody = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
        tnc: 1,
      };

      // Only add referral if provided
      if (referral.trim()) {
        requestBody.upline_referral_phone_number = referral.trim();
      }

      console.log('📤 Sending registration request:', requestBody);

      const res = await fetch(`${BASE_URL}/register`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const json = await res.json();
      console.log('📥 Full API Response:', JSON.stringify(json, null, 2));
      console.log('📥 Response status code:', res.status);
      console.log('📥 Response status field:', json.status);

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
        console.log('❌ Validation errors:', errorMessages);
        return;
      }

      // Check for other API errors (non-200 status)
      if (!res.ok) {
        Alert.alert('Registration Failed', json.message || 'Registration failed. Please try again.');
        console.log('❌ API Error:', json);
        return;
      }

      // Check if status is explicitly false
      if (json.status === false) {
        if (json.errors) {
          const errorMessages = Object.values(json.errors).flat().join('\n');
          Alert.alert('Registration Failed', errorMessages);
        } else {
          Alert.alert('Registration Failed', json.message || 'Registration failed. Please try again.');
        }
        return;
      }

      // Extract token and user data
      const token = json.access?.token || json.data?.access?.token || json.data?.token;
      const userDataFromApi = json.data;

      console.log('🔑 Extracted token:', token ? '✅ Present' : '❌ Missing');
      console.log('🆔 Extracted user ID:', userDataFromApi?.id || '❌ Missing');
      console.log('👤 User data from API:', userDataFromApi);

      if (!token || !userDataFromApi) {
        console.error('❌ Missing token or user data in response:', json);
        Alert.alert('Error', 'Unexpected response from server. Please try again.');
        return;
      }

      // ✅ Create complete user data object with all fields
      const userData = {
        id: userDataFromApi.id,
        first_name: userDataFromApi.first_name || firstName,
        last_name: userDataFromApi.last_name || lastName,
        username: userDataFromApi.username || username,
        email: userDataFromApi.email || email,
        phone_verification: 0,
        phone_number: '',
        token: token,
        role_id: userDataFromApi.role_id || '',
        user_plan_id: userDataFromApi.user_plan_id || '',
        created_at: userDataFromApi.created_at || '',
        updated_at: userDataFromApi.updated_at || '',
        // Preserve any other fields
        ...userDataFromApi
      };

      console.log('📦 Complete user data to save:', JSON.stringify(userData, null, 2));
      console.log('👤 First name being passed:', userData.first_name);
      console.log('👤 Last name being passed:', userData.last_name);
      console.log('👤 Email being passed:', userData.email);

      // ✅ Save user data to SecureStore immediately
      await SecureStore.setItemAsync(SESSION_KEY, token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(userData));

      // ✅ Navigate with FULL user data
      console.log('✅ Registration successful! Navigating to phone verification with user data...');
      navigate && navigate('verify', userData);
      
    } catch (err) {
      console.error('❌ Network Error:', err);
      Alert.alert('Network Error', 'Could not connect to the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleGoogle() {
    console.log('Google sign in');
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

          <Text style={styles.heading}>Get started with Megasub</Text>
          <Text style={styles.subheading}>Enjoy seamless services on signing up</Text>

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

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or sign up with email</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <FormInput
                label="First Name"
                placeholder="John"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                error={errors.firstName}
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={styles.nameField}>
              <FormInput
                label="Last Name"
                placeholder="Doe"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                error={errors.lastName}
              />
            </View>
          </View>

          <FormInput
            label="Username"
            placeholder="johndoe123"
            value={username}
            onChangeText={setUsername}
            error={errors.username}
          />

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
            placeholder="Min. 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
            error={errors.password}
          />

          <FormInput
            label="Referral Code (optional)"
            placeholder="Enter referral code"
            value={referral}
            onChangeText={setReferral}
          />

          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => {
              setAgreed(!agreed);
              setErrors(prev => ({ ...prev, agreed: undefined }));
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.checkLabel}>
                I have read the{' '}
                <Text style={styles.checkLink}>Terms and Conditions</Text>
                {' '}of Megasub
              </Text>
              {errors.agreed ? (
                <Text style={inputStyles.errorText}>{errors.agreed}</Text>
              ) : null}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.signupBtn, loading && styles.signupBtnDisabled]}
            onPress={handleSignup}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={styles.signupBtnText}>Continue to Sign Up</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigate && navigate('login')}>
              <Text style={styles.loginLink}>Click here to login</Text>
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
  nameRow: {
    flexDirection: 'row',
  },
  nameField: {
    flex: 1,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 22,
    marginTop: 4,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkMark: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  checkLabel: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.label,
    lineHeight: 20,
  },
  checkLink: {
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
  },
  signupBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  signupBtnDisabled: {
    opacity: 0.6,
  },
  signupBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.white,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
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