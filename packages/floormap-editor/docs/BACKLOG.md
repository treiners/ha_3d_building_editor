# Backlog / reminders

Not planned for now, written down so they are not forgotten (order = rough priority).

## Waiting list
- **Polygon / L-shaped rooms.** Wall-graph model (vertices, edges, rooms as loops; connectors reference an edge), schema 2.15 with migration. Needs the wall solver, joints and the mapper to work on edges instead of rectangles: a large piece of work, plan it before starting.
- **Snapping to the ghost while dragging** (floors): today it is the one-click *Match below* / *Align all*; dragging would touch every planner.
- **Mapper per floor / for the whole house.**

## Remember only (unlikely to be implemented)
- **Individual wall heights** (per wall or per room instead of one height per floor).
- **Roof.** Needs a lot of planning: roof types (flat, gable, hip, shed), overhang, and dynamic adjustment of the wall heights depending on the roof type (gable walls, knee walls). Would interact with the per-floor heights and with individual wall heights.
- **Trees in Site mode (areas):** just circles with a position and a radius, maybe a `kind` (deciduous, conifer, hedge, ...) like the area kinds.

## Decided against
- Objects / furniture inside rooms: they clutter the HA interface; entity lists are assigned in HA through the building-card.
