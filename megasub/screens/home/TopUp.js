import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Animated,
  Easing,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../../contexts/ThemeContext';
import {
  fetchNairaVirtualAccounts,
  fetchNairaFundingOptions,
  generateNairaVirtualAccount,
  ensurePhoneOnFile,
  pickFundingOption,
  resolveGenerationBank,
  getCachedVirtualAccounts,
  setCachedVirtualAccounts,
} from '../../lib/api';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

const BRAND = '#4A55DD';
const USER_KEY = 'megasub_user_data';

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
            { color: colors.text, backgroundColor: colors.card, borderColor: colors.border },
            digit ? { borderColor: BRAND } : null,
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

const MARQUEE_GAP = 48;

function MarqueeBanner({ text, colors }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [copyWidth, setCopyWidth] = useState(0);

  useEffect(() => {
    if (!copyWidth) return;
    translateX.setValue(0);
    const anim = Animated.loop(
      Animated.timing(translateX, {
        toValue: -copyWidth,
        duration: copyWidth * 20,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [copyWidth]);

  return (
    <View style={[marqueeStyles.wrap, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
      <View style={marqueeStyles.iconWrap}>
        <Ionicons name="pricetag-outline" size={14} color={BRAND} />
      </View>
      <View style={marqueeStyles.track}>
        <Animated.View style={{ flexDirection: 'row', transform: [{ translateX }] }}>
          <View
            style={{ flexDirection: 'row' }}
            onLayout={(e) => setCopyWidth(e.nativeEvent.layout.width)}
          >
            <Text style={[marqueeStyles.text, { color: BRAND }]} numberOfLines={1}>{text}</Text>
            <View style={{ width: MARQUEE_GAP }} />
          </View>
          <View style={{ flexDirection: 'row' }}>
            <Text style={[marqueeStyles.text, { color: BRAND }]} numberOfLines={1}>{text}</Text>
            <View style={{ width: MARQUEE_GAP }} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

function AccountCard({ account, colors }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(account.account_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.cardAlt }]}>
      <Text style={[styles.label, { color: colors.text }]}>
        Bank Name: <Text style={[styles.value, { color: colors.text }]}>{account.bank_name}</Text>
      </Text>
      <Text style={[styles.label, { color: colors.text }]}>
        Account Name: <Text style={[styles.value, { color: colors.text }]}>{account.account_name}</Text>
      </Text>
      <View style={styles.numberRow}>
        <Text style={[styles.label, { color: colors.text }]}>
          Account Number: <Text style={[styles.value, { color: colors.text }]}>{account.account_number}</Text>
        </Text>
        <TouchableOpacity onPress={handleCopy} activeOpacity={0.7} style={styles.copyBtn}>
          <Feather name={copied ? 'check' : 'copy'} size={15} color={BRAND} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function TopUp({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [accounts, setAccounts] = useState([]);
  const [fundingOptionId, setFundingOptionId] = useState(null);
  const [providerName, setProviderName] = useState('');
  const [bankOptions, setBankOptions] = useState([]);
  const [generatingCode, setGeneratingCode] = useState(null);
  const [needPhone, setNeedPhone] = useState(false);
  const [phoneEntry, setPhoneEntry] = useState('');

  // The PIN screen is a one-time unlock per app session, not per visit — an
  // account list already fetched this session (see api.js's
  // cachedVirtualAccounts) is shown straight away instead of re-prompting
  // for the PIN just to look at the same details again. Generating a NEW
  // account still requires the PIN, since that's a real write, not a view.
  useEffect(() => {
    const cached = getCachedVirtualAccounts();
    if (cached && cached.length > 0) {
      setAccounts(cached);
      setUnlocked(true);
    }
  }, []);

  const handleUnlock = async () => {
    if (pin.length < 4) return;
    setLoading(true);
    setError(null);

    // fetch_naira_virtual_accounts is the only call in this screen that is
    // actually gated on the PIN — a wrong one comes back as
    // status:false, message:"Incorrect PIN" (same shape confirmed on the
    // sibling buy_cable_tv endpoint). The funding-options call below takes
    // no PIN at all, so it must never be the thing that decides whether to
    // unlock — that was letting any PIN through. A user who genuinely has no
    // accounts yet still gets an empty list back with status:true, not an
    // error, so any thrown error here is treated as a rejected PIN.
    let list = [];
    try {
      const json = await fetchNairaVirtualAccounts({ userId: user?.id, pin });
      list = json.data || [];
    } catch (err) {
      setError(err.message || 'Wrong Pin. Please try again.');
      setLoading(false);
      return;
    }

    try {
      const optJson = await fetchNairaFundingOptions(user?.id);
      const options = optJson.data || [];
      console.log('💳 funding options:', JSON.stringify(options.map((o) => ({
        id: o.id,
        name: o.funding_option_name,
        slug: o.slug,
        is_current_option: o.is_current_option,
        activation_status: o.activation_status,
        bank_codes: o.bank_codes,
      }))));

      const option = pickFundingOption(options);
      if (option) {
        const bank = resolveGenerationBank(option);
        console.log('🏦 Generation bank for', option.funding_option_name, JSON.stringify(bank));
        setFundingOptionId(option.id);
        setProviderName(option.funding_option_name || '');
        setBankOptions([bank]);
      } else {
        setError('No funding provider is currently available. Please try again later.');
        setLoading(false);
        return;
      }
    } catch (err) {
      setError(err.message || 'Could not verify your PIN. Please try again.');
      setLoading(false);
      return;
    }

    // Generating an account needs a phone number linked to it, and the API
    // offers no way to ask whether one already is. So collect it whenever no
    // account exists yet, prefilled with anything already known — re-sending
    // a number the backend has is answered with "already been verified".
    if (list.length === 0) {
      const known = String(user?.phone_number || '').trim();
      if (known) setPhoneEntry(known);
      // Only ask when nothing is known — a number captured at signup is
      // re-sent silently on generate rather than demanded again here.
      setNeedPhone(!known);
    }

    setAccounts(list);
    setCachedVirtualAccounts(list);
    setUnlocked(true);
    setLoading(false);
  };

  const handleGenerate = async (bank) => {
    setGeneratingCode(bank.code);
    setError(null);

    try {
      // Send the number to the backend first — that is what links it to the
      // account the provider issues against. Only a genuine failure to
      // deliver it (or having none at all) stops us here.
      let linkedPhone;
      try {
        linkedPhone = await ensurePhoneOnFile({
          userId: user?.id,
          phoneNumber: phoneEntry.trim(),
        });
      } catch (err) {
        setNeedPhone(true);
        setError(
          err.message === 'NO_PHONE_ON_FILE'
            ? 'Enter the phone number to link to your funding account, then try again.'
            : err.message
        );
        return;
      }
      // Keep the device copy in step with the backend so other screens (and
      // the next visit here) don't ask again.
      try {
        const stored = await SecureStore.getItemAsync(USER_KEY);
        const record = stored ? JSON.parse(stored) : {};
        await SecureStore.setItemAsync(
          USER_KEY,
          JSON.stringify({
            ...record,
            phone_number: linkedPhone.phoneNumber,
            phone_verification: 1,
          })
        );
      } catch {}

      let json;
      try {
        json = await generateNairaVirtualAccount({
          user_id: user?.id,
          bank_code: bank.code,
          pin,
          funding_option_id: fundingOptionId,
        });
      } catch (err) {
        const message = err.message || '';

        // One-account rule: "Sorry you already have an account generated:
        // Account number is …" (403, status false). That's not a failure —
        // the account exists, so pull it into view instead of showing the
        // raw rejection.
        if (/already have an account/i.test(message)) {
          try {
            const refreshed = await fetchNairaVirtualAccounts({ userId: user?.id, pin });
            const list = refreshed.data || [];
            if (list.length > 0) {
              setAccounts(list);
              setCachedVirtualAccounts(list);
              return;
            }
          } catch {}
          setError(message);
          return;
        }

        // The phone is confirmed on file by this point, so a failure here is
        // the provider's, not a missing detail the user can supply.
        setError(message || 'The account could not be generated. Please try again.');
        return;
      }

      console.log(`🏦 generate_naira_virtual_accounts (bank_code=${bank.code}):`, JSON.stringify(json));

      // Documented success returns the account inline ({ data: { data: {...} } }),
      // but a re-fetch is the source of truth for what was actually persisted.
      const inlineAccount = json.data?.data?.account_number
        ? json.data.data
        : json.data?.account_number
        ? json.data
        : null;

      let refreshedList = null;
      try {
        const refreshed = await fetchNairaVirtualAccounts({ userId: user?.id, pin });
        refreshedList = refreshed.data || [];
      } catch {}

      if (refreshedList && refreshedList.length > 0) {
        setAccounts(refreshedList);
        setCachedVirtualAccounts(refreshedList);
        return;
      }
      if (inlineAccount) {
        setAccounts((prev) => {
          const next = [...prev, inlineAccount];
          setCachedVirtualAccounts(next);
          return next;
        });
        return;
      }

      // The API said "generated" but nothing was persisted — a provider-side
      // failure we can't fix from here. Say so honestly instead of implying
      // the user did something wrong.
      setError(
        'Your request was accepted, but the bank has not issued the account yet. Please check back in a few minutes — if it keeps happening, contact support.'
      );
    } finally {
      setGeneratingCode(null);
    }
  };

  // One-account policy: each user gets exactly one funding account, so once
  // any account exists every generate button disappears — the bank choice
  // only matters for the very first generation.
  const availableBanks = accounts.length > 0 ? [] : bankOptions;

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
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.text }]}>Top-up Balance</Text>

        {!unlocked ? (
          <>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Enter your transaction PIN to view your dedicated funding account details.
            </Text>

            <CustomPinInput onPinComplete={setPin} colors={colors} />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.unlockBtn, (pin.length < 4 || loading) && styles.unlockBtnDisabled]}
              activeOpacity={0.85}
              onPress={handleUnlock}
              disabled={pin.length < 4 || loading}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.unlockBtnText}>Continue</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              To top-up your wallet balance, transfer the amount you want to recharge to the account details below. Your wallet will be credited automatically.
              {providerName ? ` Accounts are issued by ${providerName}.` : ''}
            </Text>

            <MarqueeBanner text="ℹ️ Your funding provider may deduct a small transfer fee before crediting your wallet" colors={colors} />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {needPhone && accounts.length === 0 ? (
              <View style={[styles.phoneCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.phoneLabel, { color: colors.textMuted }]}>Phone Number</Text>
                <TextInput
                  style={[styles.phoneInput, { color: colors.text, backgroundColor: colors.cardAlt, borderColor: colors.border }]}
                  placeholder="08123456789"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="phone-pad"
                  maxLength={11}
                  value={phoneEntry}
                  onChangeText={setPhoneEntry}
                />
              </View>
            ) : null}

            {accounts.map((account, index) => (
              <AccountCard key={account.id || index} account={account} colors={colors} />
            ))}

            {availableBanks.map((bank) => {
              const blockedByPhone = needPhone && phoneEntry.trim().length < 10;
              return (
                <TouchableOpacity
                  key={bank.code}
                  style={[
                    styles.generateBtn,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    blockedByPhone && styles.generateBtnDisabled,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleGenerate(bank)}
                  disabled={generatingCode === bank.code || blockedByPhone}
                >
                  {generatingCode === bank.code ? (
                    <ActivityIndicator color={BRAND} size="small" />
                  ) : (
                    <>
                      <Ionicons name="add-circle-outline" size={18} color={BRAND} />
                      <Text style={styles.generateBtnText}>
                        {needPhone ? 'Verify Phone & Generate Account' : `Generate ${bank.label} Account`}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              );
            })}

            {accounts.length === 0 && availableBanks.length === 0 ? (
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                No funding account is available for your profile yet. Please contact support.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FC' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
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
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30 },
  title: { fontFamily: FONTS.extrabold, fontWeight: '800', fontSize: 20, color: '#0B0D1A', marginBottom: 10 },
  subtitle: { fontFamily: FONTS.regular, fontSize: 13, color: 'rgba(11,13,26,0.55)', lineHeight: 20, marginBottom: 22 },

  card: {
    backgroundColor: 'rgba(74,85,221,0.06)', borderRadius: 16, padding: 16, marginBottom: 14,
  },
  label: { fontFamily: FONTS.semibold, fontSize: 12.5, color: '#0B0D1A', marginBottom: 8, lineHeight: 18 },
  value: { fontFamily: FONTS.bold, color: '#0B0D1A' },
  numberRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  copyBtn: { padding: 4, marginLeft: 8 },

  otpContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '80%', alignSelf: 'center', marginVertical: 20, gap: 12 },
  otpInputBox: { width: 50, height: 50, borderWidth: 2, borderColor: '#ECEDF6', borderRadius: 12, fontSize: 20, fontWeight: '700', color: '#0B0D1A', backgroundColor: '#FFFFFF' },

  errorText: { fontFamily: FONTS.medium, fontSize: 12.5, color: '#EF4444', textAlign: 'center', marginBottom: 14 },

  unlockBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: BRAND, borderRadius: 18, height: 56,
    shadowColor: BRAND, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  unlockBtnDisabled: { backgroundColor: '#B7BCEF', shadowOpacity: 0, elevation: 0 },
  unlockBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },

  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 16, borderWidth: 1.5, paddingVertical: 14, marginBottom: 12,
  },
  generateBtnDisabled: { opacity: 0.5 },
  generateBtnText: { fontFamily: FONTS.semibold, fontSize: 13.5, color: BRAND },

  phoneCard: {
    borderRadius: 16, borderWidth: 1.5, padding: 16, marginBottom: 14,
  },
  phoneLabel: { fontFamily: FONTS.semibold, fontSize: 12.5, marginBottom: 8 },
  phoneInput: {
    height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14,
    fontFamily: FONTS.semibold, fontSize: 14,
  },
});

const marqueeStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  iconWrap: { marginRight: 8 },
  track: { flex: 1, overflow: 'hidden' },
  text: { fontFamily: FONTS.semibold, fontSize: 12.5 },
});
