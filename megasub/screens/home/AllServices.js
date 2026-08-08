import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { SERVICES, SERVICE_SCREENS, isComingSoon } from './servicesConfig';

const FONTS = {
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};

export default function AllServices({ navigate }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const handlePress = (service) => {
    const target = SERVICE_SCREENS[service.id];
    if (target && navigate) navigate(target);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card }]}
          onPress={() => navigate && navigate('home')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>All Services</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {SERVICES.map((service) => {
          const IconComponent = service.iconSet === 'material' ? MaterialCommunityIcons : Ionicons;
          const soon = isComingSoon(service.id);
          return (
            <TouchableOpacity
              key={service.id}
              style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handlePress(service)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconWrap, { backgroundColor: service.bg }]}>
                <IconComponent name={service.icon} size={22} color={service.color} />
              </View>
              <Text style={[styles.label, { color: colors.text }]}>
                {service.label.replace('\n', ' ')}
              </Text>
              {soon ? (
                <View style={styles.soonBadge}>
                  <Text style={styles.soonBadgeText}>Soon</Text>
                </View>
              ) : null}
              <Feather name="chevron-right" size={18} color={colors.textFaint} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#0B0D1A',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 16 },
  list: { paddingHorizontal: 20, paddingBottom: 30, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, fontFamily: FONTS.semibold, fontSize: 14 },
  soonBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  soonBadgeText: { fontFamily: FONTS.semibold, fontSize: 10.5, color: '#F59E0B' },
});
