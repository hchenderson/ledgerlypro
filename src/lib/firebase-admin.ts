
import * as admin from 'firebase-admin';

const hasRequiredEnvVars =
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY;

if (!admin.apps.length) {
  if (hasRequiredEnvVars) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    } catch (error: any) {
      console.error('Firebase admin initialization error', error.stack);
    }
  } else {
    console.warn("Firebase admin environment variables are not set. Skipping initialization.");
  }
}

let db: admin.firestore.Firestore;

try {
  db = admin.firestore();
} catch (error) {
    console.error("Could not get firestore instance. Is the admin SDK initialized?");
    // @ts-ignore
    db = {}; // Assign a dummy object to prevent further crashes on import
}

export const adminDb = db;
