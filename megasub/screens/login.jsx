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
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { useResponsive } from '../lib/responsive';
import { resetUnauthorizedGuard } from '../lib/api';
import { signInWithGoogle, isGoogleSignInCancelled } from '../lib/googleAuth';

// Synchronized production API endpoint URL mapping
const BASE_URL = 'https://mega-sub.com/api/v1/external';
const SESSION_KEY = 'megasub_session_token';
const USER_KEY = 'megasub_user_data';

const BIOMETRIC_LABEL = Platform.OS === 'ios' ? 'Face ID' : 'Fingerprint';
const BIOMETRIC_ICON = Platform.OS === 'ios' ? 'scan-outline' : 'finger-print-outline';

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
  const insets = useSafeAreaInsets();
  const { column } = useResponsive();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [bioBusy, setBioBusy] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Shown regardless of whether a session currently exists — the device
  // capability (hardware + enrolled face/fingerprint) is the only thing
  // that decides whether the button appears at all. Whether it can actually
  // log the user in (a valid session already cached) is checked at tap
  // time instead, with a clear message if not.
  useEffect(() => {
    (async () => {
      try {
        const [hasHardware, isEnrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
        setBiometricAvailable(hasHardware && isEnrolled);
      } catch {
        setBiometricAvailable(false);
      }
    })();
  }, []);

  async function handleBiometricLogin() {
    setBioBusy(true);
    try {
      const savedToken = await SecureStore.getItemAsync(SESSION_KEY);
      if (!savedToken) {
        Alert.alert('Not Available', 'Please log in with your password first.');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Log in to Megasub with ${BIOMETRIC_LABEL}`,
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        resetUnauthorizedGuard();
        const userData = await SecureStore.getItemAsync(USER_KEY);
        const user = userData ? JSON.parse(userData) : { first_name: 'Returning User' };
        navigate && navigate('home', user);
      }
    } catch (err) {
      Alert.alert('Error', `An error occurred during ${BIOMETRIC_LABEL} verification.`);
    } finally {
      setBioBusy(false);
    }
  }

  async function handleLogin() {
    const e = {};
    // identifier accepts an exact email, username, or phone number — no
    // format check beyond "typed something", since a valid username or
    // phone number wouldn't pass an email-shaped regex.
    if (!identifier.trim()) e.identifier = 'Email, username, or phone number is required';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      console.log('📤 Sending login request to:', `${BASE_URL}/login`);

      const typedIdentifier = identifier.trim();
      const res = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Only lowercase when it looks like an email — usernames/phone
          // numbers should go through exactly as typed.
          identifier: /\S+@\S+\.\S+/.test(typedIdentifier) ? typedIdentifier.toLowerCase() : typedIdentifier,
          password: password.trim(), // Trims leading/trailing accidental spaces
          device_name: Platform.OS === 'ios' ? 'iOS Device' : 'Android Device',
        }),
      });

      // A crashed backend can answer with an HTML error page (or an empty
      // body) instead of JSON, which would otherwise throw here and get
      // reported as a connection problem the user can't act on.
      const json = await res.json().catch(() => ({}));
      console.log('📥 Login API Response:', res.status, JSON.stringify(json, null, 2));

      // 5xx means the request never got as far as checking the credentials —
      // saying "invalid credentials" would send the user off retyping a
      // password that was never the problem.
      if (res.status >= 500) {
        Alert.alert(
          'Megasub Is Unavailable',
          "We couldn't reach Megasub's servers just now. This isn't a problem with your details — please try again in a few minutes."
        );
        return;
      }

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

      if (!res.ok || json.status === false) {
        Alert.alert('Login Failed', json.message || 'Invalid credentials. Please try again.');
        return;
      }

      const token = json.access?.token || json.data?.token;
      // /login only returns { token, user: <id> } — the id may come through
      // as a bare string or, on some deployments, a nested profile object.
      const rawUser = json.data?.user;
      const userId = json.data?.id || (typeof rawUser === 'string' ? rawUser : rawUser?.id);

      console.log('🔑 Extracted token:', token ? '✅ Present' : '❌ Missing');
      console.log('🆔 Extracted user ID:', userId);

      if (!token || !userId) {
        console.error('❌ Missing token or user ID in response structure:', json);
        Alert.alert('Error', 'Unexpected response payload from server. Please try again.');
        return;
      }

      // /login doesn't carry the account's actual profile (username, wallet
      // balance) — /dashboard does. Fetch it right after login so Home shows
      // the real account, not a placeholder.
      let profile = (rawUser && typeof rawUser === 'object') ? rawUser : {};
      try {
        const dashRes = await fetch(`${BASE_URL}/dashboard`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ user_id: userId }),
        });
        const dashJson = await dashRes.json();
        // The real account (username, first_name, main_wallet, etc.) lives
        // under data.user — the top-level data object has stale/blank
        // copies of those same fields.
        if (dashRes.ok && dashJson.status !== false && dashJson.data?.user) {
          profile = dashJson.data.user;
        }
        console.log('📊 Dashboard profile:', dashJson);
      } catch (dashErr) {
        console.log('⚠️ Could not fetch dashboard profile, using login payload only:', dashErr);
      }

      // Phone number and PIN status have no dedicated "check" endpoint (the
      // phone-verification API isn't live, and PIN status is purely local)
      // — fall back to what this same device already knows rather than
      // re-asking every login. Match on id first (most reliable), falling
      // back to whichever of email/username/phone matches what was typed —
      // identifier can now be any of the three, not just an email.
      const identifierLower = typedIdentifier.toLowerCase();
      let previousLocal = {};
      try {
        const prevRaw = await SecureStore.getItemAsync(USER_KEY);
        if (prevRaw) {
          const prev = JSON.parse(prevRaw);
          const sameAccount =
            prev.id === userId ||
            (prev.email && prev.email.toLowerCase() === identifierLower) ||
            (prev.username && prev.username.toLowerCase() === identifierLower) ||
            (prev.phone_number && prev.phone_number === typedIdentifier);
          if (sameAccount) previousLocal = prev;
        }
      } catch {}

      // The typed identifier only belongs in the email field if it actually
      // looks like one — a phone number or username typed at login must not
      // overwrite a real email address (or masquerade as one on a fresh
      // device with no previousLocal record).
      const identifierIsEmail = /\S+@\S+\.\S+/.test(typedIdentifier);

      const userData = {
        ...previousLocal,
        ...profile,
        id: userId,
        token,
        email: profile.email || previousLocal.email || (identifierIsEmail ? typedIdentifier : ''),
        username: profile.username || previousLocal.username || '',
        first_name:
          profile.first_name ||
          previousLocal.first_name ||
          profile.username ||
          (identifierIsEmail ? typedIdentifier.split('@')[0] : typedIdentifier),
        last_name: profile.last_name || previousLocal.last_name || '',
        phone_number: profile.phone_number || previousLocal.phone_number || '',
        pin_set: profile.pin_set ?? previousLocal.pin_set ?? false,
      };

      // Cache elements inside local SecureStore
      await SecureStore.setItemAsync(SESSION_KEY, token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(userData));
      resetUnauthorizedGuard();

      // The backend exposes no way to read whether a phone number is on
      // file for THIS endpoint, so the fallback signal is local memory of
      // this device: no phone + no PIN evidence means setup never completed
      // (or this is a fresh device/reinstall — SecureStore doesn't survive
      // either). If /login or /dashboard ever start returning a
      // phone_verification flag on profile.user (the /google endpoint
      // already does), trust that over local memory — it's authoritative
      // and correctly covers a fresh install where previousLocal is empty.
      const serverVerified = profile.phone_verification === true || profile.phone_verification === 1;
      const setupComplete = serverVerified
        ? !!userData.pin_set
        : !!(userData.phone_number && userData.pin_set);
      if (!setupComplete) {
        console.log('ℹ️ No phone/PIN on record — routing through verification.');
        navigate && navigate('verify', userData);
        return;
      }

      console.log('✅ Login successful! Moving to dashboard home screen.');
      navigate && navigate('home', userData);
      
    } catch (err) {
      console.error('❌ Network Error:', err);
      Alert.alert('Network Error', 'Could not connect to the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      const { userData, requiresPhoneVerification } = await signInWithGoogle({
        deviceName: Platform.OS === 'ios' ? 'iOS Device' : 'Android Device',
      });
      // The backend decides new-vs-returning from this one call — an
      // existing user with phone_verification already on file goes
      // straight to Home, a brand-new (or unverified) one goes through the
      // same verify flow email signup uses.
      navigate && navigate(requiresPhoneVerification ? 'verify' : 'home', userData);
    } catch (err) {
      if (isGoogleSignInCancelled(err)) return;
      Alert.alert('Google Sign-In Failed', err.message || 'Please try again.');
    } finally {
      setGoogleLoading(false);
    }
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

          <Text style={styles.heading}>Welcome back to Megasub</Text>
          <Text style={styles.subheading}>
            Log in to continue where you left off
          </Text>

          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogle}
            activeOpacity={0.8}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <ActivityIndicator color={COLORS.primary} size="small" />
            ) : (
              <>
                <View style={styles.googleIconWrap}>
                  <Image
                    source={require('../assets/google.png')}
                    style={styles.googleIconImg}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.googleText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or log in with email, username, or phone</Text>
            <View style={styles.dividerLine} />
          </View>

          <FormInput
            label="Email, Username, or Phone"
            placeholder="john@example.com"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            error={errors.identifier}
          />

          <FormInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
            error={errors.password}
          />

          <TouchableOpacity
            style={styles.forgotRow}
            onPress={() => navigate && navigate('reset')}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

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

          {biometricAvailable && (
            <TouchableOpacity
              style={styles.biometricBtn}
              onPress={handleBiometricLogin}
              activeOpacity={0.8}
              disabled={bioBusy}
            >
              <Ionicons name={BIOMETRIC_ICON} size={20} color={COLORS.primary} />
              <Text style={styles.biometricText}>
                {bioBusy ? 'Verifying...' : `Log in with ${BIOMETRIC_LABEL}`}
              </Text>
            </TouchableOpacity>
          )}

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
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 20,
  },
  biometricText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: COLORS.primary,
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