
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

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

// IDs from transfers_dump.json (sample)
const productIds = [
    "4vd2dutu6", // Obleas Bon O Bon
    "b5diobz6t", // Tortitas Black
    "py9sj8faa", // Formis
    "s7vd8vj3p", // Mana Rellenas
    "8f1f5bgmk"  // Galletas Cofler
];

async function inspectExternalProducts() {
    console.log("Fetching external product details...");

    const results = [];
    for (const id of productIds) {
        try {
            const docRef = doc(db, "products", id);
            const snap = await getDoc(docRef);

            if (snap.exists()) {
                results.push({ id, ...snap.data() });
            } else {
                console.log(`\nProduct [${id}] not found.`);
            }
        } catch (e) {
            console.error(`Error fetching ${id}:`, e.message);
        }
    }
    const fs = await import('fs');
    fs.writeFileSync('external_products_full.json', JSON.stringify(results, null, 2));
    console.log("Wrote results to external_products_full.json");
}

inspectExternalProducts();
