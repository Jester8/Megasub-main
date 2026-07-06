import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchProductPlanCategories,
  fetchProductPlans,
  validateMetreNumber,
  buyElectricity,
} from '../../../lib/api';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const BRAND = '#4A55DD';
const QUICK_AMOUNTS = [1000, 2000, 3000, 5000, 10000, 20000];

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

function SelectField({ label, value, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.selectField, disabled && styles.selectFieldDisabled]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
    >
      <Text style={[styles.selectValue, !value && styles.selectPlaceholder]}>
        {value || label}
      </Text>
      <Feather name="chevron-down" size={18} color="#9CA0B8" />
    </TouchableOpacity>
  );
}

function PickerModal({ visible, title, options, onSelect, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.overlayTouch} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetList}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={styles.sheetItem}
                onPress={() => onSelect(opt)}
                activeOpacity={0.75}
              >
                <Text style={styles.sheetItemLabel}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function Electricity({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState('input');

  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [allPlans, setAllPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  const [selectedProvider, setSelectedProvider] = useState(null);
  const [meterNumber, setMeterNumber] = useState('');
  const [amount, setAmount] = useState('');

  const [providerModalVisible, setProviderModalVisible] = useState(false);

  const [pin, setPin] = useState('');
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(null); // { name, address }
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    setLoadingProviders(true);
    setLoadingPlans(true);
    try {
      const [categoriesJson, plansJson] = await Promise.all([
        fetchProductPlanCategories({ userId: user?.id, productSlug: 'utility_bills' }),
        fetchProductPlans({ userId: user?.id, productSlug: 'utility_bills', amount: 100 }),
      ]);
      setProviders(
        (categoriesJson.data || []).map((c) => ({ id: c.id, label: c.product_plan_category_name }))
      );
      setAllPlans(plansJson.data || []);
    } catch (error) {
      Alert.alert('Network Error', error.message || 'Could not load electricity providers.');
    } finally {
      setLoadingProviders(false);
      setLoadingPlans(false);
    }
  };

  const selectedPlan = useMemo(
    () => (selectedProvider ? allPlans.find((p) => p.product_plan_category_id === selectedProvider.id) : null),
    [selectedProvider, allPlans]
  );

  const handleFormSubmit = () => {
    if (!selectedProvider || !selectedPlan || !meterNumber || !amount) return;
    setValidated(null);
    setStep('confirm');
  };

  const handleValidate = async () => {
    if (pin.length < 4) return;

    setValidating(true);
    try {
      const json = await validateMetreNumber({
        user_id: user?.id,
        pin,
        metre_number: meterNumber,
        product_plan_id: selectedPlan.product_plan_id,
      });
      setValidated({ name: json.data?.name || null, address: json.data?.address || null });
    } catch (error) {
      Alert.alert('Validation Failed', error.message || 'Could not validate this meter number.');
    } finally {
      setValidating(false);
    }
  };

  const handleBuy = async () => {
    if (pin.length < 4 || !validated?.name) return;

    setLoading(true);
    try {
      const payload = {
        user_id: user?.id,
        metre_number: meterNumber,
        validation_extra_info: validated.name,
        electricity_product_plan_category_id: selectedProvider.id,
        electricity_product_plan_id: selectedPlan.product_plan_id,
        amount: String(amount),
        pin,
      };

      await buyElectricity(payload);
      Alert.alert('Success 🎉', 'Electricity purchase processing complete.');
      navigate && navigate('home');
    } catch (error) {
      Alert.alert('Transaction Failed', error.message || 'Please check your information and PIN.');
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
          {step === 'input' ? 'Electricity Bill' : 'Confirm Transaction'}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {step === 'input' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>Select Provider</Text>
          {loadingProviders ? (
            <ActivityIndicator color={BRAND} style={{ marginTop: 10 }} />
          ) : (
            <SelectField
              label="Select Provider"
              value={selectedProvider?.label}
              onPress={() => setProviderModalVisible(true)}
            />
          )}

          {selectedProvider && !loadingPlans && !selectedPlan ? (
            <Text style={styles.errorText}>No plan is currently available for this provider.</Text>
          ) : null}

          <Text style={styles.sectionLabel}>Meter Number</Text>
          <View style={styles.inputCard}>
            <TextInput
              style={styles.input}
              placeholder="Meter number"
              placeholderTextColor="#9CA0B8"
              keyboardType="number-pad"
              value={meterNumber}
              onChangeText={setMeterNumber}
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
        <View style={styles.confirmContent}>
          <Text style={styles.sectionLabel}>Transaction Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Provider</Text>
              <Text style={styles.summaryValue}>{selectedProvider?.label}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Meter Number</Text>
              <Text style={styles.summaryValue}>{meterNumber}</Text>
            </View>
            {validated?.name ? (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Customer Name</Text>
                  <Text style={[styles.summaryValue, { color: '#10B981' }]}>{validated.name}</Text>
                </View>
                {validated.address ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Address</Text>
                    <Text style={[styles.summaryValue, { flex: 1, textAlign: 'right' }]}>{validated.address}</Text>
                  </View>
                ) : null}
              </>
            ) : null}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Cost</Text>
              <Text style={[styles.summaryValue, { color: BRAND, fontFamily: FONTS.bold }]}>₦{amount}</Text>
            </View>
          </View>

          <Text style={styles.pinInstructionText}>
            {validated?.name ? 'Enter 4-Digit Security PIN to Pay' : 'Enter Your PIN to Validate Meter'}
          </Text>
          <CustomPinInput onPinComplete={(text) => setPin(text)} />

          {validated?.name ? (
            <View style={styles.validatedBanner}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.validatedBannerText}>Meter validated for {validated.name}</Text>
            </View>
          ) : null}
        </View>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {step === 'input' ? (
          <TouchableOpacity
            style={[styles.continueBtn, (!selectedProvider || !selectedPlan || !meterNumber || !amount) && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleFormSubmit}
            disabled={!selectedProvider || !selectedPlan || !meterNumber || !amount}
          >
            <Text style={styles.continueText}>Continue</Text>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        ) : !validated?.name ? (
          <TouchableOpacity
            style={[styles.continueBtn, (pin.length < 4 || validating) && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleValidate}
            disabled={pin.length < 4 || validating}
          >
            {validating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.continueText}>Validate Meter</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.continueBtn, (pin.length < 4 || loading) && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleBuy}
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

      <PickerModal
        visible={providerModalVisible}
        title="Select Provider"
        options={providers}
        onClose={() => setProviderModalVisible(false)}
        onSelect={(opt) => {
          setSelectedProvider(opt);
          setProviderModalVisible(false);
        }}
      />
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

  selectField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 16, height: 56,
    borderWidth: 1.5, borderColor: '#ECEDF6',
  },
  selectFieldDisabled: { opacity: 0.5 },
  selectValue: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A' },
  selectPlaceholder: { fontFamily: FONTS.medium, color: '#9CA0B8' },

  errorText: { fontFamily: FONTS.medium, fontSize: 12, color: '#EF4444', marginTop: 8 },

  inputCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1.5, borderColor: '#ECEDF6',
  },
  nairaSign: { fontFamily: FONTS.bold, fontSize: 16, color: BRAND },
  inputDivider: { width: 1, height: 22, backgroundColor: '#ECEDF6', marginHorizontal: 12 },
  input: { flex: 1, fontFamily: FONTS.semibold, fontSize: 15, color: '#0B0D1A' },
  quickAmountWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  quickChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#ECEDF6' },
  quickChipActive: { backgroundColor: BRAND, borderColor: BRAND },
  quickChipText: { fontFamily: FONTS.semibold, fontSize: 12, color: '#0B0D1A' },
  quickChipTextActive: { color: '#FFFFFF' },

  summaryCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: '#ECEDF6', marginBottom: 30,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, gap: 12 },
  summaryLabel: { fontFamily: FONTS.medium, fontSize: 13, color: '#6B7088' },
  summaryValue: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A' },
  pinInstructionText: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A', textAlign: 'center', marginBottom: 16 },

  validatedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 18,
  },
  validatedBannerText: { fontFamily: FONTS.medium, fontSize: 12.5, color: '#10B981' },

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

  overlay: { flex: 1, backgroundColor: 'rgba(11,13,26,0.4)' },
  overlayTouch: { flex: 1 },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    maxHeight: '60%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(11,13,26,0.12)',
    alignSelf: 'center', marginBottom: 14,
  },
  sheetTitle: {
    fontFamily: FONTS.extrabold,
    fontWeight: '800',
    fontSize: 17,
    color: '#0B0D1A',
    marginBottom: 12,
  },
  sheetList: { paddingBottom: 30 },
  sheetItem: {
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(11,13,26,0.06)',
  },
  sheetItemLabel: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A' },
});
