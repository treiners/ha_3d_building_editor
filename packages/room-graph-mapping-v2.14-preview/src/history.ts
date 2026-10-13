/**
 * Undo/redo for the editor. Stores opaque state strings (JSON snapshots of the graph); the graph is small,
 * so snapshots are simpler and safer than inverse operations. Self-contained for embedding into the editor HTML.
 *
 * Usage: before a change take `before = JSON.stringify(g)`; after the change, if it differs from the current state,
 * call push(before). undo(current) / redo(current) take the CURRENT state and return the state to restore (or null).
 */
export interface History {
  push(before: string): void;
  undo(current: string): string | null;
  redo(current: string): string | null;
  clear(): void;
  canUndo(): boolean;
  canRedo(): boolean;
}
export function createHistory(limit = 100): History {
  const past: string[] = [], future: string[] = [];
  return {
    push(before: string) { past.push(before); future.length = 0; while (past.length > limit) past.shift(); },
    undo(current: string) { const s = past.pop(); if (s === undefined) return null; future.push(current); return s; },
    redo(current: string) { const s = future.pop(); if (s === undefined) return null; past.push(current); return s; },
    clear() { past.length = 0; future.length = 0; },
    canUndo() { return past.length > 0; },
    canRedo() { return future.length > 0; },
  };
}
