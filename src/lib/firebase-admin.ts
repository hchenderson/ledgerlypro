
import * as admin from 'firebase-admin';

// Check if the required environment variables are available.
const hasRequiredEnvVars =
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY;

// Initialize the Firebase Admin SDK only if it hasn't been already and the env vars are present.
if (!admin.apps.length && hasRequiredEnvVars) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error: any) {
    console.error('Firebase admin initialization error:', error.stack);
  }
} else if (!hasRequiredEnvVars) {
    console.warn("Firebase admin environment variables are not set. Skipping initialization.");
}

// Export the firestore instance. This will be undefined if initialization fails.
export const adminDb = admin.apps.length ? admin.firestore() : undefined;
