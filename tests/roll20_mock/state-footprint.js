'use strict';

// Diagnostic only: inspect the existing namespace without changing storage or values.
function serializedSize(value) {
    const json = JSON.stringify(value);
    return { utf8Bytes: Buffer.byteLength(json, 'utf8'), utf16CodeUnits: json.length };
}

function measureStateFootprint(namespace) {
    if (!namespace || !namespace.characters) { throw new Error('A managed importer namespace is required.'); }
    const ids = Object.keys(namespace.characters);
    if (!ids.length) { throw new Error('Measure after importing at least one managed Character.'); }
    const total = serializedSize(namespace);
    const fixed = serializedSize(Object.assign({}, namespace, { characters: {} }));
    const entries = ids.map((id) => {
        const manifest = namespace.characters[id];
        const size = serializedSize(manifest);
        // Include the Character-ID key and colon, without the outer braces or commas.
        const entrySize = serializedSize({ [id]: manifest });
        return { characterId: id, name: manifest.baseline && manifest.baseline.character.name,
            ...size, entryUtf8Bytes: entrySize.utf8Bytes - 2, entryUtf16CodeUnits: entrySize.utf16CodeUnits - 2 };
    });
    const averageEntryBytes = entries.reduce((sum, entry) => sum + entry.entryUtf8Bytes, 0) / ids.length;
    const averageEntryUnits = entries.reduce((sum, entry) => sum + entry.entryUtf16CodeUnits, 0) / ids.length;
    const largest = entries.reduce((best, entry) => entry.utf8Bytes > best.utf8Bytes ? entry : best);
    return {
        measurementVersion: 1,
        namespace: 'state.D35StatblockImporter',
        serialization: 'Compact JSON.stringify; UTF-8 bytes and JavaScript UTF-16 code units',
        managedCharacters: ids.length,
        total,
        averageStatePerCharacter: { utf8Bytes: total.utf8Bytes / ids.length, utf16CodeUnits: total.utf16CodeUnits / ids.length },
        averageCharacterEntry: { utf8Bytes: averageEntryBytes, utf16CodeUnits: averageEntryUnits },
        largestManifest: { characterId: largest.characterId, name: largest.name,
            utf8Bytes: largest.utf8Bytes, utf16CodeUnits: largest.utf16CodeUnits },
        lastReport: serializedSize(namespace.lastReport),
        fixedNamespaceAndReportOverhead: fixed,
        projection: {
            description: 'Rough linear projection, not a guaranteed Roll20 limit or measured capacity',
            formula: 'fixed namespace/report overhead + N * mean Character entry size + (N - 1) JSON commas',
            assumptions: 'Same creature/plan mix, ID lengths, latest report and verified post-update journals; no pending failures or additional history',
            estimates: [50, 100, 200].map((n) => ({ managedCharacters: n,
                utf8Bytes: Math.round(fixed.utf8Bytes + n * averageEntryBytes + n - 1),
                utf16CodeUnits: Math.round(fixed.utf16CodeUnits + n * averageEntryUnits + n - 1) }))
        }
    };
}

module.exports = { measureStateFootprint };
