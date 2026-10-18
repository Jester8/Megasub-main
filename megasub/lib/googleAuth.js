import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { googleAuth } from './api';
import { finishSocialSignIn } from './socialSession';

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
// app. Its bundle ID was edited in Google Cloud Console to com.megasub.megasub
// (2026-10-18) to match app.json and the existing App Store Connect record,
// keeping the same client ID.
const GOOGLE_IOS_CLIENT_ID = '610379032738-qgicd1bril1d6n43v78ldqmh8bfdacaq.apps.googleusercontent.com';

// Android-type OAuth client also exists (610379032738-06kumfcnmfcnfn2a70ep1hhed082jafi.apps.googleusercontent.com)
// but is deliberately not referenced here — GoogleSignin.configure() has no
// androidClientId option. The Android SDK finds the right client on its own
// by matching this app's package name against the SHA-1 registered on that
// client in Google Cloud Console. Clients are registered against
// com.anonymous.megasub, which stays the Android package for good — the app
// is already live on Google Play under it, and Play never allows a package
// name to change (Samuel, 2026-10-18; a planned move to com.megasub.app was
// dropped). Play-installed builds are re-signed with Google's app signing
// key, so there's one Android client for that key's SHA-1 (Play Console →
// App integrity) and a second for the EAS upload key's SHA-1 (D0:CF:…:95:28)
// — otherwise sign-in works in one kind of build but fails with
// DEVELOPER_ERROR in the other.
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

  // v13+ of this library wraps the payload as { type: 'success', data } and
  // reports a dismissed sheet as { type: 'cancelled' } instead of throwing;
  // older versions return the fields directly — support both shapes, and
  // turn a cancel into the same silent error isGoogleSignInCancelled knows.
  if (signInResult?.type === 'cancelled') {
    const cancelled = new Error('Google sign-in was cancelled.');
    cancelled.code = statusCodes.SIGN_IN_CANCELLED;
    throw cancelled;
  }
  const idToken = signInResult?.data?.idToken || signInResult?.idToken;
  if (!idToken) {
    throw new Error('Google did not return an ID token. Please try again.');
  }

  const json = await googleAuth({ idToken, deviceName, referralCode, tnc: true });
  return finishSocialSignIn(json, 'google');
}
