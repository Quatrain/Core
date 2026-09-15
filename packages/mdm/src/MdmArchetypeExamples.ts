import { AbstractMdmObject } from './AbstractMdmObject'
import { MdmArchetypeSpec } from './MdmArchetypeSpec'
import { MdmNature } from './enums/MdmEnums'
import { TextileGarmentSpecInterface, TEXTILE_GARMENT_ONTOLOGY_DEFAULT } from './domain/TextileDomain'
import { MediaDiskSpecInterface, MEDIA_DISK_ONTOLOGY_DEFAULT } from './domain/MediaDomain'
import { HardwareDeviceSpecInterface, HARDWARE_DEVICE_ONTOLOGY_DEFAULT } from './domain/HardwareDomain'
import { VirtualKeychainSpecInterface, VIRTUAL_KEYCHAIN_ONTOLOGY_DEFAULT } from './domain/VirtualDomain'

/**
 * Concrete Garment MDM Object Class (Extends AbstractMdmObject)
 * Enforces TextileGarmentSpecInterface over child Specification collection.
 */
export class Garment extends AbstractMdmObject {
   static COLLECTION = 'garments'

   getArchetypeSpec(): MdmArchetypeSpec {
      return {
         archetypeId: 'textile.garment',
         name: 'Garment Textile Item',
         nature: MdmNature.PHYSICAL,
         collection: Garment.COLLECTION,
         ontologyMapping: TEXTILE_GARMENT_ONTOLOGY_DEFAULT,
         requiredProperties: ['sizes', 'colors', 'materials'],
         optionalProperties: ['washCare', 'brand', 'weightGrams', 'fitType', 'ontologyMapping'],
      }
   }

   public get specifications(): TextileGarmentSpecInterface {
      return this.specificationsObject as TextileGarmentSpecInterface
   }
}

/**
 * Concrete TeeShirt Model Class (Extends Garment)
 */
export class TeeShirt extends Garment {
   static COLLECTION = 'tshirts'

   getArchetypeSpec(): MdmArchetypeSpec {
      return {
         archetypeId: 'textile.tshirt',
         name: 'Organic Cotton T-Shirt',
         nature: MdmNature.PHYSICAL,
         collection: TeeShirt.COLLECTION,
         ontologyMapping: TEXTILE_GARMENT_ONTOLOGY_DEFAULT,
         requiredProperties: ['sizes', 'colors', 'materials'],
         optionalProperties: ['washCare', 'brand', 'weightGrams', 'fitType', 'ontologyMapping'],
      }
   }
}

/**
 * Concrete Audio/Video Disk MDM Object Class (Extends AbstractMdmObject)
 * Enforces MediaDiskSpecInterface over child Specification collection.
 */
export class Disk extends AbstractMdmObject {
   static COLLECTION = 'disks'

   getArchetypeSpec(): MdmArchetypeSpec {
      return {
         archetypeId: 'media.disk',
         name: 'Audio/Video Media Disk',
         nature: MdmNature.PHYSICAL,
         collection: Disk.COLLECTION,
         ontologyMapping: MEDIA_DISK_ONTOLOGY_DEFAULT,
         requiredProperties: ['format', 'durationSec', 'trackCount'],
         optionalProperties: ['rpm', 'genre', 'label', 'isrcCodes', 'catalogNumber', 'ontologyMapping'],
      }
   }

   public get specifications(): MediaDiskSpecInterface {
      return this.specificationsObject as MediaDiskSpecInterface
   }
}

/**
 * Concrete Hardware IoT Device MDM Object Class (Extends AbstractMdmObject)
 * Enforces HardwareDeviceSpecInterface over child Specification collection.
 */
export class HardwareDevice extends AbstractMdmObject {
   static COLLECTION = 'devices'

   getArchetypeSpec(): MdmArchetypeSpec {
      return {
         archetypeId: 'hardware.device',
         name: 'IoT Hardware Device / Probe',
         nature: MdmNature.PHYSICAL,
         collection: HardwareDevice.COLLECTION,
         ontologyMapping: HARDWARE_DEVICE_ONTOLOGY_DEFAULT,
         requiredProperties: ['serialNumber', 'commCapabilities'],
         optionalProperties: ['powerCapabilities', 'sensorBuses', 'firmwareVersion', 'hardwareRevision', 'ontologyMapping'],
      }
   }

   public get specifications(): HardwareDeviceSpecInterface {
      return this.specificationsObject as HardwareDeviceSpecInterface
   }
}

/**
 * Concrete Virtual Keychain MDM Object Class (Extends AbstractMdmObject)
 * Enforces VirtualKeychainSpecInterface over child Specification collection.
 */
export class VirtualKeychain extends AbstractMdmObject {
   static COLLECTION = 'keychains'

   getArchetypeSpec(): MdmArchetypeSpec {
      return {
         archetypeId: 'virtual.keychain',
         name: 'Network Access Keychain Credentials',
         nature: MdmNature.VIRTUAL,
         collection: VirtualKeychain.COLLECTION,
         ontologyMapping: VIRTUAL_KEYCHAIN_ONTOLOGY_DEFAULT,
         requiredProperties: ['authMechanism', 'targetNetwork'],
         optionalProperties: ['scopes', 'expiresAt', 'maxUsageCount', 'ontologyMapping'],
      }
   }

   public get specifications(): VirtualKeychainSpecInterface {
      return this.specificationsObject as VirtualKeychainSpecInterface
   }
}

export { SoilProfile } from './domain/SoilProfile'
