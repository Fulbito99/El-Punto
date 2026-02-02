
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query, orderBy } from "firebase/firestore";

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

async function inspectTransfers() {
    console.log(`Inspecting latest 5 transfers...`);
    const transfersRef = collection(db, "transfers");

    try {
        const q = query(transfersRef, orderBy("date", "desc"), limit(5));
        const snap = await getDocs(q);

        if (!snap.empty) {
            const transfers = [];
            snap.forEach(doc => {
                transfers.push({ id: doc.id, ...doc.data() });
            });
            const fs = await import('fs');
            fs.writeFileSync('transfers_dump.json', JSON.stringify(transfers, null, 2));
            console.log("Wrote transfers to transfers_dump.json");
        } else {
            console.log("No transfers found.");
        }
    } catch (e) {
        console.error("QUERY ERROR:", e.message);
        // Fallback if index missing or date field different
        try {
            console.log("Retrying without sort...");
            const q2 = query(transfersRef, limit(5));
            const snap2 = await getDocs(q2);
            snap2.forEach(doc => {
                console.log("------------------------------------------------");
                console.log("DATA:", JSON.stringify(doc.data(), null, 2));
            });
        } catch (e2) {
            console.error(e2);
        }
    }
}

inspectTransfers();
