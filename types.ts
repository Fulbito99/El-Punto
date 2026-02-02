
export interface Category {
  id: string;
  name: string;
  inventoryType?: 'cocina' | 'local'; // defaults to 'cocina' if undefined
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  unit?: string; // unidad, kg, litro, etc.
  inventoryType?: 'cocina' | 'local'; // defaults to 'cocina' if undefined
  barcodes?: string[];
}

export interface DailyEntry {
  productId: string;
  date: string; // ISO YYYY-MM-DD
  stock: number; // Conteo real del día
  ingreso: number; // Lo que ingresó hoy
  finalized?: boolean; // Si fue guardado para el historial
  transferId?: string; // ID de la transferencia que generó este ingreso
  // processedTransferIds?: string[]; // DEPRECATED
  processedTransferData?: { [id: string]: number }; // Map ID -> Quantity processed
}

export interface CalculatedRow {
  product: Product;
  stock: number;
  ingreso: number;
  expected: number; // Dia Siguiente (basado en lógica anterior)
  difference: number;
}

export interface UserProfile {
  email: string;
  role: 'admin' | 'employee';
}



export interface Sale {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  amount?: number; // Total value of the sale (Qty * Price)
  date: string; // ISO YYYY-MM-DD
  importId: string; // ID de la importación
}

export interface SalesImport {
  id: string;
  date: string; // ISO YYYY-MM-DD
  timestamp: number;
  totalItems: number;
  unmappedItems: string[]; // Productos del CSV sin mapear
}

export interface Transfer {
  id: string;
  date: string;
  productId: string;
  productName: string;
  quantity: number;
  destinationLocaleId: string;
  destinationLocaleName: string;
  sourceLocaleId?: string;
  sourceLocaleName?: string;
}
