/**
 * Rename a room (v3.2). Pure and embedded into the editor page with toString(): no imports of values, helpers live inside the function.
 * The id never changes, so connectors, relationships, joints, entities and objects keep pointing at the room. Rules: the name is trimmed
 * and its spaces collapsed, 1 to 40 characters, unique among the rooms of the floor that is being edited (case-insensitive; the same name
 * on two floors is fine), and `Outside` (the hidden room, found by its name) can neither be renamed nor taken as a name.
 */
export function renameRoom<G extends { rooms: { id: string; name: string }[] }>(input: { graph: G; roomId: string; name: string }): { graph: G; ok: boolean; message: string; id: string } {
  const g0 = input.graph, id = input.roomId, bad = (m: string) => ({ graph: g0, ok: false, message: m, id });
  const r0 = g0.rooms.find((r) => r.id === id);
  if (!r0) return bad('No such room.');
  const name = String(input.name ?? '').replace(/\s+/g, ' ').trim();
  if (r0.name.toLowerCase() === 'outside') return bad('The Outside room cannot be renamed.');
  if (!name) return bad('The name must not be empty.');
  if (name.length > 40) return bad('The name must be at most 40 characters.');
  if (name.toLowerCase() === 'outside') return bad('The name Outside is reserved for the area around the house.');
  if (name === r0.name) return { graph: g0, ok: true, message: 'Name unchanged.', id };
  if (g0.rooms.some((r) => r.id !== id && r.name.toLowerCase() === name.toLowerCase())) return bad('Another room is already called ' + name + '.');
  const g = JSON.parse(JSON.stringify(g0)) as G;
  g.rooms.find((r) => r.id === id)!.name = name;
  return { graph: g, ok: true, message: 'Renamed ' + r0.name + ' to ' + name + '.', id };
}
