import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

// Screens with their own steps (pick plan → confirm) handle the on-screen
// back arrow themselves, but Android's hardware back button went to App.js's
// screen history and skipped those steps, landing on Home. This lets a
// screen take the hardware back press first: `onBack` returns true when it
// moved to a previous step, false to let the app handle it as before.
// Listeners added later run first, so this always wins over App.js's.
export default function useStepBack(onBack) {
  const handlerRef = useRef(onBack);
  handlerRef.current = onBack;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => !!handlerRef.current?.());
    return () => sub.remove();
  }, []);
}
