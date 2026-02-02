
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query } from "firebase/firestore";
import fs from 'fs';

const firebaseConfig = {
    apiKey: "AIzaSyBFvtmsk4HiPENA3wRdj6rIQ4DQ_5_j2WA",
    authDomain: "la-central-cocina.firebaseapp.com",
    projectId: "la-central-cocina",
    storageBucket: "la-central-cocina.firebasestorage.app",
    messagingSenderId: "327437950800",
    appId: "1:327437950800:web:dcb5af95d57acee0075655"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function dumpProducts() {
    console.log("Dumping local products...");
    const productsRef = collection(db, "products");
    const snapshot = await getDocs(productsRef);
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    fs.writeFileSync('local_products.json', JSON.stringify(products, null, 2));
    console.log(`Wrote ${products.length} products to local_products.json`);
}

dumpProducts();
