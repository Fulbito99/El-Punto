
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

async function dumpTransfers() {
    console.log(`Dumping latest 1000 transfers...`);
    const transfersRef = collection(db, "transfers");
    // Fetch last 1000 transfers
    const q = query(transfersRef, orderBy("date", "desc"), limit(1000));
    const snap = await getDocs(q);

    if (!snap.empty) {
        const transfers = [];
        snap.forEach(doc => {
            transfers.push({ id: doc.id, ...doc.data() });
        });

        const fs = await import('fs');
        fs.writeFileSync('all_transfers_dump.json', JSON.stringify(transfers, null, 2));
        console.log(`Wrote ${transfers.length} transfers to all_transfers_dump.json`);
    } else {
        console.log("No transfers found.");
    }
}

dumpTransfers();
