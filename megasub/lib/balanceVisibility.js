import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

// Whether the user chose to hide their wallet balance. Kept on the device so
// it survives closing the app (it used to reset to "shown" on every launch),
// and shared by every screen that shows the balance (Home card, Wallet), so
// hiding it in one place hides it everywhere.
const KEY = 'megasub_balance_hidden';

let current = null; // null until read from storage
const listeners = new Set();

function publish(value) {
  current = value;
  listeners.forEach((fn) => fn(value));
}

export function useBalanceHidden() {
  const [hidden, setHiddenState] = useState(current ?? false);

  useEffect(() => {
    listeners.add(setHiddenState);
    if (current === null) {
      SecureStore.getItemAsync(KEY)
        .then((stored) => publish(stored === 'true'))
        .catch(() => publish(false));
    } else {
      setHiddenState(current);
    }
    return () => listeners.delete(setHiddenState);
  }, []);

  const setHidden = (value) => {
    publish(value);
    SecureStore.setItemAsync(KEY, value ? 'true' : 'false').catch(() => {});
  };

  return [hidden, setHidden];
}
