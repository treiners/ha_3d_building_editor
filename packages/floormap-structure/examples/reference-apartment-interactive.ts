import { readFileSync, writeFileSync } from "node:fs";
import { generateFloorGeometry } from "../src/generation/GeometryPipeline.js";
import type { Connector } from "../src/model/Connector.js";
import type { Room } from "../src/model/Room.js";
import type { WindowOpening } from "../src/model/WindowOpening.js";
import { buildInspectionModel } from "../src/interaction/InspectionModel.js";
import { renderInteractiveInspectionHtml } from "../src/interaction/InteractiveSvgDocument.js";
import { renderFloorSvg } from "../src/svg/SvgRenderer.js";

interface BuildingFile { building:{name?:string;floors:Array<{rooms:Room[];connectors?:Connector[];openings?:WindowOpening[]}>} }
const input=process.argv[2]??"examples/reference-apartment-v1.2.json";
const output=process.argv[3]??"examples/reference-apartment-interactive.html";
const document=JSON.parse(readFileSync(input,"utf8")) as BuildingFile;
const source=document.building.floors[0];if(!source)throw new Error("No floor found.");
const floor=generateFloorGeometry(source.rooms);
const windows=(source.openings??[]).filter((opening)=>opening.type==="window");
const svg=renderFloorSvg(source.rooms,floor,{title:document.building.name??"Reference Apartment",showBoundaryIds:false});
const model=buildInspectionModel(source.rooms,floor,source.connectors??[],windows);
writeFileSync(output,renderInteractiveInspectionHtml(svg,model,document.building.name??"Interactive Apartment"),"utf8");
console.log(`Generated ${output} with ${model.records.length} inspectable records.`);
