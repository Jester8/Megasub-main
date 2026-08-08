import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, StatusBar } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TermsPrivacyBody } from '../TermsPrivacy';

const FONTS = {
  bold: 'Manrope_700Bold',
};

const BRAND = '#4A55DD';

// Full-screen modal wrapping TermsPrivacyBody for the signup screen, which
// runs before any user is signed in — TermsPrivacy.js itself always routes
// its back button to 'profile', an authenticated-only screen, so it can't be
// reused directly here. The checkbox agreement stays on signup; this is just
// the reading surface the "Terms and Conditions" link is supposed to open.
export default function TermsModal({ visible, onClose, colors }) {
  const insets = useSafeAreaInsets();
  const theme = colors || {
    background: '#F7F8FC',
    card: '#FFFFFF',
    text: '#0B0D1A',
    textMuted: 'rgba(11,13,26,0.6)',
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: theme.card }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Feather name="x" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Terms & Privacy Policy</Text>
          <View style={{ width: 38 }} />
        </View>

        <TermsPrivacyBody colors={theme} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#0B0D1A',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 16, color: '#0B0D1A' },
});
