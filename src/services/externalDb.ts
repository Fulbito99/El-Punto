import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    limit,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    or
} from "firebase/firestore";

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

export interface ExternalTransfer {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    date: string; // "D/M/YYYY, HH:mm:ss"
    destinationLocaleId: string;
    sourceLocaleId: string;
}

// Helper to parse date string "DD/MM/YYYY, HH:mm:ss"
function parseDateStr(dateStr: string): number {
    if (!dateStr) return 0;
    try {
        const [dStr, tStr] = dateStr.split(', ');
        const [day, month, year] = dStr.split('/').map(Number);
        const [hours, minutes, seconds] = tStr ? tStr.split(':').map(Number) : [0, 0, 0];
        return new Date(year, month - 1, day, hours, minutes, seconds).getTime();
    } catch (e) {
        return 0;
    }
}

/**
 * Subscribes to transfers for a specific locale (both incoming and outgoing).
 */
export const subscribeIncomingTransfers = (
    localeId: string,
    callback: (transfers: ExternalTransfer[]) => void
) => {
    try {
        const transfersRef = collection(externalDb, "transfers");

        // Removed orderBy timestamp because some transfers (e.g. from La Central) lack this field
        const q = query(
            transfersRef,
            or(
                where("destinationLocaleId", "==", localeId),
                where("sourceLocaleId", "==", localeId)
            ),
            limit(500)
        );

        return onSnapshot(q, (snapshot) => {
            const formatDate = (date: Date) => {
                const d = String(date.getDate()).padStart(2, '0');
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const y = date.getFullYear();
                return `${d}/${m}/${y}`;
            };

            const todayPrefix = formatDate(new Date());
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayPrefix = formatDate(yesterday);

            const transfers = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as ExternalTransfer))
                .filter(t => t.date && (t.date.startsWith(todayPrefix) || t.date.startsWith(yesterdayPrefix)))
                .sort((a, b) => parseDateStr(b.date) - parseDateStr(a.date));

            callback(transfers);
        }, (error) => {
            console.error("Error subscribing to transfers:", error);
        });
    } catch (e) {
        console.error("Setup transfer subscription failed", e);
        return () => { };
    }
};

export interface ExternalProduct {
    id: string;
    sku: string;
    additionalSkus: string[];
    name: string;
}

/**
 * Fetches details for a list of product IDs from the external database.
 */
export const fetchExternalProducts = async (productIds: string[]): Promise<ExternalProduct[]> => {
    if (productIds.length === 0) return [];
    const cachedData = localStorage.getItem('cache_external_prods');
    const cache: Record<string, ExternalProduct> = cachedData ? JSON.parse(cachedData) : {};
    const missingIds = productIds.filter(id => !cache[id]);
    if (missingIds.length === 0) {
        return productIds.map(id => cache[id]);
    }
    try {
        const uniqueMissing = Array.from(new Set(missingIds));
        const promises = uniqueMissing.map(id => getDoc(doc(externalDb, 'products', id)));
        const snapshots = await Promise.all(promises);
        snapshots.forEach(snap => {
            if (snap.exists()) {
                const data = snap.data();
                const prod = {
                    id: snap.id,
                    sku: data.sku,
                    additionalSkus: data.additionalSkus || [],
                    name: data.name
                } as ExternalProduct;
                cache[snap.id] = prod;
            }
        });
        localStorage.setItem('cache_external_prods', JSON.stringify(cache));
        return productIds.map(id => cache[id] || ({ id, name: 'Desconocido', sku: '', additionalSkus: [] } as ExternalProduct));
    } catch (error) {
        console.error("Error fetching external products:", error);
        return [];
    }
};

/**
 * Fetches transfers for a specific locale and date string.
 */
export const getTransfersForDate = async (localeId: string, dateString: string): Promise<ExternalTransfer[]> => {
    try {
        const transfersRef = collection(externalDb, "transfers");
        // Removed orderBy timestamp to ensure we get transfers that miss this field
        const qIncoming = query(transfersRef, where("destinationLocaleId", "==", localeId), limit(500));
        const qOutgoing = query(transfersRef, where("sourceLocaleId", "==", localeId), limit(500));

        const [snapIn, snapOut] = await Promise.all([getDocs(qIncoming), getDocs(qOutgoing)]);
        const snapshot = [...snapIn.docs, ...snapOut.docs];

        const results: ExternalTransfer[] = [];
        const [y, m, d] = dateString.split('-').map(Number);
        const seenIds = new Set(); // Dedup because same transfer logic? (shouldn't overlap incoming/outgoing unless self-transfer)

        snapshot.forEach(doc => {
            if (seenIds.has(doc.id)) return;
            seenIds.add(doc.id);
            const data = doc.data() as ExternalTransfer;
            const tDate = data.date;
            if (!tDate) return;

            // Handle date format "DD/MM/YYYY, HH:mm:ss"
            const [datePart] = tDate.split(',');
            const [tDay, tMonth, tYear] = datePart.split('/').map(Number);

            if (tDay === d && tMonth === m && tYear === y) {
                results.push({ ...data, id: doc.id });
            }
        });

        // Sort results by date desc
        return results.sort((a, b) => parseDateStr(b.date) - parseDateStr(a.date));
    } catch (error) {
        console.error("Error getting transfers for date:", error);
        return [];
    }
};
