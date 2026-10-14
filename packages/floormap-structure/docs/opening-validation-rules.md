# Opening Validation Rules v1.1

## Purpose
Validates windows, doors, external doors and open passages after geometry generation.

## Severity
- **Error**: invalid geometry or conflicting wall usage.
- **Warning**: unusual but possible architecture.
- **Info**: valid special condition.

## Rules
1. Referenced boundaries must exist.
2. An opening boundary must belong to its declared room.
3. `offset >= 0`, `width > 0`, and `offset + width <= boundary length`.
4. A window on a shared wall produces `WINDOW_ON_SHARED_WALL` (warning by default).
5. Windows must not overlap windows, doors, external doors or open passages.
6. Doors and external doors must not overlap other doors or passages.
7. Open passages must not overlap another opening.
8. Endpoint contact within tolerance is not overlap.
9. Internal connectors are evaluated on both source boundaries.
10. Results are structured, deterministic and do not prevent rendering unless the caller chooses to block on errors.

## Acceptance
The reference apartment must produce actionable issues for internal-wall windows and any interval conflicts while remaining renderable.
