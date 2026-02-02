
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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

async function checkProducts() {
    try {
        console.log("Checking local products...");
        const snap = await getDocs(collection(db, "products"));

        const targetProducts = ["cofler", "mentitas", "marroc"];

        snap.forEach(doc => {
            const data = doc.data();
            const pName = (data.name || "").toLowerCase();

            if (targetProducts.some(t => pName.includes(t))) {
                console.log(`LOCAL PRODUCT MATCH: ${data.name}`);
                console.log(`ID: ${doc.id}`);
                console.log(`Data:`, JSON.stringify(data));
                console.log("-------------------");
            }
        });
        console.log("Done.");
    } catch (e) {
        console.error("Error:", e);
    }
}

checkProducts();
