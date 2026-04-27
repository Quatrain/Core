# Quatrain Core - Architecture Guidelines & Common Pitfalls

Ce document recense les principes architecturaux essentiels de Quatrain Core, ainsi que les erreurs courantes à éviter lors du développement.

## 1. Instanciation et Chargement des Modèles (`PersistedBaseObject`)

L'une des erreurs les plus fréquentes concerne la manière d'instancier ou de récupérer des objets depuis la base de données. Quatrain propose deux méthodes statiques distinctes sur les objets héritant de `PersistedBaseObject` :

### ❌ Ce qu'il ne faut PAS faire pour charger un objet existant
```typescript
// Mauvais : Utiliser .factory() avec un identifiant simple (UUID)
const user = await User.factory('123e4567-e89b-12d3-a456-426614174000') 
```
La méthode `.factory()` attend soit :
- Un objet source contenant les données pour initialiser une nouvelle instance (`{ name: 'John' }`).
- Une chaîne de caractères représentant un **chemin complet** (`collection/uuid`), ce qui est rarement utilisé directement dans le code applicatif.
Si on lui passe un UUID seul, Quatrain échouera avec une erreur du type : `[SQLA] path parts number should be even, received: '...'`.

### ✅ Ce qu'il FAUT faire
```typescript
// Créer une nouvelle instance (vide ou avec des données initiales)
const newUser = await User.factory({ email: 'test@test.com' })

// Charger une instance existante depuis le backend via son identifiant (UUID)
const existingUser = await User.fromBackend('123e4567-e89b-12d3-a456-426614174000')
```
La méthode `.fromBackend(id)` est la méthode canonique pour récupérer un objet précis dans la base.

---

## 2. Déclaration des Propriétés (`PROPS_DEFINITION`)

Lorsqu'on définit la structure d'un modèle via `PROPS_DEFINITION`, il faut être très rigoureux sur les types de propriétés.

### ❌ L'erreur classique : Utiliser des chaînes littérales
```typescript
export const MonModeleDef = [
   {
      name: 'isDefault',
      mandatory: true,
      type: 'BooleanProperty', // ❌ Mauvais !
   }
]
```
Utiliser une simple chaîne de caractères empêche le moteur Quatrain de résoudre correctement la classe de la propriété, causant des erreurs fatales lors de la construction de l'objet (ex: `Unable to build data object: Unknown property type BooleanProperty`).

### ✅ La bonne pratique : Utiliser les constantes `.TYPE`
```typescript
import { BooleanProperty } from '@quatrain/core'

export const MonModeleDef = [
   {
      name: 'isDefault',
      mandatory: true,
      type: BooleanProperty.TYPE, // ✅ Correct !
   }
]
```
Il faut toujours importer la classe de la propriété (ex: `StringProperty`, `NumberProperty`, `BooleanProperty`, `ObjectProperty`) et utiliser sa propriété statique `.TYPE`.

---

## 3. Gestion des Suppressions Logiques (Soft Delete)

Par défaut, Quatrain gère un système de "soft delete" (suppression logique) via la propriété `status` héritée de `BaseObject`.

**Comportement Backend :**
- Si le `BackendAdapter` est configuré avec `softDelete: true`, appeler la suppression d'un objet va uniquement passer sa propriété `status` à `'deleted'`.
- Si `softDelete: false` est configuré (souvent le cas en développement sur SQLite via `studio-api`), la suppression efface réellement la ligne de la base de données.

**Filtrage lors de la lecture :**
Même si le soft-delete est activé, les requêtes brutes de base (`apiClient.get()`) pourraient remonter des objets supprimés si les filtres appropriés ne sont pas appliqués ou si le middleware ne les intercepte pas.
Il est donc toujours prudent, côté frontend ou dans les services API, de filtrer explicitement les objets dont le statut est `'deleted'` si nécessaire :
```typescript
const result = await Backend.execute(Model, 'read', { filters: { 'status:neq': 'deleted' } })
```
