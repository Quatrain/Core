# HOWTO: Using @quatrain/i18n-es

This document shows how to consume the Spanish translation bundle in your application.

---

## Usage

Import the dictionary and register it into the central `Translator` instance:

```typescript
import { Translator } from '@quatrain/i18n'
import { esDictionary } from '@quatrain/i18n-es'

const translator = new Translator('es')
translator.register('es', esDictionary)

const label = translator.translate('table', 'uid', 'es')
console.log(label) // "Identificador"
```
