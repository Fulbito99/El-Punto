
import { Product, DailyEntry, Sale, Category } from '../../types';
import { getDateRange, getYesterday, addDays } from '../utils/dates';
import { SALES_CATEGORIES } from '../../constants';

export interface ReportRow {
    productId: string;
    productName: string;
    categoryName: string;
    product: Product;
    dates: {
        [date: string]: {
            stock: number;
            ingreso: number;
            ventas: number;
            diaSiguiente: number;
            diferencia: number;
            ventasAmount?: number; // Optional if we want monetary later
        };
    };
}


// Generate report data for a date range
export const generateReport = (
    startDate: string,
    endDate: string,
    products: Product[],
    categories: Category[],
    entries: DailyEntry[],
    sales: Sale[],
    categoryFilter?: string
): ReportRow[] => {
    const dates = getDateRange(startDate, endDate);
    const filteredProducts = categoryFilter
        ? products.filter(p => p.categoryId === categoryFilter)
        : products;

    return filteredProducts.map(product => {
        const category = categories.find(c => c.id === product.categoryId);
        const showSales = (category && SALES_CATEGORIES.includes(category.name.toUpperCase())) || product.inventoryType === 'local';

        const dateData: ReportRow['dates'] = {};

        dates.forEach(date => {
            const entry = entries.find(e => e.productId === product.id && e.date === date);
            const stock = entry?.stock || 0;
            const ingreso = entry?.ingreso || 0;

            // Get sales for this product on this date
            const productSales = sales.filter(s => s.productId === product.id && s.date === date);
            const ventas = productSales.reduce((sum, s) => sum + s.quantity, 0);

            // Calculate día siguiente
            const diaSiguiente = showSales
                ? stock + ingreso - ventas
                : stock + ingreso;

            // Calculate diferencia: Stock(Mañana) - diaSiguiente(Hoy)
            const nextDate = addDays(date, 1);
            const nextEntry = entries.find(e => e.productId === product.id && e.date === nextDate);
            const nextStock = nextEntry ? nextEntry.stock : 0;

            const diferencia = nextStock - diaSiguiente;

            dateData[date] = {
                stock,
                ingreso,
                ventas: showSales ? ventas : 0,
                diaSiguiente,
                diferencia
            };
        });

        return {
            productId: product.id,
            productName: product.name,
            categoryName: category?.name || '',
            product: product,
            dates: dateData
        };
    });
};

// Export report to CSV
export const exportToCSV = (
    reportData: ReportRow[],
    dates: string[],
    showSales: boolean = true
): string => {
    // Group by category
    const grouped: { [key: string]: ReportRow[] } = {};
    reportData.forEach(row => {
        const cat = row.categoryName || 'SIN CATEGORIA';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(row);
    });

    // Sort categories alphabetically
    const sortedCategories = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

    // Build header
    let header = 'Producto,Categoría';
    dates.forEach(date => {
        const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('es-AR', {
            timeZone: 'America/Argentina/Buenos_Aires',
            day: '2-digit',
            month: '2-digit'
        });
        header += `,${formattedDate} Stock,${formattedDate} Ingreso`;
        if (showSales) {
            header += `,${formattedDate} Ventas`;
        }
        header += `,${formattedDate} Día Sig,${formattedDate} Dif`;
    });

    // Build rows with category grouping
    const allRows: string[] = [header];

    sortedCategories.forEach(([categoryName, rows], index) => {
        // Add empty row for separation between categories (except before the first one)
        if (index > 0) {
            allRows.push('');
        }

        // Add category header row
        allRows.push(`--- RUBRO: ${categoryName.toUpperCase()} ---`);

        rows.forEach(row => {
            let line = `${row.productName},${row.categoryName}`;
            dates.forEach(date => {
                const data = row.dates[date];
                line += `,${data.stock},${data.ingreso}`;
                if (showSales) {
                    line += `,${data.ventas}`;
                }
                line += `,${data.diaSiguiente},${data.diferencia}`;
            });
            allRows.push(line);
        });
    });

    return allRows.join('\n');
};

// Download CSV file
export const downloadCSV = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Export to PDF
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateTimeAR } from '../utils/dates';

export const exportToPDF = (
    reportData: ReportRow[],
    dates: string[],
    showSales: boolean = true,
    startDate: string,
    endDate: string
) => {
    // Landscape orientation to fit 7 days
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    // Title
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text('Reporte de Inventario - La Central Cocina', 14, 22);

    // Metadata
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Rango: ${startDate} al ${endDate}`, 14, 30);
    doc.text(`Generado: ${formatDateTimeAR(new Date())}`, 14, 35);

    // Columns Definition
    const columns = [
        { header: 'Producto', dataKey: 'product' },
        ...dates.map(date => {
            // Short date for column header to save space (DD/MM)
            const parts = date.split('-');
            const shortDate = `${parts[2]}/${parts[1]}`;
            // We need multiple columns per date?
            // AutoTable doesn't support nested headers easily.
            // Strategy: One row per product, but columns flattened?
            // "12/05 Stock", "12/05 Ing", "12/05 Vta", "12/05 DS", "12/05 Dif"
            // This is too wide for PDF.
            // Alternative: Group by Date? No, user wants product list.
            // Let's rely on the requested Excel format but transposed or condensed?
            // If we have 7 days, that's 7 * 5 = 35 columns. Too many for portrait. Even Landscape.
            // Maybe we just export a summary or strictly what fits?
            // Let's try to fit it. If it's too wide, user will scroll in PDF or we use A3?
            // Standard A4.
            // Let's just create flattened columns like the CSV.
            return [
                { header: `${shortDate}\nStk`, dataKey: `${date}_stock` },
                { header: `${shortDate}\nIng`, dataKey: `${date}_ing` },
                ...(showSales ? [{ header: `${shortDate}\nVta`, dataKey: `${date}_vta` }] : []),
                { header: `${shortDate}\nDS`, dataKey: `${date}_ds` },
                { header: `${shortDate}\nDif`, dataKey: `${date}_dif` }
            ];
        }).flat()
    ];

    // Group by category
    const grouped: { [key: string]: typeof reportData } = {};
    reportData.forEach(row => {
        const cat = row.categoryName || 'SIN CATEGORIA';
        if (cat.toUpperCase() === 'SIN CATEGORIA' || cat.toUpperCase() === 'SIN CATEGORÍA') return;

        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(row);
    });

    // Sort categories alphabetically
    const sortedCategories = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

    // Data Transformation with category headers
    const data: any[] = [];

    sortedCategories.forEach(([categoryName, rows], index) => {
        // Add an empty row purely for visual spacing between categories
        if (index > 0) {
            const spacerRow: any = {
                product: '',
                _isSpacer: true
            };
            dates.forEach(date => {
                spacerRow[`${date}_stock`] = '';
                spacerRow[`${date}_ing`] = '';
                if (showSales) spacerRow[`${date}_vta`] = '';
                spacerRow[`${date}_ds`] = '';
                spacerRow[`${date}_dif`] = '';
            });
            data.push(spacerRow);
        }

        // Add category header row (spanning all columns)
        const categoryRow: any = {
            product: `📁 ${categoryName.toUpperCase()}`,
            _isCategory: true
        };
        dates.forEach(date => {
            categoryRow[`${date}_stock`] = '';
            categoryRow[`${date}_ing`] = '';
            if (showSales) categoryRow[`${date}_vta`] = '';
            categoryRow[`${date}_ds`] = '';
            categoryRow[`${date}_dif`] = '';
        });
        data.push(categoryRow);

        // Add product rows for this category
        rows.forEach(row => {
            const rowData: any = {
                product: `  • ${row.productName}` // Added indentation and bullet
            };

            dates.forEach(date => {
                const d = row.dates[date];
                rowData[`${date}_stock`] = d.stock;
                rowData[`${date}_ing`] = d.ingreso;
                if (showSales) rowData[`${date}_vta`] = d.ventas;
                rowData[`${date}_ds`] = d.diaSiguiente;
                rowData[`${date}_dif`] = d.diferencia;
            });

            data.push(rowData);
        });
    });

    autoTable(doc, {
        head: [columns.map(c => c.header)],
        body: data.map(row => columns.map(c => row[c.dataKey])),
        startY: 40,
        styles: {
            fontSize: 6, // Smaller font to fit more days
            cellPadding: 0.8,
            overflow: 'linebreak',
            halign: 'center'
        },
        headStyles: {
            fillColor: [31, 41, 55], // Match UI slate-800
            textColor: 255,
            fontSize: 6,
            halign: 'center',
            valign: 'middle',
            fontStyle: 'bold'
        },
        columnStyles: {
            0: { cellWidth: 35, fontStyle: 'bold' } // Product column wider
        },
        // Highlight negative differences and style category rows
        didParseCell: function (data) {
            // Style category header rows
            if (data.section === 'body' && (data.row.raw as any)._isCategory) {
                // App-like category header: dark gray bg, blue text? App uses blue text on dark bg.
                // Let's emulate:
                data.cell.styles.fillColor = [39, 39, 42]; // zinc-800
                data.cell.styles.textColor = [96, 165, 250]; // blue-400 equivalent
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fontSize = 8;
                data.cell.styles.halign = 'left';
            }

            // Style spacer rows
            if (data.section === 'body' && (data.row.raw as any)._isSpacer) {
                data.cell.styles.fillColor = [255, 255, 255];
                data.cell.styles.cellPadding = 0.5;
                data.cell.styles.fontSize = 2; // Tiny to make it just a gap
            }

            if (data.section === 'body' && data.column.index > 0) {
                // Robustly determine value
                let val = Number(data.cell.raw);
                if (isNaN(val)) {
                    // Try getting text content
                    const txt = Array.isArray(data.cell.text) ? data.cell.text.join('') : String(data.cell.text);
                    val = parseFloat(txt);
                }

                const key = String(data.column.dataKey || '');

                if (!isNaN(val)) {
                    // Global negative red check
                    if (val < 0) {
                        data.cell.styles.textColor = [220, 53, 69]; // Red
                        data.cell.styles.fontStyle = 'bold';
                    }
                    // Green for positive Difference only
                    else if (val > 0 && key.endsWith('_dif')) {
                        data.cell.styles.textColor = [40, 167, 69]; // Green
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            }
        }
    });

    const fileName = `Reporte_${startDate}_${endDate}.pdf`;
    doc.save(fileName);
};
