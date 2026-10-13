export function createHistory(limit = 100) {
    const past = [], future = [];
    return {
        push(before) { past.push(before); future.length = 0; while (past.length > limit)
            past.shift(); },
        undo(current) { const s = past.pop(); if (s === undefined)
            return null; future.push(current); return s; },
        redo(current) { const s = future.pop(); if (s === undefined)
            return null; past.push(current); return s; },
        clear() { past.length = 0; future.length = 0; },
        canUndo() { return past.length > 0; },
        canRedo() { return future.length > 0; },
    };
}
