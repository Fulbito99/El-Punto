import {
    collection,
    query,
    where,
    onSnapshot,
    getDocs,
    deleteDoc,
    doc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Transfer } from '../../types';

const TRANSFERS_COL = 'transfers';
const EL_PUNTO_LOCALE_ID = 'locale-1'; // ID de El Punto en Deposito

/**
 * Subscribe to incoming transfers for El Punto
 * Listens to all transfers where destinationLocaleId === 'locale-1'
 */
export const subscribeToIncomingTransfers = (
    callback: (transfers: Transfer[]) => void
) => {
    const q = query(
        collection(db, TRANSFERS_COL),
        where('destinationLocaleId', '==', EL_PUNTO_LOCALE_ID)
    );

    return onSnapshot(q, (snapshot) => {
        const transfers = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Transfer));
        callback(transfers);
    });
};

/**
 * Get all transfers for El Punto (for initial load or history)
 */
export const getIncomingTransfers = async (): Promise<Transfer[]> => {
    const q = query(
        collection(db, TRANSFERS_COL),
        where('destinationLocaleId', '==', EL_PUNTO_LOCALE_ID)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as Transfer));
};

/**
 * Delete entries linked to a specific transfer
 * Used when a transfer is deleted in Deposito
 */
export const deleteEntriesByTransferId = async (transferId: string) => {
    const entriesCol = collection(db, 'entries');
    const q = query(entriesCol, where('transferId', '==', transferId));

    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
};
