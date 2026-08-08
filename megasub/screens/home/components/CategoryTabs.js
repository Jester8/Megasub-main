import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';

const FONTS = {
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};

// Segmented pill selector shared by Data/Airtime/Cable for picking a plan
// category (e.g. SME / Awoof / Gifting, or a cable provider). Options may
// carry a `logo` (image source) shown as a small rounded badge.
export default function CategoryTabs({ options, selectedId, onSelect, colors }) {
  if (!options || options.length === 0) return null;
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const active = selectedId === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[
              styles.tab,
              { backgroundColor: colors.card, borderColor: colors.border },
              active && { backgroundColor: colors.brand, borderColor: colors.brand },
            ]}
            onPress={() => onSelect(opt)}
            activeOpacity={0.8}
          >
            {opt.logo ? <Image source={opt.logo} style={styles.tabLogo} /> : null}
            <Text
              style={[styles.tabText, { color: colors.text }, active && styles.tabTextActive]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    // Fixed one-third width (no flexGrow) so every tab is the same size and
    // a short last row doesn't stretch its tabs wider than the rest. Long
    // labels wrap onto extra lines instead of truncating; minHeight keeps
    // single-line tabs the same size as wrapped ones.
    flexGrow: 0,
    flexBasis: '31.5%',
    minHeight: 58,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  // Category labels come back from the API in ALL CAPS (e.g. "GIFTING") —
  // capitalized here for display only, since it's a tab pill, not a
  // multi-word title where lowercase (see PlanGrid) would read better.
  tabText: { fontFamily: FONTS.semibold, fontSize: 13, flexShrink: 1, textAlign: 'center', textTransform: 'capitalize' },
  tabTextActive: { color: '#FFFFFF', fontFamily: FONTS.bold },
  tabLogo: { width: 22, height: 22, borderRadius: 11 },
});
