import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

const FONTS = {
  regular: 'Montserrat_400Regular',
  bold: 'Montserrat_700Bold',
};

// Shown when a provider-backed V2 product answers available: false (see
// request() in lib/api.js, which flags those as error.isUnavailable). The
// backend returns demo values in that state, and they must never be shown
// as real cards/PINs/eSIMs, so screens render this instead of the data.
export default function UnavailableNotice({ title, message, icon = 'clock', colors }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Feather name={icon} size={30} color="#4A55DD" />
      </View>
      <Text style={[styles.title, { color: colors?.text }]}>{title || 'Coming Soon'}</Text>
      <Text style={[styles.message, { color: colors?.textMuted }]}>
        {message || 'This service is not available yet. Please check back soon.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 32 },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(74,85,221,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontFamily: FONTS.bold, fontSize: 17, marginBottom: 8, textAlign: 'center' },
  message: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
