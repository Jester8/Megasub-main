import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../../../lib/responsive';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

// Expects userData object containing your dashboard payload fields (passed down from navigation/parent context)
export default function WalletCard({ userData, onTopUp }) {
  const [hidden, setHidden] = useState(false);
  const { isTablet } = useResponsive();

  // Safely extract main_wallet balance string and convert it to float (handles "0" string types from API payload)
  const walletBalance = userData?.main_wallet ? parseFloat(userData.main_wallet) : 0.00;
  
  // Safely extract username or fallback safely if missing
  const userAccountIdentifier = userData?.username || 'User Account';

  const formatted = '₦' + walletBalance.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={['#2A35C4', '#4A55DD', '#1E2A9E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, isTablet && styles.cardTablet]}
      >
        {/* Visual background element shapes */}
        <View style={styles.circle1} />
        <View style={styles.circle2} />
        <View style={styles.circle3} />

        <View style={styles.topRow}>
          <View>
            <Text style={styles.cardLabel}>Wallet Balance</Text>
            <View style={styles.balanceRow}>
              <Text style={[styles.balanceText, isTablet && styles.balanceTextTablet]}>
                {hidden ? '₦ ••••••' : formatted}
              </Text>
              <TouchableOpacity onPress={() => setHidden(!hidden)} style={styles.eyeBtn}>
                <Ionicons
                  name={hidden ? 'eye-off-outline' : 'eye-outline'}
                  size={isTablet ? 16 : 18}
                  color="rgba(255,255,255,0.7)"
                />
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.logoMark, isTablet && styles.logoMarkTablet]}>
            <Text style={[styles.logoMarkText, isTablet && styles.logoMarkTextTablet]}>M</Text>
          </View>
        </View>

        <View style={[styles.bottomRow, isTablet && styles.bottomRowTablet]}>
          <View>
            <Text style={styles.acctLabel}>Username</Text>
            <Text style={styles.acctValue}>{userAccountIdentifier}</Text>
          </View>
          <TouchableOpacity style={styles.topUpBtn} onPress={onTopUp} activeOpacity={0.85}>
            <Ionicons name="add" size={isTablet ? 15 : 16} color="#4A55DD" />
            <Text style={styles.topUpText}>Top Up</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    marginTop: 14,
  },
  card: {
    borderRadius: 20,
    padding: 22,
    overflow: 'hidden',
    minHeight: 160,
    justifyContent: 'space-between',
    elevation: 10,
    shadowColor: '#4A55DD',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  // Slides.js pins its image height to this card's minHeight so the two read
  // as one size — keep the tablet values in step there too.
  cardTablet: {
    padding: 18,
    minHeight: 140,
  },
  circle1: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.05)', top: -60, right: -40,
  },
  circle2: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.04)', bottom: -30, left: -20,
  },
  circle3: {
    position: 'absolute', width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.06)', top: 30, right: 80,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  balanceText: {
    fontFamily: FONTS.extrabold,
    fontSize: 26,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  balanceTextTablet: { fontSize: 23 },
  eyeBtn: { padding: 4 },
  logoMark: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  logoMarkTablet: { width: 34, height: 34, borderRadius: 17 },
  logoMarkText: {
    fontFamily: FONTS.extrabold,
    fontSize: 18, color: '#FFFFFF',
  },
  logoMarkTextTablet: { fontSize: 16 },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 24,
  },
  bottomRowTablet: { marginTop: 18 },
  acctLabel: {
    fontFamily: FONTS.regular,
    fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 3,
  },
  acctValue: {
    fontFamily: FONTS.bold,
    fontSize: 13, color: 'rgba(255,255,255,0.85)',
  },
  topUpBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8, gap: 5, elevation: 3,
  },
  topUpText: {
    fontFamily: FONTS.bold, fontSize: 13, color: '#4A55DD',
  },
});