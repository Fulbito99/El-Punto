// Script para poblar datos de ejemplo - Semana del 16 al 22 de Enero 2026
// Ejecutar: node seed-sample-data.js

const admin = require('firebase-admin');

// Inicializar Firebase Admin (necesitas el serviceAccountKey.json)
// O usar las credenciales de la aplicación
const firebaseConfig = {
    apiKey: "AIzaSyDuE_JIZTwZ5WGQnX-M4kWv9tD1p_j5mTk",
    authDomain: "kathe-market-app.firebaseapp.com",
    projectId: "kathe-market-app",
    storageBucket: "kathe-market-app.firebasestorage.app",
    messagingSenderId: "1048962773460",
    appId: "1:1048962773460:web:7f10cc3e9d021823466641"
};

// Datos de ejemplo para la semana
const sampleData = {
    // Productos de ejemplo
    products: [
        { name: 'Pan Frances', category: 'PANES' },
        { name: 'Pan Hamburguesa', category: 'PANES' },
        { name: 'Pan Pancho', category: 'PANES' },
        { name: 'Carne Molida', category: 'CARNES' },
        { name: 'Milanesa', category: 'CARNES' },
        { name: 'Empanada Carne', category: 'EMPANADAS' },
        { name: 'Empanada Pollo', category: 'EMPANADAS' },
    ],

    // Mapeos CSV -> Producto
    mappings: [
        { csvName: 'Pan Frances', productName: 'Pan Frances' },
        { csvName: 'Hamburguesa', productName: 'Pan Hamburguesa' },
        { csvName: 'Panchito', productName: 'Pan Pancho' },
        { csvName: 'Carne Picada', productName: 'Carne Molida' },
        { csvName: 'Milanesas', productName: 'Milanesa' },
        { csvName: 'Emp. Carne', productName: 'Empanada Carne' },
        { csvName: 'Emp. Pollo', productName: 'Empanada Pollo' },
    ],

    // Datos por día (16-22 Enero)
    dailyData: [
        {
            date: '2026-01-16',
            entries: [
                { product: 'Pan Frances', stock: 50, ingreso: 100 },
                { product: 'Pan Hamburguesa', stock: 30, ingreso: 80 },
                { product: 'Pan Pancho', stock: 40, ingreso: 60 },
                { product: 'Carne Molida', stock: 20, ingreso: 30 },
                { product: 'Milanesa', stock: 25, ingreso: 40 },
                { product: 'Empanada Carne', stock: 60, ingreso: 120 },
                { product: 'Empanada Pollo', stock: 50, ingreso: 100 },
            ],
            sales: [
                { product: 'Pan Frances', quantity: 95 },
                { product: 'Pan Hamburguesa', quantity: 70 },
                { product: 'Pan Pancho', quantity: 55 },
                { product: 'Carne Molida', quantity: 28 },
                { product: 'Milanesa', quantity: 35 },
                { product: 'Empanada Carne', quantity: 110 },
                { product: 'Empanada Pollo', quantity: 90 },
            ]
        },
        {
            date: '2026-01-17',
            entries: [
                { product: 'Pan Frances', stock: 55, ingreso: 100 },
                { product: 'Pan Hamburguesa', stock: 40, ingreso: 80 },
                { product: 'Pan Pancho', stock: 45, ingreso: 60 },
                { product: 'Carne Molida', stock: 22, ingreso: 30 },
                { product: 'Milanesa', stock: 30, ingreso: 40 },
                { product: 'Empanada Carne', stock: 70, ingreso: 120 },
                { product: 'Empanada Pollo', stock: 60, ingreso: 100 },
            ],
            sales: [
                { product: 'Pan Frances', quantity: 100 },
                { product: 'Pan Hamburguesa', quantity: 75 },
                { product: 'Pan Pancho', quantity: 60 },
                { product: 'Carne Molida', quantity: 30 },
                { product: 'Milanesa', quantity: 38 },
                { product: 'Empanada Carne', quantity: 115 },
                { product: 'Empanada Pollo', quantity: 95 },
            ]
        },
        {
            date: '2026-01-18',
            entries: [
                { product: 'Pan Frances', stock: 55, ingreso: 120 },
                { product: 'Pan Hamburguesa', stock: 45, ingreso: 90 },
                { product: 'Pan Pancho', stock: 45, ingreso: 70 },
                { product: 'Carne Molida', stock: 22, ingreso: 35 },
                { product: 'Milanesa', stock: 32, ingreso: 45 },
                { product: 'Empanada Carne', stock: 75, ingreso: 130 },
                { product: 'Empanada Pollo', stock: 65, ingreso: 110 },
            ],
            sales: [
                { product: 'Pan Frances', quantity: 110 },
                { product: 'Pan Hamburguesa', quantity: 82 },
                { product: 'Pan Pancho', quantity: 68 },
                { product: 'Carne Molida', quantity: 33 },
                { product: 'Milanesa', quantity: 42 },
                { product: 'Empanada Carne', quantity: 125 },
                { product: 'Empanada Pollo', quantity: 105 },
            ]
        },
        {
            date: '2026-01-19',
            entries: [
                { product: 'Pan Frances', stock: 65, ingreso: 120 },
                { product: 'Pan Hamburguesa', stock: 53, ingreso: 90 },
                { product: 'Pan Pancho', stock: 47, ingreso: 70 },
                { product: 'Carne Molida', stock: 24, ingreso: 35 },
                { product: 'Milanesa', stock: 35, ingreso: 45 },
                { product: 'Empanada Carne', stock: 80, ingreso: 130 },
                { product: 'Empanada Pollo', stock: 70, ingreso: 110 },
            ],
            sales: [
                { product: 'Pan Frances', quantity: 115 },
                { product: 'Pan Hamburguesa', quantity: 88 },
                { product: 'Pan Pancho', quantity: 72 },
                { product: 'Carne Molida', quantity: 35 },
                { product: 'Milanesa', quantity: 45 },
                { product: 'Empanada Carne', quantity: 130 },
                { product: 'Empanada Pollo', quantity: 110 },
            ]
        },
        {
            date: '2026-01-20',
            entries: [
                { product: 'Pan Frances', stock: 70, ingreso: 100 },
                { product: 'Pan Hamburguesa', stock: 55, ingreso: 80 },
                { product: 'Pan Pancho', stock: 45, ingreso: 60 },
                { product: 'Carne Molida', stock: 24, ingreso: 30 },
                { product: 'Milanesa', stock: 35, ingreso: 40 },
                { product: 'Empanada Carne', stock: 80, ingreso: 120 },
                { product: 'Empanada Pollo', stock: 70, ingreso: 100 },
            ],
            sales: [
                { product: 'Pan Frances', quantity: 105 },
                { product: 'Pan Hamburguesa', quantity: 80 },
                { product: 'Pan Pancho', quantity: 62 },
                { product: 'Carne Molida', quantity: 32 },
                { product: 'Milanesa', quantity: 40 },
                { product: 'Empanada Carne', quantity: 122 },
                { product: 'Empanada Pollo', quantity: 102 },
            ]
        },
        {
            date: '2026-01-21',
            entries: [
                { product: 'Pan Frances', stock: 65, ingreso: 100 },
                { product: 'Pan Hamburguesa', stock: 55, ingreso: 80 },
                { product: 'Pan Pancho', stock: 43, ingreso: 60 },
                { product: 'Carne Molida', stock: 22, ingreso: 30 },
                { product: 'Milanesa', stock: 35, ingreso: 40 },
                { product: 'Empanada Carne', stock: 78, ingreso: 120 },
                { product: 'Empanada Pollo', stock: 68, ingreso: 100 },
            ],
            sales: [
                { product: 'Pan Frances', quantity: 98 },
                { product: 'Pan Hamburguesa', quantity: 78 },
                { product: 'Pan Pancho', quantity: 58 },
                { product: 'Carne Molida', quantity: 30 },
                { product: 'Milanesa', quantity: 38 },
                { product: 'Empanada Carne', quantity: 118 },
                { product: 'Empanada Pollo', quantity: 98 },
            ]
        },
        {
            date: '2026-01-22',
            entries: [
                { product: 'Pan Frances', stock: 67, ingreso: 100 },
                { product: 'Pan Hamburguesa', stock: 57, ingreso: 80 },
                { product: 'Pan Pancho', stock: 45, ingreso: 60 },
                { product: 'Carne Molida', stock: 22, ingreso: 30 },
                { product: 'Milanesa', stock: 37, ingreso: 40 },
                { product: 'Empanada Carne', stock: 80, ingreso: 120 },
                { product: 'Empanada Pollo', stock: 70, ingreso: 100 },
            ],
            sales: [] // Día actual, sin ventas aún
        }
    ]
};

console.log('=== DATOS DE EJEMPLO - SEMANA 16-22 ENERO 2026 ===\n');
console.log('📦 PRODUCTOS:');
sampleData.products.forEach(p => {
    console.log(`  - ${p.name} (${p.category})`);
});

console.log('\n🔗 MAPEOS CSV → SISTEMA:');
sampleData.mappings.forEach(m => {
    console.log(`  "${m.csvName}" → "${m.productName}"`);
});

console.log('\n📊 DATOS POR DÍA:\n');
sampleData.dailyData.forEach(day => {
    console.log(`📅 ${day.date}`);
    console.log('  Inventario:');
    day.entries.forEach(e => {
        const sales = day.sales.find(s => s.product === e.product);
        const ventasQty = sales ? sales.quantity : 0;
        const expected = e.stock + e.ingreso - ventasQty;
        console.log(`    ${e.product.padEnd(20)} | Stock: ${String(e.stock).padStart(3)} | Ingreso: ${String(e.ingreso).padStart(3)} | Ventas: ${String(ventasQty).padStart(3)} | Esperado: ${String(expected).padStart(3)}`);
    });
    console.log('');
});

console.log('\n💡 INSTRUCCIONES:');
console.log('1. Estos datos muestran cómo se vería el sistema con una semana completa');
console.log('2. Cada día tiene: Stock inicial + Ingreso - Ventas = Stock esperado');
console.log('3. El stock del día siguiente debería coincidir con el esperado del día anterior');
console.log('4. Las diferencias mostrarían discrepancias entre esperado y real');
console.log('\n✅ Los datos están listos para ser importados a Firestore');
