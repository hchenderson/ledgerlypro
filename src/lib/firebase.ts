
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, enableNetwork } from "firebase/firestore";
import { getAuth } from "firebase/auth";

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

// Force the client to go online. This can help in environments like
// Cloud Workstations where the SDK might incorrectly flag itself as offline.
enableNetwork(db).catch((err) => {
    console.warn("Firestore network could not be enabled:", err);
});

export { app, db, auth };
