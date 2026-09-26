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
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchResultCheckerProducts, buyResultChecker } from '../../../lib/api';
import { requireNetworkOrShowError } from '../../../lib/network';
import { useTheme } from '../../../contexts/ThemeContext';
import WrongPinModal from '../components/WrongPinModal';
import UnavailableNotice from '../components/UnavailableNotice';

// Official WAEC/NECO marks, sourced directly from their own sites (NECO) and
// a CC-BY-SA-licensed upload (WAEC) — used the same nominative way the app
// already shows MTN/Airtel/DSTV logos: to identify which board a purchase
// option represents, not as decorative branding.
const EXAM_LOGOS = {
  WAEC: require('../../../assets/result-checker/waec.png'),
  NECO: require('../../../assets/result-checker/neco.png'),
};
import { formatNaira, alertForPurchaseError, sanitizePositiveInt } from '../../../lib/format';

const FONTS = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  extrabold: 'Montserrat_800ExtraBold',
};

const BRAND = '#4A55DD';
const MAX_QUANTITY = 10;

// Custom, zero-dependency OTP input inside the same file for robustness on
// Expo — matches the pattern already used in Airtime.js/Data.js/Cable.js/
// Electricity.js/Bulk.js rather than introducing a shared component.
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

// One issued PIN on the success screen — masked by default, revealed on
// tap, with its own copy button. Matches the v2 spec's "PIN reveal state:
// masked by default, revealed on tap, always visible in history" note;
// TransactionHistory/ReceiptModal already show the raw value once revealed
// here, since the transaction record itself carries the real PIN.
function PinCard({ pin, index, colors }) {
  const [revealed, setRevealed] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(pin.pin || pin.serial || '');
    Alert.alert('Copied', 'PIN copied to clipboard.');
  };

  return (
    <View style={[styles.pinCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.pinCardHeader}>
        <Text style={[styles.pinCardLabel, { color: colors.textMuted }]}>PIN {index + 1}</Text>
        {pin.serial ? (
          <Text style={[styles.pinCardSerial, { color: colors.textFaint }]}>Serial: {pin.serial}</Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={styles.pinValueRow}
        activeOpacity={0.7}
        onPress={() => setRevealed((r) => !r)}
      >
        <Text style={[styles.pinValue, { color: colors.text }]}>
          {revealed ? pin.pin : '•••• •••• ••••'}
        </Text>
        <View style={styles.pinValueActions}>
          <Feather name={revealed ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
          <TouchableOpacity onPress={handleCopy} activeOpacity={0.7} style={{ marginLeft: 14 }}>
            <Feather name="copy" size={18} color={BRAND} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default function ResultChecker({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // Step Workflow Toggle: 'input' (Form screen), 'confirm' (Pin screen), 'success'
  const [step, setStep] = useState('input');

  // Catalog State — one entry per exam board (e.g. WAEC, NECO), each with
  // its own unit price per PIN.
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  // Set when the catalog route isn't live yet (or the provider says so).
  const [unavailableMessage, setUnavailableMessage] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Form State
  const [quantity, setQuantity] = useState(1);

  // Auth State
  const [pin, setPin] = useState('');
  const [pinKey, setPinKey] = useState(0);
  const [wrongPinVisible, setWrongPinVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [purchasedPins, setPurchasedPins] = useState([]);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const json = await fetchResultCheckerProducts(user?.id);
      const list = json.data || [];
      setProducts(list);
      if (list.length > 0) setSelectedProduct(list[0]);
    } catch (error) {
      if (error.isUnavailable) setUnavailableMessage(error.message);
      else Alert.alert('Network Error', error.message || 'Could not load result checker options.');
    } finally {
      setLoadingProducts(false);
    }
  };

  const unitPrice = Number(selectedProduct?.price || 0);
  const totalCost = unitPrice * quantity;
  // purchase_available is false while the provider isn't live — the catalog
  // still lists WAEC/NECO with their prices, but buying must stay blocked.
  const purchaseAvailable = selectedProduct?.purchase_available !== false;
  // available_stock is real, finite scratch-card inventory now that this is
  // live — undefined (older/demo responses without the field) is treated as
  // no cap rather than blocking every purchase.
  const availableStock = selectedProduct?.available_stock;
  const inStock = availableStock === undefined || availableStock > 0;
  const stockCap = availableStock === undefined ? MAX_QUANTITY : Math.min(MAX_QUANTITY, availableStock);
  const canContinue =
    !!selectedProduct && purchaseAvailable && inStock && quantity > 0 && quantity <= stockCap;

  // Selecting a product with less stock than the current quantity, or one
  // that's out of stock, must not leave quantity sitting above what can
  // actually be bought.
  useEffect(() => {
    if (!selectedProduct) return;
    setQuantity((q) => Math.max(1, Math.min(q, stockCap)));
  }, [selectedProduct?.id]);

  const handleFormSubmit = () => {
    if (!canContinue) return;
    setStep('confirm');
  };

  const handleBuy = async () => {
    if (pin.length < 4) return;
    if (!(await requireNetworkOrShowError())) return;

    setLoading(true);
    try {
      const payload = {
        user_id: user?.id,
        exam_type: selectedProduct.exam_type || selectedProduct.name,
        product_id: selectedProduct.id,
        quantity,
        pin,
        amount: String(totalCost),
        wallet_category: 'main_wallet',
      };

      const json = await buyResultChecker(payload);
      // Response is expected to carry one entry per unit purchased, e.g.
      // { data: { pins: [{ pin, serial }, ...] } } — see the endpoint list
      // handed to the backend for the exact contract.
      const pins = json?.data?.pins || json?.data?.result_checkers || [];
      setPurchasedPins(pins);
      setStep('success');
    } catch (error) {
      // An unavailable response carries demo PINs — never surfaced as real
      // ones, and nothing was debited.
      if (error.isUnavailable) {
        Alert.alert('Unavailable', error.message);
        setStep('input');
        return;
      }
      const alert = alertForPurchaseError(error);
      if (alert.isWrongPin) {
        setWrongPinVisible(true);
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
            {step === 'input' ? 'Result Checker' : 'Confirm Transaction'}
          </Text>
          <View style={{ width: 38 }} />
        </View>
      )}

      {step === 'success' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.successHeader}>
            <View style={styles.successIconWrap}>
              <Feather name="check-circle" size={48} color="#16A34A" />
            </View>
            <Text style={[styles.successTitle, { color: colors.text }]}>Purchase Successful!</Text>
            <Text style={[styles.successSubtitle, { color: colors.textMuted }]}>
              {quantity} {selectedProduct?.exam_type || selectedProduct?.name} result checker
              {quantity > 1 ? ' PINs' : ' PIN'} ready below.
            </Text>
          </View>

          {purchasedPins.length > 0 ? (
            purchasedPins.map((p, i) => <PinCard key={i} pin={p} index={i} colors={colors} />)
          ) : (
            <Text style={[styles.emptyPinsText, { color: colors.textMuted }]}>
              Your PIN(s) will also be saved under Transaction History if they don't appear here.
            </Text>
          )}

          <TouchableOpacity
            style={styles.doneBtn}
            activeOpacity={0.85}
            onPress={() => navigate && navigate('home')}
          >
            <Text style={styles.doneText}>Back to Home</Text>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </ScrollView>
      ) : unavailableMessage && step === 'input' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <UnavailableNotice
            title="Result Checker Coming Soon"
            message={unavailableMessage}
            icon="book-open"
            colors={colors}
          />
        </ScrollView>
      ) : step === 'input' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Select Exam Board</Text>
          {loadingProducts ? (
            <ActivityIndicator color={BRAND} style={{ marginTop: 10 }} />
          ) : products.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No result checker products available right now.
            </Text>
          ) : (
            <View style={styles.productRow}>
              {products.map((p) => {
                const active = selectedProduct?.id === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.productPill,
                      { backgroundColor: colors.card, borderColor: colors.border },
                      active && styles.productPillActive,
                    ]}
                    onPress={() => setSelectedProduct(p)}
                    activeOpacity={0.8}
                  >
                    {EXAM_LOGOS[p.exam_type] ? (
                      <Image source={EXAM_LOGOS[p.exam_type]} style={styles.productLogo} resizeMode="contain" />
                    ) : null}
                    <Text style={[styles.productLabel, { color: colors.text }, active && styles.productLabelActive]}>
                      {p.exam_type || p.name}
                    </Text>
                    <Text style={[styles.productPrice, { color: colors.textMuted }, active && styles.productLabelActive]}>
                      {p.purchase_available === false ? 'Coming soon' : `₦${formatNaira(p.price)} / PIN`}
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

          {selectedProduct && !purchaseAvailable ? (
            <Text style={[styles.hintText, { color: colors.textFaint, marginTop: 10 }]}>
              {selectedProduct.exam_type || selectedProduct.name} PINs can't be purchased yet. This option will
              open up as soon as it goes live.
            </Text>
          ) : null}

          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Quantity</Text>
          <View style={[styles.quantityRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={!inStock}
              activeOpacity={0.7}
            >
              <Feather name="minus" size={18} color={BRAND} />
            </TouchableOpacity>
            <TextInput
              style={[styles.qtyInput, { color: colors.text }]}
              keyboardType="number-pad"
              value={String(quantity)}
              onChangeText={(text) => {
                const n = parseInt(sanitizePositiveInt(text) || '1', 10);
                setQuantity(Math.min(stockCap, Math.max(1, n)));
              }}
            />
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => setQuantity((q) => Math.min(stockCap, q + 1))}
              activeOpacity={0.7}
              disabled={!inStock || quantity >= stockCap}
            >
              <Feather name="plus" size={18} color={BRAND} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.hintText, { color: colors.textFaint }]}>
            {selectedProduct && !inStock
              ? 'Out of stock right now. Check back soon.'
              : `Up to ${stockCap} PIN${stockCap === 1 ? '' : 's'} per purchase.`}
          </Text>

          {selectedProduct ? (
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Unit Price</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>₦{formatNaira(unitPrice)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Total Cost</Text>
                <Text style={[styles.summaryValue, { color: BRAND, fontFamily: FONTS.bold }]}>
                  ₦{formatNaira(totalCost)}
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <View style={styles.confirmContent}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Transaction Summary</Text>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Exam Board</Text>
              <View style={styles.summaryValueRow}>
                {EXAM_LOGOS[selectedProduct?.exam_type] ? (
                  <Image source={EXAM_LOGOS[selectedProduct.exam_type]} style={styles.summaryLogo} resizeMode="contain" />
                ) : null}
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {selectedProduct?.exam_type || selectedProduct?.name}
                </Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Quantity</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{quantity}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Total Cost</Text>
              <Text style={[styles.summaryValue, { color: BRAND, fontFamily: FONTS.bold }]}>
                ₦{formatNaira(totalCost)}
              </Text>
            </View>
          </View>

          <Text style={[styles.pinInstructionText, { color: colors.text }]}>Enter 4-Digit Security PIN</Text>
          <CustomPinInput key={pinKey} onPinComplete={(text) => setPin(text)} colors={colors} />
        </View>
      )}

      {step !== 'success' && !unavailableMessage && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background }]}>
          {step === 'input' ? (
            <TouchableOpacity
              style={[styles.continueBtn, (!canContinue || loadingProducts) && styles.continueBtnDisabled]}
              activeOpacity={0.85}
              onPress={handleFormSubmit}
              disabled={!canContinue || loadingProducts}
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
                  <Text style={styles.continueText}>Pay ₦{formatNaira(totalCost)}</Text>
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
  emptyText: { fontFamily: FONTS.medium, fontSize: 13, textAlign: 'center', marginTop: 20 },

  productRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  productPill: {
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#ECEDF6',
    flexBasis: '48%', position: 'relative',
  },
  productPillActive: { borderColor: BRAND, backgroundColor: 'rgba(74,85,221,0.06)' },
  productLogo: { width: 28, height: 28, marginBottom: 6 },
  productLabel: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A', marginBottom: 4 },
  productPrice: { fontFamily: FONTS.medium, fontSize: 12, color: '#6B7088' },
  productLabelActive: { color: BRAND },
  checkWrap: {
    position: 'absolute', top: 10, right: 10,
    width: 18, height: 18, borderRadius: 9, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center',
  },

  quantityRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 16, height: 56,
    borderWidth: 1.5, borderColor: '#ECEDF6',
  },
  qtyBtn: {
    width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(74,85,221,0.08)',
  },
  qtyInput: { flex: 1, textAlign: 'center', fontFamily: FONTS.bold, fontSize: 18, color: '#0B0D1A' },
  hintText: { fontFamily: FONTS.regular, fontSize: 11.5, marginTop: 8, marginLeft: 4 },

  summaryCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: '#ECEDF6', marginTop: 22,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  summaryLabel: { fontFamily: FONTS.medium, fontSize: 13, color: '#6B7088' },
  summaryValue: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A' },
  summaryValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryLogo: { width: 20, height: 20 },
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
  successTitle: { fontFamily: FONTS.extrabold, fontWeight: '800', fontSize: 20, marginBottom: 6 },
  successSubtitle: { fontFamily: FONTS.medium, fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
  emptyPinsText: { fontFamily: FONTS.medium, fontSize: 13, textAlign: 'center', marginTop: 20, paddingHorizontal: 20 },

  pinCard: { borderRadius: 16, borderWidth: 1.5, padding: 16, marginBottom: 12 },
  pinCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  pinCardLabel: { fontFamily: FONTS.semibold, fontSize: 12 },
  pinCardSerial: { fontFamily: FONTS.regular, fontSize: 11 },
  pinValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pinValue: { fontFamily: FONTS.bold, fontSize: 16, letterSpacing: 1 },
  pinValueActions: { flexDirection: 'row', alignItems: 'center' },

  doneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: BRAND, borderRadius: 18, height: 56, gap: 8, marginTop: 10,
  },
  doneText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },
});
