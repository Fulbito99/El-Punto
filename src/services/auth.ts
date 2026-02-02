
import { signInWithPopup, signOut as firebaseSignOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';
import { UserProfile } from '../../types';

const USERS_COLLECTION = 'users';

export const signInWithGoogle = async (): Promise<void> => {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.error("Error signing in with popup", error);
        throw error;
    }
};

export const signOut = async (): Promise<void> => {
    await firebaseSignOut(auth);
};

export const getUserProfile = async (email: string): Promise<UserProfile | null> => {
    const docRef = doc(db, USERS_COLLECTION, email);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
    }
    return null;
};

export const createUserProfile = async (email: string, role: 'admin' | 'employee'): Promise<void> => {
    const docRef = doc(db, USERS_COLLECTION, email);
    await setDoc(docRef, { email, role });
};

export const updateUserRole = async (email: string, role: 'admin' | 'employee'): Promise<void> => {
    const docRef = doc(db, USERS_COLLECTION, email);
    await setDoc(docRef, { email, role }, { merge: true });
};

// Check if this is the first user (auto-assign admin)
export const isFirstUser = async (): Promise<boolean> => {
    // We could query the users collection, but for simplicity we'll just check if the current user exists
    // In a real app, you'd want to check the count of users
    return false; // For now, we'll handle this in the UI
};
