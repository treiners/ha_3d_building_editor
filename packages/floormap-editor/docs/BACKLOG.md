# Backlog / reminders

Not planned for now, written down so they are not forgotten (order = rough priority). Current state and the user's order of ideas: `docs/HANDOVER-3.1.md` section 4.

## Waiting list
- **Roof / ceilings.** Ceiling shape defined by key markers (not by room height); walls extend to the roof or stop at hanging ceilings. Postponed until the 3D visualisation has caught up (it must also read `outline` of rooms and areas). Needs planning: roof types, overhang, interaction with per-floor heights and individual wall heights.
- **Home Assistant: entity source (file import first), then the live panel**: design in `docs/HOME-ASSISTANT-INTEGRATION.md`.
- **Copy and paste of rooms with contents, entity coverage highlight, Fix buttons in the Issues panel.**
- **Split a room** (inverse of merge); wall solver (`planWall`, `planClose`, `planFit`) aware of notches.
- **Snapping to the ghost while dragging** (floors): today it is the one-click *Match below* / *Align all*; dragging would touch every planner.
- **Mapper per floor / for the whole house.**

## Remember only (unlikely to be implemented)
- **Individual wall heights** (per wall or per room instead of one height per floor).

## Done (was on this list)
- Autosave / recovery (3.2), rename room, free object categories (3.2).
- Polygon / L-shaped rooms (rectilinear shapes with `outline`, v2.18), trees in Site mode (tree areas with trunk, canopy and `species`, 3.1), objects / furniture (v2.17, Objects mode).
