import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';

const FONTS = { semibold: 'Manrope_600SemiBold' };
const BRAND = '#4A55DD';

// PDF export used to just wrap the same receipt screenshot in an HTML/PDF
// shell (via expo-print) — a blurry, non-selectable image masquerading as a
// document, flagged in QA (Screenshot #26) with "maybe we should just remove
// the pdf." Removed rather than rebuilt as real text/vector content, since
// the image share already covers the same use case without the false
// impression of a real PDF.
export default function ShareButtons({ sharing, onShareImage, colors }) {
  return (
    <View style={styles.shareRow}>
      <TouchableOpacity
        style={[styles.shareBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.8}
        onPress={onShareImage}
        disabled={sharing !== null}
      >
        {sharing === 'image' ? (
          <ActivityIndicator color={BRAND} size="small" />
        ) : (
          <>
            <Feather name="image" size={16} color={BRAND} />
            <Text style={styles.shareBtnText}>Share Receipt</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  shareRow: { flexDirection: 'row', gap: 10, width: '100%' },
  shareBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 16, borderWidth: 1.5, height: 48,
  },
  shareBtnText: { fontFamily: FONTS.semibold, fontSize: 13, color: BRAND },
});
