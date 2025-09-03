
import { app } from "./firebase";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider,
    signOut as firebaseSignOut
} from "firebase/auth";

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        return result.user;
    } catch (error) {
        console.error("Authentication error:", error);
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
