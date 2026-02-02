
const fs = require('fs');

try {
    const localProducts = JSON.parse(fs.readFileSync('local_products.json', 'utf8'));
    const transfers = JSON.parse(fs.readFileSync('transfers_dump.json', 'utf8'));

    // Create a map of normalized local names
    const localNames = new Set(localProducts.map(p => p.name.trim().toLowerCase()));

    console.log("Analyzing Transfer Mismatches...");
    let mismatches = 0;

    transfers.forEach(t => {
        const tName = t.productName.trim().toLowerCase();
        if (!localNames.has(tName)) {
            console.log(`[MISMATCH] Transfer Product: "${t.productName}" (ID: ${t.productId}) NOT FOUND in local products.`);
            // Suggest close matches?
            const closeMatches = localProducts.filter(p => p.name.trim().toLowerCase().includes(tName) || tName.includes(p.name.trim().toLowerCase()));
            if (closeMatches.length > 0) {
                console.log(`    -> Possible matches in local: ${closeMatches.map(p => `"${p.name}"`).join(', ')}`);
            }
            mismatches++;
        } else {
            // console.log(`[MATCH] "${t.productName}" found.`);
        }
    });

    if (mismatches === 0) {
        console.log("All transfer products match local products!");
    } else {
        console.log(`Found ${mismatches} mismatches.`);
    }

} catch (e) {
    console.error("Error reading or parsing files:", e);
}
