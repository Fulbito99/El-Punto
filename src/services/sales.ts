
import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    onSnapshot,
    doc,
    setDoc,
    deleteDoc,
    updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Sale, SalesImport, Category } from '@/types';
import { SALES_CATEGORIES } from '../../constants';

const SALES_COL = 'sales';
const IMPORTS_COL = 'sales_imports';

// Parse CSV text (supports standard CSV or custom "Name Quantity Amount Percentage" format)
export const parseCSV = (csvText: string): { name: string; quantity: number; amount: number }[] => {
    const lines = csvText.trim().split('\n');
    const items: { name: string; quantity: number; amount: number }[] = [];

    // Header keywords to skip
    const headerKeywords = ['articulos', 'cantidad', 'importe', 'porcentaje', 'producto', 'nombre', 'precio'];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Skip header row if detected
        if (headerKeywords.some(k => line.toLowerCase().includes(k))) continue;

        let name = '';
        let quantity = 0;
        let amount = 0;
        let parsed = false;

        // Strategy 1: Tab separation (Excel copy-paste default)
        if (line.includes('\t')) {
            const parts = line.split('\t');
            if (parts.length >= 2) {
                const pName = parts[0].trim();
                const pQtyStr = parts[1].trim();
                const cleanQty = pQtyStr.replace(/[^\d.,]/g, '').replace(',', '.');
                const pQty = parseFloat(cleanQty);

                if (pName && !isNaN(pQty)) {
                    if (parts.length >= 3) {
                        const pAmountStr = parts[2].trim();
                        // Remove $ and . (thousands), replace , with .
                        const cleanAmount = pAmountStr.replace(/[$]/g, '').replace(/\./g, '').replace(',', '.').trim();
                        const parsedAmount = parseFloat(cleanAmount);
                        if (!isNaN(parsedAmount)) amount = parsedAmount;
                    }
                    items.push({ name: pName, quantity: pQty, amount });
                    parsed = true;
                    continue;
                }
            }
        }

        // Strategy 1.5: Semicolon separation (Common in Spanish CSV)
        if (!parsed && line.includes(';')) {
            const parts = line.split(';');
            // Basic check: Name;Qty[;Amount]
            if (parts.length >= 2) {
                const pName = parts[0].trim();
                const pQtyStr = parts[1].trim();
                // Check if 2nd part looks like a number
                const cleanQty = pQtyStr.replace(',', '.'); // Simple replace for CSV
                const pQty = parseFloat(cleanQty);

                if (pName && !isNaN(pQty)) {
                    if (parts.length >= 3) {
                        const pAmountStr = parts[2].trim();
                        const cleanAmount = pAmountStr.replace(/[$.]/g, '').replace(',', '.').trim();
                        const parsedAmount = parseFloat(cleanAmount);
                        if (!isNaN(parsedAmount)) amount = parsedAmount;
                    }
                    items.push({ name: pName, quantity: pQty, amount });
                    parsed = true;
                    continue;
                }
            }
        }

        // Strategy 2: Regex for space aligned columns with AMOUNT
        // CHANGED: ^(.+?) to ^(.+) (Greedy) to swallow "600" in "Product 600" if followed by valid Qty/Amt
        if (!parsed) {
            const regex = /^(.+)\s+(\d+(?:[.,]\d+)?)\s+((?:\$|USD)?\s?[\d.,]+).*$/i;
            const match = line.match(regex);
            if (match) {
                name = match[1].trim();
                const qtyStr = match[2].replace(',', '.');
                quantity = parseFloat(qtyStr);

                const amountStr = match[3].replace(/[$.]/g, '').replace(',', '.').trim();
                let parsedAmount = parseFloat(amountStr);
                if (!isNaN(parsedAmount)) amount = parsedAmount;

                items.push({ name, quantity, amount });
                parsed = true;
                continue;
            }
        }

        // Fallback: Default simple split by comma if mostly CSV-like
        // Only if NO tabs or semicolons were found/handled, and it has commas
        if (!parsed && line.includes(',')) {
            const parts = line.split(',');
            const lastPart = parts.pop() || '';
            const qtyFn = parseFloat(lastPart.trim());
            if (!isNaN(qtyFn)) {
                name = parts.join(',').trim();
                quantity = qtyFn;
                parsed = true;
                items.push({ name, quantity, amount: 0 });
            }
        }

        // Strategy 3: Loose "Name Only" or "Name String" (Default Qty = 1)
        // If the user says "I don't want to export quantity", we might get lines with just Name
        // or "Name Category".
        if (!parsed && line.length > 2) {
            // Try to see if there is a number at the END that implies quantity?
            // No, the user specifically said "no quiero que tambien exporte la cantidad".
            // So we should just take the string as Name.

            // However, we should be careful about header rows that weren't caught.
            // (Header keywords are handled above).

            // If the line has Tabs/Commas/Semicolons but we failed to find a valid Quantity number in the expected slot,
            // we might want to just take the first column as Name.

            let potentialName = line;

            if (line.includes('\t')) {
                potentialName = line.split('\t')[0];
            } else if (line.includes(';')) {
                potentialName = line.split(';')[0];
            } else if (line.includes(',')) {
                // Be careful with commas in names? 
                // If we are here, Strategy 2 (Fallback Comma) failed to find a number at the end.
                // So maybe it's "Name, Category"?
                potentialName = line.split(',')[0];
            }

            // Cleanup
            potentialName = potentialName.trim();

            if (potentialName.length > 1) { // Avoid single char noise
                items.push({ name: potentialName, quantity: 1, amount: 0 });
                parsed = true;
            }
        }
    }

    return items;
};

// Normalize string for comparison (remove accents, lowercase, trim)
const normalizeString = (str: string): string => {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
};

// Update sale quantity
export const updateSale = async (id: string, updates: Partial<Sale>) => {
    const docRef = doc(db, SALES_COL, id);
    await updateDoc(docRef, updates);
};

// Delete a sale
export const deleteSale = async (id: string) => {
    await deleteDoc(doc(db, SALES_COL, id));
};

// Delete all sales for a date
export const clearSalesForDate = async (date: string) => {
    const sales = await getSalesForDate(date);
    const promises = sales.map(s => deleteDoc(doc(db, SALES_COL, s.id)));
    await Promise.all(promises);
};

// ALIAS MAPPING
const PRODUCT_ALIASES: Record<string, string> = {
    'licuado vaso arandano': 'pulpa arandanos',
    'licuado litro arandano': 'pulpa arandanos',
    'licuado vaso anana': 'pulpa anana',
    'licuado litro anana': 'pulpa anana',
    'licuado vaso frutilla': 'pulpa frutillas',
    'licuado litro frutilla': 'pulpa frutillas',
    'licuado vaso maracuya': 'pulpa maracuya',
    'licuado litro maracuya': 'pulpa maracuya',
    'licuado vaso banana': 'banana fruta', // Assuming 'Banana Fruta' is the inventory item for Bananas? Or maybe it is not tracked? 
    // Wait, I saw 'Banana Fruta' in the sales list, line 23: "Banana Fruta 2.00".
    // I did NOT see 'Banana' or 'Banana Fruta' in constants.ts. 
    // If it's not in constants, it won't be tracked anyway unless user adds it.
    // I will add the alias just in case they add the product later or if it exists in DB but not initial list.
    'licuado vaso durazno': 'pulpa durazno',
    'licuado litro durazno': 'pulpa durazno',
};

// Import sales from CSV with automatic product matching and UPSERT logic
export const importSales = async (
    csvText: string,
    date: string,
    products: { id: string; name: string; categoryId: string; inventoryType?: 'cocina' | 'local' }[],
    categories: Category[]
): Promise<{ success: boolean; unmapped: string[]; imported: number }> => {
    const rawItems = parseCSV(csvText);
    const unmapped: string[] = [];

    // 0. Pre-process items: Apply Aliases and Aggregate
    const aggregatedItems = new Map<string, { qty: number; amount: number }>(); // NormalizedName -> {qty, amount}

    for (const item of rawItems) {
        let name = normalizeString(item.name);

        // Apply Alias
        if (PRODUCT_ALIASES[name]) {
            name = normalizeString(PRODUCT_ALIASES[name]);
        }

        const current = aggregatedItems.get(name) || { qty: 0, amount: 0 };
        aggregatedItems.set(name, {
            qty: current.qty + item.quantity,
            amount: current.amount + (item.amount || 0)
        });
    }

    // 1. Fetch existing sales for this date to prevent duplicates
    const existingSales = await getSalesForDate(date);
    const salesMap = new Map<string, Sale>();
    existingSales.forEach(s => salesMap.set(s.productId, s));

    let importedCount = 0;

    // Create or find import record
    const importDoc = await addDoc(collection(db, IMPORTS_COL), {
        date,
        timestamp: new Date().toLocaleString('en-US', {
            timeZone: 'America/Argentina/Buenos_Aires'
        }),
        totalItems: rawItems.length,
        unmappedItems: []
    });

    const importId = importDoc.id;

    // 2. Process aggregated items
    for (const [normalizedItemName, data] of aggregatedItems.entries()) {
        const { qty: quantity, amount } = data;
        // Try to find exact match first
        let matchedProduct = products.find(p =>
            normalizeString(p.name) === normalizedItemName
        );

        // If no exact match, try partial match strategies
        if (!matchedProduct) {
            matchedProduct = products.find(p => {
                const normalizedProductName = normalizeString(p.name);

                // Strategy 1: Simple substring matching (most permissive)
                if (normalizedProductName.includes(normalizedItemName) || normalizedItemName.includes(normalizedProductName)) {
                    return true;
                }

                // Strategy 2: Word boundary matching for more precise matches
                const escapeRegExp = (string: string) => {
                    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                };

                const regexItem = new RegExp(`\\b${escapeRegExp(normalizedItemName)}\\b`, 'i');
                const regexProd = new RegExp(`\\b${escapeRegExp(normalizedProductName)}\\b`, 'i');

                return regexItem.test(normalizedProductName) || regexProd.test(normalizedItemName);
            });
        }

        if (matchedProduct) {
            // Check if product belongs to allowed category OR is a local inventory product
            const productCategory = categories.find(c => c.id === matchedProduct?.categoryId);

            // Allow if: 1) Product is in local inventory, OR 2) Category is in SALES_CATEGORIES
            const isLocalProduct = matchedProduct.inventoryType === 'local';
            const isAllowedCategory = productCategory && SALES_CATEGORIES.includes(productCategory.name.toUpperCase());

            if (!isLocalProduct && !isAllowedCategory) {
                continue;
            }

            // Check if sale already exists for this product and date (check updated map)
            const existingSale = salesMap.get(matchedProduct.id);

            if (existingSale) {
                // UPDATE existing record
                const newQuantity = existingSale.quantity + quantity;
                const newAmount = (existingSale.amount || 0) + amount;
                await updateSale(existingSale.id, {
                    quantity: newQuantity, // Accumulate
                    amount: newAmount,
                    importId
                });
                // Update in-memory map so next iteration knows about the new total
                salesMap.set(matchedProduct.id, { ...existingSale, quantity: newQuantity, amount: newAmount });
            } else {
                // CREATE new record
                const newSaleRef = await addDoc(collection(db, SALES_COL), {
                    productId: matchedProduct.id,
                    productName: matchedProduct.name,
                    quantity: quantity,
                    amount: amount,
                    date,
                    importId
                });

                // Add to map for subsequent matches in this same loop
                salesMap.set(matchedProduct.id, {
                    id: newSaleRef.id,
                    productId: matchedProduct.id,
                    productName: matchedProduct.name,
                    quantity: quantity,
                    amount: amount,
                    date,
                    importId
                } as Sale);
            }
            importedCount++;
        } else {
            // For unmapped, we revert to original names? 
            // We only have normalized aliases here. 
            // It's acceptable to report the normalized name that failed.
            unmapped.push(normalizedItemName);
        }
    }

    // Update import with unmapped items
    await setDoc(doc(db, IMPORTS_COL, importId), {
        unmappedItems: unmapped
    }, { merge: true });

    return {
        success: true,
        unmapped,
        imported: importedCount
    };
};

// Get sales for a specific date
export const getSalesForDate = async (date: string): Promise<Sale[]> => {
    const q = query(collection(db, SALES_COL), where('date', '==', date));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
};

// Subscribe to sales (simple version)
export const subscribeSales = (callback: (data: Sale[]) => void) => {
    const q = query(collection(db, SALES_COL));
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
        callback(data);
    });
};

// Get sales for a product on a specific date
export const getSalesForProduct = async (productId: string, date: string): Promise<number> => {
    const q = query(
        collection(db, SALES_COL),
        where('productId', '==', productId),
        where('date', '==', date)
    );
    const snapshot = await getDocs(q);

    let total = 0;
    snapshot.docs.forEach(doc => {
        const sale = doc.data() as Sale;
        total += sale.quantity;
    });

    return total;
};
