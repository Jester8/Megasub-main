import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

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
  return (
    <View style={styles.wrapper}>
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
              <View style={[styles.iconArea, isActive && styles.iconAreaActive]}>
                <Feather
                  name={tab.icon}
                  size={22}
                  color={isActive ? '#4A55DD' : 'rgba(11,13,26,0.4)'}
                  strokeWidth={isActive ? 2.4 : 2}
                />
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
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
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 20,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  container: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 12,
    paddingHorizontal: 10,
    elevation: 14,
    shadowColor: '#0B0D1A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
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
  iconAreaActive: {
    backgroundColor: 'rgba(74,85,221,0.12)',
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