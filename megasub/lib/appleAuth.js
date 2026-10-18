import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { appleAuth } from './api';
import { finishSocialSignIn } from './socialSession';

// Sign in with Apple is iOS-only here — App Store guideline 4.8 requires it
// on iOS because the app offers Google sign-in; Android users get Google and
// email/password. isAvailableAsync() is false on iOS < 13 and some
// simulators, so screens only show the button when this resolves true.
export async function isAppleSignInAvailable() {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export function isAppleSignInCancelled(err) {
  return err?.code === 'ERR_REQUEST_CANCELED';
}

// Runs the full Apple flow: native sheet → POST /apple → local session
// storage — shared by signup.jsx and login.jsx, same as signInWithGoogle.
// Returns { userData, requiresPhoneVerification, isNewUser } or throws
// (ERR_REQUEST_CANCELED included — callers treat that as silent via
// isAppleSignInCancelled).
export async function signInWithApple({ deviceName, referralCode } = {}) {
  // Apple gets the SHA-256 of a one-time random value; the backend gets the
  // raw value and checks the token's nonce claim against its hash, so a
  // stolen identity token can't be replayed in another request.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) {
    throw new Error('Apple did not return a sign-in token. Please try again.');
  }

  const json = await appleAuth({
    identityToken: credential.identityToken,
    authorizationCode: credential.authorizationCode,
    nonce: rawNonce,
    // Only present the very first time this Apple ID authorizes Megasub.
    firstName: credential.fullName?.givenName,
    lastName: credential.fullName?.familyName,
    email: credential.email,
    deviceName,
    referralCode,
    tnc: true,
  });
  return finishSocialSignIn(json, 'apple');
}
