import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';

const FONTS = {
  medium: 'Manrope_500Medium',
  bold: 'Manrope_700Bold',
};

const TABS = [
  { id: 'home',    label: 'Home',    icon: 'home' },
  { id: 'history', label: 'History', icon: 'file-text' },
  { id: 'wallet',  label: 'Wallet',  icon: 'credit-card' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

export default function BottomNav({ activeTab, onTabPress }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + 14, backgroundColor: colors.card, borderTopColor: colors.divider }]}>
      <View style={styles.container}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tab}
              onPress={() => onTabPress && onTabPress(tab.id)}
              activeOpacity={0.75}
            >
              <View style={styles.iconArea}>
                <Feather
                  name={tab.icon}
                  size={22}
                  color={isActive ? colors.brand : colors.textFaint}
                  fill={isActive ? colors.brand : 'none'}
                  strokeWidth={isActive ? 2.4 : 2}
                />
              </View>
              <Text style={[styles.tabLabel, { color: isActive ? colors.brand : colors.textFaint }, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(11,13,26,0.08)',
  },
  container: {
    flexDirection: 'row',
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  iconArea: {
    width: 42,
    height: 34,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: 'rgba(11,13,26,0.4)',
  },
  tabLabelActive: {
    fontFamily: FONTS.bold,
    color: '#4A55DD',
  },
});