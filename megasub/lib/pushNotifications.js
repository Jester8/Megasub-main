import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import { registerDevice, unregisterDevice } from './api';

// Push goes through Expo's push service: this install sends its Expo push
// token to the backend, and the backend posts to exp.host, which forwards to
// FCM (Android, key in EAS) or APNs (iOS, key in EAS). Contract with the
// backend: docs/Megasub_Backend_Requirements_Push_and_Social_Login.pdf §2–7.

const DEVICE_ID_KEY = 'megasub_device_id';
const PUSH_TOKEN_KEY = 'megasub_push_token';

// Shown while the app is open, too — a wallet-funded or purchase-failed
// alert matters as much in the foreground as it does in the background.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// The backend picks one of these per message (channelId), so users can mute
// promotions in Android settings without losing transaction or security
// alerts. Creating a channel that already exists just updates it.
async function ensureAndroidChannels() {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    Notifications.setNotificationChannelAsync('transactions', {
      name: 'Transactions',
      description: 'Wallet funding, purchases, refunds and scheduled purchases',
      importance: Notifications.AndroidImportance.HIGH,
    }),
    Notifications.setNotificationChannelAsync('security', {
      name: 'Security',
      description: 'New logins, PIN and password changes, verification results',
      importance: Notifications.AndroidImportance.HIGH,
    }),
    Notifications.setNotificationChannelAsync('promotions', {
      name: 'Promotions',
      description: 'Offers and announcements',
      importance: Notifications.AndroidImportance.DEFAULT,
    }),
  ]);
}

// Stable per install (not per account) so the backend can upsert the same
// row when a different person signs in on this phone.
async function getDeviceId() {
  let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  }
  return id;
}

// Permission is asked once, after login, never at cold start. A user who
// declined isn't nagged again — iOS won't re-show the prompt anyway.
async function ensurePermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

// The app calls this on every login and every app start that lands on Home.
// Repeats within one app run for the same account/token are skipped; the
// backend treats each call as an upsert anyway.
let lastRegistration = null;
// Home can be navigated to several times in quick succession, so concurrent
// calls share one in-flight registration, and a failed attempt waits a
// minute before the next try instead of hammering the API on every render.
let inFlight = null;
let lastFailureAt = 0;
const RETRY_AFTER_FAILURE_MS = 60 * 1000;

export function registerPushDevice(userId) {
  if (!userId) return Promise.resolve();
  if (inFlight) return inFlight;
  if (Date.now() - lastFailureAt < RETRY_AFTER_FAILURE_MS) return Promise.resolve();
  inFlight = doRegisterPushDevice(userId).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doRegisterPushDevice(userId) {
  try {
    await ensureAndroidChannels();
    if (!(await ensurePermission())) return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    const deviceId = await getDeviceId();

    const key = `${userId}:${pushToken}`;
    if (lastRegistration === key) return;

    await registerDevice({
      user_id: userId,
      push_token: pushToken,
      token_type: 'expo',
      platform: Platform.OS,
      device_id: deviceId,
      device_name: Constants.deviceName || (Platform.OS === 'ios' ? 'iOS Device' : 'Android Device'),
      os_version: String(Platform.Version),
      app_version: Constants.expoConfig?.version || '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: Intl.DateTimeFormat().resolvedOptions().locale,
    });
    lastRegistration = key;
    lastFailureAt = 0;
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, pushToken);
  } catch (err) {
    // Push is a nice-to-have on top of every flow — simulators may have no
    // push token, and a failed call is retried later. Neither should ever
    // surface as an error to the user.
    lastFailureAt = Date.now();
    console.log('⚠️ Push registration skipped:', err?.message);
  }
}

// Called on logout before the session token is cleared, so the backend can
// stop sending this account's alerts to a phone nobody is signed into. Never
// blocks logout for more than a few seconds.
export async function unregisterPushDevice(userId) {
  lastRegistration = null;
  if (!userId) return;
  try {
    const [deviceId, pushToken] = await Promise.all([
      SecureStore.getItemAsync(DEVICE_ID_KEY),
      SecureStore.getItemAsync(PUSH_TOKEN_KEY),
    ]);
    if (!deviceId) return;
    await Promise.race([
      unregisterDevice({ userId, deviceId, pushToken }),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);
  } catch (err) {
    console.log('⚠️ Push unregister skipped:', err?.message);
  }
}

// After a session ends server-side (another login, deleted account) the
// backend already dropped this device; only the in-memory memo needs reset.
export function forgetPushRegistration() {
  lastRegistration = null;
  lastFailureAt = 0;
}

// APNs/FCM can rotate a token while the app is running; re-register so the
// backend never keeps sending to the dead one. This listener also fires every
// time getExpoPushTokenAsync fetches the (unchanged) device token, so it must
// only act on a token that actually differs — reacting to every event made
// registration re-trigger itself in an endless loop.
let lastDeviceToken = null;

export function addPushTokenRefreshListener(getUserId) {
  return Notifications.addPushTokenListener(({ data }) => {
    const token = typeof data === 'string' ? data : JSON.stringify(data);
    const changed = lastDeviceToken !== null && lastDeviceToken !== token;
    lastDeviceToken = token;
    if (!changed) return;
    lastRegistration = null;
    lastFailureAt = 0;
    registerPushDevice(getUserId());
  });
}

// Maps a tapped notification's data.type (spec §4) to the screen that shows
// it. Anything unknown opens the Notifications screen.
export function screenForNotification(data) {
  const type = String(data?.type || '');
  if (type.startsWith('wallet.')) return 'wallet';
  if (type.startsWith('transaction.')) return 'history';
  if (type.startsWith('schedule.')) return 'scheduled';
  if (type.startsWith('kyc.')) return data?.kyc_type === 'card' ? 'card-kyc' : 'kyc';
  if (type.startsWith('card.')) return 'virtual-card';
  if (type.startsWith('esim.')) return 'my-esims';
  if (type.startsWith('referral.')) return 'refer-earn';
  if (type.startsWith('security.')) return 'profile';
  return 'notifications';
}

export const addNotificationTapListener = (listener) =>
  Notifications.addNotificationResponseReceivedListener((response) =>
    listener(response.notification.request.content.data || {})
  );

// The tap that launched the app from a killed state, if any.
export function getLaunchNotificationData() {
  const response = Notifications.getLastNotificationResponse();
  return response ? response.notification.request.content.data || {} : null;
}

export function clearLaunchNotification() {
  Notifications.clearLastNotificationResponse?.();
}
