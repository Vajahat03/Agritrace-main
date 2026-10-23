import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence,
  User as FirebaseUser,
  NextOrObserver,
  Unsubscribe,
} from 'firebase/auth';

/**
 * AgriTrace Firebase Client Configuration
 * Client-safe: Only NEXT_PUBLIC_* variables are referenced.
 * Do not place Firebase Admin SDK keys, private keys, or MongoDB URIs here.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'your_firebase_api_key_here' &&
  !firebaseConfig.apiKey.includes('placeholder') &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== 'your_firebase_project_id'
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (typeof window !== 'undefined' || isFirebaseConfigured) {
  try {
    if (getApps().length > 0) {
      app = getApp();
    } else if (firebaseConfig.apiKey && firebaseConfig.projectId) {
      app = initializeApp(firebaseConfig);
    }

    if (app) {
      auth = getAuth(app);
      // Ensure browser local persistence is configured when window is available
      if (typeof window !== 'undefined') {
        setPersistence(auth, browserLocalPersistence).catch((err) => {
          console.warn('[AgriTrace Firebase] Could not set persistence to browserLocalPersistence:', err);
        });
      }
    }
  } catch (err) {
    console.warn('[AgriTrace Firebase] Initialization error:', err);
  }
}

export { app, auth };

/**
 * Formats Firebase authentication error codes into meaningful, user-friendly messages.
 */
export function formatFirebaseAuthError(error: any): string {
  if (!error) return 'An unknown authentication error occurred.';

  const code: string = error?.code || '';
  const message: string = error?.message || '';

  if (!isFirebaseConfigured && (!auth || code.includes('invalid-api-key') || code.includes('api-key-not-valid'))) {
    return 'Firebase authentication is not configured. Please provide valid NEXT_PUBLIC_FIREBASE_* environment variables in .env.local.';
  }

  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completing.';
    case 'auth/cancelled-popup-request':
      return 'Sign-in operation was cancelled.';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by your browser. Please allow popups for this site.';
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Please sign in instead.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please check your credentials and try again.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/network-request-failed':
      return 'Network connection failed. Please check your internet connection and try again.';
    case 'auth/too-many-requests':
      return 'Access temporarily disabled due to many failed attempts. Please reset your password or try again later.';
    case 'auth/user-disabled':
      return 'This user account has been disabled. Please contact AgriTrace support.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in your Firebase Console.';
    case 'auth/requires-recent-login':
      return 'This action requires recent authentication. Please log in again.';
    default:
      if (message.includes('API key not valid')) {
        return 'Firebase API key is invalid or not configured. Check your environment settings.';
      }
      return message || 'Authentication failed. Please try again.';
  }
}

function ensureAuth(): Auth {
  if (!auth) {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase authentication is not configured. Set NEXT_PUBLIC_FIREBASE_* variables in .env.local.');
    }
    // Attempt lazy initialization
    if (firebaseConfig.apiKey && firebaseConfig.projectId) {
      const initialized = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      auth = getAuth(initialized);
      return auth;
    }
    throw new Error('Firebase auth instance is unavailable.');
  }
  return auth;
}

/**
 * Register a new user with Email and Password.
 */
export async function registerWithEmail(
  email: string,
  pass: string,
  fullName: string
): Promise<FirebaseUser> {
  const authInstance = ensureAuth();
  const credential = await createUserWithEmailAndPassword(authInstance, email, pass);
  if (fullName && credential.user) {
    try {
      await updateProfile(credential.user, { displayName: fullName });
    } catch (profileErr) {
      console.warn('[AgriTrace Firebase] Could not set displayName:', profileErr);
    }
  }
  return credential.user;
}

/**
 * Sign in existing user with Email and Password.
 */
export async function loginWithEmail(email: string, pass: string): Promise<FirebaseUser> {
  const authInstance = ensureAuth();
  const credential = await signInWithEmailAndPassword(authInstance, email, pass);
  return credential.user;
}

/**
 * Sign in with Google Popup.
 */
export async function loginWithGoogle(): Promise<FirebaseUser> {
  const authInstance = ensureAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(authInstance, provider);
  return credential.user;
}

/**
 * Send password reset email.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const authInstance = ensureAuth();
  await sendPasswordResetEmail(authInstance, email);
}

/**
 * Sign out the current user.
 */
export async function logoutUser(): Promise<void> {
  const authInstance = ensureAuth();
  await signOut(authInstance);
}

/**
 * Listen for Firebase Auth state changes.
 */
export function subscribeToAuthState(
  observer: NextOrObserver<FirebaseUser | null>
): Unsubscribe {
  if (!auth) {
    if (isFirebaseConfigured && firebaseConfig.apiKey && firebaseConfig.projectId) {
      const initialized = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      auth = getAuth(initialized);
    } else {
      // If auth is not configured, immediately notify observer with null and return noop
      if (typeof observer === 'function') {
        observer(null);
      } else if (observer && typeof observer.next === 'function') {
        observer.next(null);
      }
      return () => {};
    }
  }
  return onAuthStateChanged(auth, observer);
}

/**
 * Get the current Firebase user's ID token.
 */
export async function getCurrentUserIdToken(forceRefresh = false): Promise<string | null> {
  if (!auth || !auth.currentUser) return null;
  return auth.currentUser.getIdToken(forceRefresh);
}
