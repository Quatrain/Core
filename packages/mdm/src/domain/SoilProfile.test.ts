import { SoilProfile } from './SoilProfile'
import {
   SoilTextureClass,
   SoilProfileOrigin,
   SoilDrainageClass,
} from './AgronomyDomain'
import { MdmNature } from '../enums/MdmEnums'

describe('SoilProfile MDM Object & Agronomy Domain', () => {
   it('should enforce correct archetype specification metadata', () => {
      const profile = SoilProfile.fromObject({
         name: 'Terroir Avignon Sud',
         archetypeId: 'agronomy.soil_profile',
         nature: MdmNature.PHYSICAL,
      })
      const archetype = profile.getArchetypeSpec()

      expect(archetype.archetypeId).toBe('agronomy.soil_profile')
      expect(archetype.nature).toBe(MdmNature.PHYSICAL)
      expect(archetype.collection).toBe('soil-profiles')
      expect(archetype.requiredProperties).toContain('horizons')
      expect(archetype.requiredProperties).toContain('dominantTextureClass')
      expect(archetype.requiredProperties).toContain('origin')
   })

   it('should classify soil textures correctly via USDA/FAO triangle logic', () => {
      // Clay: 50% clay, 30% silt, 20% sand
      expect(SoilProfile.classifySoilTexture(50, 30, 20)).toBe(SoilTextureClass.CLAY)
      // Clay Loam: 32% clay, 38% silt, 30% sand (Lavandes soil profile)
      expect(SoilProfile.classifySoilTexture(32, 38, 30)).toBe(SoilTextureClass.CLAY_LOAM)
      // Loam: 20% clay, 40% silt, 40% sand
      expect(SoilProfile.classifySoilTexture(20, 40, 40)).toBe(SoilTextureClass.LOAM)
      // Sand: 5% clay, 5% silt, 90% sand
      expect(SoilProfile.classifySoilTexture(5, 5, 90)).toBe(SoilTextureClass.SAND)
      // Silt: 8% clay, 85% silt, 7% sand
      expect(SoilProfile.classifySoilTexture(8, 85, 7)).toBe(SoilTextureClass.SILT)
   })

   it('should validate and calculate Total Available Water (TAW) across horizons', () => {
      const profile = SoilProfile.fromObject({
         name: 'Sol Argilo-Limoneux Méditerranéen',
         sku: 'SOIL-AVIGNON-01',
         archetypeId: 'agronomy.soil_profile',
         nature: MdmNature.PHYSICAL,
      })

      profile.setSpecificationsFromObject({
         dominantTextureClass: SoilTextureClass.CLAY_LOAM,
         origin: SoilProfileOrigin.SOILGRIDS_V2,
         drainageClass: SoilDrainageClass.WELL_DRAINED,
         maxRootingDepthCm: 100,
         sourceCoordinates: {
            latitude: 43.949,
            longitude: 4.805,
         },
         horizons: [
            {
               depthRange: [0, 15],
               clayPercentage: 30,
               siltPercentage: 40,
               sandPercentage: 30,
               coarseFragmentsPercentage: 5,
               textureClass: SoilTextureClass.CLAY_LOAM,
               fieldCapacityVolumetric: 32, // 32%
               wiltingPointVolumetric: 12,  // 12%
               temporaryWiltingPointVolumetric: 20, // 20%
            },
            {
               depthRange: [15, 30],
               clayPercentage: 34,
               siltPercentage: 36,
               sandPercentage: 30,
               coarseFragmentsPercentage: 10,
               textureClass: SoilTextureClass.CLAY_LOAM,
               fieldCapacityVolumetric: 34, // 34%
               wiltingPointVolumetric: 14,  // 14%
               temporaryWiltingPointVolumetric: 22,
            },
            {
               depthRange: [30, 60],
               clayPercentage: 38,
               siltPercentage: 32,
               sandPercentage: 30,
               coarseFragmentsPercentage: 15,
               textureClass: SoilTextureClass.CLAY_LOAM,
               fieldCapacityVolumetric: 35, // 35%
               wiltingPointVolumetric: 15,  // 15%
               temporaryWiltingPointVolumetric: 23,
            },
            {
               depthRange: [60, 100],
               clayPercentage: 42,
               siltPercentage: 28,
               sandPercentage: 30,
               coarseFragmentsPercentage: 20,
               textureClass: SoilTextureClass.CLAY,
               fieldCapacityVolumetric: 36,
               wiltingPointVolumetric: 16,
               temporaryWiltingPointVolumetric: 24,
            },
         ],
      })

      expect(profile.validateArchetypeSpecs()).toBe(true)

      // Test 1: Shallow rooting depth (25 cm - e.g. salad/vegetables)
      // Horizon 0-15: 150mm * (32-12)% * 0.95 = 150 * 0.20 * 0.95 = 28.5 mm TAW
      // Horizon 15-25: 100mm * (34-14)% * 0.90 = 100 * 0.20 * 0.90 = 18.0 mm TAW
      // Expected TAW = 28.5 + 18.0 = 46.5 mm
      const res25cm = profile.calculateAvailableWaterCapacity(25)
      expect(res25cm.tawMm).toBe(46.5)

      // Test 2: Deep rooting depth (60 cm - e.g. lavender/vines in intermediate stage)
      // Horizon 0-15: 28.5 mm
      // Horizon 15-30: 150mm * 0.20 * 0.90 = 27.0 mm
      // Horizon 30-60: 300mm * (35-15)% * 0.85 = 300 * 0.20 * 0.85 = 51.0 mm
      // Expected TAW = 28.5 + 27.0 + 51.0 = 106.5 mm
      const res60cm = profile.calculateAvailableWaterCapacity(60)
      expect(res60cm.tawMm).toBe(106.5)
      expect(res60cm.rawMm).toBeGreaterThan(0)
      expect(res60cm.rawMm).toBeLessThan(res60cm.tawMm)
   })
})
