// Manifest of the pure functions that are copied into the generated editor HTML.
//
// Why this exists: the browser has no module system here. Each function is serialised with
// `fn.toString()` and pasted into the page's script, so the Node tests and the browser run the
// exact same code. That only works while every function is self-contained (rules in CLAUDE.md):
//   - no imports of values and no outer-scope references; helpers live inside the function,
//   - sibling functions may be called as globals (they are all in this list),
//   - compile with plain `tsc` (esbuild keepNames injects helpers that break toString).
// test/embed.test.ts enforces this for the whole list, so a new entry cannot silently break the page.
//
// ORDER MATTERS for two reasons: tests slice the source between `function mapLayout(` and
// `function applyMap(`, and the golden-HTML test pins the exact bytes. Append new entries at the end
// of their group and update the golden file on purpose (`npm run golden:update`).
import { mapLayout } from './mapper.js';
import { createHistory } from './history.js';
import { deriveJoints } from './joints.js';
import { planMove } from './moves.js';
import { planWall, planCorner, planAlign, planClose, planFit } from './walls.js';
import { doorGeometry, doorAngle, mirrorDoor } from './door.js';
import { fillDefaults } from './defaults.js';
import { connectRooms, addRoom, removeRoom, removeConnector, addOpening } from './edit.js';
import { renameRoom } from './rename.js';
import { areaKinds, addArea, updateArea, removeArea, areaAt, validateAreas, fillAreaDefaults } from './areas.js';
import {
  entityCatalog, entityWorld, entityHost, entityHostAt, coverageSector, nearestAnchor, addEntity, moveEntity,
  updateEntity, removeEntity, validateEntities, convertEntityCoordinates, fillEntityDefaults, syncEntitySizes,
  coverageHints, entitiesInBox, moveEntities, removeEntities, pasteEntities, alignEntities, updateEntities, entityObjectFrame, entitySuggestions, entityClamp,
} from './entities.js';
import { shiftOrigin } from './origin.js';
import { objectCatalog, objectDefs, objectFootprint, objectHost, objectHostAt, objectClamp, addObject, moveObject, updateObject, removeObject, validateObjects, fillObjectDefaults, objectClearance, objectSnap, addObjectType, updateObjectType, removeObjectType } from './objects.js';
import {
  outlineFromRect, outlineBounds, outlineArea, outlineNormalize, outlineIssues, outlinePoint, outlineGrid, outlineHasRect, outlineOverlapArea, outlineCombine, outlineWalls, outlineWallAt, outlineLabelRect, outlineNearest, outlineMoveWall, outlineBump, outlineThin,
} from './shape.js';
import { shapeOfRoom, shapeWallPartner, shapeWallPartners, reshapeRoom, reshapeWithPartner, moveRoomWall, pullRoomWall, mergeRooms } from './room-shape.js';
import { areaOutlineOf, reshapeArea, moveAreaWall, pullAreaWall, mergeAreas } from './area-shape.js';
import { roomAreas, wallLabels } from './dimensions.js';
import { roomElevation, wallHeightOf, setRoomHeights, heightIssues } from './heights.js';
import { viewGesture } from './viewport.js';
import { linkConnectors, addPartner } from './link.js';
import { wallList, setWallHeights, sharedWallIssues } from './wallheights.js';
import { floorsSplit, floorsMerge, floorsSwitch, floorsAdd, floorsRemove, floorsRename, floorsGhost, floorsFill } from './floors.js';
import { stairRect, stairBar, stairsVisible, stairsAdd, stairsUpdate, stairsRemove, stairsHost, stairsFill, stairResize } from './stairs.js';
import { savedGraph } from './save.js';
import { checkContract } from './contract.js';
import { underlayInit, underlayScale } from './underlay.js';

/** One pure function that is embedded into the editor page. */
export type EmbeddedFunction = (...args: any[]) => any;

/** All embedded functions, in embedding order (see the header comment). */
export const embeddedFunctions: readonly EmbeddedFunction[] = [
  // placement and history
  mapLayout, createHistory, deriveJoints,
  // moving rooms and walls
  planMove, planWall, planCorner, planAlign, planClose, planFit,
  // doors, defaults and graph edits
  doorGeometry, doorAngle, mirrorDoor, fillDefaults,
  connectRooms, addRoom, removeRoom, removeConnector, addOpening, renameRoom,
  // areas
  areaKinds, addArea, updateArea, removeArea, areaAt, validateAreas, fillAreaDefaults,
  // entities
  entityCatalog, entityWorld, entityHost, entityHostAt, coverageSector, nearestAnchor, addEntity, moveEntity,
  updateEntity, removeEntity, validateEntities, convertEntityCoordinates, fillEntityDefaults, syncEntitySizes,
  coverageHints, entitiesInBox, moveEntities, removeEntities, pasteEntities, alignEntities, updateEntities, entityObjectFrame, entitySuggestions, entityClamp,
  // objects (appliances, furniture)
  objectCatalog, objectDefs, objectFootprint, objectHost, objectHostAt, objectClamp, addObject, moveObject, updateObject, removeObject, validateObjects, fillObjectDefaults, objectClearance, objectSnap, addObjectType, updateObjectType, removeObjectType,
  // rectilinear room shapes (outline)
  outlineFromRect, outlineBounds, outlineArea, outlineNormalize, outlineIssues, outlinePoint, outlineGrid, outlineHasRect, outlineOverlapArea, outlineCombine, outlineWalls, outlineWallAt, outlineLabelRect, outlineNearest, outlineMoveWall, outlineBump, outlineThin,
  // shape editing (Shape tool)
  shapeOfRoom, shapeWallPartner, shapeWallPartners, reshapeRoom, reshapeWithPartner, moveRoomWall, pullRoomWall, mergeRooms,
  // shaped areas
  areaOutlineOf, reshapeArea, moveAreaWall, pullAreaWall, mergeAreas,
  // dimensions and areas
  roomAreas, wallLabels,
  // heights (height from floor, wall heights)
  roomElevation, wallHeightOf, setRoomHeights, heightIssues,
  // touch gestures
  viewGesture,
  // link two existing openings
  linkConnectors, addPartner,
  // wall heights per wall (Walls mode)
  wallList, setWallHeights, sharedWallIssues,
  // site origin, floors, stairs
  shiftOrigin,
  floorsSplit, floorsMerge, floorsSwitch, floorsAdd, floorsRemove, floorsRename, floorsGhost, floorsFill,
  stairRect, stairBar, stairsVisible, stairsAdd, stairsUpdate, stairsRemove, stairsHost, stairsFill, stairResize,
  // saving, contract check, underlay
  savedGraph, checkContract, underlayInit, underlayScale,
];

/** The script text pasted into the page: every function's source, one per line break. */
export function embeddedSource(): string {
  return embeddedFunctions.map((f) => f.toString()).join('\n');
}
