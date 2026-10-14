# Domain Model

## Philosophy

The project models homes using rooms and connections between rooms. The room is the primary modelling object.

## Building

Represents a complete building.

Attributes:

- id
- name
- floors
- devices
- views
- metadata

## Floor

Represents one level of a building.

Attributes:

- id
- name
- elevation
- rooms

## Room

Represents a meaningful space.

Examples:

- Living Room
- Kitchen
- Office
- Bedroom

Attributes:

- id
- name
- shape
- height
- tags

Example:

```json
{
  "id": "living-room",
  "name": "Living Room",
  "shape": [[0,0],[5,0],[5,4],[0,4]]
}
```

## Connector

Defines relationships between spaces.

Types:

- Door
- Open Passage
- Stair
- Entrance

Example:

```json
{
  "id": "door1",
  "type": "door",
  "roomA": "living-room",
  "roomB": "hallway"
}
```

## Device

Represents a Home Assistant entity placed within the model.

Attributes:

- id
- roomId
- entityId
- deviceType
- position

## View

Represents a saved visualisation.

Attributes:

- id
- name
- camera
- visibleFloors
- visibleLayers

## Initial Scope

The MVP supports:

- Buildings
- Floors
- Rooms
- Connectors
- Devices
- Saved Views
