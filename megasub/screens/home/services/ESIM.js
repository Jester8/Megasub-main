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
  StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchEsimCountries, fetchEsimPlans, buyEsim } from '../../../lib/api';
import { requireNetworkOrShowError } from '../../../lib/network';
import { useTheme } from '../../../contexts/ThemeContext';
import WrongPinModal from '../components/WrongPinModal';
import UnavailableNotice from '../components/UnavailableNotice';
import EsimInstallCard from '../components/EsimInstallCard';
import { alertForPurchaseError, formatUsd } from '../../../lib/format';

const FONTS = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  extrabold: 'Montserrat_800ExtraBold',
};

const BRAND = '#4A55DD';

// Matches the pattern already used in Airtime.js/ResultChecker.js/etc
// rather than a shared component.
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

export default function ESIM({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // Step Workflow: 'country' -> 'plans' -> 'confirm' -> 'success'
  const [step, setStep] = useState('country');

  const [countries, setCountries] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  // Set when the provider answers available: false (demo mode) — shown as a
  // "coming soon" notice instead of an empty list or a raw error.
  const [unavailableMessage, setUnavailableMessage] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(null);

  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const [pin, setPin] = useState('');
  const [pinKey, setPinKey] = useState(0);
  const [wrongPinVisible, setWrongPinVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [purchasedEsim, setPurchasedEsim] = useState(null);

  useEffect(() => {
    loadCountries();
  }, []);

  const loadCountries = async (query) => {
    setLoadingCountries(true);
    try {
      const json = await fetchEsimCountries(user?.id, query);
      setUnavailableMessage(null);
      // Popular destinations first, then alphabetical.
      setCountries(
        [...(json.data || [])].sort(
          (a, b) =>
            Number(!!b.is_popular) - Number(!!a.is_popular) || String(a.name).localeCompare(String(b.name))
        )
      );
    } catch (error) {
      if (error.isUnavailable) setUnavailableMessage(error.message);
      else Alert.alert('Network Error', error.message || 'Could not load countries.');
    } finally {
      setLoadingCountries(false);
    }
  };

  const handleSearchSubmit = () => loadCountries(search.trim() || undefined);

  const selectCountry = async (country) => {
    setSelectedCountry(country);
    setStep('plans');
    setLoadingPlans(true);
    try {
      const json = await fetchEsimPlans({ userId: user?.id, countryCode: country.code });
      const list = json.data || [];
      setPlans(list);
      setSelectedPlan(list[0] || null);
    } catch (error) {
      if (error.isUnavailable) {
        setStep('country');
        setUnavailableMessage(error.message);
      } else {
        Alert.alert('Network Error', error.message || 'Could not load plans for this country.');
      }
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleBuy = async () => {
    if (pin.length < 4 || !selectedPlan || !selectedCountry) return;
    if (!(await requireNetworkOrShowError())) return;

    setLoading(true);
    try {
      // No amount is sent on purpose: the backend looks up the provider's
      // real price, applies its own markup and debits that, ignoring anything
      // the app supplies. eSIMs are paid from the USD wallet only.
      const payload = {
        user_id: user?.id,
        plan_id: selectedPlan.id,
        country_code: selectedCountry.code,
        iso3: selectedCountry.iso3 || selectedPlan.iso3,
        pin,
        wallet_category: 'usd_wallet',
      };
      const json = await buyEsim(payload);
      setPurchasedEsim(json?.data || null);
      setStep('success');
    } catch (error) {
      // Demo values in an unavailable response are never shown as a real
      // eSIM — just tell the user the purchase isn't available yet.
      if (error.isUnavailable) {
        Alert.alert('Unavailable', error.message);
        return;
      }
      // A dropped connection is ambiguous: the purchase may have gone through
      // and the wallet been charged. Point at My eSIMs instead of inviting a
      // second attempt that could buy (and charge for) a duplicate.
      if (error.isNetworkError) {
        Alert.alert(
          'Check My eSIMs',
          'We lost connection before getting a response, so your eSIM may have been purchased. Check My eSIMs before trying again.',
          [
            { text: 'Not Now', style: 'cancel' },
            { text: 'View My eSIMs', onPress: () => navigate && navigate('my-esims') },
          ]
        );
        return;
      }
      const alert = alertForPurchaseError(error);
      if (alert.isWrongPin) setWrongPinVisible(true);
      else Alert.alert(alert.title, alert.message);
    } finally {
      setLoading(false);
    }
  };

  const titleForStep = {
    country: 'Global eSIM',
    plans: selectedCountry?.name || 'Select Plan',
    confirm: 'Confirm Transaction',
  }[step];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />
      {step !== 'success' && (
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.card }]}
            onPress={() => {
              if (step === 'confirm') setStep('plans');
              else if (step === 'plans') setStep('country');
              else navigate && navigate('home');
            }}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{titleForStep}</Text>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.card }]}
            onPress={() => navigate && navigate('my-esims')}
            activeOpacity={0.7}
          >
            <Feather name="list" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}

      {step === 'success' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.successHeader}>
            <View style={styles.successIconWrap}>
              <Feather name="check-circle" size={48} color="#16A34A" />
            </View>
            <Text style={[styles.successTitle, { color: colors.text }]}>eSIM Ready!</Text>
            <Text style={[styles.successSubtitle, { color: colors.textMuted }]}>
              {selectedPlan?.name} for {selectedCountry?.name} is ready to activate.
            </Text>
          </View>

          <EsimInstallCard esim={purchasedEsim} colors={colors} />

          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 14 }]}>
            {purchasedEsim?.price ? (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Paid</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {formatUsd(purchasedEsim.price, purchasedEsim.currency)}
                </Text>
              </View>
            ) : null}
            {purchasedEsim?.reference ? (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Reference</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{purchasedEsim.reference}</Text>
              </View>
            ) : null}
            {purchasedEsim?.expiry_date ? (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Expires</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{purchasedEsim.expiry_date}</Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.disclaimerText, { color: colors.textFaint }]}>
            Not all phones support eSIM. Check your device's settings before traveling.
          </Text>

          <TouchableOpacity
            style={styles.doneBtn}
            activeOpacity={0.85}
            onPress={() => navigate && navigate('my-esims')}
          >
            <Text style={styles.doneText}>View My eSIMs</Text>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </ScrollView>
      ) : step === 'country' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search country"
              placeholderTextColor={colors.textFaint}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
          </View>

          {loadingCountries ? (
            <ActivityIndicator color={BRAND} style={{ marginTop: 20 }} />
          ) : unavailableMessage ? (
            <UnavailableNotice
              title="eSIM Coming Soon"
              message={unavailableMessage}
              icon="globe"
              colors={colors}
            />
          ) : countries.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No countries found.</Text>
          ) : (
            countries.map((c) => (
              <TouchableOpacity
                key={c.code}
                style={[styles.countryRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.8}
                onPress={() => selectCountry(c)}
              >
                <Text style={styles.countryFlag}>{c.flag_emoji || '🌍'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.countryName, { color: colors.text }]}>{c.name}</Text>
                  {c.region ? <Text style={[styles.countryRegion, { color: colors.textFaint }]}>{c.region}</Text> : null}
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      ) : step === 'plans' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {loadingPlans ? (
            <ActivityIndicator color={BRAND} style={{ marginTop: 20 }} />
          ) : plans.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No plans available for this country.</Text>
          ) : (
            plans.map((p) => {
              const active = selectedPlan?.id === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.planCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    active && styles.planCardActive,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedPlan(p)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planName, { color: colors.text }]}>{p.name}</Text>
                    <Text style={[styles.planMeta, { color: colors.textMuted }]}>
                      {p.data_size} · Valid {p.validity_days} days
                    </Text>
                  </View>
                  <Text style={[styles.planPrice, active && { color: BRAND }]}>{formatUsd(p.price, p.currency)}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      ) : (
        <View style={styles.confirmContent}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Transaction Summary</Text>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Country</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{selectedCountry?.name}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Plan</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{selectedPlan?.name}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Total Cost</Text>
              <Text style={[styles.summaryValue, { color: BRAND, fontFamily: FONTS.bold }]}>
                {formatUsd(selectedPlan?.price, selectedPlan?.currency)}
              </Text>
            </View>
          </View>

          <Text style={[styles.disclaimerText, { color: colors.textFaint, marginBottom: 6 }]}>
            Paid from your USD wallet only, with no automatic conversion from your main wallet. The final price is
            confirmed when you pay.
          </Text>

          <Text style={[styles.pinInstructionText, { color: colors.text }]}>Enter 4-Digit Security PIN</Text>
          <CustomPinInput key={pinKey} onPinComplete={(text) => setPin(text)} colors={colors} />
        </View>
      )}

      {step !== 'success' && step !== 'country' && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background }]}>
          {step === 'plans' ? (
            <TouchableOpacity
              style={[styles.continueBtn, (!selectedPlan || loadingPlans) && styles.continueBtnDisabled]}
              activeOpacity={0.85}
              onPress={() => setStep('confirm')}
              disabled={!selectedPlan || loadingPlans}
            >
              <Text style={styles.continueText}>Continue</Text>
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
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.continueText}>Pay {formatUsd(selectedPlan?.price, selectedPlan?.currency)}</Text>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', elevation: 2,
    shadowColor: '#0B0D1A', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 16, color: '#0B0D1A', flex: 1, textAlign: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },
  confirmContent: { paddingHorizontal: 20, paddingTop: 10 },
  sectionLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: '#6B7088', marginTop: 22, marginBottom: 10 },
  emptyText: { fontFamily: FONTS.medium, fontSize: 13, textAlign: 'center', marginTop: 20 },

  inputCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, paddingHorizontal: 16, height: 52, borderWidth: 1.5, borderColor: '#ECEDF6',
    marginTop: 16, gap: 10,
  },
  searchInput: { flex: 1, fontFamily: FONTS.medium, fontSize: 14, color: '#0B0D1A' },

  countryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1.5, borderColor: '#ECEDF6',
    paddingHorizontal: 16, paddingVertical: 14, marginTop: 10,
  },
  countryFlag: { fontSize: 22 },
  countryName: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A' },
  countryRegion: { fontFamily: FONTS.regular, fontSize: 11.5, marginTop: 2 },

  planCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1.5, borderColor: '#ECEDF6',
    paddingHorizontal: 16, paddingVertical: 14, marginTop: 12,
  },
  planCardActive: { borderColor: BRAND, backgroundColor: 'rgba(74,85,221,0.06)' },
  planName: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A', marginBottom: 3 },
  planMeta: { fontFamily: FONTS.medium, fontSize: 12, color: '#6B7088' },
  planPrice: { fontFamily: FONTS.bold, fontSize: 14, color: '#0B0D1A' },

  summaryCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: '#ECEDF6', marginTop: 22,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  summaryLabel: { fontFamily: FONTS.medium, fontSize: 13, color: '#6B7088' },
  summaryValue: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A' },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  codeText: { fontFamily: FONTS.bold, fontSize: 15, flex: 1, marginRight: 10 },
  pinInstructionText: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A', textAlign: 'center', marginBottom: 16, marginTop: 10 },

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
  successTitle: { fontFamily: FONTS.extrabold, fontSize: 20, marginBottom: 6 },
  successSubtitle: { fontFamily: FONTS.medium, fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },

  qrCard: {
    alignItems: 'center', borderRadius: 16, borderWidth: 1.5, padding: 20, marginBottom: 14,
  },
  qrImage: { width: 180, height: 180, marginBottom: 12 },
  qrHint: { fontFamily: FONTS.regular, fontSize: 12, textAlign: 'center' },
  disclaimerText: { fontFamily: FONTS.regular, fontSize: 11.5, textAlign: 'center', marginTop: 14, paddingHorizontal: 10 },

  doneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: BRAND, borderRadius: 18, height: 56, gap: 8, marginTop: 20,
  },
  doneText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },
});
