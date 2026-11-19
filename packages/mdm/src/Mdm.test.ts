import { Mdm } from './Mdm'
import { MockMdmAdapter } from './MockMdmAdapter'
import { MdmNature } from './enums/MdmEnums'
import { GarmentSize, TextileColor, TextileMaterial } from './domain/TextileDomain'
import { TeeShirt, Garment, Disk, VirtualKeychain, HardwareDevice } from './MdmArchetypeExamples'
import { MediaDiskFormat } from './domain/MediaDomain'
import { Specification } from './Specification'
import { Vendor } from './Vendor'
import { MdmSpecGroups } from './MdmSpecGroups'

describe('@quatrain/mdm Pivot Class, Adapter Specification & Vendor Read/Write Test Suite', () => {
   beforeEach(() => {
      const adapter = new MockMdmAdapter('default')
      Mdm.addAdapter(adapter, 'default', true)
   })

   it('should retrieve registered Quatrain MDM standard specification groups via MdmSpecGroups', () => {
      const dimGroup = MdmSpecGroups.getGroup('@quatrain/mdm/groups/dimensions')
      const vendorGroup = MdmSpecGroups.getGroup('@quatrain/mdm/groups/vendor')

      expect(dimGroup).toBeDefined()
      expect(dimGroup?.$id).toBe('@quatrain/mdm/groups/dimensions')
      expect(vendorGroup).toBeDefined()
      expect(vendorGroup?.$id).toBe('@quatrain/mdm/groups/vendor')
   })

   it('should register and retrieve MDM adapters via alias registry', () => {
      const adapter = Mdm.getAdapter('default')
      expect(adapter).toBeInstanceOf(MockMdmAdapter)
      expect(adapter.alias).toBe('default')
   })

   it('should save and read Specifications via Mdm adapter methods', async () => {
      const tshirt = TeeShirt.fromObject({
         name: 'Test Tee',
         archetypeId: 'textile.tshirt',
         nature: MdmNature.PHYSICAL
      })

      const spec = Specification.fromObject({
         name: 'sizes',
         key: 'sizes',
         value: [GarmentSize.MEDIUM, GarmentSize.LARGE],
         parent: tshirt
      })

      await Mdm.saveSpecification(tshirt, spec)
      const fetchedSpecs = await Mdm.getSpecifications(tshirt)
      expect(fetchedSpecs.length).toBe(1)
      expect(fetchedSpecs[0].val('key')).toBe('sizes')
   })

   it('should save, attach and read Vendors via Mdm adapter methods', async () => {
      const vendor = Vendor.fromObject({
         name: 'Acme Textiles',
         sku: 'ACME-01'
      })

      await Mdm.saveVendor(vendor)

      const tshirt = TeeShirt.fromObject({
         name: 'Test Tee Vendor',
         archetypeId: 'textile.tshirt',
         nature: MdmNature.PHYSICAL
      })

      await Mdm.attachVendor(tshirt, vendor, 'ACME-SKU-99', 'supplier', true)

      const attachedVendors = await Mdm.getVendors(tshirt)
      expect(attachedVendors.length).toBe(1)
      expect(attachedVendors[0].val('name')).toBe('Acme Textiles')
   })

   it('should create and validate a TeeShirt product variant and inventory unit using Specification & ObjectVendor collections', () => {
      const ecoMillsVendor = Vendor.fromObject({
         name: 'EcoApparel Mills',
         url: 'https://ecomills.example.com'
      })

      const tshirtVariant = TeeShirt.fromObject({
         name: 'Quatrain Organic V-Neck T-Shirt (Navy)',
         sku: 'QT-TSHIRT-ORG-001',
         archetypeId: 'textile.tshirt',
         nature: MdmNature.PHYSICAL,
         lifecycleState: 'production'
      })

      tshirtVariant.addVendor(ecoMillsVendor, 'ECO-MILL-883', 'manufacturer', true)

      tshirtVariant.setSpecificationsFromObject({
         sizes: [GarmentSize.SMALL, GarmentSize.MEDIUM, GarmentSize.LARGE],
         colors: [TextileColor.NAVY_BLUE, TextileColor.WHITE],
         materials: [TextileMaterial.ORGANIC_COTTON],
         brand: 'Quatrain EcoWear'
      })

      expect(tshirtVariant.validateArchetypeSpecs()).toBe(true)
      expect(tshirtVariant.getVendors().length).toBe(1)
      expect(tshirtVariant.getVendors()[0].val('name')).toBe('EcoApparel Mills')

      const tshirtUnit = TeeShirt.fromObject({
         name: 'Quatrain T-Shirt - Size Medium Navy',
         archetypeId: 'textile.tshirt',
         parent: tshirtVariant,
         nature: MdmNature.PHYSICAL,
         lifecycleState: 'AVAILABLE'
      })

      tshirtUnit.setSpecificationsFromObject({
         selectedSize: GarmentSize.MEDIUM,
         selectedColor: TextileColor.NAVY_BLUE,
         barcode: '3760000000042'
      })

      expect(tshirtUnit.getSubcollectionName('certifications')).toContain('certifications')
   })

   it('should validate missing required textile properties on Garment instance', () => {
      const garment = Garment.fromObject({
         name: 'Incomplete Garment',
         archetypeId: 'textile.garment',
         nature: MdmNature.PHYSICAL
      })

      garment.setSpecification('materials', [TextileMaterial.COTTON])
      expect(() => garment.validateArchetypeSpecs()).toThrow(/MdmValidationError: Missing required archetype specification 'sizes'/)
   })

   it('should support MediaDiskFormat ENUM and MediaDiskSpecInterface interface on Disk class using Specification collection', () => {
      const disk = Disk.fromObject({
         name: 'Vinyl Collector Album 33 RPM',
         sku: 'VINYL-ALBUM-001',
         archetypeId: 'media.disk',
         nature: MdmNature.PHYSICAL
      })

      disk.setSpecificationsFromObject({
         format: MediaDiskFormat.VINYL_12IN,
         durationSec: 2400,
         trackCount: 10,
         diameterInches: 12,
         speedRpm: 33,
         audioChannels: 'STEREO',
         albumTitle: 'Quatrain Echoes',
         artistName: 'The Deep Mind Ensemble'
      })

      expect(disk.validateArchetypeSpecs()).toBe(true)
      expect(disk.specifications.format).toBe(MediaDiskFormat.VINYL_12IN)
      expect(disk.specifications.speedRpm).toBe(33)
   })

   it('should support VirtualKeychain and HardwareDevice archetypes', () => {
      const keychain = VirtualKeychain.fromObject({
         name: 'Production AWS KMS Key',
         sku: 'KMS-PROD-KEY-01',
         archetypeId: 'virtual.keychain',
         nature: MdmNature.VIRTUAL
      })

      keychain.setSpecificationsFromObject({
         authMechanism: 'AWS_KMS_IAM',
         targetNetwork: 'aws-us-east-1',
         keyType: 'ASYMMETRIC_RSA_4096',
         cipherAlgorithm: 'AES_256_GCM',
         provider: 'AWS_KMS',
         vaultUri: 'aws:kms:us-east-1:123456789:key/prod-01'
      })

      expect(keychain.validateArchetypeSpecs()).toBe(true)
      expect(keychain.specifications.vaultUri).toBe('aws:kms:us-east-1:123456789:key/prod-01')

      const dev = HardwareDevice.fromObject({
         name: 'Environmental Sensor Node',
         sku: 'ACME-PROBE-01',
         archetypeId: 'hardware.device',
         nature: MdmNature.PHYSICAL
      })

      dev.setSpecificationsFromObject({
         serialNumber: 'SN-001',
         commCapabilities: ['LORA_868'],
         deviceType: 'probe',
         firmwareVersion: 'v2.1.4',
         hardwareRevision: 'rev-B',
         macAddress: '00:1B:44:11:3A:B7',
         enclosureRating: 'IP68'
      })

      expect(dev.validateArchetypeSpecs()).toBe(true)
      expect(dev.specifications.enclosureRating).toBe('IP68')
   })
})
