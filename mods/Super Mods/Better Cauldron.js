// Better Cauldron Mod
// This mod enhances the native cauldron table with search and filter functionality

(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        MOD_NAME: 'Better Cauldron',
        DEBUG: true
    };
    
    // State management
    let cauldronState = {
        isInitialized: false,
        currentFilter: 'all',
        controlsAdded: false,
        originalRows: []
    };
    
    // Memory leak prevention
    let mainObserver = null;
    let closeObserver = null;
    let eventListeners = new Map();
    
    // Utility functions
    function log(message, ...args) {
        if (CONFIG.DEBUG) {
            console.log(`[${CONFIG.MOD_NAME}]`, message, ...args);
        }
    }
    
    // Main functionality
    function initializeCauldronUpgrade() {
        if (cauldronState.isInitialized) {
            return;
        }
        
        log('Initializing Better Cauldron mod...');
        
        // Set up mutation observer to watch for cauldron modal opening
        mainObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if this is a cauldron modal
                        if (isCauldronModal(node)) {
                            log('Cauldron modal detected, adding controls...');
                            setTimeout(() => enhanceCauldronTable(node), 200);
                        }
                    }
                });
            });
        });
        
        mainObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        cauldronState.isInitialized = true;
        log('Better Cauldron mod initialized successfully');
    }
    
    function isCauldronModal(element) {
        // Check if this element or its children contain the cauldron modal
        const titleEl = element.querySelector && element.querySelector('h2');
        const title = titleEl ? titleEl.textContent.trim() : '';
        const hasCauldronTitle = title === 'Monstrous Cauldron' ||
            title === 'Monstruous Cauldron' ||
            title === 'Caldeirão de Monstros';
        
        const hasCauldronText = element.textContent && 
            (element.textContent.includes('All sold creatures go to the cauldron') ||
             element.textContent.includes('Todas as criaturas vendidas vão para o caldeirão') ||
             element.textContent.includes('In the end, every thing goes to the cauldron'));
        
        return hasCauldronTitle || hasCauldronText;
    }
    
    function enhanceCauldronTable(modalElement) {
        try {
            // Prevent duplicate enhancement
            if (cauldronState.controlsAdded) {
                log('Controls already added, skipping...');
                return;
            }
            
            const contentContainer = modalElement.querySelector('.widget-bottom');
            if (!contentContainer) {
                log('Content container not found');
                return;
            }
            
            // Check if controls already exist (equipment controls indicate both tabs were enhanced)
            if (contentContainer.querySelector('#cauldron-search-equip')) {
                log('Controls already exist in this modal');
                return;
            }
            
            // Update tooltip title to indicate Better Cauldron (green like "Better Yasir activated!")
            const tooltipTitle = modalElement.querySelector('.tooltip-prose p.text-monster');
            if (tooltipTitle) {
                tooltipTitle.textContent = 'Better Cauldron activated!';
                tooltipTitle.classList.add('inline');
                tooltipTitle.style.color = 'rgb(50, 205, 50)';
            }
            
            const tabPanels = contentContainer.querySelectorAll('[role="tabpanel"]');
            let creaturesTabPanel = null;
            let creaturesTable = null;
            let equipTabPanel = null;
            let equipTable = null;
            
            for (const panel of tabPanels) {
                const table = panel.querySelector('table');
                if (!table) continue;
                const isEquipment = table.querySelector('.equipment-portrait');
                if (isEquipment) {
                    equipTabPanel = panel;
                    equipTable = table;
                } else {
                    creaturesTabPanel = panel;
                    creaturesTable = table;
                }
            }
            
            // Fallback: single table (old layout or only one tab has content)
            if (!creaturesTable && !equipTable) {
                const nativeTable = contentContainer.querySelector('table');
                if (nativeTable) {
                    creaturesTable = nativeTable;
                    creaturesTabPanel = nativeTable.closest('[role="tabpanel"]');
                }
            }
            
            if (creaturesTable) {
                log('Adding controls to Creatures tab...');
                const tbody = creaturesTable.querySelector('tbody');
                if (tbody) {
                    cauldronState.originalRows = Array.from(tbody.querySelectorAll('tr'));
                }
                const controlsContainer = createControls('creatures');
                if (creaturesTabPanel && creaturesTabPanel.firstElementChild) {
                    creaturesTabPanel.insertBefore(controlsContainer, creaturesTabPanel.firstElementChild);
                } else {
                    const scrollArea = contentContainer.querySelector('[data-radix-scroll-area-viewport]');
                    if (scrollArea) {
                        scrollArea.parentNode.parentNode.insertBefore(controlsContainer, scrollArea.parentNode);
                    } else {
                        creaturesTable.parentNode.insertBefore(controlsContainer, creaturesTable);
                    }
                }
                setupTabEventListeners('creatures', controlsContainer, creaturesTable, creaturesTabPanel);
            }
            
            if (equipTable && equipTabPanel) {
                log('Adding controls to Equipments tab...');
                const equipControls = createControls('equipment');
                equipTabPanel.insertBefore(equipControls, equipTabPanel.firstElementChild);
                setupTabEventListeners('equipment', equipControls, equipTable, equipTabPanel);
            } else if (tabPanels.length >= 2) {
                // Equipments tab may be lazy-rendered when user switches to it; observe for table
                const otherPanel = Array.from(tabPanels).find(p => p !== creaturesTabPanel);
                if (otherPanel && !otherPanel.querySelector('#cauldron-search-equip')) {
                    const tryAddEquipControls = () => {
                        const table = otherPanel.querySelector('table');
                        if (!table || !table.querySelector('.equipment-portrait')) return false;
                        if (otherPanel.querySelector('#cauldron-search-equip')) return true;
                        log('Adding controls to Equipments tab...');
                        const equipControls = createControls('equipment');
                        otherPanel.insertBefore(equipControls, otherPanel.firstElementChild);
                        setupTabEventListeners('equipment', equipControls, table, otherPanel);
                        return true;
                    };
                    if (!tryAddEquipControls()) {
                        const equipObserver = new MutationObserver(() => {
                            if (tryAddEquipControls()) {
                                equipObserver.disconnect();
                                eventListeners.delete('equip-lazy-observer');
                            }
                        });
                        equipObserver.observe(otherPanel, { childList: true, subtree: true });
                        eventListeners.set('equip-lazy-observer', { observer: equipObserver, disconnect: () => equipObserver.disconnect() });
                    }
                }
            }
            
            cauldronState.controlsAdded = true;
            log('Cauldron table(s) enhanced successfully');
            
        } catch (error) {
            log('Error enhancing cauldron table:', error);
        }
    }
    
    // Shared tier options (both creatures and equipment filter by tier)
    const TIER_OPTIONS = [
        { value: '1', text: 'Grey' },
        { value: '2', text: 'Green' },
        { value: '3', text: 'Blue' },
        { value: '4', text: 'Purple' },
        { value: '5', text: 'Yellow' }
    ];

    const TAB_CONFIG = {
        creatures: {
            searchId: 'cauldron-search',
            filterId: 'cauldron-filter-select',
            placeholder: 'Search monsters...',
            allLabel: 'All Monsters',
            eventKeyPrefix: 'creatures'
        },
        equipment: {
            searchId: 'cauldron-search-equip',
            filterId: 'cauldron-filter-equip',
            placeholder: 'Search equipment...',
            allLabel: 'All Tiers',
            eventKeyPrefix: 'equip'
        }
    };

    function createControls(type) {
        const config = TAB_CONFIG[type];
        const filterOptions = [{ value: 'all', text: config.allLabel }, ...TIER_OPTIONS];
        
        const container = document.createElement('div');
        container.className = 'cauldron-controls';
        container.style.cssText = `
            display: flex;
            gap: 16px;
            padding: 8px 12px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            align-items: center;
            margin: 8px 0;
            font-family: inherit;
        `;
        
        const searchContainer = document.createElement('div');
        searchContainer.style.cssText = 'display: flex; align-items: center; flex: 1;';
        
        const searchInput = document.createElement('input');
        searchInput.id = config.searchId;
        searchInput.placeholder = config.placeholder;
        searchInput.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 14px;
            flex: 1;
            font-family: inherit;
            outline: none;
        `;
        
        searchInput.addEventListener('focus', () => {
            searchInput.style.borderColor = 'rgba(255, 255, 255, 0.4)';
        });
        searchInput.addEventListener('blur', () => {
            searchInput.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        });
        
        searchContainer.appendChild(searchInput);
        
        const filterContainer = document.createElement('div');
        filterContainer.style.cssText = 'display: flex; align-items: center;';
        
        const filterSelect = document.createElement('select');
        filterSelect.id = config.filterId;
        filterSelect.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 14px;
            font-family: inherit;
            outline: none;
            cursor: pointer;
            min-width: 120px;
        `;
        
        filterOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            optionElement.style.cssText = 'background: #333; color: #fff;';
            filterSelect.appendChild(optionElement);
        });
        
        filterContainer.appendChild(filterSelect);
        container.appendChild(searchContainer);
        container.appendChild(filterContainer);
        
        return container;
    }
    
    function isTabActive(tabPanel) {
        if (!tabPanel) return true;
        return tabPanel.getAttribute('data-state') === 'active' && !tabPanel.hasAttribute('hidden');
    }
    
    function setupTabEventListeners(type, controlsContainer, table, tabPanel) {
        const config = TAB_CONFIG[type];
        const searchInput = controlsContainer.querySelector('#' + config.searchId);
        const filterSelect = controlsContainer.querySelector('#' + config.filterId);
        if (!searchInput || !filterSelect) return;

        const applyIfActive = () => {
            if (isTabActive(tabPanel)) {
                applyTabFiltering(type, table, tabPanel);
            }
        };

        searchInput.addEventListener('input', applyIfActive);
        eventListeners.set('search-input-' + config.eventKeyPrefix, { element: searchInput, event: 'input', handler: applyIfActive });

        const filterHandler = () => {
            if (type === 'creatures') cauldronState.currentFilter = filterSelect.value;
            applyIfActive();
        };
        filterSelect.addEventListener('change', filterHandler);
        eventListeners.set('filter-select-' + config.eventKeyPrefix, { element: filterSelect, event: 'change', handler: filterHandler });

        if (tabPanel) {
            const tabObserver = new MutationObserver(() => {
                if (isTabActive(tabPanel)) {
                    applyTabFiltering(type, table, tabPanel);
                }
            });
            tabObserver.observe(tabPanel, {
                attributes: true,
                attributeFilter: ['data-state', 'hidden']
            });
            eventListeners.set('tab-observer-' + config.eventKeyPrefix, { observer: tabObserver, disconnect: () => tabObserver.disconnect() });
        }

        setTimeout(applyIfActive, 100);
    }
    
    function getRowTier(row, type) {
        const selector = type === 'equipment' ? '.equipment-portrait .has-rarity' : '.has-rarity';
        const el = row.querySelector(selector);
        return el ? (el.getAttribute('data-rarity') || '1') : '1';
    }

    // Equipment: ad -> attack damage, ap -> ability power, hp -> heal (from stat icon src)
    const STAT_SEARCH_MAP = { ad: 'attackdamage', ap: 'abilitypower', hp: 'heal' };

    function getEquipmentStatType(row) {
        const icon = row.querySelector('.equipment-portrait img[alt="stat type"]');
        if (!icon || !icon.src) return '';
        const match = icon.src.match(/\/([^/]+)\.png$/);
        return match ? match[1].toLowerCase() : '';
    }

    function parseEquipmentSearch(searchValue) {
        const trimmed = searchValue.trim().toLowerCase();
        for (const [short, stat] of Object.entries(STAT_SEARCH_MAP)) {
            if (trimmed === short) {
                return { statFilter: stat, nameSearch: '' };
            }
            if (trimmed.startsWith(short + ' ')) {
                return { statFilter: stat, nameSearch: trimmed.slice(short.length).trim() };
            }
        }
        return { statFilter: null, nameSearch: trimmed };
    }

    function applyTabFiltering(type, table, tabPanel) {
        if (tabPanel && !isTabActive(tabPanel)) return;

        const config = TAB_CONFIG[type];
        const searchInput = document.querySelector('#' + config.searchId);
        const filterSelect = document.querySelector('#' + config.filterId);
        if (!searchInput || !filterSelect) return;

        const currentTable = tabPanel ? tabPanel.querySelector('table') : table;
        const tableToUse = currentTable || table;
        const tbody = tableToUse.querySelector('tbody');
        if (!tbody) return;

        const searchValue = searchInput.value.toLowerCase();
        const filterValue = filterSelect.value;
        const rows = Array.from(tbody.querySelectorAll('tr'));

        // Creatures: sort by shiny then tier when showing all
        if (type === 'creatures' && filterValue === 'all') {
            rows.sort((a, b) => {
                const isShiny = (row) => {
                    const img = row.querySelector('img');
                    return img && img.src.includes('-shiny.png') ? 1 : 0;
                };
                const getRarity = (row) => parseInt(getRowTier(row, 'creatures')) || 1;
                const shinyDiff = isShiny(b) - isShiny(a);
                if (shinyDiff !== 0) return shinyDiff;
                return getRarity(b) - getRarity(a);
            });
            rows.forEach(row => tbody.appendChild(row));
        }

        // Equipment: sort by tier when "All Tiers" is selected (same as creatures default)
        if (type === 'equipment' && filterValue === 'all') {
            rows.sort((a, b) => {
                const getRarity = (row) => parseInt(getRowTier(row, 'equipment')) || 1;
                return getRarity(b) - getRarity(a);
            });
            rows.forEach(row => tbody.appendChild(row));
        }

        const equipmentSearch = type === 'equipment' ? parseEquipmentSearch(searchValue) : null;

        rows.forEach(row => {
            const nameCell = row.querySelector('p.text-whiteHighlight');
            const name = nameCell ? nameCell.textContent.toLowerCase() : '';
            const tier = getRowTier(row, type);
            let show = true;
            if (type === 'equipment' && equipmentSearch) {
                if (equipmentSearch.statFilter !== null) {
                    const rowStat = getEquipmentStatType(row);
                    if (rowStat !== equipmentSearch.statFilter) show = false;
                }
                if (show && equipmentSearch.nameSearch && !name.includes(equipmentSearch.nameSearch)) show = false;
            } else if (searchValue && !name.includes(searchValue)) {
                show = false;
            }
            if (filterValue !== 'all' && tier !== filterValue) show = false;
            row.style.display = show ? 'table-row' : 'none';
        });

        log('Applied ' + type + ' filtering:', { searchValue, filterValue, visibleRows: rows.filter(r => r.style.display !== 'none').length });
    }
    
    function cleanupEventListeners() {
        eventListeners.forEach((listener) => {
            try {
                if (listener.observer) {
                    if (listener.disconnect) listener.disconnect();
                    else if (listener.observer.disconnect) listener.observer.disconnect();
                } else if (listener.element && listener.handler) {
                    listener.element.removeEventListener(listener.event, listener.handler);
                }
            } catch (error) {
                log('Error removing event listener:', error);
            }
        });
        eventListeners.clear();
    }

    // Reset state when modal closes
    function resetState() {
        cauldronState.controlsAdded = false;
        cauldronState.originalRows = [];
        cleanupEventListeners();
        log('State reset');
    }

    // Complete cleanup function
    function cleanup() {
        log('Cleaning up Better Cauldron mod...');
        if (mainObserver) {
            mainObserver.disconnect();
            mainObserver = null;
        }
        if (closeObserver) {
            closeObserver.disconnect();
            closeObserver = null;
        }
        cleanupEventListeners();
        cauldronState.isInitialized = false;
        cauldronState.controlsAdded = false;
        cauldronState.originalRows = [];
        if (window.CauldronUpgrade) {
            delete window.CauldronUpgrade;
        }
        log('Better Cauldron mod cleaned up successfully');
    }
    
    // Watch for modal closing
    closeObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.removedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE && isCauldronModal(node)) {
                    log('Cauldron modal closed, resetting state');
                    resetState();
                }
            });
        });
    });
    
    closeObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Initialize the mod when the page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeCauldronUpgrade);
    } else {
        initializeCauldronUpgrade();
    }
    
    // Export for potential external access
    window.CauldronUpgrade = {
        initialize: initializeCauldronUpgrade,
        config: CONFIG,
        state: cauldronState,
        reset: resetState,
        cleanup: cleanup
    };
    
    // Export cleanup function for mod loader
    exports = {
        cleanup: cleanup,
        reset: resetState,
        initialize: initializeCauldronUpgrade
    };
    
    log('Better Cauldron mod loaded successfully');
    
})();

