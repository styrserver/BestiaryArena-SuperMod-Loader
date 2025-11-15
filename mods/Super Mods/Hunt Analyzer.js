// Hunt Analyzer Mod for Bestiary Arena

// =======================
// 1. Initialization & Setup
// =======================

// Use shared translation system via API
const t = (key) => api.i18n.t(key);

// =======================
// 1.0. Theme System
// =======================
const HUNT_ANALYZER_THEMES = {
    original: {
        name: 'Original',
    colors: {
      // Panel colors
      panelBackground: '#282C34',
      headerBackground: '#1a1a1a',
      sectionBackground: 'rgba(40,44,52,0.4)',
      sectionBackgroundFallback: '#323234',
      
      // Borders
      border: '#3A404A',
      borderDark: '#2C313A',
      
      // Text colors
      text: '#ABB2BF',
      textSecondary: '#FFFFFF',
      textAccent: '#E06C75',  // Room title, section titles
      textStats: '#98C379',   // Stats text
      textInfo: '#61AFEF',    // Info text (sessions, playtime)
      textGold: '#E5C07B',    // Gold color
      textDust: '#61AFEF',    // Dust color
      textShiny: '#C678DD',   // Shiny color 
      textRunes: '#98C379',   // Runes color
      
      // Button colors
      buttonBackground: 'linear-gradient(to bottom, #4B5563, #343841)',
      buttonHover: 'linear-gradient(to bottom, #6B7280, #4B5563)',
      buttonIconBackground: 'transparent',
      buttonIconHover: '#3A404A',
      
      // Dropdown colors
      dropdownBackground: 'rgba(40,44,52,0.8)',
      dropdownMenuBackground: 'rgba(40,44,52,0.95)',
      dropdownOptionHover: 'rgba(224, 108, 117, 0.2)',
      dropdownOptionSelected: 'rgba(224, 108, 117, 0.3)',
      
      // Entry colors
      entryBackground: 'rgba(59, 64, 72, 0.3)',
      
      // Dialog colors
      dialogBackground: '#282C34',
      dialogBorder: '#E06C75',
      dialogText: '#ABB2BF',
      dialogTitle: '#E06C75',
      confirmButtonBackground: '#E06C75',
      confirmButtonHover: 'linear-gradient(to bottom, #FF8A96, #E06C75)',
      confirmButtonActive: 'linear-gradient(to bottom, #E06C75, #C25560)',
      confirmButtonBorder: '#C25560',
      
      // Feedback colors
      feedbackSuccess: '#98C379',
      feedbackError: '#E06C75',
      
      // Shadows
      panelShadow: 'rgba(0,0,0,0.7)',
      textShadow: 'rgba(224, 108, 117, 0.7)',
      buttonShadow: 'rgba(0,0,0,0.5)',
      buttonShadowHover: 'rgba(0,0,0,0.7)',
      dialogShadow: 'rgba(0,0,0,0.8)',
      dropdownShadow: 'rgba(0,0,0,0.3)',
      
      // Overlay
      overlayBackground: 'rgba(0, 0, 0, 0.7)',
      
      // Button highlights
      buttonHighlight: 'rgba(255,255,255,0.1)',
      buttonHighlightHover: 'rgba(255,255,255,0.2)'
    },
    backgrounds: {
      panel: 'url(/_next/static/media/background-darker.2679c837.png)',
      header: 'url(/_next/static/media/background-dark.95edca67.png)',
      section: 'url(/_next/static/media/background-regular.b0337118.png)'
    }
  },
  ice: {
    name: 'Frosty',
    colors: {
      // Panel colors - Cool icy blue tones
      panelBackground: '#0a1419',
      headerBackground: '#050a0f',
      sectionBackground: 'rgba(13, 71, 161, 0.2)',
      sectionBackgroundFallback: '#0d1b2a',
      
      // Borders - Bright ice blue accents
      border: '#42a5f5',
      borderDark: '#0277bd',
      
      // Text colors - Cool, crisp palette
      text: '#b3d9f2',
      textSecondary: '#ffffff',
      textAccent: '#80d8ff',  // Bright ice blue for accents
      textStats: '#42a5f5',   // Sky blue for stats
      textInfo: '#64b5f6',    // Light blue for info
      textGold: '#ffcc80',    // Warm amber for gold (contrast)
      textDust: '#80d8ff',    // Ice blue for dust
      textShiny: '#b3e5fc',   // Light cyan for shiny
      textRunes: '#42a5f5',   // Sky blue for runes
      
      // Button colors - Cool blue gradients
      buttonBackground: 'linear-gradient(to bottom, #1565c0, #0d47a1)',
      buttonHover: 'linear-gradient(to bottom, #1976d2, #1565c0)',
      buttonIconBackground: 'transparent',
      buttonIconHover: 'rgba(66, 165, 245, 0.2)',
      
      // Dropdown colors
      dropdownBackground: 'rgba(10, 20, 25, 0.95)',
      dropdownMenuBackground: 'rgba(5, 10, 15, 0.98)',
      dropdownOptionHover: 'rgba(66, 165, 245, 0.15)',
      dropdownOptionSelected: 'rgba(128, 216, 255, 0.25)',
      
      // Entry colors
      entryBackground: 'rgba(13, 71, 161, 0.15)',
      
      // Dialog colors
      dialogBackground: '#0a1419',
      dialogBorder: '#80d8ff',
      dialogText: '#b3d9f2',
      dialogTitle: '#80d8ff',
      confirmButtonBackground: '#42a5f5',
      confirmButtonHover: 'linear-gradient(to bottom, #64b5f6, #42a5f5)',
      confirmButtonActive: 'linear-gradient(to bottom, #42a5f5, #0277bd)',
      confirmButtonBorder: '#0277bd',
      
      // Feedback colors
      feedbackSuccess: '#80d8ff',
      feedbackError: '#e91e63',
      
      // Shadows - Cool blue glow
      panelShadow: 'rgba(66, 165, 245, 0.3)',
      textShadow: 'rgba(128, 216, 255, 0.5)',
      buttonShadow: 'rgba(0, 0, 0, 0.8)',
      buttonShadowHover: 'rgba(66, 165, 245, 0.4)',
      dialogShadow: 'rgba(128, 216, 255, 0.4)',
      dropdownShadow: 'rgba(66, 165, 245, 0.3)',
      
      // Overlay
      overlayBackground: 'rgba(0, 0, 0, 0.85)',
      
      // Button highlights - Icy glow
      buttonHighlight: 'rgba(128, 216, 255, 0.1)',
      buttonHighlightHover: 'rgba(128, 216, 255, 0.2)'
    },
    backgrounds: {
      // Use blue background textures for ice theme
      panel: 'url(/_next/static/media/background-blue.7259c4ed.png)',
      header: 'url(/_next/static/media/background-blue.7259c4ed.png)',
      section: 'url(/_next/static/media/background-blue.7259c4ed.png)'
    }
  },
  poison: {
    name: 'Venomous',
    colors: {
      // Panel colors - Rich green/nature tones
      panelBackground: '#0f1a0f',
      headerBackground: '#050a05',
      sectionBackground: 'rgba(27, 94, 32, 0.2)',
      sectionBackgroundFallback: '#1b2e1b',
      
      // Borders - Vibrant green accents
      border: '#43a047',
      borderDark: '#2e7d32',
      
      // Text colors - Natural green palette
      text: '#c8e6c9',
      textSecondary: '#ffffff',
      textAccent: '#66bb6a',  // Bright green for accents
      textStats: '#4caf50',   // Medium green for stats
      textInfo: '#81c784',    // Light green for info
      textGold: '#ffd54f',    // Amber for gold (contrast)
      textDust: '#81c784',    // Light green for dust
      textShiny: '#66bb6a',   // Bright green for shiny
      textRunes: '#4caf50',   // Medium green for runes
      
      // Button colors - Green gradients
      buttonBackground: 'linear-gradient(to bottom, #2e7d32, #1b5e20)',
      buttonHover: 'linear-gradient(to bottom, #388e3c, #2e7d32)',
      buttonIconBackground: 'transparent',
      buttonIconHover: 'rgba(67, 160, 71, 0.2)',
      
      // Dropdown colors
      dropdownBackground: 'rgba(15, 26, 15, 0.95)',
      dropdownMenuBackground: 'rgba(5, 10, 5, 0.98)',
      dropdownOptionHover: 'rgba(67, 160, 71, 0.15)',
      dropdownOptionSelected: 'rgba(102, 187, 106, 0.25)',
      
      // Entry colors
      entryBackground: 'rgba(27, 94, 32, 0.15)',
      
      // Dialog colors
      dialogBackground: '#0f1a0f',
      dialogBorder: '#66bb6a',
      dialogText: '#c8e6c9',
      dialogTitle: '#66bb6a',
      confirmButtonBackground: '#43a047',
      confirmButtonHover: 'linear-gradient(to bottom, #66bb6a, #43a047)',
      confirmButtonActive: 'linear-gradient(to bottom, #43a047, #2e7d32)',
      confirmButtonBorder: '#2e7d32',
      
      // Feedback colors
      feedbackSuccess: '#66bb6a',
      feedbackError: '#d32f2f',
      
      // Shadows - Natural green glow
      panelShadow: 'rgba(67, 160, 71, 0.3)',
      textShadow: 'rgba(102, 187, 106, 0.5)',
      buttonShadow: 'rgba(0, 0, 0, 0.8)',
      buttonShadowHover: 'rgba(67, 160, 71, 0.4)',
      dialogShadow: 'rgba(102, 187, 106, 0.4)',
      dropdownShadow: 'rgba(67, 160, 71, 0.3)',
      
      // Overlay
      overlayBackground: 'rgba(0, 0, 0, 0.85)',
      
      // Button highlights - Green glow
      buttonHighlight: 'rgba(102, 187, 106, 0.1)',
      buttonHighlightHover: 'rgba(102, 187, 106, 0.2)'
    },
    backgrounds: {
      // Use green background textures for poison theme
      panel: 'url(/_next/static/media/background-green.be515334.png)',
      header: 'url(/_next/static/media/background-green.be515334.png)',
      section: 'url(/_next/static/media/background-green.be515334.png)'
    }
  },
  fire: {
    name: 'Demonic',
    colors: {
      // Panel colors - Deep red/fire tones
      panelBackground: '#1a0a0a',
      headerBackground: '#0f0505',
      sectionBackground: 'rgba(139, 0, 0, 0.3)',
      sectionBackgroundFallback: '#2a1414',
      
      // Borders - Fiery red accents
      border: '#dc143c',
      borderDark: '#8b0000',
      
      // Text colors - Warm red palette
      text: '#ffcccc',
      textSecondary: '#ffffff',
      textAccent: '#ff1744',  // Bright red for accents
      textStats: '#ff4444',   // Red for stats
      textInfo: '#ff6666',    // Light red for info
      textGold: '#ffaa00',    // Amber for gold
      textDust: '#ff6666',    // Light red for dust
      textShiny: '#ff1744',   // Bright red for shiny
      textRunes: '#ff4444',   // Red for runes
      
      // Button colors - Red gradients
      buttonBackground: 'linear-gradient(to bottom, #8b0000, #5a0000)',
      buttonHover: 'linear-gradient(to bottom, #b71c1c, #8b0000)',
      buttonIconBackground: 'transparent',
      buttonIconHover: 'rgba(220, 20, 60, 0.2)',
      
      // Dropdown colors
      dropdownBackground: 'rgba(26, 10, 10, 0.95)',
      dropdownMenuBackground: 'rgba(15, 5, 5, 0.98)',
      dropdownOptionHover: 'rgba(220, 20, 60, 0.15)',
      dropdownOptionSelected: 'rgba(255, 23, 68, 0.25)',
      
      // Entry colors
      entryBackground: 'rgba(139, 0, 0, 0.2)',
      
      // Dialog colors
      dialogBackground: '#1a0a0a',
      dialogBorder: '#ff1744',
      dialogText: '#ffcccc',
      dialogTitle: '#ff1744',
      confirmButtonBackground: '#dc143c',
      confirmButtonHover: 'linear-gradient(to bottom, #ff1744, #dc143c)',
      confirmButtonActive: 'linear-gradient(to bottom, #dc143c, #8b0000)',
      confirmButtonBorder: '#8b0000',
      
      // Feedback colors
      feedbackSuccess: '#ff4444',
      feedbackError: '#ff1744',
      
      // Shadows - Fiery red glow
      panelShadow: 'rgba(220, 20, 60, 0.4)',
      textShadow: 'rgba(255, 23, 68, 0.6)',
      buttonShadow: 'rgba(0, 0, 0, 0.8)',
      buttonShadowHover: 'rgba(220, 20, 60, 0.5)',
      dialogShadow: 'rgba(255, 23, 68, 0.5)',
      dropdownShadow: 'rgba(220, 20, 60, 0.4)',
      
      // Overlay
      overlayBackground: 'rgba(0, 0, 0, 0.85)',
      
      // Button highlights - Fiery glow
      buttonHighlight: 'rgba(255, 23, 68, 0.1)',
      buttonHighlightHover: 'rgba(255, 23, 68, 0.2)'
    },
    backgrounds: {
      // Use red background textures for fire theme
      panel: 'url(/_next/static/media/background-red.21d3f4bd.png)',
      header: 'url(/_next/static/media/background-red.21d3f4bd.png)',
      section: 'url(/_next/static/media/background-red.21d3f4bd.png)'
    }
  },
  undead: {
    name: 'Undead',
    colors: {
      // Panel colors - Deep purple/undead tones
      panelBackground: '#1a0f1a',
      headerBackground: '#0f050f',
      sectionBackground: 'rgba(74, 20, 140, 0.3)',
      sectionBackgroundFallback: '#2a142a',
      
      // Borders - Mystical purple accents
      border: '#8e24aa',
      borderDark: '#4a148c',
      
      // Text colors - Purple palette
      text: '#e1bee7',
      textSecondary: '#ffffff',
      textAccent: '#ab47bc',  // Bright purple for accents
      textStats: '#9575cd',   // Light purple for stats
      textInfo: '#ba68c8',    // Medium purple for info
      textGold: '#ffaa00',    // Amber for gold (contrast)
      textDust: '#ba68c8',    // Medium purple for dust
      textShiny: '#ab47bc',   // Bright purple for shiny
      textRunes: '#9575cd',   // Light purple for runes
      
      // Button colors - Purple gradients
      buttonBackground: 'linear-gradient(to bottom, #4a148c, #311b92)',
      buttonHover: 'linear-gradient(to bottom, #6a1b9a, #4a148c)',
      buttonIconBackground: 'transparent',
      buttonIconHover: 'rgba(142, 36, 170, 0.2)',
      
      // Dropdown colors
      dropdownBackground: 'rgba(26, 15, 26, 0.95)',
      dropdownMenuBackground: 'rgba(15, 5, 15, 0.98)',
      dropdownOptionHover: 'rgba(142, 36, 170, 0.15)',
      dropdownOptionSelected: 'rgba(171, 71, 188, 0.25)',
      
      // Entry colors
      entryBackground: 'rgba(74, 20, 140, 0.2)',
      
      // Dialog colors
      dialogBackground: '#1a0f1a',
      dialogBorder: '#ab47bc',
      dialogText: '#e1bee7',
      dialogTitle: '#ab47bc',
      confirmButtonBackground: '#8e24aa',
      confirmButtonHover: 'linear-gradient(to bottom, #ab47bc, #8e24aa)',
      confirmButtonActive: 'linear-gradient(to bottom, #8e24aa, #4a148c)',
      confirmButtonBorder: '#4a148c',
      
      // Feedback colors
      feedbackSuccess: '#ab47bc',
      feedbackError: '#d32f2f',
      
      // Shadows - Mystical purple glow
      panelShadow: 'rgba(142, 36, 170, 0.4)',
      textShadow: 'rgba(171, 71, 188, 0.6)',
      buttonShadow: 'rgba(0, 0, 0, 0.8)',
      buttonShadowHover: 'rgba(142, 36, 170, 0.5)',
      dialogShadow: 'rgba(171, 71, 188, 0.5)',
      dropdownShadow: 'rgba(142, 36, 170, 0.4)',
      
      // Overlay
      overlayBackground: 'rgba(0, 0, 0, 0.85)',
      
      // Button highlights - Purple glow
      buttonHighlight: 'rgba(171, 71, 188, 0.1)',
      buttonHighlightHover: 'rgba(171, 71, 188, 0.2)'
    },
    backgrounds: {
      // Use darker background textures for undead theme
      panel: 'url(/_next/static/media/background-darker.2679c837.png)',
      header: 'url(/_next/static/media/background-dark.95edca67.png)',
      section: 'url(/_next/static/media/background-darker.2679c837.png)'
    }
  }
};

// Theme utility functions
function getCurrentTheme() {
  // Use try-catch to safely access HuntAnalyzerState (may not be initialized yet during early CSS injection)
  try {
    if (typeof HuntAnalyzerState !== 'undefined' && HuntAnalyzerState.settings && HuntAnalyzerState.settings.theme) {
      const themeName = HuntAnalyzerState.settings.theme;
      return HUNT_ANALYZER_THEMES[themeName] || HUNT_ANALYZER_THEMES.original;
    }
  } catch (e) {
    // HuntAnalyzerState not yet defined, use default
  }
  return HUNT_ANALYZER_THEMES.original;
}

function getThemeColor(colorKey) {
  const theme = getCurrentTheme();
  return theme.colors[colorKey] || '#ABB2BF'; // Fallback to default text color
}

function getThemeBackground(backgroundKey) {
  const theme = getCurrentTheme();
  return theme.backgrounds[backgroundKey] || '';
}

// Apply theme to an element (helper for inline styles)
function applyThemeStyle(element, styleMap) {
  if (!element) return;
  const theme = getCurrentTheme();
  Object.entries(styleMap).forEach(([property, colorKey]) => {
    if (theme.colors[colorKey]) {
      element.style[property] = theme.colors[colorKey];
    } else {
      // Fallback: use colorKey directly if it's not a theme key
      element.style[property] = colorKey;
    }
  });
}

// =======================
// 1.1. CSS Styles
// =======================
// Inject CSS styles for common UI patterns
function injectHuntAnalyzerStyles() {
    const styleId = 'hunt-analyzer-styles';
    let style = document.getElementById(styleId);
    
    // Remove existing style if it exists (for theme updates)
    if (style) {
        style.remove();
    }
    
    const theme = getCurrentTheme();
    
    style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* Hunt Analyzer Theme Variables */
        :root {
            --ha-panel-bg: ${theme.colors.panelBackground};
            --ha-panel-bg-image: ${theme.backgrounds.panel};
            --ha-header-bg: ${theme.colors.headerBackground};
            --ha-header-bg-image: ${theme.backgrounds.header};
            --ha-section-bg: ${theme.colors.sectionBackground};
            --ha-section-bg-image: ${theme.backgrounds.section};
            --ha-section-bg-fallback: ${theme.colors.sectionBackgroundFallback};
            --ha-border: ${theme.colors.border};
            --ha-border-dark: ${theme.colors.borderDark};
            --ha-text: ${theme.colors.text};
            --ha-text-secondary: ${theme.colors.textSecondary};
            --ha-text-accent: ${theme.colors.textAccent};
            --ha-text-stats: ${theme.colors.textStats};
            --ha-text-info: ${theme.colors.textInfo};
            --ha-button-bg: ${theme.colors.buttonBackground};
            --ha-button-hover: ${theme.colors.buttonHover};
            --ha-button-icon-bg: ${theme.colors.buttonIconBackground};
            --ha-button-icon-hover: ${theme.colors.buttonIconHover};
            --ha-panel-shadow: ${theme.colors.panelShadow};
            --ha-text-shadow: ${theme.colors.textShadow};
            --ha-button-shadow: ${theme.colors.buttonShadow};
            --ha-button-shadow-hover: ${theme.colors.buttonShadowHover};
            --ha-button-highlight: ${theme.colors.buttonHighlight};
            --ha-button-highlight-hover: ${theme.colors.buttonHighlightHover};
        }
        
        /* Hunt Analyzer Common Styles */
        .ha-panel-container {
            position: fixed;
            background-image: var(--ha-panel-bg-image);
            background-repeat: repeat;
            background-color: var(--ha-panel-bg);
            border: 1px solid var(--ha-border);
            color: var(--ha-text);
            padding: 0;
            overflow: hidden;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            height: 100%;
            font-family: Inter, sans-serif;
            border-radius: 7px;
            box-shadow: 0 0 15px var(--ha-panel-shadow);
        }
        
        .ha-header-container {
            display: flex;
            flex-direction: column;
            width: 100%;
            background-image: var(--ha-header-bg-image);
            background-repeat: repeat;
            background-color: var(--ha-header-bg);
            border-bottom: 1px solid var(--ha-border);
            padding: 4px;
            flex: 0 0 auto;
        }
        
        .ha-title-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            margin-bottom: 2px;
            cursor: move;
        }
        
        .ha-room-title {
            margin: 0;
            font-size: 14px;
            color: var(--ha-text-accent);
            font-weight: bold;
            text-shadow: 0 0 5px var(--ha-text-shadow);
        }
        
        .ha-header-controls {
            display: flex;
            gap: 5px;
        }
        
        .ha-styled-button {
            padding: 6px 12px;
            border: 1px solid var(--ha-border);
            background: var(--ha-button-bg);
            color: var(--ha-text);
            font-size: 9px;
            cursor: pointer;
            border-radius: 5px;
            transition: all 0.2s ease;
            box-shadow: 0 2px 5px var(--ha-button-shadow), inset 0 1px 0 var(--ha-button-highlight);
            flex-grow: 1;
        }
        
        .ha-styled-button:hover {
            background: var(--ha-button-hover);
            box-shadow: 0 3px 8px var(--ha-button-shadow-hover), inset 0 1px 0 var(--ha-button-highlight-hover);
            transform: translateY(-1px);
        }
        
        .ha-styled-button:active {
            box-shadow: inset 0 2px 5px var(--ha-button-shadow);
            transform: translateY(1px);
        }
        
        .ha-icon-button {
            background-color: var(--ha-button-icon-bg);
            border: 1px solid var(--ha-border);
            color: var(--ha-text);
            padding: 2px 6px;
            margin: 0;
            cursor: pointer;
            font-size: 12px;
            line-height: 1;
            min-width: 20px;
            min-height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 3px;
            transition: all 0.2s ease;
        }
        
        .ha-icon-button:hover {
            background-color: var(--ha-button-icon-hover);
            color: var(--ha-text-secondary);
        }
        
        .ha-icon-button:active {
            transform: translateY(1px);
            background-color: var(--ha-border-dark);
        }
        
        .ha-container-section {
            display: flex;
            flex-direction: column;
            flex: 1 1 0;
            min-height: 0;
            margin: 0 5px 5px 5px;
            background-image: var(--ha-section-bg-image);
            background-repeat: repeat;
            background-color: var(--ha-section-bg-fallback);
            border-radius: 6px;
            padding: 6px;
            overflow-y: auto;
        }
        
        .ha-section-title {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 3px;
        }
        
        .ha-section-title h3 {
            margin: 0px;
            font-size: 14px;
            color: var(--ha-text-accent);
            font-weight: bold;
            text-shadow: var(--ha-text-shadow) 0px 0px 5px;
        }
        
        .ha-display-content {
            width: 100%;
            padding: 4px;
            border: 1px solid var(--ha-border);
            background-color: var(--ha-section-bg);
            border-radius: 4px;
            overflow-y: auto;
            max-height: 200px;
        }
        
        .ha-flex-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
        }
        
        .ha-flex-column {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        
        .ha-stats-text {
            font-size: 10px;
            color: var(--ha-text-stats);
        }
        
        .ha-border-separator {
            border-top: 1px solid var(--ha-border);
            border-bottom: 1px solid var(--ha-border);
            margin-top: 6px;
            padding: 3px 0;
        }
    `;
    document.head.appendChild(style);
}

// =======================
// 2.1. Utility Functions
// =======================
function normalizeName(name) {
    return name?.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

/**
 * Determines the category of an item for sorting purposes
 * @param {Object} item - The item object
 * @returns {number} Category priority: 1=Runes, 2=Equipment, 3=Everything else
 */
function getItemCategory(item) {
    const name = item.originalName.toLowerCase();
    if (name.includes('rune')) {
        return 1; // Runes first
    } else if (item.isEquipment) {
        return 2; // Equipment second
    } else {
        return 3; // Everything else last
    }
}

// Throttling for frequent updates
let lastUpdateLogTime = 0;

// Track last known values to avoid unnecessary updates
let lastKnownSessionCount = 0;
let lastKnownGold = 0;
let lastKnownDust = 0;
let lastKnownShiny = 0;

// Throttling for board subscription to avoid interfering with animations
let lastBoardSubscriptionTime = 0;

// =======================
// 2.2. Constants & Globals
// =======================
const PANEL_ID = "mod-autoplay-analyzer-panel";
const BUTTON_ID = "mod-autoplay-button";
const DUST_ICON_SRC = '/assets/icons/dust.png';
const LAYOUT_MODES = {
    VERTICAL: 'vertical',
    HORIZONTAL: 'horizontal',
    MINIMIZED: 'minimized'
};
const LAYOUT_DIMENSIONS = {
    [LAYOUT_MODES.VERTICAL]: { width: 350, height: 750, minWidth: 260, maxWidth: 500, minHeight: 500, maxHeight: 750 },
    [LAYOUT_MODES.HORIZONTAL]: { width: 300, height: 300, minWidth: 650, maxWidth: 1000, minHeight: 220, maxHeight: 400 },
    [LAYOUT_MODES.MINIMIZED]: { width: 250, height: 250, minWidth: 250, maxWidth: 250, minHeight: 250, maxHeight: 250 }
};

// =======================
// 2.3. Configuration Constants
// =======================
const CONFIG = {
    // Throttling and timing
    UPDATE_LOG_THROTTLE: 30000, // 30 seconds
    BOARD_SUBSCRIPTION_THROTTLE: 100, // 100ms
    
    // Panel positioning and sizing
    PANEL_DEFAULT_TOP: 50,
    PANEL_DEFAULT_LEFT: 10,
    PANEL_GAP: 10,
    
    // Resize handles
    RESIZE_EDGE_SIZE: 8,
    RESIZE_HANDLE_SIZE: 6,
    RESIZE_CORNER_SIZE: 12,
    
    // UI styling
    ICON_SIZE: 36,
    SMALL_ICON_SIZE: 12,
    BUTTON_PADDING: '6px 12px',
    ICON_BUTTON_PADDING: '2px 6px',
    
    // Item processing
    GOLD_SPRITE_ID: 3031,
    HEAL_POTION_SPRITE_ID: 10327,
    
    // Stamina recovery values
    STAMINA_RECOVERY: {
        1: 12,  // Mini
        2: 24,  // Strong  
        3: 48,  // Great
        4: 96,  // Ultimate
        5: null  // Supreme (will be set to player's max stamina, capped at 360)
    },
    
    // Auto-save interval (30 seconds)
    AUTO_SAVE_INTERVAL: 30000
};

// =======================
// 2.4. Centralized State Management
// =======================
const HuntAnalyzerState = {
  session: {
    count: 0,
    startTime: 0,
    isActive: false,
    sessionStartTime: 0
  },
  totals: {
    gold: 0,
    creatures: 0,
    equipment: 0,
    runes: 0,
    dust: 0,
    shiny: 0,
    staminaSpent: 0,
    staminaRecovered: 0,
    wins: 0,
    losses: 0
  },
  data: {
    sessions: [],
    aggregatedLoot: new Map(),
    aggregatedCreatures: new Map()
  },
  ui: {
    updateIntervalId: null,
    lastSeed: null,
    autoplayLogText: "",
    selectedMapFilter: "ALL"
  },
  settings: (() => {
    const settings = {
      theme: 'original',
      persistData: false
    };
    let isApplyingTheme = false; // Flag to prevent recursion when applyTheme sets the property
    // Wrap settings with Proxy to watch for theme changes (event-driven, no polling needed)
    return new Proxy(settings, {
      set(target, property, value) {
        const oldValue = target[property];
        target[property] = value;
        // If theme changed externally (not from applyTheme itself), apply it immediately
        if (property === 'theme' && value !== oldValue && !isApplyingTheme && typeof applyTheme === 'function') {
          // Use setTimeout to avoid issues if applyTheme is called during initialization
          setTimeout(() => {
            console.log('[Hunt Analyzer] Theme changed via direct property update:', value);
            isApplyingTheme = true;
            applyTheme(value, true);
            isApplyingTheme = false;
          }, 0);
        }
        return true;
      }
    });
  })(),
  // Internal clock system for accurate time tracking
  timeTracking: {
    currentMap: null,
    mapStartTime: 0,
    accumulatedTimeMs: 0, // Total time accumulated across all maps
    mapTimeMs: new Map(), // Time per map: Map<roomName, timeMs>
    lastAutoplayTime: 0,
    clockIntervalId: null,
    // Manual mode timing (when no autoplay timer exists)
    manualActive: false,
    manualSessionStartMs: 0,
    // When true, wait for the next newGame to start manual timing (set on map change)
    waitingForManualStart: false,
    // Autoplay baseline to subtract when map changes so we don't double count
    autoplayBaselineMinutes: 0,
    // When true, skip the next autoplay reset accumulation (used after we already snapshot on map/mode change)
    suppressNextAutoplayReset: false
  }
};

// =======================
// 2.4.a Unified Time Helpers
// =======================
function getCurrentMode() {
  try {
    const mode = globalThis.state?.board?.getSnapshot?.()?.context?.mode;
    if (mode === 'autoplay') return 'autoplay';
    if (mode === 'manual') return 'manual';
    return 'none';
  } catch (_e) {
    return 'none';
  }
}

function getLiveSessionMs() {
  const mode = getCurrentMode();
  if (mode === 'autoplay') {
    const currentAutoplayTime = getAutoplaySessionTime(); // minutes
    if (currentAutoplayTime && currentAutoplayTime > 0) {
      const adjustedAutoplayMinutes = Math.max(0, currentAutoplayTime - (HuntAnalyzerState.timeTracking.autoplayBaselineMinutes || 0));
      return adjustedAutoplayMinutes * 60 * 1000;
    }
    return 0;
  }
  if (mode === 'manual') {
    if (HuntAnalyzerState.timeTracking.manualActive && HuntAnalyzerState.timeTracking.manualSessionStartMs > 0) {
      return Date.now() - HuntAnalyzerState.timeTracking.manualSessionStartMs;
    }
    return 0;
  }
  return 0;
}

function snapshotIntoTotals() {
  const liveMs = getLiveSessionMs();
  if (liveMs > 0) {
    HuntAnalyzerState.timeTracking.accumulatedTimeMs += liveMs;
    if (HuntAnalyzerState.timeTracking.currentMap) {
      const prevMapTime = HuntAnalyzerState.timeTracking.mapTimeMs.get(HuntAnalyzerState.timeTracking.currentMap) || 0;
      HuntAnalyzerState.timeTracking.mapTimeMs.set(HuntAnalyzerState.timeTracking.currentMap, prevMapTime + liveMs);
    }
  }

  const mode = getCurrentMode();
  if (mode === 'autoplay') {
    // Reset autoplay baseline to current DOM minutes so next session starts from 0
    const currentAutoplayTime = getAutoplaySessionTime();
    HuntAnalyzerState.timeTracking.autoplayBaselineMinutes = currentAutoplayTime || 0;
    // Ensure manual is not active
    HuntAnalyzerState.timeTracking.manualActive = false;
    HuntAnalyzerState.timeTracking.manualSessionStartMs = 0;
  } else if (mode === 'manual') {
    // Keep manual timing continuous but avoid double counting: advance start to now
    if (HuntAnalyzerState.timeTracking.manualActive) {
      HuntAnalyzerState.timeTracking.manualSessionStartMs = Date.now();
    }
  }
  return liveMs;
}

// Storage keys for persistence
const HUNT_ANALYZER_STORAGE_KEY = 'huntAnalyzerData';
const HUNT_ANALYZER_PANEL_SETTINGS_KEY = 'hunt-analyzer-panel-settings';
const HUNT_ANALYZER_STATE_KEY = 'huntAnalyzerState';
const HUNT_ANALYZER_SETTINGS_KEY = 'huntAnalyzerSettings';

// Maximum number of sessions to keep in storage (to prevent quota exceeded errors)
const MAX_SESSIONS_TO_KEEP = 10000;

// =======================
// 2.5. Autoplay Time Tracking Functions
// =======================
// Parse autoplay session time from DOM text content
function parseAutoplayTime(textContent) {
  const enText = "Autoplay session";
  const ptText = "Sessão autoplay";
  
  // Pattern for H:MM:SS format (1 hour and above)
  const hourPattern = new RegExp(`(?:${enText}|${ptText}) \\((\\d+):(\\d+):(\\d+)\\)`);
  const hourMatch = textContent.match(hourPattern);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1]);
    const minutes = parseInt(hourMatch[2]);
    const seconds = parseInt(hourMatch[3]);
    return (hours * 60) + minutes + (seconds / 60);
  }
  
  // Pattern for MM:SS format (under 1 hour)
  const minutePattern = new RegExp(`(?:${enText}|${ptText}) \\((\\d+):(\\d+)\\)`);
  const minuteMatch = textContent.match(minutePattern);
  if (minuteMatch) {
    const minutes = parseInt(minuteMatch[1]);
    const seconds = parseInt(minuteMatch[2]);
    return minutes + (seconds / 60);
  }
  
  return null;
}

// Get current autoplay session time from DOM
function getAutoplaySessionTime() {
  try {
    const autoplayButton = document.querySelector('button.widget-top-text img[alt="Autoplay"]');
    if (autoplayButton) {
      const button = autoplayButton.closest('button');
      if (button) {
        const time = parseAutoplayTime(button.textContent);
        if (time !== null) return time;
      }
    }
    
    // Fallback: look for any button containing autoplay session text
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
      const time = parseAutoplayTime(button.textContent);
      if (time !== null) return time;
    }
    
    return 0;
  } catch (error) {
    console.error('[Hunt Analyzer] Error getting autoplay session time:', error);
    return 0;
  }
}

// =======================
// 2.6. DOM Cache Manager
// =======================
class DOMCache {
  constructor() {
    this.elements = new Map();
    this.itemVisuals = new Map();
  }

  get(id) {
    if (!this.elements.has(id)) {
      const element = document.getElementById(id);
      if (element) {
        this.elements.set(id, element);
      }
    }
    return this.elements.get(id);
  }

  set(id, element) {
    this.elements.set(id, element);
  }

  clear() {
    this.elements.clear();
    this.itemVisuals.clear();
  }

  getItemVisual(key) {
    return this.itemVisuals.get(key);
  }

  setItemVisual(key, visual) {
    this.itemVisuals.set(key, visual);
  }
}

// Initialize DOM cache
const domCache = new DOMCache();

// =======================
// 2.7. Internal Clock System
// =======================
// Start the internal clock system
function startInternalClock(reason) {
  if (HuntAnalyzerState.timeTracking.clockIntervalId) {
    clearInterval(HuntAnalyzerState.timeTracking.clockIntervalId);
  }
  
  console.log('[Hunt Analyzer] Internal clock: starting interval (1s)', reason ? `reason: ${reason}` : '');
  HuntAnalyzerState.timeTracking.clockIntervalId = setInterval(() => {
    updateInternalClock();
  }, 1000); // Update every second
}

// Stop the internal clock system
function stopInternalClock() {
  if (HuntAnalyzerState.timeTracking.clockIntervalId) {
    clearInterval(HuntAnalyzerState.timeTracking.clockIntervalId);
    HuntAnalyzerState.timeTracking.clockIntervalId = null;
    console.log('[Hunt Analyzer] Internal clock: stopped');
  }
}

// =======================
// 2.7.a Rank Pointer Coordination
// =======================
// Rank Pointer coordination is now handled event-driven in updateInternalClock()
// No polling needed - manual timing is already started on newGame events and mode changes

// Update the internal clock by watching DOM autoplay timer
function updateInternalClock() {
  const currentAutoplayTime = getAutoplaySessionTime();
  const nowMs = Date.now();
  const mode = getCurrentMode();
  const isAutoplayRunning = mode === 'autoplay' && currentAutoplayTime && currentAutoplayTime > 0;
  // Lightweight heartbeat only when something interesting changes below
  
  // Check Rank Pointer coordination (event-driven, no polling)
  // If Rank Pointer is running and we're in manual mode, ensure timing is active
  if (mode === 'manual' && !HuntAnalyzerState.timeTracking.manualActive) {
    try {
      const rankPointerRunning = !!(window.__modCoordination && window.__modCoordination.rankPointerRunning);
      if (rankPointerRunning) {
        HuntAnalyzerState.timeTracking.manualActive = true;
        HuntAnalyzerState.timeTracking.manualSessionStartMs = Date.now();
        console.log('[Hunt Analyzer] Manual timing: started due to Rank Pointer (event-driven)');
      }
    } catch (_) {}
  }
  
  // If autoplay is active, stop manual session (manual starts only on first newGame)
  if (isAutoplayRunning) {
    // If we were in manual, first accumulate manual elapsed into totals and current map
    if (HuntAnalyzerState.timeTracking.manualActive && HuntAnalyzerState.timeTracking.manualSessionStartMs > 0) {
      const elapsedManualMs = nowMs - HuntAnalyzerState.timeTracking.manualSessionStartMs;
      HuntAnalyzerState.timeTracking.accumulatedTimeMs += elapsedManualMs;
      if (HuntAnalyzerState.timeTracking.currentMap) {
        const prevMapTime = HuntAnalyzerState.timeTracking.mapTimeMs.get(HuntAnalyzerState.timeTracking.currentMap) || 0;
        HuntAnalyzerState.timeTracking.mapTimeMs.set(HuntAnalyzerState.timeTracking.currentMap, prevMapTime + elapsedManualMs);
      }
      HuntAnalyzerState.timeTracking.manualActive = false;
      HuntAnalyzerState.timeTracking.manualSessionStartMs = 0;
      // Start autoplay session from its current value (baseline 0 so we count full autoplay session)
      HuntAnalyzerState.timeTracking.autoplayBaselineMinutes = 0;
      console.log('[Hunt Analyzer] Internal clock: switched to autoplay, manual elapsed accumulated (ms):', elapsedManualMs);
    }
  }
  
  // If autoplay time decreased (session reset), accumulate the previous time
  if (currentAutoplayTime < HuntAnalyzerState.timeTracking.lastAutoplayTime) {
    if (HuntAnalyzerState.timeTracking.suppressNextAutoplayReset) {
      // We already snapshotted this segment on a recent map/mode change; skip double-counting
      HuntAnalyzerState.timeTracking.suppressNextAutoplayReset = false;
      console.log('[Hunt Analyzer] Internal clock: autoplay reset detected but suppressed to avoid double count');
    } else {
      const timeToAccumulate = HuntAnalyzerState.timeTracking.lastAutoplayTime * 60 * 1000; // Convert minutes to ms
      
      // Add to accumulated time
      HuntAnalyzerState.timeTracking.accumulatedTimeMs += timeToAccumulate;
      
      // Add to current map time if we have one
      if (HuntAnalyzerState.timeTracking.currentMap) {
        const currentMapTime = HuntAnalyzerState.timeTracking.mapTimeMs.get(HuntAnalyzerState.timeTracking.currentMap) || 0;
        HuntAnalyzerState.timeTracking.mapTimeMs.set(HuntAnalyzerState.timeTracking.currentMap, currentMapTime + timeToAccumulate);
      }
      console.log('[Hunt Analyzer] Internal clock: autoplay reset detected, accumulated previous autoplay (ms):', timeToAccumulate);
    }
  }
  
  // Track last DOM-reported autoplay minutes
  const prevAutoplayTime = HuntAnalyzerState.timeTracking.lastAutoplayTime;
  HuntAnalyzerState.timeTracking.lastAutoplayTime = currentAutoplayTime;
  
  // Only when actually in autoplay mode, detect transition from >0 → 0 and reset baseline
  if (mode === 'autoplay' && prevAutoplayTime > 0 && currentAutoplayTime === 0) {
    HuntAnalyzerState.timeTracking.autoplayBaselineMinutes = 0;
    console.log('[Hunt Analyzer] Internal clock: autoplay baseline reset to 0');
  }
}

// Track map change and start timing for new map
function trackMapChange(roomName) {
  // If we're switching maps, just update context. Accumulation is handled by snapshotIntoTotals() upstream.
  const mapChanged = HuntAnalyzerState.timeTracking.currentMap && HuntAnalyzerState.timeTracking.currentMap !== roomName;
  if (mapChanged) {
    console.log('[Hunt Analyzer] Map change:', {
      from: HuntAnalyzerState.timeTracking.currentMap,
      to: roomName,
      accumulatedMs: 0
    });
  }

  // Set new current map
  HuntAnalyzerState.timeTracking.currentMap = roomName;
  HuntAnalyzerState.timeTracking.mapStartTime = Date.now();
  
  // If in manual mode and map actually changed, start a new manual session window from now
  if (mapChanged && HuntAnalyzerState.timeTracking.manualActive) {
    HuntAnalyzerState.timeTracking.manualSessionStartMs = Date.now();
    console.log('[Hunt Analyzer] Manual timing: new session window started due to map change');
  }
}

// Get filtered time for rate calculations
function getFilteredTimeHours() {
  const liveMs = getLiveSessionMs();
  if (HuntAnalyzerState.ui.selectedMapFilter === "ALL") {
    return (HuntAnalyzerState.timeTracking.accumulatedTimeMs + liveMs) / (1000 * 60 * 60);
  } else {
    // Return time for selected map plus current session if on that map
    const mapTimeMs = HuntAnalyzerState.timeTracking.mapTimeMs.get(HuntAnalyzerState.ui.selectedMapFilter) || 0;
    let totalTimeMs = mapTimeMs;
    if (HuntAnalyzerState.timeTracking.currentMap === HuntAnalyzerState.ui.selectedMapFilter) {
      totalTimeMs += liveMs;
    }
    return totalTimeMs / (1000 * 60 * 60);
  }
}

// Format playtime for display
function formatPlaytime(hours) {
  const totalMinutes = Math.floor(hours * 60);
  const totalSeconds = Math.floor(hours * 3600);
  
  const displayHours = Math.floor(totalSeconds / 3600);
  const displayMinutes = Math.floor((totalSeconds % 3600) / 60);
  const displaySeconds = totalSeconds % 60;
  
  return `${displayHours.toString().padStart(2, '0')}:${displayMinutes.toString().padStart(2, '0')}:${displaySeconds.toString().padStart(2, '0')}`;
}

// =======================
// 2.8. Performance Caching & Event Handlers
// =======================
const equipmentCache = new Map();
const monsterCache = new Map();
const itemInfoCache = new Map();

// Cleanup references
let boardSubscription = null;
let modeMapSubscription = null;
let updateIntervalId = null;
let autoSaveIntervalId = null;
let mapDebugLastLogTime = 0;
let mapDebugLogCount = 0;
let timeoutIds = [];

// Event handler tracking for memory leak prevention
let panelResizeMouseMoveHandler = null;
let panelResizeMouseUpHandler = null;
let panelDragMouseMoveHandler = null;
let panelDragMouseUpHandler = null;
let globalResizeMouseMoveHandler = null;
let globalResizeMouseUpHandler = null;
let windowMessageHandler = null;

// Additional event handlers for cleanup
let dropdownClickHandler = null;
let documentClickHandler = null;
let optionMouseEnterHandler = null;
let optionMouseLeaveHandler = null;
let optionClickHandler = null;
let beforeUnloadHandler = null;
let storageEventHandler = null;

// =======================
// 2.9. Panel Management Class
// =======================
class PanelManager {
  constructor() {
    this.cachedElements = new Map();
    this.layoutModes = LAYOUT_MODES;
    this.layoutDimensions = LAYOUT_DIMENSIONS;
    this.currentMode = LAYOUT_MODES.VERTICAL;
  }

  cacheElement(id, element) {
    this.cachedElements.set(id, element);
  }

  getCachedElement(id) {
    return this.cachedElements.get(id);
  }

  createPanel() {
    return this.createAutoplayAnalyzerPanel();
  }

  updateLayout(panel, mode) {
    this.currentMode = mode;
    this.updatePanelLayout(panel);
  }

  getLayoutConstraints(mode) {
    return this.layoutDimensions[mode];
  }

  // Delegate to existing functions for now
  createAutoplayAnalyzerPanel() {
    return createAutoplayAnalyzerPanel();
  }

  updatePanelLayout(panel) {
    return updatePanelLayout(panel);
  }
}

// Initialize panel manager
const panelManager = new PanelManager();

// Helper function to get player's max stamina from DOM
function getPlayerMaxStamina() {
    try {
        const elStamina = document.querySelector('[title="Stamina"]');
        if (!elStamina) {
            console.log('[Hunt Analyzer] Stamina element not found');
            return 360; // Fallback to max
        }
        
        const staminaSpans = elStamina.querySelectorAll('span span');
        if (staminaSpans.length < 2) {
            console.log('[Hunt Analyzer] Stamina spans not found');
            return 360; // Fallback to max
        }
        
        const maxStaminaText = staminaSpans[1].textContent.trim();
        const maxStamina = parseInt(maxStaminaText.replace('/', ''));
        
        if (isNaN(maxStamina)) {
            console.log('[Hunt Analyzer] Invalid max stamina value');
            return 360; // Fallback to max
        }
        
        // Cap at 360 as specified
        const cappedStamina = Math.min(maxStamina, 360);
        console.log(`[Hunt Analyzer] Player max stamina: ${maxStamina} (capped at ${cappedStamina})`);
        return cappedStamina;
    } catch (error) {
        console.error('[Hunt Analyzer] Error getting max stamina:', error);
        return 360; // Fallback to max
    }
}

// Initialize max stamina for tier 5 potions
CONFIG.STAMINA_RECOVERY[5] = getPlayerMaxStamina();

// Debug log to verify max stamina initialization
console.log('[Hunt Analyzer] Initialized max stamina for tier 5 potions:', CONFIG.STAMINA_RECOVERY[5]);

// Initialize persistence system
// Inject styles after state is defined (needed for theme system)
injectHuntAnalyzerStyles();
loadHuntAnalyzerSettings();
loadHuntAnalyzerData();
loadHuntAnalyzerState();

// Ensure map filter is set to "ALL" on initialization
HuntAnalyzerState.ui.selectedMapFilter = "ALL";
console.log('[Hunt Analyzer] Map filter initialized to:', HuntAnalyzerState.ui.selectedMapFilter);

// Do not resume manual timing after reload; require a fresh newGame or autoplay
HuntAnalyzerState.timeTracking.manualActive = false;
HuntAnalyzerState.timeTracking.manualSessionStartMs = 0;

// Initialize internal clock system
// Do not start internal clock on init; it will start on first newGame/manual or autoplay detection

// Auto-reopen panel if needed
autoReopenHuntAnalyzer();

// =======================
// 2.10. Data Persistence System
// =======================

// Function to create inventory-style creature portrait like the game does
function createInventoryStyleCreaturePortrait(creatureData) {
    const containerSlot = createContainerSlot('34px');
    
    // Rarity border
    const rarityDiv = createRarityBorder(creatureData.tierLevel || 1);
    
    // Creature image
    const img = document.createElement('img');
    img.src = `/assets/portraits/${creatureData.gameId}.png`;
    img.alt = creatureData.originalName;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.maxWidth = '34px';
    img.style.maxHeight = '34px';
    img.style.objectFit = 'contain';
    
    // Level count
    const levelSpan = document.createElement('span');
    levelSpan.className = 'pixel-font-16 absolute bottom-0 left-2px z-3 text-whiteExp';
    levelSpan.style.position = 'absolute';
    levelSpan.style.bottom = '0px';
    levelSpan.style.left = '2px';
    levelSpan.style.color = 'white';
    levelSpan.style.fontSize = '14px';
    levelSpan.style.background = 'rgba(0, 0, 0, 0.7)';
    levelSpan.style.padding = '0px 2px';
    levelSpan.textContent = creatureData.count || 1;
    
    containerSlot.appendChild(rarityDiv);
    containerSlot.appendChild(img);
    containerSlot.appendChild(levelSpan);
    
    // Add shiny indicator if creature is shiny
    if (creatureData.isShiny) {
        const shinyIcon = document.createElement('img');
        shinyIcon.src = 'https://bestiaryarena.com/assets/icons/shiny-star.png';
        shinyIcon.alt = 'Shiny';
        shinyIcon.title = 'Shiny';
        shinyIcon.style.position = 'absolute';
        shinyIcon.style.bottom = '0px';
        shinyIcon.style.right = '0px';
        shinyIcon.style.width = '9px';
        shinyIcon.style.height = '10px';
        shinyIcon.style.imageRendering = 'pixelated';
        shinyIcon.style.zIndex = '10';
        containerSlot.appendChild(shinyIcon);
    }
    
    return containerSlot;
}

// Function to create inventory-style item portrait like the game does
function createInventoryStyleItemPortrait(itemData) {
    // For sprite items, use the proper sprite system like Cyclopedia
    if (itemData.spriteId && (typeof itemData.spriteId === 'number' || /^\d+$/.test(itemData.spriteId))) {
        try {
            // Use the sprite system with proper DOM structure
            const spriteDiv = createItemSprite(itemData.spriteId, itemData.originalName, itemData.rarity || 1, itemData.stat);
            
            // Add count overlay to sprite container (bottom left like creatures)
            const countSpan = createCountOverlay(itemData.count);
            
            // Make sure the sprite container has relative positioning for the count overlay
            spriteDiv.style.position = 'relative';
            spriteDiv.appendChild(countSpan);
            return spriteDiv;
        } catch (error) {
            console.warn('[Hunt Analyzer] Error creating sprite, falling back to image:', error);
        }
    }
    
    // Fallback to image-based approach for non-sprite items
    const containerSlot = createContainerSlot('36px');
    
    // Rarity border
    const rarityDiv = createRarityBorder(itemData.rarity || 1);
    
    // Item image
    const img = document.createElement('img');
    if (itemData.src) {
        img.src = itemData.src;
    } else if (itemData.spriteSrc) {
        img.src = itemData.spriteSrc;
    } else {
        // Try API component as fallback
        try {
            const apiElement = api.ui.components.createItemPortrait({
                itemId: itemData.spriteId,
                tier: itemData.rarity || 1
            });
            const apiImg = apiElement.querySelector('img');
            if (apiImg && apiImg.src && apiImg.src.trim() !== '') {
                img.src = apiImg.src;
            } else {
                img.src = '/assets/icons/unknown.png';
            }
        } catch (error) {
            console.warn('[Hunt Analyzer] Error creating API portrait:', error);
            img.src = '/assets/icons/unknown.png';
        }
    }
    
    img.alt = itemData.originalName;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.maxWidth = '36px';
    img.style.maxHeight = '36px';
    img.style.objectFit = 'contain';
    img.style.imageRendering = 'pixelated';
    img.style.borderRadius = '3px';
    
    // Count overlay (bottom left like creatures)
    const countSpan = createCountOverlay(itemData.count);
    
    containerSlot.appendChild(rarityDiv);
    containerSlot.appendChild(img);
    containerSlot.appendChild(countSpan);
    
    return containerSlot;
}

// Function to regenerate all visual elements when game API is available
function regenerateAllVisuals() {
    if (!globalThis.state?.utils) {
        console.log('[Hunt Analyzer] Game API not available yet, skipping visual regeneration');
        return;
    }
    
    // Consolidated visual regeneration log
    console.log('[Hunt Analyzer] Regenerating visual elements:', {
        gameAPI: !!globalThis.state?.utils,
        getEquipment: !!globalThis.state?.utils?.getEquipment,
        getMonster: !!globalThis.state?.utils?.getMonster
    });
    
    let regeneratedCount = 0;
    
    // Regenerate loot visuals using API components
    HuntAnalyzerState.data.aggregatedLoot.forEach((value, key) => {
        // Ensure equipment items have gameId set from spriteId
        if (value.isEquipment && !value.gameId && value.spriteId) {
            value.gameId = value.spriteId;
        }
        
        // Always regenerate equipment items to use API components, even if they already have visuals
        const shouldRegenerate = !(value.visual instanceof HTMLElement) || 
                                (value.isEquipment && typeof globalThis.state?.utils?.getEquipment === 'function' && value.gameId);
        
        if (shouldRegenerate) {
            // Only log equipment items for debugging
            if (value.isEquipment) {
                // Equipment processing consolidated - see summary log at end
            }
            
            let visualElement;
            
            // Handle equipment items specially using API components
            if (value.isEquipment && typeof globalThis.state?.utils?.getEquipment === 'function' && value.gameId) {
                try {
                    const equipData = globalThis.state.utils.getEquipment(value.gameId);
                    if (equipData && equipData.metadata && typeof equipData.metadata.spriteId === 'number') {
                        const equipmentSpriteId = equipData.metadata.spriteId;
                        
                        // Extract stat information from equipment data
                        let equipmentStat = null;
                        if (equipData.metadata && equipData.metadata.stat) {
                            equipmentStat = equipData.metadata.stat;
                        } else if (equipData.stats && equipData.stats.length > 0) {
                            // Get the primary stat (first stat in the array)
                            equipmentStat = equipData.stats[0].type;
                        }
                        
                        // Update the stat information in the stored data
                        if (equipmentStat && !value.stat) {
                            value.stat = equipmentStat;
                        }
                        
                        // Use API component for equipment like Cyclopedia does
                        if (api && api.ui && api.ui.components && api.ui.components.createItemPortrait) {
                            try {
                                const equipmentPortrait = api.ui.components.createItemPortrait({
                                    itemId: equipmentSpriteId,
                                    tier: value.rarity || 1
                                });
                                
                                // Check if we got a valid DOM element
                                if (equipmentPortrait && equipmentPortrait.nodeType) {
                                    // If it's a button, get the first child (the actual portrait)
                                    if (equipmentPortrait.tagName === 'BUTTON' && equipmentPortrait.firstChild) {
                                        const firstChild = equipmentPortrait.firstChild;
                                        if (firstChild && firstChild.nodeType) {
                                            // Add count overlay to the portrait (bottom left like creatures)
                                            const countSpan = createCountOverlay(value.count);
                                            
                                            firstChild.appendChild(countSpan);
                                            
                                            // Add stat icon to the portrait
                                            addStatIconToPortrait(firstChild, equipmentStat);
                                            
                                            visualElement = firstChild;
                                        }
                                    } else {
                                        // Use the portrait directly if it's not a button
                                        addStatIconToPortrait(equipmentPortrait, equipmentStat);
                                        visualElement = equipmentPortrait;
                                    }
                                }
                            } catch (apiError) {
                                console.warn('[Hunt Analyzer] Error creating API equipment portrait, falling back to sprite:', apiError);
                            }
                        }
                        
                        // Fallback to sprite system if API component failed
                        if (!visualElement) {
                            console.log('[Hunt Analyzer] API component failed, falling back to sprite system for:', value.originalName);
                            const spriteDiv = createItemSprite(equipmentSpriteId, value.originalName, value.rarity || 1);
                            
                            // Add count overlay to sprite (bottom left like creatures)
                            const countSpan = createCountOverlay(value.count);
                            
                            // Make sure the sprite container has relative positioning for the count overlay
                            spriteDiv.style.position = 'relative';
                            spriteDiv.appendChild(countSpan);
                            visualElement = spriteDiv;
                            console.log('[Hunt Analyzer] Fallback sprite created:', visualElement);
                        }
                    }
                } catch (e) { 
                    console.error("[Hunt Analyzer] Error getting equipment data:", e); 
                }
            }
            
            // For non-equipment items, use the standard approach
            if (!visualElement) {
                // Pass the correct data structure to createInventoryStyleItemPortrait
                const itemData = {
                    spriteId: value.spriteId,
                    src: value.src,
                    spriteSrc: value.src,
                    originalName: value.originalName,
                    rarity: value.rarity,
                    count: value.count
                };
                visualElement = createInventoryStyleItemPortrait(itemData);
            }
            
            value.visual = visualElement;
            regeneratedCount++;
            // Only log equipment visuals for debugging
            if (value.isEquipment) {
                // Equipment visual generation consolidated - see summary log at end
            }
        }
    });
    
    // Regenerate creature visuals using API components
    HuntAnalyzerState.data.aggregatedCreatures.forEach((value, key) => {
        if (!(value.visual instanceof HTMLElement)) {
            let visualElement;
            if (value.gameId) {
                // Create inventory-style creature portrait like the game does
                visualElement = createInventoryStyleCreaturePortrait(value);
            } else {
                // Fallback emoji
                const span = document.createElement('span');
                span.textContent = '👾';
                span.style.fontSize = '24px';
                span.style.width = '36px';
                span.style.height = '36px';
                span.style.display = 'flex';
                span.style.justifyContent = 'center';
                span.style.alignItems = 'center';
                visualElement = span;
            }
            
            value.visual = visualElement;
            regeneratedCount++;
        }
    });
    
    // Consolidated visual regeneration summary
    if (regeneratedCount > 0) {
        console.log(`[Hunt Analyzer] Visual regeneration completed: ${regeneratedCount} elements processed`);
    }
    
    // Re-render the display with updated visuals
    renderAllSessions();
}

// Consolidated persistence logging
function logPersistenceOperation(operation, success = true) {
    if (success) {
        console.log(`[Hunt Analyzer] Persistence: ${operation} completed`);
    } else {
        console.error(`[Hunt Analyzer] Persistence: ${operation} failed`);
    }
}

// Clean session data by removing visual elements and unnecessary fields
function cleanSessionData(sessions) {
    return sessions.map(session => {
        const cleanSession = {
            message: session.message,
            roomId: session.roomId,
            roomName: session.roomName,
            timestamp: session.timestamp,
            staminaSpent: session.staminaSpent,
            staminaRecovered: session.staminaRecovered,
            victory: session.victory,
            loot: (session.loot || []).map(item => {
                const cleanItem = { ...item };
                delete cleanItem.visual; // Remove visual - will be regenerated on load
                return cleanItem;
            }),
            creatures: (session.creatures || []).map(creature => {
                const cleanCreature = { ...creature };
                delete cleanCreature.visual; // Remove visual - will be regenerated on load
                return cleanCreature;
            })
        };
        return cleanSession;
    });
}

// Prune old sessions, keeping only the most recent N sessions
function pruneOldSessions() {
    if (HuntAnalyzerState.data.sessions.length <= MAX_SESSIONS_TO_KEEP) {
        return 0; // No pruning needed
    }
    
    const originalCount = HuntAnalyzerState.data.sessions.length;
    // Sort by timestamp (newest first) and keep only the most recent ones
    HuntAnalyzerState.data.sessions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    HuntAnalyzerState.data.sessions = HuntAnalyzerState.data.sessions.slice(0, MAX_SESSIONS_TO_KEEP);
    const prunedCount = originalCount - HuntAnalyzerState.data.sessions.length;
    
    console.log(`[Hunt Analyzer] Pruned ${prunedCount} old sessions (kept ${HuntAnalyzerState.data.sessions.length} most recent)`);
    return prunedCount;
}

// Save Hunt Analyzer data to localStorage
function saveHuntAnalyzerData() {
    try {
        // Snapshot any live time (manual or autoplay) before persisting
        snapshotIntoTotals();

        // Prune old sessions if we exceed the limit
        pruneOldSessions();

        // Clean aggregated data by removing visual elements (they can be regenerated)
        const cleanAggregatedLoot = new Map();
        HuntAnalyzerState.data.aggregatedLoot.forEach((value, key) => {
            const cleanValue = { ...value };
            delete cleanValue.visual; // Remove visual element - will be regenerated on load
            cleanAggregatedLoot.set(key, cleanValue);
        });
        
        const cleanAggregatedCreatures = new Map();
        HuntAnalyzerState.data.aggregatedCreatures.forEach((value, key) => {
            const cleanValue = { ...value };
            delete cleanValue.visual; // Remove visual element - will be regenerated on load
            cleanAggregatedCreatures.set(key, cleanValue);
        });
        
        // Clean session data by removing visual elements
        const cleanSessions = cleanSessionData(HuntAnalyzerState.data.sessions);
        
        // Snapshot current manual session time into saved totals (without continuing after reload)
        // Convert Map to array for timeTracking persistence (already includes snapshot)
        const mapTimeSnapshot = new Map(HuntAnalyzerState.timeTracking.mapTimeMs);
        const mapTimeMsArray = Array.from(mapTimeSnapshot.entries());
        
        const dataToSave = {
            sessions: cleanSessions,
            totals: HuntAnalyzerState.totals,
            aggregatedLoot: Array.from(cleanAggregatedLoot.entries()),
            aggregatedCreatures: Array.from(cleanAggregatedCreatures.entries()),
            session: HuntAnalyzerState.session,
            timeTracking: {
                currentMap: HuntAnalyzerState.timeTracking.currentMap,
                mapStartTime: HuntAnalyzerState.timeTracking.mapStartTime,
                accumulatedTimeMs: HuntAnalyzerState.timeTracking.accumulatedTimeMs,
                mapTimeMs: mapTimeMsArray,
                lastAutoplayTime: HuntAnalyzerState.timeTracking.lastAutoplayTime,
                // Do not resume ticking on reload; snapshot only
                manualActive: false,
                manualSessionStartMs: 0,
                autoplayBaselineMinutes: HuntAnalyzerState.timeTracking.autoplayBaselineMinutes
            }
        };
        
        try {
            localStorage.setItem(HUNT_ANALYZER_STORAGE_KEY, JSON.stringify(dataToSave));
            logPersistenceOperation('Data save');
        } catch (quotaError) {
            // If quota exceeded, try aggressive pruning and retry
            if (quotaError.name === 'QuotaExceededError' || quotaError.message?.includes('quota')) {
                console.warn('[Hunt Analyzer] Quota exceeded, attempting aggressive cleanup...');
                
                // Reduce max sessions by half and prune again
                const originalMax = MAX_SESSIONS_TO_KEEP;
                const aggressiveMax = Math.floor(MAX_SESSIONS_TO_KEEP / 2);
                
                // Temporarily reduce sessions to half
                HuntAnalyzerState.data.sessions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                HuntAnalyzerState.data.sessions = HuntAnalyzerState.data.sessions.slice(0, aggressiveMax);
                
                // Re-clean and try again
                const retryCleanSessions = cleanSessionData(HuntAnalyzerState.data.sessions);
                dataToSave.sessions = retryCleanSessions;
                
                try {
                    localStorage.setItem(HUNT_ANALYZER_STORAGE_KEY, JSON.stringify(dataToSave));
                    console.log(`[Hunt Analyzer] Successfully saved after aggressive pruning (kept ${aggressiveMax} sessions)`);
                    logPersistenceOperation('Data save');
                } catch (retryError) {
                    console.error('[Hunt Analyzer] Still failed after aggressive cleanup:', retryError);
                    // Last resort: clear all sessions and save totals only
                    console.warn('[Hunt Analyzer] Last resort: clearing all session data to save totals');
                    const minimalData = {
                        sessions: [],
                        totals: HuntAnalyzerState.totals,
                        aggregatedLoot: [],
                        aggregatedCreatures: [],
                        session: HuntAnalyzerState.session,
                        timeTracking: dataToSave.timeTracking
                    };
                    try {
                        localStorage.setItem(HUNT_ANALYZER_STORAGE_KEY, JSON.stringify(minimalData));
                        console.warn('[Hunt Analyzer] Saved minimal data (sessions cleared due to storage quota)');
                        logPersistenceOperation('Data save (minimal)');
                    } catch (finalError) {
                        console.error('[Hunt Analyzer] Complete save failure:', finalError);
                        logPersistenceOperation('Data save', false);
                        throw finalError;
                    }
                }
            } else {
                throw quotaError;
            }
        }
    } catch (error) {
        console.error('[Hunt Analyzer] Error saving data:', error);
        logPersistenceOperation('Data save', false);
    }
}

// Load Hunt Analyzer data from localStorage
function loadHuntAnalyzerData() {
    try {
        // Check if persistence is enabled before loading
        if (!HuntAnalyzerState.settings.persistData) {
            // Clear localStorage if persistence is disabled
            localStorage.removeItem(HUNT_ANALYZER_STORAGE_KEY);
            return false;
        }
        
        const savedData = localStorage.getItem(HUNT_ANALYZER_STORAGE_KEY);
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            
            // Restore sessions
            if (parsedData.sessions) {
                HuntAnalyzerState.data.sessions = parsedData.sessions;
                // Prune old sessions if loaded data exceeds limit
                if (HuntAnalyzerState.data.sessions.length > MAX_SESSIONS_TO_KEEP) {
                    console.log(`[Hunt Analyzer] Loaded ${HuntAnalyzerState.data.sessions.length} sessions, pruning to ${MAX_SESSIONS_TO_KEEP} most recent`);
                    pruneOldSessions();
                }
            }
            
            // Restore totals
            if (parsedData.totals) {
                Object.assign(HuntAnalyzerState.totals, parsedData.totals);
            }
            
            // Restore aggregated data (convert arrays back to Maps, visuals will be regenerated later)
            if (parsedData.aggregatedLoot) {
                HuntAnalyzerState.data.aggregatedLoot = new Map(parsedData.aggregatedLoot);
            }
            if (parsedData.aggregatedCreatures) {
                HuntAnalyzerState.data.aggregatedCreatures = new Map(parsedData.aggregatedCreatures);
            }
            
            // Restore session state
            if (parsedData.session) {
                Object.assign(HuntAnalyzerState.session, parsedData.session);
            }
            
            // Restore timeTracking data
            if (parsedData.timeTracking) {
                HuntAnalyzerState.timeTracking.currentMap = parsedData.timeTracking.currentMap || null;
                HuntAnalyzerState.timeTracking.mapStartTime = parsedData.timeTracking.mapStartTime || 0;
                HuntAnalyzerState.timeTracking.accumulatedTimeMs = parsedData.timeTracking.accumulatedTimeMs || 0;
                HuntAnalyzerState.timeTracking.lastAutoplayTime = parsedData.timeTracking.lastAutoplayTime || 0;
                HuntAnalyzerState.timeTracking.manualActive = parsedData.timeTracking.manualActive || false;
                HuntAnalyzerState.timeTracking.manualSessionStartMs = parsedData.timeTracking.manualSessionStartMs || 0;
                HuntAnalyzerState.timeTracking.autoplayBaselineMinutes = parsedData.timeTracking.autoplayBaselineMinutes || 0;
                
                // Convert array back to Map for mapTimeMs
                if (parsedData.timeTracking.mapTimeMs && Array.isArray(parsedData.timeTracking.mapTimeMs)) {
                    HuntAnalyzerState.timeTracking.mapTimeMs = new Map(parsedData.timeTracking.mapTimeMs);
                }
            }
            
            return true;
        }
    } catch (error) {
        console.error('[Hunt Analyzer] Error loading data:', error);
        logPersistenceOperation('Data load', false);
    }
    return false;
}

// Save Hunt Analyzer UI state
function saveHuntAnalyzerState() {
    const stateToSave = {
        isOpen: HuntAnalyzerState.ui.isOpen,
        isMinimized: HuntAnalyzerState.ui.isMinimized,
        displayMode: HuntAnalyzerState.ui.displayMode,
        selectedMapFilter: HuntAnalyzerState.ui.selectedMapFilter,
        closedManually: false
    };
    
    return saveToStorage(HUNT_ANALYZER_STATE_KEY, stateToSave);
}

// Load Hunt Analyzer UI state
function loadHuntAnalyzerState() {
    const parsedState = loadFromStorage(HUNT_ANALYZER_STATE_KEY);
    if (parsedState) {
        HuntAnalyzerState.ui.isOpen = parsedState.isOpen || false;
        HuntAnalyzerState.ui.isMinimized = parsedState.isMinimized || false;
        HuntAnalyzerState.ui.displayMode = parsedState.displayMode || 'vertical';
        HuntAnalyzerState.ui.selectedMapFilter = parsedState.selectedMapFilter || "ALL";
        return parsedState;
    }
    return null;
}

// Save Hunt Analyzer settings
function saveHuntAnalyzerSettings() {
    return saveToStorage(HUNT_ANALYZER_SETTINGS_KEY, HuntAnalyzerState.settings);
}

// Load Hunt Analyzer settings
function loadHuntAnalyzerSettings() {
    const parsedSettings = loadFromStorage(HUNT_ANALYZER_SETTINGS_KEY);
    if (parsedSettings) {
        Object.assign(HuntAnalyzerState.settings, parsedSettings);
        // Apply theme after loading settings
        applyTheme(HuntAnalyzerState.settings.theme || 'original', false);
        return true;
    }
    return false;
}

// Apply theme and update UI
function applyTheme(themeName, updateExistingPanel = true) {
    if (!HUNT_ANALYZER_THEMES[themeName]) {
        console.warn(`[Hunt Analyzer] Unknown theme: ${themeName}, using 'original'`);
        themeName = 'original';
    }
    
    HuntAnalyzerState.settings.theme = themeName;
    
    // Re-inject styles with new theme
    injectHuntAnalyzerStyles();
    
    // Update existing panel if open and requested
    if (updateExistingPanel) {
        const panel = document.getElementById(PANEL_ID);
        if (panel) {
            // Panel will use CSS variables, so most updates are automatic
            // But we need to update inline styles for elements that were created with hardcoded colors
            updatePanelThemeColors(panel);
        }
    }
    
    console.log(`[Hunt Analyzer] Theme applied: ${themeName}`);
}

// Update theme colors for existing panel elements
function updatePanelThemeColors(panel) {
    if (!panel) return;
    
    // Update resource displays
    const goldAmountSpan = document.getElementById('mod-total-gold-display');
    if (goldAmountSpan) goldAmountSpan.style.color = getThemeColor('textGold');
    
    const dustAmountSpan = document.getElementById('mod-total-dust-display');
    if (dustAmountSpan) dustAmountSpan.style.color = getThemeColor('textDust');
    
    const shinyAmountSpan = document.getElementById('mod-total-shiny-display');
    if (shinyAmountSpan) shinyAmountSpan.style.color = getThemeColor('textShiny');
    
    const runesAmountSpan = document.getElementById('mod-total-runes-display');
    if (runesAmountSpan) runesAmountSpan.style.color = getThemeColor('textRunes');
    
    // Update info text elements
    const infoElements = [
        'mod-autoplay-counter',
        'mod-playtime-display',
        'mod-stamina-display',
        'mod-win-loss-display'
    ];
    infoElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.color = getThemeColor('textInfo');
    });
    
    // Update stats text
    const statsElements = panel.querySelectorAll('.ha-stats-text');
    statsElements.forEach(el => {
        el.style.color = getThemeColor('textStats');
    });
    
    // Update dropdown
    const dropdownButton = document.getElementById('mod-map-filter-dropdown-button');
    if (dropdownButton) {
        dropdownButton.style.border = `1px solid ${getThemeColor('border')}`;
        dropdownButton.style.backgroundColor = getThemeColor('dropdownBackground');
        dropdownButton.style.color = getThemeColor('text');
    }
    
    const dropdownMenu = document.getElementById('mod-map-filter-dropdown-menu');
    if (dropdownMenu) {
        dropdownMenu.style.backgroundColor = getThemeColor('dropdownMenuBackground');
        dropdownMenu.style.border = `1px solid ${getThemeColor('border')}`;
        dropdownMenu.style.boxShadow = `0 4px 8px ${getThemeColor('dropdownShadow')}`;
    }
    
    // Update live display section background
    const liveDisplaySection = panel.querySelector('.live-display-section');
    if (liveDisplaySection) {
        liveDisplaySection.style.backgroundImage = getThemeBackground('section');
        liveDisplaySection.style.backgroundColor = getThemeColor('sectionBackgroundFallback');
    }
    
    // Update loot container
    const lootContainer = panel.querySelector('.loot-container');
    if (lootContainer) {
        lootContainer.style.backgroundImage = getThemeBackground('section');
        lootContainer.style.backgroundColor = getThemeColor('sectionBackgroundFallback');
    }
    
    // Update loot display div
    const lootDisplayDiv = document.getElementById('mod-loot-display');
    if (lootDisplayDiv) {
        lootDisplayDiv.style.border = `1px solid ${getThemeColor('border')}`;
        lootDisplayDiv.style.backgroundColor = getThemeColor('sectionBackground');
        lootDisplayDiv.style.color = getThemeColor('text');
    }
    
    // Update loot title
    const lootTitle = document.getElementById('mod-loot-title');
    if (lootTitle) {
        lootTitle.style.color = getThemeColor('textAccent');
        lootTitle.style.textShadow = `${getThemeColor('textShadow')} 0px 0px 5px`;
    }
    
    // Update creature drop container
    const creatureDropContainer = panel.querySelector('.creature-drop-container');
    if (creatureDropContainer) {
        creatureDropContainer.style.backgroundImage = getThemeBackground('section');
        creatureDropContainer.style.backgroundColor = getThemeColor('sectionBackgroundFallback');
    }
    
    // Update creature drop display div
    const creatureDropDisplayDiv = document.getElementById('mod-creature-drop-display');
    if (creatureDropDisplayDiv) {
        creatureDropDisplayDiv.style.border = `1px solid ${getThemeColor('border')}`;
        creatureDropDisplayDiv.style.backgroundColor = getThemeColor('sectionBackground');
        creatureDropDisplayDiv.style.color = getThemeColor('text');
    }
    
    // Update creature drop title
    const creatureDropTitle = document.getElementById('mod-creature-drops-title');
    if (creatureDropTitle) {
        creatureDropTitle.style.color = getThemeColor('textAccent');
        creatureDropTitle.style.textShadow = `${getThemeColor('textShadow')} 0px 0px 5px`;
    }
    
    // Update map filter container
    const mapFilterContainer = panel.querySelector('.map-filter-container');
    if (mapFilterContainer) {
        mapFilterContainer.style.backgroundImage = getThemeBackground('section');
        mapFilterContainer.style.backgroundColor = getThemeColor('sectionBackgroundFallback');
    }
    
    // Update map filter title (if it exists as a separate element)
    const mapFilterTitle = panel.querySelector('.map-filter-container h3');
    if (mapFilterTitle && !mapFilterTitle.id) {
        mapFilterTitle.style.color = getThemeColor('textAccent');
        mapFilterTitle.style.textShadow = `${getThemeColor('textShadow')} 0px 0px 5px`;
    }
    
    // Update button container
    const buttonContainer = panel.querySelector('.button-container');
    if (buttonContainer) {
        buttonContainer.style.backgroundImage = getThemeBackground('section');
        buttonContainer.style.backgroundColor = getThemeColor('sectionBackgroundFallback');
    }
}

// Check if panel should be reopened after page refresh
function shouldReopenHuntAnalyzer() {
    if (!HuntAnalyzerState.settings.persistData) {
        console.log('[Hunt Analyzer] Persistence disabled, not auto-reopening');
        return false;
    }
    
    const savedState = loadHuntAnalyzerState();
    console.log('[Hunt Analyzer] Checking auto-reopen conditions:', {
        savedState,
        persistData: HuntAnalyzerState.settings.persistData,
        hasData: HuntAnalyzerState.data.sessions.length > 0
    });
    
    // Auto-reopen if:
    // 1. Persistence is enabled AND
    // 2. We have saved data AND
    // 3. Panel wasn't manually closed (or no saved state exists)
    if (savedState) {
        return savedState.isOpen && !savedState.closedManually;
    } else {
        // If no saved state but we have data and persistence is enabled, reopen
        return HuntAnalyzerState.data.sessions.length > 0;
    }
}

// Auto-reopen Hunt Analyzer after page refresh
function autoReopenHuntAnalyzer() {
    if (shouldReopenHuntAnalyzer()) {
        console.log('[Hunt Analyzer] Auto-reopening panel after page refresh');
        setTimeout(() => {
            createAutoplayAnalyzerPanel();
        }, 2000); // Wait 2 seconds for page to fully load
    } else {
        console.log('[Hunt Analyzer] Not auto-reopening panel:', {
            persistData: HuntAnalyzerState.settings.persistData,
            hasData: HuntAnalyzerState.data.sessions.length > 0,
            savedState: loadHuntAnalyzerState()
        });
    }
}

// =======================
// 3. Utility Modules
// =======================
const ItemUtils = {
  getRarity(itemName, tooltipKey, item) {
    return getItemInfoFromDatabase(itemName, tooltipKey, item).rarity;
  },
  
  getDisplayName(itemName, tooltipKey, item) {
    return getItemInfoFromDatabase(itemName, tooltipKey, item).displayName;
  },
  
  createVisual(itemData) {
    return getItemVisual(itemData);
  },
  
  isRune(itemName, item) {
    return isRuneItem(itemName, item);
  },
  
  getStaminaRecovery(itemName, item) {
    return getStaminaRecoveryAmount(itemName, item);
  }
};

const CreatureUtils = {
  getDetails(monsterDrop) {
    return getCreatureDetails(monsterDrop);
  },
  
  getTierDetails(genes) {
    return getCreatureTierDetails(genes);
  },
  
  getNameFromId(gameId) {
    return getMonsterNameFromId(gameId);
  }
};

const EquipmentUtils = {
  getNameFromId(gameId) {
    return getEquipmentNameFromId(gameId);
  }
};

const FormatUtils = {
  formatName(name) {
    return formatNameToTitleCase(name);
  },
  
  formatTime(ms) {
    return formatTime(ms);
  },
  
  getRarityColor(tierLevel) {
    return getRarityBorderColor(tierLevel);
  }
};

const UIElements = {
  createStyledButton(text) {
    return createStyledButton(text);
  },
  
  createStyledIconButton(iconText) {
    return createStyledIconButton(iconText);
  },
  
  createItemSprite(itemId, tooltipKey, rarity = 1) {
    return createItemSprite(itemId, tooltipKey, rarity);
  }
};

// =======================
// 3.0. Legacy Utility Functions (for backward compatibility)
// =======================
// Checks if the current game mode is sandbox mode.
// Returns true if in sandbox mode, false otherwise.
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
// Combined function to get both rarity and display name in one lookup
function getItemInfoFromDatabase(itemName, tooltipKey, item) {
    const cacheKey = `${itemName}_${tooltipKey}_${item?.rarityLevel || 0}_${item?.tier || 0}`;
    if (itemInfoCache.has(cacheKey)) {
        return itemInfoCache.get(cacheKey);
    }
    
    // Try to find the item in the inventory database by name or tooltip key
    const inventoryDB = window.inventoryDatabase;
    if (!inventoryDB?.tooltips) {
        const result = { rarity: null, displayName: null };
        itemInfoCache.set(cacheKey, result);
        return result;
    }
    
    // Normalize names for matching
    const normalizedItemName = normalizeName(itemName);
    const normalizedTooltip = normalizeName(tooltipKey);
    
    // Try different variations of the item name
    const searchTerms = [
        normalizedItemName,
        normalizedTooltip,
        itemName?.toLowerCase(),
        tooltipKey?.toLowerCase()
    ].filter(Boolean);
    
    for (const term of searchTerms) {
        // Direct match
        if (inventoryDB.tooltips[term]) {
            const result = {
                rarity: inventoryDB.tooltips[term].rarity,
                displayName: inventoryDB.tooltips[term].displayName
            };
            itemInfoCache.set(cacheKey, result);
            return result;
        }
    }
    
    // Try to match common consumable patterns and determine variant
    if (normalizedItemName?.includes('dicemanipulator') || normalizedItemName?.includes('dice') || 
        normalizedTooltip?.includes('dicemanipulator') || normalizedTooltip?.includes('dice')) {
        const existingRarity = item?.rarityLevel || item?.tier || 0;
        if (existingRarity >= 1 && existingRarity <= 5) {
            const result = {
                rarity: inventoryDB.tooltips[`diceManipulator${existingRarity}`]?.rarity || '1',
                displayName: inventoryDB.tooltips[`diceManipulator${existingRarity}`]?.displayName || null
            };
            itemInfoCache.set(cacheKey, result);
            return result;
        }
        const result = {
            rarity: inventoryDB.tooltips['diceManipulator1']?.rarity || '1',
            displayName: inventoryDB.tooltips['diceManipulator1']?.displayName || null
        };
        itemInfoCache.set(cacheKey, result);
        return result;
    }
    
    if (normalizedItemName?.includes('stamina') || normalizedTooltip?.includes('stamina')) {
        const existingRarity = item?.rarityLevel || item?.tier || 0;
        if (existingRarity >= 1 && existingRarity <= 5) {
            const result = {
                rarity: inventoryDB.tooltips[`stamina${existingRarity}`]?.rarity || '1',
                displayName: inventoryDB.tooltips[`stamina${existingRarity}`]?.displayName || null
            };
            itemInfoCache.set(cacheKey, result);
            return result;
        }
        const result = {
            rarity: inventoryDB.tooltips['stamina1']?.rarity || '1',
            displayName: inventoryDB.tooltips['stamina1']?.displayName || null
        };
        itemInfoCache.set(cacheKey, result);
        return result;
    }
    
    if (normalizedItemName?.includes('summonscroll') || normalizedItemName?.includes('summon') ||
        normalizedTooltip?.includes('summonscroll') || normalizedTooltip?.includes('summon')) {
        const existingRarity = item?.rarityLevel || item?.tier || 0;
        if (existingRarity >= 1 && existingRarity <= 5) {
            const result = {
                rarity: inventoryDB.tooltips[`summonScroll${existingRarity}`]?.rarity || '1',
                displayName: inventoryDB.tooltips[`summonScroll${existingRarity}`]?.displayName || null
            };
            itemInfoCache.set(cacheKey, result);
            return result;
        }
        const result = {
            rarity: inventoryDB.tooltips['summonScroll1']?.rarity || '1',
            displayName: inventoryDB.tooltips['summonScroll1']?.displayName || null
        };
        itemInfoCache.set(cacheKey, result);
        return result;
    }
    
    if (normalizedItemName?.includes('insightstone') || normalizedItemName?.includes('insight') ||
        normalizedTooltip?.includes('insightstone') || normalizedTooltip?.includes('insight')) {
        const existingRarity = item?.rarityLevel || item?.tier || 0;
        if (existingRarity >= 1 && existingRarity <= 5) {
            const result = {
                rarity: inventoryDB.tooltips[`insightStone${existingRarity}`]?.rarity || '1',
                displayName: inventoryDB.tooltips[`insightStone${existingRarity}`]?.displayName || null
            };
            itemInfoCache.set(cacheKey, result);
            return result;
        }
        const result = {
            rarity: inventoryDB.tooltips['insightStone1']?.rarity || '1',
            displayName: inventoryDB.tooltips['insightStone1']?.displayName || null
        };
        itemInfoCache.set(cacheKey, result);
        return result;
    }
    
    // Try to match rune patterns
    if (normalizedItemName?.includes('rune') || normalizedTooltip?.includes('rune')) {
        const runePatterns = [
            { patterns: ['blankrune', 'blank'], key: 'runeBlank' },
            { patterns: ['avaricerune', 'avarice'], key: 'runeAvarice' },
            { patterns: ['recyclerune', 'recycle'], key: 'runeRecycle' },
            { patterns: ['hitpointsrune', 'hitpoints', 'hprune'], key: 'runeHp' },
            { patterns: ['abilitypowerrune', 'abilitypower', 'aprune'], key: 'runeAp' },
            { patterns: ['attackdamagerune', 'attackdamage', 'adrune'], key: 'runeAd' },
            { patterns: ['armorrune', 'armor', 'arrune'], key: 'runeAr' },
            { patterns: ['magicresistrune', 'magicresist', 'mrrune'], key: 'runeMr' }
        ];
        
        for (const runePattern of runePatterns) {
            for (const pattern of runePattern.patterns) {
                if (normalizedItemName?.includes(pattern) || normalizedTooltip?.includes(pattern)) {
                    const result = {
                        rarity: inventoryDB.tooltips[runePattern.key]?.rarity || '1',
                        displayName: inventoryDB.tooltips[runePattern.key]?.displayName || null
                    };
                    itemInfoCache.set(cacheKey, result);
                    return result;
                }
            }
        }
        
        // If no specific rune pattern matches, try to identify by sprite source
        const spriteSrc = item?.spriteSrc;
        if (spriteSrc) {
            let runeKey = null;
            if (spriteSrc.includes('rune-avarice')) runeKey = 'runeAvarice';
            else if (spriteSrc.includes('rune-recycle')) runeKey = 'runeRecycle';
            else if (spriteSrc.includes('rune-hp')) runeKey = 'runeHp';
            else if (spriteSrc.includes('rune-ap')) runeKey = 'runeAp';
            else if (spriteSrc.includes('rune-ad')) runeKey = 'runeAd';
            else if (spriteSrc.includes('rune-ar')) runeKey = 'runeAr';
            else if (spriteSrc.includes('rune-mr')) runeKey = 'runeMr';
            else if (spriteSrc.includes('rune-blank')) runeKey = 'runeBlank';
            
            if (runeKey) {
                const result = {
                    rarity: inventoryDB.tooltips[runeKey]?.rarity || '1',
                    displayName: inventoryDB.tooltips[runeKey]?.displayName || null
                };
                itemInfoCache.set(cacheKey, result);
                return result;
            }
        }
        
        // Final fallback to generic rune lookup
        if (inventoryDB.tooltips['runeBlank']) {
            const result = {
                rarity: inventoryDB.tooltips['runeBlank'].rarity,
                displayName: inventoryDB.tooltips['runeBlank'].displayName
            };
            itemInfoCache.set(cacheKey, result);
            return result;
        }
    }
    
    const result = { rarity: null, displayName: null };
    itemInfoCache.set(cacheKey, result);
    return result;
}

function isRuneItem(itemName, item) {
    // Check if the item is a rune based on name patterns
    const normalizedName = itemName?.toLowerCase().replace(/\s+/g, '');
    
    // Check for rune patterns - more comprehensive matching
    const runePatterns = [
        'rune', 'blankrune', 'avaricerune', 'recyclerune',
        'hitpointsrune', 'abilitypowerrune', 'attackdamagerune',
        'armorrune', 'magicresistrune',
        // Additional patterns for better detection
        'blank', 'avarice', 'recycle', 'hitpoints', 'abilitypower', 
        'attackdamage', 'armor', 'magicresist'
    ];
    
    for (const pattern of runePatterns) {
        if (normalizedName?.includes(pattern)) {
            return true;
        }
    }
    
    // Check tooltip key for rune patterns
    const tooltipKey = item?.tooltipKey?.toLowerCase();
    if (tooltipKey) {
        for (const pattern of runePatterns) {
            if (tooltipKey.includes(pattern)) {
                return true;
            }
        }
    }
    
    // Check sprite source for rune icons
    const spriteSrc = item?.spriteSrc;
    if (spriteSrc && spriteSrc.includes('rune-')) {
        return true;
    }
    
    return false;
}

function getStaminaRecoveryAmount(itemName, item) {
    // Calculate stamina recovery based on item type and count
    const inventoryDB = window.inventoryDatabase;
    if (!inventoryDB?.tooltips) return 0;
    
    // Normalize names for matching
    const normalizedItemName = normalizeName(itemName);
    
    // Check if it's a stamina potion
    if (normalizedItemName?.includes('stamina') || normalizedItemName?.includes('potion')) {
        const existingRarity = item?.rarityLevel || item?.tier || 0;
        const count = item?.amount || 1;
        
        const recoveryPerItem = CONFIG.STAMINA_RECOVERY[existingRarity] || 12;
        return recoveryPerItem * count;
    }
    
    return 0;
}

function getItemDisplayNameFromDatabase(itemName, tooltipKey, item) {
    // Try to find the item in the inventory database by name or tooltip key
    const inventoryDB = window.inventoryDatabase;
    if (!inventoryDB?.tooltips) return null;
    
    // Normalize names for matching
    const normalizedItemName = normalizeName(itemName);
    const normalizedTooltip = normalizeName(tooltipKey);
    
    // Try different variations of the item name
    const searchTerms = [
        normalizedItemName,
        normalizedTooltip,
        itemName?.toLowerCase(),
        tooltipKey?.toLowerCase()
    ].filter(Boolean);
    
    for (const term of searchTerms) {
        // Direct match
        if (inventoryDB.tooltips[term]) {
            return inventoryDB.tooltips[term].displayName;
        }
    }
    
    // Try to match common consumable patterns and determine variant
    if (normalizedItemName?.includes('dicemanipulator') || normalizedItemName?.includes('dice') || 
        normalizedTooltip?.includes('dicemanipulator') || normalizedTooltip?.includes('dice')) {
        // Try to determine which dice manipulator variant based on item properties
        const existingRarity = item?.rarityLevel || item?.tier || 0;
        if (existingRarity >= 1 && existingRarity <= 5) {
            return inventoryDB.tooltips[`diceManipulator${existingRarity}`]?.displayName || null;
        }
        // Default to variant 1 if we can't determine the specific variant
        return inventoryDB.tooltips['diceManipulator1']?.displayName || null;
    }
    
    if (normalizedItemName?.includes('stamina') || normalizedTooltip?.includes('stamina')) {
        // Try to determine which stamina variant based on item properties
        const existingRarity = item?.rarityLevel || item?.tier || 0;
        if (existingRarity >= 1 && existingRarity <= 5) {
            return inventoryDB.tooltips[`stamina${existingRarity}`]?.displayName || null;
        }
        // Default to variant 1 if we can't determine the specific variant
        return inventoryDB.tooltips['stamina1']?.displayName || null;
    }
    
    if (normalizedItemName?.includes('summonscroll') || normalizedItemName?.includes('summon') ||
        normalizedTooltip?.includes('summonscroll') || normalizedTooltip?.includes('summon')) {
        // Try to determine which summon scroll variant based on item properties
        const existingRarity = item?.rarityLevel || item?.tier || 0;
        if (existingRarity >= 1 && existingRarity <= 5) {
            return inventoryDB.tooltips[`summonScroll${existingRarity}`]?.displayName || null;
        }
        // Default to variant 1 if we can't determine the specific variant
        return inventoryDB.tooltips['summonScroll1']?.displayName || null;
    }
    
    if (normalizedItemName?.includes('insightstone') || normalizedItemName?.includes('insight') ||
        normalizedTooltip?.includes('insightstone') || normalizedTooltip?.includes('insight')) {
        // Try to determine which insight stone variant based on item properties
        const existingRarity = item?.rarityLevel || item?.tier || 0;
        if (existingRarity >= 1 && existingRarity <= 5) {
            return inventoryDB.tooltips[`insightStone${existingRarity}`]?.displayName || null;
        }
        // Default to variant 1 if we can't determine the specific variant
        return inventoryDB.tooltips['insightStone1']?.displayName || null;
    }
    
    // Try to match rune patterns
    if (normalizedItemName?.includes('rune') || normalizedTooltip?.includes('rune')) {
        // Try to match specific rune types with more flexible patterns
        const runePatterns = [
            { patterns: ['blankrune', 'blank'], key: 'runeBlank' },
            { patterns: ['avaricerune', 'avarice'], key: 'runeAvarice' },
            { patterns: ['recyclerune', 'recycle'], key: 'runeRecycle' },
            { patterns: ['hitpointsrune', 'hitpoints', 'hprune'], key: 'runeHp' },
            { patterns: ['abilitypowerrune', 'abilitypower', 'aprune'], key: 'runeAp' },
            { patterns: ['attackdamagerune', 'attackdamage', 'adrune'], key: 'runeAd' },
            { patterns: ['armorrune', 'armor', 'arrune'], key: 'runeAr' },
            { patterns: ['magicresistrune', 'magicresist', 'mrrune'], key: 'runeMr' }
        ];
        
        for (const runePattern of runePatterns) {
            for (const pattern of runePattern.patterns) {
                if (normalizedItemName?.includes(pattern) || normalizedTooltip?.includes(pattern)) {
                    return inventoryDB.tooltips[runePattern.key]?.displayName || null;
                }
            }
        }
        
        // If no specific rune pattern matches, try to identify by sprite source
        const spriteSrc = item?.spriteSrc;
        if (spriteSrc) {
            if (spriteSrc.includes('rune-avarice')) return inventoryDB.tooltips['runeAvarice']?.displayName || 'Avarice Rune';
            if (spriteSrc.includes('rune-recycle')) return inventoryDB.tooltips['runeRecycle']?.displayName || 'Recycle Rune';
            if (spriteSrc.includes('rune-hp')) return inventoryDB.tooltips['runeHp']?.displayName || 'Hitpoints Rune';
            if (spriteSrc.includes('rune-ap')) return inventoryDB.tooltips['runeAp']?.displayName || 'Ability Power Rune';
            if (spriteSrc.includes('rune-ad')) return inventoryDB.tooltips['runeAd']?.displayName || 'Attack Damage Rune';
            if (spriteSrc.includes('rune-ar')) return inventoryDB.tooltips['runeAr']?.displayName || 'Armor Rune';
            if (spriteSrc.includes('rune-mr')) return inventoryDB.tooltips['runeMr']?.displayName || 'Magic Resist Rune';
            if (spriteSrc.includes('rune-blank')) return inventoryDB.tooltips['runeBlank']?.displayName || 'Blank Rune';
        }
        
        // Final fallback to generic rune lookup
        if (inventoryDB.tooltips['runeBlank']) {
            return inventoryDB.tooltips['runeBlank'].displayName;
        }
    }
    
    return null;
}

function getRarityBorderColor(tierLevel) {
    // Use database colors if available, fallback to manual mapping
    const rarityColors = window.inventoryDatabase?.rarityColors || {};
    if (rarityColors[tierLevel]) {
        return rarityColors[tierLevel];
    }
    
    // Fallback to original manual mapping
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

// Function to add stat icon to existing equipment portrait
function addStatIconToPortrait(portrait, stat) {
    if (!stat || !portrait) return;
    
    // Check if stat icon already exists
    if (portrait.querySelector('.stat-icon')) return;
    
    const statIcon = document.createElement('img');
    statIcon.className = 'stat-icon';
    statIcon.style.cssText = `
        position: absolute;
        bottom: 1px;
        right: 1px;
        width: 12px;
        height: 12px;
        image-rendering: pixelated;
        z-index: 10;
    `;
    
    const statType = stat.toLowerCase();
    if (statType === 'ad' || statType === 'attackdamage') {
        statIcon.src = '/assets/icons/attackdamage.png';
    } else if (statType === 'ap' || statType === 'abilitypower') {
        statIcon.src = '/assets/icons/abilitypower.png';
    } else if (statType === 'hp' || statType === 'health') {
        statIcon.src = '/assets/icons/heal.png';
    } else if (statType === 'armor') {
        statIcon.src = '/assets/icons/armor.png';
    } else if (statType === 'mr' || statType === 'magicresist') {
        statIcon.src = '/assets/icons/magicresist.png';
    } else {
        statIcon.src = '/assets/icons/attackdamage.png';
    }
    
    portrait.appendChild(statIcon);
}

// Function to add stat icons to all existing equipment portraits in the loot display
function addStatIconsToExistingPortraits() {
    const lootDisplay = document.getElementById('mod-loot-display');
    if (!lootDisplay) return;
    
    const equipmentPortraits = lootDisplay.querySelectorAll('.equipment-portrait');
    equipmentPortraits.forEach(portrait => {
        // Check if stat icon already exists
        if (portrait.querySelector('.stat-icon')) return;
        
        // Try to find the equipment data for this portrait
        const spriteElement = portrait.querySelector('.sprite.item');
        if (spriteElement) {
            const itemId = spriteElement.className.match(/id-(\d+)/);
            if (itemId) {
                const gameId = parseInt(itemId[1]);
                try {
                    const equipData = globalThis.state?.utils?.getEquipment?.(gameId);
                    if (equipData) {
                        let stat = null;
                        if (equipData.metadata && equipData.metadata.stat) {
                            stat = equipData.metadata.stat;
                        } else if (equipData.stats && equipData.stats.length > 0) {
                            stat = equipData.stats[0].type;
                        }
                        
                        if (stat) {
                            addStatIconToPortrait(portrait, stat);
                        }
                    }
                } catch (e) {
                    console.warn('[Hunt Analyzer] Error getting equipment data for stat icon:', e);
                }
            }
        }
    });
}
function createItemSprite(itemId, tooltipKey = '', rarity = 1, stat = null) {
    // Create the main container following Cyclopedia pattern
    const containerSlot = createContainerSlot('36px', 'container-slot surface-darker');
    containerSlot.title = tooltipKey || `ID-${itemId}`;
    
    // Create rarity container
    const rarityContainer = createRarityBorder(rarity, 'has-rarity relative grid h-full place-items-center');
    
    // Create sprite container
    const spriteContainer = document.createElement('div');
    spriteContainer.className = 'relative size-sprite';
    spriteContainer.style.overflow = 'visible';
    
    // Create sprite element
    const spriteElement = document.createElement('div');
    spriteElement.className = `sprite item id-${itemId} absolute bottom-0 right-0`;
    
    // Create viewport
    const viewport = document.createElement('div');
    viewport.className = 'viewport';
    
    // Create image
    const img = document.createElement('img');
    img.alt = tooltipKey || String(itemId);
    img.setAttribute('data-cropped', 'false');
    img.className = 'spritesheet';
    img.style.setProperty('--cropX', '0');
    img.style.setProperty('--cropY', '0');
    
    // Assemble the structure
    viewport.appendChild(img);
    spriteElement.appendChild(viewport);
    spriteContainer.appendChild(spriteElement);
    rarityContainer.appendChild(spriteContainer);
    containerSlot.appendChild(rarityContainer);
    
    // Add stat icon if stat is provided
    if (stat) {
        const statIcon = document.createElement('img');
        statIcon.style.cssText = `
            position: absolute;
            bottom: 1px;
            right: 1px;
            width: 12px;
            height: 12px;
            image-rendering: pixelated;
            z-index: 10;
        `;
        
        const statType = stat.toLowerCase();
        if (statType === 'ad' || statType === 'attackdamage') {
            statIcon.src = '/assets/icons/attackdamage.png';
        } else if (statType === 'ap' || statType === 'abilitypower') {
            statIcon.src = '/assets/icons/abilitypower.png';
        } else if (statType === 'hp' || statType === 'health') {
            statIcon.src = '/assets/icons/heal.png';
        } else if (statType === 'armor') {
            statIcon.src = '/assets/icons/armor.png';
        } else if (statType === 'mr' || statType === 'magicresist') {
            statIcon.src = '/assets/icons/magicresist.png';
        } else {
            statIcon.src = '/assets/icons/attackdamage.png';
        }
        containerSlot.appendChild(statIcon);
    }
    
    return containerSlot;
}
function getEquipmentNameFromId(gameId) {
    if (equipmentCache.has(gameId)) {
        return equipmentCache.get(gameId);
    }
    
    try {
        // Equipment database doesn't have findEquipmentByGameId function yet
        // Fallback to direct API call (original implementation)
        const equipData = globalThis.state.utils.getEquipment(gameId);
        const result = equipData && equipData.metadata ? equipData.metadata.name : null;
        equipmentCache.set(gameId, result);
        return result;
    } catch (e) { 
        equipmentCache.set(gameId, null);
        return null; 
    }
}
function getMonsterNameFromId(gameId) {
    if (monsterCache.has(gameId)) {
        return monsterCache.get(gameId);
    }
    
    try {
        // Try database first for better performance and richer data
        const creatureData = window.creatureDatabase?.findMonsterByGameId(gameId);
        if (creatureData?.metadata?.name) {
            monsterCache.set(gameId, creatureData.metadata.name);
            return creatureData.metadata.name;
        }
        
        // Fallback to direct API call
        const monsterData = globalThis.state.utils.getMonster(gameId);
        const result = monsterData && monsterData.metadata ? monsterData.metadata.name : null;
        monsterCache.set(gameId, result);
        return result;
    } catch (e) { 
        monsterCache.set(gameId, null);
        return null; 
    }
}
function getCreatureTierDetails(genes) {
    const totalStats = genes.hp + genes.ad + genes.ap + genes.armor + genes.magicResist;
    let tierName = "Unknown Tier", tierLevel = 0;
    if (totalStats >= 80) { tierName = "Legendary"; tierLevel = 5; }
    else if (totalStats >= 70) { tierName = "Epic"; tierLevel = 4; }
    else if (totalStats >= 60) { tierName = "Rare"; tierLevel = 3; }
    else if (totalStats >= 50) { tierName = "Uncommon"; tierLevel = 2; }
    else if (totalStats >= 5) { tierName = "Common"; tierLevel = 1; }
    return { totalStats, tierName, tierLevel };
}
function getItemVisual(itemData, preResolvedName = null) {
    let recognizedName = preResolvedName || itemData.tooltipKey || 'Unknown Item';
    if (itemData.isEquipment && typeof globalThis.state?.utils?.getEquipment === 'function' && itemData.gameId) {
        try {
            const equipData = globalThis.state.utils.getEquipment(itemData.gameId);
            if (equipData && equipData.metadata && typeof equipData.metadata.spriteId === 'number') {
                const equipmentSpriteId = equipData.metadata.spriteId;
                recognizedName = equipData.metadata.name || recognizedName;
                
                // Use simple sprite system like the original implementation
                const spriteDiv = createItemSprite(equipmentSpriteId, recognizedName, itemData.rarity || 1);
                
                // Add count overlay to sprite (bottom left like creatures)
                const countSpan = createCountOverlay(itemData.count);
                
                // Make sure the sprite container has relative positioning for the count overlay
                spriteDiv.style.position = 'relative';
                spriteDiv.appendChild(countSpan);
                return { visualElement: spriteDiv, recognizedName: formatNameToTitleCase(recognizedName) };
            }
        } catch (e) { console.error("[Hunt Analyzer] Error getting equipment name:", e); }
    }
    if (itemData.spriteId === CONFIG.GOLD_SPRITE_ID) {
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
        const spriteDiv = createItemSprite(itemData.spriteId, itemData.tooltipKey, itemData.rarity || 1);
        
        // Add count overlay to sprite (bottom left like creatures)
        const countSpan = createCountOverlay(itemData.count);
        
        // Make sure the sprite container has relative positioning for the count overlay
        spriteDiv.style.position = 'relative';
        spriteDiv.appendChild(countSpan);
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
    
    // Check if creature is shiny
    const isShiny = monsterDrop.shiny === true;
    
    // Create container for creature visual with potential shiny overlay
    const visualContainer = document.createElement('div');
    visualContainer.style.position = 'relative';
    visualContainer.style.width = '36px';
    visualContainer.style.height = '36px';
    visualContainer.style.display = 'inline-block';
    
    const creatureVisualImg = document.createElement('img');
    // Use database function for portrait URL, fallback to manual construction
    creatureVisualImg.src = window.creatureDatabase?.getMonsterPortraitUrl(monsterDrop.gameId, isShiny) || 
        `/assets/portraits/${monsterDrop.gameId}${isShiny ? '-shiny' : ''}.png`;
    creatureVisualImg.alt = name;
    creatureVisualImg.style.width = '36px';
    creatureVisualImg.style.height = '36px';
    creatureVisualImg.style.imageRendering = 'pixelated';
    creatureVisualImg.style.borderRadius = '3px';
    
    visualContainer.appendChild(creatureVisualImg);
    
    // Add shiny star overlay if creature is shiny
    if (isShiny) {
        const shinyIcon = document.createElement('img');
        shinyIcon.src = '/assets/icons/shiny-star.png';
        shinyIcon.alt = 'shiny';
        shinyIcon.title = 'Shiny';
        shinyIcon.style.position = 'absolute';
        shinyIcon.style.top = '2px';
        shinyIcon.style.left = '2px';
        shinyIcon.style.width = '8px';
        shinyIcon.style.height = '8px';
        shinyIcon.style.zIndex = '10';
        shinyIcon.style.pointerEvents = 'none';
        visualContainer.appendChild(shinyIcon);
    }
    
    const { totalStats, tierName, tierLevel } = getCreatureTierDetails(monsterDrop.genes);
    return { name, visual: visualContainer, rarity: tierLevel, totalStats, tierName, tierLevel, gameId: monsterDrop.gameId, isShiny };
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
// 2.11. Helper Functions for UI Elements
// =======================

// Helper function to create count overlay spans
function createCountOverlay(count) {
    const countSpan = document.createElement('span');
    countSpan.className = 'pixel-font-16 absolute bottom-0 left-2px z-3 text-whiteExp';
    countSpan.style.position = 'absolute';
    countSpan.style.bottom = '0px';
    countSpan.style.left = '2px';
    countSpan.style.color = 'white';
    countSpan.style.fontSize = '14px';
    countSpan.style.background = 'rgba(0, 0, 0, 0.7)';
    countSpan.style.padding = '0px 2px';
    countSpan.style.borderRadius = '2px';
    countSpan.style.zIndex = '10';
    countSpan.textContent = count || 1;
    return countSpan;
}

// Helper function to create container slots
function createContainerSlot(size = '34px', className = 'container-slot surface-darker relative') {
    const containerSlot = document.createElement('div');
    containerSlot.className = className;
    containerSlot.style.width = size;
    containerSlot.style.height = size;
    containerSlot.style.overflow = 'visible';
    return containerSlot;
}

// Helper function to create rarity borders
function createRarityBorder(rarity, className = 'has-rarity absolute inset-0 z-1 opacity-80') {
    const rarityDiv = document.createElement('div');
    rarityDiv.className = className;
    rarityDiv.setAttribute('data-rarity', String(rarity));
    rarityDiv.setAttribute('role', 'none');
    return rarityDiv;
}

// =======================
// 2.12. Storage Utility Functions
// =======================

// Generic function to save data to localStorage
function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        logPersistenceOperation(`${key} save`);
        return true;
    } catch (error) {
        console.error(`[Hunt Analyzer] Error saving ${key}:`, error);
        logPersistenceOperation(`${key} save`, false);
        return false;
    }
}

// Generic function to load data from localStorage
function loadFromStorage(key) {
    try {
        const savedData = localStorage.getItem(key);
        if (savedData) {
            return JSON.parse(savedData);
        }
    } catch (error) {
        console.error(`[Hunt Analyzer] Error loading ${key}:`, error);
        logPersistenceOperation(`${key} load`, false);
    }
    return null;
}

// =======================
// 3.1. Data Processing Class
// =======================
class DataProcessor {
  constructor() {
    this.state = HuntAnalyzerState;
  }

  processSession(serverResults) {
    if (!serverResults?.rewardScreen) return;

    const { rewardScreen } = serverResults;
    const autoplayMessage = rewardScreen.victory ? "Victory!" : "Defeat!";
    const aggregatedLootForSession = new Map();
    const aggregatedCreaturesForSession = new Map();
    const currentLootItemsLog = [];

    // Get room name for display and session data
    const roomNamesMap = globalThis.state?.utils?.ROOM_NAME;
    const readableRoomName = roomNamesMap?.[rewardScreen.roomId] || `Room ID: ${rewardScreen.roomId}`;

    // Track map change for internal clock system
    trackMapChange(readableRoomName);

    // Update Room ID display in header
    const cachedRoomIdDisplayElement = domCache.get("mod-room-id-display");
    if (cachedRoomIdDisplayElement && rewardScreen.roomId) {
      updateRoomTitleDisplay(rewardScreen.roomId, readableRoomName);
    }

    // Process Gold - add to session loot but will be filtered out in aggregation
    if (rewardScreen.loot?.goldAmount > 0) {
      const goldAmount = rewardScreen.loot.goldAmount;
      const { visualElement: goldVisual, recognizedName: goldName } = getItemVisual({
        spriteId: CONFIG.GOLD_SPRITE_ID,
        tooltipKey: 'Gold',
        amount: goldAmount
      });

      aggregatedLootForSession.set('Gold', {
        count: goldAmount,
        visual: goldVisual,
        originalName: goldName,
        rarity: 0,
        rarityBorderColor: getRarityBorderColor(0),
        spriteId: CONFIG.GOLD_SPRITE_ID,
        src: '/assets/icons/goldpile.png',
        isEquipment: false,
        stat: null
      });
      
      currentLootItemsLog.push(`Gold (x${goldAmount})`);
    }

    // Process all loot items
    const allLootItems = [
      ...(rewardScreen.loot.droppedItems || []),
      ...(rewardScreen.equipDrop ? [rewardScreen.equipDrop] : [])
    ];

    // Immediately track stamina recovery from dropped potions
    for (const item of allLootItems) {
      if (item.spriteId === CONFIG.GOLD_SPRITE_ID || 
          (item.tooltipKey && item.tooltipKey.toLowerCase() === 'gold') ||
          item.spriteId === CONFIG.HEAL_POTION_SPRITE_ID) {
        continue;
      }

      // Check if this is a stamina potion and add recovery immediately
      let itemName = 'Unknown Item';
      if (item.tooltipKey?.toLowerCase().includes('dust') || 
          (item.spriteSrc && item.spriteSrc.includes('dust'))) {
        itemName = 'Dust';
      } else if (item.tooltipKey) {
        itemName = item.tooltipKey;
      } else if (item.name) {
        itemName = item.name;
      }

      const staminaRecovery = getStaminaRecoveryAmount(itemName, item);
      if (staminaRecovery > 0) {
        HuntAnalyzerState.totals.staminaRecovered += staminaRecovery;
        console.log(`[Hunt Analyzer] Stamina potion dropped: ${itemName} (+${staminaRecovery} stamina)`);
      }
    }

    for (const item of allLootItems) {
      if (item.spriteId === CONFIG.GOLD_SPRITE_ID || 
          (item.tooltipKey && item.tooltipKey.toLowerCase() === 'gold') ||
          item.spriteId === CONFIG.HEAL_POTION_SPRITE_ID) { // Skip gold and heal potion
        continue;
      }

      const isEquipment = rewardScreen.equipDrop === item || (item.stat && item.gameId && item.tier);
      let rarity = item.rarityLevel || item.tier || 0;
      
      let itemName = 'Unknown Item';
      if (item.tooltipKey?.toLowerCase().includes('dust') || 
          (item.spriteSrc && item.spriteSrc.includes('dust'))) {
        itemName = 'Dust';
      } else if (isEquipment) {
        itemName = getEquipmentNameFromId(item.gameId) || 
                  `${item.stat.toUpperCase()} Equipment Tier ${item.tier}`;
      } else if (item.tooltipKey) {
        itemName = item.tooltipKey;
      } else if (item.spriteId) {
        itemName = `ID-${item.spriteId}`;
      }
      
      // For equipment items, ensure they have gameId
      if (isEquipment && !item.gameId) {
        // Try to get gameId from spriteId if available
        item.gameId = item.spriteId;
      }
      
      // Get both rarity and display name in one optimized lookup
      const { rarity: databaseRarity, displayName: databaseDisplayName } = getItemInfoFromDatabase(itemName, item.tooltipKey, item);
      
      if (databaseRarity) {
        rarity = parseInt(databaseRarity);
      }
      
      if (databaseDisplayName) {
        // Extract the descriptive part from the display name for rarity text
        // e.g., "Summon Scroll (Crude)" -> "Crude"
        const match = databaseDisplayName.match(/\(([^)]+)\)$/);
        if (match) {
          // Store the descriptive rarity for later use
          item._descriptiveRarity = match[1];
          // Use the base name without the descriptive part
          itemName = databaseDisplayName.replace(/\s*\([^)]+\)$/, '');
        } else {
          itemName = databaseDisplayName;
        }
      }
      
      
      const rarityBorderColor = getRarityBorderColor(rarity);

      // Use resolved itemName to avoid redundant API calls in getItemVisual
      let itemVisual, resolvedItemName, equipmentStat = null;
      
      // Handle equipment items specially using API components for grid display
      if (isEquipment && typeof globalThis.state?.utils?.getEquipment === 'function' && item.gameId) {
        try {
          const equipData = globalThis.state.utils.getEquipment(item.gameId);
          if (equipData && equipData.metadata && typeof equipData.metadata.spriteId === 'number') {
            const equipmentSpriteId = equipData.metadata.spriteId;
            resolvedItemName = equipData.metadata.name || itemName;
            
            // Extract stat information from equipment data
            if (equipData.metadata && equipData.metadata.stat) {
              equipmentStat = equipData.metadata.stat;
            } else if (equipData.stats && equipData.stats.length > 0) {
              // Get the primary stat (first stat in the array)
              equipmentStat = equipData.stats[0].type;
            }
            
            // Use API component for equipment like Cyclopedia does
            if (api && api.ui && api.ui.components && api.ui.components.createItemPortrait) {
              try {
                const equipmentPortrait = api.ui.components.createItemPortrait({
                  itemId: equipmentSpriteId,
                  tier: rarity || 1
                });
                
                // Check if we got a valid DOM element
                if (equipmentPortrait && equipmentPortrait.nodeType) {
                  // If it's a button, get the first child (the actual portrait)
                  if (equipmentPortrait.tagName === 'BUTTON' && equipmentPortrait.firstChild) {
                    const firstChild = equipmentPortrait.firstChild;
                    if (firstChild && firstChild.nodeType) {
                      // Add count overlay to the portrait (bottom left like creatures)
                      const countSpan = createCountOverlay(item.amount);
                      
                      firstChild.appendChild(countSpan);
                      
                      // Add stat icon to the portrait
                      addStatIconToPortrait(firstChild, equipmentStat);
                      
                      itemVisual = firstChild;
                    }
                  }
                }
              } catch (apiError) {
                console.warn('[Hunt Analyzer] Error creating API equipment portrait, falling back to sprite:', apiError);
              }
            }
            
            // Fallback to sprite system if API component failed
            if (!itemVisual) {
              const spriteDiv = createItemSprite(equipmentSpriteId, resolvedItemName, rarity || 1);
              
              // Add count overlay to sprite (bottom left like creatures)
              const countSpan = createCountOverlay(item.amount);
              
              // Make sure the sprite container has relative positioning for the count overlay
              spriteDiv.style.position = 'relative';
              spriteDiv.appendChild(countSpan);
              itemVisual = spriteDiv;
            }
          }
        } catch (e) { 
          console.error("[Hunt Analyzer] Error getting equipment data:", e); 
        }
      }
      
      // For non-equipment items, use the same approach as regenerative system
      if (!itemVisual) {
        resolvedItemName = itemName;
        
        // Use the same visual creation system as the regenerative system
        const itemData = {
          spriteId: item.spriteId || item.gameId,
          src: item.spriteSrc,
          spriteSrc: item.spriteSrc,
          originalName: resolvedItemName,
          rarity: rarity,
          count: item.amount || 1
        };
        itemVisual = createInventoryStyleItemPortrait(itemData);
      }

      // Handle dust items - add to session but will be filtered out in aggregation
      if (resolvedItemName === 'Dust') {
        console.log('[Hunt Analyzer] Processing dust item:', { amount: item.amount, totalBefore: HuntAnalyzerState.totals.dust });
        HuntAnalyzerState.totals.dust += item.amount || 1;
        currentLootItemsLog.push(`Dust (x${item.amount || 1})`);
        console.log('[Hunt Analyzer] Dust total after processing:', HuntAnalyzerState.totals.dust);
        // Continue processing to add dust to session loot (will be filtered out later)
      }

      // Track rune drops - check both original and resolved names
      const originalItemName = item.tooltipKey || `ID-${item.spriteId}`;
      if (isRuneItem(originalItemName, item) || isRuneItem(resolvedItemName, item)) {
        HuntAnalyzerState.totals.runes += item.amount || 1;
      }

      const mapKey = `${resolvedItemName}_${rarity}_${item.spriteId}_${item.spriteSrc}_${isEquipment}_${item.stat}`;
      const currentQuantity = item.amount || 1;

      if (aggregatedLootForSession.has(mapKey)) {
        const existing = aggregatedLootForSession.get(mapKey);
        existing.count += currentQuantity;
        
        // Update the count overlay in the visual element
        if (existing.visual && existing.visual.querySelector) {
            const countSpan = existing.visual.querySelector('.pixel-font-16');
            if (countSpan) {
                countSpan.textContent = existing.count;
            }
        }
        
        // Update descriptive rarity if available
        if (item._descriptiveRarity) {
          existing._descriptiveRarity = item._descriptiveRarity;
        }
        // Update gameId and stat for equipment items
        if (item.gameId) {
          existing.gameId = item.gameId;
        }
        if (equipmentStat && !existing.stat) {
          existing.stat = equipmentStat;
        }
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
          gameId: item.gameId, // Add gameId for equipment items
          stat: item.stat || equipmentStat || null,
          _descriptiveRarity: item._descriptiveRarity || null
        });
      }
      currentLootItemsLog.push(`${resolvedItemName} (Rarity ${rarity}, x${currentQuantity})`);
    }

    // Process Creature Drop
    if (rewardScreen.monsterDrop) {
      const { name: creatureName, totalStats, tierName, tierLevel, gameId: creatureGameId, isShiny } = 
        getCreatureDetails(rewardScreen.monsterDrop);

      if (!creatureName.toLowerCase().includes('monster squeezer')) {
        // Track shiny drops
        if (isShiny) {
          HuntAnalyzerState.totals.shiny += 1;
        }
        
        // Include shiny status in map key to separate shiny and normal creatures
        const mapKey = `${creatureGameId}_${tierLevel}_${isShiny ? 'shiny' : 'normal'}`;
        if (aggregatedCreaturesForSession.has(mapKey)) {
          const existing = aggregatedCreaturesForSession.get(mapKey);
          existing.count += 1;
          
          // Update the count overlay in the visual element
          const countSpan = existing.visual.querySelector('.pixel-font-16');
          if (countSpan) {
            countSpan.textContent = existing.count;
          }
        } else {
          // Use the same visual creation system as the regenerative system
          const creatureData = {
            gameId: creatureGameId,
            originalName: creatureName,
            tierLevel: tierLevel,
            count: 1,
            isShiny: isShiny
          };
          const creatureVisual = createInventoryStyleCreaturePortrait(creatureData);
          
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
            gameId: creatureGameId,
            isShiny: isShiny
          });
        }
      }
    }

    // Update stamina spent
    if (typeof serverResults.next?.playerExpDiff === 'number') {
      HuntAnalyzerState.totals.staminaSpent += serverResults.next.playerExpDiff;
    }

    // Calculate stamina recovered for this session
    let sessionStaminaRecovered = 0;
    for (const item of allLootItems) {
      if (item.spriteId === CONFIG.GOLD_SPRITE_ID || 
          (item.tooltipKey && item.tooltipKey.toLowerCase() === 'gold') ||
          item.spriteId === CONFIG.HEAL_POTION_SPRITE_ID) {
        continue;
      }

      let itemName = 'Unknown Item';
      if (item.tooltipKey?.toLowerCase().includes('dust') || 
          (item.spriteSrc && item.spriteSrc.includes('dust'))) {
        itemName = 'Dust';
      } else if (item.tooltipKey) {
        itemName = item.tooltipKey;
      } else if (item.name) {
        itemName = item.name;
      }

      const staminaRecovery = getStaminaRecoveryAmount(itemName, item);
      if (staminaRecovery > 0) {
        sessionStaminaRecovered += staminaRecovery;
      }
    }

    // Track win/loss
    if (rewardScreen.victory) {
      HuntAnalyzerState.totals.wins++;
    } else {
      HuntAnalyzerState.totals.losses++;
    }
    
    // Extract gold and dust from loot array for session tracking
    let sessionGold = 0;
    let sessionDust = 0;
    for (const item of aggregatedLootForSession.values()) {
      if (item.originalName === 'Gold') {
        sessionGold += item.count;
      } else if (item.originalName === 'Dust') {
        sessionDust += item.count;
      }
    }
    
    // Store session data
    const sessionData = {
      message: autoplayMessage,
      roomId: rewardScreen.roomId,
      roomName: readableRoomName,
      loot: Array.from(aggregatedLootForSession.values()),
      creatures: Array.from(aggregatedCreaturesForSession.values()),
      timestamp: Date.now(),
      staminaSpent: serverResults.next?.playerExpDiff || 0,
      staminaRecovered: sessionStaminaRecovered,
      victory: rewardScreen.victory,
      gold: sessionGold,
      dust: sessionDust
    };
    
    this.state.data.sessions.push(sessionData);
    
    // Consolidated session processing summary
    console.log('[Hunt Analyzer] Session processed:', {
      result: autoplayMessage,
      room: readableRoomName,
      gold: rewardScreen.loot?.goldAmount || 0,
      lootItems: aggregatedLootForSession.size,
      creatures: aggregatedCreaturesForSession.size,
      staminaSpent: sessionData.staminaSpent,
      staminaRecovered: sessionData.staminaRecovered
    });
    
    // Auto-save data if persistence is enabled
    if (HuntAnalyzerState.settings.persistData) {
      saveHuntAnalyzerData();
    }
  }

  aggregateData() {
    // Clear global aggregated data before re-populating from all sessions
    this.state.data.aggregatedLoot.clear();
    this.state.data.aggregatedCreatures.clear();

    // Reset totals
    HuntAnalyzerState.totals.gold = 0;
    HuntAnalyzerState.totals.creatures = 0;
    HuntAnalyzerState.totals.equipment = 0;
    HuntAnalyzerState.totals.runes = 0;
    HuntAnalyzerState.totals.dust = 0;
    HuntAnalyzerState.totals.shiny = 0;
    HuntAnalyzerState.totals.staminaSpent = 0;
    HuntAnalyzerState.totals.staminaRecovered = 0;
    HuntAnalyzerState.totals.wins = 0;
    HuntAnalyzerState.totals.losses = 0;

    // Filter sessions by selected map
    const filteredSessions = this.state.data.sessions.filter(sessionData => {
      if (this.state.ui.selectedMapFilter === "ALL") {
        return true;
      }
      return sessionData.roomName === this.state.ui.selectedMapFilter;
    });

    // Aggregate data from filtered sessions into the global maps
    filteredSessions.forEach(sessionData => {
        // Track wins/losses
        if (sessionData.victory === true) {
          HuntAnalyzerState.totals.wins++;
        } else if (sessionData.victory === false) {
          HuntAnalyzerState.totals.losses++;
        }
        
        // Aggregate stamina data
        HuntAnalyzerState.totals.staminaSpent += sessionData.staminaSpent || 0;
        HuntAnalyzerState.totals.staminaRecovered += sessionData.staminaRecovered || 0;
        
        sessionData.loot.forEach(item => {
            // Handle special items (Gold, Dust) that should only appear in totals
            if (item.originalName === 'Gold' || item.originalName === 'Dust') {
                // Still accumulate totals for Gold and Dust
                if (item.originalName === 'Gold') {
                    HuntAnalyzerState.totals.gold += item.count;
                } else if (item.originalName === 'Dust') {
                    HuntAnalyzerState.totals.dust += item.count;
                }
                return; // Skip adding to aggregatedLoot
            }

            const mapKey = `${item.originalName}_${item.rarity}_${item.spriteId}_${item.src}_${item.isEquipment}_${item.stat}`;
            if (this.state.data.aggregatedLoot.has(mapKey)) {
                const existing = this.state.data.aggregatedLoot.get(mapKey);
                existing.count += item.count;
                
                // Update the count overlay in the visual element
                if (existing.visual && existing.visual.querySelector) {
                    const countSpan = existing.visual.querySelector('.pixel-font-16');
                    if (countSpan) {
                        countSpan.textContent = existing.count;
                    }
                }
                
                this.state.data.aggregatedLoot.set(mapKey, existing);
            } else {
                this.state.data.aggregatedLoot.set(mapKey, { ...item });
            }

            // Accumulate global totals for Equipment and Runes based on originalName
            if (item.isEquipment) {
                HuntAnalyzerState.totals.equipment += item.count;
            } else if (item.originalName.includes('Rune') || item.originalName.includes('rune')) {
                HuntAnalyzerState.totals.runes += item.count;
            }
        });

        sessionData.creatures.forEach(creature => {
            const mapKey = `${creature.gameId}_${creature.tierLevel}_${creature.isShiny ? 'shiny' : 'normal'}`;
        if (this.state.data.aggregatedCreatures.has(mapKey)) {
          const existing = this.state.data.aggregatedCreatures.get(mapKey);
                existing.count += creature.count;
                
                // Update the count overlay in the visual element
                if (existing.visual && existing.visual.querySelector) {
                    const countSpan = existing.visual.querySelector('.pixel-font-16');
                    if (countSpan) {
                        countSpan.textContent = existing.count;
                    }
                }
                
          this.state.data.aggregatedCreatures.set(mapKey, existing);
            } else {
          this.state.data.aggregatedCreatures.set(mapKey, { ...creature });
            }
            
            // Count shiny drops for display
            if (creature.isShiny) {
          HuntAnalyzerState.totals.shiny += creature.count;
            }
        });
    });
  }
}

// Initialize data processor
const dataProcessor = new DataProcessor();

// =======================
// 3.2. Room Display Enhancement Functions
// =======================

// Enhanced room title display with boosted and raid status
function updateRoomTitleDisplay(roomId, roomName) {
    const cachedRoomIdDisplayElement = domCache.get("mod-room-id-display");
    if (!cachedRoomIdDisplayElement) return;

    let displayText = roomName || `Room ID: ${roomId}`;
    let statusIndicators = [];

    // Check if map is boosted
    const boostedRoomId = globalThis.state?.daily?.getSnapshot?.()?.context?.boostedMap?.roomId;
    if (boostedRoomId === roomId) {
        statusIndicators.push('Boosted');
    }

    // Check if map is a raid using maps database
    if (typeof window !== 'undefined' && window.mapsDatabase) {
        const mapData = window.mapsDatabase.getMapById(roomId);
        if (mapData && mapData.raid === true) {
            statusIndicators.push('Raid');
        }
    }

    // Add status indicators to display text
    if (statusIndicators.length > 0) {
        displayText += ` (${statusIndicators.join(', ')})`;
    }

    cachedRoomIdDisplayElement.textContent = displayText;
}

// =======================
// 3.3. Map Filter Functions
// =======================

// Update map filter dropdown based on available maps
function updateMapFilterDropdown() {
    const mapFilterRow = domCache.get("mod-map-filter-row");
    if (!mapFilterRow) return;

    // Clear existing content
    mapFilterRow.innerHTML = "";

    // Create dropdown container
    const dropdownContainer = document.createElement("div");
    dropdownContainer.style.position = "relative";
    dropdownContainer.style.display = "inline-block";

    // Create dropdown button
    const dropdownButton = document.createElement("button");
    dropdownButton.id = "mod-map-filter-dropdown-button";
    dropdownButton.style.padding = "6px 12px";
    dropdownButton.style.border = `1px solid ${getThemeColor('border')}`;
    dropdownButton.style.borderRadius = "4px";
    dropdownButton.style.backgroundColor = getThemeColor('dropdownBackground');
    dropdownButton.style.color = getThemeColor('text');
    dropdownButton.style.fontSize = "12px";
    dropdownButton.style.cursor = "pointer";
    dropdownButton.style.minWidth = "150px";
    dropdownButton.style.textAlign = "left";
    dropdownButton.style.display = "flex";
    dropdownButton.style.justifyContent = "space-between";
    dropdownButton.style.alignItems = "center";

    // Create dropdown arrow
    const arrow = document.createElement("span");
    arrow.textContent = "▼";
    arrow.style.fontSize = "10px";
    arrow.style.marginLeft = "8px";

    dropdownButton.appendChild(document.createTextNode(HuntAnalyzerState.ui.selectedMapFilter));
    dropdownButton.appendChild(arrow);

    // Create dropdown menu
    const dropdownMenu = document.createElement("div");
    dropdownMenu.id = "mod-map-filter-dropdown-menu";
    dropdownMenu.style.position = "absolute";
    dropdownMenu.style.top = "100%";
    dropdownMenu.style.left = "0";
    dropdownMenu.style.right = "0";
    dropdownMenu.style.backgroundColor = getThemeColor('dropdownMenuBackground');
    dropdownMenu.style.border = `1px solid ${getThemeColor('border')}`;
    dropdownMenu.style.borderRadius = "4px";
    dropdownMenu.style.boxShadow = `0 4px 8px ${getThemeColor('dropdownShadow')}`;
    dropdownMenu.style.zIndex = "10000";
    dropdownMenu.style.display = "none";
    dropdownMenu.style.maxHeight = "200px";
    dropdownMenu.style.overflowY = "auto";

    // Get unique map names from sessions (maps that have been farmed)
    const farmedMapNames = new Set(HuntAnalyzerState.data.sessions.map(s => s.roomName));
    
    // Get region data and room name mapping (matching Cyclopedia's approach)
    const roomNamesMap = globalThis.state?.utils?.ROOM_NAME || {};
    const regions = globalThis.state?.utils?.REGIONS || [];
    
    // Build ordered list using region room order (same as Cyclopedia does)
    const orderedMaps = [];
    
    if (regions.length > 0) {
        // Iterate through regions in their native order
        regions.forEach(region => {
            if (!region.rooms) return;
            
            // Iterate through rooms in their native order within this region
            region.rooms.forEach(room => {
                const roomId = room.id;
                const mapName = roomNamesMap[roomId];
                
                // Only include maps that have been farmed
                if (mapName && farmedMapNames.has(mapName)) {
                    orderedMaps.push(mapName);
                    // Remove from set to avoid duplicates
                    farmedMapNames.delete(mapName);
                }
            });
        });
    }
    
    // Add any remaining maps not found in regions (fallback - should be rare)
    if (farmedMapNames.size > 0) {
        const remainingMaps = Array.from(farmedMapNames).sort();
        orderedMaps.push(...remainingMaps);
    }
    
    // Add "ALL" option
    const allOption = createDropdownOption("ALL");
    dropdownMenu.appendChild(allOption);

    // Add options for each farmed map (in Cyclopedia's order)
    orderedMaps.forEach(mapName => {
        const mapOption = createDropdownOption(mapName);
        dropdownMenu.appendChild(mapOption);
    });

    // Toggle dropdown visibility
    dropdownClickHandler = (e) => {
        e.stopPropagation();
        const isVisible = dropdownMenu.style.display === "block";
        dropdownMenu.style.display = isVisible ? "none" : "block";
        arrow.textContent = isVisible ? "▼" : "▲";
    };
    dropdownButton.addEventListener("click", dropdownClickHandler);

    // Close dropdown when clicking outside
    documentClickHandler = () => {
        dropdownMenu.style.display = "none";
        arrow.textContent = "▼";
    };
    document.addEventListener("click", documentClickHandler);

    dropdownContainer.appendChild(dropdownButton);
    dropdownContainer.appendChild(dropdownMenu);
    mapFilterRow.appendChild(dropdownContainer);
}

// Create a dropdown option
function createDropdownOption(mapName) {
    const option = document.createElement("div");
    option.textContent = mapName;
    option.style.padding = "8px 12px";
    option.style.cursor = "pointer";
    option.style.fontSize = "12px";
    option.style.color = getThemeColor('text');
    option.style.borderBottom = `1px solid ${getThemeColor('border')}`;
    option.style.transition = "background-color 0.2s ease";

    // Highlight selected option
    if (mapName === HuntAnalyzerState.ui.selectedMapFilter) {
        option.style.backgroundColor = getThemeColor('dropdownOptionSelected');
        option.style.color = getThemeColor('textSecondary');
    }

    // Hover effects
    option.addEventListener("mouseenter", () => {
        if (mapName !== HuntAnalyzerState.ui.selectedMapFilter) {
            option.style.backgroundColor = getThemeColor('dropdownOptionHover');
        }
    });

    option.addEventListener("mouseleave", () => {
        if (mapName !== HuntAnalyzerState.ui.selectedMapFilter) {
            option.style.backgroundColor = "transparent";
        }
    });

    // Click handler
    option.addEventListener("click", () => {
        HuntAnalyzerState.ui.selectedMapFilter = mapName;
        
        // Update dropdown button text
        const dropdownButton = document.getElementById("mod-map-filter-dropdown-button");
        if (dropdownButton) {
            dropdownButton.childNodes[0].textContent = mapName;
        }
        
        // Close dropdown
        const dropdownMenu = document.getElementById("mod-map-filter-dropdown-menu");
        if (dropdownMenu) {
            dropdownMenu.style.display = "none";
        }
        
        // Update arrow
        const arrow = dropdownButton?.querySelector("span");
        if (arrow) {
            arrow.textContent = "▼";
        }
        
        // Refresh data and display
        dataProcessor.aggregateData();
        renderAllSessions();
    });

    return option;
}

// =======================
// 4. Data Processing Functions
// =======================
// Renders all stored game sessions to the analyzer panel.
// Optimized to use incremental updates instead of full re-renders when possible.
function renderAllSessions() {
    // Check if the panel is open first
    if (!document.getElementById(PANEL_ID)) {
        return; // Silently return if panel is not open
    }
    
    const cachedLootDiv = domCache.get("mod-loot-display");
    const cachedCreatureDropDiv = domCache.get("mod-creature-drop-display");
    const cachedTotalGoldDisplayElement = domCache.get("mod-total-gold-display");
    const cachedTotalDustDisplayElement = domCache.get("mod-total-dust-display");
    const cachedTotalShinyDisplayElement = domCache.get("mod-total-shiny-display");
    
    if (!cachedLootDiv || !cachedCreatureDropDiv || !cachedTotalGoldDisplayElement || !cachedTotalDustDisplayElement) {
        console.warn("[Hunt Analyzer] Render target divs or gold/dust display elements not available. Panel might not be open.");
        return;
    }

    // Use the new data processor to aggregate data
    dataProcessor.aggregateData();
    
    // Use DocumentFragment for efficient batch DOM updates
    const creatureFragment = document.createDocumentFragment();
    
    // Clear previous content - but build fragments first to minimize reflow
    cachedLootDiv.innerHTML = ''; // Clear previous content
    cachedCreatureDropDiv.innerHTML = ''; // Clear previous content

    // Update Gold, Dust, and Shiny display next to Loot title
    if (cachedTotalGoldDisplayElement) {
        cachedTotalGoldDisplayElement.textContent = HuntAnalyzerState.totals.gold;
    }
    if (cachedTotalDustDisplayElement) {
        cachedTotalDustDisplayElement.textContent = HuntAnalyzerState.totals.dust;
    }
    if (cachedTotalShinyDisplayElement) {
        cachedTotalShinyDisplayElement.textContent = HuntAnalyzerState.totals.shiny;
    }

    // Get all loot items (Gold and Dust are already excluded from aggregatedLoot)
    const allLoot = Array.from(HuntAnalyzerState.data.aggregatedLoot.values());

    // Calculate total loot items for current filter
    let totalLootItems = 0;
    allLoot.forEach((data) => {
        totalLootItems += data.count;
    });

    // Update loot title with total count
    const lootTitle = document.getElementById('mod-loot-title');
    if (lootTitle) {
        const filterText = HuntAnalyzerState.ui.selectedMapFilter === 'ALL' ? '' : ` (${HuntAnalyzerState.ui.selectedMapFilter})`;
        lootTitle.textContent = `${t('mods.huntAnalyzer.loot')}: ${totalLootItems}${filterText}`;
    }

    // Sort loot with new priority order: Runes → Equipment → Everything else
    const sortedFilteredLoot = allLoot.sort((a, b) => {
        // First priority: Category (Runes → Equipment → Everything else)
        const categoryA = getItemCategory(a);
        const categoryB = getItemCategory(b);
        if (categoryA !== categoryB) {
            return categoryA - categoryB;
        }
        
        // Second priority: Name (alphabetical within each category)
        const nameCompare = a.originalName.localeCompare(b.originalName);
        if (nameCompare !== 0) {
            return nameCompare;
        }
        
        // Third priority: Rarity (highest rarity first)
        if (a.rarity !== b.rarity) {
            return b.rarity - a.rarity; // Higher rarity first (descending)
        }
        
        // Within same name and rarity, sort by GameId for consistency
        if (a.gameId !== b.gameId) {
            return a.gameId - b.gameId; // Sort by GameId numerically
        }
        return 0;
    });

    // Create grid container for loot using unified function
    const lootGridContainer = createUnifiedGridContainer();

    sortedFilteredLoot.forEach((data) => {
        const lootEntryDiv = document.createElement('div');
        lootEntryDiv.style.display = 'flex';
        lootEntryDiv.style.flexDirection = 'column';
        lootEntryDiv.style.alignItems = 'center';
        lootEntryDiv.style.justifyContent = 'center';
        lootEntryDiv.style.padding = '4px';
        lootEntryDiv.style.backgroundColor = getThemeColor('entryBackground');
        lootEntryDiv.style.borderRadius = '6px';

        const iconWrapper = document.createElement('div');
        iconWrapper.style.display = 'flex';
        iconWrapper.style.justifyContent = 'center';
        iconWrapper.style.alignItems = 'center';

        // Debug: Log equipment items only
        if (data.isEquipment) {
            // Equipment processing consolidated - see summary log at end
        }
        
        // For equipment items, always use API components directly
        // This ensures proper equipment portraits regardless of stored visual state
        let visualElement;
        
        // Try to get gameId from spriteId if missing for equipment items
        let equipmentGameId = data.gameId;
        if (data.isEquipment && !equipmentGameId && data.spriteId) {
            equipmentGameId = data.spriteId;
        }
        
        if (data.isEquipment && equipmentGameId && typeof globalThis.state?.utils?.getEquipment === 'function') {
            try {
                const equipData = globalThis.state.utils.getEquipment(equipmentGameId);
                if (equipData && equipData.metadata && typeof equipData.metadata.spriteId === 'number') {
                    const equipmentSpriteId = equipData.metadata.spriteId;
                    
                    // Use API component for equipment like Cyclopedia does
                    if (api && api.ui && api.ui.components && api.ui.components.createItemPortrait) {
                        const equipmentPortrait = api.ui.components.createItemPortrait({
                            itemId: equipmentSpriteId,
                            tier: data.rarity || 1
                        });
                        
                        // Check if we got a valid DOM element
                        if (equipmentPortrait && equipmentPortrait.nodeType) {
                            // If it's a button, get the first child (the actual portrait)
                            if (equipmentPortrait.tagName === 'BUTTON' && equipmentPortrait.firstChild) {
                                const firstChild = equipmentPortrait.firstChild;
                                if (firstChild && firstChild.nodeType) {
                                    // Add count overlay to the portrait (bottom left like creatures)
                                    const countSpan = createCountOverlay(data.count);
                                    
                                    firstChild.appendChild(countSpan);
                                    
                                    // Add stat icon to the portrait
                                    addStatIconToPortrait(firstChild, data.stat);
                                    
                                    visualElement = firstChild;
                                }
                            } else {
                                // Use the portrait directly if it's not a button
                                addStatIconToPortrait(equipmentPortrait, data.stat);
                                visualElement = equipmentPortrait;
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('[Hunt Analyzer] Error creating equipment API component:', e);
            }
        }
        
        // Fallback to stored visual or regenerate for non-equipment items
        if (!visualElement) {
            visualElement = data.visual;
            
            // Only regenerate if visual is not a proper HTMLElement
            if (!(visualElement instanceof HTMLElement)) {
                // Regenerate visual from item data (loaded from persistence)
                const itemData = {
                    spriteId: data.spriteId,
                    src: data.src,
                    spriteSrc: data.src,
                    originalName: data.originalName,
                    rarity: data.rarity,
                    count: data.count,
                    isEquipment: data.isEquipment,
                    gameId: data.gameId,
                    stat: data.stat
                };
                visualElement = createInventoryStyleItemPortrait(itemData);
            }
        }
        
        if (visualElement instanceof HTMLElement) {
            iconWrapper.appendChild(visualElement);
        } else {
            // Fallback for non-image visuals
            iconWrapper.textContent = visualElement || '🎲';
            iconWrapper.style.fontSize = '24px';
        }
        lootEntryDiv.appendChild(iconWrapper);

        lootGridContainer.appendChild(lootEntryDiv);
        HuntAnalyzerState.totals.loot += data.count; // Accumulate for overall rate
    });
    
    // Append grid container to loot display
    cachedLootDiv.appendChild(lootGridContainer);
    
    // Add stat icons to any existing equipment portraits
    setTimeout(() => addStatIconsToExistingPortraits(), 100);

    // Sort and render overall aggregated creatures in grid layout
    const sortedOverallCreatures = Array.from(HuntAnalyzerState.data.aggregatedCreatures.values()).sort((a, b) => {
        // First priority: shiny creatures first
        if (a.isShiny !== b.isShiny) {
            return b.isShiny ? 1 : -1; // Shiny first
        }
        
        // Second priority: name (alphabetical)
        const nameCompare = a.originalName.localeCompare(b.originalName);
        if (nameCompare !== 0) {
            return nameCompare;
        }
        
        // Third priority: rarity (highest tier level first)
        if (a.tierLevel !== b.tierLevel) {
            return b.tierLevel - a.tierLevel; // Higher tier level first (descending)
        }
        
        // Within same name and tier level, sort by GameId for consistency
        if (a.gameId !== b.gameId) {
            return a.gameId - b.gameId; // Sort by GameId numerically
        }
        return 0;
    });

    // Calculate total creature drops for current filter
    let totalCreatureDrops = 0;
    sortedOverallCreatures.forEach((data) => {
        totalCreatureDrops += data.count;
    });

    // Update creature drops title with total count
    const creatureDropTitle = document.getElementById('mod-creature-drops-title');
    if (creatureDropTitle) {
        const filterText = HuntAnalyzerState.ui.selectedMapFilter === 'ALL' ? '' : ` (${HuntAnalyzerState.ui.selectedMapFilter})`;
        creatureDropTitle.textContent = `${t('mods.huntAnalyzer.creatureDrops')}: ${totalCreatureDrops}${filterText}`;
    }

    // Create grid container for creatures using unified function
    const gridContainer = createUnifiedGridContainer();

    sortedOverallCreatures.forEach((data) => {
        const creatureEntryDiv = document.createElement('div');
        creatureEntryDiv.style.display = 'flex';
        creatureEntryDiv.style.flexDirection = 'column';
        creatureEntryDiv.style.alignItems = 'center';
        creatureEntryDiv.style.justifyContent = 'center';
        creatureEntryDiv.style.padding = '4px';
        creatureEntryDiv.style.backgroundColor = getThemeColor('entryBackground');
        creatureEntryDiv.style.borderRadius = '6px';

        const iconWrapper = document.createElement('div');
        iconWrapper.style.display = 'flex';
        iconWrapper.style.justifyContent = 'center';
        iconWrapper.style.alignItems = 'center';

        // Regenerate visual element from creature data instead of using saved visual
        // This fixes the "[object Object]" issue when loading from persistence
        let visualElement;
        if (data.visual instanceof HTMLElement) {
            // Use existing visual if it's a proper HTMLElement (fresh data)
            visualElement = data.visual;
        } else {
            // Regenerate visual from creature data (loaded from persistence)
            if (data.gameId) {
                // Create inventory-style creature portrait like the game does
                visualElement = createInventoryStyleCreaturePortrait(data);
            } else {
                // Fallback emoji
                visualElement = '👾';
            }
        }
        
        if (visualElement instanceof HTMLElement) {
            iconWrapper.appendChild(visualElement);
        } else {
            // Fallback for non-image visuals
            iconWrapper.textContent = visualElement || '👾';
            iconWrapper.style.fontSize = '24px';
        }
        creatureEntryDiv.appendChild(iconWrapper);

        gridContainer.appendChild(creatureEntryDiv);
        HuntAnalyzerState.totals.creatures += data.count; // Accumulate for overall rate
    });
    
    // Append grid container to creature display
    cachedCreatureDropDiv.appendChild(gridContainer);

    updatePanelDisplay(); // Update overall rates after rendering all sessions
}


// PROCESSES THE CONTENT OF AN AUTOPLAY SUMMARY USING A 'serverResults' OBJECT.
// This function now extracts data from the serverResults and adds it to the
// `allGameSessionsData` array. It does NOT render directly.
// serverResults - The structured data containing game outcome, loot, and creature drops.
function processAutoplaySummary(serverResults) {
    // Delegate to the new data processor
    dataProcessor.processSession(serverResults);

    // Trigger re-render - use requestAnimationFrame to batch DOM updates
    requestAnimationFrame(() => {
        renderAllSessions();
        updateMapFilterDropdown();
    });
}


// Generates a summarized log text of all aggregated loot and creature drops.
// This is the text that will be copied to the user's clipboard.
// Returns the formatted summary log.
function generateSummaryLogText() {
    let summary = `--- Hunt Analyzer Summary ---\n`;

    // Overall Stats
    const filteredTimeHours = getFilteredTimeHours();
    
    // Determine room name for summary header - check if multiple maps were hunted
    const uniqueMaps = new Set(HuntAnalyzerState.data.sessions.map(s => s.roomName));
    let roomDisplayName;
    if (uniqueMaps.size === 0) {
        roomDisplayName = 'N/A';
    } else if (uniqueMaps.size === 1) {
        roomDisplayName = Array.from(uniqueMaps)[0];
    } else {
        roomDisplayName = `All Maps (${uniqueMaps.size} maps)`;
    }
    
    // Calculate overall rates for summary
    const autoplayRatePerHour = filteredTimeHours > 0 ? Math.floor(HuntAnalyzerState.session.count / filteredTimeHours) : 0;
    const goldRatePerHour = filteredTimeHours > 0 ? Math.floor(HuntAnalyzerState.totals.gold / filteredTimeHours) : 0;
    const creatureRatePerHour = filteredTimeHours > 0 ? Math.floor(HuntAnalyzerState.totals.creatures / filteredTimeHours) : 0;
    const equipmentRatePerHour = filteredTimeHours > 0 ? Math.round(HuntAnalyzerState.totals.equipment / filteredTimeHours) : 0;
    const staminaSpentRatePerHour = filteredTimeHours > 0 ? Math.floor(HuntAnalyzerState.totals.staminaSpent / filteredTimeHours) : 0;
    
    // Calculate overall efficiency metrics
    const goldPerStamina = HuntAnalyzerState.totals.staminaSpent > 0 ? (HuntAnalyzerState.totals.gold / HuntAnalyzerState.totals.staminaSpent).toFixed(2) : 'N/A';
    const sessionsPerStamina = HuntAnalyzerState.totals.staminaSpent > 0 ? (HuntAnalyzerState.session.count / HuntAnalyzerState.totals.staminaSpent).toFixed(3) : 'N/A';
    const totalSessionsForWinRate = HuntAnalyzerState.totals.wins + HuntAnalyzerState.totals.losses;
    const winRate = totalSessionsForWinRate > 0 ? Math.round((HuntAnalyzerState.totals.wins / totalSessionsForWinRate) * 100) : 0;
    
    summary += `Room: ${roomDisplayName}\n`;
    summary += `Sessions: ${HuntAnalyzerState.session.count}\n`;
    summary += `Win/Loss: ${HuntAnalyzerState.totals.wins}/${HuntAnalyzerState.totals.losses} (${winRate}%)\n`;
    summary += `Time Elapsed: ${formatTime(filteredTimeHours * 60 * 60 * 1000)}\n`;
    summary += `Gold: ${HuntAnalyzerState.totals.gold} | Dust: ${HuntAnalyzerState.totals.dust}\n`;
    summary += `Equipment Drops: ${HuntAnalyzerState.totals.equipment} | Creature Drops: ${HuntAnalyzerState.totals.creatures} | Shiny Drops: ${HuntAnalyzerState.totals.shiny}\n`;
    summary += `Total Stamina Spent: ${HuntAnalyzerState.totals.staminaSpent}\n`;
    summary += `---------------------------\n`;
    summary += `Overall Rates: ${autoplayRatePerHour} sessions/h | ${goldRatePerHour} gold/h | ${creatureRatePerHour} creatures/h | ${equipmentRatePerHour} equipment/h\n`;
    summary += `Overall Efficiency: ${goldPerStamina} gold/stamina | ${sessionsPerStamina} sessions/stamina | ${staminaSpentRatePerHour} stamina/h\n`;
    summary += `Generated: ${new Date().toLocaleString()}\n`;
    summary += `---------------------------\n\n`;

    // Map-specific Analysis
    summary += `--- Map Analysis ---\n`;
    if (HuntAnalyzerState.data.sessions.length === 0) {
        summary += `No sessions recorded.\n`;
    } else {
        // Group sessions by map and calculate map-specific stats
        const mapGroups = {};
        const overallStartTime = HuntAnalyzerState.session.startTime;
        const sessionsWithTimestamps = HuntAnalyzerState.data.sessions.filter(s => s.timestamp);
        
        HuntAnalyzerState.data.sessions.forEach(session => {
            const mapName = session.roomName || 'Unknown Map';
            if (!mapGroups[mapName]) {
                mapGroups[mapName] = {
                    sessions: 0,
                    wins: 0,
                    losses: 0,
                    loot: new Map(),
                    creatures: new Map(),
                    totalGold: 0,
                    totalDust: 0,
                    totalStamina: 0,
                    totalEquipment: 0,
                    totalCreatures: 0,
                    totalShiny: 0,
                    startTime: session.timestamp || overallStartTime,
                    endTime: session.timestamp || overallStartTime,
                    hasTimestamps: false
                };
            }
            
            mapGroups[mapName].sessions++;
            if (session.victory === true) {
                mapGroups[mapName].wins++;
            } else if (session.victory === false) {
                mapGroups[mapName].losses++;
            }
            mapGroups[mapName].totalGold += session.gold || 0;
            mapGroups[mapName].totalDust += session.dust || 0;
            mapGroups[mapName].totalStamina += session.staminaSpent || 0;
            
            // Track time range for this map
            if (session.timestamp) {
                mapGroups[mapName].hasTimestamps = true;
                mapGroups[mapName].startTime = Math.min(mapGroups[mapName].startTime, session.timestamp);
                mapGroups[mapName].endTime = Math.max(mapGroups[mapName].endTime, session.timestamp);
            } else {
                // For sessions without timestamps, use overall session time range
                mapGroups[mapName].startTime = Math.min(mapGroups[mapName].startTime, overallStartTime);
                mapGroups[mapName].endTime = Math.max(mapGroups[mapName].endTime, Date.now());
            }
            
            // Aggregate loot for this map
            session.loot.forEach(item => {
                const mapKey = `${item.originalName}_${item.rarity}_${item.spriteId}_${item.src}_${item.isEquipment}_${item.stat}`;
                if (mapGroups[mapName].loot.has(mapKey)) {
                    const existing = mapGroups[mapName].loot.get(mapKey);
                    existing.count += item.count;
                    mapGroups[mapName].loot.set(mapKey, existing);
                } else {
                    mapGroups[mapName].loot.set(mapKey, { ...item });
                }
                
                // Count equipment (gold and dust are tracked via session.gold/dust above)
                if (item.isEquipment) {
                    mapGroups[mapName].totalEquipment += item.count;
                }
            });
            
            // Aggregate creatures for this map
            session.creatures.forEach(creature => {
                const mapKey = `${creature.gameId}_${creature.tierLevel}_${creature.isShiny ? 'shiny' : 'normal'}`;
                if (mapGroups[mapName].creatures.has(mapKey)) {
                    const existing = mapGroups[mapName].creatures.get(mapKey);
                    existing.count += creature.count;
                    mapGroups[mapName].creatures.set(mapKey, existing);
                } else {
                    mapGroups[mapName].creatures.set(mapKey, { ...creature });
                }
                
                mapGroups[mapName].totalCreatures += creature.count;
                if (creature.isShiny) {
                    mapGroups[mapName].totalShiny += creature.count;
                }
            });
        });
        
        // Sort maps by session count (most hunted first)
        const sortedMaps = Object.keys(mapGroups).sort((a, b) => mapGroups[b].sessions - mapGroups[a].sessions);
        
        sortedMaps.forEach(mapName => {
            const mapData = mapGroups[mapName];
            const mapTimeHours = (mapData.endTime - mapData.startTime) / (1000 * 60 * 60);
            
            // Calculate map-specific rates
            const mapSessionRate = mapTimeHours > 0 ? Math.floor(mapData.sessions / mapTimeHours) : 0;
            const mapGoldRate = mapTimeHours > 0 ? Math.floor(mapData.totalGold / mapTimeHours) : 0;
            const mapCreatureRate = mapTimeHours > 0 ? Math.floor(mapData.totalCreatures / mapTimeHours) : 0;
            const mapEquipmentRate = mapTimeHours > 0 ? Math.round(mapData.totalEquipment / mapTimeHours) : 0;
            const mapStaminaRate = mapTimeHours > 0 ? Math.floor(mapData.totalStamina / mapTimeHours) : 0;
            
            // Calculate map-specific efficiency
            const mapGoldPerStamina = mapData.totalStamina > 0 ? (mapData.totalGold / mapData.totalStamina).toFixed(2) : 'N/A';
            const mapSessionsPerStamina = mapData.totalStamina > 0 ? (mapData.sessions / mapData.totalStamina).toFixed(3) : 'N/A';
            const mapWinRate = (mapData.wins + mapData.losses) > 0 ? Math.round((mapData.wins / (mapData.wins + mapData.losses)) * 100) : 0;
            
            summary += `\n${mapName}:\n`;
            summary += `  Sessions: ${mapData.sessions} | W/L: ${mapData.wins}/${mapData.losses} (${mapWinRate}%) | Time: ${formatTime(mapData.endTime - mapData.startTime)}${mapData.hasTimestamps ? '' : ' (estimated)'}\n`;
            summary += `  Gold: ${mapData.totalGold} | Dust: ${mapData.totalDust} | Stamina: ${mapData.totalStamina}\n`;
            summary += `  Equipment: ${mapData.totalEquipment} | Creatures: ${mapData.totalCreatures} | Shiny: ${mapData.totalShiny}\n`;
            summary += `  Rates: ${mapSessionRate} sessions/h | ${mapGoldRate} gold/h | ${mapCreatureRate} creatures/h | ${mapEquipmentRate} equipment/h\n`;
            summary += `  Efficiency: ${mapGoldPerStamina} gold/stamina | ${mapSessionsPerStamina} sessions/stamina | ${mapStaminaRate} stamina/h\n`;
            
            // Show top loot items for this map (limit to 8 most common)
            const sortedLoot = Array.from(mapData.loot.values()).sort((a, b) => b.count - a.count);
            const topLoot = sortedLoot.slice(0, 8);
            
            if (topLoot.length > 0) {
                summary += `  Top Loot:\n`;
                topLoot.forEach(item => {
                    let itemLine = `    ${item.originalName}: x${item.count}`;
                    if (item.rarity > 0) {
                        const rarityText = item._descriptiveRarity || 
                                          window.inventoryDatabase?.rarityText?.[item.rarity] || 
                                          `Rarity ${item.rarity}`;
                        itemLine += ` (${rarityText})`;
                    }
                    if (item.isEquipment && item.stat) {
                        itemLine += ` (Stat: ${item.stat.toUpperCase()})`;
                    }
                    summary += `${itemLine}\n`;
                });
            }
            
            // Show creatures for this map (limit to 8 most common)
            const sortedCreatures = Array.from(mapData.creatures.values()).sort((a, b) => b.count - a.count);
            const topCreatures = sortedCreatures.slice(0, 8);
            
            if (topCreatures.length > 0) {
                summary += `  Creatures:\n`;
                topCreatures.forEach(creature => {
                    let creatureLine = `    ${creature.originalName} (${creature.tierName}): x${creature.count}`;
                    if (creature.isShiny) {
                        creatureLine = `    ✨ ${creatureLine}`;
                    }
                    summary += `${creatureLine}\n`;
                });
            }
        });
    }
    summary += `---------------------------\n`;

    return summary;
}

// =======================
// 4.1. Unified Grid Functions
// =======================
// Helper function to create a unified grid container for both loot and creature displays
// Returns a styled grid container element
function createUnifiedGridContainer() {
    const gridContainer = document.createElement('div');
    gridContainer.style.display = 'grid';
    gridContainer.style.gridTemplateColumns = 'repeat(5, 1fr)';
    gridContainer.style.gap = '8px';
    gridContainer.style.padding = '4px';
    return gridContainer;
}

// =======================
// 5.0. Event Handler Functions
// =======================

// Handles the style button click for layout switching
function handleStyleButtonClick(panel, styleButton, minimizeBtn) {
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
        minimizeBtn.textContent = '–';
        minimizeBtn.title = 'Minimize Analyzer';
    }
    // Save panel settings after layout change
    savePanelSettings(panel);
}

// Handles the minimize button click
function handleMinimizeButtonClick(panel, styleButton, minimizeBtn) {
    if (panelState.mode !== LAYOUT_MODES.MINIMIZED) {
        panelState._lastMode = panelState.mode;
        panelState.mode = LAYOUT_MODES.MINIMIZED;
        minimizeBtn.textContent = '+';
        minimizeBtn.title = 'Restore Analyzer';
    } else {
        panelState.mode = panelState._lastMode || LAYOUT_MODES.VERTICAL;
        minimizeBtn.textContent = '–';
        minimizeBtn.title = 'Minimize Analyzer';
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
    // Save panel settings after minimize/restore
    savePanelSettings(panel);
}

// Handles the close button click
function handleCloseButtonClick(panel) {
    // Save panel settings before closing
    savePanelSettings(panel);
    
    // Remove document event listeners to prevent memory leaks
    if (panelResizeMouseMoveHandler) {
        document.removeEventListener('mousemove', panelResizeMouseMoveHandler);
        panelResizeMouseMoveHandler = null;
    }
    if (panelResizeMouseUpHandler) {
        document.removeEventListener('mouseup', panelResizeMouseUpHandler);
        panelResizeMouseUpHandler = null;
    }
    if (panelDragMouseMoveHandler) {
        document.removeEventListener('mousemove', panelDragMouseMoveHandler);
        panelDragMouseMoveHandler = null;
    }
    if (panelDragMouseUpHandler) {
        document.removeEventListener('mouseup', panelDragMouseUpHandler);
        panelDragMouseUpHandler = null;
    }
    
    // Clear cached DOM references
    domCache.clear();
    // Stop the live update interval
    // Remove resize listener
    window.removeEventListener('resize', updatePanelPosition);
    // Remove the panel
    panel.remove();
}

// Handles panel resize mouse move
function handlePanelResizeMouseMove(e, panel) {
    if (!panelState.isResizing || panelState.mode === LAYOUT_MODES.MINIMIZED) return;
    let dx = e.clientX - panelState.resizeStartX;
    let dy = e.clientY - panelState.resizeStartY;
    let newWidth = panelState.startWidth;
    let newHeight = panelState.startHeight;
    let newLeft = panelState.startLeft;
    let newTop = panelState.startTop;
    const layout = LAYOUT_DIMENSIONS[panelState.mode];
    
    // Allow resizing in both directions for vertical/horizontal
    if (panelState.resizeDir.includes('e')) {
        newWidth = clamp(panelState.startWidth + dx, layout.minWidth, layout.maxWidth);
    }
    if (panelState.resizeDir.includes('w')) {
        newWidth = clamp(panelState.startWidth - dx, layout.minWidth, layout.maxWidth);
        newLeft = panelState.startLeft + dx;
    }
    if (panelState.resizeDir.includes('s')) {
        newHeight = clamp(panelState.startHeight + dy, layout.minHeight, layout.maxHeight);
    }
    if (panelState.resizeDir.includes('n')) {
        newHeight = clamp(panelState.startHeight - dy, layout.minHeight, layout.maxHeight);
        newTop = panelState.startTop + dy;
    }
    panel.style.width = newWidth + 'px';
    panel.style.height = newHeight + 'px';
    panel.style.left = newLeft + 'px';
    panel.style.top = newTop + 'px';
    panel.style.transition = 'none';
}

// Handles panel resize mouse up
function handlePanelResizeMouseUp(panel) {
    if (panelState.isResizing) {
        panelState.isResizing = false;
        document.body.style.userSelect = '';
        panel.style.transition = '';
        // Save panel settings after resize
        savePanelSettings(panel);
    }
}

// Handles panel drag mouse move
function handlePanelDragMouseMove(e, panel) {
    if (!panelState.isDragging) return;
    let newLeft = e.clientX - panelState.dragOffsetX;
    let newTop = e.clientY - panelState.dragOffsetY;
    
    // Clamp to viewport
    newLeft = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, newLeft));
    newTop = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, newTop));
    panel.style.left = newLeft + 'px';
    panel.style.top = newTop + 'px';
    panel.style.transition = 'none';
}

// Handles panel drag mouse up
function handlePanelDragMouseUp(panel) {
    if (panelState.isDragging) {
        panelState.isDragging = false;
        document.body.style.userSelect = '';
        panel.style.transition = '';
        // Save panel settings after drag
        savePanelSettings(panel);
    }
}

// =======================
// 5.1. Utility Functions for Repeated Patterns
// =======================

// Creates a display element with icon and amount
function createResourceDisplay(iconSrc, iconAlt, amountId, colorKey = 'text') {
    const displayDiv = document.createElement('div');
    displayDiv.style.display = 'flex';
    displayDiv.style.alignItems = 'center';
    displayDiv.style.gap = '4px';

    const icon = document.createElement('img');
    icon.style.width = '12px';
    icon.style.height = '12px';
    icon.style.imageRendering = 'pixelated';
    icon.src = iconSrc;
    icon.alt = iconAlt;

    const amountSpan = document.createElement('span');
    amountSpan.id = amountId;
    amountSpan.style.color = getThemeColor(colorKey);
    amountSpan.style.fontSize = '12px';
    amountSpan.style.fontWeight = 'bold';
    amountSpan.textContent = '0';

    displayDiv.appendChild(amountSpan);
    displayDiv.appendChild(icon);

    return { displayDiv, amountSpan };
}

// Creates a rate display element
function createRateDisplay(rateId, labelKey, initialValue = 0) {
    const rateElement = document.createElement("span");
    rateElement.id = rateId;
    rateElement.textContent = `${t(labelKey)}: ${initialValue}`;
    rateElement.className = "ha-stats-text";
    return rateElement;
}

// Creates a flex row container
function createFlexRow(gap = '4px', justifyContent = 'space-between', alignItems = 'center') {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = gap;
    row.style.justifyContent = justifyContent;
    row.style.alignItems = alignItems;
    return row;
}

// Creates a flex column container
function createFlexColumn(gap = '2px') {
    const column = document.createElement("div");
    column.style.display = "flex";
    column.style.flexDirection = "column";
    column.style.gap = gap;
    return column;
}

// Creates a section title
function createSectionTitle(titleId, titleText) {
    const titleContainer = document.createElement("div");
    titleContainer.className = "ha-section-title";

    const title = document.createElement("h3");
    title.id = titleId;
    title.textContent = titleText;
    titleContainer.appendChild(title);

    return { titleContainer, title };
}

// Creates a display content area
function createDisplayContent(contentId, maxHeight = '200px') {
    const contentDiv = document.createElement("div");
    contentDiv.id = contentId;
    contentDiv.className = "ha-display-content";
    contentDiv.style.maxHeight = maxHeight;
    // Ensure theme colors are applied
    contentDiv.style.border = `1px solid ${getThemeColor('border')}`;
    contentDiv.style.backgroundColor = getThemeColor('sectionBackground');
    contentDiv.style.color = getThemeColor('text');
    return contentDiv;
}

// Creates a confirmation dialog
function createConfirmationDialog(titleKey, messageKey, onConfirm, onCancel) {
    const confirmDialog = document.createElement('div');
    confirmDialog.style.position = 'fixed';
    confirmDialog.style.top = '50%';
    confirmDialog.style.left = '50%';
    confirmDialog.style.transform = 'translate(-50%, -50%)';
    confirmDialog.style.backgroundColor = getThemeColor('dialogBackground');
    confirmDialog.style.border = `2px solid ${getThemeColor('dialogBorder')}`;
    confirmDialog.style.borderRadius = '8px';
    confirmDialog.style.padding = '20px';
    confirmDialog.style.zIndex = '10000';
    confirmDialog.style.color = getThemeColor('dialogText');
    confirmDialog.style.fontFamily = 'Inter, sans-serif';
    confirmDialog.style.boxShadow = `0 0 20px ${getThemeColor('dialogShadow')}`;

    const dialogTitle = document.createElement('h3');
    dialogTitle.textContent = t(titleKey);
    dialogTitle.style.margin = '0 0 15px 0';
    dialogTitle.style.color = getThemeColor('dialogTitle');
    dialogTitle.style.fontSize = '16px';

    const dialogMessage = document.createElement('p');
    dialogMessage.textContent = t(messageKey);
    dialogMessage.style.margin = '0 0 20px 0';
    dialogMessage.style.fontSize = '14px';
    dialogMessage.style.lineHeight = '1.4';

    const dialogButtonContainer = document.createElement('div');
    dialogButtonContainer.style.display = 'flex';
    dialogButtonContainer.style.gap = '10px';
    dialogButtonContainer.style.justifyContent = 'center';

    const confirmBtn = createStyledButton(t('mods.huntAnalyzer.confirm'));
    confirmBtn.addEventListener('click', () => {
        onConfirm();
        document.body.removeChild(confirmDialog);
    });

    const cancelBtn = createStyledButton("Cancel");
    cancelBtn.addEventListener('click', () => {
        if (onCancel) onCancel();
        document.body.removeChild(confirmDialog);
    });

    dialogButtonContainer.appendChild(confirmBtn);
    dialogButtonContainer.appendChild(cancelBtn);

    confirmDialog.appendChild(dialogTitle);
    confirmDialog.appendChild(dialogMessage);
    confirmDialog.appendChild(dialogButtonContainer);
    
    return confirmDialog;
}

// Resets all Hunt Analyzer state data
function resetHuntAnalyzerState() {
    HuntAnalyzerState.ui.autoplayLogText = ""; // Reset the log text
    HuntAnalyzerState.ui.lastSeed = null;
    HuntAnalyzerState.ui.selectedMapFilter = "ALL";
    HuntAnalyzerState.session.count = 0;
    HuntAnalyzerState.totals.gold = 0;
    HuntAnalyzerState.totals.creatures = 0;
    HuntAnalyzerState.totals.equipment = 0;
    HuntAnalyzerState.totals.runes = 0;
    HuntAnalyzerState.totals.dust = 0;
    HuntAnalyzerState.totals.shiny = 0;
    HuntAnalyzerState.totals.staminaSpent = 0;
    HuntAnalyzerState.totals.staminaRecovered = 0;
    HuntAnalyzerState.totals.wins = 0;
    HuntAnalyzerState.totals.losses = 0;
    HuntAnalyzerState.session.startTime = Date.now();
    HuntAnalyzerState.session.sessionStartTime = 0;
    HuntAnalyzerState.session.isActive = false;
    HuntAnalyzerState.data.sessions = [];
    HuntAnalyzerState.data.aggregatedLoot.clear();
    HuntAnalyzerState.data.aggregatedCreatures.clear();
    
    // Reset time tracking data
    if (HuntAnalyzerState.timeTracking.clockIntervalId) {
        clearInterval(HuntAnalyzerState.timeTracking.clockIntervalId);
    }
    HuntAnalyzerState.timeTracking.currentMap = null;
    HuntAnalyzerState.timeTracking.mapStartTime = 0;
    HuntAnalyzerState.timeTracking.accumulatedTimeMs = 0;
    HuntAnalyzerState.timeTracking.mapTimeMs.clear();
    HuntAnalyzerState.timeTracking.lastAutoplayTime = 0;
    HuntAnalyzerState.timeTracking.clockIntervalId = null;
    HuntAnalyzerState.timeTracking.manualActive = false;
    HuntAnalyzerState.timeTracking.manualSessionStartMs = 0;
    HuntAnalyzerState.timeTracking.autoplayBaselineMinutes = 0;
    
    // Clear localStorage so "Clear All" permanently removes data
    // This ensures data doesn't reappear after refresh, regardless of persistence setting
    try {
        localStorage.removeItem(HUNT_ANALYZER_STORAGE_KEY);
    } catch (error) {
        console.error('[Hunt Analyzer] Error clearing localStorage:', error);
    }
    
    // Immediately update playtime display to show 0
    const playtimeElement = document.getElementById('mod-playtime-display');
    if (playtimeElement) {
        playtimeElement.textContent = "Playtime: 00:00:00";
    }
}

// Updates room display with current room information
function updateCurrentRoomDisplay() {
    const roomNamesMap = globalThis.state?.utils?.ROOM_NAME;
    let roomDisplayName = t('mods.huntAnalyzer.currentRoom');
    let currentRoomId = null;
    
    if (roomNamesMap) {
        currentRoomId = globalThis.state.board?.area?.id || globalThis.state.player?.currentRoomId;
        if (currentRoomId && roomNamesMap[currentRoomId]) {
            roomDisplayName = roomNamesMap[currentRoomId];
        } else if (currentRoomId) {
            roomDisplayName = `Room ID: ${currentRoomId}`;
        }
    }
    
    // If map actually changed, record accumulated time for previous map and start new
    if (roomDisplayName && HuntAnalyzerState.timeTracking.currentMap && HuntAnalyzerState.timeTracking.currentMap !== roomDisplayName) {
        trackMapChange(roomDisplayName);
    }
    
    if (currentRoomId) {
        updateRoomTitleDisplay(currentRoomId, roomDisplayName);
    }
}

// =======================
// 5.2. Panel Section Creation Functions
// =======================

// Creates the live display section with session stats and rates
function createLiveDisplaySection() {
    const liveDisplaySection = document.createElement("div");
    liveDisplaySection.className = "live-display-section";
    liveDisplaySection.style.display = "flex";
    liveDisplaySection.style.flexDirection = "column";
    liveDisplaySection.style.padding = "8px";
    liveDisplaySection.style.backgroundImage = getThemeBackground('section');
    liveDisplaySection.style.backgroundRepeat = 'repeat';
    liveDisplaySection.style.backgroundColor = getThemeColor('sectionBackgroundFallback'); // Fallback
    liveDisplaySection.style.flex = "0 0 auto"; // FIXED SIZE
    liveDisplaySection.style.width = "100%";
    liveDisplaySection.style.boxSizing = "border-box";

    // Session Stats
    const sessionStatsDiv = document.createElement("div");
    sessionStatsDiv.style.display = "flex";
    sessionStatsDiv.style.flexDirection = "column";
    sessionStatsDiv.style.gap = "2px";
    sessionStatsDiv.style.marginBottom = "4px";

    const firstRow = document.createElement("div");
    firstRow.style.display = "flex";
    firstRow.style.justifyContent = "space-between";
    firstRow.style.alignItems = "center";

    const autoplayCounter = document.createElement("div");
    autoplayCounter.id = "mod-autoplay-counter";
    autoplayCounter.style.display = "flex";
    autoplayCounter.style.alignItems = "center";
    autoplayCounter.style.gap = "4px";
    autoplayCounter.style.fontSize = "12px";
    autoplayCounter.style.color = getThemeColor('textInfo');
    
    const sessionCountSpan = document.createElement("span");
    sessionCountSpan.textContent = `${t('mods.huntAnalyzer.sessions')}: 0 (0/h)`;
    sessionCountSpan.id = "mod-session-count";
    
    autoplayCounter.appendChild(sessionCountSpan);

    const playtimeElement = document.createElement("span");
    playtimeElement.id = "mod-playtime-display";
    playtimeElement.textContent = "Playtime: 0m";
    playtimeElement.style.fontSize = "10px";
    playtimeElement.style.color = getThemeColor('textInfo');
    
    firstRow.appendChild(autoplayCounter);
    firstRow.appendChild(playtimeElement);
    
    // Second row for Stamina and W/L
    const secondRow = document.createElement("div");
    secondRow.style.display = "flex";
    secondRow.style.justifyContent = "space-between";
    secondRow.style.alignItems = "center";
    
    // Stamina Display
    const staminaDisplaySpan = document.createElement("span");
    staminaDisplaySpan.id = "mod-stamina-display";
    staminaDisplaySpan.style.display = "none";
    staminaDisplaySpan.style.whiteSpace = "nowrap";
    staminaDisplaySpan.style.lineHeight = "12px";
    staminaDisplaySpan.style.verticalAlign = "middle";
    staminaDisplaySpan.style.fontSize = "10px";
    staminaDisplaySpan.style.color = getThemeColor('textInfo');

    // Win/Loss Display
    const winLossElement = document.createElement("span");
    winLossElement.id = "mod-win-loss-display";
    winLossElement.style.fontSize = "10px";
    winLossElement.style.color = getThemeColor('textInfo');
    winLossElement.textContent = "W/L: 0/0 (0%)";
    
    secondRow.appendChild(staminaDisplaySpan);
    secondRow.appendChild(winLossElement);
    
    sessionStatsDiv.appendChild(firstRow);
    sessionStatsDiv.appendChild(secondRow);
    liveDisplaySection.appendChild(sessionStatsDiv);

    return { liveDisplaySection, autoplayCounter, sessionCountSpan, autoplayRateElement, staminaDisplaySpan, winLossElement };
}

// Creates the drop rate live feed section
function createDropRateSection() {
    const dropRateLiveFeedDiv = document.createElement("div");
    dropRateLiveFeedDiv.className = "ha-border-separator";
    dropRateLiveFeedDiv.style.fontSize = "10px";
    dropRateLiveFeedDiv.style.color = getThemeColor('textStats');

    // Left section for rates
    const leftRatesSection = createFlexColumn();

    const goldRateElement = createRateDisplay("mod-gold-rate", 'mods.huntAnalyzer.goldPerHour');
    leftRatesSection.appendChild(goldRateElement);

    const creatureRateElement = createRateDisplay("mod-creature-rate", 'mods.huntAnalyzer.creaturesPerHour');
    leftRatesSection.appendChild(creatureRateElement);

    const equipmentRateElement = createRateDisplay("mod-equipment-rate", 'mods.huntAnalyzer.equipmentPerHour');
    leftRatesSection.appendChild(equipmentRateElement);

    const runeRateElement = createRateDisplay("mod-rune-rate", 'mods.huntAnalyzer.runesPerHour');
    leftRatesSection.appendChild(runeRateElement);

    const totalStaminaSpentElement = document.createElement('span');
    totalStaminaSpentElement.id = 'mod-total-stamina-spent';
    totalStaminaSpentElement.className = "ha-stats-text";
    // Calculate initial stamina efficiency with natural regen
    const initialElapsedTimeMs = Date.now() - HuntAnalyzerState.session.startTime;
    const initialElapsedTimeMinutes = initialElapsedTimeMs / (1000 * 60);
    const initialElapsedTimeHours = initialElapsedTimeMs / (1000 * 60 * 60);
    const initialNaturalStaminaRegen = Math.floor(initialElapsedTimeMinutes);
    const initialTotalStaminaRecovered = HuntAnalyzerState.totals.staminaRecovered + initialNaturalStaminaRegen;
    const initialNetStaminaChange = initialTotalStaminaRecovered - HuntAnalyzerState.totals.staminaSpent;
    const initialNetStaminaPerHour = Math.floor(initialNetStaminaChange / initialElapsedTimeHours);
    const initialRecoveryEfficiency = HuntAnalyzerState.totals.staminaSpent > 0 ? 
        Math.round((initialTotalStaminaRecovered / HuntAnalyzerState.totals.staminaSpent) * 100) : 0;
    const initialStaminaSpentRatePerHour = initialElapsedTimeHours > 0 ? 
        Math.floor(HuntAnalyzerState.totals.staminaSpent / initialElapsedTimeHours) : 0;
    totalStaminaSpentElement.textContent = `Stamina/h: ${initialStaminaSpentRatePerHour} (Net: ${initialNetStaminaPerHour > 0 ? '+' : ''}${initialNetStaminaPerHour}/h) [${initialRecoveryEfficiency}% recovery]`;
    leftRatesSection.appendChild(totalStaminaSpentElement);

    // Right section for totals
    const rightTotalsSection = createFlexColumn();
    rightTotalsSection.style.alignItems = 'flex-end';

    // Create resource displays using utility function
    const { displayDiv: goldDisplayDiv, amountSpan: goldAmountSpan } = createResourceDisplay('/assets/icons/goldpile.png', 'Gold', 'mod-total-gold-display', 'textGold');
    rightTotalsSection.appendChild(goldDisplayDiv);

    const { displayDiv: dustDisplayDiv, amountSpan: dustAmountSpan } = createResourceDisplay('/assets/icons/dust.png', 'Dust', 'mod-total-dust-display', 'textDust');
    rightTotalsSection.appendChild(dustDisplayDiv);

    const { displayDiv: shinyDisplayDiv, amountSpan: shinyAmountSpan } = createResourceDisplay('/assets/icons/shiny.png', 'Shiny', 'mod-total-shiny-display', 'textShiny');
    rightTotalsSection.appendChild(shinyDisplayDiv);

    const { displayDiv: runesDisplayDiv, amountSpan: runesAmountSpan } = createResourceDisplay('/assets/icons/rune.png', 'Runes', 'mod-total-runes-display', 'textRunes');
    rightTotalsSection.appendChild(runesDisplayDiv);

    dropRateLiveFeedDiv.appendChild(leftRatesSection);
    dropRateLiveFeedDiv.appendChild(rightTotalsSection);

    return { 
        dropRateLiveFeedDiv, 
        goldRateElement, 
        creatureRateElement, 
        equipmentRateElement, 
        runeRateElement, 
        totalStaminaSpentElement,
        goldAmountSpan,
        dustAmountSpan,
        shinyAmountSpan,
        runesAmountSpan
    };
}

// Creates the button container section
function createButtonContainer() {
    const buttonContainer = createFlexRow('5px', 'center');
    buttonContainer.style.padding = "8px";
    buttonContainer.style.flex = "0 0 auto";

    // Clear Data Button
    const clearDataBtn = createStyledButton(t('mods.huntAnalyzer.clearData'));
    clearDataBtn.addEventListener('click', () => {
        const confirmDialog = createConfirmationDialog(
            'mods.huntAnalyzer.confirmClear',
            'mods.huntAnalyzer.clearWarning',
            () => {
                resetHuntAnalyzerState();
                // Clear the visual display divs and update counter
                const cachedLootDiv = domCache.get("mod-loot-display");
                const cachedCreatureDropDiv = domCache.get("mod-creature-drop-display");
                if (cachedLootDiv) cachedLootDiv.innerHTML = "";
                if (cachedCreatureDropDiv) cachedCreatureDropDiv.innerHTML = "";
                // Call renderAllSessions to refresh the display (which will now be empty)
                renderAllSessions(); // Re-render to show cleared state
                updateMapFilterDropdown(); // Update filter dropdown to show only ALL
                updatePanelDisplay(); // Update overall rates to reflect cleared state
                updateCurrentRoomDisplay(); // Reset the room ID display to current room name
                updatePanelPosition(); // Re-align after clear
            }
        );
        document.body.appendChild(confirmDialog);
    });

    buttonContainer.appendChild(clearDataBtn);

    return buttonContainer;
}

// Creates the map filter container section
function createMapFilterContainer() {
    const mapFilterContainer = document.createElement("div");
    mapFilterContainer.className = "ha-container-section";
    mapFilterContainer.style.flex = "0 0 auto";

    const { titleContainer: mapFilterTitleContainer, title: mapFilterTitle } = createSectionTitle("mod-map-filter-title", t('mods.huntAnalyzer.mapFilter'));

    const mapFilterDropdown = document.createElement("select");
    mapFilterDropdown.id = "mod-map-filter-dropdown";
    mapFilterDropdown.style.width = "100%";
    mapFilterDropdown.style.padding = "4px";
    mapFilterDropdown.style.border = "1px solid #3A404A";
    mapFilterDropdown.style.borderRadius = "4px";
    mapFilterDropdown.style.backgroundColor = "#282C34";
    mapFilterDropdown.style.color = "#ABB2BF";
    mapFilterDropdown.style.fontSize = "12px";

    mapFilterContainer.appendChild(mapFilterTitleContainer);
    mapFilterContainer.appendChild(mapFilterDropdown);

    return { mapFilterContainer, mapFilterDropdown };
}

// Creates the loot container section
function createLootContainer() {
    const lootContainer = document.createElement("div");
    lootContainer.className = "ha-container-section";

    const { titleContainer: lootTitleContainer, title: lootTitle } = createSectionTitle("mod-loot-title", t('mods.huntAnalyzer.loot'));

    const lootDisplayDiv = createDisplayContent("mod-loot-display");

    lootContainer.appendChild(lootTitleContainer);
    lootContainer.appendChild(lootDisplayDiv);

    return { lootContainer, lootDisplayDiv };
}

// Creates the creature drop container section
function createCreatureDropContainer() {
    const creatureDropContainer = document.createElement("div");
    creatureDropContainer.className = "ha-container-section";

    const { titleContainer: creatureDropTitleContainer, title: creatureDropTitle } = createSectionTitle("mod-creature-drops-title", t('mods.huntAnalyzer.creatureDrops'));

    const creatureDropDisplayDiv = createDisplayContent("mod-creature-drop-display");

    creatureDropContainer.appendChild(creatureDropTitleContainer);
    creatureDropContainer.appendChild(creatureDropDisplayDiv);

    return { creatureDropContainer, creatureDropDisplayDiv };
}
// Helper function to create a consistently styled button.
// text - The text content of the button.
// Returns the styled button element.
function createStyledButton(text) {
    const button = document.createElement("button");
    button.textContent = text;
    button.className = "ha-styled-button";

    return button;
}

// Helper function to create a consistently styled icon button for header.
// iconText - The text/emoji for the icon (e.g., '—', '✕').
// Returns the styled button element.
function createStyledIconButton(iconText) {
    const button = document.createElement("button");
    button.textContent = iconText;
    button.className = "ha-icon-button";

    return button;
}

// Creates the main panel container with basic styling and layout.
function createPanelContainer() {
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "ha-panel-container";
    
    // Load saved panel settings
    const savedSettings = loadPanelSettings();
    
    // Apply initial layout constraints
    const initialLayout = LAYOUT_DIMENSIONS[LAYOUT_MODES.VERTICAL];
    
    // Apply saved settings or defaults
    if (savedSettings) {
        applyPanelSettings(panel, savedSettings);
    } else {
        // Apply default positioning and sizing if no saved settings
        panel.style.top = "50px";
        panel.style.left = "10px";
        panel.style.width = initialLayout.width + 'px';
        panel.style.height = initialLayout.height + 'px';
    }
    
    // Always apply layout constraints
    panel.style.minWidth = initialLayout.minWidth + 'px';
    panel.style.maxWidth = initialLayout.maxWidth + 'px';
    panel.style.minHeight = initialLayout.minHeight + 'px';
    panel.style.maxHeight = initialLayout.maxHeight + 'px';

    // Try to regenerate visuals immediately, and set up periodic checks
    regenerateAllVisuals();
    
    // Set up one-time visual regeneration check after a short delay
    // This replaces the polling mechanism with a more efficient approach
    setTimeout(() => {
        if (globalThis.state?.utils) {
            regenerateAllVisuals();
        }
    }, 1000); // Single check after 1 second

    // Render the initial display with any persisted data
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
        renderAllSessions();
    }, 100);

    return panel;
}

// Creates the top header section with title and controls.
function createHeaderSection() {
    const topHeaderContainer = document.createElement("div");
    topHeaderContainer.className = "ha-header-container";

    // Title and Controls Row
    const titleAndControlsRow = document.createElement("div");
    titleAndControlsRow.className = "ha-title-row";

    // Room ID Display
    const roomIdDisplay = document.createElement("h3");
    roomIdDisplay.id = "mod-room-id-display";
    roomIdDisplay.className = "ha-room-title";
    roomIdDisplay.textContent = t('mods.huntAnalyzer.currentRoom');

    // Header Controls
    const headerControls = document.createElement("div");
    headerControls.className = "ha-header-controls";

    // Style Button (Vertical/Horizontal)
    const styleButton = createStyledIconButton('Horizontal'); // Default to horizontal icon
    styleButton.id = "mod-style-button";
    styleButton.title = "Switch to horizontal layout";
    styleButton.setAttribute('aria-label', 'Switch layout style');
    styleButton.tabIndex = 0;

    // Minimize Button
    const minimizeBtn = createStyledIconButton('–');
    minimizeBtn.id = "mod-minimize-button";
    minimizeBtn.title = "Minimize Analyzer";
    minimizeBtn.setAttribute('aria-label', 'Minimize Analyzer');
    minimizeBtn.tabIndex = 0;

    // Close Button
    const closeBtn = createStyledIconButton("✕");
    closeBtn.title = "Close Analyzer";

    // Add buttons in order: style, minimize, close
    headerControls.appendChild(styleButton);
    headerControls.appendChild(minimizeBtn);
    headerControls.appendChild(closeBtn);
    titleAndControlsRow.appendChild(roomIdDisplay);
    titleAndControlsRow.appendChild(headerControls);
    topHeaderContainer.appendChild(titleAndControlsRow);

    return { topHeaderContainer, titleAndControlsRow, headerControls, roomIdDisplay, styleButton, minimizeBtn, closeBtn };
}

// Creates and appends the Hunt Analyzer Mod panel to the document body.
// Prevents creation of duplicate panels.
// Styles are applied inline to match a professional game theme.
function createAutoplayAnalyzerPanel() {
    // Check if the panel already exists to prevent duplicates.
    if (document.getElementById(PANEL_ID)) {
        console.log('[Hunt Analyzer] Panel already exists, skipping creation');
        return;
    }
    
    console.log('[Hunt Analyzer] Creating new analyzer panel...');

    // Only reset data if we don't have persisted data
    if (HuntAnalyzerState.data.sessions.length === 0) {
        // Reset tracking variables for a fresh panel session
        HuntAnalyzerState.session.count = 0;
        HuntAnalyzerState.totals.gold = 0;
        HuntAnalyzerState.totals.creatures = 0;
        HuntAnalyzerState.totals.equipment = 0;
        HuntAnalyzerState.totals.runes = 0;
        HuntAnalyzerState.totals.dust = 0;
        HuntAnalyzerState.totals.shiny = 0;
        HuntAnalyzerState.totals.staminaSpent = 0;
        HuntAnalyzerState.totals.staminaRecovered = 0;
        HuntAnalyzerState.totals.wins = 0;
        HuntAnalyzerState.totals.losses = 0;
        HuntAnalyzerState.session.startTime = Date.now();
        HuntAnalyzerState.session.isActive = false;
        HuntAnalyzerState.session.sessionStartTime = 0;
        HuntAnalyzerState.data.sessions = [];
        HuntAnalyzerState.data.aggregatedLoot.clear();
        HuntAnalyzerState.data.aggregatedCreatures.clear();
    } else {
        // Re-aggregate data from persisted sessions
        dataProcessor.aggregateData();
    }
    
    // Consolidated panel initialization log
    console.log('[Hunt Analyzer] Panel initialized:', {
        hasPersistedData: HuntAnalyzerState.data.sessions.length > 0,
        sessionCount: HuntAnalyzerState.data.sessions.length,
        isOpen: true
    });
    
    // Set UI state to open
    HuntAnalyzerState.ui.isOpen = true;
    HuntAnalyzerState.ui.closedManually = false;
    
    // Save UI state
    if (HuntAnalyzerState.settings.persistData) {
        saveHuntAnalyzerState();
    }
    // Create main panel container (this loads and applies saved settings)
    const panel = createPanelContainer();
    
    // Sync currentLayoutMode with panelState.mode after settings are loaded
    let currentLayoutMode = (panelState && panelState.mode) || LAYOUT_MODES.VERTICAL;
    
    // Create header section
    const { topHeaderContainer, titleAndControlsRow, headerControls, roomIdDisplay, styleButton, minimizeBtn, closeBtn } = createHeaderSection();
    styleButton.addEventListener("click", () => handleStyleButtonClick(panel, styleButton, minimizeBtn));

    // Set up minimize button event handler
    minimizeBtn.addEventListener("click", () => handleMinimizeButtonClick(panel, styleButton, minimizeBtn));

    // Set up close button event handler
    closeBtn.addEventListener("click", () => handleCloseButtonClick(panel));

    // Add buttons in order: style, minimize, close
    headerControls.appendChild(styleButton);
    headerControls.appendChild(minimizeBtn);
    headerControls.appendChild(closeBtn);
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

    panelResizeMouseMoveHandler = function(e) {
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
    };
    document.addEventListener('mousemove', panelResizeMouseMoveHandler);

    panelResizeMouseUpHandler = function() {
        if (isResizing) {
            isResizing = false;
            document.body.style.userSelect = '';
            panel.style.transition = '';
            // Save panel settings after resize
            savePanelSettings(panel);
        }
    };
    document.addEventListener('mouseup', panelResizeMouseUpHandler);
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

    panelDragMouseMoveHandler = function(e) {
        if (!isDragging) return;
        let newLeft = e.clientX - dragOffsetX;
        let newTop = e.clientY - dragOffsetY;
        // Clamp to viewport
        newLeft = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, newLeft));
        newTop = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, newTop));
        panel.style.left = newLeft + 'px';
        panel.style.top = newTop + 'px';
        panel.style.transition = 'none';
    };
    document.addEventListener('mousemove', panelDragMouseMoveHandler);

    panelDragMouseUpHandler = function() {
        if (isDragging) {
            isDragging = false;
            document.body.style.userSelect = '';
            panel.style.transition = '';
            // Save panel settings after drag
            savePanelSettings(panel);
        }
    };
    document.addEventListener('mouseup', panelDragMouseUpHandler);
    // --- END DRAGGABLE PANEL LOGIC ---

    // 2. Live Display Section
    const liveDisplaySection = document.createElement("div");
    liveDisplaySection.className = "live-display-section";
    liveDisplaySection.style.display = "flex";
    liveDisplaySection.style.flexDirection = "column";
    liveDisplaySection.style.padding = "8px";
    liveDisplaySection.style.backgroundImage = getThemeBackground('section');
    liveDisplaySection.style.backgroundRepeat = 'repeat';
    liveDisplaySection.style.backgroundColor = getThemeColor('sectionBackgroundFallback');
    liveDisplaySection.style.flex = "0 0 auto"; // FIXED SIZE
    liveDisplaySection.style.width = "100%";
    liveDisplaySection.style.boxSizing = "border-box";

    // Session Stats
    const sessionStatsDiv = document.createElement("div");
    sessionStatsDiv.style.display = "flex";
    sessionStatsDiv.style.flexDirection = "column";
    sessionStatsDiv.style.gap = "2px";
    sessionStatsDiv.style.marginBottom = "4px";

    const firstRow = document.createElement("div");
    firstRow.style.display = "flex";
    firstRow.style.justifyContent = "space-between";
    firstRow.style.alignItems = "center";

    const autoplayCounter = document.createElement("div");
    autoplayCounter.id = "mod-autoplay-counter";
    autoplayCounter.style.display = "flex";
    autoplayCounter.style.alignItems = "center";
    autoplayCounter.style.gap = "4px";
    autoplayCounter.style.fontSize = "12px";
    autoplayCounter.style.color = getThemeColor('textInfo');
    
    const sessionCountSpan = document.createElement("span");
    sessionCountSpan.textContent = `${t('mods.huntAnalyzer.sessions')}: 0 (0/h)`;
    sessionCountSpan.id = "mod-session-count";
    
    autoplayCounter.appendChild(sessionCountSpan);

    const playtimeElement = document.createElement("span");
    playtimeElement.id = "mod-playtime-display";
    playtimeElement.textContent = "Playtime: 0m";
    playtimeElement.style.fontSize = "10px";
    playtimeElement.style.color = getThemeColor('textInfo');
    
    firstRow.appendChild(autoplayCounter);
    firstRow.appendChild(playtimeElement);
    
    // Second row for Stamina and W/L
    const secondRow = document.createElement("div");
    secondRow.style.display = "flex";
    secondRow.style.justifyContent = "space-between";
    secondRow.style.alignItems = "center";
    
    // Stamina Display
    const staminaDisplaySpan = document.createElement("span");
    staminaDisplaySpan.id = "mod-stamina-display";
    staminaDisplaySpan.style.display = "none";
    staminaDisplaySpan.style.whiteSpace = "nowrap";
    staminaDisplaySpan.style.lineHeight = "12px";
    staminaDisplaySpan.style.verticalAlign = "middle";
    staminaDisplaySpan.style.fontSize = "10px";
    staminaDisplaySpan.style.color = getThemeColor('textInfo');

    // Win/Loss Display
    const winLossElement = document.createElement("span");
    winLossElement.id = "mod-win-loss-display";
    winLossElement.style.fontSize = "10px";
    winLossElement.style.color = getThemeColor('textInfo');
    winLossElement.textContent = "W/L: 0/0 (0%)";
    
    secondRow.appendChild(staminaDisplaySpan);
    secondRow.appendChild(winLossElement);
    
    sessionStatsDiv.appendChild(firstRow);
    sessionStatsDiv.appendChild(secondRow);
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
    goldRateElement.textContent = `${t('mods.huntAnalyzer.goldPerHour')}: 0`;
    leftRatesSection.appendChild(goldRateElement);

    const creatureRateElement = document.createElement("span");
    creatureRateElement.id = "mod-creature-rate";
    creatureRateElement.textContent = `${t('mods.huntAnalyzer.creaturesPerHour')}: 0`;
    leftRatesSection.appendChild(creatureRateElement);

    const equipmentRateElement = document.createElement("span");
    equipmentRateElement.id = "mod-equipment-rate";
    equipmentRateElement.textContent = `${t('mods.huntAnalyzer.equipmentPerHour')}: 0`;
    leftRatesSection.appendChild(equipmentRateElement);

    const runeRateElement = document.createElement("span");
    runeRateElement.id = "mod-rune-rate";
    runeRateElement.textContent = `${t('mods.huntAnalyzer.runesPerHour')}: 0`;
    leftRatesSection.appendChild(runeRateElement);

    const totalStaminaSpentElement = document.createElement('span');
    totalStaminaSpentElement.id = 'mod-total-stamina-spent';
    // Calculate initial stamina efficiency - show zeros until first session completes
    const initialStaminaSpentRatePerHour = 0;
    const initialNetStaminaPerHour = 0;
    const initialRecoveryEfficiency = 0;
    totalStaminaSpentElement.textContent = `Stamina/h: ${initialStaminaSpentRatePerHour} (Net: ${initialNetStaminaPerHour > 0 ? '+' : ''}${initialNetStaminaPerHour}/h) [${initialRecoveryEfficiency}% recovery]`;
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
    goldIcon.style.width = '12px';
    goldIcon.style.height = '12px';
    goldIcon.style.imageRendering = 'pixelated';
    goldIcon.src = '/assets/icons/goldpile.png';
    goldIcon.alt = 'Gold';

    const goldAmountSpan = document.createElement('span');
    goldAmountSpan.id = 'mod-total-gold-display';
    goldAmountSpan.style.color = getThemeColor('textGold');
    goldAmountSpan.style.fontSize = '12px';
    goldAmountSpan.style.fontWeight = 'bold';
    goldAmountSpan.textContent = '0';

    goldDisplayDiv.appendChild(goldAmountSpan);
    goldDisplayDiv.appendChild(goldIcon);
    rightTotalsSection.appendChild(goldDisplayDiv);

    // Dust Display
    const dustDisplayDiv = document.createElement('div');
    dustDisplayDiv.style.display = 'flex';
    dustDisplayDiv.style.alignItems = 'center';
    dustDisplayDiv.style.gap = '4px';

    const dustIcon = document.createElement('img');
    dustIcon.style.width = '12px';
    dustIcon.style.height = '12px';
    dustIcon.style.imageRendering = 'pixelated';
    dustIcon.src = '/assets/icons/dust.png';
    dustIcon.alt = 'Dust';

    const dustAmountSpan = document.createElement('span');
    dustAmountSpan.id = 'mod-total-dust-display';
    dustAmountSpan.style.color = getThemeColor('textDust');
    dustAmountSpan.style.fontSize = '12px';
    dustAmountSpan.style.fontWeight = 'bold';
    dustAmountSpan.textContent = '0';

    dustDisplayDiv.appendChild(dustAmountSpan);
    dustDisplayDiv.appendChild(dustIcon);
    rightTotalsSection.appendChild(dustDisplayDiv);

    // Shiny Display
    const shinyDisplayDiv = document.createElement('div');
    shinyDisplayDiv.style.display = 'flex';
    shinyDisplayDiv.style.alignItems = 'center';
    shinyDisplayDiv.style.gap = '4px';

    const shinyIcon = document.createElement('img');
    shinyIcon.style.width = '12px';
    shinyIcon.style.height = '12px';
    shinyIcon.style.imageRendering = 'pixelated';
    shinyIcon.src = '/assets/icons/shiny-star.png';
    shinyIcon.alt = 'Shiny';

    const shinyAmountSpan = document.createElement('span');
    shinyAmountSpan.id = 'mod-total-shiny-display';
    shinyAmountSpan.style.color = getThemeColor('textShiny');
    shinyAmountSpan.style.fontSize = '12px';
    shinyAmountSpan.style.fontWeight = 'bold';
    shinyAmountSpan.textContent = '0';

    shinyDisplayDiv.appendChild(shinyAmountSpan);
    shinyDisplayDiv.appendChild(shinyIcon);
    rightTotalsSection.appendChild(shinyDisplayDiv);

    // Runes Display
    const runesDisplayDiv = document.createElement('div');
    runesDisplayDiv.style.display = 'flex';
    runesDisplayDiv.style.alignItems = 'center';
    runesDisplayDiv.style.gap = '4px';

    const runesIcon = document.createElement('img');
    runesIcon.style.width = '12px';
    runesIcon.style.height = '12px';
    runesIcon.style.imageRendering = 'pixelated';
    runesIcon.src = 'https://bestiaryarena.com/assets/icons/rune-blank.png';
    runesIcon.alt = 'Runes';

    const runesAmountSpan = document.createElement('span');
    runesAmountSpan.id = 'mod-total-runes-display';
    runesAmountSpan.style.color = getThemeColor('textRunes');
    runesAmountSpan.style.fontSize = '12px';
    runesAmountSpan.style.fontWeight = 'bold';
    runesAmountSpan.textContent = '0';

    runesDisplayDiv.appendChild(runesAmountSpan);
    runesDisplayDiv.appendChild(runesIcon);
    rightTotalsSection.appendChild(runesDisplayDiv);

    dropRateLiveFeedDiv.appendChild(leftRatesSection);
    dropRateLiveFeedDiv.appendChild(rightTotalsSection);
    liveDisplaySection.appendChild(dropRateLiveFeedDiv);

    // 3. Map Filter Section
    const mapFilterContainer = document.createElement("div");
    mapFilterContainer.className = "map-filter-container";
    mapFilterContainer.style.display = "flex";
    mapFilterContainer.style.flexDirection = "row";
    mapFilterContainer.style.flex = "0 0 auto";
    mapFilterContainer.style.margin = "5px";
    mapFilterContainer.style.backgroundImage = getThemeBackground('section');
    mapFilterContainer.style.backgroundRepeat = 'repeat';
    mapFilterContainer.style.backgroundColor = getThemeColor('sectionBackgroundFallback');
    mapFilterContainer.style.borderRadius = '6px';
    mapFilterContainer.style.padding = '6px';
    mapFilterContainer.style.alignItems = "center";
    mapFilterContainer.style.justifyContent = "center";
    mapFilterContainer.style.gap = "8px";

    const mapFilterTitle = document.createElement("h3");
    mapFilterTitle.textContent = "Map Filter";
    mapFilterTitle.style.margin = "0px";
    mapFilterTitle.style.fontSize = "14px";
    mapFilterTitle.style.color = getThemeColor('textAccent');
    mapFilterTitle.style.fontWeight = "bold";
    mapFilterTitle.style.textShadow = `${getThemeColor('textShadow')} 0px 0px 5px`;
    mapFilterTitle.style.flex = "0 0 auto";

    const mapFilterRow = document.createElement("div");
    mapFilterRow.id = "mod-map-filter-row";
    mapFilterRow.style.display = "flex";
    mapFilterRow.style.alignItems = "center";
    mapFilterRow.style.justifyContent = "center";
    mapFilterRow.style.flex = "0 0 auto";

    mapFilterContainer.appendChild(mapFilterTitle);
    mapFilterContainer.appendChild(mapFilterRow);

    // 4. Loot Section
    const lootContainer = document.createElement("div");
    lootContainer.className = "loot-container";
    lootContainer.style.display = "flex";
    lootContainer.style.flexDirection = "column";
    lootContainer.style.flex = "1 1 0"; // FLEXIBLE
    lootContainer.style.minHeight = "0";
    lootContainer.style.margin = "0px 5px 5px 5px";
    lootContainer.style.backgroundImage = getThemeBackground('section');
    lootContainer.style.backgroundRepeat = 'repeat';
    lootContainer.style.backgroundColor = getThemeColor('sectionBackgroundFallback');
    lootContainer.style.borderRadius = '6px';
    lootContainer.style.padding = '6px';
    lootContainer.style.overflowY = 'auto';

    const lootTitleContainer = document.createElement("div");
    lootTitleContainer.style.display = "flex";
    lootTitleContainer.style.alignItems = "center";
    lootTitleContainer.style.justifyContent = "center";
    lootTitleContainer.style.marginBottom = "3px";

    const lootTitle = document.createElement("h3");
    lootTitle.id = "mod-loot-title";
    lootTitle.style.margin = "0px";
    lootTitle.style.fontSize = "14px";
    lootTitle.style.color = getThemeColor('textAccent');
    lootTitle.style.fontWeight = "bold";
    lootTitle.style.textShadow = `${getThemeColor('textShadow')} 0px 0px 5px`;
    lootTitleContainer.appendChild(lootTitle);

    const lootDisplayDiv = document.createElement("div");
    lootDisplayDiv.id = "mod-loot-display";
    lootDisplayDiv.style.width = "100%";
    lootDisplayDiv.style.padding = "4px";
    lootDisplayDiv.style.border = `1px solid ${getThemeColor('border')}`;
    lootDisplayDiv.style.backgroundColor = getThemeColor('sectionBackground');
    lootDisplayDiv.style.color = getThemeColor('text');
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
    creatureDropContainer.style.margin = "0 5px 5px 5px";
    creatureDropContainer.style.backgroundImage = getThemeBackground('section');
    creatureDropContainer.style.backgroundRepeat = 'repeat';
    creatureDropContainer.style.backgroundColor = getThemeColor('sectionBackgroundFallback');
    creatureDropContainer.style.borderRadius = '6px';
    creatureDropContainer.style.padding = '6px';
    creatureDropContainer.style.overflowY = 'auto';

    const creatureDropTitleContainer = document.createElement("div");
    creatureDropTitleContainer.style.display = "flex";
    creatureDropTitleContainer.style.alignItems = "center";
    creatureDropTitleContainer.style.justifyContent = "center";
    creatureDropTitleContainer.style.marginBottom = "3px";

    const creatureDropTitle = document.createElement("h3");
    creatureDropTitle.id = "mod-creature-drops-title";
    creatureDropTitle.style.margin = "0px";
    creatureDropTitle.style.fontSize = "14px";
    creatureDropTitle.style.color = getThemeColor('textAccent');
    creatureDropTitle.style.fontWeight = "bold";
    creatureDropTitle.style.textShadow = `${getThemeColor('textShadow')} 0px 0px 5px`;
    creatureDropTitleContainer.appendChild(creatureDropTitle);

    const creatureDropDisplayDiv = document.createElement("div");
    creatureDropDisplayDiv.id = "mod-creature-drop-display";
    creatureDropDisplayDiv.style.width = "100%";
    creatureDropDisplayDiv.style.padding = "4px";
    creatureDropDisplayDiv.style.border = `1px solid ${getThemeColor('border')}`;
    creatureDropDisplayDiv.style.backgroundColor = getThemeColor('sectionBackground');
    creatureDropDisplayDiv.style.color = getThemeColor('text');
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
    buttonContainer.style.padding = "0px 8px 8px 8px";
    buttonContainer.style.margin = "0";
    buttonContainer.style.marginTop = "0";
    buttonContainer.style.borderTop = "none";
    buttonContainer.style.backgroundImage = getThemeBackground('section');
    buttonContainer.style.backgroundRepeat = 'repeat';
    buttonContainer.style.backgroundColor = getThemeColor('sectionBackgroundFallback');
    buttonContainer.style.flex = "0 0 auto"; // FIXED SIZE
    buttonContainer.style.flexDirection = 'row';

    // Settings button removed - now handled by Mod Settings

    const clearButton = createStyledButton(t('mods.huntAnalyzer.clearAll'));
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
            // Perform comprehensive clear all action using the reset function
            resetHuntAnalyzerState();
            
            // Clear the visual display divs and update counter
            const cachedLootDiv = domCache.get("mod-loot-display");
            const cachedCreatureDropDiv = domCache.get("mod-creature-drop-display");
            if (cachedLootDiv) cachedLootDiv.innerHTML = "";
            if (cachedCreatureDropDiv) cachedCreatureDropDiv.innerHTML = "";
            
            // Call renderAllSessions to refresh the display (which will now be empty)
            renderAllSessions(); // Re-render to show cleared state
            updateMapFilterDropdown(); // Update filter dropdown to show only ALL
            updatePanelDisplay(); // Update overall rates to reflect cleared state
            // Reset the room ID display to current room name
            const roomNamesMap = globalThis.state?.utils?.ROOM_NAME; // Changed to ROOM_NAME (singular)
            let roomDisplayName = t('mods.huntAnalyzer.currentRoom');
            let currentRoomId = null;
            if (roomNamesMap) {
                currentRoomId = globalThis.state.board?.area?.id || globalThis.state.player?.currentRoomId;
                if (currentRoomId && roomNamesMap[currentRoomId]) {
                    roomDisplayName = roomNamesMap[currentRoomId];
                } else if (currentRoomId) {
                    roomDisplayName = `Room ID: ${currentRoomId}`;
                }
            }
            if (currentRoomId) {
                updateRoomTitleDisplay(currentRoomId, roomDisplayName);
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

    const copyLogButton = createStyledButton(t('mods.huntAnalyzer.copyLog'));
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
        timeoutIds.push(setTimeout(() => {
            feedbackMessage.style.opacity = '1';
        }, 10));
        timeoutIds.push(setTimeout(() => {
            feedbackMessage.style.opacity = '0';
            timeoutIds.push(setTimeout(() => {
                feedbackMessage.remove();
            }, 300)); // Remove after fade out
        }, 1500)); // Display for 1.5 seconds
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

    // Version display removed

    // Assemble the panel (default to vertical, updatePanelLayout will fix for horizontal)
    panel.appendChild(leftColumn);
    panel.appendChild(mapFilterContainer);
    panel.appendChild(lootContainer);
    panel.appendChild(creatureDropContainer);

    // Cache DOM elements
    domCache.set("mod-loot-display", lootDisplayDiv);
    domCache.set("mod-creature-drop-display", creatureDropDisplayDiv);
    domCache.set("mod-autoplay-counter", autoplayCounter);
    domCache.set("mod-session-count", sessionCountSpan);
    domCache.set("mod-stamina-display", staminaDisplaySpan);
    domCache.set("mod-win-loss-display", winLossElement);
    domCache.set("mod-playtime-display", playtimeElement);
    domCache.set("mod-gold-rate", goldRateElement);
    domCache.set("mod-creature-rate", creatureRateElement);
    domCache.set("mod-equipment-rate", equipmentRateElement);
    domCache.set("mod-rune-rate", runeRateElement);
    domCache.set("mod-room-id-display", roomIdDisplay);
    domCache.set("mod-total-gold-display", goldAmountSpan);
    domCache.set("mod-total-dust-display", dustAmountSpan);
    domCache.set("mod-total-shiny-display", shinyAmountSpan);
    domCache.set("mod-total-runes-display", runesAmountSpan);
    domCache.set("mod-total-stamina-spent", totalStaminaSpentElement);

    // Set custom properties for layout management
    panel._leftColumn = leftColumn;
    panel._topHeaderContainer = topHeaderContainer;
    panel._liveDisplaySection = liveDisplaySection;
    panel._buttonContainer = buttonContainer;
    panel._mapFilterContainer = mapFilterContainer;
    panel._lootContainer = lootContainer;
    panel._creatureDropContainer = creatureDropContainer;

    document.body.appendChild(panel);

    // Apply saved layout mode if available
    if (panelState && panelState.mode) {
        currentLayoutMode = panelState.mode;
        // Apply layout mode to panel (preserveSize=true to keep saved width/height)
        applyLayoutMode(panel, panelState.mode, mapFilterContainer, lootContainer, creatureDropContainer, buttonContainer, true);
        
        // Re-apply saved size after layout mode to ensure it takes precedence
        const savedSettings = loadPanelSettings();
        if (savedSettings) {
            if (savedSettings.width) {
                const width = parseInt(savedSettings.width);
                if (!isNaN(width)) {
                    const layout = LAYOUT_DIMENSIONS[panelState.mode];
                    const clampedWidth = clamp(width, layout.minWidth, layout.maxWidth);
                    panel.style.width = clampedWidth + 'px';
                }
            }
            if (savedSettings.height) {
                const height = parseInt(savedSettings.height);
                if (!isNaN(height)) {
                    const layout = LAYOUT_DIMENSIONS[panelState.mode];
                    const clampedHeight = clamp(height, layout.minHeight, layout.maxHeight);
                    panel.style.height = clampedHeight + 'px';
                }
            }
        }
        
        // Update button states based on saved layout mode
        if (panelState.mode === LAYOUT_MODES.VERTICAL) {
            styleButton.textContent = 'Horizontal';
            styleButton.title = 'Switch to horizontal layout';
            minimizeBtn.textContent = '—';
            minimizeBtn.title = 'Minimize Analyzer';
        } else if (panelState.mode === LAYOUT_MODES.HORIZONTAL) {
            styleButton.textContent = 'Vertical';
            styleButton.title = 'Switch to vertical layout';
            minimizeBtn.textContent = '—';
            minimizeBtn.title = 'Minimize Analyzer';
        } else if (panelState.mode === LAYOUT_MODES.MINIMIZED) {
            minimizeBtn.textContent = '+';
            minimizeBtn.title = 'Restore Analyzer';
        }
    }

    // Set up timer for per-hour metrics calculation (needs to update every second)
    if (updateIntervalId) {
        clearInterval(updateIntervalId);
    }
    updateIntervalId = setInterval(updatePanelDisplay, 1000);
    
    // Set up periodic auto-save if persistence is enabled
    if (HuntAnalyzerState.settings.persistData) {
        if (autoSaveIntervalId) {
            clearInterval(autoSaveIntervalId);
        }
        autoSaveIntervalId = setInterval(() => {
            if (HuntAnalyzerState.data.sessions.length > 0) {
                saveHuntAnalyzerData();
                console.log('[Hunt Analyzer] Periodic auto-save completed');
            }
        }, CONFIG.AUTO_SAVE_INTERVAL);
        console.log('[Hunt Analyzer] Periodic auto-save enabled (30s interval)');
    }

    // Force layout update to fit header and live sections on first open
    updatePanelLayout(panel);

    // Initialize panel
    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);

    updatePanelDisplay();
    updateMapFilterDropdown(); // Initialize map filter dropdown

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


// Smooths initial rate values to prevent inflated numbers at startup
// Uses a longer period with more gradual easing for ultra-smooth progression
function getSmoothedRate(actualRate, elapsedTimeMs) {
    const SMOOTHING_TIME_MS = 10 * 60 * 1000; // 10 minutes for ultra-smooth progression
    const SMOOTHING_FACTOR = 0.1; // Start with only 10% of actual rate for very conservative start
    
    // Handle edge case where elapsedTimeMs is 0 or negative
    if (elapsedTimeMs <= 0) {
        return Math.max(1, Math.floor(actualRate * SMOOTHING_FACTOR));
    }
    
    if (elapsedTimeMs < SMOOTHING_TIME_MS) {
        const timeProgress = elapsedTimeMs / SMOOTHING_TIME_MS;
        
        // Use ease-out cubic function for smoother, more natural progression
        // This creates a curve that starts slow and accelerates toward the end
        const easedProgress = 1 - Math.pow(1 - timeProgress, 3);
        
        // Apply the eased progression to the smoothing factor
        const smoothingFactor = SMOOTHING_FACTOR + (1 - SMOOTHING_FACTOR) * easedProgress;
        
        // Use Math.round instead of Math.floor to prevent zero values for small rates
        const smoothedRate = Math.round(actualRate * smoothingFactor);
        
        // Ensure minimum value of 1 for rates > 0 to avoid showing 0 when there's actual progress
        return actualRate > 0 ? Math.max(1, smoothedRate) : smoothedRate;
    }
    
    return actualRate;
}

// Updates the display in the Hunt Analyzer Mod panel with the current loot, creature drops,
// autoplay session count, and live drop rates.
function updatePanelDisplay() {
    const now = Date.now();
    const shouldLog = (now - lastUpdateLogTime) > CONFIG.UPDATE_LOG_THROTTLE;
    
    // Always update for continuous timer - no throttling
    lastBoardSubscriptionTime = now;
    
    if (shouldLog) {
        console.log('[Hunt Analyzer] updatePanelDisplay called');
        lastUpdateLogTime = now;
    }
    
    // Update tracked values for continuous updates
    lastKnownSessionCount = HuntAnalyzerState.session.count;
    lastKnownGold = HuntAnalyzerState.totals.gold;
    lastKnownDust = HuntAnalyzerState.totals.dust;
    lastKnownShiny = HuntAnalyzerState.totals.shiny;
    
    // Get cached DOM elements
    const cachedLootDiv = domCache.get("mod-loot-display");
    const cachedCreatureDropDiv = domCache.get("mod-creature-drop-display");
    const cachedAutoplayCounterElement = domCache.get("mod-autoplay-counter");
    const cachedSessionCountSpan = domCache.get("mod-session-count");
    const cachedStaminaDisplayElement = domCache.get("mod-stamina-display");
    const cachedWinLossElement = domCache.get("mod-win-loss-display");
    const cachedPlaytimeDisplayElement = domCache.get("mod-playtime-display");
    const cachedGoldRateElement = domCache.get("mod-gold-rate");
    const cachedCreatureRateElement = domCache.get("mod-creature-rate");
    const cachedEquipmentRateElement = domCache.get("mod-equipment-rate");
    const cachedRuneRateElement = domCache.get("mod-rune-rate");
    const cachedRoomIdDisplayElement = domCache.get("mod-room-id-display");
    const cachedTotalGoldDisplayElement = domCache.get("mod-total-gold-display");
    const cachedTotalDustDisplayElement = domCache.get("mod-total-dust-display");
    const cachedTotalShinyDisplayElement = domCache.get("mod-total-shiny-display");
    const cachedTotalRunesDisplayElement = domCache.get("mod-total-runes-display");
    const cachedTotalStaminaSpentElement = domCache.get("mod-total-stamina-spent");

    // Update the session counter display (filtered by selected map)
    if (cachedSessionCountSpan) {
        let filteredSessionCount = HuntAnalyzerState.session.count;
        if (HuntAnalyzerState.ui.selectedMapFilter !== "ALL") {
            // Count sessions only from the selected map
            filteredSessionCount = HuntAnalyzerState.data.sessions.filter(session => 
                session.roomName === HuntAnalyzerState.ui.selectedMapFilter
            ).length;
        }
        
        // Calculate session rate for display
        const filteredTimeHours = getFilteredTimeHours();
        const sessionRate = filteredTimeHours > 0 ? Math.floor(filteredSessionCount / filteredTimeHours) : 0;
        
        cachedSessionCountSpan.textContent = `${t('mods.huntAnalyzer.sessions')}: ${filteredSessionCount} (${sessionRate}/h)`;
    }
    
    // Update win/loss display
    if (cachedWinLossElement) {
        const totalSessions = HuntAnalyzerState.totals.wins + HuntAnalyzerState.totals.losses;
        const winRate = totalSessions > 0 ? Math.round((HuntAnalyzerState.totals.wins / totalSessions) * 100) : 0;
        cachedWinLossElement.textContent = `W/L: ${HuntAnalyzerState.totals.wins}/${HuntAnalyzerState.totals.losses} (${winRate}%)`;
    }
    
    // Update stamina display
    if (cachedStaminaDisplayElement) {
        cachedStaminaDisplayElement.textContent = `Total Stamina: ${HuntAnalyzerState.totals.staminaSpent}`;
        cachedStaminaDisplayElement.style.display = 'inline';
    }

    // Update dust display
    if (cachedTotalDustDisplayElement) {
        cachedTotalDustDisplayElement.textContent = HuntAnalyzerState.totals.dust;
    }

    // Update gold display
    if (cachedTotalGoldDisplayElement) {
        cachedTotalGoldDisplayElement.textContent = HuntAnalyzerState.totals.gold;
    }

    // Update shiny display
    if (cachedTotalShinyDisplayElement) {
        cachedTotalShinyDisplayElement.textContent = HuntAnalyzerState.totals.shiny;
    }

    // Update runes display
    if (cachedTotalRunesDisplayElement) {
        cachedTotalRunesDisplayElement.textContent = HuntAnalyzerState.totals.runes;
    }

    // Update room ID display
    if (cachedRoomIdDisplayElement) {
        const roomNamesMap = globalThis.state?.utils?.ROOM_NAME;
        let roomDisplayName = t('mods.huntAnalyzer.currentRoom');
        let currentRoomId = null;
        
        if (roomNamesMap) {
            currentRoomId = globalThis.state.board?.area?.id || globalThis.state.player?.currentRoomId;
            if (currentRoomId && roomNamesMap[currentRoomId]) {
                roomDisplayName = roomNamesMap[currentRoomId];
            } else if (currentRoomId) {
                roomDisplayName = `Room ID: ${currentRoomId}`;
            }
        }
        
        if (currentRoomId) {
            updateRoomTitleDisplay(currentRoomId, roomDisplayName);
        }
    }

    // --- Autoplay Sessions/Hour Calculation (filtered by selected map) ---
    let autoplayRatePerHour = 0;
    const filteredTimeHours = getFilteredTimeHours();

    if (filteredTimeHours > 0) {
        let sessionCountForRate = HuntAnalyzerState.session.count;
        if (HuntAnalyzerState.ui.selectedMapFilter !== "ALL") {
            // Count sessions only from the selected map for rate calculation
            sessionCountForRate = HuntAnalyzerState.data.sessions.filter(session => 
                session.roomName === HuntAnalyzerState.ui.selectedMapFilter
            ).length;
        }
        const actualRate = filteredTimeHours > 0 ? Math.floor(sessionCountForRate / filteredTimeHours) : 0;
        autoplayRatePerHour = getSmoothedRate(actualRate, filteredTimeHours * 60 * 60 * 1000);
    }
    // Update playtime display
    if (cachedPlaytimeDisplayElement) {
        const filteredTimeHours = getFilteredTimeHours();
        const playtimeText = formatPlaytime(filteredTimeHours);
        cachedPlaytimeDisplayElement.textContent = `Playtime: ${playtimeText}`;
    }
    // --- End Autoplay Sessions/Hour Calculation ---

    // --- Rate Calculation Logic for Gold/Creatures/Equipment: Based on filtered time ---
    let goldRatePerHour = 0;
    let creatureRatePerHour = 0;
    let equipmentRatePerHour = 0;
    let runeRatePerHour = 0;
    let staminaSpentRatePerHour = 0;

    if (filteredTimeHours > 0) {
        const actualGoldRate = Math.floor(HuntAnalyzerState.totals.gold / filteredTimeHours);
        const actualCreatureRate = Math.floor(HuntAnalyzerState.totals.creatures / filteredTimeHours);
        const actualEquipmentRate = Math.round(HuntAnalyzerState.totals.equipment / filteredTimeHours);
        const actualRuneRate = Math.round(HuntAnalyzerState.totals.runes / filteredTimeHours);
        const actualStaminaRate = Math.floor(HuntAnalyzerState.totals.staminaSpent / filteredTimeHours);
        
        goldRatePerHour = getSmoothedRate(actualGoldRate, filteredTimeHours * 60 * 60 * 1000);
        creatureRatePerHour = getSmoothedRate(actualCreatureRate, filteredTimeHours * 60 * 60 * 1000);
        equipmentRatePerHour = getSmoothedRate(actualEquipmentRate, filteredTimeHours * 60 * 60 * 1000);
        runeRatePerHour = getSmoothedRate(actualRuneRate, filteredTimeHours * 60 * 60 * 1000);
        staminaSpentRatePerHour = getSmoothedRate(actualStaminaRate, filteredTimeHours * 60 * 60 * 1000);
    }

    if (cachedGoldRateElement) {
        cachedGoldRateElement.textContent = `${t('mods.huntAnalyzer.goldPerHour')}: ${goldRatePerHour}`;
    }
    if (cachedCreatureRateElement) {
        cachedCreatureRateElement.textContent = `${t('mods.huntAnalyzer.creaturesPerHour')}: ${creatureRatePerHour}`;
    }
    if (cachedEquipmentRateElement) {
        cachedEquipmentRateElement.textContent = `${t('mods.huntAnalyzer.equipmentPerHour')}: ${equipmentRatePerHour}`;
    }
    if (cachedRuneRateElement) {
        cachedRuneRateElement.textContent = `${t('mods.huntAnalyzer.runesPerHour')}: ${runeRatePerHour}`;
    }
    if (cachedTotalStaminaSpentElement) {
        // Only calculate natural regeneration if we have completed sessions
        const hasCompletedSessions = HuntAnalyzerState.data.sessions.length > 0;
        const filteredTimeMinutes = filteredTimeHours * 60;
        const naturalStaminaRegen = hasCompletedSessions ? Math.floor(filteredTimeMinutes) : 0;
        
        // Total stamina recovery = potions + natural regen (only if sessions completed)
        const totalStaminaRecovered = HuntAnalyzerState.totals.staminaRecovered + naturalStaminaRegen;
        
        // Net stamina change (positive = gaining, negative = losing)
        const netStaminaChange = totalStaminaRecovered - HuntAnalyzerState.totals.staminaSpent;
        const actualNetStaminaRate = filteredTimeHours > 0 ? Math.floor(netStaminaChange / filteredTimeHours) : 0;
        // Only apply smoothing if we have completed sessions, otherwise show actual rate
        const netStaminaPerHour = hasCompletedSessions ? 
            getSmoothedRate(actualNetStaminaRate, filteredTimeHours * 60 * 60 * 1000) : actualNetStaminaRate;
        
        // Recovery efficiency percentage (including natural regen)
        const recoveryEfficiency = HuntAnalyzerState.totals.staminaSpent > 0 ? 
            Math.round((totalStaminaRecovered / HuntAnalyzerState.totals.staminaSpent) * 100) : 0;
        
        cachedTotalStaminaSpentElement.textContent = `Stamina/h: ${staminaSpentRatePerHour} (Net: ${netStaminaPerHour > 0 ? '+' : ''}${netStaminaPerHour}/h) [${recoveryEfficiency}% recovery]`;
    }
}

// Calculates and applies the correct position for the analyzer panel.
// It will now attempt to position the panel to the left of the main game content, with a small gap.
function updatePanelPosition() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    // Check if panel has a saved position (has explicit top/left styles set)
    // If it does, preserve it instead of auto-positioning
    const hasSavedPosition = panel.style.top && panel.style.left && 
                             panel.style.top !== 'auto' && panel.style.left !== 'auto' &&
                             panel.style.top.trim() !== '' && panel.style.left.trim() !== '';
    
    if (hasSavedPosition) {
        // Panel has a saved position, don't override it
        // Just ensure it stays within viewport bounds
        const rect = panel.getBoundingClientRect();
        const maxLeft = window.innerWidth - panel.offsetWidth;
        const maxTop = window.innerHeight - panel.offsetHeight;
        
        if (rect.left < 0) panel.style.left = '0px';
        else if (rect.left > maxLeft) panel.style.left = Math.max(0, maxLeft) + 'px';
        
        if (rect.top < 0) panel.style.top = '0px';
        else if (rect.top > maxTop) panel.style.top = Math.max(0, maxTop) + 'px';
        
        return;
    }

    // No saved position, use auto-positioning relative to main element
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

// Toggles the minimized state of the analyzer panel.
// Hides/shows content and adjusts panel height.
function toggleMinimize() {
    const panel = document.getElementById(PANEL_ID);
    const lootContainer = document.querySelector(`#${PANEL_ID} .loot-container`);
    const creatureDropContainer = document.querySelector(`#${PANEL_ID} .creature-drop-container`);
    const minimizeBtn = document.getElementById("mod-minimize-button");
    const buttonContainer = panel && panel.querySelector('.button-container');

    if (!panel || !lootContainer || !creatureDropContainer || !minimizeBtn) {
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
        minimizeBtn.textContent = 'Vertical';
        minimizeBtn.title = 'Current layout: Vertical';
    } else if (panelState.mode === LAYOUT_MODES.HORIZONTAL) {
        minimizeBtn.textContent = 'Horizontal';
        minimizeBtn.title = 'Current layout: Horizontal';
    } else if (panelState.mode === LAYOUT_MODES.MINIMIZED) {
        minimizeBtn.textContent = 'Minimized';
        minimizeBtn.title = 'Current layout: Minimized';
    }

    // Cancel any ongoing resize if switching to minimized
    if (panelState.mode === LAYOUT_MODES.MINIMIZED) {
        panelState.isResizing = false;
    }
    applyLayoutMode(panel, panelState.mode, mapFilterContainer, lootContainer, creatureDropContainer, buttonContainer);
    updatePanelLayout(panel);
    updatePanelPosition();
    
    // Save panel settings after layout mode change
    savePanelSettings(panel);
}

// Add this helper function near the top (after LAYOUT_DIMENSIONS):
function applyLayoutMode(panel, mode, mapFilterContainer, lootContainer, creatureDropContainer, buttonContainer, preserveSize = false) {
    const layout = LAYOUT_DIMENSIONS[mode];
    if (!layout) return;
    
    // Only set width/height if not preserving size (i.e., when user explicitly changes layout mode)
    // When preserving size (on load), only set constraints
    if (!preserveSize) {
        panel.style.width = layout.width + 'px';
        panel.style.height = layout.height + 'px';
    }
    
    // Always apply constraints
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
        mapFilterContainer.style.display = 'none';
        lootContainer.style.display = 'none';
        creatureDropContainer.style.display = 'none';
        if (buttonContainer) buttonContainer.style.display = 'flex';
    } else {
        mapFilterContainer.style.display = 'flex';
        mapFilterContainer.style.flexDirection = 'column';
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
    const mapFilterContainer = panel._mapFilterContainer;
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
    // Set flex based on layout mode
    if (panelState.mode === LAYOUT_MODES.VERTICAL) {
        // In vertical mode, give map filter minimal space and make loot/creatures bigger
        if (mapFilterContainer) mapFilterContainer.style.flex = "0 0 auto";
        if (lootContainer) lootContainer.style.flex = "1 1 0";
        if (creatureDropContainer) creatureDropContainer.style.flex = "1 1 0";
    } else {
        // In horizontal mode, all sections get their normal sizing
        if (mapFilterContainer) mapFilterContainer.style.flex = "0 0 auto";
        if (lootContainer) lootContainer.style.flex = "1 1 0";
        if (creatureDropContainer) creatureDropContainer.style.flex = "1 1 0";
    }

    // Use currentLayoutMode for layout
    if (panelState.mode === LAYOUT_MODES.HORIZONTAL) {
        panel.style.flexDirection = 'row';
        // Ensure leftColumn contains header, live, buttons in order
        if (leftColumn) {
            if (leftColumn.children[0] !== topHeaderContainer) leftColumn.insertBefore(topHeaderContainer, leftColumn.firstChild);
            if (leftColumn.children[1] !== liveDisplaySection) leftColumn.insertBefore(liveDisplaySection, leftColumn.children[1] || null);
            if (leftColumn.children[2] !== buttonContainer) leftColumn.appendChild(buttonContainer);
        }
        // Ensure panel order: leftColumn, mapFilter, loot, creatures
        [leftColumn, mapFilterContainer, lootContainer, creatureDropContainer].forEach((el, idx) => {
            if (el && panel.children[idx] !== el) panel.insertBefore(el, panel.children[idx] || null);
        });
    } else if (panelState.mode === LAYOUT_MODES.MINIMIZED) {
        panel.style.flexDirection = 'column';
        // Remove leftColumn if present
        if (leftColumn && panel.contains(leftColumn)) panel.removeChild(leftColumn);
        // Always remove all six elements from the panel, then append in correct order
        [topHeaderContainer, liveDisplaySection, buttonContainer, mapFilterContainer, lootContainer, creatureDropContainer].forEach(el => {
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
        // Always remove all six elements from the panel, then append in correct order
        [topHeaderContainer, liveDisplaySection, buttonContainer, mapFilterContainer, lootContainer, creatureDropContainer].forEach(el => {
            if (el && el.parentNode === panel) panel.removeChild(el);
        });
        [topHeaderContainer, liveDisplaySection, buttonContainer, mapFilterContainer, lootContainer, creatureDropContainer].forEach(el => {
            if (el) panel.appendChild(el);
        });
    }
}

// In the mousedown and mousemove handlers for resizing, keep the early return for minimized mode:
// (already present, but ensure it stays)
// panel.addEventListener('mousedown', ...)
// document.addEventListener('mousemove', ...)

// =======================
// 6. Event Handlers and Initialization
// =======================

// Listen for game start and end events using the game's global API.
if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.board && globalThis.state.board.on) {
    console.log('[Hunt Analyzer] Setting up board event listeners...');
    
    globalThis.state.board.on('newGame', (event) => {
        // Only process if the panel is open
        if (!document.getElementById(PANEL_ID)) {
            return; // Exit immediately if panel is not open
        }
        
        // Skip recording if in sandbox mode
        if (isSandboxMode()) {
            console.log("[Hunt Analyzer] Skipping sandbox mode session");
            return;
        }
        
        // Only update session state, don't process rewards here
        // Rewards will be processed by the board subscription when serverResults arrive
        HuntAnalyzerState.session.count++;
        HuntAnalyzerState.session.isActive = true;
        HuntAnalyzerState.session.sessionStartTime = Date.now();
        
        // Consolidated session lifecycle log
        console.log('[Hunt Analyzer] New session started:', {
            count: HuntAnalyzerState.session.count,
            isActive: HuntAnalyzerState.session.isActive,
            sessionStartTime: HuntAnalyzerState.session.sessionStartTime
        });
        
        // Defer display update to avoid interfering with animations
        timeoutIds.push(setTimeout(() => {
            updatePanelDisplay();
        }, 0));

    // Simplified: always ensure the internal clock is running on newGame
    try {
        const mode = getCurrentMode();
        if (!HuntAnalyzerState.timeTracking.clockIntervalId) {
            startInternalClock('newGame');
            console.log('[Hunt Analyzer] Clock: start on newGame (mode:', mode, ')');
        }
        if (mode === 'manual') {
            if (!HuntAnalyzerState.timeTracking.manualActive || HuntAnalyzerState.timeTracking.manualSessionStartMs === 0) {
                HuntAnalyzerState.timeTracking.manualActive = true;
                HuntAnalyzerState.timeTracking.manualSessionStartMs = Date.now();
            }
            HuntAnalyzerState.timeTracking.waitingForManualStart = false;
        } else {
            HuntAnalyzerState.timeTracking.manualActive = false;
            HuntAnalyzerState.timeTracking.manualSessionStartMs = 0;
            HuntAnalyzerState.timeTracking.waitingForManualStart = false;
        }
    } catch (_e) { /* ignore */ }
    });

    if (globalThis.state.board.subscribe) {
        console.log('[Hunt Analyzer] Setting up board subscription...');
        boardSubscription = globalThis.state.board.subscribe(({ context }) => {
            // Only process if the panel is open
            if (!document.getElementById(PANEL_ID)) {
                return; // Exit immediately if panel is not open
            }
            
            // Ultra-minimal processing - only check for server results
            const serverResults = context.serverResults;
            if (!serverResults || !serverResults.rewardScreen || typeof serverResults.seed === 'undefined') {
                return; // Exit immediately - no processing, no logging
            }
            
            // Skip processing if in sandbox mode
            if (isSandboxMode()) {
                return;
            }
            
            const seed = serverResults.seed;
            
            // Improved seed handling - only process if we haven't seen this seed before
            if (seed === HuntAnalyzerState.ui.lastSeed) {
                return; // Skip duplicate seeds silently
            }
            
            // Only process when we have valid server results and a new seed
            HuntAnalyzerState.ui.lastSeed = seed;
            
            // Consolidated server results processing log
            console.log(`[Hunt Analyzer] Processing server results:`, {
                seed: seed,
                hasRewardScreen: !!serverResults.rewardScreen,
                hasNext: !!serverResults.next
            });
            
            // Use setTimeout to defer processing and avoid blocking animations
            timeoutIds.push(setTimeout(() => {
                // Keep ticking independent of results; do not reset manual window here
                processAutoplaySummary(serverResults);
                HuntAnalyzerState.session.isActive = false;
                
                // Ensure clock keeps running after results, align manual flag only if not active
                try {
                    const modeNow = getCurrentMode();
                    if (!HuntAnalyzerState.timeTracking.clockIntervalId) {
                        startInternalClock('serverResults');
                        console.log('[Hunt Analyzer] Clock: start on serverResults (mode:', modeNow, ')');
                    }
                    if (modeNow === 'manual' && !HuntAnalyzerState.timeTracking.manualActive) {
                        HuntAnalyzerState.timeTracking.manualActive = true;
                        HuntAnalyzerState.timeTracking.manualSessionStartMs = Date.now();
                    }
                    if (modeNow !== 'manual') {
                        HuntAnalyzerState.timeTracking.manualActive = false;
                        HuntAnalyzerState.timeTracking.manualSessionStartMs = 0;
                    }
                } catch (_e) { /* ignore */ }

                updatePanelDisplay();
            }, 0));
        });

        // Separate lightweight subscription to detect map switches and stop internal clock
        try {
            let lastSelectedRoomId = null;
            let lastKnownMode = null;
            modeMapSubscription = globalThis.state.board.subscribe((state) => {
                const ctx = state?.context || {};
                const playerCtx = globalThis.state?.player?.getSnapshot?.()?.context || {};
                const roomId = (ctx.selectedMap && ctx.selectedMap.selectedRoom && ctx.selectedMap.selectedRoom.id)
                    || (ctx.selectedMap && ctx.selectedMap.id)
                    || (ctx.area && ctx.area.id)
                    || playerCtx.currentRoomId
                    || null;
                const mode = ctx.mode || null;

                // Mode transition handling: snapshot current live time and start baseline for new mode
                if (mode !== lastKnownMode) {
                    // Snapshot whatever was active before switching
                    snapshotIntoTotals();
                    // If we were previously in autoplay, we just snapshotted the segment; suppress the next autoplay reset accumulation
                    if (lastKnownMode === 'autoplay') {
                        HuntAnalyzerState.timeTracking.suppressNextAutoplayReset = true;
                    }

                    // Prepare new mode
                    if (mode === 'autoplay') {
                        // Set baseline to current DOM time
                        HuntAnalyzerState.timeTracking.autoplayBaselineMinutes = getAutoplaySessionTime() || 0;
                        // Ensure internal clock runs for UI updates
                        if (!HuntAnalyzerState.timeTracking.clockIntervalId) {
                            startInternalClock('modeChange:autoplay');
                        }
                    } else if (mode === 'manual') {
                        // Start manual session window
                        HuntAnalyzerState.timeTracking.manualActive = true;
                        HuntAnalyzerState.timeTracking.manualSessionStartMs = Date.now();
                    }
                    lastKnownMode = mode;
                }
                if (!roomId) {
                    const now = Date.now();
                    if (now - mapDebugLastLogTime > 5000 && mapDebugLogCount < 10) {
                        mapDebugLastLogTime = now;
                        mapDebugLogCount++;
                        console.log('[Hunt Analyzer] Map debug: no roomId in context', {
                            keys: Object.keys(ctx || {}),
                            selectedMap: ctx.selectedMap,
                            area: ctx.area,
                            selectedRoom: ctx.selectedRoom,
                            mode
                        });
                    }
                    return;
                }
                if (lastSelectedRoomId === null) {
                    lastSelectedRoomId = roomId;
                    console.log('[Hunt Analyzer] Map debug: initialized room tracking', { roomId, mode });
                    return;
                }
                if (roomId !== lastSelectedRoomId) {
                    const preHadClock = !!HuntAnalyzerState.timeTracking.clockIntervalId;
                    const preMode = getCurrentMode();
                    console.log('[Hunt Analyzer] Map change detected:', { from: lastSelectedRoomId, to: roomId, preHadClock, preMode });
                    // On map change:
                    // 1) Snapshot any live time
                    const snapMs = snapshotIntoTotals();
                    // If currently in autoplay, we just snapshotted the DOM segment; suppress the next autoplay reset accumulation
                    if (getCurrentMode() === 'autoplay') {
                        HuntAnalyzerState.timeTracking.suppressNextAutoplayReset = true;
                    }
                    // 2) Update map/time context
                    lastSelectedRoomId = roomId;
                    const roomNamesMap = globalThis.state?.utils?.ROOM_NAME;
                    const roomName = roomNamesMap?.[roomId] || `Room ID: ${roomId}`;
                    trackMapChange(roomName);
                    // 3) Do NOT start or continue manual timing on map change; wait for next newGame
                    HuntAnalyzerState.timeTracking.manualActive = false;
                    HuntAnalyzerState.timeTracking.manualSessionStartMs = 0;
                    HuntAnalyzerState.timeTracking.waitingForManualStart = true;
                    console.log('[Hunt Analyzer] Manual timing paused on map change; waiting for next newGame');
                    const postHadClock = !!HuntAnalyzerState.timeTracking.clockIntervalId;
                    const postMode = getCurrentMode();
                    if (!preHadClock && postHadClock) {
                        console.log('[Hunt Analyzer] WARNING: Clock started during map change! Investigate callers.');
                    }
                    console.log('[Hunt Analyzer] Map change handled:', { postHadClock, postMode });
                    updateRoomTitleDisplay(roomId, roomName);
                }
            });
        } catch (_e) { /* ignore */ }
    }
}

// Create button to open the sidebar panel.
function createHuntAnalyzerButton() {
    if (typeof api !== 'undefined' && api && api.ui && api.ui.addButton) {
        api.ui.addButton({
            id: BUTTON_ID,
            text: t('mods.huntAnalyzer.buttonText'),
            tooltip: t('mods.huntAnalyzer.buttonTooltip'),
            primary: false,
            onClick: () => {
                createAutoplayAnalyzerPanel();
            }
        });
        console.log('[Hunt Analyzer] UI button created successfully');
    }
}

// Create button immediately if API is ready
createHuntAnalyzerButton();

// Translation event handler
const translationEventHandler = (event) => {
    console.log('[Hunt Analyzer] Translations loaded, updating UI elements...', event.detail);
    
    // Update button text if it exists
    const button = document.querySelector(`[data-mod-id="${BUTTON_ID}"]`);
    if (button) {
        button.textContent = t('mods.huntAnalyzer.buttonText');
        button.title = t('mods.huntAnalyzer.buttonTooltip');
    }
    
    // Update panel content if it exists
    const panel = document.getElementById(PANEL_ID);
    if (panel) {
        // Update room display
        const roomDisplay = document.getElementById('mod-room-id-display');
        if (roomDisplay) {
            roomDisplay.textContent = t('mods.huntAnalyzer.currentRoom');
        }
        
        // Update session counter
        const sessionCounter = document.getElementById('mod-session-count');
        if (sessionCounter) {
            let filteredSessionCount = HuntAnalyzerState.session.count;
            if (HuntAnalyzerState.ui.selectedMapFilter !== "ALL") {
                filteredSessionCount = HuntAnalyzerState.data.sessions.filter(session => 
                    session.roomName === HuntAnalyzerState.ui.selectedMapFilter
                ).length;
            }
            
            const filteredTimeHours = getFilteredTimeHours();
            const sessionRate = filteredTimeHours > 0 ? Math.floor(filteredSessionCount / filteredTimeHours) : 0;
            sessionCounter.textContent = `${t('mods.huntAnalyzer.sessions')}: ${filteredSessionCount} (${sessionRate}/h)`;
        }
        
        // Update playtime display
        const playtimeDisplay = document.getElementById('mod-playtime-display');
        if (playtimeDisplay) {
            const filteredTimeHours = getFilteredTimeHours();
            const playtimeText = formatPlaytime(filteredTimeHours);
            playtimeDisplay.textContent = `Playtime: ${playtimeText}`;
        }
        
        // Update rate displays
        const goldRate = document.getElementById('mod-gold-rate');
        if (goldRate) {
            const filteredTimeHours = getFilteredTimeHours();
            const goldRatePerHour = filteredTimeHours > 0 ? 
                getSmoothedRate(Math.floor(HuntAnalyzerState.totals.gold / filteredTimeHours), filteredTimeHours * 60 * 60 * 1000) : 0;
            goldRate.textContent = `${t('mods.huntAnalyzer.goldPerHour')}: ${goldRatePerHour}`;
        }
        
        const creatureRate = document.getElementById('mod-creature-rate');
        if (creatureRate) {
            const filteredTimeHours = getFilteredTimeHours();
            const creatureRatePerHour = filteredTimeHours > 0 ? 
                getSmoothedRate(Math.floor(HuntAnalyzerState.totals.creatures / filteredTimeHours), filteredTimeHours * 60 * 60 * 1000) : 0;
            creatureRate.textContent = `${t('mods.huntAnalyzer.creaturesPerHour')}: ${creatureRatePerHour}`;
        }
        
        const equipmentRate = document.getElementById('mod-equipment-rate');
        if (equipmentRate) {
            const filteredTimeHours = getFilteredTimeHours();
            const equipmentRatePerHour = filteredTimeHours > 0 ? 
                getSmoothedRate(Math.round(HuntAnalyzerState.totals.equipment / filteredTimeHours), filteredTimeHours * 60 * 60 * 1000) : 0;
            equipmentRate.textContent = `${t('mods.huntAnalyzer.equipmentPerHour')}: ${equipmentRatePerHour}`;
        }
        
        const runeRate = document.getElementById('mod-rune-rate');
        if (runeRate) {
            const filteredTimeHours = getFilteredTimeHours();
            const runeRatePerHour = filteredTimeHours > 0 ? 
                getSmoothedRate(Math.round(HuntAnalyzerState.totals.runes / filteredTimeHours), filteredTimeHours * 60 * 60 * 1000) : 0;
            runeRate.textContent = `${t('mods.huntAnalyzer.runesPerHour')}: ${runeRatePerHour}`;
        }
        
        const staminaSpent = document.getElementById('mod-total-stamina-spent');
        if (staminaSpent) {
            const filteredTimeHours = getFilteredTimeHours();
            const filteredTimeMinutes = filteredTimeHours * 60;
            const staminaSpentRatePerHour = filteredTimeHours > 0 ? 
                getSmoothedRate(Math.floor(HuntAnalyzerState.totals.staminaSpent / filteredTimeHours), filteredTimeHours * 60 * 60 * 1000) : 0;
            
            // Only calculate natural regeneration if we have completed sessions
            const hasCompletedSessions = HuntAnalyzerState.data.sessions.length > 0;
            const naturalStaminaRegen = hasCompletedSessions ? Math.floor(filteredTimeMinutes) : 0;
            
            // Total stamina recovery = potions + natural regen (only if sessions completed)
            const totalStaminaRecovered = HuntAnalyzerState.totals.staminaRecovered + naturalStaminaRegen;
            
            // Net stamina change (positive = gaining, negative = losing)
            const netStaminaChange = totalStaminaRecovered - HuntAnalyzerState.totals.staminaSpent;
            const actualNetStaminaRate = filteredTimeHours > 0 ? Math.floor(netStaminaChange / filteredTimeHours) : 0;
            // Only apply smoothing if we have completed sessions, otherwise show actual rate
            const netStaminaPerHour = hasCompletedSessions ? 
                getSmoothedRate(actualNetStaminaRate, filteredTimeHours * 60 * 60 * 1000) : actualNetStaminaRate;
            
            // Recovery efficiency percentage (including natural regen)
            const recoveryEfficiency = HuntAnalyzerState.totals.staminaSpent > 0 ? 
                Math.round((totalStaminaRecovered / HuntAnalyzerState.totals.staminaSpent) * 100) : 0;
            
            staminaSpent.textContent = `Stamina/h: ${staminaSpentRatePerHour} (Net: ${netStaminaPerHour > 0 ? '+' : ''}${netStaminaPerHour}/h) [${recoveryEfficiency}% recovery]`;
        }
        
        // Update section titles
        const lootTitle = panel.querySelector('.loot-container h3');
        if (lootTitle) {
            lootTitle.textContent = t('mods.huntAnalyzer.loot');
        }
        
        const creatureDropTitle = panel.querySelector('.creature-drop-container h3');
        if (creatureDropTitle) {
            creatureDropTitle.textContent = t('mods.huntAnalyzer.creatureDrops');
        }
        
        // Update button text
        const clearButton = panel.querySelector('.button-container button:first-child');
        if (clearButton) {
            clearButton.textContent = t('mods.huntAnalyzer.clearAll');
        }
        
        const copyLogButton = panel.querySelector('.button-container button:last-child');
        if (copyLogButton) {
            copyLogButton.textContent = t('mods.huntAnalyzer.copyLog');
        }
    }
};

// Also listen for translation loading event to update button text and panel content
document.addEventListener('bestiary-translations-loaded', translationEventHandler);

// Initial script execution setup.

// Add these functions before createAutoplayAnalyzerPanel()
function savePanelSettings(panel) {
    if (!panel) return;
    
    try {
        // Get current panel settings
        const rect = panel.getBoundingClientRect();
        const settings = {
            width: panel.style.width || `${LAYOUT_DIMENSIONS[LAYOUT_MODES.VERTICAL].width}px`,
            maxWidth: panel.style.maxWidth,
            minWidth: panel.style.minWidth,
            height: panel.style.height || `${LAYOUT_DIMENSIONS[LAYOUT_MODES.VERTICAL].height}px`,
            maxHeight: panel.style.maxHeight,
            top: rect.top + 'px',
            left: rect.left + 'px',
            layoutMode: (panelState && panelState.mode) || LAYOUT_MODES.VERTICAL,
            isMinimized: false
        };
        
        // Update config (for mod loader's config system)
        config.panelSettings = settings;
        
        // Save configuration using the mod loader's system
        api.service.updateScriptConfig(context.hash, config);
        
        // Also save to localStorage (like VIP List.js) so it persists across config exports/imports
        localStorage.setItem(HUNT_ANALYZER_PANEL_SETTINGS_KEY, JSON.stringify(settings));
        console.log('[Hunt Analyzer] Panel settings saved:', settings);
    } catch (error) {
        console.error('[Hunt Analyzer] Error saving panel settings:', error);
    }
}

function loadPanelSettings() {
    try {
        // Try to load from localStorage first (like VIP List.js)
        const saved = localStorage.getItem(HUNT_ANALYZER_PANEL_SETTINGS_KEY);
        if (saved) {
            const settings = JSON.parse(saved);
            // Validate that settings have required properties
            if (settings && (settings.top || settings.left || settings.width || settings.height)) {
                console.log('[Hunt Analyzer] Panel settings loaded:', settings);
                // Also update config object for consistency
                config.panelSettings = settings;
                return settings;
            }
        }
    } catch (error) {
        console.error('[Hunt Analyzer] Error loading panel settings:', error);
    }
    
    // Fallback to config object (for backward compatibility)
    if (config.panelSettings && (config.panelSettings.top || config.panelSettings.left || config.panelSettings.width || config.panelSettings.height)) {
        return config.panelSettings;
    }
    
    // Return null if no valid settings found (will use defaults)
    return null;
}

function applyPanelSettings(panel, settings) {
    if (!panel || !settings) return;
    
    try {
        // Apply layout mode first if saved
        if (settings.layoutMode && panelState) {
            const savedMode = settings.layoutMode;
            // Validate mode is one of the valid options
            if (savedMode === LAYOUT_MODES.VERTICAL || 
                savedMode === LAYOUT_MODES.HORIZONTAL || 
                savedMode === LAYOUT_MODES.MINIMIZED) {
                panelState.mode = savedMode;
            }
        }
        
        // Get current layout constraints based on mode
        const currentMode = (panelState && panelState.mode) || LAYOUT_MODES.VERTICAL;
        const layout = LAYOUT_DIMENSIONS[currentMode];
        
        // Apply width (clamp to valid range)
        if (settings.width) {
            const width = parseInt(settings.width);
            if (!isNaN(width)) {
                const clampedWidth = clamp(width, layout.minWidth, layout.maxWidth);
                panel.style.width = clampedWidth + 'px';
            } else {
                panel.style.width = settings.width; // Fallback to string value
            }
        }
        
        // Apply height (clamp to valid range)
        if (settings.height) {
            const height = parseInt(settings.height);
            if (!isNaN(height)) {
                const clampedHeight = clamp(height, layout.minHeight, layout.maxHeight);
                panel.style.height = clampedHeight + 'px';
            } else {
                panel.style.height = settings.height; // Fallback to string value
            }
        }
        
        // Apply min/max constraints
        if (settings.minWidth) panel.style.minWidth = settings.minWidth;
        if (settings.maxWidth) panel.style.maxWidth = settings.maxWidth;
        if (settings.maxHeight) panel.style.maxHeight = settings.maxHeight;
        
        // Apply top position (ensure panel stays within viewport)
        if (settings.top) {
            const top = parseInt(settings.top);
            if (!isNaN(top)) {
                const maxTop = window.innerHeight - layout.minHeight;
                const clampedTop = clamp(top, 0, Math.max(0, maxTop));
                panel.style.top = clampedTop + 'px';
            } else {
                panel.style.top = settings.top; // Fallback to string value
            }
        }
        
        // Apply left position (ensure panel stays within viewport)
        if (settings.left) {
            const left = parseInt(settings.left);
            if (!isNaN(left)) {
                const maxLeft = window.innerWidth - layout.minWidth;
                const clampedLeft = clamp(left, 0, Math.max(0, maxLeft));
                panel.style.left = clampedLeft + 'px';
            } else {
                panel.style.left = settings.left; // Fallback to string value
            }
        }
        
        // Apply minimized state if needed
        if (settings.isMinimized !== undefined && settings.isMinimized !== false) {
            const lootContainer = panel.querySelector('.loot-container');
            const creatureDropContainer = panel.querySelector('.creature-drop-container');
            const minimizeBtn = document.getElementById("mod-minimize-button");
            const buttonContainer = panel.querySelector('.button-container');
            if (lootContainer && creatureDropContainer && minimizeBtn) {
                if (settings.isMinimized) {
                    lootContainer.style.display = 'none';
                    creatureDropContainer.style.display = 'none';
                    panel.style.height = 'fit-content';
                    panel.style.maxHeight = '200px';
                    minimizeBtn.textContent = '+';
                    minimizeBtn.title = 'Maximize Analyzer';
                } else {
                    lootContainer.style.display = 'flex';
                    lootContainer.style.flexDirection = 'column';
                    creatureDropContainer.style.display = 'flex';
                    creatureDropContainer.style.flexDirection = 'column';
                    panel.style.height = '90vh';
                    panel.style.maxHeight = '750px';
                    minimizeBtn.textContent = '—';
                    minimizeBtn.title = 'Minimize Analyzer';
                }
            }
        }
        
        console.log('[Hunt Analyzer] Panel settings applied:', settings);
    } catch (error) {
        console.error('[Hunt Analyzer] Error applying panel settings:', error);
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
    layoutMode: LAYOUT_MODES.VERTICAL,
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

globalResizeMouseMoveHandler = function(e) {
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
};
document.addEventListener('mousemove', globalResizeMouseMoveHandler);

globalResizeMouseUpHandler = function(e) {
    if (panelState.isResizing) {
        const panel = document.getElementById(PANEL_ID);
        if (panel) {
            panel.classList.remove('resizing');
            // Save panel settings after resize
            savePanelSettings(panel);
        }
        document.body.style.userSelect = '';
        panelState.resetResizeState();
    }
};
document.addEventListener('mouseup', globalResizeMouseUpHandler);

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
        // Save panel settings after maximize/restore
        savePanelSettings(panel);
    }
};




// =======================
// 7. Cleanup System
// =======================

// Comprehensive cleanup function for memory leak prevention
// Follows mod development guide best practices for cleanup
function cleanupHuntAnalyzer() {
    console.log('[Hunt Analyzer] Starting cleanup...');
    
    try {
        // 1. Clear intervals and timeouts
        if (updateIntervalId) {
            clearInterval(updateIntervalId);
            updateIntervalId = null;
        }
        
        if (autoSaveIntervalId) {
            clearInterval(autoSaveIntervalId);
            autoSaveIntervalId = null;
        }
        
        // Stop internal clock system
        stopInternalClock();
        
        // Clear all timeouts
        timeoutIds.forEach(id => clearTimeout(id));
        timeoutIds = [];
        
        // 2. Remove document event listeners to prevent memory leaks
        if (panelResizeMouseMoveHandler) {
            document.removeEventListener('mousemove', panelResizeMouseMoveHandler);
            panelResizeMouseMoveHandler = null;
        }
        if (panelResizeMouseUpHandler) {
            document.removeEventListener('mouseup', panelResizeMouseUpHandler);
            panelResizeMouseUpHandler = null;
        }
        if (panelDragMouseMoveHandler) {
            document.removeEventListener('mousemove', panelDragMouseMoveHandler);
            panelDragMouseMoveHandler = null;
        }
        if (panelDragMouseUpHandler) {
            document.removeEventListener('mouseup', panelDragMouseUpHandler);
            panelDragMouseUpHandler = null;
        }
        if (globalResizeMouseMoveHandler) {
            document.removeEventListener('mousemove', globalResizeMouseMoveHandler);
            globalResizeMouseMoveHandler = null;
        }
        if (globalResizeMouseUpHandler) {
            document.removeEventListener('mouseup', globalResizeMouseUpHandler);
            globalResizeMouseUpHandler = null;
        }
        if (windowMessageHandler) {
            window.removeEventListener('message', windowMessageHandler);
            windowMessageHandler = null;
        }
        
        // Remove additional tracked event listeners
        if (dropdownClickHandler) {
            const dropdownButton = document.querySelector('[data-map-filter-dropdown]');
            if (dropdownButton) {
                dropdownButton.removeEventListener('click', dropdownClickHandler);
                dropdownClickHandler = null;
            }
        }
        
        if (documentClickHandler) {
            document.removeEventListener('click', documentClickHandler);
            documentClickHandler = null;
        }
        
        // Remove window resize listener
        window.removeEventListener('resize', updatePanelPosition);
        
        // Remove translation event listener
        document.removeEventListener('bestiary-translations-loaded', translationEventHandler);
        
        // Remove beforeunload listener
        if (beforeUnloadHandler) {
            window.removeEventListener('beforeunload', beforeUnloadHandler);
            beforeUnloadHandler = null;
        }
        
        // Remove storage event listener
        if (storageEventHandler) {
            window.removeEventListener('storage', storageEventHandler);
            storageEventHandler = null;
        }
        
        // 3. Unsubscribe from subscriptions
        if (boardSubscription) {
            try {
                boardSubscription.unsubscribe();
                boardSubscription = null;
            } catch (error) {
                console.warn('[Hunt Analyzer] Error unsubscribing board:', error);
            }
        }
        if (modeMapSubscription) {
            try {
                modeMapSubscription.unsubscribe();
                modeMapSubscription = null;
            } catch (error) {
                console.warn('[Hunt Analyzer] Error unsubscribing mode/map subscription:', error);
            }
        }
        
        
        // 4. Set UI state to closed and save data before removing panel
        HuntAnalyzerState.ui.isOpen = false;
        HuntAnalyzerState.ui.closedManually = true;
        
        if (HuntAnalyzerState.settings.persistData) {
            saveHuntAnalyzerData();
            saveHuntAnalyzerState();
        }
        
        // 5. Remove panel and test button
        const panel = document.getElementById(PANEL_ID);
        if (panel && panel.parentNode) {
            panel.parentNode.removeChild(panel);
        }
        
        // Remove test button if it exists
        const testButton = document.querySelector('[data-hunt-analyzer-test]');
        if (testButton && testButton.parentNode) {
            testButton.parentNode.removeChild(testButton);
        }
        
        // Remove any dynamically created dropdown elements
        const dropdownElements = document.querySelectorAll('[data-map-filter-dropdown], .map-filter-dropdown');
        dropdownElements.forEach(element => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        
        // 5. Clear caches to prevent memory leaks
        equipmentCache.clear();
        monsterCache.clear();
        itemInfoCache.clear();
        
        // Clear DOM cache if it exists
        if (window.domCache && typeof window.domCache.clear === 'function') {
            window.domCache.clear();
        }
        
        // 6. Reset critical state only
        HuntAnalyzerState.session.count = 0;
        HuntAnalyzerState.session.isActive = false;
        HuntAnalyzerState.data.sessions = [];
        HuntAnalyzerState.data.aggregatedLoot.clear();
        HuntAnalyzerState.data.aggregatedCreatures.clear();
        
        console.log('[Hunt Analyzer] Cleanup completed');
        
    } catch (error) {
        console.error('[Hunt Analyzer] Error during cleanup:', error);
        
        // Force cleanup of critical resources even if errors occur
        try {
            if (updateIntervalId) {
                clearInterval(updateIntervalId);
                updateIntervalId = null;
            }
            if (autoSaveIntervalId) {
                clearInterval(autoSaveIntervalId);
                autoSaveIntervalId = null;
            }
            timeoutIds.forEach(id => clearTimeout(id));
            timeoutIds = [];
            
            if (boardSubscription) {
                boardSubscription.unsubscribe();
                boardSubscription = null;
            }
            
            if (beforeUnloadHandler) {
                window.removeEventListener('beforeunload', beforeUnloadHandler);
                beforeUnloadHandler = null;
            }
            
            if (storageEventHandler) {
                window.removeEventListener('storage', storageEventHandler);
                storageEventHandler = null;
            }
        } catch (forceCleanupError) {
            console.error('[Hunt Analyzer] Error during force cleanup:', forceCleanupError);
        }
    }
}

// Listen for mod disable events
windowMessageHandler = function(event) {
    // Only log important messages, not routine API calls
    if (event.data && event.data.message && event.data.message.action === 'updateLocalModState') {
        const modName = event.data.message.name;
        const enabled = event.data.message.enabled;
        
        console.log('[Hunt Analyzer] Mod state update:', { modName, enabled });
        
        if (modName === 'Super Mods/Hunt Analyzer.js' && !enabled) {
            console.log('[Hunt Analyzer] Mod disabled, running cleanup...');
            cleanupHuntAnalyzer();
        }
    }
};
window.addEventListener('message', windowMessageHandler);
console.log('[Hunt Analyzer] Message listener added');

// Save data before page unload
beforeUnloadHandler = () => {
    if (HuntAnalyzerState.settings.persistData) {
        saveHuntAnalyzerData();
        saveHuntAnalyzerState();
    }
};
window.addEventListener('beforeunload', beforeUnloadHandler);

// Export functionality and expose state globally for Mod Settings integration
window.HuntAnalyzerState = HuntAnalyzerState;

// Expose applyTheme function for Mod Settings integration
window.applyHuntAnalyzerTheme = applyTheme;

// Expose themes object for Mod Settings to dynamically list available themes
window.HUNT_ANALYZER_THEMES = HUNT_ANALYZER_THEMES;

// Listen for theme changes from Mod Settings via storage events
storageEventHandler = (e) => {
    if (e.key === HUNT_ANALYZER_SETTINGS_KEY && e.newValue) {
        try {
            const newSettings = JSON.parse(e.newValue);
            if (newSettings.theme && newSettings.theme !== HuntAnalyzerState.settings.theme) {
                console.log('[Hunt Analyzer] Theme changed via storage event:', newSettings.theme);
                applyTheme(newSettings.theme, true);
            }
        } catch (error) {
            console.error('[Hunt Analyzer] Error parsing theme change from storage:', error);
        }
    }
};
window.addEventListener('storage', storageEventHandler);

// Theme changes are now handled event-driven via Proxy on HuntAnalyzerState.settings
// No polling needed - changes are detected immediately when Mod Settings updates the property

exports = {
    cleanup: cleanupHuntAnalyzer,
    getStats: () => ({
        autoplayCount: HuntAnalyzerState.session.count,
        totalGoldQuantity: HuntAnalyzerState.totals.gold,
        totalCreatureDrops: HuntAnalyzerState.totals.creatures,
        totalEquipmentDrops: HuntAnalyzerState.totals.equipment,
        totalDustQuantity: HuntAnalyzerState.totals.dust,
        totalStaminaSpent: HuntAnalyzerState.totals.staminaSpent
    })
};

console.log('[Hunt Analyzer] Mod initialization complete');