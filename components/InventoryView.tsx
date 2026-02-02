import React, { useMemo, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Category, Product, DailyEntry, Sale } from '../types';
import { Package, CheckCircle, Save, Info, TrendingDown, Plus, Box, Search, ScanBarcode, X, Edit, History } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { getSalesForDate } from '../src/services/sales';
import { getYesterday, getCurrentDateAR } from '../src/utils/dates';
import { SALES_CATEGORIES } from '../constants';
import { motion } from 'framer-motion';

import { updateEntryService, subscribeEntries } from '../src/services/inventory';
import { findProductInExternalDb, subscribeIncomingTransfers, ExternalTransfer, fetchExternalProducts, getTransfersForDate } from '../src/services/externalDb';

// Componente de input que maneja el estado localmente y guarda con debounce
// REMOVED DEBOUNCED INPUT

export interface InventoryHandle {
  saveChanges: () => Promise<void>;
  hasUnsavedChanges: () => boolean;
}

interface Props {
  categories: Category[];
  products: Product[];
  entries: DailyEntry[];
  currentDate: string;
  selectedCategoryId: string;
  onCategoryChange: (id: string) => void;
  onUpdateEntry: (pId: string, d: string, updates: { stock?: number; ingreso?: number }) => Promise<void>;
  onFinalizeCategory: (catId: string, date: string) => Promise<void>;
  onFinalizeGlobal?: (type: 'cocina' | 'local', ignoredProductIds?: string[]) => Promise<void>; // Make optional to avoid breaking if parent not updated immediately, but logic will assume it exists
  onReopenCategory: (catId: string, date: string) => void;
  isAdmin: boolean;
  inventoryType?: 'cocina' | 'local';
}

const InventoryView = forwardRef<InventoryHandle, Props>(({
  categories, products, entries, currentDate, selectedCategoryId, onCategoryChange, onUpdateEntry, onFinalizeCategory, onFinalizeGlobal, onReopenCategory, isAdmin, inventoryType
}, ref) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [tappedCat, setTappedCat] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<('cocina' | 'local')[]>(['cocina']); // Default to cocina
  const [searchTerm, setSearchTerm] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [recentTransfers, setRecentTransfers] = useState<ExternalTransfer[]>([]);
  const [externalProductDetails, setExternalProductDetails] = useState<Record<string, { sku?: string; additionalSkus?: string[] }>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Local state for unsaved changes
  const [unsavedChanges, setUnsavedChanges] = useState<Record<string, { stock?: number; ingreso?: number }>>({});

  useImperativeHandle(ref, () => ({
    saveChanges: async () => {
      await handleSaveChanges();
    },
    hasUnsavedChanges: () => Object.keys(unsavedChanges).length > 0
  }));

  // Clear unsaved changes ONLY when DATE changes, NOT when category changes.
  useEffect(() => {
    setUnsavedChanges({});
  }, [currentDate]);

  // Refs to access latest state inside subscriptions without re-subscribing
  const productsRef = React.useRef(products);
  const entriesRef = React.useRef(entries);

  React.useEffect(() => {
    productsRef.current = products;
  }, [products]);

  React.useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  // Categories that should show sales (Only if admin)
  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const showSales = isAdmin && inventoryType === 'local';

  useEffect(() => {
    const fetchSales = async () => {
      const salesData = await getSalesForDate(currentDate);
      setSales(salesData);
    };
    fetchSales();
  }, [currentDate]);

  // Clear search when category changes
  useEffect(() => {
    setSearchTerm('');
  }, [selectedCategoryId]);

  // Scanner Effect
  useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner(
        "reader-inventory",
        {
          fps: 10,
          qrbox: 250,
          videoConstraints: {
            facingMode: "environment"
          }
        },
        /* verbose= */ false
      );

      scanner.render(
        async (decodedText) => {
          setShowScanner(false);
          await scanner.clear();

          // Check if barcode exists locally
          const hasLocal = products.some(p =>
            (p.barcodes?.some(b => b === decodedText))
          );

          if (hasLocal) {
            setSearchTerm(decodedText);
          } else {
            // If not found locally, try external DB to find name
            setSearchTerm(decodedText); // Show barcode tentatively
            try {
              const externalName = await findProductInExternalDb(decodedText);
              if (externalName) {
                setSearchTerm(externalName);
              }
            } catch (e) {
              console.error(e);
            }
          }
        },
        (errorMessage) => {
          // parse error, ignore usually
        }
      );

      return () => {
        scanner.clear().catch(console.error);
      };
    }
  }, [showScanner]);

  // Incoming Transfers Effect
  useEffect(() => {
    // Defines "La Central: Guardia" as target
    const MY_LOCALE_ID = 'locale-1';

    // Helper to check if transfer is from today
    const isToday = (dateStr: string) => {
      if (!dateStr) return false;
      // Format "D/M/YYYY, HH:mm:ss"
      const [datePart] = dateStr.split(',');
      const [day, month, year] = datePart.split('/');

      const todayAr = getCurrentDateAR();
      const [y, m, d] = todayAr.split('-').map(Number);

      return parseInt(day) === d &&
        parseInt(month) === m &&
        parseInt(year) === y;
    };

    const unsubscribe = subscribeIncomingTransfers(MY_LOCALE_ID, async (transfers) => {
      const todayDate = getCurrentDateAR();

      // Store ALL transfers for history view
      setRecentTransfers(transfers);

      // Fetch external details for SKU matching
      const transferProductIds = transfers.map(t => t.productId);
      const details = await fetchExternalProducts(transferProductIds);

      const detailsMap: Record<string, any> = {};
      details.forEach(d => {
        if (d) detailsMap[d.id] = d;
      });
      setExternalProductDetails(prev => ({ ...prev, ...detailsMap }));

      const todayTransfers = transfers.filter(t => isToday(t.date));
      // Run Reconcile for Today
      await runReconciliation(todayTransfers, productsRef.current, entriesRef.current, todayDate, detailsMap);
    });

    return () => unsubscribe();
  }, []); // Empty dependency array - we use refs!

  // REUSABLE RECONCILIATION LOGIC
  const runReconciliation = async (
    transfers: ExternalTransfer[],
    currentProducts: Product[],
    currentEntries: DailyEntry[],
    targetDate: string,
    externalDetails: Record<string, any>
  ) => {
    // Map transfers to local products by name OR SKU
    // Key: productId (Local), Value: List of relevant transfers
    const transfersByLocalId = new Map<string, ExternalTransfer[]>();
    const processedProductIds = new Set<string>();

    // 1. Group incoming transfers by matching Local Product ID
    transfers.forEach(t => {
      const extDetail = externalDetails[t.productId];

      // A. Match by Name (Normalized)
      const normalize = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const targetName = normalize(t.productName);

      let localProd = currentProducts.find(p => normalize(p.name) === targetName);

      // A2. Try fuzzy match (Includes) - Handles "Galletita" vs "Galletitas"
      if (!localProd && targetName.length > 5) {
        localProd = currentProducts.find(p => {
          const n = normalize(p.name);
          return (n.includes(targetName) || targetName.includes(n)) && n.length > 5;
        });
      }

      // B. Match by SKU (Using External Details)
      if (!localProd && extDetail) {
        localProd = currentProducts.find(p => {
          if (!p.barcodes || p.barcodes.length === 0) return false;
          const matchMain = extDetail.sku && p.barcodes.includes(extDetail.sku);
          const matchAdd = extDetail.additionalSkus && extDetail.additionalSkus.some((sku: string) => p.barcodes?.includes(sku));
          return matchMain || matchAdd;
        });
      }

      // C. Match by ID as Barcode (Direct fallback)
      if (!localProd) {
        localProd = currentProducts.find(p => p.barcodes && p.barcodes.includes(t.productId));
      }

      if (localProd) {
        const list = transfersByLocalId.get(localProd.id) || [];
        list.push(t);
        transfersByLocalId.set(localProd.id, list);
        processedProductIds.add(localProd.id);
      }
    });

    // 2. Identify products that had transfers processed previously but might have them deleted now
    currentEntries.forEach(entry => {
      // Only care about target date
      if (entry.date !== targetDate) return;
      // Only care if they have processed data
      if (!entry.processedTransferData || Object.keys(entry.processedTransferData).length === 0) return;

      // Add to set of products to check
      processedProductIds.add(entry.productId);
    });

    // 3. Process each affected product
    const promises: Promise<void>[] = [];

    processedProductIds.forEach(productId => {
      const incomingTransfers = transfersByLocalId.get(productId) || [];
      const entry = currentEntries.find(e => e.productId === productId && e.date === targetDate);

      const currentProcessedData = entry?.processedTransferData || {};
      const newProcessedData = { ...currentProcessedData };
      let netIngresoDiff = 0;
      let changed = false;

      const incomingIds = new Set(incomingTransfers.map(t => t.id));



      // A. Handle Adds and Updates (incoming -> local)
      incomingTransfers.forEach(t => {
        const prevQty = currentProcessedData[t.id] || 0;
        // User Requirement: Treat negative quantities (source deduction) as positive (ingress)
        const trueQty = Math.abs(t.quantity);

        if (prevQty !== trueQty) {
          netIngresoDiff += (trueQty - prevQty);
          newProcessedData[t.id] = trueQty;
          changed = true;
        }
      });

      // B. Handle Deletions (local -> incoming)
      Object.keys(currentProcessedData).forEach(tId => {
        if (!incomingIds.has(tId)) {
          const prevQty = currentProcessedData[tId];
          netIngresoDiff -= prevQty;
          delete newProcessedData[tId];
          changed = true;
        }
      });

      // C. Commit changes if any OR if Ingreso is desynchronized (less than transfer sum)
      const transferSum = Object.values(newProcessedData).reduce((sum, q) => sum + (q as number), 0);
      const proposedIngreso = Math.max(0, (entry?.ingreso || 0) + netIngresoDiff);

      // Force update if calculated income is less than what transfers dictate (Audit fix)
      if (changed || proposedIngreso < transferSum) {

        let finalIngreso = proposedIngreso;
        if (proposedIngreso < transferSum) {
          console.warn(`Product ${productId} desync deteced: Income ${proposedIngreso} < TransferSum ${transferSum}. Auto-correcting.`);
          finalIngreso = transferSum;
        }

        const currentStock = entry?.stock || 0;
        const currentFinalized = entry?.finalized || false;

        const updatePromise = updateEntryService({
          productId: productId,
          date: targetDate,
          ingreso: finalIngreso,
          stock: currentStock,
          finalized: currentFinalized,
          processedTransferData: newProcessedData
        });



        promises.push(updatePromise);
      }
    });

    // Clear local overrides for any product involved in the sync
    setUnsavedChanges(prev => {
      const next = { ...prev };
      let modified = false;
      processedProductIds.forEach(pid => {
        if (next[pid] && next[pid].ingreso !== undefined) {
          // Only clear ingreso overrides if we just synced income
          delete next[pid].ingreso;
          // If object empty, remove key
          if (Object.keys(next[pid]).length === 0) delete next[pid];
          modified = true;
        }
      });
      return modified ? next : prev;
    });

    await Promise.all(promises);
  };

  // Auto-correct negative income values (Self-healing)
  useEffect(() => {
    entries.forEach(e => {
      if (e.date === currentDate && e.ingreso < 0) {
        console.log(`Auto-correcting negative income for product ${e.productId}: ${e.ingreso} -> 0`);
        updateEntryService({
          productId: e.productId,
          date: e.date,
          ingreso: 0
        }).catch(console.error);
      }
    });
  }, [entries, currentDate]);

  const filteredProducts = useMemo(() =>
    products.filter(p => {
      const matchesCategory = p.categoryId === selectedCategoryId;
      const term = searchTerm.toLowerCase();
      const matchesSearch = p.name.toLowerCase().includes(term) || (p.barcodes && p.barcodes.some(b => b.toLowerCase().includes(term)));
      return matchesCategory && matchesSearch;
    }),
    [products, selectedCategoryId, searchTerm]
  );

  const getYesterdayDate = (dateStr: string) => {
    return getYesterday(dateStr);
  };

  const categoryEntries = entries.filter(e =>
    filteredProducts.some(p => p.id === e.productId) && e.date === currentDate
  );

  const isFinalized = categoryEntries.length > 0 && categoryEntries.every(e => e.finalized);

  const rows = filteredProducts.map(p => {
    const today = entries.find(e => e.productId === p.id && e.date === currentDate) || { stock: 0, ingreso: 0, finalized: false };
    const yesterdayDate = getYesterdayDate(currentDate);
    const yesterday = entries.find(e => e.productId === p.id && e.date === yesterdayDate) || { stock: 0, ingreso: 0 };
    const hasYesterday = entries.some(e => e.productId === p.id && e.date === yesterdayDate);

    // Get sales for this product
    const productSales = sales.filter(s => s.productId === p.id);
    const totalSales = productSales.reduce((sum, s) => sum + s.quantity, 0);

    // Calculate expected values
    const proyectadoAyer = yesterday.stock + yesterday.ingreso;

    // Get local unsaved overrides
    const localChanges = unsavedChanges[p.id] || {};

    // Merge props with local state
    const displayStock = localChanges.stock !== undefined ? localChanges.stock : today.stock;
    const displayIngreso = localChanges.ingreso !== undefined ? localChanges.ingreso : today.ingreso;

    // Calculate projected today
    const proyectadoHoy = showSales
      ? displayStock + displayIngreso - totalSales
      : displayStock + displayIngreso;

    const difference = hasYesterday ? (displayStock - proyectadoAyer) : 0;

    return {
      product: p,
      stock: displayStock,
      ingreso: displayIngreso,
      ventas: totalSales,
      esperadoDeAyer: proyectadoAyer,
      diaSiguiente: proyectadoHoy,
      difference,
      hasYesterday,
      finalized: today.finalized,
      processedTransferData: today.processedTransferData || {}
    };
  });

  const handleLocalUpdate = (productId: string, field: 'stock' | 'ingreso', value: number) => {
    // Validation for Ingreso: Cannot go below sum of transfers
    if (field === 'ingreso') {
      const row = rows.find(r => r.product.id === productId);
      if (row) {
        const transferSum = Object.values(row.processedTransferData).reduce((sum, qty) => (sum as number) + (qty as number), 0) as number;
        if (value < transferSum) {
          // If user tries to set below transfer sum, clamp to transfer sum (or ignore)
          // We'll clamp it so they see the limit
          value = transferSum;
        }
      }
    }

    setUnsavedChanges(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value
      }
    }));
  };

  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  const executeSave = async () => {
    setIsSaving(true);
    try {
      // 1. Commit all unsaved changes
      const promises: Promise<void>[] = [];
      const updatedProductIds: string[] = [];

      // Iterate over all products that have changes
      Object.entries(unsavedChanges).forEach(([prodId, changes]) => {
        const currentChanges = unsavedChanges[prodId];
        if (currentChanges) {
          updatedProductIds.push(prodId);
          promises.push(onUpdateEntry(prodId, currentDate, { ...currentChanges, finalized: true }));
        }
      });

      await Promise.all(promises);

      // 2. Finalize GLOBAL if prop provided, otherwise fallback (though this view is mostly used in App.tsx which provides it)
      if (onFinalizeGlobal) {
        // If we have an explicit inventory type, use it. Default to 'cocina' if not (safety fallback)
        const typeToFinalize = inventoryType || 'cocina';
        await onFinalizeGlobal(typeToFinalize, updatedProductIds);
      } else if (!isFinalized) {
        // Fallback to old category-based finalize if global not provided
        await onFinalizeCategory(selectedCategoryId, currentDate);
      }

      // 3. Keep local state to avoid "disappearing numbers" visual glitch (optimistic UI)
      setUnsavedChanges({});
      alert(onFinalizeGlobal ? '¡Inventario guardado y finalizado!' : '¡Guardado exitosamente!');
    } catch (error) {
      console.error("Error saving:", error);
      alert(`Hubo un error al guardar: ${(error as Error).message}`);
    } finally {
      setIsSaving(false);
      setShowSaveConfirm(false);
    }
  };

  const handleSaveChanges = async () => {
    setShowSaveConfirm(true);
  };

  return (
    <div className="flex flex-col gap-4 p-2 md:p-4 max-w-4xl mx-auto w-full">
      {/* Selector de Rubros */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              setTappedCat(cat.id);
              onCategoryChange(cat.id);
            }}
            className={`
                  relative px-6 py-3 rounded-full font-bold text-sm transition-all whitespace-nowrap shadow-sm border
                  ${tappedCat === cat.id ? 'text-lime-800 scale-105 border-lime-200 z-10' :
                selectedCategoryId === cat.id ? 'text-lime-700 bg-lime-50 border-lime-200' : 'text-gray-500 bg-white border-gray-200 hover:text-gray-700 hover:bg-gray-50'}
                `}
          >
            {selectedCategoryId === cat.id && (
              <motion.div
                layoutId="bubble"
                className="absolute inset-0 bg-lime-100/50 rounded-full -z-10"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            {cat.name}
          </button>
        ))}
      </div>

      {/* Buscador */}
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-lime-500 focus:ring-1 focus:ring-lime-500 sm:text-sm font-bold transition-all shadow-sm"
            placeholder="Buscar producto..."
          />
        </div>
        {inventoryType === 'local' && (
          <button
            onClick={() => setShowScanner(true)}
            className="bg-white text-gray-500 hover:text-gray-800 hover:bg-gray-50 px-4 rounded-xl transition-colors flex items-center justify-center border border-gray-200 shadow-sm"
            title="Escanear código"
          >
            <ScanBarcode size={24} />
          </button>
        )}
        {inventoryType === 'local' && (
          <button
            onClick={() => setShowHistory(true)}
            className="bg-white text-gray-500 hover:text-gray-800 hover:bg-gray-50 px-4 rounded-xl transition-colors flex items-center justify-center border border-gray-200 shadow-sm"
            title="Historial de Transferencias"
          >
            <History size={24} />
          </button>
        )}
        {inventoryType === 'local' && (
          <button
            onClick={async () => {
              if (confirm(`¿Verificar y sincronizar transferencias para la fecha: ${currentDate}?`)) {
                setIsSaving(true);
                try {
                  // 1. Get transfers for date
                  const transfers = await getTransfersForDate('locale-1', currentDate);
                  if (transfers.length === 0) {
                    alert("No se encontraron transferencias para esta fecha.");
                    setIsSaving(false);
                    return;
                  }

                  // 2. Fetch details (SKUs)
                  const detailsMap: Record<string, any> = {};
                  const tIds = transfers.map(t => t.productId);
                  const details = await fetchExternalProducts(tIds);
                  details.forEach(d => { if (d) detailsMap[d.id] = d; });

                  // 3. Reconcile
                  // We reuse the same logic function (defined below or we extract it)
                  await runReconciliation(transfers, productsRef.current, entriesRef.current, currentDate, detailsMap);

                  alert(`Sincronización completada. Se revisaron ${transfers.length} transferencias.`);
                } catch (e) {
                  console.error(e);
                  alert("Error al sincronizar");
                } finally {
                  setIsSaving(false);
                }
              }
            }}
            className="bg-white text-gray-500 hover:text-gray-800 hover:bg-gray-50 px-4 rounded-xl transition-colors flex items-center justify-center border border-gray-200 shadow-sm"
            title="Sincronizar Manualmente"
          >
            <Box size={24} className="text-blue-500" />
          </button>
        )}
      </div>

      {/* Lista de Productos */}
      <div className="flex flex-col gap-3">
        {rows.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-gray-200">
            <Package className="mx-auto text-gray-300 mb-2" size={48} />
            <p className="text-gray-400 text-sm font-medium italic">
              {searchTerm ? 'No se encontraron productos' : 'Sin productos en este rubro'}
            </p>
          </div>
        ) : (
          <>
            {rows.map(row => (
              <div key={row.product.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200 p-6 flex flex-col gap-6">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <h3 className="font-black text-gray-800 text-2xl uppercase tracking-tighter leading-none flex items-baseline gap-2">
                      {row.product.name}
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full lowercase ring-1 ring-blue-100 italic">
                        {row.product.unit || 'u'}
                      </span>

                    </h3>
                    {isAdmin && row.hasYesterday && (
                      <div className="flex items-center gap-1.5 opacity-80">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                        <span className="font-medium text-gray-500 text-[10px] uppercase tracking-widest">
                          Ayer: {row.esperadoDeAyer}
                        </span>
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className={`flex flex-col items-center min-w-[70px] px-3 py-2 rounded-2xl ring-1 ring-inset ${row.difference === 0 ? 'bg-gray-100 text-gray-500 ring-gray-200' :
                      row.difference > 0 ? 'bg-green-50 text-green-600 ring-green-200' : 'bg-red-50 text-red-600 ring-red-200'
                      }`}>
                      <span className="text-[8px] font-black uppercase tracking-[0.2em] mb-0.5">Diferencia</span>
                      <span className="text-xl font-black leading-none">
                        {row.difference > 0 ? '+' : ''}{row.difference}
                      </span>
                    </div>
                  )}
                </div>

                <div className={`grid ${showSales ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Stock Real</label>
                    <input
                      type="number"
                      value={row.stock === 0 ? '' : row.stock}
                      onChange={(e) => handleLocalUpdate(row.product.id, 'stock', e.target.value === '' ? 0 : Number(e.target.value))}
                      disabled={row.finalized || isSaving}
                      className={`w-full border-2 focus:bg-white focus:shadow-md rounded-[1.25rem] px-2 py-4 font-black text-gray-800 text-center text-2xl transition-all outline-none ${row.finalized
                        ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-50 border-gray-200 focus:border-blue-400 placeholder-gray-300'}`}
                      placeholder="0"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Ingresos</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={row.ingreso === 0 ? '' : row.ingreso}
                        onChange={(e) => {
                          // Handle delete (empty string) as 0, which will be clamped to transferSum in handleLocalUpdate
                          const val = e.target.value === '' ? 0 : Number(e.target.value);
                          handleLocalUpdate(row.product.id, 'ingreso', val);
                        }}
                        readOnly={row.finalized} // Only read-only if finalized. Otherwise editable (with constraint)
                        disabled={row.finalized || isSaving}
                        className={`w-full border-2 focus:bg-white focus:shadow-md rounded-[1.25rem] px-2 py-4 font-black text-gray-800 text-center text-2xl transition-all outline-none ${row.finalized
                          ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-50 border-gray-200 focus:border-green-400 placeholder-gray-300'}`} // Changed style back to white bg when editable
                        placeholder="0"
                      />
                      <button
                        onClick={() => {
                          const valStr = prompt('¿Cuánto deseas sumar al ingreso actual?');
                          if (valStr) {
                            const val = Number(valStr);
                            if (!isNaN(val) && val !== 0) {
                              handleLocalUpdate(row.product.id, 'ingreso', (row.ingreso || 0) + val);
                            }
                          }
                        }}
                        className="bg-green-50 text-green-600 hover:bg-green-100 rounded-[1.25rem] w-12 flex items-center justify-center transition-colors px-1 border border-green-100"
                        title="Sumar al ingreso actual"
                      >
                        <Plus size={20} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                  {showSales && (
                    <div className="flex flex-col gap-2">
                      <label className="text-[9px] font-black text-purple-600 uppercase tracking-widest text-center flex items-center justify-center gap-1">
                        <TrendingDown size={10} />
                        Ventas
                      </label>
                      <div className="w-full bg-purple-50 border-2 border-purple-100 rounded-[1.25rem] px-2 py-4 font-black text-purple-600 text-center text-2xl shadow-sm">
                        {row.ventas}
                      </div>
                    </div>
                  )}
                </div>

                {isAdmin && (
                  <div className="bg-white rounded-[2rem] p-6 flex justify-between items-center text-gray-800 shadow-xl shadow-gray-200/50 relative overflow-hidden group border border-gray-200">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 group-hover:bg-blue-100 transition-all duration-700"></div>

                    <div className="flex flex-col z-10">
                      <span className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2 opacity-80">Pronóstico Mañana</span>
                      <div className="flex items-center gap-3">
                        <span className={`text-4xl font-black leading-none drop-shadow-sm ${row.diaSiguiente < 0 ? 'text-red-500' : 'text-gray-800'}`}>{row.diaSiguiente}</span>
                        <div className="flex flex-col border-l border-gray-200 pl-2">
                          <span className="text-[7px] text-gray-400 font-black leading-tight">STOCK +</span>
                          <span className="text-[7px] text-gray-400 font-black leading-tight">INGRESO</span>
                          {showSales && (
                            <span className="text-[7px] text-purple-500 font-black leading-tight uppercase">- VENTAS</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="h-12 w-[1px] bg-gray-200 mx-2" />

                    <div className="flex-1 bg-gray-50 rounded-lg p-2 flex flex-col items-center justify-center gap-1 border border-gray-100">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Ant</span>
                      <span className="text-lg font-black text-gray-700">{row.stock}</span>
                    </div>

                    <div className="h-12 w-[1px] bg-gray-200 mx-2" />

                    <div className="flex flex-col items-end z-10 text-right">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Estado de Cuenta</span>
                      <div className={`text-xs font-black flex items-center gap-1.5 ${row.difference < 0 ? 'text-red-500' :
                        row.difference > 0 ? 'text-green-500' : 'text-gray-400'
                        }`}>
                        {row.hasYesterday ? (
                          <div className="flex flex-col items-end">
                            <span className="text-base font-black uppercase tracking-tighter">
                              {row.difference === 0 ? 'Cuadrado' : row.difference > 0 ? 'Sobran' : 'Faltan'}
                            </span>
                            <span className="text-[8px] bg-gray-100 px-2 py-0.5 rounded-full mt-1 border border-gray-200 font-bold text-gray-500">
                              {row.stock} vs {row.esperadoDeAyer}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[9px] bg-gray-100 px-3 py-1 rounded-full text-gray-500 font-bold border border-gray-200 uppercase">Sin Historial</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

          </>
        )
        }
      </div >

      {/* HISTORY MODAL */}
      {
        showHistory && (
          <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-lg relative border border-gray-200 shadow-xl max-h-[80vh] flex flex-col">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-gray-800 font-bold flex items-center gap-2">
                  <History className="text-blue-500" />
                  Historial de Transferencias
                </h3>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-gray-400 hover:text-gray-600 bg-gray-100 p-1.5 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="overflow-y-auto p-4 flex flex-col gap-3">
                {recentTransfers.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">No hay transferencias recientes</div>
                ) : (
                  recentTransfers.map(transfer => {
                    const extDetail = externalProductDetails[transfer.productId];

                    // 1. Try match by Name (Normalized)
                    const normalize = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const targetName = normalize(transfer.productName);

                    let localMatch = products.find(p => normalize(p.name) === targetName);
                    let matchType = 'name (exact)';

                    // 1.B Try fuzzy name
                    if (!localMatch && targetName.length > 5) {
                      localMatch = products.find(p => {
                        const n = normalize(p.name);
                        return (n.includes(targetName) || targetName.includes(n)) && n.length > 5;
                      });
                      if (localMatch) matchType = 'name (fuzzy)';
                    }

                    // 2. Try match by Code (SKU)
                    if (!localMatch && extDetail) {
                      localMatch = products.find(p => {
                        if (!p.barcodes || p.barcodes.length === 0) return false;
                        const matchMain = extDetail.sku && p.barcodes.includes(extDetail.sku);
                        const matchAdd = extDetail.additionalSkus && extDetail.additionalSkus.some(sku => p.barcodes?.includes(sku));
                        return matchMain || matchAdd;
                      });
                      if (localMatch) matchType = 'code (sku)';
                    }

                    // 3. Try match by ID as Barcode
                    if (!localMatch) {
                      localMatch = products.find(p => p.barcodes && p.barcodes.includes(transfer.productId));
                      if (localMatch) matchType = 'code (id)';
                    }

                    const isMatched = !!localMatch;

                    return (
                      <div key={transfer.id} className="bg-white rounded-lg p-3 border border-gray-200 flex flex-col gap-2 shadow-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] text-gray-400 font-bold block mb-0.5">{transfer.date}</span>
                            <span className="text-gray-800 font-bold">{transfer.productName}</span>
                          </div>
                          <span className={`text-xs font-black px-2 py-1 rounded-md ${isMatched ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            {transfer.quantity} u
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-gray-400">Estado:</span>
                          {isMatched ? (
                            <span className="text-green-600 font-bold flex items-center gap-1">
                              <CheckCircle size={12} />
                              {matchType === 'code' ? 'Registrado por CÓDIGO' : 'Registrado por NOMBRE'}
                              <span className="text-gray-400 font-normal">({localMatch.name})</span>
                            </span>
                          ) : (
                            <span className="text-red-500 font-bold flex items-center gap-1">
                              <TrendingDown size={12} className="rotate-180" /> No Registrado
                            </span>
                          )}
                        </div>

                        {!isMatched && (
                          <div className="mt-1 p-2 bg-yellow-50 border border-yellow-200 rounded text-[10px] text-yellow-700">
                            ⚠️ El nombre "{transfer.productName}" no coincide exactamente y tampoco se encontró coincidencia por código de barras.
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Scanner Modal Overlay */}
      {
        showScanner && (
          <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white p-4 rounded-xl w-full max-w-sm relative border border-gray-200 shadow-xl">
              <button
                onClick={() => setShowScanner(false)}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 bg-gray-100 p-1 rounded-full"
              >
                <X size={20} />
              </button>
              <h3 className="text-gray-800 font-bold mb-4 flex items-center gap-2">
                <ScanBarcode className="text-lime-600" />
                Escanear Código
              </h3>
              <div id="reader-inventory" className="w-full overflow-hidden rounded-lg bg-black"></div>
              <p className="text-xs text-gray-500 mt-4 text-center">
                Apunta la cámara al código de barras del producto.
              </p>
            </div>
          </div>
        )
      }
      {/* Save Confirmation Modal */}
      {showSaveConfirm && (
        <div className="fixed inset-0 z-[60] bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm relative border border-gray-200 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-black text-gray-800 mb-2 flex items-center gap-2">
              <Save className="text-lime-600" />
              ¿Guardar Cambios?
            </h3>
            <p className="text-sm text-gray-500 mb-6 font-medium">
              Se actualizará el stock e ingreso de los productos modificados.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveConfirm(false)}
                disabled={isSaving}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Seguir Editando
              </button>
              <button
                onClick={executeSave}
                disabled={isSaving}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-lime-600 hover:bg-lime-700 shadow-lg shadow-lime-200 hover:shadow-lime-300 transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    Confirmar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default InventoryView;
