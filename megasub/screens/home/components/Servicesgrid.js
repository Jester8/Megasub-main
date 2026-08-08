import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../../contexts/ThemeContext';
import { useResponsive } from '../../../lib/responsive';
import { SERVICES, SERVICE_SCREENS } from '../servicesConfig';

const PADDING = 20;
const CARD_PADDING = 14;
const GAP = 6;
const COLUMNS = 4;

const FONTS = {
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};

function ServiceItem({ service, onPress, itemSize, iconSize, textColor }) {
  const IconComponent = service.iconSet === 'material' ? MaterialCommunityIcons : Ionicons;
  return (
    <TouchableOpacity
      style={[styles.item, { width: itemSize }]}
      onPress={() => onPress && onPress(service)}
      activeOpacity={0.75}
    >
      <View style={[styles.iconWrap, { width: iconSize, height: iconSize, borderRadius: iconSize / 2, backgroundColor: service.bg }]}>
        <IconComponent name={service.icon} size={iconSize * 0.5} color={service.color} />
      </View>
      <Text style={[styles.label, { color: textColor }]}>{service.label}</Text>
    </TouchableOpacity>
  );
}

export default function ServicesGrid({ navigate, onServicePress, onSeeAllPress }) {
  const { colors } = useTheme();
  // Columns are measured against the capped content column, not the screen,
  // or the four items spread across the whole tablet with the icons marooned
  // in the middle of each cell.
  const { isTablet, contentWidth } = useResponsive();
  const isCompact = contentWidth < 360;
  const iconSize = isCompact || isTablet ? 44 : 52;
  const itemSize = (contentWidth - PADDING * 2 - CARD_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

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
        <TouchableOpacity onPress={onSeeAllPress}>
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
    marginTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
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