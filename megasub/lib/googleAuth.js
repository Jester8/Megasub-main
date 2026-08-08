import * as SecureStore from 'expo-secure-store';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { googleAuth, resetUnauthorizedGuard } from './api';

const SESSION_KEY = 'megasub_session_token';
const USER_KEY = 'megasub_user_data';

// Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client
// IDs → "Web application" type (Samuel, 2026-08-04). This MUST match the
// Web Client ID the backend uses to verify the token's `aud` claim — give
// this same value to whoever runs the /google endpoint if they haven't
// already got it, otherwise every sign-in will 401 with "Invalid or expired
// Google token." The paired client *secret* is not used here — only the
// native ID-token flow is needed client-side, and a client secret must
// never ship inside a mobile app bundle (it's extractable by anyone who
// decompiles the app). Keep it out of this repo entirely.
const GOOGLE_WEB_CLIENT_ID = '610379032738-gjnp8tokk3s6g160qa9l9ub3ltcdarl1.apps.googleusercontent.com';

// iOS-type OAuth client (bundle ID com.anonymous.megasub) — its reversed
// form is also registered as the URL scheme in app.json so the OS can route
// the sign-in redirect back into the app.
const GOOGLE_IOS_CLIENT_ID = '610379032738-qgicd1bril1d6n43v78ldqmh8bfdacaq.apps.googleusercontent.com';

// Android-type OAuth client also exists (610379032738-06kumfcnmfcnfn2a70ep1hhed082jafi.apps.googleusercontent.com)
// but is deliberately not referenced here — GoogleSignin.configure() has no
// androidClientId option. The Android SDK finds the right client on its own
// by matching this app's package (com.anonymous.megasub) against the SHA-1
// registered on that client in Google Cloud Console; that registration is
// the only setup this platform needs.
let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    offlineAccess: false,
  });
  configured = true;
}

export function isGoogleSignInCancelled(err) {
  return err?.code === statusCodes.SIGN_IN_CANCELLED;
}

// Runs the full Google flow: native sign-in → POST /google → local session
// storage — shared by signup.jsx and login.jsx since the backend decides
// new-account-vs-login from the same call, not from which screen it came
// from. Returns { userData, requiresPhoneVerification, isNewUser } or
// throws (SIGN_IN_CANCELLED included — callers should treat that as silent
// via isGoogleSignInCancelled, not an error to alert on).
export async function signInWithGoogle({ deviceName, referralCode } = {}) {
  ensureConfigured();

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const signInResult = await GoogleSignin.signIn();

  // v13+ of this library wraps the payload as { type: 'success', data };
  // older versions return the fields directly — support both shapes.
  const idToken = signInResult?.data?.idToken || signInResult?.idToken;
  if (!idToken) {
    throw new Error('Google did not return an ID token. Please try again.');
  }

  const json = await googleAuth({ idToken, deviceName, referralCode, tnc: true });

  const token = json.access?.token;
  const apiUser = json.data?.user || {};
  const requiresPhoneVerification = !!json.data?.requires_phone_verification;
  const isNewUser = !!json.data?.is_new_user;

  if (!token || !apiUser.id) {
    const error = new Error('Unexpected response from Google sign-in. Please try again.');
    error.payload = json;
    throw error;
  }

  const userData = {
    id: apiUser.id,
    email: apiUser.email || '',
    first_name: apiUser.first_name || '',
    last_name: apiUser.last_name || '',
    username: apiUser.username || '',
    // Matches the phone_verification convention already used by
    // signup/verify.jsx (1/0), not the boolean the /google response uses.
    phone_verification: apiUser.phone_verification ? 1 : 0,
    token,
    // Google-created accounts may have no password on file — delete_account
    // omits the password field for them (Profile.js checks this flag).
    auth_provider: 'google',
  };

  await SecureStore.setItemAsync(SESSION_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(userData));
  resetUnauthorizedGuard();

  return { userData, requiresPhoneVerification, isNewUser };
}
