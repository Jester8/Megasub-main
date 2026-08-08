import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const FONTS = {
  regular: 'Manrope_400Regular',
  bold: 'Manrope_700Bold',
};

const ERROR = '#EF4444';

// Replaces the raw backend text ("PIN mismatch", "Incorrect PIN", etc) that
// used to surface via the native Alert — alertForPurchaseError in lib/format.js
// normalizes every wrong-PIN wording to isWrongPin, and this is shown instead
// for that case specifically across the purchase screens (Airtime, Data,
// Cable, Electricity, Bulk).
export default function WrongPinModal({ visible, onClose }) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.card}>
              <View style={styles.iconWrap}>
                <Ionicons name="close-circle" size={48} color={ERROR} />
              </View>
              <Text style={styles.title}>Wrong PIN</Text>
              <Text style={styles.message}>
                The PIN you entered was not accepted. Please try again.
              </Text>
              <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={onClose}>
                <Text style={styles.buttonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
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
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconWrap: { marginBottom: 14 },
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
    backgroundColor: ERROR,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 36,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },
});
