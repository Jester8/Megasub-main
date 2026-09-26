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
import {
  fetchProductPlanCategories,
  fetchProductPlans,
  buyBulkData,
  retryBulkDataBatch,
  isLocalBulkBatch,
} from '../../../lib/api';
import { useNetworksQuery } from '../../../lib/queries';
import { requireNetworkOrShowError } from '../../../lib/network';
import { useTheme } from '../../../contexts/ThemeContext';
import CategoryTabs from '../components/CategoryTabs';
import PlanGrid from '../components/PlanGrid';
import ContactPicker from '../components/ContactPicker';
import WrongPinModal from '../components/WrongPinModal';
import { formatNaira, alertForPurchaseError, stripNetworkPrefix, formatPlanTitle } from '../../../lib/format';

const FONTS = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  extrabold: 'Montserrat_800ExtraBold',
};

const BRAND = '#4A55DD';
// Capped per the v2 spec's "Bulk data batch performance at scale" risk note
// — keeps a single batch call from timing out server-side.
const MAX_BATCH_SIZE = 50;

const NETWORK_COLORS = {
  MTN: '#FFC700',
  AIRTEL: '#FF1E1E',
  '9MOBILE': '#0B6E4F',
  GLO: '#3FA535',
};

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

// One number per line or comma-separated, normalized to leading-zero form —
// matches Bulk.js's (bulk airtime) parser exactly for consistency.
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

const isValidPhone = (p) => /^0\d{10}$/.test(String(p).trim());

export default function BulkData({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // Step: 'input' -> 'review' -> 'confirm' -> 'result'
  const [step, setStep] = useState('input');

  const { data: networks = [], isLoading: loadingNetworks } = useNetworksQuery(user?.id);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [recipientsText, setRecipientsText] = useState('');
  const [contactPickerVisible, setContactPickerVisible] = useState(false);

  const [pin, setPin] = useState('');
  const [pinKey, setPinKey] = useState(0);
  const [wrongPinVisible, setWrongPinVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  // { current, total } while a batch is being sent one recipient at a time.
  const [progress, setProgress] = useState(null);
  const [batchResult, setBatchResult] = useState(null); // { batch_id, total_amount, results: [{phone_number,status,failure_reason}] }

  useEffect(() => {
    if (!selectedNetwork && networks.length > 0) setSelectedNetwork(networks[0]);
  }, [networks]);

  useEffect(() => {
    if (selectedNetwork) loadCategories(selectedNetwork.id);
  }, [selectedNetwork]);

  useEffect(() => {
    if (selectedNetwork && selectedCategory) loadPlans(selectedNetwork.id, selectedCategory.id);
  }, [selectedCategory]);

  const loadCategories = async (networkId) => {
    setLoadingCategories(true);
    setSelectedCategory(null);
    setPlans([]);
    setSelectedPlan(null);
    try {
      const json = await fetchProductPlanCategories({ userId: user?.id, productSlug: 'data', networkId });
      // CG (Corporate Gifting) isn't offered — hide it rather than let
      // users pick a data type that isn't actually usable.
      const list = (json.data || []).filter((c) => !/\bCG\b/i.test(c.product_plan_category_name));
      setCategories(list);
      if (list.length > 0) setSelectedCategory(list[0]);
    } catch (error) {
      Alert.alert('Network Error', error.message || 'Could not load data categories.');
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadPlans = async (networkId, planCategoryId) => {
    setLoadingPlans(true);
    setSelectedPlan(null);
    try {
      const json = await fetchProductPlans({ userId: user?.id, productSlug: 'data', networkId, planCategoryId });
      const list = json.data || [];
      setPlans(list);
      if (list.length > 0) setSelectedPlan(list[0]);
    } catch (error) {
      Alert.alert('Network Error', error.message || 'Could not load data plans.');
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

  const recipientsRaw = parseRecipients(recipientsText);
  const invalidRecipients = recipientsRaw.filter((r) => !isValidPhone(r));
  const duplicateRecipients = recipientsRaw.filter((r, i) => recipientsRaw.indexOf(r) !== i);
  const recipients = [...new Set(recipientsRaw)];
  const unitPrice = Number(selectedPlan?.selling_price || 0);
  const totalCost = unitPrice * recipients.length;

  const canContinue = !!(
    selectedNetwork &&
    selectedCategory &&
    selectedPlan &&
    recipients.length > 0 &&
    recipients.length <= MAX_BATCH_SIZE &&
    invalidRecipients.length === 0
  );

  const handleReview = () => {
    if (!canContinue) return;
    setStep('review');
  };

  const handleBuy = async () => {
    if (pin.length < 4) return;
    if (!(await requireNetworkOrShowError())) return;

    setLoading(true);
    try {
      const payload = {
        user_id: user?.id,
        network_id: selectedNetwork.id,
        product_plan_category_id: selectedCategory.id,
        product_plan_id: selectedPlan.product_plan_id,
        pin,
        wallet_category: 'main_wallet',
        recipients,
      };
      const json = await buyBulkData(payload, {
        unitPrice,
        onProgress: (index, total) => setProgress({ current: index + 1, total }),
      });
      setBatchResult(json?.data || { results: recipients.map((r) => ({ phone_number: r, status: 'successful' })) });
      setStep('result');
    } catch (error) {
      const alert = alertForPurchaseError(error);
      if (alert.isWrongPin) setWrongPinVisible(true);
      else Alert.alert(alert.title, alert.message);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const failedEntries = (batchResult?.results || []).filter((r) => r.status === 'failed');

  const handleRetryFailed = async () => {
    if (!batchResult?.batch_id) return;
    setRetrying(true);
    try {
      const json = await retryBulkDataBatch(
        { user_id: user?.id, batch_id: batchResult.batch_id, pin },
        {
          base: {
            user_id: user?.id,
            network_id: selectedNetwork.id,
            product_plan_category_id: selectedCategory.id,
            product_plan_id: selectedPlan.product_plan_id,
            pin,
          },
          recipients: failedEntries.map((f) => f.phone_number),
          unitPrice,
          onProgress: (index, total) => setProgress({ current: index + 1, total }),
        }
      );
      const updatedResults = [...(batchResult.results || [])];
      (json?.data?.results || []).forEach((r) => {
        const idx = updatedResults.findIndex((u) => u.phone_number === r.phone_number);
        if (idx >= 0) updatedResults[idx] = r;
      });
      // A batch made client-side has no server total, so it is recomputed
      // from the merged results; a server batch reports its own.
      const totalAmount = isLocalBulkBatch(batchResult.batch_id)
        ? (unitPrice * updatedResults.filter((r) => r.status !== 'failed').length).toFixed(4)
        : json?.data?.total_amount ?? batchResult.total_amount;
      setBatchResult({ ...batchResult, total_amount: totalAmount, results: updatedResults });
    } catch (error) {
      const alert = alertForPurchaseError(error);
      if (alert.isWrongPin) setWrongPinVisible(true);
      else Alert.alert('Retry Failed', error.message || 'Could not retry the failed entries.');
    } finally {
      setRetrying(false);
      setProgress(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />
      {step !== 'result' && (
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.card }]}
            onPress={() => {
              // A batch is mid-flight: leaving now would hide its results.
              if (loading) return;
              if (step === 'confirm') setStep('review');
              else if (step === 'review') setStep('input');
              else navigate && navigate('home');
            }}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {step === 'input' ? 'Bulk Data' : step === 'review' ? 'Review Batch' : 'Confirm Transaction'}
          </Text>
          <View style={{ width: 38 }} />
        </View>
      )}

      {step === 'result' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.successHeader}>
            <View style={styles.successIconWrap}>
              <Feather
                name={failedEntries.length === 0 ? 'check-circle' : 'alert-circle'}
                size={48}
                color={failedEntries.length === 0 ? '#16A34A' : '#F59E0B'}
              />
            </View>
            <Text style={[styles.successTitle, { color: colors.text }]}>
              {failedEntries.length === 0 ? 'Batch Sent!' : 'Batch Partially Sent'}
            </Text>
            <Text style={[styles.successSubtitle, { color: colors.textMuted }]}>
              {(batchResult?.results || []).length - failedEntries.length} of {(batchResult?.results || []).length}{' '}
              recipients received data successfully.
              {batchResult?.total_amount ? ` Total charged: ₦${formatNaira(Number(batchResult.total_amount))}.` : ''}
            </Text>
          </View>

          {(batchResult?.results || []).map((r, i) => {
            const failed = r.status === 'failed';
            return (
              <View
                key={i}
                style={[
                  styles.resultRow,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Feather
                  name={failed ? 'x-circle' : 'check-circle'}
                  size={18}
                  color={failed ? '#DC2626' : '#16A34A'}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.resultPhone, { color: colors.text }]}>{r.phone_number}</Text>
                  {failed && r.failure_reason ? (
                    <Text style={styles.resultReason}>{r.failure_reason}</Text>
                  ) : null}
                </View>
                <Text style={[styles.resultStatus, { color: failed ? '#DC2626' : '#16A34A' }]}>
                  {failed ? 'Failed' : 'Success'}
                </Text>
              </View>
            );
          })}

          {failedEntries.length > 0 ? (
            <TouchableOpacity
              style={[styles.retryBtn, retrying && styles.continueBtnDisabled]}
              activeOpacity={0.85}
              onPress={handleRetryFailed}
              disabled={retrying}
            >
              {retrying ? (
                <>
                  <ActivityIndicator color="#FFFFFF" />
                  {progress ? (
                    <Text style={styles.continueText}>Sending {progress.current} of {progress.total}</Text>
                  ) : null}
                </>
              ) : (
                <>
                  <Feather name="refresh-cw" size={16} color="#FFFFFF" />
                  <Text style={styles.continueText}>Retry {failedEntries.length} Failed</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.doneBtn} activeOpacity={0.85} onPress={() => navigate && navigate('home')}>
            <Text style={styles.doneText}>Back to Home</Text>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </ScrollView>
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
                    {logo ? <Image source={logo} style={styles.networkLogo} /> : <View style={[styles.networkDot, { backgroundColor: color }]} />}
                    <Text style={[styles.networkLabel, { color: colors.text }, active && styles.networkLabelActive]}>{n.network_name}</Text>
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
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Data Type</Text>
              {loadingCategories ? (
                <ActivityIndicator color={BRAND} style={{ marginTop: 10 }} />
              ) : (
                <CategoryTabs
                  options={categories.map((c) => ({ id: c.id, label: stripNetworkPrefix(c.product_plan_category_name, selectedNetwork?.network_name) }))}
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

          <TouchableOpacity
            style={[styles.pickContactsBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.8}
            onPress={() => setContactPickerVisible(true)}
          >
            <Feather name="user-plus" size={16} color={BRAND} />
            <Text style={styles.pickContactsText}>Pick from Contacts</Text>
          </TouchableOpacity>

          <View style={[styles.textAreaCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
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
            Separate numbers with a comma or a new line. Up to {MAX_BATCH_SIZE} per batch. The same plan applies to every recipient.
          </Text>
          {invalidRecipients.length > 0 && (
            <Text style={styles.phoneErrorText}>
              Fix {invalidRecipients.length === 1 ? 'this number' : 'these numbers'}: {invalidRecipients.join(', ')}
            </Text>
          )}
          {duplicateRecipients.length > 0 && (
            <Text style={styles.warnText}>
              Duplicate number{duplicateRecipients.length === 1 ? '' : 's'} removed: {[...new Set(duplicateRecipients)].join(', ')}
            </Text>
          )}
          {recipients.length > MAX_BATCH_SIZE && (
            <Text style={styles.phoneErrorText}>Batches are limited to {MAX_BATCH_SIZE} recipients.</Text>
          )}

          {selectedNetwork && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Plan</Text>
              {loadingPlans ? (
                <ActivityIndicator color={BRAND} style={{ marginTop: 10 }} />
              ) : (
                <PlanGrid
                  plans={plans.map((p) => ({ id: p.product_plan_id, title: formatPlanTitle(p.product_plan_name), meta: p.selling_price ? `₦${formatNaira(p.selling_price)}` : undefined }))}
                  selectedId={selectedPlan?.product_plan_id}
                  onSelect={(opt) => setSelectedPlan(plans.find((p) => p.product_plan_id === opt.id))}
                  colors={colors}
                />
              )}
            </>
          )}

          {recipients.length > 0 && unitPrice > 0 ? (
            <View style={[styles.totalCard, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
              <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Total for {recipients.length} recipients</Text>
              <Text style={[styles.totalValue, { color: BRAND }]}>₦{totalCost.toLocaleString()}</Text>
            </View>
          ) : null}
        </ScrollView>
      ) : step === 'review' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Network</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{selectedNetwork?.network_name}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Plan</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{selectedPlan?.product_plan_name}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Recipients</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{recipients.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Total Cost</Text>
              <Text style={[styles.summaryValue, { color: BRAND, fontFamily: FONTS.bold }]}>₦{totalCost.toLocaleString()}</Text>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Recipient List</Text>
          {recipients.map((r, i) => (
            <View key={r} style={[styles.reviewRow, { borderBottomColor: colors.divider }]}>
              <Text style={[styles.reviewIndex, { color: colors.textFaint }]}>{i + 1}</Text>
              <Text style={[styles.reviewPhone, { color: colors.text }]}>{r}</Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.confirmContent}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Transaction Summary</Text>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Recipients</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{recipients.length}</Text>
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

      {step !== 'result' && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background }]}>
          {step === 'input' ? (
            <TouchableOpacity
              style={[styles.continueBtn, (!canContinue || loadingCategories || loadingPlans) && styles.continueBtnDisabled]}
              activeOpacity={0.85}
              onPress={handleReview}
              disabled={!canContinue || loadingCategories || loadingPlans}
            >
              <Text style={styles.continueText}>Review Batch</Text>
              <Feather name="arrow-right" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          ) : step === 'review' ? (
            <TouchableOpacity style={styles.continueBtn} activeOpacity={0.85} onPress={() => setStep('confirm')}>
              <Text style={styles.continueText}>Continue to Pay</Text>
              <Feather name="arrow-right" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.continueBtn, (pin.length < 4 || loading) && styles.continueBtnDisabled]}
              activeOpacity={0.85}
              onPress={handleBuy}
              disabled={pin.length < 4 || loading}
            >
              {loading ? (
                <>
                  <ActivityIndicator color="#FFFFFF" />
                  {progress ? (
                    <Text style={styles.continueText}>Sending {progress.current} of {progress.total}</Text>
                  ) : null}
                </>
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
  phoneErrorText: { fontFamily: FONTS.regular, fontSize: 12, color: '#D94F4F', marginTop: -6, marginBottom: 12, marginLeft: 4 },
  warnText: { fontFamily: FONTS.regular, fontSize: 12, color: '#B45309', marginTop: 6, marginBottom: 6, marginLeft: 4 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', elevation: 2,
    shadowColor: '#0B0D1A', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
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

  textAreaCard: { borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 12, minHeight: 110 },
  textArea: { fontFamily: FONTS.medium, fontSize: 14, minHeight: 90, textAlignVertical: 'top' },
  hintText: { fontFamily: FONTS.regular, fontSize: 11.5, marginTop: 8, lineHeight: 16 },
  pickContactsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1.5, paddingVertical: 12, marginTop: 12,
  },
  pickContactsText: { fontFamily: FONTS.semibold, fontSize: 13, color: BRAND },

  totalCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 16, borderWidth: 1.5, padding: 16, marginTop: 22,
  },
  totalLabel: { fontFamily: FONTS.medium, fontSize: 13 },
  totalValue: { fontFamily: FONTS.extrabold, fontWeight: '800', fontSize: 17 },

  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#ECEDF6', marginTop: 10, marginBottom: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  summaryLabel: { fontFamily: FONTS.medium, fontSize: 13, color: '#6B7088' },
  summaryValue: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A' },
  pinInstructionText: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A', textAlign: 'center', marginBottom: 16 },

  reviewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, gap: 12 },
  reviewIndex: { fontFamily: FONTS.medium, fontSize: 12, width: 20 },
  reviewPhone: { fontFamily: FONTS.semibold, fontSize: 14 },

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

  successHeader: { alignItems: 'center', paddingVertical: 20 },
  successIconWrap: { marginBottom: 14 },
  successTitle: { fontFamily: FONTS.extrabold, fontWeight: '800', fontSize: 20, marginBottom: 6 },
  successSubtitle: { fontFamily: FONTS.medium, fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },

  resultRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1.5, padding: 14, marginTop: 10 },
  resultPhone: { fontFamily: FONTS.semibold, fontSize: 14 },
  resultReason: { fontFamily: FONTS.regular, fontSize: 11, color: '#DC2626', marginTop: 2 },
  resultStatus: { fontFamily: FONTS.semibold, fontSize: 12 },

  retryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#F59E0B', borderRadius: 18, height: 52, marginTop: 20,
  },

  doneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: BRAND, borderRadius: 18, height: 56, gap: 8, marginTop: 14,
  },
  doneText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },
});
