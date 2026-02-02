import React, { useState, useEffect } from 'react';
import { Upload, TrendingDown, AlertCircle, Trash2, FileDown, Calendar, DollarSign, Package } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Product, Sale, Category } from '../types';
import {
    importSales,
    subscribeSales,
    deleteSale,
    clearSalesForDate
} from '../src/services/sales';
import { formatDateAR } from '../src/utils/dates';

interface Props {
    products: Product[];
    categories: Category[];
    currentDate: string;
}

const SalesView: React.FC<Props> = ({ products, categories, currentDate }) => {
    const [csvText, setCsvText] = useState('');
    const [sales, setSales] = useState<Sale[]>([]);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ unmapped: string[]; imported: number } | null>(null);

    // Date Range State
    const [dateMode, setDateMode] = useState<'today' | 'range'>('today');
    const [startDate, setStartDate] = useState(currentDate);
    const [endDate, setEndDate] = useState(currentDate);

    // Update range if currentDate changes or mode changes to 'today'
    useEffect(() => {
        if (dateMode === 'today') {
            setStartDate(currentDate);
            setEndDate(currentDate);
        }
    }, [currentDate, dateMode]);

    useEffect(() => {
        const unsubSales = subscribeSales(setSales);
        return () => {
            unsubSales();
        };
    }, []);

    const handleImport = async () => {
        if (!csvText.trim()) {
            alert('Por favor pega el contenido de las ventas');
            return;
        }

        setImporting(true);
        setImportResult(null);

        try {
            const dateToUse = currentDate;
            const result = await importSales(csvText, dateToUse, products, categories);
            setImportResult(result);

            if (result.unmapped.length > 0) {
                alert(`Carga completa.\n${result.imported} productos procesados.\n${result.unmapped.length} productos sin mapear.`);
            } else {
                alert(`¡Éxito! ${result.imported} productos actualizados.`);
                setCsvText('');
            }
        } catch (error) {
            console.error('Error importing sales:', error);
            alert('Error al cargar ventas. Revisa el formato.');
        } finally {
            setImporting(false);
        }
    };

    const handleDeleteSale = async (id: string) => {
        if (confirm('¿Estás seguro de eliminar esta venta?')) {
            await deleteSale(id);
        }
    };

    const handleDeleteAll = async () => {
        if (confirm(`¿Estás seguro de eliminar TODAS las ventas del día ${currentDate}?`)) {
            await clearSalesForDate(currentDate);
        }
    };

    // Filter sales for date range
    const filteredSales = sales.filter(s => s.date >= startDate && s.date <= endDate);

    // Calculate Total Amount
    const totalAmount = filteredSales.reduce((sum, s) => sum + (s.amount || 0), 0);

    // Formatter
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);
    };

    const exportToPDF = () => {
        const doc = new jsPDF();

        // Title
        doc.setFontSize(18);
        doc.text('Reporte de Ventas', 14, 20);

        // Date range
        doc.setFontSize(11);
        doc.text(`Periodo: ${startDate === endDate ? startDate : `${startDate} a ${endDate}`}`, 14, 30);

        // Prepare table data
        const tableData = filteredSales.map(sale => [
            sale.productName,
            sale.date,
            sale.quantity.toString(),
            formatCurrency(sale.amount || 0)
        ]);

        // Add table
        autoTable(doc, {
            startY: 35,
            head: [['Producto', 'Fecha', 'Cantidad', 'Importe']],
            body: tableData,
            foot: [[
                'TOTAL',
                '',
                filteredSales.length + ' items',
                formatCurrency(totalAmount)
            ]],
            theme: 'striped',
            headStyles: { fillColor: [132, 204, 22] }, // lime-600
            footStyles: { fillColor: [220, 252, 231], textColor: [0, 0, 0], fontStyle: 'bold' } // lime-100
        });

        // Save
        doc.save(`ventas_${startDate}_${endDate}.pdf`);
    };

    return (
        <div className="p-3 md:p-6 flex flex-col gap-6 max-w-5xl mx-auto w-full">
            {/* Import Section */}
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 shadow-lg border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-lime-100 rounded-lg">
                        <Upload size={24} className="text-lime-600" />
                    </div>
                    <div>
                        <h2 className="font-bold text-xl text-gray-800">Cargar Ventas</h2>
                        <p className="text-xs text-gray-500">Importa datos desde Excel</p>
                    </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-xs text-blue-800 font-medium mb-1">📋 Formato esperado:</p>
                    <p className="text-xs text-blue-700 font-mono">Artículos | Cantidad | Importe | Porcentaje</p>
                </div>

                <textarea
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    placeholder="Pega aquí las ventas copiadas desde Excel&#10;&#10;Ejemplo:&#10;Coca Cola 500Ml    8.00    $ 22.400,00    1.71%&#10;Agua Benedictina    12.00    $ 20.400,00    2.56%"
                    className="w-full h-36 bg-white border-2 border-gray-300 rounded-xl p-4 text-sm font-mono resize-none focus:ring-2 focus:ring-lime-500 focus:border-lime-500 text-gray-800 placeholder-gray-400 outline-none transition-all shadow-sm"
                />

                <button
                    onClick={handleImport}
                    disabled={importing || !csvText.trim()}
                    className="mt-4 w-full bg-gradient-to-r from-lime-600 to-lime-500 text-white py-3 px-6 rounded-xl hover:from-lime-700 hover:to-lime-600 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed font-bold transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:transform-none flex items-center justify-center gap-2"
                >
                    {importing ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                            Importando...
                        </>
                    ) : (
                        <>
                            <Upload size={18} />
                            Procesar Ventas
                        </>
                    )}
                </button>

                {importResult && importResult.unmapped.length > 0 && (
                    <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg shadow-sm">
                        <p className="text-sm font-semibold text-yellow-800 flex items-center gap-2 mb-2">
                            <AlertCircle size={18} />
                            Productos sin mapear ({importResult.unmapped.length})
                        </p>
                        <ul className="text-xs text-yellow-700 ml-6 list-disc space-y-1">
                            {importResult.unmapped.map((name, i) => (
                                <li key={i}>{name}</li>
                            ))}
                        </ul>
                        <p className="text-xs text-yellow-600 mt-3 italic">
                            Estos productos no coinciden con ningún producto del inventario.
                        </p>
                    </div>
                )}
            </div>

            {/* Sales History */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">

                {/* Header & Date Range */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-lime-100 rounded-lg">
                                <TrendingDown size={24} className="text-lime-600" />
                            </div>
                            <div>
                                <h2 className="font-bold text-xl text-gray-800">Historial de Ventas</h2>
                                <p className="text-xs text-gray-500">Consulta y exporta tus ventas</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            {/* Mode Selector */}
                            <div className="flex bg-gray-100 p-1 rounded-xl w-fit border border-gray-200">
                                <button
                                    onClick={() => setDateMode('today')}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${dateMode === 'today' ? 'bg-white text-lime-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Hoy
                                </button>
                                <button
                                    onClick={() => setDateMode('range')}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${dateMode === 'range' ? 'bg-white text-lime-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Rango
                                </button>
                            </div>

                            {/* Date Inputs */}
                            <div className="flex items-center gap-2 text-sm">
                                <Calendar size={16} className="text-gray-400" />
                                {dateMode === 'today' ? (
                                    <div className="bg-lime-50 text-lime-700 px-3 py-2 rounded-lg font-bold border border-lime-200">
                                        Fecha: {formatDateAR(currentDate)}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={e => setStartDate(e.target.value)}
                                            className="border-2 border-gray-300 rounded-lg px-3 py-2 bg-white hover:border-lime-400 focus:border-lime-500 focus:ring-2 focus:ring-lime-200 outline-none transition-all text-sm font-medium"
                                        />
                                        <span className="text-gray-400 font-medium">→</span>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={e => setEndDate(e.target.value)}
                                            className="border-2 border-gray-300 rounded-lg px-3 py-2 bg-white hover:border-lime-400 focus:border-lime-500 focus:ring-2 focus:ring-lime-200 outline-none transition-all text-sm font-medium"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Total Card */}
                    <div className="bg-gradient-to-br from-lime-500 to-lime-600 px-6 py-4 rounded-2xl shadow-lg flex flex-col items-end min-w-[200px]">
                        <div className="flex items-center gap-2 mb-1">
                            <DollarSign size={16} className="text-lime-100" />
                            <span className="text-xs font-bold text-lime-100 uppercase tracking-wider">Total Ventas</span>
                        </div>
                        <span className="text-3xl font-black text-white drop-shadow-sm">{formatCurrency(totalAmount)}</span>
                        <div className="flex items-center gap-1 mt-1">
                            <Package size={12} className="text-lime-200" />
                            <span className="text-xs text-lime-100 font-medium">{filteredSales.length} productos</span>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                {filteredSales.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-gray-200">
                        <button
                            onClick={exportToPDF}
                            className="text-sm text-lime-700 bg-lime-50 hover:bg-lime-100 font-semibold px-4 py-2 border-2 border-lime-300 rounded-lg transition-all flex items-center gap-2 shadow-sm hover:shadow"
                        >
                            <FileDown size={16} />
                            Exportar PDF
                        </button>
                        <button
                            onClick={handleDeleteAll}
                            className="text-sm text-red-600 bg-red-50 hover:bg-red-100 font-semibold px-4 py-2 border-2 border-red-300 rounded-lg transition-all flex items-center gap-2 shadow-sm hover:shadow"
                        >
                            <Trash2 size={16} />
                            Eliminar Visible
                        </button>
                    </div>
                )}

                {/* Sales List */}
                {filteredSales.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="inline-flex p-4 bg-gray-100 rounded-full mb-4">
                            <TrendingDown size={48} className="text-gray-300" />
                        </div>
                        <p className="text-lg font-medium text-gray-400 mb-1">No hay ventas registradas</p>
                        <p className="text-sm text-gray-400">en el periodo seleccionado</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredSales.map(sale => (
                            <div key={sale.id} className="flex justify-between items-center p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200 group hover:border-lime-300 hover:shadow-md transition-all">
                                <div className="flex-1">
                                    <span className="font-semibold text-gray-800 block mb-1">{sale.productName}</span>
                                    <div className="flex items-center gap-2">
                                        <Calendar size={12} className="text-gray-400" />
                                        <span className="text-xs text-gray-500">{sale.date}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col items-end">
                                        <span className="font-bold text-lg text-lime-700">{sale.amount ? formatCurrency(sale.amount) : '-'}</span>
                                        <div className="flex items-center gap-1">
                                            <Package size={12} className="text-gray-400" />
                                            <span className="text-xs text-gray-500">{sale.quantity} u.</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteSale(sale.id)}
                                        className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                        title="Eliminar venta"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SalesView;
