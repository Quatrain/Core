import { OntologyMappingInterface } from './OntologyDomain'

/**
 * Standard USDA / FAO Soil Texture Classes (10 canonical pedological classes)
 */
export enum SoilTextureClass {
   CLAY = 'clay',
   CLAY_LOAM = 'clay-loam',
   SILTY_CLAY_LOAM = 'silty-clay-loam',
   LOAM = 'loam',
   SILT_LOAM = 'silt-loam',
   SANDY_CLAY = 'sandy-clay',
   SANDY_CLAY_LOAM = 'sandy-clay-loam',
   SANDY_LOAM = 'sandy-loam',
   SAND = 'sand',
   SILT = 'silt',
}

/**
 * Standard Origins for Pedological Soil Profiles
 */
export enum SoilProfileOrigin {
   SOILGRIDS_V2 = 'soilgrids_v2',
   LABORATORY_ANALYSIS = 'laboratory_analysis',
   MANUAL_FIELD = 'manual_field',
   REGIONAL_REFERENCE = 'regional_reference',
}

/**
 * Standard Soil Drainage Classes
 */
export enum SoilDrainageClass {
   EXCESSIVE = 'excessive',
   WELL_DRAINED = 'well_drained',
   MODERATELY_WELL = 'moderately_well',
   IMPERFECT = 'imperfect',
   POOR = 'poor',
}

/**
 * Standardized Pedological Soil Horizon Interface
 * Describes physical, chemical, and hydrodynamic properties of a single soil layer.
 */
export interface SoilHorizonInterface extends Record<string, unknown> {
   /** Depth range in centimeters: [topDepthCm, bottomDepthCm] e.g. [0, 15] */
   depthRange: [number, number]
   /** Granulometry: Clay mass percentage (0-100%) */
   clayPercentage: number
   /** Granulometry: Silt mass percentage (0-100%) */
   siltPercentage: number
   /** Granulometry: Sand mass percentage (0-100%) */
   sandPercentage: number
   /** Volumetric coarse fragments / stones percentage (> 2mm) (0-100%) */
   coarseFragmentsPercentage?: number
   /** Texture class mapped to standard taxonomy */
   textureClass: SoilTextureClass
   /** Bulk density in g/cm³ (typically 1.1 to 1.7 g/cm³) */
   bulkDensityGcm3?: number
   /** Organic matter content percentage (%) */
   organicMatterPercentage?: number
   /** Soil Organic Carbon (SOC) in g/kg */
   organicCarbonGkg?: number
   /** Soil pH in water (pH H2O) */
   phWater?: number
   /** Field Capacity (FC / Theta_CC) in volumetric % (or cm³/100cm³) */
   fieldCapacityVolumetric: number
   /** Permanent Wilting Point (PWP / Theta_PFP) in volumetric % */
   wiltingPointVolumetric: number
   /** Temporary Wilting Point / Readily available threshold (TWP / Theta_RFU) in volumetric % */
   temporaryWiltingPointVolumetric?: number
   /** Saturated hydraulic conductivity Ksat in mm/h */
   ksatMmPerHour?: number
}

/**
 * Standard Recognized FAO GLOSIS / W3C SOSA / OKF Agronomic Soil Profile Ontology Mapping
 */
export const SOIL_PROFILE_ONTOLOGY_DEFAULT: OntologyMappingInterface = {
   ontologyUri: 'https://glosis.org/soil/SoilProfile',
   w3cSosaTerm: 'sosa:FeatureOfInterest',
   w3cWotType: 'wot:Thing',
   schemaOrgType: 'https://schema.org/Place',
   gs1GpcCode: '10000000', // Agricultural / Land Assets
}

/**
 * Standardized Multi-Horizon Stratified Soil Profile Specification Interface
 */
export interface SoilProfileSpecInterface extends Record<string, unknown> {
   /** Ordered list of soil horizons from surface to bedrock/subsoil */
   horizons: SoilHorizonInterface[]
   /** Dominant / Topsoil texture class */
   dominantTextureClass: SoilTextureClass
   /** Origin / Provenance of the pedological data */
   origin: SoilProfileOrigin | string
   /** Drainage classification */
   drainageClass?: SoilDrainageClass | string
   /** Maximum depth of root penetration in cm */
   maxRootingDepthCm?: number
   /** Source GPS coordinates if resolved via geospatial API */
   sourceCoordinates?: {
      latitude: number
      longitude: number
      altitude?: number
   }
   /** Parent rock / geological substrate description */
   parentMaterial?: string
   /** Standard ontology mapping */
   ontologyMapping?: OntologyMappingInterface
}
