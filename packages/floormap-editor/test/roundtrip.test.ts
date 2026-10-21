import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { migrate, mapOnlyMissing } from '../src/core.js';
import { floorsSplit, floorsAdd, floorsSwitch } from '../src/floors.js';
import { savedGraph } from '../src/save.js';
import { stairsAdd } from '../src/stairs.js';
import { checkContract } from '../src/contract.js';

const ref = (): any => JSON.parse(readFileSync(new URL('../../../shared/reference-home-connectors.json', import.meta.url), 'utf8'));
/** what the editor does when a file is loaded (generate / Load): migrate, place rooms without layout, split floors */
const load = (raw: any): any => { const g: any = migrate(raw); mapOnlyMissing(g); return floorsSplit(g); };

describe('round trip: load -> save -> load -> save gives the same file', () => {
  it('reference home (single floor)', () => {
    const s1 = savedGraph(load(ref())), s2 = savedGraph(load(s1));
    assert.deepEqual(s2, s1); assert.equal(s1.floors, undefined); assert.equal(s1._fl, undefined);
  });
  it('saving does not change what is loaded: the saved file keeps every room, connector and relationship of the reference home', () => {
    const r = ref(), s = savedGraph(load(r));
    assert.deepEqual(s.rooms.map((x: any) => x.id).sort(), r.rooms.map((x: any) => x.id).sort());
    assert.equal(s.relationships.length, r.relationships.length);
    assert.equal(s.rooms.flatMap((x: any) => x.connectors).length, r.rooms.flatMap((x: any) => x.connectors).length);
  });
  it('the reference home has no contract errors after saving', () => {
    assert.deepEqual(checkContract(savedGraph(load(ref()))).errors, []);
  });
  it('two floors (copy of the house + north + stairs link): second round trip identical, floors keep order, height and elevation, no working keys', () => {
    let g = load(ref()); g.northDegrees = 35;
    g = floorsAdd({ graph: g, copy: true, name: 'Upper' });
    g = stairsAdd({ graph: g, x: 2, y: 2 });
    const s1 = savedGraph(g), s2 = savedGraph(load(s1));
    assert.deepEqual(s2, s1); assert.deepEqual(s1.floors.map((f: any) => f.name), ['Floor 1', 'Upper']); assert.deepEqual(s1.floors.map((f: any) => f.elevation), [0, 2.52]);
    assert.equal(s1.northDegrees, 35); assert.equal(s1.stairs.length, 1); assert.ok('fromRoom' in s1.stairs[0] && 'toRoom' in s1.stairs[0]); assert.equal(s1._fl, undefined); assert.equal(new Set(s1.rooms.map((r: any) => r.id)).size, s1.rooms.length);
    assert.deepEqual(checkContract(s1).errors, []);
  });
  it('switching floors before saving does not change the file', () => {
    let g = floorsAdd({ graph: load(ref()), copy: true }); const a = savedGraph(g); g = floorsSwitch(g, 'floor-1');
    assert.deepEqual(savedGraph(g), a);
  });
});
