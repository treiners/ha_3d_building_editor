import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderSvgConnectors, svgConnectorStyles } from "../src/svg/SvgConnectorRenderer.js";
import type { RenderedConnector } from "../src/model/RenderedConnector.js";

const transform={x:(value:number)=>value*10,y:(value:number)=>value*10};
function connector(type:RenderedConnector["type"]):RenderedConnector{return{id:`rendered:${type}`,connectorId:type,type,roomA:"a",boundaryA:"a-b0",start:{x:1,y:2},end:{x:3,y:2},centre:{x:2,y:2},width:2,rotationDegrees:0};}

describe("renderSvgConnectors",()=>{
  it("renders a door connector",()=>{const svg=renderSvgConnectors([connector("door")],transform);assert.match(svg,/connector-door/);assert.match(svg,/x1="10" y1="20" x2="30" y2="20"/);});
  it("renders an external door connector",()=>{assert.match(renderSvgConnectors([connector("external-door")],transform),/connector-external-door/);});
  it("renders an open passage connector",()=>{assert.match(renderSvgConnectors([connector("open-passage")],transform),/connector-open-passage/);});
  it("provides styles for all connector types",()=>{assert.match(svgConnectorStyles,/connector-door/);assert.match(svgConnectorStyles,/connector-open-passage/);});
});
