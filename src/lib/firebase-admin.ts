
'use server';

import * as admin from 'firebase-admin';

const initializeFirebaseAdmin = () => {
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
};

initializeFirebaseAdmin();

export async function getAdminDb() {
    if (!admin.apps.length) {
        return null;
    }
    return admin.firestore();
}

export async function getAdminAuth() {
    if (!admin.apps.length) {
        return null;
    }
    return admin.auth();
}
