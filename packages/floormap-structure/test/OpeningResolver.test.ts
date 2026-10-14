import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveWallOpenings } from "../src/generation/OpeningResolver.js";
import type { GeneratedFloor } from "../src/model/GeneratedFloor.js";
import type { RenderedConnector } from "../src/model/RenderedConnector.js";

const floor: GeneratedFloor = {
  boundaries: [
    { id:"a-b0",roomId:"a",edgeIndex:0,start:{x:0,y:0},end:{x:10,y:0},length:10 },
    { id:"b-b0",roomId:"b",edgeIndex:0,start:{x:10,y:0},end:{x:0,y:0},length:10 },
  ],
  sharedBoundaries: [],
  wallSegments: [
    { id:"wall:a-b0:0",boundaryId:"a-b0",roomId:"a",classification:"shared",start:{x:0,y:0},end:{x:10,y:0},length:10,localStart:0,localEnd:10 },
    { id:"wall:b-b0:0",boundaryId:"b-b0",roomId:"b",classification:"shared",start:{x:10,y:0},end:{x:0,y:0},length:10,localStart:0,localEnd:10 },
  ],
};

function connector(overrides:Partial<RenderedConnector>={}):RenderedConnector{return{
  id:"rendered:door",connectorId:"door",type:"door",roomA:"a",roomB:"b",boundaryA:"a-b0",boundaryB:"b-b0",
  start:{x:3,y:0},end:{x:5,y:0},centre:{x:4,y:0},width:2,rotationDegrees:0,...overrides,
};}

describe("resolveWallOpenings",()=>{
  it("cuts an opening from both sides of an internal wall",()=>{
    const result=resolveWallOpenings(floor,[connector()]);
    assert.equal(result.openings.length,2);
    assert.equal(result.wallSegments.length,4);
    assert.deepEqual(result.wallSegments.filter(x=>x.boundaryId==="a-b0").map(x=>x.length),[3,5]);
    assert.deepEqual(result.wallSegments.filter(x=>x.boundaryId==="b-b0").map(x=>x.length),[5,3]);
  });

  it("records deterministic opening IDs",()=>{
    const result=resolveWallOpenings(floor,[connector()]);
    assert.deepEqual(result.openings.map(x=>x.id),["opening:door:a-b0","opening:door:b-b0"]);
  });

  it("cuts an external door from one boundary only",()=>{
    const external: RenderedConnector = {
      id:"rendered:outside", connectorId:"outside", type:"external-door",
      roomA:"a", boundaryA:"a-b0", start:{x:3,y:0}, end:{x:5,y:0},
      centre:{x:4,y:0}, width:2, rotationDegrees:0,
    };
    const result=resolveWallOpenings(floor,[external]);
    assert.equal(result.openings.length,1);
    assert.equal(result.wallSegments.filter(x=>x.boundaryId==="a-b0").length,2);
    assert.equal(result.wallSegments.filter(x=>x.boundaryId==="b-b0").length,1);
  });

  it("removes a complete wall interval for a full-width passage",()=>{
    const passage=connector({connectorId:"passage",id:"rendered:passage",type:"open-passage",start:{x:0,y:0},end:{x:10,y:0},centre:{x:5,y:0},width:10});
    const result=resolveWallOpenings(floor,[passage]);
    assert.equal(result.wallSegments.length,0);
  });

  it("rejects overlapping connector openings",()=>{
    const first=connector();
    const second=connector({id:"rendered:second",connectorId:"second",start:{x:4,y:0},end:{x:6,y:0},centre:{x:5,y:0}});
    assert.throws(()=>resolveWallOpenings(floor,[first,second]),/overlapping connector openings/);
  });

  it("leaves walls unchanged when there are no connectors",()=>{
    assert.deepEqual(resolveWallOpenings(floor,[]).wallSegments,floor.wallSegments);
  });
});
