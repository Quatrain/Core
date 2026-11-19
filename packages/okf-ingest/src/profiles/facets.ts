import { DomainTaxonomyProfile, OkfJsonSchemaProperty } from '../types';

/**
 * A classification axis of a knowledge base, declared by the application.
 */
export interface FacetDefinitionInterface {
   /** Frontmatter key, such as `region` or `audience`. */
   name: string;
   /** What the facet classifies, given to the model. */
   description: string;
   /**
    * Values the model must choose from. When given, any other value it returns is
    * dropped, so the vocabulary stays closed.
    */
   values?: string[];
   /** Examples given to the model when the vocabulary is open. */
   examples?: string[];
}

/**
 * How a facet profile is built.
 */
export interface FacetTaxonomyProfileOptionsInterface {
   facets: FacetDefinitionInterface[];
   id?: string;
   name?: string;
   systemRole?: string;
   defaultCategory?: string;
   defaultTags?: string[];
   targetLanguages?: string[];
   /** Also asks for `thematics`, the themes of the knowledge base a document belongs to. */
   thematics?: string[] | boolean;
}

const FACET_NAME = /^[a-z][a-zA-Z0-9_]*$/;

/**
 * Taxonomy profile built from the facets an application declares: the prompt asks
 * for each facet, the schema requires a list of strings for it, and the result
 * keeps only the declared keys and, for a closed vocabulary, only its values. The
 * package itself knows no domain.
 */
export class FacetTaxonomyProfile implements DomainTaxonomyProfile {
   readonly id: string;
   readonly name: string;
   readonly systemRole: string;
   readonly defaultCategory?: string;
   readonly defaultTags?: string[];
   readonly targetLanguages?: string[];
   readonly promptGuidelines: string[];
   readonly schemaProperties: Record<string, OkfJsonSchemaProperty>;

   protected readonly facets: FacetDefinitionInterface[];
   protected readonly thematics: string[] | boolean;

   /**
    * @param options - Facets and identity of the profile.
    * @throws Error when a facet name is not a plain identifier or is declared twice.
    */
   constructor(options: FacetTaxonomyProfileOptionsInterface) {
      const seen = new Set<string>();
      for (const facet of options.facets) {
         if (!FACET_NAME.test(facet.name) || seen.has(facet.name) || facet.name === 'thematics') {
            throw new Error(`Facet name not valid or declared twice: ${facet.name}`);
         }
         seen.add(facet.name);
      }
      this.facets = options.facets.map((facet) => ({ ...facet }));
      this.thematics = options.thematics ?? false;
      this.id = options.id ?? 'facets';
      this.name = options.name ?? 'Facet taxonomy profile';
      this.systemRole =
         options.systemRole ??
         'You are an expert knowledge engineer specializing in structured knowledge synthesis according to the Open Knowledge Format (OKF v0.2) specification.';
      this.defaultCategory = options.defaultCategory;
      this.defaultTags = options.defaultTags;
      this.targetLanguages = options.targetLanguages;

      const list: OkfJsonSchemaProperty = { type: 'ARRAY', items: { type: 'STRING' } };
      this.schemaProperties = {};
      this.promptGuidelines = ['8. Classification (only values supported by the document; leave a list empty otherwise):'];
      if (this.thematics !== false) {
         this.schemaProperties.thematics = list;
         this.promptGuidelines.push(
            Array.isArray(this.thematics)
               ? `   - "thematics": Themes of the knowledge base the document belongs to, among: ${this.thematics.join(', ')}.`
               : '   - "thematics": Themes of the knowledge base the document belongs to.'
         );
      }
      for (const facet of this.facets) {
         this.schemaProperties[facet.name] = list;
         const hint = facet.values
            ? ` Choose among: ${facet.values.join(', ')}.`
            : facet.examples && facet.examples.length > 0
              ? ` (e.g. ${facet.examples.join(', ')})`
              : '';
         this.promptGuidelines.push(`   - "${facet.name}": ${facet.description}.${hint}`);
      }
   }

   /**
    * Keeps the declared facets of a model answer: lists of strings, restricted to the
    * vocabulary when one is declared.
    */
   extractDomainMetadata(rawResult: Record<string, unknown>): Record<string, unknown> {
      const result: Record<string, unknown> = {};
      if (this.thematics !== false) {
         result.thematics = this.pick(rawResult.thematics, Array.isArray(this.thematics) ? this.thematics : undefined);
      }
      for (const facet of this.facets) {
         result[facet.name] = this.pick(rawResult[facet.name], facet.values);
      }
      return result;
   }

   protected pick(value: unknown, vocabulary?: string[]): string[] | undefined {
      if (!Array.isArray(value)) {
         return undefined;
      }
      const strings = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '');
      const kept = vocabulary ? strings.filter((entry) => vocabulary.includes(entry)) : strings;
      return kept.length > 0 ? Array.from(new Set(kept)) : undefined;
   }
}
