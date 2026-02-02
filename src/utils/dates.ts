/**
 * Utilidades para manejo de fechas con zona horaria de Argentina (UTC-3)
 * ESTRATEGIA: CÁLCULO MANUAL (Offset fijo de -3 horas)
 * Esto evita depender de la configuración regional del navegador o de Intl API si falla.
 */

// Argentina es UTC-3 fijo
const AR_OFFSET_HOURS = -3;

/**
 * Retorna un objeto Date ajustado tal que sus métodos UTC devuelven la hora local de AR.
 */
const getArDateObject = (baseDate: Date = new Date()): Date => {
    // Obtenemos el timestamp UTC real
    const utcTimestamp = baseDate.getTime();
    // Ajustamos por el offset (-3 horas en ms)
    const shiftedTimestamp = utcTimestamp + (AR_OFFSET_HOURS * 60 * 60 * 1000);
    // Retornamos una nueva fecha con ese timestamp desplazado
    return new Date(shiftedTimestamp);
};

/**
 * Obtiene la fecha actual en Argentina en formato YYYY-MM-DD
 * Usa cálculo matemático directo sobre UTC.
 */
export const getCurrentDateAR = (): string => {
    // 1. Obtener fecha desplazada
    const arDate = getArDateObject();

    // 2. Leer componentes UTC (que ahora corresponden a la hora local AR)
    const year = arDate.getUTCFullYear();
    const month = String(arDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(arDate.getUTCDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

/**
 * Obtiene la fecha y hora actual en Argentina como objeto Date
 * (Aproximación para compatibilidad con librerías que esperan Date)
 */
export const getCurrentDateTimeAR = (): Date => {
    return new Date(getCurrentDateAR() + 'T00:00:00');
};

/**
 * Formatea una fecha YYYY-MM-DD a DD/MM/YYYY
 */
export const formatDateAR = (dateStr: string): string => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
};

/**
 * Formatea una fecha timestamp o Date a string fecha/hora AR
 */
export const formatDateTimeAR = (timestamp: number | Date): string => {
    const baseDate = new Date(timestamp);
    const arDate = getArDateObject(baseDate);

    const day = String(arDate.getUTCDate()).padStart(2, '0');
    const month = String(arDate.getUTCMonth() + 1).padStart(2, '0');
    const year = arDate.getUTCFullYear();
    const hours = String(arDate.getUTCHours()).padStart(2, '0');
    const minutes = String(arDate.getUTCMinutes()).padStart(2, '0');

    return `${day}/${month}/${year}, ${hours}:${minutes}`;
};

/**
 * Obtiene el año actual en Argentina
 */
export const getCurrentYearAR = (): string => {
    const arDate = getArDateObject();
    return String(arDate.getUTCFullYear());
};

/**
 * Suma o resta días a una fecha YYYY-MM-DD
 * Operamos puramente sobr strings/UTC para evitar shifts raros
 */
export const addDays = (dateStr: string, days: number): string => {
    if (!dateStr) return getCurrentDateAR();

    const [y, m, d] = dateStr.split('-').map(Number);
    // Usamos UTC para la aritmética segura (mediodía para evitar bordes)
    const date = new Date(Date.UTC(y, m - 1, d, 12));
    date.setUTCDate(date.getUTCDate() + days);

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

/**
 * Obtiene un rango de fechas entre dos fechas (inclusive)
 */
export const getDateRange = (startDate: string, endDate: string): string[] => {
    const dates: string[] = [];
    let current = startDate;
    let safeguard = 0;

    while (current <= endDate && safeguard < 365) {
        dates.push(current);
        current = addDays(current, 1);
        safeguard++;
    }

    return dates;
};

/**
 * Obtiene fecha de ayer en formato YYYY-MM-DD dada una fecha
 */
export const getYesterday = (dateStr: string): string => {
    return addDays(dateStr, -1);
};
