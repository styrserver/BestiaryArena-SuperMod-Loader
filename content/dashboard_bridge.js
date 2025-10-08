window.addEventListener('message', function(event) {
  if (event.source !== window) return;
  if (event.data && event.data.type === 'OPEN_SUPERMOD_DASHBOARD') {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage({ action: 'openDashboard' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Extension context error:', chrome.runtime.lastError.message);
            // Show user-friendly error message
            alert('Extension context error. Please refresh the page and try again.');
          } else if (response && response.success) {
            console.log('Dashboard opened successfully');
          }
        });
      } catch (error) {
        console.error('Failed to send message to extension:', error);
        alert('Extension context error. Please refresh the page and try again.');
      }
    } else if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
      try {
        browser.runtime.sendMessage({ action: 'openDashboard' }).then((response) => {
          if (response && response.success) {
            console.log('Dashboard opened successfully');
          }
        }).catch((error) => {
          console.error('Extension context error:', error);
          alert('Extension context error. Please refresh the page and try again.');
        });
      } catch (error) {
        console.error('Failed to send message to extension:', error);
        alert('Extension context error. Please refresh the page and try again.');
      }
    }
  }
}); 