'use strict';

// Explicit mock oracle, not proof of Roll20's live extraction/rendering behavior.
// It derives the first applicable quote from the linked Handout; no fallback prose.
function nativeFlavorText(world, journalApi, pin) {
    if (pin.get('linkType') !== 'handout' || pin.get('subLinkType') !== 'headerPlayer' ||
            pin.get('autoNotesType') !== 'blockquote' || pin.get('notesDesynced')) return '';
    const h = world.getObj('handout', pin.get('link'));
    if (!h) return '';
    const tree = journalApi.semantic(h._attrs.notes);
    const start = tree.findIndex(b => /^h[1-6]$/.test(b[0]) && b[1].map(r => r[0]).join('') === pin.get('subLink'));
    if (start < 0) return '';
    for (let i = start + 1; i < tree.length; i++) {
        if (/^h[1-6]$/.test(tree[i][0])) break;
        if (tree[i][0] === 'blockquote') return tree[i][1].map(p => p[1].map(r => r[0]).join('')).join('\n');
    }
    return '';
}

module.exports = { nativeFlavorText };
