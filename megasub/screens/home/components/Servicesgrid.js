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
import { SERVICES, HOME_SERVICES, SERVICE_SCREENS } from '../servicesConfig';

const PADDING = 20;
const CARD_PADDING = 12;
const GAP = 6;
const COLUMNS = 4;

const FONTS = {
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
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

// Services laid out four to a card, with a gap between cards. Shared by Home
// (the first eight, with a "See all" link) and the "See all" page (every
// service).
function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export function ServiceGrid({ services, navigate, onServicePress, onSeeAllPress, showSeeAll = false }) {
  const { colors } = useTheme();
  // Columns are measured against the capped content column, not the screen,
  // or the four items spread across the whole tablet with the icons marooned
  // in the middle of each cell.
  const { isTablet, contentWidth } = useResponsive();
  const isCompact = contentWidth < 360;
  const iconSize = isCompact || isTablet ? 44 : 48;
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
      {showSeeAll ? (
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={onSeeAllPress}>
            <Text style={[styles.seeAll, colors.mode === 'dark' && { color: '#FFFFFF' }]}>See all services</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {chunk(services, COLUMNS).map((row, i) => (
        <View
          key={i}
          style={[
            styles.card,
            { backgroundColor: colors.cardAlt },
            Platform.OS === 'android' && { backgroundColor: colors.card },
            i > 0 && styles.cardGap,
          ]}
        >
          <View style={styles.grid}>
            {row.map((s) => (
              <ServiceItem key={s.id} service={s} onPress={handlePress} itemSize={itemSize} iconSize={iconSize} textColor={colors.text} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export function AllServicesGrid({ navigate }) {
  return <ServiceGrid services={SERVICES} navigate={navigate} />;
}

export default function ServicesGrid({ navigate, onServicePress, onSeeAllPress }) {
  return (
    <ServiceGrid
      services={HOME_SERVICES}
      navigate={navigate}
      onServicePress={onServicePress}
      onSeeAllPress={onSeeAllPress}
      showSeeAll
    />
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: PADDING,
    marginTop: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 6,
  },
  seeAll: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: '#4A55DD',
  },
  cardGap: { marginTop: 14 },
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

    fontSize: 11,
    color: '#0B0D1A',
    textAlign: 'center',
    lineHeight: 14,
  },
});