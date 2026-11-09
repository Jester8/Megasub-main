import React, { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from 'react-native';

const BRAND = '#4A55DD';

// Text-only style keys: they belong on the digit, not on the box around it.
const TEXT_KEYS = ['color', 'fontSize', 'fontWeight', 'fontFamily', 'letterSpacing'];

function splitBoxStyle(style) {
  const flat = StyleSheet.flatten(style) || {};
  const box = {};
  const text = {};
  Object.entries(flat).forEach(([key, value]) => {
    if (TEXT_KEYS.includes(key)) text[key] = value;
    else box[key] = value;
  });
  return { box, text };
}

// The PIN/OTP boxes used across the app. One invisible TextInput sits over
// the row of boxes and holds the whole code; the boxes only draw it. The old
// inputs were one TextInput per digit with maxLength={1}, which meant a
// pasted or SMS-autofilled code could never land (only one character fits),
// tapping a box left focus stuck there, and backspace didn't step back. A
// single field gets paste, OTP autofill and continuous typing/backspace from
// the platform for free.
//
//   value / onChange  -> the code as a string of digits
//   otp               -> a one-time code from SMS/email (enables autofill);
//                        leave false for a transaction PIN
//   boxStyle, filledStyle, containerStyle -> each screen keeps its own look
export default function CodeInput({
  length = 4,
  value = '',
  onChange,
  colors,
  secure = false,
  otp = false,
  autoFocus = false,
  containerStyle,
  boxStyle,
  filledStyle,
  activeStyle,
}) {
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);

  const handleChange = (text) => {
    onChange && onChange(String(text || '').replace(/\D/g, '').slice(0, length));
  };

  const activeIndex = Math.min(value.length, length - 1);

  return (
    <Pressable style={[styles.row, containerStyle]} onPress={() => inputRef.current?.focus()}>
      {Array.from({ length }).map((_, index) => {
        const digit = value[index] || '';
        const { box, text } = splitBoxStyle([
          boxStyle,
          colors ? { color: colors.text, backgroundColor: colors.card, borderColor: colors.border } : null,
          digit ? filledStyle : null,
          focused && index === activeIndex ? activeStyle || { borderColor: BRAND } : null,
        ]);
        return (
          <View key={index} style={[styles.box, box]}>
            <Text style={[styles.digit, text]}>{digit ? (secure ? '•' : digit) : ''}</Text>
          </View>
        );
      })}

      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        selectionColor="transparent"
        textContentType={otp ? 'oneTimeCode' : 'none'}
        autoComplete={otp ? (Platform.OS === 'android' ? 'sms-otp' : 'one-time-code') : 'off'}
        importantForAutofill={otp ? 'yes' : 'no'}
        // The digits are drawn by the boxes; a secure field would block paste
        // on iOS, so the input itself stays plain and invisible.
        accessibilityLabel={otp ? `${length}-digit code` : `${length}-digit PIN`}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  box: { alignItems: 'center', justifyContent: 'center' },
  digit: { textAlign: 'center' },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    color: 'transparent',
    backgroundColor: 'transparent',
    // Not 0: some Android builds stop delivering touches (and the paste
    // menu) to a fully transparent view.
    opacity: 0.02,
    fontSize: 1,
  },
});
