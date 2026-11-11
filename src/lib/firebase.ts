
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  enableNetwork,
  getFirestore,
} from "firebase/firestore";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from "firebase/app-check";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Add a check for the API key
if (!firebaseConfig.apiKey) {
  console.error("Firebase API key is missing. Check your .env.local file and ensure NEXT_PUBLIC_FIREBASE_API_KEY is set.");
}


// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
let appCheck: AppCheck | null = null;

const RELEASE_TEST_PROJECT_ID = "ledgerly-release-demo";
const useEmulators = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true";

function parseLocalEmulatorHost(value: string | undefined, expectedPort: number) {
  if (!value) throw new Error(`Isolated Firebase testing requires localhost:${expectedPort}.`);
  const [host, portText] = value.split(":");
  const port = Number(portText);
  if (!(["127.0.0.1", "localhost"].includes(host)) || port !== expectedPort) {
    throw new Error(`Isolated Firebase testing requires localhost:${expectedPort}; received ${value}.`);
  }
  return { host, port };
}

if (useEmulators) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Firebase emulator mode is forbidden in production builds.");
  }
  if (firebaseConfig.projectId !== RELEASE_TEST_PROJECT_ID) {
    throw new Error(`Firebase emulator mode requires project ${RELEASE_TEST_PROJECT_ID}.`);
  }
  const globalState = globalThis as typeof globalThis & {
    __ledgerlyFirebaseEmulatorsConnected?: boolean;
  };
  if (!globalState.__ledgerlyFirebaseEmulatorsConnected) {
    const firestore = parseLocalEmulatorHost(
      process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST,
      8085,
    );
    const authentication = parseLocalEmulatorHost(
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST,
      9099,
    );
    connectFirestoreEmulator(db, firestore.host, firestore.port);
    connectAuthEmulator(
      auth,
      `http://${authentication.host}:${authentication.port}`,
      { disableWarnings: true },
    );
    globalState.__ledgerlyFirebaseEmulatorsConnected = true;
  }
}

if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY) {
  if (
    process.env.NODE_ENV !== "production"
    && process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG === "true"
  ) {
    (globalThis as typeof globalThis & {
      FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean;
    }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(
      process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY,
    ),
    isTokenAutoRefreshEnabled: true,
  });
}

// Force the client to go online. This can help in environments like
// Cloud Workstations where the SDK might incorrectly flag itself as offline.
enableNetwork(db).catch((err) => {
    console.warn("Firestore network could not be enabled:", err);
});

export { app, db, auth, appCheck };
