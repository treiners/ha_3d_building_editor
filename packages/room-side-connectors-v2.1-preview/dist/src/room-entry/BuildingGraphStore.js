export const slugify = (v) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
export const createEmptyBuildingGraph = (name = "My Home") => ({ schemaVersion: "2.1", id: slugify(name), name, rooms: [], relationships: [] });
export function addRoom(g, r) { if (g.rooms.some(x => x.id === r.id))
    throw Error("Duplicate room ID."); return { ...g, rooms: [...g.rooms, r] }; }
export function addRoomConnector(g, c) { if (c.position < 0 || c.position > 1)
    throw RangeError("Position must be between 0 and 1."); if (g.rooms.flatMap(r => r.connectors).some(x => x.id === c.id))
    throw Error("Duplicate connector ID."); if (!g.rooms.some(r => r.id === c.roomId))
    throw Error("Room missing."); return { ...g, rooms: g.rooms.map(r => r.id === c.roomId ? { ...r, connectors: [...r.connectors, c] } : r) }; }
export function addConnectorRelationship(g, l) { const c = g.rooms.flatMap(r => r.connectors), a = c.find(x => x.id === l.connectorA), b = c.find(x => x.id === l.connectorB); if (!a || !b)
    throw Error("Connector missing."); if (a.roomId === b.roomId)
    throw Error("Different rooms required."); if (g.relationships.some(x => [x.connectorA, x.connectorB].includes(l.connectorA) || [x.connectorA, x.connectorB].includes(l.connectorB)))
    throw Error("Connector already linked."); return { ...g, relationships: [...g.relationships, l] }; }
export function removeConnector(g, id) { return { ...g, rooms: g.rooms.map(r => ({ ...r, connectors: r.connectors.filter(c => c.id !== id) })), relationships: g.relationships.filter(l => l.connectorA !== id && l.connectorB !== id) }; }
