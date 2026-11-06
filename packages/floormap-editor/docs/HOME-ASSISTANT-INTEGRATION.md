# Home Assistant integration (design, nothing implemented yet)

Goal: the editor runs next to Home Assistant (HA), reads entities / areas / states from it, and a change of the floor plan is visible in the 3D visualisation right away, without exporting and importing a file. The API names below are from the HA developer documentation as known when this was written; check them against the HA version in use before implementing.

## What an external editor can and cannot do
| Need | Possible from outside? | How |
|---|---|---|
| Read entities, states, attributes | yes | WebSocket `get_states`, or REST `GET /api/states` |
| Read areas, devices, entity registry (which entity is in which area) | yes | WebSocket `config/area_registry/list`, `config/device_registry/list`, `config/entity_registry/list` |
| Live state changes (motion, door open, light on) | yes | WebSocket `subscribe_events` (`state_changed`) or `subscribe_entities` |
| Store the floor plan inside HA so the visualisation sees it | not by itself | HA has no WebSocket command that writes an arbitrary file. A small custom integration (or `frontend/set_user_data`, per user only) is needed, see below |

Connection from outside: `ws(s)://<host>:8123/api/websocket`, the server sends `auth_required`, the client answers `{ "type": "auth", "access_token": "<long-lived token>" }`, then every command is `{ "id": n, "type": "..." }` and answers carry the same id. A page loaded over https cannot open a plain `ws://` connection (mixed content), so the editor must be served the same way as HA. The token is a secret: keep it in the user's browser, never in the plan file.

## Where the floor plan lives
The plan is one JSON document (`docs/FILE-FORMAT.md`). Options, in order of effort:
1. **File** (today): Load / Save in the editor, the visualisation loads the same file.
2. **Custom integration (HACS) with a store** (recommended target): Python side uses `homeassistant.helpers.storage.Store` (a file in `.storage/`) and registers WebSocket commands, for example `floormap/get`, `floormap/save` (with `expected_revision`, so two editors cannot overwrite each other silently) and `floormap/subscribe` (pushes the new plan to every open panel). The editor calls `save`, the 3D panel receives the push and redraws: this is the "visible right away" behaviour.
3. **Panel inside HA** (`panel_custom`): the editor is served as an HA panel. It then receives the `hass` object from HA and calls `hass.callWS(...)` with the logged-in user's rights, so no token is needed. The 3D visualisation can be a second panel or a card that subscribes to `floormap/subscribe`.

## What changes in the editor (design rules)
- No HA calls inside the pure modules. The editor talks to two small interfaces that the page provides:
  - `EntitySource.list()` returns `{ entityId, name, domain, deviceClass, areaName }[]` and optionally `subscribe(cb)` for states.
  - `FloorplanStore` with `load()`, `save(graph, revision)` and `subscribe(cb)`.
- Three implementations of the same interfaces: **file** (JSON / CSV import, Load / Save), **HA WebSocket** (external, token) and **HA panel** (`hass`). The editor does not care which one it gets.
- Entities already have `haEntityId`; the import fills the "not placed yet" list, a click places it and pre-selects the type from domain and device class. HA area names are matched to room names to propose a room.
- Saving stays explicit at first (Save sends the plan); autosave to HA can follow once `revision` conflicts are handled.

## Order of work
1. `EntitySource` with file import (JSON / CSV exported from HA) and the "not placed yet" list. This is useful on its own and fixes the interface.
2. HA WebSocket source (external, token): areas, entities, states.
3. Custom integration with `floormap/get|save|subscribe`, then the editor as a panel; visualisation subscribes.
4. Optional: live states on the entity icons in the plan.

## Open decisions
- Who may save (all HA users or admins only), and how conflicts are shown when two people edit.
- Whether the plan should also be copied to `/config/www` for tools that only read files.
- One plan per HA instance, or several (houses).
