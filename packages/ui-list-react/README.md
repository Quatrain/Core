# @quatrain/ui-list-react

This package provides high-level React components to display collections of Quatrain `DataObjects` in dynamic tables, lists, and grids.

## Features
- **Dynamic Columns**: Automatically infers column headers and data types from the Quatrain `ModelClass` properties.
- **Pagination & Filtering**: Integrates tightly with the `@quatrain/api-client` to automatically handle `offset`, `batch`, and `where` query operations via UI controls.
- **Mantine Integration**: Heavily utilizes `@quatrain/ui` (Mantine) for beautiful, cohesive design right out of the box.

## Usage

```tsx
import { DynamicList } from '@quatrain/ui-list-react';

<DynamicList 
   modelId="user-model-123" 
   onRowClick={(item) => console.log('Clicked:', item)} 
/>
```
*(Documentation will be expanded as the components are built out)*
