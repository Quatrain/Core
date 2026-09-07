# HOWTO: `@quatrain/mdm` — Step-by-Step Guide: Creating a T-Shirt Product Variant & Inventory Unit

This guide demonstrates how to create a concrete **T-Shirt** garment product using `@quatrain/mdm` with standardized ENUMs, extensible interfaces, archetype specification validation, top-level `Vendor` entities, `ObjectVendor` relational associations, and child `Specification` collections.

---

## 1. Define the Concrete `TeeShirt` Model Class

Extend `AbstractMdmObject` and define the mandatory `getArchetypeSpec()` schema specifying required and optional properties:

```typescript
import { 
   AbstractMdmObject, 
   MdmArchetypeSpec, 
   MdmNature, 
   TextileGarmentSpecInterface 
} from '@quatrain/mdm';

/**
 * Concrete TeeShirt Model Class (Extends AbstractMdmObject)
 */
export class TeeShirt extends AbstractMdmObject {
   static COLLECTION = 'tshirts'

   getArchetypeSpec(): MdmArchetypeSpec {
      return {
         archetypeId: 'textile.tshirt',
         name: 'Organic Cotton T-Shirt',
         nature: MdmNature.PHYSICAL,
         collection: TeeShirt.COLLECTION,
         requiredProperties: ['sizes', 'colors', 'materials'],
         optionalProperties: ['washCare', 'brand', 'weightGrams', 'fitType']
      }
   }

   public get specifications(): TextileGarmentSpecInterface {
      return this.specificationsObject as TextileGarmentSpecInterface
   }
}
```

---

## 2. Register Provider Adapter & Archetype with Pivot Class `Mdm`

Centralize registry initialization via `Mdm`:

```typescript
import { Mdm, MockMdmAdapter, MdmNature } from '@quatrain/mdm';

// Register provider adapter
Mdm.addAdapter(new MockMdmAdapter('default'), 'default', true);

// Instantiate sample and register TeeShirt Archetype Spec & Model Class
const tshirtSample = TeeShirt.fromObject({ 
   name: 'T-Shirt Archetype',
   archetypeId: 'textile.tshirt',
   nature: MdmNature.PHYSICAL 
});

Mdm.registerArchetype(tshirtSample.getArchetypeSpec());
Mdm.registerModel('textile.tshirt', TeeShirt);
```

---

## 3. Create Independent `Vendor` Entities and Associate via `ObjectVendor`

Create top-level `Vendor` instances and associate them to the `TeeShirt` variant with product-vendor metadata (*vendorSku, role, primary status*):

```typescript
import { 
   Vendor,
   GarmentSize, 
   TextileColor, 
   TextileMaterial, 
   TextileWashCare, 
   TextileGarmentSpecInterface,
   MdmNature
} from '@quatrain/mdm';

// 1. Create standalone Vendor entities
const ecoMillsVendor = Vendor.fromObject({
   name: 'EcoApparel Mills',
   url: 'https://ecomills.example.com'
});

const globalDistroVendor = Vendor.fromObject({
   name: 'Textile Global Distro',
   url: 'https://tgd.example.com'
});

// 2. Instantiate T-Shirt Product Variant
const tshirtVariant = TeeShirt.fromObject({
   name: 'Quatrain Organic V-Neck T-Shirt (Navy)',
   sku: 'QT-TSHIRT-ORG-001',
   archetypeId: 'textile.tshirt',
   nature: MdmNature.PHYSICAL,
   lifecycleState: 'production',
});

// 3. Associate Vendors via ObjectVendor relationship records
tshirtVariant.addVendor(ecoMillsVendor, 'ECO-MILL-883', 'manufacturer', true);
tshirtVariant.addVendor(globalDistroVendor, 'TGD-2026-9', 'distributor');

// 4. Populate Specification child collection
tshirtVariant.setSpecificationsFromObject({
   sizes: [GarmentSize.SMALL, GarmentSize.MEDIUM, GarmentSize.LARGE],
   colors: [TextileColor.NAVY_BLUE, TextileColor.WHITE],
   materials: [TextileMaterial.ORGANIC_COTTON],
   brand: 'Quatrain EcoWear'
});

// 5. Validate specifications against archetype schema
tshirtVariant.validateArchetypeSpecs(); // Returns true
console.log(tshirtVariant.getVendors().map(v => v.val('name'))); // ['EcoApparel Mills', 'Textile Global Distro']
```

---

## 4. Property Types Guidelines: Inline Maps vs Relational Collections

When declaring property definitions (`PROPS_DEFINITION`) in domain models:

| Property Type | Source Package | Usage | Example |
| :--- | :--- | :--- | :--- |
| `MapProperty.TYPE` (`'map'`) | `@quatrain/core` | **Inline Group Dictionaries**: Autocontained JSON / JSONB maps stored directly in table columns. | `dimensions`, `vendor_info` |
| `CollectionProperty.TYPE` (`'collection'`) | `@quatrain/backend` | **Relational Collections**: Child entities persisted as separate table rows with a parent foreign key. | `specifications`, `vendors` |
| `ObjectProperty.TYPE` (`'object'`) | `@quatrain/core` | **Single Entity References**: Direct link to a single model instance. Requires `instanceOf: ClassName`. | `parent` |

```typescript
import { AbstractMdmObject } from '@quatrain/mdm'
import { MapProperty } from '@quatrain/core'

export class Device extends AbstractMdmObject {
   static COLLECTION = 'devices'
   static PROPS_DEFINITION = [
      ...AbstractMdmObject.PROPS_DEFINITION,
      // Inline specification group JSONB map (use MapProperty.TYPE)
      { name: 'dimensions', type: MapProperty.TYPE, required: false, default: { unitSystem: 'metric' } },
      { name: 'vendor_info', type: MapProperty.TYPE, required: false, default: {} },
   ] as typeof AbstractMdmObject.PROPS_DEFINITION
}
```
