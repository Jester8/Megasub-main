import * as SecureStore from 'expo-secure-store';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import {
  googleAuth,
  resetUnauthorizedGuard,
  setSignupStep,
  clearSignupStep,
  getAccountSetupStatus,
  saveAccountSetupStatus,
} from './api';

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

// iOS-type OAuth client — its reversed form is also registered as the URL
// scheme in app.json so the OS can route the sign-in redirect back into the
// app. Registered in Google Cloud Console against bundle ID
// com.anonymous.megasub; the app.json bundleIdentifier was later changed to
// com.megasub.megasub (Samuel, 2026-08-16) to match the bundle ID of the
// existing App Store Connect app record created by the previous developer,
// so a new build can attach to that app instead of creating a separate one.
// This client must be recreated (or edited, if Google allows changing the
// bundle ID on an existing iOS client) for com.megasub.megasub before
// Google Sign-In will work on iOS again.
const GOOGLE_IOS_CLIENT_ID = '610379032738-qgicd1bril1d6n43v78ldqmh8bfdacaq.apps.googleusercontent.com';

// Android-type OAuth client also exists (610379032738-06kumfcnmfcnfn2a70ep1hhed082jafi.apps.googleusercontent.com)
// but is deliberately not referenced here — GoogleSignin.configure() has no
// androidClientId option. The Android SDK finds the right client on its own
// by matching this app's package name against the SHA-1 registered on that
// client in Google Cloud Console. That client was registered against
// com.anonymous.megasub; the app.json package was later changed to
// com.megasub.app (Samuel, 2026-08-14), so a new Android OAuth client (same
// SHA-1, new package name) must be created before Google Sign-In will work
// on Android again.
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
  const serverRequiresPhoneVerification = !!json.data?.requires_phone_verification;
  const isNewUser = !!json.data?.is_new_user;

  if (!token || !apiUser.id) {
    const error = new Error('Unexpected response from Google sign-in. Please try again.');
    error.payload = json;
    throw error;
  }

  // The backend's requires_phone_verification flag on its own is not proof
  // setup is finished — it says nothing about the transaction PIN, which
  // the /google response never reports at all (no pin_set field exists).
  // Trusting that flag alone sent brand-new Google signups (pin never set)
  // straight to Home. PIN status has to come from this device's own memory
  // instead. previousLocal (matching USER_KEY, a single slot holding only
  // whichever account is CURRENTLY signed in) only works while this is
  // still that account — signing out and into a DIFFERENT Google account
  // left the previous one's data there, matching nothing, so a fully
  // set-up account got sent through phone verification again on every
  // switch. accountSetup (keyed by user id, survives account switches) is
  // checked first for that reason; previousLocal stays as a fallback for
  // anything saved before this map existed.
  let previousLocal = {};
  try {
    const prevRaw = await SecureStore.getItemAsync(USER_KEY);
    if (prevRaw) {
      const prev = JSON.parse(prevRaw);
      const sameAccount =
        prev.id === apiUser.id ||
        (prev.email && apiUser.email && prev.email.toLowerCase() === apiUser.email.toLowerCase());
      if (sameAccount) previousLocal = prev;
    }
  } catch {}

  const accountSetup = (await getAccountSetupStatus(apiUser.id)) || {};

  const userData = {
    id: apiUser.id,
    email: apiUser.email || '',
    first_name: apiUser.first_name || '',
    last_name: apiUser.last_name || '',
    username: apiUser.username || '',
    // Matches the phone_verification convention already used by
    // signup/verify.jsx (1/0), not the boolean the /google response uses.
    phone_verification: apiUser.phone_verification ? 1 : 0,
    phone_number: accountSetup.phone_number || previousLocal.phone_number || '',
    pin_set: accountSetup.pin_set ?? previousLocal.pin_set ?? false,
    token,
    // Google-created accounts may have no password on file — delete_account
    // omits the password field for them (Profile.js checks this flag).
    auth_provider: 'google',
  };

  saveAccountSetupStatus(apiUser.id, { phone_number: userData.phone_number, pin_set: userData.pin_set });

  // Setup is only actually complete when the backend confirms phone
  // verification is not outstanding AND this device remembers a PIN was
  // set for this exact account. Either missing sends the user through
  // verify.jsx, which collects whichever of the two is still needed —
  // never straight to Home on an incomplete account.
  const requiresPhoneVerification = serverRequiresPhoneVerification || !userData.pin_set;

  await SecureStore.setItemAsync(SESSION_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(userData));
  // Same bypass risk as signup.jsx's email flow: the session above is
  // written before phone verification/PIN setup finish for a new or
  // unverified Google account. Google accounts skip email verification
  // entirely, so the resume point is 'verify', not 'email-verify'.
  if (requiresPhoneVerification) {
    await setSignupStep('verify');
  } else {
    await clearSignupStep();
  }
  resetUnauthorizedGuard();

  return { userData, requiresPhoneVerification, isNewUser };
}
