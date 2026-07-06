import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { ThemeProvider } from './contexts/ThemeContext';
import OnboardingScreen from './screens/splash';
import SignupScreen from './screens/signup';
import LoginScreen from './screens/login';
import HomeScreen from './screens/home/Homescreen';
import VerifyScreen from './screens/verify';
import Resetscreen from './screens/reset';
import Airtime from './screens/home/services/Airtime';
import Data from './screens/home/services/Data';
import Cable from './screens/home/services/Cable';
import Electricity from './screens/home/services/Electricity';
import Bulk from './screens/home/services/Bulk';
import Waec from './screens/home/services/Waec';
import TransactionHistory from './screens/home/TransactionHistory';
import TopUp from './screens/home/TopUp';
import Wallet from './screens/home/Wallet';
import Profile from './screens/home/Profile';
import EditProfile from './screens/home/EditProfile';
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

export default function App() {
  // null while the saved session/onboarding state is still being read from
  // SecureStore, so we never flash onboarding/login before we know better.
  const [screen, setScreen] = useState(null);
  const [user, setUser] = useState(null);
  const [screenParams, setScreenParams] = useState(null);

  useEffect(() => {
    bootstrap();
  }, []);

  async function bootstrap() {
    try {
      const [sessionToken, userData, onboardingSeen] = await Promise.all([
        SecureStore.getItemAsync(SESSION_KEY),
        SecureStore.getItemAsync(USER_KEY),
        SecureStore.getItemAsync(ONBOARDING_KEY),
      ]);

      if (sessionToken && userData) {
        console.log('✅ Saved session found, going straight to home');
        setUser(JSON.parse(userData));
        setScreen('home');
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
}

  let content = null;
  if (screen === 'onboarding') content = <OnboardingScreen navigate={navigate} />;
  if (screen === 'signup')     content = <SignupScreen navigate={navigate} />;
  if (screen === 'login')      content = <LoginScreen navigate={navigate} />;
  if (screen === 'home')       content = <HomeScreen navigate={navigate} user={user} />;
  if (screen === 'verify')     content = <VerifyScreen navigate={navigate} />;
  if (screen === 'reset')      content = <Resetscreen navigate={navigate} />;
  if (screen === 'airtime')    content = <Airtime navigate={navigate} user={user} />;
  if (screen === 'data')       content = <Data navigate={navigate} user={user} />;
  if (screen === 'cable')      content = <Cable navigate={navigate} user={user} />;
  if (screen === 'electricity') content = <Electricity navigate={navigate} user={user} />;
  if (screen === 'bulk')       content = <Bulk navigate={navigate} user={user} />;
  if (screen === 'waec')       content = <Waec navigate={navigate} user={user} />;
  if (screen === 'history')    content = <TransactionHistory navigate={navigate} user={user} />;
  if (screen === 'topup')      content = <TopUp navigate={navigate} />;
  if (screen === 'wallet')     content = <Wallet navigate={navigate} user={user} />;
  if (screen === 'profile')    content = <Profile navigate={navigate} user={user} />;
  if (screen === 'edit-profile')    content = <EditProfile navigate={navigate} user={user} />;
  if (screen === 'change-pin')      content = <ChangePin navigate={navigate} />;
  if (screen === 'change-password') content = <ChangePassword navigate={navigate} />;
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