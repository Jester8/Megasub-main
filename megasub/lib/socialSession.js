import * as SecureStore from 'expo-secure-store';
import {
  resetUnauthorizedGuard,
  setSignupStep,
  clearSignupStep,
  getAccountSetupStatus,
  saveAccountSetupStatus,
} from './api';

const SESSION_KEY = 'megasub_session_token';
const USER_KEY = 'megasub_user_data';

// Turns a successful /google or /apple response into a stored local session.
// Both endpoints answer with the same shape, so googleAuth.js and
// appleAuth.js share this instead of each keeping its own copy. Returns
// { userData, requiresPhoneVerification, isNewUser }.
export async function finishSocialSignIn(json, provider) {
  const token = json.access?.token;
  const apiUser = json.data?.user || {};
  const serverRequiresPhoneVerification = !!json.data?.requires_phone_verification;
  const isNewUser = !!json.data?.is_new_user;

  if (!token || !apiUser.id) {
    const error = new Error('Unexpected response from sign-in. Please try again.');
    error.payload = json;
    throw error;
  }

  // The backend's requires_phone_verification flag on its own is not proof
  // setup is finished — it says nothing about the transaction PIN. pin_set
  // was requested from the backend (spec §9); until it ships, PIN status
  // has to come from this device's own memory instead. previousLocal
  // (matching USER_KEY, a single slot holding only whichever account is
  // CURRENTLY signed in) only works while this is still that account —
  // signing out and into a DIFFERENT account left the previous one's data
  // there, matching nothing, so a fully set-up account got sent through
  // phone verification again on every switch. accountSetup (keyed by user
  // id, survives account switches) is checked first for that reason;
  // previousLocal stays as a fallback for anything saved before that map
  // existed.
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
  const serverPinSet = typeof apiUser.pin_set === 'boolean' ? apiUser.pin_set : undefined;

  const userData = {
    id: apiUser.id,
    email: apiUser.email || '',
    first_name: apiUser.first_name || '',
    last_name: apiUser.last_name || '',
    username: apiUser.username || '',
    // Matches the phone_verification convention already used by
    // signup/verify.jsx (1/0), not the boolean the social responses use.
    phone_verification: apiUser.phone_verification ? 1 : 0,
    phone_number: apiUser.phone_number || accountSetup.phone_number || previousLocal.phone_number || '',
    pin_set: serverPinSet ?? accountSetup.pin_set ?? previousLocal.pin_set ?? false,
    token,
    // Social-created accounts may have no password on file — delete_account
    // omits the password field for them (Profile.js checks these).
    auth_provider: provider,
    ...(typeof apiUser.has_password === 'boolean' ? { has_password: apiUser.has_password } : {}),
  };

  saveAccountSetupStatus(apiUser.id, { phone_number: userData.phone_number, pin_set: userData.pin_set });

  // Setup is only actually complete when the backend confirms phone
  // verification is not outstanding AND a PIN is known to be set for this
  // exact account. Either missing sends the user through verify.jsx, which
  // collects whichever of the two is still needed — never straight to Home
  // on an incomplete account.
  const requiresPhoneVerification = serverRequiresPhoneVerification || !userData.pin_set;

  await SecureStore.setItemAsync(SESSION_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(userData));
  // Same bypass risk as signup.jsx's email flow: the session above is
  // written before phone verification/PIN setup finish for a new or
  // unverified account. Social accounts skip email verification entirely,
  // so the resume point is 'verify', not 'email-verify'.
  if (requiresPhoneVerification) {
    await setSignupStep('verify');
  } else {
    await clearSignupStep();
  }
  resetUnauthorizedGuard();

  return { userData, requiresPhoneVerification, isNewUser };
}
