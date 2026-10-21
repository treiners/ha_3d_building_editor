import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateAreas } from '../src/areas.js';
import { checkContract } from '../src/contract.js';

const room = (id: string, x: number, floor?: string): any => ({ id, name: id, ...(floor ? { floor } : {}), connectors: [], layout: { x, y: 0, width: 4, height: 3 } });
const deck = (x: number): any => ({ id: 'deck', name: 'Deck', kind: 'deck', shape: 'rect', layout: { x, y: 0, width: 3, height: 3 }, roofed: false });
const scene = (deckX: number, floors = true): any => ({ ...(floors ? { floors: [{ id: 'g', name: 'G' }, { id: 'u', name: 'U' }] } : {}), rooms: [room('a', 0, floors ? 'g' : undefined), room('up', 3, floors ? 'u' : undefined)], relationships: [], areas: [deck(deckX)] });

describe('areas lie at ground level: only rooms of the ground floor count for "overlaps room"', () => {
  it('upper room "up" (x 3..7) overhangs the deck (x 5..8): no warning when the room is on floor u', () => {
    assert.deepEqual(validateAreas(scene(5)), []);
  });
  it('the same overhang without floors (everything on one level) is still reported', () => {
    assert.deepEqual(validateAreas(scene(5, false)).map(w => [w.code, w.message]), [['overlaps-room', 'Overlaps room "up".']]);
  });
  it('deck at x 3.5..6.5 overlaps ground room a (x 0..4): reported', () => {
    assert.deepEqual(validateAreas(scene(3.5)).map(w => [w.code, w.message]), [['overlaps-room', 'Overlaps room "a".']]);
  });
  it('the contract check names the area: Area "Deck (deck)": Overlaps room "a".', () => {
    const r = checkContract(scene(3.5));
    assert.deepEqual(r.errors, []); assert.deepEqual(r.warnings.map(w => [w.code, w.message]), [['area-overlaps-room', 'Area "Deck (deck)": Overlaps room "a".']]);
  });
});
