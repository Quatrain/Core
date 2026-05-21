# HOWTO - Using @quatrain/i18n-en

This document shows how to consume the English translation bundle in your application.

---

## Usage

Import the dictionary and register it into the central `Translator` instance:

```typescript
import { Translator } from '@quatrain/i18n'
import { enDictionary } from '@quatrain/i18n-en'

const translator = new Translator('en')
translator.register('en', enDictionary)

const label = translator.translate('table', 'uid', 'en')
console.log(label) // "Identifier"
```
