import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Some features run on V2 endpoints that aren't deployed to production yet;
// the server answers those with "not available yet", and each screen then
// shows a "Coming Soon" notice. That's fine on Android, but App Review
// rejects visible placeholder features (guideline 2.1/2.2), so on iOS a
// feature the server reports as unavailable is hidden instead: its Home tile
// and Profile entry disappear until the server starts answering for it.
//
// request() in lib/api.js reports every call here by path, so availability
// follows what the server actually says; warmup.js probes these features at
// login on iOS so the grid is right before the user first sees it.

const STORAGE_KEY = 'megasub_unavailable_features';

// Feature id (matches servicesConfig ids, plus 'refer-earn' and 'withdraw')
// → the API paths that belong to it.
const FEATURE_PATHS = {
  esim: /esim/,
  'virtual-card': /virtual_card|card_kyc|fetch_cards|create_card|card_details|freeze_card|unfreeze_card|fund_card/,
  waec: /result_checker/,
  scheduled: /scheduled_purchases/,
  'refer-earn': /^referrals/,
};

let unavailable = new Set();
const listeners = new Set();

function emit() {
  listeners.forEach((l) => l());
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...unavailable])).catch(() => {});
}

// Last known state from the previous run, so a hidden feature doesn't flash
// back in before this run's first response for it arrives.
AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (Array.isArray(saved) && unavailable.size === 0) {
      unavailable = new Set(saved);
      listeners.forEach((l) => l());
    }
  })
  .catch(() => {});

function featureForPath(path) {
  return Object.keys(FEATURE_PATHS).find((id) => FEATURE_PATHS[id].test(path)) || null;
}

// Called by request(): available = false when the server said the feature
// isn't deployed, true on any successful response for one of its paths.
export function reportPathAvailability(path, available) {
  const id = featureForPath(path);
  if (!id || available === !unavailable.has(id)) return;
  unavailable = new Set(unavailable);
  if (available) unavailable.delete(id);
  else unavailable.add(id);
  emit();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => unavailable;

// True when this feature should be hidden on this platform. Android keeps
// showing the "Coming Soon" notices, so this is always false there.
export function useIsFeatureHidden(id) {
  const set = useSyncExternalStore(subscribe, getSnapshot);
  return Platform.OS === 'ios' && set.has(id);
}

// Filters a list of { id } entries (the services grid) down to what iOS
// should show.
export function useVisibleFeatures(list) {
  const set = useSyncExternalStore(subscribe, getSnapshot);
  if (Platform.OS !== 'ios') return list;
  return list.filter((item) => !set.has(item.id));
}

// Withdrawals have no backend yet anywhere, so iOS never shows the button.
export const SHOW_WITHDRAW = Platform.OS !== 'ios';
