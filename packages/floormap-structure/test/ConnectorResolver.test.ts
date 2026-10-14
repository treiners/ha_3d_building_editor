import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveConnectors } from "../src/generation/ConnectorResolver.js";
import type { Connector } from "../src/model/Connector.js";
import type { GeneratedFloor } from "../src/model/GeneratedFloor.js";

const floor: GeneratedFloor = {
  boundaries: [
    { id:"bedroom-b2", roomId:"bedroom", edgeIndex:2, start:{x:8,y:7}, end:{x:5,y:7}, length:3 },
    { id:"bathroom-b0", roomId:"bathroom", edgeIndex:0, start:{x:5,y:7}, end:{x:8,y:7}, length:3 },
    { id:"living-b1", roomId:"living", edgeIndex:1, start:{x:4,y:0}, end:{x:4,y:4}, length:4 },
  ],
  sharedBoundaries: [],
  wallSegments: [],
};

const bedroomDoor: Connector = {
  id:"bedroom-bathroom", type:"door", roomA:"bedroom", roomB:"bathroom",
  boundaryA:"bedroom-b2", boundaryB:"bathroom-b0", offset:1.2,
  geometry:{ width:0.72, height:2.04, style:"single-hinged" },
};

describe("resolveConnectors", () => {
  it("resolves the apartment door using offset and width", () => {
    const result = resolveConnectors([bedroomDoor], floor);
    assert.equal(result.length,1);
    assert.equal(result[0]?.width,0.72);
    assert.deepEqual(result[0]?.start,{x:6.8,y:7});
    assert.deepEqual(result[0]?.end,{x:6.08,y:7});
    assert.equal(result[0]?.rotationDegrees,180);
  });

  it("resolves a vertical open passage", () => {
    const connector: Connector = {
      id:"living-dining", type:"open-passage", roomA:"living", roomB:"dining",
      boundaryA:"living-b1", offset:0.75, width:2.5,
    };
    const result = resolveConnectors([connector], floor);
    assert.equal(result[0]?.type,"open-passage");
    assert.equal(result[0]?.rotationDegrees,90);
    assert.deepEqual(result[0]?.start,{x:4,y:0.75});
    assert.deepEqual(result[0]?.end,{x:4,y:3.25});
  });

  it("rejects missing boundaries", () => {
    assert.throws(() => resolveConnectors([{...bedroomDoor,boundaryA:"missing"}],floor),/missing boundary/);
  });

  it("rejects a connector that exceeds its boundary", () => {
    assert.throws(() => resolveConnectors([{...bedroomDoor,offset:2.5}],floor),/does not fit/);
  });

  it("ignores unsupported stair rendering in v0.8", () => {
    const stairs: Connector = { id:"stairs",type:"stair",roomA:"living",boundaryA:"living-b1",offset:0,width:1 };
    assert.deepEqual(resolveConnectors([stairs],floor),[]);
  });
});
