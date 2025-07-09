// Dashboard Button Mod
console.log('DashboardButton initializing...');

function openDashboardInNewTab() {
  console.log('[DashboardButton] openDashboardInNewTab called');
  if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
    console.log('[DashboardButton] Using browser.runtime.sendMessage');
    browser.runtime.sendMessage({ action: 'openDashboard' });
  } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    console.log('[DashboardButton] Using chrome.runtime.sendMessage');
    chrome.runtime.sendMessage({ action: 'openDashboard' });
  } else {
    // fallback: open extension page dynamically if possible, else fallback to relative path
    let dashboardUrl;
    if (window.browser && window.browser.runtime && typeof window.browser.runtime.getURL === 'function') {
      dashboardUrl = window.browser.runtime.getURL('dashboard/dashboard.html');
      console.log('[DashboardButton] Fallback: using window.browser.runtime.getURL:', dashboardUrl);
    } else if (window.chrome && window.chrome.runtime && typeof window.chrome.runtime.getURL === 'function') {
      dashboardUrl = window.chrome.runtime.getURL('dashboard/dashboard.html');
      console.log('[DashboardButton] Fallback: using window.chrome.runtime.getURL:', dashboardUrl);
    } else {
      dashboardUrl = 'dashboard/dashboard.html';
      console.log('[DashboardButton] Fallback: using plain relative path:', dashboardUrl);
    }
    window.open(dashboardUrl, '_blank');
  }
}

function addDashboardHeaderButton() {
  const tryInsert = () => {
    // Find the header <ul> by its class
    const headerUl = document.querySelector('header ul.pixel-font-16.flex.items-center');
    if (!headerUl) {
      setTimeout(tryInsert, 500);
      return;
    }
    // Prevent duplicate button
    if (headerUl.querySelector('.dashboard-header-btn')) {
      console.debug('[DashboardButton] Dashboard header button already exists, skipping insert.');
      return;
    }

    // Create the <li> and <button>
    const li = document.createElement('li');
    li.className = 'hover:text-whiteExp';
    const btn = document.createElement('button');
    btn.textContent = 'SuperMod';
    btn.className = 'dashboard-header-btn';
    btn.onclick = openDashboardInNewTab;
    li.appendChild(btn);

    // Improved logic: Insert after Cyclopedia, but before any <li> with ml-auto (e.g., Discord)
    const cyclopediaLi = Array.from(headerUl.children).find(
      el => el.querySelector('button') && el.textContent.includes('Cyclopedia')
    );
    const mlAutoLi = Array.from(headerUl.children).find(
      el => el.classList.contains('ml-auto')
    );

    if (cyclopediaLi) {
      if (mlAutoLi) {
        headerUl.insertBefore(li, mlAutoLi);
        console.debug('[DashboardButton] Dashboard header button inserted before ml-auto (Discord).');
      } else if (cyclopediaLi.nextSibling) {
        headerUl.insertBefore(li, cyclopediaLi.nextSibling);
        console.debug('[DashboardButton] Dashboard header button inserted after Cyclopedia.');
      } else {
        headerUl.appendChild(li);
        console.debug('[DashboardButton] Dashboard header button appended after Cyclopedia.');
      }
      return;
    }
    // Fallback: Insert after Wiki
    const wikiLi = Array.from(headerUl.children).find(
      el => el.querySelector('a') && el.textContent.includes('Wiki')
    );
    if (wikiLi && wikiLi.nextSibling) {
      headerUl.insertBefore(li, wikiLi.nextSibling);
      console.debug('[DashboardButton] Dashboard header button inserted after Wiki.');
    } else {
      headerUl.appendChild(li);
      console.debug('[DashboardButton] Dashboard header button appended to header.');
    }
  };
  tryInsert();
}

addDashboardHeaderButton(); 