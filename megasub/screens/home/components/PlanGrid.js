import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const FONTS = {
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};

// 3-column grid of plan cards shared by Data/Airtime/Cable, each showing an
// optional top meta line (e.g. validity), a bold title, an optional price,
// and an optional bottom badge pill (e.g. category name).
// plans: [{ id, meta, title, price, badge }]
export default function PlanGrid({ plans, selectedId, onSelect, colors }) {
  if (!plans || plans.length === 0) return null;
  return (
    <View style={styles.grid}>
      {plans.map((p) => {
        const active = selectedId === p.id;
        return (
          <TouchableOpacity
            key={p.id}
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
              active && { borderColor: colors.brand, backgroundColor: colors.cardAlt },
            ]}
            onPress={() => onSelect(p)}
            activeOpacity={0.85}
          >
            {p.meta ? (
              <Text style={[styles.meta, { color: colors.brand }]} numberOfLines={1}>
                {p.meta}
              </Text>
            ) : null}
            <Text
              style={[styles.title, { color: colors.text }, active && { color: colors.brand }]}
            >
              {p.title}
            </Text>
            {p.price != null ? (
              <Text
                style={[styles.price, { color: colors.text }, active && { color: colors.brand }]}
                numberOfLines={1}
              >
                ₦{Number(p.price).toLocaleString()}
              </Text>
            ) : null}
            {p.badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText} numberOfLines={1}>{p.badge}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // alignItems defaults to stretch, so every card in a row grows to match
  // the tallest one — long titles wrap onto more lines instead of truncating,
  // and the row still stays uniform.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    flexBasis: '31%',
    flexGrow: 0,
    minHeight: 112,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    gap: 4,
  },
  // Plan names/categories come back from the API in ALL CAPS — capitalized
  // here for display only (first letter of each word), so nothing that
  // matches on the raw strings elsewhere (logo lookups, category filters) is
  // affected.
  meta: { fontFamily: FONTS.semibold, fontSize: 10.5, textTransform: 'capitalize' },
  title: { fontFamily: FONTS.bold, fontSize: 14.5, textAlign: 'center', textTransform: 'capitalize' },
  price: { fontFamily: FONTS.bold, fontSize: 12.5 },
  badge: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(16,185,129,0.12)',
  },
  badgeText: { fontFamily: FONTS.semibold, fontSize: 9.5, color: '#10B981', textTransform: 'capitalize' },
});
