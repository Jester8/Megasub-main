import React, { useState, useRef, useEffect } from 'react';
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
import { fetchNetworks, fetchProductPlans, buyAirtime } from '../../../lib/api';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const BRAND = '#4A55DD';

const NETWORK_COLORS = {
  MTN: '#FFC700',
  AIRTEL: '#FF1E1E',
  '9MOBILE': '#0B6E4F',
  GLO: '#3FA535',
};

const QUICK_AMOUNTS = [100, 200, 300, 500, 1000, 1500, 2000, 5000];

// Custom, zero-dependency OTP input inside the same file for robustness on Expo
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

export default function Airtime({ navigate, user }) {
  const insets = useSafeAreaInsets();

  // Step Workflow Toggle: 'input' (Form screen) or 'confirm' (Pin screen)
  const [step, setStep] = useState('input');

  // Catalog State
  const [networks, setNetworks] = useState([]);
  const [loadingNetworks, setLoadingNetworks] = useState(true);
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // Form States
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');

  // Auth States
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadNetworks();
  }, []);

  useEffect(() => {
    if (selectedNetwork) loadPlans(selectedNetwork.id);
  }, [selectedNetwork]);

  const loadNetworks = async () => {
    setLoadingNetworks(true);
    try {
      const json = await fetchNetworks(user?.id);
      const list = json.data || [];
      setNetworks(list);
      if (list.length > 0) setSelectedNetwork(list[0]);
    } catch (error) {
      Alert.alert('Network Error', error.message || 'Could not load networks.');
    } finally {
      setLoadingNetworks(false);
    }
  };

  const loadPlans = async (networkId) => {
    setLoadingPlans(true);
    setSelectedPlan(null);
    try {
      const json = await fetchProductPlans({ userId: user?.id, productSlug: 'airtime', networkId });
      const list = json.data || [];
      setPlans(list);
      if (list.length > 0) setSelectedPlan(list[0]);
    } catch (error) {
      Alert.alert('Network Error', error.message || 'Could not load airtime plans.');
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleFormSubmit = () => {
    if (!selectedNetwork || !selectedPlan || !phone || !amount) return;
    setStep('confirm');
  };

  const handleBuyAirtime = async () => {
    if (pin.length < 4) return;

    setLoading(true);
    try {
      const cleanedPhone = phone.replace(/\s+/g, '');
      const formattedPhone = cleanedPhone.startsWith('0') ? cleanedPhone : `0${cleanedPhone}`;

      const payload = {
        network_id: selectedNetwork.id,
        user_id: user?.id,
        phone_number: formattedPhone,
        product_plan_id: selectedPlan.product_plan_id,
        pin,
        amount: String(amount),
        validatephonenetwork: 0,
      };

      await buyAirtime(payload);
      Alert.alert('Success 🎉', 'Airtime purchase processing complete.');
      navigate && navigate('home');
    } catch (error) {
      Alert.alert('Transaction Failed', error.message || 'Please check your information and PIN.');
    } finally {
      setLoading(false);
    }
  };

  const canContinue = !!(selectedNetwork && selectedPlan && phone && amount);

  return (
    <View style={styles.screen}>
      {/* Dynamic Navigation Header depending on active layout workflow block */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => step === 'confirm' ? setStep('input') : (navigate && navigate('home'))}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color="#0B0D1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 'input' ? 'Airtime Recharge' : 'Confirm Transaction'}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {step === 'input' ? (
        /* ================= STEP 1: INPUT DATA SELECTION VIEW ================= */
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>Select Network</Text>
          {loadingNetworks ? (
            <ActivityIndicator color={BRAND} style={{ marginTop: 10 }} />
          ) : (
            <View style={styles.networkRow}>
              {networks.map((n) => {
                const active = selectedNetwork?.id === n.id;
                const color = NETWORK_COLORS[n.network_name?.toUpperCase()] || BRAND;
                return (
                  <TouchableOpacity
                    key={n.id}
                    style={[styles.networkPill, active && styles.networkPillActive]}
                    onPress={() => setSelectedNetwork(n)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.networkDot, { backgroundColor: color }]} />
                    <Text style={[styles.networkLabel, active && styles.networkLabelActive]}>
                      {n.network_name}
                    </Text>
                    {active && (
                      <View style={styles.checkWrap}>
                        <Feather name="check" size={12} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {plans.length > 1 && (
            <>
              <Text style={styles.sectionLabel}>Recharge Type</Text>
              <View style={styles.networkRow}>
                {plans.map((p) => {
                  const active = selectedPlan?.product_plan_id === p.product_plan_id;
                  return (
                    <TouchableOpacity
                      key={p.product_plan_id}
                      style={[styles.networkPill, active && styles.networkPillActive]}
                      onPress={() => setSelectedPlan(p)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.networkLabel, active && styles.networkLabelActive]}>
                        {p.product_plan_name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

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

          <Text style={styles.sectionLabel}>Amount</Text>
          <View style={styles.inputCard}>
            <Text style={styles.nairaSign}>₦</Text>
            <View style={styles.inputDivider} />
            <TextInput
              style={styles.input}
              placeholder="Enter amount"
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
        </ScrollView>
      ) : (
        /* ================= STEP 2: SECURE PIN CONFIRMATION VIEW ================= */
        <View style={styles.confirmContent}>
          <Text style={styles.sectionLabel}>Transaction Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Network</Text>
              <Text style={styles.summaryValue}>{selectedNetwork?.network_name}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Recipient</Text>
              <Text style={styles.summaryValue}>{phone}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Cost</Text>
              <Text style={[styles.summaryValue, { color: BRAND, fontFamily: FONTS.bold }]}>₦{amount}</Text>
            </View>
          </View>

          <Text style={styles.pinInstructionText}>Enter 4-Digit Security PIN</Text>
          <CustomPinInput onPinComplete={(text) => setPin(text)} />
        </View>
      )}

      {/* Dynamic Action Buttons Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {step === 'input' ? (
          <TouchableOpacity
            style={[styles.continueBtn, (!canContinue || loadingPlans) && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleFormSubmit}
            disabled={!canContinue || loadingPlans}
          >
            <Text style={styles.continueText}>Continue</Text>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.continueBtn, (pin.length < 4 || loading) && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleBuyAirtime}
            disabled={pin.length < 4 || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.continueText}>Pay ₦{amount}</Text>
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
  networkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  networkPill: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#ECEDF6',
    flexBasis: '48%',
  },
  networkPillActive: { borderColor: BRAND, backgroundColor: 'rgba(74,85,221,0.06)' },
  networkDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  networkLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: '#0B0D1A', flex: 1 },
  networkLabelActive: { color: BRAND },
  checkWrap: { width: 18, height: 18, borderRadius: 9, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  inputCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1.5, borderColor: '#ECEDF6',
  },
  flagWrap: { flexDirection: 'row', alignItems: 'center' },
  flagText: { fontSize: 18, marginRight: 6 },
  dialCode: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A' },
  nairaSign: { fontFamily: FONTS.bold, fontSize: 16, color: BRAND },
  inputDivider: { width: 1, height: 22, backgroundColor: '#ECEDF6', marginHorizontal: 12 },
  input: { flex: 1, fontFamily: FONTS.semibold, fontSize: 15, color: '#0B0D1A' },
  quickAmountWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  quickChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#ECEDF6' },
  quickChipActive: { backgroundColor: BRAND, borderColor: BRAND },
  quickChipText: { fontFamily: FONTS.semibold, fontSize: 12, color: '#0B0D1A' },
  quickChipTextActive: { color: '#FFFFFF' },

  // Confirmation screen dynamic view styles
  summaryCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: '#ECEDF6', marginBottom: 30,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  summaryLabel: { fontFamily: FONTS.medium, fontSize: 13, color: '#6B7088' },
  summaryValue: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A' },
  pinInstructionText: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A', textAlign: 'center', marginBottom: 16 },

  // Custom inside-file OTP inputs structural UI configuration styles
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
