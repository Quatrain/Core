import { QuatrainDictionary } from './types'

/**
 * A standard, framework-agnostic translation manager and dictionary resolver.
 * Handles language registration and scoped key extraction with safety fallbacks.
 */
export class Translator {
    protected dictionaries: Record<string, QuatrainDictionary> = {}
    protected defaultLang: string

    /**
     * Initializes the translator utility.
     * 
     * @param defaultLang - The default language code (e.g. 'en', 'fr') to fallback to if a key is missing.
     */
    constructor(defaultLang: string = 'en') {
        this.defaultLang = defaultLang
    }

    /**
     * Registers a specific translation language dictionary.
     * 
     * @param lang - The language key code (e.g. 'en', 'fr').
     * @param dict - The fully conforming Quatrain dictionary instance.
     */
    public register(lang: string, dict: QuatrainDictionary): void {
        this.dictionaries[lang] = dict
    }

    /**
     * Translates a specific text label key inside a given dictionary scope.
     * 
     * @param scope - The dictionary scope key (e.g. 'table').
     * @param key - The specific term key inside the selected scope.
     * @param lang - The target language code to extract from (falls back to default language).
     * @returns The localized translation string, or the raw key string if no match was found.
     */
    public translate(scope: keyof QuatrainDictionary, key: string, lang: string = this.defaultLang): string {
        const dict: QuatrainDictionary | undefined = this.dictionaries[lang] || this.dictionaries[this.defaultLang]
        if (!dict) {
            return key
        }
        
        const scopeObj = dict[scope] as unknown as Record<string, string> | undefined
        return scopeObj?.[key] ?? key
    }
}
