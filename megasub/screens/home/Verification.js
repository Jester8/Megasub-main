import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const BRAND = '#4A55DD';

const ID_TYPES = [
  { id: 'bvn', label: 'BVN' },
  { id: 'nin', label: 'NIN' },
];

export default function Verification({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const status = user?.kyc_status || 'pending';
  const [idType, setIdType] = useState(ID_TYPES[0]);
  const [idNumber, setIdNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (idNumber.trim().length < 10) return;

    setLoading(true);
    try {
      const payload = {
        user_id: "9ccf0fe6-b32e-4672-9b63-65217a170220",
        id_type: idType.id,
        id_number: idNumber.trim(),
      };

      const response = await fetch('https://YOUR_API_BASE_URL/external/submit_kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await response.json();

      if (response.ok) {
        Alert.alert('Submitted', 'Your verification details have been submitted for review.');
        navigate && navigate('profile');
      } else {
        Alert.alert('Submission Failed', json.message || 'Please check your details and try again.');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not submit your details. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const isVerified = status === 'verified';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card }]}
          onPress={() => navigate && navigate('profile')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>KYC Verification</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.statusCard, isVerified ? styles.statusCardVerified : styles.statusCardPending]}>
          <View style={[styles.statusIconWrap, { backgroundColor: isVerified ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)' }]}>
            <Ionicons
              name={isVerified ? 'shield-checkmark' : 'time-outline'}
              size={22}
              color={isVerified ? '#10B981' : '#F59E0B'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusTitle, { color: colors.text }]}>{isVerified ? 'Verified' : 'Not Verified'}</Text>
            <Text style={[styles.statusSub, { color: colors.textMuted }]}>
              {isVerified
                ? 'Your identity has been verified successfully.'
                : 'Submit your BVN or NIN to verify your identity and unlock higher transaction limits.'}
            </Text>
          </View>
        </View>

        {!isVerified && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ID Type</Text>
            <View style={styles.typeRow}>
              {ID_TYPES.map((t) => {
                const active = idType.id === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.typeCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                      active && styles.typeCardActive,
                    ]}
                    onPress={() => setIdType(t)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.typeLabel, { color: colors.text }, active && styles.typeLabelActive]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{idType.label} Number</Text>
            <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={`Enter your ${idType.label}`}
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                maxLength={11}
                value={idNumber}
                onChangeText={setIdNumber}
              />
            </View>
          </>
        )}
      </ScrollView>

      {!isVerified && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.continueBtn, (idNumber.trim().length < 10 || loading) && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleSubmit}
            disabled={idNumber.trim().length < 10 || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.continueText}>Submit for Verification</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FC' },
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
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#0B0D1A',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 16, color: '#0B0D1A' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },
  sectionLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: '#6B7088', marginTop: 22, marginBottom: 10 },

  statusCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: 18, padding: 16, borderWidth: 1.5,
  },
  statusCardPending: { backgroundColor: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.25)' },
  statusCardVerified: { backgroundColor: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.25)' },
  statusIconWrap: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontFamily: FONTS.bold, fontSize: 14.5, color: '#0B0D1A', marginBottom: 4 },
  statusSub: { fontFamily: FONTS.regular, fontSize: 12.5, color: 'rgba(11,13,26,0.55)', lineHeight: 18 },

  typeRow: { flexDirection: 'row', gap: 10 },
  typeCard: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#ECEDF6',
  },
  typeCardActive: { borderColor: BRAND, backgroundColor: 'rgba(74,85,221,0.06)' },
  typeLabel: { fontFamily: FONTS.bold, fontSize: 13.5, color: '#0B0D1A' },
  typeLabelActive: { color: BRAND },

  inputCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1.5, borderColor: '#ECEDF6',
  },
  input: { flex: 1, fontFamily: FONTS.semibold, fontSize: 15, color: '#0B0D1A' },

  footer: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#F7F8FC' },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: BRAND, borderRadius: 18, height: 56, gap: 8,
    shadowColor: BRAND, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  continueBtnDisabled: { backgroundColor: '#B7BCEF', shadowOpacity: 0, elevation: 0 },
  continueText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },
});
