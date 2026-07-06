import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FONTS = {
  regular: 'Manrope_400Regular',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: 'By creating an account or using Megasub, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, please discontinue use of the app.',
  },
  {
    title: '2. Account Responsibility',
    body: 'You are responsible for maintaining the confidentiality of your login credentials and transaction PIN. Notify us immediately of any unauthorized use of your account.',
  },
  {
    title: '3. Wallet & Transactions',
    body: 'Funds credited to your wallet are held for the purpose of purchasing airtime, data, and bill payments through the app. Transactions are final once successfully processed.',
  },
  {
    title: '4. Data We Collect',
    body: 'We collect information you provide directly (such as name, email, and phone number) and transaction data necessary to provide our services. We do not sell your personal data to third parties.',
  },
  {
    title: '5. Data Security',
    body: 'We use industry-standard encryption to protect your data in transit and at rest. Your transaction PIN and password are never stored in plain text.',
  },
  {
    title: '6. Changes to These Terms',
    body: 'We may update these terms from time to time. Continued use of the app after changes take effect constitutes acceptance of the revised terms.',
  },
];

export default function TermsPrivacy({ navigate }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigate && navigate('profile')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color="#0B0D1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Privacy Policy</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Last updated: January 2026</Text>
        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
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
  updated: { fontFamily: FONTS.regular, fontSize: 11.5, color: '#9CA0B8', marginBottom: 20 },

  section: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12 },
  sectionTitle: { fontFamily: FONTS.bold, fontSize: 13.5, color: '#0B0D1A', marginBottom: 8 },
  sectionBody: { fontFamily: FONTS.regular, fontSize: 12.5, color: 'rgba(11,13,26,0.6)', lineHeight: 19 },
});
