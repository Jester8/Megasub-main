import React, { useState, useRef, useMemo } from 'react';
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
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const BRAND = '#4A55DD';

const NETWORKS = [
  { id: 'mtn', label: 'MTN', color: '#FFC700', uuid: '9c29efbb-0062-4f47-9e64-92ff101274d5' },
  { id: 'airtel', label: 'Airtel', color: '#FF1E1E', uuid: 'YOUR_AIRTEL_UUID_HERE' },
  { id: '9mobile', label: '9mobile', color: '#0B6E4F', uuid: 'YOUR_9MOBILE_UUID_HERE' },
  { id: 'glo', label: 'Glo', color: '#3FA535', uuid: 'YOUR_GLO_UUID_HERE' },
];

const QUICK_AMOUNTS = [100, 200, 300, 500, 1000, 1500, 2000, 5000];

function CustomPinInput({ onPinComplete }) {
  const [code, setCode] = useState(['', '', '', '']);
  const inputs = useRef([]);

  const handleChangeText = (text, index) => {
    const newCode = [...code];
    const cleanText = text.slice(-1);
    newCode[index] = cleanText;
    setCode(newCode);

    onPinComplete(newCode.join(''));

    if (cleanText && index < 3) {
      inputs.current[index + 1].focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1].focus();
    }
  };

  return (
    <View style={styles.otpContainer}>
      {code.map((digit, index) => (
        <TextInput
          key={index}
          ref={(ref) => (inputs.current[index] = ref)}
          style={[styles.otpInputBox, digit ? styles.otpInputFilled : null]}
          keyboardType="number-pad"
          maxLength={1}
          secureTextEntry={true}
          value={digit}
          onChangeText={(text) => handleChangeText(text, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          textAlign="center"
        />
      ))}
    </View>
  );
}

export default function Bulk({ navigate }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState('input');

  const [selectedNetwork, setSelectedNetwork] = useState(NETWORKS[0]);
  const [numbersText, setNumbersText] = useState('');
  const [amount, setAmount] = useState('');

  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const recipients = useMemo(
    () => numbersText.split('\n').map((n) => n.trim()).filter(Boolean),
    [numbersText]
  );

  const totalAmount = recipients.length * (parseInt(amount, 10) || 0);

  const handleFormSubmit = () => {
    if (!selectedNetwork || recipients.length === 0 || !amount) return;
    setStep('confirm');
  };

  const handleBulkRecharge = async () => {
    if (pin.length < 4) return;

    setLoading(true);
    try {
      const payload = {
        network_id: selectedNetwork.uuid,
        user_id: "9ccf0fe6-b32e-4672-9b63-65217a170220",
        phone_numbers: recipients,
        pin: pin,
        amount: String(amount),
      };

      const response = await fetch('https://YOUR_API_BASE_URL/external/bulk_recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await response.json();

      if (response.ok) {
        Alert.alert('Success 🎉', 'Bulk recharge processing complete.');
        navigate && navigate('home');
      } else {
        Alert.alert('Transaction Failed', json.message || 'Please check your information and PIN.');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not establish connection to the payment processing servers.');
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
          onPress={() => (step === 'confirm' ? setStep('input') : (navigate && navigate('home')))}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color="#0B0D1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 'input' ? 'Bulk Recharge' : 'Confirm Transaction'}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {step === 'input' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.networkRow}>
            {NETWORKS.map((n) => {
              const active = selectedNetwork.id === n.id;
              return (
                <TouchableOpacity
                  key={n.id}
                  style={[styles.networkCard, active && styles.networkCardActive]}
                  onPress={() => setSelectedNetwork(n)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.networkIconWrap, { backgroundColor: n.color }]}>
                    <Ionicons name="call" size={18} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.networkCardLabel, active && styles.networkCardLabelActive]}>
                    {n.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.numbersCard}>
            <View style={styles.numbersTopRow}>
              <Text style={styles.dialCode}>+234</Text>
              <TouchableOpacity style={styles.contactBtn} activeOpacity={0.75}>
                <Ionicons name="person-outline" size={16} color="#0B0D1A" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.numbersInput}
              placeholder={'803 123 4567\n802 987 6543\n...'}
              placeholderTextColor="#9CA0B8"
              keyboardType="phone-pad"
              multiline
              textAlignVertical="top"
              value={numbersText}
              onChangeText={setNumbersText}
            />
          </View>

          <View style={styles.helperRow}>
            <Feather name="info" size={13} color="#9CA0B8" />
            <Text style={styles.helperText}>Enter each number on a line, separated by Enter key</Text>
          </View>

          <View style={styles.inputCard}>
            <Text style={styles.nairaSign}>₦</Text>
            <View style={styles.inputDivider} />
            <TextInput
              style={styles.input}
              placeholder="Enter Amount"
              placeholderTextColor="#9CA0B8"
              keyboardType="number-pad"
              value={amount}
              onChangeText={setAmount}
            />
          </View>

          <View style={styles.quickAmountWrap}>
            {QUICK_AMOUNTS.map((a) => {
              const active = amount === String(a);
              return (
                <TouchableOpacity
                  key={a}
                  style={[styles.quickChip, active && styles.quickChipActive]}
                  onPress={() => setAmount(String(a))}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>
                    ₦{a}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {recipients.length > 0 && amount ? (
            <Text style={styles.totalHint}>
              {recipients.length} recipient{recipients.length > 1 ? 's' : ''} • Total ₦{totalAmount}
            </Text>
          ) : null}
        </ScrollView>
      ) : (
        <View style={styles.confirmContent}>
          <Text style={styles.sectionLabel}>Transaction Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Network</Text>
              <Text style={styles.summaryValue}>{selectedNetwork.label}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Recipients</Text>
              <Text style={styles.summaryValue}>{recipients.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount Each</Text>
              <Text style={styles.summaryValue}>₦{amount}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Cost</Text>
              <Text style={[styles.summaryValue, { color: BRAND, fontFamily: FONTS.bold }]}>₦{totalAmount}</Text>
            </View>
          </View>

          <Text style={styles.pinInstructionText}>Enter 4-Digit Security PIN</Text>
          <CustomPinInput onPinComplete={(text) => setPin(text)} />
        </View>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {step === 'input' ? (
          <TouchableOpacity
            style={[styles.continueBtn, (recipients.length === 0 || !amount) && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleFormSubmit}
            disabled={recipients.length === 0 || !amount}
          >
            <Text style={styles.continueText}>Continue</Text>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.continueBtn, (pin.length < 4 || loading) && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleBulkRecharge}
            disabled={pin.length < 4 || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.continueText}>Pay ₦{totalAmount}</Text>
                <Feather name="shield" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        )}
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
    paddingTop: 18,
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
  confirmContent: { paddingHorizontal: 20, paddingTop: 10 },
  sectionLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: '#6B7088', marginTop: 22, marginBottom: 10 },

  networkRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  networkCard: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 16,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#ECEDF6',
  },
  networkCardActive: { borderColor: BRAND, backgroundColor: 'rgba(74,85,221,0.06)' },
  networkIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  networkCardLabel: { fontFamily: FONTS.semibold, fontSize: 11.5, color: '#0B0D1A' },
  networkCardLabelActive: { color: BRAND },

  numbersCard: {
    backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1.5, borderColor: '#ECEDF6',
    padding: 16, minHeight: 170,
  },
  numbersTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dialCode: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A' },
  contactBtn: {
    width: 30, height: 30, borderRadius: 8, borderWidth: 1.5, borderColor: '#ECEDF6',
    alignItems: 'center', justifyContent: 'center',
  },
  numbersInput: { flex: 1, fontFamily: FONTS.medium, fontSize: 14, color: '#0B0D1A', minHeight: 120 },

  helperRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  helperText: { fontFamily: FONTS.regular, fontSize: 11.5, color: '#9CA0B8', flex: 1 },

  inputCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1.5, borderColor: '#ECEDF6',
    marginTop: 18,
  },
  nairaSign: { fontFamily: FONTS.bold, fontSize: 16, color: BRAND },
  inputDivider: { width: 1, height: 22, backgroundColor: '#ECEDF6', marginHorizontal: 12 },
  input: { flex: 1, fontFamily: FONTS.semibold, fontSize: 15, color: '#0B0D1A' },
  quickAmountWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  quickChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#ECEDF6' },
  quickChipActive: { backgroundColor: BRAND, borderColor: BRAND },
  quickChipText: { fontFamily: FONTS.semibold, fontSize: 12, color: '#0B0D1A' },
  quickChipTextActive: { color: '#FFFFFF' },

  totalHint: { fontFamily: FONTS.semibold, fontSize: 12.5, color: BRAND, marginTop: 18, textAlign: 'center' },

  summaryCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: '#ECEDF6', marginBottom: 30,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  summaryLabel: { fontFamily: FONTS.medium, fontSize: 13, color: '#6B7088' },
  summaryValue: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A' },
  pinInstructionText: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A', textAlign: 'center', marginBottom: 16 },

  otpContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '80%', alignSelf: 'center', marginVertical: 10, gap: 12 },
  otpInputBox: { width: 50, height: 50, borderWidth: 2, borderColor: '#ECEDF6', borderRadius: 12, fontSize: 20, fontWeight: '700', color: '#0B0D1A', backgroundColor: '#FFFFFF' },
  otpInputFilled: { borderColor: BRAND },

  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18, backgroundColor: '#F7F8FC' },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: BRAND, borderRadius: 18, height: 56, gap: 8,
    shadowColor: BRAND, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  continueBtnDisabled: { backgroundColor: '#B7BCEF', shadowOpacity: 0, elevation: 0 },
  continueText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },
});
