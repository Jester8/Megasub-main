import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';

const FONTS = {
  regular: 'Manrope_400Regular',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};

// Selectable option list — vertical (default, full-width rows with a radio
// indicator) or horizontal (a clean scrollable row of pill cards, for long
// option sets like electricity DISCOs where wrapping/full-width rows don't
// fit well).
// options: [{ id, label, meta }]
export default function OptionList({ options, selectedId, onSelect, colors, horizontal }) {
  if (!options || options.length === 0) return null;

  if (horizontal) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hScrollContent}
      >
        {options.map((opt) => {
          const active = selectedId === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.hCard,
                { backgroundColor: colors.card, borderColor: colors.border },
                active && { borderColor: colors.brand, backgroundColor: colors.cardAlt },
              ]}
              onPress={() => onSelect(opt)}
              activeOpacity={0.8}
            >
              <View style={styles.hTop}>
                {opt.logo ? <Image source={opt.logo} style={styles.hLogo} /> : null}
                <Text
                  style={[styles.hLabel, { color: colors.text }, active && { color: colors.brand }]}
                  numberOfLines={1}
                >
                  {opt.label}
                </Text>
              </View>
              {opt.meta ? (
                <Text style={[styles.hMeta, { color: colors.textFaint }]} numberOfLines={1}>
                  {opt.meta}
                </Text>
              ) : null}
              {active ? (
                <View style={[styles.hCheck, { backgroundColor: colors.brand }]}>
                  <Feather name="check" size={11} color="#FFFFFF" />
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <View style={styles.list}>
      {options.map((opt) => {
        const active = selectedId === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[
              styles.row,
              { backgroundColor: colors.card, borderColor: colors.border },
              active && { borderColor: colors.brand, backgroundColor: colors.cardAlt },
            ]}
            onPress={() => onSelect(opt)}
            activeOpacity={0.8}
          >
            <View style={styles.textWrap}>
              <Text
                style={[styles.label, { color: colors.text }, active && { color: colors.brand }]}
                numberOfLines={1}
              >
                {opt.label}
              </Text>
              {opt.meta ? (
                <Text style={[styles.meta, { color: colors.textFaint }]} numberOfLines={1}>
                  {opt.meta}
                </Text>
              ) : null}
            </View>
            <View style={[styles.radio, { borderColor: active ? colors.brand : colors.border }]}>
              {active ? <View style={[styles.radioDot, { backgroundColor: colors.brand }]} /> : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  textWrap: { flex: 1, marginRight: 12 },
  label: { fontFamily: FONTS.semibold, fontSize: 14 },
  meta: { fontFamily: FONTS.regular, fontSize: 11.5, marginTop: 2 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },

  hScrollContent: { gap: 10, paddingRight: 4 },
  hCard: {
    minWidth: 130,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  hTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  hLogo: { width: 24, height: 24, borderRadius: 12 },
  hLabel: { fontFamily: FONTS.semibold, fontSize: 13.5, paddingRight: 18, flexShrink: 1 },
  hMeta: { fontFamily: FONTS.regular, fontSize: 11, marginTop: 3 },
  hCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
