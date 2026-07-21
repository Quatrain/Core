/**
 * Specification for configuring a single adapter instance.
 */
export type AdapterConfigSpec = string | {
   package: string;
   adapter: string;
   config?: Record<string, any>;
};

/**
 * Specification for a pivot class managing a single default adapter or a collection of named adapters.
 */
export type PivotAdaptersSpec = AdapterConfigSpec | Record<string, AdapterConfigSpec>;

/**
 * Base interface representing any application content payload to be delivered.
 */
export interface AppContentInterface {
   type: 'pwa' | 'web-bundle' | 'cli' | 'native';
   name: string;
   version: string;
}

/**
 * Specific content interface for PWA / Web application deliverables.
 */
export interface PWAContentInterface extends AppContentInterface {
   type: 'pwa';
   distPath?: string;            // Path to compiled static assets
   entryComponent?: any;         // Root UI component (Astro, React, Vue)
   theme?: Record<string, any>;  // Design tokens or CSS theme configuration
   manifest?: Record<string, any>; // Web App Manifest options
}

/**
 * Generic composition interface representing an application payload bound to its runtime infrastructure adapters.
 */
export interface AppCompositionInterface<TContent extends AppContentInterface = AppContentInterface> {
   /** The typed application content payload to deliver (e.g. PWA, WebBundle, CLI) */
   content: TContent;

   /**
    * The context of Quatrain pivot classes bound to this composition.
    * Each pivot class (e.g. Ai, Storage, Backend) can hold a single adapter or a map of named adapters.
    */
   adapters?: {
      ai?: PivotAdaptersSpec;
      backend?: PivotAdaptersSpec;
      auth?: PivotAdaptersSpec;
      storage?: PivotAdaptersSpec;
      queue?: PivotAdaptersSpec;
      messaging?: PivotAdaptersSpec;
      ingestion?: PivotAdaptersSpec;
   };

   /** Domain-specific configuration or metadata */
   config?: Record<string, any>;
}
