import React, { useState, useRef } from 'react';
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

const EXAM_TYPES = [
  { id: 'waec', label: 'WAEC', sub: 'Result Checker PIN', price: 3500 },
  { id: 'neco', label: 'NECO', sub: 'Result Checker PIN', price: 3000 },
];

const QUANTITIES = [1, 2, 3, 4, 5];

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

export default function Waec({ navigate }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState('input');

  const [selectedExam, setSelectedExam] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [phone, setPhone] = useState('');

  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const totalAmount = selectedExam ? selectedExam.price * quantity : 0;

  const handleFormSubmit = () => {
    if (!selectedExam || !phone) return;
    setStep('confirm');
  };

  const handleBuyPin = async () => {
    if (pin.length < 4) return;

    setLoading(true);
    try {
      const cleanedPhone = phone.replace(/\s+/g, '');
      const formattedPhone = cleanedPhone.startsWith('0') ? cleanedPhone : `0${cleanedPhone}`;

      const payload = {
        exam_type: selectedExam.id,
        user_id: "9ccf0fe6-b32e-4672-9b63-65217a170220",
        phone_number: formattedPhone,
        quantity,
        pin: pin,
        amount: String(totalAmount),
      };

      const response = await fetch('https://YOUR_API_BASE_URL/external/buy_exam_pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await response.json();

      if (response.ok) {
        Alert.alert('Success 🎉', 'Exam PIN purchase processing complete.');
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
          {step === 'input' ? 'WAEC / NECO' : 'Confirm Transaction'}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {step === 'input' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>Select Exam Type</Text>
          <View style={styles.examRow}>
            {EXAM_TYPES.map((e) => {
              const active = selectedExam?.id === e.id;
              return (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.examCard, active && styles.examCardActive]}
                  onPress={() => setSelectedExam(e)}
                  activeOpacity={0.8}
                >
                  <View style={styles.examIconWrap}>
                    <Ionicons name="school-outline" size={22} color={active ? BRAND : '#6B7088'} />
                  </View>
                  <Text style={[styles.examLabel, active && styles.examLabelActive]}>{e.label}</Text>
                  <Text style={styles.examSub}>{e.sub}</Text>
                  <Text style={[styles.examPrice, active && styles.examLabelActive]}>₦{e.price}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Quantity</Text>
          <View style={styles.quickAmountWrap}>
            {QUANTITIES.map((q) => {
              const active = quantity === q;
              return (
                <TouchableOpacity
                  key={q}
                  style={[styles.quickChip, active && styles.quickChipActive]}
                  onPress={() => setQuantity(q)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>
                    {q}
                  </Text>
                </TouchableOpacity>
              );
            })}
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

          {selectedExam ? (
            <Text style={styles.totalHint}>
              {quantity} PIN{quantity > 1 ? 's' : ''} • Total ₦{totalAmount}
            </Text>
          ) : null}
        </ScrollView>
      ) : (
        <View style={styles.confirmContent}>
          <Text style={styles.sectionLabel}>Transaction Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Exam Type</Text>
              <Text style={styles.summaryValue}>{selectedExam?.label}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Quantity</Text>
              <Text style={styles.summaryValue}>{quantity}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Phone</Text>
              <Text style={styles.summaryValue}>{phone}</Text>
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
            style={[styles.continueBtn, (!selectedExam || !phone) && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleFormSubmit}
            disabled={!selectedExam || !phone}
          >
            <Text style={styles.continueText}>Continue</Text>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.continueBtn, (pin.length < 4 || loading) && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleBuyPin}
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

  examRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  examCard: {
    flexBasis: '48%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 1.5, borderColor: '#ECEDF6',
  },
  examCardActive: { borderColor: BRAND, backgroundColor: 'rgba(74,85,221,0.06)' },
  examIconWrap: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(74,85,221,0.08)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  examLabel: { fontFamily: FONTS.bold, fontSize: 15, color: '#0B0D1A' },
  examLabelActive: { color: BRAND },
  examSub: { fontFamily: FONTS.regular, fontSize: 11, color: '#9CA0B8', marginTop: 2, marginBottom: 8 },
  examPrice: { fontFamily: FONTS.bold, fontSize: 13, color: '#0B0D1A' },

  quickAmountWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#ECEDF6', alignItems: 'center', justifyContent: 'center' },
  quickChipActive: { backgroundColor: BRAND, borderColor: BRAND },
  quickChipText: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A' },
  quickChipTextActive: { color: '#FFFFFF' },

  inputCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1.5, borderColor: '#ECEDF6',
  },
  flagWrap: { flexDirection: 'row', alignItems: 'center' },
  flagText: { fontSize: 18, marginRight: 6 },
  dialCode: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A' },
  inputDivider: { width: 1, height: 22, backgroundColor: '#ECEDF6', marginHorizontal: 12 },
  input: { flex: 1, fontFamily: FONTS.semibold, fontSize: 15, color: '#0B0D1A' },

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

  footer: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#F7F8FC' },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: BRAND, borderRadius: 18, height: 56, gap: 8,
    shadowColor: BRAND, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  continueBtnDisabled: { backgroundColor: '#B7BCEF', shadowOpacity: 0, elevation: 0 },
  continueText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },
});
