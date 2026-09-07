# `@quatrain/mdm` — Agnostic Master Data Management (MDM) Core Package

The `@quatrain/mdm` package provides an abstract, domain-agnostic Master Data Management (MDM) architecture for physical assets, garments, audio/video media, virtual products (*digital access keychains, credentials*), managed services, and composite objects.

---

## 🏛️ Abstract Architecture & Sibling Conventions

Following standard **Quatrain Core** sibling package conventions:
- **`abstract class AbstractMdmObject extends PersistedBaseObject`**: Core abstract model class that MUST be extended to define concrete real-world objects (e.g. `TeeShirt`, `Garment`, `Disk`, `HardwareDevice`, `VirtualKeychain`). Cannot be instantiated directly.
- **Clean Concrete Derived Class Naming**: Derived domain classes drop the `MdmObject` suffix (e.g., `TeeShirt`, `Garment`, `Disk`, `HardwareDevice`, `VirtualKeychain`).
- **Archetype Specifications (`MdmArchetypeSpec`)**: Archetypes define mandatory (`requiredProperties`) and optional (`optionalProperties`) specification schemas (e.g., Garment: sizes/colors/materials; Disk: format/duration/tracks; IoT Device: serialNumber/radioCapabilities).
- **Validation Engine (`validateArchetypeSpecs()`)**: Built-in validation ensuring required archetype specification fields exist prior to persistence.
- **Pivot Class `Mdm extends Core`**: Central registry manager providing provider adapter registration (`Mdm.addAdapter()`), archetype specification registration (`Mdm.registerArchetype()`), and custom model registration (`Mdm.registerModel()`).
- **Subcollections**: Supports attaching $N$ subitems or attributes linked to a parent element via dynamic collection paths (`<COLLECTION>/<uid>/<subcollection>`).

---

## 📦 Usage

See [`HOWTO.md`](HOWTO.md) for practical examples and registration scenarios.
