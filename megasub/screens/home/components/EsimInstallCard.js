import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { parseLpaCode } from '../../../lib/format';

const FONTS = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
};

const BRAND = '#4A55DD';

function CopyRow({ label, value, colors }) {
  if (!value) return null;
  const copy = async () => {
    await Clipboard.setStringAsync(String(value));
    Alert.alert('Copied', `${label} copied to clipboard.`);
  };
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={copy}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.value, { color: colors.text }]} selectable>
          {value}
        </Text>
      </View>
      <Feather name="copy" size={18} color={BRAND} />
    </TouchableOpacity>
  );
}

// Everything needed to install a purchased eSIM: the QR code (for a second
// device) and the SM-DP+ address + activation code (for typing in on the same
// phone, since a phone can't scan its own screen). The backend returns the QR
// as qr_code_image (a base64 data URI) with qr_code_url null, so the image is
// read from either field.
export default function EsimInstallCard({ esim, colors }) {
  if (!esim) return null;
  const qrSource = esim.qr_code_image || esim.qr_code_url;
  const parsed = parseLpaCode(esim.activation_code);

  return (
    <View>
      {qrSource ? (
        <View style={[styles.qrCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Image source={{ uri: qrSource }} style={styles.qrImage} resizeMode="contain" />
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Scan this with another phone to install. To install on this phone, use the details below.
          </Text>
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Install manually</Text>
        {parsed ? (
          <>
            <CopyRow label="SM-DP+ Address" value={parsed.smdp} colors={colors} />
            <CopyRow label="Activation Code" value={parsed.code} colors={colors} />
          </>
        ) : null}
        <CopyRow label="Full activation link" value={esim.activation_code} colors={colors} />
        <Text style={[styles.steps, { color: colors.textFaint }]}>
          iPhone: Settings, Mobile Service, Add eSIM, Enter Details Manually. Android: Settings, Network, SIMs, Add
          eSIM, then enter the code.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  qrCard: { alignItems: 'center', borderRadius: 16, borderWidth: 1.5, padding: 20, marginBottom: 14 },
  qrImage: { width: 200, height: 200, marginBottom: 12 },
  hint: { fontFamily: FONTS.regular, fontSize: 12, textAlign: 'center', lineHeight: 17 },

  card: { borderRadius: 16, borderWidth: 1.5, padding: 16 },
  cardTitle: { fontFamily: FONTS.bold, fontSize: 14, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  label: { fontFamily: FONTS.medium, fontSize: 11.5, marginBottom: 3 },
  value: { fontFamily: FONTS.semibold, fontSize: 13.5 },
  steps: { fontFamily: FONTS.regular, fontSize: 11.5, lineHeight: 16, marginTop: 8 },
});
