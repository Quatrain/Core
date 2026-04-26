# @quatrain/ui-form-react

This package provides high-level, granular React components to dynamically generate forms based on Quatrain DataObjects and Property definitions.

## Features
- **Agnostic Form Elements**: Exposes specific widgets (e.g. `StringInput`, `NumberInput`, `BooleanToggle`) that seamlessly integrate with Quatrain's validation rules (`mandatory`, `minLength`, `maxLength`, etc.).
- **Automatic Data Binding**: Designed to read from and write to standard Quatrain `ApiPayload` objects.
- **Mantine Integration**: Heavily utilizes `@quatrain/ui` (Mantine) for beautiful, cohesive design right out of the box.

## Usage

```tsx
import { DynamicForm } from '@quatrain/ui-form-react';

<DynamicForm 
   modelId="user-model-123" 
   onSubmit={(data) => console.log('Saved:', data)} 
/>
```
*(Documentation will be expanded as the components are built out)*
