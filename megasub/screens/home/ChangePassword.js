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

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const BRAND = '#4A55DD';

function PasswordField({ label, value, onChangeText, placeholder }) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.inputCard}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#9CA0B8"
          secureTextEntry={!visible}
          value={value}
          onChangeText={onChangeText}
        />
        <TouchableOpacity onPress={() => setVisible(!visible)} activeOpacity={0.7}>
          <Feather name={visible ? 'eye-off' : 'eye'} size={18} color="#9CA0B8" />
        </TouchableOpacity>
      </View>
    </>
  );
}

export default function ChangePassword({ navigate }) {
  const insets = useSafeAreaInsets();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = currentPassword.length > 0 && newPassword.length >= 8 && passwordsMatch;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setLoading(true);
    try {
      const payload = {
        user_id: "9ccf0fe6-b32e-4672-9b63-65217a170220",
        current_password: currentPassword,
        new_password: newPassword,
      };

      const response = await fetch('https://YOUR_API_BASE_URL/external/change_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await response.json();

      if (response.ok) {
        Alert.alert('Password Updated', 'Your password has been changed.');
        navigate && navigate('profile');
      } else {
        Alert.alert('Update Failed', json.message || 'Please check your current password and try again.');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not update your password. Please try again.');
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
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <PasswordField
          label="Current Password"
          placeholder="Enter current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />
        <PasswordField
          label="New Password"
          placeholder="At least 8 characters"
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <PasswordField
          label="Confirm New Password"
          placeholder="Re-enter new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        {confirmPassword.length > 0 && !passwordsMatch ? (
          <Text style={styles.errorText}>New password and confirmation don't match</Text>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.continueBtn, (!canSubmit || loading) && styles.continueBtnDisabled]}
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={!canSubmit || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.continueText}>Update Password</Text>
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
  input: { flex: 1, fontFamily: FONTS.semibold, fontSize: 15, color: '#0B0D1A' },

  errorText: { fontFamily: FONTS.medium, fontSize: 12.5, color: '#EF4444', textAlign: 'center', marginTop: 18 },

  footer: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#F7F8FC' },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: BRAND, borderRadius: 18, height: 56, gap: 8,
    shadowColor: BRAND, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  continueBtnDisabled: { backgroundColor: '#B7BCEF', shadowOpacity: 0, elevation: 0 },
  continueText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },
});
