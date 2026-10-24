/**
 * The shape of the floor-plan file, in one place (refactoring step 3, docs/REFACTORING-LOG.md).
 *
 * Three levels, from the file on disk to what the editor holds while you work:
 *   Graph          the original 2.14 core (rooms, relationships, wall alignments, joints, building values), defined in core.ts
 *   FloorplanGraph the SAVED file: Graph plus the optional parts added since (floors, stairs, areas, entities, north)
 *   WorkingGraph   what the editor keeps in memory: FloorplanGraph plus `_fl`, the stash of the floors that are not shown;
 *                  `floorsMerge` / `savedGraph` turn it back into a FloorplanGraph (so `_fl` never reaches the file)
 *
 * Only TYPES live here (erased by tsc), so the pure modules that are embedded with `toString()` are not affected.
 * The base types (Graph, Room, Port, Link, Alignment, Layout, Side) are imported from core.ts for now and move here
 * in a later slice. New optional fields only: files without them behave as before.
 * Coordinates: metres, x right, y down, one frame for all floors.
 */
import type { Graph, Room, Link, Alignment, Layout } from './core.js';

/** Version of the file format. '3.0' is written; '2.14' files are read and upgraded on load (no data changes: everything newer is optional). */
export type SchemaVersion = '2.14' | '3.0';

/** A room as saved when floors are used: `floor` is the id of its floor (absent = the first floor). */
export type FloorRoom = Room & { floor?: string };

/** One storey. `height` = floor-to-ceiling metres, `elevation` = metres of the floor surface above the lowest floor. */
export interface Floor { id: string; name: string; height?: number; elevation?: number }

/** Stairs: a rectangle seen from above that connects two floors directly above each other. See stairs.ts for the bar rules. */
export interface Stair {
  id: string; name?: string;
  /** Ids of the lower and the upper floor. */
  lower: string; upper: string;
  /** Top-left corner of the rectangle in plan metres. `length` runs along `direction`, `width` across it. */
  x: number; y: number; length: number; width: number;
  /** The way the stair climbs, seen on the plan: right = +x, left = -x, up = -y (north), down = +y. */
  direction: 'right' | 'left' | 'up' | 'down';
  /** Derived on save (`stairsFill`): the room under the middle of the bar on the lower / upper floor, null = none. */
  fromRoom?: string | null; toRoom?: string | null;
}

/** An outside area (deck, driveway, garden, pond, path): a labelled footprint that is not part of the room graph. */
export interface Area { id: string; name: string; kind: string; shape: 'rect' | 'ellipse'; layout: Layout }

/** Where the numbers in `entityPlacements[].position` are measured from. 'room' (default) = metres from the host's top-left corner. */
export interface EntitySettings { coordinates?: 'room' | 'plan'; gridStep?: number }

/**
 * A sensor, light, contact, ... placed in a room, an area or on a connector. Exactly one of roomId / areaId / connectorId anchors it
 * (resolution order connector, area, room). `facingDegrees` is clockwise from "up" on the plan (0 = up, 90 = right).
 */
export interface EntityPlacement {
  id: string; type: string; name?: string;
  /** Home Assistant entity id, e.g. light.living_ceiling. */
  haEntityId?: string;
  roomId?: string; areaId?: string; connectorId?: string; side?: 'A' | 'B';
  /** [x, y] in metres, see EntitySettings.coordinates. Absent for connector-bound entities. */
  position?: [number, number];
  /** Metres above the floor. */
  height?: number;
  facingDegrees?: number; fieldOfViewDegrees?: number; range?: number;
}

/** `appliance` = things that are devices (refrigerator, washing machine, ...), `furniture` = everything else. A reader may hide furniture. */
export type ObjectCategory = 'appliance' | 'furniture';

/** What an object type is: default footprint (`width` across the front, `depth` front to back), `height`, optional `elevation` (wall mounted) and `clearance` (free space needed in front, metres). Custom types are listed in `objectTypes` with their `id`. */
export interface ObjectTypeDef {
  id?: string; label: string; category: ObjectCategory;
  width: number; depth: number; height: number; elevation?: number; clearance?: number;
}

/**
 * A physical thing in a room or area: refrigerator, oven, sofa, bed. `position` = centre of the footprint in metres from the top-left corner of the
 * host (room or area), x right, y down. `facingDegrees` = direction the front points to, clockwise from up (0 = up on the plan, 90 = right).
 * Width / depth / height / elevation / category default to the type; `Save graph` writes them explicitly.
 */
export interface ObjectPlacement {
  id: string; type: string; name?: string;
  roomId?: string; areaId?: string;
  position: [number, number];
  facingDegrees?: number;
  width?: number; depth?: number; height?: number; elevation?: number;
  category?: ObjectCategory;
}

/** What every floor stores while it is not the one being edited (see floors.ts). */
export interface FloorStash {
  rooms: FloorRoom[]; relationships: Link[]; wallAlignments: Alignment[]; entityPlacements?: EntityPlacement[]; objects?: ObjectPlacement[];
}

/** The saved file. Everything after the 2.14 core is optional. */
export type FloorplanGraph = Omit<Graph, 'schemaVersion' | 'rooms'> & {
  schemaVersion: SchemaVersion;
  rooms: FloorRoom[];
  floors?: Floor[];
  stairs?: Stair[];
  areas?: Area[];
  entityPlacements?: EntityPlacement[];
  entitySettings?: EntitySettings;
  objects?: ObjectPlacement[];
  objectTypes?: ObjectTypeDef[];
  /** Degrees the plan's "up" is rotated away from true north, 0 = absent. */
  northDegrees?: number;
};

/** The graph while editing: the current floor is in rooms / relationships / ..., the other floors are in `_fl.data`. Never saved. */
export type WorkingGraph = FloorplanGraph & { _fl?: { cur: string; data: Record<string, FloorStash> } };
