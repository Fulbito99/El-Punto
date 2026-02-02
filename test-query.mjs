
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, limit } from "firebase/firestore";

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

async function search(barcode) {
    console.log(`Searching for ${barcode}...`);
    const productsRef = collection(db, "products");

    // 1. Search SKU
    const qSku = query(productsRef, where("sku", "==", barcode));
    const snapSku = await getDocs(qSku);

    if (!snapSku.empty) {
        snapSku.forEach(doc => {
            console.log("Found by SKU:", doc.data());
        });
        return;
    } else {
        console.log("Not found by SKU.");
    }

    // 2. Search Barcodes
    const qBarcodes = query(productsRef, where("barcodes", "array-contains", barcode));
    const snapBarcodes = await getDocs(qBarcodes);

    if (!snapBarcodes.empty) {
        snapBarcodes.forEach(doc => {
            console.log("Found by Barcodes Array:", doc.data());
        });
        return;
    } else {
        console.log("Not found by Barcodes Array.");
    }
}

search("7798085681605");
