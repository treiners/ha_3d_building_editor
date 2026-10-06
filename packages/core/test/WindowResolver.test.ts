import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveWindows } from "../src/generation/WindowResolver.js";

const floor:any={boundaries:[{id:"living-b0",roomId:"living",edgeIndex:0,start:{x:0,y:0},end:{x:4,y:0},length:4}],sharedBoundaries:[],wallSegments:[]};

describe("resolveWindows",()=>{
  it("resolves a window using defaults",()=>{
    const result=resolveWindows([{id:"w1",type:"window",roomId:"living",boundaryId:"living-b0",offset:1}],floor);
    assert.equal(result[0]?.width,1);
    assert.deepEqual(result[0]?.start,{x:1,y:0});
    assert.deepEqual(result[0]?.end,{x:2,y:0});
  });
  it("uses explicit bathroom window dimensions",()=>{
    const result=resolveWindows([{id:"bathroom-window",type:"window",roomId:"living",boundaryId:"living-b0",offset:1,geometry:{width:.5,height:.5,sillHeight:1.5}}],floor);
    assert.equal(result[0]?.width,.5);
    assert.equal(result[0]?.sillHeight,1.5);
  });
  it("rejects a window outside its boundary",()=>{
    assert.throws(()=>resolveWindows([{id:"bad",type:"window",roomId:"living",boundaryId:"living-b0",offset:3.5,geometry:{width:1}}],floor),/does not fit/);
  });
});
