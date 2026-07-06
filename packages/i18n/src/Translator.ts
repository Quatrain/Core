import { CoreDictionary } from './types'

/**
 * A standard, framework-agnostic translation manager and dictionary resolver.
 * Handles language registration and scoped key extraction with safety fallbacks.
 */
export class Translator {
    protected dictionaries: Record<string, CoreDictionary> = {}
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
      * Registers one or multiple translation language dictionaries.
      * 
      * @param dicts - A record mapping language keys (e.g. 'en', 'fr') to dictionaries.
      */
     public register(dicts: Record<string, CoreDictionary>): void
     /**
      * Registers a specific translation language dictionary.
      * 
      * @param lang - The language key code (e.g. 'en', 'fr').
      * @param dict - The fully conforming Quatrain dictionary instance.
      */
     public register(lang: string, dict: CoreDictionary): void
     public register(
         langOrDicts: string | Record<string, CoreDictionary>,
         dict?: CoreDictionary
     ): void {
         if (typeof langOrDicts === 'string') {
             if (dict) {
                 this.dictionaries[langOrDicts] = dict
             }
         } else {
             for (const [lang, d] of Object.entries(langOrDicts)) {
                 this.dictionaries[lang] = d
             }
         }
     }

    /**
     * Translates a specific text label key inside a given dictionary scope.
     * Supports both standard (scope, key) calls and dotted key path (e.g. "backends.title") notation.
     * 
     * @param scope - The dictionary scope key (e.g. 'table') or a dotted key path (e.g. 'app.title').
     * @param keyOrLang - The specific term key inside the selected scope, or the language code if scope is a dotted key.
     * @param lang - The target language code to extract from (falls back to default language).
     * @returns The localized translation string, or the raw key string if no match was found.
     */
    public translate(scope: string, keyOrLang?: string, lang?: string): string {
        let resolvedLang = lang || this.defaultLang
        let resolvedScope = scope
        let resolvedKey = keyOrLang

        // Support dotted key notation (e.g. "backends.title")
        if (!keyOrLang || keyOrLang === 'en' || keyOrLang === 'fr') {
            if (scope.includes('.')) {
                const parts = scope.split('.')
                resolvedScope = parts[0]
                resolvedKey = parts.slice(1).join('.')
                resolvedLang = keyOrLang || lang || this.defaultLang
            }
        }

        const dict: CoreDictionary | undefined = this.dictionaries[resolvedLang] || this.dictionaries[this.defaultLang]
        if (!dict) {
            return resolvedKey || scope
        }

        // Handle nested dotted keys inside resolvedKey
        let current: any = dict[resolvedScope]
        if (resolvedKey) {
            const keyParts = resolvedKey.split('.')
            for (const part of keyParts) {
                if (current && typeof current === 'object') {
                    current = current[part]
                } else {
                    current = undefined
                    break
                }
            }
        }

        return typeof current === 'string' ? current : (resolvedKey || scope)
    }

    /**
     * Dynamically extends and merges existing translation dictionaries.
     * This allows consuming applications to register their specific UI translations at runtime.
     * 
     * @param dicts - A record mapping language keys (e.g. 'en', 'fr') to custom dictionaries.
     */
    public extend(dicts: Record<string, Record<string, any>>): void
    /**
     * Dynamically extends and merges an existing dictionary for a given language.
     * This allows consuming applications to register their specific UI translations at runtime.
     * 
     * @param lang - The language key code (e.g. 'en', 'fr').
     * @param customDict - The custom dictionary object containing terms to merge.
     */
    public extend(lang: string, customDict: Record<string, any>): void
    public extend(
        langOrDicts: string | Record<string, Record<string, any>>,
        customDict?: Record<string, any>
    ): void {
        if (typeof langOrDicts === 'string') {
            if (customDict) {
                if (!this.dictionaries[langOrDicts]) {
                    this.dictionaries[langOrDicts] = { table: {} as any }
                }
                this.dictionaries[langOrDicts] = this.deepMerge(this.dictionaries[langOrDicts], customDict)
            }
        } else {
            for (const [lang, dict] of Object.entries(langOrDicts)) {
                if (!this.dictionaries[lang]) {
                    this.dictionaries[lang] = { table: {} as any }
                }
                this.dictionaries[lang] = this.deepMerge(this.dictionaries[lang], dict)
            }
        }
    }


    /**
     * A helper method to perform recursive deep-merging of two dictionary objects.
     * 
     * @param target - The base target object.
     * @param source - The source object containing updates to merge.
     * @returns The deep-merged dictionary object.
     */
    protected deepMerge(target: any, source: any): any {
        if (!source) return target
        const output = { ...target }

        for (const key of Object.keys(source)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                output[key] = this.deepMerge(target[key] || {}, source[key])
            } else {
                output[key] = source[key]
            }
        }
        return output
    }

    /**
     * Returns a Proxy object representing a callable translation shortcut function `t`.
     * 
     * @example
     * const t = translator.getProxy('en')
     * t('app.title') // -> "Core App"
     * t.fr('app.title') // -> "Application Core"
     * 
     * @param lang - Optional default language code override for this proxy instance.
     * @returns A callable and chainable translation Proxy.
     */
    public getProxy(lang?: string): any {
        const targetLang = lang || this.defaultLang

        const handler = {
            apply: (target: any, thisArg: any, argumentsList: any[]) => {
                const [scope, key] = argumentsList
                return this.translate(scope, key, targetLang)
            },
            get: (target: any, prop: string | symbol) => {
                if (typeof prop === 'string') {
                    return this.getProxy(prop)
                }
                return Reflect.get(target, prop)
            }
        }

        const dummy = () => {}
        return new Proxy(dummy, handler)
    }
}

