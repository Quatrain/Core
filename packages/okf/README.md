# @quatrain/okf

Open Knowledge Format (OKF) flat file storage adapter for the Quatrain Core framework.

## Overview

The `@quatrain/okf` package provides a file-based persistence adapter (`OKFBackendAdapter`) that serializes Quatrain `PersistedBaseObject` entities into a structured flat file filesystem directory conforming to the OKF format.

This adapter is specifically designed to facilitate local-first, offline-first architectures by excluding relational databases and utilizing structured directory trees containing lightweight JSON files.

## Features

- **Decoupled Architecture:** Pure filesystem storage format independent of underlying Git versioning or synchronization layers.
- **Operator Auditing:** Automatically stores the operator's email in the document's metadata block (`meta.created_by`) for full change traceability.
- **Hierarchical Layouts:**
  - Telemetry: Saved as `telemetry/YYYY-MM-DD/{type}/{HHMMSS}-{millis}-{bassinId}.json`
  - Other: Saved as `{collection}/{uid}.json`
