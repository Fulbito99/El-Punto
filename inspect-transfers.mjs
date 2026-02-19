
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query, where, orderBy } from "firebase/firestore";
import fs from 'fs';

// External Firebase Config (Deposito)
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

async function inspectTransfers() {
    console.log(`Inspecting transfers for 'locale-1' (El Punto)...`);
    const transfersRef = collection(db, "transfers");

    try {
        // Query for locale-1 as destination
        // Removed orderBy on 'date' as it's a string and might cause index issues if not formatted correctly
        // Added limit to 500 to catch recent ones
        // Added orderBy timestamp desc to get recent first
        const q = query(
            transfersRef,
            where('destinationLocaleId', '==', 'locale-1'),
            orderBy('timestamp', 'desc'),
            limit(500)
        );
        const snap = await getDocs(q);

        if (!snap.empty) {
            const transfers = [];
            snap.forEach(doc => {
                transfers.push({ id: doc.id, ...doc.data() });
            });
            fs.writeFileSync('transfers_dump.json', JSON.stringify(transfers, null, 2));
            console.log(`Wrote ${transfers.length} transfers to transfers_dump.json`);
        } else {
            console.log("No transfers found for locale-1.");
        }
    } catch (e) {
        console.error("QUERY ERROR:", e);

        // Fallback: Try without orderBy timestamp if index missing
        try {
            console.log("Trying fallback query without sort...");
            const qFallback = query(
                transfersRef,
                where('destinationLocaleId', '==', 'locale-1'),
                limit(500)
            );
            const snapFallback = await getDocs(qFallback);
            if (!snapFallback.empty) {
                const transfers = [];
                snapFallback.forEach(doc => {
                    transfers.push({ id: doc.id, ...doc.data() });
                });
                fs.writeFileSync('transfers_dump.json', JSON.stringify(transfers, null, 2));
                console.log(`Fallback: Wrote ${transfers.length} transfers to transfers_dump.json`);
            }
        } catch (e2) {
            console.error("FALLBACK ERROR:", e2);
        }
    }
}

inspectTransfers();
