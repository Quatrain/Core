# HOWTO: Using @quatrain/skills

This document shows how to utilize the skill helper structures and safely write execution outputs.

---

## 1. Writing Outputs Safely

Use the `writeOutput` function to write any object data to a file. It automatically takes care of recursive parent directory creation:

```typescript
import { writeOutput } from '@quatrain/skills';

const myRunData = {
  status: 'success',
  timestamp: Date.now(),
  results: [1, 2, 3]
};

// Writes to '.log/runs/latest.json', creating '.log/' and 'runs/' directories if missing
await writeOutput(myRunData, '.log/runs/latest.json');
```

## 2. Declaring an API-based Skill

You can implement the exported interfaces to declare structured skills:

```typescript
import { ApiSkillDefinition } from '@quatrain/skills';

const myOdooSkill: ApiSkillDefinition = {
  name: 'odoo-fetch-partners',
  description: 'Fetches partner data from Odoo ERP',
  client: {
    type: 'xmlrpc',
    endpointUrl: 'https://erp.example.com',
    parameters: {
      db: 'my_database',
      user: 'admin'
    }
  },
  methods: [
     {
       name: 'getPartners',
       remoteName: 'execute_kw',
       description: 'Read partners'
     }
  ]
};
```
