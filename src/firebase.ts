
import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDCqxNxvNhuqBJ4DlQ2CCKvdygG1omBraA",
  authDomain: "el-punto-ed260.firebaseapp.com",
  projectId: "el-punto-ed260",
  storageBucket: "el-punto-ed260.firebasestorage.app",
  messagingSenderId: "123631832869",
  appId: "1:123631832869:web:4b8253b03e306834aa14cc"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Habilitar persistencia de datos offline
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a a time.
      console.warn('Persistence failed-precondition (multiple tabs open)');
    } else if (err.code === 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence
      console.warn('Persistence is unimplemented');
    }
  });
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

