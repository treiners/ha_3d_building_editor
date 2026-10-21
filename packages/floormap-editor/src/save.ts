/**
 * The graph exactly as *Save graph* writes it: floors merged (unique ids), every default written, floor heights / elevations filled, origin moved to the
 * top-left corner of the house. One function so the editor, the contract check and the round-trip test cannot drift apart.
 * Pure, embedded with toString(); siblings: floorsMerge, fillDefaults, fillEntityDefaults, fillAreaDefaults, floorsFill, stairsFill (needs stairsHost, stairBar, stairRect), shiftOrigin.
 */
import { floorsMerge, floorsFill } from './floors.js';
import { fillDefaults } from './defaults.js';
import { fillEntityDefaults } from './entities.js';
import { fillAreaDefaults } from './areas.js';
import { shiftOrigin } from './origin.js';
import { stairsFill } from './stairs.js';

export function savedGraph(graph: any): any {
  return shiftOrigin(stairsFill(floorsFill(fillAreaDefaults(fillEntityDefaults(fillDefaults(floorsMerge(graph)))))));
}
