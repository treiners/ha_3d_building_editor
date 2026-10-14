# Migration from 2.0 preview

Each room now requires a `connectors` array. Relationships no longer use `roomA`, `roomB`, and `connection`; they use `connectorA` and `connectorB`. Windows are represented as unlinked room-side connectors. Doors, passages, and wall links may be paired between different rooms.
