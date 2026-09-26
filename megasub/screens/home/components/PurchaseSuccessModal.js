import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const FONTS = {
  regular: 'Montserrat_400Regular',
  bold: 'Montserrat_700Bold',
};

const SUCCESS = '#16A34A';
const AUTO_DISMISS_MS = 4000;

// Brief celebratory confirmation shown the instant a purchase call succeeds
// — auto-dismisses on its own after 4s, revealing the full receipt
// (SuccessView) already rendered behind it. Matches WrongPinModal's visual
// style so success/failure feedback feel like the same system.
export default function PurchaseSuccessModal({ visible, message, onClose }) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      onClose && onClose();
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="checkmark-circle" size={56} color={SUCCESS} />
          </View>
          <Text style={styles.title}>{message || 'Purchase Successful'}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconWrap: { marginBottom: 16 },
  title: { fontFamily: FONTS.bold, fontSize: 17, color: '#0B0D1A', textAlign: 'center' },
});
