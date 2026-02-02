# Guía de Importación de Ventas - Semana Completa

He creado 7 archivos CSV con ventas de ejemplo para la semana del 16 al 22 de Enero 2026.

## 📁 Archivos Creados

1. `ventas-16-enero.csv` - Jueves 16
2. `ventas-17-enero.csv` - Viernes 17
3. `ventas-18-enero.csv` - Sábado 18
4. `ventas-19-enero.csv` - Domingo 19
5. `ventas-20-enero.csv` - Lunes 20
6. `ventas-21-enero.csv` - Martes 21
7. `ventas-22-enero.csv` - Miércoles 22

## 📋 Pasos para Importar

### 1. Primero: Configurar Mapeos (solo una vez)

Ve a la pestaña **Ventas** → sección **Mapeo de Productos**

Agrega estos mapeos:

| Nombre en CSV | Producto del Sistema |
|---------------|---------------------|
| Pan Frances | Pan Francés |
| Hamburguesa | Pan Hamburguesa |
| Panchito | Pan Pancho |
| Carne Picada | Carne Molida |
| Milanesas | Milanesa |
| Emp. Carne | Empanada Carne |
| Emp. Pollo | Empanada Pollo |

### 2. Importar Ventas por Día

Para cada día:

1. **Cambia la fecha** en el selector de fecha (arriba a la derecha)
2. Abre el archivo CSV correspondiente (ej: `ventas-16-enero.csv`)
3. Selecciona TODO el texto (Ctrl+A)
4. Copia (Ctrl+C)
5. Ve a **Ventas** → pega en el área de texto
6. Click en **Importar Ventas**

**Orden recomendado:**
- 16 de Enero → importar `ventas-16-enero.csv`
- 17 de Enero → importar `ventas-17-enero.csv`
- ... y así sucesivamente hasta el 22

### 3. Ver Reportes

Una vez importadas todas las ventas, ve a la pestaña **Reportes** para ver:
- Ventas totales por producto
- Comparativas por día
- Tendencias de la semana

## 📊 Datos de Ejemplo

**16 de Enero:**
- Pan Francés: 95 unidades
- Pan Hamburguesa: 70 unidades
- Pan Pancho: 55 unidades
- Carne Molida: 28 unidades
- Milanesa: 35 unidades
- Empanada Carne: 110 unidades
- Empanada Pollo: 90 unidades

*(Los otros días tienen cantidades similares con variaciones)*

## ⚠️ Importante

- Los mapeos se guardan automáticamente
- Una vez configurados, no necesitas volver a crearlos
- Puedes importar ventas de días pasados en cualquier orden
- Las ventas se mostrarán en el historial de cada día
