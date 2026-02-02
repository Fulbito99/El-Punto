
import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, limit, doc, getDoc } from "firebase/firestore";

// Configuration for the external database (Deposito Inventory)
const externalFirebaseConfig = {
    apiKey: "AIzaSyCKXfqtER1968lTf-t4-PWxDWGmb--dXEA",
    authDomain: "deposito-inventory-f7a1b.firebaseapp.com",
    projectId: "deposito-inventory-f7a1b",
    storageBucket: "deposito-inventory-f7a1b.firebasestorage.app",
    messagingSenderId: "221074983931",
    appId: "1:221074983931:web:febc0346ec1d7dc9bed95e"
};

// Initialize the secondary app safely
let externalApp: FirebaseApp;
const appName = "externalInventoryApp";

if (getApps().some(app => app.name === appName)) {
    externalApp = getApp(appName);
} else {
    externalApp = initializeApp(externalFirebaseConfig, appName);
}

const externalDb = getFirestore(externalApp);

/**
 * Searches for a product in the external database by its SKU (barcode).
 * Returns the product name if found, otherwise null.
 */
export const findProductInExternalDb = async (barcode: string): Promise<string | null> => {
    try {
        const productsRef = collection(externalDb, "products");

        // 1. Try searching by main SKU
        const qSku = query(productsRef, where("sku", "==", barcode), limit(1));
        const snapshotSku = await getDocs(qSku);

        if (!snapshotSku.empty) {
            return snapshotSku.docs[0].data().name || null;
        }

        // 2. If not found, try searching in 'additionalSkus' array
        const qBarcodes = query(productsRef, where("additionalSkus", "array-contains", barcode), limit(1));
        const snapshotBarcodes = await getDocs(qBarcodes);

        if (!snapshotBarcodes.empty) {
            return snapshotBarcodes.docs[0].data().name || null;
        }

        return null;
    } catch (error) {
        console.error("Error searching in external DB:", error);
        return null;
    }
};
// ... (existing code)

export interface ExternalTransfer {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    date: string; // "D/M/YYYY, HH:mm:ss"
    destinationLocaleId: string;
    sourceLocaleId: string;
    // Add other fields if necessary
}

import { onSnapshot, orderBy } from "firebase/firestore";

/**
 * Subscribes to incoming transfers for a specific locale.
 * Filters for transfers where destinationLocaleId matches.
 * Note: Ideally, we should filter by date too, but for now we'll fetch recent.
 */
export const subscribeIncomingTransfers = (
    localeId: string,
    callback: (transfers: ExternalTransfer[]) => void
) => {
    try {
        const transfersRef = collection(externalDb, "transfers");

        // Use a simple query without sorting to avoid index/format issues.
        // We catch strict recently items by a reasonably high limit.
        const q = query(
            transfersRef,
            where("destinationLocaleId", "==", localeId),
            limit(500)
        );

        return onSnapshot(q, (snapshot) => {
            const transfers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ExternalTransfer[];

            // Client-side sort (Newest first)
            transfers.sort((a, b) => {
                try {
                    const parse = (d: string) => {
                        if (!d) return 0;
                        const [datePart] = d.split(',');
                        const [day, month, year] = datePart.split('/').map(Number);
                        return new Date(year, month - 1, day).getTime();
                    }
                    return parse(b.date) - parse(a.date);
                } catch (e) {
                    return 0;
                }
            });

            callback(transfers);
        }, (error) => {
            console.error("Error subscribing to transfers:", error);
        });
    } catch (e) {
        console.error("Setup transfer subscription failed", e);
        return () => { };
    }
};

/**
 * Fetches details for a list of product IDs from the external database.
 * Used to get SKUs for matching.
 */
export const fetchExternalProducts = async (productIds: string[]) => {
    if (!productIds.length) return [];

    // Firestore 'in' query is limited to 10. We'll fetch individually in parallel for simplicity 
    // and because we don't expect huge numbers in this view (last 50 transfers, maybe 20 unique products).
    // Or we could chunk it. Let's do individual processing which is robust.

    try {
        const uniqueIds = Array.from(new Set(productIds));
        const promises = uniqueIds.map(id => getDoc(doc(externalDb, 'products', id)));
        const snapshots = await Promise.all(promises);

        return snapshots.map(snap => {
            if (!snap.exists()) return null;
            const data = snap.data();
            return {
                id: snap.id,
                sku: data.sku,
                additionalSkus: data.additionalSkus || [],
                name: data.name
            };
        }).filter(p => p !== null);
    } catch (error) {
        console.error("Error fetching external products:", error);
        return [];
    }
};

/**
 * Fetches transfers for a specific locale and date string.
 * Since specific index might not exist for exact string match on 'date',
 * we fetch recent ones and filter in client (safer and no index needed).
 */
export const getTransfersForDate = async (localeId: string, dateString: string): Promise<ExternalTransfer[]> => {
    try {
        const transfersRef = collection(externalDb, "transfers");
        // Limit to 200 should cover a few days easily
        const q = query(
            transfersRef,
            where("destinationLocaleId", "==", localeId),
            limit(500)
        );

        const snapshot = await getDocs(q);
        const results: ExternalTransfer[] = [];

        // Target format from user input usually "YYYY-MM-DD" or similar, 
        // but transfer.date is "DD/MM/YYYY, HH:mm:ss"
        // We need to parse dateString (which is likely YYYY-MM-DD from app state)
        // and match against transfer.date

        const [y, m, d] = dateString.split('-').map(Number); // 2026, 1, 31

        snapshot.forEach(doc => {
            const data = doc.data() as ExternalTransfer;
            const tDate = data.date; // "31/01/2026, ..."
            if (!tDate) return;

            const [datePart] = tDate.split(',');
            const [tDay, tMonth, tYear] = datePart.split('/').map(Number);

            if (tDay === d && tMonth === m && tYear === y) {
                results.push({ ...data, id: doc.id });
            }
        });

        return results;
    } catch (error) {
        console.error("Error getting transfers for date:", error);
        return [];
    }
};
