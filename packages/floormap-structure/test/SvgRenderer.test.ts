import assert from 'node:assert/strict';
import {describe,it} from 'node:test';
import {renderFloorSvg} from '../src/svg/SvgRenderer.js';
describe('renderFloorSvg',()=>{
 it('rejects empty floor',()=>{assert.throws(()=>renderFloorSvg([], {boundaries:[],sharedBoundaries:[],wallSegments:[]}));});
});
