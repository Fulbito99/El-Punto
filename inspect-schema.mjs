
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";

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

async function inspectProduct() {
    // SKU visible in the screenshot for "Citric Surtido 500Ml"
    const knownSku = "7798085601452";

    console.log(`Inspecting product with SKU: ${knownSku}...`);
    const productsRef = collection(db, "products");

    try {
        const q = query(productsRef, where("sku", "==", knownSku));
        const snap = await getDocs(q);

        if (!snap.empty) {
            snap.forEach(doc => {
                console.log("DOCUMENT DATA:");
                console.log(JSON.stringify(doc.data(), null, 2));
            });
        } else {
            console.log("Product not found by SKU either. Check collection name or permissions.");
        }
    } catch (e) {
        console.error("QUERY ERROR:", e);
    }
}

inspectProduct();
