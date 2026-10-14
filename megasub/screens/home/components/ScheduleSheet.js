import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { RECURRENCES, defaultStart, validateStartsAt, formatWhen } from '../../../lib/schedule';

const FONTS = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
};

const BRAND = '#4A55DD';

// Bottom sheet for choosing how often and when a purchase repeats. It only
// collects the choice; the caller sends it (create, or update) so this one
// sheet serves the Airtime, Data and Cable screens and the edit action.
export default function ScheduleSheet({
  visible,
  onClose,
  onConfirm,
  title = 'Schedule this purchase',
  confirmLabel = 'Schedule',
  busy = false,
  initialRecurrence = 'once',
  initialDate = null,
  colors,
}) {
  const [recurrence, setRecurrence] = useState(initialRecurrence);
  const [when, setWhen] = useState(initialDate || defaultStart());
  const [error, setError] = useState(null);
  // Android shows date and time as separate dialogs: 'date' | 'time' | null.
  const [androidPicker, setAndroidPicker] = useState(null);

  // Start fresh every time the sheet opens.
  useEffect(() => {
    if (visible) {
      setRecurrence(initialRecurrence || 'once');
      setWhen(initialDate && new Date(initialDate) > new Date() ? new Date(initialDate) : defaultStart());
      setError(null);
      setAndroidPicker(null);
    }
  }, [visible]);

  const submit = () => {
    const problem = validateStartsAt(when);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    onConfirm({ recurrence, startsAt: when });
  };

  const onPick = (event, selected) => {
    if (Platform.OS === 'android') {
      const target = androidPicker;
      setAndroidPicker(null);
      if (event?.type === 'dismissed' || !selected) return;
      if (target === 'date') {
        const next = new Date(when);
        next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
        setWhen(next);
      } else {
        const next = new Date(when);
        next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
        setWhen(next);
      }
    } else if (selected) {
      setWhen(selected);
    }
    setError(null);
  };

  const text = colors?.text || '#0B0D1A';
  const muted = colors?.textMuted || '#6B7088';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.overlayTouch} onPress={busy ? undefined : onClose} />
        <View style={[styles.sheet, { backgroundColor: colors?.card || '#FFFFFF' }]}>
          <View style={[styles.handle, { backgroundColor: colors?.divider || '#ECEDF6' }]} />
          <Text style={[styles.title, { color: text }]}>{title}</Text>

          <Text style={[styles.label, { color: muted }]}>How often</Text>
          <View style={styles.chips}>
            {RECURRENCES.map((r) => {
              const active = recurrence === r.id;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.chip,
                    { backgroundColor: colors?.background || '#F7F8FC', borderColor: colors?.border || '#ECEDF6' },
                    active && styles.chipActive,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setRecurrence(r.id)}
                >
                  <Text style={[styles.chipText, { color: text }, active && styles.chipTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.label, { color: muted }]}>
            {recurrence === 'once' ? 'Runs on' : 'Starts on'}
          </Text>

          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={when}
              mode="datetime"
              display="spinner"
              themeVariant={colors?.mode === 'dark' ? 'dark' : 'light'}
              minimumDate={new Date()}
              onChange={onPick}
              style={styles.iosPicker}
            />
          ) : (
            <View style={styles.androidRow}>
              <TouchableOpacity
                style={[styles.field, { backgroundColor: colors?.background || '#F7F8FC', borderColor: colors?.border || '#ECEDF6' }]}
                onPress={() => setAndroidPicker('date')}
                activeOpacity={0.8}
              >
                <Feather name="calendar" size={15} color={muted} />
                <Text style={[styles.fieldText, { color: text }]}>
                  {when.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.field, { backgroundColor: colors?.background || '#F7F8FC', borderColor: colors?.border || '#ECEDF6' }]}
                onPress={() => setAndroidPicker('time')}
                activeOpacity={0.8}
              >
                <Feather name="clock" size={15} color={muted} />
                <Text style={[styles.fieldText, { color: text }]}>
                  {when.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {Platform.OS === 'android' && androidPicker ? (
            <DateTimePicker
              value={when}
              mode={androidPicker}
              display="default"
              minimumDate={androidPicker === 'date' ? new Date() : undefined}
              onChange={onPick}
            />
          ) : null}

          <Text style={[styles.summary, { color: muted }]}>
            {formatWhen(when)} (Nigeria time)
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.confirmBtn, busy && styles.confirmBtnDisabled]}
            activeOpacity={0.85}
            onPress={submit}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmText}>{confirmLabel}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={busy} activeOpacity={0.7}>
            <Text style={[styles.cancelText, { color: muted }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(11,13,26,0.45)', justifyContent: 'flex-end' },
  overlayTouch: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 30,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontFamily: FONTS.bold, fontSize: 17, marginBottom: 6 },
  label: { fontFamily: FONTS.semibold, fontSize: 12.5, marginTop: 18, marginBottom: 10 },

  chips: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12, borderWidth: 1.5 },
  chipActive: { backgroundColor: BRAND, borderColor: BRAND },
  chipText: { fontFamily: FONTS.semibold, fontSize: 12.5 },
  chipTextActive: { color: '#FFFFFF' },

  iosPicker: { height: 150 },
  androidRow: { flexDirection: 'row', gap: 10 },
  field: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, height: 48,
  },
  fieldText: { fontFamily: FONTS.semibold, fontSize: 13.5 },

  summary: { fontFamily: FONTS.medium, fontSize: 12, textAlign: 'center', marginTop: 10 },
  error: { fontFamily: FONTS.medium, fontSize: 12, color: '#EF4444', textAlign: 'center', marginTop: 8 },

  confirmBtn: {
    backgroundColor: BRAND, borderRadius: 16, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 18,
  },
  confirmBtnDisabled: { backgroundColor: '#B7BCEF' },
  confirmText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontFamily: FONTS.semibold, fontSize: 13.5 },
});
