import React, { useState } from 'react';
import { Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { createScheduledPurchase } from '../../../lib/api';
import { requireNetworkOrShowError } from '../../../lib/network';
import { alertForPurchaseError } from '../../../lib/format';
import { SCHEDULE_TIMEZONE, toLagosIso, formatWhen } from '../../../lib/schedule';
import { useTheme } from '../../../contexts/ThemeContext';

const BRAND = '#4A55DD';

// Shared by the Airtime, Data and Cable confirm screens: opens the schedule
// sheet and sends the already-collected purchase to scheduled_purchases with
// the PIN the user typed there. No money moves when a schedule is created;
// it is charged when each run executes.
//
//   getPurchase() -> the `purchase` object for this service (see the API
//                    collection for each service's shape)
//   getPin()      -> the PIN entered on the confirm screen
//   onWrongPin()  -> called when the server rejects the PIN
export default function useSchedulePurchase({ user, navigate, serviceType, getPurchase, getPin, onWrongPin }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async ({ recurrence, startsAt }) => {
    if (!(await requireNetworkOrShowError())) return;

    setBusy(true);
    try {
      await createScheduledPurchase({
        user_id: user?.id,
        service_type: serviceType,
        recurrence,
        timezone: SCHEDULE_TIMEZONE,
        starts_at: toLagosIso(startsAt),
        pin: getPin(),
        purchase: getPurchase(),
      });
      setVisible(false);
      Alert.alert(
        'Purchase scheduled',
        `It will run ${recurrence === 'once' ? 'on' : 'starting'} ${formatWhen(startsAt)}. You can pause, change or cancel it in Scheduled Purchases.`,
        [
          { text: 'View schedules', onPress: () => navigate && navigate('scheduled') },
          { text: 'Done', onPress: () => navigate && navigate('home') },
        ]
      );
    } catch (error) {
      const alert = alertForPurchaseError(error);
      if (alert.isWrongPin) {
        setVisible(false);
        onWrongPin && onWrongPin();
      } else if (error.isNetworkError) {
        // The schedule may have been created before the connection dropped;
        // a second attempt could create a duplicate that buys twice.
        setVisible(false);
        Alert.alert(
          'Check your schedules',
          'We lost connection before getting a response, so your schedule may have been created. Check Scheduled Purchases before trying again.',
          [
            { text: 'View schedules', onPress: () => navigate && navigate('scheduled') },
            { text: 'OK', style: 'cancel' },
          ]
        );
      } else if (alert.requiresPhoneVerification) {
        setVisible(false);
        Alert.alert(alert.title, alert.message, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Verify Phone', onPress: () => navigate && navigate('verify', user) },
        ]);
      } else {
        Alert.alert('Could not schedule', error.message || 'Please check the details and try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return {
    visible,
    busy,
    open: () => setVisible(true),
    close: () => !busy && setVisible(false),
    submit,
  };
}

// The "Schedule this purchase" link shown under the Pay button. Brand blue in
// light mode, white in dark mode. It stays disabled until the PIN is entered;
// the dimming is kept lighter in dark mode so the white text still reads.
export function ScheduleLink({ onPress, disabled }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.link, disabled && { opacity: colors.mode === 'dark' ? 0.7 : 0.45 }]}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
    >
      <Feather name="calendar" size={15} color={colors.brandText} />
      <Text style={[styles.linkText, { color: colors.brandText }]}>Schedule this purchase</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  linkText: { fontFamily: 'Montserrat_600SemiBold', fontSize: 13.5, color: BRAND },
});
