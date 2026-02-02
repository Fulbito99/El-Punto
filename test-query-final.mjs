
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

console.log("START FINAL CHECK");

const app = initializeApp(externalFirebaseConfig);
const db = getFirestore(app);

async function search() {
    const barcode = "7798085681605";
    console.log(`Checking additionalSkus for ${barcode}...`);
    const productsRef = collection(db, "products");

    try {
        const q = query(productsRef, where("additionalSkus", "array-contains", barcode));
        const snap = await getDocs(q);

        if (!snap.empty) {
            snap.forEach(doc => {
                console.log("FOUND PRODUCT:", doc.data().name);
                console.log("MAIN SKU:", doc.data().sku);
                console.log("ADDITIONAL SKUS:", doc.data().additionalSkus);
            });
        } else {
            console.log("NOT FOUND in additionalSkus.");
        }
    } catch (e) {
        console.error("QUERY ERROR:", e.message);
    }
    console.log("END");
}

search();
