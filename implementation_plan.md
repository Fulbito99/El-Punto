# Sistema de Importación de Ventas CSV

Implementar un sistema completo para importar ventas desde CSV y afectar el inventario automáticamente.

## Proposed Changes

### Data Model
#### [MODIFY] [types.ts](file:///c:/Users/franc/OneDrive/Escritorio/kathe market/types.ts)
- Agregar interfaces:
  - `ProductMapping`: mapeo entre nombre CSV y producto del sistema
  - `Sale`: registro de venta individual
  - `SalesImport`: importación completa con fecha

### Services
#### [NEW] [src/services/sales.ts](file:///c:/Users/franc/OneDrive/Escritorio/kathe market/src/services/sales.ts)
- `parseCSV(text: string)`: parsear CSV pegado
- `saveSalesImport()`: guardar ventas en Firestore
- `getSalesForDate()`: obtener ventas de una fecha
- `getProductMappings()`: obtener mapeos configurados
- `saveProductMapping()`: guardar mapeo CSV → Producto

### UI Components
#### [NEW] [components/SalesView.tsx](file:///c:/Users/franc/OneDrive/Escritorio/kathe market/components/SalesView.tsx)
- Sección 1: Importar CSV (textarea para pegar)
- Sección 2: Configurar mapeos de productos
- Sección 3: Historial de ventas importadas
- Filtros por fecha y categoría

#### [MODIFY] [App.tsx](file:///c:/Users/franc/OneDrive/Escritorio/kathe market/App.tsx)
- Agregar tab "Ventas" (solo para admins)
- Integrar `SalesView`

#### [MODIFY] [components/InventoryView.tsx](file:///c:/Users/franc/OneDrive/Escritorio/kathe market/components/InventoryView.tsx)
- Actualizar cálculo de "Esperado" para incluir ventas:
  - Fórmula: `Stock anterior + Ingreso - Ventas`
  - Solo para categorías: PANES, CARNES, EMPANADAS

### Database Collections
- `sales`: ventas individuales
- `product_mappings`: mapeos CSV → Producto
- `sales_imports`: registro de importaciones

## Verification Plan
### Manual Verification
1. Importar CSV de ejemplo
2. Configurar mapeos (ej: "Panchito" → "Pancho")
3. Verificar que las ventas se resten del stock esperado
4. Confirmar que solo afecta a PANES, CARNES, EMPANADAS
