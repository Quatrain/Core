# HOWTO - Using @quatrain/i18n-fr

This document shows how to consume the French translation bundle in your application.

---

## Usage

Import the dictionary and register it into the central `Translator` instance:

```typescript
import { Translator } from '@quatrain/i18n'
import { frDictionary } from '@quatrain/i18n-fr'

const translator = new Translator('fr')
translator.register('fr', frDictionary)

const label = translator.translate('table', 'uid', 'fr')
console.log(label) // "Identifiant"
```
