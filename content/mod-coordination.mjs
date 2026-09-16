// =======================
// Global Mod Coordination System
// =======================
// Centralized coordination system for all mods to coordinate resources,
// manage priorities, and communicate state changes.
'use strict';

// Top-level log to verify script is being parsed/executed (only in debug mode)
if (window.BESTIARY_DEBUG) {
    console.log('[Mod Coordination] Script loaded');
}

try {
    (function() {
        'use strict';
        
        // Log initialization (only in debug mode)
        if (window.BESTIARY_DEBUG) {
            console.log('[Mod Coordination] Initializing...');
        }
    
    // Prevent multiple initializations
    if (window.ModCoordination) {
        console.warn('[Mod Coordination] Already initialized - instance exists:', window.ModCoordination);
        return;
    }
    
    // =======================
    // ControlManager Class
    // =======================
    
    /**
     * Reusable control manager class for coordination between mods
     */
    class ControlManager {
        constructor(name, uniqueProperties = {}) {
            this.name = name;
            this.currentOwner = null;
            
            // Add any unique properties specific to this manager
            Object.assign(this, uniqueProperties);
        }
        
        /**
         * Request control (returns true if successful)
         * @param {string} modName - Name of mod requesting control
         * @returns {boolean} True if control granted
         */
        requestControl(modName) {
            if (this.currentOwner === null || this.currentOwner === modName) {
                this.currentOwner = modName;
                console.log(`[${this.name}] Control granted to ${modName}`);
                return true;
            }
            console.log(`[${this.name}] Control denied to ${modName} (currently owned by ${this.currentOwner})`);
            return false;
        }
        
        /**
         * Release control
         * @param {string} modName - Name of mod releasing control
         * @returns {boolean} True if control released
         */
        releaseControl(modName) {
            if (this.currentOwner === modName) {
                this.currentOwner = null;
                console.log(`[${this.name}] Control released by ${modName}`);
                return true;
            }
            return false;
        }
        
        /**
         * Check if mod has control
         * @param {string} modName - Name of mod to check
         * @returns {boolean} True if mod has control
         */
        hasControl(modName) {
            return this.currentOwner === modName;
        }
        
        /**
         * Get current owner
         * @returns {string|null} Current owner or null
         */
        getCurrentOwner() {
            return this.currentOwner;
        }
        
        /**
         * Check if controlled by another mod
         * @param {string} modName - Name of mod to check
         * @returns {boolean} True if controlled by another mod
         */
        isControlledByOther(modName) {
            return this.currentOwner !== null && this.currentOwner !== modName;
        }
    }
    
    // =======================
    // ModCoordination Class
    // =======================
    
    /**
     * Global mod coordination system
     */
    class ModCoordination {
        constructor() {
            this.modStates = new Map(); // modName -> state object
            this.controlManagers = new Map(); // resourceName -> ControlManager
            this.eventListeners = new Map(); // eventType -> Set<listeners>
            this.priorityRules = new Map(); // modName -> priority number
            this.cleanupTimers = new Map(); // modName -> Set<timers>
            
            // Initialize default control managers
            this.initializeDefaultManagers();
            
            console.log('[Mod Coordination] System initialized');
        }
        
        /**
         * Initialize default control managers
         */
        initializeDefaultManagers() {
            // Quest Button Manager
            if (!window.QuestButtonManager) {
                const questButtonManager = new ControlManager('Quest Button Manager', {
                    originalState: null,
                    validationInterval: null
                });
                this.controlManagers.set('questButton', questButtonManager);
                window.QuestButtonManager = questButtonManager;
            } else {
                this.controlManagers.set('questButton', window.QuestButtonManager);
            }
            
            // Autoplay Manager
            if (!window.AutoplayManager) {
                const autoplayManager = new ControlManager('Autoplay Manager', {
                    originalMode: null,
                    isControlledByOther(modName) {
                        return this.currentOwner !== null && this.currentOwner !== modName;
                    }
                });
                this.controlManagers.set('autoplay', autoplayManager);
                window.AutoplayManager = autoplayManager;
            } else {
                this.controlManagers.set('autoplay', window.AutoplayManager);
            }
            
            // Bestiary Automator Settings Manager
            if (!window.BestiaryAutomatorSettingsManager) {
                const settingsManager = new ControlManager('Bestiary Automator Settings Manager');
                this.controlManagers.set('bestiaryAutomatorSettings', settingsManager);
                window.BestiaryAutomatorSettingsManager = settingsManager;
            } else {
                this.controlManagers.set('bestiaryAutomatorSettings', window.BestiaryAutomatorSettingsManager);
            }
        }
        
        // =======================
        // Mod Registration
        // =======================
        
        /**
         * Register a mod with the coordination system
         * @param {string} modName - Unique mod identifier
         * @param {Object} config - Mod configuration
         * @param {number} config.priority - Priority (0-255, higher = more priority)
         * @param {Object} config.metadata - Additional metadata
         * @returns {Object} Mod state object
         */
        registerMod(modName, config = {}) {
            if (this.modStates.has(modName)) {
                console.warn(`[Mod Coordination] Mod ${modName} already registered`);
                return this.modStates.get(modName);
            }
            
            // Check for saved priority override
            let priority = config.priority !== undefined ? config.priority : 1;
            try {
                const savedPriorities = localStorage.getItem('mod-coordination-priorities');
                if (savedPriorities) {
                    const parsed = JSON.parse(savedPriorities);
                    if (parsed[modName] !== undefined) {
                        priority = parsed[modName];
                        console.log(`[Mod Coordination] Using saved priority for ${modName}: ${priority}`);
                    }
                }
            } catch (error) {
                console.warn(`[Mod Coordination] Error loading saved priority for ${modName}:`, error);
            }
            
            const modState = {
                name: modName,
                enabled: false,
                active: false,
                priority: priority,
                resources: new Set(), // Resources this mod controls
                lastUpdate: Date.now(),
                metadata: config.metadata || {}
            };
            
            this.modStates.set(modName, modState);
            this.priorityRules.set(modName, modState.priority);
            
            // Setup cleanup on page unload
            this.setupCleanup(modName);
            
            if (window.BESTIARY_DEBUG) {
                console.log(`[Mod Coordination] Mod registered: ${modName} (priority: ${modState.priority})`);
            }
            this.emit('modRegistered', { modName, config });
            
            return modState;
        }
        
        /**
         * Unregister a mod
         * @param {string} modName - Mod identifier
         */
        unregisterMod(modName) {
            const modState = this.modStates.get(modName);
            if (!modState) return;
            
            // Release all resources
            modState.resources.forEach(resource => {
                this.releaseControl(resource, modName);
            });
            
            // Cleanup timers
            this.cleanupModTimers(modName);
            
            // Remove state
            this.modStates.delete(modName);
            this.priorityRules.delete(modName);
            
            this.emit('modUnregistered', { modName });
        }
        
        // =======================
        // State Management
        // =======================
        
        /**
         * Update mod state
         * @param {string} modName - Mod identifier
         * @param {Object} updates - State updates
         */
        updateModState(modName, updates) {
            const modState = this.modStates.get(modName);
            if (!modState) {
                console.warn(`[Mod Coordination] Cannot update state for unregistered mod: ${modName}`);
                return false;
            }
            
            const wasActive = modState.active;
            const wasEnabled = modState.enabled;
            const wasPriority = modState.priority;
            
            Object.assign(modState, updates, { lastUpdate: Date.now() });
            
            // Update priority rules if priority changed
            if (updates.priority !== undefined && updates.priority !== wasPriority) {
                this.priorityRules.set(modName, modState.priority);
                this.emit('modPriorityChanged', { modName, priority: modState.priority, oldPriority: wasPriority });
                if (window.BESTIARY_DEBUG) {
                    console.log(`[Mod Coordination] Priority updated for ${modName}: ${wasPriority} → ${modState.priority}`);
                }
            }
            
            // Emit events for state changes
            if (wasEnabled !== modState.enabled) {
                this.emit('modEnabledChanged', { modName, enabled: modState.enabled });
            }
            
            if (wasActive !== modState.active) {
                this.emit('modActiveChanged', { modName, active: modState.active });
            }
            
            return true;
        }
        
        /**
         * Update mod priority
         * @param {string} modName - Mod identifier
         * @param {number} priority - New priority (0-255)
         * @returns {boolean} True if updated successfully
         */
        updateModPriority(modName, priority) {
            if (typeof priority !== 'number' || priority < 0 || priority > 255) {
                console.warn(`[Mod Coordination] Invalid priority value: ${priority} (must be 0-255)`);
                return false;
            }
            const result = this.updateModState(modName, { priority });
            if (!result) {
                console.warn(`[Mod Coordination] Failed to update priority for ${modName}`);
            }
            return result;
        }
        
        /**
         * Get all registered mods with their priorities
         * @returns {Array} Array of { name, priority, enabled, active } objects sorted by priority
         */
        getAllMods() {
            const mods = Array.from(this.modStates.values())
                .map(state => ({
                    name: state.name,
                    priority: state.priority,
                    enabled: state.enabled,
                    active: state.active,
                    metadata: state.metadata
                }))
                .sort((a, b) => b.priority - a.priority);
            return mods;
        }
        
        /**
         * Get mod state
         * @param {string} modName - Mod identifier
         * @returns {Object|null} Mod state or null
         */
        getModState(modName) {
            return this.modStates.get(modName) || null;
        }
        
        /**
         * Check if mod is active
         * @param {string} modName - Mod identifier
         * @returns {boolean} True if mod is active
         */
        isModActive(modName) {
            const state = this.modStates.get(modName);
            return state ? state.active : false;
        }
        
        /**
         * Check if mod is enabled
         * @param {string} modName - Mod identifier
         * @returns {boolean} True if mod is enabled
         */
        isModEnabled(modName) {
            const state = this.modStates.get(modName);
            return state ? state.enabled : false;
        }
        
        // =======================
        // Resource Control
        // =======================
        
        /**
         * Get or create a control manager for a resource
         * @param {string} resourceName - Resource identifier
         * @param {Object} config - Manager configuration
         * @returns {ControlManager} Control manager instance
         */
        getControlManager(resourceName, config = {}) {
            if (!this.controlManagers.has(resourceName)) {
                const manager = new ControlManager(resourceName, config);
                this.controlManagers.set(resourceName, manager);
            }
            return this.controlManagers.get(resourceName);
        }
        
        /**
         * Request control of a resource
         * @param {string} resourceName - Resource identifier
         * @param {string} modName - Mod identifier
         * @param {Object} options - Request options
         * @param {boolean} options.force - Force takeover (higher priority only)
         * @returns {boolean} True if control granted
         */
        requestControl(resourceName, modName, options = {}) {
            const manager = this.getControlManager(resourceName);
            const modState = this.modStates.get(modName);
            
            if (!modState) {
                console.warn(`[Mod Coordination] Cannot request control - mod not registered: ${modName}`);
                return false;
            }
            
            const currentOwner = manager.getCurrentOwner();
            
            // Check priority if resource is already controlled
            if (currentOwner && currentOwner !== modName) {
                const currentOwnerState = this.modStates.get(currentOwner);
                const requesterPriority = modState.priority;
                const currentPriority = currentOwnerState?.priority || 0;
                
                // Higher priority can take control
                if (requesterPriority > currentPriority) {
                    manager.releaseControl(currentOwner);
                    this.emit('controlTaken', { resourceName, from: currentOwner, to: modName });
                } else if (options.force) {
                    // Force takeover (use with caution)
                    console.warn(`[Mod Coordination] Force takeover: ${modName} forcing control from ${currentOwner}`);
                    manager.releaseControl(currentOwner);
                    this.emit('controlTaken', { resourceName, from: currentOwner, to: modName, forced: true });
                } else {
                    return false;
                }
            }
            
            const granted = manager.requestControl(modName);
            if (granted) {
                modState.resources.add(resourceName);
                this.emit('controlGranted', { resourceName, modName });
            }
            
            return granted;
        }
        
        /**
         * Release control of a resource
         * @param {string} resourceName - Resource identifier
         * @param {string} modName - Mod identifier
         * @returns {boolean} True if control released
         */
        releaseControl(resourceName, modName) {
            const manager = this.controlManagers.get(resourceName);
            if (!manager) {
                console.warn(`[Mod Coordination] No manager found for resource: ${resourceName}`);
                return false;
            }
            
            const released = manager.releaseControl(modName);
            if (released) {
                const modState = this.modStates.get(modName);
                if (modState) {
                    modState.resources.delete(resourceName);
                }
                this.emit('controlReleased', { resourceName, modName });
            }
            
            return released;
        }
        
        /**
         * Check if mod has control
         * @param {string} resourceName - Resource identifier
         * @param {string} modName - Mod identifier
         * @returns {boolean} True if mod has control
         */
        hasControl(resourceName, modName) {
            const manager = this.controlManagers.get(resourceName);
            return manager ? manager.hasControl(modName) : false;
        }
        
        // =======================
        // Priority System
        // =======================
        
        /**
         * Check if mod can run based on priorities
         * @param {string} modName - Mod identifier
         * @param {string[]} blockingMods - Array of mod names that should block this mod
         * @returns {boolean} True if mod can run
         */
        canModRun(modName, blockingMods = []) {
            const modState = this.modStates.get(modName);
            if (!modState || !modState.enabled) {
                return false;
            }
            
            // Check against blocking mods
            for (const blockingMod of blockingMods) {
                const blockingState = this.modStates.get(blockingMod);
                if (blockingState && blockingState.active && blockingState.enabled) {
                    const blockingPriority = blockingState.priority || 0;
                    const modPriority = modState.priority || 0;
                    
                    // If blocking mod has higher or equal priority, cannot run
                    if (blockingPriority >= modPriority) {
                        return false;
                    }
                }
            }
            
            return true;
        }
        
        /**
         * Get active mods sorted by priority
         * @returns {Array} Array of mod states sorted by priority (highest first)
         */
        getActiveModsByPriority() {
            return Array.from(this.modStates.values())
                .filter(state => state.active && state.enabled)
                .sort((a, b) => b.priority - a.priority);
        }
        
        // =======================
        // Event System
        // =======================
        
        /**
         * Subscribe to coordination events
         * @param {string} eventType - Event type
         * @param {Function} callback - Event callback
         * @returns {Function} Unsubscribe function
         */
        on(eventType, callback) {
            if (!this.eventListeners.has(eventType)) {
                this.eventListeners.set(eventType, new Set());
            }
            this.eventListeners.get(eventType).add(callback);
            
            // Return unsubscribe function
            return () => {
                const listeners = this.eventListeners.get(eventType);
                if (listeners) {
                    listeners.delete(callback);
                }
            };
        }
        
        /**
         * Emit coordination events
         * @param {string} eventType - Event type
         * @param {Object} data - Event data
         */
        emit(eventType, data) {
            const listeners = this.eventListeners.get(eventType);
            if (listeners && listeners.size > 0) {
                listeners.forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error(`[Mod Coordination] Error in event listener for ${eventType}:`, error);
                    }
                });
            }
        }
        
        /**
         * Remove event listener
         * @param {string} eventType - Event type
         * @param {Function} callback - Event callback
         */
        off(eventType, callback) {
            const listeners = this.eventListeners.get(eventType);
            if (listeners) {
                listeners.delete(callback);
            }
        }
        
        // =======================
        // Cleanup
        // =======================
        
        /**
         * Setup cleanup for a mod
         * @param {string} modName - Mod identifier
         */
        setupCleanup(modName) {
            // Track timers for this mod
            if (!this.cleanupTimers.has(modName)) {
                this.cleanupTimers.set(modName, new Set());
            }
        }
        
        /**
         * Register a timer for cleanup
         * @param {string} modName - Mod identifier
         * @param {number} timerId - Timer ID
         */
        registerTimer(modName, timerId) {
            const timers = this.cleanupTimers.get(modName);
            if (timers) {
                timers.add(timerId);
            }
        }
        
        /**
         * Cleanup mod timers
         * @param {string} modName - Mod identifier
         */
        cleanupModTimers(modName) {
            const timers = this.cleanupTimers.get(modName);
            if (timers) {
                timers.forEach(timerId => {
                    clearTimeout(timerId);
                    clearInterval(timerId);
                });
                timers.clear();
            }
        }
        
        /**
         * Get coordination summary
         * @returns {Object} Summary object
         */
        getSummary() {
            return {
                registeredMods: Array.from(this.modStates.keys()),
                activeMods: Array.from(this.modStates.values())
                    .filter(s => s.active)
                    .map(s => s.name),
                resources: Array.from(this.controlManagers.keys()),
                priorities: Object.fromEntries(
                    Array.from(this.modStates.entries()).map(([name, state]) => [name, state.priority])
                )
            };
        }
    }
    
    // Create global instance
    try {
        window.ModCoordination = new ModCoordination();
        if (window.BESTIARY_DEBUG) {
            console.log('[Mod Coordination] System initialized');
        }
    } catch (error) {
        console.error('[Mod Coordination] ✗ ERROR in constructor:', error);
        console.error('[Mod Coordination] Error stack:', error?.stack);
        throw error;
    }
    
    // Verify it was created
    if (!window.ModCoordination) {
        console.error('[Mod Coordination] ✗ FAILED to create global instance!');
        console.error('[Mod Coordination] window.ModCoordination value:', window.ModCoordination);
    }
    })();
} catch (error) {
    console.error('[Mod Coordination] ===== CRITICAL ERROR IN MOD COORDINATION =====');
    console.error('[Mod Coordination] Error:', error);
    console.error('[Mod Coordination] Error message:', error?.message);
    console.error('[Mod Coordination] Error stack:', error?.stack);
    console.error('[Mod Coordination] Error name:', error?.name);
    throw error; // Re-throw to prevent silent failure
}

