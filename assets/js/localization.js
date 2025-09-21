// Polyfill for Chrome and Firefox WebExtensions
if (typeof window.browser === 'undefined') {
  window.browser = window.chrome;
}

window.browserAPI = window.browserAPI || (typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null));

class Localization {
  constructor() {
    this.currentLocale = 'en-US';
    this.translations = {};
    this.supportedLocales = ['en-US'];
    this.defaultLocale = 'en-US';
    this.onLocaleChangeCallbacks = [];
  }

  async init() {
    try {
      const storage = await window.browserAPI.storage.local.get('locale');
      this.currentLocale = storage.locale || this.defaultLocale;
    } catch (error) {
      console.error('Error loading language preference:', error);
      this.currentLocale = this.defaultLocale;
    }

    await this.loadTranslations();
    
    this.updateInterface();
    
    return this;
  }

  async loadTranslations() {
    try {
      for (const locale of this.supportedLocales) {
        const response = await window.browserAPI.runtime.getURL(`assets/locales/${locale}.json`);
        if (response.ok) {
          this.translations[locale] = await response.json();
        } else {
          console.error(`Error loading translations for ${locale}:`, response.statusText);
        }
      }
    } catch (error) {
      console.error('Error loading translations:', error);
    }
  }

  t(key, locale = null) {
    const currentLocale = locale || this.currentLocale;
    
    const keys = key.split('.');
    let translation = this.translations[currentLocale];
    
    for (const k of keys) {
      if (!translation || !translation[k]) {
        if (currentLocale !== this.defaultLocale) {
          return this.t(key, this.defaultLocale);
        }
        return key;
      }
      translation = translation[k];
    }
    
    return translation;
  }

  async setLocale(locale) {
    if (!this.supportedLocales.includes(locale)) {
      console.error(`Unsupported language: ${locale}`);
      return false;
    }
    
    this.currentLocale = locale;
    
    try {
      await window.browserAPI.storage.local.set({ locale });
    } catch (error) {
      console.error('Error saving language preference:', error);
    }
    
    this.updateInterface();
    
    this.onLocaleChangeCallbacks.forEach(callback => callback(locale));
    
    return true;
  }

  onLocaleChange(callback) {
    if (typeof callback === 'function') {
      this.onLocaleChangeCallbacks.push(callback);
    }
  }

  updateInterface() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      element.textContent = this.t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      element.placeholder = this.t(key);
    });
  }

  getLocale() {
    return this.currentLocale;
  }

  getSupportedLocales() {
    return this.supportedLocales.map(locale => ({
      code: locale,
      name: this.t(`language.${locale}`)
    }));
  }
}

window.i18n = new Localization();