
/**
 * Returns the conversion factor between two units.
 * Multiply the old quantity by this factor to get the new quantity.
 */
export const getConversionFactor = (oldUnit: string | undefined, newUnit: string): number => {
    const from = (oldUnit || 'unidad').toLowerCase();
    const to = newUnit.toLowerCase();

    if (from === to) return 1;

    // --- WEIGHT ---
    if (from === 'kg' && to === 'g') return 1000;
    if (from === 'g' && to === 'kg') return 0.001;

    // --- VOLUME ---
    if (from === 'lt' && to === 'ml') return 1000;
    if (from === 'ml' && to === 'lt') return 0.001;

    // Default: No conversion known
    return 1;
};
