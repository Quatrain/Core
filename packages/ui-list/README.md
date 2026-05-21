# @quatrain/ui-list

Headless, framework-agnostic list and data table state manager for the Quatrain Core monorepo. It manages the querying, sorting, pagination, filtering, and model schema mapping independent of any UI framework.

## Features

- **Agnostic State Management**: Pure TypeScript list controller which can be integrated into any frontend framework (React, Vue, Angular, etc.).
- **Flexible Data Feed**: Accepts standard endpoint names, custom load operations, or Core model definitions.
- **TypeScript Class Decorator**: Polished `@CoreList(config)` decorator to cleanly associate list options to exposer/controller classes.
- **Model Inferences**: Automatically parses Quatrain Model `PROPS_DEFINITION` schemas to deduce column types and relational values.
