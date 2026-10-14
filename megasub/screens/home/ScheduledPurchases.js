import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  StatusBar,
  Modal,
  Pressable,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchScheduledPurchases,
  fetchScheduleExecutions,
  updateScheduledPurchase,
  pauseScheduledPurchase,
  resumeScheduledPurchase,
  cancelScheduledPurchase,
} from '../../lib/api';
import { requireNetworkOrShowError } from '../../lib/network';
import { alertForPurchaseError, formatNaira } from '../../lib/format';
import {
  SCHEDULE_TIMEZONE,
  toLagosIso,
  formatWhen,
  normalizeSchedule,
  normalizeExecution,
  extractList,
} from '../../lib/schedule';
import { useTheme } from '../../contexts/ThemeContext';
import UnavailableNotice from './components/UnavailableNotice';
import LogoLoader from './components/LogoLoader';
import ScheduleSheet from './components/ScheduleSheet';
import WrongPinModal from './components/WrongPinModal';

const FONTS = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
};

const BRAND = '#4A55DD';

const TONES = {
  good: { bg: 'rgba(22,163,74,0.12)', fg: '#16A34A' },
  warn: { bg: 'rgba(245,158,11,0.14)', fg: '#B45309' },
  bad: { bg: 'rgba(220,38,38,0.1)', fg: '#DC2626' },
  neutral: { bg: 'rgba(107,112,136,0.12)', fg: '#6B7088' },
};

const SERVICE_ICONS = { airtime: 'call-outline', data: 'wifi-outline', cable: 'tv-outline' };

const ACTION_TEXT = {
  pause: { title: 'Pause schedule', done: 'Schedule paused.', fail: 'Could not pause the schedule' },
  resume: { title: 'Resume schedule', done: 'Schedule resumed.', fail: 'Could not resume the schedule' },
  cancel: { title: 'Cancel schedule', done: 'Schedule cancelled.', fail: 'Could not cancel the schedule' },
  update: { title: 'Change schedule', done: 'Schedule updated.', fail: 'Could not update the schedule' },
};

function StatusPill({ info }) {
  const tone = TONES[info.tone] || TONES.neutral;
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.pillText, { color: tone.fg }]}>{info.label}</Text>
    </View>
  );
}

function summaryLine(s) {
  return [s.recipient, s.plan, s.amount !== null && Number.isFinite(s.amount) ? `₦${formatNaira(s.amount)}` : null]
    .filter(Boolean)
    .join(' · ');
}

export default function ScheduledPurchases({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unavailableMessage, setUnavailableMessage] = useState(null);
  // Set when the list could not be loaded, so a failure is never shown as "no schedules".
  const [loadError, setLoadError] = useState(null);

  const [selected, setSelected] = useState(null); // normalized schedule
  const [view, setView] = useState('detail'); // 'detail' | 'history'
  const [executions, setExecutions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // An action waiting on the PIN: { type, schedule, recurrence?, startsAt? }
  const [pending, setPending] = useState(null);
  const [pin, setPin] = useState('');
  const [working, setWorking] = useState(false);
  const [wrongPinVisible, setWrongPinVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);

  const load = useCallback(
    async ({ pull = false } = {}) => {
      if (pull) setRefreshing(true);
      else setLoading(true);
      try {
        const json = await fetchScheduledPurchases(user?.id);
        setUnavailableMessage(null);
        setLoadError(null);
        setItems(extractList(json, 'schedules', 'scheduled_purchases').map(normalizeSchedule));
      } catch (error) {
        if (error.isUnavailable) setUnavailableMessage(error.message);
        else setLoadError(error.message || 'Could not load your scheduled purchases.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id]
  );

  useEffect(() => {
    load();
  }, [load]);

  const openHistory = async (schedule) => {
    setView('history');
    setLoadingHistory(true);
    setExecutions([]);
    try {
      const json = await fetchScheduleExecutions({ userId: user?.id, scheduleId: schedule.id });
      setExecutions(extractList(json, 'executions', 'history').map(normalizeExecution));
    } catch (error) {
      Alert.alert('Could not load history', error.message || 'Please try again.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setView('detail');
  };

  const askPin = (type, schedule, extra = {}) => {
    setPin('');
    setPending({ type, schedule, ...extra });
  };

  const confirmCancel = (schedule) => {
    Alert.alert(
      'Cancel this schedule?',
      'It will stop running and cannot be resumed. Purchases already made are not affected.',
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Cancel schedule', style: 'destructive', onPress: () => askPin('cancel', schedule) },
      ]
    );
  };

  const runPending = async () => {
    if (!pending || pin.length < 4) return;
    if (!(await requireNetworkOrShowError())) return;

    const { type, schedule } = pending;
    const base = { userId: user?.id, scheduleId: schedule.id, pin };
    setWorking(true);
    try {
      if (type === 'pause') await pauseScheduledPurchase(base);
      else if (type === 'resume') await resumeScheduledPurchase(base);
      else if (type === 'cancel') await cancelScheduledPurchase(base);
      else {
        await updateScheduledPurchase({
          ...base,
          recurrence: pending.recurrence,
          timezone: SCHEDULE_TIMEZONE,
          startsAt: toLagosIso(pending.startsAt),
        });
      }
      setPending(null);
      setPin('');
      closeDetail();
      Alert.alert('Done', ACTION_TEXT[type].done);
      load();
    } catch (error) {
      const alert = alertForPurchaseError(error);
      if (alert.isWrongPin) {
        setPin('');
        setWrongPinVisible(true);
      } else if (error.isNetworkError) {
        // The change may have gone through before the connection dropped.
        setPending(null);
        setPin('');
        Alert.alert(
          'Check your schedules',
          'We lost connection before getting a response. Your change may have gone through, so the list is being refreshed.'
        );
        load();
      } else {
        setPending(null);
        setPin('');
        Alert.alert(ACTION_TEXT[type].fail, error.message || 'Please try again.');
      }
    } finally {
      setWorking(false);
    }
  };

  const canAct = selected && !['cancelled', 'completed'].includes(selected.status.key);
  const isPaused = selected?.status.key === 'paused';

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Scheduled Purchases</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ pull: true })} tintColor={BRAND} />}
      >
        {loading ? (
          <LogoLoader centered />
        ) : unavailableMessage ? (
          <UnavailableNotice title="Scheduling Coming Soon" message={unavailableMessage} icon="calendar" colors={colors} />
        ) : loadError ? (
          <View style={styles.empty}>
            <Feather name="wifi-off" size={40} color="#B7BCEF" />
            <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>Could not load schedules</Text>
            <Text style={[styles.emptySub, { color: colors.textFaint }]}>{loadError}</Text>
            <TouchableOpacity style={styles.retryBtn} activeOpacity={0.85} onPress={() => load()}>
              <Text style={styles.retryBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="calendar" size={40} color="#B7BCEF" />
            <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>No scheduled purchases yet</Text>
            <Text style={[styles.emptySub, { color: colors.textFaint }]}>
              On the Airtime, Data or Cable TV confirm screen, tap "Schedule this purchase" to set one up.
            </Text>
          </View>
        ) : (
          items.map((s, i) => (
            <TouchableOpacity
              key={s.id || i}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              activeOpacity={0.8}
              onPress={() => {
                setView('detail');
                setSelected(s);
              }}
            >
              <View style={styles.cardTop}>
                <View style={styles.iconWrap}>
                  <Ionicons name={SERVICE_ICONS[s.serviceType] || 'repeat-outline'} size={20} color={BRAND} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {s.serviceLabel}
                    {s.recurrenceLabel ? ` · ${s.recurrenceLabel}` : ''}
                  </Text>
                  {summaryLine(s) ? (
                    <Text style={[styles.cardSub, { color: colors.textMuted }]} numberOfLines={1}>
                      {summaryLine(s)}
                    </Text>
                  ) : null}
                </View>
                <StatusPill info={s.status} />
              </View>
              {s.nextRun ? (
                <Text style={[styles.cardNext, { color: colors.textFaint }]}>
                  {s.status.key === 'active' ? 'Next run' : 'Starts'}: {formatWhen(s.nextRun)}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Detail / history sheet */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={closeDetail}>
        <View style={styles.overlay}>
          <Pressable style={styles.overlayTouch} onPress={closeDetail} />
          {selected ? (
            <View style={[styles.sheet, { backgroundColor: colors.card }]}>
              <View style={[styles.handle, { backgroundColor: colors.divider }]} />

              {view === 'detail' ? (
                <>
                  <View style={styles.sheetTop}>
                    <Text style={[styles.sheetTitle, { color: colors.text }]}>
                      {selected.serviceLabel}
                      {selected.recurrenceLabel ? ` · ${selected.recurrenceLabel}` : ''}
                    </Text>
                    <StatusPill info={selected.status} />
                  </View>

                  {[
                    ['Recipient', selected.recipient],
                    ['Plan', selected.plan],
                    ['Amount', selected.amount !== null && Number.isFinite(selected.amount) ? `₦${formatNaira(selected.amount)}` : null],
                    ['Next run', selected.nextRun ? formatWhen(selected.nextRun) : null],
                    ['Last run', selected.lastRun ? formatWhen(selected.lastRun) : null],
                  ]
                    .filter(([, v]) => !!v)
                    .map(([label, value]) => (
                      <View key={label} style={[styles.detailRow, { borderTopColor: colors.divider }]}>
                        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={2}>{value}</Text>
                      </View>
                    ))}

                  <View style={styles.actions}>
                    {canAct ? (
                      <>
                        <TouchableOpacity
                          style={styles.primaryBtn}
                          activeOpacity={0.85}
                          onPress={() => askPin(isPaused ? 'resume' : 'pause', selected)}
                        >
                          <Feather name={isPaused ? 'play' : 'pause'} size={16} color="#FFFFFF" />
                          <Text style={styles.primaryBtnText}>{isPaused ? 'Resume' : 'Pause'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.outlineBtn, { borderColor: colors.border }]}
                          activeOpacity={0.85}
                          onPress={() => setEditVisible(true)}
                        >
                          <Feather name="edit-2" size={15} color={colors.brandText} />
                          <Text style={[styles.outlineBtnText, { color: colors.brandText }]}>Change schedule</Text>
                        </TouchableOpacity>
                      </>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.outlineBtn, { borderColor: colors.border }]}
                      activeOpacity={0.85}
                      onPress={() => openHistory(selected)}
                    >
                      <Feather name="clock" size={15} color={colors.brandText} />
                      <Text style={[styles.outlineBtnText, { color: colors.brandText }]}>Execution history</Text>
                    </TouchableOpacity>
                    {canAct ? (
                      <TouchableOpacity style={styles.dangerBtn} activeOpacity={0.7} onPress={() => confirmCancel(selected)}>
                        <Text style={styles.dangerBtnText}>Cancel schedule</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.sheetTop}>
                    <TouchableOpacity onPress={() => setView('detail')} style={styles.historyBack}>
                      <Feather name="arrow-left" size={18} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.sheetTitle, { color: colors.text, flex: 1 }]}>Execution history</Text>
                  </View>
                  <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                    {loadingHistory ? (
                      <ActivityIndicator color={BRAND} style={{ marginTop: 30 }} />
                    ) : executions.length === 0 ? (
                      <Text style={[styles.emptySub, { color: colors.textFaint, marginTop: 30 }]}>
                        This schedule has not run yet.
                      </Text>
                    ) : (
                      executions.map((e, i) => {
                        const tone = TONES[e.tone] || TONES.neutral;
                        return (
                          <View key={e.id || i} style={[styles.execRow, { borderTopColor: colors.divider }]}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.execWhen, { color: colors.text }]}>{formatWhen(e.when)}</Text>
                              {e.message ? (
                                <Text style={[styles.execMsg, { color: colors.textMuted }]} numberOfLines={2}>{e.message}</Text>
                              ) : null}
                              {e.reference ? (
                                <Text style={[styles.execMsg, { color: colors.textFaint }]}>Ref {e.reference}</Text>
                              ) : null}
                            </View>
                            <View style={[styles.pill, { backgroundColor: tone.bg }]}>
                              <Text style={[styles.pillText, { color: tone.fg }]}>{e.statusLabel}</Text>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </ScrollView>
                </>
              )}
            </View>
          ) : null}
        </View>
      </Modal>

      {/* Change schedule: pick the new timing, then the PIN confirms it */}
      <ScheduleSheet
        visible={editVisible}
        title="Change schedule"
        confirmLabel="Continue"
        initialRecurrence={selected?.recurrence || 'once'}
        initialDate={selected?.nextRun || selected?.startsAt || null}
        colors={colors}
        onClose={() => setEditVisible(false)}
        onConfirm={({ recurrence, startsAt }) => {
          setEditVisible(false);
          askPin('update', selected, { recurrence, startsAt });
        }}
      />

      {/* PIN prompt for every change */}
      <Modal visible={!!pending} transparent animationType="fade" onRequestClose={() => !working && setPending(null)}>
        <KeyboardAvoidingView style={styles.pinOverlay} behavior="padding">
          <Pressable style={styles.overlayTouch} onPress={() => !working && setPending(null)} />
          <View style={[styles.pinCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.sheetTitle, { color: colors.text, textAlign: 'center' }]}>
              {pending ? ACTION_TEXT[pending.type].title : ''}
            </Text>
            <Text style={[styles.pinHint, { color: colors.textMuted }]}>Enter your 4-digit transaction PIN to confirm.</Text>
            <TextInput
              style={[styles.pinInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
              value={pin}
              onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="••••"
              placeholderTextColor={colors.textFaint}
              autoFocus
              textAlign="center"
            />
            <TouchableOpacity
              style={[styles.primaryBtn, { alignSelf: 'stretch' }, (pin.length < 4 || working) && styles.btnDisabled]}
              activeOpacity={0.85}
              onPress={runPending}
              disabled={pin.length < 4 || working}
            >
              {working ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Confirm</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelLink} onPress={() => setPending(null)} disabled={working}>
              <Text style={[styles.cancelLinkText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <WrongPinModal visible={wrongPinVisible} onClose={() => setWrongPinVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', elevation: 2,
    shadowColor: '#0B0D1A', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 16 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },

  empty: { alignItems: 'center', paddingTop: 90, gap: 6 },
  emptyTitle: { fontFamily: FONTS.semibold, fontSize: 14, marginTop: 10 },
  emptySub: { fontFamily: FONTS.regular, fontSize: 12.5, textAlign: 'center', lineHeight: 18, paddingHorizontal: 26 },

  retryBtn: { backgroundColor: BRAND, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 26, marginTop: 16 },
  retryBtnText: { fontFamily: FONTS.bold, fontSize: 13.5, color: '#FFFFFF' },

  card: { borderRadius: 16, borderWidth: 1.5, padding: 14, marginTop: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(74,85,221,0.1)',
  },
  cardTitle: { fontFamily: FONTS.bold, fontSize: 14, marginBottom: 2 },
  cardSub: { fontFamily: FONTS.medium, fontSize: 12 },
  cardNext: { fontFamily: FONTS.regular, fontSize: 11.5, marginTop: 10 },
  pill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10 },
  pillText: { fontFamily: FONTS.semibold, fontSize: 11 },

  overlay: { flex: 1, backgroundColor: 'rgba(11,13,26,0.45)', justifyContent: 'flex-end' },
  overlayTouch: { flex: 1 },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 30 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  sheetTitle: { fontFamily: FONTS.bold, fontSize: 17 },
  historyBack: { paddingRight: 6, paddingVertical: 4 },

  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth,
  },
  detailLabel: { fontFamily: FONTS.medium, fontSize: 12.5 },
  detailValue: { fontFamily: FONTS.semibold, fontSize: 13, flexShrink: 1, textAlign: 'right' },

  actions: { marginTop: 16, gap: 10 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: BRAND, borderRadius: 14, height: 50,
  },
  primaryBtnText: { fontFamily: FONTS.bold, fontSize: 14.5, color: '#FFFFFF' },
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderRadius: 14, height: 48,
  },
  outlineBtnText: { fontFamily: FONTS.semibold, fontSize: 13.5, color: BRAND },
  dangerBtn: { alignItems: 'center', paddingVertical: 10 },
  dangerBtnText: { fontFamily: FONTS.semibold, fontSize: 13.5, color: '#DC2626' },
  btnDisabled: { backgroundColor: '#B7BCEF' },

  execRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth,
  },
  execWhen: { fontFamily: FONTS.semibold, fontSize: 13 },
  execMsg: { fontFamily: FONTS.regular, fontSize: 11.5, marginTop: 3 },

  pinOverlay: { flex: 1, backgroundColor: 'rgba(11,13,26,0.5)', justifyContent: 'flex-end' },
  pinCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 30, alignItems: 'center' },
  pinHint: { fontFamily: FONTS.regular, fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 16 },
  pinInput: {
    alignSelf: 'stretch', height: 54, borderRadius: 14, borderWidth: 1.5,
    fontFamily: FONTS.bold, fontSize: 22, letterSpacing: 8, marginBottom: 16,
  },
  cancelLink: { paddingVertical: 12 },
  cancelLinkText: { fontFamily: FONTS.semibold, fontSize: 13.5 },
});
