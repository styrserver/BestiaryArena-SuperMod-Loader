// =======================
// 0. Version & Metadata
// =======================
(function() {
  
    // =======================
    // 1. Configuration & Constants
    // =======================
      const defaultConfig = { enabled: true };
      const config = Object.assign({}, defaultConfig, context?.config);
      
      // Use shared translation system via API
      const api = context?.api || window.BestiaryModAPI;
      const t = (key) => api?.i18n?.t(key) || key;
      
      // Performance constants
      const CONSTANTS = {
        DEBOUNCE_DELAY: 50, // Reduced from 100ms for faster response
        RETRY_MAX_ATTEMPTS: 5,
        RETRY_BASE_DELAY: 100,
        RETRY_DELAY: 500,
        ERROR_DISPLAY_DURATION: 5000,
        MAX_INPUT_WIDTH: 50
      };
      
      const BETTER_YASIR_PO_ORDERS_STORAGE_KEY = 'better-yasir-po-orders-v1';
      const BETTER_YASIR_PO_HISTORY_STORAGE_KEY = 'better-yasir-po-purchase-history-v1';
      const BETTER_YASIR_PO_HISTORY_COMMA_MIGRATION_KEY = 'better-yasir-po-history-comma-migration-v1';
      const BETTER_YASIR_PO_HISTORY_MAX = 200;
      const BETTER_YASIR_PO_PLACEMENT_GRACE_MS = 30000;
      
      // DOM selectors cache
      const SELECTORS = {
        YASIR_MODAL: '.widget-bottom',
        SHOP_TABLE: 'table',
        SHOP_ROW: 'tbody tr',
        ITEM_SLOT: '.container-slot',
        BUY_BUTTON: 'button',
        SELL_BUTTON: 'button',
        SECTION_HEADER: '.widget-top',
        SECTION_CONTENT: '.widget-bottom',
        SECTIONS: '.w-full',
        DICE_MANIPULATOR_SPRITE: '.sprite.item',
        RARITY_ELEMENT: '[data-rarity]',
        EXALTATION_CHEST_IMG: 'img[src*="exaltation-chest"]',
        RECYCLE_RUNE_IMG: 'img[src*="rune-recycle"]',
        DUST_IMG: 'img[src*="dust-large"]',
        STONE_OF_INSIGHT_SPRITE: '.sprite.item'
      };
      
      // DOM cache for frequently accessed elements
      const domCache = new Map();
      const CACHE_TTL = 15000; // 15 seconds cache time (reduced from 30s for better responsiveness)
      
      // DOM cache management
      function getCachedElement(selector, context = document) {
        const cacheKey = `${selector}-${context.uid || 'document'}`;
        const cached = domCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          return cached.element;
        }
        
        const element = context.querySelector(selector);
        if (element) {
          domCache.set(cacheKey, { element, timestamp: Date.now() });
        }
        return element;
      }
      
      function getCachedElements(selector, context = document) {
        const cacheKey = `${selector}-all-${context.uid || 'document'}`;
        const cached = domCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          return cached.elements;
        }
        
        const elements = Array.from(context.querySelectorAll(selector));
        domCache.set(cacheKey, { elements, timestamp: Date.now() });
        return elements;
      }
      
      function clearDomCache() {
        domCache.clear();
      }
      
      function invalidateCacheForElement(element) {
        // Remove any cache entries that reference this element
        for (const [key, value] of domCache.entries()) {
          if (value.element === element || (value.elements && value.elements.includes(element))) {
            domCache.delete(key);
          }
        }
      }
      
      // Event listener management
      const eventListeners = new Map();
      let confirmationOutsideHandler = null;
      let observer = null;
      let observerTimeout = null;
      /** Runs sync on intro mutations so we can rebuild before paint (debounced observer is too late). */
      let yasirIntroSyncObserver = null;
      
      let yasirActiveSettingsPanel = null;
      let yasirSettingsEscListenerKey = null;
      let yasirSettingsResizeListenerKey = null;
      let yasirSettingsModalObserver = null;
      let yasirSettingsRepositionTimer = null;
      let yasirSettingsResizeObserver = null;
      let yasirSettingsResizeObserverTarget = null;
      let yasirSettingsPanelCleanupLock = false;
      let yasirPoOrderFulfillmentInProgress = false;
      let yasirPoAffordabilityUnsub = null;
      let yasirDailyPoUnsub = null;
      let yasirDailyPoLastSig = null;
      let yasirDailyPoSetupRetryTimer = null;
      let yasirPoHeadlessFulfillTimer = null;
      let yasirPoOrderPlacementGraceUntil = 0;
      
      // Track processed elements to prevent re-processing
      const processedElements = new WeakSet();
      
      // Cache item key detection results
      let itemKeyCache = new WeakMap();
      
      // Centralized event listener management
      function addManagedEventListener(element, event, handler, options = {}) {
        const key = `${element.uid || Math.random()}-${event}`;
        eventListeners.set(key, { element, event, handler, options });
        element.addEventListener(event, handler, options);
        return key;
      }
      
      function removeManagedEventListener(key) {
        const listener = eventListeners.get(key);
        if (listener) {
          listener.element.removeEventListener(listener.event, listener.handler, listener.options);
          eventListeners.delete(key);
        }
      }
      
      function cleanupAllEventListeners() {
        eventListeners.forEach((listener, key) => {
          listener.element.removeEventListener(listener.event, listener.handler, listener.options);
        });
        eventListeners.clear();
      }
      
      // Cleanup confirmation handler
      function cleanupConfirmationHandler() {
        if (confirmationOutsideHandler) {
          document.removeEventListener('click', confirmationOutsideHandler, true);
          confirmationOutsideHandler = null;
        }
      }
      
      // Cleanup observer and timeouts
      function cleanupObservers() {
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        if (observerTimeout) {
          clearTimeout(observerTimeout);
          observerTimeout = null;
        }
        if (yasirIntroSyncObserver) {
          yasirIntroSyncObserver.disconnect();
          yasirIntroSyncObserver = null;
        }
      }
      
      // CSS styles for the quantity input and action buttons
      const QUANTITY_INPUT_STYLES = `
        .better-yasir-quantity-input {
          width: 100%;
          max-width: ${CONSTANTS.MAX_INPUT_WIDTH}px;
          height: 20px;
          background-image: url('https://bestiaryarena.com/_next/static/media/background-darker.2679c837.png');
          background-size: auto;
          background-repeat: repeat;
          background-position: center;
          border: none;
          color: white;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          text-align: center;
          padding: 2px;
          margin-bottom: 1px;
          border-radius: 2px;
          display: block;
          position: relative;
        }
        
        .better-yasir-quantity-input::before {
          content: '';
          position: absolute;
          top: -2px;
          left: -2px;
          right: -2px;
          bottom: -2px;
          background-image: url('https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png');
          background-size: 100% 100%;
          background-repeat: no-repeat;
          background-position: center;
          z-index: -1;
          border-radius: 4px;
        }
        .better-yasir-quantity-input:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(106, 106, 106, 0.5);
        }
        .better-yasir-quantity-input::-webkit-inner-spin-button,
        .better-yasir-quantity-input::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .better-yasir-action-button {
          /* Only override specific behaviors, let original classes handle styling */
          transition: all 0.1s ease !important;
        }
        
        /* Confirmation highlight */
        .better-yasir-action-button.confirm {
          background-image: url('https://bestiaryarena.com/_next/static/media/background-green.be515334.png') !important;
          border: 1px solid #32cd32 !important;
          box-shadow: 0 0 8px rgba(50, 205, 50, 0.6) !important;
        }
        
        /* Hide React's one-frame plain-text intro until our .tooltip-prose is back (no visible flash). */
        .widget-bottom[data-better-yasir-enhanced] > div.grid.gap-3:not(:has(.tooltip-prose)) {
          visibility: hidden;
          min-height: 92px;
        }
        
        .better-yasir-po-section {
          margin-bottom: 10px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        }
        .better-yasir-po-section:last-of-type {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }
        .better-yasir-settings-main {
          display: flex;
          flex-direction: column;
          width: 100%;
          flex: 1;
          min-height: 0;
          box-sizing: border-box;
          overflow: hidden;
        }
        .better-yasir-settings-tab-panels {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .better-yasir-settings-tab-panel {
          flex: 1;
          min-height: 0;
          display: none;
          flex-direction: column;
          overflow-y: auto;
          overflow-x: hidden;
          background: rgba(0, 0, 0, 0.18);
          padding: 16px;
          box-sizing: border-box;
        }
        .better-yasir-settings-tab-panel.is-active {
          display: flex;
        }
        .better-yasir-settings-tab-panel.better-yasir-settings-tab-panel--po-orders {
          overflow: hidden;
        }
        .better-yasir-settings-tab-bar {
          display: flex;
          flex-direction: row;
          gap: 6px;
          margin-top: 10px;
        }
        .better-yasir-settings-tab {
          flex: 1;
          min-width: 0;
          text-align: center;
        }
        .better-yasir-settings-panel-header {
          flex-shrink: 0;
          padding: 12px 16px 8px;
          box-sizing: border-box;
          border-bottom: 1px solid #444;
          background: rgba(0, 0, 0, 0.15);
        }
        .better-yasir-orders-typography {
          font-size: 10px;
          line-height: 1.38;
        }
        .better-yasir-orders-typography .better-yasir-settings-section-title {
          font-size: 11px;
          line-height: 1.3;
        }
        .better-yasir-orders-typography .better-yasir-settings-panel-header .better-yasir-settings-section-title {
          font-size: 12px;
        }
        .better-yasir-orders-typography .better-yasir-po-add-btn {
          font-size: 14px !important;
        }
        .better-yasir-orders-typography .better-yasir-po-row-order-remove {
          font-size: 10px !important;
        }
        .better-yasir-orders-typography .better-yasir-settings-tab {
          font-size: 13px !important;
        }
        .better-yasir-po-currency-inline {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          vertical-align: middle;
          font-weight: 700;
        }
        .better-yasir-po-currency-inline .better-yasir-po-currency-icon {
          width: 13px;
          height: 13px;
          object-fit: contain;
          flex-shrink: 0;
        }
        [data-better-yasir-po-floating="true"] {
          font-size: 10px;
          line-height: 1.38;
        }
        [data-better-yasir-po-floating="true"] .better-yasir-po-item-option {
          font-size: 10px;
        }
        .better-yasir-settings-section-title {
          margin: 0 0 12px 0;
          color: #ffe066;
          font-weight: bold;
          text-align: left;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
        }
        .better-yasir-settings-section-title.is-compact {
          margin-bottom: 8px;
        }
        .better-yasir-po-composer {
          display: flex;
          flex-direction: column;
          flex: 0 0 150px;
          height: 150px;
          min-height: 150px;
          max-height: 150px;
          box-sizing: border-box;
          overflow: hidden;
          padding-bottom: 10px;
          margin-bottom: 10px;
          border-bottom: 1px solid #444;
        }
        .better-yasir-po-placed {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          margin-top: 4px;
          overflow: hidden;
        }
        .better-yasir-po-placed > .better-yasir-settings-section-title {
          flex-shrink: 0;
        }
        .better-yasir-po-placed-scroll {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          box-sizing: border-box;
        }
        .better-yasir-po-edit-input {
          height: 22px;
          box-sizing: border-box;
          text-align: center;
          background-image: url('https://bestiaryarena.com/_next/static/media/background-darker.2679c837.png');
          background-size: auto;
          background-repeat: repeat;
          border: none;
          color: #fff;
          font-size: 11px;
          padding: 2px 4px;
          border-radius: 2px;
        }
        .better-yasir-po-edit-input.better-yasir-po-qty-input {
          width: 52px;
        }
        .better-yasir-po-edit-input.better-yasir-po-price-input {
          width: 92px;
        }
        .better-yasir-po-edit-input:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(106, 106, 106, 0.55);
        }
        .better-yasir-po-card {
          padding: 8px;
          margin-bottom: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .better-yasir-po-card-toolbar {
          display: flex;
          justify-content: flex-end;
        }
        .better-yasir-po-add-btn {
          margin-top: 6px;
          width: 100%;
          flex-shrink: 0;
        }
        .better-yasir-po-composer-editor {
          padding-bottom: 2px;
          font-size: 10px;
          line-height: 1.38;
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .better-yasir-po-composer-editor .better-yasir-po-item-trigger,
        .better-yasir-po-composer-editor .better-yasir-po-item-option {
          font-size: 10px;
        }
        .better-yasir-po-composer-editor .better-yasir-po-edit-input {
          font-size: 10px;
          height: 20px;
          padding: 1px 3px;
        }
        .better-yasir-po-composer-line {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px 5px;
          line-height: 1.38;
        }
        .better-yasir-po-composer-row-price {
          margin-top: 6px;
        }
        .better-yasir-po-composer-total-block {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 3px;
          line-height: 1.38;
        }
        .better-yasir-po-composer-total-block .better-yasir-po-composer-total-preview {
          margin-left: 0;
        }
        .better-yasir-po-composer-picker {
          flex: 0 1 200px;
          min-width: 0;
          max-width: 200px;
        }
        .better-yasir-po-composer-editor .better-yasir-po-item-trigger {
          width: 180px;
          max-width: 180px;
          min-height: 30px;
          padding: 2px 5px;
        }
        .better-yasir-po-composer-editor .better-yasir-po-item-trigger-chevron {
          font-size: 9px;
        }
        .better-yasir-po-row-order {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          gap: 6px;
          padding: 4px 5px;
          margin-bottom: 3px;
        }
        .better-yasir-po-row-em {
          font-weight: 700;
        }
        .better-yasir-po-row-order-body {
          flex: 1;
          min-width: 0;
        }
        .better-yasir-po-row-order-line {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 3px 5px;
          line-height: 1.35;
        }
        .better-yasir-po-row-order-total {
          margin-top: 3px;
          line-height: 1.3;
          opacity: 0.9;
        }
        .better-yasir-po-row-order-actions {
          flex-shrink: 0;
          align-self: flex-start;
          margin-top: -1px;
        }
        .better-yasir-po-item-trigger {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 6px;
          min-height: 38px;
          padding: 4px 6px;
          box-sizing: border-box;
          text-align: left;
          color: #fff;
          background-image: url('https://bestiaryarena.com/_next/static/media/background-darker.2679c837.png');
          border: 2px solid transparent;
          border-image: url('https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png') 4 fill stretch;
          cursor: pointer;
        }
        .better-yasir-po-item-trigger .better-yasir-po-item-slot img,
        .better-yasir-po-item-option .better-yasir-po-item-slot img {
          width: 28px;
          height: 28px;
          object-fit: contain;
          flex-shrink: 0;
        }
        .better-yasir-po-trigger-visual .container-slot,
        .better-yasir-po-item-option .container-slot {
          pointer-events: none;
          flex-shrink: 0;
        }
        .better-yasir-po-item-trigger-chevron {
          margin-left: auto;
          opacity: 0.75;
          font-size: 10px;
        }
        .better-yasir-po-item-trigger-placeholder-label {
          color: rgba(255, 255, 255, 0.38);
          letter-spacing: 0.12em;
        }
        .better-yasir-po-trigger-placeholder-slot {
          box-sizing: border-box;
          border-radius: 2px;
          background: rgba(0, 0, 0, 0.2);
        }
        .better-yasir-po-currency-insufficient,
        .better-yasir-po-currency-insufficient .better-yasir-po-currency-icon {
          color: #ff6b6b !important;
        }
        .better-yasir-po-row-order--suspended {
          opacity: 1;
          background-color: rgba(100, 18, 18, 0.88) !important;
          background-image: none !important;
          border: 2px solid rgba(255, 90, 90, 0.95) !important;
          box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
        }
        .better-yasir-po-row-order--suspended,
        .better-yasir-po-row-order--suspended .better-yasir-po-row-order-body,
        .better-yasir-po-row-order--suspended .better-yasir-po-row-order-line,
        .better-yasir-po-row-order--suspended .better-yasir-po-row-order-total,
        .better-yasir-po-row-order--suspended .better-yasir-po-row-em,
        .better-yasir-po-row-order--suspended .text-whiteRegular,
        .better-yasir-po-row-order--suspended [class*="text-rarity"] {
          color: #ffdede !important;
        }
        .better-yasir-po-row-order--suspended .better-yasir-po-currency-insufficient,
        .better-yasir-po-row-order--suspended .better-yasir-po-currency-insufficient .better-yasir-po-currency-inline,
        .better-yasir-po-row-order--suspended .better-yasir-po-currency-insufficient span {
          color: #ffb4b4 !important;
        }
        .better-yasir-po-row-order--suspended .better-yasir-po-row-order-remove {
          color: #fff5f5 !important;
          border-color: rgba(255, 160, 160, 0.85) !important;
        }
        .better-yasir-po-row-order--suspended .better-yasir-po-suspended-note {
          font-size: 9px;
          line-height: 1.25;
          margin-top: 4px;
          color: #ffc8c8 !important;
          font-weight: 700;
        }
        .better-yasir-po-suspended-note {
          font-size: 9px;
          line-height: 1.25;
          margin-top: 4px;
          color: #ff9a9a;
        }
        .better-yasir-po-item-picker-root {
          position: relative;
          z-index: 2;
        }
        .better-yasir-po-item-list {
          display: none;
          flex-direction: column;
          gap: 4px;
          box-sizing: border-box;
          padding: 6px;
          background: rgba(22, 22, 28, 0.98);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 4px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
        }
        .better-yasir-po-item-option {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          min-height: 36px;
          padding: 4px 6px;
          box-sizing: border-box;
          text-align: left;
          color: #fff;
          background-image: url('https://bestiaryarena.com/_next/static/media/background-darker.2679c837.png');
          border: 2px solid transparent;
          border-image: url('https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png') 4 fill stretch;
          cursor: pointer;
        }
        .better-yasir-po-item-option:hover {
          filter: brightness(1.08);
        }
        .better-yasir-po-item-slot {
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          background: rgba(0, 0, 0, 0.25);
          border: 2px solid transparent;
          border-image: url('https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png') 4 fill stretch;
        }
    
      `;
      
    // =======================
    // 2. Utility Functions
    // =======================
    
      // Centralized error handling with different severity levels
      function handleError(error, context = '', severity = 'error') {
        const prefix = '[Better Yasir]';
        const message = context ? `${prefix} ${context}:` : prefix;
        
        switch (severity) {
          case 'warn':
            console.warn(message, error);
            break;
          case 'info':
            console.info(message, error);
            break;
          default:
            console.error(message, error);
        }
      }
      
      // Safe execution wrapper for functions that might throw
      function safeExecute(fn, context = '', fallback = null) {
        try {
          return fn();
        } catch (error) {
          handleError(error, context);
          return fallback;
        }
      }
      
      // Common DOM query utilities
      const domUtils = {
        // Find Yasir modal with multiple fallback strategies
        findYasirModal() {
          // Method 1: Look for enhanced modal
          let modal = document.querySelector(`${SELECTORS.YASIR_MODAL}[data-better-yasir-enhanced]`);
          if (modal) return modal;
          
          // Method 2: Look for any widget-bottom containing Yasir content
          const widgetBottoms = document.querySelectorAll('.widget-bottom');
          for (const widget of widgetBottoms) {
            const text = widget.textContent || '';
            if (text.includes('Yasir') && (text.includes('Buy') || text.includes('Sell') || text.includes('Exchange'))) {
              return widget;
            }
          }
          
          // Method 3: Look for any element with our custom inputs
          const inputs = document.querySelectorAll('.better-yasir-quantity-input');
          if (inputs.length > 0) {
            return inputs[0].closest('.widget-bottom') || inputs[0].closest('[role="dialog"]') || document.body;
          }
          
          return null;
        },
        
        // Find flex containers that need enhancement
        findFlexContainers() {
          return document.querySelectorAll('div.flex.items-center.gap-1\\.5.dithered.px-1, div.flex.items-center.gap-1\\.5');
        },
        
        // Check if element is already processed
        isProcessed(element) {
          return processedElements.has(element) || 
                 element.querySelector('.better-yasir-quantity-input') ||
                 element.dataset.betterYasirWrapper;
        },
        
        // Get table context information
        getTableContext(container) {
          const tableRow = container.closest('tr');
          const tableHeader = tableRow?.closest('table')?.querySelector('thead th');
          const headerText = tableHeader?.textContent || '';
          const exchangeText = t('mods.betterYasir.exchangeItems');
          const sellText = t('mods.betterYasir.sell');
          const isExchangeSection = headerText.includes('Exchange') || 
                                   headerText.includes(sellText) ||
                                   headerText.includes(exchangeText);
          
          return { tableRow, tableHeader, isExchangeSection };
        }
      };
    
      // Game state: always read fresh snapshots (no TTL cache — clearCaches was invalidating it constantly).
      function getGameState() {
        if (!document.querySelector('.widget-bottom') &&
            !document.querySelector('h2 p')?.textContent?.includes('Yasir')) {
          return null;
        }
        try {
          const playerState = globalThis.state?.player?.getSnapshot()?.context;
          const dailyState = globalThis.state?.daily?.getSnapshot()?.context;
          const globalState = globalThis.state?.global?.getSnapshot()?.context;
          return { playerState, dailyState, globalState };
        } catch (error) {
          handleError(error, 'Error accessing game state');
          return null;
        }
      }
      
      function getYasirShopData() {
        try {
          const yasir = globalThis.state?.daily?.getSnapshot?.()?.context?.yasir;
          return yasir && typeof yasir === 'object' ? yasir : {};
        } catch (error) {
          handleError(error, 'Error accessing Yasir shop data');
          return {};
        }
      }
      
      function getInventoryState() {
        try {
          const gameState = getGameState();
          return gameState?.playerState?.inventory || {};
        } catch (error) {
          handleError(error, 'Error accessing inventory state');
          return {};
        }
      }
    
      function getPlayerDust() {
        try {
          const ctx = globalThis.state?.player?.getSnapshot()?.context;
          return ctx?.dust ?? 0;
        } catch (error) {
          handleError(error, 'Error accessing player dust');
          return 0;
        }
      }
      
      function getPlayerGold() {
        try {
          const ctx = globalThis.state?.player?.getSnapshot()?.context;
          return ctx?.gold ?? 0;
        } catch (error) {
          handleError(error, 'Error accessing player gold');
          return 0;
        }
      }
      
      // Format inventory quantity for display (e.g. 1234 -> "1,2k", 100000 -> "100k"); uses comma as decimal separator
      function formatQuantityDisplay(num) {
        if (num == null || typeof num !== 'number' || num < 0) return '0';
        const locale = 'sv-SE'; // comma as decimal separator (1,7k)
        if (num < 1000) return String(num);
        if (num < 1e6) {
          const k = num / 1000;
          const formatted = k % 1 === 0
            ? k.toLocaleString(locale, { maximumFractionDigits: 0 })
            : k.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
          return formatted + 'k';
        }
        const m = num / 1e6;
        const formattedM = m % 1 === 0
          ? m.toLocaleString(locale, { maximumFractionDigits: 0 })
          : m.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        return formattedM + 'M';
      }
      
      // Set quantity span display (abbreviated) and raw value for parsing
      function setQuantitySpanDisplay(quantitySpan, rawQuantity) {
        if (!quantitySpan) return;
        const n = typeof rawQuantity === 'number' ? rawQuantity : parseInt(rawQuantity, 10) || 0;
        quantitySpan.textContent = formatQuantityDisplay(n);
        quantitySpan.dataset.rawQuantity = String(n);
      }
      
      // Get minimum quantity from DOM for an item
      function getMinimumQuantityFromDOM(itemSlot) {
        return safeExecute(() => {
          if (!itemSlot) return 1;
          
          // Look for the quantity indicator in the item slot
          const quantityIndicator = itemSlot.querySelector('.revert-pixel-font-spacing');
          if (quantityIndicator) {
            const quantitySpan = quantityIndicator.querySelector('span');
            if (quantitySpan) {
              // Prefer raw quantity (set when we use abbreviated display)
              const raw = quantitySpan.dataset.rawQuantity;
              if (raw !== undefined && raw !== '') {
                const minQuantity = parseInt(raw, 10);
                if (!isNaN(minQuantity)) return minQuantity;
              }
              const quantityText = quantitySpan.textContent;
              const match = quantityText.match(/(\d+)x/);
              if (match) {
                const minQuantity = parseInt(match[1]);
                return minQuantity;
              }
            }
          }
          
          return 1; // Default to 1 if no quantity found
        }, 'Error getting minimum quantity from DOM', 1);
      }
      
      // Get item price from Yasir API data
      function getItemPriceFromAPI(itemKey) {
        try {
          const yasirData = getYasirShopData();
          
          // For dice manipulators, use the diceCost from API
          if (itemKey && itemKey.startsWith('diceManipulator')) {
            const diceCost = yasirData?.diceCost;
            if (diceCost !== undefined) {
              return diceCost;
            }
          }
          
          if (itemKey === 'exaltationChest') {
            return 150;
          }
          
          // For recycle rune, we need to check if it's available and get its price
          if (itemKey === 'recycleRune') {
            // Check if recycle rune is available in the API data
            // For now, return a default price or check if it's in stock
            return null; // Will fall back to DOM method
          }
          
          return null; // Will fall back to DOM method
        } catch (error) {
          handleError(error, 'Error getting item price from API');
          return null;
        }
      }
      
      // Get item price with API fallback to DOM
      function getItemPriceWithFallback(itemKey, container = null) {
        // For dice manipulators, always use API data to ensure correct currency icon
        if (itemKey && itemKey.startsWith('diceManipulator')) {
          const yasirData = getYasirShopData();
          const diceCost = yasirData?.diceCost || 0;
          let minQuantity = 10; // Default minimum quantity
          if (container) {
            const itemSlot = container.querySelector(SELECTORS.ITEM_SLOT);
            minQuantity = getMinimumQuantityFromDOM(itemSlot) || 10;
          } else {
            const itemSlot = document.querySelector(`[data-item-key="${itemKey}"]`);
            if (itemSlot) {
              minQuantity = getMinimumQuantityFromDOM(itemSlot) || 10;
            } else {
              const bundle = YASIR_PO_PRICING[itemKey]?.bundle;
              if (Number.isFinite(bundle) && bundle > 0) {
                minQuantity = bundle;
              }
            }
          }
          const totalPrice = diceCost * minQuantity;
          return totalPrice;
        }
        
        // Try API first for other items
        const apiPrice = getItemPriceFromAPI(itemKey);
        if (apiPrice !== null) {
          return apiPrice;
        }
        
        // Fall back to DOM method if container is provided
        if (container) {
          const domPrice = getItemPriceFromNextCell(container);
          return domPrice;
        }
        
        return 0;
      }
      
      // Update local inventory based on API response (write into playerContext.inventory)
      function updateLocalInventory(inventoryDiff) {
        try {
          queueStateUpdate(inventoryDiff);
        } catch (error) {
          handleError(error, 'Failed to queue inventory update');
        }
      }
      
      // Calculate max quantity for buy items based on available resources
      function calculateMaxQuantity(itemKey, itemPrice, itemSlot, currentDust, currentGold) {
        if (itemKey && itemKey.startsWith('diceManipulator')) {
          // For dice manipulators, use gold
          const yasirData = getYasirShopData();
          const diceCost = yasirData?.diceCost || 0;
          const minQuantity = getMinimumQuantityFromDOM(itemSlot) || 10;
          const pricePerQuantityUnit = diceCost * minQuantity;
          return pricePerQuantityUnit > 0 ? Math.floor(currentGold / pricePerQuantityUnit) : 0;
        } else if (itemKey === 'recycleRune') {
          // For recycle rune, use gold
          return itemPrice > 0 ? Math.floor(currentGold / itemPrice) : 0;
        } else {
          // For other items, use dust
          return itemPrice > 0 ? Math.floor(currentDust / itemPrice) : 0;
        }
      }
      
      // Inject CSS styles
      function injectStyles() {
        if (document.getElementById('better-yasir-styles')) return;
        
        // Only inject if Yasir modal is present or likely to be present
        if (!document.querySelector('.widget-bottom') && 
            !document.querySelector('h2 p')?.textContent?.includes('Yasir')) {
          return;
        }
        
        const style = document.createElement('style');
        style.id = 'better-yasir-styles';
        style.textContent = QUANTITY_INPUT_STYLES;
        document.head.appendChild(style);
      }
      
      // Get the quantity from an item slot using game state only
      function getItemQuantity(itemSlot) {
        // Check if itemSlot is null or undefined
        if (!itemSlot) {
          return 0;
        }
        
        const inventory = getInventoryState();
        
        const itemKey = getItemKeyFromSlot(itemSlot);
        if (!itemKey) {
          return 0;
        }
        
        const quantity = inventory[itemKey] || 0;
        return quantity;
      }
      
      // Determine item key from the slot
      function getItemKeyFromSlot(itemSlot) {
        return safeExecute(() => {
          if (!itemSlot) return null;
          
          // Check cache first
          if (itemKeyCache.has(itemSlot)) {
            return itemKeyCache.get(itemSlot);
          }
          
          // Fast path – return cached value if we already resolved this slot
          if (itemSlot.dataset.itemKey) {
            const cachedKey = itemSlot.dataset.itemKey;
            itemKeyCache.set(itemSlot, cachedKey);
            return cachedKey;
          }
    
          // Single query for all elements we need
          const elements = {
            spriteItem: itemSlot.querySelector(SELECTORS.STONE_OF_INSIGHT_SPRITE),
            rarityElement: itemSlot.querySelector(SELECTORS.RARITY_ELEMENT),
            exaltationChestImg: itemSlot.querySelector(SELECTORS.EXALTATION_CHEST_IMG),
            recycleRuneImg: itemSlot.querySelector(SELECTORS.RECYCLE_RUNE_IMG),
            dustImg: itemSlot.querySelector(SELECTORS.DUST_IMG),
            summonScrollImg: itemSlot.querySelector('img[src*="summonscroll"]')
          };
    
          let detectedKey = null;
    
          // Check for sprite items first (highest priority)
          if (elements.spriteItem) {
            const classMatch = elements.spriteItem.className.match(/id-(\d+)/);
            const spriteId = classMatch?.[1];
            
            if (spriteId) {
              const spriteMapping = {
                '35909': 'diceManipulator',
                '21383': 'insightStone',
                '653': 'outfitBag1',
                '43672': 'monsterCauldron',
                '42363': 'hygenie'
              };
              
              const baseKey = spriteMapping[spriteId];
              if (baseKey) {
                if ((baseKey === 'diceManipulator' || baseKey === 'insightStone') && elements.rarityElement) {
                  const rarity = elements.rarityElement.getAttribute('data-rarity');
                  detectedKey = `${baseKey}${rarity}`;
                } else {
                  detectedKey = baseKey;
                }
              } else {
                detectedKey = `sprite_${spriteId}`;
              }
            }
          }
          // Check for Exaltation Chest
          else if (elements.exaltationChestImg) {
            detectedKey = 'exaltationChest';
          }
          // Check for Recycle Rune
          else if (elements.recycleRuneImg) {
            detectedKey = 'recycleRune';
          }
          // Check for Summon Scroll
          else if (elements.summonScrollImg) {
            const srcMatch = elements.summonScrollImg.src.match(/summonscroll(\d+)\.png/);
            const tier = srcMatch?.[1] || '1';
            detectedKey = `summonScroll${tier}`;
          }
          // Check for Dust (lowest priority)
          else if (elements.dustImg) {
            detectedKey = 'dust';
          }
    
          if (detectedKey) {
            itemSlot.dataset.itemKey = detectedKey;
            itemKeyCache.set(itemSlot, detectedKey);
            return detectedKey;
          }
    
          return null;
        }, 'Error getting item key from slot', null);
      }
      
      // Unified price calculation utility
      const priceUtils = {
        // Extract price from button text (handles numbers with commas)
        extractPriceFromText(text) {
          // Remove all non-digit characters except commas, then remove commas and parse
          const cleaned = text.replace(/[^\d,]/g, '').replace(/,/g, '');
          return cleaned ? parseInt(cleaned, 10) : 0;
        },
        
      // Check if button indicates out of stock
      isOutOfStock(button) {
        const text = button.textContent.trim();
        const outOfStockText = t('mods.betterYasir.outOfStock');
        return text === '' || text.includes(outOfStockText) || button.disabled;
      },
        
        // Format number with commas for thousands separators (cross-browser compatible)
        formatNumberWithCommas(number) {
          return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        }
      };
      
      // Get item price from the shop row
      function getItemPrice(shopRow) {
        return safeExecute(() => {
          const priceButton = shopRow.querySelector('button');
          if (priceButton && !priceUtils.isOutOfStock(priceButton)) {
            return priceUtils.extractPriceFromText(priceButton.textContent);
          }
          return 0;
        }, 'Error getting item price', 0);
      }
    
      // Get item price from the original button in the next cell
      function getItemPriceFromNextCell(container) {
        return safeExecute(() => {
          const currentCell = container.closest('td');
          if (currentCell) {
            const nextCell = currentCell.nextElementSibling;
            if (nextCell) {
              const originalButton = nextCell.querySelector('button');
              if (originalButton && !priceUtils.isOutOfStock(originalButton)) {
                return priceUtils.extractPriceFromText(originalButton.textContent);
              }
            }
          }
          return 0;
        }, 'Error getting item price from next cell', 0);
      }
      
      // Check if item is out of stock
      function isItemOutOfStock(shopRow) {
        return safeExecute(() => {
          const text = shopRow.textContent;
          const outOfStockText = t('mods.betterYasir.outOfStock');
          return text.includes(outOfStockText);
        }, 'Error checking if item is out of stock', false);
      }
      
      // Create custom action button
      function createCustomActionButton(actionType) {
        const button = document.createElement('button');
        // Use the same classes as the original buttons for consistent sizing and styling
        button.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-blue active:frame-pressed-1-blue surface-blue gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 [_svg]:size-[11px] [_svg]:mb-[2px] [_svg]:mt-[3px] w-full text-whiteHighlight better-yasir-action-button';
        // Don't set text content here - it will be set by updateActionButtonText
        return button;
      }
    
      // Create quantity input element
      function createQuantityInput(maxQuantity, defaultValue = 1, minQuantity = 1) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'better-yasir-quantity-input';
        input.placeholder = minQuantity.toString();
        input.value = defaultValue.toString();
        input.max = maxQuantity; // Set initial max attribute
        
        // Handle input validation
        input.addEventListener('input', function() {
          const value = this.value.trim();
          
          // Allow empty input (user can delete all numbers)
          if (value === '') {
            return;
          }
          
          // Get current max value from the input's max attribute (which gets updated)
          const currentMax = parseInt(this.max) || maxQuantity;
          
          // Check if it's a valid number
          const numValue = parseInt(value);
          if (isNaN(numValue) || numValue < minQuantity) {
            this.value = minQuantity.toString();
          } else if (numValue > currentMax) {
            this.value = currentMax.toString();
          }
          
          // Removed hard limit of 100 items
        });
        
        // Handle blur event to set default value when input loses focus
        input.addEventListener('blur', function() {
          const value = this.value.trim();
          
          // If empty, set to minimum quantity
          if (value === '') {
            this.value = minQuantity.toString();
          }
        });
        
        return input;
      }
      
      // Update action button text based on quantity and price
      function updateActionButtonText(button, quantity, actionType, itemPrice = 0, itemKey = null) {
        let actionText;
        
        // Create the button content similar to original buttons
        if (actionType === 'buy') {
          let totalPrice;
          
          // For dice manipulators, we need to calculate based on API price per "quantity unit" (10 dice)
          if (itemKey && itemKey.startsWith('diceManipulator')) {
            const yasirData = getYasirShopData();
            const diceCost = yasirData?.diceCost || 0;
            const minQuantity = getMinimumQuantityFromDOM(document.querySelector(`[data-item-key="${itemKey}"]`)) || 10;
            const pricePerQuantityUnit = diceCost * minQuantity; // 4732 × 10 = 47320
            totalPrice = pricePerQuantityUnit * quantity; // Use price per quantity unit × visual quantity
          } else {
            // For other items, use the provided itemPrice (which is already total price)
            totalPrice = itemPrice * quantity;
          }
          
          // Determine the correct currency icon based on item type
          let currencyIcon = '/assets/icons/dust.png';
          let currencyAlt = 'dust';
          
          if (itemKey === 'exaltationChest') {
            // Exaltation chest uses dust
            currencyIcon = '/assets/icons/dust.png';
            currencyAlt = 'dust';
          } else if (itemKey === 'recycleRune' || (itemKey && itemKey.startsWith('diceManipulator'))) {
            // Recycle rune and dice manipulators use gold
            currencyIcon = '/assets/icons/goldpile.png'; // Use the correct gold icon
            currencyAlt = 'gold';
          } else {
            // Default to dust for other items
            currencyIcon = '/assets/icons/dust.png';
            currencyAlt = 'dust';
          }
          
          button.innerHTML = `<img alt="${currencyAlt}" src="${currencyIcon}" class="pixelated" width="11" height="12">${priceUtils.formatNumberWithCommas(totalPrice)}`;
        } else if (actionType === 'sell') {
          // For sell buttons (exchange section), show dust icon and quantity
          let dustAmount;
          
          // Special handling for Liberty Bay Legendary Dice Manipulators
          if (itemKey && itemKey.startsWith('diceManipulator')) {
            // For dice manipulators in sell section, use 10 dust per item
            dustAmount = 10 * quantity;
          } else {
            // For other items, use the provided itemPrice
            dustAmount = itemPrice * quantity;
          }
          
          button.innerHTML = `<img alt="dust" src="/assets/icons/dust.png" class="pixelated" width="11" height="12">${priceUtils.formatNumberWithCommas(dustAmount)}`;
        } else {
          // For other trade buttons, show dust icon and quantity
          const dustAmount = itemPrice * quantity;
          button.innerHTML = `<img alt="dust" src="/assets/icons/dust.png" class="pixelated" width="11" height="12">${priceUtils.formatNumberWithCommas(dustAmount)}`;
        }
      }
      
      /**
       * English dice names: singular when listingQuantity === 1 (one Yasir listing), else plural.
       * DOM-derived names get a best-effort manipulator / manipulators fix when quantity is known.
       */
      function adjustDiceManipulatorPlural(displayName, itemKey, listingQuantity) {
        if (!displayName || !(itemKey && itemKey.startsWith('diceManipulator'))) {
          return displayName;
        }
        const q = listingQuantity != null ? parseInt(String(listingQuantity), 10) : NaN;
        if (!Number.isFinite(q) || q < 1) {
          return displayName;
        }
        if (q === 1) {
          return displayName.replace(/\bmanipulators\b/gi, (m) =>
            m.charAt(0) === 'M' ? 'Manipulator' : 'manipulator'
          );
        }
        return displayName.replace(/\bmanipulator\b/gi, (m) =>
          m.charAt(0) === 'M' ? 'Manipulators' : 'manipulators'
        );
      }
      
      // Show confirmation prompt inside Yasir tooltip
      function getItemDisplayName(itemKey, contextElement = null, nameOpts = null) {
        const listingQty =
          nameOpts && nameOpts.listingQuantity != null
            ? parseInt(String(nameOpts.listingQuantity), 10)
            : null;
        // Try to get the name from the DOM first (will be in correct language)
        let itemSlot = null;
        
        // If context element provided (like actionButton), use it to find the item slot
        if (contextElement) {
          const row = contextElement.closest('tr');
          if (row) {
            itemSlot = row.querySelector(`[data-item-key="${itemKey}"]`);
          }
        }
        
        // Fallback to document query
        if (!itemSlot) {
          itemSlot = document.querySelector(`[data-item-key="${itemKey}"]`);
        }
        
        if (itemSlot) {
          // Find the item name in the DOM structure
          const container = itemSlot.closest('td')?.querySelector('div.flex.items-center.gap-1\\.5');
          if (container) {
            // The item name is typically in a div after the container-slot
            // Try multiple approaches to find the name element
            let nameElement = container.querySelector('div:not(.container-slot):not(.has-rarity):not(.better-yasir-right-side-wrapper)');
            
            // If that doesn't work, try finding all divs and pick the one with text
            if (!nameElement || !nameElement.textContent.trim()) {
              const allDivs = Array.from(container.querySelectorAll('div'));
              for (const div of allDivs) {
                if (!div.classList.contains('container-slot') && 
                    !div.classList.contains('has-rarity') &&
                    !div.classList.contains('better-yasir-right-side-wrapper') &&
                    !div.closest('.container-slot') &&
                    div.textContent.trim() &&
                    div.textContent.trim().length > 0) {
                  nameElement = div;
                  break;
                }
              }
            }
            
            if (nameElement) {
              // Clone to avoid modifying the original, remove <p> tags, then get text
              const clone = nameElement.cloneNode(true);
              clone.querySelectorAll('p').forEach(p => p.remove());
              const nameText = clone.textContent?.trim();
              if (nameText) {
                return adjustDiceManipulatorPlural(nameText, itemKey, listingQty);
              }
            }
          }
        }
        
        // Fallback to hardcoded English names if DOM extraction fails
        if (itemKey === 'exaltationChest') {
          return 'Exaltation Chest';
        }
        if (itemKey === 'recycleRune') {
          return 'Recycle Rune';
        }
        if (itemKey === 'dust') {
          return 'Dust';
        }
        if (itemKey === 'stoneOfInsight' || itemKey.startsWith('insightStone')) {
          return 'Stone of Insight';
        }
        if (itemKey.startsWith('summonScroll')) {
          return 'Summon Scroll';
        }
        if (itemKey.startsWith('diceManipulator')) {
          const tier = parseInt(itemKey.replace('diceManipulator', ''), 10);
          const plural = {
            1: 'Common dice manipulators',
            2: 'Uncommon dice manipulators',
            3: 'Rare dice manipulators',
            4: 'Mythic dice manipulators',
            5: 'Legendary dice manipulators'
          };
          const singular = {
            1: 'Common dice manipulator',
            2: 'Uncommon dice manipulator',
            3: 'Rare dice manipulator',
            4: 'Mythic dice manipulator',
            5: 'Legendary dice manipulator'
          };
          if (listingQty === 1) {
            return singular[tier] || 'dice manipulator';
          }
          return plural[tier] || 'dice manipulators';
        }
        return 'items';
      }
      
      function loadYasirPoOrdersFromStorage() {
        try {
          const raw = localStorage.getItem(BETTER_YASIR_PO_ORDERS_STORAGE_KEY);
          if (!raw) {
            return [];
          }
          const arr = JSON.parse(raw);
          return Array.isArray(arr) ? arr : [];
        } catch (_) {
          return [];
        }
      }
      
      function saveYasirPoOrdersToStorage(rows) {
        try {
          localStorage.setItem(BETTER_YASIR_PO_ORDERS_STORAGE_KEY, JSON.stringify(rows));
        } catch (error) {
          handleError(error, 'saveYasirPoOrdersToStorage');
        }
      }
      
      function loadYasirPoPurchaseHistoryCountFromStorage() {
        try {
          const raw = localStorage.getItem(BETTER_YASIR_PO_HISTORY_STORAGE_KEY);
          if (!raw) {
            return 0;
          }
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed.length : 0;
        } catch (_) {
          return 0;
        }
      }

      function runYasirPoHistoryCommaMigrationOnce() {
        try {
          if (localStorage.getItem(BETTER_YASIR_PO_HISTORY_COMMA_MIGRATION_KEY) === 'done') {
            return;
          }
          const raw = localStorage.getItem(BETTER_YASIR_PO_HISTORY_STORAGE_KEY);
          if (!raw) {
            localStorage.setItem(BETTER_YASIR_PO_HISTORY_COMMA_MIGRATION_KEY, 'done');
            return;
          }
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) {
            localStorage.setItem(BETTER_YASIR_PO_HISTORY_COMMA_MIGRATION_KEY, 'done');
            return;
          }
          let changed = false;
          const migrated = parsed.map((entry) => {
            if (!entry || typeof entry !== 'object') {
              return entry;
            }
            if (typeof entry.line !== 'string') {
              return entry;
            }
            const nextLine = entry.line.replace(/(\d)[\u00A0\u202F](?=\d{3}\b)/g, '$1,');
            if (nextLine !== entry.line) {
              changed = true;
              return { ...entry, line: nextLine };
            }
            return entry;
          });
          if (changed) {
            localStorage.setItem(BETTER_YASIR_PO_HISTORY_STORAGE_KEY, JSON.stringify(migrated));
          }
          localStorage.setItem(BETTER_YASIR_PO_HISTORY_COMMA_MIGRATION_KEY, 'done');
        } catch (_) {}
      }
      
      function refreshBetterYasirOrdersPanelTabCounts() {
        const panel = document.getElementById('better-yasir-settings-panel');
        if (!panel) {
          return;
        }
        const orderBtn = panel.querySelector('[data-better-yasir-tab="orders"]');
        const historyBtn = panel.querySelector('[data-better-yasir-tab="history"]');
        if (!orderBtn || !historyBtn) {
          return;
        }
        const orderCount = loadYasirPoOrdersFromStorage().length;
        const histCount = loadYasirPoPurchaseHistoryCountFromStorage();
        orderBtn.textContent = `${t('mods.betterYasir.settingsPurchaseOrdersTitle')} (${orderCount})`;
        historyBtn.textContent = `${t('mods.betterYasir.settingsPurchaseHistoryTitle')} (${histCount})`;
      }
      
      function formatHistoryGoldAmountLabel(amount) {
        return t('mods.betterYasir.historyCostGold').replace(
          /\{amount\}/g,
          priceUtils.formatNumberWithCommas(Math.round(amount))
        );
      }
      
      function formatHistoryDustAmountLabel(amount) {
        return t('mods.betterYasir.historyCostDust').replace(
          /\{amount\}/g,
          priceUtils.formatNumberWithCommas(Math.round(amount))
        );
      }
      
      /** Same sentence as saved purchase history (incl. batch/total gold or dust). */
      function buildYasirPoPurchaseSummaryLine(itemKey, quantity, costMeta = null) {
        const safeQuantity = parseInt(quantity, 10) || 1;
        const itemName = getItemDisplayName(itemKey, null, { listingQuantity: safeQuantity });
        const g = costMeta?.gold;
        const d = costMeta?.dust;
        if (typeof g === 'number' && g > 0) {
          const batchG = costMeta?.goldBatch;
          let costPhrase;
          if (
            typeof batchG === 'number' &&
            batchG > 0 &&
            Math.round(batchG) !== Math.round(g)
          ) {
            costPhrase = t('mods.betterYasir.historyPurchaseGoldBatchAndTotal')
              .replace(/\{batch\}/g, formatHistoryGoldAmountLabel(batchG))
              .replace(/\{total\}/g, formatHistoryGoldAmountLabel(g));
          } else {
            costPhrase = formatHistoryGoldAmountLabel(g);
          }
          return t('mods.betterYasir.successBuyWithCost')
            .replace(/\{quantity\}/g, String(safeQuantity))
            .replace(/\{itemName\}/g, itemName)
            .replace(/\{cost\}/g, costPhrase);
        }
        if (typeof d === 'number' && d > 0) {
          const batchD = costMeta?.dustBatch;
          let costPhrase;
          if (
            typeof batchD === 'number' &&
            batchD > 0 &&
            Math.round(batchD) !== Math.round(d)
          ) {
            costPhrase = t('mods.betterYasir.historyPurchaseDustBatchAndTotal')
              .replace(/\{batch\}/g, formatHistoryDustAmountLabel(batchD))
              .replace(/\{total\}/g, formatHistoryDustAmountLabel(d));
          } else {
            costPhrase = formatHistoryDustAmountLabel(d);
          }
          return t('mods.betterYasir.successBuyWithCost')
            .replace(/\{quantity\}/g, String(safeQuantity))
            .replace(/\{itemName\}/g, itemName)
            .replace(/\{cost\}/g, costPhrase);
        }
        return t('mods.betterYasir.successBuy')
          .replace(/\{quantity\}/g, String(safeQuantity))
          .replace(/\{itemName\}/g, itemName);
      }
      
      function appendYasirPurchaseHistoryRecord(itemKey, quantity, costMeta = null) {
        try {
          const line = buildYasirPoPurchaseSummaryLine(itemKey, quantity, costMeta);
          const raw = localStorage.getItem(BETTER_YASIR_PO_HISTORY_STORAGE_KEY);
          let list = [];
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              list = parsed;
            }
          }
          list.unshift({ ts: Date.now(), line });
          localStorage.setItem(
            BETTER_YASIR_PO_HISTORY_STORAGE_KEY,
            JSON.stringify(list.slice(0, BETTER_YASIR_PO_HISTORY_MAX))
          );
          refreshBetterYasirOrdersPanelTabCounts();
        } catch (error) {
          handleError(error, 'appendYasirPurchaseHistoryRecord');
        }
      }
      
      const BETTER_YASIR_PO_TOAST_DURATION_MS = 30000;
      const BETTER_YASIR_PO_TOAST_CONTAINER_ID = 'better-yasir-po-toast-container';
      
      /** Transient toast (Challenges.js-style DOM): long duration, × to dismiss, separate id from Challenges. */
      function showBetterYasirPurchaseOrderToast(message, durationMs) {
        const ms = typeof durationMs === 'number' && durationMs > 0 ? durationMs : BETTER_YASIR_PO_TOAST_DURATION_MS;
        const safeMsg = message != null && message !== '' ? String(message).replace(/</g, '\u003c') : '';
        try {
          let container = document.getElementById(BETTER_YASIR_PO_TOAST_CONTAINER_ID);
          if (!container) {
            container = document.createElement('div');
            container.id = BETTER_YASIR_PO_TOAST_CONTAINER_ID;
            container.style.cssText =
              'position: fixed; z-index: 10002; inset: 16px 16px 64px; pointer-events: none;';
            document.body.appendChild(container);
          }
          const existing = container.querySelectorAll('.better-yasir-po-toast-item');
          const stackOffset = existing.length * 46;
          const flexWrap = document.createElement('div');
          flexWrap.className = 'better-yasir-po-toast-item';
          flexWrap.style.cssText =
            'left: 0; right: 0; display: flex; position: absolute; transition: 230ms cubic-bezier(0.21, 1.02, 0.73, 1); transform: translateY(-' +
            stackOffset +
            'px); bottom: 0; justify-content: flex-end; pointer-events: auto;';
          const toast = document.createElement('div');
          toast.setAttribute('role', 'status');
          toast.className =
            'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';
          toast.style.cssText = 'pointer-events: auto;';
          const widgetTop = document.createElement('div');
          widgetTop.className = 'widget-top h-2.5';
          const widgetBottom = document.createElement('div');
          widgetBottom.className =
            'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';
          const messageDiv = document.createElement('div');
          messageDiv.className = 'text-left';
          messageDiv.style.flex = '1 1 auto';
          if (safeMsg.indexOf('\n') !== -1) {
            messageDiv.style.whiteSpace = 'pre-line';
          } else {
            messageDiv.style.whiteSpace = 'nowrap';
            messageDiv.style.overflow = 'hidden';
            messageDiv.style.textOverflow = 'ellipsis';
          }
          messageDiv.style.color = '#b8f5b8';
          messageDiv.textContent = safeMsg;
          const closeBtn = document.createElement('button');
          closeBtn.type = 'button';
          closeBtn.setAttribute('aria-label', t('mods.betterYasir.poOrderToastDismissAria'));
          closeBtn.className = 'flex-shrink-0';
          closeBtn.style.cssText =
            'width: 16px; height: 16px; padding: 0; border: none; background: transparent; cursor: pointer; color: #e74c3c; font-size: 16px; line-height: 1; display: flex; align-items: center; justify-content: center; border-radius: 2px;';
          closeBtn.textContent = '\u00d7';
          widgetBottom.appendChild(messageDiv);
          widgetBottom.appendChild(closeBtn);
          toast.appendChild(widgetTop);
          toast.appendChild(widgetBottom);
          flexWrap.appendChild(toast);
          container.appendChild(flexWrap);
          
          let autoTimer = null;
          const dismiss = () => {
            if (autoTimer != null) {
              clearTimeout(autoTimer);
              autoTimer = null;
            }
            if (flexWrap.parentNode) {
              flexWrap.parentNode.removeChild(flexWrap);
            }
            const rest = container.querySelectorAll('.better-yasir-po-toast-item');
            rest.forEach((el, index) => {
              el.style.transform = 'translateY(-' + index * 46 + 'px)';
            });
          };
          closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dismiss();
          });
          autoTimer = setTimeout(dismiss, ms);
        } catch (e) {
          handleError(e, 'showBetterYasirPurchaseOrderToast', 'warn');
        }
      }
    
      function showConfirmationPrompt(quantity, itemKey, actionButton, actionType) {
        try {
          const tooltip = ensureYasirTooltipStructure() || getCachedElement('.tooltip-prose');
          if (!tooltip) return;
          const paragraphs = tooltip.querySelectorAll('p');
          if (paragraphs.length < 2) return;
          const msgElem = paragraphs[1];
          if (!tooltip.dataset.originalText) {
            tooltip.dataset.originalText = msgElem.textContent;
          }
          // remove any previous confirmation
          getCachedElements('.better-yasir-action-button.confirm').forEach(btn=>{
            btn.classList.remove('confirm');
            delete btn.dataset.confirm;
          });
    
          const itemName = getItemDisplayName(itemKey, actionButton, { listingQuantity: quantity });
          const actionText = actionType === 'buy' ? t('mods.betterYasir.buy').toLowerCase() : t('mods.betterYasir.sell').toLowerCase();
          
          // Calculate the total cost
          let totalCost = 0;
          let currency = '';
          
          if (actionType === 'buy') {
            // For dice manipulators, calculate based on API price per "quantity unit" (10 dice)
            if (itemKey && itemKey.startsWith('diceManipulator')) {
              const yasirData = getYasirShopData();
              const diceCost = yasirData?.diceCost || 0;
              const minQuantity = getMinimumQuantityFromDOM(document.querySelector(`[data-item-key="${itemKey}"]`)) || 10;
              const pricePerQuantityUnit = diceCost * minQuantity;
              totalCost = pricePerQuantityUnit * quantity;
              currency = 'gold';
            } else if (itemKey === 'exaltationChest') {
              // For exaltation chest, get price from DOM
              const container = actionButton.closest('td')?.previousElementSibling?.querySelector('div.flex.items-center.gap-1\\.5');
              if (container) {
                totalCost = getItemPriceWithFallback(itemKey, container) * quantity;
              }
              currency = 'dust';
            } else if (itemKey === 'recycleRune') {
              // For recycle rune, get price from DOM (uses gold)
              const container = actionButton.closest('td')?.previousElementSibling?.querySelector('div.flex.items-center.gap-1\\.5');
              if (container) {
                totalCost = getItemPriceWithFallback(itemKey, container) * quantity;
              }
              currency = 'gold';
            } else {
              // For other items, get price from DOM
              const container = actionButton.closest('td')?.previousElementSibling?.querySelector('div.flex.items-center.gap-1\\.5');
              if (container) {
                totalCost = getItemPriceWithFallback(itemKey, container) * quantity;
              }
              currency = 'dust';
            }
          } else if (actionType === 'sell') {
            // For sell actions, calculate dust received
            totalCost = 10 * quantity; // Exchange rate is 10 dust per item
            currency = 'dust';
          }
          
          const forText = t('mods.betterYasir.for');
          const costText = totalCost > 0 ? ` ${forText} ${priceUtils.formatNumberWithCommas(totalCost)} ${currency}` : '';
          const confirmKey = actionType === 'buy' ? 'mods.betterYasir.confirmBuy' : 'mods.betterYasir.confirmSell';
          const confirmText = t(confirmKey)
            .replace('{quantity}', quantity)
            .replace('{itemName}', itemName)
            .replace('{costText}', costText);
          msgElem.textContent = confirmText;
          msgElem.style.color = '#ff4d4d';
          actionButton.dataset.confirm = 'pending';
          actionButton.classList.add('confirm');
          // Attach outside click handler to reset confirmation when clicking elsewhere
          if (!confirmationOutsideHandler) {
            confirmationOutsideHandler = (ev) => {
              if (!ev.target.closest('.better-yasir-action-button.confirm')) {
                removeConfirmationPrompt();
              }
            };
            document.addEventListener('click', confirmationOutsideHandler, true);
          }
        } catch (e) {}
      }
      
      function removeConfirmationPrompt() {
        try {
          const tooltip = ensureYasirTooltipStructure() || getCachedElement('.tooltip-prose');
          if (!tooltip || !tooltip.dataset.originalText) return;
          const paragraphs = tooltip.querySelectorAll('p');
          if (paragraphs.length < 2) return;
          const msgElem = paragraphs[1];
          msgElem.textContent = tooltip.dataset.originalText;
          msgElem.style.color = '';
          delete tooltip.dataset.originalText;
          // remove confirm class from any button
          // Remove pending confirmation from all action buttons
          getCachedElements('.better-yasir-action-button').forEach(b=>{
            b.classList.remove('confirm');
            delete b.dataset.confirm;
          });
          cleanupConfirmationHandler();
        } catch (e) {}
      }
      
      // Helper function to convert rarity number to name for different item types
      function getRarityName(rarity) {
        const rarityNames = {
          '1': 'Common',
          '2': 'Uncommon', 
          '3': 'Rare',
          '4': 'Mythic',
          '5': 'Legendary'
        };
        return rarityNames[rarity] || 'Unknown';
      }
      
      // Helper function to convert rarity number to name for Stone of Insight
      function getInsightStoneRarityName(rarity) {
        const insightStoneRarityNames = {
          '1': 'Glimpse',
          '2': 'Awakening', 
          '3': 'Arcane',
          '4': 'Enlightenment',
          '5': 'Epiphany'
        };
        return insightStoneRarityNames[rarity] || 'Unknown';
      }
      
      // Helper function to convert rarity number to name for Summon Scroll
      function getSummonScrollRarityName(rarity) {
        const summonScrollRarityNames = {
          '1': 'Crude',
          '2': 'Ordinary', 
          '3': 'Refined',
          '4': 'Special',
          '5': 'Exceptional'
        };
        return summonScrollRarityNames[rarity] || 'Unknown';
      }
      
      // Helper function to convert rarity number to name for Dice Manipulator
      function getDiceManipulatorRarityName(rarity) {
        const diceManipulatorRarityNames = {
          '1': 'Common',
          '2': 'Uncommon', 
          '3': 'Rare',
          '4': 'Mythic',
          '5': 'Legendary'
        };
        return diceManipulatorRarityNames[rarity] || 'Unknown';
      }
      
      // Unified function to get rarity name based on item type
      function getItemRarityName(itemKey, rarity) {
        if (itemKey && itemKey.startsWith('insightStone')) {
          return getInsightStoneRarityName(rarity);
        } else if (itemKey && itemKey.startsWith('summonScroll')) {
          return getSummonScrollRarityName(rarity);
        } else if (itemKey && itemKey.startsWith('diceManipulator')) {
          return getDiceManipulatorRarityName(rarity);
        } else {
          return getRarityName(rarity);
        }
      }
      
      // Create a proper Stone of Insight sprite with complete container structure
      function createStoneOfInsightSprite(quantity = 1) {
        // Create the main container slot with proper attributes
        const containerSlot = document.createElement('div');
        containerSlot.className = 'container-slot surface-darker data-[disabled=\'true\']:dithered data-[highlighted=\'true\']:unset-border-image data-[hoverable=\'true\']:hover:unset-border-image';
        containerSlot.setAttribute('data-hoverable', 'false');
        containerSlot.setAttribute('data-highlighted', 'false');
        containerSlot.setAttribute('data-disabled', 'false');
        
        // Create the has-rarity container
        const hasRarityContainer = document.createElement('div');
        hasRarityContainer.className = 'has-rarity relative grid h-full place-items-center';
        hasRarityContainer.setAttribute('data-rarity', '5');
        
        // Create the sprite container with proper positioning
        const spriteContainer = document.createElement('div');
        spriteContainer.className = 'sprite item relative id-21383';
        
        // Create the viewport
        const viewport = document.createElement('div');
        viewport.className = 'viewport';
        
        // Create the spritesheet image
        const img = document.createElement('img');
        img.alt = 'Stone of Insight';
        img.setAttribute('data-cropped', 'false');
        img.className = 'spritesheet';
        img.src = 'https://bestiaryarena.com/assets/ITEM/21383.png'; // Add the spritesheet source
        img.style.setProperty('--cropX', '0');
        img.style.setProperty('--cropY', '0');
        
        // Create the quantity indicator
        const quantityIndicator = document.createElement('div');
        quantityIndicator.className = 'revert-pixel-font-spacing pointer-events-none absolute bottom-[3px] right-px flex h-2.5';
        
        const quantitySpan = document.createElement('span');
        quantitySpan.className = 'relative font-outlined-fill text-white';
        quantitySpan.style.cssText = 'line-height: 1; font-size: 12px; font-family: Arial, sans-serif; font-weight: bold; text-shadow: 1px 1px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000;';
        quantitySpan.setAttribute('translate', 'no');
        setQuantitySpanDisplay(quantitySpan, quantity);
        
        // Assemble the structure
        quantityIndicator.appendChild(quantitySpan);
        viewport.appendChild(img);
        spriteContainer.appendChild(viewport);
        hasRarityContainer.appendChild(spriteContainer);
        hasRarityContainer.appendChild(quantityIndicator);
        containerSlot.appendChild(hasRarityContainer);
        
        return containerSlot;
      }
      
      // Most recent "safe" tooltip body text we can reuse across React/mutation rebuilds.
      let lastYasirTooltipBodyText = '';

      // Show a temporary tooltip message (error/info)
      function showTooltipMessage(message, color = '#ff4d4d', duration = CONSTANTS.ERROR_DISPLAY_DURATION) {
        try {
          const tooltip = ensureYasirTooltipStructure() || document.querySelector('.tooltip-prose');
          if (!tooltip) return;
          const paragraphs = tooltip.querySelectorAll('p');
          if (paragraphs.length < 2) return;
          const msgElem = paragraphs[1];
          const isSuccessColor = color === '#32cd32';
          const currentBodyText = (msgElem.textContent || '').trim();
          const defaultBodyText = (tooltip.dataset.betterYasirDefaultText || '').trim();
          const looksLikeTransientShopResult = /successfully\s+(purchased|traded|sold)\b/i.test(currentBodyText);
          const preferredRestoreText = defaultBodyText || lastYasirTooltipBodyText;

          // Persist clean success text so future tooltip rebuilds avoid stale/incorrect base UI lines.
          if (color === '#32cd32' && typeof message === 'string' && message.trim()) {
            lastYasirTooltipBodyText = message.trim();
            tooltip.dataset.betterYasirDefaultText = lastYasirTooltipBodyText;
          }

          if (!tooltip.dataset.originalText) {
            // Never restore stale shop result text (can be very large cumulative totals from base UI).
            tooltip.dataset.originalText =
              looksLikeTransientShopResult && preferredRestoreText
                ? preferredRestoreText
                : msgElem.textContent;
          }
          msgElem.textContent = message;
          msgElem.style.color = color;
          if (isSuccessColor) {
            // Keep successful purchase/trade text in green instead of reverting to white.
            delete tooltip.dataset.originalText;
            return;
          }
          setTimeout(() => {
            if (!tooltip.dataset.originalText) return;
            msgElem.textContent = tooltip.dataset.originalText;
            msgElem.style.color = '';
            delete tooltip.dataset.originalText;
          }, duration);
        } catch (e) {}
      }
      
      // Update visible resource displays (gold/dust)
      function updateResourceDisplays(playerGold, playerDust) {
        try {
          // Find and update gold display - look for the specific gold display in the Yasir modal
          const yasirModal = document.querySelector('.widget-bottom[data-better-yasir-enhanced]');
          if (yasirModal) {
            // Look for gold display within the modal - try multiple selectors
            const goldDisplays = yasirModal.querySelectorAll('img[src*="goldpile"], img[alt*="gold"], img[src*="gold"]');
            goldDisplays.forEach(goldImg => {
              const goldContainer = goldImg.closest('div');
              if (goldContainer) {
                // Find the text element that contains the gold amount
                const goldTextElement = goldContainer.querySelector('span, div') || goldContainer;
                if (goldTextElement) {
                  const goldText = goldTextElement.textContent;
                  if (goldText && goldText.match(/\d+/)) {
                    // Update the text content with new gold amount
                    const newText = goldText.replace(/\d+(?:,\d+)*/, priceUtils.formatNumberWithCommas(playerGold));
                    goldTextElement.textContent = newText;
                  }
                }
              }
            });
            
            // Also try to find gold displays by looking for the specific pattern in the bottom bar
            const bottomBar = yasirModal.querySelector('.flex.items-center.justify-between, .flex.items-center.gap-4');
            if (bottomBar) {
              const goldElements = bottomBar.querySelectorAll('img[src*="gold"], img[alt*="gold"]');
              goldElements.forEach(goldImg => {
                const goldContainer = goldImg.closest('div');
                if (goldContainer) {
                  const goldTextElement = goldContainer.querySelector('span, div') || goldContainer;
                  if (goldTextElement) {
                    const goldText = goldTextElement.textContent;
                                  if (goldText && goldText.match(/\d+/)) {
                    const newText = goldText.replace(/\d+(?:,\d+)*/, priceUtils.formatNumberWithCommas(playerGold));
                    goldTextElement.textContent = newText;
                  }
                  }
                }
              });
            }
          }
          
          // Find and update dust display - look for the specific dust display in the Yasir modal
          if (yasirModal) {
            const dustDisplays = yasirModal.querySelectorAll('img[src*="dust"], img[alt*="dust"]');
            dustDisplays.forEach(dustImg => {
              const dustContainer = dustImg.closest('div');
              if (dustContainer) {
                // Find the text element that contains the dust amount
                const dustTextElement = dustContainer.querySelector('span, div') || dustContainer;
                if (dustTextElement) {
                  const dustText = dustTextElement.textContent;
                  if (dustText && dustText.match(/\d+/)) {
                    // Update the text content with new dust amount
                    const newText = dustText.replace(/\d+(?:,\d+)*/, priceUtils.formatNumberWithCommas(playerDust));
                    dustTextElement.textContent = newText;
                  }
                }
              }
            });
          }
        } catch (error) {
          handleError(error, 'Error updating resource displays');
        }
      }
      
      // Refresh UI after action to show updated inventory counts
      function refreshUIAfterAction() {
        try {
          // Set flag to prevent multiple refresh cycles
          document.body.dataset.betterYasirRefreshing = 'true';
          
          // Clear the flag after a delay
          setTimeout(() => {
            delete document.body.dataset.betterYasirRefreshing;
          }, 1000);
          
          // Use utility function to find the Yasir modal
          const modal = domUtils.findYasirModal();
          
          if (!modal) {
            console.warn('[Better Yasir] Could not find Yasir modal for UI refresh');
            return;
          }
          
          // Force a fresh read of the game state (no caching)
          // Clear the cache first to ensure we get fresh data
          clearCaches();
          const gameState = getGameState();
          const inventory = gameState?.playerState?.inventory || {};
          const playerDust = gameState?.playerState?.dust || 0;
          const playerGold = gameState?.playerState?.gold || 0;
          
    
          
          if (!inventory) {
            console.warn('[Better Yasir] No inventory state available for UI refresh');
            return;
          }
          
          // Update visible inventory counts in the UI
          updateVisibleInventoryCounts(modal, inventory);
          
          // Find all quantity inputs and update their max values
          const quantityInputs = modal.querySelectorAll('.better-yasir-quantity-input');
          quantityInputs.forEach((input, inputIndex) => {
            const container = input.closest('div.flex.items-center.gap-1\\.5');
            if (!container) return;
            
            const itemSlot = container.querySelector(SELECTORS.ITEM_SLOT);
            if (!itemSlot) return;
            
            const itemKey = getItemKeyFromSlot(itemSlot);
            const currentQuantity = inventory[itemKey] || 0;
            
            // Update max value and current value based on action type
            // Find the action button by looking in the same table row
            const tableRow = container.closest('tr');
            let actionButton = null;
            let isBuyAction = false;
            
            if (tableRow) {
              // Look for the action button in the same row
              actionButton = tableRow.querySelector('.better-yasir-action-button');
              
              if (actionButton) {
                // More reliable way to determine action type: check the table section first
                const tableHeader = tableRow.closest('table')?.querySelector('thead th');
                const headerText = tableHeader?.textContent || '';
                const exchangeText = t('mods.betterYasir.exchangeItems');
                const sellText = t('mods.betterYasir.sell');
                const isExchangeSection = headerText.includes('Exchange') || headerText.includes(sellText) || headerText.includes(exchangeText);
                
                if (isExchangeSection) {
                  // If we're in the exchange/sell section, it's definitely a sell action
                  isBuyAction = false;
                } else {
                  // If we're in the buy section, it's definitely a buy action
                  isBuyAction = true;
                }
              } else {
                // Fallback: determine action type by looking at the table header
                const tableHeader = tableRow.closest('table')?.querySelector('thead th');
                const headerText = tableHeader?.textContent || '';
                const exchangeText = t('mods.betterYasir.exchangeItems');
                const sellText = t('mods.betterYasir.sell');
                const isExchangeSection = headerText.includes('Exchange') || headerText.includes(sellText) || headerText.includes(exchangeText);
                isBuyAction = !isExchangeSection;
              }
            }
            
                      if (actionButton) {
                let itemPrice = 0;
                let newValue = 1; // Initialize newValue
                
                if (isBuyAction) {
                  // For buy actions, recalculate max based on available resources
                  itemPrice = getItemPriceWithFallback(itemKey, container);
                  const maxQuantity = calculateMaxQuantity(itemKey, itemPrice, itemSlot, playerDust, playerGold);
                  
                  input.max = maxQuantity;
                  const currentValue = parseInt(input.value) || 1;
                  newValue = Math.min(currentValue, Math.max(1, maxQuantity));
                  input.value = newValue.toString();
                  
                  // Trigger input validation to ensure the value is within bounds
                  input.dispatchEvent(new Event('input'));
                } else {
                  // For sell actions, use available quantity
                  itemPrice = 10; // Exchange rate is 10 dust per item
                  input.max = currentQuantity;
                  const currentValue = parseInt(input.value) || 1;
                  newValue = Math.min(currentValue, Math.max(1, currentQuantity));
                  input.value = newValue.toString();
                  
                  // Trigger input validation to ensure the value is within bounds
                  input.dispatchEvent(new Event('input'));
                }
                
                // Update button text
                updateActionButtonText(actionButton, newValue, isBuyAction ? 'buy' : 'sell', itemPrice, itemKey);
              }
          });
          
          // Also update any visible resource displays (gold/dust)
          updateResourceDisplays(playerGold, playerDust);
          
          // React often re-renders the intro strip ~200ms after buys; rebuild portrait + tooltip if flattened.
          scheduleEnsureYasirTooltipStructure(modal);
          
        } catch (error) {
          handleError(error, 'Error refreshing UI after action');
        }
      }
      
      // Update visible inventory counts in the UI
      function updateVisibleInventoryCounts(modal, inventory) {
        try {
          // Find all container slots and update their quantity displays
          const containerSlots = modal.querySelectorAll('.container-slot');
          
          containerSlots.forEach((slot, index) => {
            const itemKey = getItemKeyFromSlot(slot);
            if (!itemKey) {
              return;
            }
            
            // Check if this slot is in the Buy section or Sell section
            const tableRow = slot.closest('tr');
            const tableHeader = tableRow?.closest('table')?.querySelector('thead th');
            const headerText = tableHeader?.textContent || '';
            const exchangeText = t('mods.betterYasir.exchangeItems');
            const sellText = t('mods.betterYasir.sell');
            const isSellSection = headerText.includes(sellText) || headerText.includes('Exchange') || headerText.includes(exchangeText);
            
            // Only update quantities for items in the Sell section
            // For Buy section items (like dice manipulators), preserve the original quantity display
            if (isSellSection) {
              const currentQuantity = inventory[itemKey] || 0;
              
              // Find the quantity indicator (the "444x" text)
              const quantityIndicator = slot.querySelector('.revert-pixel-font-spacing');
              if (quantityIndicator) {
                const quantitySpan = quantityIndicator.querySelector('span');
                if (quantitySpan) {
                  setQuantitySpanDisplay(quantitySpan, currentQuantity);
                  // Ensure the text is visible
                  quantitySpan.style.color = 'transparent';
                  quantitySpan.style.textShadow = '1px 1px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000';
                }
              }
            }
            // For Buy section items, do NOT update the quantity display
            // This preserves the original "10x" for dice manipulators which represents the purchase quantity, not inventory
          });
          
          // Also try a more direct approach for specific items (only in Sell section)
          updateSpecificItemQuantities(modal, inventory);
          
        } catch (error) {
          handleError(error, 'Error updating visible inventory counts');
        }
      }
      
      // Update specific item quantities with direct selectors (only for Sell section)
      function updateSpecificItemQuantities(modal, inventory) {
        try {
          // Update Stone of Insight specifically (only in Sell section)
          if (inventory.insightStone5 !== undefined) {
            const insightStoneSlots = modal.querySelectorAll('.container-slot[data-item-key="insightStone5"]');
            
            insightStoneSlots.forEach((slot, index) => {
              // Check if this slot is in the Sell section
              const tableRow = slot.closest('tr');
              const tableHeader = tableRow?.closest('table')?.querySelector('thead th');
              const headerText = tableHeader?.textContent || '';
              const exchangeText = t('mods.betterYasir.exchangeItems');
              const sellText = t('mods.betterYasir.sell');
              const isSellSection = headerText.includes(sellText) || headerText.includes('Exchange') || headerText.includes(exchangeText);
              
              if (isSellSection) {
                const quantitySpan = slot.querySelector('.revert-pixel-font-spacing span');
                if (quantitySpan) {
                  setQuantitySpanDisplay(quantitySpan, inventory.insightStone5);
                  // Apply the same styling as dice manipulators for consistent appearance
                  quantitySpan.className = 'relative font-outlined-fill text-white';
                  quantitySpan.style.cssText = 'line-height: 1; font-size: 12px; font-family: Arial, sans-serif; font-weight: bold; text-shadow: 1px 1px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000;';
                }
              }
            });
          }
          
          // Update dice manipulators specifically (only in Sell section)
          Object.entries(inventory).forEach(([itemKey, quantity]) => {
            if (itemKey.startsWith('diceManipulator')) {
              const slots = modal.querySelectorAll(`.container-slot[data-item-key="${itemKey}"]`);
              if (slots.length > 0) {
                slots.forEach((slot, index) => {
                  // Check if this slot is in the Sell section
                  const tableRow = slot.closest('tr');
                  const tableHeader = tableRow?.closest('table')?.querySelector('thead th');
                  const headerText = tableHeader?.textContent || '';
                  const exchangeText = t('mods.betterYasir.exchangeItems');
                  const sellText = t('mods.betterYasir.sell');
                  const isSellSection = headerText.includes(sellText) || headerText.includes('Exchange') || headerText.includes(exchangeText);
                  
                  if (isSellSection) {
                    const quantitySpan = slot.querySelector('.revert-pixel-font-spacing span');
                    if (quantitySpan) {
                      setQuantitySpanDisplay(quantitySpan, quantity);
                      // Use the same styling as Stone of Insight for consistent appearance
                      quantitySpan.className = 'relative font-outlined-fill text-white';
                      quantitySpan.style.cssText = 'line-height: 1; font-size: 12px; font-family: Arial, sans-serif; font-weight: bold; text-shadow: 1px 1px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000;';
                    }
                  }
                });
              }
            }
          });
          
          // Update other items as needed (only in Sell section)
          Object.entries(inventory).forEach(([itemKey, quantity]) => {
            if (itemKey === 'insightStone5' || itemKey.startsWith('diceManipulator')) return; // Already handled above
            
            const slots = modal.querySelectorAll(`.container-slot[data-item-key="${itemKey}"]`);
            if (slots.length > 0) {
              slots.forEach((slot, index) => {
                // Check if this slot is in the Sell section
                const tableRow = slot.closest('tr');
                const tableHeader = tableRow?.closest('table')?.querySelector('thead th');
                const headerText = tableHeader?.textContent || '';
                const exchangeText = t('mods.betterYasir.exchangeItems');
                const sellText = t('mods.betterYasir.sell');
                const isSellSection = headerText.includes(sellText) || headerText.includes('Exchange') || headerText.includes(exchangeText);
                
                if (isSellSection) {
                  const quantitySpan = slot.querySelector('.revert-pixel-font-spacing span');
                  if (quantitySpan) {
                    setQuantitySpanDisplay(quantitySpan, quantity);
                    // Use the same styling as Stone of Insight for consistent appearance
                    quantitySpan.className = 'relative font-outlined-fill text-white';
                    quantitySpan.style.cssText = 'line-height: 1; font-size: 12px; font-family: Arial, sans-serif; font-weight: bold; text-shadow: 1px 1px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000;';
                  }
                }
              });
            }
          });
          
        } catch (error) {
          handleError(error, 'Error updating specific item quantities');
        }
      }
      
      /** Flex wrapper or td in Yasir buy table for reliable price / bundle reads (globalThis.state + DOM). */
      function findYasirBuyFlexContainerForItemKey(modalRoot, itemKey) {
        const root = modalRoot || domUtils.findYasirModal();
        if (!root || !itemKey) {
          return null;
        }
        const slot = root.querySelector(`tbody .container-slot[data-item-key="${itemKey}"]`);
        if (!slot) {
          return null;
        }
        return slot.closest('div.flex.items-center.gap-1\\.5') || slot.closest('td');
      }
      
      // Perform the actual purchase/trade via API call
      async function performAction(itemKey, quantity, actionType, actionOptions = {}) {
        const suppressDefaultSuccessUi = actionOptions.suppressDefaultSuccessUi === true;
        // Stable request key so duplicate clicks / duplicate handlers collapse to one in-flight request.
        // (Date.now() here defeats deduplication entirely.)
        const requestKey = `${actionType}-${itemKey}-${quantity}`;
        
        return deduplicateRequest(requestKey, async () => {
          let buyPreflight = null;
          try {
            if (!itemKey || quantity <= 0) {
              handleError(new Error('Invalid action parameters'), { itemKey, quantity, actionType });
              return false;
            }
            
            // For dice manipulators, convert visual quantity to actual quantity (only for buy actions)
            let actualQuantity = quantity;
            if (actionType === 'buy' && itemKey && itemKey.startsWith('diceManipulator')) {
              const yasirModal = domUtils.findYasirModal();
              const slot = yasirModal?.querySelector(`[data-item-key="${itemKey}"]`);
              const fromDom = slot ? getMinimumQuantityFromDOM(slot) : null;
              const bundle = YASIR_PO_PRICING[itemKey]?.bundle;
              const minQuantity =
                (Number.isFinite(fromDom) && fromDom > 0 ? fromDom : null) ||
                (Number.isFinite(bundle) && bundle > 0 ? bundle : null) ||
                10;
              actualQuantity = quantity * minQuantity;
            }
            
            // Re-validate current inventory before proceeding
            const gameState = getGameState();
            if (gameState && gameState.playerState?.inventory) {
              const currentQuantity = gameState.playerState.inventory[itemKey] || 0;
              
              // Check if user has sufficient items for trade
              if (actionType === 'sell') {
                if (currentQuantity < quantity) {
                  handleError(new Error('Insufficient items for trade'), { requested: quantity, available: currentQuantity, itemKey });
                  return false;
                }
              }
            }
            
            // Re-validate player resources for buy actions
            if (actionType === 'buy') {
              let playerResource = 0;
              let resourceType = '';
              
              if (itemKey === 'recycleRune' || (itemKey && itemKey.startsWith('diceManipulator'))) {
                // Recycle rune and dice manipulators use gold
                playerResource = getPlayerGold();
                resourceType = 'gold';
              } else {
                // Other items use dust
                playerResource = getPlayerDust();
                resourceType = 'dust';
              }
              
              const priceCtx = findYasirBuyFlexContainerForItemKey(null, itemKey);
              let itemPrice = getItemPriceWithFallback(itemKey, priceCtx);
              if (itemKey === 'exaltationChest' && (!Number.isFinite(itemPrice) || itemPrice <= 0)) {
                itemPrice = 150;
              }
              const totalCost = itemPrice * quantity;
              let batchGoldCost = null;
              let dustBatchCost = null;
              if (itemKey && itemKey.startsWith('diceManipulator')) {
                const yd = getYasirShopData();
                const dc = yd?.diceCost;
                const b = YASIR_PO_PRICING[itemKey]?.bundle;
                if (Number.isFinite(dc) && Number.isFinite(b) && b > 0) {
                  batchGoldCost = dc * b;
                }
              } else if (itemKey === 'recycleRune' && Number.isFinite(itemPrice) && itemPrice > 0) {
                batchGoldCost = itemPrice;
              } else if (itemKey === 'exaltationChest' && Number.isFinite(itemPrice) && itemPrice > 0) {
                dustBatchCost = itemPrice;
              }
              buyPreflight = { resourceType, totalCost, itemPrice, batchGoldCost, dustBatchCost };
              
              if (playerResource < totalCost) {
                handleError(new Error(`Insufficient ${resourceType} for purchase`), { requested: totalCost, available: playerResource });
                return false;
              }
            }
            
            // Get Yasir's current location from the daily state
            const yasirData = getYasirShopData();
            const yasirLocation = yasirData?.location;
            
            if (!yasirLocation) {
              handleError(new Error('Could not determine Yasir location'), { yasirData });
              return false;
            }
            
            // Determine the endpoint and payload based on action type and item
            let endpoint = '';
            let payload = {};
            
            if (actionType === 'buy') {
              // Recycle Rune uses a different endpoint and payload structure
              if (itemKey === 'recycleRune') {
                endpoint = '/api/trpc/store.buyRecycleRuneYasir?batch=1';
                payload = {
                  "0": {
                    "json": {
                      "amount": actualQuantity
                    }
                  }
                };
              } else {
                // Based on HAR analysis, the buy API endpoint is:
                endpoint = '/api/trpc/store.yasirDailyStock?batch=1';
                
                // Updated payload with new required parameters
                payload = {
                  "0": {
                    "json": {
                      "itemKey": itemKey,
                      "amount": actualQuantity,  // Use actual quantity (visual quantity × 10 for dice manipulators)
                      "location": yasirLocation  // Added location parameter
                    }
                  }
                };
              }
              
            } else if (actionType === 'sell') {
              // Use a different API endpoint for dust exchange
              endpoint = '/api/trpc/store.yasirDustExchange?batch=1';
              payload = {
                "0": {
                  "json": {
                    "itemKey": itemKey,
                    "amount": actualQuantity,  // Use actual quantity (visual quantity × 10 for dice manipulators)
                    "location": yasirLocation  // Added location parameter
                  }
                }
              };
            }
            
            // Log the API call for debugging
            console.log(`[Better Yasir] Making ${actionType} request:`, {
              endpoint,
              payload,
              itemKey,
              quantity,
              actualQuantity
            });
            
            // Make the actual API call
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Accept': '*/*',
                'Accept-Language': 'en-US',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Content-Type': 'application/json',
                'X-Game-Version': '1',
                'Origin': 'https://bestiaryarena.com',
                'Referer': 'https://bestiaryarena.com/game',
                'Sec-GPC': '1',
                'Connection': 'keep-alive',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin'
              },
              credentials: 'include',
              body: JSON.stringify(payload)
            });
            
            // Handle API response
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[Better Yasir] Server response:`, errorText);
              
              // Handle specific error cases
              if (response.status === 403) {
                try {
                  const errorData = JSON.parse(errorText);
                  if (errorData[0]?.error?.json?.message) {
                    throw new Error(errorData[0].error.json.message);
                  }
                } catch (parseError) {
                  // If we can't parse the error, use the generic message
                }
              }
              
              // Log the full error for debugging
              console.error(`[Better Yasir] Full error response:`, {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                body: errorText
              });
              
              throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const result = await response.json();
            
            let responseData = null;
            if (result && Array.isArray(result) && result[0]?.result?.data?.json) {
              responseData = result[0].result.data.json;
              
              // Create inventory diff from the response
              const inventoryDiff = {};
              
              // Handle inventory changes
              if (responseData.inventoryDiff) {
                Object.assign(inventoryDiff, responseData.inventoryDiff);
              }
              
              // Handle dust changes
              if (responseData.dustDiff !== undefined) {
                inventoryDiff.dust = responseData.dustDiff;
              }
              
              // Handle gold changes (for selling dice manipulators)
              if (responseData.goldDiff !== undefined) {
                inventoryDiff.gold = responseData.goldDiff;
              }
              
              if (Object.keys(inventoryDiff).length > 0) {
                updateLocalInventory(inventoryDiff);
              }
            }
            
            if (actionType === 'buy' && actionOptions && typeof actionOptions === 'object') {
              let gold = null;
              let dust = null;
              if (responseData) {
                if (responseData.goldDiff !== undefined && responseData.goldDiff < 0) {
                  gold = Math.abs(responseData.goldDiff);
                }
                if (responseData.dustDiff !== undefined && responseData.dustDiff < 0) {
                  dust = Math.abs(responseData.dustDiff);
                }
              }
              if (gold == null && dust == null && buyPreflight) {
                if (buyPreflight.resourceType === 'gold' && buyPreflight.totalCost > 0) {
                  gold = Math.round(buyPreflight.totalCost);
                }
                if (buyPreflight.resourceType === 'dust' && buyPreflight.totalCost > 0) {
                  dust = Math.round(buyPreflight.totalCost);
                }
              }
              let goldBatch = null;
              if (
                buyPreflight?.batchGoldCost != null &&
                Number.isFinite(buyPreflight.batchGoldCost) &&
                buyPreflight.batchGoldCost > 0
              ) {
                goldBatch = Math.round(buyPreflight.batchGoldCost);
              } else if (
                itemKey &&
                itemKey.startsWith('diceManipulator') &&
                gold != null &&
                quantity > 0
              ) {
                const inferred = gold / quantity;
                if (Number.isFinite(inferred) && inferred > 0) {
                  goldBatch = Math.round(inferred);
                }
              }
              let dustBatch = null;
              if (
                buyPreflight?.dustBatchCost != null &&
                Number.isFinite(buyPreflight.dustBatchCost) &&
                buyPreflight.dustBatchCost > 0
              ) {
                dustBatch = Math.round(buyPreflight.dustBatchCost);
              } else if (itemKey === 'exaltationChest' && dust != null && quantity > 0) {
                const inferred = dust / quantity;
                if (Number.isFinite(inferred) && inferred > 0) {
                  dustBatch = Math.round(inferred);
                }
              }
              actionOptions._resolvedBuyCost = { gold, dust, goldBatch, dustBatch };
            }
            
            // Show success message
            removeConfirmationPrompt();
            const safeQuantity = parseInt(quantity) || 1;
            const itemName = getItemDisplayName(itemKey, null, { listingQuantity: safeQuantity });
            const successKey = actionType === 'buy' ? 'mods.betterYasir.successBuy' : 'mods.betterYasir.successSell';
            const successText = t(successKey)
              .replace('{quantity}', safeQuantity)
              .replace('{itemName}', itemName);
            
            if (!suppressDefaultSuccessUi) {
              showTooltipMessage(successText, '#32cd32', 5000);
              if (actionType === 'buy') {
                appendYasirPurchaseHistoryRecord(itemKey, safeQuantity, actionOptions._resolvedBuyCost);
              }
            }
            
            // Clear caches immediately after successful action to get fresh state
            clearCaches();
            
            // Single consolidated UI update with fresh state
            setTimeout(() => {
              // Clear caches and get fresh state
              clearCaches();
              
              // Get fresh state using optimized functions
              const currentDust = getPlayerDust();
              const currentGold = getPlayerGold();
              const currentInventory = getInventoryState();
              
              // Update resource displays first
              updateResourceDisplays(currentGold, currentDust);
              
              // Update visible inventory counts
              const modal = domUtils.findYasirModal();
              if (modal) {
                updateVisibleInventoryCounts(modal, currentInventory);
                scheduleEnsureYasirTooltipStructure(modal);
              }
              
              // Update quantity inputs and buttons
              const inputs = document.querySelectorAll('.better-yasir-quantity-input');
              
              inputs.forEach((input, index) => {
                const container = input.closest('div.flex.items-center.gap-1\\.5');
                if (!container) return;
                
                const itemSlot = container.querySelector('.container-slot');
                if (!itemSlot) return;
                
                const slotItemKey = getItemKeyFromSlot(itemSlot);
                if (!slotItemKey) return;
                
                const actionButton = container.querySelector('.better-yasir-action-button');
                
                // Improved buy/sell detection
                let isBuyAction = false;
                if (actionButton) {
                  // More reliable way to determine action type: check the table section first
                  const tableRow = container.closest('tr');
                  if (tableRow) {
                    const tableHeader = tableRow.closest('table')?.querySelector('thead th');
                    const headerText = tableHeader?.textContent || '';
                    const exchangeText = t('mods.betterYasir.exchangeItems');
                    const sellText = t('mods.betterYasir.sell');
                    const isExchangeSection = headerText.includes('Exchange') || headerText.includes(sellText) || headerText.includes(exchangeText);
                    isBuyAction = !isExchangeSection;
                  } else {
                    // Fallback: determine by item type (Exaltation Chest and Recycle Rune are always buy)
                    isBuyAction = slotItemKey === 'exaltationChest' || slotItemKey === 'recycleRune';
                  }
                } else {
                  // Fallback: determine by table section
                  const tableRow = container.closest('tr');
                  if (tableRow) {
                    const tableHeader = tableRow.closest('table')?.querySelector('thead th');
                    const headerText = tableHeader?.textContent || '';
                    const exchangeText = t('mods.betterYasir.exchangeItems');
                    const sellText = t('mods.betterYasir.sell');
                    const isExchangeSection = headerText.includes('Exchange') || headerText.includes(sellText) || headerText.includes(exchangeText);
                    isBuyAction = !isExchangeSection;
                  } else {
                    // Second fallback: determine by item type (Exaltation Chest and Recycle Rune are always buy)
                    isBuyAction = slotItemKey === 'exaltationChest' || slotItemKey === 'recycleRune';
                  }
                }
                
                if (isBuyAction) {
                  // For buy items, recalculate max based on available resources
                  const itemPrice = getItemPriceWithFallback(slotItemKey, container);
                  const maxQuantity = calculateMaxQuantity(slotItemKey, itemPrice, itemSlot, currentDust, currentGold);
                  
                  // Ensure max is at least 1
                  const safeMax = Math.max(1, maxQuantity);
                  input.max = safeMax;
                  
                  // Reset input to 1 after purchase
                  input.value = '1';
                  
                  // Update the action button text
                  if (actionButton) {
                    updateActionButtonText(actionButton, 1, 'buy', itemPrice, slotItemKey);
                  }
                } else {
                  // For sell items, use available inventory quantity
                  const currentQuantity = currentInventory[slotItemKey] || 0;
                  const safeMax = Math.max(1, currentQuantity);
                  input.max = safeMax;
                  
                  // Get current value and ensure it's valid
                  const currentValue = parseInt(input.value) || 1;
                  const newValue = Math.min(currentValue, safeMax);
                  input.value = newValue.toString();
                  
                  // Update the action button text
                  if (actionButton) {
                    updateActionButtonText(actionButton, newValue, 'sell', 10, slotItemKey);
                  }
                }
              });
            }, 100);
            
            return true;
          } catch (error) {
            handleError(error, `${actionType} action failed`);
            
            // Show user-friendly error message
            let errorMessage = `${actionType} ${t('mods.betterYasir.failedRetry')}`;
            if (error.message.includes('Insufficient')) {
              errorMessage = error.message;
            } else if (error.message.includes('HTTP error! Status: 403')) {
              errorMessage = t('mods.betterYasir.notEnoughResources');
            }
            
            // Show error state briefly
            if (!suppressDefaultSuccessUi) {
              showTooltipMessage(errorMessage);
            }
            throw error; // Re-throw to be handled by the calling function
          }
        });
      }
      
    // =======================
    // 3. UI Component Creation
    // =======================
      
      // Add quantity inputs to shop rows
      function addQuantityInputsToShopRows(shopTable) {
        // Check if this table has already been processed
        if (shopTable.dataset.betterYasirTableProcessed) {
          return;
        }
        
        // Mark table as being processed to prevent duplicates
        shopTable.dataset.betterYasirTableProcessed = 'processing';
        
        // Find all shop rows
        const shopRows = shopTable.querySelectorAll(SELECTORS.SHOP_ROW);
        
        let processedCount = 0;
        
        shopRows.forEach((shopRow, index) => {
          const itemSlot = shopRow.querySelector(SELECTORS.ITEM_SLOT);
          const originalButton = shopRow.querySelector(SELECTORS.BUY_BUTTON);
          
          if (!itemSlot || !originalButton) {
            return;
          }
          
          // Check if we've already added our custom UI to this row
          if (shopRow.querySelector('.better-yasir-quantity-input')) {
            return;
          }
          
          const itemKey = getItemKeyFromSlot(itemSlot);
          if (!itemKey) {
            return;
          }
          
          // Check if item is out of stock
          if (isItemOutOfStock(shopRow)) {
            return;
          }
          
          // Determine action type based on table context
          const tableHeader = shopTable.querySelector('thead th');
          const isExchangeTable = tableHeader && tableHeader.textContent.includes('Exchange');
          const actionType = isExchangeTable ? 'trade' : 'buy';
          
          // Get item price and available quantity
          const itemPrice = getItemPrice(shopRow);
          const availableQuantity = getItemQuantity(itemSlot);
          
          // For buying, use a reasonable default max quantity based on available resources
          // For trading, use the available quantity
          const maxQuantity = actionType === 'buy' ? Math.floor(10000 / itemPrice) : availableQuantity;
          
          // Create quantity input
          const quantityInput = createQuantityInput(maxQuantity);
          
          // Create our custom action button
          const customActionButton = createCustomActionButton(actionType);
          
          // Insert our custom UI before the original button
          originalButton.parentNode.insertBefore(quantityInput, originalButton);
          originalButton.parentNode.insertBefore(customActionButton, originalButton);
          
          // Hide the original button now that we have our custom UI
          originalButton.style.display = 'none';
          
          // Set initial value
          const initialQuantity = Math.min(1, maxQuantity);
          quantityInput.value = initialQuantity.toString();
          
          // Update button text with price
          updateActionButtonText(customActionButton, initialQuantity, actionType, itemPrice, itemKey);
          
          // Add event listeners
          addEventListenersToInput(quantityInput, customActionButton, itemKey, maxQuantity, index, itemSlot, actionType, itemPrice);
          
          processedCount++;
        });
        
        // Mark table as processed if we successfully processed any rows
        if (processedCount > 0) {
          shopTable.dataset.betterYasirTableProcessed = 'true';
        } else {
          // If no rows were processed, remove the processing marker
          delete shopTable.dataset.betterYasirTableProcessed;
        }
      }
    
      // Helper functions for flex container processing
      const flexContainerHelpers = {
        // Check if container should be skipped
        shouldSkipContainer(container) {
          if (processedElements.has(container)) return true;
          if (container.querySelector('.better-yasir-quantity-input')) return true;
          if (container.dataset.betterYasirWrapper) return true;
          
          const tableRow = container.closest('tr');
          if (tableRow && tableRow.dataset.betterYasirProcessed) return true;
          
          return false;
        },
        
        // Check if item is out of stock
        isItemOutOfStock(container) {
          const containerText = container.textContent || '';
          const outOfStockText = t('mods.betterYasir.outOfStock');
          if (containerText.includes(outOfStockText)) return true;
          
          const currentCell = container.closest('td');
          if (currentCell) {
            const nextCell = currentCell.nextElementSibling;
            if (nextCell) {
              const nextCellText = nextCell.textContent || '';
              const outOfStockText = t('mods.betterYasir.outOfStock');
              if (nextCellText.includes(outOfStockText)) return true;
            }
          }
          
          return false;
        },
        
        // Get target item information for exchange section
        getTargetItemInfo(container, tableRow, isExchangeSection) {
          let targetContainer = container;
          let targetItemSlot = container.querySelector(SELECTORS.ITEM_SLOT);
          let targetItemKey = getItemKeyFromSlot(targetItemSlot);
          
          if (isExchangeSection) {
            const tableCells = tableRow.querySelectorAll('td');
            if (tableCells.length >= 2) {
              const secondCell = tableCells[1];
              
              // Check Yasir location for location-specific replacements
              const yasirData = getYasirShopData();
              const yasirLocation = yasirData?.location;
              
              // Handle Carlin-specific replacement (Dust -> Summon Scroll)
              if (yasirLocation === 'carlin' && targetItemKey === 'dust') {
                // Look for Summon Scroll in the second cell (price cell)
                const summonScrollImg = secondCell.querySelector('img[src*="summonscroll"]');
                if (summonScrollImg) {
                  const srcMatch = summonScrollImg.src.match(/summonscroll(\d+)\.png/);
                  const tier = srcMatch ? srcMatch[1] : '5'; // Default to tier 5 for Carlin
                  targetItemKey = `summonScroll${tier}`;
                  
                  // Replace the Dust item with Summon Scroll in the first cell
                  const firstCell = tableCells[0];
                  const firstCellContainer = firstCell.querySelector('div.flex.items-center.gap-1\\.5');
                  if (firstCellContainer) {
                    const dustSlot = firstCellContainer.querySelector('.container-slot[data-item-key="dust"]');
                    if (dustSlot) {
                      // Create Summon Scroll container
                      const summonScrollContainer = document.createElement('div');
                      summonScrollContainer.className = 'container-slot surface-darker data-[disabled=\'true\']:dithered data-[highlighted=\'true\']:unset-border-image data-[hoverable=\'true\']:hover:unset-border-image';
                      summonScrollContainer.setAttribute('data-hoverable', 'false');
                      summonScrollContainer.setAttribute('data-highlighted', 'false');
                      summonScrollContainer.setAttribute('data-disabled', 'false');
                      summonScrollContainer.setAttribute('data-item-key', targetItemKey);
                      
                      // Create the has-rarity container
                      const hasRarityContainer = document.createElement('div');
                      hasRarityContainer.className = 'has-rarity relative grid h-full place-items-center';
                      hasRarityContainer.setAttribute('data-rarity', '5');
                      
                      // Create the Summon Scroll image
                      const img = document.createElement('img');
                      img.src = `https://bestiaryarena.com/assets/icons/summonscroll${tier}.png`;
                      img.className = 'pixelated';
                      img.width = '32';
                      img.height = '32';
                      img.alt = 'Summon Scroll';
                      
                      // Create the quantity indicator
                      const quantityIndicator = document.createElement('div');
                      quantityIndicator.className = 'revert-pixel-font-spacing pointer-events-none absolute bottom-[3px] right-px flex h-2.5';
                      
                      const quantitySpan = document.createElement('span');
                      quantitySpan.className = 'relative font-outlined-fill text-white';
                      quantitySpan.style.cssText = 'line-height: 1; font-size: 12px; font-family: Arial, sans-serif; font-weight: bold; text-shadow: 1px 1px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000;';
                      quantitySpan.setAttribute('translate', 'no');
                      
                      // Get quantity from inventory
                      const inventory = getInventoryState();
                      const quantity = inventory[targetItemKey] || 0;
                      setQuantitySpanDisplay(quantitySpan, quantity);
                      
                      // Assemble the structure
                      quantityIndicator.appendChild(quantitySpan);
                      hasRarityContainer.appendChild(img);
                      hasRarityContainer.appendChild(quantityIndicator);
                      summonScrollContainer.appendChild(hasRarityContainer);
                      
                                     // Replace Dust with Summon Scroll
                   dustSlot.parentNode.replaceChild(summonScrollContainer, dustSlot);
                   targetItemSlot = summonScrollContainer;
                   
                   // Remove the Summon Scroll icon from the price cell (second cell)
                   const secondCell = tableCells[1];
                   const summonScrollIconInPrice = secondCell.querySelector('img[src*="summonscroll"]');
                   if (summonScrollIconInPrice) {
                     const iconContainer = summonScrollIconInPrice.closest('.container-slot');
                     if (iconContainer) {
                       iconContainer.remove();
                     }
                   }
                   
                   // Update text content
                   this.updateExchangeText(firstCellContainer, summonScrollContainer, targetItemKey);
                    }
                  }
                }
              }
              // Handle Ankrahmun-specific replacement (Dust -> Stone of Insight)
              else if (yasirLocation === 'ankrahmun' && targetItemKey === 'dust') {
                // Look for Stone of Insight first
                let insightStoneSlot = secondCell.querySelector('.sprite.item.id-21383');
                if (insightStoneSlot) {
                  targetItemKey = 'insightStone5';
                  targetItemSlot = insightStoneSlot.closest('.container-slot');
                  this.handleInsightStoneExchange(tableCells, targetItemKey);
                }
              }
              // Handle Liberty Bay-specific replacement (Dust -> Legendary Dice Manipulator)
              else if (yasirLocation === 'libertyBay' && targetItemKey === 'dust') {
                // Look for Legendary Dice Manipulator in the second cell
                let legendaryDiceSlot = secondCell.querySelector('.sprite.item.id-35909');
                if (legendaryDiceSlot) {
                  // Check if it's the legendary version (tier 5)
                  const rarityElement = legendaryDiceSlot.closest('[data-rarity]');
                  const rarity = rarityElement ? rarityElement.getAttribute('data-rarity') : '';
                  if (rarity === '5') {
                    targetItemKey = 'diceManipulator5';
                    targetItemSlot = legendaryDiceSlot.closest('.container-slot');
                    this.handleDiceManipulatorExchange(tableCells, targetItemKey);
                  }
                }
              }
              // Handle other locations (default behavior)
              else {
                // Look for Stone of Insight first
                let insightStoneSlot = secondCell.querySelector('.sprite.item.id-21383');
                if (insightStoneSlot) {
                  targetItemKey = 'insightStone5';
                  targetItemSlot = insightStoneSlot.closest('.container-slot');
                  this.handleInsightStoneExchange(tableCells, targetItemKey);
                } else {
                  // Look for other items
                  const itemSlot = secondCell.querySelector('.sprite.item');
                  if (itemSlot) {
                    targetItemKey = getItemKeyFromSlot(itemSlot);
                    targetItemSlot = itemSlot.closest('.container-slot');
                  } else {
                    const summonScrollImg = secondCell.querySelector('img[src*="summonscroll"]');
                    if (summonScrollImg) {
                      const srcMatch = summonScrollImg.src.match(/summonscroll(\d+)\.png/);
                      const tier = srcMatch ? srcMatch[1] : '1';
                      targetItemKey = `summonScroll${tier}`;
                      targetItemSlot = summonScrollImg.closest('.container-slot');
                    }
                  }
                }
              }
            }
          }
          
          return { targetContainer, targetItemSlot, targetItemKey };
        },
        
        // Handle Stone of Insight exchange section
        handleInsightStoneExchange(tableCells, targetItemKey) {
          const firstCell = tableCells[0];
          const secondCell = tableCells[1];
          const firstCellContainer = firstCell.querySelector('div.flex.items-center.gap-1\\.5');
          
          if (firstCellContainer) {
            const dustSlot = firstCellContainer.querySelector('.container-slot[data-item-key="dust"]');
            if (dustSlot) {
              const dailyItemSlot = secondCell.querySelector('.container-slot');
              if (dailyItemSlot) {
                const inventory = getInventoryState();
                const insightStoneQuantity = inventory.insightStone5 || 1;
                const stoneOfInsightContainer = createStoneOfInsightSprite(insightStoneQuantity);
                
                dustSlot.parentNode.replaceChild(stoneOfInsightContainer, dustSlot);
                stoneOfInsightContainer.setAttribute('data-item-key', 'insightStone5');
                dailyItemSlot.remove();
                
                this.updateExchangeText(firstCellContainer, dailyItemSlot, targetItemKey);
              }
            }
          }
        },
        
        // Handle Dice Manipulator exchange section (for Liberty Bay)
        handleDiceManipulatorExchange(tableCells, targetItemKey) {
          const firstCell = tableCells[0];
          const secondCell = tableCells[1];
          const firstCellContainer = firstCell.querySelector('div.flex.items-center.gap-1\\.5');
          
          if (firstCellContainer) {
            const dustSlot = firstCellContainer.querySelector('.container-slot[data-item-key="dust"]');
            if (dustSlot) {
              const dailyItemSlot = secondCell.querySelector('.container-slot');
              if (dailyItemSlot) {
                const inventory = getInventoryState();
                const diceManipulatorQuantity = inventory.diceManipulator5 || 1;
                
                // Create Dice Manipulator container similar to Stone of Insight
                const diceManipulatorContainer = document.createElement('div');
                diceManipulatorContainer.className = 'container-slot surface-darker data-[disabled=\'true\']:dithered data-[highlighted=\'true\']:unset-border-image data-[hoverable=\'true\']:hover:unset-border-image';
                diceManipulatorContainer.setAttribute('data-hoverable', 'false');
                diceManipulatorContainer.setAttribute('data-highlighted', 'false');
                diceManipulatorContainer.setAttribute('data-disabled', 'false');
                diceManipulatorContainer.setAttribute('data-item-key', targetItemKey);
                
                // Create the has-rarity container
                const hasRarityContainer = document.createElement('div');
                hasRarityContainer.className = 'has-rarity relative grid h-full place-items-center';
                hasRarityContainer.setAttribute('data-rarity', '5');
                
                // Create the sprite container
                const spriteContainer = document.createElement('div');
                spriteContainer.className = 'sprite item relative id-35909';
                
                // Create the viewport
                const viewport = document.createElement('div');
                viewport.className = 'viewport';
                
                // Create the spritesheet image
                const img = document.createElement('img');
                img.alt = 'Dice Manipulator';
                img.setAttribute('data-cropped', 'false');
                img.className = 'spritesheet';
                img.src = 'https://bestiaryarena.com/assets/ITEM/35909.png';
                img.style.setProperty('--cropX', '0');
                img.style.setProperty('--cropY', '0');
                
                // Create the quantity indicator
                const quantityIndicator = document.createElement('div');
                quantityIndicator.className = 'revert-pixel-font-spacing pointer-events-none absolute bottom-[3px] right-px flex h-2.5';
                
                const quantitySpan = document.createElement('span');
                quantitySpan.className = 'relative font-outlined-fill text-white';
                quantitySpan.style.cssText = 'line-height: 1; font-size: 12px; font-family: Arial, sans-serif; font-weight: bold; text-shadow: 1px 1px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000;';
                quantitySpan.setAttribute('translate', 'no');
                setQuantitySpanDisplay(quantitySpan, diceManipulatorQuantity);
                
                // Assemble the structure
                quantityIndicator.appendChild(quantitySpan);
                viewport.appendChild(img);
                spriteContainer.appendChild(viewport);
                hasRarityContainer.appendChild(spriteContainer);
                hasRarityContainer.appendChild(quantityIndicator);
                diceManipulatorContainer.appendChild(hasRarityContainer);
                
                dustSlot.parentNode.replaceChild(diceManipulatorContainer, dustSlot);
                dailyItemSlot.remove();
                
                this.updateExchangeText(firstCellContainer, dailyItemSlot, targetItemKey);
              }
            }
          }
        },
        
        // Update text content for exchange section
        updateExchangeText(firstCellContainer, dailyItemSlot, targetItemKey) {
          const textDivs = firstCellContainer.querySelectorAll('div:not(.container-slot):not(.better-yasir-right-side-wrapper):not(.has-rarity):not(.revert-pixel-font-spacing)');
          
          if (textDivs.length > 0) {
            const rarityElement = dailyItemSlot.querySelector('[data-rarity]');
            const rarity = rarityElement ? rarityElement.getAttribute('data-rarity') : '';
            
            let itemName = 'Daily Item';
            const spriteImg = dailyItemSlot.querySelector('.sprite.item img');
            if (spriteImg && spriteImg.alt) {
              itemName = spriteImg.alt;
            } else if (targetItemKey) {
              if (targetItemKey.startsWith('insightStone')) {
                itemName = 'Stone of Insight';
              } else if (targetItemKey.startsWith('diceManipulator')) {
                itemName = 'Dice Manipulator';
              } else if (targetItemKey.startsWith('summonScroll')) {
                itemName = 'Summon Scroll';
              } else {
                itemName = targetItemKey.charAt(0).toUpperCase() + targetItemKey.slice(1);
              }
            }
            
            const rarityClass = rarity ? `text-rarity-${rarity}` : 'text-whiteRegular';
            
            textDivs.forEach((textDiv) => {
              if (!textDiv.querySelector('.sprite, .viewport, .spritesheet') && !textDiv.classList.contains('revert-pixel-font-spacing')) {
                const rarityText = getItemRarityName(targetItemKey, rarity);
                textDiv.innerHTML = `${itemName}<p class="pixel-font-14 -mt-0.5 ${rarityClass}">${rarityText}</p>`;
              }
            });
          }
        },
        
        // Calculate max quantity based on action type and resources
        calculateMaxQuantity(targetItemKey, actionType, itemPrice, targetItemSlot, availableQuantity) {
          if (actionType === 'buy') {
            if (targetItemKey && targetItemKey.startsWith('diceManipulator')) {
              const yasirData = getYasirShopData();
              const diceCost = yasirData?.diceCost || 0;
              const playerGold = getPlayerGold();
              const minQuantity = getMinimumQuantityFromDOM(targetItemSlot);
              const pricePerQuantityUnit = diceCost * minQuantity;
              const maxFromGold = pricePerQuantityUnit > 0 ? Math.floor(playerGold / pricePerQuantityUnit) : 0;
              return Math.max(1, maxFromGold);
            } else {
              const playerDust = getPlayerDust();
              return itemPrice > 0 ? Math.floor(playerDust / itemPrice) : 0;
            }
          } else {
            return availableQuantity;
          }
        },
        
        // Create and position UI elements
        createUIElements(targetContainer, targetItemKey, maxQuantity, initialQuantity, actionType, itemPrice) {
          const quantityInput = createQuantityInput(maxQuantity, initialQuantity, 1);
          
          const rightSideWrapper = document.createElement('div');
          rightSideWrapper.className = 'better-yasir-right-side-wrapper';
          rightSideWrapper.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: auto;
            min-width: 60px;
          `;
          
          rightSideWrapper.appendChild(quantityInput);
          targetContainer.appendChild(rightSideWrapper);
          
          return { quantityInput, rightSideWrapper };
        },
        
        // Find target cell for button placement
        findTargetCell(container, tableRow, isExchangeSection) {
          if (isExchangeSection) {
            const tableCells = tableRow.querySelectorAll('td');
            return tableCells.length >= 2 ? tableCells[1] : null;
          } else {
            const currentCell = container.closest('td');
            return currentCell ? currentCell.nextElementSibling : null;
          }
        }
      };
      
      // Add quantity inputs to flex container divs (new function for the specific div structure)
      function addQuantityInputsToFlexContainers() {
        const flexContainers = domUtils.findFlexContainers();
        
        flexContainers.forEach((container, index) => {
          // Skip if already processed
          if (flexContainerHelpers.shouldSkipContainer(container)) {
            return;
          }
          
          // Find the item slot within this container
          const itemSlot = container.querySelector(SELECTORS.ITEM_SLOT);
          if (!itemSlot) return;
          
          const itemKey = getItemKeyFromSlot(itemSlot);
          if (!itemKey) return;
          
          // Check if item is out of stock
          if (flexContainerHelpers.isItemOutOfStock(container)) {
            return;
          }
          
          // Get table context and determine action type
          const tableRow = container.closest('tr');
          const { tableHeader, isExchangeSection } = domUtils.getTableContext(container);
          
          // Get target item information
          const { targetContainer, targetItemSlot, targetItemKey } = flexContainerHelpers.getTargetItemInfo(container, tableRow, isExchangeSection);
          
          // Determine action type
          const priceButton = container.querySelector('button');
          const buttonText = priceButton?.textContent?.trim() || '';
          const isTradeButton = buttonText === 'Trade';
          const actionType = (isExchangeSection || isTradeButton) ? 'sell' : 'buy';
          
          // Get item price
          let itemPrice = 0;
          if (isExchangeSection) {
            itemPrice = 10; // Exchange rate is 10 dust per item
          } else {
            // Use targetItemKey for price calculation, not the original itemKey
            itemPrice = getItemPriceWithFallback(targetItemKey, container);
            // For dice manipulators, don't skip if price is 0 initially - let retry mechanism handle it
            if (itemPrice === 0 && !targetItemKey.startsWith('diceManipulator')) {
              return; // Skip items with 0 price (out of stock), except dice manipulators
            }
          }
          
          // Validate target item
          if (!targetItemSlot || !targetItemKey) return;
          
          const availableQuantity = getItemQuantity(targetItemSlot);
          
          // Calculate quantities
          const maxQuantity = flexContainerHelpers.calculateMaxQuantity(targetItemKey, actionType, itemPrice, targetItemSlot, availableQuantity);
          const initialQuantity = targetItemKey.startsWith('diceManipulator') ? Math.max(1, Math.min(1, maxQuantity)) : Math.min(1, maxQuantity);
          
          // Create UI elements
          const { quantityInput } = flexContainerHelpers.createUIElements(targetContainer, targetItemKey, maxQuantity, initialQuantity, actionType, itemPrice);
          
          // Find target cell and add button
          const targetCell = flexContainerHelpers.findTargetCell(container, tableRow, isExchangeSection);
          
          if (targetCell) {
            const customActionButton = createCustomActionButton(actionType);
            quantityInput.value = initialQuantity.toString();
            updateActionButtonText(customActionButton, initialQuantity, actionType, itemPrice, targetItemKey);
            
            targetCell.appendChild(customActionButton);
            
            // Hide existing button
            const existingButton = targetCell.querySelector('button');
            if (existingButton) {
              existingButton.style.display = 'none';
            }
            
            // Add event listeners
            addEventListenersToInput(quantityInput, customActionButton, targetItemKey, maxQuantity, index, targetItemSlot, actionType, itemPrice);
            
            // Mark as processed
            if (tableRow) tableRow.dataset.betterYasirProcessed = 'true';
            processedElements.add(container);
            
            // Retry price if needed
            if ((itemPrice === 0 && !isExchangeSection) || targetItemKey.startsWith('diceManipulator')) {
              setTimeout(() => {
                const retryPrice = getItemPriceWithFallback(targetItemKey, container);
                if (retryPrice > 0) {
                  updateActionButtonText(customActionButton, parseInt(quantityInput.value) || 1, actionType, retryPrice, targetItemKey);
                }
              }, 100);
            }
          }
        });
        
        // Update section titles and add price headers AFTER processing containers
        const modal = document.querySelector('.widget-bottom');
        if (modal) {
          updateSectionTitles(modal);
          addPriceColumnHeaders(modal);
        }
      }
      
      // Add event listeners to input and button
      function addEventListenersToInput(quantityInput, actionButton, itemKey, maxQuantity, index, itemSlot, actionType, itemPrice = 0) {
        // If this UI node was re-processed by mutation logic, remove old handlers first.
        if (quantityInput._betterYasirInputHandler) {
          quantityInput.removeEventListener('input', quantityInput._betterYasirInputHandler);
        }
        if (actionButton._betterYasirButtonHandler) {
          actionButton.removeEventListener('click', actionButton._betterYasirButtonHandler);
        }

        // Debounce timer for input validation
        let validationTimeout = null;
        
        // Store references for cleanup
        const inputHandler = function() {
          const value = this.value.trim();
          let quantity;
          
          // Clear existing timeout
          if (validationTimeout) {
            clearTimeout(validationTimeout);
          }
          
          // Basic validation for all input types
          if (value === '') {
            quantity = 1;
            this.value = '1';
          } else {
            quantity = parseInt(value) || 1;
            const currentMax = parseInt(this.max) || maxQuantity;
            
            // Only force correction if the value is way out of bounds
            if (quantity > currentMax && currentMax > 0) {
              quantity = currentMax;
              this.value = quantity.toString();
            } else if (quantity < 1) {
              quantity = 1;
              this.value = '1';
            }
          }
          
          // Update button text immediately - get the correct price for this item
          let correctItemPrice = itemPrice;
          if (actionType === 'buy' && itemKey && itemKey.startsWith('diceManipulator')) {
            // For dice manipulators in buy section, get the price from API data
            const yasirData = getYasirShopData();
            const diceCost = yasirData?.diceCost || 0;
            const minQuantity = getMinimumQuantityFromDOM(itemSlot) || 10;
            correctItemPrice = diceCost * minQuantity; // Price per quantity unit
          } else if (actionType === 'sell' && itemKey && itemKey.startsWith('diceManipulator')) {
            // For dice manipulators in sell section, use 10 dust per item
            correctItemPrice = 10;
          }
          updateActionButtonText(actionButton, quantity, actionType, correctItemPrice, itemKey);
          
          // For buy actions, do a delayed validation to update max if needed
          if (actionType === 'buy') {
            validationTimeout = setTimeout(() => {
              // Get fresh resource data
              const currentDust = getPlayerDust();
              const currentGold = getPlayerGold();
              
              // Recalculate max based on current resources
              const newMax = calculateMaxQuantity(itemKey, itemPrice, itemSlot, currentDust, currentGold);
              
              // Only update max if it's significantly different
              if (Math.abs(newMax - parseInt(this.max)) > 1) {
                this.max = newMax;
                
                // Only force correction if current value is way out of bounds
                const currentValue = parseInt(this.value) || 1;
                if (currentValue > newMax && newMax > 0) {
                  this.value = newMax.toString();
                  // Get the correct price for this item
                  let correctItemPrice = itemPrice;
                  if (actionType === 'buy' && itemKey && itemKey.startsWith('diceManipulator')) {
                    const yasirData = getYasirShopData();
                    const diceCost = yasirData?.diceCost || 0;
                    const minQuantity = getMinimumQuantityFromDOM(itemSlot) || 10;
                    correctItemPrice = diceCost * minQuantity;
                  } else if (actionType === 'sell' && itemKey && itemKey.startsWith('diceManipulator')) {
                    // For dice manipulators in sell section, use 10 dust per item
                    correctItemPrice = 10;
                  }
                  updateActionButtonText(actionButton, newMax, actionType, correctItemPrice, itemKey);
                }
              }
            }, 100); // Longer delay to avoid interfering with typing
          }
        };
        
        // Store button click handler for cleanup
        const buttonHandler = async function(e) {
          e.stopPropagation();
          // Prevent multiple simultaneous clicks
          if (actionButton.disabled) {
            return;
          }
          
          const value = quantityInput.value.trim();
          let quantity;
          
          if (value === '') {
            quantity = 1;
          } else {
            quantity = parseInt(value) || 1;
            // Ensure quantity doesn't exceed the maximum (use current max attribute)
            const currentMax = parseInt(quantityInput.max) || maxQuantity;
            if (quantity > currentMax) {
              quantity = currentMax;
            }
          }
          
          // Confirmation after validations pass
          if (actionButton.dataset.confirm !== 'pending') {
            showConfirmationPrompt(quantity, itemKey, actionButton, actionType);
            return; // wait for second click
          } else {
            removeConfirmationPrompt();
            delete actionButton.dataset.confirm;
          }
          
          // Show loading state and disable button
          const originalText = actionButton.innerHTML;
          const loadingText = actionType === 'buy' ? t('mods.betterYasir.buying') : t('mods.betterYasir.selling');
          actionButton.innerHTML = loadingText;
          removeConfirmationPrompt();
          actionButton.disabled = true;
          
          try {
            // Implement actual action logic
            await performAction(itemKey, quantity, actionType);
          } catch (error) {
            handleError(error, `${itemKey} ${actionType} failed`);
            
            // Show error state briefly
            actionButton.innerHTML = t('mods.betterYasir.error');
            showTooltipMessage(`${actionType} ${t('mods.betterYasir.failedRetry')}`);
            setTimeout(() => {
              actionButton.innerHTML = originalText;
              actionButton.disabled = false;
            }, CONSTANTS.ERROR_DISPLAY_DURATION);
            return;
          } finally {
            // Restore button state
            actionButton.innerHTML = originalText;
            actionButton.disabled = false;
          }
        };
        
        // Add event listeners with stored references
        quantityInput.addEventListener('input', inputHandler);
        actionButton.addEventListener('click', buttonHandler);
        
        // Store function refs on elements so they can be removed correctly later.
        quantityInput._betterYasirInputHandler = inputHandler;
        actionButton._betterYasirButtonHandler = buttonHandler;
        // Keep dataset flags for debugging/inspection without serializing functions.
        quantityInput.dataset.betterYasirInputHandler = 'true';
        actionButton.dataset.betterYasirButtonHandler = 'true';
      }
      
    // =======================
    // 4. Core UI Functions (footer Settings + Exaltation-style side panel)
    // =======================
      
      const YASIR_SETTINGS_PANEL_WIDTH = 350;
      
      const YASIR_SETTINGS_BTN_BASE = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 gap-1 px-2 py-0.5 pb-[3px] pixel-font-14 [&_svg]:size-[11px] [&_svg]:mb-[1px] [&_svg]:mt-[2px]';
      
      function yasirSettingsFooterButtonClass() {
        return `${YASIR_SETTINGS_BTN_BASE} frame-1-blue active:frame-pressed-1-blue surface-blue text-whiteHighlight`;
      }
      
      function refreshBetterYasirFooterOrdersIndicator() {
        const hasOrders = loadYasirPoOrdersFromStorage().length > 0;
        const tabLabel = t('mods.betterYasir.tabSettings');
        const queuedTip = t('mods.betterYasir.footerOrdersHasQueuedTooltip');
        document.querySelectorAll('[data-better-yasir-footer-settings]').forEach((btn) => {
          btn.className = yasirSettingsFooterButtonClass();
          let warn = btn.querySelector('[data-better-yasir-footer-po-warn]');
          if (hasOrders) {
            if (!warn) {
              warn = document.createElement('span');
              warn.dataset.betterYasirFooterPoWarn = 'true';
              warn.setAttribute('aria-hidden', 'true');
              warn.className = 'better-yasir-footer-po-warn';
              warn.textContent = '⚠️';
              warn.style.cssText =
                'font-size:12px;line-height:1;display:inline-flex;align-items:center;margin-right:3px;color:#ffc107;flex-shrink:0;';
              btn.insertBefore(warn, btn.firstChild);
            }
            btn.title = queuedTip;
            btn.setAttribute('aria-label', `${tabLabel}. ${queuedTip}`);
          } else {
            warn?.remove();
            btn.removeAttribute('title');
            btn.setAttribute('aria-label', tabLabel);
          }
        });
      }
      
      function syncYasirFooterSettingsButton(widgetBottom) {
        refreshBetterYasirFooterOrdersIndicator();
      }
      
      function positionYasirSettingsPanel(panel, dialogEl) {
        const modalRect = dialogEl.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const modalHeight = modalRect.height;
        let left = modalRect.right;
        let top = modalRect.top;
        if (left + YASIR_SETTINGS_PANEL_WIDTH > viewportWidth) {
          left = modalRect.left - YASIR_SETTINGS_PANEL_WIDTH;
        }
        if (top + modalHeight > viewportHeight) {
          top = viewportHeight - modalHeight - 10;
        }
        if (top < 10) {
          top = 10;
        }
        if (left < 10) {
          left = 10;
        }
        panel.style.position = 'absolute';
        panel.style.zIndex = '10001';
        panel.style.left = (left - modalRect.left) + 'px';
        panel.style.top = (top - modalRect.top) + 'px';
        panel.style.height = modalHeight + 'px';
      }
      
      function cleanupYasirSettingsPanel() {
        if (yasirSettingsPanelCleanupLock) {
          return;
        }
        yasirSettingsPanelCleanupLock = true;
        try {
          detachYasirPoAffordabilityPlayerListener();
          if (yasirSettingsRepositionTimer) {
            clearTimeout(yasirSettingsRepositionTimer);
            yasirSettingsRepositionTimer = null;
          }
          if (yasirSettingsModalObserver) {
            yasirSettingsModalObserver.disconnect();
            yasirSettingsModalObserver = null;
          }
          if (yasirSettingsResizeListenerKey) {
            removeManagedEventListener(yasirSettingsResizeListenerKey);
            yasirSettingsResizeListenerKey = null;
          }
          if (yasirSettingsResizeObserver && yasirSettingsResizeObserverTarget) {
            yasirSettingsResizeObserver.disconnect();
            yasirSettingsResizeObserver = null;
            yasirSettingsResizeObserverTarget = null;
          }
          if (yasirSettingsEscListenerKey) {
            removeManagedEventListener(yasirSettingsEscListenerKey);
            yasirSettingsEscListenerKey = null;
          }
          document.querySelectorAll('[data-better-yasir-po-floating="true"]').forEach((node) => {
            try {
              node.remove();
            } catch (_) {
              /* ignore */
            }
          });
          document.querySelectorAll('[data-better-yasir-po-overlay="true"]').forEach((node) => {
            try {
              node.remove();
            } catch (_) {
              /* ignore */
            }
          });
          if (yasirActiveSettingsPanel) {
            yasirActiveSettingsPanel.remove();
            yasirActiveSettingsPanel = null;
          }
          syncYasirFooterSettingsButton(null);
        } finally {
          yasirSettingsPanelCleanupLock = false;
        }
      }
      
      function setupYasirSettingsPanelObservers(dialogEl) {
        yasirSettingsModalObserver = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            if (mutation.type === 'childList') {
              for (const node of mutation.removedNodes) {
                if (node === dialogEl) {
                  cleanupYasirSettingsPanel();
                  return;
                }
              }
            }
            if (mutation.type === 'attributes' && mutation.attributeName === 'data-state') {
              const s = dialogEl.getAttribute('data-state');
              if (s === 'closed' || !s) {
                cleanupYasirSettingsPanel();
                return;
              }
            }
            if (mutation.type === 'attributes' && mutation.attributeName === 'style' && yasirActiveSettingsPanel) {
              if (yasirSettingsRepositionTimer) {
                clearTimeout(yasirSettingsRepositionTimer);
              }
              yasirSettingsRepositionTimer = setTimeout(() => {
                yasirSettingsRepositionTimer = null;
                if (yasirActiveSettingsPanel && dialogEl.isConnected) {
                  positionYasirSettingsPanel(yasirActiveSettingsPanel, dialogEl);
                }
              }, 100);
            }
          }
        });
        yasirSettingsModalObserver.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['data-state', 'style']
        });
        yasirSettingsModalObserver.observe(dialogEl, {
          attributes: true,
          attributeFilter: ['data-state', 'style']
        });
      }
      
      function setupYasirSettingsPanelResize(dialogEl) {
        const onResize = () => {
          if (yasirActiveSettingsPanel && dialogEl.isConnected) {
            positionYasirSettingsPanel(yasirActiveSettingsPanel, dialogEl);
          }
        };
        yasirSettingsResizeListenerKey = addManagedEventListener(window, 'resize', onResize);
        yasirSettingsResizeObserver = new ResizeObserver(onResize);
        yasirSettingsResizeObserver.observe(dialogEl);
        yasirSettingsResizeObserverTarget = dialogEl;
      }
      
      /** Same item id as Yasir shop / Cyclopedia (Hunt Analyzer createItemSprite pattern). */
      const YASIR_DICE_MANIPULATOR_SPRITE_ID = 35909;
      
      /** Dice Manipulator: game spritesheet + rarity border (see Hunt Analyzer.js createItemSprite). */
      function createYasirPoDiceManipulatorSprite(rarity, altText) {
        const containerSlot = document.createElement('div');
        containerSlot.className = 'container-slot surface-darker';
        containerSlot.style.cssText = 'width:32px;height:32px;min-width:32px;min-height:32px;overflow:visible;padding:0;';
        containerSlot.setAttribute('data-hoverable', 'false');
        containerSlot.setAttribute('data-highlighted', 'false');
        containerSlot.setAttribute('data-disabled', 'false');
        
        const rarityDiv = document.createElement('div');
        rarityDiv.className = 'has-rarity relative grid h-full place-items-center';
        rarityDiv.setAttribute('data-rarity', String(rarity));
        
        const spriteContainer = document.createElement('div');
        spriteContainer.className = 'relative size-sprite';
        spriteContainer.style.overflow = 'visible';
        
        const spriteElement = document.createElement('div');
        spriteElement.className = `sprite item id-${YASIR_DICE_MANIPULATOR_SPRITE_ID} absolute bottom-0 right-0`;
        
        const viewport = document.createElement('div');
        viewport.className = 'viewport';
        
        const img = document.createElement('img');
        img.alt = altText || 'Dice Manipulator';
        img.setAttribute('data-cropped', 'false');
        img.className = 'spritesheet';
        img.style.setProperty('--cropX', '0');
        img.style.setProperty('--cropY', '0');
        
        viewport.appendChild(img);
        spriteElement.appendChild(viewport);
        spriteContainer.appendChild(spriteElement);
        rarityDiv.appendChild(spriteContainer);
        containerSlot.appendChild(rarityDiv);
        return containerSlot;
      }
      
      function createYasirPoStaticItemIcon(src, altText) {
        const slot = document.createElement('div');
        slot.className = 'better-yasir-po-item-slot';
        const im = document.createElement('img');
        im.alt = altText || '';
        im.className = 'pixelated';
        im.width = 26;
        im.height = 26;
        im.src = src;
        slot.appendChild(im);
        return slot;
      }
      
      function createYasirPoItemPickerVisual(entry) {
        if (entry.kind === 'dice') {
          return createYasirPoDiceManipulatorSprite(entry.rarity, t(entry.labelKey));
        }
        return createYasirPoStaticItemIcon(entry.icon, t(entry.labelKey));
      }
      
      function createYasirPoNumberInput(ariaLabelKey, widthClass) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.inputMode = 'numeric';
        inp.autocomplete = 'off';
        inp.className = `better-yasir-po-edit-input pixel-font-14 ${widthClass}`;
        inp.setAttribute('aria-label', t(ariaLabelKey));
        return inp;
      }
      
      /** Per-item bundle size, dust cost, and allowed gold listing price range (per Yasir bundle slot). */
      const YASIR_PO_PRICING = {
        exaltationChest: { currency: 'dust', perUnit: 150, bundle: 1 },
        recycleRune: { currency: 'gold', minPerBundle: 10000, maxPerBundle: 14000, bundle: 1 },
        diceManipulator4: { currency: 'gold', minPerBundle: 45000, maxPerBundle: 60000, bundle: 10 },
        diceManipulator3: { currency: 'gold', minPerBundle: 30000, maxPerBundle: 45000, bundle: 30 }
      };
      
      /** Product phrase for PO rows, e.g. "30x Rare Dice Manipulators" (bundle size baked in). */
      function getYasirPoOrderProductPhrase(itemKey) {
        const rule = YASIR_PO_PRICING[itemKey];
        if (!rule) {
          return '';
        }
        if (itemKey === 'diceManipulator3') {
          return t('mods.betterYasir.settingsPoOrderProductDiceRare').replace(/\{bundle\}/g, String(rule.bundle));
        }
        if (itemKey === 'diceManipulator4') {
          return t('mods.betterYasir.settingsPoOrderProductDiceMythic').replace(/\{bundle\}/g, String(rule.bundle));
        }
        if (itemKey === 'recycleRune') {
          return t('mods.betterYasir.settingsPoOrderProductRecycleRune');
        }
        if (itemKey === 'exaltationChest') {
          return t('mods.betterYasir.settingsPoOrderProductExaltationChest');
        }
        return '';
      }
      
      function getYasirPoPriceBounds(itemKey) {
        const rule = YASIR_PO_PRICING[itemKey];
        if (!rule || rule.currency === 'dust') {
          return null;
        }
        return { min: rule.minPerBundle, max: rule.maxPerBundle };
      }
      
      function parseYasirPoQtyInt(raw) {
        const n = parseInt(String(raw ?? '').replace(/[^\d]/g, ''), 10);
        return Number.isFinite(n) && n > 0 ? n : NaN;
      }
      
      function parseYasirPoPriceInt(raw) {
        const n = parseInt(String(raw ?? '').replace(/[^\d]/g, ''), 10);
        return Number.isFinite(n) ? n : NaN;
      }
      
      function clampYasirPoPrice(n, min, max) {
        return Math.min(max, Math.max(min, Math.round(n)));
      }
      
      function formatYasirPoAmount(n) {
        return priceUtils.formatNumberWithCommas(Math.round(n));
      }
      
      /** Dice manipulators: qty is Yasir listing count (1 listing = 30 rare or 10 mythic). */
      function yasirPoQtyIsDiceListingBatches(itemKey) {
        return itemKey === 'diceManipulator3' || itemKey === 'diceManipulator4';
      }
      
      const YASIR_PO_GOLD_ICON_SRC = '/assets/icons/goldpile.png';
      const YASIR_PO_DUST_ICON_SRC = '/assets/icons/dust.png';
      
      /** @returns {{ kind: 'gold'|'dust', amount: string } | null} */
      function computeYasirPoOrderTotalParts(itemKey, qtyRaw, priceRaw) {
        const qty = parseYasirPoQtyInt(qtyRaw);
        const rule = YASIR_PO_PRICING[itemKey];
        if (!rule || !Number.isFinite(qty)) {
          return null;
        }
        if (rule.currency === 'dust') {
          return { kind: 'dust', amount: formatYasirPoAmount(qty * rule.perUnit) };
        }
        const bounds = getYasirPoPriceBounds(itemKey);
        if (!bounds) {
          return null;
        }
        let listing = parseYasirPoPriceInt(priceRaw);
        if (!Number.isFinite(listing)) {
          listing = bounds.min;
        }
        listing = clampYasirPoPrice(listing, bounds.min, bounds.max);
        const listings = yasirPoQtyIsDiceListingBatches(itemKey)
          ? qty
          : Math.ceil(qty / rule.bundle);
        const totalGold = listings * listing;
        return { kind: 'gold', amount: formatYasirPoAmount(totalGold) };
      }
      
      /** Total gold for a gold-currency PO at the given listing cap(s); null for dust / invalid. */
      function computeYasirPoOrderGoldTotalNumber(itemKey, qtyRaw, priceRaw) {
        const qty = parseYasirPoQtyInt(qtyRaw);
        const rule = YASIR_PO_PRICING[itemKey];
        if (!rule || rule.currency !== 'gold' || !Number.isFinite(qty)) {
          return null;
        }
        const bounds = getYasirPoPriceBounds(itemKey);
        if (!bounds) {
          return null;
        }
        let listing = parseYasirPoPriceInt(priceRaw);
        if (!Number.isFinite(listing)) {
          listing = bounds.min;
        }
        listing = clampYasirPoPrice(listing, bounds.min, bounds.max);
        const listings = yasirPoQtyIsDiceListingBatches(itemKey)
          ? qty
          : Math.ceil(qty / rule.bundle);
        return listings * listing;
      }
      
      function computeYasirPoOrderTotalText(itemKey, qtyRaw, priceRaw) {
        const p = computeYasirPoOrderTotalParts(itemKey, qtyRaw, priceRaw);
        if (!p) {
          return null;
        }
        if (p.kind === 'dust') {
          return `${p.amount} ${t('mods.betterYasir.settingsPoCurrencyDust')}`;
        }
        return `${p.amount} ${t('mods.betterYasir.settingsPoCurrencyGold')}`;
      }
      
      function yasirPoOrderRecordsMatch(a, b) {
        const normLg = (x) => {
          if (x == null || x === '') {
            return null;
          }
          const n = parseInt(String(x), 10);
          return Number.isFinite(n) ? n : null;
        };
        return (
          a.itemKey === b.itemKey &&
          parseInt(String(a.qty), 10) === parseInt(String(b.qty), 10) &&
          normLg(a.listingGold) === normLg(b.listingGold)
        );
      }
      
      function removeYasirPoOrderRecord(rec) {
        const orders = loadYasirPoOrdersFromStorage();
        const idx = orders.findIndex((o) => yasirPoOrderRecordsMatch(o, rec));
        if (idx < 0) {
          return false;
        }
        const next = orders.slice(0, idx).concat(orders.slice(idx + 1));
        saveYasirPoOrdersToStorage(next);
        return true;
      }
      
      function removePurchaseOrderCardFromOpenSettingsPanel(rec) {
        const panel = document.getElementById('better-yasir-settings-panel');
        if (!panel) {
          return;
        }
        const cards = panel.querySelectorAll('[data-better-yasir-po-card]');
        for (const card of cards) {
          const lg = card.dataset.poListingGold;
          const recLg = rec.listingGold != null && rec.listingGold !== '' ? String(rec.listingGold) : '';
          if (
            card.dataset.poItemKey === rec.itemKey &&
            parseInt(card.dataset.poQty, 10) === parseInt(String(rec.qty), 10) &&
            (lg || '') === recLg
          ) {
            card.remove();
            break;
          }
        }
      }
      
      /** Gold cost per Yasir "quantity" unit at current shop listing (game state daily + DOM). */
      function getYasirCurrentShopBuyUnitGold(modal, itemKey) {
        const row = findYasirBuyFlexContainerForItemKey(modal, itemKey)?.closest('tr');
        if (!row || isItemOutOfStock(row)) {
          return null;
        }
        if (itemKey && itemKey.startsWith('diceManipulator')) {
          const slot = row.querySelector('.container-slot');
          const yasirData = getYasirShopData();
          const diceCost = yasirData?.diceCost;
          const minQ = getMinimumQuantityFromDOM(slot) || 10;
          if (!Number.isFinite(diceCost) || diceCost <= 0) {
            return null;
          }
          return diceCost * minQ;
        }
        if (itemKey === 'recycleRune') {
          const p = getItemPrice(row);
          return p > 0 ? p : null;
        }
        return null;
      }
      
      /** Total gold for this PO at current listing prices (globalThis.state.player + DOM). */
      function getYasirPoCurrentTotalGoldCost(modal, rec) {
        const rule = YASIR_PO_PRICING[rec.itemKey];
        if (!rule || rule.currency === 'dust') {
          return null;
        }
        const per = getYasirCurrentShopBuyUnitGold(modal, rec.itemKey);
        if (per == null) {
          return null;
        }
        const qty = parseInt(String(rec.qty), 10);
        if (!Number.isFinite(qty) || qty <= 0) {
          return null;
        }
        if (yasirPoQtyIsDiceListingBatches(rec.itemKey)) {
          return per * qty;
        }
        return per * Math.ceil(qty / rule.bundle);
      }
      
      /** Per-listing gold when Yasir table is not in the DOM (dice via daily diceCost, recycle rune via safe listing cap). */
      function getYasirCurrentShopBuyUnitGoldHeadless(itemKey, recycleRuneListingCapRaw) {
        if (!itemKey) {
          return null;
        }
        const rule = YASIR_PO_PRICING[itemKey];
        if (!rule || rule.currency !== 'gold') {
          return null;
        }
        if (itemKey.startsWith('diceManipulator')) {
          const yasirData = getYasirShopData();
          const diceCost = yasirData?.diceCost;
          const minQ = rule.bundle;
          if (!Number.isFinite(diceCost) || diceCost <= 0 || !Number.isFinite(minQ) || minQ <= 0) {
            return null;
          }
          return diceCost * minQ;
        }
        if (itemKey === 'recycleRune') {
          const bounds = getYasirPoPriceBounds(itemKey);
          const cap = parseInt(String(recycleRuneListingCapRaw), 10);
          if (!bounds || !Number.isFinite(cap) || cap < bounds.min || cap > bounds.max) {
            return null;
          }
          // Headless mode uses the user cap as a strict per-listing safety ceiling.
          return cap;
        }
        return null;
      }
      
      function getYasirPoCurrentTotalGoldCostHeadless(rec) {
        const rule = YASIR_PO_PRICING[rec.itemKey];
        if (!rule || rule.currency === 'dust') {
          return null;
        }
        const per = getYasirCurrentShopBuyUnitGoldHeadless(rec.itemKey, rec.listingGold);
        if (per == null) {
          return null;
        }
        const qty = parseInt(String(rec.qty), 10);
        if (!Number.isFinite(qty) || qty <= 0) {
          return null;
        }
        if (yasirPoQtyIsDiceListingBatches(rec.itemKey)) {
          return per * qty;
        }
        return per * Math.ceil(qty / rule.bundle);
      }
      
      /** Human-readable validation failure codes (purchase-order console logging is always on). */
      const BETTER_YASIR_PO_LOG_REASONS = {
        no_state: 'Missing game state or order itemKey',
        no_yasir: 'Daily state has no Yasir location',
        bad_item: 'Item is not supported for purchase orders',
        bad_qty: 'Invalid quantity on order',
        no_row: 'Buy row not found in Yasir modal DOM',
        oos: 'Item out of stock in shop table',
        dust: 'Not enough dust for this order',
        no_cap: 'Gold order missing listingGold cap',
        no_price: 'Could not read current shop gold price',
        over_cap: 'Current listing gold exceeds your price cap',
        gold: 'Not enough gold for this order at current prices',
        below_committed_gold: 'Not enough gold to cover this order at your listing cap (order suspended)',
        below_committed_dust: 'Not enough dust for this order (order suspended)',
        needs_shop_ui:
          'Open the Yasir shop for this item (live gold price or stock is read from the shop table)'
      };
      
      function betterYasirPoConsoleLog(message, detail) {
        if (detail !== undefined) {
          console.log(`[Better Yasir PO] ${message}`, detail);
        } else {
          console.log(`[Better Yasir PO] ${message}`);
        }
      }
      
      /**
       * Validates a queued purchase order against globalThis.state (player + daily) and live Yasir DOM.
       * Does not perform network I/O.
       */
      function validateYasirPurchaseOrderAgainstGameState(modal, rec) {
        if (!rec?.itemKey || !globalThis.state?.player?.getSnapshot) {
          return { ok: false, reason: 'no_state' };
        }
        clearCaches();
        const dailySnap = globalThis.state.daily?.getSnapshot?.()?.context;
        if (!dailySnap?.yasir?.location) {
          return { ok: false, reason: 'no_yasir' };
        }
        const rule = YASIR_PO_PRICING[rec.itemKey];
        if (!rule) {
          return { ok: false, reason: 'bad_item' };
        }
        const qty = parseInt(String(rec.qty), 10);
        if (!Number.isFinite(qty) || qty <= 0) {
          return { ok: false, reason: 'bad_qty' };
        }
        
        if (rule.currency === 'dust') {
          const needDust = qty * rule.perUnit;
          if (getPlayerDust() < needDust) {
            return { ok: false, reason: 'below_committed_dust' };
          }
        } else {
          const committedGold = computeYasirPoOrderGoldTotalNumber(
            rec.itemKey,
            String(rec.qty),
            rec.listingGold != null && rec.listingGold !== '' ? String(rec.listingGold) : undefined
          );
          if (committedGold != null && getPlayerGold() < committedGold) {
            return { ok: false, reason: 'below_committed_gold' };
          }
        }
        
        const priceCtx = findYasirBuyFlexContainerForItemKey(modal, rec.itemKey);
        if (!priceCtx) {
          return { ok: false, reason: 'no_row' };
        }
        const shopRow = priceCtx.closest('tr');
        if (!shopRow || isItemOutOfStock(shopRow)) {
          return { ok: false, reason: 'oos' };
        }
        
        if (rule.currency === 'dust') {
          return { ok: true };
        }
        
        const cap = parseInt(String(rec.listingGold), 10);
        if (!Number.isFinite(cap)) {
          return { ok: false, reason: 'no_cap' };
        }
        const perListing = getYasirCurrentShopBuyUnitGold(modal, rec.itemKey);
        if (perListing == null) {
          return { ok: false, reason: 'no_price' };
        }
        if (perListing > cap) {
          return { ok: false, reason: 'over_cap' };
        }
        const totalGold = getYasirPoCurrentTotalGoldCost(modal, rec);
        if (totalGold == null || totalGold > getPlayerGold()) {
          return { ok: false, reason: 'gold' };
        }
        return { ok: true };
      }
      
      /**
       * Validates a PO using only globalThis.state + fixed rules (no Yasir DOM).
       * Supports dice manipulators, Recycle Rune (via safe listing cap), and Exaltation Chest (dust).
       */
      function validateYasirPurchaseOrderHeadless(rec) {
        if (!rec?.itemKey || !globalThis.state?.player?.getSnapshot) {
          return { ok: false, reason: 'no_state' };
        }
        clearCaches();
        const dailySnap = globalThis.state.daily?.getSnapshot?.()?.context;
        if (!dailySnap?.yasir?.location) {
          return { ok: false, reason: 'no_yasir' };
        }
        const rule = YASIR_PO_PRICING[rec.itemKey];
        if (!rule) {
          return { ok: false, reason: 'bad_item' };
        }
        const qty = parseInt(String(rec.qty), 10);
        if (!Number.isFinite(qty) || qty <= 0) {
          return { ok: false, reason: 'bad_qty' };
        }
        
        if (rule.currency === 'dust') {
          const needDust = qty * rule.perUnit;
          if (getPlayerDust() < needDust) {
            return { ok: false, reason: 'below_committed_dust' };
          }
          return { ok: true };
        }
        
        if (!rec.itemKey.startsWith('diceManipulator') && rec.itemKey !== 'recycleRune') {
          return { ok: false, reason: 'needs_shop_ui' };
        }
        
        const committedGold = computeYasirPoOrderGoldTotalNumber(
          rec.itemKey,
          String(rec.qty),
          rec.listingGold != null && rec.listingGold !== '' ? String(rec.listingGold) : undefined
        );
        if (committedGold != null && getPlayerGold() < committedGold) {
          return { ok: false, reason: 'below_committed_gold' };
        }
        
        const cap = parseInt(String(rec.listingGold), 10);
        if (!Number.isFinite(cap)) {
          return { ok: false, reason: 'no_cap' };
        }
        const perListing = getYasirCurrentShopBuyUnitGoldHeadless(rec.itemKey, rec.listingGold);
        if (perListing == null) {
          return { ok: false, reason: 'no_price' };
        }
        if (perListing > cap) {
          return { ok: false, reason: 'over_cap' };
        }
        const totalGold = getYasirPoCurrentTotalGoldCostHeadless(rec);
        if (totalGold == null || totalGold > getPlayerGold()) {
          return { ok: false, reason: 'gold' };
        }
        return { ok: true };
      }
      
      function buildFallbackPoHistoryCost(rec, modalOrNull) {
        const rule = YASIR_PO_PRICING[rec.itemKey];
        if (!rule) {
          return null;
        }
        if (rule.currency === 'dust') {
          const qty = parseInt(String(rec.qty), 10) || 0;
          const per = rule.perUnit;
          const totalD = qty * per;
          return {
            gold: null,
            dust: totalD,
            goldBatch: null,
            dustBatch: per
          };
        }
        let goldBatch = null;
        if (rec.itemKey.startsWith('diceManipulator')) {
          const per =
            modalOrNull != null
              ? getYasirCurrentShopBuyUnitGold(modalOrNull, rec.itemKey)
              : getYasirCurrentShopBuyUnitGoldHeadless(rec.itemKey, rec.listingGold);
          if (per != null) {
            goldBatch = Math.round(per);
          }
        } else if (rec.itemKey === 'recycleRune') {
          const per =
            modalOrNull != null
              ? getYasirCurrentShopBuyUnitGold(modalOrNull, rec.itemKey)
              : getYasirCurrentShopBuyUnitGoldHeadless(rec.itemKey, rec.listingGold);
          if (per != null) {
            goldBatch = Math.round(per);
          }
        }
        const total =
          modalOrNull != null
            ? getYasirPoCurrentTotalGoldCost(modalOrNull, rec)
            : getYasirPoCurrentTotalGoldCostHeadless(rec);
        if (total == null) {
          return null;
        }
        const totalR = Math.round(total);
        if (goldBatch == null && rec.itemKey === 'recycleRune') {
          const qty = parseInt(String(rec.qty), 10) || 1;
          goldBatch = Math.round(totalR / Math.max(1, qty));
        }
        return { gold: totalR, dust: null, goldBatch, dustBatch: null };
      }
      
      /**
       * Fulfills at most one order per successful API call; re-scans until no order matches.
       * modalOrNull: null = headless path (dice + exaltation chest only).
       * Concurrency: single-flight via yasirPoOrderFulfillmentInProgress.
       */
      async function fulfillYasirPurchaseOrderQueue(modalOrNull) {
        if (!globalThis.state?.player?.getSnapshot) {
          betterYasirPoConsoleLog('fulfillment aborted: no player state', {
            mode: modalOrNull != null ? 'modal' : 'headless'
          });
          return;
        }
        if (!loadYasirPoOrdersFromStorage().length) {
          return;
        }
        
        const validate =
          modalOrNull != null
            ? (rec) => validateYasirPurchaseOrderAgainstGameState(modalOrNull, rec)
            : (rec) => validateYasirPurchaseOrderHeadless(rec);
        const mode = modalOrNull != null ? 'modal' : 'headless';
        
        clearCaches();
        const yasirSnap = getYasirShopData();
        const initialQueue = loadYasirPoOrdersFromStorage();
        betterYasirPoConsoleLog(`fulfillment start (${mode}) — queued purchase orders and Yasir context`, {
          purchaseOrders: initialQueue.map((o) => ({
            itemKey: o.itemKey,
            qty: o.qty,
            listingGoldCap: o.listingGold != null && o.listingGold !== '' ? o.listingGold : null
          })),
          orderCount: initialQueue.length,
          yasir: {
            location: yasirSnap?.location ?? null,
            diceCost: yasirSnap?.diceCost ?? null
          },
          playerSnapshot: {
            gold: getPlayerGold(),
            dust: getPlayerDust()
          }
        });
        
        let safety = 0;
        while (safety < 32) {
          safety++;
          clearCaches();
          const orders = loadYasirPoOrdersFromStorage();
          if (!orders.length) {
            break;
          }
          let progressed = false;
          for (const rec of orders) {
            const gate = validate(rec);
            if (!gate.ok) {
              betterYasirPoConsoleLog('order skipped (validation)', {
                mode,
                order: {
                  itemKey: rec.itemKey,
                  qty: rec.qty,
                  listingGoldCap: rec.listingGold != null && rec.listingGold !== '' ? rec.listingGold : null
                },
                reasonCode: gate.reason,
                reason: BETTER_YASIR_PO_LOG_REASONS[gate.reason] || gate.reason,
                yasirLocation: globalThis.state?.daily?.getSnapshot?.()?.context?.yasir?.location ?? null
              });
              continue;
            }
            try {
              betterYasirPoConsoleLog('attempting purchase for order', {
                mode,
                itemKey: rec.itemKey,
                qty: rec.qty,
                listingGoldCap: rec.listingGold != null && rec.listingGold !== '' ? rec.listingGold : null,
                yasirLocation: globalThis.state?.daily?.getSnapshot?.()?.context?.yasir?.location ?? null
              });
              const actionOpts = { suppressDefaultSuccessUi: true };
              const ok = await performAction(rec.itemKey, rec.qty, 'buy', actionOpts);
              if (ok === true) {
                betterYasirPoConsoleLog('purchase SUCCESS — removed from queue and recorded in history', {
                  mode,
                  itemKey: rec.itemKey,
                  qty: rec.qty,
                  yasirLocation: globalThis.state?.daily?.getSnapshot?.()?.context?.yasir?.location ?? null
                });
                removeYasirPoOrderRecord(rec);
                removePurchaseOrderCardFromOpenSettingsPanel(rec);
                const qtyN = parseInt(String(rec.qty), 10) || 1;
                const costMeta =
                  actionOpts._resolvedBuyCost ||
                  buildFallbackPoHistoryCost(rec, modalOrNull);
                appendYasirPurchaseHistoryRecord(rec.itemKey, qtyN, costMeta);
                const summaryLine = buildYasirPoPurchaseSummaryLine(rec.itemKey, qtyN, costMeta);
                const toastTitle = t('mods.betterYasir.poOrderToastYasirTrade');
                showBetterYasirPurchaseOrderToast(`${toastTitle}: ${summaryLine}`);
                refreshBetterYasirFooterOrdersIndicator();
                refreshBetterYasirOrdersPanelTabCounts();
                progressed = true;
                break;
              }
              betterYasirPoConsoleLog('purchase NOT executed (performAction returned false — e.g. pre-flight validation)', {
                mode,
                itemKey: rec.itemKey,
                qty: rec.qty,
                performActionResult: ok
              });
            } catch (poErr) {
              betterYasirPoConsoleLog('purchase FAILED (error from shop / network)', {
                mode,
                itemKey: rec.itemKey,
                qty: rec.qty,
                error: poErr?.message || String(poErr),
                yasirLocation: globalThis.state?.daily?.getSnapshot?.()?.context?.yasir?.location ?? null
              });
              break;
            }
          }
          if (!progressed) {
            break;
          }
        }
        
        clearCaches();
        const remaining = loadYasirPoOrdersFromStorage();
        betterYasirPoConsoleLog('fulfillment finished', {
          mode,
          remainingOrderCount: remaining.length,
          remainingOrders: remaining.map((o) => ({
            itemKey: o.itemKey,
            qty: o.qty,
            listingGoldCap: o.listingGold != null && o.listingGold !== '' ? o.listingGold : null
          })),
          yasirLocation: globalThis.state?.daily?.getSnapshot?.()?.context?.yasir?.location ?? null
        });
      }
      
      function runAfterPurchaseOrderPlacementGrace(done) {
        const wait = yasirPoOrderPlacementGraceUntil - Date.now();
        if (wait > 0) {
          betterYasirPoConsoleLog(
            `PO fulfillment delayed ${Math.ceil(wait / 1000)}s (grace after placing an order)`
          );
          setTimeout(() => runAfterPurchaseOrderPlacementGrace(done), wait);
          return;
        }
        done();
      }
      
      function scheduleYasirPurchaseOrderFulfillment(modalWidgetBottom) {
        if (!modalWidgetBottom || yasirPoOrderFulfillmentInProgress) {
          if (!modalWidgetBottom) {
            betterYasirPoConsoleLog('schedule skipped: no modal widget');
          } else if (yasirPoOrderFulfillmentInProgress) {
            betterYasirPoConsoleLog('schedule skipped: fulfillment already in progress');
          }
          return;
        }
        if (!loadYasirPoOrdersFromStorage().length) {
          return;
        }
        if (modalWidgetBottom.dataset.betterYasirPoFulfillScheduled === '1') {
          betterYasirPoConsoleLog('schedule skipped: fulfillment timer already queued for this modal');
          return;
        }
        modalWidgetBottom.dataset.betterYasirPoFulfillScheduled = '1';
        betterYasirPoConsoleLog('scheduled purchase-order fulfillment (320ms debounce, then placement grace if any)', {
          queuedCount: loadYasirPoOrdersFromStorage().length
        });
        setTimeout(() => {
          if (yasirPoOrderFulfillmentInProgress) {
            delete modalWidgetBottom.dataset.betterYasirPoFulfillScheduled;
            betterYasirPoConsoleLog('delayed run skipped: fulfillment already in progress');
            return;
          }
          runAfterPurchaseOrderPlacementGrace(() => {
            delete modalWidgetBottom.dataset.betterYasirPoFulfillScheduled;
            if (!loadYasirPoOrdersFromStorage().length) {
              return;
            }
            if (yasirPoOrderFulfillmentInProgress) {
              return;
            }
            yasirPoOrderFulfillmentInProgress = true;
            fulfillYasirPurchaseOrderQueue(modalWidgetBottom)
              .catch((e) => {
                betterYasirPoConsoleLog('fulfillment promise rejected', {
                  error: e?.message || String(e)
                });
                handleError(e, 'scheduleYasirPurchaseOrderFulfillment');
              })
              .finally(() => {
                yasirPoOrderFulfillmentInProgress = false;
              });
          });
        }, 320);
      }
      
      function scheduleHeadlessYasirPurchaseOrderFulfillment() {
        if (!loadYasirPoOrdersFromStorage().length) {
          return;
        }
        if (yasirPoOrderFulfillmentInProgress) {
          betterYasirPoConsoleLog('headless schedule skipped: fulfillment already in progress');
          return;
        }
        if (yasirPoHeadlessFulfillTimer != null) {
          return;
        }
        betterYasirPoConsoleLog('scheduled headless purchase-order fulfillment (320ms debounce, then placement grace if any)', {
          queuedCount: loadYasirPoOrdersFromStorage().length
        });
        yasirPoHeadlessFulfillTimer = setTimeout(() => {
          if (yasirPoOrderFulfillmentInProgress) {
            yasirPoHeadlessFulfillTimer = null;
            betterYasirPoConsoleLog('headless delayed run skipped: fulfillment already in progress');
            return;
          }
          runAfterPurchaseOrderPlacementGrace(() => {
            yasirPoHeadlessFulfillTimer = null;
            if (!loadYasirPoOrdersFromStorage().length) {
              return;
            }
            if (yasirPoOrderFulfillmentInProgress) {
              return;
            }
            yasirPoOrderFulfillmentInProgress = true;
            fulfillYasirPurchaseOrderQueue(null)
              .catch((e) => {
                betterYasirPoConsoleLog('headless fulfillment promise rejected', {
                  error: e?.message || String(e)
                });
                handleError(e, 'scheduleHeadlessYasirPurchaseOrderFulfillment');
              })
              .finally(() => {
                yasirPoOrderFulfillmentInProgress = false;
              });
          });
        }, 320);
      }
      
      function yasirDailyContextSignature(y) {
        if (!y || typeof y !== 'object') {
          return '';
        }
        return `${y.location ?? ''}|${y.diceCost ?? ''}`;
      }
      
      /**
       * When daily Yasir data changes or on init, run PO fulfillment: modal path when shop is open, else headless
       * for dice + Exaltation Chest (Recycle Rune still needs the shop once for live gold/stock).
       */
      function maybeSchedulePoFulfillmentFromDailyUpdate(reason) {
        if (!loadYasirPoOrdersFromStorage().length) {
          return;
        }
        const modal = domUtils.findYasirModal();
        if (modal) {
          betterYasirPoConsoleLog(`scheduling PO fulfillment (${reason})`, {
            yasir: getYasirShopData(),
            queuedCount: loadYasirPoOrdersFromStorage().length
          });
          scheduleYasirPurchaseOrderFulfillment(modal);
        } else {
          betterYasirPoConsoleLog(`scheduling headless PO fulfillment (${reason})`, {
            yasir: getYasirShopData(),
            queuedCount: loadYasirPoOrdersFromStorage().length
          });
          scheduleHeadlessYasirPurchaseOrderFulfillment();
        }
      }
      
      function cleanupYasirDailyPoWatch() {
        if (yasirPoHeadlessFulfillTimer != null) {
          clearTimeout(yasirPoHeadlessFulfillTimer);
          yasirPoHeadlessFulfillTimer = null;
        }
        if (yasirDailyPoSetupRetryTimer != null) {
          clearTimeout(yasirDailyPoSetupRetryTimer);
          yasirDailyPoSetupRetryTimer = null;
        }
        if (!yasirDailyPoUnsub) {
          yasirDailyPoLastSig = null;
          return;
        }
        try {
          if (typeof yasirDailyPoUnsub.unsubscribe === 'function') {
            yasirDailyPoUnsub.unsubscribe();
          }
        } catch (_) {
          /* ignore */
        }
        yasirDailyPoUnsub = null;
        yasirDailyPoLastSig = null;
      }
      
      function setupYasirDailyPurchaseOrderWatch() {
        cleanupYasirDailyPoWatch();
        const daily = globalThis.state?.daily;
        if (!daily || typeof daily.subscribe !== 'function') {
          yasirDailyPoSetupRetryTimer = setTimeout(() => {
            yasirDailyPoSetupRetryTimer = null;
            setupYasirDailyPurchaseOrderWatch();
          }, 2000);
          return;
        }
        yasirDailyPoLastSig = yasirDailyContextSignature(daily.getSnapshot?.()?.context?.yasir);
        yasirDailyPoUnsub = daily.subscribe((snap) => {
          const y = snap?.context?.yasir;
          const sig = yasirDailyContextSignature(y);
          if (sig === yasirDailyPoLastSig) {
            return;
          }
          yasirDailyPoLastSig = sig;
          maybeSchedulePoFulfillmentFromDailyUpdate('globalThis.state.daily yasir context changed');
        });
        betterYasirPoConsoleLog('watching globalThis.state.daily for purchase-order fulfillment triggers');
      }
      
      function yasirPoFillTotalWithCurrencyIcon(targetEl, parts, placeholderText, fillOpts) {
        targetEl.replaceChildren();
        targetEl.classList.remove('better-yasir-po-currency-insufficient');
        if (!parts) {
          targetEl.textContent = placeholderText;
          return;
        }
        const insufficient = fillOpts && fillOpts.insufficient === true;
        const wrap = document.createElement('span');
        wrap.className = 'better-yasir-po-currency-inline better-yasir-po-row-em';
        if (insufficient) {
          wrap.classList.add('better-yasir-po-currency-insufficient');
        }
        const amt = document.createElement('span');
        amt.style.letterSpacing = '0.02em';
        amt.textContent = parts.amount;
        wrap.appendChild(amt);
        const im = document.createElement('img');
        im.className = 'pixelated better-yasir-po-currency-icon';
        im.alt =
          parts.kind === 'gold'
            ? t('mods.betterYasir.settingsPoCurrencyGoldIconAlt')
            : t('mods.betterYasir.settingsPoCurrencyDustIconAlt');
        im.src = parts.kind === 'gold' ? YASIR_PO_GOLD_ICON_SRC : YASIR_PO_DUST_ICON_SRC;
        im.width = 13;
        im.height = 13;
        wrap.appendChild(im);
        targetEl.appendChild(wrap);
        if (insufficient) {
          targetEl.classList.add('better-yasir-po-currency-insufficient');
        }
      }
      
      function createYasirSettingsSidePanel() {
        const panel = document.createElement('div');
        panel.id = 'better-yasir-settings-panel';
        panel.classList.add('better-yasir-orders-typography');
        panel.style.cssText = `
          width: ${YASIR_SETTINGS_PANEL_WIDTH}px;
          background: url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat;
          color: #fff;
          font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
          border: 4px solid transparent;
          border-image: url('https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png') 6 fill stretch;
          border-radius: 6px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        `;
        
        const stopIfNonInteractive = (event) => {
          const target = event.target;
          const interactive = target.tagName === 'SELECT' ||
            target.tagName === 'BUTTON' ||
            target.tagName === 'INPUT' ||
            target.closest('select') ||
            target.closest('button') ||
            target.closest('input');
          if (!interactive) {
            event.stopPropagation();
            event.preventDefault();
          }
        };
        addManagedEventListener(panel, 'click', stopIfNonInteractive);
        addManagedEventListener(panel, 'mousedown', stopIfNonInteractive);
        addManagedEventListener(panel, 'mouseup', stopIfNonInteractive);
        
        const panelHeader = document.createElement('div');
        panelHeader.className = 'better-yasir-settings-panel-header';
        const panelTitle = document.createElement('h3');
        panelTitle.className = 'better-yasir-settings-section-title';
        panelTitle.style.marginBottom = '0';
        panelTitle.textContent = t('mods.betterYasir.tabSettings');
        panelHeader.appendChild(panelTitle);
        
        const tabBar = document.createElement('div');
        tabBar.className = 'better-yasir-settings-tab-bar';
        const tabBtnOrders = document.createElement('button');
        tabBtnOrders.type = 'button';
        tabBtnOrders.className = `better-yasir-settings-tab is-active ${YASIR_SETTINGS_BTN_BASE} frame-1 active:frame-pressed-1 surface-regular text-whiteRegular`;
        tabBtnOrders.dataset.betterYasirTab = 'orders';
        tabBtnOrders.textContent = t('mods.betterYasir.settingsPurchaseOrdersTitle');
        tabBtnOrders.setAttribute('aria-selected', 'true');
        const tabBtnHistory = document.createElement('button');
        tabBtnHistory.type = 'button';
        tabBtnHistory.className = `better-yasir-settings-tab ${YASIR_SETTINGS_BTN_BASE} frame-1 active:frame-pressed-1 surface-regular text-whiteRegular`;
        tabBtnHistory.dataset.betterYasirTab = 'history';
        tabBtnHistory.textContent = t('mods.betterYasir.settingsPurchaseHistoryTitle');
        tabBtnHistory.setAttribute('aria-selected', 'false');
        tabBar.appendChild(tabBtnOrders);
        tabBar.appendChild(tabBtnHistory);
        panelHeader.appendChild(tabBar);
        panel.appendChild(panelHeader);
        
        const mainContainer = document.createElement('div');
        mainContainer.className = 'better-yasir-settings-main';
        
        const tabPanelsWrap = document.createElement('div');
        tabPanelsWrap.className = 'better-yasir-settings-tab-panels';
        
        const tabPanelOrders = document.createElement('div');
        tabPanelOrders.className =
          'better-yasir-settings-tab-panel is-active better-yasir-settings-tab-panel--po-orders';
        tabPanelOrders.dataset.betterYasirOrdersTab = 'orders';
        
        const tabPanelHistory = document.createElement('div');
        tabPanelHistory.className = 'better-yasir-settings-tab-panel';
        tabPanelHistory.dataset.betterYasirOrdersTab = 'history';
        
        const poColTitle = document.createElement('h4');
        poColTitle.className = 'better-yasir-settings-section-title';
        poColTitle.textContent = t('mods.betterYasir.settingsPoComposerSectionTitle');
        tabPanelOrders.appendChild(poColTitle);
        
        const composerTop = document.createElement('div');
        composerTop.className = 'better-yasir-po-composer';
        
        const PO_PICKER_ITEMS = [
          { key: 'diceManipulator3', labelKey: 'mods.betterYasir.settingsPoItemDiceRare', rarityClass: 'text-rarity-3', kind: 'dice', rarity: 3 },
          { key: 'diceManipulator4', labelKey: 'mods.betterYasir.settingsPoItemDiceMythic', rarityClass: 'text-rarity-4', kind: 'dice', rarity: 4 },
          {
            key: 'recycleRune',
            labelKey: 'mods.betterYasir.settingsPoItemRecycleRune',
            rarityClass: '',
            kind: 'icon',
            icon: 'https://bestiaryarena.com/assets/icons/rune-recycle.png'
          },
          {
            key: 'exaltationChest',
            labelKey: 'mods.betterYasir.settingsPoItemExaltationChest',
            rarityClass: 'text-rarity-5',
            kind: 'icon',
            icon: 'https://bestiaryarena.com/assets/icons/exaltation-chest.png'
          }
        ];
        
        function mountYasirPoItemPicker(initialEntry, onItemChange) {
          const itemPickerWrap = document.createElement('div');
          itemPickerWrap.className = 'better-yasir-po-item-picker-root';
          itemPickerWrap.style.marginTop = '0';
          
          const itemList = document.createElement('div');
          itemList.className = 'better-yasir-po-item-list';
          itemList.dataset.open = 'false';
          itemList.style.display = 'none';
          
          const trigger = document.createElement('button');
          trigger.type = 'button';
          trigger.className = 'better-yasir-po-item-trigger';
          
          const triggerVisualHost = document.createElement('div');
          triggerVisualHost.className = 'better-yasir-po-trigger-visual flex shrink-0 items-center justify-center';
          const triggerLabel = document.createElement('span');
          triggerLabel.className = 'flex-1 min-w-0 truncate';
          const chev = document.createElement('span');
          chev.className = 'better-yasir-po-item-trigger-chevron';
          chev.textContent = '▼';
          trigger.appendChild(triggerVisualHost);
          trigger.appendChild(triggerLabel);
          trigger.appendChild(chev);
          
          function renderTriggerPlaceholder() {
            triggerVisualHost.replaceChildren();
            const ph = document.createElement('div');
            ph.className = 'better-yasir-po-trigger-placeholder-slot';
            ph.setAttribute('aria-hidden', 'true');
            ph.style.cssText = 'width:32px;height:32px;min-width:32px;min-height:32px;flex-shrink:0;';
            triggerVisualHost.appendChild(ph);
            triggerLabel.className =
              'flex-1 min-w-0 truncate better-yasir-po-item-trigger-placeholder-label';
            const phText = t('mods.betterYasir.settingsPoSelectItemPlaceholder');
            triggerLabel.textContent = phText;
            trigger.removeAttribute('data-selected-key');
            trigger.setAttribute('aria-haspopup', 'listbox');
            trigger.setAttribute('aria-expanded', 'false');
            trigger.setAttribute('aria-label', t('mods.betterYasir.settingsPoSelectItemAria'));
          }
          
          function renderTriggerFromEntry(entry) {
            triggerVisualHost.replaceChildren(createYasirPoItemPickerVisual(entry));
            triggerLabel.className = `flex-1 min-w-0 truncate ${entry.rarityClass}`.trim();
            triggerLabel.textContent = t(entry.labelKey);
            trigger.dataset.selectedKey = entry.key;
            trigger.setAttribute('aria-haspopup', 'listbox');
            trigger.setAttribute('aria-expanded', 'false');
            trigger.removeAttribute('aria-label');
          }
          
          if (initialEntry) {
            renderTriggerFromEntry(initialEntry);
          } else {
            renderTriggerPlaceholder();
          }
          
          let listOpen = false;
          let ddScrollKey = null;
          let ddResizeKey = null;
          let ddPanelScrollKeys = [];
          let ddDocPtrKey = null;
          let ddDocMouseKey = null;
          let ddDocClickKey = null;
          let poDropOverlay = null;
          
          /** Viewport vs fixed containing block: Radix/dialog often uses transform, so fixed+viewport px misaligns. */
          function getPoListFixedContainingBlockRect(listEl) {
            let el = listEl.parentElement;
            while (el) {
              const cs = window.getComputedStyle(el);
              if (
                (cs.transform && cs.transform !== 'none') ||
                (cs.filter && cs.filter !== 'none') ||
                (cs.perspective && cs.perspective !== 'none')
              ) {
                return el.getBoundingClientRect();
              }
              el = el.parentElement;
            }
            return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
          }
          
          function repositionFloatingList() {
            if (!listOpen || !trigger.isConnected) {
              return;
            }
            const r = trigger.getBoundingClientRect();
            const margin = 8;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const w = Math.max(Math.min(r.width, vw - 2 * margin), 176);
            let leftVp = r.left;
            if (leftVp + w > vw - margin) {
              leftVp = Math.max(margin, vw - w - margin);
            }
            leftVp = Math.max(margin, leftVp);
            let topVp = r.bottom + 4;
            const spaceBelow = vh - topVp - margin;
            const spaceAbove = r.top - margin;
            const wantMin = 100;
            let maxH = Math.min(280, Math.max(spaceBelow, wantMin));
            if (spaceBelow < wantMin && spaceAbove > spaceBelow) {
              maxH = Math.min(280, spaceAbove - 4);
              topVp = Math.max(margin, r.top - maxH - 4);
            } else {
              maxH = Math.min(280, spaceBelow);
            }
            const cb = getPoListFixedContainingBlockRect(itemList);
            const left = leftVp - cb.left;
            const top = topVp - cb.top;
            itemList.style.position = 'fixed';
            itemList.style.left = `${Math.round(left)}px`;
            itemList.style.top = `${Math.round(top)}px`;
            itemList.style.width = `${Math.round(w)}px`;
            itemList.style.maxHeight = `${Math.round(maxH)}px`;
            itemList.style.overflowY = 'auto';
            itemList.style.overflowX = 'hidden';
            itemList.style.zIndex = '200010';
          }
          
          function unbindFloatingListListeners() {
            if (ddScrollKey) {
              removeManagedEventListener(ddScrollKey);
              ddScrollKey = null;
            }
            if (ddResizeKey) {
              removeManagedEventListener(ddResizeKey);
              ddResizeKey = null;
            }
            ddPanelScrollKeys.forEach((k) => removeManagedEventListener(k));
            ddPanelScrollKeys = [];
            if (ddDocPtrKey) {
              removeManagedEventListener(ddDocPtrKey);
              ddDocPtrKey = null;
            }
            if (ddDocMouseKey) {
              removeManagedEventListener(ddDocMouseKey);
              ddDocMouseKey = null;
            }
            if (ddDocClickKey) {
              removeManagedEventListener(ddDocClickKey);
              ddDocClickKey = null;
            }
          }
          
          function closePoItemList() {
            if (!listOpen) {
              return;
            }
            listOpen = false;
            itemList.dataset.open = 'false';
            itemList.style.display = 'none';
            itemList.removeAttribute('data-better-yasir-po-floating');
            trigger.setAttribute('aria-expanded', 'false');
            chev.textContent = '▼';
            unbindFloatingListListeners();
            itemList.style.position = '';
            itemList.style.left = '';
            itemList.style.top = '';
            itemList.style.width = '';
            itemList.style.maxHeight = '';
            itemList.style.overflowY = '';
            itemList.style.overflowX = '';
            itemList.style.zIndex = '';
            if (poDropOverlay) {
              poDropOverlay.style.display = 'none';
              if (poDropOverlay.parentNode) {
                poDropOverlay.remove();
              }
            }
            if (itemList.parentNode && itemList.parentNode !== itemPickerWrap) {
              try {
                if (itemPickerWrap.isConnected) {
                  itemPickerWrap.appendChild(itemList);
                } else {
                  itemList.remove();
                }
              } catch (_) {
                itemList.remove();
              }
            }
          }
          
          function openPoItemList() {
            if (listOpen) {
              return;
            }
            listOpen = true;
            itemList.dataset.open = 'true';
            itemList.setAttribute('data-better-yasir-po-floating', 'true');
            trigger.setAttribute('aria-expanded', 'true');
            if (!poDropOverlay) {
              poDropOverlay = document.createElement('div');
              poDropOverlay.setAttribute('data-better-yasir-po-overlay', 'true');
              poDropOverlay.style.cssText =
                'position:fixed;inset:0;z-index:200009;background:transparent;pointer-events:auto;cursor:default;display:none;';
              const overlayClose = (e) => {
                e.preventDefault();
                e.stopPropagation();
                closePoItemList();
              };
              addManagedEventListener(poDropOverlay, 'mousedown', overlayClose);
              addManagedEventListener(poDropOverlay, 'pointerdown', overlayClose);
              addManagedEventListener(poDropOverlay, 'click', overlayClose);
            }
            poDropOverlay.style.display = 'block';
            const floatRoot =
              itemPickerWrap.closest('[role="dialog"]') ||
              itemPickerWrap.closest('.widget-bottom') ||
              document.body;
            floatRoot.appendChild(poDropOverlay);
            floatRoot.appendChild(itemList);
            itemList.style.display = 'flex';
            repositionFloatingList();
            chev.textContent = '▲';
            const onRepos = () => repositionFloatingList();
            ddScrollKey = addManagedEventListener(window, 'scroll', onRepos, true);
            ddResizeKey = addManagedEventListener(window, 'resize', onRepos, { passive: true });
            const panelRoot = itemPickerWrap.closest('#better-yasir-settings-panel');
            if (panelRoot) {
              const scrollEls = [panelRoot];
              panelRoot.querySelectorAll(
                '.better-yasir-settings-main, .better-yasir-settings-tab-panels, .better-yasir-settings-tab-panel'
              ).forEach((el) => scrollEls.push(el));
              scrollEls.forEach((el) => {
                ddPanelScrollKeys.push(addManagedEventListener(el, 'scroll', onRepos, { passive: true }));
              });
            }
            const docClose = (ev) => {
              if (!itemPickerWrap.isConnected) {
                closePoItemList();
                return;
              }
              const t = ev.target;
              const path = typeof ev.composedPath === 'function' ? ev.composedPath() : null;
              const inFloatingUi =
                (path && path.includes(itemList)) ||
                (path && path.includes(trigger)) ||
                itemList.contains(t) ||
                trigger.contains(t);
              if (inFloatingUi) {
                return;
              }
              closePoItemList();
            };
            ddDocPtrKey = addManagedEventListener(document, 'pointerdown', docClose, true);
            ddDocMouseKey = addManagedEventListener(document, 'mousedown', docClose, true);
            ddDocClickKey = addManagedEventListener(document, 'click', docClose, true);
          }
          
          function applyPoItemSelection(entry) {
            if (!entry) {
              renderTriggerPlaceholder();
            } else {
              renderTriggerFromEntry(entry);
            }
            if (typeof onItemChange === 'function') {
              onItemChange();
            }
          }
          
          addManagedEventListener(itemList, 'mousedown', (e) => e.stopPropagation());
          addManagedEventListener(itemList, 'pointerdown', (e) => e.stopPropagation());
          addManagedEventListener(itemList, 'click', (e) => e.stopPropagation());
          
          PO_PICKER_ITEMS.forEach((entry) => {
            const opt = document.createElement('button');
            opt.type = 'button';
            opt.className = 'better-yasir-po-item-option';
            opt.dataset.itemKey = entry.key;
            opt.style.touchAction = 'manipulation';
            opt.appendChild(createYasirPoItemPickerVisual(entry));
            const lab = document.createElement('span');
            lab.className = `flex-1 min-w-0 leading-tight ${entry.rarityClass}`.trim();
            lab.textContent = t(entry.labelKey);
            opt.appendChild(lab);
            function pickPoItemOption(e) {
              if (e.button != null && e.button !== 0) {
                return;
              }
              e.stopPropagation();
              if (e.cancelable) {
                e.preventDefault();
              }
              applyPoItemSelection(entry);
              closePoItemList();
            }
            addManagedEventListener(opt, 'pointerdown', pickPoItemOption, true);
            addManagedEventListener(opt, 'click', (e) => {
              e.stopPropagation();
              e.preventDefault();
            });
            itemList.appendChild(opt);
          });
          
          addManagedEventListener(trigger, 'click', (e) => {
            e.stopPropagation();
            if (listOpen) {
              closePoItemList();
            } else {
              openPoItemList();
            }
          });
          
          itemPickerWrap.appendChild(trigger);
          itemPickerWrap.appendChild(itemList);
          
          function resetPickerToDefault() {
            closePoItemList();
            applyPoItemSelection(null);
          }
          
          return { wrap: itemPickerWrap, resetPickerToDefault, closePoItemList };
        }
        
        const composerEditor = document.createElement('div');
        composerEditor.className = 'better-yasir-po-composer-editor';
        
        const composerLineBuy = document.createElement('div');
        composerLineBuy.className = 'better-yasir-po-composer-line text-whiteRegular';
        
        const buyLbl = document.createElement('span');
        buyLbl.textContent = t('mods.betterYasir.settingsPoBuy');
        composerLineBuy.appendChild(buyLbl);
        
        const qtyComposerInput = createYasirPoNumberInput('mods.betterYasir.settingsPoQtyAriaDiceRare', 'better-yasir-po-qty-input');
        qtyComposerInput.value = '1';
        composerLineBuy.appendChild(qtyComposerInput);
        
        const ofOnlyLbl = document.createElement('span');
        ofOnlyLbl.textContent = t('mods.betterYasir.settingsPoOf');
        composerLineBuy.appendChild(ofOnlyLbl);
        
        const composerLinePrice = document.createElement('div');
        composerLinePrice.className =
          'better-yasir-po-composer-line better-yasir-po-composer-row-price text-whiteRegular';
        
        function getComposerItemKey() {
          return composerEditor.querySelector('.better-yasir-po-item-trigger')?.dataset?.selectedKey;
        }
        
        function syncComposerQtyLabel() {
          const key = getComposerItemKey();
          if (key === 'diceManipulator3') {
            qtyComposerInput.setAttribute('aria-label', t('mods.betterYasir.settingsPoQtyAriaDiceRare'));
          } else if (key === 'diceManipulator4') {
            qtyComposerInput.setAttribute('aria-label', t('mods.betterYasir.settingsPoQtyAriaDiceMythic'));
          } else {
            qtyComposerInput.setAttribute('aria-label', t('mods.betterYasir.settingsPoQtyAria'));
          }
        }
        
        const whenPrefix = document.createElement('span');
        whenPrefix.textContent = t('mods.betterYasir.settingsPoComposerPriceLead');
        const priceComposerInput = createYasirPoNumberInput('mods.betterYasir.settingsPoPriceInputAria', 'better-yasir-po-price-input');
        const whenSuffix = document.createElement('span');
        whenSuffix.textContent = t('mods.betterYasir.settingsPoPriceLimitSuffix');
        const priceLineDust = document.createElement('span');
        priceLineDust.className = 'better-yasir-po-ref-dust';
        priceLineDust.style.display = 'none';
        composerLinePrice.appendChild(whenPrefix);
        composerLinePrice.appendChild(priceComposerInput);
        composerLinePrice.appendChild(whenSuffix);
        composerLinePrice.appendChild(priceLineDust);
        
        let composerGoldBoundKey = null;
        
        function clampComposerPriceField(ev) {
          const min = parseInt(priceComposerInput.dataset.poPriceMin, 10);
          const max = parseInt(priceComposerInput.dataset.poPriceMax, 10);
          if (!Number.isFinite(min) || !Number.isFinite(max)) {
            return;
          }
          if (ev.type === 'blur' || ev.type === 'change') {
            let v = parseYasirPoPriceInt(priceComposerInput.value);
            if (!Number.isFinite(v)) {
              v = min;
            }
            priceComposerInput.value = String(clampYasirPoPrice(v, min, max));
            updateComposerTotalPreview();
            return;
          }
          if (ev.type === 'input') {
            const v = parseYasirPoPriceInt(priceComposerInput.value);
            if (Number.isFinite(v) && v > max) {
              priceComposerInput.value = String(max);
            }
            updateComposerTotalPreview();
          }
        }
        
        const totalPreviewRow = document.createElement('div');
        totalPreviewRow.className = 'better-yasir-po-composer-total-block text-whiteRegular';
        totalPreviewRow.style.cssText = 'opacity:0.92;font-size:10px;';
        const totalPreviewLbl = document.createElement('div');
        totalPreviewLbl.textContent = `${t('mods.betterYasir.settingsPoTotalCost')}:`;
        const totalPreviewVal = document.createElement('div');
        totalPreviewVal.className = 'better-yasir-po-composer-total-preview';
        totalPreviewVal.style.letterSpacing = '0.02em';
        totalPreviewRow.appendChild(totalPreviewLbl);
        totalPreviewRow.appendChild(totalPreviewVal);
        
        function updateComposerPriceDisplay() {
          const key = getComposerItemKey();
          if (!key) {
            whenPrefix.style.display = 'none';
            priceComposerInput.style.display = 'none';
            whenSuffix.style.display = 'none';
            priceLineDust.style.display = 'none';
            composerLinePrice.style.display = 'none';
            composerEditor.removeAttribute('aria-label');
            return;
          }
          composerLinePrice.style.display = '';
          const rule = YASIR_PO_PRICING[key];
          if (rule?.currency === 'dust') {
            whenPrefix.style.display = 'none';
            priceComposerInput.style.display = 'none';
            whenSuffix.style.display = 'none';
            priceLineDust.style.display = '';
            priceLineDust.textContent = t('mods.betterYasir.settingsPoComposerDustClause')
              .replace(/\{dust\}/g, formatYasirPoAmount(rule.perUnit));
            const dustPick = PO_PICKER_ITEMS.find((e) => e.key === key);
            const dustItemLab = dustPick ? t(dustPick.labelKey) : '';
            composerEditor.setAttribute(
              'aria-label',
              `${t('mods.betterYasir.settingsPoBuy')} ${qtyComposerInput.value} ${t('mods.betterYasir.settingsPoOf')} ${dustItemLab}. ${priceLineDust.textContent}`
            );
          } else {
            priceLineDust.style.display = 'none';
            whenPrefix.style.display = '';
            priceComposerInput.style.display = '';
            whenSuffix.style.display = '';
            const bounds = getYasirPoPriceBounds(key);
            if (bounds) {
              priceComposerInput.dataset.poPriceMin = String(bounds.min);
              priceComposerInput.dataset.poPriceMax = String(bounds.max);
              if (composerGoldBoundKey !== key) {
                priceComposerInput.value = String(bounds.min);
                composerGoldBoundKey = key;
              } else {
                let v = parseYasirPoPriceInt(priceComposerInput.value);
                if (!Number.isFinite(v)) {
                  v = bounds.min;
                }
                priceComposerInput.value = String(clampYasirPoPrice(v, bounds.min, bounds.max));
              }
              priceComposerInput.setAttribute(
                'aria-label',
                t('mods.betterYasir.settingsPoPriceInputAria')
                  .replace(/\{min\}/g, formatYasirPoAmount(bounds.min))
                  .replace(/\{max\}/g, formatYasirPoAmount(bounds.max))
              );
            }
            const pickEnt = PO_PICKER_ITEMS.find((e) => e.key === key);
            const itemLab = pickEnt ? t(pickEnt.labelKey) : '';
            const pv = parseYasirPoPriceInt(priceComposerInput.value);
            const pvShow = Number.isFinite(pv) ? formatYasirPoAmount(pv) : '';
            const lead = t('mods.betterYasir.settingsPoComposerPriceLead');
            const suf = t('mods.betterYasir.settingsPoPriceLimitSuffix');
            composerEditor.setAttribute(
              'aria-label',
              `${t('mods.betterYasir.settingsPoBuy')} ${qtyComposerInput.value} ${t('mods.betterYasir.settingsPoOf')} ${itemLab}. ${lead}${pvShow}${suf}`
            );
          }
        }
        
        function updateComposerTotalPreview() {
          const key = getComposerItemKey();
          const ph = t('mods.betterYasir.settingsPoPlaceholder');
          if (!key) {
            yasirPoFillTotalWithCurrencyIcon(totalPreviewVal, null, ph);
            return;
          }
          clearCaches();
          const rule = YASIR_PO_PRICING[key];
          const priceArg = rule?.currency === 'dust' ? undefined : priceComposerInput.value;
          const parts = computeYasirPoOrderTotalParts(key, qtyComposerInput.value, priceArg);
          let insufficient = false;
          if (parts?.kind === 'gold') {
            const need = computeYasirPoOrderGoldTotalNumber(key, qtyComposerInput.value, priceArg);
            insufficient = need != null && getPlayerGold() < need;
          } else if (parts?.kind === 'dust' && rule) {
            const qty = parseYasirPoQtyInt(qtyComposerInput.value);
            insufficient = Number.isFinite(qty) && getPlayerDust() < qty * rule.perUnit;
          }
          yasirPoFillTotalWithCurrencyIcon(totalPreviewVal, parts, ph, { insufficient });
        }
        
        const pickerApi = mountYasirPoItemPicker(null, () => {
          syncComposerQtyLabel();
          updateComposerPriceDisplay();
          updateComposerTotalPreview();
        });
        pickerApi.wrap.classList.add('better-yasir-po-composer-picker');
        
        composerLineBuy.appendChild(pickerApi.wrap);
        
        composerEditor.appendChild(composerLineBuy);
        composerEditor.appendChild(composerLinePrice);
        composerEditor.appendChild(totalPreviewRow);
        
        function resetComposerToDefaults() {
          qtyComposerInput.value = '1';
          composerGoldBoundKey = null;
          pickerApi.resetPickerToDefault();
          syncComposerQtyLabel();
          updateComposerPriceDisplay();
          updateComposerTotalPreview();
        }
        
        addManagedEventListener(qtyComposerInput, 'input', () => {
          updateComposerPriceDisplay();
          updateComposerTotalPreview();
        });
        addManagedEventListener(qtyComposerInput, 'change', () => {
          updateComposerPriceDisplay();
          updateComposerTotalPreview();
        });
        
        addManagedEventListener(priceComposerInput, 'input', (ev) => clampComposerPriceField(ev));
        addManagedEventListener(priceComposerInput, 'change', (ev) => clampComposerPriceField(ev));
        addManagedEventListener(priceComposerInput, 'blur', (ev) => clampComposerPriceField(ev));
        
        const poListEl = document.createElement('div');
        poListEl.className = 'better-yasir-po-list';
        
        function syncPoOrderCardAffordabilityUi(card) {
          const itemKey = card?.dataset?.poItemKey;
          if (!itemKey) {
            return;
          }
          clearCaches();
          const qty = parseInt(card.dataset.poQty, 10);
          const lg = card.dataset.poListingGold;
          const rule = YASIR_PO_PRICING[itemKey];
          const totalHost = card.querySelector('[data-better-yasir-po-total-host="true"]');
          if (!totalHost) {
            return;
          }
          const parts = computeYasirPoOrderTotalParts(
            itemKey,
            String(qty),
            lg != null && lg !== '' ? String(lg) : undefined
          );
          let insufficient = false;
          if (rule?.currency === 'gold') {
            const need = computeYasirPoOrderGoldTotalNumber(
              itemKey,
              String(qty),
              lg != null && lg !== '' ? String(lg) : undefined
            );
            insufficient = need != null && getPlayerGold() < need;
          } else if (rule?.currency === 'dust') {
            insufficient = !Number.isFinite(qty) || getPlayerDust() < qty * rule.perUnit;
          }
          yasirPoFillTotalWithCurrencyIcon(
            totalHost,
            parts,
            t('mods.betterYasir.settingsPoPlaceholder'),
            { insufficient }
          );
          card.classList.toggle('better-yasir-po-row-order--suspended', insufficient);
          let note = card.querySelector('[data-better-yasir-po-suspended-note="true"]');
          if (insufficient) {
            if (!note) {
              note = document.createElement('div');
              note.dataset.betterYasirPoSuspendedNote = 'true';
              note.className = 'better-yasir-po-suspended-note text-whiteRegular';
              note.textContent =
                rule?.currency === 'dust'
                  ? t('mods.betterYasir.settingsPoOrderSuspendedDust')
                  : t('mods.betterYasir.settingsPoOrderSuspendedGold');
              const bodyEl = card.querySelector('.better-yasir-po-row-order-body');
              if (bodyEl) {
                bodyEl.appendChild(note);
              }
            }
          } else if (note) {
            note.remove();
          }
        }
        
        function reorderSuspendedPoOrderCardsToTop() {
          const cards = Array.from(poListEl.querySelectorAll('[data-better-yasir-po-card]'));
          if (cards.length < 2) {
            return;
          }
          const suspended = [];
          const active = [];
          for (const c of cards) {
            if (c.classList.contains('better-yasir-po-row-order--suspended')) {
              suspended.push(c);
            } else {
              active.push(c);
            }
          }
          if (suspended.length === 0) {
            return;
          }
          const ordered = suspended.concat(active);
          const frag = document.createDocumentFragment();
          for (const c of ordered) {
            frag.appendChild(c);
          }
          poListEl.appendChild(frag);
        }
        
        function refreshPoOrdersAffordability() {
          poListEl.querySelectorAll('[data-better-yasir-po-card]').forEach((c) => syncPoOrderCardAffordabilityUi(c));
          reorderSuspendedPoOrderCardsToTop();
          updateComposerTotalPreview();
        }
        
        function collectPoOrdersSnapshot() {
          return Array.from(poListEl.querySelectorAll('[data-better-yasir-po-card]'))
            .map((card) => ({
              itemKey: card.dataset.poItemKey,
              qty: parseInt(card.dataset.poQty, 10),
              listingGold:
                card.dataset.poListingGold != null && card.dataset.poListingGold !== ''
                  ? parseInt(card.dataset.poListingGold, 10)
                  : null
            }))
            .filter((r) => r.itemKey && Number.isFinite(r.qty) && r.qty > 0);
        }
        
        function persistPoOrders(options = {}) {
          saveYasirPoOrdersToStorage(collectPoOrdersSnapshot());
          refreshBetterYasirFooterOrdersIndicator();
          refreshBetterYasirOrdersPanelTabCounts();
          refreshPoOrdersAffordability();
          if (options.afterUserPlacedOrder === true) {
            yasirPoOrderPlacementGraceUntil = Date.now() + BETTER_YASIR_PO_PLACEMENT_GRACE_MS;
          }
          const modalHost = poListEl.closest('.widget-bottom');
          if (modalHost) {
            scheduleYasirPurchaseOrderFulfillment(modalHost);
          } else {
            scheduleHeadlessYasirPurchaseOrderFulfillment();
          }
        }
        
        function createReadOnlyPurchaseOrderRow(itemKey, qty, goldListingRaw) {
          const entry = PO_PICKER_ITEMS.find((e) => e.key === itemKey);
          if (!entry || !Number.isFinite(qty) || qty <= 0) {
            return null;
          }
          
          const card = document.createElement('div');
          card.dataset.betterYasirPoCard = 'true';
          card.className = 'better-yasir-po-row-order frame-pressed-1 surface-dark';
          card.dataset.poItemKey = itemKey;
          card.dataset.poQty = String(qty);
          
          const body = document.createElement('div');
          body.className = 'better-yasir-po-row-order-body';
          
          const name = t(entry.labelKey);
          const bounds = getYasirPoPriceBounds(itemKey);
          const rule = YASIR_PO_PRICING[itemKey];
          
          let listingGold = null;
          if (bounds) {
            let v = parseYasirPoPriceInt(goldListingRaw);
            if (!Number.isFinite(v)) {
              v = bounds.min;
            }
            listingGold = clampYasirPoPrice(v, bounds.min, bounds.max);
            card.dataset.poListingGold = String(listingGold);
          }
          
          const totalParts = computeYasirPoOrderTotalParts(
            itemKey,
            String(qty),
            listingGold != null ? String(listingGold) : undefined
          );
          
          const line1 = document.createElement('div');
          line1.className = 'better-yasir-po-row-order-line text-whiteRegular';
          
          const spanBuy = document.createElement('span');
          spanBuy.textContent = t('mods.betterYasir.settingsPoBuy');
          line1.appendChild(spanBuy);
          
          const spanQty = document.createElement('span');
          spanQty.className = 'better-yasir-po-row-em';
          spanQty.textContent = formatYasirPoAmount(qty);
          line1.appendChild(spanQty);
          
          const spanOf = document.createElement('span');
          spanOf.textContent = t('mods.betterYasir.settingsPoOf');
          line1.appendChild(spanOf);
          
          const nameSpan = document.createElement('span');
          nameSpan.className = (entry.rarityClass || '').trim();
          const productPhrase = getYasirPoOrderProductPhrase(itemKey);
          nameSpan.textContent = productPhrase || name;
          line1.appendChild(nameSpan);
          
          if (listingGold != null) {
            const wp = document.createElement('span');
            wp.textContent = t('mods.betterYasir.settingsPoPriceLimitPrefix');
            line1.appendChild(wp);
            const pr = document.createElement('span');
            pr.className = 'better-yasir-po-row-em';
            pr.textContent = formatYasirPoAmount(listingGold);
            pr.style.letterSpacing = '0.02em';
            line1.appendChild(pr);
            const ws = document.createElement('span');
            ws.textContent = t('mods.betterYasir.settingsPoPriceLimitSuffix');
            line1.appendChild(ws);
          } else if (rule?.currency === 'dust') {
            const dustSpan = document.createElement('span');
            const dustRaw = t('mods.betterYasir.settingsPoComposerDustClause');
            const dustAmt = formatYasirPoAmount(rule.perUnit);
            const dustParts = dustRaw.split('{dust}');
            if (dustParts.length === 2) {
              dustSpan.appendChild(document.createTextNode(dustParts[0]));
              const dustBold = document.createElement('span');
              dustBold.className = 'better-yasir-po-row-em';
              dustBold.textContent = dustAmt;
              dustSpan.appendChild(dustBold);
              dustSpan.appendChild(document.createTextNode(dustParts[1]));
            } else {
              dustSpan.textContent = dustRaw.replace(/\{dust\}/g, dustAmt);
            }
            line1.appendChild(dustSpan);
          }
          
          const line2 = document.createElement('div');
          line2.className = 'better-yasir-po-row-order-total text-whiteRegular';
          line2.appendChild(
            document.createTextNode(`${t('mods.betterYasir.settingsPoTotalCost')}: `)
          );
          const totalHost = document.createElement('span');
          totalHost.dataset.betterYasirPoTotalHost = 'true';
          yasirPoFillTotalWithCurrencyIcon(
            totalHost,
            totalParts,
            t('mods.betterYasir.settingsPoPlaceholder')
          );
          line2.appendChild(totalHost);
          
          body.appendChild(line1);
          body.appendChild(line2);
          
          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.dataset.betterYasirPoRemove = 'true';
          removeBtn.className = `better-yasir-po-row-order-remove ${YASIR_SETTINGS_BTN_BASE} frame-1-red active:frame-pressed-1-red surface-red text-whiteHighlight`;
          removeBtn.textContent = t('mods.betterYasir.settingsPoRemove');
          addManagedEventListener(removeBtn, 'click', () => {
            card.remove();
            persistPoOrders({});
          });
          
          const actions = document.createElement('div');
          actions.className = 'better-yasir-po-row-order-actions';
          actions.appendChild(removeBtn);
          
          card.appendChild(body);
          card.appendChild(actions);
          syncPoOrderCardAffordabilityUi(card);
          return card;
        }
        
        const addPoBtn = document.createElement('button');
        addPoBtn.type = 'button';
        addPoBtn.className = `${YASIR_SETTINGS_BTN_BASE} frame-1-green active:frame-pressed-1-green surface-green text-whiteHighlight better-yasir-po-add-btn`;
        addPoBtn.textContent = t('mods.betterYasir.settingsPoAdd');
        addManagedEventListener(addPoBtn, 'click', () => {
          const key = getComposerItemKey();
          const qty = parseYasirPoQtyInt(qtyComposerInput.value);
          if (!key || !Number.isFinite(qty)) {
            return;
          }
          const rule = YASIR_PO_PRICING[key];
          let goldRaw = null;
          if (rule?.currency !== 'dust' && getYasirPoPriceBounds(key)) {
            clampComposerPriceField({ type: 'blur' });
            goldRaw = priceComposerInput.value;
          }
          clearCaches();
          if (rule?.currency === 'gold') {
            const needGold = computeYasirPoOrderGoldTotalNumber(key, String(qty), goldRaw);
            if (needGold != null && getPlayerGold() < needGold) {
              updateComposerTotalPreview();
              return;
            }
          } else if (rule?.currency === 'dust') {
            if (getPlayerDust() < qty * rule.perUnit) {
              updateComposerTotalPreview();
              return;
            }
          }
          const row = createReadOnlyPurchaseOrderRow(key, qty, goldRaw);
          if (row) {
            poListEl.appendChild(row);
            resetComposerToDefaults();
            persistPoOrders({ afterUserPlacedOrder: true });
          }
        });
        
        const queuedOrdersTitle = document.createElement('h4');
        queuedOrdersTitle.className = 'better-yasir-settings-section-title is-compact';
        queuedOrdersTitle.textContent = t('mods.betterYasir.settingsPlacedOrdersTitle');
        
        const placedWrap = document.createElement('div');
        placedWrap.className = 'better-yasir-po-placed';
        const placedScroll = document.createElement('div');
        placedScroll.className = 'better-yasir-po-placed-scroll';
        placedScroll.appendChild(poListEl);
        
        composerTop.appendChild(composerEditor);
        composerTop.appendChild(addPoBtn);
        placedWrap.appendChild(queuedOrdersTitle);
        placedWrap.appendChild(placedScroll);
        
        loadYasirPoOrdersFromStorage().forEach((rec) => {
          if (!rec.itemKey || !Number.isFinite(rec.qty)) {
            return;
          }
          const row = createReadOnlyPurchaseOrderRow(
            rec.itemKey,
            rec.qty,
            rec.listingGold != null && Number.isFinite(rec.listingGold) ? String(rec.listingGold) : undefined
          );
          if (row) {
            poListEl.appendChild(row);
          }
        });
        
        syncComposerQtyLabel();
        updateComposerPriceDisplay();
        updateComposerTotalPreview();
        
        tabPanelOrders.appendChild(composerTop);
        tabPanelOrders.appendChild(placedWrap);
        
        const histTitleH = document.createElement('h4');
        histTitleH.className = 'better-yasir-settings-section-title';
        histTitleH.textContent = t('mods.betterYasir.settingsPurchaseHistoryTitle');
        const histContainer = document.createElement('div');
        histContainer.className = 'better-yasir-po-history-list text-whiteRegular';
        histContainer.style.opacity = '0.9';
        tabPanelHistory.appendChild(histTitleH);
        tabPanelHistory.appendChild(histContainer);
        
        function renderYasirPurchaseHistoryInto(container) {
          container.replaceChildren();
          let entries = [];
          try {
            const raw = localStorage.getItem(BETTER_YASIR_PO_HISTORY_STORAGE_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                entries = parsed;
              }
            }
          } catch (_) {
            entries = [];
          }
          if (entries.length === 0) {
            const p = document.createElement('p');
            p.className = 'text-whiteRegular';
            p.style.cssText = 'margin:0;opacity:0.85;line-height:1.38;';
            p.textContent = t('mods.betterYasir.settingsPoHistoryEmpty');
            container.appendChild(p);
            return;
          }
          entries.forEach((e) => {
            const row = document.createElement('div');
            row.className = 'better-yasir-po-history-row frame-pressed-1 surface-dark';
            row.style.cssText = 'padding:6px 8px;margin-bottom:4px;line-height:1.35;';
            const time = new Date(e.ts).toLocaleString(undefined, {
              dateStyle: 'short',
              timeStyle: 'short',
              hour12: false
            });
            const normalizedLine = String(e.line || '').replace(/(\d)[\u00A0\u202F](?=\d{3}\b)/g, '$1,');
            row.textContent = `${time} — ${normalizedLine}`;
            container.appendChild(row);
          });
        }
        
        function setOrdersSettingsTab(which) {
          refreshBetterYasirOrdersPanelTabCounts();
          const showOrders = which === 'orders';
          tabPanelOrders.classList.toggle('is-active', showOrders);
          tabPanelHistory.classList.toggle('is-active', !showOrders);
          tabBtnOrders.classList.toggle('is-active', showOrders);
          tabBtnHistory.classList.toggle('is-active', !showOrders);
          tabBtnOrders.setAttribute('aria-selected', showOrders ? 'true' : 'false');
          tabBtnHistory.setAttribute('aria-selected', showOrders ? 'false' : 'true');
          if (showOrders) {
            refreshPoOrdersAffordability();
          } else {
            renderYasirPurchaseHistoryInto(histContainer);
          }
        }
        
        addManagedEventListener(tabBtnOrders, 'click', (e) => {
          e.stopPropagation();
          setOrdersSettingsTab('orders');
        });
        addManagedEventListener(tabBtnHistory, 'click', (e) => {
          e.stopPropagation();
          setOrdersSettingsTab('history');
        });
        
        tabPanelsWrap.appendChild(tabPanelOrders);
        tabPanelsWrap.appendChild(tabPanelHistory);
        mainContainer.appendChild(tabPanelsWrap);
        panel.appendChild(mainContainer);
        
        panel._betterYasirRefreshPoAffordability = refreshPoOrdersAffordability;
        refreshPoOrdersAffordability();
        
        return panel;
      }
      
      function detachYasirPoAffordabilityPlayerListener() {
        if (!yasirPoAffordabilityUnsub) {
          return;
        }
        try {
          if (typeof yasirPoAffordabilityUnsub === 'function') {
            yasirPoAffordabilityUnsub();
          } else if (typeof yasirPoAffordabilityUnsub.unsubscribe === 'function') {
            yasirPoAffordabilityUnsub.unsubscribe();
          }
        } catch (_) {
          /* ignore */
        }
        yasirPoAffordabilityUnsub = null;
      }
      
      function openYasirSettingsPanel(widgetBottom) {
        cleanupYasirSettingsPanel();
        const dialogEl = widgetBottom?.closest('[role="dialog"]');
        if (!dialogEl) {
          return;
        }
        const panel = createYasirSettingsSidePanel();
        positionYasirSettingsPanel(panel, dialogEl);
        widgetBottom.appendChild(panel);
        refreshBetterYasirOrdersPanelTabCounts();
        yasirActiveSettingsPanel = panel;
        panel.setAttribute('data-modal-part', 'true');
        panel.dataset.attachedModalId = dialogEl.id || 'yasir-dialog';
        
        setupYasirSettingsPanelObservers(dialogEl);
        setupYasirSettingsPanelResize(dialogEl);
        
        const escHandler = (event) => {
          if (event.key === 'Escape' && yasirActiveSettingsPanel) {
            cleanupYasirSettingsPanel();
          }
        };
        yasirSettingsEscListenerKey = addManagedEventListener(document, 'keydown', escHandler);
        
        syncYasirFooterSettingsButton(widgetBottom);
        
        detachYasirPoAffordabilityPlayerListener();
        const playerActor = globalThis.state?.player;
        if (playerActor?.subscribe && typeof panel._betterYasirRefreshPoAffordability === 'function') {
          const sub = playerActor.subscribe(() => {
            if (!document.getElementById('better-yasir-settings-panel')) {
              detachYasirPoAffordabilityPlayerListener();
              return;
            }
            try {
              panel._betterYasirRefreshPoAffordability();
            } catch (_) {
              /* ignore */
            }
          });
          if (sub && typeof sub.unsubscribe === 'function') {
            yasirPoAffordabilityUnsub = () => {
              try {
                sub.unsubscribe();
              } catch (_) {
                /* ignore */
              }
            };
          }
        }
      }
      
      function injectYasirFooterSettingsButton(widgetBottom) {
        if (!widgetBottom || widgetBottom.querySelector('[data-better-yasir-footer-settings]')) {
          return;
        }
        const footer = widgetBottom.querySelector('.flex.justify-end.gap-2');
        if (!footer) {
          return;
        }
        const closeButton = footer.querySelector('button:last-of-type');
        if (!closeButton) {
          return;
        }
        const footerBtn = document.createElement('button');
        footerBtn.type = 'button';
        footerBtn.dataset.betterYasirFooterSettings = 'true';
        footerBtn.textContent = t('mods.betterYasir.tabSettings');
        footerBtn.className = yasirSettingsFooterButtonClass();
        footerBtn.setAttribute('aria-label', t('mods.betterYasir.tabSettings'));
        addManagedEventListener(footerBtn, 'click', () => {
          if (yasirActiveSettingsPanel) {
            cleanupYasirSettingsPanel();
            syncYasirFooterSettingsButton(widgetBottom);
            return;
          }
          openYasirSettingsPanel(widgetBottom);
        });
        footer.insertBefore(footerBtn, closeButton);
        refreshBetterYasirFooterOrdersIndicator();
      }
      
      function teardownBetterYasirUi() {
        cleanupYasirSettingsPanel();
        document.querySelectorAll('[data-better-yasir-footer-settings]').forEach((el) => el.remove());
        document.querySelectorAll('[data-better-yasir-header-row]').forEach((row) => {
          const h2 = row.querySelector('h2.widget-top');
          const rowParent = row.parentElement;
          if (h2 && rowParent) {
            rowParent.insertBefore(h2, row);
          }
          row.remove();
        });
        document.querySelectorAll('.widget-bottom').forEach((wb) => {
          const shopPane = wb.querySelector('.better-yasir-shop-pane');
          const settingsPane = wb.querySelector('.better-yasir-settings-pane');
          if (shopPane && wb.contains(shopPane)) {
            while (shopPane.firstChild) {
              wb.insertBefore(shopPane.firstChild, shopPane);
            }
            shopPane.remove();
          }
          if (settingsPane) {
            settingsPane.remove();
          }
          delete wb.dataset.betterYasirTabsInit;
          delete wb.dataset.betterYasirActiveTab;
        });
        document.getElementById('better-yasir-settings-panel')?.remove();
      }
      
      // Main function to enhance the Yasir modal
      // candidateWidget: optional .widget-bottom from mutation loop (must not pre-set betterYasirProcessing on it — enhance manages that flag).
      function enhanceYasirModal(candidateWidget = null) {
        // Inject styles only when enhancing modal
        injectStyles();
        
        // Try multiple ways to find the Yasir modal
        let modal = null;
        const buyLabel = t('mods.betterYasir.buy');
        const sellLabel = t('mods.betterYasir.sell');
        const currentStockText = t('mods.betterYasir.currentStock');
        const exchangeText = t('mods.betterYasir.exchangeItems');
        
        const matchesYasirWidgetBottom = (w) => {
          if (!w?.classList?.contains('widget-bottom') || !w.querySelector('table')) {
            return false;
          }
          const text = w.textContent || '';
          const hasYasir = text.includes('Yasir');
          const hasBuySection = text.includes('Current stock') ||
            text.includes(currentStockText) ||
            text.includes(buyLabel);
          const hasSellSection = text.includes('Exchange your items for dust') ||
            text.includes(exchangeText) ||
            text.includes(sellLabel);
          return hasYasir && hasBuySection && hasSellSection;
        };
        
        if (candidateWidget && matchesYasirWidgetBottom(candidateWidget)) {
          modal = candidateWidget;
          console.log('[Better Yasir]', 'enhance: modal via candidate (mutation loop)');
        }
        
        // Method 1: visible shop title (skip sr-only duplicate h2 in dialog)
        if (!modal) {
          const yasirTitle = document.querySelector('h2.widget-top:not(.sr-only) p') ||
            document.querySelector('h2.widget-top p') ||
            document.querySelector('h2 p');
          if (yasirTitle && yasirTitle.textContent.includes('Yasir')) {
            const titleH2 = yasirTitle.closest('h2');
            let widgetBottom = titleH2?.nextElementSibling?.classList?.contains('widget-bottom')
              ? titleH2.nextElementSibling
              : null;
            if (!widgetBottom && titleH2) {
              const dialog = titleH2.closest('[role="dialog"]');
              widgetBottom = dialog?.querySelector('.widget-bottom') || null;
            }
            const widgetText = widgetBottom?.textContent || '';
            const hasBuyMarkers = widgetText.includes('Current stock') ||
              widgetText.includes(currentStockText) ||
              widgetText.includes(buyLabel);
            if (widgetBottom && hasBuyMarkers) {
              modal = widgetBottom;
              console.log('[Better Yasir]', 'enhance: modal via method1 (title h2 + widget-bottom sibling)');
            }
          }
        }
        
        // Method 2: widget-bottom with Yasir copy and buy/sell tables (raw or after updateSectionTitles)
        if (!modal) {
          const widgetBottoms = document.querySelectorAll('.widget-bottom');
          for (const widget of widgetBottoms) {
            if (matchesYasirWidgetBottom(widget)) {
              modal = widget;
              console.log('[Better Yasir]', 'enhance: modal via method2 (scan widget-bottoms)');
              break;
            }
          }
        }
        
        if (!modal) {
          console.log('[Better Yasir]', 'enhance: no modal matched', {
            buyLabel,
            sellLabel,
            widgetBottomCount: document.querySelectorAll('.widget-bottom').length
          });
          return false;
        }
        
        // Check if we've already enhanced this modal
        if (modal.dataset.betterYasirEnhanced) {
          return true;
        }
        
        // Check if modal is currently being processed
        if (modal.dataset.betterYasirProcessing) {
          return false;
        }
        
        // Mark modal as being processed
        modal.dataset.betterYasirProcessing = 'true';
        
        // Process flex containers (for the new div structure) - this handles everything now
        addQuantityInputsToFlexContainers();
        ensureYasirTooltipStructure(modal);
        
        injectYasirFooterSettingsButton(modal);
        
        // Mark as enhanced
        modal.dataset.betterYasirEnhanced = 'true';
        
        // Remove processing marker
        delete modal.dataset.betterYasirProcessing;
        
        console.log('[Better Yasir]', 'enhance: complete', {
          hasFooterBtn: !!modal.querySelector('[data-better-yasir-footer-settings]')
        });
        
        scheduleYasirPurchaseOrderFulfillment(modal);
        
        return true;
      }
      
    // =======================
    // 5. Main Logic
    // =======================
      
      // Update section titles in the Yasir modal
      function updateSectionTitles(modal) {
        try {
          // Find all table header cells in the entire document
          const sectionHeaders = document.querySelectorAll('th');
          
          sectionHeaders.forEach((header, index) => {
            const text = header.textContent?.trim();
            
            const currentStockText = t('mods.betterYasir.currentStock');
            const exchangeText = t('mods.betterYasir.exchangeItems');
            
            // Check for buy section
            if (text === 'Current stock' || text === currentStockText) {
              header.textContent = t('mods.betterYasir.buy');
              header.style.textAlign = 'center';
              header.style.color = '#32cd32'; // Green color
            } 
            // Check for sell section
            else if (text === 'Exchange your items for dust' || text === exchangeText) {
              header.textContent = t('mods.betterYasir.sell');
              header.style.textAlign = 'center';
              header.style.color = '#ff4d4d'; // Red color
            }
          });
        } catch (e) {
          console.log('[Better Yasir] Error updating section titles:', e);
        }
      }
      
      // Add price column headers to tables
      function addPriceColumnHeaders(modal) {
        try {
          // Find all tables in the entire document
          const tables = document.querySelectorAll('table');
          
          tables.forEach((table, tableIndex) => {
            // Check if this table already has a price header
            if (table.querySelector('.better-yasir-price-header')) {
              return;
            }
            
            // Find the table header row
            const thead = table.querySelector('thead');
            if (thead) {
              const headerRow = thead.querySelector('tr');
              if (headerRow) {
                // Check if the header already spans 2 columns (colspan="2")
                const existingHeader = headerRow.querySelector('th');
                if (existingHeader && existingHeader.getAttribute('colspan') === '2') {
                  // Keep the original section title (Selling/Buying) instead of changing to "Item"
                  const originalText = existingHeader.textContent;
                  existingHeader.removeAttribute('colspan');
                  // Don't change the text - keep it as "Selling" or "Buying"
                  
                  // Add price column header
                  const priceHeader = document.createElement('th');
                  priceHeader.textContent = t('mods.betterYasir.price');
                  priceHeader.className = 'bg-grayRegular px-1 font-normal first:table-frame-bottom [&:not(:first-child)]:table-frame-bottom-left text-left better-yasir-price-header';
                  priceHeader.style.textAlign = 'center';
                  headerRow.appendChild(priceHeader);
                }
              }
            }
          });
        } catch (e) {
          console.log('[Better Yasir] Error adding price headers:', e);
        }
      }
      
      /** Yasir shop `.widget-bottom` — never use the first `.widget-bottom` in the document (toasts/quests use it too). */
      function getYasirShopWidgetBottomHost(preferred = null) {
        if (preferred?.classList?.contains('widget-bottom') && preferred.querySelector('table')) {
          return preferred;
        }
        const enhanced = document.querySelector('.widget-bottom[data-better-yasir-enhanced]');
        if (enhanced?.querySelector('table')) return enhanced;
        const found = domUtils.findYasirModal();
        if (found?.classList?.contains('widget-bottom') && found.querySelector('table')) {
          return found;
        }
        return null;
      }
      
      /** Coalesce rapid ensure calls (React refresh + mutation + our timeouts) into one paint — reduces post-buy flash. */
      let ensureYasirIntroRafId = null;
      function scheduleEnsureYasirTooltipStructure(modal = null) {
        if (ensureYasirIntroRafId != null) {
          cancelAnimationFrame(ensureYasirIntroRafId);
        }
        ensureYasirIntroRafId = requestAnimationFrame(() => {
          ensureYasirIntroRafId = null;
          ensureYasirTooltipStructure(modal);
        });
      }
      
      function ensureYasirTooltipStructure(modal = null) {
        try {
          const host = getYasirShopWidgetBottomHost(modal);
          if (!host) return null;
          
          const introGrid = host.querySelector('div.grid.gap-3');
          if (!introGrid) return null;
          if (introGrid.querySelector('table')) return null;
          const introTooltip = introGrid.querySelector('.tooltip-prose');
          if (introTooltip) return introTooltip;
          
          const activatedText = t('mods.betterYasir.activated');
          const fullText = (introGrid.textContent || '').replace(/\s+/g, ' ').trim();
          if (!fullText) return null;
          
          let bodyText = fullText;
          if (fullText.includes(activatedText)) {
            bodyText = fullText.replace(activatedText, '').trim();
          }
          // Ignore transient success/result lines from the base UI; prefer last safe text we showed.
          if (/successfully\s+(purchased|traded|sold)\b/i.test(bodyText)) {
            bodyText = lastYasirTooltipBodyText || '';
          }
          if (!bodyText) {
            bodyText = "Greetings, mate! Sorry I didn't bring many products this time around.";
          }
          lastYasirTooltipBodyText = bodyText;
          
          const slotWrap = document.createElement('div');
          slotWrap.className = 'container-slot surface-darker grid h-full place-items-center overflow-hidden px-4 py-2';
          const yasirImg = document.createElement('img');
          yasirImg.alt = 'Yasir';
          yasirImg.className = 'pixelated';
          yasirImg.width = 68;
          yasirImg.height = 74;
          yasirImg.src = '/assets/icons/yasir.png';
          slotWrap.appendChild(yasirImg);
          
          const tooltip = document.createElement('div');
          tooltip.className = 'tooltip-prose pixel-font-16 frame-pressed-1 surface-dark flex w-full flex-col gap-1 p-2 text-whiteRegular';
          
          const titleP = document.createElement('p');
          titleP.className = 'inline text-monster';
          titleP.style.color = '#32cd32';
          titleP.textContent = activatedText;
          
          const bodyP = document.createElement('p');
          bodyP.className = 'inline';
          bodyP.textContent = bodyText;
          tooltip.dataset.betterYasirDefaultText = bodyText;
          
          tooltip.appendChild(titleP);
          tooltip.appendChild(bodyP);
          // Single DOM update avoids a blank frame from clearing before appending
          introGrid.replaceChildren(slotWrap, tooltip);
          
          return tooltip;
        } catch (e) {
          return null;
        }
      }
      
      // Utility to transform Yasir tooltip title to activation text
      function transformYasirTooltip() {
        try {
          const tooltip = ensureYasirTooltipStructure() || document.querySelector('.tooltip-prose');
          if (!tooltip) return;
          const titleElem = tooltip.querySelector('p'); // first <p> is title
          const activatedText = t('mods.betterYasir.activated');
          if (titleElem && titleElem.textContent.includes("Yasir") && titleElem.textContent !== activatedText) {
            titleElem.textContent = activatedText;
            titleElem.style.color = '#32cd32';
          }
        } catch (e) { /* silent */ }
      }
    
      // Clear DOM / item-key caches (game state is read fresh each call; no snapshot TTL cache).
      function clearCaches() {
        clearDomCache();
        itemKeyCache = new WeakMap();
      }
      
      // Clean up event listeners for better memory management
      function cleanupEventListeners() {
        const inputs = document.querySelectorAll('.better-yasir-quantity-input');
        inputs.forEach(input => {
          if (input._betterYasirInputHandler) {
            input.removeEventListener('input', input._betterYasirInputHandler);
            delete input._betterYasirInputHandler;
          }
          if (input.dataset.betterYasirInputHandler) {
            delete input.dataset.betterYasirInputHandler;
          }
        });
        
        const buttons = document.querySelectorAll('.better-yasir-action-button');
        buttons.forEach(button => {
          if (button._betterYasirButtonHandler) {
            button.removeEventListener('click', button._betterYasirButtonHandler);
            delete button._betterYasirButtonHandler;
          }
          if (button.dataset.betterYasirButtonHandler) {
            delete button.dataset.betterYasirButtonHandler;
          }
        });
      }
    
      // API request deduplication
      const pendingRequests = new Map();
      const REQUEST_TIMEOUT = 10000; // 10 seconds timeout
      
      // Request deduplication helper
      function deduplicateRequest(requestKey, requestFn) {
        // Check if there's already a pending request for this key
        if (pendingRequests.has(requestKey)) {
          const pending = pendingRequests.get(requestKey);
          if (Date.now() - pending.timestamp < REQUEST_TIMEOUT) {
            return pending.promise;
          } else {
            // Request timed out, remove it
            pendingRequests.delete(requestKey);
          }
        }
        
        // Create new request
        const promise = requestFn();
        pendingRequests.set(requestKey, {
          promise,
          timestamp: Date.now()
        });
        
        // Clean up when request completes
        promise.finally(() => {
          pendingRequests.delete(requestKey);
        });
        
        return promise;
      }
      
      // Batch state update helper
      const stateUpdateQueue = new Map();
      let stateUpdateTimeout = null;
      
      function queueStateUpdate(updates) {
        // Merge updates into queue
        Object.entries(updates).forEach(([key, value]) => {
          stateUpdateQueue.set(key, value);
        });
        
        // Schedule batch update if not already scheduled
        if (!stateUpdateTimeout) {
          stateUpdateTimeout = setTimeout(() => {
            flushStateUpdates();
          }, 50); // Batch updates every 50ms
        }
      }
      
      function flushStateUpdates() {
        if (stateUpdateQueue.size === 0) return;
        
        try {
          const player = globalThis.state?.player;
          if (!player) {
            console.warn('[Better Yasir] Player state not available for batch update');
            return;
          }
          
          const updates = Object.fromEntries(stateUpdateQueue);
          
          player.send({
            type: 'setState',
            fn: (prev) => {
              const newState = { ...prev };
              // Ensure nested inventory exists
              newState.inventory = { ...prev.inventory };
              
              Object.entries(updates).forEach(([itemKey, change]) => {
                if (change === 0) return;
                
                // Handle dust separately from inventory items
                if (itemKey === 'dust') {
                  newState.dust = Math.max(0, (newState.dust || 0) + change);
                  return;
                }
                
                // Handle gold separately from inventory items
                if (itemKey === 'gold') {
                  newState.gold = Math.max(0, (newState.gold || 0) + change);
                  return;
                }
                
                // Handle inventory items
                if (!newState.inventory[itemKey]) newState.inventory[itemKey] = 0;
                newState.inventory[itemKey] = Math.max(0, newState.inventory[itemKey] + change);
                // Mirror on root for compatibility
                newState[itemKey] = newState.inventory[itemKey];
              });
              
              return newState;
            }
          });
          
          // Force UI refresh after state update with a longer delay to ensure state propagation
          setTimeout(() => {
            // Clear caches first to force fresh data
            clearCaches();
            refreshUIAfterAction();
          }, 200);
          
          // Also try an immediate update for the specific item that was just changed
          const pendingUpdates = Object.fromEntries(stateUpdateQueue);
          if (pendingUpdates.insightStone5 !== undefined) {
            setTimeout(() => {
              // Update quantity display
              const modal = document.querySelector('.widget-bottom');
              if (modal) {
                const insightStoneSlot = modal.querySelector('.container-slot[data-item-key="insightStone5"]');
                if (insightStoneSlot) {
                  const quantitySpan = insightStoneSlot.querySelector('.revert-pixel-font-spacing span');
                  if (quantitySpan) {
                    // Calculate the new quantity based on the pending update (use raw value when we use abbreviated display)
                    const currentQuantity = parseInt(quantitySpan.dataset.rawQuantity || quantitySpan.textContent.replace(/[^\d]/g, ''), 10) || 0;
                    const change = pendingUpdates.insightStone5 || 0;
                    const newQuantity = Math.max(0, currentQuantity + change);
                    setQuantitySpanDisplay(quantitySpan, newQuantity);
                  }
                }
              }
              
              // Also update input max values immediately
              refreshUIAfterAction();
            }, 50);
          }
          
          // Immediate gold update if gold changed
          if (pendingUpdates.gold !== undefined) {
            setTimeout(() => {
              // Get fresh gold amount and update displays immediately
              const currentGold = getPlayerGold();
              const currentDust = getPlayerDust();
              updateResourceDisplays(currentGold, currentDust);
            }, 25);
          }
          
        } catch (error) {
          handleError(error, 'Failed to batch update state');
        } finally {
          stateUpdateQueue.clear();
          stateUpdateTimeout = null;
        }
      }
    
      // Debounced function for processing mutations
      function debouncedProcessMutations(mutations) {
        // Quick check: if no Yasir-related content, skip processing entirely
        const hasYasirContent = mutations.some(mutation => 
          mutation.addedNodes.length > 0 && 
          Array.from(mutation.addedNodes).some(node => 
            node.nodeType === Node.ELEMENT_NODE && 
            (node.textContent?.includes('Yasir') || 
             node.querySelector?.('*') && 
             Array.from(node.querySelectorAll('*')).some(el => 
               el.textContent?.includes('Yasir')
             ))
          )
        );
        
        if (!hasYasirContent) return;
        
        if (observerTimeout) {
          clearTimeout(observerTimeout);
        }
        
        observerTimeout = setTimeout(() => {
          // Always attempt tooltip transform
          transformYasirTooltip();
          scheduleEnsureYasirTooltipStructure();
          
          // Only process if we're not currently in a UI refresh cycle
          if (!document.body.dataset.betterYasirRefreshing) {
            // Run enhance BEFORE addQuantityInputsToFlexContainers: that path calls
            // updateSectionTitles() which rewrites "Current stock" -> "Buy" etc., and would
            // break enhanceYasirModal() detection on the same tick.
            const existingModal = document.querySelector(`${SELECTORS.YASIR_MODAL}[data-better-yasir-enhanced]`);
            if (!existingModal) {
              clearCaches();
              const widgetBottoms = document.querySelectorAll(SELECTORS.YASIR_MODAL);
              for (const widget of widgetBottoms) {
                if (widget.querySelector('table') && !widget.dataset.betterYasirEnhanced) {
                  console.log('[Better Yasir]', 'mutation: running enhanceYasirModal before flex/quantity pass');
                  // Do not set betterYasirProcessing here — enhanceYasirModal sets it on the modal it
                  // resolves; pre-setting it caused an immediate return false (same node).
                  enhanceYasirModal(widget);
                  break;
                }
              }
            } else {
              console.log('[Better Yasir]', 'mutation: Yasir modal already enhanced, skipping enhance pass');
            }
            
            const flexContainers = document.querySelectorAll('div.flex.items-center.gap-1\\.5.dithered.px-1, div.flex.items-center.gap-1\\.5');
            if (flexContainers.length > 0) {
              addQuantityInputsToFlexContainers();
            }
          }
        }, CONSTANTS.DEBOUNCE_DELAY);
      }
      
      function setupYasirIntroSyncObserver() {
        if (yasirIntroSyncObserver) return;
        yasirIntroSyncObserver = new MutationObserver((mutations) => {
          const enhanced = document.querySelector('.widget-bottom[data-better-yasir-enhanced]');
          if (!enhanced) return;
          const intro = enhanced.querySelector('div.grid.gap-3');
          if (!intro || intro.querySelector('.tooltip-prose')) return;
          
          for (let i = 0; i < mutations.length; i++) {
            const m = mutations[i];
            if (m.type !== 'childList') continue;
            const t = m.target;
            if (
              t === enhanced ||
              t === intro ||
              (t.nodeType === Node.ELEMENT_NODE && intro.contains(t))
            ) {
              ensureYasirTooltipStructure(enhanced);
              return;
            }
          }
        });
        yasirIntroSyncObserver.observe(document.body, { childList: true, subtree: true });
      }
      
      // Retry mechanism for modal enhancement
      function retryEnhanceYasirModal(maxAttempts = CONSTANTS.RETRY_MAX_ATTEMPTS, baseDelay = CONSTANTS.RETRY_BASE_DELAY) {
        let attempts = 0;
        
        const tryEnhance = () => {
          attempts++;
          if (enhanceYasirModal()) {
            return; // Success, stop retrying
          }
          
          if (attempts < maxAttempts) {
            const delay = baseDelay * Math.pow(2, attempts - 1); // Exponential backoff
            setTimeout(tryEnhance, delay);
          } else {
            console.warn('[Better Yasir] Failed to enhance modal after maximum retry attempts');
          }
        };
        
        tryEnhance();
      }
      
      function initializeBetterYasir() {
        runYasirPoHistoryCommaMigrationOnce();

        // Set up observer to watch for DOM changes
        observer = new MutationObserver(debouncedProcessMutations);
        
        // Start observing
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        
        setupYasirIntroSyncObserver();
        
        // Run initial tooltip transform
        transformYasirTooltip();
    
        // Check for flex containers on startup
        addQuantityInputsToFlexContainers();
    
        // Don't try to enhance modal on startup - wait for it to be opened
        // The MutationObserver will handle detecting when the modal is actually opened
        
        setupYasirDailyPurchaseOrderWatch();
        setTimeout(() => {
          maybeSchedulePoFulfillmentFromDailyUpdate('mod init (after state hydrate)');
        }, 750);
      }
      
      function cleanup() {
        if (ensureYasirIntroRafId != null) {
          cancelAnimationFrame(ensureYasirIntroRafId);
          ensureYasirIntroRafId = null;
        }
        teardownBetterYasirUi();
        yasirPoOrderPlacementGraceUntil = 0;
        
        // Cleanup all event listeners
        cleanupAllEventListeners();
        
        // Cleanup confirmation handler
        cleanupConfirmationHandler();
        
        // Cleanup observers and timeouts
        cleanupObservers();
        cleanupYasirDailyPoWatch();
        
        // Cleanup state update timeout
        if (stateUpdateTimeout) {
          clearTimeout(stateUpdateTimeout);
          stateUpdateTimeout = null;
        }
        
        // Flush any pending state updates
        flushStateUpdates();
        
        // Clear pending requests
        pendingRequests.clear();
        
        // Remove styles
        const styleElement = document.getElementById('better-yasir-styles');
        if (styleElement) {
          styleElement.remove();
        }
        
        // Remove enhanced markers
        document.querySelectorAll('[data-better-yasir-enhanced]').forEach(element => {
          delete element.dataset.betterYasirEnhanced;
        });
        
        // Remove table processing markers
        document.querySelectorAll('[data-better-yasir-table-processed]').forEach(element => {
          delete element.dataset.betterYasirTableProcessed;
        });
        
        // Remove modal processing markers
        document.querySelectorAll('[data-better-yasir-processing]').forEach(element => {
          delete element.dataset.betterYasirProcessing;
        });
        
        // Remove quantity inputs and custom buttons
        document.querySelectorAll('.better-yasir-quantity-input, .better-yasir-action-button').forEach(element => {
          element.remove();
        });
        
        // Show original buttons that were hidden
        document.querySelectorAll('button[style*="display: none"]').forEach(button => {
          if (button.parentNode.querySelector('.better-yasir-action-button')) {
            button.style.display = '';
          }
        });
      }
      
      // Initialize the mod
      console.log('[Better Yasir] initializing...');
      initializeBetterYasir();
      
      // Export cleanup function for the mod loader
      if (typeof context !== 'undefined') {
        context.exports = {
          cleanup: cleanup,
          refreshUI: refreshUIAfterAction,
          debugInventory: () => {
            const gameState = getGameState();
            console.log('[Better Yasir] Current inventory:', gameState?.playerState?.inventory);
            console.log('[Better Yasir] insightStone5 quantity:', gameState?.playerState?.inventory?.insightStone5);
          },
          fixInputMax: () => {
            const gameState = getGameState();
            const currentQuantity = gameState?.playerState?.inventory?.insightStone5 || 0;
            console.log('[Better Yasir] Fixing input max for insightStone5, current quantity:', currentQuantity);
            
            const inputs = document.querySelectorAll('.better-yasir-quantity-input');
            inputs.forEach((input, index) => {
              const container = input.closest('div.flex.items-center.gap-1\\.5');
              if (container) {
                const itemSlot = container.querySelector('.container-slot');
                if (itemSlot) {
                  const itemKey = getItemKeyFromSlot(itemSlot);
                  if (itemKey === 'insightStone5') {
                    console.log(`[Better Yasir] Found insightStone5 input ${index}, updating max from ${input.max} to ${currentQuantity}`);
                    input.max = currentQuantity;
                    const currentValue = parseInt(input.value) || 1;
                    const newValue = Math.min(currentValue, Math.max(1, currentQuantity));
                    input.value = newValue.toString();
                    console.log(`[Better Yasir] Updated input value from ${currentValue} to ${newValue}`);
                  }
                }
              }
            });
          }
        };
      }
      
    })();

    