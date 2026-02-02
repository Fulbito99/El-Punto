
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query } from "firebase/firestore";

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

async function listProducts() {
    console.log(`Listing first 5 products...`);
    const productsRef = collection(db, "products");

    try {
        const q = query(productsRef, limit(5));
        const snap = await getDocs(q);

        if (!snap.empty) {
            console.log(`Found ${snap.size} products.`);
            snap.forEach(doc => {
                console.log("------------------------------------------------");
                console.log("ID:", doc.id);
                console.log("DATA:", JSON.stringify(doc.data(), null, 2));
            });
        } else {
            console.log("Collection 'products' is empty or not accessible with current credentials.");
        }
    } catch (e) {
        console.error("QUERY ERROR:", e);
    }
}

listProducts();
