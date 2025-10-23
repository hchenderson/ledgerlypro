
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccount) as admin.ServiceAccount),
    });
  } else {
    // For environments like Google Cloud Run where the service account is automatically available
    admin.initializeApp();
  }
}

export const adminApp = admin.app();
export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
