// =======================
// 1. Configuration
// =======================
'use strict';

console.log('[Outfiter] initializing...');

// =======================
// 2. Configuration & Constants
// =======================

// Cache DATA availability to avoid repeated checks
const DATA_AVAILABLE = typeof DATA !== 'undefined';

// Store original fetch for cleanup
let originalFetch = null;

// Store timer IDs for cleanup
let restoreTimer = null;

// Store notification cleanup timers
const notificationTimers = new Set();

// =======================
// 3. Helper Functions
// =======================

function getOutfitIds() {
  return [
    1108, 129, 131, 132, 134, 143, 144, 145, 146, 151, 152, 153, 154, 251,
    268, 278, 289, 324, 335, 367, 430, 463, 465, 472, 512, 516, 541, 574, 577,
    610, 619, 846, 1042, 1094, 1119, 1146, 1161, 1243, 1251, 1270, 1460, 1597,
    532, 1848, 128, 533, 633, 634, 637, 665, 667, 684, 697, 698, 725, 733,
    746, 750, 853, 873, 884, 899, 908, 955, 957, 1021, 1023, 1050, 1056, 1173,
    1186, 1188, 1202, 1204, 1245, 1292, 1338, 1384, 1415, 1444, 1449, 1575,
    1581, 1612, 1618, 1662, 1680, 1713, 1722, 1856, 160, 194, 226, 253, 254,
    255, 264, 273, 328, 493, 534, 695, 760, 842, 862, 875, 876, 881, 931, 932,
    935, 980, 1059, 1061, 1063, 1068, 1062, 1102, 1110, 1112, 1114, 1116,
    1118, 1127, 1133, 1136, 1189, 1219, 1255, 1268, 1279, 1298, 1300, 1301,
    1346, 1382, 1386, 1396, 1406, 1436, 1745, 1774, 1776, 1845, 12, 1850, 947,
    1069, 1071, 1190, 1200, 1206, 1217, 1221, 1222, 1223, 1282, 1316, 1317,
    1322, 1331, 1371, 1407, 1408, 1418, 1430, 1489, 1500, 1537, 1538, 1539,
    1543, 1568, 1599, 1611, 1646, 1647, 1648, 1675, 1724, 1725, 1740, 1747,
    1809, 1816, 1814, 1831, 1860, 75, 130, 133, 1824, 1837, 159, 432, 962,
    964, 966, 968, 970, 972, 974, 1210, 1288, 1874, 1363, 1378, 1457, 1737,
    1810, 1826, 1827, 1847, 1857, 1866,
  ];
}

function saveOutfitToStorage(outfitId, colors = null) {
  try {
    const outfitData = {
      outfitId: outfitId,
      colors: colors || {},
      timestamp: Date.now()
    };
    localStorage.setItem('outfiter-current-outfit', JSON.stringify(outfitData));
    console.log('[Outfiter] Saved outfit to localStorage:', outfitData);
  } catch (error) {
    console.error('[Outfiter] Error saving outfit to localStorage:', error);
  }
}

function loadOutfitFromStorage() {
  try {
    const saved = localStorage.getItem('outfiter-current-outfit');
    if (saved) {
      const outfitData = JSON.parse(saved);
      console.log('[Outfiter] Loaded outfit from localStorage:', outfitData);
      return outfitData;
    }
  } catch (error) {
    console.error('[Outfiter] Error loading outfit from localStorage:', error);
  }
  return null;
}

function forceOutfitChangeLocally(outfitId, colors = null) {
  try {
    console.log('[Outfiter] Forcing local outfit change for ID:', outfitId);
    
    globalThis.state.player.trigger.setState({
      fn: (prev) => ({
        ...prev,
        outfitId: outfitId,
        // Update colors if provided
        ...(colors && {
          head: colors.head || prev.head,
          body: colors.body || prev.body,
          legs: colors.legs || prev.legs,
          feet: colors.feet || prev.feet,
        }),
      }),
    });
    
    // Save to localStorage for persistence
    saveOutfitToStorage(outfitId, colors);
    
    console.log('[Outfiter] Successfully forced local outfit change');
    return true;
  } catch (error) {
    console.error('[Outfiter] Error forcing local outfit change:', error);
    return false;
  }
}

function restoreSavedOutfit() {
  try {
    const savedOutfit = loadOutfitFromStorage();
    if (savedOutfit && savedOutfit.outfitId) {
      console.log('[Outfiter] Restoring saved outfit:', savedOutfit.outfitId);
      
      // Apply the saved outfit
      globalThis.state.player.trigger.setState({
        fn: (prev) => ({
          ...prev,
          outfitId: savedOutfit.outfitId,
          // Restore colors if they exist
          ...(savedOutfit.colors && {
            head: savedOutfit.colors.head || prev.head,
            body: savedOutfit.colors.body || prev.body,
            legs: savedOutfit.colors.legs || prev.legs,
            feet: savedOutfit.colors.feet || prev.feet,
          }),
        }),
      });
      
      console.log('[Outfiter] Successfully restored saved outfit');
      return true;
    }
  } catch (error) {
    console.error('[Outfiter] Error restoring saved outfit:', error);
  }
  return false;
}

function showOutfitChangeNotification(message, type = 'success') {
  try {
    // Create a subtle notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : '#FF9800'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
      max-width: 300px;
      word-wrap: break-word;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto-remove after 3 seconds
    const fadeTimer = setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      const removeTimer = setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
        // Clean up timer references
        notificationTimers.delete(removeTimer);
      }, 300);
      notificationTimers.add(removeTimer);
    }, 3000);
    
    // Store timer for cleanup
    notificationTimers.add(fadeTimer);
    
  } catch (error) {
    console.error('[Outfiter] Error showing notification:', error);
  }
}

function interceptOutfitChangeErrors() {
  try {
    // Store original fetch if not already stored
    if (!originalFetch) {
      originalFetch = window.fetch;
    }
    
    // Hook into fetch to intercept outfit change API calls
    window.fetch = function(...args) {
      const [url, options] = args;
      
      // Check if this is an outfit change request
      if (url && url.includes('account.changeOutfit') && options && options.method === 'POST') {
        return originalFetch.apply(this, args).then(async response => {
          // Extract outfit data from request
          let outfitId = null;
          let colors = null;
          
          try {
            const requestBody = JSON.parse(options.body);
            if (requestBody['0'] && requestBody['0'].json) {
              const outfitData = requestBody['0'].json;
              outfitId = outfitData.outfitId;
              colors = outfitData.colors;
            }
          } catch (parseError) {
            console.error('[Outfiter] Error parsing request body:', parseError);
          }
          
          // Check if the response indicates an error
          if (!response.ok || response.status >= 400) {
            try {
              const data = await response.clone().json();
              
              // Check if it's an outfit not owned error
              if (data && data[0] && data[0].error && 
                  data[0].error.json && 
                  data[0].error.json.message && 
                  data[0].error.json.message.includes('does not have outfit')) {
                
                console.log('[Outfiter] Detected outfit ownership error, forcing local change');
                
                // Force the outfit change locally
                forceOutfitChangeLocally(outfitId, colors);
                
                // Return a successful response to prevent UI errors
                return new Response(JSON.stringify([{
                  result: {
                    data: {
                      success: true,
                      outfitId: outfitId,
                      colors: colors
                    }
                  }
                }]), {
                  status: 200,
                  statusText: 'OK',
                  headers: {
                    'Content-Type': 'application/json'
                  }
                });
              } else {
                // Other types of errors - show warning but don't override
                console.warn('[Outfiter] Outfit change failed with error:', data);
                showOutfitChangeNotification(
                  'Outfit change failed - server error', 
                  'warning'
                );
              }
            } catch (error) {
              console.error('[Outfiter] Error reading response:', error);
            }
          } else {
            // Success case - save the outfit change
            console.log('[Outfiter] Successful outfit change, saving to localStorage');
            saveOutfitToStorage(outfitId, colors);
          }
          
          return response;
        }).catch(error => {
          console.error('[Outfiter] Network error during outfit change:', error);
          showOutfitChangeNotification(
            'Network error - outfit change may have failed', 
            'warning'
          );
          throw error; // Re-throw to maintain normal error handling
        });
      }
      
      // For non-outfit requests, use original fetch
      return originalFetch.apply(this, args);
    };
    
    console.log('[Outfiter] Successfully set up outfit change error interception');
    return true;
  } catch (error) {
    console.error('[Outfiter] Error setting up error interception:', error);
    return false;
  }
}

// =======================
// 3. Main Execution
// =======================

function executeOutfiter() {
  try {
    // Check if Outfiter is enabled via localStorage
    const outfiterEnabled = localStorage.getItem('outfiter-enabled') === 'true';
    
    if (!outfiterEnabled) {
      console.log('[Outfiter] Disabled - skipping execution');
      return false;
    }
    
    console.log('[Outfiter] Enabled - executing outfit operations');

    // Set outfits in player state (merge with existing outfits)
    const outfitIds = getOutfitIds();
    globalThis.state.player.trigger.setState({
      fn: (prev) => ({
        ...prev,
        outfits: [...new Set([...prev.outfits, ...outfitIds])], // Merge and deduplicate
      }),
    });

    // Define excluded items from bag pool (only if DATA is available)
    if (DATA_AVAILABLE) {
      const EXCLUDE_FROM_BAG_POOL = [
        DATA.Newcomer.id,
        DATA.Gamemaster.id,
        DATA.Citizen.id, // tutorial reward
        DATA["Golden Outfit"].id, // store gold sink
        DATA.Poof.id,
        DATA.Jester.id, // april fools
        DATA["Newly Wed"].id, // valentines day
        DATA["Ceremonial Garb"].id, // carnival
        DATA.Festive.id, // carnival
        DATA["Royal Pumpkin"].id, // halloween
        DATA["Pumpkin Mummy"].id, // halloween
        DATA["Sinister Archer"].id, // halloween
        DATA["Merry Garb"].id, // christmas
        DATA.Elven.id, // christmas
        DATA["Bat Knight"].id, // oathkeeper amazon achievement
        DATA["Crusader"].id, // black knight achievement
      ];
      console.log('[Outfiter] EXCLUDE_FROM_BAG_POOL defined with', EXCLUDE_FROM_BAG_POOL.length, 'items');
    } else {
      console.log('[Outfiter] DATA object not available, skipping EXCLUDE_FROM_BAG_POOL definition');
    }
    
    // Set up error interception for outfit changes
    interceptOutfitChangeErrors();
    
    // Restore saved outfit after a short delay to ensure state is ready
    restoreTimer = setTimeout(() => {
      restoreSavedOutfit();
    }, 1000);
    
    console.log('[Outfiter] Successfully executed outfit operations');
    return true;
  } catch (error) {
    console.error('[Outfiter] Error executing outfit operations:', error);
    return false;
  }
}

// =======================
// 3. Exports & Lifecycle Management
// =======================

exports = {
  init: function() {
    try {
      executeOutfiter();
      
      // Add event listener for outfiter toggle changes
      window.addEventListener('message', handleOutfiterToggle);
      
      return true;
    } catch (error) {
      console.error('[Outfiter] Initialization error:', error);
      return false;
    }
  },
  
  cleanup: function() {
    try {
      // Check if window exists before cleanup
      if (typeof window !== 'undefined') {
        // Remove event listener to prevent memory leaks
        window.removeEventListener('message', handleOutfiterToggle);
        
        // Clear any pending timers
        if (restoreTimer) {
          clearTimeout(restoreTimer);
          restoreTimer = null;
        }
        
        // Clear all notification timers
        notificationTimers.forEach(timer => {
          clearTimeout(timer);
        });
        notificationTimers.clear();
        
        // Clean up any remaining notifications
        const notifications = document.querySelectorAll('[style*="position: fixed"][style*="top: 20px"][style*="right: 20px"]');
        notifications.forEach(notification => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        });
        
        // Restore original fetch if it was modified
        if (originalFetch) {
          window.fetch = originalFetch;
          originalFetch = null;
        }
      }
      
      console.log('[Outfiter] Cleaned up successfully');
      return true;
    } catch (error) {
      console.error('[Outfiter] Cleanup error:', error);
      return false;
    }
  }
};

// Legacy window object for backward compatibility
if (typeof window !== 'undefined') {
  window.Outfiter = {
    init: exports.init,
    cleanup: exports.cleanup
  };
}

// Message handler for outfiter toggle changes
function handleOutfiterToggle(event) {
  if (event.source !== window) return;
  
  if (event.data && event.data.from === 'BESTIARY_EXTENSION' && event.data.action === 'updateOutfiterMode') {
    const enabled = event.data.enabled;
    console.log('[Outfiter] Received toggle update:', enabled);
    
    if (enabled) {
      // Re-execute when enabled
      executeOutfiter();
    } else {
      console.log('[Outfiter] Disabled via toggle - no action needed');
    }
  }
}

// Event listener is now added in init() function

// Auto-initialize if running in mod context
if (typeof context !== 'undefined' && context.api) {
  exports.init();
}

