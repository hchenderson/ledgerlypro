

import { app, auth } from "./firebase";
import { 
    signInWithPopup, 
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail as firebaseSendPasswordResetEmail,
    UserCredential
} from "firebase/auth";

const provider = new GoogleAuthProvider();

export const signInWithGoogle = async (): Promise<UserCredential> => {
    try {
        return await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Authentication error:", error);
        throw error;
    }
};

export const signUpWithEmail = async (email, password) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error("Sign up error:", error);
        throw error;
    }
}

export const signInWithEmail = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error("Sign in error:", error);
        throw error;
    }
}

export const sendPasswordResetEmail = async (email: string) => {
    try {
        await firebaseSendPasswordResetEmail(auth, email);
    } catch (error) {
        console.error("Password reset error:", error);
        throw error;
    }
};


export const signOut = async () => {
    try {
        await firebaseSignOut(auth);
    } catch (error) {
        console.error("Sign out error:", error);
        throw error;
    }
}

export const authState = auth;


