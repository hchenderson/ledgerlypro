
'use server';

import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (serviceAccountString) {
    try {
        const serviceAccount = JSON.parse(serviceAccountString);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    } catch (error) {
        console.error("Failed to parse or initialize Firebase Admin SDK:", error);
    }
  } else {
    console.warn("FIREBASE_SERVICE_ACCOUNT environment variable is not set. Firebase Admin SDK not initialized.");
  }
}

let adminDb: admin.firestore.Firestore;
let adminAuth: admin.auth.Auth;

if (admin.apps.length > 0) {
    adminDb = admin.firestore();
    adminAuth = admin.auth();
}

// @ts-ignore
export { adminDb, adminAuth };
