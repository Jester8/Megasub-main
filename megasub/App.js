import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert, BackHandler } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { fetchDashboard, setUnauthorizedHandler, resetUnauthorizedGuard, clearCachedVirtualAccounts } from './lib/api';
import { ThemeProvider } from './contexts/ThemeContext';
import OnboardingScreen from './screens/splash';
import SignupScreen from './screens/signup';
import LoginScreen from './screens/login';
import UnlockScreen from './screens/Unlock';
import HomeScreen from './screens/home/Homescreen';
import VerifyScreen from './screens/verify';
import EmailVerifyScreen from './screens/EmailVerify';
import Resetscreen from './screens/reset';
import Airtime from './screens/home/services/Airtime';
import Data from './screens/home/services/Data';
import Cable from './screens/home/services/Cable';
import Electricity from './screens/home/services/Electricity';
import Bulk from './screens/home/services/Bulk';
import ComingSoon from './screens/home/services/ComingSoon';
import AllServices from './screens/home/AllServices';
import Notifications from './screens/home/Notifications';
import TransactionHistory from './screens/home/TransactionHistory';
import TopUp from './screens/home/TopUp';
import Wallet from './screens/home/Wallet';
import Profile from './screens/home/Profile';
import ChangePin from './screens/home/ChangePin';
import ChangePassword from './screens/home/ChangePassword';
import Verification from './screens/home/Verification';
import ReferEarn from './screens/home/ReferEarn';
import HelpCenter from './screens/home/HelpCenter';
import ContactSupport from './screens/home/ContactSupport';
import TermsPrivacy from './screens/home/TermsPrivacy';

const USER_KEY = 'megasub_user_data';
const SESSION_KEY = 'megasub_session_token';
const ONBOARDING_KEY = 'megasub_onboarding_seen';
const BIOMETRIC_KEY = 'megasub_biometric_enabled';

export default function App() {
  // null while the saved session/onboarding state is still being read from
  // SecureStore, so we never flash onboarding/login before we know better.
  const [screen, setScreen] = useState(null);
  const [user, setUser] = useState(null);
  const [screenParams, setScreenParams] = useState(null);

  // This app has no navigation library, just this one `screen` string — so
  // there is nothing to pop when Android's hardware back button is pressed,
  // and it falls through to the OS default of closing the app instead of
  // going to the previous page. screenRef/historyRef back the BackHandler
  // below with the current screen and a simple back-stack.
  const screenRef = useRef(screen);
  useEffect(() => { screenRef.current = screen; }, [screen]);
  const historyRef = useRef([]);

  useEffect(() => {
    bootstrap();
    setUnauthorizedHandler(handleUnauthorized);
  }, []);

  // Root screens: the back button should exit/minimize the app from here,
  // never pop to something stale (e.g. back into a finished signup flow).
  const ROOT_SCREENS = new Set(['home', 'login', 'onboarding']);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const current = screenRef.current;
      if (!current || ROOT_SCREENS.has(current)) {
        return false; // let the OS handle it at true roots
      }
      const history = historyRef.current;
      if (history.length > 0) {
        const target = history[history.length - 1];
        historyRef.current = history.slice(0, -1);
        setScreen(target);
        return true;
      }
      // No recorded history (e.g. a deep link straight into a sub-screen) —
      // fall back to a safe screen instead of exiting mid-flow.
      setScreen(user ? 'home' : 'login');
      return true;
    });
    return () => sub.remove();
  }, [user]);

  // Mega-Sub has no refresh-token endpoint, so an expired session can only be
  // fixed by logging in again — this fires once from any screen's failed API
  // call and routes everyone the same way instead of each showing its own
  // confusing "Unauthenticated" error. api.js's unauthorizedHandled guard is
  // what stops a burst of parallel 401s (e.g. Cable's Promise.all) from
  // calling this more than once and stacking duplicate alerts.
  async function handleUnauthorized() {
    const stillHasSession = await SecureStore.getItemAsync(SESSION_KEY);
    if (!stillHasSession) return;

    // Only the expired token gets cleared. USER_KEY holds phone_number/
    // pin_set — there's no server field for either, so wiping it here would
    // erase that memory and force the user through phone + PIN setup again
    // on every single re-login.
    await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
    clearCachedVirtualAccounts();
    setUser(null);
    setScreen('login');
    Alert.alert('Session Expired', 'Please log in again to continue.');
  }

  async function bootstrap() {
    try {
      const [sessionToken, userData, onboardingSeen] = await Promise.all([
        SecureStore.getItemAsync(SESSION_KEY),
        SecureStore.getItemAsync(USER_KEY),
        SecureStore.getItemAsync(ONBOARDING_KEY),
      ]);

      if (sessionToken && userData) {
        resetUnauthorizedGuard();
        // Verification is a one-time, signup-only step (with its own Skip
        // button) — a saved session always resumes straight to Home, unless
        // the user opted into biometric app-lock, in which case that gate
        // comes first.
        setUser(JSON.parse(userData));

        const biometricEnabled = await SecureStore.getItemAsync(BIOMETRIC_KEY);
        if (biometricEnabled === 'true') {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();
          if (hasHardware && isEnrolled) {
            console.log('🔒 Saved session found, gating behind biometric unlock');
            setScreen('unlock');
            return;
          }
        }

        console.log('✅ Saved session found, going straight to home');
        setScreen('home');
        refreshWallet();
      } else if (onboardingSeen) {
        setScreen('login');
      } else {
        setScreen('onboarding');
      }
    } catch (err) {
      console.log('Error during startup bootstrap:', err);
      setScreen('onboarding');
    }
  }

  // /login only returns { token, user: <id> }, and the cached profile is
  // otherwise never touched again — so main_wallet goes stale the moment a
  // purchase or top-up changes it. Re-pull the live profile whenever the
  // user lands on a screen that shows balance.
  async function refreshWallet() {
    try {
      const userDataRaw = await SecureStore.getItemAsync(USER_KEY);
      if (!userDataRaw) return;
      const { id } = JSON.parse(userDataRaw);
      if (!id) return;

      const json = await fetchDashboard(id);

      // /dashboard's top-level `data` carries stale/blank profile fields
      // (e.g. first_name/username) — the real account (including
      // main_wallet) is nested under data.user.
      const account = json?.data?.user;
      if (account) {
        setUser((prev) => {
          const merged = { ...prev, ...account };
          SecureStore.setItemAsync(USER_KEY, JSON.stringify(merged)).catch(() => {});
          return merged;
        });
      }
    } catch (err) {
      console.log('⚠️ Could not refresh wallet balance:', err);
    }
  }

  // Bails out of the biometric gate back to a normal password login —
  // e.g. the user's face/fingerprint isn't being recognized right now.
  async function handleUsePasswordInstead() {
    await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
    setUser(null);
    setScreen('login');
  }

  async function loadSavedUser() {
    try {
      const userData = await SecureStore.getItemAsync(USER_KEY);
      if (userData) {
        const parsedUser = JSON.parse(userData);
        console.log('💾 Loaded saved user:', parsedUser);
        console.log('👤 Loaded first_name:', parsedUser.first_name);
        console.log('👤 Loaded last_name:', parsedUser.last_name);
        console.log('👤 Loaded email:', parsedUser.email);
        setUser(parsedUser);
      } else {
        console.log('⚠️ No saved user data found');
        setUser(null);
      }
    } catch (err) {
      console.log('Error loading saved user:', err);
    }
  }
function navigate(s, userData) {
  console.log('🚀 Navigating to:', s);
  console.log('📦 Raw user data received:', userData);

  // Track where the hardware back button should return to. Landing on a
  // root screen (home/login/onboarding) drops any stale history from the
  // flow just finished (e.g. signup → verify → pin) instead of letting back
  // step into a screen that no longer makes sense to revisit.
  if (screen && screen !== s) {
    if (ROOT_SCREENS.has(s)) {
      historyRef.current = [];
    } else {
      historyRef.current = [...historyRef.current, screen].slice(-20);
    }
  }

  // Once the user moves past onboarding, remember that so it's never
  // shown again on future launches.
  if (screen === 'onboarding' && s !== 'onboarding') {
    SecureStore.setItemAsync(ONBOARDING_KEY, 'true').catch((err) =>
      console.log('Error saving onboarding flag:', err)
    );
  }

  // Handle case where userData contains a nested userData property
  let actualUserData = userData;
  if (userData && userData.userData && typeof userData.userData === 'object') {
    actualUserData = userData.userData;
    console.log('📦 Extracted nested userData:', actualUserData);
  }

  // Also handle case where userData is in the params object
  if (userData && userData.params && userData.params.userData) {
    actualUserData = userData.params.userData;
    console.log('📦 Extracted params.userData:', actualUserData);
  }

  if (actualUserData && typeof actualUserData === 'object' && Object.keys(actualUserData).length > 0) {
    console.log('👤 Setting user with first_name:', actualUserData.first_name);
    setUser(actualUserData);
  } else {
    console.log('⚠️ No valid user data received, keeping existing user');
    // Try to load from SecureStore if no data passed
    loadSavedUser();
  }

  // For screens like 'airtime' that pass along non-user params
  // (e.g. { network, phone, amount }), stash them separately so
  // user state isn't clobbered with unrelated data.
  if (!actualUserData || Object.keys(actualUserData).length === 0) {
    setScreenParams(userData || null);
  } else {
    setScreenParams(null);
  }

  setScreen(s);

  // Balance-bearing screens should never show a stale, login-time snapshot.
  if (s === 'home' || s === 'wallet') {
    refreshWallet();
  }
}

  let content = null;
  if (screen === 'onboarding') content = <OnboardingScreen navigate={navigate} />;
  if (screen === 'signup')     content = <SignupScreen navigate={navigate} />;
  if (screen === 'login')      content = <LoginScreen navigate={navigate} />;
  if (screen === 'unlock')     content = (
    <UnlockScreen
      onUnlocked={() => { setScreen('home'); refreshWallet(); }}
      onUsePassword={handleUsePasswordInstead}
    />
  );
  if (screen === 'home')       content = <HomeScreen navigate={navigate} user={user} onRefreshWallet={refreshWallet} />;
  if (screen === 'verify')     content = <VerifyScreen navigate={navigate} user={user} />;
  if (screen === 'email-verify') content = <EmailVerifyScreen navigate={navigate} user={user} />;
  if (screen === 'reset')      content = <Resetscreen navigate={navigate} />;
  if (screen === 'airtime')    content = <Airtime navigate={navigate} user={user} />;
  if (screen === 'data')       content = <Data navigate={navigate} user={user} />;
  if (screen === 'cable')      content = <Cable navigate={navigate} user={user} />;
  if (screen === 'electricity') content = <Electricity navigate={navigate} user={user} />;
  if (screen === 'bulk')       content = <Bulk navigate={navigate} user={user} />;
  if (screen === 'coming-soon-esim')         content = <ComingSoon navigate={navigate} title="E-SIM" icon="wifi" />;
  if (screen === 'coming-soon-waec')         content = <ComingSoon navigate={navigate} title="WAEC / NECO" icon="book-open" />;
  if (screen === 'coming-soon-virtual-card') content = <ComingSoon navigate={navigate} title="Virtual Card" icon="credit-card" />;
  if (screen === 'all-services') content = <AllServices navigate={navigate} />;
  if (screen === 'notifications') content = <Notifications navigate={navigate} user={user} />;
  if (screen === 'history')    content = <TransactionHistory navigate={navigate} user={user} />;
  if (screen === 'topup')      content = <TopUp navigate={navigate} user={user} />;
  if (screen === 'wallet')     content = <Wallet navigate={navigate} user={user} />;
  if (screen === 'profile')    content = <Profile navigate={navigate} user={user} />;
  if (screen === 'change-pin')      content = <ChangePin navigate={navigate} user={user} />;
  if (screen === 'change-password') content = <ChangePassword navigate={navigate} user={user} />;
  if (screen === 'kyc')             content = <Verification navigate={navigate} user={user} />;
  if (screen === 'refer-earn')      content = <ReferEarn navigate={navigate} user={user} />;
  if (screen === 'help-center')     content = <HelpCenter navigate={navigate} />;
  if (screen === 'contact-support') content = <ContactSupport navigate={navigate} />;
  if (screen === 'terms-privacy')   content = <TermsPrivacy navigate={navigate} />;
  console.log('📱 Current screen:', screen);
  console.log('👤 Current user in App state:', user);
  console.log('👤 Current user first_name in App:', user?.first_name);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          {screen === null ? (
            <View style={styles.bootLoader}>
              <ActivityIndicator color="#4A55DD" size="large" />
            </View>
          ) : (
            content
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  bootLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});