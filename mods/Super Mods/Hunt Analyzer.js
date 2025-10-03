// Hunt Analyzer Mod for Bestiary Arena

// =======================
// 0. Version
// =======================
const HUNT_ANALYZER_VERSION = "1.1.0"; // Patch version

// =======================
// 1. Constants & Globals
// =======================
const PANEL_ID = "mod-autoplay-analyzer-panel";
const BUTTON_ID = "mod-autoplay-button";
const GOLD_SPRITE_ID = 3031;
const DUST_ICON_SRC = '/assets/icons/dust.png';
const LAYOUT_MODES = {
    VERTICAL: 'vertical',
    HORIZONTAL: 'horizontal',
    MINIMIZED: 'minimized'
};
const LAYOUT_DIMENSIONS = {
    [LAYOUT_MODES.VERTICAL]: { width: 350, height: 750, minWidth: 260, maxWidth: 500, minHeight: 500, maxHeight: 750 },
    [LAYOUT_MODES.HORIZONTAL]: { width: 750, height: 300, minWidth: 650, maxWidth: 1000, minHeight: 220, maxHeight: 400 },
    [LAYOUT_MODES.MINIMIZED]: { width: 250, height: 250, minWidth: 250, maxWidth: 250, minHeight: 250, maxHeight: 250 }
};

let autoplayCount = 0;
let modOverallStartTime = 0;
let totalGoldQuantity = 0;
let totalCreatureDrops = 0;
let totalEquipmentDrops = 0;
let totalDustQuantity = 0;
let totalStaminaSpent = 0;
let allGameSessionsData = [];
let globalAggregatedLootData = new Map();
let globalAggregatedCreatureData = new Map();
let isGameActive = false;
let sessionStartTime = 0;
let updateIntervalId = null;
let lastSeed = null;

// Cleanup references
let boardSubscription = null;
let gameTimerSubscription = null;

// Global variable for autoplay state - Declared once at the top
let autoplayLogText = ""; 

// Cached DOM
let cachedLootDiv = null;
let cachedCreatureDropDiv = null;
let cachedAutoplayCounterElement = null;
let cachedAutoplayRateElement = null;
let cachedGoldRateElement = null;
let cachedCreatureRateElement = null;
let cachedEquipmentRateElement = null;
let cachedRoomIdDisplayElement = null;
let cachedTotalGoldDisplayElement = null;
let cachedTotalDustDisplayElement = null;
let cachedTotalStaminaSpentElement = null;

// Add cache for item visuals
const itemVisualCache = new Map();

// =======================
// 2. Utility Functions
// =======================
/**
 * Checks if the current game mode is sandbox mode.
 * @returns {boolean} True if in sandbox mode, false otherwise.
 */
function isSandboxMode() {
    try {
        const boardContext = globalThis.state.board.getSnapshot().context;
        return boardContext.mode === 'sandbox';
    } catch (error) {
        console.error("[Hunt Analyzer] Error checking sandbox mode:", error);
        return false;
    }
}

function formatNameToTitleCase(name) {
    if (!name || typeof name !== 'string') return 'Unknown Item';
    let formatted = name.replace(/-/g, ' ');
    formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
    return formatted.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map(num => num.toString().padStart(2, '0')).join(':');
}
function getRarityBorderColor(tierLevel) {
    switch (tierLevel) {
        case 1: return "#ABB2BF";
        case 2: return "#98C379";
        case 3: return "#61AFEF";
        case 4: return "#C678DD";
        case 5: return "#E5C07B";
        default: return "#3A404A";
    }
}
const iconMap = {
    ap: "/assets/icons/abilitypower.png",
    ad: "/assets/icons/attackdamage.png",
    hp: "/assets/icons/heal.png",
    magicResist: "/assets/icons/magicresist.png",
    armor: "/assets/icons/armor.png",
    speed: "/assets/icons/speed.png",
    level: "/assets/icons/achievement.png"
};
function createItemSprite(itemId, tooltipKey = '') {
    const spriteContainer = document.createElement('div');
    spriteContainer.className = `sprite item relative id-${itemId}`;
    spriteContainer.style.width = '36px';
    spriteContainer.style.height = '36px';
    spriteContainer.style.imageRendering = 'pixelated';
    spriteContainer.style.margin = '0';
    spriteContainer.style.borderRadius = '3px';
    spriteContainer.title = tooltipKey || `ID-${itemId}`;
    const viewport = document.createElement('div');
    viewport.className = 'viewport';
    const img = document.createElement('img');
    img.alt = tooltipKey || String(itemId);
    img.setAttribute('data-cropped', 'false');
    img.className = 'spritesheet';
    img.style.setProperty('--cropX', '0');
    img.style.setProperty('--cropY', '0');
    viewport.appendChild(img);
    spriteContainer.appendChild(viewport);
    return spriteContainer;
}
function getEquipmentNameFromId(gameId) {
    try {
        const equipData = globalThis.state.utils.getEquipment(gameId);
        return equipData && equipData.metadata ? equipData.metadata.name : null;
    } catch (e) { return null; }
}
function getMonsterNameFromId(gameId) {
    try {
        const monsterData = globalThis.state.utils.getMonster(gameId);
        return monsterData && monsterData.metadata ? monsterData.metadata.name : null;
    } catch (e) { return null; }
}
function getCreatureTierDetails(genes) {
    const totalStats = genes.hp + genes.ad + genes.ap + genes.armor + genes.magicResist;
    let tierName = "Unknown Tier", tierLevel = 0;
    if (totalStats >= 80) { tierName = "Yellow Tier"; tierLevel = 5; }
    else if (totalStats >= 70) { tierName = "Purple Tier"; tierLevel = 4; }
    else if (totalStats >= 60) { tierName = "Blue Tier"; tierLevel = 3; }
    else if (totalStats >= 50) { tierName = "Green Tier"; tierLevel = 2; }
    else if (totalStats >= 5) { tierName = "Grey Tier"; tierLevel = 1; }
    return { totalStats, tierName, tierLevel };
}
function getItemVisual(itemData) {
    let recognizedName = itemData.tooltipKey || 'Unknown Item';
    if (itemData.isEquipment && typeof globalThis.state?.utils?.getEquipment === 'function' && itemData.gameId) {
        try {
            const equipData = globalThis.state.utils.getEquipment(itemData.gameId);
            if (equipData && equipData.metadata && typeof equipData.metadata.spriteId === 'number') {
                const equipmentSpriteId = equipData.metadata.spriteId;
                recognizedName = equipData.metadata.name || recognizedName;
                const spriteDiv = createItemSprite(equipmentSpriteId, recognizedName);
                return { visualElement: spriteDiv, recognizedName: formatNameToTitleCase(recognizedName) };
            }
        } catch (e) { console.error("[Hunt Analyzer] Error getting equipment name:", e); }
    }
    if (itemData.spriteId === GOLD_SPRITE_ID) {
        const img = document.createElement('img');
        img.src = '/assets/icons/goldpile.png';
        img.alt = 'Gold';
        img.style.width = '36px';
        img.style.height = '36px';
        img.style.imageRendering = 'pixelated';
        img.style.borderRadius = '3px';
        recognizedName = 'Gold';
        return { visualElement: img, recognizedName: recognizedName };
    }
    if (itemData.spriteSrc && itemData.spriteSrc.includes('dust')) {
        const img = document.createElement('img');
        img.src = DUST_ICON_SRC;
        img.alt = 'Dust';
        img.style.width = '36px';
        img.style.height = '36px';
        img.style.imageRendering = 'pixelated';
        img.style.borderRadius = '3px';
        recognizedName = 'Dust';
        return { visualElement: img, recognizedName: recognizedName };
    }
    if (itemData.stat && iconMap[itemData.stat]) {
        const img = document.createElement('img');
        img.src = iconMap[itemData.stat];
        img.alt = itemData.tooltipKey || itemData.stat;
        recognizedName = formatNameToTitleCase(itemData.tooltipKey || `${itemData.stat.toUpperCase()} Stat`);
        img.style.width = '36px';
        img.style.height = '36px';
        img.style.imageRendering = 'pixelated';
        img.style.borderRadius = '3px';
        return { visualElement: img, recognizedName: recognizedName };
    }
    if (itemData.spriteId) {
        const spriteDiv = createItemSprite(itemData.spriteId, itemData.tooltipKey);
        recognizedName = formatNameToTitleCase(itemData.tooltipKey || `ID-${itemData.spriteId}`);
        return { visualElement: spriteDiv, recognizedName: recognizedName };
    }
    if (itemData.spriteSrc) {
        const img = document.createElement('img');
        img.src = itemData.spriteSrc;
        img.alt = itemData.tooltipKey || 'item';
        recognizedName = formatNameToTitleCase(itemData.tooltipKey || 'Item with Direct Image');
        img.style.width = '36px';
        img.style.height = '36px';
        img.style.imageRendering = 'pixelated';
        img.style.borderRadius = '3px';
        return { visualElement: img, recognizedName: recognizedName };
    }
    if (itemData.stat) {
        const emojiMap = {
            hp: '❤️', ad: '⚔️', ap: '🧙', armor: '🛡️',
            magicresist: '🔮', speed: '💨', level: '⬆️'
        };
        const emoji = emojiMap[itemData.stat.toLowerCase()] || '🪖';
        recognizedName = formatNameToTitleCase(itemData.tooltipKey || `${itemData.stat.toUpperCase()} Stat`);
        const visualElement = document.createElement('span');
        visualElement.textContent = emoji;
        visualElement.style.fontSize = '24px';
        visualElement.style.width = '36px';
        visualElement.style.height = '36px';
        visualElement.style.display = 'flex';
        visualElement.style.justifyContent = 'center';
        visualElement.style.alignItems = 'center';
        return { visualElement, recognizedName };
    }
    // Fallback for unknown items
    const fallbackSpan = document.createElement('span');
    fallbackSpan.textContent = '🎲';
    fallbackSpan.style.fontSize = '24px';
    fallbackSpan.style.width = '36px';
    fallbackSpan.style.height = '36px';
    fallbackSpan.style.display = 'flex';
    fallbackSpan.style.justifyContent = 'center';
    fallbackSpan.style.alignItems = 'center';
    return { visualElement: fallbackSpan, recognizedName: formatNameToTitleCase(recognizedName) };
}
function getCreatureDetails(monsterDrop) {
    let name = `GameID: ${monsterDrop.gameId}`;
    const friendlyName = getMonsterNameFromId(monsterDrop.gameId);
    if (friendlyName) name = friendlyName;
    name = formatNameToTitleCase(name);
    const creatureVisualImg = document.createElement('img');
    creatureVisualImg.src = `/assets/portraits/${monsterDrop.gameId}.png`;
    creatureVisualImg.alt = name;
    creatureVisualImg.style.width = '36px';
    creatureVisualImg.style.height = '36px';
    creatureVisualImg.style.imageRendering = 'pixelated';
    creatureVisualImg.style.borderRadius = '3px';
    let visual = creatureVisualImg;
    const { totalStats, tierName, tierLevel } = getCreatureTierDetails(monsterDrop.genes);
    return { name, visual, rarity: tierLevel, totalStats, tierName, tierLevel, gameId: monsterDrop.gameId };
}
function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    let success = false;
    try { success = document.execCommand('copy'); } catch (err) { console.error("[Hunt Analyzer] Failed to copy to clipboard:", err); } // Added prefix
    document.body.removeChild(textarea);
    return success;
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

// =======================
// 3. Data Processing Functions
// =======================
/**
 * Renders all stored game sessions to the analyzer panel.
 * This function now clears existing content and redraws everything as a single, combined, sorted list.
 */
function renderAllSessions() {
    // Check if the panel is open first
    if (!document.getElementById(PANEL_ID)) {
        return; // Silently return if panel is not open
    }
    
    if (!cachedLootDiv || !cachedCreatureDropDiv || !cachedTotalGoldDisplayElement || !cachedTotalDustDisplayElement) {
        console.warn("[Hunt Analyzer] Render target divs or gold/dust display elements not available. Panel might not be open.");
        return;
    }

    cachedLootDiv.innerHTML = ''; // Clear previous content
    cachedCreatureDropDiv.innerHTML = ''; // Clear previous content
    totalGoldQuantity = 0; // Recalculate totals from stored data
    totalCreatureDrops = 0;
    totalEquipmentDrops = 0; // Recalculate total equipment drops
    totalDustQuantity = 0; // Recalculate total dust drops

    // Clear global aggregated data before re-populating from all sessions
    globalAggregatedLootData.clear();
    globalAggregatedCreatureData.clear();

    // Aggregate data from all sessions into the global maps
    allGameSessionsData.forEach(sessionData => {
        sessionData.loot.forEach(item => {
            const mapKey = `${item.originalName}_${item.rarity}_${item.spriteId}_${item.src}_${item.isEquipment}_${item.stat}`; // More specific key
            if (globalAggregatedLootData.has(mapKey)) {
                const existing = globalAggregatedLootData.get(mapKey);
                existing.count += item.count;
                globalAggregatedLootData.set(mapKey, existing);
            } else {
                globalAggregatedLootData.set(mapKey, { ...item });
            }

            // Accumulate global totals for Gold, Dust, and Equipment based on originalName
            if (item.originalName === 'Gold') {
                totalGoldQuantity += item.count;
            } else if (item.originalName === 'Dust') {
                totalDustQuantity += item.count;
            } else if (item.isEquipment) { // Assuming `isEquipment` flag is set by processAutoplaySummary
                totalEquipmentDrops += item.count;
            }
        });

        sessionData.creatures.forEach(creature => {
            const mapKey = `${creature.gameId}_${creature.tierLevel}`;
            if (globalAggregatedCreatureData.has(mapKey)) {
                const existing = globalAggregatedCreatureData.get(mapKey);
                existing.count += creature.count;
                globalAggregatedCreatureData.set(mapKey, existing);
            } else {
                globalAggregatedCreatureData.set(mapKey, { ...creature });
            }
        });
    });

    // Update Gold and Dust display next to Loot title
    if (cachedTotalGoldDisplayElement) {
        cachedTotalGoldDisplayElement.textContent = totalGoldQuantity;
    }
    if (cachedTotalDustDisplayElement) {
        cachedTotalDustDisplayElement.textContent = totalDustQuantity;
    }

    // Filter out Gold and Dust from the main loot display (as they have separate totals)
    const filteredLoot = Array.from(globalAggregatedLootData.values()).filter(item =>
        item.originalName !== 'Gold' && item.originalName !== 'Dust'
    );

    // Sort and render overall filtered loot based on new rules
    const sortedFilteredLoot = filteredLoot.sort((a, b) => {
        // Rule 1: equipDrop items come before non-equipDrop items
        if (a.isEquipment && !b.isEquipment) {
            return -1; // a (equipment) comes before b (non-equipment)
        }
        if (!a.isEquipment && b.isEquipment) {
            return 1; // b (equipment) comes before a (non-equipment)
        }

        // If both are equipment or both are non-equipment, apply secondary rules
        if (a.isEquipment && b.isEquipment) {
            // Rule 2.1: If both are equipDrop, sort by GameId
            if (a.gameId !== b.gameId) {
                return a.gameId - b.gameId;
            }
            // Rule 2.2: Then by Stat (alphabetical)
            if (a.stat && b.stat) {
                return a.stat.localeCompare(b.stat);
            }
            // Fallback for equipment if stats are same or missing
            return a.originalName.localeCompare(b.originalName);
        } else {
            // Rule 3.1: If both are non-equipDrop, sort by TooltipKey (originalName)
            const nameCompare = a.originalName.localeCompare(b.originalName);
            if (nameCompare !== 0) {
                return nameCompare;
            }
            // Rule 3.2: Then by rarityLevel (rarity) (ascending)
            return a.rarity - b.rarity;
        }
    });

    sortedFilteredLoot.forEach((data) => {
        const itemEntryDiv = document.createElement('div');
        itemEntryDiv.style.display = 'flex';
        itemEntryDiv.style.flexDirection = 'row';
        itemEntryDiv.style.alignItems = 'center';
        itemEntryDiv.style.justifyContent = 'flex-start';
        itemEntryDiv.style.border = `1px solid ${data.rarityBorderColor}`;
        itemEntryDiv.style.borderRadius = '5px';
        itemEntryDiv.style.padding = '4px 8px';
        itemEntryDiv.style.backgroundColor = '#3B4048';
        itemEntryDiv.style.flexShrink = '0';
        itemEntryDiv.style.width = '100%';
        itemEntryDiv.style.height = '48px'; /* Fixed height for loot items */
        itemEntryDiv.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.4)';
        itemEntryDiv.style.transition = 'all 0.2s ease-out';


        const iconWrapper = document.createElement('div'); // Changed from iconSpan to iconWrapper
        iconWrapper.style.flexShrink = '0';
        iconWrapper.style.marginRight = '8px';
        // The visual will be an HTMLElement (img or div.sprite) or a string (emoji)
        // Ensure it's treated as HTMLElement if it is.
        if (data.visual instanceof HTMLElement) {
            iconWrapper.appendChild(data.visual);
        } else {
            // Fallback for emojis or plain text if getItemVisual returns string
            iconWrapper.textContent = data.visual;
            iconWrapper.style.fontSize = '24px'; // Make emoji/text larger
            iconWrapper.style.width = '36px';
            iconWrapper.style.height = '36px';
            iconWrapper.style.display = 'flex';
            iconWrapper.style.justifyContent = 'center';
            iconWrapper.style.alignItems = 'center';
        }
        itemEntryDiv.appendChild(iconWrapper);

        const nameSpan = document.createElement('span');
        nameSpan.style.flexGrow = '1';
        nameSpan.style.color = '#ABB2BF';
        nameSpan.style.fontSize = "10px";
        nameSpan.style.whiteSpace = 'nowrap';
        nameSpan.style.overflow = 'hidden';
        nameSpan.style.textOverflow = 'ellipsis';
        nameSpan.textContent = data.originalName; // Simply display the name
        itemEntryDiv.appendChild(nameSpan);

        const lootInfoSpan = document.createElement('span');
        lootInfoSpan.style.flexShrink = '0';
        lootInfoSpan.style.marginLeft = '8px';
        lootInfoSpan.style.fontSize = "10px";
        lootInfoSpan.style.fontFamily = 'inherit';
        lootInfoSpan.style.textAlign = 'right';

        // Check if the item is equipment and has a stat icon
        if (data.isEquipment && data.stat && iconMap[data.stat]) {
            const statIconImg = document.createElement('img');
            statIconImg.src = iconMap[data.stat];
            statIconImg.alt = data.stat.toUpperCase();
            statIconImg.style.width = '14px'; // Small icon
            statIconImg.style.height = '14px';
            statIconImg.style.verticalAlign = 'middle';
            statIconImg.style.marginRight = '2px';
            statIconImg.style.imageRendering = 'pixelated';

            lootInfoSpan.appendChild(statIconImg);
            const textNode = document.createTextNode(` (x${data.count})`);
            lootInfoSpan.appendChild(textNode);
            lootInfoSpan.style.color = data.rarityBorderColor; // Keep rarity color for equipment
        } else if (data.rarity > 0) {
            lootInfoSpan.textContent = `Rarity: ${data.rarity} (x${data.count})`;
            lootInfoSpan.style.color = data.rarityBorderColor;
        } else {
            lootInfoSpan.textContent = `x${data.count}`;
            lootInfoSpan.style.color = '#ABB2BF';
        }
        itemEntryDiv.appendChild(lootInfoSpan);
        cachedLootDiv.appendChild(itemEntryDiv);
    });

    // Sort and render overall aggregated creatures
    const sortedOverallCreatures = Array.from(globalAggregatedCreatureData.values()).sort((a, b) => {
        // Sort by GameId (which is stored in 'gameId' property), then by tierLevel
        if (a.gameId !== b.gameId) {
            return a.gameId - b.gameId; // Sort by GameId numerically
        }
        return a.tierLevel - b.tierLevel; // Then by tier level
    });

    sortedOverallCreatures.forEach((data) => {
        const creatureEntryDiv = document.createElement('div');
        creatureEntryDiv.style.display = 'flex';
        creatureEntryDiv.style.flexDirection = 'row';
        creatureEntryDiv.style.alignItems = 'center';
        creatureEntryDiv.style.justifyContent = 'flex-start';
        // Use tierLevel for border color
        creatureEntryDiv.style.border = `1px solid ${getRarityBorderColor(data.tierLevel)}`;
        creatureEntryDiv.style.borderRadius = '5px';
        creatureEntryDiv.style.padding = '4px 8px';
        creatureEntryDiv.style.backgroundColor = '#3B4048';
        creatureEntryDiv.style.flexShrink = '0';
        creatureEntryDiv.style.width = '100%';
        creatureEntryDiv.style.height = '48px'; /* Fixed height for creature items */
        creatureEntryDiv.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.4)'; // Corrected application
        creatureEntryDiv.style.transition = 'all 0.2s ease-out'; // Corrected application

        const iconWrapper = document.createElement('div'); // Wrapper for the creature icon
        iconWrapper.style.flexShrink = '0';
        iconWrapper.style.marginRight = '8px';
        iconWrapper.style.width = '36px'; // Size for the icon
        iconWrapper.style.height = '36px';
        iconWrapper.style.display = 'flex';
        iconWrapper.style.justifyContent = 'center';
        iconWrapper.style.alignItems = 'center';

        // Append the visual element (which is now an <img>) to the wrapper
        if (data.visual instanceof HTMLElement) {
            iconWrapper.appendChild(data.visual);
        } else {
            // Fallback for non-image visuals (e.g., if getCreatureDetails ever returns string)
            iconWrapper.textContent = data.visual;
            iconWrapper.style.fontSize = '24px'; // Apply font size for emojis/text
        }
        creatureEntryDiv.appendChild(iconWrapper);

        const nameSpan = document.createElement('span');
        nameSpan.style.flexGrow = '1';
        // Display creature name as "GameID: X" or friendly name if available
        nameSpan.textContent = data.originalName; // Now storing the friendly name or GameID: X
        nameSpan.style.fontSize = "10px";
        nameSpan.style.color = '#ABB2BF';
        nameSpan.style.whiteSpace = 'nowrap';
        nameSpan.style.overflow = 'hidden';
        nameSpan.style.textOverflow = 'ellipsis';
        creatureEntryDiv.appendChild(nameSpan);

        const tierAndCountText = document.createElement('span');
        tierAndCountText.style.flexShrink = '0';
        tierAndCountText.style.marginLeft = '8px';
        tierAndCountText.style.fontSize = "10px";
        tierAndCountText.style.fontFamily = 'inherit';
        tierAndCountText.style.textAlign = 'right';
        // Apply tier-based color
        tierAndCountText.style.color = getRarityBorderColor(data.tierLevel);

        tierAndCountText.textContent = `${data.tierName} (x${data.count})`; // Display tier name and count

        creatureEntryDiv.appendChild(tierAndCountText);
        cachedCreatureDropDiv.appendChild(creatureEntryDiv);
        totalCreatureDrops += data.count; // Accumulate for overall rate
    });

    updatePanelDisplay(); // Update overall rates after rendering all sessions
}


/**
 * PROCESSES THE CONTENT OF AN AUTOPLAY SUMMARY USING A 'serverResults' OBJECT.
 * This function now extracts data from the serverResults and adds it to the
 * `allGameSessionsData` array. It does NOT render directly.
 *
 * @param {FullServerResults} serverResults - The structured data containing game outcome, loot, and creature drops.
 */
function processAutoplaySummary(serverResults) {
    if (!serverResults?.rewardScreen) return;

    const { rewardScreen } = serverResults;
    const autoplayMessage = rewardScreen.victory ? "Victory!" : "Defeat!";
    const aggregatedLootForSession = new Map();
    const aggregatedCreaturesForSession = new Map();
    const currentLootItemsLog = []; // Initialize the array for logging current session's loot

    // Update Room ID display in header
    if (cachedRoomIdDisplayElement && rewardScreen.roomId) {
        const roomNamesMap = globalThis.state?.utils?.ROOM_NAME;
        let readableRoomName = roomNamesMap?.[rewardScreen.roomId] || `Room ID: ${rewardScreen.roomId}`;
        const boostedRoomId = rewardScreen.boostedRoomId || globalThis.state.daily?.getSnapshot?.()?.context?.boostedMap?.roomId;
        if (boostedRoomId === rewardScreen.roomId) {
            readableRoomName += ' (boosted)';
        }
        cachedRoomIdDisplayElement.textContent = readableRoomName;
    }

    // Process Gold
    if (rewardScreen.loot?.goldAmount > 0) {
        const goldAmount = rewardScreen.loot.goldAmount;
        const { visualElement: goldVisual, recognizedName: goldName } = getItemVisual({
            spriteId: GOLD_SPRITE_ID,
            tooltipKey: 'Gold',
            amount: goldAmount
        });

        aggregatedLootForSession.set('Gold', {
            count: goldAmount,
            visual: goldVisual,
            originalName: goldName,
            rarity: 0,
            rarityBorderColor: getRarityBorderColor(0),
            spriteId: GOLD_SPRITE_ID,
            src: '/assets/icons/goldpile.png',
            isEquipment: false,
            stat: null
        });
    }

    // Process all loot items
    const allLootItems = [
        ...(rewardScreen.loot.droppedItems || []),
        ...(rewardScreen.equipDrop ? [rewardScreen.equipDrop] : [])
    ];

    for (const item of allLootItems) {
        if (item.spriteId === GOLD_SPRITE_ID || 
            (item.tooltipKey && item.tooltipKey.toLowerCase() === 'gold') ||
            item.spriteId === 10327) { // Skip gold and heal potion
            continue;
        }

        const isEquipment = rewardScreen.equipDrop === item || (item.stat && item.gameId && item.tier);
        const rarity = item.rarityLevel || item.tier || 0;
        const rarityBorderColor = getRarityBorderColor(rarity);
        
        let itemName = 'Unknown Item';
        if (item.tooltipKey?.toLowerCase().includes('dust')) {
            itemName = 'Dust';
        } else if (isEquipment) {
            itemName = getEquipmentNameFromId(item.gameId) || 
                      `${item.stat.toUpperCase()} Equipment Tier ${item.tier}`;
        } else if (item.tooltipKey) {
            itemName = item.tooltipKey;
        } else if (item.spriteId) {
            itemName = `ID-${item.spriteId}`;
        }

        const { visualElement: itemVisual, recognizedName: resolvedItemName } = getItemVisual({
            spriteId: item.spriteId || item.gameId,
            spriteSrc: item.spriteSrc,
            tooltipKey: itemName,
            stat: item.stat,
            gameId: item.gameId,
            isEquipment
        });

        const mapKey = `${resolvedItemName}_${rarity}_${item.spriteId}_${item.spriteSrc}_${isEquipment}_${item.stat}`;
        const currentQuantity = item.amount || 1;

        if (aggregatedLootForSession.has(mapKey)) {
            const existing = aggregatedLootForSession.get(mapKey);
            existing.count += currentQuantity;
            aggregatedLootForSession.set(mapKey, existing);
        } else {
            aggregatedLootForSession.set(mapKey, {
                count: currentQuantity,
                visual: itemVisual,
                originalName: resolvedItemName,
                rarity: rarity,
                rarityBorderColor: rarityBorderColor,
                spriteId: item.spriteId || item.gameId,
                src: item.spriteSrc,
                isEquipment: isEquipment,
                stat: item.stat || null
            });
        }
        currentLootItemsLog.push(`${resolvedItemName} (Rarity ${rarity}, x${currentQuantity})`);
    }

    // Process Creature Drop
    if (rewardScreen.monsterDrop) {
        const { name: creatureName, visual: creatureVisual, totalStats, tierName, tierLevel, gameId: creatureGameId } = 
            getCreatureDetails(rewardScreen.monsterDrop);

        if (!creatureName.toLowerCase().includes('monster squeezer')) {
            const mapKey = `${creatureGameId}_${tierLevel}`;
            if (aggregatedCreaturesForSession.has(mapKey)) {
                const existing = aggregatedCreaturesForSession.get(mapKey);
                existing.count += 1;
            } else {
                aggregatedCreaturesForSession.set(mapKey, {
                    count: 1,
                    visual: creatureVisual,
                    originalName: creatureName,
                    genes: Object.entries(rewardScreen.monsterDrop.genes)
                        .map(([key, value]) => `${key.toUpperCase()}:${value}`)
                        .join(', '),
                    totalStats,
                    tierName,
                    tierLevel,
                    rarityBorderColor: getRarityBorderColor(tierLevel),
                    gameId: creatureGameId
                });
            }
        }
    }

    // Update stamina spent
    if (typeof serverResults.next?.playerExpDiff === 'number') {
        totalStaminaSpent += serverResults.next.playerExpDiff;
    }

    // Store session data
    allGameSessionsData.push({
        message: autoplayMessage,
        loot: Array.from(aggregatedLootForSession.values()),
        creatures: Array.from(aggregatedCreaturesForSession.values())
    });

    // Trigger re-render
    renderAllSessions();
}


/**
 * Generates a summarized log text of all aggregated loot and creature drops.
 * This is the text that will be copied to the user's clipboard.
 * @returns {string} The formatted summary log.
 */
function generateSummaryLogText() {
    let summary = `--- Hunt Analyzer Summary ---\n`;

    // Overall Stats
    const overallElapsedTimeMs = Date.now() - modOverallStartTime;
    summary += `Room: ${cachedRoomIdDisplayElement?.textContent || 'N/A'}\n`;
    summary += `Sessions: ${autoplayCount}\n`;
    summary += `Time Elapsed: ${formatTime(overallElapsedTimeMs)}\n`;
    summary += `Gold: ${totalGoldQuantity} | Dust: ${totalDustQuantity}\n`;
    summary += `Equipment Drops: ${totalEquipmentDrops} | Creature Drops: ${totalCreatureDrops}\n`;
    summary += `Total Stamina Spent: ${totalStaminaSpent}\n`;
    summary += `---------------------------\n\n`;

    // Loot Summary
    summary += `--- Aggregated Loot ---\n`;
    if (globalAggregatedLootData.size === 0) {
        summary += `No loot recorded.\n`;
    } else {
        // Sort loot for consistent output based on new rules
        const sortedLoot = Array.from(globalAggregatedLootData.values()).sort((a, b) => {
            // Rule 1: equipDrop items come before non-equipDrop items
            if (a.isEquipment && !b.isEquipment) {
                return -1; // a (equipment) comes before b (non-equipment)
            }
            if (!a.isEquipment && b.isEquipment) {
                return 1; // b (equipment) comes before a (non-equipment)
            }

            // If both are equipment or both are non-equipment, apply secondary rules
            if (a.isEquipment && b.isEquipment) {
                // Rule 2.1: If both are equipDrop, sort by GameId
                if (a.gameId !== b.gameId) {
                    return a.gameId - b.gameId;
                }
                // Rule 2.2: Then by Stat
                if (a.stat && b.stat) {
                    return a.stat.localeCompare(b.stat);
                }
                // Fallback for equipment if stats are same or missing
                return a.originalName.localeCompare(b.originalName);
            } else {
                // Rule 3.1: If both are non-equipDrop, sort by TooltipKey (originalName)
                const nameCompare = a.originalName.localeCompare(b.originalName);
                if (nameCompare !== 0) {
                    return nameCompare;
                }
                // Rule 3.2: Then by rarityLevel (rarity)
                return a.rarity - b.rarity;
            }
        });

        sortedLoot.forEach(item => {
            let itemLine = `${item.originalName}: x${item.count}`;
            if (item.rarity > 0) {
                itemLine += ` (Rarity: ${item.rarity})`;
            }
            if (item.isEquipment && item.stat) {
                itemLine += ` (Stat: ${item.stat.toUpperCase()})`;
            }
            summary += `${itemLine}\n`;
        });
    }
    summary += `---------------------------\n\n`;

    // Creature Summary
    summary += `--- Aggregated Creature Drops ---\n`;
    if (globalAggregatedCreatureData.size === 0) {
        summary += `No creatures recorded.\n`;
    } else {
        // Sort creatures for consistent output
        const sortedCreatures = Array.from(globalAggregatedCreatureData.values()).sort((a, b) => {
            // Sort by GameId (which is stored in 'gameId' property), then by tierLevel
            if (a.gameId !== b.gameId) {
                return a.gameId - b.gameId; // Sort by GameId numerically
            }
            return a.tierLevel - b.tierLevel; // Then by tier level
        });

        sortedCreatures.forEach(creature => {
            summary += `${creature.originalName} (${creature.tierName}): x${creature.count}\n`;
        });
    }
    summary += `---------------------------\n`;

    return summary;
}

// =======================
// 4. UI Creation Functions
// =======================
/**
 * Helper function to create a consistently styled button.
 * @param {string} text - The text content of the button.
 * @returns {HTMLButtonElement} The styled button element.
 */
function createStyledButton(text) {
    const button = document.createElement("button");
    button.textContent = text;
    button.style.padding = "6px 12px";
    button.style.border = "1px solid #3A404A";
    button.style.background = "linear-gradient(to bottom, #4B5563, #343841)";
    button.style.color = "#ABB2BF";
    button.style.fontSize = "9px";
    button.style.cursor = "pointer";
    button.style.borderRadius = "5px";
    button.style.transition = "all 0.2s ease";
    button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)';
    button.style.flexGrow = '1';

    button.onmouseover = () => {
        button.style.background = "linear-gradient(to bottom, #6B7280, #4B5563)";
        button.style.boxShadow = '0 3px 8px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.2)';
        button.style.transform = 'translateY(-1px)';
    };
    button.onmouseout = () => {
        button.style.background = "linear-gradient(to bottom, #4B5563, #343841)";
        button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)';
        button.style.transform = 'translateY(0)';
    };
    button.onmousedown = () => {
        button.style.boxShadow = 'inset 0 2px 5px rgba(0,0,0,0.5)';
        button.style.transform = 'translateY(1px)';
    };
    button.onmouseup = () => {
        button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)';
        button.style.transform = 'translateY(0)';
    };

    return button;
}

/**
 * Helper function to create a consistently styled icon button for header.
 * @param {string} iconText - The text/emoji for the icon (e.g., '—', '✕').
 * @returns {HTMLButtonElement} The styled button element.
 */
function createStyledIconButton(iconText) {
    const button = document.createElement("button");
    button.textContent = iconText;
    button.style.backgroundColor = "transparent";
    button.style.border = "1px solid #3A404A";
    button.style.color = "#ABB2BF";
    button.style.padding = "2px 6px"; // Reduced padding from default
    button.style.margin = "0";
    button.style.cursor = "pointer";
    button.style.fontSize = "12px"; // Reduced font size
    button.style.lineHeight = "1"; // Added to ensure proper vertical alignment
    button.style.minWidth = "20px"; // Added minimum width
    button.style.minHeight = "20px"; // Added minimum height
    button.style.display = "flex"; // Added to center the icon
    button.style.alignItems = "center"; // Added to center the icon
    button.style.justifyContent = "center"; // Added to center the icon
    button.style.borderRadius = "3px"; // Reduced border radius
    button.style.transition = "all 0.2s ease";

    // Hover effect
    button.onmouseover = () => {
        button.style.backgroundColor = "#3A404A";
        button.style.color = "#FFFFFF";
    };
    button.onmouseout = () => {
        button.style.backgroundColor = "transparent";
        button.style.color = "#ABB2BF";
    };

    // Active effect
    button.onmousedown = () => {
        button.style.transform = "translateY(1px)";
        button.style.backgroundColor = "#2C313A";
    };
    button.onmouseup = () => {
        button.style.transform = "translateY(0)";
        button.style.backgroundColor = "#3A404A";
    };

    return button;
}

/**
 * Creates and appends the Hunt Analyzer Mod panel to the document body.
 * Prevents creation of duplicate panels.
 * Styles are applied inline to match a professional game theme.
 */
function createAutoplayAnalyzerPanel() {
    // Check if the panel already exists to prevent duplicates.
    if (document.getElementById(PANEL_ID)) {
        return;
    }

    // Layout mode constants
    const LAYOUT_MODES = {
        VERTICAL: 'vertical',
        HORIZONTAL: 'horizontal',
        MINIMIZED: 'minimized'
    };

    // Layout dimensions
    const LAYOUT_DIMENSIONS = {
        [LAYOUT_MODES.VERTICAL]: { width: 350, height: 750, minWidth: 260, maxWidth: 500, minHeight: 500, maxHeight: 750 },
        [LAYOUT_MODES.HORIZONTAL]: { width: 750, height: 300, minWidth: 650, maxWidth: 1000, minHeight: 220, maxHeight: 400 },
        [LAYOUT_MODES.MINIMIZED]: { width: 250, height: 250, minWidth: 250, maxWidth: 250, minHeight: 250, maxHeight: 250 }
    };

    // Reset tracking variables for a fresh panel session
    autoplayCount = 0;
    totalGoldQuantity = 0;
    totalCreatureDrops = 0;
    totalEquipmentDrops = 0;
    totalDustQuantity = 0;
    totalStaminaSpent = 0;
    modOverallStartTime = Date.now();
    isGameActive = false;
    sessionStartTime = 0;
    allGameSessionsData = [];
    globalAggregatedLootData.clear();
    globalAggregatedCreatureData.clear();
    let currentLayoutMode = LAYOUT_MODES.VERTICAL; // Default to vertical layout
    autoplayLogText = "";

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.position = "fixed";
    panel.style.top = "50px";
    panel.style.width = "25vw";
    panel.style.maxWidth = "315px";
    panel.style.minWidth = "200px";
    panel.style.height = "90vh";
    panel.style.maxHeight = "800px";
    panel.style.backgroundColor = "#282C34";
    panel.style.border = "1px solid #3A404A";
    panel.style.color = "#ABB2BF";
    panel.style.padding = "0";
    panel.style.overflow = "hidden";
    panel.style.zIndex = "9999";
    panel.style.display = "flex";
    panel.style.flexDirection = "column";
    panel.style.height = '100%';
    panel.style.fontFamily = 'Inter, sans-serif';
    panel.style.borderRadius = "7px";
    panel.style.boxShadow = '0 0 15px rgba(0,0,0,0.7)';

    // Apply initial layout constraints
    const initialLayout = LAYOUT_DIMENSIONS[LAYOUT_MODES.VERTICAL];
    panel.style.width = initialLayout.width + 'px';
    panel.style.height = initialLayout.height + 'px';
    panel.style.minWidth = initialLayout.minWidth + 'px';
    panel.style.maxWidth = initialLayout.maxWidth + 'px';
    panel.style.minHeight = initialLayout.minHeight + 'px';
    panel.style.maxHeight = initialLayout.maxHeight + 'px';

    // 1. Top Header Section
    const topHeaderContainer = document.createElement("div");
    topHeaderContainer.style.display = "flex";
    topHeaderContainer.style.flexDirection = "column";
    topHeaderContainer.style.width = "100%";
    topHeaderContainer.style.backgroundImage = 'url(/_next/static/media/background-dark.95edca67.png)';
    topHeaderContainer.style.backgroundRepeat = 'repeat';
    topHeaderContainer.style.backgroundColor = '#323234'; // Fallback
    topHeaderContainer.style.borderBottom = "1px solid #3A404A";
    topHeaderContainer.style.padding = "4px"; // Reduced padding from 8px to 4px
    topHeaderContainer.style.flex = "0 0 auto"; // FIXED SIZE

    // Title and Controls Row
    const titleAndControlsRow = document.createElement("div");
    titleAndControlsRow.style.display = "flex";
    titleAndControlsRow.style.justifyContent = "space-between";
    titleAndControlsRow.style.alignItems = "center";
    titleAndControlsRow.style.width = "100%";
    titleAndControlsRow.style.marginBottom = "2px"; // Reduced margin from 4px to 2px
    titleAndControlsRow.style.cursor = "move";

    // Room ID Display
    const roomIdDisplay = document.createElement("h3");
    roomIdDisplay.id = "mod-room-id-display";
    roomIdDisplay.textContent = "Current Room";
    roomIdDisplay.style.margin = "0";
    roomIdDisplay.style.fontSize = "14px"; // Reduced from 18px to 14px
    roomIdDisplay.style.color = "#E06C75";
    roomIdDisplay.style.fontWeight = "bold";
    roomIdDisplay.style.textShadow = '0 0 5px rgba(224, 108, 117, 0.7)';

    // Header Controls
    const headerControls = document.createElement("div");
    headerControls.style.display = "flex";
    headerControls.style.gap = "5px";

    // Style Button (Vertical/Horizontal)
    const styleButton = createStyledIconButton('Horizontal'); // Default to horizontal icon
    styleButton.id = "mod-style-button";
    styleButton.title = "Switch to horizontal layout";
    styleButton.setAttribute('aria-label', 'Switch layout style');
    styleButton.tabIndex = 0;
    styleButton.addEventListener("click", () => {
        // Only toggle between vertical and horizontal
        if (panelState.mode === LAYOUT_MODES.MINIMIZED) {
            // If minimized, restore to last non-minimized mode, then toggle
            panelState.mode = panelState._lastMode || LAYOUT_MODES.VERTICAL;
        }
        if (panelState.mode === LAYOUT_MODES.VERTICAL) {
            panelState.mode = LAYOUT_MODES.HORIZONTAL;
            styleButton.textContent = 'Vertical';
            styleButton.title = 'Switch to vertical layout';
        } else {
            panelState.mode = LAYOUT_MODES.VERTICAL;
            styleButton.textContent = 'Horizontal';
            styleButton.title = 'Switch to horizontal layout';
        }
        // Always update _lastMode for minimize restore
        panelState._lastMode = panelState.mode;
        // Always reset to default layout size for the new mode
        const layout = LAYOUT_DIMENSIONS[panelState.mode];
        panel.style.width = layout.width + 'px';
        panel.style.height = layout.height + 'px';
        panel.style.minWidth = layout.minWidth + 'px';
        panel.style.maxWidth = layout.maxWidth + 'px';
        panel.style.minHeight = layout.minHeight + 'px';
        panel.style.maxHeight = layout.maxHeight + 'px';
        updatePanelLayout(panel);
        updatePanelPosition();
        // Update minimize button state if coming from minimized
        if (panelState.mode !== LAYOUT_MODES.MINIMIZED) {
            minimizeButton.textContent = '–';
            minimizeButton.title = 'Minimize Analyzer';
        }
    });

    // Minimize Button
    const minimizeButton = createStyledIconButton('–');
    minimizeButton.id = "mod-minimize-button";
    minimizeButton.title = "Minimize Analyzer";
    minimizeButton.setAttribute('aria-label', 'Minimize Analyzer');
    minimizeButton.tabIndex = 0;
    minimizeButton.addEventListener("click", () => {
        if (panelState.mode !== LAYOUT_MODES.MINIMIZED) {
            panelState._lastMode = panelState.mode;
            panelState.mode = LAYOUT_MODES.MINIMIZED;
            minimizeButton.textContent = '+';
            minimizeButton.title = 'Restore Analyzer';
        } else {
            panelState.mode = panelState._lastMode || LAYOUT_MODES.VERTICAL;
            minimizeButton.textContent = '–';
            minimizeButton.title = 'Minimize Analyzer';
        }
        // Always reset to default layout size for the new mode
        const layout = LAYOUT_DIMENSIONS[panelState.mode];
        panel.style.width = layout.width + 'px';
        panel.style.height = layout.height + 'px';
        panel.style.minWidth = layout.minWidth + 'px';
        panel.style.maxWidth = layout.maxWidth + 'px';
        panel.style.minHeight = layout.minHeight + 'px';
        panel.style.maxHeight = layout.maxHeight + 'px';
        updatePanelLayout(panel);
        updatePanelPosition();
        // Update style button state if coming from minimized
        if (panelState.mode === LAYOUT_MODES.VERTICAL) {
            styleButton.textContent = 'Horizontal';
            styleButton.title = 'Switch to horizontal layout';
        } else if (panelState.mode === LAYOUT_MODES.HORIZONTAL) {
            styleButton.textContent = 'Vertical';
            styleButton.title = 'Switch to vertical layout';
        }
    });

    // Close Button
    const closeButton = createStyledIconButton("✕");
    closeButton.title = "Close Analyzer";
    closeButton.addEventListener("click", () => {
        // Save panel settings before closing
        savePanelSettings(panel);
        // Clear cached DOM references
        cachedLootDiv = null;
        cachedCreatureDropDiv = null;
        cachedAutoplayCounterElement = null;
        cachedAutoplayRateElement = null;
        cachedGoldRateElement = null;
        cachedCreatureRateElement = null;
        cachedEquipmentRateElement = null;
        cachedRoomIdDisplayElement = null;
        cachedTotalGoldDisplayElement = null;
        cachedTotalDustDisplayElement = null;
        cachedTotalStaminaSpentElement = null;
        // Stop the live update interval
        if (updateIntervalId) {
            clearInterval(updateIntervalId);
            updateIntervalId = null;
        }
        // Remove resize listener
        window.removeEventListener('resize', updatePanelPosition);
        // Remove the panel
        panel.remove();
    });

    // Add buttons in order: style, minimize, close
    headerControls.appendChild(styleButton);
    headerControls.appendChild(minimizeButton);
    headerControls.appendChild(closeButton);
    titleAndControlsRow.appendChild(roomIdDisplay);
    titleAndControlsRow.appendChild(headerControls);
    topHeaderContainer.appendChild(titleAndControlsRow);

    // --- NATIVE-LIKE RESIZABLE PANEL LOGIC ---
    const edgeSize = 8; // px, area near edge/corner to trigger resize
    let isResizing = false;
    let resizeDir = '';
    let resizeStartX = 0;
    let resizeStartY = 0;
    let startWidth = 0;
    let startHeight = 0;
    let startLeft = 0;
    let startTop = 0;

    // Helper to get which edge/corner is hovered
    function getResizeDirection(e, panel) {
        const rect = panel.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        let dir = '';
        
        // Only allow resizing when not minimized
        if (currentLayoutMode !== LAYOUT_MODES.MINIMIZED) {
            if (y < edgeSize) dir += 'n';
            else if (y > rect.height - edgeSize) dir += 's';
            if (x < edgeSize) dir += 'w';
            else if (x > rect.width - edgeSize) dir += 'e';
        }
        
        return dir;
    }

    // Change cursor on hover
    panel.addEventListener('mousemove', function(e) {
        if (isResizing) return;
        const dir = getResizeDirection(e, panel);
        let cursor = '';
        switch (dir) {
            case 'n': cursor = currentLayoutMode === LAYOUT_MODES.MINIMIZED ? '' : 'ns-resize'; break;
            case 's': cursor = currentLayoutMode === LAYOUT_MODES.MINIMIZED ? '' : 'ns-resize'; break;
            case 'e': cursor = 'ew-resize'; break;
            case 'w': cursor = 'ew-resize'; break;
            case 'ne': cursor = currentLayoutMode === LAYOUT_MODES.MINIMIZED ? 'ew-resize' : 'nesw-resize'; break;
            case 'nw': cursor = currentLayoutMode === LAYOUT_MODES.MINIMIZED ? 'ew-resize' : 'nwse-resize'; break;
            case 'se': cursor = currentLayoutMode === LAYOUT_MODES.MINIMIZED ? 'ew-resize' : 'nwse-resize'; break;
            case 'sw': cursor = currentLayoutMode === LAYOUT_MODES.MINIMIZED ? 'ew-resize' : 'nesw-resize'; break;
            default: cursor = '';
        }
        panel.style.cursor = cursor || '';
    });

    // Start resizing on mousedown near edge/corner
    panel.addEventListener('mousedown', function(e) {
        console.log('Current mode:', currentLayoutMode);
        if (currentLayoutMode === LAYOUT_MODES.MINIMIZED) {
            const layout = LAYOUT_DIMENSIONS[LAYOUT_MODES.MINIMIZED];
            panel.style.width = layout.width + 'px';
            panel.style.height = layout.height + 'px';
            panel.style.minWidth = panel.style.maxWidth = layout.width + 'px';
            panel.style.minHeight = panel.style.maxHeight = layout.height + 'px';
            isResizing = false;
            return;
        }
        if (e.target.tagName === 'BUTTON' || e.target === titleAndControlsRow) return;
        const dir = getResizeDirection(e, panel);
        if (!dir) return;
        isResizing = true;
        resizeDir = dir;
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        const rect = panel.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;
        startLeft = rect.left;
        startTop = rect.top;
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
        if (!isResizing || currentLayoutMode === LAYOUT_MODES.MINIMIZED) return;
        let dx = e.clientX - resizeStartX;
        let dy = e.clientY - resizeStartY;
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;
        const layout = LAYOUT_DIMENSIONS[panelState.mode];
        
        // Allow resizing in both directions for vertical/horizontal
        if (resizeDir.includes('e')) {
            newWidth = clamp(startWidth + dx, layout.minWidth, layout.maxWidth);
        }
        if (resizeDir.includes('w')) {
            newWidth = clamp(startWidth - dx, layout.minWidth, layout.maxWidth);
            newLeft = startLeft + dx;
        }
        if (resizeDir.includes('s')) {
            newHeight = clamp(startHeight + dy, layout.minHeight, layout.maxHeight);
        }
        if (resizeDir.includes('n')) {
            newHeight = clamp(startHeight - dy, layout.minHeight, layout.maxHeight);
            newTop = startTop + dy;
        }
        panel.style.width = newWidth + 'px';
        panel.style.height = newHeight + 'px';
        panel.style.left = newLeft + 'px';
        panel.style.top = newTop + 'px';
        panel.style.transition = 'none';
    });

    document.addEventListener('mouseup', function() {
        if (isResizing) {
            isResizing = false;
            document.body.style.userSelect = '';
            panel.style.transition = '';
        }
    });
    // --- END NATIVE-LIKE RESIZABLE PANEL LOGIC ---

    // --- DRAGGABLE PANEL LOGIC ---
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    titleAndControlsRow.addEventListener('mousedown', function(e) {
        if (e.target.tagName === 'BUTTON') return; // Don't drag if clicking a button
        isDragging = true;
        const rect = panel.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        let newLeft = e.clientX - dragOffsetX;
        let newTop = e.clientY - dragOffsetY;
        // Clamp to viewport
        newLeft = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, newLeft));
        newTop = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, newTop));
        panel.style.left = newLeft + 'px';
        panel.style.top = newTop + 'px';
        panel.style.transition = 'none';
    });

    document.addEventListener('mouseup', function() {
        if (isDragging) {
            isDragging = false;
            document.body.style.userSelect = '';
            panel.style.transition = '';
        }
    });
    // --- END DRAGGABLE PANEL LOGIC ---

    // 2. Live Display Section
    const liveDisplaySection = document.createElement("div");
    liveDisplaySection.className = "live-display-section";
    liveDisplaySection.style.display = "flex";
    liveDisplaySection.style.flexDirection = "column";
    liveDisplaySection.style.padding = "8px";
    liveDisplaySection.style.backgroundImage = 'url(/_next/static/media/background-regular.b0337118.png)';
    liveDisplaySection.style.backgroundRepeat = 'repeat';
    liveDisplaySection.style.backgroundColor = '#323234'; // Fallback
    liveDisplaySection.style.flex = "0 0 auto"; // FIXED SIZE
    liveDisplaySection.style.width = "100%";
    liveDisplaySection.style.boxSizing = "border-box";

    // Session Stats
    const sessionStatsDiv = document.createElement("div");
    sessionStatsDiv.style.display = "flex";
    sessionStatsDiv.style.justifyContent = "space-between";
    sessionStatsDiv.style.alignItems = "center";
    sessionStatsDiv.style.marginBottom = "4px";

    const autoplayCounter = document.createElement("span");
    autoplayCounter.id = "mod-autoplay-counter";
    autoplayCounter.textContent = "Sessions: 0";
    autoplayCounter.style.fontSize = "12px";
    autoplayCounter.style.color = "#61AFEF";

    const autoplayRateElement = document.createElement("span");
    autoplayRateElement.id = "mod-autoplay-rate";
    autoplayRateElement.textContent = "Sessions: 0/h";
    autoplayRateElement.style.fontSize = "10px";
    autoplayRateElement.style.color = "#56B6C2";

    sessionStatsDiv.appendChild(autoplayCounter);
    sessionStatsDiv.appendChild(autoplayRateElement);
    liveDisplaySection.appendChild(sessionStatsDiv);

    // Drop Rate Live Feed
    const dropRateLiveFeedDiv = document.createElement("div");
    dropRateLiveFeedDiv.style.display = "flex";
    dropRateLiveFeedDiv.style.justifyContent = "space-between";
    dropRateLiveFeedDiv.style.marginTop = "6px";
    dropRateLiveFeedDiv.style.padding = "3px 0";
    dropRateLiveFeedDiv.style.borderTop = "1px solid #3A404A";
    dropRateLiveFeedDiv.style.borderBottom = "1px solid #3A404A";
    dropRateLiveFeedDiv.style.fontSize = "10px";
    dropRateLiveFeedDiv.style.color = "#98C379";

    // Left section for rates
    const leftRatesSection = document.createElement('div');
    leftRatesSection.style.display = 'flex';
    leftRatesSection.style.flexDirection = 'column';
    leftRatesSection.style.gap = '2px';

    const goldRateElement = document.createElement("span");
    goldRateElement.id = "mod-gold-rate";
    goldRateElement.textContent = "Gold/h: 0";
    leftRatesSection.appendChild(goldRateElement);

    const creatureRateElement = document.createElement("span");
    creatureRateElement.id = "mod-creature-rate";
    creatureRateElement.textContent = "Creatures/h: 0";
    leftRatesSection.appendChild(creatureRateElement);

    const equipmentRateElement = document.createElement("span");
    equipmentRateElement.id = "mod-equipment-rate";
    equipmentRateElement.textContent = "Equipment/h: 0";
    leftRatesSection.appendChild(equipmentRateElement);

    const totalStaminaSpentElement = document.createElement('span');
    totalStaminaSpentElement.id = 'mod-total-stamina-spent';
    totalStaminaSpentElement.textContent = `Stamina spent: ${totalStaminaSpent}`;
    leftRatesSection.appendChild(totalStaminaSpentElement);

    // Right section for totals
    const rightTotalsSection = document.createElement('div');
    rightTotalsSection.style.display = 'flex';
    rightTotalsSection.style.flexDirection = 'column';
    rightTotalsSection.style.alignItems = 'flex-end';
    rightTotalsSection.style.gap = '2px';

    // Gold Display
    const goldDisplayDiv = document.createElement('div');
    goldDisplayDiv.style.display = 'flex';
    goldDisplayDiv.style.alignItems = 'center';
    goldDisplayDiv.style.gap = '4px';

    const goldIcon = document.createElement('img');
    goldIcon.style.width = '20px';
    goldIcon.style.height = '20px';
    goldIcon.style.imageRendering = 'pixelated';
    goldIcon.src = '/assets/icons/goldpile.png';
    goldIcon.alt = 'Gold';

    const goldAmountSpan = document.createElement('span');
    goldAmountSpan.id = 'mod-total-gold-display';
    goldAmountSpan.style.color = '#E5C07B';
    goldAmountSpan.style.fontSize = '12px';
    goldAmountSpan.style.fontWeight = 'bold';
    goldAmountSpan.textContent = '0';

    goldDisplayDiv.appendChild(goldIcon);
    goldDisplayDiv.appendChild(goldAmountSpan);
    rightTotalsSection.appendChild(goldDisplayDiv);

    // Dust Display
    const dustDisplayDiv = document.createElement('div');
    dustDisplayDiv.style.display = 'flex';
    dustDisplayDiv.style.alignItems = 'center';
    dustDisplayDiv.style.gap = '4px';

    const dustIcon = document.createElement('img');
    dustIcon.style.width = '20px';
    dustIcon.style.height = '20px';
    dustIcon.style.imageRendering = 'pixelated';
    dustIcon.src = '/assets/icons/dust.png';
    dustIcon.alt = 'Dust';

    const dustAmountSpan = document.createElement('span');
    dustAmountSpan.id = 'mod-total-dust-display';
    dustAmountSpan.style.color = '#C678DD';
    dustAmountSpan.style.fontSize = '12px';
    dustAmountSpan.style.fontWeight = 'bold';
    dustAmountSpan.textContent = '0';

    dustDisplayDiv.appendChild(dustIcon);
    dustDisplayDiv.appendChild(dustAmountSpan);
    rightTotalsSection.appendChild(dustDisplayDiv);

    dropRateLiveFeedDiv.appendChild(leftRatesSection);
    dropRateLiveFeedDiv.appendChild(rightTotalsSection);
    liveDisplaySection.appendChild(dropRateLiveFeedDiv);

    // 3. Loot Section
    const lootContainer = document.createElement("div");
    lootContainer.className = "loot-container";
    lootContainer.style.display = "flex";
    lootContainer.style.flexDirection = "column";
    lootContainer.style.flex = "1 1 0"; // FLEXIBLE
    lootContainer.style.minHeight = "0";
    lootContainer.style.margin = "8px";
    lootContainer.style.backgroundImage = 'url(/_next/static/media/background-regular.b0337118.png)';
    lootContainer.style.backgroundRepeat = 'repeat';
    lootContainer.style.backgroundColor = '#323234'; // Fallback
    lootContainer.style.borderRadius = '6px';
    lootContainer.style.padding = '6px';
    lootContainer.style.overflowY = 'auto';

    const lootTitleContainer = document.createElement("div");
    lootTitleContainer.style.display = "flex";
    lootTitleContainer.style.alignItems = "center";
    lootTitleContainer.style.justifyContent = "space-between";
    lootTitleContainer.style.marginBottom = "3px";

    const lootTitle = document.createElement("h4");
    lootTitle.textContent = "Loot";
    lootTitle.style.margin = "0";
    lootTitle.style.color = "#61AFEF";
    lootTitle.style.fontSize = "13px";
    lootTitleContainer.appendChild(lootTitle);

    const lootDisplayDiv = document.createElement("div");
    lootDisplayDiv.id = "mod-loot-display";
    lootDisplayDiv.style.width = "100%";
    lootDisplayDiv.style.padding = "4px";
    lootDisplayDiv.style.border = "1px solid #3A404A";
    lootDisplayDiv.style.backgroundColor = "rgba(40,44,52,0.4)";
    lootDisplayDiv.style.color = "#ABB2BF";
    lootDisplayDiv.style.fontSize = "11px";
    lootDisplayDiv.style.borderRadius = "4px";
    lootDisplayDiv.style.overflowY = "scroll";
    lootDisplayDiv.style.flexGrow = "1";
    lootDisplayDiv.style.display = "flex";
    lootDisplayDiv.style.flexDirection = "column";
    lootDisplayDiv.style.gap = "6px";

    lootContainer.appendChild(lootTitleContainer);
    lootContainer.appendChild(lootDisplayDiv);

    // 4. Creature Drops Section
    const creatureDropContainer = document.createElement("div");
    creatureDropContainer.className = "creature-drop-container";
    creatureDropContainer.style.display = "flex";
    creatureDropContainer.style.flexDirection = "column";
    creatureDropContainer.style.flex = "1 1 0"; // FLEXIBLE
    creatureDropContainer.style.minHeight = "0";
    creatureDropContainer.style.margin = "8px";
    creatureDropContainer.style.backgroundImage = 'url(/_next/static/media/background-regular.b0337118.png)';
    creatureDropContainer.style.backgroundRepeat = 'repeat';
    creatureDropContainer.style.backgroundColor = '#323234'; // Fallback
    creatureDropContainer.style.borderRadius = '6px';
    creatureDropContainer.style.padding = '6px';
    creatureDropContainer.style.overflowY = 'auto';

    const creatureDropTitleContainer = document.createElement("div");
    creatureDropTitleContainer.style.display = "flex";
    creatureDropTitleContainer.style.alignItems = "center";
    creatureDropTitleContainer.style.justifyContent = "space-between";
    creatureDropTitleContainer.style.marginBottom = "3px";

    const creatureDropTitle = document.createElement("h4");
    creatureDropTitle.textContent = "Creature Drops";
    creatureDropTitle.style.margin = "0";
    creatureDropTitle.style.color = "#61AFEF";
    creatureDropTitle.style.fontSize = "13px";
    creatureDropTitleContainer.appendChild(creatureDropTitle);

    const creatureDropDisplayDiv = document.createElement("div");
    creatureDropDisplayDiv.id = "mod-creature-drop-display";
    creatureDropDisplayDiv.style.width = "100%";
    creatureDropDisplayDiv.style.padding = "4px";
    creatureDropDisplayDiv.style.border = "1px solid #3A404A";
    creatureDropDisplayDiv.style.backgroundColor = "rgba(40,44,52,0.4)";
    creatureDropDisplayDiv.style.color = "#ABB2BF";
    creatureDropDisplayDiv.style.fontSize = "11px";
    creatureDropDisplayDiv.style.borderRadius = "4px";
    creatureDropDisplayDiv.style.overflowY = "scroll";
    creatureDropDisplayDiv.style.flexGrow = "1";
    creatureDropDisplayDiv.style.display = "flex";
    creatureDropDisplayDiv.style.flexDirection = "column";
    creatureDropDisplayDiv.style.gap = "6px";

    creatureDropContainer.appendChild(creatureDropTitleContainer);
    creatureDropContainer.appendChild(creatureDropDisplayDiv);

    // 5. Bottom Controls
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "button-container";
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "center";
    buttonContainer.style.gap = "8px";
    buttonContainer.style.padding = "8px";
    buttonContainer.style.borderTop = "1px solid #3A404A";
    buttonContainer.style.backgroundImage = 'url(/_next/static/media/background-regular.b0337118.png)';
    buttonContainer.style.backgroundRepeat = 'repeat';
    buttonContainer.style.backgroundColor = '#323234'; // Fallback
    buttonContainer.style.flex = "0 0 auto"; // FIXED SIZE
    buttonContainer.style.flexDirection = 'row';

    const clearButton = createStyledButton("Clear All");
    clearButton.addEventListener("click", () => {
        // Create the confirmation dialog
        const confirmDialog = document.createElement('div');
        confirmDialog.style.position = 'fixed';
        confirmDialog.style.top = '50%';
        confirmDialog.style.left = '50%';
        confirmDialog.style.transform = 'translate(-50%, -50%)';
        confirmDialog.style.backgroundColor = '#282C34'; // Dark background
        confirmDialog.style.border = '2px solid #E06C75'; // Accent border
        confirmDialog.style.borderRadius = '8px';
        confirmDialog.style.padding = '20px';
        confirmDialog.style.zIndex = '10000'; // Above analyzer panel
        confirmDialog.style.boxShadow = '0 5px 15px rgba(0,0,0,0.8)';
        confirmDialog.style.display = 'flex';
        confirmDialog.style.flexDirection = 'column';
        confirmDialog.style.gap = '15px';
        confirmDialog.style.fontFamily = 'Inter, sans-serif';
        confirmDialog.style.color = '#ABB2BF';
        confirmDialog.style.textAlign = 'center';
        confirmDialog.style.minWidth = '250px';

        const message = document.createElement('p');
        message.textContent = "Are you sure you want to clear all data?";
        message.style.margin = '0';
        message.style.fontSize = '16px';
        message.style.fontWeight = 'bold';
        message.style.color = '#E06C75';

        const dialogButtonContainer = document.createElement('div'); // Renamed to avoid conflict
        dialogButtonContainer.style.display = 'flex';
        dialogButtonContainer.style.justifyContent = 'center';
        dialogButtonContainer.style.gap = '10px';

        // Confirm Button
        const confirmBtn = createStyledButton("Confirm");
        confirmBtn.style.backgroundColor = '#E06C75'; // Red for confirmation
        confirmBtn.style.color = '#FFFFFF';
        confirmBtn.style.borderColor = '#C25560';

        // Override hover/active for confirm button to match accent
        confirmBtn.onmouseover = () => {
            confirmBtn.style.background = "linear-gradient(to bottom, #FF8A96, #E06C75)";
            confirmBtn.style.boxShadow = '0 3px 8px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.2)';
            confirmBtn.style.transform = 'translateY(-1px)';
        };
        confirmBtn.onmouseout = () => {
            confirmBtn.style.background = "linear-gradient(to bottom, #E06C75, #C25560)";
            confirmBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)';
            confirmBtn.style.transform = 'translateY(0)';
        };


        confirmBtn.addEventListener('click', () => {
            // Perform the clear all action
            autoplayLogText = ""; // Reset the log text here
            autoplayCount = 0;
            totalGoldQuantity = 0;
            totalCreatureDrops = 0;
            totalEquipmentDrops = 0; // NEW: Reset equipment drops on clear
            totalDustQuantity = 0; // NEW: Reset dust drops on clear
            totalStaminaSpent = 0; // Reset stamina on clear
            modOverallStartTime = Date.now(); // Reset overall session timer
            sessionStartTime = 0;
            isGameActive = false;
            allGameSessionsData = []; // Clear all stored sessions
            globalAggregatedLootData.clear(); // Clear global aggregated data
            globalAggregatedCreatureData.clear(); // Clear global aggregated data
            // Clear the visual display divs and update counter
            if (cachedLootDiv) cachedLootDiv.innerHTML = "";
            if (cachedCreatureDropDiv) cachedCreatureDropDiv.innerHTML = "";
            // Call renderAllSessions to refresh the display (which will now be empty)
            renderAllSessions(); // Re-render to show cleared state
            updatePanelDisplay(); // Update overall rates to reflect cleared state
            // Reset the room ID display to current room name
            const roomNamesMap = globalThis.state?.utils?.ROOM_NAME; // Changed to ROOM_NAME (singular)
            let roomDisplayName = "Current Room";
            if (roomNamesMap) {
                const potentialRoomId = globalThis.state.board?.area?.id || globalThis.state.player?.currentRoomId;
                if (potentialRoomId && roomNamesMap[potentialRoomId]) {
                    roomDisplayName = roomNamesMap[potentialRoomId];
                } else if (potentialRoomId) {
                    roomDisplayName = `Room ID: ${potentialRoomId}`;
                }
            }
            if (cachedRoomIdDisplayElement) {
                cachedRoomIdDisplayElement.textContent = roomDisplayName;
            }
            updatePanelPosition(); // Re-align after clear

            // Remove the dialog
            document.body.removeChild(confirmDialog);
        });

        // Cancel Button
        const cancelBtn = createStyledButton("Cancel");
        cancelBtn.addEventListener('click', () => {
            // Just remove the dialog without clearing data
            document.body.removeChild(confirmDialog);
        });

        dialogButtonContainer.appendChild(confirmBtn);
        dialogButtonContainer.appendChild(cancelBtn);

        confirmDialog.appendChild(message);
        confirmDialog.appendChild(dialogButtonContainer);

        document.body.appendChild(confirmDialog);
    });

    const copyLogButton = createStyledButton("Copy Log");
    copyLogButton.addEventListener("click", () => {
        const summaryText = generateSummaryLogText();
        const success = copyToClipboard(summaryText);
        // Provide visual feedback to the user
        const feedbackMessage = document.createElement('div');
        feedbackMessage.textContent = success ? 'Log copied!' : 'Failed to copy!';
        feedbackMessage.style.position = 'absolute';
        feedbackMessage.style.bottom = '10px';
        feedbackMessage.style.left = '50%';
        feedbackMessage.style.transform = 'translateX(-50%)';
        feedbackMessage.style.backgroundColor = success ? '#98C379' : '#E06C75'; // Green for success, red for failure
        feedbackMessage.style.color = '#FFFFFF';
        feedbackMessage.style.padding = '8px 12px';
        feedbackMessage.style.borderRadius = '5px';
        feedbackMessage.style.zIndex = '10001'; // Above other elements
        feedbackMessage.style.opacity = '0'; // Start invisible
        feedbackMessage.style.transition = 'opacity 0.3s ease-in-out';
        panel.appendChild(feedbackMessage);

        // Fade in and then fade out
        setTimeout(() => {
            feedbackMessage.style.opacity = '1';
        }, 10);
        setTimeout(() => {
            feedbackMessage.style.opacity = '0';
            setTimeout(() => {
                feedbackMessage.remove();
            }, 300); // Remove after fade out
        }, 1500); // Display for 1.5 seconds
    });

    buttonContainer.appendChild(clearButton);
    buttonContainer.appendChild(copyLogButton);

    // --- COLUMN WRAPPER for left column in horizontal mode ---
    const leftColumn = document.createElement("div");
    leftColumn.className = "analyzer-left-column";
    leftColumn.style.display = "flex";
    leftColumn.style.flexDirection = "column";
    leftColumn.style.width = "240px";
    leftColumn.style.minWidth = "200px";
    leftColumn.style.maxWidth = "300px";
    leftColumn.style.flex = "0 0 auto";
    leftColumn.appendChild(topHeaderContainer);
    leftColumn.appendChild(liveDisplaySection);
    leftColumn.appendChild(buttonContainer);

    // Add version number (define before appending)
    const versionDiv = document.createElement("div");
    versionDiv.textContent = `v${HUNT_ANALYZER_VERSION}`;
    versionDiv.style.position = "absolute";
    versionDiv.style.bottom = "6px";
    versionDiv.style.right = "10px";
    versionDiv.style.fontSize = "10px";
    versionDiv.style.color = "#444";
    versionDiv.style.opacity = "0.5";
    versionDiv.style.pointerEvents = "none";
    versionDiv.style.userSelect = "none";

    // Assemble the panel (default to vertical, updatePanelLayout will fix for horizontal)
    panel.appendChild(leftColumn);
    panel.appendChild(lootContainer);
    panel.appendChild(creatureDropContainer);
    panel.appendChild(versionDiv);

    // Cache DOM elements
    cachedLootDiv = lootDisplayDiv;
    cachedCreatureDropDiv = creatureDropDisplayDiv;
    cachedAutoplayCounterElement = autoplayCounter;
    cachedAutoplayRateElement = autoplayRateElement;
    cachedGoldRateElement = goldRateElement;
    cachedCreatureRateElement = creatureRateElement;
    cachedEquipmentRateElement = equipmentRateElement;
    cachedRoomIdDisplayElement = roomIdDisplay;
    cachedTotalGoldDisplayElement = goldAmountSpan;
    cachedTotalDustDisplayElement = dustAmountSpan;
    cachedTotalStaminaSpentElement = totalStaminaSpentElement;

    // Set custom properties for layout management
    panel._leftColumn = leftColumn;
    panel._topHeaderContainer = topHeaderContainer;
    panel._liveDisplaySection = liveDisplaySection;
    panel._buttonContainer = buttonContainer;
    panel._lootContainer = lootContainer;
    panel._creatureDropContainer = creatureDropContainer;

    document.body.appendChild(panel);

    // Force layout update to fit header and live sections on first open
    updatePanelLayout(panel);

    // Initialize panel
    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);

    if (updateIntervalId) {
        clearInterval(updateIntervalId);
    }
    updateIntervalId = setInterval(updatePanelDisplay, 1000);
    updatePanelDisplay();

    // Set initial layout
    updatePanelLayout(panel);

    // Add resize handles to the panel (corners and edges)
    addResizeHandles(panel);
    // Add event listeners for handles
    Array.from(panel.querySelectorAll('.resize-handle')).forEach(handle => {
        handle.addEventListener('mousedown', onResizeHandleMouseDown);
    });
    // Add double-click to header
    const header = panel.querySelector('.top-header');
    if (header) {
        header.addEventListener('dblclick', onHeaderDblClick);
    }
}

/**
 * Updates the display in the Hunt Analyzer Mod panel with the current loot, creature drops,
 * autoplay session count, and live drop rates.
 */
function updatePanelDisplay() {
    // Lazily get and cache references if they haven't been already.
    if (!cachedLootDiv) cachedLootDiv = document.getElementById("mod-loot-display");
    if (!cachedCreatureDropDiv) cachedCreatureDropDiv = document.getElementById("mod-creature-drop-display");
    if (!cachedAutoplayCounterElement) cachedAutoplayCounterElement = document.getElementById("mod-autoplay-counter");
    if (!cachedAutoplayRateElement) cachedAutoplayRateElement = document.getElementById("mod-autoplay-rate");
    if (!cachedGoldRateElement) cachedGoldRateElement = document.getElementById("mod-gold-rate");
    if (!cachedCreatureRateElement) cachedCreatureRateElement = document.getElementById("mod-creature-rate");
    if (!cachedEquipmentRateElement) cachedEquipmentRateElement = document.getElementById("mod-equipment-rate");
    if (!cachedRoomIdDisplayElement) cachedRoomIdDisplayElement = document.getElementById("mod-room-id-display");
    if (!cachedTotalGoldDisplayElement) cachedTotalGoldDisplayElement = document.getElementById("mod-total-gold-display");
    if (!cachedTotalDustDisplayElement) cachedTotalDustDisplayElement = document.getElementById("mod-total-dust-display");
    if (!cachedTotalStaminaSpentElement) cachedTotalStaminaSpentElement = document.getElementById("mod-total-stamina-spent");

    // Update the session counter display
    if (cachedAutoplayCounterElement) {
        cachedAutoplayCounterElement.textContent = `Sessions: ${autoplayCount}`;
    }

    // --- Autoplay Sessions/Hour Calculation ---
    let autoplayRatePerHour = 0;
    const overallElapsedTimeMs = Date.now() - modOverallStartTime;
    const overallElapsedTimeHours = overallElapsedTimeMs / (1000 * 60 * 60);

    if (overallElapsedTimeHours > 0) {
        autoplayRatePerHour = Math.floor(autoplayCount / overallElapsedTimeHours); // Ensure no decimals
    }
    if (cachedAutoplayRateElement) {
        cachedAutoplayRateElement.textContent = `Sessions: ${autoplayRatePerHour}/h`;
    }
    // --- End Autoplay Sessions/Hour Calculation ---

    // --- Rate Calculation Logic for Gold/Creatures/Equipment: Based on total elapsed time ---
    let goldRatePerHour = 0;
    let creatureRatePerHour = 0;
    let equipmentRatePerHour = 0;
    let staminaSpentRatePerHour = 0;

    if (overallElapsedTimeHours > 0) {
        goldRatePerHour = Math.floor(totalGoldQuantity / overallElapsedTimeHours);
        creatureRatePerHour = Math.floor(totalCreatureDrops / overallElapsedTimeHours);
        equipmentRatePerHour = Math.floor(totalEquipmentDrops / overallElapsedTimeHours);
        staminaSpentRatePerHour = Math.floor(totalStaminaSpent / overallElapsedTimeHours);
    }

    if (cachedGoldRateElement) {
        cachedGoldRateElement.textContent = `Gold/h: ${goldRatePerHour}`;
    }
    if (cachedCreatureRateElement) {
        cachedCreatureRateElement.textContent = `Creatures/h: ${creatureRatePerHour}`;
    }
    if (cachedEquipmentRateElement) {
        cachedEquipmentRateElement.textContent = `Equipment/h: ${equipmentRatePerHour}`;
    }
    if (cachedTotalStaminaSpentElement) {
        cachedTotalStaminaSpentElement.textContent = `Stamina spent: ${totalStaminaSpent} (${staminaSpentRatePerHour}/h)`;
    }
}

/**
 * Calculates and applies the correct position for the analyzer panel.
 * It will now attempt to position the panel to the left of the main game content, with a small gap.
 */
function updatePanelPosition() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    const mainElement = document.querySelector('main');
    const panelWidth = panel.offsetWidth; // Get the actual rendered width of the panel
    const gap = 10; // Small gap in pixels between the panel and the main content

    if (mainElement) {
        const mainRect = mainElement.getBoundingClientRect();
        // Calculate the left position so that the panel's right edge
        // is 'gap' pixels to the left of the main content's left edge.
        const newLeft = mainRect.left - panelWidth - gap;

        // Ensure the panel doesn't go off the screen to the left (clamp at 0).
        panel.style.left = Math.max(0, newLeft) + 'px';
    } else {
        // Fallback if <main> element is not found, place it fixed on the far left with a small margin.
        panel.style.left = '10px';
        panel.style.top = '50px'; // Set top position as well for consistency
    }
}

/**
 * Toggles the minimized state of the analyzer panel.
 * Hides/shows content and adjusts panel height.
 */
function toggleMinimize() {
    const panel = document.getElementById(PANEL_ID);
    const lootContainer = document.querySelector(`#${PANEL_ID} .loot-container`);
    const creatureDropContainer = document.querySelector(`#${PANEL_ID} .creature-drop-container`);
    const minimizeButton = document.getElementById("mod-minimize-button");
    const buttonContainer = panel && panel.querySelector('.button-container');

    if (!panel || !lootContainer || !creatureDropContainer || !minimizeButton) {
        console.error("[Hunt Analyzer] Toggle minimize: Required elements not found.");
        return;
    }

    // Switch mode
    switch (panelState.mode) {
        case LAYOUT_MODES.VERTICAL:
            panelState.mode = LAYOUT_MODES.HORIZONTAL;
            break;
        case LAYOUT_MODES.HORIZONTAL:
            panelState.mode = LAYOUT_MODES.MINIMIZED;
            break;
        case LAYOUT_MODES.MINIMIZED:
            panelState.mode = LAYOUT_MODES.VERTICAL;
            break;
    }

    // Set button text and tooltip to the CURRENT mode
    if (panelState.mode === LAYOUT_MODES.VERTICAL) {
        minimizeButton.textContent = 'Vertical';
        minimizeButton.title = 'Current layout: Vertical';
    } else if (panelState.mode === LAYOUT_MODES.HORIZONTAL) {
        minimizeButton.textContent = 'Horizontal';
        minimizeButton.title = 'Current layout: Horizontal';
    } else if (panelState.mode === LAYOUT_MODES.MINIMIZED) {
        minimizeButton.textContent = 'Minimized';
        minimizeButton.title = 'Current layout: Minimized';
    }

    // Cancel any ongoing resize if switching to minimized
    if (panelState.mode === LAYOUT_MODES.MINIMIZED) {
        panelState.isResizing = false;
    }
    applyLayoutMode(panel, panelState.mode, lootContainer, creatureDropContainer, buttonContainer);
    updatePanelLayout(panel);
    updatePanelPosition();
}

// Add this helper function near the top (after LAYOUT_DIMENSIONS):
function applyLayoutMode(panel, mode, lootContainer, creatureDropContainer, buttonContainer) {
    const layout = LAYOUT_DIMENSIONS[mode];
    if (!layout) return;
    panel.style.width = layout.width + 'px';
    panel.style.height = layout.height + 'px';
    panel.style.minWidth = layout.minWidth + 'px';
    panel.style.maxWidth = layout.maxWidth + 'px';
    panel.style.minHeight = layout.minHeight + 'px';
    panel.style.maxHeight = layout.maxHeight + 'px';
    if (mode === LAYOUT_MODES.HORIZONTAL) {
        panel.style.flexDirection = 'row';
    } else {
        panel.style.flexDirection = 'column';
    }
    if (mode === LAYOUT_MODES.MINIMIZED) {
        lootContainer.style.display = 'none';
        creatureDropContainer.style.display = 'none';
        if (buttonContainer) buttonContainer.style.display = 'flex';
    } else {
        lootContainer.style.display = 'flex';
        lootContainer.style.flexDirection = 'column';
        creatureDropContainer.style.display = 'flex';
        creatureDropContainer.style.flexDirection = 'column';
        if (buttonContainer) buttonContainer.style.display = 'flex';
    }
}

// In updatePanelLayout, use currentLayoutMode instead of height for layout:
function updatePanelLayout(panel) {
    const leftColumn = panel._leftColumn;
    const topHeaderContainer = panel._topHeaderContainer;
    const liveDisplaySection = panel._liveDisplaySection;
    const buttonContainer = panel._buttonContainer;
    const lootContainer = panel._lootContainer;
    const creatureDropContainer = panel._creatureDropContainer;

    // Always set fixed/flexible sizing regardless of layout
    if (leftColumn) {
        if (panelState.mode === LAYOUT_MODES.HORIZONTAL) {
            leftColumn.style.display = "flex";
            leftColumn.style.flexDirection = "column";
            leftColumn.style.width = "240px";
            leftColumn.style.minWidth = "200px";
            leftColumn.style.maxWidth = "300px";
            leftColumn.style.flex = "0 0 auto";
            leftColumn.style.height = "auto";
        } else {
            leftColumn.style.display = "flex";
            leftColumn.style.flexDirection = "column";
            leftColumn.style.width = "240px";
            leftColumn.style.minWidth = "200px";
            leftColumn.style.maxWidth = "300px";
            leftColumn.style.flex = "0 0 auto";
            leftColumn.style.height = "";
        }
    }
    if (topHeaderContainer) topHeaderContainer.style.flex = "0 0 auto";
    if (liveDisplaySection) {
        if (panelState.mode === LAYOUT_MODES.HORIZONTAL) {
            liveDisplaySection.style.flex = "1 1 auto";
            liveDisplaySection.style.height = "auto";
            liveDisplaySection.style.maxHeight = "none";
        } else {
            liveDisplaySection.style.flex = "0 0 auto";
            liveDisplaySection.style.height = "";
            liveDisplaySection.style.maxHeight = "";
        }
    }
    if (buttonContainer) {
        buttonContainer.style.flex = "0 0 auto";
        buttonContainer.style.flexDirection = 'row';
    }
    if (lootContainer) lootContainer.style.flex = "1 1 0";
    if (creatureDropContainer) creatureDropContainer.style.flex = "1 1 0";

    // Use currentLayoutMode for layout
    if (panelState.mode === LAYOUT_MODES.HORIZONTAL) {
        panel.style.flexDirection = 'row';
        // Ensure leftColumn contains header, live, buttons in order
        if (leftColumn) {
            if (leftColumn.children[0] !== topHeaderContainer) leftColumn.insertBefore(topHeaderContainer, leftColumn.firstChild);
            if (leftColumn.children[1] !== liveDisplaySection) leftColumn.insertBefore(liveDisplaySection, leftColumn.children[1] || null);
            if (leftColumn.children[2] !== buttonContainer) leftColumn.appendChild(buttonContainer);
        }
        // Ensure panel order: leftColumn, loot, creatures
        [leftColumn, lootContainer, creatureDropContainer].forEach((el, idx) => {
            if (el && panel.children[idx] !== el) panel.insertBefore(el, panel.children[idx] || null);
        });
    } else if (panelState.mode === LAYOUT_MODES.MINIMIZED) {
        panel.style.flexDirection = 'column';
        // Remove leftColumn if present
        if (leftColumn && panel.contains(leftColumn)) panel.removeChild(leftColumn);
        // Always remove all five elements from the panel, then append in correct order
        [topHeaderContainer, liveDisplaySection, buttonContainer, lootContainer, creatureDropContainer].forEach(el => {
            if (el && el.parentNode === panel) panel.removeChild(el);
        });
        [topHeaderContainer, liveDisplaySection, buttonContainer].forEach(el => {
            if (el) panel.appendChild(el);
        });
        // Fit all to width/height auto
        if (topHeaderContainer) {
            topHeaderContainer.style.width = '100%';
            topHeaderContainer.style.height = 'auto';
        }
        if (liveDisplaySection) {
            liveDisplaySection.style.width = '100%';
            liveDisplaySection.style.flex = '1 1 auto';
            liveDisplaySection.style.height = 'auto';
            liveDisplaySection.style.maxHeight = 'none';
        }
        if (buttonContainer) {
            buttonContainer.style.width = '100%';
            buttonContainer.style.height = 'auto';
        }
    } else {
        // Vertical
        panel.style.flexDirection = 'column';
        // Remove leftColumn if present
        if (leftColumn && panel.contains(leftColumn)) panel.removeChild(leftColumn);
        // Always remove all five elements from the panel, then append in correct order
        [topHeaderContainer, liveDisplaySection, buttonContainer, lootContainer, creatureDropContainer].forEach(el => {
            if (el && el.parentNode === panel) panel.removeChild(el);
        });
        [topHeaderContainer, liveDisplaySection, buttonContainer, lootContainer, creatureDropContainer].forEach(el => {
            if (el) panel.appendChild(el);
        });
    }
}

// In the mousedown and mousemove handlers for resizing, keep the early return for minimized mode:
// (already present, but ensure it stays)
// panel.addEventListener('mousedown', ...)
// document.addEventListener('mousemove', ...)

// =======================
// 5. Event Handlers and Initialization
// =======================

// Listen for game start and end events using the game's global API.
if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.board && globalThis.state.board.on) {
    globalThis.state.board.on('newGame', (event) => {
        // Skip recording if in sandbox mode
        if (isSandboxMode()) {
            console.log("[Hunt Analyzer] Skipping sandbox mode session");
            return;
        }
        
        autoplayCount++;
        isGameActive = true;
        sessionStartTime = Date.now();
        updatePanelDisplay();
    });

    if (globalThis.state.board.subscribe) {
        boardSubscription = globalThis.state.board.subscribe(({ context }) => {
            const serverResults = context.serverResults;
            if (!serverResults || !serverResults.rewardScreen || typeof serverResults.seed === 'undefined') return;
            
            // Skip processing if in sandbox mode
            if (isSandboxMode()) {
                console.log("[Hunt Analyzer] Skipping sandbox mode results");
                return;
            }
            
            const seed = serverResults.seed;
            if (seed === lastSeed) return;
            lastSeed = seed;
            processAutoplaySummary(serverResults);
            isGameActive = false;
            updatePanelDisplay();
        });
    }
}

// Add game end detection using gameTimer.
if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.gameTimer && globalThis.state.gameTimer.subscribe) {
    gameTimerSubscription = globalThis.state.gameTimer.subscribe((data) => {
        // Skip processing if in sandbox mode
        if (isSandboxMode()) {
            return;
        }
        
        const { readableGrade, rankPoints } = data.context;
        if ((readableGrade !== undefined && readableGrade !== null) || (rankPoints !== undefined && rankPoints !== null)) {
            if (isGameActive) {
                isGameActive = false;
                updatePanelDisplay();
            }
        }
    });
}

// Create button to open the sidebar panel.
if (typeof api !== 'undefined' && api && api.ui && api.ui.addButton) {
    api.ui.addButton({
        id: BUTTON_ID,
        text: "Hunt Analyzer",
        tooltip: "Click to open hunt analyzer panel",
        primary: false,
        onClick: createAutoplayAnalyzerPanel
    });
} else {
    // This block is a fallback for development/testing environments
    // where the game's 'api' object might not be present.
    // In a production environment with the game API, this block can be removed.
    const testButton = document.createElement("button");
    testButton.textContent = "Open Hunt Analyzer (Test)"; // Renamed button text
    testButton.style.position = "fixed";
    testButton.style.bottom = "10px";
    testButton.style.right = "10px";
    testButton.style.padding = "10px";
    testButton.style.backgroundColor = "#555";
    testButton.style.color = "#fff";
    testButton.style.border = "none";
    testButton.style.borderRadius = "5px";
    testButton.style.zIndex = "10000";
    testButton.style.cursor = "pointer";
    testButton.setAttribute('data-hunt-analyzer-test', 'true');
    testButton.addEventListener("click", createAutoplayAnalyzerPanel);
    document.body.appendChild(testButton);
    console.log("[Hunt Analyzer] Fallback test button added.");
}

// Initial script execution setup.
console.log("[Hunt Analyzer] Hunt Analyzer script initialized.");

// Add these functions before createAutoplayAnalyzerPanel()
function savePanelSettings(panel) {
    if (!panel) return;
    
    // Get current panel settings
    const rect = panel.getBoundingClientRect();
    const settings = {
        width: panel.style.width,
        maxWidth: panel.style.maxWidth,
        minWidth: panel.style.minWidth,
        height: panel.style.height,
        maxHeight: panel.style.maxHeight,
        top: rect.top + 'px',
        left: rect.left + 'px',
        isMinimized: false
    };
    
    // Update config
    config.panelSettings = settings;
    
    // Save configuration using the mod loader's system
    api.service.updateScriptConfig(context.hash, config);
}

function loadPanelSettings() {
    // The settings are already loaded in the config object from context.config
    return config.panelSettings;
}

function applyPanelSettings(panel, settings) {
    if (!panel || !settings) return;
    
    // Apply all saved settings
    if (settings.width) panel.style.width = settings.width;
    if (settings.maxWidth) panel.style.maxWidth = settings.maxWidth;
    if (settings.minWidth) panel.style.minWidth = settings.minWidth;
    if (settings.height) panel.style.height = settings.height;
    if (settings.maxHeight) panel.style.maxHeight = settings.maxHeight;
    if (settings.top) panel.style.top = settings.top;
    if (settings.left) panel.style.left = settings.left;
    
    // Apply minimized state if needed
    if (settings.isMinimized !== undefined && settings.isMinimized !== false) {
        const lootContainer = panel.querySelector('.loot-container');
        const creatureDropContainer = panel.querySelector('.creature-drop-container');
        const minimizeButton = document.getElementById("mod-minimize-button");
        const buttonContainer = panel.querySelector('.button-container');
        if (lootContainer && creatureDropContainer && minimizeButton) {
            if (settings.isMinimized) {
                lootContainer.style.display = 'none';
                creatureDropContainer.style.display = 'none';
                panel.style.height = 'fit-content';
                panel.style.maxHeight = '200px';
                minimizeButton.textContent = '+';
                minimizeButton.title = 'Maximize Analyzer';
            } else {
                lootContainer.style.display = 'flex';
                lootContainer.style.flexDirection = 'column';
                creatureDropContainer.style.display = 'flex';
                creatureDropContainer.style.flexDirection = 'column';
                panel.style.height = '90vh';
                panel.style.maxHeight = '750px';
                minimizeButton.textContent = '—';
                minimizeButton.title = 'Minimize Analyzer';
            }
        }
    }
}

// Default config for first-time users: vertical mode, 300x700px. Otherwise, last saved config is used.
const defaultConfig = {
  panelSettings: {
    width: "300px",
    maxWidth: "500px",
    minWidth: "300px",
    height: "700px",
    maxHeight: "750px",
    minHeight: "500px",
    top: "50px",
    left: "10px",
    isMinimized: false
  }
};

// Initialize with saved config or defaults
const config = Object.assign({}, defaultConfig, context.config);

// Add resize handles to the panel (corners and edges)
function addResizeHandles(panel) {
    const directions = [
        'n', 'e', 's', 'w',
        'ne', 'se', 'sw', 'nw'
    ];
    directions.forEach(dir => {
        const handle = document.createElement('div');
        handle.className = 'resize-handle resize-handle-' + dir;
        handle.setAttribute('data-dir', dir);
        handle.style.position = 'absolute';
        handle.style.zIndex = '10001';
        handle.style.background = 'transparent';
        handle.style.userSelect = 'none';
        handle.setAttribute('aria-label', 'Resize ' + dir);
        // Position and size for each handle
        if (dir.length === 1) {
            // Edge
            if (dir === 'n' || dir === 's') {
                handle.style.height = '6px';
                handle.style.width = '100%';
                handle.style.cursor = dir + '-resize';
                handle.style[dir === 'n' ? 'top' : 'bottom'] = '0';
                handle.style.left = '0';
            } else {
                handle.style.width = '6px';
                handle.style.height = '100%';
                handle.style.cursor = dir + '-resize';
                handle.style[dir === 'w' ? 'left' : 'right'] = '0';
                handle.style.top = '0';
            }
        } else {
            // Corner
            handle.style.width = '12px';
            handle.style.height = '12px';
            handle.style.cursor = dir + '-resize';
            handle.style[dir.includes('n') ? 'top' : 'bottom'] = '0';
            handle.style[dir.includes('w') ? 'left' : 'right'] = '0';
        }
        panel.appendChild(handle);
    });
}

// Resizing logic using handles
function onResizeHandleMouseDown(e) {
    if (panelState.mode === LAYOUT_MODES.MINIMIZED) return;
    
    const dir = e.target.getAttribute('data-dir');
    if (!dir) return;
    
    const panel = e.target.parentElement;
    const rect = panel.getBoundingClientRect();
    
    Object.assign(panelState, {
        isResizing: true,
        resizeDir: dir,
        resizeStartX: e.clientX,
        resizeStartY: e.clientY,
        startWidth: rect.width,
        startHeight: rect.height,
        startLeft: rect.left,
        startTop: rect.top
    });
    
    panel.classList.add('resizing');
    document.body.style.userSelect = 'none';
    e.preventDefault();
}

document.addEventListener('mousemove', function(e) {
    if (!panelState.isResizing || panelState.mode === LAYOUT_MODES.MINIMIZED) return;
    const panel = document.getElementById(PANEL_ID);
    const layout = LAYOUT_DIMENSIONS[panelState.mode];
    let dx = e.clientX - panelState.resizeStartX;
    let dy = e.clientY - panelState.resizeStartY;
    let newWidth = panelState.startWidth;
    let newHeight = panelState.startHeight;
    let newLeft = panelState.startLeft;
    let newTop = panelState.startTop;

    // Handle width changes
    if (panelState.resizeDir.includes('e')) {
        // Right edge resize
        newWidth = clamp(panelState.startWidth + dx, layout.minWidth, layout.maxWidth);
    }
    if (panelState.resizeDir.includes('w')) {
        // Left edge resize
        const rightEdge = panelState.startLeft + panelState.startWidth;
        newWidth = clamp(panelState.startWidth - dx, layout.minWidth, layout.maxWidth);
        newLeft = rightEdge - newWidth;
    }

    // Handle height changes
    if (panelState.resizeDir.includes('s')) {
        // Bottom edge resize
        newHeight = clamp(panelState.startHeight + dy, layout.minHeight, layout.maxHeight);
    }
    if (panelState.resizeDir.includes('n')) {
        // Top edge resize
        const bottomEdge = panelState.startTop + panelState.startHeight;
        newHeight = clamp(panelState.startHeight - dy, layout.minHeight, layout.maxHeight);
        newTop = bottomEdge - newHeight;
    }

    // Apply changes
    panel.style.width = newWidth + 'px';
    panel.style.height = newHeight + 'px';
    panel.style.left = newLeft + 'px';
    panel.style.top = newTop + 'px';
    panel.classList.add('resizing');
});

document.addEventListener('mouseup', function(e) {
    if (panelState.isResizing) {
        const panel = document.getElementById(PANEL_ID);
        if (panel) {
            panel.classList.remove('resizing');
        }
        document.body.style.userSelect = '';
        panelState.resetResizeState();
    }
});

// Double-click header to maximize/restore
function onHeaderDblClick(e) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panelState.setMaximized(panel, !panelState.isMaximized);
}

// Optimize panel state management
const panelState = {
    mode: LAYOUT_MODES.VERTICAL,
    isResizing: false,
    resizeDir: '',
    resizeStartX: 0,
    resizeStartY: 0,
    startWidth: 0,
    startHeight: 0,
    startLeft: 0,
    startTop: 0,
    isMaximized: false,
    lastSize: null,
    
    // Add methods for state management
    resetResizeState() {
        this.isResizing = false;
        this.resizeDir = '';
        this.resizeStartX = 0;
        this.resizeStartY = 0;
        this.startWidth = 0;
        this.startHeight = 0;
        this.startLeft = 0;
        this.startTop = 0;
    },
    
    saveCurrentSize(panel) {
        if (!panel) return;
        this.lastSize = {
            width: panel.style.width,
            height: panel.style.height,
            left: panel.style.left,
            top: panel.style.top
        };
    },
    
    restoreLastSize(panel) {
        if (!panel || !this.lastSize) return;
        Object.assign(panel.style, this.lastSize);
    },
    
    setMaximized(panel, maximized) {
        if (!panel) return;
        this.isMaximized = maximized;
        
        if (maximized) {
            this.saveCurrentSize(panel);
            Object.assign(panel.style, {
                width: window.innerWidth + 'px',
                height: window.innerHeight + 'px',
                left: '0px',
                top: '0px'
            });
        } else {
            this.restoreLastSize(panel);
        }
    }
};

// Update the onHeaderDblClick function to use the new state management
function onHeaderDblClick(e) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panelState.setMaximized(panel, !panelState.isMaximized);
}

// Update the onResizeHandleMouseDown function
function onResizeHandleMouseDown(e) {
    if (panelState.mode === LAYOUT_MODES.MINIMIZED) return;
    
    const dir = e.target.getAttribute('data-dir');
    if (!dir) return;
    
    const panel = e.target.parentElement;
    const rect = panel.getBoundingClientRect();
    
    Object.assign(panelState, {
        isResizing: true,
        resizeDir: dir,
        resizeStartX: e.clientX,
        resizeStartY: e.clientY,
        startWidth: rect.width,
        startHeight: rect.height,
        startLeft: rect.left,
        startTop: rect.top
    });
    
    panel.classList.add('resizing');
    document.body.style.userSelect = 'none';
    e.preventDefault();
}

// Update the mouseup event listener
document.addEventListener('mouseup', function(e) {
    if (panelState.isResizing) {
        const panel = document.getElementById(PANEL_ID);
        if (panel) {
            panel.classList.remove('resizing');
        }
        document.body.style.userSelect = '';
        panelState.resetResizeState();
    }
});

// =======================
// 6. Cleanup System
// =======================

// Simplified cleanup function
function cleanupHuntAnalyzer() {
    console.log('[Hunt Analyzer] Starting cleanup...');
    
    try {
        // 1. Clear intervals
        if (updateIntervalId) {
            clearInterval(updateIntervalId);
            updateIntervalId = null;
        }
        
        // 2. Unsubscribe from subscriptions
        if (boardSubscription) {
            try {
                boardSubscription.unsubscribe();
                boardSubscription = null;
            } catch (error) {
                console.warn('[Hunt Analyzer] Error unsubscribing board:', error);
            }
        }
        
        if (gameTimerSubscription) {
            try {
                gameTimerSubscription.unsubscribe();
                gameTimerSubscription = null;
            } catch (error) {
                console.warn('[Hunt Analyzer] Error unsubscribing gameTimer:', error);
            }
        }
        
        // 3. Remove panel and test button
        const panel = document.getElementById(PANEL_ID);
        if (panel && panel.parentNode) {
            panel.parentNode.removeChild(panel);
        }
        
        const testButton = document.querySelector('[data-hunt-analyzer-test]');
        if (testButton && testButton.parentNode) {
            testButton.parentNode.removeChild(testButton);
        }
        
        // 4. Reset critical state only
        autoplayCount = 0;
        isGameActive = false;
        allGameSessionsData = [];
        globalAggregatedLootData.clear();
        globalAggregatedCreatureData.clear();
        itemVisualCache.clear();
        
        console.log('[Hunt Analyzer] Cleanup completed');
        
    } catch (error) {
        console.error('[Hunt Analyzer] Error during cleanup:', error);
    }
}

// Listen for mod disable events
window.addEventListener('message', (event) => {
    if (event.data && event.data.message && event.data.message.action === 'updateLocalModState') {
        const modName = event.data.message.name;
        const enabled = event.data.message.enabled;
        
        if (modName === 'Super Mods/Hunt Analyzer.js' && !enabled) {
            console.log('[Hunt Analyzer] Mod disabled, running cleanup...');
            cleanupHuntAnalyzer();
        }
    }
});

// Export functionality
exports = {
    cleanup: cleanupHuntAnalyzer,
    getVersion: () => HUNT_ANALYZER_VERSION,
    getStats: () => ({
        autoplayCount,
        totalGoldQuantity,
        totalCreatureDrops,
        totalEquipmentDrops,
        totalDustQuantity,
        totalStaminaSpent
    })
};

