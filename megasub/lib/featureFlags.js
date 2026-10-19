import { Platform } from 'react-native';

// Continue with Google / Apple stay hidden on iOS until the backend's /apple
// endpoint is live. App Store guideline 4.8 requires Sign in with Apple
// whenever Google sign-in is offered, and review rejects a login button that
// errors — so both go together on iOS. Android keeps Google (it has no Apple
// button). Flip this to true once /apple is confirmed working on TestFlight.
export const SHOW_SOCIAL_LOGIN = Platform.OS !== 'ios';
