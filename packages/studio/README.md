# @quatrain/studio

The `@quatrain/studio` package contains the core configuration, meta-models, and orchestrator tooling for Quatrain Core Studio. It serves as the bridge between Quatrain Core's backend mechanics and the user-facing UI tools.

## Features
- **Meta-Models**: Exposes `StudioModel` and `StudioProperty`, which are `BaseObject` entities used to design your own application schemas dynamically.
- **AI Agents**: Incorporates AI orchestration, code generation (Generators), and structural definitions for applications managed via the Studio.

---
## Architecture

- `StudioProject`: Represents an entire application project.
- `StudioModel`: A model definition (e.g. `Invoice`, `User`).
- `StudioProperty`: Properties attached to a model (e.g. `amount`, `name`), supporting granular configurations like `mandatory`, `maxLength`, etc.
