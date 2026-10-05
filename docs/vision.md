A lightweight Home Assistant building modeller focused on rooms, connectivity and information visualisation rather than architectural accuracy.
# Vision

## Project summary

This project aims to provide a simple, accessible way for people to create a useful digital representation of their home for Home Assistant.

Users should be able to describe their home through familiar concepts such as floors, rooms, doors, windows and connected spaces. The resulting model will support clear 2D editing, interactive 3D visualisation and the display of relevant Home Assistant information.

The project is not intended to be architectural, CAD or BIM software. Its purpose is to create a recognisable and informative representation of a building without requiring specialist modelling tools such as Blender, SketchUp or Sweet Home 3D.

> A lightweight Home Assistant building modeller focused on rooms, connectivity and information visualisation rather than architectural accuracy.

## The problem

Existing 3D home visualisations often require users to:

- create a model in external 3D software;
- understand specialist modelling concepts;
- export and manage model files;
- identify and bind individual model objects;
- repeat parts of this process when the building model changes.

This creates a substantial barrier for users who want an effective Home Assistant visualisation but do not need, or want, a complete architectural model.

The project should reduce this barrier by providing a task-oriented editor designed around the way residents understand their homes.

## Core idea

The project treats rooms as the primary building blocks of a home.

Most users think about their home in terms of:

- living room;
- kitchen;
- bedroom;
- hallway;
- bathroom;
- garage;
- outdoor area.

They do not normally think in terms of meshes, vertices, materials or construction layers.

The editor should therefore allow users to create rooms directly. For example, a rectangular room can be created with a single click-and-drag operation. More complex rooms can be represented by simple polygon shapes.

Walls, floors and basic 3D geometry can then be generated from these room shapes.

## Vision

A user should be able to:

1. Create a building.
2. Add one or more floors.
3. Draw rooms using simple construction tools.
4. Connect rooms using doors, openings or other connectors.
5. Add external doors and windows.
6. Name and organise spaces.
7. Place Home Assistant devices and sensors.
8. associate model elements with Home Assistant entities;
9. Switch between 2D editing and 3D visualisation.
10. Explore the building and understand its current state.

The first experience should be useful without requiring precise measurements or specialist knowledge.

## Design principles

### 1. Rooms are first-class objects

A room is not merely the space remaining between walls. It is a permanent and meaningful part of the building model.

Rooms can:

- have names and types;
- belong to floors;
- have simple geometric shapes;
- contain devices and information;
- connect to other rooms;
- provide areas for visualising light, occupancy, temperature and other states.

### 2. Connectivity is part of the model

Rooms can be connected through:

- doors;
- open passages;
- stairs;
- external entrances;
- other future connector types.

A connector is more than a visual object. It represents a relationship between spaces.

This structure may later support:

- navigation through the building;
- occupancy movement;
- robot routes;
- evacuation paths;
- accessibility information;
- relationships between indoor and outdoor areas.

These are future possibilities, not requirements for the initial version.

### 3. Representation is more important than precision

The model should represent the recognisable shape and organisation of a home.

It does not need to reproduce every construction detail.

For example:

- wall thickness can use reasonable defaults;
- room measurements can be approximate;
- doors and windows can use standard visual forms;
- complex architectural details can be simplified;
- small irregularities can be ignored.

Approximate real-world dimensions should still be supported because they help maintain sensible proportions, placement and navigation.

### 4. Information is more important than decoration

The principal value of the model is the information that can be understood through it.

Examples include:

- whether a door is open;
- whether a window is open;
- which lights are on;
- which room or area is illuminated;
- where sensors are located;
- whether a room is occupied;
- the temperature of a room;
- whether an entity is unavailable.

Visual quality is important, but it should support understanding rather than pursue photorealism.

### 5. Simple workflows should cover common homes

The default construction tools should support the majority of homes without exposing unnecessary complexity.

Initial construction concepts should include:

- rectangular rooms;
- polygon rooms;
- floors;
- doors;
- openings;
- windows.

Advanced tools should be added only when they solve a common and clearly defined need.

### 6. Two-dimensional editing comes first

Users will initially construct and modify their home in a 2D floor-plan editor.

The 2D model will be used to generate the 3D representation.

This approach should make editing:

- easier to understand;
- faster to perform;
- suitable for mouse and touch input;
- less dependent on 3D modelling knowledge;
- easier to validate and correct.

The 3D view will initially be a visualisation of the model rather than the primary editing environment.

### 7. The building model is the primary asset

The authoritative model should be semantic building data, not a generated 3D mesh.

The model should describe concepts such as:

- buildings;
- floors;
- rooms;
- boundaries;
- connectors;
- devices;
- entity bindings;
- saved views.

The 2D editor and 3D renderer are consumers of this model.

Generated geometry should be reproducible from the underlying building data.

### 8. Home Assistant is an integration layer

The core building model should remain independent from Home Assistant.

Home Assistant functionality should be provided through a dedicated adapter that can:

- discover or select entities;
- read entity states;
- interpret those states;
- associate entities with model objects;
- update visualisations when states change;
- optionally call Home Assistant services.

This separation should allow the building editor and model to be tested independently.

### 9. Modular and extensible by design

The project should support future growth without placing every possible feature into the initial implementation.

Potential extension areas include:

- additional room-shape tools;
- new connector types;
- device types;
- state visualisers;
- importers and exporters;
- alternative renderers;
- outdoor areas;
- terrain;
- energy visualisation;
- environmental information.

Extensibility should be enabled through stable interfaces and clear separation of responsibilities.

Runtime third-party plugins are not required for the initial version.

### 10. Progressive complexity

A new user should be able to create a useful result with a small number of steps.

More advanced capabilities can become available progressively.

The interface should avoid presenting every option at once. It should guide users through tasks such as:

1. Create a floor.
2. Add rooms.
3. Connect rooms.
4. Add doors and windows.
5. Name spaces.
6. Place devices.
7. Associate Home Assistant entities.
8. Configure the visualisation.

## Initial user experience

A typical first-time workflow should resemble the following:

1. The user creates a new building.
2. The user adds a ground floor.
3. The user draws a rectangular living room.
4. The user draws an adjacent hallway and kitchen.
5. The user connects the rooms using doors or open passages.
6. The user adds external windows and an entrance door.
7. The application generates a basic 3D representation.
8. The user rotates, pans and zooms the model.
9. The user associates doors, windows and lights with Home Assistant entities.
10. The model responds to live Home Assistant states.

The user should not need to understand 3D modelling, mesh generation or file conversion.

## Initial scope

The first meaningful version should support:

- one building;
- one or more floors;
- rectangular rooms;
- simple polygon rooms;
- room names;
- approximate dimensions;
- room positioning;
- basic room connectivity;
- doors or open passages;
- external windows;
- JSON saving and loading;
- 2D viewing and editing;
- automatic generation of basic 3D geometry;
- rotation, panning and zooming in the 3D view.

Home Assistant entity bindings can be introduced after the underlying building model and editor are stable.

## Initial non-goals

The initial version will not attempt to provide:

- architectural drawings;
- construction documentation;
- structural engineering;
- complete CAD functionality;
- BIM or IFC compatibility;
- photorealistic rendering;
- furniture libraries;
- complex roofs;
- curved or sloped walls;
- detailed stairs;
- detailed landscaping;
- automatic blueprint recognition;
- collaborative multi-user editing;
- arbitrary runtime plugins.

These exclusions protect the project's focus. They can be reconsidered if there is a clear future use case.

## Measures of success

The project is successful when a typical Home Assistant user can:

- create a recognisable representation of their home;
- understand the editor without specialist training;
- complete common layouts primarily with room-based tools;
- see relationships between floors, rooms and connectors;
- generate an effective 3D visualisation;
- associate home information with meaningful locations;
- obtain useful information from the model quickly.

The quality of the experience should be measured by clarity, usefulness and ease of creation rather than architectural accuracy.

## Technical direction

The planned technical direction is:

- TypeScript as the primary implementation language;
- a versioned semantic building-data format;
- a framework-independent core domain package;
- a dedicated 2D editor;
- generated 3D geometry;
- Three.js for interactive 3D rendering;
- a separate Home Assistant adapter;
- a full-screen Home Assistant panel for editing;
- a lightweight dashboard card for operational viewing;
- eventual distribution through HACS.

These choices establish the current direction but may be refined through prototyping.

## Guiding question

Before introducing a feature, the project should ask:

> Does this make it easier to represent, understand or interact with a home and its information?

If the answer is no, the feature is probably outside the project's core purpose.
