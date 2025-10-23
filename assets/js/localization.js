// Localization utility for Bestiary Arena Mod Loader
// This file provides centralized language detection and translation utilities

// Language detection function
function isPortuguese() {
    return document.documentElement.lang === 'pt' || 
           document.querySelector('html[lang="pt"]') || 
           navigator.language.startsWith('pt');
}

// Get localized text based on current language
function getLocalizedText(englishText, portugueseText) {
    return isPortuguese() ? portugueseText : englishText;
}

// Load translations from pt-BR.json
async function loadTranslations() {
    try {
        const response = await fetch(chrome.runtime.getURL('assets/locales/pt-BR.json'));
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.warn('[Localization] Could not load pt-BR.json translations:', error);
    }
    return null;
}

// Get translation from pt-BR.json by path (e.g., 'mods.betterUI.settingsTitle')
async function getTranslation(translationPath) {
    if (!isPortuguese()) {
        return null; // Return null for English to use fallback text
    }
    
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

// Helper function to get localized text with pt-BR.json fallback
async function getLocalizedTextWithFallback(englishText, translationPath) {
    if (isPortuguese()) {
        const translation = await getTranslation(translationPath);
        return translation || englishText;
    }
    return englishText;
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