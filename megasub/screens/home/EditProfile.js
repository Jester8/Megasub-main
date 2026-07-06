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
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const BRAND = '#4A55DD';
const USER_KEY = 'megasub_user_data';

export default function EditProfile({ navigate, user }) {
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone_number || '');
  const [loading, setLoading] = useState(false);

  const hasChanges =
    firstName !== (user?.first_name || '') ||
    lastName !== (user?.last_name || '') ||
    email !== (user?.email || '') ||
    phone !== (user?.phone_number || '');

  const handleSave = async () => {
    if (!firstName.trim() || !email.trim()) return;

    setLoading(true);
    try {
      const updatedUser = {
        ...user,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone_number: phone.trim(),
      };

      const response = await fetch('https://YOUR_API_BASE_URL/external/update_profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser),
      });

      // Keep the locally edited fields regardless of remote response shape,
      // since this endpoint is a placeholder until the real API is wired up.
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(updatedUser));

      Alert.alert('Profile Updated', 'Your changes have been saved.');
      navigate && navigate('profile', updatedUser);
    } catch (error) {
      Alert.alert('Network Error', 'Could not save your changes. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

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
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>First Name</Text>
        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            placeholder="First name"
            placeholderTextColor="#9CA0B8"
            value={firstName}
            onChangeText={setFirstName}
          />
        </View>

        <Text style={styles.sectionLabel}>Last Name</Text>
        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            placeholder="Last name"
            placeholderTextColor="#9CA0B8"
            value={lastName}
            onChangeText={setLastName}
          />
        </View>

        <Text style={styles.sectionLabel}>Email Address</Text>
        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#9CA0B8"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <Text style={styles.sectionLabel}>Phone Number</Text>
        <View style={styles.inputCard}>
          <View style={styles.flagWrap}>
            <Text style={styles.flagText}>🇳🇬</Text>
            <Text style={styles.dialCode}>+234</Text>
          </View>
          <View style={styles.inputDivider} />
          <TextInput
            style={styles.input}
            placeholder="803 123 4567"
            placeholderTextColor="#9CA0B8"
            keyboardType="phone-pad"
            maxLength={11}
            value={phone}
            onChangeText={setPhone}
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.continueBtn, (!hasChanges || !firstName.trim() || !email.trim() || loading) && styles.continueBtnDisabled]}
          activeOpacity={0.85}
          onPress={handleSave}
          disabled={!hasChanges || !firstName.trim() || !email.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.continueText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
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

  inputCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1.5, borderColor: '#ECEDF6',
  },
  flagWrap: { flexDirection: 'row', alignItems: 'center' },
  flagText: { fontSize: 18, marginRight: 6 },
  dialCode: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A' },
  inputDivider: { width: 1, height: 22, backgroundColor: '#ECEDF6', marginHorizontal: 12 },
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
