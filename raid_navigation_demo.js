// Raid Navigation Demo
// This script demonstrates how to use the raid system API to detect active raids
// and navigate to them using the same navigation method as Cyclopedia

console.log('[Raid Navigation Demo] Starting...');

// Map raid names to room IDs (from Raid Hunter mod)
const EVENT_TO_ROOM_MAPPING = {
    'Rat Plague': 'rkswrs',
    'Buzzing Madness': 'crwasp',
    'Monastery Catacombs': 'crcat',
    'Ghostlands Boneyard': 'crghst4',
    'Permafrosted Hole': 'fhole',
    'Jammed Mailbox': 'fbox',
    'Frosted Bunker': 'fscave',
    'Hedge Maze Trap': 'abmazet',
    'Tower of Whitewatch (Shield)': 'aborca',
    'Tower of Whitewatch (Helmet)': 'aborcb',
    'Tower of Whitewatch (Armor)': 'aborcc',
    'Orcish Barricade': 'ofbar',
    'Poacher Cave (Bear)': 'kpob',
    'Poacher Cave (Wolf)': 'kpow',
    'Dwarven Bank Heist': 'vbank',
    'An Arcanist Ritual': 'vdhar'
};

// Function to get current raid state
function getCurrentRaidState() {
    try {
        if (!globalThis.state || !globalThis.state.raids) {
            console.log('[Raid Navigation Demo] Raid state not available');
            return null;
        }
        
        const raidState = globalThis.state.raids.getSnapshot();
        console.log('[Raid Navigation Demo] Current raid state:', raidState.context);
        return raidState.context;
    } catch (error) {
        console.error('[Raid Navigation Demo] Error getting raid state:', error);
        return null;
    }
}

// Function to navigate to a specific room (same method as Cyclopedia)
function navigateToRoom(roomId) {
    try {
        if (!globalThis.state || !globalThis.state.board) {
            console.error('[Raid Navigation Demo] Board state not available');
            return false;
        }
        
        console.log(`[Raid Navigation Demo] Navigating to room: ${roomId}`);
        globalThis.state.board.send({
            type: 'selectRoomById',
            roomId: roomId
        });
        return true;
    } catch (error) {
        console.error('[Raid Navigation Demo] Error navigating to room:', error);
        return false;
    }
}

// Function to find active raids and navigate to the first one
function findAndNavigateToActiveRaid() {
    const raidState = getCurrentRaidState();
    if (!raidState) {
        console.log('[Raid Navigation Demo] No raid state available');
        return;
    }
    
    const raidList = raidState.list || [];
    console.log(`[Raid Navigation Demo] Found ${raidList.length} active raids`);
    
    if (raidList.length === 0) {
        console.log('[Raid Navigation Demo] No active raids found');
        return;
    }
    
    // Process each raid in the list
    raidList.forEach((raid, index) => {
        console.log(`[Raid Navigation Demo] Raid ${index + 1}:`, raid);
        
        // Try to find the raid name in the raid object
        let raidName = null;
        
        // Check various possible properties for the raid name
        if (raid.name) {
            raidName = raid.name;
        } else if (raid.title) {
            raidName = raid.title;
        } else if (raid.eventName) {
            raidName = raid.eventName;
        } else if (raid.type) {
            raidName = raid.type;
        }
        
        if (raidName) {
            console.log(`[Raid Navigation Demo] Found raid name: ${raidName}`);
            
            // Check if we have a room mapping for this raid
            const roomId = EVENT_TO_ROOM_MAPPING[raidName];
            if (roomId) {
                console.log(`[Raid Navigation Demo] Found room mapping: ${raidName} -> ${roomId}`);
                
                // Navigate to the first raid we find
                if (index === 0) {
                    console.log(`[Raid Navigation Demo] Navigating to first active raid: ${raidName}`);
                    navigateToRoom(roomId);
                }
            } else {
                console.log(`[Raid Navigation Demo] No room mapping found for: ${raidName}`);
            }
        } else {
            console.log(`[Raid Navigation Demo] Could not determine raid name for raid:`, raid);
        }
    });
}

// Function to monitor for new raids
function setupRaidMonitoring() {
    if (!globalThis.state || !globalThis.state.raids) {
        console.log('[Raid Navigation Demo] Raid state not available for monitoring');
        return null;
    }
    
    console.log('[Raid Navigation Demo] Setting up raid monitoring...');
    
    // Monitor for new raids
    const unsubscribe = globalThis.state.raids.on("newRaid", (e) => {
        console.log('[Raid Navigation Demo] New raid detected:', e);
        console.log('[Raid Navigation Demo] New raid data:', e.raid);
        
        // Try to navigate to the new raid
        if (e.raid) {
            let raidName = e.raid.name || e.raid.title || e.raid.eventName || e.raid.type;
            if (raidName) {
                const roomId = EVENT_TO_ROOM_MAPPING[raidName];
                if (roomId) {
                    console.log(`[Raid Navigation Demo] Auto-navigating to new raid: ${raidName} -> ${roomId}`);
                    navigateToRoom(roomId);
                }
            }
        }
    });
    
    // Monitor raid list changes
    const listUnsubscribe = globalThis.state.raids.subscribe((state) => {
        const currentList = state.context.list || [];
        console.log(`[Raid Navigation Demo] Raid list updated: ${currentList.length} raids`);
        
        if (currentList.length > 0) {
            console.log('[Raid Navigation Demo] Active raids:', currentList);
        }
    });
    
    return () => {
        if (unsubscribe) unsubscribe();
        if (listUnsubscribe) listUnsubscribe();
    };
}

// Main execution
function main() {
    console.log('[Raid Navigation Demo] Checking for active raids...');
    
    // Check current raids
    findAndNavigateToActiveRaid();
    
    // Set up monitoring for future raids
    const cleanup = setupRaidMonitoring();
    
    // Return cleanup function
    return cleanup;
}

// Auto-execute if in browser context
if (typeof window !== 'undefined') {
    const cleanup = main();
    
    // Make cleanup available globally
    window.raidNavigationCleanup = cleanup;
    
    console.log('[Raid Navigation Demo] Demo started. Call window.raidNavigationCleanup() to stop monitoring.');
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getCurrentRaidState,
        navigateToRoom,
        findAndNavigateToActiveRaid,
        setupRaidMonitoring,
        main
    };
}
