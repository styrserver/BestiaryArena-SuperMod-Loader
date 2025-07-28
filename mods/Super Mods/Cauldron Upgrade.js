// Cauldron Upgrade Mod
// This mod enhances the native cauldron table with search and filter functionality

(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        MOD_NAME: 'Cauldron Upgrade',
        DEBUG: true
    };
    
    // State management
    let cauldronState = {
        isInitialized: false,
        currentFilter: 'all',
        controlsAdded: false,
        originalRows: []
    };
    
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
        
        log('Initializing Cauldron Upgrade mod...');
        
        // Set up mutation observer to watch for cauldron modal opening
        const observer = new MutationObserver((mutations) => {
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
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        cauldronState.isInitialized = true;
        log('Cauldron Upgrade mod initialized successfully');
    }
    
    function isCauldronModal(element) {
        // Check if this element or its children contain the cauldron modal
        const hasCauldronTitle = element.querySelector && 
            element.querySelector('h2') && 
            element.querySelector('h2').textContent === 'Monster Cauldron';
        
        const hasCauldronText = element.textContent && 
            element.textContent.includes('All sold creatures go to the cauldron');
        
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
            
            // Check if controls already exist
            if (contentContainer.querySelector('.cauldron-controls')) {
                log('Controls already exist in this modal');
                return;
            }
            
            // Find the native table
            const nativeTable = contentContainer.querySelector('table');
            if (!nativeTable) {
                log('Native table not found');
                return;
            }
            
            log('Found native table, adding controls...');
            
            // Store original rows for filtering
            const tbody = nativeTable.querySelector('tbody');
            if (tbody) {
                cauldronState.originalRows = Array.from(tbody.querySelectorAll('tr'));
            }
            
            // Create controls
            const controlsContainer = createControls();
            
            // Insert controls before the scrollable area
            const scrollArea = contentContainer.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollArea) {
                // Insert before the scroll area container
                scrollArea.parentNode.parentNode.insertBefore(controlsContainer, scrollArea.parentNode);
            } else {
                // Fallback: insert before the table
                nativeTable.parentNode.insertBefore(controlsContainer, nativeTable);
            }
            
            // Set up event listeners
            setupEventListeners(controlsContainer, nativeTable);
            
            cauldronState.controlsAdded = true;
            log('Cauldron table enhanced successfully');
            
        } catch (error) {
            log('Error enhancing cauldron table:', error);
        }
    }
    
    function createControls() {
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
        
        // Search input
        const searchContainer = document.createElement('div');
        searchContainer.style.cssText = 'display: flex; align-items: center; flex: 1;';
        
        const searchInput = document.createElement('input');
        searchInput.id = 'cauldron-search';
        searchInput.placeholder = 'Search monsters...';
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
        
        // Filter dropdown
        const filterContainer = document.createElement('div');
        filterContainer.style.cssText = 'display: flex; align-items: center;';
        
        const filterSelect = document.createElement('select');
        filterSelect.id = 'cauldron-filter-select';
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
        
        const filterOptions = [
            { value: 'all', text: 'All Monsters' },
            { value: '1', text: 'Grey' },
            { value: '2', text: 'Green' },
            { value: '3', text: 'Blue' },
            { value: '4', text: 'Purple' },
            { value: '5', text: 'Yellow' }
        ];
        
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
    
    function setupEventListeners(controlsContainer, table) {
        const searchInput = controlsContainer.querySelector('#cauldron-search');
        const filterSelect = controlsContainer.querySelector('#cauldron-filter-select');
        
        // Search functionality
        searchInput.addEventListener('input', () => {
            applyFiltering(table);
        });
        
        // Filter functionality
        filterSelect.addEventListener('change', () => {
            cauldronState.currentFilter = filterSelect.value;
            applyFiltering(table);
        });
        
        // Initial application
        setTimeout(() => applyFiltering(table), 100);
    }
    
    function applyFiltering(table) {
        const searchInput = document.querySelector('#cauldron-search');
        const filterSelect = document.querySelector('#cauldron-filter-select');
        
        if (!searchInput || !filterSelect) return;
        
        const searchValue = searchInput.value.toLowerCase();
        const filterValue = filterSelect.value;
        
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        
        const rows = tbody.querySelectorAll('tr');
        
        rows.forEach(row => {
            const nameCell = row.querySelector('p.text-whiteHighlight');
            const name = nameCell ? nameCell.textContent.toLowerCase() : '';
            
            let show = true;
            
            // Apply search filter
            if (searchValue && !name.includes(searchValue)) {
                show = false;
            }
            
            // Apply rarity filter
            if (filterValue !== 'all') {
                const rarityElement = row.querySelector('.has-rarity');
                if (rarityElement) {
                    const rarity = rarityElement.getAttribute('data-rarity');
                    if (rarity !== filterValue) {
                        show = false;
                    }
                } else if (filterValue !== '1') {
                    // If no rarity element, it's common (1), so hide if filtering for other rarities
                    show = false;
                }
            }
            
            row.style.display = show ? 'table-row' : 'none';
        });
        
        log('Applied filtering:', { 
            searchValue, 
            filterValue, 
            visibleRows: Array.from(rows).filter(r => r.style.display !== 'none').length 
        });
    }
    
    // Reset state when modal closes
    function resetState() {
        cauldronState.controlsAdded = false;
        cauldronState.originalRows = [];
        log('State reset');
    }
    
    // Watch for modal closing
    const closeObserver = new MutationObserver((mutations) => {
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
        reset: resetState
    };
    
    log('Cauldron Upgrade mod loaded successfully');
    
})(); 