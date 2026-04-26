# @quatrain/ui

The `@quatrain/ui` package is the foundational frontend layer of the Quatrain framework. It encapsulates the core styling and layout configurations required by all specific React component packages (like `ui-form-react`).

## Architecture
- By default, it exports the **Mantine** component library, ensuring that any downstream UI packages share the exact same style context and theme configuration.
- It is designed to be framework-agnostic at its core, but currently integrates `MantineProvider` and basic CSS reset tokens for React.

## Getting Started

To use it in your host application (like `studio-web`), wrap your root with the exported theme provider:

```tsx
import { MantineProvider } from '@quatrain/ui';
import '@quatrain/ui/core.css';

function App() {
  return (
    <MantineProvider defaultColorScheme="dark">
       <YourApp />
    </MantineProvider>
  )
}
```
