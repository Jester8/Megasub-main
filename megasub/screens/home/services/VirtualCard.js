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
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchVirtualCardProducts,
  fetchKycStatus,
  fetchCards,
  fetchCardDetails,
  createCard,
  freezeCard,
  unfreezeCard,
  fundCard,
} from '../../../lib/api';
import { requireNetworkOrShowError } from '../../../lib/network';
import { useTheme } from '../../../contexts/ThemeContext';
import WrongPinModal from '../components/WrongPinModal';
import UnavailableNotice from '../components/UnavailableNotice';
import LogoLoader from '../components/LogoLoader';
import {
  formatNaira,
  formatUsd,
  alertForPurchaseError,
  cardFundingCharge,
  cardTotalUsd,
} from '../../../lib/format';

const FONTS = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  extrabold: 'Montserrat_800ExtraBold',
};

const BRAND = '#4A55DD';

// Visual styling per card_type only — which types exist, and whether each is
// enabled, comes from fetch_virtual_card_products. Only the Dollar card is
// offered for now; the Naira card is switched off below.
const CARD_TYPES = [
  // { id: 'naira', label: 'Naira Card', gradient: ['#4A55DD', '#2E3A9E'] },  // Naira card disabled for now
  { id: 'dollar', label: 'Dollar Card', gradient: ['#0B0D1A', '#2A2E45'] },
];

// The only brand the backend documents for create_card.
const CARD_BRAND = 'MASTERCARD';

// A product is only usable once the provider is switched on and out of demo
// mode — enabled alone isn't enough (Naira is listed but disabled, and demo
// products carry made-up values).
const isLiveProduct = (p) =>
  p.enabled !== false &&
  p.provider_configured !== false &&
  p.provider_enabled !== false &&
  p.demo_mode !== true;

const isNaira = (currency) => String(currency || '').toUpperCase() === 'NGN';
const cardSymbol = (currency) => (isNaira(currency) ? '₦' : '$');

// Balances arrive as strings like "25.00" with a currency code alongside.
function formatCardBalance(card) {
  return isNaira(card.currency)
    ? `₦${formatNaira(card.balance || 0)}`
    : formatUsd(card.balance || 0, card.currency);
}

// Digits with at most one decimal point and two decimal places — cards can
// be funded in cents, unlike whole-naira purchases.
function sanitizeAmount(text) {
  const cleaned = String(text ?? '').replace(/[^0-9.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
}

// What a create/fund will actually cost, straight from the product's own
// rules, shown before the PIN is entered: the amount, the USD funding charge
// on top, and the total taken from the USD wallet. If that wallet is short
// the backend converts the difference from the main wallet at the product's
// NGN/USD rate, which is stated here so nobody is surprised by a naira debit.
function FeeSummary({ amountLabel, amount, product, colors, style }) {
  const charge = cardFundingCharge(product, amount);
  const total = cardTotalUsd(amount, charge);
  const rate = Number(product?.ngn_to_usd_rate);
  return (
    <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{amountLabel}</Text>
        <Text style={[styles.summaryValue, { color: colors.text }]}>{formatUsd(amount)}</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Funding charge</Text>
        <Text style={[styles.summaryValue, { color: colors.text }]}>
          {charge === null ? 'Applies' : formatUsd(charge)}
        </Text>
      </View>
      {total !== null ? (
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Total</Text>
          <Text style={[styles.summaryValue, { color: BRAND, fontFamily: FONTS.bold }]}>{formatUsd(total)}</Text>
        </View>
      ) : null}
      <Text style={[styles.feeNote, { color: colors.textFaint }]}>
        Paid from your USD wallet.{' '}
        {Number.isFinite(rate) && rate > 0
          ? `If it is short, the difference is converted from your main wallet at ₦${formatNaira(rate)} per $1.`
          : 'If it is short, the difference is converted from your main wallet.'}
      </Text>
    </View>
  );
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

function CardTile({ card, onPress }) {
  const type = CARD_TYPES.find((t) => t.id === card.type) || CARD_TYPES[0];
  return (
    <TouchableOpacity style={[styles.cardTile, { backgroundColor: type.gradient[0] }]} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.cardTileTop}>
        <Text style={styles.cardTileLabel}>{type.label}</Text>
        {card.status === 'frozen' ? (
          <View style={styles.frozenPill}>
            <Feather name="lock" size={11} color="#FFFFFF" />
            <Text style={styles.frozenText}>Frozen</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.cardTileNumber}>{card.masked_number || '•••• •••• •••• ••••'}</Text>
      <View style={styles.cardTileBottom}>
        <View>
          <Text style={styles.cardTileBalanceLabel}>Balance</Text>
          <Text style={styles.cardTileBalance}>{formatCardBalance(card)}</Text>
        </View>
        {card.brand ? <Text style={styles.cardTileBrand}>{card.brand}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

// Tapping a card opens this instead of navigating to a separate screen —
// App.js's navigate() treats any non-empty object argument as user data
// (see its actualUserData check), so passing a raw card object through it
// would silently overwrite the signed-in user. A same-screen modal sidesteps
// that entirely, matching how TransactionHistory already shows a single
// item's detail (ReceiptModal) without a dedicated route.
function CardDetailModal({ card, visible, onClose, colors, userId, product, onChanged, onVerifyPhone }) {
  const [fundAmount, setFundAmount] = useState('');
  const [pin, setPin] = useState('');
  const [pinKey, setPinKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [wrongPinVisible, setWrongPinVisible] = useState(false);
  // Full number / expiry / CVV — fetched only when the user asks, held in
  // memory only, and wiped whenever the modal closes.
  const [details, setDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!visible) {
      setDetails(null);
      setFundAmount('');
      setPin('');
    }
  }, [visible]);

  if (!card) return null;
  const frozen = card.status === 'frozen';
  const usdCard = !isNaira(card.currency);

  const fundValue = Number(fundAmount) || 0;
  const minFunding = Number(product?.minimum_funding_amount) || 0;
  const belowMinimum = usdCard && fundValue > 0 && fundValue < minFunding;
  const canFund = fundValue > 0 && !belowMinimum && pin.length >= 4 && !busy;

  const resetAndClose = () => {
    setFundAmount('');
    setPin('');
    setDetails(null);
    onClose();
  };

  // The full card number and CVV are sensitive, so ask the phone's own
  // biometrics/passcode first. Returns false only when the user was asked and
  // said no; a device with nothing enrolled falls back to a plain confirm.
  const confirmReveal = async () => {
    try {
      const capable = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
      if (capable) {
        const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm to show card details' });
        return res.success;
      }
    } catch (e) {
      // fall through to the manual confirmation below
    }
    return new Promise((resolve) => {
      Alert.alert('Show card details?', 'Your full card number and CVV will be displayed. Make sure no one is watching.', [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Show', onPress: () => resolve(true) },
      ], { onDismiss: () => resolve(false) });
    });
  };

  const handleRevealDetails = async () => {
    if (!(await requireNetworkOrShowError())) return;
    if (!(await confirmReveal())) return;
    setLoadingDetails(true);
    try {
      const json = await fetchCardDetails({ userId, cardId: card.id });
      const d = json?.data || {};
      if (!d.number) {
        Alert.alert('Unavailable', 'Card details are not available right now.');
        return;
      }
      setDetails({ number: String(d.number), expiry: d.expiry, cvv: d.cvv });
    } catch (error) {
      // The backend's 404 leaks an internal model name — never show that.
      const message = /no query results/i.test(error.message || '')
        ? "We couldn't find this card."
        : error.message || 'Please try again.';
      Alert.alert('Could not load card details', message);
    } finally {
      setLoadingDetails(false);
    }
  };

  const copyValue = async (value, label) => {
    await Clipboard.setStringAsync(String(value || ''));
    Alert.alert('Copied', `${label} copied to clipboard.`);
  };

  const handleToggleFreeze = () => {
    Alert.alert(
      frozen ? 'Unfreeze Card' : 'Freeze Card',
      frozen
        ? 'This card will be usable for transactions again.'
        : 'This card will be blocked from all transactions until unfrozen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: frozen ? 'Unfreeze' : 'Freeze',
          style: frozen ? 'default' : 'destructive',
          onPress: async () => {
            if (!(await requireNetworkOrShowError())) return;
            setBusy(true);
            try {
              const action = frozen ? unfreezeCard : freezeCard;
              await action({ user_id: userId, card_id: card.id });
              onChanged && onChanged();
              resetAndClose();
            } catch (error) {
              Alert.alert('Error', error.message || 'Could not update card status.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const handleFund = async () => {
    if (!canFund) return;
    if (!(await requireNetworkOrShowError())) return;

    setBusy(true);
    try {
      await fundCard({ user_id: userId, card_id: card.id, amount: Number(fundAmount), pin });
      onChanged && onChanged();
      Alert.alert('Success', 'Card funded successfully.');
      resetAndClose();
    } catch (error) {
      if (error.isUnavailable) {
        Alert.alert('Unavailable', error.message);
        return;
      }
      // A dropped connection is ambiguous: the request may have reached the
      // server and charged the wallet. Never invite a blind retry — refresh
      // the balance and tell the user to check first.
      if (error.isNetworkError) {
        Alert.alert(
          'Check Your Card',
          'We lost connection before getting a response, so the funding may have gone through. Check your card balance before trying again.'
        );
        onChanged && onChanged();
        return;
      }
      const alert = alertForPurchaseError(error);
      if (alert.isWrongPin) setWrongPinVisible(true);
      else if (alert.requiresPhoneVerification) {
        Alert.alert(alert.title, alert.message, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Verify Phone', onPress: () => { resetAndClose(); onVerifyPhone && onVerifyPhone(); } },
        ]);
      } else Alert.alert(alert.title, alert.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={resetAndClose}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
        <Pressable style={styles.modalOverlayTouch} onPress={resetAndClose} />
        <ScrollView
          style={[styles.modalCard, { backgroundColor: colors.background }]}
          contentContainerStyle={{ padding: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <CardTile card={card} onPress={() => {}} />

          <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {details ? (
              <>
                <View style={styles.detailRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Card Number</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {details.number.replace(/(.{4})/g, '$1 ').trim()}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => copyValue(details.number, 'Card number')} hitSlop={10}>
                    <Feather name="copy" size={18} color={BRAND} />
                  </TouchableOpacity>
                </View>
                <View style={styles.detailRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Expiry</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{details.expiry || '-'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>CVV</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{details.cvv || '-'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => copyValue(details.cvv, 'CVV')} hitSlop={10}>
                    <Feather name="copy" size={18} color={BRAND} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.revealBtn} onPress={() => setDetails(null)} activeOpacity={0.7}>
                  <Feather name="eye-off" size={15} color={BRAND} />
                  <Text style={styles.revealBtnText}>Hide details</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.revealBtn}
                onPress={handleRevealDetails}
                disabled={loadingDetails}
                activeOpacity={0.7}
              >
                {loadingDetails ? (
                  <ActivityIndicator color={BRAND} />
                ) : (
                  <>
                    <Feather name="eye" size={15} color={BRAND} />
                    <Text style={styles.revealBtnText}>Show card details</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.freezeBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.8}
            onPress={handleToggleFreeze}
            disabled={busy}
          >
            <Feather name={frozen ? 'unlock' : 'lock'} size={16} color={frozen ? '#16A34A' : '#DC2626'} />
            <Text style={[styles.freezeBtnText, { color: frozen ? '#16A34A' : '#DC2626' }]}>
              {frozen ? 'Unfreeze Card' : 'Freeze Card'}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Fund Card</Text>
          <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={styles.nairaSign}>{cardSymbol(card.currency)}</Text>
            <View style={[styles.inputDivider, { backgroundColor: colors.border }]} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Enter amount"
              placeholderTextColor={colors.textFaint}
              keyboardType="decimal-pad"
              value={fundAmount}
              onChangeText={(text) => setFundAmount(sanitizeAmount(text))}
            />
          </View>
          {belowMinimum ? (
            <Text style={styles.minHint}>Minimum funding is {formatUsd(minFunding)}.</Text>
          ) : null}

          {usdCard && fundValue > 0 && !belowMinimum ? (
            <FeeSummary
              amountLabel="Amount"
              amount={fundValue}
              product={product}
              colors={colors}
              style={{ marginTop: 14 }}
            />
          ) : null}

          <Text style={[styles.pinInstructionText, { color: colors.text }]}>Enter 4-Digit Security PIN</Text>
          <CustomPinInput key={pinKey} onPinComplete={setPin} colors={colors} />

          <TouchableOpacity
            style={[styles.continueBtn, !canFund && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleFund}
            disabled={!canFund}
          >
            {busy ? <ActivityIndicator color="#FFFFFF" /> : (
              <>
                <Text style={styles.continueText}>Fund Card</Text>
                <Feather name="arrow-right" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeLink} onPress={resetAndClose}>
            <Text style={styles.closeLinkText}>Close</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <WrongPinModal
        visible={wrongPinVisible}
        onClose={() => {
          setWrongPinVisible(false);
          setPin('');
          setPinKey((k) => k + 1);
        }}
      />
    </Modal>
  );
}

export default function VirtualCard({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // Step: 'list' -> 'create-type' -> 'create-confirm' -> 'create-success'
  const [step, setStep] = useState('list');

  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [products, setProducts] = useState([]);
  // BVN verification decides whether a card can be created: true = verified,
  // false = not verified yet, null = still unknown (loading, or the status
  // could not be read). Creating is only allowed once it is true.
  const [bvnVerified, setBvnVerified] = useState(null);
  // Set when the provider isn't live (products not configured, or a call
  // answered available: false). Demo values in those responses are never
  // shown as real cards.
  const [unavailableMessage, setUnavailableMessage] = useState(null);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);

  const [pin, setPin] = useState('');
  const [pinKey, setPinKey] = useState(0);
  const [wrongPinVisible, setWrongPinVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCard, setNewCard] = useState(null);

  useEffect(() => {
    loadCards();
  }, []);

  // Card types available to create, with styling merged in from CARD_TYPES.
  const cardOptions = products.map((p) => {
    const look = CARD_TYPES.find((t) => t.id === p.card_type) || CARD_TYPES[0];
    return {
      id: p.card_type,
      label: p.name || look.label,
      gradient: look.gradient,
      enabled: isLiveProduct(p),
      comingSoon: p.enabled === false,
    };
  });
  const selectedType =
    cardOptions.find((o) => o.id === selectedTypeId && o.enabled) || cardOptions.find((o) => o.enabled) || null;
  // The API product behind the selected card type: fees, minimum funding and
  // the NGN/USD conversion rate all come from here.
  const selectedProduct = products.find((p) => p.card_type === selectedType?.id) || null;
  const creationFee = Number(selectedProduct?.creation_fee) || 0;

  const loadCards = async () => {
    setLoadingCards(true);
    try {
      const productsJson = await fetchVirtualCardProducts(user?.id);
      // Naira card disabled for now: drop it so it never shows, even as "coming soon".
      const list = (productsJson.data || []).filter((p) => p.card_type !== 'naira');
      setProducts(list);

      const live = list.some(isLiveProduct);
      if (!live) {
        setCards([]);
        setUnavailableMessage('Virtual cards are not available yet. We will let you know as soon as they go live.');
        return;
      }

      const [kycRes, cardsRes] = await Promise.allSettled([fetchKycStatus(), fetchCards(user?.id)]);
      let unavailable = null;
      let failure = null;

      if (kycRes.status === 'fulfilled') {
        const kyc = kycRes.value?.data || {};
        setBvnVerified(kyc.verified === true || kyc.status === 'verified');
      } else {
        setBvnVerified(null);
      }

      if (cardsRes.status === 'fulfilled') {
        const real = (cardsRes.value?.data?.cards || []).filter((c) => c.is_demo !== true && c.available !== false);
        setCards(real);
      } else if (cardsRes.reason?.isUnavailable) unavailable = cardsRes.reason.message;
      else failure = cardsRes.reason;

      setUnavailableMessage(unavailable);
      if (failure) Alert.alert('Network Error', failure.message || 'Could not load your cards.');
    } catch (error) {
      if (error.isUnavailable) setUnavailableMessage(error.message);
      else Alert.alert('Network Error', error.message || 'Could not load your cards.');
    } finally {
      setLoadingCards(false);
    }
  };

  // A card can only be created once the user's BVN is verified. The screen
  // also disables every create button until then; this guards the handlers.
  const canCreate = bvnVerified === true;
  const startCreate = () => {
    if (unavailableMessage || !canCreate) return;
    setStep('create-type');
  };

  const handleCreate = async () => {
    if (pin.length < 4 || !canCreate) return;
    if (!(await requireNetworkOrShowError())) return;

    setCreating(true);
    try {
      // amount is the creation fee the product advertises; brand is required.
      const payload = {
        user_id: user?.id,
        card_type: selectedType.id,
        brand: CARD_BRAND,
        amount: creationFee,
        pin,
      };
      const json = await createCard(payload);
      setNewCard(json?.data || null);
      setStep('create-success');
    } catch (error) {
      if (error.isUnavailable) {
        Alert.alert('Unavailable', error.message);
        setStep('list');
        return;
      }
      // Ambiguous outcome: the request may have created (and charged for) a
      // card before the connection dropped. Refresh instead of inviting a
      // second attempt that could create a duplicate.
      if (error.isNetworkError) {
        Alert.alert(
          'Check Your Cards',
          'We lost connection before getting a response, so your card may have been created. Check your cards before trying again.'
        );
        setStep('list');
        setPin('');
        loadCards();
        return;
      }
      const alert = alertForPurchaseError(error);
      if (alert.isWrongPin) setWrongPinVisible(true);
      else if (alert.requiresPhoneVerification) {
        Alert.alert(alert.title, alert.message, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Verify Phone', onPress: () => navigate && navigate('verify', user) },
        ]);
      } else if (/kyc|verif|identity/i.test(alert.message)) {
        Alert.alert('Verification Needed', alert.message, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Verify Identity', onPress: () => navigate && navigate('card-kyc') },
        ]);
      } else Alert.alert(alert.title, alert.message);
    } finally {
      setCreating(false);
    }
  };

  if (step === 'list') {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.card }]}
            onPress={() => navigate && navigate('home')}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Virtual Cards</Text>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.card }]}
            onPress={startCreate}
            activeOpacity={0.7}
            disabled={!!unavailableMessage || !canCreate}
          >
            <Feather name="plus" size={20} color={unavailableMessage || !canCreate ? colors.textFaint : colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {!loadingCards && !unavailableMessage && !canCreate ? (
            <TouchableOpacity
              style={[styles.kycBanner, { backgroundColor: colors.card, borderColor: colors.border }]}
              activeOpacity={0.8}
              onPress={() => navigate && navigate('kyc')}
            >
              <Feather name="shield" size={18} color={BRAND} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.kycBannerTitle, { color: colors.text }]}>
                  {bvnVerified === false ? 'Verify your BVN to create a card' : "We couldn't check your verification"}
                </Text>
                <Text style={[styles.kycBannerSub, { color: colors.textFaint }]}>
                  {bvnVerified === false
                    ? 'Card creation unlocks as soon as your BVN is verified. Tap to verify.'
                    : 'Tap to open verification and check your status.'}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}

          {loadingCards ? (
            <LogoLoader centered />
          ) : unavailableMessage ? (
            <UnavailableNotice
              title="Virtual Cards Coming Soon"
              message={unavailableMessage}
              icon="credit-card"
              colors={colors}
            />
          ) : cards.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="credit-card" size={40} color="#B7BCEF" />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No cards yet</Text>
              <Text style={[styles.emptySubtext, { color: colors.textFaint }]}>
                {canCreate
                  ? 'Create a virtual dollar card for online payments.'
                  : 'Verify your BVN to unlock virtual dollar cards.'}
              </Text>
              <TouchableOpacity
                style={[styles.ctaBtn, !canCreate && styles.ctaBtnDisabled]}
                activeOpacity={0.85}
                onPress={startCreate}
                disabled={!canCreate}
              >
                <Text style={styles.ctaText}>Create Dollar Card</Text>
              </TouchableOpacity>
            </View>
          ) : (
            cards.map((c, i) => (
              <CardTile key={c.id || i} card={c} onPress={() => setSelectedCard(c)} />
            ))
          )}
        </ScrollView>

        <CardDetailModal
          card={selectedCard}
          visible={!!selectedCard}
          onClose={() => setSelectedCard(null)}
          colors={colors}
          userId={user?.id}
          product={products.find((p) => p.card_type === selectedCard?.type) || null}
          onChanged={loadCards}
          onVerifyPhone={() => navigate && navigate('verify', user)}
        />
      </View>
    );
  }

  if (step === 'create-success') {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.successHeader}>
            <View style={styles.successIconWrap}>
              <Feather name="check-circle" size={48} color="#16A34A" />
            </View>
            <Text style={[styles.successTitle, { color: colors.text }]}>Card Created!</Text>
            <Text style={[styles.successSubtitle, { color: colors.textMuted }]}>
              Your {selectedType?.label || 'card'} is ready to fund and use.
            </Text>
          </View>
          {newCard ? <CardTile card={newCard} onPress={() => {}} /> : null}
          <TouchableOpacity
            style={styles.doneBtn}
            activeOpacity={0.85}
            onPress={() => {
              setStep('list');
              setPin('');
              loadCards();
            }}
          >
            <Text style={styles.doneText}>Back to Cards</Text>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior="padding"
    >
      <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card }]}
          onPress={() => (step === 'create-confirm' ? setStep('create-type') : setStep('list'))}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {step === 'create-type' ? 'Create Card' : 'Confirm'}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {step === 'create-type' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Select Card Type</Text>
          {cardOptions.map((t) => {
            const active = selectedType?.id === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.typeRow,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  active && styles.typeRowActive,
                  !t.enabled && { opacity: 0.55 },
                ]}
                activeOpacity={0.8}
                disabled={!t.enabled}
                onPress={() => setSelectedTypeId(t.id)}
              >
                <Feather name="credit-card" size={20} color={active ? BRAND : colors.textMuted} />
                <Text style={[styles.typeLabel, { color: colors.text }, active && { color: BRAND }]}>{t.label}</Text>
                {t.comingSoon ? <Text style={[styles.soonTag, { color: colors.textFaint }]}>Coming soon</Text> : null}
                {active && (
                  <View style={styles.checkWrap}>
                    <Feather name="check" size={12} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {selectedProduct && selectedType ? (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Fees</Text>
              <FeeSummary
                amountLabel="Creation fee"
                amount={creationFee}
                product={selectedProduct}
                colors={colors}
                style={{ marginTop: 0 }}
              />
            </>
          ) : null}
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.confirmContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Transaction Summary</Text>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 12 }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Card Type</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{selectedType?.label}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Brand</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{CARD_BRAND}</Text>
            </View>
          </View>
          <FeeSummary
            amountLabel="Creation fee"
            amount={creationFee}
            product={selectedProduct}
            colors={colors}
            style={{ marginTop: 0 }}
          />
          <Text style={[styles.pinInstructionText, { color: colors.text }]}>Enter 4-Digit Security PIN</Text>
          <CustomPinInput key={pinKey} onPinComplete={(text) => setPin(text)} colors={colors} />
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background }]}>
        {step === 'create-type' ? (
          <TouchableOpacity
            style={[styles.continueBtn, !selectedType && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={() => setStep('create-confirm')}
            disabled={!selectedType}
          >
            <Text style={styles.continueText}>Continue</Text>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.continueBtn, (pin.length < 4 || creating) && styles.continueBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleCreate}
            disabled={pin.length < 4 || creating}
          >
            {creating ? <ActivityIndicator color="#FFFFFF" /> : (
              <Text style={styles.continueText}>Create Card</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <WrongPinModal
        visible={wrongPinVisible}
        onClose={() => {
          setWrongPinVisible(false);
          setPin('');
          setPinKey((k) => k + 1);
        }}
      />
    </KeyboardAvoidingView>
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
  headerTitle: { fontFamily: FONTS.bold, fontSize: 16, color: '#0B0D1A' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },
  confirmContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24 },
  sectionLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: '#6B7088', marginTop: 22, marginBottom: 10 },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 6 },
  emptyText: { fontFamily: FONTS.semibold, fontSize: 14, marginTop: 10 },
  emptySubtext: { fontFamily: FONTS.regular, fontSize: 12, textAlign: 'center', paddingHorizontal: 30 },
  ctaBtn: { backgroundColor: BRAND, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24, marginTop: 16 },
  ctaBtnDisabled: { backgroundColor: '#B7BCEF' },
  ctaText: { fontFamily: FONTS.bold, fontSize: 13.5, color: '#FFFFFF' },

  cardTile: { borderRadius: 20, padding: 20, marginTop: 14, minHeight: 160, justifyContent: 'space-between' },
  cardTileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTileLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  frozenPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  frozenText: { fontFamily: FONTS.semibold, fontSize: 10, color: '#FFFFFF' },
  cardTileNumber: { fontFamily: FONTS.bold, fontSize: 18, color: '#FFFFFF', letterSpacing: 1.5, marginVertical: 20 },
  cardTileBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardTileBrand: { fontFamily: FONTS.bold, fontSize: 11, color: 'rgba(255,255,255,0.75)', letterSpacing: 1 },
  cardTileBalanceLabel: { fontFamily: FONTS.medium, fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
  cardTileBalance: { fontFamily: FONTS.extrabold, fontWeight: '800', fontSize: 20, color: '#FFFFFF' },

  typeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1.5, borderColor: '#ECEDF6',
    paddingHorizontal: 16, paddingVertical: 16, marginBottom: 12,
  },
  typeRowActive: { borderColor: BRAND, backgroundColor: 'rgba(74,85,221,0.06)' },
  typeLabel: { flex: 1, fontFamily: FONTS.semibold, fontSize: 14 },
  soonTag: { fontFamily: FONTS.medium, fontSize: 11 },

  feeNote: { fontFamily: FONTS.regular, fontSize: 11.5, lineHeight: 16, marginTop: 6 },
  minHint: { fontFamily: FONTS.medium, fontSize: 12, color: '#D94F4F', marginTop: 8, marginLeft: 4 },

  kycBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1.5, padding: 14, marginTop: 6,
  },
  kycBannerTitle: { fontFamily: FONTS.semibold, fontSize: 13 },
  kycBannerSub: { fontFamily: FONTS.regular, fontSize: 11.5, marginTop: 2 },

  detailsCard: { borderRadius: 14, borderWidth: 1.5, padding: 14, marginTop: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 6 },
  detailLabel: { fontFamily: FONTS.medium, fontSize: 11.5, marginBottom: 3 },
  detailValue: { fontFamily: FONTS.bold, fontSize: 15, letterSpacing: 0.5 },
  revealBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 6 },
  revealBtnText: { fontFamily: FONTS.semibold, fontSize: 13, color: BRAND },
  checkWrap: { width: 18, height: 18, borderRadius: 9, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },

  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#ECEDF6', marginTop: 22 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  summaryLabel: { fontFamily: FONTS.medium, fontSize: 13, color: '#6B7088' },
  summaryValue: { fontFamily: FONTS.semibold, fontSize: 14, color: '#0B0D1A' },
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

  doneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: BRAND, borderRadius: 18, height: 56, gap: 8, marginTop: 20,
  },
  doneText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(11,13,26,0.4)', justifyContent: 'flex-end' },
  modalOverlayTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  modalCard: { maxHeight: '88%', borderTopLeftRadius: 28, borderTopRightRadius: 28 },

  freezeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1.5, paddingVertical: 12, marginTop: 16,
  },
  freezeBtnText: { fontFamily: FONTS.semibold, fontSize: 13.5 },

  inputCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1.5, borderColor: '#ECEDF6',
  },
  nairaSign: { fontFamily: FONTS.bold, fontSize: 16, color: BRAND },
  inputDivider: { width: 1, height: 22, backgroundColor: '#ECEDF6', marginHorizontal: 12 },
  input: { flex: 1, fontFamily: FONTS.semibold, fontSize: 15, color: '#0B0D1A' },

  closeLink: { alignItems: 'center', paddingVertical: 16 },
  closeLinkText: { fontFamily: FONTS.semibold, fontSize: 13.5, color: '#6B7088' },
});
