
import React, { useState, useMemo, useEffect } from 'react';
import { Product, DailyEntry, Category, Sale } from '../types';
import { Calendar, Filter, FileSpreadsheet, Download, TrendingDown, Search } from 'lucide-react';
import { generateReport, exportToCSV, downloadCSV, exportToPDF, ReportRow } from '../src/services/reports';
import { getSalesForDate } from '../src/services/sales';
import { getCurrentDateAR, addDays, getDateRange } from '../src/utils/dates';
import { SALES_CATEGORIES } from '../constants';

interface Props {
  products: Product[];
  entries: DailyEntry[];
  categories: Category[];
  currentDate: string;
}

const ReportsView: React.FC<Props> = ({ products, entries, categories, currentDate }) => {
  // Get today by default (or current selected date)
  const getDefaultDates = () => {
    const end = currentDate;
    const start = end; // Just today
    return { start, end };
  };

  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [selectedCat, setSelectedCat] = useState('');
  const [sales, setSales] = useState<Sale[]>([]);
  const [reportMode, setReportMode] = useState<'standard' | 'sales'>('standard');
  const [filterType, setFilterType] = useState<'single' | 'range'>('single');
  const [showFilters, setShowFilters] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentInventoryType, setCurrentInventoryType] = useState<'cocina' | 'local'>('cocina');

  // Fetch all sales for the date range
  useEffect(() => {
    setSelectedCat('');
    if (currentInventoryType === 'local') {
      setReportMode('sales');
    }
  }, [currentInventoryType]);

  useEffect(() => {
    const fetchSales = async () => {
      const dates = getDateRange(startDate, endDate);
      const allSales: Sale[] = [];

      for (const date of dates) {
        const dateSales = await getSalesForDate(date);
        allSales.push(...dateSales);
      }

      setSales(allSales);
    };

    fetchSales();
  }, [startDate, endDate]);

  const reportDataFlat = useMemo(() => {
    // Explicitly filter based on the current inventory type
    let filteredProducts: Product[] = [];
    let filteredCategories: Category[] = [];

    if (currentInventoryType === 'cocina') {
      filteredProducts = products.filter(p => !p.inventoryType || p.inventoryType === 'cocina');
      filteredCategories = categories.filter(c => !c.inventoryType || c.inventoryType === 'cocina');
    } else {
      filteredProducts = products.filter(p => p.inventoryType === 'local');
      filteredCategories = categories.filter(c => c.inventoryType === 'local');
    }

    // console.log(`Stats: Type=${currentInventoryType}, Cats=${filteredCategories.length}, Prods=${filteredProducts.length}`);

    const rawData = generateReport(startDate, endDate, filteredProducts, filteredCategories, entries, sales, selectedCat);

    // Filter out products without a valid category or that result in empty category names
    // This is crucial: if a product exists but its category was filtered out (because type mismatch), 
    // generateReport might return it with no category name (if utilizing products list).
    // But since we pass filteredProducts AND filteredCategories, it should be clean.
    const filteredData = rawData.filter(row => {
      const cat = row.categoryName || 'SIN CATEGORIA';
      return cat.toUpperCase() !== 'SIN CATEGORIA' && cat.toUpperCase() !== 'SIN CATEGORÍA';
    });

    if (reportMode === 'sales') {
      return filteredData.filter(row => (currentInventoryType === 'local') || SALES_CATEGORIES.includes(row.categoryName.toUpperCase()));
    }
    return filteredData;
  }, [startDate, endDate, products, categories, entries, sales, selectedCat, reportMode, currentInventoryType]);

  const groupedData = useMemo<Record<string, ReportRow[]>>(() => {
    const groups: { [key: string]: ReportRow[] } = {};
    reportDataFlat.forEach(row => {
      const cat = row.categoryName || 'SIN CATEGORIA';
      // Filter out unwanted categories
      if (cat.toUpperCase() === 'SIN CATEGORIA' || cat.toUpperCase() === 'SIN CATEGORÍA') return;

      // Filter by Search Term
      if (searchTerm && !row.productName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return;
      }

      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(row);
    });
    // Sort categories alphabetically
    return Object.fromEntries(Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)));
  }, [reportDataFlat, searchTerm, currentInventoryType]);

  const dates = useMemo(() => getDateRange(startDate, endDate), [startDate, endDate]);

  // Categories that show sales
  const selectedCategory = categories.find(c => c.id === selectedCat);
  const showSales = reportMode === 'sales' && (currentInventoryType === 'local' || (!selectedCat || (selectedCategory && SALES_CATEGORIES.includes(selectedCategory.name.toUpperCase()))));

  const handleExportCSV = () => {
    const csv = exportToCSV(reportDataFlat, dates, showSales);
    const filename = `reporte_${reportMode}_${startDate}_${endDate}.csv`;
    downloadCSV(csv, filename);
  };

  const handleExportPDF = () => {
    exportToPDF(reportDataFlat, dates, showSales, startDate, endDate);
  };

  const handleSingleDateChange = (date: string) => {
    setStartDate(date);
    setEndDate(date);
  };

  return (
    <div className="p-2 md:p-4 flex flex-col gap-3 max-w-6xl mx-auto w-full">
      {/* Inventory Type Toggle */}
      <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner border border-gray-200 gap-1">
        <button
          onClick={() => setCurrentInventoryType('cocina')}
          className={`flex-1 py-2 px-3 rounded-lg font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${currentInventoryType === 'cocina' ? 'bg-white text-gray-800 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200/50'}`}
        >
          Cocina
        </button>
        <button
          onClick={() => setCurrentInventoryType('local')}
          className={`flex-1 py-2 px-3 rounded-lg font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${currentInventoryType === 'local' ? 'bg-white text-gray-800 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200/50'}`}
        >
          Local
        </button>
      </div>



      {/* Filters (Collapsible) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden text-sm">
        <div
          className="p-3 flex justify-between items-center cursor-pointer bg-gray-50/50 hover:bg-gray-50 transition-colors"
          onClick={() => setShowFilters(!showFilters)}
        >
          <h2 className="font-bold text-gray-800 text-sm flex items-center gap-2">
            <Filter size={16} className={reportMode === 'sales' ? "text-lime-500" : "text-blue-500"} />
            Filtros
          </h2>
          <div className="flex gap-2 items-center">
            <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setFilterType('single')}
                className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${filterType === 'single' ? 'bg-white text-gray-800 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Día
              </button>
              <button
                onClick={() => setFilterType('range')}
                className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${filterType === 'range' ? 'bg-white text-gray-800 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Rango
              </button>
            </div>
            {showFilters ? <div className="text-gray-400 text-xs">▲</div> : <div className="text-gray-400 text-xs">▼</div>}
          </div>
        </div>

        {showFilters && (
          <div className="p-3 flex flex-col gap-3 border-t border-gray-200 animate-in slide-in-from-top-2 duration-200">

            {filterType === 'single' ? (
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Fecha</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleSingleDateChange(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-bold text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none transition-shadow"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Desde</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1.5 text-xs font-bold text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none transition-shadow"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Hasta</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1.5 text-xs font-bold text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none transition-shadow"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Rubro</label>
              <select
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-bold text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none transition-shadow"
              >
                <option value="">TODOS</option>
                {categories.filter(c =>
                  currentInventoryType === 'cocina'
                    ? (!c.inventoryType || c.inventoryType === 'cocina')
                    : c.inventoryType === 'local'
                ).map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
              </select>
            </div>

            {/* Search Bar */}
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Buscar</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                  <Search className="h-3.5 w-3.5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg leading-tight bg-gray-50 text-gray-800 placeholder-gray-400 focus:ring-1 focus:ring-blue-500 text-xs font-bold transition-colors outline-none"
                  placeholder="Nombre del producto..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={handleExportCSV}
                className="flex-1 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
              >        <FileSpreadsheet size={14} />
                Excel
              </button>
              <button
                onClick={handleExportPDF}
                className="flex-1 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
              >        <Download size={14} />
                PDF
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 overflow-x-auto">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-gray-400 uppercase text-xs tracking-wider">
            {reportMode === 'sales' ? `Reporte Ventas (${currentInventoryType})` : `Reporte General (${currentInventoryType})`}
          </h3>
          <span className={`text-[10px] font-bold px-3 py-1 rounded-full text-white ${reportMode === 'sales' ? 'bg-lime-500 shadow-sm shadow-lime-200' : 'bg-blue-500 shadow-sm shadow-blue-200'}`}>
            {reportDataFlat.length} PRODUCTOS
          </span>
        </div>

        {reportDataFlat.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center gap-2">
            <FileSpreadsheet className="text-gray-200" size={48} />
            <p className="text-gray-400 text-sm font-medium">No hay datos para este rango</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse text-gray-800">
              <thead>
                <tr className="border-b-2 border-gray-100">
                  <th className="sticky left-0 bg-white p-2 text-left font-black text-gray-400 uppercase border-r-2 border-gray-100 z-10">
                    Producto
                  </th>
                  {dates.map(date => {
                    const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('es-AR', {
                      timeZone: 'America/Argentina/Buenos_Aires',
                      day: '2-digit',
                      month: '2-digit'
                    });
                    const cols = showSales ? 5 : 4;
                    return (
                      <th key={date} className="p-1 border-r border-gray-100 min-w-[85px] sm:min-w-[100px]" colSpan={1}>
                        <div className="font-black text-gray-400 text-center mb-1 text-[10px] sm:text-xs">{formattedDate}</div>
                        <div
                          className="grid gap-px text-[7px] sm:text-[8px] font-black uppercase bg-gray-50 rounded text-gray-400 py-0.5 border border-gray-100"
                          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                        >
                          <span className="text-center" title="Stock">S</span>
                          <span className="text-center" title="Ingreso">I</span>
                          {showSales && <span className="text-center text-lime-500" title="Ventas">V</span>}
                          <span className="text-center" title="Día Siguiente">DS</span>
                          <span className="text-center" title="Diferencia">D</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {(Object.entries(groupedData) as [string, ReportRow[]][]).map(([catName, rows]) => (
                  <React.Fragment key={catName}>
                    {/* Category Header Row */}
                    <tr className="bg-gray-50/50 border-y-2 border-gray-100">
                      <td colSpan={1 + dates.length} className="p-3 font-black text-blue-500 text-xs uppercase tracking-[0.2em] bg-gray-50/50 sticky left-0 z-10">
                        📁 {catName}
                      </td>
                    </tr>
                    {/* Repeated Header Row for Category */}
                    <tr className="bg-white border-b border-gray-100">
                      <th className="p-2 text-left font-black text-gray-400 uppercase text-[10px] tracking-wider border-r border-gray-100">
                        Producto
                      </th>
                      {dates.map(date => {
                        const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('es-AR', {
                          timeZone: 'America/Argentina/Buenos_Aires',
                          day: '2-digit',
                          month: '2-digit'
                        });
                        const cols = showSales ? 5 : 4;
                        return (
                          <th key={date} className="p-0.5 border-r border-gray-100 min-w-[85px] sm:min-w-[100px]">
                            {filterType === 'range' && (
                              <div className="text-[8px] sm:text-[9px] text-gray-400 text-center mb-0.5 font-bold">{formattedDate}</div>
                            )}
                            <div
                              className="grid gap-px text-[7px] sm:text-[8px] font-black uppercase bg-gray-50 rounded text-gray-400 py-0.5 border border-gray-100"
                              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                            >
                              <span className="text-center" title="Stock">S</span>
                              <span className="text-center" title="Ingreso">I</span>
                              {showSales && <span className="text-center text-lime-500" title="Ventas">V</span>}
                              <span className="text-center" title="Día Siguiente">DS</span>
                              <span className="text-center" title="Diferencia">D</span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                    {rows.map(row => (
                      <tr key={row.productId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="sticky left-0 bg-white p-2 font-semibold text-gray-700 border-r-2 border-gray-100 z-10 min-w-[120px]">
                          {row.productName}
                          {row.product?.unit && (
                            <span className="text-gray-400 font-normal text-xs ml-1">({row.product.unit})</span>
                          )}
                        </td>
                        {dates.map(date => {
                          const data = row.dates[date];
                          const cols = showSales ? 5 : 4;
                          return (
                            <td key={date} className="border-r border-gray-100 px-1 py-2">
                              <div
                                className="grid gap-0 text-[10px] items-center"
                                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                              >
                                <span className="text-center font-medium text-gray-400">{data.stock}</span>
                                <span className="text-center font-medium text-green-600">{data.ingreso}</span>
                                {showSales && <span className="text-center font-medium text-lime-600">{data.ventas}</span>}
                                <span className={`text-center font-bold ${data.diaSiguiente < 0 ? 'text-red-500' : 'text-gray-800'}`}>{data.diaSiguiente}</span>
                                <span className={`text-center font-black ${data.diferencia > 0 ? 'text-green-500' :
                                  data.diferencia < 0 ? 'text-red-500' :
                                    'text-gray-300'
                                  }`}>
                                  {data.diferencia > 0 ? '+' : ''}{data.diferencia}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg p-3 text-xs border border-gray-200">
        <div className="font-bold text-gray-800 mb-2">Leyenda:</div>
        <div className="grid grid-cols-2 gap-2 text-gray-500">
          <div><span className="font-bold">S:</span> Stock</div>
          <div><span className="font-bold">I:</span> Ingreso</div>
          {showSales && <div><span className="font-bold text-lime-600">V:</span> Ventas</div>}
          <div><span className="font-bold">DS:</span> Día Siguiente</div>
          <div><span className="font-bold">Dif:</span> Diferencia</div>
        </div>
      </div>
    </div>
  );
};

export default ReportsView;
