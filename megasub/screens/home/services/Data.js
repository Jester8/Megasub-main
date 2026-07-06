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
import { fetchNetworks, fetchProductPlanCategories, fetchProductPlans, buyData } from '../../../lib/api';

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

export default function Data({ navigate, user }) {
  const insets = useSafeAreaInsets();
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
  const [phone, setPhone] = useState('');

  const [pin, setPin] = useState('');
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
      setNetworks(json.data || []);
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
      const json = await fetchProductPlanCategories({ userId: user?.id, productSlug: 'data', networkId });
      setCategories(json.data || []);
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
      setPlans(json.data || []);
    } catch (error) {
      Alert.alert('Network Error', error.message || 'Could not load data plans.');
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleFormSubmit = () => {
    if (!selectedNetwork || !phone || !selectedCategory || !selectedPlan) return;
    setStep('confirm');
  };

  const handleBuyData = async () => {
    if (pin.length < 4) return;

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
        wallet_category: 'main_wallet',
        validatephonenetwork: 0,
      };

      await buyData(payload);
      Alert.alert('Success 🎉', 'Data subscription processing complete.');
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
          {step === 'input' ? 'Data Subscription' : 'Confirm Transaction'}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {step === 'input' ? (
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

          <View style={styles.couponBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.couponEyebrow}>Test 22</Text>
              <Text style={styles.couponTitle}>Hellobrosam</Text>
              <Text style={styles.couponSub}>For null</Text>
            </View>
            <TouchableOpacity activeOpacity={0.8}>
              <Text style={styles.couponBtn}>Apply Coupon</Text>
            </TouchableOpacity>
          </View>

          {selectedNetwork ? (
            <>
              <Text style={styles.sectionLabel}>Data Category</Text>
              {loadingCategories ? (
                <ActivityIndicator color={BRAND} style={{ marginTop: 10 }} />
              ) : (
                <View style={styles.categoryRow}>
                  {categories.map((c) => {
                    const active = selectedCategory?.id === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.categoryChip, active && styles.categoryChipActive]}
                        onPress={() => setSelectedCategory(c)}
                        activeOpacity={0.8}
                      >
                        {c.is_hot_sales ? (
                          <View style={styles.hotDot} />
                        ) : null}
                        <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                          {c.product_plan_category_name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {selectedCategory ? (
                <>
                  <Text style={styles.sectionLabel}>Choose a Plan</Text>
                  {loadingPlans ? (
                    <ActivityIndicator color={BRAND} style={{ marginTop: 10 }} />
                  ) : (
                    <View style={styles.planList}>
                      {plans.map((p) => {
                        const active = selectedPlan?.product_plan_id === p.product_plan_id;
                        return (
                          <TouchableOpacity
                            key={p.product_plan_id}
                            style={[styles.planCard, active && styles.planCardActive]}
                            onPress={() => setSelectedPlan(p)}
                            activeOpacity={0.8}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.planSize, active && styles.planSizeActive]}>{p.product_plan_name}</Text>
                              <Text style={styles.planValidity}>{p.validity_in_days} Days Validity</Text>
                            </View>
                            <Text style={[styles.planPrice, active && styles.planSizeActive]}>₦{p.selling_price}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </>
              ) : null}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Feather name="box" size={40} color="#B7BCEF" />
              <Text style={styles.emptyText}>
                Choose Your Preferred Network Provider to Discover Exclusive Offers Tailored to Your Network Preferences
              </Text>
            </View>
          )}
        </ScrollView>
      ) : (
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
              <Text style={styles.summaryLabel}>Plan</Text>
              <Text style={styles.summaryValue}>{selectedPlan?.product_plan_name}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Cost</Text>
              <Text style={[styles.summaryValue, { color: BRAND, fontFamily: FONTS.bold }]}>₦{selectedPlan?.selling_price}</Text>
            </View>
          </View>

          <Text style={styles.pinInstructionText}>Enter 4-Digit Security PIN</Text>
          <CustomPinInput onPinComplete={(text) => setPin(text)} />
        </View>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {step === 'input' ? (
          <TouchableOpacity
            style={[styles.continueBtn, (!selectedNetwork || !phone || !selectedCategory || !selectedPlan) && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleFormSubmit}
            disabled={!selectedNetwork || !phone || !selectedCategory || !selectedPlan}
          >
            <Text style={styles.continueText}>Continue</Text>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.continueBtn, (pin.length < 4 || loading) && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleBuyData}
            disabled={pin.length < 4 || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.continueText}>Pay ₦{selectedPlan?.selling_price}</Text>
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
  inputDivider: { width: 1, height: 22, backgroundColor: '#ECEDF6', marginHorizontal: 12 },
  input: { flex: 1, fontFamily: FONTS.semibold, fontSize: 15, color: '#0B0D1A' },

  couponBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, borderWidth: 1.5, borderColor: BRAND, padding: 14, marginTop: 16,
  },
  couponEyebrow: { fontFamily: FONTS.medium, fontSize: 11, color: '#9CA0B8' },
  couponTitle: { fontFamily: FONTS.bold, fontSize: 14, color: BRAND, marginTop: 1 },
  couponSub: { fontFamily: FONTS.regular, fontSize: 11, color: '#9CA0B8', marginTop: 1 },
  couponBtn: { fontFamily: FONTS.bold, fontSize: 13, color: BRAND },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyText: { fontFamily: FONTS.medium, fontSize: 13.5, color: '#9CA0B8', textAlign: 'center', marginTop: 14, lineHeight: 20 },

  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 14,
    borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#ECEDF6',
  },
  categoryChipActive: { backgroundColor: BRAND, borderColor: BRAND },
  categoryChipText: { fontFamily: FONTS.semibold, fontSize: 12.5, color: '#0B0D1A' },
  categoryChipTextActive: { color: '#FFFFFF' },
  hotDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' },

  planList: { gap: 10 },
  planCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#ECEDF6',
  },
  planCardActive: { borderColor: BRAND, backgroundColor: 'rgba(74,85,221,0.06)' },
  planSize: { fontFamily: FONTS.bold, fontSize: 14, color: '#0B0D1A' },
  planSizeActive: { color: BRAND },
  planValidity: { fontFamily: FONTS.regular, fontSize: 11.5, color: '#9CA0B8', marginTop: 2 },
  planPrice: { fontFamily: FONTS.bold, fontSize: 14, color: '#0B0D1A' },

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

  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18, backgroundColor: '#F7F8FC' },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: BRAND, borderRadius: 18, height: 56, gap: 8,
    shadowColor: BRAND, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  continueBtnDisabled: { backgroundColor: '#B7BCEF', shadowOpacity: 0, elevation: 0 },
  continueText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },
});
