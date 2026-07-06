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
  validateCableTv,
  buyCableTv,
} from '../../../lib/api';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const BRAND = '#4A55DD';

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
                {opt.price != null && <Text style={styles.sheetItemPrice}>₦{opt.price}</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function Cable({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState('input');

  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [allPlans, setAllPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  const [selectedProvider, setSelectedProvider] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [smartcard, setSmartcard] = useState('');

  const [providerModalVisible, setProviderModalVisible] = useState(false);
  const [packageModalVisible, setPackageModalVisible] = useState(false);

  const [pin, setPin] = useState('');
  const [validating, setValidating] = useState(false);
  const [validatedName, setValidatedName] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    setLoadingProviders(true);
    setLoadingPlans(true);
    try {
      const [categoriesJson, plansJson] = await Promise.all([
        fetchProductPlanCategories({ userId: user?.id, productSlug: 'cable_subscription' }),
        fetchProductPlans({ userId: user?.id, productSlug: 'cable_subscription' }),
      ]);
      setProviders(
        (categoriesJson.data || []).map((c) => ({ id: c.id, label: c.product_plan_category_name }))
      );
      setAllPlans(plansJson.data || []);
    } catch (error) {
      Alert.alert('Network Error', error.message || 'Could not load cable providers.');
    } finally {
      setLoadingProviders(false);
      setLoadingPlans(false);
    }
  };

  const packages = useMemo(
    () =>
      selectedProvider
        ? allPlans
            .filter((p) => p.product_plan_category_id === selectedProvider.id)
            .map((p) => ({ id: p.product_plan_id, label: p.product_plan_name, price: p.selling_price }))
        : [],
    [selectedProvider, allPlans]
  );

  const handleFormSubmit = () => {
    if (!selectedProvider || !selectedPackage || !smartcard) return;
    setValidatedName(null);
    setStep('confirm');
  };

  const handleValidate = async () => {
    if (pin.length < 4) return;

    setValidating(true);
    try {
      const json = await validateCableTv({
        user_id: user?.id,
        pin,
        smart_card_number: smartcard,
        product_plan_id: selectedPackage.id,
      });
      setValidatedName(json.data?.name || null);
    } catch (error) {
      Alert.alert('Validation Failed', error.message || 'Could not validate this smart card number.');
    } finally {
      setValidating(false);
    }
  };

  const handleSubscribe = async () => {
    if (pin.length < 4 || !validatedName) return;

    setLoading(true);
    try {
      const payload = {
        user_id: user?.id,
        smart_card_number: smartcard,
        validation_customer_name: validatedName,
        cable_product_plan_category_id: selectedProvider.id,
        cable_product_plan_id: selectedPackage.id,
        pin,
      };

      await buyCableTv(payload);
      Alert.alert('Success 🎉', 'Cable subscription processing complete.');
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
          {step === 'input' ? 'Cable Subscription' : 'Confirm Transaction'}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {step === 'input' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {loadingProviders ? (
            <ActivityIndicator color={BRAND} style={{ marginTop: 10 }} />
          ) : (
            <SelectField
              label="Select Provider"
              value={selectedProvider?.label}
              onPress={() => setProviderModalVisible(true)}
            />
          )}

          <View style={{ height: 14 }} />

          <SelectField
            label="Select Package"
            value={selectedPackage?.label}
            onPress={() => setPackageModalVisible(true)}
            disabled={!selectedProvider || loadingPlans}
          />

          <View style={{ height: 14 }} />

          <View style={styles.inputCard}>
            <TextInput
              style={styles.input}
              placeholder="Smartcard Number"
              placeholderTextColor="#9CA0B8"
              keyboardType="number-pad"
              value={smartcard}
              onChangeText={setSmartcard}
            />
          </View>

          {selectedPackage ? (
            <Text style={styles.totalHint}>Amount: ₦{selectedPackage.price}</Text>
          ) : null}
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
              <Text style={styles.summaryLabel}>Package</Text>
              <Text style={styles.summaryValue}>{selectedPackage?.label}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Smartcard No.</Text>
              <Text style={styles.summaryValue}>{smartcard}</Text>
            </View>
            {validatedName ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Customer Name</Text>
                <Text style={[styles.summaryValue, { color: '#10B981' }]}>{validatedName}</Text>
              </View>
            ) : null}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Cost</Text>
              <Text style={[styles.summaryValue, { color: BRAND, fontFamily: FONTS.bold }]}>₦{selectedPackage?.price}</Text>
            </View>
          </View>

          <Text style={styles.pinInstructionText}>
            {validatedName ? 'Enter 4-Digit Security PIN to Pay' : 'Enter Your PIN to Validate Smartcard'}
          </Text>
          <CustomPinInput onPinComplete={(text) => setPin(text)} />

          {validatedName ? (
            <View style={styles.validatedBanner}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.validatedBannerText}>Smartcard validated for {validatedName}</Text>
            </View>
          ) : null}
        </View>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {step === 'input' ? (
          <TouchableOpacity
            style={[styles.continueBtn, (!selectedProvider || !selectedPackage || !smartcard) && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleFormSubmit}
            disabled={!selectedProvider || !selectedPackage || !smartcard}
          >
            <Text style={styles.continueText}>Continue</Text>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        ) : !validatedName ? (
          <TouchableOpacity
            style={[styles.continueBtn, (pin.length < 4 || validating) && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleValidate}
            disabled={pin.length < 4 || validating}
          >
            {validating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.continueText}>Validate Smartcard</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.continueBtn, (pin.length < 4 || loading) && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleSubscribe}
            disabled={pin.length < 4 || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.continueText}>Pay ₦{selectedPackage?.price}</Text>
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
          setSelectedPackage(null);
          setProviderModalVisible(false);
        }}
      />

      <PickerModal
        visible={packageModalVisible}
        title="Select Package"
        options={packages}
        onClose={() => setPackageModalVisible(false)}
        onSelect={(opt) => {
          setSelectedPackage(opt);
          setPackageModalVisible(false);
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
  scrollContent: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 30 },
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

  inputCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1.5, borderColor: '#ECEDF6',
  },
  input: { flex: 1, fontFamily: FONTS.semibold, fontSize: 15, color: '#0B0D1A' },

  totalHint: { fontFamily: FONTS.semibold, fontSize: 12.5, color: BRAND, marginTop: 16, textAlign: 'center' },

  summaryCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: '#ECEDF6', marginBottom: 30,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(11,13,26,0.06)',
  },
  sheetItemLabel: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A' },
  sheetItemPrice: { fontFamily: FONTS.bold, fontSize: 13, color: BRAND },
});
