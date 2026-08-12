
import { 
    signInWithPopup, 
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail as firebaseSendPasswordResetEmail,
    UserCredential,
} from "firebase/auth";
import { auth } from "./firebase";

const provider = new GoogleAuthProvider();

export class EmailVerificationRequiredError extends Error {
    readonly code = "auth/email-not-verified";

    constructor() {
        super("Verify your email before signing in. We sent you a new verification link.");
        this.name = "EmailVerificationRequiredError";
    }
}

export const signInWithGoogle = async (): Promise<UserCredential> => {
    try {
        return await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Authentication error:", error);
        throw error;
    }
};

export const signUpWithEmail = async (email: string, password: string) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        try {
            await sendEmailVerification(userCredential.user);
        } finally {
            await firebaseSignOut(auth);
        }
        return userCredential.user;
    } catch (error) {
        console.error("Sign up error:", error);
        throw error;
    }
}

export const signInWithEmail = async (email: string, password: string) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
            await sendEmailVerification(userCredential.user).catch(() => undefined);
            await firebaseSignOut(auth);
            throw new EmailVerificationRequiredError();
        }
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
