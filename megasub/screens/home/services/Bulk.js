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
import { useTheme } from '../../../contexts/ThemeContext';
import CategoryTabs from '../components/CategoryTabs';
import PlanGrid from '../components/PlanGrid';
import SuccessView from '../components/SuccessView';
import ContactPicker from '../components/ContactPicker';
import WrongPinModal from '../components/WrongPinModal';
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

function CustomPinInput({ onPinComplete, colors }) {
  const [code, setCode] = useState(['', '', '', '']);
  const inputs = useRef([]);

  const handleChangeText = (text, index) => {
    const newCode = [...code];
    const cleanText = text.slice(-1);
    newCode[index] = cleanText;
    setCode(newCode);
    onPinComplete(newCode.join(''));
    if (cleanText && index < 3) inputs.current[index + 1].focus();
    // Deleting used to just clear the box and leave focus there, so the
    // very next backspace press had nothing to do — advancing back to the
    // previous box here means backspacing flows continuously across boxes.
    else if (!cleanText && index > 0) inputs.current[index - 1].focus();
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
          secureTextEntry
          value={digit}
          onChangeText={(text) => handleChangeText(text, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          textAlign="center"
        />
      ))}
    </View>
  );
}

// Parses one phone number per line (or comma-separated on one line) into a
// clean list, formatting each to the leading-zero local format.
function parseRecipients(raw) {
  return raw
    .split(/[\n,]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const cleaned = p.replace(/\s+/g, '');
      return cleaned.startsWith('0') ? cleaned : `0${cleaned}`;
    });
}

// Nigerian mobile numbers: 11 digits, leading zero. Recharging with anything
// shorter/garbled used to still go through — the backend's network-match
// check was disabled for this call (validatephonenetwork: 0) before the
// correct field usage was known. The updated API spec documents
// validatephonenetwork: 1 as the real, intended value — now set below — so
// this is server-enforced too, not just client-side. A bulk send still
// blocks on ANY invalid entry rather than silently dropping it — silently
// skipping would charge for fewer recipients than the user typed without
// telling them why.
// parseRecipients always normalizes to the leading-zero form before this
// runs (prepending '0' when missing), so recipients only ever arrive here
// in the 11-digit form — unlike Airtime/Data's raw field, which also has to
// accept the bare 10-digit local number a user might type directly.
const isValidPhone = (p) => /^0\d{10}$/.test(String(p).trim());


export default function Bulk({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [step, setStep] = useState('input');

  const [networks, setNetworks] = useState([]);
  const [loadingNetworks, setLoadingNetworks] = useState(true);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [recipientsText, setRecipientsText] = useState('');
  const [contactPickerVisible, setContactPickerVisible] = useState(false);
  const [amount, setAmount] = useState('');

  const [pin, setPin] = useState('');
  const [pinKey, setPinKey] = useState(0);
  const [wrongPinVisible, setWrongPinVisible] = useState(false);
  const [loading, setLoading] = useState(false);

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


  const handleContactsPicked = (numbers) => {
    const existing = new Set(parseRecipients(recipientsText));
    const additions = numbers.filter((n) => !existing.has(n));
    if (additions.length === 0) return;
    setRecipientsText((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}\n${additions.join('\n')}` : additions.join('\n');
    });
  };

  const recipients = parseRecipients(recipientsText);
  const invalidRecipients = recipients.filter((r) => !isValidPhone(r));
  const canContinue = !!(
    selectedNetwork &&
    selectedCategory &&
    selectedPlan &&
    recipients.length > 0 &&
    invalidRecipients.length === 0 &&
    Number(amount) > 0
  );
  const totalCost = recipients.length * (Number(amount) || 0);

  const handleFormSubmit = () => {
    if (!canContinue) return;
    setStep('confirm');
  };

  const handleBuyBulk = async () => {
    if (pin.length < 4) return;

    setLoading(true);
    try {
      const payload = {
        network_id: selectedNetwork.id,
        user_id: user?.id,
        phone_number: recipients.join(','),
        product_plan_category_id: selectedCategory.id,
        product_plan_id: selectedPlan.product_plan_id,
        pin,
        amount: String(amount),
        actual_amount: String(amount),
        wallet_category: 'main_wallet',
        validatephonenetwork: 1,
      };

      await buyAirtime(payload);
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
            onPress={() => (step === 'confirm' ? setStep('input') : navigate && navigate('home'))}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {step === 'input' ? 'Bulk Recharge' : 'Confirm Transaction'}
          </Text>
          <View style={{ width: 38 }} />
        </View>
      )}

      {step === 'success' ? (
        <SuccessView
          title="Bulk Recharge Sent!"
          subtitle={`Airtime was sent to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}.`}
          amount={totalCost}
          details={[
            { label: 'Network', value: selectedNetwork?.network_name },
            { label: 'Recipients', value: String(recipients.length) },
            { label: 'Amount Each', value: `₦${formatNaira(amount)}` },
          ].filter((d) => d.value)}
          onDone={() => navigate && navigate('home')}
          colors={colors}
        />
      ) : step === 'input' ? (
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

          <View style={styles.labelRow}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 22 }]}>Recipients</Text>
            <Text style={[styles.countBadge, { color: recipients.length ? BRAND : colors.textFaint }]}>
              {recipients.length} number{recipients.length === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={[styles.textAreaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[styles.textArea, { color: colors.text }]}
              placeholder={'One number per line, e.g.\n08168509044\n09060627548\n09011988807'}
              placeholderTextColor={colors.textFaint}
              keyboardType="phone-pad"
              multiline
              value={recipientsText}
              onChangeText={setRecipientsText}
            />
          </View>
          <Text style={[styles.hintText, { color: colors.textFaint }]}>
            Separate numbers with a comma or a new line. The same plan and amount apply to every recipient.
          </Text>
          {invalidRecipients.length > 0 && (
            <Text style={styles.phoneErrorText}>
              Fix {invalidRecipients.length === 1 ? 'this number' : 'these numbers'}: {invalidRecipients.join(', ')}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.pickContactsBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.8}
            onPress={() => setContactPickerVisible(true)}
          >
            <Feather name="user-plus" size={16} color={BRAND} />
            <Text style={styles.pickContactsText}>Pick from Contacts</Text>
          </TouchableOpacity>

          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Amount (per recipient)</Text>
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

          {selectedNetwork && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Plan</Text>
              {loadingPlans ? (
                <ActivityIndicator color={BRAND} style={{ marginTop: 10 }} />
              ) : (
                <PlanGrid
                  plans={plans.map((p) => ({ id: p.product_plan_id, title: p.product_plan_name, meta: p.product_plan_amount ? `₦${formatNaira(p.product_plan_amount)}` : undefined }))}
                  selectedId={selectedPlan?.product_plan_id}
                  onSelect={(opt) => setSelectedPlan(plans.find((p) => p.product_plan_id === opt.id))}
                  colors={colors}
                />
              )}
            </>
          )}

          {recipients.length > 0 && amount ? (
            <View style={[styles.totalCard, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
              <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Total for {recipients.length} recipients</Text>
              <Text style={[styles.totalValue, { color: BRAND }]}>₦{totalCost.toLocaleString()}</Text>
            </View>
          ) : null}
        </ScrollView>
      ) : (
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
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Recipients</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{recipients.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Amount Each</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>₦{formatNaira(amount)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Total Cost</Text>
              <Text style={[styles.summaryValue, { color: BRAND, fontFamily: FONTS.bold }]}>₦{totalCost.toLocaleString()}</Text>
            </View>
          </View>

          <Text style={[styles.pinInstructionText, { color: colors.text }]}>Enter 4-Digit Security PIN</Text>
          <CustomPinInput key={pinKey} onPinComplete={setPin} colors={colors} />
        </View>
      )}

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
              onPress={handleBuyBulk}
              disabled={pin.length < 4 || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.continueText}>Pay ₦{totalCost.toLocaleString()}</Text>
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
        onDone={handleContactsPicked}
        colors={colors}
        multi
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
    marginTop: -6,
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
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countBadge: { fontFamily: FONTS.semibold, fontSize: 12.5 },

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

  textAreaCard: {
    borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 12, minHeight: 110,
  },
  textArea: { fontFamily: FONTS.medium, fontSize: 14, minHeight: 90, textAlignVertical: 'top' },
  hintText: { fontFamily: FONTS.regular, fontSize: 11.5, marginTop: 8, lineHeight: 16 },
  pickContactsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1.5, paddingVertical: 12, marginTop: 12,
  },
  pickContactsText: { fontFamily: FONTS.semibold, fontSize: 13, color: BRAND },

  inputCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1.5, borderColor: '#ECEDF6',
  },
  nairaSign: { fontFamily: FONTS.bold, fontSize: 16, color: BRAND },
  inputDivider: { width: 1, height: 22, backgroundColor: '#ECEDF6', marginHorizontal: 12 },
  input: { flex: 1, fontFamily: FONTS.semibold, fontSize: 15, color: '#0B0D1A' },

  totalCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 16, borderWidth: 1.5, padding: 16, marginTop: 22,
  },
  totalLabel: { fontFamily: FONTS.medium, fontSize: 13 },
  totalValue: { fontFamily: FONTS.extrabold, fontWeight: '800', fontSize: 17 },

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
