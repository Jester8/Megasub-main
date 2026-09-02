import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { setNetworkErrorHandler, isOnline } from '../../../lib/network';

const FONTS = {
  regular: 'Manrope_400Regular',
  bold: 'Manrope_700Bold',
};

const BRAND = '#4A55DD';

// Mounted once at the app root (see App.js) — not controlled by a parent's
// visible prop, because it has to be triggerable from anywhere in the app
// (any purchase screen, PIN change, etc.) without threading state through
// every layer in between. requireNetworkOrShowError() in lib/network.js is
// what actually calls the open() this registers.
export default function NetworkErrorModal() {
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setNetworkErrorHandler(() => setVisible(true));
    return () => setNetworkErrorHandler(null);
  }, []);

  const handleRetry = async () => {
    setChecking(true);
    const online = await isOnline();
    setChecking(false);
    if (online) setVisible(false);
    // Still offline: stay open. The button's own spinner is the only
    // feedback needed — there's nothing new to say that isn't already on
    // screen.
  };

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="cloud-offline-outline" size={48} color={BRAND} />
          </View>
          <Text style={styles.title}>No Internet Connection</Text>
          <Text style={styles.message}>
            Megasub needs a working connection to complete this. Check your WiFi or mobile data and try again.
          </Text>
          <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={handleRetry} disabled={checking}>
            {checking ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Try Again</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.dismissBtn} activeOpacity={0.7} onPress={() => setVisible(false)}>
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(74,85,221,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontFamily: FONTS.bold, fontSize: 18, color: '#0B0D1A', marginBottom: 8 },
  message: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7088',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  button: {
    backgroundColor: BRAND,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 36,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },
  dismissBtn: { marginTop: 14, paddingVertical: 6 },
  dismissText: { fontFamily: FONTS.regular, fontSize: 13, color: '#6B7088' },
});
