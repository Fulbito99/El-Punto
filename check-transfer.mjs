
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

// External Firebase Config
const externalFirebaseConfig = {
    apiKey: "AIzaSyCKXfqtER1968lTf-t4-PWxDWGmb--dXEA",
    authDomain: "deposito-inventory-f7a1b.firebaseapp.com",
    projectId: "deposito-inventory-f7a1b",
    storageBucket: "deposito-inventory-f7a1b.firebasestorage.app",
    messagingSenderId: "367375252876",
    appId: "1:367375252876:web:e2b3e8346e438c8230b65f"
};

const app = initializeApp(externalFirebaseConfig);
const db = getFirestore(app);

async function checkTransfer() {
    const id = "cGobOV2jTUv0jaXFy8to";
    console.log(`Checking transfer ${id}...`);
    const docRef = doc(db, "transfers", id);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
        const data = snap.data();
        console.log("Full Data Keys:", Object.keys(data));
        console.log("Full Data:", JSON.stringify(data, null, 2));
        console.log("Timestamp field:", data.timestamp);
    } else {
        console.log("Transfer not found!");
    }
}

checkTransfer();
