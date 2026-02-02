
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

console.log("START SCRIPT");

const app = initializeApp(externalFirebaseConfig);
const db = getFirestore(app);

async function search(barcode) {
    console.log(`Checking BARCODES array for ${barcode}...`);
    const productsRef = collection(db, "products");

    try {
        const q = query(productsRef, where("barcodes", "array-contains", barcode));
        const snap = await getDocs(q);

        if (!snap.empty) {
            snap.forEach(doc => {
                console.log("FOUND:", doc.data().name);
            });
        } else {
            console.log("NOT FOUND in barcodes array.");
        }
    } catch (e) {
        console.error("QUERY ERROR:", e.message);
    }
    console.log("END SCRIPT");
}

search("7798085681605");
