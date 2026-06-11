# HOWTO - Using @quatrain/i18n

This document describes how to leverage `@quatrain/i18n` to define structured dictionaries and perform translations.

---

## 1. Registering Custom Dictionaries

You can instantiate a central `Translator` and load multilingual dictionaries dynamically:

```typescript
import { Translator, CoreDictionary } from '@quatrain/i18n'

// 1. Create translator instance (with fallback default language)
const translator = new Translator('en')

// 2. Define standard dictionaries
const englishDict: CoreDictionary = {

    table: {
        uid: 'Identifier',
        id: 'ID',
        status: 'Status',
        createdAt: 'Created At',
        createdBy: 'Created By',
        updatedAt: 'Updated At',
        updatedBy: 'Updated By',
        deletedAt: 'Deleted At',
        deletedBy: 'Deleted By',
        showMeta: 'Show system metadata columns',
        noData: 'No data available',
        rowsPerPage: 'Rows per page',
        searchPlaceholder: 'Search...',
        loading: 'Loading...'
    }
}

// 3. Register dictionaries
translator.register('en', englishDict)
```

---

## 2. Resolving Localized Text

Translate strings by specifying a dictionary scope group and targeted text key:

```typescript
const translatedLabel = translator.translate('table', 'status', 'en')
console.log(translatedLabel) // "Status"
```
