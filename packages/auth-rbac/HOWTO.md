# HOWTO: Advanced RBAC & Dynamic Callbacks

This guide demonstrates common usage scenarios for `@quatrain/auth-rbac`.

---

## 1. Dynamic Attribute-Based Conditions (e.g. `partner` role)

Attach an asynchronous condition callback to inspect context or external services (like database/cache):

```typescript
import { RbacEngine, StandardRole } from '@quatrain/auth-rbac'

const rbac = new RbacEngine()

rbac.registerRole({
   name: StandardRole.PARTNER,
   inherits: [StandardRole.VISITOR],
   rules: [
      {
         action: ['read', 'create', 'update'],
         resource: 'companies/:targetCompany/*',
         // Dynamic resolver checking whether targetCompany is managed
         condition: async (subject, context) => {
            const managedCompanies = await getManagedCompanies(subject)
            return managedCompanies.includes(context?.targetCompany)
         },
      },
   ],
})

// Evaluation:
const partnerUser = { uid: 'usr_p', role: StandardRole.PARTNER }

const allowed = await rbac.can(partnerUser, 'read', 'companies/c1/jobs', {
   targetCompany: 'companies/c1',
})
```

---

## 2. Preventing Privilege Escalation (Tokens & M2M Apps)

When a company admin creates an API token, ensure the token's requested scopes do not exceed the admin's own rights:

```typescript
const adminSubject = {
   uid: 'admin_1',
   role: 'admin',
}

const requestedScopes = [
   'read:medias/*',
   'delete:system/global', // Escalation attempt!
]

const { valid, rejectedScopes } = await rbac.isSubsetOf(adminSubject, requestedScopes)

if (!valid) {
   throw new Error(`Cannot grant unauthorized scopes: ${rejectedScopes.join(', ')}`)
}
```

---

## 3. Resolving HTTP Requests into Semantic Actions

```typescript
import { resolveHttpToSemanticAction, sanitizeResourcePath } from '@quatrain/auth-rbac'

// In your router / middleware
const action = resolveHttpToSemanticAction(req.method, req.path) // e.g. 'update'
const resource = sanitizeResourcePath(req.path) // e.g. 'medias/123'

const allowed = await rbac.can(req.user, action, resource)
```

---

## 4. Frontend Usage (React UI Guard)

Because `@quatrain/auth-rbac` has zero server or native bindings, it runs natively in React / browser bundles:

```tsx
import { rbac } from './rbacInstance'

export function DeleteButton({ user, resourcePath }: { user: any; resourcePath: string }) {
   const [canDelete, setCanDelete] = useState(false)

   useEffect(() => {
      rbac.can(user, 'delete', resourcePath).then(setCanDelete)
   }, [user, resourcePath])

   if (!canDelete) return null
   return <button onClick={handleDelete}>Delete</button>
}
```
