import assert from"node:assert/strict";import{describe,it}from"node:test";import{renderOpeningClickTargets}from"../src/interaction/OpeningClickTargets.js";
const floor:any={boundaries:[{id:"a-b0",roomId:"a",edgeIndex:0,start:{x:0,y:0},end:{x:4,y:0},length:4}],sharedBoundaries:[],wallSegments:[]};const tx={scale:10,x:(v:number)=>v*10,y:(v:number)=>v*10};
describe("opening click targets",()=>{
 it("renders connector target metadata",()=>{const s=renderOpeningClickTargets(floor,[{id:"d",type:"door",roomA:"a",boundaryA:"a-b0",offset:1,width:1}],[],tx);assert.match(s,/data-inspect-type="connector"/);assert.match(s,/data-edit-offset="1"/);});
 it("renders window target metadata",()=>{const s=renderOpeningClickTargets(floor,[],[{id:"w",type:"window",roomId:"a",boundaryId:"a-b0",offset:2}],tx);assert.match(s,/data-inspect-type="window"/);assert.match(s,/x1="20"/);});
});
