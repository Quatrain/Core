# @quatrain/chat

The core conversational engine for the Quatrain framework.

This package provides a headless, UI-agnostic implementation of conversational agents, handling message history, prompt templating, context injection (RAG), and integration with LLM providers (Gemini, OpenAI, Ollama).

## Architecture

`@quatrain/chat` is decoupled from the frontend presentation layer.
* Logical controllers like `ChatController` manage session state and interactions.
* Visual presentation (chat bubbles, input boxes) is managed separately in the `CoreUX` workspace.

## License

AGPL-3.0-only
