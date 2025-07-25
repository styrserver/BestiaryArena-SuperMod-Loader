window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  if (event.data && event.data.type === 'OPEN_SUPERMOD_DASHBOARD') {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'openDashboard' });
    } else if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
      browser.runtime.sendMessage({ action: 'openDashboard' });
    }
  }
}); 