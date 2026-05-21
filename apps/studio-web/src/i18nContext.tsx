import React, { createContext, useContext, useState } from 'react'
import { Translator } from '@quatrain/i18n'
import { enDictionary } from '@quatrain/i18n-en'
import { frDictionary } from '@quatrain/i18n-fr'
import localEn from './locales/en.json'
import localFr from './locales/fr.json'

/**
 * Type definition for the native i18n Context.
 */
export interface I18nContextType {
    /** The localized translation function, supporting dotted-key notation. */
    t: (key: string, defaultValue?: string) => string
    
    /** The current active language locale (e.g. 'en', 'fr'). */
    locale: string
    
    /** Sets the current active language and persists the choice in localStorage. */
    changeLanguage: (lang: string) => void
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

// Initialize framework-agnostic translator
const translator = new Translator('fr')

// Register core dictionaries
translator.register('en', enDictionary)
translator.register('fr', frDictionary)

// Dynamic dynamic extension using consuming application's custom translations
translator.extend('en', localEn)
translator.extend('fr', localFr)

/**
 * Lightweight, native React Provider wrapper to deliver dynamic i18n.
 * Replaces react-i18next / i18next third-party integrations entirely.
 * 
 * @param props - Object containing children elements.
 * @returns React functional provider.
 */
export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [locale, setLocale] = useState<string>(() => {
        return localStorage.getItem('coreStudioLang') || 'fr'
    })

    const changeLanguage = (lang: string) => {
        setLocale(lang)
        localStorage.setItem('coreStudioLang', lang)
    }

    const t = (key: string, defaultValue?: string): string => {
        const result = translator.translate(key, undefined, locale)
        const parts = key.split('.')
        const lastPart = parts[parts.length - 1]
        if ((result === key || result === lastPart) && defaultValue !== undefined) {
            return defaultValue
        }
        return result
    }

    return (
        <I18nContext.Provider value={{ t, locale, changeLanguage }}>
            {children}
        </I18nContext.Provider>
    )
}

/**
 * Custom React Hook to consume i18n context values.
 * 
 * @returns The localized translating features.
 */
export const useI18n = (): I18nContextType => {
    const context = useContext(I18nContext)
    if (!context) {
        throw new Error('useI18n must be used within an I18nProvider')
    }
    return context
}
