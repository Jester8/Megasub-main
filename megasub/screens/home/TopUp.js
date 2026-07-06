import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const BRAND = '#4A55DD';

const ACCOUNTS = [
  { id: '1', bank: 'SAFEHAVEN MFB', name: 'MEGA-SUB Lambano', number: '8011410562' },
  { id: '2', bank: 'ACCESS BANK PLC', name: 'CRYSTALPAY-DOULOS MEGASUB LAMBANO', number: '1820816589' },
  { id: '3', bank: 'WEMA BANK', name: 'CrystalPay-MEGA-SUBDoulosLambano', number: '7178154518' },
];

function AccountCard({ account }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(account.number);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>
        Bank Name: <Text style={styles.value}>{account.bank}</Text>
      </Text>
      <Text style={styles.label}>
        Account Name: <Text style={styles.value}>{account.name}</Text>
      </Text>
      <View style={styles.numberRow}>
        <Text style={styles.label}>
          Account Number: <Text style={styles.value}>{account.number}</Text>
        </Text>
        <TouchableOpacity onPress={handleCopy} activeOpacity={0.7} style={styles.copyBtn}>
          <Feather name={copied ? 'check' : 'copy'} size={15} color={BRAND} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function TopUp({ navigate }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigate && navigate('home')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color="#0B0D1A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Top-up Balance</Text>
        <Text style={styles.subtitle}>
          To top-up your wallet balance, Transfer the amount you want to recharge to the account details provided below. Your account will be credited in minutes.
        </Text>

        {ACCOUNTS.map((account) => (
          <AccountCard key={account.id} account={account} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FC' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
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
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30 },
  title: { fontFamily: FONTS.extrabold, fontWeight: '800', fontSize: 20, color: '#0B0D1A', marginBottom: 10 },
  subtitle: { fontFamily: FONTS.regular, fontSize: 13, color: 'rgba(11,13,26,0.55)', lineHeight: 20, marginBottom: 22 },

  card: {
    backgroundColor: 'rgba(74,85,221,0.06)', borderRadius: 16, padding: 16, marginBottom: 14,
  },
  label: { fontFamily: FONTS.semibold, fontSize: 12.5, color: '#0B0D1A', marginBottom: 8, lineHeight: 18 },
  value: { fontFamily: FONTS.bold, color: '#0B0D1A' },
  numberRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  copyBtn: { padding: 4, marginLeft: 8 },
});
