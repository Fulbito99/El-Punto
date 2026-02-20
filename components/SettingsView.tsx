
import React, { useState } from 'react';
import { Category, Product } from '../types';
import { PlusCircle, Trash2, FolderPlus, Tag, ChevronDown, ChevronUp, Database, Edit, ScanBarcode, X } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { findProductInExternalDb } from '../src/services/externalDb';

interface Props {
  categories: Category[];
  products: Product[];
  onAddCategory: (name: string, type: 'cocina' | 'local') => Promise<string | void>;
  onRemoveCategory: (id: string) => void;
  onAddProduct: (name: string, catId: string, unit: string, type: 'cocina' | 'local', barcodes?: string[]) => Promise<string | void>;
  onRemoveProduct: (id: string) => void;
  onUpdateProduct: (id: string, updates: Partial<Product>) => void;
  onUpdateCategory: (id: string, name: string, type: 'cocina' | 'local') => Promise<string | void>;
  onClearAllEntries: () => Promise<void>;
}

const SettingsView: React.FC<Props> = ({
  categories, products, onAddCategory, onRemoveCategory, onAddProduct, onRemoveProduct, onUpdateProduct, onUpdateCategory, onClearAllEntries
}) => {
  const [newCatName, setNewCatName] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdUnit, setNewProdUnit] = useState('unidad');
  const [selectedCatId, setSelectedCatId] = useState('');
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [currentInventoryType, setCurrentInventoryType] = useState<'cocina' | 'local'>('cocina');

  // Edit Category State
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [editingCatType, setEditingCatType] = useState<'cocina' | 'local'>('cocina');

  // Barcode State
  const [newProdBarcodes, setNewProdBarcodes] = useState<string[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  // Layout State (Collapsible Sections) - Default collapsed for mobile compactness
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isAddCatOpen, setIsAddCatOpen] = useState(false);
  const [isAddProdOpen, setIsAddProdOpen] = useState(false);



  // Edit Product State
  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [editingProdName, setEditingProdName] = useState('');
  const [editingProdCatId, setEditingProdCatId] = useState('');
  const [editingProdUnit, setEditingProdUnit] = useState('unidad');
  const [editingProdBarcodes, setEditingProdBarcodes] = useState<string[]>([]);
  const [editingBarcodeInput, setEditingBarcodeInput] = useState('');

  // Scanner Effect
  React.useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner(
        "reader",
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
          if (editingProdId) {
            setEditingProdBarcodes(prev => [...prev, decodedText]);
          } else {
            setNewProdBarcodes(prev => [...prev, decodedText]);
          }
          setShowScanner(false);
          scanner.clear();

          // Attempt to find product name in external DB
          try {
            const externalName = await findProductInExternalDb(decodedText);
            if (externalName) {
              setNewProdName(externalName);
              // Optional: You could show a small toast here, but autofilling is clear enough
            }
          } catch (e) {
            console.error("Autofill failed", e);
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

  // Filter categories based on current type
  const filteredCategories = categories.filter(c =>
    currentInventoryType === 'cocina'
      ? (!c.inventoryType || c.inventoryType === 'cocina')
      : c.inventoryType === 'local'
  );

  const handleAddCat = () => {
    if (newCatName.trim()) {
      onAddCategory(newCatName.trim(), currentInventoryType);
      setNewCatName('');
    }
  };

  const handleAddProd = () => {
    if (newProdName.trim() && selectedCatId) {
      onAddProduct(newProdName.trim(), selectedCatId, newProdUnit, currentInventoryType, newProdBarcodes);
      setNewProdName('');
      setNewProdBarcodes([]);
      setBarcodeInput('');
      setNewProdUnit('unidad');
    }
  };

  return (
    <div className="p-2 md:p-4 flex flex-col gap-2 md:gap-4 max-w-4xl mx-auto w-full">
      <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
        <button
          onClick={() => setCurrentInventoryType('cocina')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${currentInventoryType === 'cocina' ? 'bg-lime-50 text-lime-700 border border-lime-200 shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
        >
          Cocina
        </button>
        <button
          onClick={() => setCurrentInventoryType('local')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${currentInventoryType === 'local' ? 'bg-lime-50 text-lime-700 border border-lime-200 shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
        >
          Local
        </button>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div
          className="p-3 flex items-center justify-between cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
          onClick={() => setIsBackupOpen(!isBackupOpen)}
        >
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Database size={16} className="text-lime-600" />
            Respaldo y Restauración
          </h3>
          {isBackupOpen ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </div>

        {isBackupOpen && (
          <div className="p-3 flex flex-col gap-3 border-t border-gray-200 animate-in slide-in-from-top-2 duration-200">
            <p className="text-xs text-gray-500">
              Descarga un respaldo o restaura masivamente.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  // GENERAR CSV
                  const headers = ['Rubro', 'Producto', 'Unidad'];
                  const rows: string[] = [];

                  categories.forEach(cat => {
                    const catProducts = products.filter(p => p.categoryId === cat.id);
                    if (catProducts.length === 0) {
                      // Rubro sin productos
                      rows.push(`"${cat.name}",,`);
                    } else {
                      catProducts.forEach(prod => {
                        rows.push(`"${cat.name}","${prod.name}","${prod.unit || 'unidad'}"`);
                      });
                    }
                  });

                  const csvContent = [headers.join(','), ...rows].join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', `inventario_backup_${new Date().toISOString().slice(0, 10)}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="flex-1 bg-zinc-800 border border-zinc-700 text-lime-400 px-3 py-2 rounded-lg shadow-sm hover:bg-zinc-700 font-bold text-xs flex items-center justify-center gap-2"
              >
                <Database size={14} />
                Exportar
              </button>

              <button
                onClick={async () => {
                  if (window.confirm('¿ESTÁS SEGURO? Esto borrará TODO el historial de conteos de inventario. Los productos y rubros se mantendrán, pero los stocks volverán a cero.')) {
                    if (window.confirm('¿DE VERDAD? Esta acción es irreversible.')) {
                      await onClearAllEntries();
                      alert('Historial de inventario eliminado correctamente.');
                    }
                  }
                }}
                className="flex-1 bg-red-900/30 border border-red-800 text-red-500 px-3 py-2 rounded-lg shadow-sm hover:bg-red-900/50 font-bold text-xs flex items-center justify-center gap-2"
              >
                <Trash2 size={14} />
                Resetear Stocks
              </button>

              <div className="flex-1 relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    if (!window.confirm('¿Estás seguro de importar este archivo? Se añadirán rubros y productos nuevos.')) {
                      e.target.value = '';
                      return;
                    }

                    const text = await file.text();
                    const lines = text.split('\n').filter(l => l.trim());

                    if (lines.length === 0) return;

                    // 1. Detect Delimiter
                    const firstLine = lines[0];
                    let delimiter = ',';
                    if (firstLine.includes('\t')) delimiter = '\t';
                    else if (firstLine.includes(';')) delimiter = ';';

                    // Helper to split CSV line respecting quotes
                    const splitCSV = (line: string, delim: string) => {
                      const regex = new RegExp(`(?:^|${delim})(\"(?:[^\"]|\"\")*\"|[^${delim}]*)`, 'g');
                      const matches = [];
                      let match;
                      while (match = regex.exec(line)) {
                        let val = match[1];
                        if (val.startsWith(delim)) val = val.substring(1); // Should not happen with this regex usually but careful
                        // Remove quotes
                        if (val.startsWith('"') && val.endsWith('"')) {
                          val = val.slice(1, -1).replace(/""/g, '"');
                        }
                        matches.push(val.trim());
                      }
                      // The regex might not catch the last empty element correctly if simplified, 
                      // but let's try a standard split for simple cases if no quotes involved
                      if (!line.includes('"')) {
                        return line.split(delim).map(s => s.trim());
                      }
                      return matches;
                    };

                    // 2. Detected Headers?
                    const headerLine = lines[0].toLowerCase();
                    const hasHeader = headerLine.includes('rubro') || headerLine.includes('producto') || headerLine.includes('categor');

                    let rubroIdx = 0;
                    let prodIdx = 1;
                    let unitIdx = 2;

                    let startIndex = 0;

                    if (hasHeader) {
                      startIndex = 1;
                      const headers = splitCSV(headerLine, delimiter).map(h => h.toLowerCase());

                      const rIdx = headers.findIndex(h => h.includes('rubro') || h.includes('categor'));
                      const pIdx = headers.findIndex(h => h.includes('producto') || h.includes('nombre') || h.includes('articul'));
                      const uIdx = headers.findIndex(h => h.includes('unidad'));

                      if (rIdx !== -1) rubroIdx = rIdx;
                      if (pIdx !== -1) prodIdx = pIdx;
                      if (uIdx !== -1) unitIdx = uIdx;
                    }

                    let importCount = 0;
                    const currentCategories = [...categories];

                    for (let i = startIndex; i < lines.length; i++) {
                      const row = splitCSV(lines[i], delimiter);
                      if (row.length < 2) continue; // Need at least Rubro+Prod or Prod+Rubro

                      const catName = row[rubroIdx];
                      const prodName = row[prodIdx];

                      // Safety: if mapped wrong, verify
                      if (!catName || !prodName) continue;

                      const unit = row[unitIdx] || 'unidad';

                      // Helper to fix common encoding issues (Mojibake)
                      const fixMojibake = (str: string) => {
                        if (!str) return str;

                        let fixed = str;

                        // 1. Try robust decode mechanism
                        try {
                          // Check for double-encoding signature
                          if (/[ÃÂ]/.test(fixed)) {
                            const decoded = decodeURIComponent(escape(fixed));
                            if (decoded && decoded !== fixed) fixed = decoded;
                          }
                        } catch (e) { }

                        // 2. Direct brute-force replacements for stubbornly broken chars
                        // This handles "GÃ³ndola" explicitly if the above failed
                        fixed = fixed
                          .replace(/Ã¡/g, 'á')
                          .replace(/Ã©/g, 'é')
                          .replace(/Ã\u00AD/g, 'í') // Soft hyphen often creates issues
                          .replace(/Ãí/g, 'í')      // Sometimes it appears as Ãí
                          .replace(/Ã³/g, 'ó')
                          .replace(/Ãº/g, 'ú')
                          .replace(/Ã±/g, 'ñ')
                          .replace(/Ã‘/g, 'Ñ')
                          .replace(/Â°/g, '°')
                          .replace(/Ã°/g, '°')
                          .replace(/Ã¼/g, 'ü');

                        return fixed;
                      };

                      const cleanCatName = fixMojibake(catName);
                      const cleanProdName = fixMojibake(prodName);

                      // 1. Buscar o Crear Categoría
                      let targetCat = currentCategories.find(c => c.name.toLowerCase() === cleanCatName.toLowerCase());

                      if (!targetCat) {
                        try {
                          const newId = await onAddCategory(cleanCatName, currentInventoryType);
                          if (newId && typeof newId === 'string') {
                            targetCat = { id: newId, name: cleanCatName };
                            currentCategories.push(targetCat);
                          } else {
                            continue;
                          }
                        } catch (err) {
                          console.error("Error adding category", err);
                          continue;
                        }
                      }

                      // 2. Si hay nombre de producto, buscar o crear
                      if (cleanProdName && targetCat) {
                        const existingProd = products.find(p =>
                          p.categoryId === targetCat!.id &&
                          p.name.toLowerCase() === cleanProdName.toLowerCase()
                        );

                        if (!existingProd) {
                          await onAddProduct(cleanProdName, targetCat.id, unit, currentInventoryType);
                          importCount++;
                        }
                      }
                    }

                    alert(`Proceso finalizado. Se importaron/verificaron ${lines.length - startIndex} líneas.`);
                    e.target.value = ''; // Reset input
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <button className="w-full h-full bg-lime-600 text-white px-3 py-2 rounded-lg shadow-sm hover:bg-lime-700 font-bold text-xs flex items-center justify-center gap-2">
                  <Database size={14} />
                  Importar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>



      {/* Add Category */}
      {/* Add Category */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div
          className="p-3 flex items-center justify-between cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
          onClick={() => setIsAddCatOpen(!isAddCatOpen)}
        >
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <FolderPlus size={16} className="text-lime-600" />
            Nuevo Rubro
          </h2>
          {isAddCatOpen ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </div>

        {isAddCatOpen && (
          <div className="p-3 flex gap-2 border-t border-gray-200 animate-in slide-in-from-top-2 duration-200">
            <input
              type="text"
              placeholder="Nombre del rubro..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="flex-1 bg-white border border-gray-300 rounded-lg p-2 text-sm text-gray-800 focus:ring-1 focus:ring-lime-500 placeholder-gray-400 focus:border-lime-500 outline-none"
            />
            <button
              onClick={handleAddCat}
              className="bg-lime-600 text-white p-2 rounded-lg hover:bg-lime-700 transition-colors shadow-sm"
            >
              <PlusCircle size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Add Product */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div
          className="p-3 flex items-center justify-between cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
          onClick={() => setIsAddProdOpen(!isAddProdOpen)}
        >
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Tag size={16} className="text-lime-600" />
            Nuevo Producto
          </h2>
          {isAddProdOpen ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </div>

        {isAddProdOpen && (
          <div className="p-3 flex flex-col gap-2 border-t border-gray-200 animate-in slide-in-from-top-2 duration-200">
            <select
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm text-gray-800 focus:border-lime-500 focus:ring-1 focus:ring-lime-500 outline-none"
            >
              <option value="">Seleccionar Categoría ({currentInventoryType === 'cocina' ? 'Cocina' : 'Local'})</option>
              {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
              <input
                type="text"
                placeholder="Nombre..."
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                className="flex-[2] bg-white border border-gray-300 rounded-lg p-2 text-sm text-gray-800 placeholder-gray-400 min-w-[120px] focus:border-lime-500 focus:ring-1 focus:ring-lime-500 outline-none"
              />

              {currentInventoryType === 'local' && (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2 items-center">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Escanear/Ingresar..."
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && barcodeInput.trim()) {
                            const code = barcodeInput.trim();
                            setNewProdBarcodes([...newProdBarcodes, code]);
                            setBarcodeInput('');
                            // Attempt lookup
                            if (!newProdName) {
                              try {
                                const externalName = await findProductInExternalDb(code);
                                if (externalName) setNewProdName(externalName);
                              } catch (err) { console.error(err); }
                            }
                          }
                        }}
                        className="w-24 bg-white border border-gray-300 rounded-lg p-2 text-sm text-gray-800 placeholder-gray-400 text-center focus:border-lime-500 focus:ring-1 focus:ring-lime-500 outline-none"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        if (barcodeInput.trim()) {
                          const code = barcodeInput.trim();
                          setNewProdBarcodes([...newProdBarcodes, code]);
                          setBarcodeInput('');
                          // Attempt lookup
                          if (!newProdName) {
                            try {
                              const externalName = await findProductInExternalDb(code);
                              if (externalName) setNewProdName(externalName);
                            } catch (err) { console.error(err); }
                          }
                        }
                      }}
                      className="bg-gray-100 border border-gray-200 text-gray-500 p-2 rounded-lg hover:text-gray-700 hover:bg-gray-200 transition-colors"
                      title="Agregar Código"
                    >
                      <PlusCircle size={20} />
                    </button>
                    <button
                      onClick={() => setShowScanner(!showScanner)}
                      className={`p-2 rounded-lg transition-colors border ${showScanner ? 'bg-lime-500 text-white border-lime-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                      title="Escanear Código"
                    >
                      <ScanBarcode size={20} />
                    </button>
                  </div>
                  {newProdBarcodes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {newProdBarcodes.map((code, idx) => (
                        <span key={idx} className="text-[10px] bg-gray-100 border border-gray-200 px-2 py-0.5 rounded text-gray-600 flex items-center gap-1 font-mono">
                          {code}
                          <button onClick={() => setNewProdBarcodes(newProdBarcodes.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash2 size={10} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {currentInventoryType === 'cocina' && (
                <select
                  value={newProdUnit}
                  onChange={(e) => setNewProdUnit(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg p-2 text-sm w-20 text-gray-800 focus:border-lime-500 focus:ring-1 focus:ring-lime-500 outline-none"
                >
                  <option value="unidad">Ui.</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="lt">lt</option>
                  <option value="ml">ml</option>
                  <option value="pieza">Pza.</option>
                  <option value="caja">Caja</option>
                  <option value="paq">Paq.</option>
                  <option value="docena">Doc.</option>
                </select>
              )}

              <button
                onClick={handleAddProd}
                className="bg-lime-600 text-white p-2 rounded-lg hover:bg-lime-700 transition-colors shadow-sm"
              >
                <PlusCircle size={20} />
              </button>
            </div>


          </div>
        )}
      </div>

      {/* List / Management */}
      <div className="flex flex-col gap-3">
        <h3 className="font-bold text-gray-500 text-sm uppercase tracking-wide">Gestión de Rubros ({currentInventoryType === 'cocina' ? 'Cocina' : 'Local'})</h3>
        <div className="flex flex-col gap-2">
          {filteredCategories.map(cat => (
            <div key={cat.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
              >
                <div className="flex items-center gap-2 flex-1">
                  {editingCatId === cat.id ? (
                    <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                      <input
                        value={editingCatName}
                        onChange={e => setEditingCatName(e.target.value)}
                        className="bg-white text-gray-900 border border-gray-300 rounded px-2 py-1 text-sm flex-1 focus:ring-1 focus:ring-lime-500 outline-none"
                      />
                      <select
                        value={editingCatType}
                        onChange={e => setEditingCatType(e.target.value as 'cocina' | 'local')}
                        className="bg-white text-gray-900 border border-gray-300 rounded px-2 py-1 text-xs outline-none"
                      >
                        <option value="cocina">Cocina</option>
                        <option value="local">Local</option>
                      </select>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (editingCatName.trim()) {
                            await onUpdateCategory(cat.id, editingCatName.trim(), editingCatType);
                            setEditingCatId(null);
                          }
                        }}
                        className="bg-lime-600 text-white px-2 py-1 rounded text-xs font-bold shadow-sm"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCatId(null);
                        }}
                        className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs hover:bg-gray-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-semibold text-gray-800">{cat.name}</span>
                      <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-full text-gray-500 border border-gray-200">
                        {products.filter(p => p.categoryId === cat.id).length} items
                      </span>
                      {(cat.inventoryType) && (
                        <span className={`text-[9px] px-1.5 rounded border uppercase ${cat.inventoryType === 'cocina' ? 'border-lime-200 text-lime-700 bg-lime-50' : 'border-blue-200 text-blue-700 bg-blue-50'}`}>
                          {cat.inventoryType}
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!editingCatId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCatId(cat.id);
                        setEditingCatName(cat.name);
                        setEditingCatType(cat.inventoryType || 'cocina');
                      }}
                      className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                      title="Editar Rubro"
                    >
                      <Edit size={16} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('¿Seguro quiere eliminar este rubro? Esta acción no se puede deshacer.')) {
                        onRemoveCategory(cat.id);
                      }
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                  {expandedCat === cat.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </div>

              {expandedCat === cat.id && (
                <div className="bg-gray-50 border-t border-gray-200 p-2 flex flex-col gap-1">
                  {products.filter(p => p.categoryId === cat.id).length === 0 ? (
                    <span className="text-xs text-gray-400 p-2 italic text-center">Sin productos</span>
                  ) : (
                    products.filter(p => p.categoryId === cat.id).map(prod => (
                      <div key={prod.id} className="flex justify-between items-center p-2 bg-white rounded border border-gray-200 text-sm shadow-sm">

                        {editingProdId === prod.id ? (
                          <div className="flex flex-col gap-2 w-full">
                            <input
                              type="text"
                              value={editingProdName}
                              onChange={(e) => setEditingProdName(e.target.value)}
                              className="bg-white text-gray-900 border border-gray-300 rounded p-1 text-sm w-full focus:ring-1 focus:ring-lime-500 outline-none"
                              placeholder="Nombre del producto"
                            />
                            <div className="flex gap-2">
                              <select
                                value={editingProdCatId}
                                onChange={(e) => setEditingProdCatId(e.target.value)}
                                className="bg-white text-gray-900 border border-gray-300 rounded p-1 text-xs flex-1 outline-none"
                              >
                                {filteredCategories.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                              {currentInventoryType === 'cocina' && (
                                <select
                                  value={editingProdUnit}
                                  onChange={(e) => setEditingProdUnit(e.target.value)}
                                  className="bg-white text-gray-900 border border-gray-300 rounded p-1 text-xs w-20 outline-none"
                                >
                                  <option value="unidad">Ui.</option>
                                  <option value="kg">kg</option>
                                  <option value="g">g</option>
                                  <option value="lt">lt</option>
                                  <option value="ml">ml</option>
                                  <option value="pieza">Pza.</option>
                                  <option value="caja">Caja</option>
                                  <option value="paq">Paq.</option>
                                  <option value="docena">Doc.</option>
                                </select>
                              )}
                              {currentInventoryType === 'local' && (
                                <div className="flex flex-col gap-2 w-full mt-2">
                                  <label className="text-xs text-gray-500">Códigos de Barra</label>
                                  <div className="flex gap-2 items-center">
                                    <input
                                      type="text"
                                      placeholder="Nuevo código..."
                                      value={editingBarcodeInput}
                                      onChange={(e) => setEditingBarcodeInput(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && editingBarcodeInput.trim()) {
                                          setEditingProdBarcodes(prev => [...prev, editingBarcodeInput.trim()]);
                                          setEditingBarcodeInput('');
                                        }
                                      }}
                                      className="bg-white text-gray-900 border border-gray-300 rounded p-1 text-xs flex-1 outline-none focus:border-lime-500"
                                    />
                                    <button
                                      onClick={() => {
                                        if (editingBarcodeInput.trim()) {
                                          setEditingProdBarcodes([...editingProdBarcodes, editingBarcodeInput.trim()]);
                                          setEditingBarcodeInput('');
                                        }
                                      }}
                                      className="bg-gray-100 border border-gray-200 text-gray-500 p-1 rounded hover:text-gray-700 hover:bg-gray-200"
                                    >
                                      <PlusCircle size={16} />
                                    </button>
                                    <button
                                      onClick={() => setShowScanner(!showScanner)}
                                      className={`p-1 rounded transition-colors border ${showScanner ? 'bg-lime-500 text-white border-lime-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                                      title="Escanear Código"
                                    >
                                      <ScanBarcode size={16} />
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {editingProdBarcodes.map((code, idx) => (
                                      <span key={idx} className="text-[10px] bg-gray-100 border border-gray-200 px-2 py-0.5 rounded text-gray-600 flex items-center gap-1 font-mono">
                                        {code}
                                        <button
                                          onClick={() => setEditingProdBarcodes(editingProdBarcodes.filter((_, i) => i !== idx))}
                                          className="text-red-400 hover:text-red-600"
                                        >
                                          <Trash2 size={10} />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={async () => {
                                  if (editingProdName.trim() && editingProdCatId) {
                                    // Auto-add pending barcode
                                    const finalBarcodes = [...editingProdBarcodes];
                                    if (editingBarcodeInput.trim()) {
                                      finalBarcodes.push(editingBarcodeInput.trim());
                                    }

                                    await onUpdateProduct(prod.id, {
                                      name: editingProdName.trim(),
                                      categoryId: editingProdCatId,
                                      unit: editingProdUnit,
                                      barcodes: finalBarcodes
                                    });
                                    setEditingProdId(null);
                                    setEditingBarcodeInput('');
                                  }
                                }}
                                className="bg-lime-600 text-white px-3 py-1 rounded text-xs font-bold shadow-sm hover:bg-lime-700"
                              >
                                Guardar
                              </button>
                              <button
                                onClick={() => setEditingProdId(null)}
                                className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs hover:bg-gray-300"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-800 flex items-center gap-2">
                                {prod.name}
                                {prod.barcodes && prod.barcodes.length > 0 && currentInventoryType === 'local' && (
                                  <div className="flex flex-wrap gap-1">
                                    {prod.barcodes.map((code, idx) => (
                                      <span key={idx} className="text-[10px] bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded text-gray-500 font-mono tracking-wider flex items-center gap-1">
                                        <ScanBarcode size={10} />
                                        {code}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </span>
                              {currentInventoryType === 'cocina' && (
                                <span className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wide">
                                  {prod.unit || 'unidad'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingProdId(prod.id);
                                  setEditingProdName(prod.name);
                                  setEditingProdCatId(prod.categoryId);
                                  setEditingProdUnit(prod.unit || 'unidad');
                                  setEditingProdBarcodes(prod.barcodes || (prod.barcode ? [prod.barcode] : []));
                                }}
                                className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm('¿Seguro quieres eliminar este producto?')) {
                                    onRemoveProduct(prod.id);
                                  }
                                }}
                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Scanner Modal Overlay */}
      {showScanner && (
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
            <div id="reader" className="w-full overflow-hidden rounded-lg bg-black"></div>
            <p className="text-xs text-gray-500 mt-4 text-center">
              Apunta la cámara al código de barras del producto.
            </p>
          </div>
        </div>
      )}

    </div>
  );
};

export default SettingsView;
