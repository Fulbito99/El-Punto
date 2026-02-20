
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  LayoutDashboard,
  Settings,
  FileText,
  LogOut,
  ShoppingCart,
  Save,
  Menu,
  X,
  Edit,
} from 'lucide-react';
import { Category, Product, DailyEntry, UserProfile } from './types';
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS } from './constants';
import InventoryView, { InventoryHandle } from './components/InventoryView';
import ReportsView from './components/ReportsView';
import SettingsView from './components/SettingsView';
import SalesView from './components/SalesView';
import LoginView from './components/LoginView';
import { onAuthStateChanged, User, getRedirectResult } from 'firebase/auth';
import { auth } from './src/firebase';
import {
  subscribeCategories,
  subscribeProducts,
  subscribeEntries,
  addCategoryService,
  deleteCategoryService,
  addProductService,
  deleteProductService,
  updateProductService,
  updateEntryService,
  finalizeEntriesService,
  unfinalizeEntriesService,
  clearAllEntriesService,
  updateCategoryService
} from './src/services/inventory';
import {
  signInWithGoogle,
  signOut as authSignOut,
  getUserProfile,
  createUserProfile,
  updateUserRole
} from './src/services/auth';

import { getCurrentDateAR } from './src/utils/dates';
import { getConversionFactor } from './src/utils/units';

import { Transfer } from './types';


const App: React.FC = () => {
  const [activeTab, setActiveTabState] = useState<'inventory-cocina' | 'inventory-local' | 'reports' | 'sales' | 'settings'>(() => {
    const saved = localStorage.getItem('activeTab');
    return (saved as any) || 'inventory-cocina';
  });

  const setActiveTab = (tab: 'inventory-cocina' | 'inventory-local' | 'reports' | 'sales' | 'settings') => {
    setActiveTabState(tab);
    localStorage.setItem('activeTab', tab);
  };

  const cocinaInventoryRef = useRef<InventoryHandle>(null);
  const localInventoryRef = useRef<InventoryHandle>(null);

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Data from Firestore
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);

  const [currentDate, setCurrentDate] = useState(getCurrentDateAR());

  // Persistent Category Selection
  const [selectedCategoryId, setSelectedCategoryIdState] = useState<string>(() => localStorage.getItem('selectedCategoryId') || '');
  const setSelectedCategoryId = (id: string) => {
    setSelectedCategoryIdState(id);
    localStorage.setItem('selectedCategoryId', id);
  };

  const [selectedLocalCategoryId, setSelectedLocalCategoryIdState] = useState<string>(() => localStorage.getItem('selectedLocalCategoryId') || '');
  const setSelectedLocalCategoryId = (id: string) => {
    setSelectedLocalCategoryIdState(id);
    localStorage.setItem('selectedLocalCategoryId', id);
  };

  const [isLoading, setIsLoading] = useState(true);

  // Debug state with localStorage persistence
  const [debugLog, setDebugLog] = useState<string[]>(() => {
    const saved = localStorage.getItem('debug_logs');
    return saved ? JSON.parse(saved) : [];
  });

  const [loginError, setLoginError] = useState<string | null>(null);

  const addLog = (msg: string) => {
    const time = new Date().toISOString().split('T')[1].split('.')[0];
    setDebugLog(prev => {
      const newLogs = [...prev, `${time} - ${msg}`].slice(-50); // Keep last 50 logs
      localStorage.setItem('debug_logs', JSON.stringify(newLogs));
      return newLogs;
    });
  };

  const clearLogs = () => {
    setDebugLog([]);
    localStorage.removeItem('debug_logs');
  };

  // Check for redirect result on mount
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          addLog(`Redirect exitoso. Usuario: ${result.user.email}`);
        }
      })
      .catch((error) => {
        console.error("Redirect error:", error);
        addLog(`REDIRECT ERROR: ${error.code} - ${error.message}`);
      });
  }, []);

  // Auth listener
  useEffect(() => {
    addLog("Iniciando listener de Auth...");
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      addLog(`Auth cambio. Usuario: ${currentUser ? currentUser.email : 'No user'}`);
      setUser(currentUser);
      setAuthLoading(true);
      try {
        if (currentUser && currentUser.email) {
          addLog("Obteniendo perfil...");
          let profile = await getUserProfile(currentUser.email);
          addLog(`Perfil obtenido: ${profile ? 'Si' : 'No'}`);

          // Admin emails list
          const ADMIN_EMAILS = ['katherinamedina18@gmail.com', 'francoaguirre928@gmail.com'];

          // If no profile exists, create one
          if (!profile) {
            addLog("Creando perfil nuevo...");
            const role = ADMIN_EMAILS.includes(currentUser.email) ? 'admin' : 'employee';
            await createUserProfile(currentUser.email, role);
            profile = { email: currentUser.email, role };
            addLog("Perfil creado.");
          }
          // If profile exists but role should be admin and isn't
          else if (ADMIN_EMAILS.includes(currentUser.email) && profile.role !== 'admin') {
            addLog("Actualizando a admin...");
            await updateUserRole(currentUser.email, 'admin');
            profile = { ...profile, role: 'admin' };
            addLog("Actualizado.");
          }

          setUserProfile(profile);
          addLog("Perfil establecido.");
        } else {
          addLog("No hay usuario, limpiando perfil.");
          setUserProfile(null);
        }
      } catch (err: any) {
        console.error("Error in auth flow:", err);
        addLog(`ERROR: ${err.code || 'No code'}`);
        addLog(`MSG: ${err.message || JSON.stringify(err)}`);
      } finally {
        addLog("Finalizando carga.");
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Data subscriptions
  useEffect(() => {
    if (!user) return; // Only subscribe if logged in

    const unsubCat = subscribeCategories((data) => {
      // Sort categories alphabetically
      const sortedData = [...data].sort((a, b) => a.name.localeCompare(b.name));
      setCategories(sortedData);

      // Ensure we have a selected category for both views if available
      const cocinaCats = sortedData.filter(c => !c.inventoryType || c.inventoryType === 'cocina');
      const localCats = sortedData.filter(c => c.inventoryType === 'local');

      if (cocinaCats.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(cocinaCats[0].id);
      }
      if (localCats.length > 0 && !selectedLocalCategoryId) {
        setSelectedLocalCategoryId(localCats[0].id);
      }
      setIsLoading(false);
    });
    const unsubProd = subscribeProducts((data) => {
      // Sort products alphabetically
      const sortedProds = [...data].sort((a, b) => a.name.localeCompare(b.name));
      setProducts(sortedProds);
    });

    // Suscribirse SOLAMENTE a hoy y ayer para ahorrar lecturas (90% de ahorro)
    // El historial completo se cargará bajo demanda en la vista de Reportes.
    const today = getCurrentDateAR();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const startDate = yesterday.toISOString().split('T')[0];

    const unsubEntries = subscribeEntries(setEntries, {
      startDate,
      endDate: today
    });

    // Subscribe to incoming transfers from Deposito - MOVED TO InventoryView.tsx using externalDb service
    // The previous implementation here was incorrect as it pointed to local DB 'transfers' collection which is for internal use or empty.
    // Real transfers are in the external 'deposito-inventory' project.

    return () => {
      unsubCat();
      unsubProd();
      unsubEntries();
    };
  }, [user]);

  useEffect(() => {
    const cocinaCats = categories.filter(c => !c.inventoryType || c.inventoryType === 'cocina');
    const localCats = categories.filter(c => c.inventoryType === 'local');

    if (cocinaCats.length > 0) {
      const isValid = cocinaCats.some(c => c.id === selectedCategoryId);
      if (!selectedCategoryId || !isValid) {
        setSelectedCategoryId(cocinaCats[0].id);
      }
    }

    if (localCats.length > 0) {
      const isValid = localCats.some(c => c.id === selectedLocalCategoryId);
      if (!selectedLocalCategoryId || !isValid) {
        setSelectedLocalCategoryId(localCats[0].id);
      }
    }
  }, [categories, selectedCategoryId, selectedLocalCategoryId]);

  const addCategory = async (name: string, type: 'cocina' | 'local' = 'cocina') => {
    return await addCategoryService(name, type);
  };

  const removeCategory = async (id: string) => {
    await deleteCategoryService(id);
    // Note: Deleting products associated with category is not automatically done in NoSQL usually, 
    // but for this app size we could do it. For now leaving as is (orphaned products won't show if filtered).
  };

  const updateCategory = async (id: string, name: string, inventoryType: 'cocina' | 'local') => {
    // Also update products if moving inventory type? 
    // Ideally yes, otherwise they disappear from view.
    const category = categories.find(c => c.id === id);
    if (!category) return;

    // Update category
    await updateCategoryService(id, { name, inventoryType });

    // Update product types if type changed
    if (category.inventoryType !== inventoryType || (!category.inventoryType && inventoryType === 'local')) {
      // Find all products in this category
      const productsInCat = products.filter(p => p.categoryId === id);
      for (const p of productsInCat) {
        // Only update if needed
        if (p.inventoryType !== inventoryType) {
          await updateProductService(p.id, { inventoryType });
        }
      }
    }
  };

  const addProduct = async (name: string, categoryId: string, unit: string, type: 'cocina' | 'local' = 'cocina', barcodes?: string[]) => {
    return await addProductService(name, categoryId, unit, type, barcodes);
  };

  const removeProduct = async (id: string) => {
    await deleteProductService(id);
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    if (userProfile?.role !== 'admin') return alert('No tienes permisos');

    // Migración de unidades si cambia la magnitud
    if (updates.unit) {
      const product = products.find(p => p.id === id);
      const factor = getConversionFactor(product?.unit, updates.unit);

      if (factor !== 1) {
        const productEntries = entries.filter(e => e.productId === id);
        if (productEntries.length > 0) {
          const promises = productEntries.map(e =>
            updateEntryService({
              ...e,
              stock: e.stock * factor,
              ingreso: e.ingreso * factor
            })
          );
          await Promise.all(promises);
        }
      }
    }

    await updateProductService(id, updates);
  };

  const updateEntry = async (productId: string, date: string, updates: { stock?: number; ingreso?: number }) => {
    // Find existing to preserve other fields, or create new
    const existing = entries.find(e => e.productId === productId && e.date === date);

    // Merge existing with updates. Ensure we have defaults if creating new.
    const newEntry: DailyEntry = existing
      ? { ...existing, ...updates }
      : {
        productId,
        date,
        stock: 0,
        ingreso: 0,
        finalized: false,
        ...updates
      };

    await updateEntryService(newEntry);
  };

  const finalizeCategory = async (categoryId: string, date: string) => {
    const productsInCat = products.filter(p => p.categoryId === categoryId).map(p => p.id);
    const entriesToFinalize = entries.filter(e => productsInCat.includes(e.productId) && e.date === date);

    // Also need to consider products that have NO entry yet? 
    // The original logic only finalized existing entries. We'll stick to that.
    if (entriesToFinalize.length > 0) {
      await finalizeEntriesService(entriesToFinalize);
    }
  };

  const reopenCategory = async (categoryId: string, date: string) => {
    const productsInCat = products.filter(p => p.categoryId === categoryId).map(p => p.id);
    const entriesToReopen = entries.filter(e => productsInCat.includes(e.productId) && e.date === date);

    if (entriesToReopen.length > 0) {
      await unfinalizeEntriesService(entriesToReopen);
    }
  };

  const cleanupDuplicates = async () => {
    const productsToDelete: string[] = [];
    const seen = new Set<string>();

    // 1. Identify duplicates
    products.forEach(p => {
      const key = `${p.categoryId}-${p.name.trim().toLowerCase()}`;
      if (seen.has(key)) {
        productsToDelete.push(p.id);
      } else {
        seen.add(key);
      }
    });

    if (productsToDelete.length === 0) {
      alert('No se encontraron duplicados.');
      return;
    }

    if (!confirm(`Se encontraron ${productsToDelete.length} productos duplicados. ¿Deseas eliminarlos?`)) {
      return;
    }

    // 2. Delete duplicates
    let deletedCount = 0;
    for (const id of productsToDelete) {
      await deleteProductService(id);
      deletedCount++;
    }

    alert(`Se eliminaron ${deletedCount} productos duplicados.`);
  };

  const resetMercaderia = async () => {
    if (!confirm('¿Estás seguro de REEMPLAZAR todos los productos de MERCADERIA? Se borrarán los actuales y se cargarán los nuevos.')) return;

    // 1. Find Mercaderia Category ID
    const mercName = 'MERCADERIA';
    const existingCat = categories.find(c => c.name.toUpperCase() === mercName);

    if (!existingCat) {
      alert('No se encontró la categoría MERCADERIA');
      return;
    }

    const catId = existingCat.id;

    // 2. Delete existing products in Mercaderia
    const prodsToDelete = products.filter(p => p.categoryId === catId);
    for (const p of prodsToDelete) {
      await deleteProductService(p.id);
    }

    // 3. Add new products from INITIAL_PRODUCTS where categoryId === '1'
    const newProds = INITIAL_PRODUCTS.filter(p => p.categoryId === '1');
    let added = 0;
    for (const p of newProds) {
      await addProductService(p.name, catId, 'unidad');
      added++;
    }

    alert(`Se eliminaron ${prodsToDelete.length} productos y se agregaron ${added} nuevos en Mercadería.`);
  };

  /* Global Finalize Check */
  const isInventoryFinalized = useMemo(() => {
    // Determine which categories map to the current view
    let targetCats: Category[] = [];
    if (activeTab === 'inventory-cocina') {
      targetCats = categories.filter(c => !c.inventoryType || c.inventoryType === 'cocina');
    } else if (activeTab === 'inventory-local') {
      targetCats = categories.filter(c => c.inventoryType === 'local');
    } else {
      return false;
    }

    if (targetCats.length === 0) return false;

    // Check if ALL categories that have products are finalized
    // Logic: If ANY product in a category is finalized -> that category is finalized.
    // We want to know if ALL available categories are finalized.

    // 1. Get IDs of all target categories that actually have products
    const catsWithProducts = targetCats.filter(c => products.some(p => p.categoryId === c.id));

    if (catsWithProducts.length === 0) return false;

    // 2. Check if every single one of those categories has at least one finalized entry for today
    const allFinalized = catsWithProducts.every(cat => {
      const catProdIds = products.filter(p => p.categoryId === cat.id).map(p => p.id);
      return entries.some(e => e.date === currentDate && catProdIds.includes(e.productId) && e.finalized);
    });

    return allFinalized;
  }, [activeTab, categories, products, currentDate, entries]);

  const finalizeGlobal = async (type: 'cocina' | 'local', ignoredProductIds: string[] = []) => {
    // 1. Identify categories
    const targetCats = categories.filter(c =>
      type === 'cocina'
        ? (!c.inventoryType || c.inventoryType === 'cocina')
        : (c.inventoryType === 'local')
    );

    // 2. Gather all products for those categories
    const allProdIds: string[] = [];
    targetCats.forEach(c => {
      const pIds = products.filter(p => p.categoryId === c.id).map(p => p.id);
      allProdIds.push(...pIds);
    });

    if (allProdIds.length === 0) return;

    // 3. Find existing entries for today for these products
    const entriesToFinalize = entries.filter(e => allProdIds.includes(e.productId) && e.date === currentDate);
    const existingProductIds = entriesToFinalize.map(e => e.productId);

    // 4. Identify missing products (no entry for today)
    // EXCLUDE products that were just updated (ignoredProductIds) to avoid race condition overwrites
    const missingProductIds = allProdIds.filter(id => !existingProductIds.includes(id) && !ignoredProductIds.includes(id));

    // 5. Create 0-value finalized entries for missing products
    const createPromises = missingProductIds.map(productId =>
      updateEntryService({
        productId,
        date: currentDate,
        stock: 0,
        ingreso: 0,
        finalized: true
      })
    );

    await Promise.all(createPromises);

    // 6. Finalize existing entries
    if (entriesToFinalize.length > 0) {
      await finalizeEntriesService(entriesToFinalize);
    }
  };

  const reopenGlobal = async (type: 'cocina' | 'local') => {
    // 1. Identify categories
    const targetCats = categories.filter(c =>
      type === 'cocina'
        ? (!c.inventoryType || c.inventoryType === 'cocina')
        : (c.inventoryType === 'local')
    );

    // 2. Gather all products
    const allProdIds: string[] = [];
    targetCats.forEach(c => {
      const pIds = products.filter(p => p.categoryId === c.id).map(p => p.id);
      allProdIds.push(...pIds);
    });

    if (allProdIds.length === 0) return;

    // 3. Find entries
    const entriesToReopen = entries.filter(e => allProdIds.includes(e.productId) && e.date === currentDate);

    if (entriesToReopen.length > 0) {
      await unfinalizeEntriesService(entriesToReopen);
    }
  };
  const handleSignIn = async () => {
    setLoginError(null);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error('Error signing in:', error);
      let msg = 'Error al iniciar sesión.';
      if (error?.code === 'auth/popup-closed-by-user') {
        msg = 'Se cerró la ventana de inicio de sesión.';
      } else if (error?.code === 'auth/unauthorized-domain') {
        msg = 'Dominio no autorizado. Contacte al administrador.';
      } else if (error?.message) {
        msg = error.message;
      }
      setLoginError(msg);
      addLog(`LOGIN ERROR: ${error?.code} - ${error?.message}`);
    }
  };

  const handleSignOut = async () => {
    try {
      await authSignOut();
      setLoginError(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-20 h-20 rounded-xl overflow-hidden shadow-lg mx-auto mb-4">
            <img src="/logo.png?v=1.9" alt="El Punto" className="w-full h-full object-contain" />
          </div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user || !userProfile) {
    return <LoginView onSignIn={handleSignIn} error={loginError} />;
  }

  const isAdmin = userProfile.role === 'admin';

  return (
    <div className="flex bg-gray-50 text-gray-900 h-screen w-full overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-gradient-to-b from-white to-gray-50 border-r border-gray-200 z-30 shadow-lg">
        <div className="p-6 border-b border-gray-200 flex items-center gap-3 bg-white">
          <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md ring-2 ring-lime-100">
            <img src="/logo.png?v=1.9" alt="El Punto" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight leading-none text-gray-800">El Punto</h1>
            <span className="text-xs text-gray-500 font-medium">Cocina v1.9.7</span>
          </div>
        </div>

        <nav className="flex-1 p-4 flex flex-col gap-2">
          <button
            onClick={() => setActiveTab('inventory-cocina')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${activeTab === 'inventory-cocina' ? 'bg-gradient-to-r from-lime-50 to-lime-100 text-lime-700 shadow-md border border-lime-300' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
          >
            <div className={`p-1.5 rounded-lg ${activeTab === 'inventory-cocina' ? 'bg-lime-200' : 'bg-transparent'}`}>
              <LayoutDashboard size={18} className={activeTab === 'inventory-cocina' ? 'text-lime-700' : 'text-gray-500'} />
            </div>
            Inventario Cocina
          </button>

          <button
            onClick={() => setActiveTab('inventory-local')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${activeTab === 'inventory-local' ? 'bg-gradient-to-r from-lime-50 to-lime-100 text-lime-700 shadow-md border border-lime-300' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
          >
            <div className={`p-1.5 rounded-lg ${activeTab === 'inventory-local' ? 'bg-lime-200' : 'bg-transparent'}`}>
              <LayoutDashboard size={18} className={activeTab === 'inventory-local' ? 'text-lime-700' : 'text-gray-500'} />
            </div>
            Inventario Local
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('reports')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${activeTab === 'reports' ? 'bg-gradient-to-r from-lime-50 to-lime-100 text-lime-700 shadow-md border border-lime-300' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
              >
                <div className={`p-1.5 rounded-lg ${activeTab === 'reports' ? 'bg-lime-200' : 'bg-transparent'}`}>
                  <FileText size={18} className={activeTab === 'reports' ? 'text-lime-700' : 'text-gray-500'} />
                </div>
                Reportes
              </button>
              <button
                onClick={() => setActiveTab('sales')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${activeTab === 'sales' ? 'bg-gradient-to-r from-lime-50 to-lime-100 text-lime-700 shadow-md border border-lime-300' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
              >
                <div className={`p-1.5 rounded-lg ${activeTab === 'sales' ? 'bg-lime-200' : 'bg-transparent'}`}>
                  <ShoppingCart size={18} className={activeTab === 'sales' ? 'text-lime-700' : 'text-gray-500'} />
                </div>
                Ventas
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${activeTab === 'settings' ? 'bg-gradient-to-r from-lime-50 to-lime-100 text-lime-700 shadow-md border border-lime-300' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
              >
                <div className={`p-1.5 rounded-lg ${activeTab === 'settings' ? 'bg-lime-200' : 'bg-transparent'}`}>
                  <Settings size={18} className={activeTab === 'settings' ? 'text-lime-700' : 'text-gray-500'} />
                </div>
                Ajustes
              </button>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center gap-3 px-4 py-3 mb-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl shadow-sm border border-gray-200">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-lime-400 to-lime-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
              {userProfile.email?.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold truncate text-gray-800">{userProfile.email}</p>
              <p className="text-[10px] text-gray-500 capitalize font-medium">{userProfile.role}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 font-semibold text-xs transition-all shadow-sm hover:shadow border border-red-200"
          >
            <LogOut size={16} />
            Cerrar Sesión
          </button>
        </div>
      </aside >

      {/* Main Content Area */}
      < div className="flex-1 flex flex-col h-screen overflow-hidden relative" >
        {/* Mobile Header */}
        <header className="md:hidden bg-gradient-to-r from-white to-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between sticky top-0 z-20 shadow-md">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md ring-2 ring-lime-100">
              <img src="/logo.png?v=1.9.7" alt="El Punto" className="w-full h-full object-contain" />
            </div>
            <h1 className="font-bold text-lg tracking-tight text-gray-800">El Punto <span className="text-xs text-gray-500 font-medium">v1.9.7</span></h1>
          </div>
          <button
            onClick={handleSignOut}
            className="p-2 text-gray-500 hover:text-red-600 transition-colors hover:bg-red-50 rounded-lg"
          >
            <LogOut size={18} />
          </button>
        </header>

        {/* Desktop Header Bar (Date & Info) */}
        <header className="hidden md:flex bg-gradient-to-r from-white to-gray-50 px-8 py-5 border-b border-gray-200 items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-black text-gray-800 tracking-tight">
              {activeTab === 'inventory-cocina' ? 'Inventario Cocina' :
                activeTab === 'inventory-local' ? 'Inventario Local' :
                  activeTab === 'reports' ? 'Reportes y Estadísticas' :
                    activeTab === 'sales' ? 'Gestión de Ventas' : 'Configuración'}
            </h2>
            {(activeTab === 'inventory-cocina' || activeTab === 'inventory-local') && (
              <button
                onClick={() => {
                  const type = activeTab === 'inventory-cocina' ? 'cocina' : 'local';
                  if (isInventoryFinalized) {
                    reopenGlobal(type);
                  } else {
                    if (activeTab === 'inventory-cocina') cocinaInventoryRef.current?.saveChanges();
                    if (activeTab === 'inventory-local') localInventoryRef.current?.saveChanges();
                  }
                }}
                className={`${isInventoryFinalized
                  ? 'bg-white text-lime-700 border-2 border-lime-600 hover:bg-lime-50'
                  : 'bg-gradient-to-r from-lime-600 to-lime-500 hover:from-lime-700 hover:to-lime-600 text-white shadow-lg shadow-lime-500/30'} 
                  px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all hover:-translate-y-0.5`}
              >
                {isInventoryFinalized ? <Edit size={18} /> : <Save size={18} />}
                {isInventoryFinalized ? 'EDITAR' : 'GUARDAR'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-r from-gray-100 to-gray-200 px-5 py-3 rounded-xl flex items-center gap-3 shadow-sm border border-gray-300">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Fecha de Trabajo:</span>
              <input
                type="date"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
                className="text-sm bg-white border-2 border-gray-300 rounded-lg px-3 py-1.5 font-bold text-gray-800 focus:ring-2 focus:ring-lime-500 focus:border-lime-500 outline-none transition-all"
              />
            </div>
          </div>
        </header>

        {/* Mobile Date Bar (Floating below header or inline) */}
        <div className="md:hidden bg-gradient-to-r from-gray-50 to-gray-100 backdrop-blur-sm px-4 py-3 border-b border-gray-200 flex justify-between items-center sticky top-[57px] z-10 shadow-sm">
          {(activeTab === 'inventory-cocina' || activeTab === 'inventory-local') ? (
            <button
              onClick={() => {
                const type = activeTab === 'inventory-cocina' ? 'cocina' : 'local';
                if (isInventoryFinalized) {
                  reopenGlobal(type);
                } else {
                  if (activeTab === 'inventory-cocina') cocinaInventoryRef.current?.saveChanges();
                  if (activeTab === 'inventory-local') localInventoryRef.current?.saveChanges();
                }
              }}
              className={`${isInventoryFinalized
                ? 'bg-white text-lime-700 border-2 border-lime-600 hover:bg-lime-50'
                : 'bg-gradient-to-r from-lime-600 to-lime-500 hover:from-lime-700 hover:to-lime-600 text-white shadow-md'} 
                px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all`}
            >
              {isInventoryFinalized ? <Edit size={14} /> : <Save size={14} />}
              {isInventoryFinalized ? 'EDITAR' : 'GUARDAR'}
            </button>
          ) : <div></div>}
          <input
            type="date"
            value={currentDate}
            onChange={(e) => setCurrentDate(e.target.value)}
            className="text-xs bg-white border-2 border-gray-300 rounded-lg shadow-sm px-3 py-2 font-bold text-gray-800 outline-none focus:border-lime-500 focus:ring-2 focus:ring-lime-200 transition-all"
          />
        </div>

        <main className="flex-1 overflow-y-auto pb-24 md:pb-0 p-0 md:p-6 md:bg-gray-50/50">
          <div className="max-w-md mx-auto md:max-w-6xl w-full"> {/* Container constraint only on mobile match or slightly wider on desktop but centered */}
            {isLoading && <div className="p-12 text-center text-gray-500 animate-pulse">Cargando datos del sistema...</div>}

            {!isLoading && (
              <>
                <div style={{ display: activeTab === 'inventory-cocina' ? 'block' : 'none' }}>
                  <InventoryView
                    ref={cocinaInventoryRef}
                    categories={categories.filter(c => !c.inventoryType || c.inventoryType === 'cocina')}
                    products={products.filter(p => !p.inventoryType || p.inventoryType === 'cocina')}
                    entries={entries}
                    currentDate={currentDate}
                    selectedCategoryId={selectedCategoryId}
                    onCategoryChange={setSelectedCategoryId}
                    onUpdateEntry={updateEntry}
                    onFinalizeCategory={finalizeCategory}
                    onFinalizeGlobal={finalizeGlobal}
                    onReopenCategory={reopenCategory}
                    isAdmin={isAdmin}
                    inventoryType="cocina"
                  />
                </div>
                <div style={{ display: activeTab === 'inventory-local' ? 'block' : 'none' }}>
                  <InventoryView
                    ref={localInventoryRef}
                    categories={categories.filter(c => c.inventoryType === 'local')}
                    products={products.filter(p => p.inventoryType === 'local')}
                    entries={entries}
                    currentDate={currentDate}
                    selectedCategoryId={selectedLocalCategoryId}
                    onCategoryChange={setSelectedLocalCategoryId}
                    onUpdateEntry={updateEntry}
                    onFinalizeCategory={finalizeCategory}
                    onFinalizeGlobal={finalizeGlobal}
                    onReopenCategory={reopenCategory}
                    isAdmin={isAdmin}
                    inventoryType="local"
                  />
                </div>
              </>
            )}
            {!isLoading && activeTab === 'reports' && (
              <ReportsView
                products={products}
                entries={entries}
                categories={categories}
                currentDate={currentDate}
              />
            )}
            {!isLoading && activeTab === 'settings' && (
              <SettingsView
                categories={categories}
                products={products}
                onAddCategory={addCategory}
                onRemoveCategory={removeCategory}
                onAddProduct={addProduct}
                onRemoveProduct={removeProduct}
                onUpdateProduct={updateProduct}
                onUpdateCategory={updateCategory}
                onClearAllEntries={clearAllEntriesService}
              />
            )}
            {!isLoading && activeTab === 'sales' && (
              <SalesView
                products={products}
                categories={categories}
                currentDate={currentDate}
              />
            )}
          </div>
        </main>

        {/* Mobile Navbar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-3 px-4 z-30 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <button
            onClick={() => setActiveTab('inventory-cocina')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'inventory-cocina' ? 'text-lime-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <LayoutDashboard size={22} />
            <span className="text-[10px] font-bold">Cocina</span>
          </button>
          <button
            onClick={() => setActiveTab('inventory-local')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'inventory-local' ? 'text-lime-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <LayoutDashboard size={22} />
            <span className="text-[10px] font-bold">Local</span>
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('reports')}
                className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'reports' ? 'text-lime-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <FileText size={22} />
                <span className="text-[10px] font-bold">Reportes</span>
              </button>
              <button
                onClick={() => setActiveTab('sales')}
                className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'sales' ? 'text-lime-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <ShoppingCart size={22} />
                <span className="text-[10px] font-bold">Ventas</span>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'settings' ? 'text-lime-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Settings size={22} />
                <span className="text-[10px] font-bold">Ajustes</span>
              </button>
            </>
          )}
        </nav>
      </div>
    </div>
  );
};

export default App;


