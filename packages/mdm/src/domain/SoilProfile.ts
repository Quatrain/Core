import { AbstractMdmObject } from '../AbstractMdmObject'
import { MdmArchetypeSpec } from '../MdmArchetypeSpec'
import { MdmNature } from '../enums/MdmEnums'
import {
   SoilProfileSpecInterface,
   SoilTextureClass,
   SOIL_PROFILE_ONTOLOGY_DEFAULT,
} from './AgronomyDomain'

/**
 * Concrete Soil Profile MDM Object Class (Extends AbstractMdmObject)
 * Represents a stratified soil pedon with multiple horizons for agronomic modeling.
 */
export class SoilProfile extends AbstractMdmObject {
   static COLLECTION = 'soil-profiles'

   getArchetypeSpec(): MdmArchetypeSpec {
      return {
         archetypeId: 'agronomy.soil_profile',
         name: 'Stratified Soil Profile with Horizons',
         nature: MdmNature.PHYSICAL,
         collection: SoilProfile.COLLECTION,
         ontologyMapping: SOIL_PROFILE_ONTOLOGY_DEFAULT,
         requiredProperties: ['horizons', 'dominantTextureClass', 'origin'],
         optionalProperties: [
            'drainageClass',
            'maxRootingDepthCm',
            'sourceCoordinates',
            'parentMaterial',
            'ontologyMapping',
         ],
      }
   }

   public get specifications(): SoilProfileSpecInterface {
      return this.specificationsObject as SoilProfileSpecInterface
   }

   /**
    * Calculates the Total Available Water (TAW / RU in mm) and Readily Available Water (RAW / RFU in mm)
    * integrated across all horizons down to the specified crop rooting depth.
    *
    * @param rootDepthCm - Depth of root zone in centimeters (e.g. 80 cm for lavender/vine, 25 cm for vegetables).
    * @returns Integrated water storage in millimeters: { tawMm, rawMm }
    */
   public calculateAvailableWaterCapacity(rootDepthCm: number): { tawMm: number; rawMm: number } {
      const specs = this.specifications
      if (!specs?.horizons || specs.horizons.length === 0) {
         return { tawMm: 0, rawMm: 0 }
      }

      let totalTawMm = 0
      let totalRawMm = 0
      const effectiveDepth = Math.max(0, rootDepthCm)

      for (const horizon of specs.horizons) {
         const [topCm, bottomCm] = horizon.depthRange
         if (topCm >= effectiveDepth) {
            continue
         }

         const overlapTop = Math.max(0, topCm)
         const overlapBottom = Math.min(effectiveDepth, bottomCm)
         const thicknessCm = overlapBottom - overlapTop

         if (thicknessCm <= 0) continue

         const thicknessMm = thicknessCm * 10
         const fc = horizon.fieldCapacityVolumetric || 0
         const pwp = horizon.wiltingPointVolumetric || 0
         const twp = horizon.temporaryWiltingPointVolumetric || (pwp + (fc - pwp) * 0.4)
         const coarseRatio = (100 - (horizon.coarseFragmentsPercentage || 0)) / 100

         const horizonTaw = thicknessMm * Math.max(0, (fc - pwp) / 100) * coarseRatio
         const horizonRaw = thicknessMm * Math.max(0, (fc - twp) / 100) * coarseRatio

         totalTawMm += horizonTaw
         totalRawMm += horizonRaw
      }

      return {
         tawMm: Math.round(totalTawMm * 10) / 10,
         rawMm: Math.round(totalRawMm * 10) / 10,
      }
   }

   /**
    * Helper method classifying soil texture into one of the 10 canonical classes
    * based on USDA / FAO Soil Texture Triangle particle size percentages.
    *
    * @param clay - Clay percentage (0-100)
    * @param silt - Silt percentage (0-100)
    * @param sand - Sand percentage (0-100)
    */
   public static classifySoilTexture(clay: number, silt: number, sand: number): SoilTextureClass {
      // Silt-dominated
      if (silt >= 80 && clay < 12) {
         return SoilTextureClass.SILT
      }
      if ((silt >= 50 && clay >= 12 && clay < 27) || (silt >= 50 && silt < 80 && clay < 12)) {
         return SoilTextureClass.SILT_LOAM
      }

      // Clay-dominated
      if (clay >= 40) {
         if (silt >= 40) return SoilTextureClass.SILTY_CLAY_LOAM
         if (sand >= 45) return SoilTextureClass.SANDY_CLAY
         return SoilTextureClass.CLAY
      }

      // Intermediate Clays (27-40% Clay)
      if (clay >= 27 && clay < 40) {
         if (sand >= 20 && sand <= 45) return SoilTextureClass.CLAY_LOAM
         if (sand > 45) return SoilTextureClass.SANDY_CLAY_LOAM
         if (silt >= 40) return SoilTextureClass.SILTY_CLAY_LOAM
         return SoilTextureClass.CLAY_LOAM
      }

      // Sand-dominated (< 20% Clay)
      if (sand >= 85 && (silt + 1.5 * clay) < 15) {
         return SoilTextureClass.SAND
      }
      if (sand >= 70 && (silt + 2 * clay) < 30) {
         return SoilTextureClass.SANDY_LOAM
      }

      // Loam / Sandy Loam
      if (clay >= 7 && clay < 27 && silt >= 28 && silt < 50 && sand <= 52) {
         return SoilTextureClass.LOAM
      }
      if (clay < 20 && sand > 52) {
         return SoilTextureClass.SANDY_LOAM
      }

      return SoilTextureClass.LOAM
   }
}
