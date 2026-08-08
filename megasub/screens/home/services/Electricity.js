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
  StatusBar,
  Image,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchProductPlanCategories,
  fetchProductPlans,
  validateMetreNumber,
  buyElectricity,
} from '../../../lib/api';
import { useTheme } from '../../../contexts/ThemeContext';
import CategoryTabs from '../components/CategoryTabs';
import OptionList from '../components/OptionList';
import SuccessView from '../components/SuccessView';
import WrongPinModal from '../components/WrongPinModal';
import { formatNaira, alertForPurchaseError, sanitizePositiveInt } from '../../../lib/format';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const BRAND = '#4A55DD';
const QUICK_AMOUNTS = [1000, 2000, 3000, 5000, 10000, 20000];

// Matched against the plan's provider label by substring — DISCO names are
// embedded in product_plan_name (e.g. "IBADAN {IBEDC}", "ABUJA {AEDC}").
// Unmatched DISCOs just show no badge.
const DISCO_LOGOS = [
  { match: 'IBADAN', logo: require('../../../assets/networks/ibedc.png') },
  { match: 'IBEDC', logo: require('../../../assets/networks/ibedc.png') },
  { match: 'ABUJA', logo: require('../../../assets/networks/abuja.png') },
  { match: 'PORT', logo: require('../../../assets/networks/portharcourt.png') },
  { match: 'PHED', logo: require('../../../assets/networks/portharcourt.png') },
  { match: 'KADUNA', logo: require('../../../assets/networks/kaduna.png') },
  { match: 'ENUGU', logo: require('../../../assets/networks/enugu.png') },
  { match: 'EEDC', logo: require('../../../assets/networks/enugu.png') },
  { match: 'EKO', logo: require('../../../assets/networks/eko.png') },
  { match: 'IKEJA', logo: require('../../../assets/networks/ikeja.png') },
  { match: 'KANO', logo: require('../../../assets/networks/kano.png') },
];

function discoLogo(label) {
  const upper = (label || '').toUpperCase();
  return DISCO_LOGOS.find((d) => upper.includes(d.match))?.logo;
}

function CustomPinInput({ onPinComplete, colors }) {
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
    } else if (!cleanText && index > 0) {
      // Deleting used to just clear the box and leave focus there, so the
      // very next backspace press had nothing to do — advancing back to the
      // previous box here means backspacing flows continuously across boxes.
      inputs.current[index - 1].focus();
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
          style={[
            styles.otpInputBox,
            { color: colors?.text, backgroundColor: colors?.card, borderColor: colors?.border },
            digit ? styles.otpInputFilled : null,
          ]}
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

export default function Electricity({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [step, setStep] = useState('input');

  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [meterNumber, setMeterNumber] = useState('');
  const [amount, setAmount] = useState('');

  const [pin, setPin] = useState('');
  const [pinKey, setPinKey] = useState(0);
  const [wrongPinVisible, setWrongPinVisible] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(null); // { name, address }
  const [validationError, setValidationError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    setLoadingCategories(true);
    setLoadingPlans(true);
    try {
      // fetch_product_plan_categories returns the billing type ("PREPAID")
      // — the actual distribution companies (IBEDC, AEDC, EKEDC, etc.) live
      // one level down, in each plan's product_plan_name.
      const [categoriesJson, plansJson] = await Promise.all([
        fetchProductPlanCategories({ userId: user?.id, productSlug: 'utility_bills' }),
        fetchProductPlans({ userId: user?.id, productSlug: 'utility_bills', amount: 100 }),
      ]);
      const categoryList = (categoriesJson.data || []).map((c) => ({ id: c.id, label: c.product_plan_category_name }));
      setCategories(categoryList);
      if (categoryList.length > 0) setSelectedCategory(categoryList[0]);
      setPlans(plansJson.data || []);
    } catch (error) {
      Alert.alert('Network Error', error.message || 'Could not load electricity providers.');
    } finally {
      setLoadingCategories(false);
      setLoadingPlans(false);
    }
  };

  // "PREPAID IBADAN {IBEDC}" -> "IBADAN {IBEDC}" — the category name is
  // already shown above the list, so the prefix on every row is just noise.
  const providerLabel = (plan) => plan.product_plan_name.replace(/^PREPAID\s*/i, '').trim() || plan.product_plan_name;

  const providers = useMemo(
    () =>
      plans
        .filter((p) => !selectedCategory || p.product_plan_category_id === selectedCategory.id)
        .map((p) => ({ id: p.product_plan_id, label: providerLabel(p), logo: discoLogo(providerLabel(p)) })),
    [plans, selectedCategory]
  );

  useEffect(() => {
    setSelectedPlan(null);
  }, [selectedCategory]);

  const handleFormSubmit = () => {
    if (!selectedPlan || !meterNumber || !amount) return;
    setValidated(null);
    setValidationError(false);
    setStep('confirm');
  };

  const handleValidate = async () => {
    if (pin.length < 4) return;

    setValidating(true);
    setValidationError(false);
    try {
      const json = await validateMetreNumber({
        user_id: user?.id,
        pin,
        metre_number: meterNumber,
        product_plan_id: selectedPlan.product_plan_id,
      });
      setValidated({ name: json.data?.name || null, address: json.data?.address || null });
    } catch (error) {
      setValidationError(true);
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
        electricity_product_plan_category_id: selectedPlan.product_plan_category_id,
        electricity_product_plan_id: selectedPlan.product_plan_id,
        amount: String(amount),
        // Documented in the updated API spec alongside amount — buy_airtime
        // already 403s without its equivalent ("The actual amount field is
        // required"), so send it here too rather than wait for the same bug.
        actual_amount: String(amount),
        pin,
      };

      await buyElectricity(payload);
      setStep('success');
    } catch (error) {
      const alert = alertForPurchaseError(error);
      if (alert.isWrongPin) {
        setWrongPinVisible(true);
      } else if (alert.requiresPhoneVerification) {
        Alert.alert(alert.title, alert.message, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Verify Phone', onPress: () => navigate && navigate('verify', user) },
        ]);
      } else {
        Alert.alert(alert.title, alert.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />
      {step !== 'success' && (
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.card }]}
            onPress={() => (step === 'confirm' ? setStep('input') : (navigate && navigate('home')))}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {step === 'input' ? 'Electricity Bill' : 'Confirm Transaction'}
          </Text>
          <View style={{ width: 38 }} />
        </View>
      )}

      {step === 'success' ? (
        <SuccessView
          title="Electricity Purchased!"
          subtitle={`Your ${selectedPlan ? providerLabel(selectedPlan) : ''} bill payment was successful.`}
          amount={amount}
          details={[
            { label: 'Provider', value: selectedPlan ? providerLabel(selectedPlan) : null },
            { label: 'Meter Number', value: meterNumber },
            { label: 'Customer Name', value: validated?.name },
            { label: 'Address', value: validated?.address },
          ].filter((d) => d.value)}
          onDone={() => navigate && navigate('home')}
          colors={colors}
        />
      ) : step === 'input' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 0 }]}>Billing Type</Text>
          {loadingCategories ? (
            <ActivityIndicator color={BRAND} style={{ marginTop: 10 }} />
          ) : (
            <CategoryTabs
              options={categories}
              selectedId={selectedCategory?.id}
              onSelect={(opt) => setSelectedCategory(categories.find((c) => c.id === opt.id))}
              colors={colors}
            />
          )}

          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Select Provider *</Text>
          {loadingPlans ? (
            <ActivityIndicator color={BRAND} style={{ marginTop: 10 }} />
          ) : (
            <OptionList
              options={providers}
              selectedId={selectedPlan?.product_plan_id}
              onSelect={(opt) => setSelectedPlan(plans.find((p) => p.product_plan_id === opt.id) || null)}
              colors={colors}
              horizontal
            />
          )}

          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Meter Number (11 digits)</Text>
          <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Meter number"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              maxLength={11}
              value={meterNumber}
              onChangeText={setMeterNumber}
            />
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Amount</Text>
          <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={styles.nairaSign}>₦</Text>
            <View style={[styles.inputDivider, { backgroundColor: colors.border }]} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Enter amount"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              value={amount}
              onChangeText={(text) => setAmount(sanitizePositiveInt(text))}
            />
          </View>

          <View style={styles.quickAmountWrap}>
            {QUICK_AMOUNTS.map((a) => {
              const active = amount === String(a);
              return (
                <TouchableOpacity
                  key={a}
                  style={[styles.quickChip, { backgroundColor: colors.card, borderColor: colors.border }, active && styles.quickChipActive]}
                  onPress={() => setAmount(String(a))}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.quickChipText, { color: colors.text }, active && styles.quickChipTextActive]}>
                    ₦{formatNaira(a)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.confirmContent}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Transaction Summary</Text>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Provider</Text>
              <View style={styles.summaryValueRow}>
                {selectedPlan && discoLogo(providerLabel(selectedPlan)) ? (
                  <Image source={discoLogo(providerLabel(selectedPlan))} style={styles.summaryLogo} />
                ) : null}
                <Text style={[styles.summaryValue, { color: colors.text }]}>{selectedPlan ? providerLabel(selectedPlan) : ''}</Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Meter Number</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{meterNumber}</Text>
            </View>
            {validated?.name ? (
              <>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Customer Name</Text>
                  <Text style={[styles.summaryValue, { color: '#10B981' }]}>{validated.name}</Text>
                </View>
                {validated.address ? (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Address</Text>
                    <Text style={[styles.summaryValue, { color: colors.text, flex: 1, textAlign: 'right' }]}>{validated.address}</Text>
                  </View>
                ) : null}
              </>
            ) : null}
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Total Cost</Text>
              <Text style={[styles.summaryValue, { color: BRAND, fontFamily: FONTS.bold }]}>₦{formatNaira(amount)}</Text>
            </View>
          </View>

          <Text style={[styles.pinInstructionText, { color: colors.text }]}>
            {validated?.name ? 'Enter 4-Digit Security PIN to Pay' : 'Enter Your PIN to Validate Meter'}
          </Text>
          <CustomPinInput key={pinKey} onPinComplete={(text) => setPin(text)} colors={colors} />

          {validated?.name ? (
            <View style={styles.validatedBanner}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.validatedBannerText}>Meter validated for {validated.name}</Text>
            </View>
          ) : validationError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color="#EF4444" />
              <Text style={styles.errorBannerText}>An error occurred. Please try again.</Text>
            </View>
          ) : null}
        </View>
      )}

      {step !== 'success' && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background }]}>
          {step === 'input' ? (
            <TouchableOpacity
              style={[styles.continueBtn, (!selectedPlan || !meterNumber || !amount) && styles.continueBtnDisabled]}
              activeOpacity={0.85}
              onPress={handleFormSubmit}
              disabled={!selectedPlan || !meterNumber || !(Number(amount) > 0)}
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
                  <Text style={styles.continueText}>Pay ₦{formatNaira(amount)}</Text>
                  <Feather name="shield" size={18} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
      <WrongPinModal
        visible={wrongPinVisible}
        onClose={() => {
          setWrongPinVisible(false);
          setPin('');
          setPinKey((k) => k + 1);
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
  summaryValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryLogo: { width: 20, height: 20, borderRadius: 10 },
  summaryLabel: { fontFamily: FONTS.medium, fontSize: 13, color: '#6B7088' },
  summaryValue: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A' },
  pinInstructionText: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A', textAlign: 'center', marginBottom: 16 },

  validatedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 18,
  },
  validatedBannerText: { fontFamily: FONTS.medium, fontSize: 12.5, color: '#10B981' },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 18,
  },
  errorBannerText: { fontFamily: FONTS.medium, fontSize: 12.5, color: '#EF4444' },

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
