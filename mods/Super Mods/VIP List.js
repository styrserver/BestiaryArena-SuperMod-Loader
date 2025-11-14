// =======================
// 1. Configuration
// =======================
'use strict';

console.log('[VIP List] initializing...');

// =======================
// 2. State & Observers
// =======================

let accountMenuObserver = null;
const processedMenus = new WeakSet();

// VIP List storage key
const VIP_LIST_STORAGE_KEY = 'vip-list-data';
const VIP_LIST_CONFIG_STORAGE_KEY = 'vip-list-config';
const VIP_LIST_SORT_STORAGE_KEY = 'vip-list-sort';
let vipListModalInstance = null;

// Sort state: { column: 'name'|'level'|'status'|'rankPoints'|'timeSum', direction: 'asc'|'desc' }
let currentSortState = {
  column: 'name',
  direction: 'asc'
};

// Load sort preference from localStorage
function loadSortPreference() {
  try {
    const saved = localStorage.getItem(VIP_LIST_SORT_STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (parsed.column && ['name', 'level', 'status', 'rankPoints', 'timeSum'].includes(parsed.column) &&
          parsed.direction && ['asc', 'desc'].includes(parsed.direction)) {
        currentSortState = parsed;
        console.log('[VIP List] Loaded sort preference from localStorage:', currentSortState);
        return currentSortState;
      }
    }
  } catch (error) {
    console.error('[VIP List] Error loading sort preference from localStorage:', error);
  }
  // Default: sort by name ascending
  currentSortState = { column: 'name', direction: 'asc' };
  return currentSortState;
}

// Save sort preference to localStorage
function saveSortPreference() {
  try {
    localStorage.setItem(VIP_LIST_SORT_STORAGE_KEY, JSON.stringify(currentSortState));
    console.log('[VIP List] Saved sort preference to localStorage:', currentSortState);
  } catch (error) {
    console.error('[VIP List] Error saving sort preference to localStorage:', error);
  }
}

// Load config from localStorage (preferred) or context.config
// Similar to Rank Pointer's approach - prioritize localStorage
function loadVIPListConfig() {
  try {
    const saved = localStorage.getItem(VIP_LIST_CONFIG_STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      console.log('[VIP List] Loaded config from localStorage:', parsed);
      // Update context.config if available
      if (typeof context !== 'undefined' && context.config) {
        Object.assign(context.config, parsed);
      }
      return parsed;
    }
  } catch (error) {
    console.error('[VIP List] Error loading config from localStorage:', error);
  }
  
  // Fallback to context.config if localStorage is empty
  const defaultConfig = typeof context !== 'undefined' && context.config ? context.config : {};
  return defaultConfig;
}

// Save config to localStorage
function saveVIPListConfig(config) {
  try {
    localStorage.setItem(VIP_LIST_CONFIG_STORAGE_KEY, JSON.stringify(config));
    console.log('[VIP List] Saved config to localStorage:', config);
  } catch (error) {
    console.error('[VIP List] Error saving config to localStorage:', error);
  }
}

// Initialize config - check localStorage first
const vipListConfig = loadVIPListConfig();

// Initialize sort preference - check localStorage first
loadSortPreference();

// Global click handler for closing dropdowns (only add once)
let vipDropdownClickHandler = null;
function setupVIPDropdownClickHandler() {
  if (vipDropdownClickHandler) return;
  
  vipDropdownClickHandler = (e) => {
    // Close all dropdowns if click is outside any dropdown
    const clickedDropdown = e.target.closest('.vip-dropdown-menu');
    const clickedNameButton = e.target.closest('button');
    
    if (!clickedDropdown && !clickedNameButton) {
      document.querySelectorAll('.vip-dropdown-menu').forEach(menu => {
        menu.style.display = 'none';
      });
    }
  };
  
  document.addEventListener('click', vipDropdownClickHandler);
}

// =======================
// 3. Helper Functions
// =======================

function getVIPList() {
  try {
    const stored = localStorage.getItem(VIP_LIST_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('[VIP List] Error loading VIP list:', error);
    return [];
  }
}

function sortVIPList(vipList, sortColumn = null, sortDirection = null) {
  // Use provided sort params or current sort state
  const column = sortColumn || currentSortState.column;
  const direction = sortDirection || currentSortState.direction;
  
  return [...vipList].sort((a, b) => {
    let comparison = 0;
    
    if (column === 'name') {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      comparison = nameA.localeCompare(nameB);
    } else if (column === 'level') {
      const levelA = parseInt(a.level) || 0;
      const levelB = parseInt(b.level) || 0;
      comparison = levelA - levelB;
      
      // Secondary sort by name if levels are equal
      if (comparison === 0) {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        comparison = nameA.localeCompare(nameB);
      }
    } else if (column === 'status') {
      // Sort: Online first, then Offline
      const statusA = (a.status || '').toLowerCase();
      const statusB = (b.status || '').toLowerCase();
      if (statusA === 'online' && statusB === 'offline') {
        comparison = -1;
      } else if (statusA === 'offline' && statusB === 'online') {
        comparison = 1;
      } else {
        comparison = statusA.localeCompare(statusB);
      }
      
      // Secondary sort by name if statuses are equal
      if (comparison === 0) {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        comparison = nameA.localeCompare(nameB);
      }
    } else if (column === 'rankPoints') {
      const rankPointsA = parseInt(a.rankPoints) || 0;
      const rankPointsB = parseInt(b.rankPoints) || 0;
      comparison = rankPointsA - rankPointsB;
      
      // Secondary sort by name if rankPoints are equal
      if (comparison === 0) {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        comparison = nameA.localeCompare(nameB);
      }
    } else if (column === 'timeSum') {
      const timeSumA = parseInt(a.timeSum) || 0;
      const timeSumB = parseInt(b.timeSum) || 0;
      comparison = timeSumA - timeSumB;
      
      // Secondary sort by name if timeSums are equal
      if (comparison === 0) {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        comparison = nameA.localeCompare(nameB);
      }
    }
    
    // Apply direction
    return direction === 'asc' ? comparison : -comparison;
  });
}

function saveVIPList(vipList) {
  try {
    // Sort before saving using current sort state
    const sortedList = sortVIPList(vipList);
    localStorage.setItem(VIP_LIST_STORAGE_KEY, JSON.stringify(sortedList));
  } catch (error) {
    console.error('[VIP List] Error saving VIP list:', error);
  }
}

function addToVIPList(playerName, playerInfo) {
  const vipList = getVIPList();
  // Check if player already exists
  const existingIndex = vipList.findIndex(vip => vip.name.toLowerCase() === playerName.toLowerCase());
  
  if (existingIndex >= 0) {
    // Update existing entry
    vipList[existingIndex] = playerInfo;
  } else {
    // Add new entry
    vipList.push(playerInfo);
  }
  
  saveVIPList(vipList);
  return vipList;
}

function removeFromVIPList(playerName) {
  const vipList = getVIPList();
  const filteredList = vipList.filter(vip => vip.name.toLowerCase() !== playerName.toLowerCase());
  saveVIPList(filteredList);
  return filteredList;
}

async function fetchPlayerData(playerName) {
  try {
    const apiUrl = `https://bestiaryarena.com/api/trpc/serverSide.profilePageData?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%22${encodeURIComponent(playerName)}%22%7D%7D`;
    
    const response = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch player data (HTTP ${response.status})`);
    }
    
    const data = await response.json();
    
    // Extract profile data from the response
    let profileData = null;
    if (Array.isArray(data) && data[0]?.result?.data?.json !== undefined) {
      profileData = data[0].result.data.json;
    } else {
      profileData = data;
    }
    
    return profileData;
  } catch (error) {
    console.error('[VIP List] Error fetching player data:', error);
    throw error;
  }
}

async function refreshAllVIPPlayerData() {
  const vipList = getVIPList();
  if (vipList.length === 0) return;
  
  console.log('[VIP List] Refreshing data for', vipList.length, 'VIP players...');
  
  // Get current player's name
  let currentPlayerName = null;
  try {
    const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
    if (playerState?.name) {
      currentPlayerName = playerState.name.toLowerCase();
    }
  } catch (error) {
    // Silently fail if we can't get player state
  }
  
  // Fetch data for all players in parallel
  const refreshPromises = vipList.map(async (vip) => {
    try {
      const profileData = await fetchPlayerData(vip.name || vip.profile);
      
      if (profileData === null) {
        // Player no longer exists, keep old data
        console.warn(`[VIP List] Player "${vip.name}" not found, keeping old data`);
        return vip;
      }
      
      // Calculate level from exp (same as Cyclopedia)
      const exp = profileData.exp || 0;
      const level = typeof exp === 'number' ? Math.floor(exp / 400) + 1 : 1;
      
      // Check if this is the current player
      const isCurrentPlayer = currentPlayerName && (profileData.name || vip.name).toLowerCase() === currentPlayerName;
      
      // Status: if current player, always Online; otherwise check updatedAt
      const status = isCurrentPlayer 
        ? 'Online' 
        : (profileData.updatedAt === null || profileData.updatedAt === undefined) ? 'Offline' : 'Online';
      
      // Extract rankPoints and timeSum (timeSum is stored as 'ticks' in profileData)
      const rankPoints = profileData.rankPoints !== undefined ? profileData.rankPoints : 0;
      const timeSum = profileData.ticks !== undefined ? profileData.ticks : 0;
      
      return {
        name: profileData.name || vip.name,
        level: level,
        status: status,
        rankPoints: rankPoints,
        timeSum: timeSum,
        profile: vip.profile || (profileData.name || vip.name).toLowerCase()
      };
    } catch (error) {
      console.error(`[VIP List] Error refreshing data for "${vip.name}":`, error);
      // Return old data if fetch fails
      return vip;
    }
  });
  
  const updatedList = await Promise.all(refreshPromises);
  // Sort and save the updated list
  saveVIPList(updatedList);
  console.log('[VIP List] Finished refreshing VIP player data');
  
  return sortVIPList(updatedList);
}

function injectVIPListItem(menuElement) {
  // Check if already processed
  if (processedMenus.has(menuElement)) {
    return false;
  }
  
  // Check if this is the "My Account" menu
  const menuText = menuElement.textContent || '';
  if (!menuText.toLowerCase().includes('my account')) {
    return false;
  }
  
  // Check if VIP List item already exists
  if (menuElement.querySelector('.vip-list-menu-item')) {
    processedMenus.add(menuElement);
    return false;
  }
  
  // Find the group container
  const group = menuElement.querySelector('div[role="group"]');
  if (!group) {
    return false;
  }
  
  // Find the separator before logout (or the logout button itself)
  const menuItems = Array.from(group.querySelectorAll('.dropdown-menu-item'));
  const logoutButton = menuItems.find(item => 
    item.textContent?.toLowerCase().includes('logout') || 
    item.querySelector('button')
  );
  
  if (!logoutButton) {
    return false;
  }
  
  // Create VIP List menu item
  const vipListItem = document.createElement('div');
  vipListItem.className = 'dropdown-menu-item relative flex cursor-default select-none items-center gap-2 outline-none text-whiteRegular vip-list-menu-item';
  vipListItem.setAttribute('role', 'menuitem');
  vipListItem.setAttribute('tabindex', '-1');
  vipListItem.setAttribute('data-orientation', 'vertical');
  vipListItem.setAttribute('data-radix-collection-item', '');
  
  // Add icon (using a star icon similar to other menu items)
  vipListItem.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-star" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
    </svg>
    VIP List
  `;
  
  // Add click handler
  vipListItem.addEventListener('click', (e) => {
    e.stopPropagation();
    openVIPListModal();
    // Close the menu
    setTimeout(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'Escape', 
        code: 'Escape', 
        keyCode: 27, 
        bubbles: true 
      }));
    }, 10);
  });
  
  // Add hover effects
  vipListItem.addEventListener('mouseenter', () => {
    vipListItem.style.background = 'rgba(255, 255, 255, 0.15)';
  });
  vipListItem.addEventListener('mouseleave', () => {
    vipListItem.style.background = 'transparent';
  });
  
  // Insert before the separator before logout (or before logout button)
  const separator = logoutButton.previousElementSibling;
  if (separator && separator.classList.contains('separator')) {
    separator.insertAdjacentElement('beforebegin', vipListItem);
  } else {
    logoutButton.insertAdjacentElement('beforebegin', vipListItem);
  }
  
  // Add separator before VIP List item if needed
  const prevItem = vipListItem.previousElementSibling;
  if (!prevItem || !prevItem.classList.contains('separator')) {
    const separator = document.createElement('div');
    separator.setAttribute('role', 'none');
    separator.setAttribute('aria-orientation', 'horizontal');
    separator.className = 'separator my-1';
    vipListItem.insertAdjacentElement('beforebegin', separator);
  }
  
  processedMenus.add(menuElement);
  console.log('[VIP List] Successfully injected VIP List menu item');
  return true;
}

function createVIPBox({headerRow, content}) {
  const box = document.createElement('div');
  box.style.flex = '1 1 0';
  box.style.display = 'flex';
  box.style.flexDirection = 'column';
  box.style.margin = '0';
  box.style.padding = '0';
  box.style.minHeight = '0';
  box.style.height = '100%';
  box.style.background = "url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat";
  box.style.border = '4px solid transparent';
  box.style.borderImage = `url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch`;
  box.style.borderRadius = '6px';
  box.style.overflow = 'hidden';
  
  // Replace title with header row
  const titleEl = document.createElement('h2');
  titleEl.className = 'widget-top widget-top-text pixel-font-16';
  titleEl.style.margin = '0';
  titleEl.style.padding = '0';
  titleEl.style.textAlign = 'center';
  titleEl.style.color = 'rgb(255, 255, 255)';
  titleEl.style.display = 'flex';
  titleEl.style.flexDirection = 'row';
  titleEl.style.alignItems = 'center';
  titleEl.style.width = '100%';
  
  // Append header row directly to title area (not cloned to preserve event listeners)
  if (headerRow) {
    // Remove sticky positioning since it's now static in title area
    headerRow.style.position = 'static';
    headerRow.style.top = 'auto';
    headerRow.style.zIndex = 'auto';
    headerRow.style.marginBottom = '0';
    headerRow.style.width = '100%';
    titleEl.appendChild(headerRow);
  }
  box.appendChild(titleEl);
  
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'column-content-wrapper';
  contentWrapper.style.flex = '1 1 0';
  contentWrapper.style.width = '100%';
  contentWrapper.style.height = '100%';
  contentWrapper.style.minHeight = '0';
  contentWrapper.style.overflowY = 'auto';
  contentWrapper.style.display = 'flex';
  contentWrapper.style.flexDirection = 'column';
  contentWrapper.style.padding = '3px';
  
  if (typeof content === 'string') {
    contentWrapper.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    contentWrapper.appendChild(content);
  }
  box.appendChild(contentWrapper);
  return box;
}

function createVIPHeaderRow() {
  const headerRow = document.createElement('div');
  headerRow.className = 'vip-header-row';
  headerRow.style.cssText = `
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 8px 0;
    margin-bottom: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-bottom: 2px solid rgba(255, 255, 255, 0.2);
    font-weight: bold;
    width: 100%;
  `;
  
  const createHeaderCell = (text, flex = '1', column = null, iconUrl = null) => {
    const cell = document.createElement('div');
    cell.style.cssText = `flex: ${flex}; color: rgb(255, 255, 255); text-align: center; white-space: nowrap; position: relative;`;
    
    if (column) {
      // Make it clickable
      cell.style.cursor = 'pointer';
      cell.style.userSelect = 'none';
      cell.style.display = 'flex';
      cell.style.alignItems = 'center';
      cell.style.justifyContent = 'center';
      
      // Add hover effect
      cell.addEventListener('mouseenter', () => {
        cell.style.background = 'rgba(255, 255, 255, 0.15)';
      });
      cell.addEventListener('mouseleave', () => {
        cell.style.background = 'transparent';
      });
      
      // Add click handler
      cell.addEventListener('click', () => {
        // Toggle direction if clicking same column, otherwise set default direction
        if (currentSortState.column === column) {
          currentSortState.direction = currentSortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
          currentSortState.column = column;
          // For level and rankPoints, default to desc (higher is better)
          // For other columns, default to asc
          currentSortState.direction = (column === 'level' || column === 'rankPoints') ? 'desc' : 'asc';
        }
        
        saveSortPreference();
        refreshVIPListDisplay();
      });
      
      // Create content (icon or text) - centered
      if (iconUrl) {
        const iconImg = document.createElement('img');
        iconImg.src = iconUrl;
        iconImg.alt = text;
        iconImg.style.cssText = 'width: 11px; height: 11px; image-rendering: pixelated; display: block;';
        cell.appendChild(iconImg);
      } else {
        const textSpan = document.createElement('span');
        textSpan.textContent = text;
        textSpan.style.whiteSpace = 'nowrap';
        cell.appendChild(textSpan);
      }
      
      // Add sort indicator positioned to the right
      const indicator = document.createElement('span');
      indicator.style.cssText = 'font-size: 12px; color: rgba(255, 255, 255, 0.7); margin-left: 4px;';
      
      if (currentSortState.column === column) {
        indicator.textContent = currentSortState.direction === 'asc' ? '↑' : '↓';
        indicator.style.color = 'rgb(100, 181, 246)';
      } else {
        indicator.textContent = '↕';
        indicator.style.opacity = '0.3';
      }
      
      cell.appendChild(indicator);
      
      // Add invisible spacer to balance the arrow and keep text centered
      const spacer = document.createElement('span');
      spacer.style.cssText = 'width: 12px; visibility: hidden;';
      cell.insertBefore(spacer, cell.firstChild);
    } else {
      // Non-clickable separator
      cell.textContent = text;
    }
    
    return cell;
  };
  
  headerRow.appendChild(createHeaderCell('Name', '2.0', 'name'));
  headerRow.appendChild(createHeaderCell('Level', '0.8', 'level'));
  headerRow.appendChild(createHeaderCell('Status', '0.9', 'status'));
  headerRow.appendChild(createHeaderCell('Rank Points', '0.9', 'rankPoints', 'https://bestiaryarena.com/assets/icons/star-tier.png'));
  headerRow.appendChild(createHeaderCell('Time Sum', '0.9', 'timeSum', 'https://bestiaryarena.com/assets/icons/speed.png'));
  
  return headerRow;
}

function createVIPListItem(vip) {
  const item = document.createElement('div');
  item.style.cssText = `
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 8px 0;
    margin-bottom: 4px;
    background: rgba(255, 255, 255, 0.05);
    width: 100%;
  `;
  
  // Get current player's name to check if this VIP is the current player
  let currentPlayerName = null;
  try {
    const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
    if (playerState?.name) {
      currentPlayerName = playerState.name.toLowerCase();
    }
  } catch (error) {
    // Silently fail if we can't get player state
  }
  
  // Check if this VIP is the current player
  const isCurrentPlayer = currentPlayerName && vip.name.toLowerCase() === currentPlayerName;
  const displayName = isCurrentPlayer ? `${vip.name} (you)` : vip.name;
  
  const createCell = (content, flex = '1', isLink = false) => {
    const cell = document.createElement('div');
    cell.style.cssText = `flex: ${flex}; text-align: center;`;
    
    if (isLink) {
      const link = document.createElement('a');
      link.href = content.href;
      link.target = '_blank';
      link.textContent = content.text;
      link.style.cssText = 'color: rgb(100, 181, 246); text-decoration: underline; cursor: pointer;';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        window.open(content.href, '_blank');
      });
      cell.appendChild(link);
    } else {
      cell.textContent = content;
      cell.style.color = typeof content === 'string' && content === 'Online' 
        ? 'rgb(76, 175, 80)' 
        : content === 'Offline'
        ? 'rgb(255, 107, 107)'
        : 'rgb(230, 215, 176)';
    }
    
    return cell;
  };
  
  const createSeparator = () => {
    const sep = document.createElement('div');
    sep.textContent = '|';
    sep.style.cssText = 'flex: 0.1; color: rgba(255, 255, 255, 0.3); text-align: center;';
    return sep;
  };
  
  // Create name cell with dropdown menu
  const nameCell = document.createElement('div');
  nameCell.style.cssText = 'flex: 2.0; text-align: center; position: relative;';
  
  const nameButton = document.createElement('button');
  nameButton.style.cssText = `
    background: transparent;
    border: none;
    color: rgb(230, 215, 176);
    cursor: pointer;
    padding: 0;
    text-decoration: none;
    font-size: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  `;
  
  // Create player name span (underlined)
  const nameSpan = document.createElement('span');
  nameSpan.textContent = vip.name;
  nameSpan.style.cssText = 'text-decoration: underline; margin-left: 15px;';
  nameButton.appendChild(nameSpan);
  
  // Add "(you)" span if current player (not underlined, italic, light blue)
  if (isCurrentPlayer) {
    const youSpan = document.createElement('span');
    youSpan.textContent = ' (you)';
    youSpan.style.cssText = 'text-decoration: none; font-style: italic; color: rgb(100, 181, 246);';
    nameButton.appendChild(youSpan);
  }
  
  // Dropdown menu
  const dropdown = document.createElement('div');
  dropdown.style.cssText = `
    display: none;
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat;
    border: 4px solid transparent;
    border-image: url('https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png') 4 fill;
    min-width: 120px;
    z-index: 1000;
    margin-top: 4px;
    padding: 4px;
  `;
  
  // Function to check if dropdown should open upward
  const shouldOpenUpward = () => {
    const buttonRect = nameButton.getBoundingClientRect();
    // Temporarily show dropdown to measure its height
    const wasVisible = dropdown.style.display === 'block';
    dropdown.style.visibility = 'hidden';
    dropdown.style.display = 'block';
    const dropdownHeight = dropdown.offsetHeight || 100; // Fallback to 100 if not measured
    dropdown.style.display = wasVisible ? 'block' : 'none';
    dropdown.style.visibility = 'visible';
    
    // Find the scrollable container
    const container = nameCell.closest('.column-content-wrapper');
    let spaceBelow = window.innerHeight - buttonRect.bottom;
    let spaceAbove = buttonRect.top;
    
    if (container) {
      const containerRect = container.getBoundingClientRect();
      // Calculate space within the visible scrollable area
      const visibleBottom = Math.min(containerRect.bottom, window.innerHeight);
      const visibleTop = Math.max(containerRect.top, 0);
      spaceBelow = visibleBottom - buttonRect.bottom;
      spaceAbove = buttonRect.top - visibleTop;
    }
    
    // Open upward if not enough space below (with some padding), and there's enough space above
    const requiredSpace = dropdownHeight + 10;
    return spaceBelow < requiredSpace && spaceAbove >= requiredSpace;
  };
  
  const createDropdownItem = (text, onClick) => {
    const menuItem = document.createElement('div');
    menuItem.textContent = text;
    menuItem.style.cssText = `
      padding: 6px 12px;
      color: rgb(230, 215, 176);
      cursor: pointer;
      font-size: 14px;
      text-align: left;
    `;
    menuItem.addEventListener('mouseenter', () => {
      menuItem.style.background = 'rgba(255, 255, 255, 0.1)';
    });
    menuItem.addEventListener('mouseleave', () => {
      menuItem.style.background = 'transparent';
    });
    menuItem.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
      dropdown.style.display = 'none';
    });
    return menuItem;
  };
  
  dropdown.appendChild(createDropdownItem('Profile', () => {
    window.open(`/profile/${vip.profile}`, '_blank');
  }));
  
  dropdown.appendChild(createDropdownItem('Cyclopedia', () => {
    const playerName = vip.name;
    
    // Close VIP List modal
    if (vipListModalInstance) {
      document.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'Escape', 
        code: 'Escape', 
        keyCode: 27, 
        bubbles: true 
      }));
      vipListModalInstance = null;
    }
    
    // Wait a bit for modal to close, then open Cyclopedia (similar to how Cyclopedia does it)
    setTimeout(() => {
      try {
        // Set searched player name in cyclopediaState before opening
        if (typeof cyclopediaState !== 'undefined') {
          cyclopediaState.searchedUsername = playerName;
        } else if (typeof window !== 'undefined' && window.cyclopediaState) {
          window.cyclopediaState.searchedUsername = playerName;
        }
        
        // Set selected category to Leaderboards
        if (typeof window !== 'undefined') {
          window.selectedCharacterItem = 'Leaderboards';
        }
        
        // Open Cyclopedia modal (similar to how Cyclopedia opens from context menu)
        if (typeof window !== 'undefined' && window.Cyclopedia && typeof window.Cyclopedia.show === 'function') {
          window.Cyclopedia.show({});
        } else if (typeof openCyclopediaModal === 'function') {
          openCyclopediaModal({});
        } else {
          console.warn('[VIP List] Could not find openCyclopediaModal function');
          return;
        }
        
        // After opening, navigate to Characters tab (index 1) and Leaderboards
        setTimeout(() => {
          // Set searched username again after modal opens
          if (typeof cyclopediaState !== 'undefined') {
            cyclopediaState.searchedUsername = playerName;
          } else if (typeof window !== 'undefined' && window.cyclopediaState) {
            window.cyclopediaState.searchedUsername = playerName;
          }
          
          // Find Characters tab button (index 1) - look for button with text "Characters"
          const tabButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
            const text = btn.textContent?.trim() || '';
            return text === 'Characters';
          });
          
          // Click Characters tab (should be index 1, but find by text to be safe)
          if (tabButtons.length > 0) {
            // Characters tab is typically the second tab (index 1)
            const charactersTab = tabButtons.find((btn, idx) => {
              // Check if it's in a tab navigation area
              const parent = btn.closest('[role="tablist"], .flex, nav');
              return parent !== null;
            }) || tabButtons[0];
            
            charactersTab.click();
          }
          
          // Wait for Characters tab to load, then click Leaderboards and trigger search
          setTimeout(() => {
            // Set searched username one more time
            if (typeof cyclopediaState !== 'undefined') {
              cyclopediaState.searchedUsername = playerName;
            } else if (typeof window !== 'undefined' && window.cyclopediaState) {
              window.cyclopediaState.searchedUsername = playerName;
            }
            
            // Set selected category to Leaderboards
            if (typeof window !== 'undefined') {
              window.selectedCharacterItem = 'Leaderboards';
            }
            
            // Find and set search input value
            const searchInput = document.querySelector('input[type="text"]');
            if (searchInput) {
              searchInput.value = playerName;
              // Trigger input event to update the value
              searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            
            // Find and click Leaderboards button (look in the Characters box)
            const leaderboardsButton = Array.from(document.querySelectorAll('div')).find(div => {
              const text = div.textContent?.trim() || '';
              return text === 'Leaderboards';
            });
            
            if (leaderboardsButton) {
              leaderboardsButton.click();
            }
            
            // Wait a bit, then trigger the search
            setTimeout(() => {
              // Find search button and click it to trigger search
              const searchButton = Array.from(document.querySelectorAll('button')).find(btn => {
                const text = btn.textContent?.trim() || '';
                return text === 'Search';
              });
              
              if (searchButton) {
                searchButton.click();
              }
            }, 100);
          }, 300);
        }, 200);
      } catch (error) {
        console.error('[VIP List] Error opening Cyclopedia:', error);
      }
    }, 10);
  }));
  
  dropdown.appendChild(createDropdownItem('Remove VIP', () => {
    removeFromVIPList(vip.name);
    refreshVIPListDisplay();
  }));
  
  nameButton.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = dropdown.style.display === 'block';
    // Close all other dropdowns
    document.querySelectorAll('.vip-dropdown-menu').forEach(menu => {
      if (menu !== dropdown) {
        menu.style.display = 'none';
      }
    });
    
    if (!isVisible) {
      // Check if we should open upward
      const openUpward = shouldOpenUpward();
      
      if (openUpward) {
        // Position above the button
        dropdown.style.top = 'auto';
        dropdown.style.bottom = '100%';
        dropdown.style.marginTop = '0';
        dropdown.style.marginBottom = '4px';
        dropdown.style.transform = 'translateX(-50%)';
      } else {
        // Position below the button (default)
        dropdown.style.top = '100%';
        dropdown.style.bottom = 'auto';
        dropdown.style.marginTop = '4px';
        dropdown.style.marginBottom = '0';
        dropdown.style.transform = 'translateX(-50%)';
      }
      
      dropdown.style.display = 'block';
      
      // Double-check after rendering and adjust if needed
      setTimeout(() => {
        const dropdownRect = dropdown.getBoundingClientRect();
        const viewportBottom = window.innerHeight;
        const viewportTop = 0;
        
        // If dropdown extends below viewport and we're opening downward, switch to upward
        if (!openUpward && dropdownRect.bottom > viewportBottom) {
          const buttonRect = nameButton.getBoundingClientRect();
          if (buttonRect.top >= dropdown.offsetHeight + 10) {
            dropdown.style.top = 'auto';
            dropdown.style.bottom = '100%';
            dropdown.style.marginTop = '0';
            dropdown.style.marginBottom = '4px';
          }
        }
        
        // If dropdown extends above viewport and we're opening upward, switch to downward
        if (openUpward && dropdownRect.top < viewportTop) {
          dropdown.style.top = '100%';
          dropdown.style.bottom = 'auto';
          dropdown.style.marginTop = '4px';
          dropdown.style.marginBottom = '0';
        }
      }, 0);
    } else {
      dropdown.style.display = 'none';
    }
  });
  
  // Setup global click handler for closing dropdowns (only once)
  setupVIPDropdownClickHandler();
  
  dropdown.className = 'vip-dropdown-menu';
  nameCell.appendChild(nameButton);
  nameCell.appendChild(dropdown);
  
  item.appendChild(nameCell);
  item.appendChild(createCell(vip.level, '0.8'));
  item.appendChild(createCell(vip.status, '0.9'));
  
  // Format rankPoints with locale string (e.g., 386)
  const rankPointsCell = createCell((vip.rankPoints !== undefined ? vip.rankPoints.toLocaleString() : '0'), '0.9');
  item.appendChild(rankPointsCell);
  
  // Format timeSum with locale string (e.g., 14 181)
  const timeSumCell = createCell((vip.timeSum !== undefined ? vip.timeSum.toLocaleString() : '0'), '0.9');
  item.appendChild(timeSumCell);
  
  return item;
}

function getVIPListContent() {
  const vipList = getVIPList();
  
  // Sort VIP list using current sort state
  const sortedList = sortVIPList(vipList);
  
  const container = document.createElement('div');
  container.style.cssText = 'width: 100%; display: flex; flex-direction: column;';
  
  // Header row is now in the title area, so don't add it here
  
  // Add VIP items
  if (sortedList.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.style.cssText = `
      padding: 20px;
      text-align: center;
      color: rgba(255, 255, 255, 0.6);
      font-size: 14px;
    `;
    emptyMessage.textContent = 'No VIP players added yet. Use the search box below to add players.';
    container.appendChild(emptyMessage);
  } else {
    sortedList.forEach(vip => {
      const item = createVIPListItem(vip);
      container.appendChild(item);
    });
  }
  
  return container;
}

function refreshVIPListDisplay() {
  if (vipListModalInstance) {
    // Find the content wrapper first, then find its parent VIP box
    const vipListBox = vipListModalInstance.querySelector('.column-content-wrapper');
    if (vipListBox) {
      // Find the VIP box parent (the div with background image)
      const vipBox = vipListBox.closest('div[style*="background"]');
      if (vipBox) {
        // Find the h2 inside the VIP box (must have pixel-font-16 class to distinguish from modal title)
        // The modal title h2 only has 'widget-top widget-top-text', not 'pixel-font-16'
        const titleEl = vipBox.querySelector('h2.widget-top.pixel-font-16');
        if (titleEl) {
          // Find and remove existing header row using class
          const existingHeader = titleEl.querySelector('.vip-header-row');
          if (existingHeader) {
            existingHeader.remove();
          }
          
          const newHeaderRow = createVIPHeaderRow();
          newHeaderRow.style.position = 'static';
          newHeaderRow.style.top = 'auto';
          newHeaderRow.style.zIndex = 'auto';
          newHeaderRow.style.marginBottom = '0';
          newHeaderRow.style.width = '100%';
          titleEl.appendChild(newHeaderRow);
        }
      }
      
      // Refresh content
      vipListBox.innerHTML = '';
      const newContent = getVIPListContent();
      vipListBox.appendChild(newContent);
    }
  }
}

async function openVIPListModal() {
  try {
    // Use the API's modal component if available
    if (typeof api !== 'undefined' && api.ui && api.ui.components && api.ui.components.createModal) {
      // Refresh all VIP player data before opening modal
      await refreshAllVIPPlayerData();
      
      const contentDiv = document.createElement('div');
      contentDiv.style.width = '100%';
      contentDiv.style.flex = '1 1 0';
      contentDiv.style.minHeight = '0';
      contentDiv.style.boxSizing = 'border-box';
      contentDiv.style.overflow = 'hidden';
      contentDiv.style.display = 'flex';
      contentDiv.style.flexDirection = 'row';
      contentDiv.style.gap = '8px';
      
      const headerRow = createVIPHeaderRow();
      const vipListBox = createVIPBox({
        headerRow: headerRow,
        content: getVIPListContent()
      });
      vipListBox.style.width = '100%';
      vipListBox.style.height = '100%';
      vipListBox.style.flex = '1 1 0';
      
      contentDiv.appendChild(vipListBox);
      
      const modal = api.ui.components.createModal({
        title: 'VIP List',
        width: 550,
        height: 360,
        content: contentDiv,
        buttons: [{ 
          text: 'Close', 
          primary: true,
          onClick: () => {
            vipListModalInstance = null;
          }
        }]
      });
      
      // Store modal instance for refreshing display
      setTimeout(() => {
        const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
        if (dialog) {
          vipListModalInstance = dialog;
        }
      }, 50);
      
      // Adjust dialog styles after creation (like Better Forge)
      setTimeout(() => {
        const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
        if (dialog) {
          dialog.style.width = '550px';
          dialog.style.minWidth = '550px';
          dialog.style.maxWidth = '550px';
          dialog.style.height = '360px';
          dialog.style.minHeight = '360px';
          dialog.style.maxHeight = '360px';
          const contentElem = dialog.querySelector('.modal-content, [data-content], .content, .modal-body, .widget-bottom');
          if (contentElem) {
            contentElem.style.width = '550px';
            contentElem.style.height = '360px';
            contentElem.style.display = 'flex';
            contentElem.style.flexDirection = 'column';
            contentElem.style.flex = '1 1 0';
            contentElem.style.minHeight = '0';
          }
          // Update separator before footer to match Better Forge style
          const separator = dialog.querySelector('.separator');
          if (separator) {
            separator.className = 'separator my-2.5';
          }
          
          // Add search input and Add button to footer
          const buttonContainer = dialog.querySelector('.flex.justify-end.gap-2');
          if (buttonContainer) {
            // Change layout to space-between
            buttonContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center; gap: 8px;';
            
            // Create search input container
            const searchContainer = document.createElement('div');
            searchContainer.style.cssText = 'display: flex; align-items: center; gap: 8px; flex: 1;';
            
            // Create search input
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'pixel-font-14 vip-search-input';
            const originalPlaceholder = 'Search player...';
            searchInput.placeholder = originalPlaceholder;
            searchInput.style.cssText = `
              flex: 1;
              min-width: 0;
              max-width: 200px;
              padding: 2px 8px;
              background: url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat;
              border: 4px solid transparent;
              border-image: url('https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png') 4 fill;
              color: rgb(255, 255, 255);
              font-size: 14px;
              text-align: left;
              box-sizing: border-box;
              max-height: 21px;
              height: 21px;
              line-height: normal;
            `;
            
            // Add style for red placeholder (error), green placeholder (success), and grey placeholder (duplicate)
            if (!document.getElementById('vip-search-input-styles')) {
              const style = document.createElement('style');
              style.id = 'vip-search-input-styles';
              style.textContent = `
                .vip-search-input.error::placeholder {
                  color: #ff6b6b !important;
                  font-style: italic;
                }
                .vip-search-input.success::placeholder {
                  color: #4caf50 !important;
                  font-style: italic;
                }
                .vip-search-input.duplicate::placeholder {
                  color: #888 !important;
                  font-style: italic;
                }
              `;
              document.head.appendChild(style);
            }
            
            // Function to add player
            const addPlayer = async () => {
              const playerName = searchInput.value.trim();
              if (!playerName) return;
              
              // Check if player is already in VIP list
              const vipList = getVIPList();
              const existingPlayer = vipList.find(vip => vip.name.toLowerCase() === playerName.toLowerCase());
              
              if (existingPlayer) {
                // Player already exists - show duplicate message in placeholder
                searchInput.value = ''; // Clear input so placeholder shows
                searchInput.placeholder = `${existingPlayer.name} already in your VIP List`;
                searchInput.classList.remove('error', 'success'); // Remove other classes
                searchInput.classList.add('duplicate'); // Add duplicate class for grey color
                
                // Restore original placeholder after 3 seconds
                setTimeout(() => {
                  searchInput.placeholder = originalPlaceholder;
                  searchInput.classList.remove('duplicate');
                }, 3000);
                
                return;
              }
              
              // Disable input and button while fetching
              searchInput.disabled = true;
              addButton.disabled = true;
              const originalButtonText = addButton.textContent;
              addButton.textContent = 'Adding...';
              
              try {
                const profileData = await fetchPlayerData(playerName);
                
                if (profileData === null) {
                  // Player doesn't exist - show error in placeholder
                  searchInput.value = ''; // Clear input so placeholder shows
                  searchInput.placeholder = 'Player not found';
                  searchInput.classList.remove('success', 'duplicate'); // Remove other classes
                  searchInput.classList.add('error');
                  
                  // Restore original placeholder after 3 seconds
                  setTimeout(() => {
                    searchInput.placeholder = originalPlaceholder;
                    searchInput.classList.remove('error');
                  }, 3000);
                  
                  searchInput.disabled = false;
                  addButton.disabled = false;
                  addButton.textContent = originalButtonText;
                  return;
                }
                
                // Extract player info from profile data
                // Calculate level from exp (same as Cyclopedia)
                const exp = profileData.exp || 0;
                const level = typeof exp === 'number' ? Math.floor(exp / 400) + 1 : 1;
                
                // Get current player's name to check if adding self
                let currentPlayerName = null;
                try {
                  const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
                  if (playerState?.name) {
                    currentPlayerName = playerState.name.toLowerCase();
                  }
                } catch (error) {
                  // Silently fail if we can't get player state
                }
                
                // Check if this is the current player
                const isCurrentPlayer = currentPlayerName && (profileData.name || playerName).toLowerCase() === currentPlayerName;
                
                // Status: if current player, always Online; otherwise check updatedAt
                const status = isCurrentPlayer 
                  ? 'Online' 
                  : (profileData.updatedAt === null || profileData.updatedAt === undefined) ? 'Offline' : 'Online';
                
                // Extract rankPoints and timeSum (timeSum is stored as 'ticks' in profileData)
                const rankPoints = profileData.rankPoints !== undefined ? profileData.rankPoints : 0;
                const timeSum = profileData.ticks !== undefined ? profileData.ticks : 0;
                
                const playerInfo = {
                  name: profileData.name || playerName,
                  level: level,
                  status: status,
                  rankPoints: rankPoints,
                  timeSum: timeSum,
                  profile: playerName.toLowerCase()
                };
                
                // Add to VIP list
                addToVIPList(playerName, playerInfo);
                
                // Refresh display
                refreshVIPListDisplay();
                
                // Show success message in placeholder
                searchInput.value = ''; // Clear input so placeholder shows
                searchInput.placeholder = `Added ${playerInfo.name} to VIP List`;
                searchInput.classList.remove('error', 'duplicate'); // Remove other classes
                searchInput.classList.add('success'); // Add success class for green color
                
                // Restore original placeholder after 3 seconds
                setTimeout(() => {
                  searchInput.placeholder = originalPlaceholder;
                  searchInput.classList.remove('success');
                }, 3000);
                
                console.log('[VIP List] Added player:', playerName);
              } catch (error) {
                console.error('[VIP List] Error adding player:', error);
                alert(`Failed to add player "${playerName}". Please try again.`);
              } finally {
                searchInput.disabled = false;
                addButton.disabled = false;
                addButton.textContent = originalButtonText;
              }
            };
            
            // Add Enter key support
            searchInput.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addPlayer();
              }
            });
            
            // Create Add button
            const addButton = document.createElement('button');
            addButton.textContent = 'Add';
            addButton.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14';
            addButton.style.cssText = `
              cursor: pointer;
              white-space: nowrap;
              box-sizing: border-box;
              max-height: 21px;
              height: 21px;
            `;
            addButton.addEventListener('click', addPlayer);
            
            searchContainer.appendChild(searchInput);
            searchContainer.appendChild(addButton);
            
            // Insert search container before Close button
            buttonContainer.insertBefore(searchContainer, buttonContainer.firstChild);
          }
        }
      }, 100);
      
      console.log('[VIP List] Modal opened');
      return modal;
    } else {
      // Fallback to window.BestiaryModAPI if available
      if (typeof window !== 'undefined' && window.BestiaryModAPI && window.BestiaryModAPI.showModal) {
        window.BestiaryModAPI.showModal({
          title: 'VIP List',
          content: '<p>VIP List content will go here.</p>',
          buttons: [{ text: 'Close', primary: false }]
        });
        console.log('[VIP List] Modal opened (fallback)');
        return true;
      } else {
        console.error('[VIP List] Modal API not available');
        return false;
      }
    }
  } catch (error) {
    console.error('[VIP List] Error opening modal:', error);
    return false;
  }
}

function startAccountMenuObserver() {
  if (accountMenuObserver) {
    return;
  }
  
  const processMutations = (mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        
        // Check if this is a menu element
        const isMenu = node.getAttribute?.('role') === 'menu';
        const hasMenu = node.querySelector?.('[role="menu"]');
        
        const menu = isMenu ? node : hasMenu;
        if (menu) {
          setTimeout(() => {
            injectVIPListItem(menu);
          }, 10);
        }
      }
    }
  };
  
  accountMenuObserver = new MutationObserver(processMutations);
  accountMenuObserver.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
  
  // Also check for existing menus
  setTimeout(() => {
    const menus = document.querySelectorAll('[role="menu"]');
    menus.forEach(menu => {
      injectVIPListItem(menu);
    });
  }, 500);
  
  console.log('[VIP List] Account menu observer started');
}

function stopAccountMenuObserver() {
  if (accountMenuObserver) {
    accountMenuObserver.disconnect();
    accountMenuObserver = null;
    console.log('[VIP List] Account menu observer stopped');
  }
}

// =======================
// 4. Exports & Lifecycle Management
// =======================

exports = {
  init: function() {
    try {
      // Ensure config is loaded from localStorage first (prioritize localStorage like Rank Pointer)
      loadVIPListConfig();
      
      startAccountMenuObserver();
      return true;
    } catch (error) {
      console.error('[VIP List] Initialization error:', error);
      return false;
    }
  },
  
  cleanup: function() {
    try {
      stopAccountMenuObserver();
      
      // Remove injected menu items
      const vipListItems = document.querySelectorAll('.vip-list-menu-item');
      vipListItems.forEach(item => {
        try {
          if (item.parentNode) {
            item.parentNode.removeChild(item);
          }
        } catch (error) {
          console.warn('[VIP List] Error removing menu item:', error);
        }
      });
      
      // Clear processed menus set (WeakSet doesn't have clear, so we just reset the reference)
      // Note: WeakSet entries are automatically garbage collected when elements are removed
      
      console.log('[VIP List] Cleaned up successfully');
      return true;
    } catch (error) {
      console.error('[VIP List] Cleanup error:', error);
      return false;
    }
  }
};

// Legacy window object for backward compatibility
if (typeof window !== 'undefined') {
  window.VIPList = {
    init: exports.init,
    cleanup: exports.cleanup
  };
}

// Auto-initialize if running in mod context
if (typeof context !== 'undefined' && context.api) {
  exports.init();
}

