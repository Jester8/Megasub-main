import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const PADDING = 20;
const CARD_PADDING = 14;
const GAP = 6;
const COLUMNS = 4;
const ICON_SIZE = 52;
const ITEM_SIZE = (width - PADDING * 2 - CARD_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

const FONTS = {
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};

const SERVICES = [
  { id: 'airtime',      label: 'Airtime',      icon: 'call-outline',            color: '#4A55DD', bg: 'rgba(74,85,221,0.1)' },
  { id: 'data',         label: 'Data',     icon: 'wifi-outline',            color: '#00C9A7', bg: 'rgba(0,201,167,0.1)' },
  { id: 'electricity',  label: 'Electricity',            icon: 'flash-outline',           color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  { id: 'cable',        label: 'Cable TV',               icon: 'tv-outline',              color: '#EC4899', bg: 'rgba(236,72,153,0.1)' },
  { id: 'bulk-sms',     label: 'Bulk\nRecharge',         icon: 'phone-portrait-outline',  color: '#7C3AED', bg: 'rgba(124,58,237,0.1)' },
  { id: 'bulk-data',    label: 'Bulk Data',              icon: 'globe-outline',           color: '#06B6D4', bg: 'rgba(6,182,212,0.1)' },
  { id: 'waec',         label: 'WAEC /\nNECO',           icon: 'school-outline',          color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  { id: 'virtual-card', label: 'Virtual\nCard',          icon: 'card-outline',            color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
];

function ServiceItem({ service, onPress }) {
  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => onPress && onPress(service)}
      activeOpacity={0.75}
    >
      <View style={[styles.iconWrap, { backgroundColor: service.bg }]}>
        <Ionicons name={service.icon} size={26} color={service.color} />
      </View>
      <Text style={styles.label}>{service.label}</Text>
    </TouchableOpacity>
  );
}

export default function ServicesGrid({ onServicePress }) {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Services</Text>
        <TouchableOpacity>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.grid}>
          {SERVICES.map((s) => (
            <ServiceItem key={s.id} service={s} onPress={onServicePress} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: PADDING,
    marginTop: 28,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: '#0B0D1A',
  },
  seeAll: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: '#4A55DD',
  },
  card: {
    backgroundColor: 'rgba(74,85,221,0.06)',
    borderRadius: 20,
    padding: CARD_PADDING,
    // subtle glow
    shadowColor: '#4A55DD',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    rowGap: GAP + 6,
    columnGap: GAP,
  },
  item: {
    width: ITEM_SIZE,
    alignItems: 'center',
  },
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  label: {
    fontFamily: FONTS.bold,
    fontWeight: '700',
    fontSize: 11,
    color: '#0B0D1A',
    textAlign: 'center',
    lineHeight: 14,
  },
});