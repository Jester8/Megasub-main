import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchNetworks, fetchProductPlanCategories, fetchProductPlans, buyAirtime } from '../../../lib/api';
import { requireNetworkOrShowError } from '../../../lib/network';
import { useTheme } from '../../../contexts/ThemeContext';
import CategoryTabs from '../components/CategoryTabs';
import PlanGrid from '../components/PlanGrid';
import SuccessView from '../components/SuccessView';
import ContactPicker from '../components/ContactPicker';
import WrongPinModal from '../components/WrongPinModal';
import CouponCheck from '../components/CouponCheck';
import { detectNetworkFromPhone, findNetworkByLabel } from '../../../lib/networkDetect';
import { formatNaira, alertForPurchaseError, stripNetworkPrefix, sanitizePositiveInt } from '../../../lib/format';

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

// Real provider logos (assets/networks); the colored dot remains the
// fallback for any network name the API returns that isn't mapped here.
const NETWORK_LOGOS = {
  MTN: require('../../../assets/networks/mtn.png'),
  AIRTEL: require('../../../assets/networks/airtel.png'),
  GLO: require('../../../assets/networks/glo.png'),
  '9MOBILE': require('../../../assets/networks/9mobile.png'),
};

const QUICK_AMOUNTS = [100, 200, 300, 500, 1000, 1500, 2000, 5000];

// Nigerian mobile numbers: 11 digits, leading zero. Recharging with anything
// shorter/garbled used to still go through — the backend's network-match
// check was disabled for this call (validatephonenetwork: 0) before the
// correct field usage was known, leaving the client as the only thing
// standing between a malformed number and a charged wallet. The updated API
// spec documents validatephonenetwork: 1 as the real, intended value — now
// set below — so this is server-enforced too, not just client-side.
// The field shows a +234 chip, so its own placeholder ("803 123 4567")
// expects the 10-digit local number without the leading zero — but the
// buy call's cleanedPhone/formattedPhone step also accepts the 11-digit
// leading-zero form and normalizes it, so both must validate here too.
const isValidPhone = (p) => {
  const cleaned = String(p || '').trim();
  return /^0\d{10}$/.test(cleaned) || /^\d{10}$/.test(cleaned);
};

// Custom, zero-dependency OTP input inside the same file for robustness on Expo
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

export default function Airtime({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // Step Workflow Toggle: 'input' (Form screen) or 'confirm' (Pin screen)
  const [step, setStep] = useState('input');

  // Catalog State
  const [networks, setNetworks] = useState([]);
  const [loadingNetworks, setLoadingNetworks] = useState(true);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // Form States
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [phone, setPhone] = useState('');
  const [contactPickerVisible, setContactPickerVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  // Auth States
  const [pin, setPin] = useState('');
  const [pinKey, setPinKey] = useState(0);
  const [wrongPinVisible, setWrongPinVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  // Transaction record returned by buy_airtime — carries the real
  // amount/discounted_amount so the receipt can break out the bonus.
  const [purchaseTx, setPurchaseTx] = useState(null);

  useEffect(() => {
    loadNetworks();
  }, []);

  useEffect(() => {
    if (selectedNetwork) loadCategories(selectedNetwork.id);
  }, [selectedNetwork]);

  useEffect(() => {
    if (selectedNetwork && selectedCategory) loadPlans(selectedNetwork.id, selectedCategory.id);
  }, [selectedCategory]);

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

  const loadCategories = async (networkId) => {
    setLoadingCategories(true);
    setSelectedCategory(null);
    setPlans([]);
    setSelectedPlan(null);
    try {
      const json = await fetchProductPlanCategories({ userId: user?.id, productSlug: 'airtime', networkId });
      const list = json.data || [];
      setCategories(list);
      if (list.length > 0) setSelectedCategory(list[0]);
    } catch (error) {
      Alert.alert('Network Error', error.message || 'Could not load recharge types.');
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadPlans = async (networkId, planCategoryId) => {
    setLoadingPlans(true);
    setSelectedPlan(null);
    try {
      // Docs call `amount` optional for airtime, but the live API rejects the
      // listing call without one (same issue Electricity.js works around) —
      // this placeholder only affects which plans are listed, not what gets charged.
      const json = await fetchProductPlans({ userId: user?.id, productSlug: 'airtime', networkId, planCategoryId, amount: 100 });
      const list = json.data || [];
      setPlans(list);
      if (list.length > 0) setSelectedPlan(list[0]);
    } catch (error) {
      Alert.alert('Network Error', error.message || 'Could not load airtime plans.');
    } finally {
      setLoadingPlans(false);
    }
  };

  // Auto-selects the network that actually matches the number instead of
  // leaving whatever was picked before — e.g. typing/picking an MTN number
  // used to leave Glo selected if Glo happened to be first in the list.
  const handlePhoneChange = (value) => {
    setPhone(value);
    const label = detectNetworkFromPhone(value);
    const match = findNetworkByLabel(networks, label);
    if (match && match.id !== selectedNetwork?.id) {
      setSelectedNetwork(match);
    }
  };

  const handleFormSubmit = () => {
    if (!selectedNetwork || !selectedCategory || !selectedPlan || !isValidPhone(phone) || !amount) return;
    setStep('confirm');
  };

  const handleBuyAirtime = async () => {
    if (pin.length < 4) return;
    if (!(await requireNetworkOrShowError())) return;

    setLoading(true);
    try {
      const cleanedPhone = phone.replace(/\s+/g, '');
      const formattedPhone = cleanedPhone.startsWith('0') ? cleanedPhone : `0${cleanedPhone}`;

      const payload = {
        network_id: selectedNetwork.id,
        user_id: user?.id,
        phone_number: formattedPhone,
        product_plan_category_id: selectedCategory.id,
        product_plan_id: selectedPlan.product_plan_id,
        pin,
        amount: String(amount),
        // Undocumented, but the live API 403s without it: "The actual amount
        // field is required." — the face value actually being recharged.
        actual_amount: String(amount),
        wallet_category: 'main_wallet',
        validatephonenetwork: 1,
      };

      const json = await buyAirtime(payload);
      setPurchaseTx(json?.data || null);
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

  const canContinue = !!(selectedNetwork && selectedCategory && selectedPlan && isValidPhone(phone) && Number(amount) > 0);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />
      {/* Dynamic Navigation Header depending on active layout workflow block */}
      {step !== 'success' && (
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.card }]}
            onPress={() => step === 'confirm' ? setStep('input') : (navigate && navigate('home'))}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {step === 'input' ? 'Airtime Recharge' : 'Confirm Transaction'}
          </Text>
          <View style={{ width: 38 }} />
        </View>
      )}

      {step === 'success' ? (
        (() => {
          // Headline stays the airtime value actually purchased (e.g. ₦100);
          // the wallet charge and the bonus/discount get their own rows when
          // the API confirms a lower charge (e.g. paid ₦98, bonus ₦2).
          const faceValue = Number(purchaseTx?.amount ?? amount) || Number(amount);
          const charged = Number(purchaseTx?.discounted_amount ?? faceValue);
          const bonus = faceValue > charged ? faceValue - charged : 0;
          return (
            <SuccessView
              title="Airtime Purchased!"
              subtitle={`Your ${selectedNetwork?.network_name || ''} recharge was successful.`}
              amount={faceValue}
              details={[
                { label: 'Network', value: selectedNetwork?.network_name, logo: NETWORK_LOGOS[selectedNetwork?.network_name?.toUpperCase()] },
                { label: 'Recipient', value: phone },
                { label: 'Recharge Type', value: selectedCategory?.product_plan_category_name },
                ...(appliedCoupon
                  ? [{ label: `Coupon (${appliedCoupon.code})`, value: `-₦${formatNaira(appliedCoupon.amount)}` }]
                  : []),
                ...(bonus > 0
                  ? [
                      { label: 'Amount Paid', value: `₦${charged.toLocaleString()}` },
                      { label: 'Bonus', value: `₦${bonus.toLocaleString()}` },
                    ]
                  : []),
              ].filter((d) => d.value)}
              onDone={() => navigate && navigate('home')}
              colors={colors}
            />
          );
        })()
      ) : step === 'input' ? (
        /* ================= STEP 1: INPUT DATA SELECTION VIEW ================= */
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Select Network</Text>
          {loadingNetworks ? (
            <ActivityIndicator color={BRAND} style={{ marginTop: 10 }} />
          ) : (
            <View style={styles.networkRow}>
              {networks.map((n) => {
                const active = selectedNetwork?.id === n.id;
                const color = NETWORK_COLORS[n.network_name?.toUpperCase()] || BRAND;
                const logo = NETWORK_LOGOS[n.network_name?.toUpperCase()];
                return (
                  <TouchableOpacity
                    key={n.id}
                    style={[styles.networkPill, { backgroundColor: colors.card, borderColor: colors.border }, active && styles.networkPillActive]}
                    onPress={() => setSelectedNetwork(n)}
                    activeOpacity={0.8}
                  >
                    {logo ? (
                      <Image source={logo} style={styles.networkLogo} />
                    ) : (
                      <View style={[styles.networkDot, { backgroundColor: color }]} />
                    )}
                    <Text style={[styles.networkLabel, { color: colors.text }, active && styles.networkLabelActive]}>
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

          {selectedNetwork && (categories.length > 1 || loadingCategories) && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Recharge Type</Text>
              {loadingCategories ? (
                <ActivityIndicator color={BRAND} style={{ marginTop: 10 }} />
              ) : (
                <CategoryTabs
                  options={categories.map((c) => ({
                    id: c.id,
                    label: stripNetworkPrefix(c.product_plan_category_name, selectedNetwork?.network_name),
                  }))}
                  selectedId={selectedCategory?.id}
                  onSelect={(opt) => setSelectedCategory(categories.find((c) => c.id === opt.id))}
                  colors={colors}
                />
              )}
            </>
          )}

          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Phone Number (10 digits)</Text>
          <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.flagWrap}>
              <Text style={styles.flagText}>🇳🇬</Text>
              <Text style={[styles.dialCode, { color: colors.text }]}>+234</Text>
            </View>
            <View style={[styles.inputDivider, { backgroundColor: colors.border }]} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="803 123 4567"
              placeholderTextColor={colors.textFaint}
              keyboardType="phone-pad"
              maxLength={11}
              value={phone}
              onChangeText={handlePhoneChange}
            />
            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() => setContactPickerVisible(true)}
              activeOpacity={0.7}
            >
              <Feather name="user-plus" size={18} color={BRAND} />
            </TouchableOpacity>
          </View>
          {phone.length > 0 && !isValidPhone(phone) && (
            <Text style={styles.phoneErrorText}>Enter a valid 11-digit phone number</Text>
          )}

          <CouponCheck userId={user?.id} colors={colors} productSlug="airtime" onApplied={setAppliedCoupon} />

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

          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Quick Amount</Text>
          <PlanGrid
            plans={QUICK_AMOUNTS.map((a) => ({ id: String(a), title: `₦${formatNaira(a)}`, meta: 'Instant', badge: selectedNetwork?.network_name }))}
            selectedId={amount}
            onSelect={(opt) => setAmount(opt.id)}
            colors={colors}
          />
        </ScrollView>
      ) : (
        /* ================= STEP 2: SECURE PIN CONFIRMATION VIEW ================= */
        <View style={styles.confirmContent}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Transaction Summary</Text>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Network</Text>
              <View style={styles.summaryValueRow}>
                {NETWORK_LOGOS[selectedNetwork?.network_name?.toUpperCase()] ? (
                  <Image
                    source={NETWORK_LOGOS[selectedNetwork.network_name.toUpperCase()]}
                    style={styles.summaryLogo}
                  />
                ) : null}
                <Text style={[styles.summaryValue, { color: colors.text }]}>{selectedNetwork?.network_name}</Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Recipient</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{phone}</Text>
            </View>
            {selectedCategory ? (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Recharge Type</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{selectedCategory.product_plan_category_name}</Text>
              </View>
            ) : null}
            {appliedCoupon ? (
              <>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Amount</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>₦{formatNaira(amount)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Coupon ({appliedCoupon.code})</Text>
                  <Text style={[styles.summaryValue, { color: '#16A34A' }]}>-₦{formatNaira(appliedCoupon.amount)}</Text>
                </View>
              </>
            ) : null}
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Total Cost</Text>
              <Text style={[styles.summaryValue, { color: BRAND, fontFamily: FONTS.bold }]}>
                ₦{formatNaira(appliedCoupon ? Math.max(0, Number(amount) - appliedCoupon.amount) : amount)}
              </Text>
            </View>
          </View>

          <Text style={[styles.pinInstructionText, { color: colors.text }]}>Enter 4-Digit Security PIN</Text>
          <CustomPinInput key={pinKey} onPinComplete={(text) => setPin(text)} colors={colors} />
        </View>
      )}

      {/* Dynamic Action Buttons Footer */}
      {step !== 'success' && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background }]}>
          {step === 'input' ? (
            <TouchableOpacity
              style={[styles.continueBtn, (!canContinue || loadingCategories || loadingPlans) && styles.continueBtnDisabled]}
              activeOpacity={0.85}
              onPress={handleFormSubmit}
              disabled={!canContinue || loadingCategories || loadingPlans}
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
                  <Text style={styles.continueText}>
                    Pay ₦{formatNaira(appliedCoupon ? Math.max(0, Number(amount) - appliedCoupon.amount) : amount)}
                  </Text>
                  <Feather name="shield" size={18} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
      <ContactPicker
        visible={contactPickerVisible}
        onClose={() => setContactPickerVisible(false)}
        onDone={(numbers) => handlePhoneChange(numbers[0] || '')}
        colors={colors}
      />
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
  phoneErrorText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#D94F4F',
    marginTop: -8,
    marginBottom: 12,
    marginLeft: 4,
  },
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
  networkLogo: { width: 26, height: 26, borderRadius: 13, marginRight: 8 },
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
  contactBtn: { paddingLeft: 10, paddingVertical: 6 },

  // Confirmation screen dynamic view styles
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
