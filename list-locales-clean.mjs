
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const externalFirebaseConfig = {
    apiKey: "AIzaSyCKXfqtER1968lTf-t4-PWxDWGmb--dXEA",
    authDomain: "deposito-inventory-f7a1b.firebaseapp.com",
    projectId: "deposito-inventory-f7a1b",
    storageBucket: "deposito-inventory-f7a1b.firebasestorage.app",
    messagingSenderId: "221074983931",
    appId: "1:221074983931:web:febc0346ec1d7dc9bed95e"
};

const app = initializeApp(externalFirebaseConfig);
const db = getFirestore(app);

async function listLocalesHelper() {
    console.log("Locales:");
    const ref = collection(db, "locales");
    try {
        const snap = await getDocs(ref);
        snap.forEach(doc => {
            const data = doc.data();
            console.log(`ID: ${doc.id}, Name: ${data.name}`);
        });
    } catch (e) {
        console.error("Error:", e.message);
    }
}

listLocalesHelper();
