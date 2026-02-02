
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
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
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
