import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { fetchKycStatus } from '../../../lib/api';

const FONTS = {
  medium: 'Montserrat_500Medium',
  bold: 'Montserrat_700Bold',
  extrabold: 'Montserrat_800ExtraBold',
};

// "Complete your KYC" prompt on Home. It stays out of the way until the
// server confirms the user is genuinely unverified: while loading, when KYC is
// switched off or unavailable, on any error, and once verified, nothing shows.
export default function KycBanner({ navigate, refreshSignal }) {
  const [needsKyc, setNeedsKyc] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const json = await fetchKycStatus();
        const data = json?.data || {};
        const verified = data.verified === true || data.status === 'verified';
        const enabled = data.settings?.enabled !== false;
        if (!cancelled) setNeedsKyc(!verified && enabled);
      } catch (error) {
        if (!cancelled) setNeedsKyc(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSignal]);

  if (!needsKyc) return null;

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={() => navigate && navigate('kyc')} style={styles.wrap}>
      <LinearGradient
        colors={['#7C3AED', '#4A55DD', '#0EA5E9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.circleLarge} />
        <View style={styles.circleSmall} />

        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark" size={26} color="#FFFFFF" />
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.title}>Complete your KYC</Text>
          <Text style={styles.subtitle}>Verify your identity to unlock virtual cards and more.</Text>
        </View>

        <View style={styles.arrow}>
          <Ionicons name="arrow-forward" size={18} color="#4A55DD" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    shadowColor: '#4A55DD',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
  },
  circleLarge: {
    position: 'absolute',
    right: -30,
    top: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  circleSmall: {
    position: 'absolute',
    right: 50,
    bottom: -35,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textWrap: { flex: 1, paddingRight: 10 },
  title: { fontFamily: FONTS.extrabold, fontSize: 15.5, color: '#FFFFFF', marginBottom: 3 },
  subtitle: { fontFamily: FONTS.medium, fontSize: 12, lineHeight: 17, color: 'rgba(255,255,255,0.88)' },
  arrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
