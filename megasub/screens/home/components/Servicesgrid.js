import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../contexts/ThemeContext';

const PADDING = 20;
const CARD_PADDING = 14;
const GAP = 6;
const COLUMNS = 4;

const FONTS = {
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};

const SERVICES = [
  { id: 'airtime',      label: 'Airtime',      icon: 'call-outline',            color: '#4A55DD', bg: 'rgba(74,85,221,0.1)' },
  { id: 'data',         label: 'Data',         icon: 'wifi-outline',            color: '#00C9A7', bg: 'rgba(0,201,167,0.1)' },
  { id: 'electricity',  label: 'Electricity',  icon: 'flash-outline',           color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  { id: 'cable',        label: 'Cable TV',     icon: 'tv-outline',              color: '#EC4899', bg: 'rgba(236,72,153,0.1)' },
  { id: 'bulk-sms',     label: 'Bulk\nRecharge', icon: 'phone-portrait-outline', color: '#7C3AED', bg: 'rgba(124,58,237,0.1)' },
  { id: 'bulk-data',    label: 'Bulk Data',    icon: 'globe-outline',           color: '#06B6D4', bg: 'rgba(6,182,212,0.1)' },
  { id: 'waec',         label: 'WAEC /\nNECO', icon: 'school-outline',          color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  { id: 'virtual-card', label: 'Virtual\nCard', icon: 'card-outline',           color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
];

// Maps a service id to the screen name used in App.js's `screen` state.
// Services without an entry here don't have a screen built yet, so tapping
// them is a no-op until one is added.
const SERVICE_SCREENS = {
  airtime: 'airtime',
  data: 'data',
  cable: 'cable',
  electricity: 'electricity',
  'bulk-sms': 'bulk',
  waec: 'waec',
};

function ServiceItem({ service, onPress, itemSize, iconSize, textColor }) {
  return (
    <TouchableOpacity
      style={[styles.item, { width: itemSize }]}
      onPress={() => onPress && onPress(service)}
      activeOpacity={0.75}
    >
      <View style={[styles.iconWrap, { width: iconSize, height: iconSize, borderRadius: iconSize / 2, backgroundColor: service.bg }]}>
        <Ionicons name={service.icon} size={iconSize * 0.5} color={service.color} />
      </View>
      <Text style={[styles.label, { color: textColor }]}>{service.label}</Text>
    </TouchableOpacity>
  );
}

export default function ServicesGrid({ navigate, onServicePress }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isCompact = width < 360;
  const iconSize = isCompact ? 44 : 52;
  const itemSize = (width - PADDING * 2 - CARD_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  const handlePress = (service) => {
    if (onServicePress) {
      onServicePress(service);
      return;
    }
    const target = SERVICE_SCREENS[service.id];
    if (target && navigate) {
      navigate(target);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Services</Text>
        <TouchableOpacity>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.cardAlt }, Platform.OS === 'android' && { backgroundColor: colors.card }]}>
        <View style={styles.grid}>
          {SERVICES.map((s) => (
            <ServiceItem key={s.id} service={s} onPress={handlePress} itemSize={itemSize} iconSize={iconSize} textColor={colors.text} />
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
    borderRadius: 20,
    padding: CARD_PADDING,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    rowGap: GAP + 6,
    columnGap: GAP,
  },
  item: {
    alignItems: 'center',
  },
  iconWrap: {
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