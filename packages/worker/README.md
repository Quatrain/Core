# @quatrain/worker

A comprehensive toolkit for building and managing backend processing workers within the Quatrain ecosystem. It provides robust utilities for executing child processes, interacting with file systems, pushing remote events, and standardizing message handler execution.

## Introduction

In distributed architectures, workers are processes that consume events (via queues or CLI) and perform heavy background tasks (such as video rendering, file processing, or data synchronization). 
The `@quatrain/worker` package abstracts away the boilerplate needed to instantiate a worker, connect it to a queue, and report its progress back to a central API.

## Key Concepts

- **`Worker`**: The core class offering static methods to execute shell commands (`execPromise`), push webhook events (`pushEvent`), and standardize the message-handling loop (`handler`).
- **`FileSystem`**: A wrapper around Node.js filesystem operations, providing typed and safe methods for managing files, directories, and temporary processing paths.
- **`Helpers`**: A collection of utility functions to streamline worker tasks.

## Installation

```bash
npm install @quatrain/worker
# or
yarn add @quatrain/worker
```

## Features

- **Agnostic execution mode**: A worker can run by listening to a queue (`queue` mode) or locally via standard input (`cli` or `test` mode).
- **Process Spawning**: Safely wrap `child_process.spawn` into Promises with structured logging.
- **Event Reporting**: Push HTTP patch events to a backend orchestrator using `axios` to update job statuses in real-time.

## License

AGPL-3.0-only
