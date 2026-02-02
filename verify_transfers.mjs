
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query, orderBy, doc, getDoc } from "firebase/firestore";

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

async function inspectTransfers() {
    console.log(`Inspecting latest transfers...`);
    const transfersRef = collection(db, "transfers");

    // Fetch last 500 transfers
    const q = query(transfersRef, orderBy("date", "desc"), limit(500));
    const snap = await getDocs(q);

    const targetKeywords = ["27", "cofler air", "aireado"];
    const foundTransfers = [];

    if (!snap.empty) {
        console.log(`Scanned ${snap.size} transfers.`);

        for (const d of snap.docs) {
            const data = d.data();
            const pName = (data.productName || "").toLowerCase();

            if (targetKeywords.some(t => pName.includes(t))) {
                // Fetch product details for SKU
                let sku = "UNKNOWN";
                let additionalSkus = [];
                try {
                    const prodDoc = await getDoc(doc(db, "products", data.productId));
                    if (prodDoc.exists()) {
                        const pData = prodDoc.data();
                        sku = pData.sku;
                        additionalSkus = pData.additionalSkus || [];
                    }
                } catch (e) {
                    console.error(`Error fetching product ${data.productId}:`, e.message);
                }

                foundTransfers.push({
                    transferId: d.id,
                    ...data,
                    sku,
                    additionalSkus
                });
            }
        }

        const fs = await import('fs');
        fs.writeFileSync('transfers_dump.json', JSON.stringify(foundTransfers, null, 2));
        console.log(`Wrote ${foundTransfers.length} matches to transfers_dump.json`);
    } else {
        console.log("No transfers found.");
    }
}

inspectTransfers();
