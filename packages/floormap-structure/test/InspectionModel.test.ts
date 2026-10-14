import assert from "node:assert/strict";import{describe,it}from"node:test";import{buildInspectionModel,selectionKey}from"../src/interaction/InspectionModel.js";
const room:any={id:"living",name:"Living Room",geometry:{shape:[[0,0],[4,0],[4,3],[0,3]]}};
const floor:any={boundaries:[{id:"living-b0",roomId:"living"}],sharedBoundaries:[],wallSegments:[{id:"wall:living-b0:0",roomId:"living",boundaryId:"living-b0",classification:"external",length:4}]};
describe("inspection model",()=>{
 it("calculates room area and relationships",()=>{const m=buildInspectionModel([room],floor,[{id:"door",type:"external-door",roomA:"living",boundaryA:"living-b0",offset:1,width:1}],[{id:"window",type:"window",roomId:"living",boundaryId:"living-b0",offset:2}]);const r=m.byKey["room:living"];assert.equal(r?.properties.area,12);assert.deepEqual(r?.properties.connectors,["door"]);assert.deepEqual(r?.properties.windows,["window"]);});
 it("indexes wall records",()=>{const m=buildInspectionModel([room],floor);assert.equal(m.byKey["wall:wall:living-b0:0"]?.properties.classification,"external");});
 it("creates stable selection keys",()=>assert.equal(selectionKey({type:"window",id:"w1"}),"window:w1"));
});
