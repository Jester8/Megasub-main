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
  validateCableTv,
  buyCableTv,
} from '../../../lib/api';
import { requireNetworkOrShowError } from '../../../lib/network';
import { useTheme } from '../../../contexts/ThemeContext';
import CategoryTabs from '../components/CategoryTabs';
import PlanGrid from '../components/PlanGrid';
import SuccessView from '../components/SuccessView';
import WrongPinModal from '../components/WrongPinModal';
import { formatNaira, alertForPurchaseError } from '../../../lib/format';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const BRAND = '#4A55DD';

// Matched against the provider (category) name by substring, since the API's
// category names vary in casing/wording (e.g. "GOTV", "GOtv Subscription").
const CABLE_LOGOS = [
  { match: 'DSTV', logo: require('../../../assets/networks/dstv.png') },
  { match: 'GOTV', logo: require('../../../assets/networks/gotv.png') },
  { match: 'STARTIMES', logo: require('../../../assets/networks/startimes.png') },
];

function cableLogo(name) {
  const upper = (name || '').toUpperCase();
  return CABLE_LOGOS.find((c) => upper.includes(c.match))?.logo;
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

export default function Cable({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [step, setStep] = useState('input');

  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [allPlans, setAllPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  const [selectedProvider, setSelectedProvider] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [smartcard, setSmartcard] = useState('');

  const [pin, setPin] = useState('');
  const [pinKey, setPinKey] = useState(0);
  const [wrongPinVisible, setWrongPinVisible] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validatedName, setValidatedName] = useState(null);
  const [validationError, setValidationError] = useState(false);
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
        (categoriesJson.data || []).map((c) => ({
          id: c.id,
          label: c.product_plan_category_name,
          logo: cableLogo(c.product_plan_category_name),
        }))
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
    setValidationError(false);
    setStep('confirm');
  };

  const handleValidate = async () => {
    if (pin.length < 4) return;

    setValidating(true);
    setValidationError(false);
    try {
      const json = await validateCableTv({
        user_id: user?.id,
        pin,
        smart_card_number: smartcard,
        product_plan_id: selectedPackage.id,
      });
      setValidatedName(json.data?.name || null);
    } catch (error) {
      setValidationError(true);
    } finally {
      setValidating(false);
    }
  };

  const handleSubscribe = async () => {
    if (pin.length < 4 || !validatedName) return;
    if (!(await requireNetworkOrShowError())) return;

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
            {step === 'input' ? 'Cable Subscription' : 'Confirm Transaction'}
          </Text>
          <View style={{ width: 38 }} />
        </View>
      )}

      {step === 'success' ? (
        <SuccessView
          title="Subscription Successful!"
          subtitle={`Your ${selectedPackage?.label || ''} subscription on ${selectedProvider?.label || ''} is active.`}
          amount={selectedPackage?.price}
          details={[
            { label: 'Provider', value: selectedProvider?.label, logo: selectedProvider?.logo },
            { label: 'Package', value: selectedPackage?.label },
            { label: 'Smartcard No.', value: smartcard },
            { label: 'Customer Name', value: validatedName },
          ].filter((d) => d.value)}
          onDone={() => navigate && navigate('home')}
          colors={colors}
        />
      ) : step === 'input' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 0 }]}>TV Provider</Text>
          {loadingProviders ? (
            <ActivityIndicator color={BRAND} style={{ marginTop: 10 }} />
          ) : (
            <CategoryTabs
              options={providers}
              selectedId={selectedProvider?.id}
              onSelect={(opt) => {
                setSelectedProvider(providers.find((p) => p.id === opt.id));
                setSelectedPackage(null);
              }}
              colors={colors}
            />
          )}

          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Smartcard Number</Text>
          <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Smartcard Number"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              value={smartcard}
              onChangeText={setSmartcard}
            />
          </View>

          {selectedProvider ? (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Select Package</Text>
              {loadingPlans ? (
                <ActivityIndicator color={BRAND} style={{ marginTop: 10 }} />
              ) : (
                <PlanGrid
                  plans={packages.map((p) => ({ id: p.id, title: p.label, price: p.price, badge: selectedProvider.label }))}
                  selectedId={selectedPackage?.id}
                  onSelect={(opt) => setSelectedPackage(packages.find((p) => p.id === opt.id))}
                  colors={colors}
                />
              )}
            </>
          ) : null}
        </ScrollView>
      ) : (
        <View style={styles.confirmContent}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Transaction Summary</Text>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Provider</Text>
              <View style={styles.summaryValueRow}>
                {selectedProvider?.logo ? (
                  <Image source={selectedProvider.logo} style={styles.summaryLogo} />
                ) : null}
                <Text style={[styles.summaryValue, { color: colors.text }]}>{selectedProvider?.label}</Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Package</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{selectedPackage?.label}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Smartcard No.</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{smartcard}</Text>
            </View>
            {validatedName ? (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Customer Name</Text>
                <Text style={[styles.summaryValue, { color: '#10B981' }]}>{validatedName}</Text>
              </View>
            ) : null}
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Total Cost</Text>
              <Text style={[styles.summaryValue, { color: BRAND, fontFamily: FONTS.bold }]}>₦{formatNaira(selectedPackage?.price)}</Text>
            </View>
          </View>

          <Text style={[styles.pinInstructionText, { color: colors.text }]}>
            {validatedName ? 'Enter 4-Digit Security PIN to Pay' : 'Enter Your PIN to Validate Smartcard'}
          </Text>
          <CustomPinInput key={pinKey} onPinComplete={(text) => setPin(text)} colors={colors} />

          {validatedName ? (
            <View style={styles.validatedBanner}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.validatedBannerText}>Smartcard validated for {validatedName}</Text>
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
                  <Text style={styles.continueText}>Pay ₦{formatNaira(selectedPackage?.price)}</Text>
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
  scrollContent: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 30 },
  confirmContent: { paddingHorizontal: 20, paddingTop: 10 },
  sectionLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: '#6B7088', marginTop: 22, marginBottom: 10 },

  inputCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1.5, borderColor: '#ECEDF6',
  },
  input: { flex: 1, fontFamily: FONTS.semibold, fontSize: 15, color: '#0B0D1A' },

  summaryCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: '#ECEDF6', marginBottom: 30,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
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
