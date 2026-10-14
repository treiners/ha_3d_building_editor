import assert from "node:assert/strict";import{describe,it}from"node:test";import{renderSvgDoors,svgDoorSymbolStyles}from"../src/svg/SvgDoorRenderer.js";
const tx={x:(v:number)=>v*10,y:(v:number)=>v*10};
const door:any={id:"rendered:d",connectorId:"d",type:"door",roomA:"a",boundaryA:"a-b0",start:{x:1,y:0},end:{x:2,y:0},centre:{x:1.5,y:0},width:1,rotationDegrees:0,style:"single-hinged"};
describe("door symbols",()=>{it("renders leaf, arc, and inspection metadata",()=>{const s=renderSvgDoors([door],tx);assert.match(s,/door-leaf/);assert.match(s,/door-swing/);assert.match(s,/data-inspect-id="d"/);});it("styles external doors separately",()=>assert.match(svgDoorSymbolStyles,/external-door-symbol/));});
