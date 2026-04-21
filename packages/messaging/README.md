# @quatrain/messaging

The unified messaging and notification abstraction for the Quatrain framework. This package provides an interface for sending transactional emails, SMS, push notifications, and in-app messages.

## Introduction

Modern applications need to reach users across various channels. The `@quatrain/messaging` package abstracts away the specific provider logic (Firebase Cloud Messaging, SendGrid, Twilio, etc.) behind a clean, unified API, allowing you to easily swap providers without rewriting your business logic.

## Key Concepts

- **`Messaging`**: The static registry where you configure messaging adapters.
- **`AbstractMessagingAdapter`**: The base class for defining channel-specific messaging implementations.

## Installation

```bash
npm install @quatrain/messaging
# You will also need an adapter, e.g.:
npm install @quatrain/messaging-firebase
```

## Architecture

Just like other Quatrain abstractions, you register adapters for different messaging channels (e.g., 'email', 'push', 'sms') to the central registry.

## License

AGPL-3.0-only
