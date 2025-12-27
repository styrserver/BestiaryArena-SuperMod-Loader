// Localization utility for Bestiary Arena Mod Loader
// This file provides centralized language detection and translation utilities

// Language detection function
// Checks stored preference first, then browser language in popup context, game language otherwise
function isPortuguese() {
    // Check if user has stored a language preference
    const storedLang = localStorage.getItem('popup-language');
    if (storedLang) {
        return storedLang === 'pt-BR';
    }

    // Check if we're in a popup context (extension popup page)
    const isPopup = window.location.protocol === 'chrome-extension:' ||
                    window.location.protocol === 'moz-extension:' ||
                    window.location.href.includes('/popup.html');

    if (isPopup) {
        // In popup: check browser language
        const browserLang = navigator.language || navigator.languages?.[0] || '';
        return browserLang.toLowerCase().startsWith('pt');
    }

    // In game/content script: check game language
    return document.documentElement.lang === 'pt' ||
           document.querySelector('html[lang="pt"]') ||
           window.location.href.includes('/pt/');
}

// Get localized text based on current language
function getLocalizedText(englishText, portugueseText) {
    return isPortuguese() ? portugueseText : englishText;
}

// Cache for loaded translations
let translationsCache = null;
let translationsLocale = null;

// Load translations from JSON file
async function loadTranslations() {
    const locale = isPortuguese() ? 'pt-BR' : 'en-US';
    
    // Return cached translations if already loaded for this locale
    if (translationsCache && translationsLocale === locale) {
        return translationsCache;
    }
    
    try {
        const filename = locale === 'pt-BR' ? 'pt-BR.json' : 'en-US.json';
        const response = await fetch(chrome.runtime.getURL(`assets/locales/${filename}`));
        if (response.ok) {
            translationsCache = await response.json();
            translationsLocale = locale;
            return translationsCache;
        }
    } catch (error) {
        console.warn(`[Localization] Could not load ${locale} translations:`, error);
    }
    return null;
}

// Get translation from JSON by path (e.g., 'popup.searchPlaceholder')
async function getTranslation(translationPath) {
    const translations = await loadTranslations();
    if (!translations) {
        return null;
    }
    
    const keys = translationPath.split('.');
    let result = translations;
    
    for (const key of keys) {
        if (result && typeof result === 'object' && key in result) {
            result = result[key];
        } else {
            return null;
        }
    }
    
    return result;
}

// Helper function to get localized text with fallback
async function getLocalizedTextWithFallback(englishText, translationPath) {
    const translation = await getTranslation(translationPath);
    return translation || englishText;
}

// Export functions for use in mods
if (typeof window !== 'undefined') {
    window.LocalizationUtils = {
        isPortuguese,
        getLocalizedText,
        loadTranslations,
        getTranslation,
        getLocalizedTextWithFallback
    };
}