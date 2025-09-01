// Shared mod loader for popup and dashboard
window.browserAPI = window.browserAPI || (typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null));

export async function getLocalMods() {
  if (!browserAPI || !browserAPI.runtime) {
    throw new Error('Browser API not available');
  }
  const response = await browserAPI.runtime.sendMessage({ action: 'getLocalMods' });
  if (response && response.success) {
    return response.mods;
  } else {
    throw new Error(response ? response.error || 'Unknown error' : 'No response from background script');
  }
} 
