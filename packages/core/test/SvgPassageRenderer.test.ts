import assert from "node:assert/strict";import{describe,it}from"node:test";import{renderSvgPassages}from"../src/svg/SvgPassageRenderer.js";
const tx={x:(v:number)=>v*10,y:(v:number)=>v*10};
describe("passage symbols",()=>{it("renders only open passages",()=>{const p:any={connectorId:"p",type:"open-passage",start:{x:0,y:0},end:{x:2,y:0}};const d:any={connectorId:"d",type:"door",start:{x:0,y:0},end:{x:1,y:0}};const s=renderSvgPassages([p,d],tx);assert.match(s,/passage-symbol/);assert.match(s,/data-inspect-id="p"/);assert.doesNotMatch(s,/data-inspect-id="d"/);});});
