import React, { useState, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SecureStore from 'expo-secure-store';
import OnboardingScreen from './screens/splash';
import SignupScreen from './screens/signup';
import LoginScreen from './screens/login';
import HomeScreen from './screens/home/Homescreen';
import VerifyScreen from './screens/verify';
import Resetscreen from './screens/reset';

const USER_KEY = 'megasub_user_data';

export default function App() {
  const [screen, setScreen] = useState('onboarding');
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadSavedUser();
  }, []);

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
      }
    } catch (err) {
      console.log('Error loading saved user:', err);
    }
  }
function navigate(s, userData) {
  console.log('🚀 Navigating to:', s);
  console.log('📦 Raw user data received:', userData);
  
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
  setScreen(s);
}

  let content = null;
  if (screen === 'onboarding') content = <OnboardingScreen navigate={navigate} />;
  if (screen === 'signup')     content = <SignupScreen navigate={navigate} />;
  if (screen === 'login')      content = <LoginScreen navigate={navigate} />;
  if (screen === 'home')       content = <HomeScreen navigate={navigate} user={user} />;
  if (screen === 'verify')     content = <VerifyScreen navigate={navigate} />;
  if (screen === 'reset')      content = <Resetscreen navigate={navigate} />;
  console.log('📱 Current screen:', screen);
  console.log('👤 Current user in App state:', user);
  console.log('👤 Current user first_name in App:', user?.first_name);
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {content}
    </GestureHandlerRootView>
  );
}