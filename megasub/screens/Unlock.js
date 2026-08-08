import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BRAND = '#4A55DD';
const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const BIOMETRIC_LABEL = Platform.OS === 'ios' ? 'Face ID' : 'Fingerprint';
const BIOMETRIC_ICON = Platform.OS === 'ios' ? 'scan-outline' : 'finger-print-outline';

// Shown on app resume when a session is still valid and the user has opted
// into biometric app-lock — gates access to the already-logged-in session,
// it does not create a new one (there's no biometric/refresh endpoint on
// the backend, so an actually expired session can only be fixed by
// retyping the password on the login screen).
export default function UnlockScreen({ onUnlocked, onUsePassword }) {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState('checking'); // 'checking' | 'failed'

  useEffect(() => {
    attemptUnlock();
  }, []);

  async function attemptUnlock() {
    setStatus('checking');
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Unlock Megasub with ${BIOMETRIC_LABEL}`,
        cancelLabel: 'Use Password',
        disableDeviceFallback: false,
      });
      if (result.success) {
        onUnlocked && onUnlocked();
      } else {
        setStatus('failed');
      }
    } catch (err) {
      setStatus('failed');
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 30 }]}>
      <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Ionicons name={BIOMETRIC_ICON} size={44} color={BRAND} />
        </View>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>
          {status === 'failed'
            ? `${BIOMETRIC_LABEL} wasn't recognized. Try again or use your password.`
            : `Unlock with ${BIOMETRIC_LABEL} to continue`}
        </Text>

        <TouchableOpacity style={styles.unlockBtn} activeOpacity={0.85} onPress={attemptUnlock}>
          <Ionicons name={BIOMETRIC_ICON} size={20} color="#FFFFFF" />
          <Text style={styles.unlockBtnText}>Try {BIOMETRIC_LABEL} Again</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.passwordBtn} activeOpacity={0.8} onPress={onUsePassword}>
        <Text style={styles.passwordBtnText}>Use Password Instead</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', paddingHorizontal: 24 },
  logo: { width: 110, height: 44, marginBottom: 40 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(74,85,221,0.08)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  title: { fontFamily: FONTS.extrabold, fontWeight: '800', fontSize: 22, color: '#0B0D1A', marginBottom: 8 },
  subtitle: {
    fontFamily: FONTS.regular, fontSize: 13.5, color: 'rgba(11,13,26,0.5)',
    textAlign: 'center', lineHeight: 20, marginBottom: 32, paddingHorizontal: 12,
  },
  unlockBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: BRAND, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 24,
  },
  unlockBtnText: { fontFamily: FONTS.bold, fontSize: 14, color: '#FFFFFF' },
  passwordBtn: { paddingVertical: 12 },
  passwordBtnText: { fontFamily: FONTS.medium, fontSize: 13.5, color: 'rgba(11,13,26,0.5)' },
});
