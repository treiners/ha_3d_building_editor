import { readFileSync, writeFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { resolveConnectors } from "../src/generation/ConnectorResolver.js";
import { generateFloorGeometry } from "../src/generation/GeometryPipeline.js";
import type { Connector } from "../src/model/Connector.js";
import type { Room } from "../src/model/Room.js";
import { renderFloorSvg } from "../src/svg/SvgRenderer.js";

interface BuildingFile { building:{ name?:string; floors:Array<{ rooms:Room[]; connectors?:Connector[] }> } }
const input=process.argv[2];
if(!input){console.error("Usage: node dist/examples/json-to-svg.js <building.json> [output.svg]");process.exit(1);}
const document=JSON.parse(readFileSync(input,"utf8")) as BuildingFile;
const floorSource=document.building.floors[0];
if(!floorSource)throw new Error("Building file does not contain a floor.");
const floor=generateFloorGeometry(floorSource.rooms);
const connectors=resolveConnectors(floorSource.connectors??[],floor);
const output=process.argv[3]??input.slice(0,input.length-extname(input).length)+".svg";
const svg=renderFloorSvg(floorSource.rooms,floor,{title:document.building.name??basename(input),connectors});
writeFileSync(output,svg,"utf8");
console.log(`Generated ${output} with ${connectors.length} connector(s).`);
