export type RoomSizeCategory="small"|"medium"|"large";
export type RoomType="living-room"|"dining-room"|"kitchen"|"bedroom"|"bathroom"|"office"|"hall"|"laundry"|"garage"|"other";
export type RoomSide="top"|"right"|"bottom"|"left";
export type RoomConnectorType="door"|"open-passage"|"window"|"wall-link";
export interface RoomSideConnector{readonly id:string;readonly roomId:string;readonly side:RoomSide;readonly type:RoomConnectorType;readonly position:number;readonly label?:string;}
export interface RoomNode{readonly id:string;readonly name:string;readonly type:RoomType;readonly sizeCategory:RoomSizeCategory;readonly connectors:readonly RoomSideConnector[];}
export interface ConnectorRelationship{readonly id:string;readonly connectorA:string;readonly connectorB:string;readonly importance:"required"|"preferred";}
export interface BuildingGraph{readonly schemaVersion:"2.1";readonly id:string;readonly name:string;readonly rooms:readonly RoomNode[];readonly relationships:readonly ConnectorRelationship[];}
