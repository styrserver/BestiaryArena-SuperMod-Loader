// Hunt Analyzer Mod for Bestiary Arena

// =======================
// 1. Initialization & Setup
// =======================

// Use shared translation system via API
const t = (key) => api.i18n.t(key);

// =======================
// 1.0. Theme System
// =======================
const HUNT_ANALYZER_DEFAULT_THEME_KEY = 'original';

const HUNT_ANALYZER_ASSET_BG = {
    darker: '/_next/static/media/background-darker.2679c837.png',
    dark: '/_next/static/media/background-dark.95edca67.png',
    regular: '/_next/static/media/background-regular.b0337118.png',
    blue: '/_next/static/media/background-blue.7259c4ed.png',
    green: '/_next/static/media/background-green.be515334.png',
    red: '/_next/static/media/background-red.21d3f4bd.png'
};

function huntAnalyzerBgUrl(assetPath) {
    return `url(${assetPath})`;
}

function huntAnalyzerUniformBackgrounds(assetKey) {
    const url = huntAnalyzerBgUrl(HUNT_ANALYZER_ASSET_BG[assetKey]);
    return { panel: url, header: url, section: url };
}

function huntAnalyzerPanelBackgrounds(panelKey, headerKey, sectionKey) {
    return {
        panel: huntAnalyzerBgUrl(HUNT_ANALYZER_ASSET_BG[panelKey]),
        header: huntAnalyzerBgUrl(HUNT_ANALYZER_ASSET_BG[headerKey]),
        section: huntAnalyzerBgUrl(HUNT_ANALYZER_ASSET_BG[sectionKey])
    };
}

function createHuntAnalyzerTheme(displayName, colors, backgrounds) {
    return { name: displayName, colors, backgrounds };
}

function resolveHuntAnalyzerTheme(themeName) {
    return HUNT_ANALYZER_THEMES[themeName] || HUNT_ANALYZER_THEMES[HUNT_ANALYZER_DEFAULT_THEME_KEY];
}

const HUNT_ANALYZER_THEMES = {
    original: createHuntAnalyzerTheme('Original', {
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
      textSealed: '#666666', // Sealed total / muted tier accent
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
    }, huntAnalyzerPanelBackgrounds('darker', 'dark', 'regular')),
  ice: createHuntAnalyzerTheme('Frosty', {
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
      textSealed: '#90a4ae',  // Muted blue-gray (sealed)
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
    }, huntAnalyzerUniformBackgrounds('blue')),
  poison: createHuntAnalyzerTheme('Venomous', {
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
      textSealed: '#78909c',  // Muted slate (sealed)
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
    }, huntAnalyzerUniformBackgrounds('green')),
  fire: createHuntAnalyzerTheme('Demonic', {
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
      textSealed: '#bcaaa4',  // Warm gray (sealed)
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
    }, huntAnalyzerUniformBackgrounds('red')),
  undead: createHuntAnalyzerTheme('Undead', {
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
      textSealed: '#b0bec5', // Cool gray (sealed)
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
    }, huntAnalyzerPanelBackgrounds('darker', 'dark', 'darker'))
};

function getCurrentTheme() {
  try {
    if (typeof HuntAnalyzerState !== 'undefined' && HuntAnalyzerState.settings?.theme) {
      return resolveHuntAnalyzerTheme(HuntAnalyzerState.settings.theme);
    }
  } catch (_e) {
    // HuntAnalyzerState not yet defined during early CSS injection
  }
  return HUNT_ANALYZER_THEMES[HUNT_ANALYZER_DEFAULT_THEME_KEY];
}

function getThemeColor(colorKey) {
  return getCurrentTheme().colors[colorKey]
        || HUNT_ANALYZER_THEMES[HUNT_ANALYZER_DEFAULT_THEME_KEY].colors.text;
}

function getThemeBackground(backgroundKey) {
  return getCurrentTheme().backgrounds[backgroundKey] || '';
}

const HUNT_ANALYZER_INFO_ELEMENT_IDS = [
  'mod-autoplay-counter',
  'mod-playtime-display',
  'mod-stamina-display',
  'mod-win-loss-display'
];

function applyAccentTitleStyle(element) {
  if (!element) return;
  element.style.color = getThemeColor('textAccent');
  element.style.textShadow = `${getThemeColor('textShadow')} 0px 0px 5px`;
}

function applyThemeFramedDisplaySurface(element) {
  if (!element) return;
  element.style.border = '4px solid transparent';
  element.style.borderImage = 'var(--ha-frame-1)';
  element.style.backgroundColor = getThemeColor('sectionBackground');
  element.style.color = getThemeColor('text');
}

function applyThemeMapFilterDropdownStyles(dropdownButton, dropdownMenu) {
  if (dropdownButton) {
    dropdownButton.style.border = `1px solid ${getThemeColor('border')}`;
    dropdownButton.style.backgroundColor = getThemeColor('dropdownBackground');
    dropdownButton.style.color = getThemeColor('text');
  }
  if (dropdownMenu) {
    dropdownMenu.style.backgroundColor = getThemeColor('dropdownMenuBackground');
    dropdownMenu.style.border = `1px solid ${getThemeColor('border')}`;
    dropdownMenu.style.boxShadow = `0 4px 8px ${getThemeColor('dropdownShadow')}`;
  }
}

function applyThemeResourceTotalColors() {
  HUNT_ANALYZER_PANEL_RESOURCE_TOTALS.forEach(({ amountId, colorKey }) => {
    const el = document.getElementById(amountId);
    if (el) el.style.color = getThemeColor(colorKey);
  });
}

function applyThemeInfoTextColors() {
  HUNT_ANALYZER_INFO_ELEMENT_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.color = getThemeColor('textInfo');
  });
}

function buildHuntAnalyzerCssVariableBlock(theme) {
  return `
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
            --ha-dropdown-option-hover: ${theme.colors.dropdownOptionHover};
            --ha-dropdown-option-selected: ${theme.colors.dropdownOptionSelected};
            --ha-frame-3: url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 fill;
            --ha-frame-1: url("https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png") 4 fill;
            --ha-frame-1-pressed: url("https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png") 4 fill;
            --ha-frame-4: url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch;
        }`;
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
        ${buildHuntAnalyzerCssVariableBlock(theme)}
        
        /* Hunt Analyzer Common Styles */
        .ha-panel-container {
            position: fixed;
            background-image: var(--ha-panel-bg-image);
            background-repeat: repeat;
            background-color: var(--ha-panel-bg);
            border: 6px solid transparent;
            border-image: var(--ha-frame-3);
            color: var(--ha-text);
            padding: 0;
            overflow: hidden;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            height: 100%;
            font-family: Inter, sans-serif;
            border-radius: 6px;
            box-shadow: 0 0 15px var(--ha-panel-shadow);
        }
        
        .ha-header-container {
            display: flex;
            flex-direction: column;
            width: auto;
            background-image: var(--ha-section-bg-image);
            background-repeat: repeat;
            background-color: var(--ha-section-bg-fallback);
            border: ${UI_LAYOUT.FRAME_BORDER};
            border-image: ${UI_LAYOUT.FRAME_BORDER_IMAGE};
            margin: ${UI_LAYOUT.SECTION_MARGIN_NO_TOP};
            padding: ${UI_LAYOUT.SECTION_PADDING};
            box-sizing: border-box;
            flex: 0 0 auto;
        }
        
        .ha-title-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            margin-bottom: 2px;
            cursor: move;
            min-width: 0;
            gap: 4px;
        }
        
        .ha-room-title {
            margin: 0;
            font-size: 14px;
            color: var(--ha-text-accent);
            font-weight: bold;
            text-shadow: 0 0 5px var(--ha-text-shadow);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            flex: 1;
            min-width: 0;
        }
        
        .ha-header-controls {
            display: flex;
            gap: 5px;
        }
        
        .ha-styled-button {
            padding: 2px 10px;
            border: 4px solid transparent;
            border-image: var(--ha-frame-1);
            background-image: var(--ha-header-bg-image);
            background-repeat: repeat;
            background-color: var(--ha-button-bg);
            color: var(--ha-text);
            font-size: 11px;
            font-weight: 700;
            font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
            text-align: center;
            white-space: nowrap;
            box-sizing: border-box;
            cursor: pointer;
            transition: color 0.2s, border-image 0.1s, filter 0.15s;
            box-shadow: 0 2px 5px var(--ha-button-shadow);
            flex-grow: 1;
            min-height: 24px;
            line-height: 1.1;
        }
        
        .ha-styled-button:hover {
            color: var(--ha-text-secondary);
            filter: brightness(1.12);
        }
        
        .ha-styled-button:active {
            border-image: var(--ha-frame-1-pressed);
            filter: brightness(0.95);
        }

        .button-container {
            border: ${UI_LAYOUT.FRAME_BORDER};
            border-image: ${UI_LAYOUT.FRAME_BORDER_IMAGE};
            background-image: var(--ha-section-bg-image);
            background-repeat: repeat;
            background-color: var(--ha-section-bg-fallback);
            box-sizing: border-box;
            margin: ${UI_LAYOUT.SECTION_MARGIN_NO_TOP};
            padding: ${UI_LAYOUT.SECTION_PADDING};
            justify-content: center;
            align-items: center;
            gap: 8px;
        }

        .live-display-section,
        .map-filter-container,
        .loot-container,
        .creature-drop-container {
            margin: ${UI_LAYOUT.SECTION_MARGIN};
            padding: ${UI_LAYOUT.SECTION_PADDING};
            border: ${UI_LAYOUT.FRAME_BORDER};
            border-image: ${UI_LAYOUT.FRAME_BORDER_IMAGE};
            background-image: var(--ha-section-bg-image);
            background-repeat: repeat;
            background-color: var(--ha-section-bg-fallback);
            box-sizing: border-box;
        }

        .map-filter-container {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .map-filter-container #mod-map-filter-row {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        #mod-map-filter-dropdown-button {
            width: 200px;
            min-width: 200px;
            max-width: 200px;
            box-sizing: border-box;
            overflow: hidden;
        }

        #mod-map-filter-dropdown-label {
            flex: 1 1 auto;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        #mod-map-filter-dropdown-arrow {
            flex: 0 0 auto;
        }

        #mod-map-filter-dropdown-menu [data-map-filter-option] {
            color: var(--ha-text);
            background-color: transparent;
        }

        #mod-map-filter-dropdown-menu [data-map-filter-option][data-selected="true"] {
            background-color: var(--ha-dropdown-option-selected);
            color: var(--ha-text-secondary);
        }

        #mod-map-filter-dropdown-menu [data-map-filter-option][data-selected="false"]:hover {
            background-color: var(--ha-dropdown-option-hover);
        }
        
        .ha-icon-button {
            background-color: var(--ha-button-icon-bg);
            border: 4px solid transparent;
            border-image: var(--ha-frame-1);
            color: var(--ha-text);
            padding: 0 6px;
            margin: 0;
            cursor: pointer;
            font-size: 11px;
            line-height: 1.1;
            min-width: 20px;
            min-height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }
        
        .ha-icon-button:hover {
            background-color: var(--ha-button-icon-hover);
            color: var(--ha-text-secondary);
        }
        
        .ha-icon-button:active {
            border-image: var(--ha-frame-1-pressed);
            transform: translateY(1px);
            background-color: var(--ha-border-dark);
        }
        
        .ha-container-section {
            display: flex;
            flex-direction: column;
            flex: 1 1 0;
            min-height: 0;
            margin: ${UI_LAYOUT.SECTION_MARGIN_NO_TOP};
            background-image: var(--ha-section-bg-image);
            background-repeat: repeat;
            background-color: var(--ha-section-bg-fallback);
            border: ${UI_LAYOUT.FRAME_BORDER};
            border-image: var(--ha-frame-4);
            padding: ${UI_LAYOUT.SECTION_PADDING};
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
            border: 4px solid transparent;
            border-image: var(--ha-frame-1);
            background-color: var(--ha-section-bg);
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

function compareLootEntries(a, b) {
    const categoryA = getItemCategory(a);
    const categoryB = getItemCategory(b);
    if (categoryA !== categoryB) return categoryA - categoryB;

    const nameCompare = (a.originalName || '').localeCompare(b.originalName || '');
    if (nameCompare !== 0) return nameCompare;

    if ((a.rarity || 0) !== (b.rarity || 0)) return (b.rarity || 0) - (a.rarity || 0);

    if ((a.gameId || 0) !== (b.gameId || 0)) return (a.gameId || 0) - (b.gameId || 0);
    return 0;
}

function compareCreatureEntries(a, b) {
    if (a.isShiny !== b.isShiny) return a.isShiny ? -1 : 1;
    if (!!a.isSealed !== !!b.isSealed) return a.isSealed ? -1 : 1;

    const nameCompare = (a.originalName || '').localeCompare(b.originalName || '');
    if (nameCompare !== 0) return nameCompare;

    if ((a.tierLevel || 0) !== (b.tierLevel || 0)) return (b.tierLevel || 0) - (a.tierLevel || 0);

    if ((a.gameId || 0) !== (b.gameId || 0)) return (a.gameId || 0) - (b.gameId || 0);
    return 0;
}

function applyFramedSectionStyles(element, { noTopMargin = false } = {}) {
    if (!element) return;
    element.style.backgroundImage = getThemeBackground('section');
    element.style.backgroundRepeat = 'repeat';
    element.style.backgroundColor = getThemeColor('sectionBackgroundFallback');
    element.style.margin = noTopMargin ? UI_LAYOUT.SECTION_MARGIN_NO_TOP : UI_LAYOUT.SECTION_MARGIN;
    element.style.padding = UI_LAYOUT.SECTION_PADDING;
    element.style.border = UI_LAYOUT.FRAME_BORDER;
    element.style.borderImage = UI_LAYOUT.FRAME_BORDER_IMAGE;
    element.style.boxSizing = 'border-box';
}

function attachInlineConfirm(button, { baseText, confirmText, onConfirm, timeoutMs = 4000 }) {
    if (!button || typeof onConfirm !== 'function') return;
    let confirmTimeoutId = null;
    let outsideClickHandler = null;
    let originalWidth = '';
    const resolveBaseText = typeof baseText === 'function' ? baseText : () => baseText;
    const fixedConfirmWidth = button.dataset.fixedConfirmWidth || '';
    const originalBackgroundImage = button.style.backgroundImage || '';
    const originalBackgroundRepeat = button.style.backgroundRepeat || '';
    const originalBackgroundColor = button.style.backgroundColor || '';
    const originalColor = button.style.color || '';
    const originalFilter = button.style.filter || '';

    const resetState = () => {
        button.dataset.confirmArmed = 'false';
        button.textContent = resolveBaseText();
        button.style.width = fixedConfirmWidth || originalWidth;
        button.style.backgroundImage = originalBackgroundImage;
        button.style.backgroundRepeat = originalBackgroundRepeat;
        button.style.backgroundColor = originalBackgroundColor;
        button.style.color = originalColor;
        button.style.filter = originalFilter;
        if (confirmTimeoutId) {
            clearTimeout(confirmTimeoutId);
            confirmTimeoutId = null;
        }
        if (outsideClickHandler) {
            document.removeEventListener('mousedown', outsideClickHandler, true);
            outsideClickHandler = null;
        }
    };

    button.addEventListener('click', () => {
        if (button.dataset.confirmArmed !== 'true') {
            originalWidth = `${button.offsetWidth}px`;
            button.dataset.confirmArmed = 'true';
            button.textContent = confirmText;
            button.style.width = fixedConfirmWidth || originalWidth;
            button.style.backgroundImage = DEMONIC_CONFIRM_BG;
            button.style.backgroundRepeat = 'repeat';
            button.style.backgroundColor = '#8b0000';
            button.style.color = '#ffffff';
            button.style.filter = 'none';
            if (confirmTimeoutId) clearTimeout(confirmTimeoutId);
            confirmTimeoutId = setTimeout(resetState, timeoutMs);

            outsideClickHandler = (event) => {
                if (event.target !== button) {
                    resetState();
                }
            };
            document.addEventListener('mousedown', outsideClickHandler, true);
            return;
        }

        resetState();
        onConfirm();
    });
}

function getClearButtonLabel() {
    if (HuntAnalyzerState.ui.selectedMapFilter === 'ALL') {
        return t('mods.huntAnalyzer.clearAll');
    }
    const localizedClearMap = t('mods.huntAnalyzer.clearMap');
    return localizedClearMap === 'mods.huntAnalyzer.clearMap' ? 'Clear Map' : localizedClearMap;
}

function getGoToMapLabel() {
    const localizedGoToMap = t('mods.huntAnalyzer.goToMap');
    return localizedGoToMap === 'mods.huntAnalyzer.goToMap' ? 'Go to map' : localizedGoToMap;
}

function getFailedToNavigateMapLabel() {
    const localizedFailed = t('mods.huntAnalyzer.failedToNavigateMap');
    return localizedFailed === 'mods.huntAnalyzer.failedToNavigateMap' ? 'Failed to navigate to map' : localizedFailed;
}

function getMapResetLabel() {
    const localizedMapReset = t('mods.huntAnalyzer.mapReset');
    return localizedMapReset === 'mods.huntAnalyzer.mapReset' ? 'Map reset' : localizedMapReset;
}

function refreshClearButtonLabel() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    const clearButton = panel.querySelector('.button-container button:first-child');
    if (!clearButton || clearButton.dataset.confirmArmed === 'true') return;
    clearButton.textContent = getClearButtonLabel();
}

function getRoomIdByMapName(mapName) {
    const roomNames = globalThis.state?.utils?.ROOM_NAME;
    if (!roomNames || !mapName || mapName === 'ALL') return null;

    for (const [roomId, displayName] of Object.entries(roomNames)) {
        if (displayName === mapName) {
            return roomId;
        }
    }
    return null;
}

function navigateToSelectedMapFilter() {
    const selectedMap = HuntAnalyzerState.ui.selectedMapFilter;
    if (!selectedMap || selectedMap === 'ALL') return false;

    const roomId = getRoomIdByMapName(selectedMap);
    if (!roomId || !globalThis.state?.board?.send) return false;

    globalThis.state.board.send({
        type: 'selectRoomById',
        roomId
    });
    return true;
}

function clearAnalyzerDataAndRefresh() {
    const selectedMapFilter = HuntAnalyzerState.ui.selectedMapFilter;
    let resetFeedbackText = t('mods.huntAnalyzer.dataReset');
    if (selectedMapFilter === 'ALL') {
        resetHuntAnalyzerState();
    } else {
        const selectedMapRoomId = getRoomIdByMapName(selectedMapFilter);
        HuntAnalyzerState.data.sessions = HuntAnalyzerState.data.sessions.filter(
            session => (
                session.roomName !== selectedMapFilter &&
                (selectedMapRoomId === null || String(session.roomId) !== String(selectedMapRoomId))
            )
        );
        HuntAnalyzerState.timeTracking.mapTimeMs.delete(selectedMapFilter);
        if (HuntAnalyzerState.timeTracking.currentMap === selectedMapFilter) {
            HuntAnalyzerState.timeTracking.currentMap = null;
            HuntAnalyzerState.timeTracking.mapStartTime = 0;
        }

        // Always return the filter to ALL after a scoped clear.
        HuntAnalyzerState.ui.selectedMapFilter = "ALL";
        dataProcessor.aggregateData();
        flushPersistenceIfEnabled();
        resetFeedbackText = getMapResetLabel();
    }

    const cachedLootDiv = domCache.get("mod-loot-display");
    const cachedCreatureDropDiv = domCache.get("mod-creature-drop-display");
    if (cachedLootDiv) cachedLootDiv.innerHTML = "";
    if (cachedCreatureDropDiv) cachedCreatureDropDiv.innerHTML = "";

    renderAllSessions();
    updateMapFilterDropdown();
    updatePanelDisplay();
    updateCurrentRoomDisplay();
    updatePanelPosition();

    const panel = document.getElementById(PANEL_ID);
    showPanelFeedback(panel, resetFeedbackText, true);
}

function showPanelFeedback(panel, text, isSuccess = true) {
    if (!panel) return;
    const feedbackMessage = document.createElement('div');
    feedbackMessage.textContent = text;
    feedbackMessage.style.position = 'absolute';
    feedbackMessage.style.bottom = '10px';
    feedbackMessage.style.left = '50%';
    feedbackMessage.style.transform = 'translateX(-50%)';
    feedbackMessage.style.backgroundColor = isSuccess ? '#98C379' : '#E06C75';
    feedbackMessage.style.color = '#FFFFFF';
    feedbackMessage.style.padding = '8px 12px';
    feedbackMessage.style.borderRadius = '5px';
    feedbackMessage.style.zIndex = '10001';
    feedbackMessage.style.opacity = '0';
    feedbackMessage.style.transition = 'opacity 0.3s ease-in-out';
    panel.appendChild(feedbackMessage);

    setTimeout(() => {
        feedbackMessage.style.opacity = '1';
    }, 10);

    setTimeout(() => {
        feedbackMessage.style.opacity = '0';
        setTimeout(() => {
            feedbackMessage.remove();
        }, 300);
    }, 1500);
}

// Throttling for frequent updates
let lastUpdateLogTime = 0;

// Track last known values to avoid unnecessary updates
let lastKnownSessionCount = 0;
let lastKnownGold = 0;
let lastKnownDust = 0;
let lastKnownShiny = 0;
let lastKnownSealed = 0;

// Throttling for board subscription to avoid interfering with animations
let lastBoardSubscriptionTime = 0;

// =======================
// 2.2. Constants & Globals
// =======================
const PANEL_ID = "mod-autoplay-analyzer-panel";
const BUTTON_ID = "mod-autoplay-button";
const DUST_ICON_SRC = '/assets/icons/dust.png';
const SEALED_ICON_SRC = 'https://bestiaryarena.com/assets/icons/star-tier-5.png';
const HUNT_ANALYZER_PANEL_RESOURCE_TOTALS = [
    { amountId: 'mod-total-gold-display', totalKey: 'gold', iconSrc: '/assets/icons/goldpile.png', iconAlt: 'Gold', colorKey: 'textGold' },
    { amountId: 'mod-total-dust-display', totalKey: 'dust', iconSrc: DUST_ICON_SRC, iconAlt: 'Dust', colorKey: 'textDust' },
    { amountId: 'mod-total-shiny-display', totalKey: 'shiny', iconSrc: '/assets/icons/shiny-star.png', iconAlt: 'Shiny', colorKey: 'textShiny' },
    { amountId: 'mod-total-sealed-display', totalKey: 'sealed', iconSrc: SEALED_ICON_SRC, iconAlt: 'Sealed', colorKey: 'textSealed' },
    { amountId: 'mod-total-runes-display', totalKey: 'runes', iconSrc: 'https://bestiaryarena.com/assets/icons/rune-blank.png', iconAlt: 'Runes', colorKey: 'textRunes' }
];
const LAYOUT_MODES = {
    VERTICAL: 'vertical',
    HORIZONTAL: 'horizontal',
    MINIMIZED: 'minimized'
};
const LAYOUT_DIMENSIONS = {
    [LAYOUT_MODES.VERTICAL]: { width: 350, height: 750, minWidth: 260, maxWidth: 500, minHeight: 500, maxHeight: 850 },
    [LAYOUT_MODES.HORIZONTAL]: { width: 300, height: 300, minWidth: 650, maxWidth: 1000, minHeight: 360, maxHeight: 400 },
    [LAYOUT_MODES.MINIMIZED]: { width: 270, height: 220, minWidth: 270, maxWidth: 270, minHeight: 220, maxHeight: 220 }
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

const UI_LAYOUT = {
    SECTION_MARGIN: '2px 2px 2px 2px',
    SECTION_MARGIN_NO_TOP: '0 2px 2px 2px',
    SECTION_PADDING: '4px',
    FRAME_BORDER: '6px solid transparent',
    FRAME_BORDER_IMAGE: 'var(--ha-frame-4)'
};
const DEMONIC_CONFIRM_BG = 'url(/_next/static/media/background-red.21d3f4bd.png)';

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
    sealed: 0,
    staminaSpent: 0,
    staminaRecovered: 0,
    experience: 0,
    wins: 0,
    losses: 0,
    dragonPlantCollects: 0,
    dragonPlantBonusGold: 0
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
      persistData: false,
      includeCreatureSellValue: true,
      includeDragonPlantCollect: true,
      includeDisenchantedEquipments: true,
      visibility: {
        sessions: true,
        playtime: true,
        stamina: true,
        winLoss: true,
        goldRate: true,
        creatureRate: true,
        equipmentRate: true,
        runeRate: true,
        expRate: true,
        staminaRate: true,
        goldTotal: true,
        dustTotal: true,
        shinyTotal: true,
        sealedTotal: true,
        runesTotal: true
      }
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

function huntAnalyzerHasRecordedBattles() {
  return HuntAnalyzerState.data.sessions.length > 0;
}

// After the first completed hunt, align baselines so pre-battle idle time is not counted.
function syncTimeTrackingAfterFirstRecordedBattle() {
  if (HuntAnalyzerState.data.sessions.length !== 1) return;
  const mode = getCurrentMode();
  if (mode === 'autoplay') {
    const currentAutoplayTime = getAutoplaySessionTime();
    HuntAnalyzerState.timeTracking.autoplayBaselineMinutes = currentAutoplayTime || 0;
    HuntAnalyzerState.timeTracking.lastAutoplayTime = currentAutoplayTime || 0;
    HuntAnalyzerState.timeTracking.suppressNextAutoplayReset = true;
    HuntAnalyzerState.timeTracking.manualActive = false;
    HuntAnalyzerState.timeTracking.manualSessionStartMs = 0;
  } else if (mode === 'manual') {
    HuntAnalyzerState.timeTracking.manualActive = true;
    HuntAnalyzerState.timeTracking.manualSessionStartMs = Date.now();
  }
}

function getLiveSessionMs() {
  if (!huntAnalyzerHasRecordedBattles()) {
    return 0;
  }
  const mode = getCurrentMode();
  if (mode === 'autoplay') {
    const currentAutoplayTime = getAutoplaySessionTime(); // minutes
    if (currentAutoplayTime && currentAutoplayTime > 0) {
      const baseline = HuntAnalyzerState.timeTracking.autoplayBaselineMinutes || 0;
      // Validate: baseline should not exceed current time (prevents negative calculations)
      const adjustedAutoplayMinutes = Math.max(0, currentAutoplayTime - Math.min(baseline, currentAutoplayTime));
      return adjustedAutoplayMinutes * 60 * 1000;
    }
    return 0;
  }
  if (mode === 'manual') {
    if (HuntAnalyzerState.timeTracking.manualActive && HuntAnalyzerState.timeTracking.manualSessionStartMs > 0) {
      const elapsed = Date.now() - HuntAnalyzerState.timeTracking.manualSessionStartMs;
      // Validate: ensure non-negative time
      return Math.max(0, elapsed);
    }
    return 0;
  }
  return 0;
}

function snapshotIntoTotals() {
  if (!huntAnalyzerHasRecordedBattles()) {
    return 0;
  }
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

// Maximum number of sessions to keep (memory + IndexedDB)
const MAX_SESSIONS_TO_KEEP = 100000;

const HUNT_ANALYZER_IDB_NAME = 'bestiary-hunt-analyzer';
const HUNT_ANALYZER_IDB_VERSION = 1;
const HUNT_ANALYZER_IDB_STORE = 'sessions';

let _needsAggregateFromSessions = false;
let _persistenceLoadComplete = false;
let _idbAvailable = true;
let _saveInFlight = null;
let _saveScheduleTimeoutId = null;

function getEmbeddedSessionsFromManifest(parsedData) {
    if (!parsedData || !Array.isArray(parsedData.sessions) || parsedData.sessions.length === 0) {
        return [];
    }
    return parsedData.sessions;
}

function isNumericHuntSpriteId(spriteId) {
    return spriteId != null && (typeof spriteId === 'number' || /^\d+$/.test(String(spriteId)));
}

// Strip UI-only / recomputable fields so JSON stays small (runtime state unchanged).
function slimLootItemForPersistence(item) {
    if (!item || typeof item !== 'object') return item;
    const out = {
        count: item.count,
        originalName: item.originalName,
        rarity: item.rarity,
        spriteId: item.spriteId,
        isEquipment: !!item.isEquipment,
        gameId: item.gameId != null ? item.gameId : null,
        stat: item.stat != null ? item.stat : null
    };
    if (item._descriptiveRarity) out._descriptiveRarity = item._descriptiveRarity;
    if (!isNumericHuntSpriteId(item.spriteId)) {
        const src = item.src || item.spriteSrc;
        if (src) out.src = src;
    }
    return out;
}

function slimCreatureForPersistence(creature) {
    if (!creature || typeof creature !== 'object') return creature;
    return {
        count: creature.count,
        originalName: creature.originalName,
        tierLevel: creature.tierLevel,
        tierName: creature.tierName,
        totalStats: creature.totalStats,
        gameId: creature.gameId,
        creatureId: creature.creatureId ?? null,
        sellValue: parsePossibleGoldValue(creature.sellValue),
        isShiny: !!creature.isShiny,
        isSealed: !!creature.isSealed
    };
}

// Guard flag: if a load fails (corrupt JSON, etc.), block auto-save from overwriting
let _persistenceLoadFailed = false;

// Track consecutive save failures so we can warn the user
let _consecutiveSaveFailures = 0;

/** Numeric total fields persisted and merged on load (max of stored vs session-derived). */
const HUNT_ANALYZER_TOTAL_COUNTER_KEYS = [
    'gold', 'creatures', 'equipment', 'runes', 'dust', 'shiny', 'sealed',
    'staminaSpent', 'staminaRecovered', 'experience', 'wins', 'losses',
    'dragonPlantCollects', 'dragonPlantBonusGold'
];

function normalizeTotalsCounter(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function getTotalsSnapshot(source = HuntAnalyzerState.totals) {
    const snap = {};
    for (const key of HUNT_ANALYZER_TOTAL_COUNTER_KEYS) {
        snap[key] = normalizeTotalsCounter(source[key]);
    }
    return snap;
}

function applyTotalsSnapshot(snapshot, target = HuntAnalyzerState.totals) {
    for (const key of HUNT_ANALYZER_TOTAL_COUNTER_KEYS) {
        target[key] = normalizeTotalsCounter(snapshot[key]);
    }
}

function resetTotalsCounters() {
    applyTotalsSnapshot({}, HuntAnalyzerState.totals);
}

function mergeTotalsPreferHigher(persisted, derived) {
    const merged = {};
    for (const key of HUNT_ANALYZER_TOTAL_COUNTER_KEYS) {
        merged[key] = Math.max(
            normalizeTotalsCounter(persisted?.[key]),
            normalizeTotalsCounter(derived?.[key])
        );
    }
    return merged;
}

function syncSessionCountFromPersistence() {
    const fromSessions = HuntAnalyzerState.data.sessions.length;
    const fromWinsLosses = (HuntAnalyzerState.totals.wins || 0) + (HuntAnalyzerState.totals.losses || 0);
    HuntAnalyzerState.session.count = Math.max(
        HuntAnalyzerState.session.count || 0,
        fromSessions,
        fromWinsLosses
    );
}

function hasPersistedAnalyzerStats() {
    const totals = HuntAnalyzerState.totals;
    return HuntAnalyzerState.timeTracking.accumulatedTimeMs > 0
        || HuntAnalyzerState.session.count > 0
        || totals.gold > 0
        || totals.wins > 0
        || totals.losses > 0
        || totals.experience > 0
        || totals.staminaSpent > 0;
}

function rebuildAggregatesFromSessionsWithMerge() {
    const persistedTotals = getTotalsSnapshot();
    dataProcessor.aggregateData();
    applyTotalsSnapshot(mergeTotalsPreferHigher(persistedTotals, getTotalsSnapshot()));
    syncSessionCountFromPersistence();
}

/** Localized via mods.huntAnalyzer.storagePrunedWarning ({kept}, {total}) and storageResetDismissHint. */
function getStoragePrunedWarning(kept, total) {
    try {
        if (typeof api !== 'undefined' && api?.i18n?.t) {
            const msg = api.i18n.t('mods.huntAnalyzer.storagePrunedWarning');
            if (msg && msg !== 'mods.huntAnalyzer.storagePrunedWarning') {
                return msg.replace(/\{kept\}/g, String(kept)).replace(/\{total\}/g, String(total))
                    + getHuntAnalyzerStorageResetDismissHint();
            }
        }
    } catch (_e) { /* fall through */ }
    return `Battle history capped at ${MAX_SESSIONS_TO_KEEP.toLocaleString()}: kept ${kept} of ${total} battles. Totals and playtime are unchanged.${getHuntAnalyzerStorageResetDismissHint()}`;
}

/** Localized via mods.huntAnalyzer.storageQuotaWarning and storageResetDismissHint. */
function getStorageQuotaWarning() {
    try {
        if (typeof api !== 'undefined' && api?.i18n?.t) {
            const msg = api.i18n.t('mods.huntAnalyzer.storageQuotaWarning');
            if (msg && msg !== 'mods.huntAnalyzer.storageQuotaWarning') {
                return msg + getHuntAnalyzerStorageResetDismissHint();
            }
        }
    } catch (_e) { /* fall through */ }
    return `Could not save analyzer data (storage quota). Totals and playtime may be saved; use Export to back up.${getHuntAnalyzerStorageResetDismissHint()}`;
}

/** Localized via mods.huntAnalyzer.storageResetDismissHint ({clearAll}) and clearAll. */
function getHuntAnalyzerStorageResetDismissHint() {
    let clearLabel = 'Clear All';
    try {
        if (typeof api !== 'undefined' && api?.i18n?.t) {
            const lbl = api.i18n.t('mods.huntAnalyzer.clearAll');
            if (lbl && typeof lbl === 'string' && lbl !== 'mods.huntAnalyzer.clearAll') {
                clearLabel = lbl;
            }
        }
    } catch (_e) { /* keep default */ }

    try {
        if (typeof api !== 'undefined' && api?.i18n?.t) {
            const hintT = api.i18n.t('mods.huntAnalyzer.storageResetDismissHint');
            if (hintT && hintT !== 'mods.huntAnalyzer.storageResetDismissHint') {
                return ' ' + hintT.replace(/\{clearAll\}/g, clearLabel);
            }
        }
    } catch (_e) { /* fall through */ }

    return ` Use ${clearLabel} to reset the analyzer—the warning stops once storage has room.`;
}

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
  
  HuntAnalyzerState.timeTracking.clockIntervalId = setInterval(() => {
    updateInternalClock();
  }, 1000); // Update every second
}

// Stop the internal clock system
function stopInternalClock() {
  if (HuntAnalyzerState.timeTracking.clockIntervalId) {
    clearInterval(HuntAnalyzerState.timeTracking.clockIntervalId);
    HuntAnalyzerState.timeTracking.clockIntervalId = null;
  }
}

// =======================
// 2.7.a Manual Runner Coordination
// =======================
// Manual Runner coordination is now handled event-driven in updateInternalClock()
// No polling needed - manual timing is already started on newGame events and mode changes

// Update the internal clock by watching DOM autoplay timer
function updateInternalClock() {
  const currentAutoplayTime = getAutoplaySessionTime();
  if (!huntAnalyzerHasRecordedBattles()) {
    HuntAnalyzerState.timeTracking.lastAutoplayTime = currentAutoplayTime;
    return;
  }
  const nowMs = Date.now();
  const mode = getCurrentMode();
  const isAutoplayRunning = mode === 'autoplay' && currentAutoplayTime && currentAutoplayTime > 0;
  // Lightweight heartbeat only when something interesting changes below
  
  // Check Manual Runner coordination (event-driven, no polling)
  // If Manual Runner is running and we're in manual mode, ensure timing is active
  if (mode === 'manual' && !HuntAnalyzerState.timeTracking.manualActive) {
    try {
      const manualRunnerRunning = window.ModCoordination?.isModActive('Manual Runner') || false;
      if (manualRunnerRunning) {
        HuntAnalyzerState.timeTracking.manualActive = true;
        HuntAnalyzerState.timeTracking.manualSessionStartMs = Date.now();
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
    }
  }
  
  // If autoplay time decreased (session reset), accumulate the previous time
  if (currentAutoplayTime < HuntAnalyzerState.timeTracking.lastAutoplayTime) {
    if (HuntAnalyzerState.timeTracking.suppressNextAutoplayReset) {
      // We already snapshotted this segment on a recent map/mode change; skip double-counting
      HuntAnalyzerState.timeTracking.suppressNextAutoplayReset = false;
    } else {
      // Validate: ensure lastAutoplayTime is positive before calculating
      if (HuntAnalyzerState.timeTracking.lastAutoplayTime > 0) {
        const timeToAccumulate = HuntAnalyzerState.timeTracking.lastAutoplayTime * 60 * 1000; // Convert minutes to ms
        
        // Validate: ensure timeToAccumulate is positive
        if (timeToAccumulate > 0) {
          // Add to accumulated time
          HuntAnalyzerState.timeTracking.accumulatedTimeMs += timeToAccumulate;
          
          // Add to current map time if we have one
          if (HuntAnalyzerState.timeTracking.currentMap) {
            const currentMapTime = HuntAnalyzerState.timeTracking.mapTimeMs.get(HuntAnalyzerState.timeTracking.currentMap) || 0;
            HuntAnalyzerState.timeTracking.mapTimeMs.set(HuntAnalyzerState.timeTracking.currentMap, currentMapTime + timeToAccumulate);
          }
        }
      }
    }
  }
  
  // Track last DOM-reported autoplay minutes
  const prevAutoplayTime = HuntAnalyzerState.timeTracking.lastAutoplayTime;
  HuntAnalyzerState.timeTracking.lastAutoplayTime = currentAutoplayTime;
  
  // Only when actually in autoplay mode, detect transition from >0 → 0 and reset baseline
  if (mode === 'autoplay' && prevAutoplayTime > 0 && currentAutoplayTime === 0) {
    HuntAnalyzerState.timeTracking.autoplayBaselineMinutes = 0;
  }
}

// Track map change and start timing for new map
function trackMapChange(roomName) {
  // If we're switching maps, just update context. Accumulation is handled by snapshotIntoTotals() upstream.
  const mapChanged = HuntAnalyzerState.timeTracking.currentMap && HuntAnalyzerState.timeTracking.currentMap !== roomName;

  // Set new current map
  HuntAnalyzerState.timeTracking.currentMap = roomName;
  HuntAnalyzerState.timeTracking.mapStartTime = Date.now();
  
  // If in manual mode and map actually changed, start a new manual session window from now
  if (mapChanged && HuntAnalyzerState.timeTracking.manualActive) {
    HuntAnalyzerState.timeTracking.manualSessionStartMs = Date.now();
  }
}

// Wall-clock span from session timestamps for one map (used when per-map clock ms is missing).
function getMapSessionWallClockSpanMs(roomName) {
  const list = HuntAnalyzerState.data.sessions.filter(s => s.roomName === roomName);
  const ts = list.map(s => s.timestamp).filter(t => typeof t === 'number' && t > 0);
  if (ts.length < 2) return 0;
  return Math.max(0, Math.max(...ts) - Math.min(...ts));
}

// Get filtered time for rate calculations
function getFilteredTimeHours() {
  const liveMs = getLiveSessionMs();
  const allTrackedMs = HuntAnalyzerState.timeTracking.accumulatedTimeMs + liveMs;
  if (HuntAnalyzerState.ui.selectedMapFilter === "ALL") {
    return allTrackedMs / (1000 * 60 * 60);
  }
  const filter = HuntAnalyzerState.ui.selectedMapFilter;
  // Primary: per-map clock + live segment when currently on that map
  let totalTimeMs = HuntAnalyzerState.timeTracking.mapTimeMs.get(filter) || 0;
  if (HuntAnalyzerState.timeTracking.currentMap === filter) {
    totalTimeMs += liveMs;
  }
  if (totalTimeMs <= 0) {
    // Reload / key mismatch / clock never split by map: estimate from session timestamps on this map
    totalTimeMs = getMapSessionWallClockSpanMs(filter);
  }
  if (totalTimeMs <= 0) {
    // Last resort: assume this map’s sessions used a fair share of total tracked playtime
    const mapSessions = HuntAnalyzerState.data.sessions.filter(s => s.roomName === filter).length;
    const totalSessions = HuntAnalyzerState.data.sessions.length;
    if (mapSessions > 0 && totalSessions > 0 && allTrackedMs > 0) {
      totalTimeMs = allTrackedMs * (mapSessions / totalSessions);
    }
  }
  return totalTimeMs / (1000 * 60 * 60);
}

function getFilteredSessionCount() {
  if (HuntAnalyzerState.ui.selectedMapFilter === "ALL") {
    return HuntAnalyzerState.session.count;
  }
  return HuntAnalyzerState.data.sessions.filter(
    (session) => session.roomName === HuntAnalyzerState.ui.selectedMapFilter
  ).length;
}

function getFilteredDurationMs(filteredTimeHours = getFilteredTimeHours()) {
  return filteredTimeHours * 60 * 60 * 1000;
}

function smoothHourlyRate(numerator, filteredTimeHours, roundFn = Math.floor) {
  if (filteredTimeHours <= 0) return 0;
  const actualRate = roundFn(numerator / filteredTimeHours);
  return getSmoothedRate(actualRate, getFilteredDurationMs(filteredTimeHours));
}

function calculateSmoothedPanelRates(filteredTimeHours = getFilteredTimeHours()) {
  const goldBreakdown = getFilteredGoldBreakdown();
  return {
    gold: smoothHourlyRate(goldBreakdown.total, filteredTimeHours),
    creature: smoothHourlyRate(HuntAnalyzerState.totals.creatures, filteredTimeHours),
    equipment: smoothHourlyRate(HuntAnalyzerState.totals.equipment, filteredTimeHours, Math.round),
    rune: smoothHourlyRate(HuntAnalyzerState.totals.runes, filteredTimeHours, Math.round),
    staminaSpent: smoothHourlyRate(HuntAnalyzerState.totals.staminaSpent, filteredTimeHours)
  };
}

// Format playtime for display
function formatPlaytime(hours) {
  const totalSeconds = Math.floor(hours * 3600);
  
  const displayHours = Math.floor(totalSeconds / 3600);
  const displayMinutes = Math.floor((totalSeconds % 3600) / 60);
  const displaySeconds = totalSeconds % 60;
  
  return `${displayHours.toString().padStart(2, '0')}:${displayMinutes.toString().padStart(2, '0')}:${displaySeconds.toString().padStart(2, '0')}`;
}

function formatPlaytimeLabel(playtimeText) {
  return `${t('mods.huntAnalyzer.playtime')}: ${playtimeText}`;
}

/** Rounds to nearest integer; |n| >= 1000 renders as K with two fraction digits (locale-aware), e.g. 1,84K or 1.84K. */
function formatCompactInt(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return String(value);
  if (Math.abs(n) < 1000) return String(n);
  const sign = n < 0 ? '-' : '';
  const kVal = Math.abs(n) / 1000;
  const kStr = kVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}${kStr}K`;
}

/** Format experience values: <1K raw, >=1K as K, >=1KK (1,000,000) as KK. */
function formatExpValue(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return String(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs < 1000) return String(n);
  if (abs < 1000000) {
    const kVal = abs / 1000;
    const kStr = kVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${sign}${kStr}K`;
  }
  const kkVal = abs / 1000000;
  const kkStr = kkVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}${kkStr}KK`;
}

/**
 * Battle EXP from serverResults (number or numeric string). Some builds only set rewardScreen;
 * others may mirror under next. Invalid values return 0.
 */
function parseBattleExpReward(rewardScreen, serverResults) {
  const raw = rewardScreen?.expReward ?? serverResults?.next?.expReward;
  if (raw === undefined || raw === null || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

/** Sum a session's stored experience without string-concat bugs from legacy saves. */
function sessionStoredExperience(session) {
  const n = Number(session?.experience);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

/** Full integer for tooltips (locale-formatted, no K suffix). */
function formatExactInt(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatWinLossLabel(wins, losses, winRate) {
  return `${t('mods.huntAnalyzer.winLoss')}: ${wins}/${losses} (${winRate}%)`;
}

function formatTotalStaminaLabel(totalStamina) {
  return `${t('mods.huntAnalyzer.totalStamina')}: ${formatCompactInt(totalStamina)}`;
}

function formatStaminaRateLabel(staminaPerHour, netStaminaPerHour, recoveryEfficiency) {
  return `${t('mods.huntAnalyzer.staminaPerHour')}: ${formatCompactInt(staminaPerHour)} (${t('mods.huntAnalyzer.net')}: ${netStaminaPerHour > 0 ? '+' : ''}${formatCompactInt(netStaminaPerHour)}/h) [${recoveryEfficiency}% ${t('mods.huntAnalyzer.recovery')}]`;
}

function formatStaminaRateTooltip(staminaPerHour, netStaminaPerHour, recoveryEfficiency) {
  return `${t('mods.huntAnalyzer.staminaPerHour')}: ${formatExactInt(staminaPerHour)} (${t('mods.huntAnalyzer.net')}: ${netStaminaPerHour > 0 ? '+' : ''}${formatExactInt(netStaminaPerHour)}/h) [${recoveryEfficiency}% ${t('mods.huntAnalyzer.recovery')}]`;
}

function setStaminaRateLineElement(element, staminaPerHour, netStaminaPerHour, recoveryEfficiency) {
  if (!element) return;
  element.textContent = formatStaminaRateLabel(staminaPerHour, netStaminaPerHour, recoveryEfficiency);
  element.setAttribute('title', formatStaminaRateTooltip(staminaPerHour, netStaminaPerHour, recoveryEfficiency));
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
let visibilityChangeHandler = null;
let pageHideHandler = null;
let persistenceSaveDebounceTimeoutId = null;
let huntAnalyzerOriginalFetch = null;
let huntAnalyzerFetchWrapper = null;
const huntAnalyzerCreatureSellByMonsterId = new Map();
const huntAnalyzerPendingCreatureSellEvents = [];
const huntAnalyzerPendingDisenchantDustEvents = [];
let huntAnalyzerLastObservedPlantGold = null;
let huntAnalyzerLastCollectedPlantGoldValue = 0;
let huntAnalyzerPlantCollectBurstTimeoutId = null;
const HUNT_ANALYZER_PLANT_COLLECT_BURST_MS = 12000;
const DRAGON_PLANT_COLLECT_BONUS_RATE = 0.05;

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

// Initialize persistence system
// Inject styles after state is defined (needed for theme system)
injectHuntAnalyzerStyles();
loadHuntAnalyzerSettings();
loadHuntAnalyzerState();

// Ensure map filter is set to "ALL" on initialization
HuntAnalyzerState.ui.selectedMapFilter = "ALL";

// Do not resume manual timing after reload; require a fresh newGame or autoplay
HuntAnalyzerState.timeTracking.manualActive = false;
HuntAnalyzerState.timeTracking.manualSessionStartMs = 0;

// Initialize internal clock system
// Do not start internal clock on init; it will start on first newGame/manual or autoplay detection

// Auto-reopen is handled during persistence initialization.

// =======================
// 2.10. Data Persistence System
// =======================

// Function to create inventory-style creature portrait like the game does
function createInventoryStyleCreaturePortrait(creatureData) {
    const containerSlot = createContainerSlot('34px');
    containerSlot.className = 'container-slot surface-darker relative flex items-center justify-center overflow-hidden';
    
    // Rarity/sealed border
    const rarityDiv = creatureData.isSealed
        ? (() => {
            const sealedBorder = document.createElement('div');
            sealedBorder.className = 'rarity-sealed absolute inset-0 z-1 opacity-80';
            sealedBorder.setAttribute('role', 'none');
            return sealedBorder;
        })()
        : createRarityBorder(creatureData.tierLevel || 1);
    
    // Creature image
    const img = document.createElement('img');
    img.src = `/assets/portraits/${creatureData.gameId}.png`;
    img.alt = creatureData.originalName;
    img.className = 'pixelated ml-auto';
    img.style.width = '32px';
    img.style.height = '32px';
    img.style.objectFit = 'contain';
    
    // Level count
    const levelSpan = document.createElement('span');
    levelSpan.className = 'pixel-font-16 absolute bottom-0 left-0 z-1 flex size-full items-end pl-0.5 text-whiteExp';
    levelSpan.style.position = 'absolute';
    levelSpan.style.bottom = '0px';
    levelSpan.style.left = '0px';
    levelSpan.style.color = 'white';
    levelSpan.style.fontSize = '14px';
    levelSpan.style.background = 'radial-gradient(circle at left bottom, rgba(0, 0, 0, 0.5) 6px, transparent 24px)';
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

    if (creatureData.isSealed) {
        const sealedIcon = document.createElement('img');
        sealedIcon.src = SEALED_ICON_SRC;
        sealedIcon.className = 'tier-stars pixelated absolute right-0 top-0 z-2 opacity-75';
        sealedIcon.alt = 'Sealed';
        sealedIcon.title = 'Sealed';
        sealedIcon.style.width = '9px';
        sealedIcon.style.height = '10px';
        sealedIcon.style.filter = 'drop-shadow(black 0px 0px 1px)';
        containerSlot.appendChild(sealedIcon);
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
    const containerSlot = createContainerSlot('34px');
    
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
    img.style.maxWidth = '34px';
    img.style.maxHeight = '34px';
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

function extractEquipmentStatFromGameData(gameId) {
    if (!gameId || typeof globalThis.state?.utils?.getEquipment !== 'function') return null;
    try {
        const equipData = globalThis.state.utils.getEquipment(gameId);
        if (!equipData) return null;
        if (equipData.metadata?.stat) return equipData.metadata.stat;
        if (equipData.stats?.length > 0) return equipData.stats[0].type;
    } catch (_e) { /* ignore */ }
    return null;
}

function shouldRegenerateLootVisual(value) {
    if (!(value.visual instanceof HTMLElement)) return true;
    return !!(value.isEquipment && typeof globalThis.state?.utils?.getEquipment === 'function' && value.gameId);
}

function regenerateLootAggregateVisual(value) {
    if (!shouldRegenerateLootVisual(value)) return false;
    if (value.isEquipment && !value.gameId && value.spriteId) {
        value.gameId = value.spriteId;
    }
    if (value.isEquipment && value.gameId && !value.stat) {
        const stat = extractEquipmentStatFromGameData(value.gameId);
        if (stat) value.stat = stat;
    }
    value.visual = resolveLootGridVisual(value);
    return value.visual instanceof HTMLElement;
}

function regenerateCreatureAggregateVisual(value) {
    if (value.visual instanceof HTMLElement) return false;
    value.visual = resolveCreatureGridVisual(value);
    return true;
}

// Regenerate missing or stale portrait visuals when the game API becomes available.
function regenerateAllVisuals() {
    if (!globalThis.state?.utils) {
        console.log('[Hunt Analyzer] Game API not available yet, skipping visual regeneration');
        return;
    }

    HuntAnalyzerState.data.aggregatedLoot.forEach((value) => {
        regenerateLootAggregateVisual(value);
    });
    HuntAnalyzerState.data.aggregatedCreatures.forEach((value) => {
        regenerateCreatureAggregateVisual(value);
    });

    renderAllSessions();
}

function logPersistenceOperation(operation, success = true) {
    if (!success) {
        console.error(`[Hunt Analyzer] Persistence: ${operation} failed`);
    }
}

// Clean session data for persistence: drop DOM visuals and nonessential fields (see slim* helpers).
function cleanSessionData(sessions) {
    return sessions.map(session => {
        const capturedCreatureSellValues = Array.isArray(session.capturedCreatureSellValues)
            ? session.capturedCreatureSellValues
                .map((entry) => ({
                    monsterId: typeof entry?.monsterId === 'string' ? entry.monsterId : null,
                    goldValue: Math.max(0, Math.floor(Number(entry?.goldValue) || 0)),
                    dustValue: Math.max(0, Math.floor(Number(entry?.dustValue) || 0))
                }))
                .filter((entry) => entry.goldValue > 0 || entry.dustValue > 0)
            : [];
        const capturedDisenchantDustValues = Array.isArray(session.capturedDisenchantDustValues)
            ? session.capturedDisenchantDustValues
                .map((entry) => ({
                    equipmentId: typeof entry?.equipmentId === 'string' ? entry.equipmentId : null,
                    dustValue: Math.max(0, Math.floor(Number(entry?.dustValue) || 0))
                }))
                .filter((entry) => entry.dustValue > 0)
            : [];
        return {
            message: session.message,
            roomId: session.roomId,
            roomName: session.roomName,
            floor: typeof session.floor === 'number' ? session.floor : null,
            timestamp: session.timestamp,
            staminaSpent: session.staminaSpent,
            staminaRecovered: session.staminaRecovered,
            experience: sessionStoredExperience(session),
            victory: session.victory,
            gold: Math.max(0, Math.floor(Number(session.gold) || 0)),
            dust: Math.max(0, Math.floor(Number(session.dust) || 0)),
            capturedCreatureSellValues,
            capturedDisenchantDustValues,
            loot: (session.loot || []).map(slimLootItemForPersistence),
            creatures: (session.creatures || []).map(slimCreatureForPersistence)
        };
    });
}

/** Only known counter fields — avoids persisting stray props (e.g. legacy render-only `loot`). */
function getTotalsSnapshotForPersistence() {
    return getTotalsSnapshot();
}

function buildHuntAnalyzerManifestPayload() {
    const mapTimeMsArray = Array.from(HuntAnalyzerState.timeTracking.mapTimeMs.entries());
    return {
        totals: getTotalsSnapshotForPersistence(),
        session: HuntAnalyzerState.session,
        timeTracking: {
            currentMap: HuntAnalyzerState.timeTracking.currentMap,
            mapStartTime: HuntAnalyzerState.timeTracking.mapStartTime,
            accumulatedTimeMs: HuntAnalyzerState.timeTracking.accumulatedTimeMs,
            mapTimeMs: mapTimeMsArray,
            lastAutoplayTime: HuntAnalyzerState.timeTracking.lastAutoplayTime,
            manualActive: false,
            manualSessionStartMs: 0,
            autoplayBaselineMinutes: HuntAnalyzerState.timeTracking.autoplayBaselineMinutes
        }
    };
}

function openHuntAnalyzerIndexedDb() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB unavailable'));
            return;
        }
        const request = indexedDB.open(HUNT_ANALYZER_IDB_NAME, HUNT_ANALYZER_IDB_VERSION);
        request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(HUNT_ANALYZER_IDB_STORE)) {
                const store = db.createObjectStore(HUNT_ANALYZER_IDB_STORE, { keyPath: 'id', autoIncrement: true });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('roomName', 'roomName', { unique: false });
            }
        };
        request.onsuccess = () => resolve(request.result);
    });
}

function sortSessionsByTimestampAsc(sessions) {
    return [...sessions].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}

function limitSessionsNewestFirst(sessions, maxCount = MAX_SESSIONS_TO_KEEP) {
    if (sessions.length <= maxCount) return sessions;
    return [...sessions]
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, maxCount);
}

/** Trim in-memory sessions to MAX_SESSIONS_TO_KEEP (newest first). Returns number removed. */
function applySessionCapToState() {
    const before = HuntAnalyzerState.data.sessions.length;
    if (before <= MAX_SESSIONS_TO_KEEP) {
        return 0;
    }
    HuntAnalyzerState.data.sessions = limitSessionsNewestFirst(HuntAnalyzerState.data.sessions);
    const prunedCount = before - HuntAnalyzerState.data.sessions.length;
    console.log(`[Hunt Analyzer] Pruned ${prunedCount} old sessions (kept ${HuntAnalyzerState.data.sessions.length} most recent)`);
    return prunedCount;
}

async function idbReplaceAllSessions(sessions) {
    if (!_idbAvailable) return;
    const limited = limitSessionsNewestFirst(sessions);
    const db = await openHuntAnalyzerIndexedDb();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(HUNT_ANALYZER_IDB_STORE, 'readwrite');
        const store = tx.objectStore(HUNT_ANALYZER_IDB_STORE);
        store.clear();
        for (const session of limited) {
            const row = { ...session };
            delete row.id;
            store.add(row);
        }
        tx.oncomplete = () => {
            db.close();
            resolve();
        };
        tx.onerror = () => {
            db.close();
            reject(tx.error || new Error('IndexedDB write failed'));
        };
        tx.onabort = () => {
            db.close();
            reject(tx.error || new Error('IndexedDB transaction aborted'));
        };
    });
}

async function idbLoadAllSessions() {
    if (!_idbAvailable) return [];
    const db = await openHuntAnalyzerIndexedDb();
    try {
        const rows = await new Promise((resolve, reject) => {
            const tx = db.transaction(HUNT_ANALYZER_IDB_STORE, 'readonly');
            const req = tx.objectStore(HUNT_ANALYZER_IDB_STORE).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error || new Error('IndexedDB read failed'));
            tx.onerror = () => reject(tx.error);
        });
        return sortSessionsByTimestampAsc(rows.map((row) => {
            const { id, ...session } = row;
            return session;
        }));
    } finally {
        db.close();
    }
}

async function idbClearAllSessions() {
    if (!_idbAvailable) return;
    const db = await openHuntAnalyzerIndexedDb();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(HUNT_ANALYZER_IDB_STORE, 'readwrite');
        tx.objectStore(HUNT_ANALYZER_IDB_STORE).clear();
        tx.oncomplete = () => {
            db.close();
            resolve();
        };
        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };
    });
}

async function saveHuntAnalyzerDataAsync() {
    if (_persistenceLoadFailed) {
        console.warn('[Hunt Analyzer] Skipping save — previous load failed. This prevents overwriting recoverable data.');
        return;
    }
    if (!_persistenceLoadComplete) {
        return;
    }

    try {
        snapshotIntoTotals();
        const beforePrune = HuntAnalyzerState.data.sessions.length;
        const prunedInMemory = applySessionCapToState();

        const cleanSessions = cleanSessionData(HuntAnalyzerState.data.sessions);
        const manifest = buildHuntAnalyzerManifestPayload();

        localStorage.setItem(HUNT_ANALYZER_STORAGE_KEY, JSON.stringify(manifest));

        if (_idbAvailable) {
            try {
                await idbReplaceAllSessions(cleanSessions);
                if (prunedInMemory > 0) {
                    showSaveWarning(getStoragePrunedWarning(
                        HuntAnalyzerState.data.sessions.length,
                        beforePrune
                    ));
                }
            } catch (idbError) {
                console.error('[Hunt Analyzer] IndexedDB save failed:', idbError);
                _consecutiveSaveFailures++;
                showSaveWarning(`Battle history could not be saved to IndexedDB. Totals and playtime were saved.${getHuntAnalyzerStorageResetDismissHint()}`);
            }
        }

        _consecutiveSaveFailures = 0;
        logPersistenceOperation('Data save');
    } catch (error) {
        _consecutiveSaveFailures++;
        console.error('[Hunt Analyzer] Error saving data:', error);
        logPersistenceOperation('Data save', false);
        if (error.name === 'QuotaExceededError' || error.message?.includes('quota')) {
            showSaveWarning(getStorageQuotaWarning());
        } else if (_consecutiveSaveFailures >= 3) {
            showSaveWarning(`Multiple save failures detected. Use "Copy Log" to back up your data.${getHuntAnalyzerStorageResetDismissHint()}`);
        }
    }
}

function saveHuntAnalyzerData() {
    if (_saveScheduleTimeoutId) {
        clearTimeout(_saveScheduleTimeoutId);
    }
    _saveScheduleTimeoutId = setTimeout(() => {
        _saveScheduleTimeoutId = null;
        if (_saveInFlight) {
            _saveInFlight.then(() => saveHuntAnalyzerDataAsync()).catch(() => {});
            return;
        }
        _saveInFlight = saveHuntAnalyzerDataAsync().finally(() => {
            _saveInFlight = null;
        });
    }, 50);
}

async function flushHuntAnalyzerDataAsync() {
    if (_saveScheduleTimeoutId) {
        clearTimeout(_saveScheduleTimeoutId);
        _saveScheduleTimeoutId = null;
    }
    if (_saveInFlight) {
        await _saveInFlight.catch(() => {});
    }
    await saveHuntAnalyzerDataAsync();
}

function showSaveWarning(message) {
    const panel = document.getElementById(PANEL_ID);
    if (panel) {
        showPanelFeedback(panel, message, false);
    }
    console.warn(`[Hunt Analyzer] ⚠ ${message}`);
}

function applyHuntAnalyzerManifest(parsedData) {
    if (parsedData.totals) {
        Object.assign(HuntAnalyzerState.totals, parsedData.totals);
        delete HuntAnalyzerState.totals.loot;
    }

    HuntAnalyzerState.data.aggregatedLoot = new Map();
    HuntAnalyzerState.data.aggregatedCreatures = new Map();

    if (parsedData.session) {
        Object.assign(HuntAnalyzerState.session, parsedData.session);
    }

    if (parsedData.timeTracking) {
        HuntAnalyzerState.timeTracking.currentMap = parsedData.timeTracking.currentMap || null;
        HuntAnalyzerState.timeTracking.mapStartTime = parsedData.timeTracking.mapStartTime || 0;
        HuntAnalyzerState.timeTracking.accumulatedTimeMs = parsedData.timeTracking.accumulatedTimeMs || 0;
        HuntAnalyzerState.timeTracking.lastAutoplayTime = parsedData.timeTracking.lastAutoplayTime || 0;
        HuntAnalyzerState.timeTracking.manualActive = false;
        HuntAnalyzerState.timeTracking.manualSessionStartMs = 0;

        if (parsedData.timeTracking.mapTimeMs && Array.isArray(parsedData.timeTracking.mapTimeMs)) {
            HuntAnalyzerState.timeTracking.mapTimeMs = new Map(parsedData.timeTracking.mapTimeMs);
        }

        const mode = getCurrentMode();
        if (mode === 'autoplay') {
            HuntAnalyzerState.timeTracking.suppressNextAutoplayReset = true;
            const immediateAutoplayTime = getAutoplaySessionTime();
            if (immediateAutoplayTime && immediateAutoplayTime > 0) {
                HuntAnalyzerState.timeTracking.autoplayBaselineMinutes = immediateAutoplayTime;
                HuntAnalyzerState.timeTracking.lastAutoplayTime = immediateAutoplayTime;
            } else {
                setTimeout(() => {
                    const currentAutoplayTime = getAutoplaySessionTime();
                    if (currentAutoplayTime && currentAutoplayTime > 0) {
                        HuntAnalyzerState.timeTracking.autoplayBaselineMinutes = currentAutoplayTime;
                        HuntAnalyzerState.timeTracking.lastAutoplayTime = currentAutoplayTime;
                    } else {
                        HuntAnalyzerState.timeTracking.autoplayBaselineMinutes = 0;
                        HuntAnalyzerState.timeTracking.lastAutoplayTime = 0;
                        HuntAnalyzerState.timeTracking.suppressNextAutoplayReset = false;
                    }
                }, 100);
            }
        } else {
            HuntAnalyzerState.timeTracking.autoplayBaselineMinutes = parsedData.timeTracking.autoplayBaselineMinutes || 0;
            HuntAnalyzerState.timeTracking.lastAutoplayTime = 0;
        }
    }
}

function loadHuntAnalyzerManifestFromLocalStorage() {
    const savedData = localStorage.getItem(HUNT_ANALYZER_STORAGE_KEY);
    if (!savedData) return null;
    return JSON.parse(savedData);
}

async function migrateEmbeddedSessionsToIndexedDb(embeddedSessions) {
    if (!embeddedSessions || embeddedSessions.length === 0) return;
    const clean = cleanSessionData(embeddedSessions);
    await idbReplaceAllSessions(clean);
    console.log(`[Hunt Analyzer] Migrated ${clean.length} battles from localStorage manifest to IndexedDB`);
}

async function loadSessionsIntoMemoryFromIndexedDb() {
    if (!_idbAvailable) return;
    HuntAnalyzerState.data.sessions = await idbLoadAllSessions();
    if (applySessionCapToState() > 0) {
        await idbReplaceAllSessions(cleanSessionData(HuntAnalyzerState.data.sessions));
    }
    if (HuntAnalyzerState.data.sessions.length > 0) {
        _needsAggregateFromSessions = true;
    }
}

async function completeHuntAnalyzerPersistenceLoad() {
    if (!HuntAnalyzerState.settings.persistData) {
        _persistenceLoadComplete = true;
        return false;
    }

    try {
        if (typeof indexedDB === 'undefined') {
            _idbAvailable = false;
            console.warn('[Hunt Analyzer] IndexedDB unavailable — battle history will not persist across refresh');
        }

        const parsedData = loadHuntAnalyzerManifestFromLocalStorage();
        if (!parsedData) {
            _persistenceLoadComplete = true;
            return false;
        }

        applyHuntAnalyzerManifest(parsedData);

        const embeddedSessions = getEmbeddedSessionsFromManifest(parsedData);

        if (embeddedSessions.length > 0 && _idbAvailable) {
            await migrateEmbeddedSessionsToIndexedDb(embeddedSessions);
            localStorage.setItem(HUNT_ANALYZER_STORAGE_KEY, JSON.stringify(buildHuntAnalyzerManifestPayload()));
            await loadSessionsIntoMemoryFromIndexedDb();
        } else if (_idbAvailable) {
            await loadSessionsIntoMemoryFromIndexedDb();
        } else if (embeddedSessions.length > 0) {
            HuntAnalyzerState.data.sessions = limitSessionsNewestFirst(embeddedSessions);
            _needsAggregateFromSessions = true;
        }

        syncSessionCountFromPersistence();
        finalizeAggregatesAfterLoadIfNeeded();
        _persistenceLoadComplete = true;
        logPersistenceOperation('Data load');
        return true;
    } catch (error) {
        console.error('[Hunt Analyzer] Error loading persisted data:', error);
        logPersistenceOperation('Data load', false);
        _persistenceLoadFailed = true;
        _persistenceLoadComplete = true;
        console.warn('[Hunt Analyzer] Load failed — auto-save is BLOCKED to protect existing data.');
        return false;
    }
}

async function loadAllPersistedSessions(manifest = loadHuntAnalyzerManifestFromLocalStorage()) {
    if (_idbAvailable) {
        try {
            const fromIdb = await idbLoadAllSessions();
            if (fromIdb.length) return fromIdb;
        } catch (e) {
            console.warn('[Hunt Analyzer] Could not read IndexedDB sessions:', e);
        }
    }
    return getEmbeddedSessionsFromManifest(manifest);
}

async function exportHuntAnalyzerDataForBackup() {
    await flushHuntAnalyzerDataAsync();
    const manifest = loadHuntAnalyzerManifestFromLocalStorage() || buildHuntAnalyzerManifestPayload();
    const sessions = await loadAllPersistedSessions(manifest);
    const data = {
        ...buildHuntAnalyzerManifestPayload(),
        totals: manifest.totals || getTotalsSnapshotForPersistence(),
        session: manifest.session || HuntAnalyzerState.session,
        timeTracking: manifest.timeTracking || buildHuntAnalyzerManifestPayload().timeTracking,
        sessions: cleanSessionData(sessions)
    };
    const stateRaw = localStorage.getItem(HUNT_ANALYZER_STATE_KEY);
    const settingsRaw = localStorage.getItem(HUNT_ANALYZER_SETTINGS_KEY);
    return {
        data,
        state: stateRaw ? JSON.parse(stateRaw) : null,
        settings: settingsRaw ? JSON.parse(settingsRaw) : null
    };
}

async function importHuntAnalyzerDataFromBackup(huntAnalyzerData) {
    if (!huntAnalyzerData || typeof huntAnalyzerData !== 'object') return;

    if (huntAnalyzerData.settings) {
        localStorage.setItem(HUNT_ANALYZER_SETTINGS_KEY, JSON.stringify(huntAnalyzerData.settings));
        loadHuntAnalyzerSettings();
    }
    if (huntAnalyzerData.state) {
        localStorage.setItem(HUNT_ANALYZER_STATE_KEY, JSON.stringify(huntAnalyzerData.state));
        loadHuntAnalyzerState();
    }

    if (huntAnalyzerData.data) {
        const incoming = huntAnalyzerData.data;
        const sessions = Array.isArray(incoming.sessions) ? incoming.sessions : [];
        const manifest = buildHuntAnalyzerManifestPayload();
        if (incoming.totals) manifest.totals = incoming.totals;
        if (incoming.session) manifest.session = incoming.session;
        if (incoming.timeTracking) manifest.timeTracking = incoming.timeTracking;
        localStorage.setItem(HUNT_ANALYZER_STORAGE_KEY, JSON.stringify(manifest));

        if (_idbAvailable) {
            if (sessions.length > 0) {
                await idbReplaceAllSessions(cleanSessionData(sessions));
            } else {
                await idbClearAllSessions();
            }
        }

        _persistenceLoadFailed = false;
        _needsAggregateFromSessions = true;
        HuntAnalyzerState.data.sessions = [];
        applyHuntAnalyzerManifest(manifest);
        if (_idbAvailable) {
            await loadSessionsIntoMemoryFromIndexedDb();
        } else {
            HuntAnalyzerState.data.sessions = sessions;
        }
        syncSessionCountFromPersistence();
        finalizeAggregatesAfterLoadIfNeeded();
        _persistenceLoadComplete = true;
    }
}

function flushPersistenceIfEnabled() {
    if (!HuntAnalyzerState.settings.persistData) return;
    flushHuntAnalyzerDataAsync().then(() => saveHuntAnalyzerState()).catch((e) => {
        console.warn('[Hunt Analyzer] flushPersistenceIfEnabled failed:', e);
    });
}

function debouncedPersistenceFlush(delayMs = 150) {
    if (persistenceSaveDebounceTimeoutId) {
        clearTimeout(persistenceSaveDebounceTimeoutId);
    }
    persistenceSaveDebounceTimeoutId = setTimeout(() => {
        persistenceSaveDebounceTimeoutId = null;
        flushPersistenceIfEnabled();
    }, delayMs);
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
        // Deep-merge visibility so new keys added later keep their defaults
        if (parsedSettings.visibility) {
            Object.assign(HuntAnalyzerState.settings.visibility, parsedSettings.visibility);
            delete parsedSettings.visibility;
        }
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
        console.warn(`[Hunt Analyzer] Unknown theme: ${themeName}, using '${HUNT_ANALYZER_DEFAULT_THEME_KEY}'`);
        themeName = HUNT_ANALYZER_DEFAULT_THEME_KEY;
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
    
}

// Update theme colors for existing panel elements
function updatePanelThemeColors(panel) {
    if (!panel) return;
    
    applyThemeResourceTotalColors();
    applyThemeInfoTextColors();
    
    // Update stats text
    const statsElements = panel.querySelectorAll('.ha-stats-text');
    statsElements.forEach(el => {
        el.style.color = getThemeColor('textStats');
    });
    
    applyThemeMapFilterDropdownStyles(
        document.getElementById('mod-map-filter-dropdown-button'),
        document.getElementById('mod-map-filter-dropdown-menu')
    );
    
    // Update live display section background
    const liveDisplaySection = panel.querySelector('.live-display-section');
    if (liveDisplaySection) {
        applyFramedSectionStyles(liveDisplaySection, { noTopMargin: true });
    }
    
    // Update loot container
    const lootContainer = panel.querySelector('.loot-container');
    if (lootContainer) {
        applyFramedSectionStyles(lootContainer, { noTopMargin: true });
    }
    
      applyThemeFramedDisplaySurface(document.getElementById('mod-loot-display'));
    applyAccentTitleStyle(document.getElementById('mod-loot-title'));
    
    // Update creature drop container
    const creatureDropContainer = panel.querySelector('.creature-drop-container');
    if (creatureDropContainer) {
        applyFramedSectionStyles(creatureDropContainer, { noTopMargin: true });
    }
    
    applyThemeFramedDisplaySurface(document.getElementById('mod-creature-drop-display'));
    applyAccentTitleStyle(document.getElementById('mod-creature-drops-title'));
    
    // Update map filter container
    const mapFilterContainer = panel.querySelector('.map-filter-container');
    if (mapFilterContainer) {
        applyFramedSectionStyles(mapFilterContainer, { noTopMargin: true });
    }
    
    // Update button container
    const buttonContainer = panel.querySelector('.button-container');
    if (buttonContainer) {
        applyFramedSectionStyles(buttonContainer, { noTopMargin: true });
    }
}

// Check if panel should be reopened after page refresh
function shouldReopenHuntAnalyzer() {
    if (!HuntAnalyzerState.settings.persistData) {
        return false;
    }
    
    const savedState = loadHuntAnalyzerState();
    
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
// 3.0. Game integration helpers
// =======================

const HUNT_ANALYZER_RUNE_LOOKUP_PATTERNS = [
    { patterns: ['blankrune', 'blank'], key: 'runeBlank' },
    { patterns: ['avaricerune', 'avarice'], key: 'runeAvarice' },
    { patterns: ['recyclerune', 'recycle'], key: 'runeRecycle' },
    { patterns: ['hitpointsrune', 'hitpoints', 'hprune'], key: 'runeHp' },
    { patterns: ['abilitypowerrune', 'abilitypower', 'aprune'], key: 'runeAp' },
    { patterns: ['attackdamagerune', 'attackdamage', 'adrune'], key: 'runeAd' },
    { patterns: ['armorrune', 'armor', 'arrune'], key: 'runeAr' },
    { patterns: ['magicresistrune', 'magicresist', 'mrrune'], key: 'runeMr' }
];

const HUNT_ANALYZER_TIERED_CONSUMABLE_RULES = [
    { hints: ['dicemanipulator', 'dice'], keyPrefix: 'diceManipulator' },
    { hints: ['stamina'], keyPrefix: 'stamina' },
    { hints: ['summonscroll', 'summon'], keyPrefix: 'summonScroll' },
    { hints: ['insightstone', 'insight'], keyPrefix: 'insightStone' }
];

const HUNT_ANALYZER_RUNE_SPRITE_KEYS = [
    ['rune-avarice', 'runeAvarice'],
    ['rune-recycle', 'runeRecycle'],
    ['rune-hp', 'runeHp'],
    ['rune-ap', 'runeAp'],
    ['rune-ad', 'runeAd'],
    ['rune-ar', 'runeAr'],
    ['rune-mr', 'runeMr'],
    ['rune-blank', 'runeBlank']
];

function matchesAnyNameHint(value, hints) {
    if (!value) return false;
    return hints.some((hint) => value.includes(hint));
}

function matchesConsumableRule(normalizedItemName, normalizedTooltip, hints) {
    return matchesAnyNameHint(normalizedItemName, hints)
        || matchesAnyNameHint(normalizedTooltip, hints);
}

function lookupTieredConsumableTooltip(inventoryDB, keyPrefix, item) {
    const existingRarity = item?.rarityLevel || item?.tier || 0;
    const tierKey = existingRarity >= 1 && existingRarity <= 5
        ? `${keyPrefix}${existingRarity}`
        : `${keyPrefix}1`;
    const entry = inventoryDB.tooltips[tierKey];
    return {
        rarity: entry?.rarity || '1',
        displayName: entry?.displayName || null
    };
}

function resolveRuneItemInfoFromDatabase(inventoryDB, normalizedItemName, normalizedTooltip, item) {
    for (const runePattern of HUNT_ANALYZER_RUNE_LOOKUP_PATTERNS) {
        for (const pattern of runePattern.patterns) {
            if (normalizedItemName?.includes(pattern) || normalizedTooltip?.includes(pattern)) {
                return {
                    rarity: inventoryDB.tooltips[runePattern.key]?.rarity || '1',
                    displayName: inventoryDB.tooltips[runePattern.key]?.displayName || null
                };
            }
        }
    }

    const spriteSrc = item?.spriteSrc;
    if (spriteSrc) {
        for (const [fragment, key] of HUNT_ANALYZER_RUNE_SPRITE_KEYS) {
            if (spriteSrc.includes(fragment)) {
                return {
                    rarity: inventoryDB.tooltips[key]?.rarity || '1',
                    displayName: inventoryDB.tooltips[key]?.displayName || null
                };
            }
        }
    }

    if (inventoryDB.tooltips['runeBlank']) {
        return {
            rarity: inventoryDB.tooltips['runeBlank'].rarity,
            displayName: inventoryDB.tooltips['runeBlank'].displayName
        };
    }

    return null;
}

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
    
    for (const rule of HUNT_ANALYZER_TIERED_CONSUMABLE_RULES) {
        if (matchesConsumableRule(normalizedItemName, normalizedTooltip, rule.hints)) {
            const result = lookupTieredConsumableTooltip(inventoryDB, rule.keyPrefix, item);
            itemInfoCache.set(cacheKey, result);
            return result;
        }
    }

    if (normalizedItemName?.includes('rune') || normalizedTooltip?.includes('rune')) {
        const result = resolveRuneItemInfoFromDatabase(
            inventoryDB, normalizedItemName, normalizedTooltip, item
        );
        if (result) {
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
    const containerSlot = createContainerSlot('34px', 'container-slot surface-darker');
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
    const displayName = window.creatureDatabase?.getDisplayNameForOwnedMonster?.(monsterDrop);
    const friendlyName = displayName || getMonsterNameFromId(monsterDrop.gameId);
    if (friendlyName) name = friendlyName;
    name = formatNameToTitleCase(name);
    
    const { totalStats, tierName, tierLevel } = getCreatureTierDetails(monsterDrop.genes);

    // Check if creature is shiny/sealed
    const isShiny = monsterDrop.shiny === true;
    const isSealed = Number(monsterDrop.tier ?? monsterDrop.metadata?.tier ?? tierLevel) === 5;
    
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

    if (isSealed) {
        const sealedIcon = document.createElement('img');
        sealedIcon.src = SEALED_ICON_SRC;
        sealedIcon.alt = 'sealed';
        sealedIcon.title = 'Sealed';
        sealedIcon.style.position = 'absolute';
        sealedIcon.style.top = '2px';
        sealedIcon.style.right = '2px';
        sealedIcon.style.width = '8px';
        sealedIcon.style.height = '8px';
        sealedIcon.style.zIndex = '10';
        sealedIcon.style.pointerEvents = 'none';
        visualContainer.appendChild(sealedIcon);
    }
    
    const sellValue = resolveCreatureSellValue(monsterDrop, tierLevel, totalStats);
    const creatureId = monsterDrop.id ?? monsterDrop.monsterId ?? monsterDrop.metadata?.id ?? null;
    return { name, visual: visualContainer, rarity: tierLevel, totalStats, tierName, tierLevel, gameId: monsterDrop.gameId, isShiny, isSealed, sellValue, creatureId };
}

function getRewardMonsterDrops(serverResults) {
    if (!serverResults || typeof serverResults !== 'object') return [];
    const rewardScreen = serverResults.rewardScreen || {};
    const drops = [];

    if (rewardScreen.monsterDrop && typeof rewardScreen.monsterDrop === 'object') {
        drops.push(rewardScreen.monsterDrop);
    }

    if (rewardScreen.monsters) {
        const monsterList = Array.isArray(rewardScreen.monsters)
            ? rewardScreen.monsters
            : [rewardScreen.monsters];
        monsterList.forEach((monster) => {
            if (monster && typeof monster === 'object') {
                drops.push(monster);
            }
        });
    }

    if (drops.length === 0 && serverResults.next?.monsterDrop && typeof serverResults.next.monsterDrop === 'object') {
        drops.push(serverResults.next.monsterDrop);
    }

    return drops;
}

/**
 * Stable merge key for loot across sessions and persist/load (null vs missing src/stat, src vs spriteSrc).
 */
function buildLootAggregateKey(item) {
    if (!item || typeof item !== 'object') return '';
    const name = item.originalName ?? '';
    const rarity = item.rarity ?? '';
    const spriteId = item.spriteId != null && item.spriteId !== '' ? item.spriteId : '';
    const srcRaw = (item.src != null && item.src !== '')
        ? item.src
        : (item.spriteSrc != null && item.spriteSrc !== '' ? item.spriteSrc : '');
    const src = srcRaw === '' || srcRaw == null ? '' : String(srcRaw);
    const statRaw = item.stat != null && item.stat !== '' ? item.stat : '';
    const stat = statRaw === '' || statRaw == null ? '' : String(statRaw);
    const eq = item.isEquipment ? 1 : 0;
    return `${name}_${rarity}_${spriteId}_${src}_${eq}_${stat}`;
}

function buildCreatureAggregateKey(creature) {
    const isSealed = !!creature.isSealed;
    const shinyPart = creature.isShiny ? 'shiny' : 'normal';
    // Sealed creatures should stack regardless of genes/tier roll.
    if (isSealed) {
        return `${creature.gameId}_sealed_${shinyPart}`;
    }
    return `${creature.gameId}_${creature.tierLevel}_${shinyPart}_unsealed`;
}

function syncAggregateCountOverlay(aggregateEntry) {
    if (!aggregateEntry?.visual?.querySelector) return;
    const countSpan = aggregateEntry.visual.querySelector('.pixel-font-16');
    if (countSpan) countSpan.textContent = aggregateEntry.count;
}

function mergeAggregateEntry(aggregateMap, key, entry, options = {}) {
    const { updateVisual = false, onMerged } = options;
    if (aggregateMap.has(key)) {
        const existing = aggregateMap.get(key);
        existing.count += entry.count;
        if (onMerged) onMerged(existing, entry);
        if (updateVisual) syncAggregateCountOverlay(existing);
        aggregateMap.set(key, existing);
        return existing;
    }
    const copy = { ...entry };
    aggregateMap.set(key, copy);
    return copy;
}

function isGoldOrDustLootItem(item) {
    return item.originalName === 'Gold' || item.originalName === 'Dust';
}

function accumulateLootCategoryTotals(item) {
    if (item.isEquipment) {
        HuntAnalyzerState.totals.equipment += item.count;
    } else if (item.originalName.includes('Rune') || item.originalName.includes('rune')) {
        HuntAnalyzerState.totals.runes += item.count;
    }
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
    if (textarea.parentNode) {
        textarea.parentNode.removeChild(textarea);
    }
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
        HuntAnalyzerState.totals.dust += item.amount || 1;
        currentLootItemsLog.push(`Dust (x${item.amount || 1})`);
        // Continue processing to add dust to session loot (will be filtered out later)
      }

      // Track rune drops - check both original and resolved names
      const originalItemName = item.tooltipKey || `ID-${item.spriteId}`;
      if (isRuneItem(originalItemName, item) || isRuneItem(resolvedItemName, item)) {
        HuntAnalyzerState.totals.runes += item.amount || 1;
      }

      const mapKey = buildLootAggregateKey({
        originalName: resolvedItemName,
        rarity,
        spriteId: item.spriteId || item.gameId,
        src: item.spriteSrc,
        spriteSrc: item.spriteSrc,
        isEquipment,
        stat: item.stat || equipmentStat || null
      });
      const currentQuantity = item.amount || 1;

      mergeAggregateEntry(aggregatedLootForSession, mapKey, {
        count: currentQuantity,
        visual: itemVisual,
        originalName: resolvedItemName,
        rarity,
        rarityBorderColor,
        spriteId: item.spriteId || item.gameId,
        src: item.spriteSrc,
        isEquipment,
        gameId: item.gameId,
        stat: item.stat || equipmentStat || null,
        _descriptiveRarity: item._descriptiveRarity || null
      }, {
        updateVisual: true,
        onMerged: (existing) => {
          if (item._descriptiveRarity) existing._descriptiveRarity = item._descriptiveRarity;
          if (item.gameId) existing.gameId = item.gameId;
          if (equipmentStat && !existing.stat) existing.stat = equipmentStat;
        }
      });
      currentLootItemsLog.push(`${resolvedItemName} (Rarity ${rarity}, x${currentQuantity})`);
    }

    // Process Creature Drop(s) - manual mode can provide rewardScreen.monsters/next.monsterDrop.
    const rewardMonsterDrops = getRewardMonsterDrops(serverResults);
    rewardMonsterDrops.forEach((monsterDrop) => {
      const { name: creatureName, totalStats, tierName, tierLevel, gameId: creatureGameId, isShiny, isSealed, sellValue, creatureId } =
        getCreatureDetails(monsterDrop);

      if (!creatureName.toLowerCase().includes('monster squeezer')) {
        if (isShiny) {
          HuntAnalyzerState.totals.shiny += 1;
        }
        if (isSealed) {
          HuntAnalyzerState.totals.sealed += 1;
        }

        const mapKey = buildCreatureAggregateKey({
          gameId: creatureGameId,
          tierLevel,
          isShiny,
          isSealed
        });
        mergeAggregateEntry(aggregatedCreaturesForSession, mapKey, {
          count: 1,
          visual: createInventoryStyleCreaturePortrait({
            gameId: creatureGameId,
            originalName: creatureName,
            tierLevel,
            count: 1,
            isShiny,
            isSealed
          }),
          originalName: creatureName,
          genes: Object.entries(monsterDrop.genes || {})
            .map(([key, value]) => `${key.toUpperCase()}:${value}`)
            .join(', '),
          totalStats,
          tierName,
          tierLevel,
          sellValue,
          creatureId,
          rarityBorderColor: getRarityBorderColor(tierLevel),
          gameId: creatureGameId,
          isShiny,
          isSealed
        }, { updateVisual: true });
      }
    });

    // Update stamina spent
    if (typeof serverResults.next?.playerExpDiff === 'number') {
      HuntAnalyzerState.totals.staminaSpent += serverResults.next.playerExpDiff;
    }

    // Track experience gained from the battle
    const battleExp = parseBattleExpReward(rewardScreen, serverResults);
    if (battleExp > 0) {
      HuntAnalyzerState.totals.experience += battleExp;
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
    let sessionCreatureSellValue = 0;
    for (const item of aggregatedLootForSession.values()) {
      if (item.originalName === 'Gold') {
        sessionGold += item.count;
      } else if (item.originalName === 'Dust') {
        sessionDust += item.count;
      }
    }
    for (const creature of aggregatedCreaturesForSession.values()) {
      const creatureCount = Math.max(0, Number(creature?.count) || 0);
      const valuePerCreature = parsePossibleGoldValue(creature?.sellValue);
      if (creatureCount > 0 && valuePerCreature > 0) {
        sessionCreatureSellValue += creatureCount * valuePerCreature;
      }
    }
    
    // Floor is included in rewardScreen in current game payloads.
    // Keep null for unknown/legacy sessions so grouping stays stable.
    const battleFloor = typeof rewardScreen.floor === 'number'
      ? rewardScreen.floor
      : (typeof serverResults?.floor === 'number' ? serverResults.floor : null);

    // Store session data
    const sessionData = {
      message: autoplayMessage,
      roomId: rewardScreen.roomId,
      roomName: readableRoomName,
      floor: battleFloor,
      loot: Array.from(aggregatedLootForSession.values()),
      creatures: Array.from(aggregatedCreaturesForSession.values()),
      timestamp: Date.now(),
      staminaSpent: serverResults.next?.playerExpDiff || 0,
      staminaRecovered: sessionStaminaRecovered,
      experience: battleExp,
      victory: rewardScreen.victory,
      gold: sessionGold,
      dust: sessionDust,
      creatureSellValue: sessionCreatureSellValue,
      capturedDisenchantDustValues: []
    };
    
    const equipmentDropsInSession = sessionData.loot.reduce((acc, item) => {
      if (!item?.isEquipment) return acc;
      return acc + Math.max(0, Number(item?.count) || 0);
    }, 0);

    this.state.data.sessions.push(sessionData);
    reconcilePendingCreatureSellEventsIntoSessions();
    reconcilePendingDisenchantDustEventsIntoSessions();
    if (this.state.data.sessions.length === 1) {
      syncTimeTrackingAfterFirstRecordedBattle();
    }
    
    // Consolidated session processing summary (single-line to avoid collapsed "Object" logs)
    console.log(
      `[Hunt Analyzer] Session processed: result=${autoplayMessage} room=${readableRoomName} ` +
      `gold=${rewardScreen.loot?.goldAmount || 0} exp=${sessionData.experience} ` +
      `lootItems=${aggregatedLootForSession.size} equipmentDrops=${equipmentDropsInSession} ` +
      `creatures=${aggregatedCreaturesForSession.size} staminaSpent=${sessionData.staminaSpent} ` +
      `staminaRecovered=${sessionData.staminaRecovered}`
    );
    
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
    HuntAnalyzerState.totals.sealed = 0;
    HuntAnalyzerState.totals.staminaSpent = 0;
    HuntAnalyzerState.totals.staminaRecovered = 0;
    HuntAnalyzerState.totals.experience = 0;
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
        
        // Aggregate experience (Number() avoids string-concat bugs from legacy persisted data)
        HuntAnalyzerState.totals.experience += sessionStoredExperience(sessionData);
        
        sessionData.loot.forEach((item) => {
            if (isGoldOrDustLootItem(item)) {
                if (item.originalName === 'Gold') HuntAnalyzerState.totals.gold += item.count;
                else HuntAnalyzerState.totals.dust += item.count;
                return;
            }
            mergeAggregateEntry(
                this.state.data.aggregatedLoot,
                buildLootAggregateKey(item),
                item,
                { updateVisual: true }
            );
            accumulateLootCategoryTotals(item);
        });

        sessionData.creatures.forEach((creature) => {
            mergeAggregateEntry(
                this.state.data.aggregatedCreatures,
                buildCreatureAggregateKey(creature),
                creature,
                { updateVisual: true }
            );
            if (creature.isShiny) HuntAnalyzerState.totals.shiny += creature.count;
            if (creature.isSealed) HuntAnalyzerState.totals.sealed += creature.count;
            HuntAnalyzerState.totals.creatures += creature.count || 0;
        });
    });
  }
}

// Initialize data processor
const dataProcessor = new DataProcessor();

function finalizeAggregatesAfterLoadIfNeeded() {
    if (!_needsAggregateFromSessions || !HuntAnalyzerState.data.sessions.length) {
        syncSessionCountFromPersistence();
        return;
    }
    _needsAggregateFromSessions = false;
    try {
        rebuildAggregatesFromSessionsWithMerge();
    } catch (e) {
        console.error('[Hunt Analyzer] Failed to rebuild aggregates from persisted sessions:', e);
    }
}

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

    const mapFilterContainer = mapFilterRow.parentElement;
    if (mapFilterContainer) {
        mapFilterContainer.querySelectorAll(':scope > h3').forEach((el) => el.remove());
    }

    // Prevent listener leaks across dropdown rebuilds.
    if (documentClickHandler) {
        document.removeEventListener("click", documentClickHandler);
        documentClickHandler = null;
    }
    const previousDropdownButton = document.getElementById("mod-map-filter-dropdown-button");
    if (previousDropdownButton && dropdownClickHandler) {
        previousDropdownButton.removeEventListener("click", dropdownClickHandler);
        dropdownClickHandler = null;
    }

    // Clear existing content
    mapFilterRow.innerHTML = "";
    mapFilterRow.style.display = "flex";
    mapFilterRow.style.alignItems = "center";
    mapFilterRow.style.justifyContent = "center";
    mapFilterRow.style.width = "100%";
    mapFilterRow.style.gap = "8px";

    // Create dropdown container
    const dropdownContainer = document.createElement("div");
    dropdownContainer.style.position = "relative";
    dropdownContainer.style.display = "inline-block";
    dropdownContainer.style.width = "200px";
    dropdownContainer.style.flexShrink = "0";

    // Create dropdown button
    const dropdownButton = document.createElement("button");
    dropdownButton.id = "mod-map-filter-dropdown-button";
    dropdownButton.style.padding = "6px 12px";
    dropdownButton.style.borderRadius = "4px";
    dropdownButton.style.fontSize = "12px";
    dropdownButton.style.cursor = "pointer";
    dropdownButton.style.width = "200px";
    dropdownButton.style.minWidth = "200px";
    dropdownButton.style.maxWidth = "200px";
    dropdownButton.style.boxSizing = "border-box";
    dropdownButton.style.textAlign = "left";
    dropdownButton.style.display = "flex";
    dropdownButton.style.justifyContent = "space-between";
    dropdownButton.style.alignItems = "center";
    dropdownButton.style.gap = "8px";
    dropdownButton.style.overflow = "hidden";

    const selectedMapLabel = HuntAnalyzerState.ui.selectedMapFilter === "ALL"
        ? t('mods.huntAnalyzer.allMaps')
        : HuntAnalyzerState.ui.selectedMapFilter;

    const labelSpan = document.createElement("span");
    labelSpan.id = "mod-map-filter-dropdown-label";
    labelSpan.textContent = selectedMapLabel;
    labelSpan.title = selectedMapLabel;

    const arrow = document.createElement("span");
    arrow.id = "mod-map-filter-dropdown-arrow";
    arrow.textContent = "▼";
    arrow.style.fontSize = "10px";
    arrow.style.flexShrink = "0";

    dropdownButton.appendChild(labelSpan);
    dropdownButton.appendChild(arrow);

    // Create dropdown menu
    const dropdownMenu = document.createElement("div");
    dropdownMenu.id = "mod-map-filter-dropdown-menu";
    dropdownMenu.style.position = "absolute";
    dropdownMenu.style.top = "100%";
    dropdownMenu.style.left = "0";
    dropdownMenu.style.right = "0";
    dropdownMenu.style.borderRadius = "4px";
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

    syncMapFilterDropdownOptionStyles();

    // Toggle dropdown visibility
    dropdownClickHandler = (e) => {
        e.stopPropagation();
        const isVisible = dropdownMenu.style.display === "block";
        if (isVisible) {
            dropdownMenu.style.display = "none";
            arrow.textContent = "▼";
            syncMapFilterDropdownOptionStyles();
        } else {
            syncMapFilterDropdownOptionStyles();
            dropdownMenu.style.display = "block";
            arrow.textContent = "▲";
        }
    };
    dropdownButton.addEventListener("click", dropdownClickHandler);

    // Close dropdown when clicking outside
    documentClickHandler = () => {
        dropdownMenu.style.display = "none";
        arrow.textContent = "▼";
        syncMapFilterDropdownOptionStyles();
    };
    document.addEventListener("click", documentClickHandler);

    applyThemeMapFilterDropdownStyles(dropdownButton, dropdownMenu);

    dropdownContainer.appendChild(dropdownButton);
    dropdownContainer.appendChild(dropdownMenu);
    mapFilterRow.appendChild(dropdownContainer);

    const navigateButton = createStyledButton('→');
    navigateButton.id = 'mod-map-filter-navigate-button';
    navigateButton.style.width = '25px';
    navigateButton.style.height = '25px';
    navigateButton.style.maxWidth = '25px';
    navigateButton.style.maxHeight = '25px';
    navigateButton.style.minWidth = '0';
    navigateButton.style.minHeight = '0';
    navigateButton.style.flexGrow = '0';
    navigateButton.style.flexShrink = '0';
    navigateButton.style.padding = '0';
    navigateButton.style.boxSizing = 'border-box';
    navigateButton.style.fontSize = '13px';
    navigateButton.style.lineHeight = '1';
    navigateButton.style.display = HuntAnalyzerState.ui.selectedMapFilter === 'ALL' ? 'none' : 'inline-flex';
    navigateButton.style.alignItems = 'center';
    navigateButton.style.justifyContent = 'center';
    navigateButton.title = getGoToMapLabel();
    navigateButton.setAttribute('aria-label', getGoToMapLabel());
    navigateButton.addEventListener('click', () => {
        const navigated = navigateToSelectedMapFilter();
        if (!navigated) {
            const panel = document.getElementById(PANEL_ID);
            showPanelFeedback(panel, getFailedToNavigateMapLabel(), false);
        }
    });
    mapFilterRow.appendChild(navigateButton);
}

function syncMapFilterDropdownOptionStyles() {
    const dropdownMenu = document.getElementById('mod-map-filter-dropdown-menu');
    if (!dropdownMenu) return;

    const selected = HuntAnalyzerState.ui.selectedMapFilter;
    dropdownMenu.querySelectorAll('[data-map-filter-option]').forEach((option) => {
        const isSelected = option.dataset.mapFilterOption === selected;
        option.dataset.selected = isSelected ? 'true' : 'false';
        option.style.backgroundColor = '';
        option.style.color = '';
    });
}

// Create a dropdown option
function createDropdownOption(mapName) {
    const option = document.createElement("div");
    const optionLabel = mapName === "ALL" ? t('mods.huntAnalyzer.allMaps') : mapName;
    option.textContent = optionLabel;
    option.dataset.mapFilterOption = mapName;
    option.style.padding = "8px 12px";
    option.style.cursor = "pointer";
    option.style.fontSize = "12px";
    option.style.borderBottom = `1px solid ${getThemeColor('border')}`;
    option.style.transition = "background-color 0.2s ease";
    option.style.overflow = "hidden";
    option.style.textOverflow = "ellipsis";
    option.style.whiteSpace = "nowrap";
    option.title = optionLabel;

    // Click handler
    option.addEventListener("click", () => {
        HuntAnalyzerState.ui.selectedMapFilter = mapName;
        syncMapFilterDropdownOptionStyles();

        // Update dropdown button text
        const dropdownButton = document.getElementById("mod-map-filter-dropdown-button");
        const labelSpan = document.getElementById("mod-map-filter-dropdown-label");
        if (labelSpan) {
            labelSpan.textContent = optionLabel;
            labelSpan.title = optionLabel;
        }
        
        // Close dropdown
        const dropdownMenu = document.getElementById("mod-map-filter-dropdown-menu");
        if (dropdownMenu) {
            dropdownMenu.style.display = "none";
        }
        
        // Update arrow
        const arrow = document.getElementById("mod-map-filter-dropdown-arrow");
        if (arrow) {
            arrow.textContent = "▼";
        }
        
        // Refresh data and display
        dataProcessor.aggregateData();
        renderAllSessions();
        refreshClearButtonLabel();
        const navigateButton = document.getElementById('mod-map-filter-navigate-button');
        if (navigateButton) {
            navigateButton.style.display = mapName === 'ALL' ? 'none' : 'inline-flex';
        }
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
    if (!cachedLootDiv || !cachedCreatureDropDiv) {
        console.warn("[Hunt Analyzer] Render target divs not available. Panel might not be open.");
        return;
    }

    // Use the new data processor to aggregate data
    dataProcessor.aggregateData();
    
    // Use DocumentFragment for efficient batch DOM updates
    const creatureFragment = document.createDocumentFragment();
    
    // Clear previous content - but build fragments first to minimize reflow
    cachedLootDiv.innerHTML = ''; // Clear previous content
    cachedCreatureDropDiv.innerHTML = ''; // Clear previous content

    updatePanelResourceTotalDisplays();

    // Get all loot items (Gold and Dust are already excluded from aggregatedLoot)
    const allLoot = Array.from(HuntAnalyzerState.data.aggregatedLoot.values());

    // Calculate total loot items for current filter
    let totalLootItems = 0;
    allLoot.forEach((data) => {
        totalLootItems += data.count;
    });

    updateFilteredSectionTitle('mod-loot-title', 'mods.huntAnalyzer.loot', totalLootItems);

    const sortedFilteredLoot = allLoot.sort(compareLootEntries);

    // Create grid container for loot using unified function
    const lootGridContainer = createUnifiedGridContainer();

    sortedFilteredLoot.forEach((data) => {
        const lootEntryDiv = createGridEntryCell();
        const iconWrapper = createGridIconWrapper();
        mountGridVisual(iconWrapper, resolveLootGridVisual(data), '🎲');
        lootEntryDiv.appendChild(iconWrapper);
        lootGridContainer.appendChild(lootEntryDiv);
    });
    
    // Append grid container to loot display
    cachedLootDiv.appendChild(lootGridContainer);
    
    // Add stat icons to any existing equipment portraits
    setTimeout(() => addStatIconsToExistingPortraits(), 100);

    const sortedOverallCreatures = Array.from(HuntAnalyzerState.data.aggregatedCreatures.values())
        .sort(compareCreatureEntries);

    // Calculate total creature drops for current filter
    let totalCreatureDrops = 0;
    sortedOverallCreatures.forEach((data) => {
        totalCreatureDrops += data.count;
    });

    updateFilteredSectionTitle('mod-creature-drops-title', 'mods.huntAnalyzer.creatureDrops', totalCreatureDrops);

    // Create grid container for creatures using unified function
    const gridContainer = createUnifiedGridContainer();

    sortedOverallCreatures.forEach((data) => {
        const creatureEntryDiv = createGridEntryCell();
        const iconWrapper = createGridIconWrapper();
        mountGridVisual(iconWrapper, resolveCreatureGridVisual(data), '👾');
        creatureEntryDiv.appendChild(iconWrapper);
        gridContainer.appendChild(creatureEntryDiv);
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


function calculateRawHourlyRates(timeHours, stats) {
    if (timeHours <= 0) {
        return { sessions: 0, gold: 0, creatures: 0, equipment: 0, experience: 0, staminaSpent: 0 };
    }
    return {
        sessions: Math.floor(stats.sessions / timeHours),
        gold: Math.floor(stats.gold / timeHours),
        creatures: Math.floor(stats.creatures / timeHours),
        equipment: Math.round(stats.equipment / timeHours),
        experience: Math.floor(stats.experience / timeHours),
        staminaSpent: Math.floor(stats.staminaSpent / timeHours)
    };
}

function calculateEfficiencyMetrics(stats) {
    const notAvailable = t('mods.huntAnalyzer.notAvailable');
    return {
        goldPerStamina: stats.staminaSpent > 0 ? (stats.gold / stats.staminaSpent).toFixed(2) : notAvailable,
        sessionsPerStamina: stats.staminaSpent > 0 ? (stats.sessions / stats.staminaSpent).toFixed(3) : notAvailable
    };
}

function getSummaryRoomDisplayName(sessions) {
    const uniqueMaps = new Set(sessions.map((s) => s.roomName));
    if (uniqueMaps.size === 0) return t('mods.huntAnalyzer.notAvailable');
    if (uniqueMaps.size === 1) return Array.from(uniqueMaps)[0];
    return `${t('mods.huntAnalyzer.allMaps')} (${uniqueMaps.size} ${t('mods.huntAnalyzer.maps')})`;
}

function formatFloorSessionBreakdown(sessions) {
    const floorSessions = new Map();
    sessions.forEach((session) => {
        const floorLabel = Number.isInteger(session.floor)
            ? `${t('mods.huntAnalyzer.floor')} ${session.floor}`
            : t('mods.huntAnalyzer.floorUnknown');
        if (!floorSessions.has(floorLabel)) {
            floorSessions.set(floorLabel, { sessions: 0, wins: 0, losses: 0 });
        }
        const floorStats = floorSessions.get(floorLabel);
        floorStats.sessions += 1;
        if (session.victory === true) floorStats.wins += 1;
        else if (session.victory === false) floorStats.losses += 1;
    });
    return Array.from(floorSessions.entries())
        .sort((a, b) => {
            const floorMatchA = a[0].match(/\d+$/);
            const floorMatchB = b[0].match(/\d+$/);
            if (!floorMatchA && !floorMatchB) return 0;
            if (!floorMatchA) return 1;
            if (!floorMatchB) return -1;
            return Number(floorMatchA[0]) - Number(floorMatchB[0]);
        })
        .map(([label, stats]) => `${label}: ${stats.sessions} (${stats.wins}/${stats.losses})`)
        .join(' | ');
}

function getSessionGoldAndDust(session) {
    let gold = typeof session.gold === 'number' ? session.gold : 0;
    let dust = typeof session.dust === 'number' ? session.dust : 0;
    if ((typeof session.gold !== 'number' || typeof session.dust !== 'number') && Array.isArray(session.loot)) {
        session.loot.forEach((item) => {
            if (!item || typeof item.count !== 'number') return;
            if (typeof session.gold !== 'number' && item.originalName === 'Gold') gold += item.count;
            else if (typeof session.dust !== 'number' && item.originalName === 'Dust') dust += item.count;
        });
    }
    return { gold, dust };
}

function parsePossibleGoldValue(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function registerCreatureSellValueByMonsterId(monsterId, goldValue, dustValue = 0) {
    const normalizedId = typeof monsterId === 'string' ? monsterId : String(monsterId ?? '');
    const parsedGold = parsePossibleGoldValue(goldValue);
    const parsedDust = parsePossibleGoldValue(dustValue);
    if (parsedGold <= 0 && parsedDust <= 0) return;
    if (normalizedId) {
        huntAnalyzerCreatureSellByMonsterId.set(normalizedId, parsedGold);
    }
    huntAnalyzerPendingCreatureSellEvents.push({ monsterId: normalizedId || null, goldValue: parsedGold, dustValue: parsedDust, consumed: false });
    reconcilePendingCreatureSellEventsIntoSessions();
}

function getSessionCreatureDropCount(session) {
    if (!session || !Array.isArray(session.creatures)) return 0;
    return session.creatures.reduce((acc, creature) => acc + Math.max(0, Number(creature?.count) || 0), 0);
}

function getSessionCapturedCreatureSellValues(session) {
    if (!session || !Array.isArray(session.capturedCreatureSellValues)) return [];
    return session.capturedCreatureSellValues;
}

function getSessionEquipmentDropCount(session) {
    if (!session || !Array.isArray(session.loot)) return 0;
    return session.loot.reduce((acc, item) => {
        if (!item?.isEquipment) return acc;
        return acc + Math.max(0, Number(item?.count) || 0);
    }, 0);
}

function getSessionCapturedDisenchantDustValues(session) {
    if (!session || !Array.isArray(session.capturedDisenchantDustValues)) return [];
    return session.capturedDisenchantDustValues;
}

function registerDisenchantDustValueByEquipmentId(equipmentId, dustValue) {
    const normalizedId = typeof equipmentId === 'string' ? equipmentId : String(equipmentId ?? '');
    const parsedDust = parsePossibleGoldValue(dustValue);
    if (parsedDust <= 0) return;
    huntAnalyzerPendingDisenchantDustEvents.push({ equipmentId: normalizedId || null, dustValue: parsedDust, consumed: false });
    reconcilePendingDisenchantDustEventsIntoSessions();
}

function reconcilePendingDisenchantDustEventsIntoSessions() {
    const sessions = HuntAnalyzerState?.data?.sessions;
    if (!Array.isArray(sessions) || sessions.length === 0) return;

    huntAnalyzerPendingDisenchantDustEvents.forEach((event) => {
        if (event.consumed) return;
        for (let i = sessions.length - 1; i >= 0; i--) {
            const session = sessions[i];
            const totalEquipmentDrops = getSessionEquipmentDropCount(session);
            if (totalEquipmentDrops <= 0) continue;
            if (!Array.isArray(session.capturedDisenchantDustValues)) {
                session.capturedDisenchantDustValues = [];
            }
            const captured = session.capturedDisenchantDustValues;
            if (event.equipmentId && captured.some((entry) => entry && entry.equipmentId === event.equipmentId)) {
                event.consumed = true;
                break;
            }
            if (captured.length >= totalEquipmentDrops) {
                continue;
            }
            captured.push({ equipmentId: event.equipmentId, dustValue: event.dustValue });
            event.consumed = true;
            console.log(`[Hunt Analyzer] Reconciled disenchant dust into session: room=${session.roomName || 'Unknown'} +${event.dustValue} dust (id=${event.equipmentId || 'n/a'})`);
            break;
        }
    });
}

function reconcilePendingCreatureSellEventsIntoSessions() {
    const sessions = HuntAnalyzerState?.data?.sessions;
    if (!Array.isArray(sessions) || sessions.length === 0) return;

    huntAnalyzerPendingCreatureSellEvents.forEach((event) => {
        if (event.consumed) return;
        for (let i = sessions.length - 1; i >= 0; i--) {
            const session = sessions[i];
            const totalDrops = getSessionCreatureDropCount(session);
            if (totalDrops <= 0) continue;
            if (!Array.isArray(session.capturedCreatureSellValues)) {
                session.capturedCreatureSellValues = [];
            }
            const captured = session.capturedCreatureSellValues;
            if (event.monsterId && captured.some((entry) => entry && entry.monsterId === event.monsterId)) {
                event.consumed = true;
                break;
            }
            if (captured.length >= totalDrops) {
                continue;
            }
            captured.push({ monsterId: event.monsterId, goldValue: event.goldValue, dustValue: event.dustValue || 0 });
            event.consumed = true;
            const dustLogSuffix = event.dustValue > 0 ? ` +${event.dustValue} dust` : '';
            console.log(`[Hunt Analyzer] Reconciled creature value: room=${session.roomName || 'Unknown'} +${event.goldValue}g${dustLogSuffix} (id=${event.monsterId || 'n/a'})`);
            break;
        }
    });
}

function installCreatureSellTrackingFetchHook() {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function' || huntAnalyzerOriginalFetch) {
        return;
    }

    huntAnalyzerOriginalFetch = window.fetch;
    huntAnalyzerFetchWrapper = async function(...args) {
        const response = await huntAnalyzerOriginalFetch.apply(this, args);
        try {
            const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
            if (typeof url === 'string' && url.includes('/api/trpc/game.sellMonster')) {
                const cloned = response.clone();
                cloned.json().then((data) => {
                    const payload = Array.isArray(data) ? data[0]?.result?.data?.json : null;
                    if (!payload) return;
                    registerCreatureSellValueByMonsterId(
                        payload.soldMonsterId,
                        payload.goldValue,
                        payload.dustDiff ?? payload.dustValue
                    );
                }).catch(() => {});
            }
            if (typeof url === 'string' && url.includes('/api/trpc/inventory.monsterSqueezer')) {
                const cloned = response.clone();
                cloned.json().then((data) => {
                    const payload = Array.isArray(data) ? data[0]?.result?.data?.json : null;
                    if (!payload) return;
                    const dustDiff = parsePossibleGoldValue(payload.dustDiff ?? payload.dustValue);
                    if (dustDiff <= 0) return;

                    let requestMonsterIds = [];
                    try {
                        const bodyRaw = args?.[1]?.body;
                        const bodyObj = typeof bodyRaw === 'string' ? JSON.parse(bodyRaw) : bodyRaw;
                        requestMonsterIds = bodyObj?.[0]?.json ?? bodyObj?.['0']?.json ?? [];
                    } catch (_e) {
                        requestMonsterIds = [];
                    }

                    if (Array.isArray(requestMonsterIds) && requestMonsterIds.length > 0) {
                        const perMonsterDust = Math.floor(dustDiff / requestMonsterIds.length);
                        const remainderDust = dustDiff - (perMonsterDust * requestMonsterIds.length);
                        requestMonsterIds.forEach((monsterId, index) => {
                            const shareDust = perMonsterDust + (index === 0 ? remainderDust : 0);
                            registerCreatureSellValueByMonsterId(monsterId, 0, shareDust);
                        });
                    } else {
                        registerCreatureSellValueByMonsterId(null, 0, dustDiff);
                    }
                }).catch(() => {});
            }
            if (typeof url === 'string' && url.includes('/api/trpc/quest.plantEat')) {
                const cloned = response.clone();
                cloned.json().then((data) => {
                    const payload = Array.isArray(data) ? data[0]?.result?.data?.json : null;
                    if (!payload) return;
                    const goldValue = parsePossibleGoldValue(payload.goldValue);
                    if (goldValue <= 0) return;

                    // If request body includes monsterIds, spread value across them; otherwise keep as unresolved event.
                    let requestMonsterIds = [];
                    try {
                        const bodyRaw = args?.[1]?.body;
                        const bodyObj = typeof bodyRaw === 'string' ? JSON.parse(bodyRaw) : null;
                        requestMonsterIds = bodyObj?.[0]?.json?.monsterIds || [];
                    } catch (_e) {
                        requestMonsterIds = [];
                    }

                    if (Array.isArray(requestMonsterIds) && requestMonsterIds.length > 0) {
                        const perMonster = Math.floor(goldValue / requestMonsterIds.length);
                        const remainder = goldValue - (perMonster * requestMonsterIds.length);
                        requestMonsterIds.forEach((monsterId, index) => {
                            const share = perMonster + (index === 0 ? remainder : 0);
                            registerCreatureSellValueByMonsterId(monsterId, share);
                        });
                    } else {
                        registerCreatureSellValueByMonsterId(null, goldValue);
                    }
                }).catch(() => {});
            }
            if (typeof url === 'string' && url.includes('/api/trpc/game.equipToDust')) {
                const cloned = response.clone();
                cloned.json().then((data) => {
                    const payload = Array.isArray(data) ? data[0]?.result?.data?.json : null;
                    if (!payload) {
                        console.log('[Hunt Analyzer] equipToDust payload missing; skipping dust capture');
                        return;
                    }
                    const dustDiff = parsePossibleGoldValue(payload.dustDiff);
                    if (dustDiff <= 0) {
                        console.log(`[Hunt Analyzer] equipToDust dustDiff invalid (${payload.dustDiff}); skipping`);
                        return;
                    }
                    let requestEquipmentId = null;
                    try {
                        const bodyRaw = args?.[1]?.body;
                        const bodyObj = typeof bodyRaw === 'string' ? JSON.parse(bodyRaw) : bodyRaw;
                        const rawJson = bodyObj?.[0]?.json ?? bodyObj?.['0']?.json ?? null;
                        if (typeof rawJson === 'string') {
                            requestEquipmentId = rawJson;
                        } else if (rawJson && typeof rawJson === 'object') {
                            requestEquipmentId = rawJson.equipmentId || null;
                        }
                    } catch (_e) {
                        requestEquipmentId = null;
                    }
                    registerDisenchantDustValueByEquipmentId(requestEquipmentId, dustDiff);
                }).catch(() => {});
            }
        } catch (_e) {
            // Non-fatal: tracking should never block requests.
        }
        return response;
    };
    window.fetch = huntAnalyzerFetchWrapper;
}

function resolveCreatureSellValue(monsterDrop, fallbackTierLevel = 0, fallbackTotalGenes = 0) {
    // Response-only mode: creature value is tracked from sell/devour API responses.
    return 0;
}

function getSessionCreatureSellValue(session) {
    if (!session || !Array.isArray(session.creatures) || session.creatures.length === 0) return 0;
    const capturedValues = getSessionCapturedCreatureSellValues(session);
    const capturedTotal = capturedValues.reduce((acc, entry) => acc + parsePossibleGoldValue(entry?.goldValue), 0);
    return capturedTotal > 0 ? capturedTotal : 0;
}

function getSessionCreatureSqueezeDustValue(session) {
    if (!session || !Array.isArray(session.creatures) || session.creatures.length === 0) return 0;
    const capturedValues = getSessionCapturedCreatureSellValues(session);
    return capturedValues.reduce((acc, entry) => acc + parsePossibleGoldValue(entry?.dustValue), 0);
}

function getSessionDisenchantDustValue(session) {
    const capturedValues = getSessionCapturedDisenchantDustValues(session);
    return capturedValues.reduce((acc, entry) => acc + parsePossibleGoldValue(entry?.dustValue), 0);
}

function getFilteredGoldBreakdown() {
    const includeCreatureSellValue = HuntAnalyzerState.settings.includeCreatureSellValue !== false;
    const includeDragonPlantCollect = HuntAnalyzerState.settings.includeDragonPlantCollect !== false;
    let baseGold = 0;
    let creatureSellGold = 0;

    HuntAnalyzerState.data.sessions.forEach((session) => {
        if (HuntAnalyzerState.ui.selectedMapFilter !== 'ALL' && session?.roomName !== HuntAnalyzerState.ui.selectedMapFilter) {
            return;
        }
        const sessionGold = getSessionGoldAndDust(session).gold;
        baseGold += sessionGold;
        creatureSellGold += getSessionCreatureSellValue(session);
    });

    const dragonPlantBonusGold = includeDragonPlantCollect
        ? Math.max(0, Math.floor(Number(HuntAnalyzerState.totals.dragonPlantBonusGold) || 0))
        : 0;

    let total = baseGold;
    if (includeCreatureSellValue) {
        total += creatureSellGold;
    }
    if (includeDragonPlantCollect) {
        total += dragonPlantBonusGold;
    }

    return {
        baseGold: Math.max(0, Math.floor(baseGold)),
        creatureSellGold: Math.max(0, Math.floor(creatureSellGold)),
        dragonPlantBonusGold,
        includeCreatureSellValue,
        includeDragonPlantCollect,
        total: Math.max(0, Math.floor(total))
    };
}

function getSessionDustBreakdown(session) {
    const lootDust = Math.max(0, getSessionGoldAndDust(session).dust);
    const equipmentDisenchantDust = Math.max(0, getSessionDisenchantDustValue(session));
    const creatureSqueezeDust = Math.max(0, getSessionCreatureSqueezeDustValue(session));
    return {
        lootDust,
        equipmentDisenchantDust,
        creatureSqueezeDust,
        total: lootDust + equipmentDisenchantDust + creatureSqueezeDust
    };
}

function getFilteredDustBreakdown() {
    const includeDisenchantedEquipments = HuntAnalyzerState.settings.includeDisenchantedEquipments !== false;
    let lootDust = 0;
    let equipmentDisenchantDust = 0;
    let creatureSqueezeDust = 0;
    HuntAnalyzerState.data.sessions.forEach((session) => {
        if (HuntAnalyzerState.ui.selectedMapFilter !== 'ALL' && session?.roomName !== HuntAnalyzerState.ui.selectedMapFilter) {
            return;
        }
        const sessionDust = getSessionDustBreakdown(session);
        lootDust += sessionDust.lootDust;
        if (includeDisenchantedEquipments) {
            equipmentDisenchantDust += sessionDust.equipmentDisenchantDust;
            creatureSqueezeDust += sessionDust.creatureSqueezeDust || 0;
        }
    });
    return {
        lootDust: Math.max(0, Math.floor(lootDust)),
        equipmentDisenchantDust: Math.max(0, Math.floor(equipmentDisenchantDust)),
        creatureSqueezeDust: Math.max(0, Math.floor(creatureSqueezeDust)),
        includeDisenchantedEquipments,
        total: Math.max(0, Math.floor(lootDust + equipmentDisenchantDust + creatureSqueezeDust))
    };
}

function getEffectiveSessionGold(session, includeCreatureSellValue = HuntAnalyzerState.settings.includeCreatureSellValue !== false) {
    const baseGold = getSessionGoldAndDust(session).gold;
    if (!includeCreatureSellValue) {
        return baseGold;
    }
    return baseGold + getSessionCreatureSellValue(session);
}

function getDragonPlantAutocollectSummaryStatus() {
    if (HuntAnalyzerState.settings.includeDragonPlantCollect === false) {
        return null;
    }

    const plantDetails = getDragonPlantTooltipDetails();
    if (!plantDetails || plantDetails.collectCount <= 0) {
        return null;
    }
    return `${formatExpValue(plantDetails.totalBonusGold)} (${plantDetails.collectCount}x)`;
}

function registerDragonPlantCollectEvent(withdrawnFromPlant) {
    const withdrawn = Math.max(0, Math.floor(Number(withdrawnFromPlant) || 0));
    if (withdrawn <= 0) return;

    const bonusGold = Math.floor(withdrawn * DRAGON_PLANT_COLLECT_BONUS_RATE);
    if (bonusGold <= 0) return;

    huntAnalyzerLastCollectedPlantGoldValue = bonusGold;
    HuntAnalyzerState.totals.dragonPlantBonusGold += bonusGold;

    if (huntAnalyzerPlantCollectBurstTimeoutId == null) {
        HuntAnalyzerState.totals.dragonPlantCollects += 1;
    }
    clearTimeout(huntAnalyzerPlantCollectBurstTimeoutId);
    huntAnalyzerPlantCollectBurstTimeoutId = setTimeout(() => {
        huntAnalyzerPlantCollectBurstTimeoutId = null;
    }, HUNT_ANALYZER_PLANT_COLLECT_BURST_MS);
}

function trackDragonPlantCollectionValue() {
    if (HuntAnalyzerState.settings.includeDragonPlantCollect === false) {
        huntAnalyzerLastObservedPlantGold = null;
        return;
    }

    const plantGoldRaw = globalThis.state?.player?.getSnapshot?.()?.context?.questLog?.plant?.gold;
    const plantGold = Number(plantGoldRaw);
    if (!Number.isFinite(plantGold) || plantGold < 0) return;

    if (Number.isFinite(huntAnalyzerLastObservedPlantGold) && plantGold < huntAnalyzerLastObservedPlantGold) {
        const collected = Math.floor(huntAnalyzerLastObservedPlantGold - plantGold);
        registerDragonPlantCollectEvent(collected);
    }
    huntAnalyzerLastObservedPlantGold = plantGold;
}

function getDragonPlantTooltipDetails() {
    if (HuntAnalyzerState.settings.includeDragonPlantCollect === false) {
        return null;
    }
    const collectCount = Math.max(0, Math.floor(Number(HuntAnalyzerState.totals.dragonPlantCollects) || 0));
    const totalBonusGold = Math.max(0, Math.floor(Number(HuntAnalyzerState.totals.dragonPlantBonusGold) || 0));
    return {
        collectCount,
        totalBonusGold
    };
}

function createEmptyMapGroupStats(fallbackStartTime) {
    return {
        sessions: 0,
        wins: 0,
        losses: 0,
        loot: new Map(),
        creatures: new Map(),
        totalGold: 0,
        totalLootGold: 0,
        totalCreatureSellGold: 0,
        totalDust: 0,
        totalLootDust: 0,
        totalDisenchantDust: 0,
        totalCreatureSqueezeDust: 0,
        totalStamina: 0,
        totalExperience: 0,
        totalEquipment: 0,
        totalCreatures: 0,
        totalShiny: 0,
        totalSealed: 0,
        startTime: fallbackStartTime,
        endTime: fallbackStartTime,
        hasTimestamps: false
    };
}

function ingestSessionIntoMapGroup(group, session, overallStartTime) {
    group.sessions += 1;
    if (session.victory === true) group.wins += 1;
    else if (session.victory === false) group.losses += 1;

    const { gold: sessionLootGold } = getSessionGoldAndDust(session);
    const sessionDust = getSessionDustBreakdown(session);
    const sessionCreatureSellGold = getSessionCreatureSellValue(session);
    group.totalLootGold += sessionLootGold;
    group.totalCreatureSellGold += sessionCreatureSellGold;
    group.totalGold += getEffectiveSessionGold(session);
    group.totalLootDust += sessionDust.lootDust;
    group.totalDisenchantDust += sessionDust.equipmentDisenchantDust;
    group.totalCreatureSqueezeDust += sessionDust.creatureSqueezeDust || 0;
    group.totalDust += sessionDust.total;
    group.totalStamina += session.staminaSpent || 0;
    group.totalExperience += sessionStoredExperience(session);

    if (session.timestamp) {
        group.hasTimestamps = true;
        group.startTime = Math.min(group.startTime, session.timestamp);
        group.endTime = Math.max(group.endTime, session.timestamp);
    } else {
        group.startTime = Math.min(group.startTime, overallStartTime);
        group.endTime = Math.max(group.endTime, Date.now());
    }

    (session.loot || []).forEach((item) => {
        mergeAggregateEntry(group.loot, buildLootAggregateKey(item), item);
        if (item.isEquipment) group.totalEquipment += item.count;
    });

    (session.creatures || []).forEach((creature) => {
        mergeAggregateEntry(group.creatures, buildCreatureAggregateKey(creature), creature);
        group.totalCreatures += creature.count;
        if (creature.isShiny) group.totalShiny += creature.count;
        if (creature.isSealed) group.totalSealed += creature.count;
    });
}

function buildMapGroupsFromSessions(sessions) {
    const mapGroups = {};
    const overallStartTime = HuntAnalyzerState.session.startTime;
    sessions.forEach((session) => {
        const mapName = session.roomName || t('mods.huntAnalyzer.unknownMap');
        if (!mapGroups[mapName]) {
            mapGroups[mapName] = createEmptyMapGroupStats(session.timestamp || overallStartTime);
        }
        ingestSessionIntoMapGroup(mapGroups[mapName], session, overallStartTime);
    });
    return mapGroups;
}

function formatLootSummaryLine(item) {
    let itemLine = `    ${item.originalName}: x${item.count}`;
    if (item.rarity > 0) {
        const rarityText = item._descriptiveRarity
            || window.inventoryDatabase?.rarityText?.[item.rarity]
            || `Rarity ${item.rarity}`;
        itemLine += ` (${rarityText})`;
    }
    if (item.isEquipment && item.stat) {
        itemLine += ` (Stat: ${item.stat.toUpperCase()})`;
    }
    return itemLine;
}

function formatCreatureSummaryLine(creature) {
    let creatureLine = `    ${creature.originalName} (${creature.tierName}): x${creature.count}`;
    if (creature.isShiny) creatureLine = `    ✨ ${creatureLine}`;
    if (creature.isSealed) creatureLine = `    ⭐ ${creatureLine}`;
    return creatureLine;
}

function appendMapAnalysisSection(summary, mapGroups) {
    summary += `--- ${t('mods.huntAnalyzer.mapAnalysis')} ---\n`;
    const mapNames = Object.keys(mapGroups);
    if (mapNames.length === 0) {
        summary += `${t('mods.huntAnalyzer.noSessionsRecorded')}\n`;
        return summary;
    }

    mapNames
        .sort((a, b) => mapGroups[b].sessions - mapGroups[a].sessions)
        .forEach((mapName) => {
            const mapData = mapGroups[mapName];
            const mapTimeHours = (mapData.endTime - mapData.startTime) / (1000 * 60 * 60);
            const mapStats = {
                sessions: mapData.sessions,
                gold: mapData.totalGold,
                creatures: mapData.totalCreatures,
                equipment: mapData.totalEquipment,
                experience: mapData.totalExperience,
                staminaSpent: mapData.totalStamina
            };
            const rates = calculateRawHourlyRates(mapTimeHours, mapStats);
            const efficiency = calculateEfficiencyMetrics(mapStats);
            const mapLootGoldRate = mapTimeHours > 0 ? Math.floor(mapData.totalLootGold / mapTimeHours) : 0;
            const mapCreatureGoldRate = mapTimeHours > 0 ? Math.floor(mapData.totalCreatureSellGold / mapTimeHours) : 0;
            const mapLootDustRate = mapTimeHours > 0 ? Math.floor(mapData.totalLootDust / mapTimeHours) : 0;
            const mapDisenchantDustRate = mapTimeHours > 0 ? Math.floor(mapData.totalDisenchantDust / mapTimeHours) : 0;
            const mapCreatureSqueezeDustRate = mapTimeHours > 0 ? Math.floor((mapData.totalCreatureSqueezeDust || 0) / mapTimeHours) : 0;
            const mapWinRate = (mapData.wins + mapData.losses) > 0
                ? Math.round((mapData.wins / (mapData.wins + mapData.losses)) * 100)
                : 0;

            summary += `\n${mapName}:\n`;
            summary += `  ${t('mods.huntAnalyzer.sessions')}: ${mapData.sessions} | ${t('mods.huntAnalyzer.winLoss')}: ${mapData.wins}/${mapData.losses} (${mapWinRate}%) | ${t('mods.huntAnalyzer.time')}: ${formatTime(mapData.endTime - mapData.startTime)}${mapData.hasTimestamps ? '' : ` (${t('mods.huntAnalyzer.estimated')})`}\n`;
            summary += `  ${t('mods.huntAnalyzer.gold')}: ${mapData.totalGold} | ${t('mods.huntAnalyzer.dust')}: ${mapData.totalDust} | ${t('mods.huntAnalyzer.stamina')}: ${mapData.totalStamina} | ${t('mods.huntAnalyzer.experience')}: ${formatExpValue(mapData.totalExperience)}\n`;
            summary += `  ${t('mods.huntAnalyzer.goldSources')}: ${t('mods.huntAnalyzer.loot')} ${mapData.totalLootGold} | ${t('mods.huntAnalyzer.creatures')} ${mapData.totalCreatureSellGold}\n`;
            if (HuntAnalyzerState.settings.includeDisenchantedEquipments !== false) {
                summary += `  ${t('mods.huntAnalyzer.dustSources')}: ${t('mods.huntAnalyzer.loot')} ${mapData.totalLootDust} | ${t('mods.huntAnalyzer.disenchants')} ${mapData.totalDisenchantDust} | ${t('mods.huntAnalyzer.creatureSqueezes')} ${mapData.totalCreatureSqueezeDust || 0}\n`;
            } else {
                summary += `  ${t('mods.huntAnalyzer.dustSources')}: ${t('mods.huntAnalyzer.loot')} ${mapData.totalLootDust}\n`;
            }
            summary += `  ${t('mods.huntAnalyzer.equipment')}: ${mapData.totalEquipment} | ${t('mods.huntAnalyzer.creatures')}: ${mapData.totalCreatures} (${t('mods.huntAnalyzer.shiny')}: ${mapData.totalShiny} | ${t('mods.huntAnalyzer.sealed')}: ${mapData.totalSealed})\n`;
            summary += `  ${t('mods.huntAnalyzer.rates')}: ${rates.sessions} ${t('mods.huntAnalyzer.sessionsPerHour')} | ${rates.gold} ${t('mods.huntAnalyzer.goldPerHour')} | ${rates.creatures} ${t('mods.huntAnalyzer.creaturesPerHour')} | ${rates.equipment} ${t('mods.huntAnalyzer.equipmentPerHour')} | ${formatExpValue(rates.experience)} ${t('mods.huntAnalyzer.expPerHour')}\n`;
            summary += `  ${t('mods.huntAnalyzer.goldSourceRates')}: ${t('mods.huntAnalyzer.loot')} ${mapLootGoldRate} ${t('mods.huntAnalyzer.goldPerHour')} | ${t('mods.huntAnalyzer.creatures')} ${mapCreatureGoldRate} ${t('mods.huntAnalyzer.goldPerHour')}\n`;
            if (HuntAnalyzerState.settings.includeDisenchantedEquipments !== false) {
                summary += `  ${t('mods.huntAnalyzer.dustSourceRates')}: ${t('mods.huntAnalyzer.loot')} ${mapLootDustRate} ${t('mods.huntAnalyzer.dustPerHour')} | ${t('mods.huntAnalyzer.disenchants')} ${mapDisenchantDustRate} ${t('mods.huntAnalyzer.dustPerHour')} | ${t('mods.huntAnalyzer.creatureSqueezes')} ${mapCreatureSqueezeDustRate} ${t('mods.huntAnalyzer.dustPerHour')}\n`;
            } else {
                summary += `  ${t('mods.huntAnalyzer.dustSourceRates')}: ${t('mods.huntAnalyzer.loot')} ${mapLootDustRate} ${t('mods.huntAnalyzer.dustPerHour')}\n`;
            }
            summary += `  ${t('mods.huntAnalyzer.efficiency')}: ${efficiency.goldPerStamina} ${t('mods.huntAnalyzer.goldPerStamina')} | ${efficiency.sessionsPerStamina} ${t('mods.huntAnalyzer.sessionsPerStamina')} | ${rates.staminaSpent} ${t('mods.huntAnalyzer.staminaPerHour')}\n`;

            const sortedLoot = Array.from(mapData.loot.values()).sort(compareLootEntries);
            if (sortedLoot.length > 0) {
                summary += `  ${t('mods.huntAnalyzer.loot')}:\n`;
                sortedLoot.forEach((item) => {
                    summary += `${formatLootSummaryLine(item)}\n`;
                });
            }

            const sortedCreatures = Array.from(mapData.creatures.values()).sort(compareCreatureEntries);
            if (sortedCreatures.length > 0) {
                summary += `  ${t('mods.huntAnalyzer.creatures')}:\n`;
                sortedCreatures.forEach((creature) => {
                    summary += `${formatCreatureSummaryLine(creature)}\n`;
                });
            }
        });

    return summary;
}

// Generates a summarized log text of all aggregated loot and creature drops.
// This is the text that will be copied to the user's clipboard.
function generateSummaryLogText() {
    const sessions = HuntAnalyzerState.data.sessions;
    const filteredTimeHours = getFilteredTimeHours();
    const goldBreakdown = getFilteredGoldBreakdown();
    const overallStats = {
        sessions: HuntAnalyzerState.session.count,
        gold: goldBreakdown.total,
        creatures: HuntAnalyzerState.totals.creatures,
        equipment: HuntAnalyzerState.totals.equipment,
        experience: HuntAnalyzerState.totals.experience,
        staminaSpent: HuntAnalyzerState.totals.staminaSpent
    };
    const overallRates = calculateRawHourlyRates(filteredTimeHours, overallStats);
    const overallEfficiency = calculateEfficiencyMetrics(overallStats);
    const dustBreakdown = getFilteredDustBreakdown();
    const dragonPlantStatus = getDragonPlantAutocollectSummaryStatus();
    const overallLootGoldRate = filteredTimeHours > 0 ? Math.floor(goldBreakdown.baseGold / filteredTimeHours) : 0;
    const overallCreatureGoldRate = filteredTimeHours > 0 ? Math.floor(goldBreakdown.creatureSellGold / filteredTimeHours) : 0;
    const overallDragonPlantGoldRate = filteredTimeHours > 0 ? Math.floor(goldBreakdown.dragonPlantBonusGold / filteredTimeHours) : 0;
    const overallLootDustRate = filteredTimeHours > 0 ? Math.floor(dustBreakdown.lootDust / filteredTimeHours) : 0;
    const overallDisenchantDustRate = filteredTimeHours > 0 ? Math.floor(dustBreakdown.equipmentDisenchantDust / filteredTimeHours) : 0;
    const overallCreatureSqueezeDustRate = filteredTimeHours > 0 ? Math.floor((dustBreakdown.creatureSqueezeDust || 0) / filteredTimeHours) : 0;
    const totalSessionsForWinRate = HuntAnalyzerState.totals.wins + HuntAnalyzerState.totals.losses;
    const winRate = totalSessionsForWinRate > 0
        ? Math.round((HuntAnalyzerState.totals.wins / totalSessionsForWinRate) * 100)
        : 0;

    let summary = `--- ${t('mods.huntAnalyzer.logSummaryTitle')} ---\n`;
    summary += `${t('mods.huntAnalyzer.room')}: ${getSummaryRoomDisplayName(sessions)}\n`;
    summary += `${t('mods.huntAnalyzer.sessions')}: ${HuntAnalyzerState.session.count}\n`;

    const floorBreakdown = formatFloorSessionBreakdown(sessions);
    if (floorBreakdown) {
        summary += `${t('mods.huntAnalyzer.sessionsByFloor')}: ${floorBreakdown}\n`;
    }

    summary += `${t('mods.huntAnalyzer.winLoss')}: ${HuntAnalyzerState.totals.wins}/${HuntAnalyzerState.totals.losses} (${winRate}%)\n`;
    summary += `${t('mods.huntAnalyzer.timeElapsed')}: ${formatTime(filteredTimeHours * 60 * 60 * 1000)}\n`;
    summary += `${t('mods.huntAnalyzer.gold')}: ${goldBreakdown.total} | ${t('mods.huntAnalyzer.dust')}: ${dustBreakdown.total}\n`;
    let goldSourcesLine = `${t('mods.huntAnalyzer.loot')} ${goldBreakdown.baseGold} | ${t('mods.huntAnalyzer.creatures')} ${goldBreakdown.creatureSellGold}`;
    let goldSourceRatesLine = `${t('mods.huntAnalyzer.loot')} ${overallLootGoldRate} ${t('mods.huntAnalyzer.goldPerHour')} | ${t('mods.huntAnalyzer.creatures')} ${overallCreatureGoldRate} ${t('mods.huntAnalyzer.goldPerHour')}`;
    if (goldBreakdown.includeDragonPlantCollect) {
        goldSourcesLine += ` | ${t('mods.huntAnalyzer.dragonPlant')} ${goldBreakdown.dragonPlantBonusGold}`;
        goldSourceRatesLine += ` | ${t('mods.huntAnalyzer.dragonPlant')} ${overallDragonPlantGoldRate} ${t('mods.huntAnalyzer.goldPerHour')}`;
    }
    summary += `${t('mods.huntAnalyzer.goldSources')}: ${goldSourcesLine}\n`;
    summary += `${t('mods.huntAnalyzer.goldSourceRates')}: ${goldSourceRatesLine}\n`;
    if (dustBreakdown.includeDisenchantedEquipments) {
        summary += `${t('mods.huntAnalyzer.dustSources')}: ${t('mods.huntAnalyzer.loot')} ${dustBreakdown.lootDust} | ${t('mods.huntAnalyzer.disenchants')} ${dustBreakdown.equipmentDisenchantDust} | ${t('mods.huntAnalyzer.creatureSqueezes')} ${dustBreakdown.creatureSqueezeDust || 0}\n`;
        summary += `${t('mods.huntAnalyzer.dustSourceRates')}: ${t('mods.huntAnalyzer.loot')} ${overallLootDustRate} ${t('mods.huntAnalyzer.dustPerHour')} | ${t('mods.huntAnalyzer.disenchants')} ${overallDisenchantDustRate} ${t('mods.huntAnalyzer.dustPerHour')} | ${t('mods.huntAnalyzer.creatureSqueezes')} ${overallCreatureSqueezeDustRate} ${t('mods.huntAnalyzer.dustPerHour')}\n`;
    } else {
        summary += `${t('mods.huntAnalyzer.dustSources')}: ${t('mods.huntAnalyzer.loot')} ${dustBreakdown.lootDust}\n`;
        summary += `${t('mods.huntAnalyzer.dustSourceRates')}: ${t('mods.huntAnalyzer.loot')} ${overallLootDustRate} ${t('mods.huntAnalyzer.dustPerHour')}\n`;
    }
    if (dragonPlantStatus) {
        summary += `${t('mods.huntAnalyzer.dragonPlant')}: ${dragonPlantStatus}\n`;
    }
    summary += `${t('mods.huntAnalyzer.equipmentDrops')}: ${HuntAnalyzerState.totals.equipment} | ${t('mods.huntAnalyzer.creatureDrops')}: ${HuntAnalyzerState.totals.creatures} (${t('mods.huntAnalyzer.shinyDrops')}: ${HuntAnalyzerState.totals.shiny} | ${t('mods.huntAnalyzer.sealedDrops')}: ${HuntAnalyzerState.totals.sealed})\n`;
    summary += `${t('mods.huntAnalyzer.totalStaminaSpent')}: ${HuntAnalyzerState.totals.staminaSpent}\n`;
    summary += `${t('mods.huntAnalyzer.experience')}: ${formatExpValue(HuntAnalyzerState.totals.experience)} | ${formatExpValue(overallRates.experience)} ${t('mods.huntAnalyzer.expPerHour')}\n`;
    summary += `---------------------------\n`;
    summary += `${t('mods.huntAnalyzer.overallRates')}: ${overallRates.sessions} ${t('mods.huntAnalyzer.sessionsPerHour')} | ${overallRates.gold} ${t('mods.huntAnalyzer.goldPerHour')} | ${overallRates.creatures} ${t('mods.huntAnalyzer.creaturesPerHour')} | ${overallRates.equipment} ${t('mods.huntAnalyzer.equipmentPerHour')} | ${formatExpValue(overallRates.experience)} ${t('mods.huntAnalyzer.expPerHour')}\n`;
    summary += `${t('mods.huntAnalyzer.overallEfficiency')}: ${overallEfficiency.goldPerStamina} ${t('mods.huntAnalyzer.goldPerStamina')} | ${overallEfficiency.sessionsPerStamina} ${t('mods.huntAnalyzer.sessionsPerStamina')} | ${overallRates.staminaSpent} ${t('mods.huntAnalyzer.staminaPerHour')}\n`;
    summary += `${t('mods.huntAnalyzer.generated')}: ${new Date().toLocaleString()}\n`;
    summary += `---------------------------\n\n`;

    summary = appendMapAnalysisSection(
        summary,
        sessions.length > 0 ? buildMapGroupsFromSessions(sessions) : {}
    );
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
    gridContainer.style.gap = '6px';
    return gridContainer;
}

function createGridEntryCell() {
    const cell = document.createElement('div');
    cell.style.display = 'flex';
    cell.style.flexDirection = 'column';
    cell.style.alignItems = 'center';
    cell.style.justifyContent = 'center';
    cell.style.padding = '4px';
    cell.style.backgroundColor = getThemeColor('entryBackground');
    cell.style.borderRadius = '6px';
    return cell;
}

function createGridIconWrapper() {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.justifyContent = 'center';
    wrapper.style.alignItems = 'center';
    return wrapper;
}

function mountGridVisual(iconWrapper, visualElement, fallbackEmoji) {
    if (visualElement instanceof HTMLElement) {
        iconWrapper.appendChild(visualElement);
        return;
    }
    iconWrapper.textContent = visualElement || fallbackEmoji;
    iconWrapper.style.fontSize = '24px';
}

function updateFilteredSectionTitle(titleId, labelKey, totalCount) {
    const title = document.getElementById(titleId);
    if (!title) return;
    const filterText = HuntAnalyzerState.ui.selectedMapFilter === 'ALL'
        ? ''
        : ` (${HuntAnalyzerState.ui.selectedMapFilter})`;
    title.textContent = `${t(labelKey)}: ${totalCount}${filterText}`;
}

function setCompactTotalDisplay(element, value) {
    if (!element) return;
    element.textContent = formatCompactInt(value);
    element.setAttribute('title', formatExactInt(value));
}

function updatePanelResourceTotalDisplays(elementById) {
    HUNT_ANALYZER_PANEL_RESOURCE_TOTALS.forEach(({ amountId, totalKey }) => {
        const element = elementById?.[amountId]
            ?? domCache.get(amountId)
            ?? document.getElementById(amountId);
        if (totalKey === 'gold') {
            const breakdown = getFilteredGoldBreakdown();
            const creatureLine = breakdown.includeCreatureSellValue
                ? `\n${t('mods.huntAnalyzer.creatures')}: ${formatExactInt(breakdown.creatureSellGold)}`
                : '';
            const dragonPlantLine = breakdown.includeDragonPlantCollect
                ? `\n${t('mods.huntAnalyzer.dragonPlant')}: ${formatExactInt(breakdown.dragonPlantBonusGold)}`
                : '';
            setCompactTotalDisplay(element, breakdown.total);
            element.setAttribute(
                'title',
                `${t('mods.huntAnalyzer.lootGold')}: ${formatExactInt(breakdown.baseGold)}${creatureLine}${dragonPlantLine}`
            );
            return;
        }
        if (totalKey === 'dust') {
            const dustBreakdown = getFilteredDustBreakdown();
            const disenchantLine = dustBreakdown.includeDisenchantedEquipments
                ? `\n${t('mods.huntAnalyzer.disenchants')}: ${formatExactInt(dustBreakdown.equipmentDisenchantDust)}`
                : '';
            const squeezeLine = dustBreakdown.includeDisenchantedEquipments
                ? `\n${t('mods.huntAnalyzer.creatureSqueezes')}: ${formatExactInt(dustBreakdown.creatureSqueezeDust || 0)}`
                : '';
            setCompactTotalDisplay(element, dustBreakdown.total);
            element.setAttribute(
                'title',
                `${t('mods.huntAnalyzer.loot')}: ${formatExactInt(dustBreakdown.lootDust)}${disenchantLine}${squeezeLine}`
            );
            return;
        }
        setCompactTotalDisplay(element, HuntAnalyzerState.totals[totalKey]);
    });
}

function resolveLootGridVisual(data) {
    let equipmentGameId = data.gameId;
    if (data.isEquipment && !equipmentGameId && data.spriteId) {
        equipmentGameId = data.spriteId;
    }

    if (data.isEquipment && equipmentGameId && typeof globalThis.state?.utils?.getEquipment === 'function') {
        try {
            const equipData = globalThis.state.utils.getEquipment(equipmentGameId);
            if (equipData?.metadata && typeof equipData.metadata.spriteId === 'number') {
                const equipmentSpriteId = equipData.metadata.spriteId;

                if (api?.ui?.components?.createItemPortrait) {
                    const equipmentPortrait = api.ui.components.createItemPortrait({
                        itemId: equipmentSpriteId,
                        tier: data.rarity || 1
                    });

                    if (equipmentPortrait?.nodeType) {
                        if (equipmentPortrait.tagName === 'BUTTON' && equipmentPortrait.firstChild?.nodeType) {
                            const portrait = equipmentPortrait.firstChild;
                            portrait.appendChild(createCountOverlay(data.count));
                            addStatIconToPortrait(portrait, data.stat);
                            return portrait;
                        }
                        addStatIconToPortrait(equipmentPortrait, data.stat);
                        return equipmentPortrait;
                    }
                }
            }
        } catch (e) {
            console.warn('[Hunt Analyzer] Error creating equipment API component:', e);
        }
    }

    let visualElement = data.visual;
    if (!(visualElement instanceof HTMLElement)) {
        visualElement = createInventoryStyleItemPortrait({
            spriteId: data.spriteId,
            src: data.src,
            spriteSrc: data.src,
            originalName: data.originalName,
            rarity: data.rarity,
            count: data.count,
            isEquipment: data.isEquipment,
            gameId: data.gameId,
            stat: data.stat
        });
    }
    return visualElement;
}

function resolveCreatureGridVisual(data) {
    if (data.gameId) {
        return createInventoryStyleCreaturePortrait(data);
    }
    if (data.visual instanceof HTMLElement) {
        const countSpan = data.visual.querySelector('.pixel-font-16');
        if (countSpan) countSpan.textContent = data.count || 1;
        return data.visual;
    }
    return '👾';
}

// Creates a framed drop section (used by loot and creature containers)
function createDropSection({ containerClassName, titleId, displayId }) {
    const container = document.createElement("div");
    container.className = containerClassName;
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.flex = "1 1 0";
    container.style.minHeight = "0";
    applyFramedSectionStyles(container, { noTopMargin: true });
    container.style.overflowY = "auto";

    const titleContainer = document.createElement("div");
    titleContainer.style.display = "flex";
    titleContainer.style.alignItems = "center";
    titleContainer.style.justifyContent = "center";
    titleContainer.style.marginBottom = "3px";

    const title = document.createElement("h3");
    title.id = titleId;
    title.style.margin = "0px";
    title.style.fontSize = "14px";
    title.style.fontWeight = "bold";
    applyAccentTitleStyle(title);
    titleContainer.appendChild(title);

    const displayDiv = document.createElement("div");
    displayDiv.id = displayId;
    displayDiv.style.width = "100%";
    displayDiv.style.padding = "4px";
    applyThemeFramedDisplaySurface(displayDiv);
    displayDiv.style.fontSize = "11px";
    displayDiv.style.overflowY = "scroll";
    displayDiv.style.flexGrow = "1";
    displayDiv.style.display = "flex";
    displayDiv.style.flexDirection = "column";
    displayDiv.style.gap = "6px";

    container.appendChild(titleContainer);
    container.appendChild(displayDiv);

    return { container, titleContainer, title, displayDiv };
}

// =======================
// 5.0. Event Handler Functions
// =======================

// Helper function to update minimize button state
function updateMinimizeButtonState(minimizeBtn, isMinimized) {
    if (!minimizeBtn) return;
    if (isMinimized) {
        minimizeBtn.textContent = '+';
        minimizeBtn.title = t('mods.huntAnalyzer.restoreAnalyzer');
    } else {
        minimizeBtn.textContent = '–';
        minimizeBtn.title = t('mods.huntAnalyzer.minimizeAnalyzer');
    }
}

// Helper function to update style button state
function updateStyleButtonState(styleButton, mode) {
    if (!styleButton) return;
    if (mode === LAYOUT_MODES.MINIMIZED) {
        styleButton.style.display = 'none';
        return;
    }

    styleButton.style.display = 'flex';
    if (mode === LAYOUT_MODES.VERTICAL) {
        styleButton.textContent = t('mods.huntAnalyzer.horizontal');
        styleButton.title = t('mods.huntAnalyzer.switchToHorizontalLayout');
    } else if (mode === LAYOUT_MODES.HORIZONTAL) {
        styleButton.textContent = t('mods.huntAnalyzer.vertical');
        styleButton.title = t('mods.huntAnalyzer.switchToVerticalLayout');
    }
}

// Helper function to apply layout dimensions to panel
function applyLayoutDimensions(panel, mode) {
    const layout = LAYOUT_DIMENSIONS[mode];
    if (!layout) return;
    
    panel.style.width = layout.width + 'px';
    panel.style.height = layout.height + 'px';
    panel.style.minWidth = layout.minWidth + 'px';
    panel.style.maxWidth = layout.maxWidth + 'px';
    panel.style.minHeight = layout.minHeight + 'px';
    panel.style.maxHeight = layout.maxHeight + 'px';
}

// Handles the style button click for layout switching
function handleStyleButtonClick(panel, styleButton, minimizeBtn) {
    // Only toggle between vertical and horizontal
    if (panelState.mode === LAYOUT_MODES.MINIMIZED) {
        // If minimized, restore to last non-minimized mode, then toggle
        panelState.mode = panelState._lastMode || LAYOUT_MODES.VERTICAL;
    }
    // Toggle between vertical and horizontal
    if (panelState.mode === LAYOUT_MODES.VERTICAL) {
        panelState.mode = LAYOUT_MODES.HORIZONTAL;
    } else {
        panelState.mode = LAYOUT_MODES.VERTICAL;
    }
    // Always update _lastMode for minimize restore
    panelState._lastMode = panelState.mode;
    // Apply layout dimensions for the new mode
    applyLayoutDimensions(panel, panelState.mode);
    updatePanelLayout(panel);
    updatePanelPosition();
    // Update button states
    updateMinimizeButtonState(minimizeBtn, false);
    updateStyleButtonState(styleButton, panelState.mode);
    // Save panel settings after layout change
    savePanelSettings(panel);
}

// Handles the minimize button click
function handleMinimizeButtonClick(panel, styleButton, minimizeBtn) {
    const wasMinimized = panelState.mode === LAYOUT_MODES.MINIMIZED;
    
    if (!wasMinimized) {
        // Minimize: store current mode and switch to minimized
        panelState._lastMode = panelState.mode;
        panelState.mode = LAYOUT_MODES.MINIMIZED;
    } else {
        // Restore: switch back to last mode
        panelState.mode = panelState._lastMode || LAYOUT_MODES.VERTICAL;
    }
    
    // Apply layout dimensions for the new mode
    applyLayoutDimensions(panel, panelState.mode);
    updatePanelLayout(panel);
    updatePanelPosition();
    
    // Update button states
    updateMinimizeButtonState(minimizeBtn, !wasMinimized);
    // Always sync style button visibility with current mode:
    // minimized => hidden, otherwise => shown with correct label.
    updateStyleButtonState(styleButton, panelState.mode);
    
    // Re-render loot and creature drops when restoring from minimized
    if (wasMinimized) {
        renderAllSessions();
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
    if (updateIntervalId) {
        clearInterval(updateIntervalId);
        updateIntervalId = null;
    }
    // Stop auto-save interval
    if (autoSaveIntervalId) {
        clearInterval(autoSaveIntervalId);
        autoSaveIntervalId = null;
    }
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
function createResourceDisplay(iconSrc, iconAlt, amountId, colorKey = 'text', rowHeight) {
    const displayDiv = document.createElement('div');
    displayDiv.style.display = 'flex';
    displayDiv.style.alignItems = 'center';
    displayDiv.style.gap = '4px';
    if (rowHeight) displayDiv.style.height = rowHeight;

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

function appendPanelResourceTotals(parent, rowHeight) {
    const spansById = {};
    HUNT_ANALYZER_PANEL_RESOURCE_TOTALS.forEach((spec) => {
        const { displayDiv, amountSpan } = createResourceDisplay(
            spec.iconSrc, spec.iconAlt, spec.amountId, spec.colorKey, rowHeight
        );
        parent.appendChild(displayDiv);
        spansById[spec.amountId] = amountSpan;
    });
    return spansById;
}

function applyDropRateRowMetrics(element, rowHeight) {
    element.style.height = rowHeight;
    element.style.lineHeight = rowHeight;
}

function applyEllipsisOverflowStyles(element) {
    element.style.display = 'block';
    element.style.maxWidth = '100%';
    element.style.whiteSpace = 'nowrap';
    element.style.overflow = 'hidden';
    element.style.textOverflow = 'ellipsis';
}

// Creates a rate display element
function createRateDisplay(rateId, labelKey, options = {}) {
    const { initialValue = 0, initialText, rowHeight, ellipsis } = options;
    const rateElement = document.createElement("span");
    rateElement.id = rateId;
    rateElement.textContent = initialText ?? `${t(labelKey)}: ${initialValue}`;
    rateElement.className = "ha-stats-text";
    if (rowHeight) applyDropRateRowMetrics(rateElement, rowHeight);
    if (ellipsis) applyEllipsisOverflowStyles(rateElement);
    return rateElement;
}

function createThemeInfoSpan(id, textContent, options = {}) {
    const span = document.createElement('span');
    span.id = id;
    if (textContent != null) span.textContent = textContent;
    span.style.fontSize = options.fontSize ?? '10px';
    span.style.color = getThemeColor('textInfo');
    if (options.display) span.style.display = options.display;
    if (options.whiteSpace) span.style.whiteSpace = options.whiteSpace;
    if (options.lineHeight) span.style.lineHeight = options.lineHeight;
    if (options.verticalAlign) span.style.verticalAlign = options.verticalAlign;
    return span;
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

// Resets all Hunt Analyzer state data
function resetHuntAnalyzerState() {
    HuntAnalyzerState.ui.autoplayLogText = ""; // Reset the log text
    HuntAnalyzerState.ui.lastSeed = null;
    HuntAnalyzerState.ui.selectedMapFilter = "ALL";
    HuntAnalyzerState.session.count = 0;
    resetTotalsCounters();
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

    idbClearAllSessions().catch((error) => {
        console.error('[Hunt Analyzer] Error clearing IndexedDB:', error);
    });
    
    // User explicitly cleared data, so re-enable saving
    _persistenceLoadFailed = false;
    _consecutiveSaveFailures = 0;
    
    // Immediately update playtime display to show 0
    const playtimeElement = document.getElementById('mod-playtime-display');
    if (playtimeElement) {
        playtimeElement.textContent = formatPlaytimeLabel("00:00:00");
    }
}

// Updates room display with current room information
function getCurrentRoomIdForDisplay() {
    const boardSnapshot = globalThis.state?.board?.getSnapshot?.();
    const boardCtx = boardSnapshot?.context || {};
    const playerCtx = globalThis.state?.player?.getSnapshot?.()?.context || {};

    return (boardCtx.selectedMap && boardCtx.selectedMap.selectedRoom && boardCtx.selectedMap.selectedRoom.id)
        || (boardCtx.selectedMap && boardCtx.selectedMap.id)
        || (boardCtx.area && boardCtx.area.id)
        || globalThis.state?.board?.area?.id
        || playerCtx.currentRoomId
        || globalThis.state?.player?.currentRoomId
        || null;
}

function updateCurrentRoomDisplay() {
    const roomNamesMap = globalThis.state?.utils?.ROOM_NAME;
    let roomDisplayName = t('mods.huntAnalyzer.currentRoom');
    const currentRoomId = getCurrentRoomIdForDisplay();
    
    if (currentRoomId && roomNamesMap?.[currentRoomId]) {
        roomDisplayName = roomNamesMap[currentRoomId];
    } else if (currentRoomId) {
        roomDisplayName = `Room ID: ${currentRoomId}`;
    }
    
    // If map actually changed, record accumulated time for previous map and start new
    if (roomDisplayName && HuntAnalyzerState.timeTracking.currentMap && HuntAnalyzerState.timeTracking.currentMap !== roomDisplayName) {
        trackMapChange(roomDisplayName);
    }
    
    if (currentRoomId) {
        updateRoomTitleDisplay(currentRoomId, roomDisplayName);
    }
}

function scheduleInitialRoomDisplaySync(maxAttempts = 12, intervalMs = 250) {
    let attempt = 0;
    const sync = () => {
        updateCurrentRoomDisplay();
        const roomIdDisplay = domCache.get("mod-room-id-display");
        const currentText = roomIdDisplay?.textContent || "";
        const stillFallback = currentText === t('mods.huntAnalyzer.currentRoom');
        const hasRoomId = !!getCurrentRoomIdForDisplay();

        attempt += 1;
        if (stillFallback && !hasRoomId && attempt < maxAttempts) {
            setTimeout(sync, intervalMs);
        }
    };

    sync();
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
    const styleButton = createStyledIconButton(t('mods.huntAnalyzer.horizontal')); // Default to horizontal icon
    styleButton.id = "mod-style-button";
    styleButton.title = t('mods.huntAnalyzer.switchToHorizontalLayout');
    styleButton.setAttribute('aria-label', t('mods.huntAnalyzer.switchLayoutStyle'));
    styleButton.tabIndex = 0;

    // Minimize Button
    const minimizeBtn = createStyledIconButton('–');
    minimizeBtn.id = "mod-minimize-button";
    minimizeBtn.title = t('mods.huntAnalyzer.minimizeAnalyzer');
    minimizeBtn.setAttribute('aria-label', t('mods.huntAnalyzer.minimizeAnalyzer'));
    minimizeBtn.tabIndex = 0;

    // Close Button
    const closeBtn = createStyledIconButton("✕");
    closeBtn.title = t('mods.huntAnalyzer.closeAnalyzer');

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
        return;
    }
    

    // Only reset when there is no persisted hunt data (sessions, totals, time, or battle count)
    if (HuntAnalyzerState.data.sessions.length === 0 && !hasPersistedAnalyzerStats()) {
        // Reset tracking variables for a fresh panel session
        HuntAnalyzerState.session.count = 0;
        HuntAnalyzerState.totals.gold = 0;
        HuntAnalyzerState.totals.creatures = 0;
        HuntAnalyzerState.totals.equipment = 0;
        HuntAnalyzerState.totals.runes = 0;
        HuntAnalyzerState.totals.dust = 0;
        HuntAnalyzerState.totals.shiny = 0;
        HuntAnalyzerState.totals.sealed = 0;
        HuntAnalyzerState.totals.staminaSpent = 0;
        HuntAnalyzerState.totals.staminaRecovered = 0;
        HuntAnalyzerState.totals.experience = 0;
        HuntAnalyzerState.totals.wins = 0;
        HuntAnalyzerState.totals.losses = 0;
        HuntAnalyzerState.session.startTime = Date.now();
        HuntAnalyzerState.session.isActive = false;
        HuntAnalyzerState.session.sessionStartTime = 0;
        HuntAnalyzerState.data.sessions = [];
        HuntAnalyzerState.data.aggregatedLoot.clear();
        HuntAnalyzerState.data.aggregatedCreatures.clear();
    } else if (HuntAnalyzerState.data.sessions.length > 0) {
        rebuildAggregatesFromSessionsWithMerge();
    }

    // Consolidated panel initialization log
    console.log('[Hunt Analyzer] Panel initialized:', {
        hasPersistedData: HuntAnalyzerState.data.sessions.length > 0 || hasPersistedAnalyzerStats(),
        sessionCount: HuntAnalyzerState.session.count,
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
    // Disabled in favor of resize handles to reduce duplicate mousemove work.
    const ENABLE_EDGE_RESIZE = false;
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
        if (panelState.mode !== LAYOUT_MODES.MINIMIZED) {
            if (y < edgeSize) dir += 'n';
            else if (y > rect.height - edgeSize) dir += 's';
            if (x < edgeSize) dir += 'w';
            else if (x > rect.width - edgeSize) dir += 'e';
        }
        
        return dir;
    }

    // Change cursor on hover
    if (ENABLE_EDGE_RESIZE) {
        panel.addEventListener('mousemove', function(e) {
            // Avoid expensive rect/cursor work while dragging.
            if (isResizing || isDragging) return;
            const dir = getResizeDirection(e, panel);
            let cursor = '';
            switch (dir) {
                case 'n': cursor = panelState.mode === LAYOUT_MODES.MINIMIZED ? '' : 'ns-resize'; break;
                case 's': cursor = panelState.mode === LAYOUT_MODES.MINIMIZED ? '' : 'ns-resize'; break;
                case 'e': cursor = 'ew-resize'; break;
                case 'w': cursor = 'ew-resize'; break;
                case 'ne': cursor = panelState.mode === LAYOUT_MODES.MINIMIZED ? 'ew-resize' : 'nesw-resize'; break;
                case 'nw': cursor = panelState.mode === LAYOUT_MODES.MINIMIZED ? 'ew-resize' : 'nwse-resize'; break;
                case 'se': cursor = panelState.mode === LAYOUT_MODES.MINIMIZED ? 'ew-resize' : 'nwse-resize'; break;
                case 'sw': cursor = panelState.mode === LAYOUT_MODES.MINIMIZED ? 'ew-resize' : 'nesw-resize'; break;
                default: cursor = '';
            }
            panel.style.cursor = cursor || '';
        });
    }

    // Start resizing on mousedown near edge/corner
    if (ENABLE_EDGE_RESIZE) {
        panel.addEventListener('mousedown', function(e) {
            if (panelState.mode === LAYOUT_MODES.MINIMIZED) {
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
    }

    panelResizeMouseMoveHandler = function(e) {
        if (!isResizing || panelState.mode === LAYOUT_MODES.MINIMIZED) return;
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
    if (ENABLE_EDGE_RESIZE) {
        document.addEventListener('mousemove', panelResizeMouseMoveHandler);
    }

    panelResizeMouseUpHandler = function() {
        if (isResizing) {
            isResizing = false;
            document.body.style.userSelect = '';
            panel.style.transition = '';
            // Save panel settings after resize
            savePanelSettings(panel);
        }
    };
    if (ENABLE_EDGE_RESIZE) {
        document.addEventListener('mouseup', panelResizeMouseUpHandler);
    }
    // --- END NATIVE-LIKE RESIZABLE PANEL LOGIC ---

    // --- DRAGGABLE PANEL LOGIC ---
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let pendingDragFrame = null;
    let queuedDragLeft = 0;
    let queuedDragTop = 0;

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
        queuedDragLeft = newLeft;
        queuedDragTop = newTop;
        if (pendingDragFrame !== null) return;
        pendingDragFrame = requestAnimationFrame(() => {
            panel.style.left = queuedDragLeft + 'px';
            panel.style.top = queuedDragTop + 'px';
            panel.style.transition = 'none';
            pendingDragFrame = null;
        });
    };
    document.addEventListener('mousemove', panelDragMouseMoveHandler);

    panelDragMouseUpHandler = function() {
        if (isDragging) {
            isDragging = false;
            if (pendingDragFrame !== null) {
                cancelAnimationFrame(pendingDragFrame);
                pendingDragFrame = null;
            }
            panel.style.left = queuedDragLeft + 'px';
            panel.style.top = queuedDragTop + 'px';
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
    applyFramedSectionStyles(liveDisplaySection, { noTopMargin: true });
    liveDisplaySection.style.flex = "0 0 auto"; // FIXED SIZE
    liveDisplaySection.style.width = "auto";

    // Session Stats
    const sessionStatsDiv = createFlexColumn('2px');
    sessionStatsDiv.style.marginBottom = "4px";

    const firstRow = createFlexRow('4px', 'space-between', 'center');

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

    const playtimeElement = createThemeInfoSpan('mod-playtime-display', formatPlaytimeLabel("00:00:00"));
    
    firstRow.appendChild(autoplayCounter);
    firstRow.appendChild(playtimeElement);
    
    const secondRow = createFlexRow('4px', 'space-between', 'center');

    const staminaDisplaySpan = createThemeInfoSpan('mod-stamina-display', null, {
        display: 'none',
        whiteSpace: 'nowrap',
        lineHeight: '12px',
        verticalAlign: 'middle'
    });

    const winLossElement = createThemeInfoSpan('mod-win-loss-display', formatWinLossLabel(0, 0, 0));
    
    secondRow.appendChild(staminaDisplaySpan);
    secondRow.appendChild(winLossElement);
    
    sessionStatsDiv.appendChild(firstRow);
    sessionStatsDiv.appendChild(secondRow);
    liveDisplaySection.appendChild(sessionStatsDiv);

    // Drop Rate Live Feed
    const dropRateLiveFeedDiv = document.createElement("div");
    dropRateLiveFeedDiv.className = "ha-border-separator";
    dropRateLiveFeedDiv.style.display = "flex";
    dropRateLiveFeedDiv.style.justifyContent = "space-between";

    const leftRatesSection = createFlexColumn('2px');
    leftRatesSection.style.flex = '1';
    leftRatesSection.style.minWidth = '0';
    leftRatesSection.style.overflow = 'hidden';
    const dropRateRowHeight = '14px';

    const goldRateElement = createRateDisplay('mod-gold-rate', 'mods.huntAnalyzer.goldPerHour', { rowHeight: dropRateRowHeight });
    leftRatesSection.appendChild(goldRateElement);

    const creatureRateElement = createRateDisplay('mod-creature-rate', 'mods.huntAnalyzer.creaturesPerHour', { rowHeight: dropRateRowHeight });
    leftRatesSection.appendChild(creatureRateElement);

    const equipmentRateElement = createRateDisplay('mod-equipment-rate', 'mods.huntAnalyzer.equipmentPerHour', { rowHeight: dropRateRowHeight });
    leftRatesSection.appendChild(equipmentRateElement);

    const runeRateElement = createRateDisplay('mod-rune-rate', 'mods.huntAnalyzer.runesPerHour', { rowHeight: dropRateRowHeight });
    leftRatesSection.appendChild(runeRateElement);

    const expRateElement = createRateDisplay('mod-exp-rate', null, {
        rowHeight: dropRateRowHeight,
        ellipsis: true,
        initialText: `${t('mods.huntAnalyzer.exp')}: ${formatExpValue(0)} | ${formatExpValue(0)}/h | ${formatExpValue(0)}/${t('mods.huntAnalyzer.expSessionAbbr')}`
    });
    expRateElement.addEventListener('mouseenter', () => {
        expRateElement.dataset.haExpTooltipHover = '1';
    });
    expRateElement.addEventListener('mouseleave', () => {
        delete expRateElement.dataset.haExpTooltipHover;
        updateModExpRateDisplay(expRateElement);
    });
    leftRatesSection.appendChild(expRateElement);

    const totalStaminaSpentElement = createRateDisplay('mod-total-stamina-spent', null, {
        rowHeight: dropRateRowHeight,
        ellipsis: true,
        initialText: ''
    });
    setStaminaRateLineElement(totalStaminaSpentElement, 0, 0, 0);
    leftRatesSection.appendChild(totalStaminaSpentElement);

    const rightTotalsSection = createFlexColumn('2px');
    rightTotalsSection.style.alignItems = 'flex-end';
    rightTotalsSection.style.flexShrink = '0';

    const resourceTotalSpans = appendPanelResourceTotals(rightTotalsSection, dropRateRowHeight);
    const goldAmountSpan = resourceTotalSpans['mod-total-gold-display'];
    const dustAmountSpan = resourceTotalSpans['mod-total-dust-display'];
    const shinyAmountSpan = resourceTotalSpans['mod-total-shiny-display'];
    const sealedAmountSpan = resourceTotalSpans['mod-total-sealed-display'];
    const runesAmountSpan = resourceTotalSpans['mod-total-runes-display'];

    dropRateLiveFeedDiv.appendChild(leftRatesSection);
    dropRateLiveFeedDiv.appendChild(rightTotalsSection);
    liveDisplaySection.appendChild(dropRateLiveFeedDiv);

    // 3. Map Filter Section
    const mapFilterContainer = document.createElement("div");
    mapFilterContainer.className = "map-filter-container";
    mapFilterContainer.style.display = "flex";
    mapFilterContainer.style.flex = "0 0 auto";
    applyFramedSectionStyles(mapFilterContainer, { noTopMargin: true });
    mapFilterContainer.style.alignItems = "center";
    mapFilterContainer.style.justifyContent = "center";

    const mapFilterRow = document.createElement("div");
    mapFilterRow.id = "mod-map-filter-row";
    mapFilterRow.style.width = "100%";

    mapFilterContainer.appendChild(mapFilterRow);

    // 4. Loot + Creature Drops Sections (shared layout/styling)
    const {
        container: lootContainer,
        title: lootTitle,
        displayDiv: lootDisplayDiv
    } = createDropSection({
        containerClassName: "loot-container",
        titleId: "mod-loot-title",
        displayId: "mod-loot-display"
    });

    const {
        container: creatureDropContainer,
        title: creatureDropTitle,
        displayDiv: creatureDropDisplayDiv
    } = createDropSection({
        containerClassName: "creature-drop-container",
        titleId: "mod-creature-drops-title",
        displayId: "mod-creature-drop-display"
    });

    // 5. Bottom Controls
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "button-container";
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "center";
    buttonContainer.style.gap = "8px";
    buttonContainer.style.padding = UI_LAYOUT.SECTION_PADDING;
    buttonContainer.style.margin = UI_LAYOUT.SECTION_MARGIN_NO_TOP;
    buttonContainer.style.marginTop = "0";
    buttonContainer.style.borderTop = "none";
    applyFramedSectionStyles(buttonContainer, { noTopMargin: true });
    buttonContainer.style.flex = "0 0 auto"; // FIXED SIZE
    buttonContainer.style.flexDirection = 'row';

    // Settings button removed - now handled by Mod Settings

    const clearButton = createStyledButton(getClearButtonLabel());
    clearButton.style.width = '135px';
    clearButton.dataset.fixedConfirmWidth = '135px';
    attachInlineConfirm(clearButton, {
        baseText: getClearButtonLabel,
        confirmText: t('mods.huntAnalyzer.confirmReset'),
        onConfirm: clearAnalyzerDataAndRefresh
    });

    const copyLogButton = createStyledButton(t('mods.huntAnalyzer.copyLog'));
    copyLogButton.addEventListener("click", () => {
        const summaryText = generateSummaryLogText();
        const success = copyToClipboard(summaryText);
        showPanelFeedback(panel, success ? t('mods.huntAnalyzer.logCopied') : t('mods.huntAnalyzer.logCopyFailed'), success);
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
    domCache.set("mod-exp-rate", expRateElement);
    domCache.set("mod-room-id-display", roomIdDisplay);
    domCache.set("mod-total-gold-display", goldAmountSpan);
    domCache.set("mod-total-dust-display", dustAmountSpan);
    domCache.set("mod-total-shiny-display", shinyAmountSpan);
    domCache.set("mod-total-sealed-display", sealedAmountSpan);
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
        // Apply layout mode to panel (preserveSize=true to keep saved width/height)
        applyLayoutMode(panel, panelState.mode, mapFilterContainer, lootContainer, creatureDropContainer, buttonContainer, true);
        
        // Update panel layout to ensure everything is properly set up
        updatePanelLayout(panel);
        
        // If restoring from minimized, render the sessions
        if (panelState.mode !== LAYOUT_MODES.MINIMIZED) {
            renderAllSessions();
        }
        
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
        updateMinimizeButtonState(minimizeBtn, panelState.mode === LAYOUT_MODES.MINIMIZED);
        updateStyleButtonState(styleButton, panelState.mode);
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
    applyVisibilitySettings();
    scheduleInitialRoomDisplaySync();
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

const VISIBILITY_ELEMENT_MAP = {
    sessions:      'mod-session-count',
    playtime:      'mod-playtime-display',
    stamina:       'mod-stamina-display',
    winLoss:       'mod-win-loss-display',
    goldRate:      'mod-gold-rate',
    creatureRate:  'mod-creature-rate',
    equipmentRate: 'mod-equipment-rate',
    runeRate:      'mod-rune-rate',
    expRate:       'mod-exp-rate',
    staminaRate:   'mod-total-stamina-spent',
    goldTotal:     'mod-total-gold-display',
    dustTotal:     'mod-total-dust-display',
    shinyTotal:    'mod-total-shiny-display',
    sealedTotal:   'mod-total-sealed-display',
    runesTotal:    'mod-total-runes-display'
};

const TOTAL_DISPLAY_IDS = new Set([
    'mod-total-gold-display', 'mod-total-dust-display',
    'mod-total-shiny-display', 'mod-total-sealed-display',
    'mod-total-runes-display'
]);

function applyVisibilitySettings() {
    const vis = HuntAnalyzerState.settings.visibility;
    if (!vis) return;

    for (const [key, elementId] of Object.entries(VISIBILITY_ELEMENT_MAP)) {
        const show = vis[key] !== false;
        const el = domCache.get(elementId) || document.getElementById(elementId);
        if (!el) continue;

        if (TOTAL_DISPLAY_IDS.has(elementId)) {
            const wrapper = el.parentElement;
            if (wrapper) wrapper.style.display = show ? 'flex' : 'none';
        } else {
            el.style.display = show ? '' : 'none';
        }
    }
}

const HUNT_ANALYZER_RATE_DISPLAY_SPECS = [
    { id: 'mod-gold-rate', labelKey: 'mods.huntAnalyzer.goldPerHour', rateKey: 'gold' },
    { id: 'mod-creature-rate', labelKey: 'mods.huntAnalyzer.creaturesPerHour', rateKey: 'creature' },
    { id: 'mod-equipment-rate', labelKey: 'mods.huntAnalyzer.equipmentPerHour', rateKey: 'equipment' },
    { id: 'mod-rune-rate', labelKey: 'mods.huntAnalyzer.runesPerHour', rateKey: 'rune' }
];

function resolvePanelElement(id, elementById) {
    return elementById?.[id] ?? domCache.get(id) ?? document.getElementById(id);
}

function setCompactRateDisplay(element, labelKey, ratePerHour, tooltipOverride = null) {
    if (!element) return;
    element.textContent = `${t(labelKey)}: ${formatCompactInt(ratePerHour)}`;
    element.setAttribute('title', tooltipOverride || `${t(labelKey)}: ${formatExactInt(ratePerHour)}`);
}

function updateSessionCountDisplay(element, filteredTimeHours = getFilteredTimeHours()) {
    if (!element) return;
    const filteredSessionCount = getFilteredSessionCount();
    const sessionRate = filteredTimeHours > 0 ? Math.floor(filteredSessionCount / filteredTimeHours) : 0;
    element.textContent = `${t('mods.huntAnalyzer.sessions')}: ${filteredSessionCount} (${formatCompactInt(sessionRate)}/h)`;
    element.setAttribute('title', `${t('mods.huntAnalyzer.sessions')}: ${formatExactInt(filteredSessionCount)} (${formatExactInt(sessionRate)}/h)`);
}

function updateWinLossDisplay(element) {
    if (!element) return;
    const totalSessions = HuntAnalyzerState.totals.wins + HuntAnalyzerState.totals.losses;
    const winRate = totalSessions > 0 ? Math.round((HuntAnalyzerState.totals.wins / totalSessions) * 100) : 0;
    element.textContent = formatWinLossLabel(HuntAnalyzerState.totals.wins, HuntAnalyzerState.totals.losses, winRate);
}

function updateStaminaSummaryDisplay(element) {
    if (!element) return;
    element.textContent = formatTotalStaminaLabel(HuntAnalyzerState.totals.staminaSpent);
    if (HuntAnalyzerState.settings.visibility?.stamina !== false) {
        element.style.display = 'inline';
    }
    element.setAttribute('title', `${t('mods.huntAnalyzer.totalStamina')}: ${formatExactInt(HuntAnalyzerState.totals.staminaSpent)}`);
}

function updatePlaytimeDisplay(element, filteredTimeHours = getFilteredTimeHours()) {
    if (!element) return;
    element.textContent = formatPlaytimeLabel(formatPlaytime(filteredTimeHours));
}

function calculateStaminaRateMetrics(filteredTimeHours = getFilteredTimeHours()) {
    const hasCompletedSessions = HuntAnalyzerState.data.sessions.length > 0;
    const naturalStaminaRegen = hasCompletedSessions ? Math.floor(filteredTimeHours * 60) : 0;
    const totalStaminaRecovered = HuntAnalyzerState.totals.staminaRecovered + naturalStaminaRegen;
    const netStaminaChange = totalStaminaRecovered - HuntAnalyzerState.totals.staminaSpent;
    const actualNetStaminaRate = filteredTimeHours > 0 ? Math.floor(netStaminaChange / filteredTimeHours) : 0;
    const durationMs = getFilteredDurationMs(filteredTimeHours);
    return {
        staminaSpentRatePerHour: smoothHourlyRate(HuntAnalyzerState.totals.staminaSpent, filteredTimeHours),
        netStaminaPerHour: hasCompletedSessions
            ? getSmoothedRate(actualNetStaminaRate, durationMs)
            : actualNetStaminaRate,
        recoveryEfficiency: HuntAnalyzerState.totals.staminaSpent > 0
            ? Math.round((totalStaminaRecovered / HuntAnalyzerState.totals.staminaSpent) * 100)
            : 0
    };
}

function updateStaminaRateDisplay(element, filteredTimeHours = getFilteredTimeHours()) {
    if (!element) return;
    const metrics = calculateStaminaRateMetrics(filteredTimeHours);
    setStaminaRateLineElement(
        element,
        metrics.staminaSpentRatePerHour,
        metrics.netStaminaPerHour,
        metrics.recoveryEfficiency
    );
}

function updatePanelRateDisplays(elementById, filteredTimeHours = getFilteredTimeHours()) {
    const rates = calculateSmoothedPanelRates(filteredTimeHours);
    const goldBreakdown = getFilteredGoldBreakdown();
    const goldRateElement = resolvePanelElement('mod-gold-rate', elementById);
    const rawGoldRate = filteredTimeHours > 0 ? Math.floor(goldBreakdown.baseGold / filteredTimeHours) : 0;
    const creatureGoldRate = filteredTimeHours > 0 ? Math.floor(goldBreakdown.creatureSellGold / filteredTimeHours) : 0;
    const creatureRateLine = goldBreakdown.includeCreatureSellValue
        ? `\n${t('mods.huntAnalyzer.creatures')}/h: ${formatExactInt(creatureGoldRate)}`
        : '';
    const dragonPlantGoldRate = filteredTimeHours > 0 ? Math.floor(goldBreakdown.dragonPlantBonusGold / filteredTimeHours) : 0;
    const dragonPlantRateLine = goldBreakdown.includeDragonPlantCollect
        ? `\n${t('mods.huntAnalyzer.dragonPlant')}/h: ${formatExactInt(dragonPlantGoldRate)}`
        : '';
    setCompactRateDisplay(
        goldRateElement,
        'mods.huntAnalyzer.goldPerHour',
        rates.gold,
        `${t('mods.huntAnalyzer.lootGoldPerHour')}: ${formatExactInt(rawGoldRate)}${creatureRateLine}${dragonPlantRateLine}`
    );
    HUNT_ANALYZER_RATE_DISPLAY_SPECS.forEach(({ id, labelKey, rateKey }) => {
        if (id === 'mod-gold-rate') return;
        setCompactRateDisplay(resolvePanelElement(id, elementById), labelKey, rates[rateKey]);
    });
    updateModExpRateDisplay(resolvePanelElement('mod-exp-rate', elementById));
    updateStaminaRateDisplay(resolvePanelElement('mod-total-stamina-spent', elementById), filteredTimeHours);
}

function refreshPanelSectionTitles() {
    let totalLootItems = 0;
    HuntAnalyzerState.data.aggregatedLoot.forEach((data) => {
        totalLootItems += data.count;
    });
    updateFilteredSectionTitle('mod-loot-title', 'mods.huntAnalyzer.loot', totalLootItems);

    let totalCreatureDrops = 0;
    HuntAnalyzerState.data.aggregatedCreatures.forEach((data) => {
        totalCreatureDrops += data.count;
    });
    updateFilteredSectionTitle('mod-creature-drops-title', 'mods.huntAnalyzer.creatureDrops', totalCreatureDrops);
}

function refreshPanelLiveStats(elementById) {
    const filteredTimeHours = getFilteredTimeHours();
    updateSessionCountDisplay(resolvePanelElement('mod-session-count', elementById), filteredTimeHours);
    updateWinLossDisplay(resolvePanelElement('mod-win-loss-display', elementById));
    updateStaminaSummaryDisplay(resolvePanelElement('mod-stamina-display', elementById));
    updatePlaytimeDisplay(resolvePanelElement('mod-playtime-display', elementById), filteredTimeHours);
    updatePanelResourceTotalDisplays(elementById);
    updatePanelRateDisplays(elementById, filteredTimeHours);
}

/** Live exp row: total (filtered) | smoothed exp/h | avg exp per session. */
function updateModExpRateDisplay(targetEl) {
    if (!targetEl) return;
    const filteredTimeHours = getFilteredTimeHours();
    const totalExp = Math.max(0, Math.floor(Number(HuntAnalyzerState.totals.experience) || 0));
    const expRatePerHour = filteredTimeHours > 0
        ? smoothHourlyRate(totalExp, filteredTimeHours)
        : 0;
    const sessionCountForExp = getFilteredSessionCount();
    const expPerSession = sessionCountForExp > 0 ? Math.floor(totalExp / sessionCountForExp) : 0;
    const expLabel = t('mods.huntAnalyzer.exp');
    const sessAbbr = t('mods.huntAnalyzer.expSessionAbbr');
    const nextText = `${expLabel}: ${formatExpValue(totalExp)} | ${formatExpValue(expRatePerHour)}/h | ${formatExpValue(expPerSession)}/${sessAbbr}`;
    const nextTitle = `${expLabel}: ${formatExactInt(totalExp)} | ${t('mods.huntAnalyzer.expPerHour')}: ${formatExactInt(expRatePerHour)} | ${t('mods.huntAnalyzer.expPerSession')}: ${formatExactInt(expPerSession)}`;
    if (targetEl.textContent !== nextText) {
        targetEl.textContent = nextText;
    }
    // Do not rewrite `title` while hovered: exp/h ticks every second so the string always changes,
    // which re-triggers native tooltips. Title refreshes on mouseleave via listener.
    if (targetEl.dataset.haExpTooltipHover === '1') {
        return;
    }
    if (targetEl.getAttribute('title') !== nextTitle) {
        targetEl.setAttribute('title', nextTitle);
    }
}

// Updates the display in the Hunt Analyzer Mod panel with the current loot, creature drops,
// autoplay session count, and live drop rates.
function updatePanelDisplay() {
    const now = Date.now();
    const shouldLog = (now - lastUpdateLogTime) > CONFIG.UPDATE_LOG_THROTTLE;
    
    // Always update for continuous timer - no throttling
    lastBoardSubscriptionTime = now;
    
    if (shouldLog) {
        lastUpdateLogTime = now;
    }
    
    // Update tracked values for continuous updates
    lastKnownSessionCount = HuntAnalyzerState.session.count;
    lastKnownGold = HuntAnalyzerState.totals.gold;
    lastKnownDust = HuntAnalyzerState.totals.dust;
    lastKnownShiny = HuntAnalyzerState.totals.shiny;
    lastKnownSealed = HuntAnalyzerState.totals.sealed;

    // Keep latest collected Dragon Plant value for tooltip details.
    trackDragonPlantCollectionValue();
    
    // Get cached DOM elements
    refreshPanelLiveStats();

    const cachedRoomIdDisplayElement = domCache.get("mod-room-id-display");

    // Update room ID display
    if (cachedRoomIdDisplayElement) {
        const roomNamesMap = globalThis.state?.utils?.ROOM_NAME;
        let roomDisplayName = t('mods.huntAnalyzer.currentRoom');
        const currentRoomId = getCurrentRoomIdForDisplay();
        
        if (currentRoomId && roomNamesMap?.[currentRoomId]) {
            roomDisplayName = roomNamesMap[currentRoomId];
        } else if (currentRoomId) {
            roomDisplayName = `Room ID: ${currentRoomId}`;
        }
        
        if (currentRoomId) {
            updateRoomTitleDisplay(currentRoomId, roomDisplayName);
        }
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
        minimizeBtn.textContent = t('mods.huntAnalyzer.vertical');
        minimizeBtn.title = `${t('mods.huntAnalyzer.currentLayout')}: ${t('mods.huntAnalyzer.vertical')}`;
    } else if (panelState.mode === LAYOUT_MODES.HORIZONTAL) {
        minimizeBtn.textContent = t('mods.huntAnalyzer.horizontal');
        minimizeBtn.title = `${t('mods.huntAnalyzer.currentLayout')}: ${t('mods.huntAnalyzer.horizontal')}`;
    } else if (panelState.mode === LAYOUT_MODES.MINIMIZED) {
        minimizeBtn.textContent = t('mods.huntAnalyzer.minimized');
        minimizeBtn.title = `${t('mods.huntAnalyzer.currentLayout')}: ${t('mods.huntAnalyzer.minimized')}`;
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
        if (buttonContainer) buttonContainer.style.display = 'none';
    } else {
        mapFilterContainer.style.display = 'flex';
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
        // Reset minimized sizing overrides so width can follow parent layout.
        buttonContainer.style.width = '';
        buttonContainer.style.height = '';
        buttonContainer.style.flexShrink = '';
        buttonContainer.style.alignSelf = 'stretch';
    }
    // Set display and flex based on layout mode
    if (panelState.mode === LAYOUT_MODES.MINIMIZED) {
        // Hide containers when minimized
        if (mapFilterContainer) mapFilterContainer.style.display = 'none';
        if (lootContainer) lootContainer.style.display = 'none';
        if (creatureDropContainer) creatureDropContainer.style.display = 'none';
        if (buttonContainer) buttonContainer.style.display = 'none';
    } else {
        // Show containers when not minimized
        if (mapFilterContainer) {
            mapFilterContainer.style.display = 'flex';
        }
        if (lootContainer) {
            lootContainer.style.display = 'flex';
            lootContainer.style.flexDirection = 'column';
        }
        if (creatureDropContainer) {
            creatureDropContainer.style.display = 'flex';
            creatureDropContainer.style.flexDirection = 'column';
        }
        if (buttonContainer) buttonContainer.style.display = 'flex';
        
        // Set flex based on layout mode
        if (panelState.mode === LAYOUT_MODES.VERTICAL) {
            // In vertical mode, give map filter minimal space and make loot/creatures bigger
            if (mapFilterContainer) mapFilterContainer.style.flex = "0 0 auto";
            if (lootContainer) lootContainer.style.flex = "1 1 0";
            if (creatureDropContainer) creatureDropContainer.style.flex = "1 1 0";
            if (buttonContainer) {
                buttonContainer.style.width = 'auto';
            }
        } else {
            // In horizontal mode, all sections get their normal sizing
            if (mapFilterContainer) mapFilterContainer.style.flex = "0 0 auto";
            if (lootContainer) lootContainer.style.flex = "1 1 0";
            if (creatureDropContainer) creatureDropContainer.style.flex = "1 1 0";
            if (buttonContainer) {
                buttonContainer.style.width = '100%';
            }
        }
    }

    // Use currentLayoutMode for layout
    if (panelState.mode === LAYOUT_MODES.HORIZONTAL) {
        panel.style.flexDirection = 'row';
        if (leftColumn) leftColumn.style.order = '0';
        if (mapFilterContainer) mapFilterContainer.style.order = '';
        if (lootContainer) lootContainer.style.order = '1';
        if (creatureDropContainer) creatureDropContainer.style.order = '2';
        // Ensure leftColumn exists and contains header, live, buttons, map filter in order
        if (!leftColumn) {
            // Create leftColumn if it doesn't exist
            const newLeftColumn = document.createElement('div');
            newLeftColumn.className = 'ha-left-column';
            panel._leftColumn = newLeftColumn;
            panel.insertBefore(newLeftColumn, panel.firstChild);
        }
        if (leftColumn) {
            if (leftColumn.children[0] !== topHeaderContainer) leftColumn.insertBefore(topHeaderContainer, leftColumn.firstChild);
            if (leftColumn.children[1] !== liveDisplaySection) leftColumn.insertBefore(liveDisplaySection, leftColumn.children[1] || null);
            if (leftColumn.children[2] !== buttonContainer) leftColumn.appendChild(buttonContainer);
            if (leftColumn.children[3] !== mapFilterContainer) leftColumn.appendChild(mapFilterContainer);
        }
        // Ensure panel order: leftColumn, loot, creatures
        [leftColumn, lootContainer, creatureDropContainer].forEach((el, idx) => {
            if (el && !panel.contains(el)) {
                // Add element if it's not in the panel
                panel.appendChild(el);
            } else if (el && panel.children[idx] !== el) {
                panel.insertBefore(el, panel.children[idx] || null);
            }
        });
    } else if (panelState.mode === LAYOUT_MODES.VERTICAL) {
        panel.style.flexDirection = 'column';
        if (leftColumn) leftColumn.style.order = '';
        if (mapFilterContainer) mapFilterContainer.style.order = '';
        if (lootContainer) lootContainer.style.order = '';
        if (creatureDropContainer) creatureDropContainer.style.order = '';
        // Remove leftColumn if present (vertical mode doesn't use it)
        if (leftColumn && panel.contains(leftColumn)) {
            // Move children back to panel before removing leftColumn
            while (leftColumn.firstChild) {
                panel.insertBefore(leftColumn.firstChild, leftColumn);
            }
            panel.removeChild(leftColumn);
        }
        // Ensure all containers are in the panel and in correct order
        const elements = [topHeaderContainer, liveDisplaySection, buttonContainer, mapFilterContainer, lootContainer, creatureDropContainer];
        elements.forEach((el, idx) => {
            if (el && !panel.contains(el)) {
                // Add element if it's not in the panel (restoring from minimized)
                panel.appendChild(el);
            } else if (el && panel.children[idx] !== el) {
                panel.insertBefore(el, panel.children[idx] || null);
            }
        });
    } else if (panelState.mode === LAYOUT_MODES.MINIMIZED) {
        panel.style.flexDirection = 'column';
        if (leftColumn) leftColumn.style.order = '';
        if (mapFilterContainer) mapFilterContainer.style.order = '';
        if (lootContainer) lootContainer.style.order = '';
        if (creatureDropContainer) creatureDropContainer.style.order = '';
        // Remove leftColumn if present
        if (leftColumn && panel.contains(leftColumn)) panel.removeChild(leftColumn);
        // Always remove all six elements from the panel, then append in correct order
        [topHeaderContainer, liveDisplaySection, buttonContainer, mapFilterContainer, lootContainer, creatureDropContainer].forEach(el => {
            if (el && el.parentNode === panel) panel.removeChild(el);
        });
        [topHeaderContainer, liveDisplaySection].forEach(el => {
            if (el) panel.appendChild(el);
        });
        // Fit all to width/height auto
        if (topHeaderContainer) {
            topHeaderContainer.style.width = 'auto';
            topHeaderContainer.style.height = 'auto';
        }
        if (liveDisplaySection) {
            liveDisplaySection.style.width = 'auto';
            liveDisplaySection.style.flex = '1 1 auto';
            liveDisplaySection.style.height = 'auto';
            liveDisplaySection.style.maxHeight = 'none';
            liveDisplaySection.style.minHeight = '0';
            liveDisplaySection.style.overflow = 'hidden';
        }
        if (buttonContainer) {
            buttonContainer.style.width = '100%';
            buttonContainer.style.height = 'auto';
            buttonContainer.style.flex = '0 0 auto';
            buttonContainer.style.flexShrink = '0';
        }
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
        
        
        // Defer display update to avoid interfering with animations
        timeoutIds.push(setTimeout(() => {
            updatePanelDisplay();
        }, 0));

    // Simplified: always ensure the internal clock is running on newGame
    try {
        const mode = getCurrentMode();
        if (!HuntAnalyzerState.timeTracking.clockIntervalId) {
            startInternalClock('newGame');
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
                        // Set baseline to current DOM time, with validation
                        const currentAutoplayTime = getAutoplaySessionTime();
                        if (currentAutoplayTime && currentAutoplayTime > 0) {
                            HuntAnalyzerState.timeTracking.autoplayBaselineMinutes = currentAutoplayTime;
                        } else {
                            // If DOM timer not ready, try again after a short delay
                            setTimeout(() => {
                                const retryTime = getAutoplaySessionTime();
                                HuntAnalyzerState.timeTracking.autoplayBaselineMinutes = retryTime || 0;
                            }, 100);
                        }
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
                    const roomNamesMap = globalThis.state?.utils?.ROOM_NAME;
                    const roomName = roomNamesMap?.[roomId] || `Room ID: ${roomId}`;
                    updateRoomTitleDisplay(roomId, roomName);
                    return;
                }
                if (roomId !== lastSelectedRoomId) {
                    const preHadClock = !!HuntAnalyzerState.timeTracking.clockIntervalId;
                    const preMode = getCurrentMode();
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
    }
}

// Create button immediately if API is ready
createHuntAnalyzerButton();

// Track real creature sell values from game.sellMonster responses.
installCreatureSellTrackingFetchHook();

// Initialize persistence - load settings and data when mod loads
async function initializeHuntAnalyzerPersistence() {
    if (typeof api !== 'undefined' && api) {
        loadHuntAnalyzerSettings();
        await completeHuntAnalyzerPersistenceLoad();
        autoReopenHuntAnalyzer();
    } else {
        console.log('[Hunt Analyzer] API not ready, retrying persistence initialization...');
        setTimeout(initializeHuntAnalyzerPersistence, 100);
    }
}

// Initialize persistence immediately
initializeHuntAnalyzerPersistence();

// Translation event handler
const translationEventHandler = (event) => {
    
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
            updateCurrentRoomDisplay();
        }
        
        refreshPanelLiveStats();
        refreshPanelSectionTitles();
        
        // Update button text
        const clearButton = panel.querySelector('.button-container button:first-child');
        if (clearButton) {
            clearButton.textContent = getClearButtonLabel();
        }
        
        const copyLogButton = panel.querySelector('.button-container button:last-child');
        if (copyLogButton) {
            copyLogButton.textContent = t('mods.huntAnalyzer.copyLog');
        }

        const styleButton = panel.querySelector('#mod-style-button');
        if (styleButton) {
            updateStyleButtonState(styleButton, panelState.mode);
            styleButton.setAttribute('aria-label', t('mods.huntAnalyzer.switchLayoutStyle'));
        }

        const minimizeButton = panel.querySelector('#mod-minimize-button');
        if (minimizeButton) {
            updateMinimizeButtonState(minimizeButton, panelState.mode === LAYOUT_MODES.MINIMIZED);
            minimizeButton.setAttribute('aria-label', t('mods.huntAnalyzer.minimizeAnalyzer'));
        }

        const closeButton = panel.querySelector('.ha-header-controls button:last-child');
        if (closeButton) {
            closeButton.title = t('mods.huntAnalyzer.closeAnalyzer');
            closeButton.setAttribute('aria-label', t('mods.huntAnalyzer.closeAnalyzer'));
        }

        updateMapFilterDropdown();
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
            height: panel.style.height || `${LAYOUT_DIMENSIONS[LAYOUT_MODES.VERTICAL].height}px`,
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
        
        // Always enforce constraints from current mode (never from persisted style values).
        panel.style.minWidth = layout.minWidth + 'px';
        panel.style.maxWidth = layout.maxWidth + 'px';
        panel.style.minHeight = layout.minHeight + 'px';
        panel.style.maxHeight = layout.maxHeight + 'px';
        
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
        
        // Apply minimized/restore state from saved settings
        if (settings.isMinimized !== undefined) {
            const lootContainer = panel.querySelector('.loot-container');
            const creatureDropContainer = panel.querySelector('.creature-drop-container');
            const minimizeBtn = document.getElementById("mod-minimize-button");
            const styleButton = document.getElementById("mod-style-button");
            const buttonContainer = panel.querySelector('.button-container');
            if (lootContainer && creatureDropContainer && minimizeBtn) {
                if (settings.isMinimized) {
                    // Store the last mode before minimizing
                    if (panelState.mode !== LAYOUT_MODES.MINIMIZED) {
                        panelState._lastMode = panelState.mode || LAYOUT_MODES.VERTICAL;
                    }
                    panelState.mode = LAYOUT_MODES.MINIMIZED;
                    updateMinimizeButtonState(minimizeBtn, true);
                } else {
                    // Restore from minimized
                    panelState.mode = panelState._lastMode || LAYOUT_MODES.VERTICAL;
                    updateMinimizeButtonState(minimizeBtn, false);
                    updateStyleButtonState(styleButton, panelState.mode);
                    // Re-render loot and creature drops when restoring from minimized
                    renderAllSessions();
                }

                // Ensure constraints match the resolved mode (prevents getting stuck at minimized 270x230).
                applyLayoutDimensions(panel, panelState.mode);
            }
        }
        
        // Note: updatePanelLayout will be called after panel structure is built
        // This ensures all elements exist before layout is applied
        
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
    maxHeight: "850px",
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
async function cleanupHuntAnalyzer() {
    
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
            const dropdownButton = document.getElementById('mod-map-filter-dropdown-button');
            if (dropdownButton) {
                dropdownButton.removeEventListener('click', dropdownClickHandler);
            }
            dropdownClickHandler = null;
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
        if (visibilityChangeHandler) {
            document.removeEventListener('visibilitychange', visibilityChangeHandler);
            visibilityChangeHandler = null;
        }
        if (pageHideHandler) {
            window.removeEventListener('pagehide', pageHideHandler);
            pageHideHandler = null;
        }
        if (persistenceSaveDebounceTimeoutId) {
            clearTimeout(persistenceSaveDebounceTimeoutId);
            persistenceSaveDebounceTimeoutId = null;
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
            try {
                await flushHuntAnalyzerDataAsync();
                saveHuntAnalyzerState();
            } catch (flushErr) {
                console.warn('[Hunt Analyzer] cleanup save failed:', flushErr);
            }
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
        huntAnalyzerCreatureSellByMonsterId.clear();
        huntAnalyzerPendingCreatureSellEvents.length = 0;
        huntAnalyzerPendingDisenchantDustEvents.length = 0;
        huntAnalyzerLastObservedPlantGold = null;
        huntAnalyzerLastCollectedPlantGoldValue = 0;
        if (huntAnalyzerPlantCollectBurstTimeoutId != null) {
            clearTimeout(huntAnalyzerPlantCollectBurstTimeoutId);
            huntAnalyzerPlantCollectBurstTimeoutId = null;
        }
        if (huntAnalyzerOriginalFetch && huntAnalyzerFetchWrapper && typeof window !== 'undefined' && window.fetch === huntAnalyzerFetchWrapper) {
            window.fetch = huntAnalyzerOriginalFetch;
        }
        huntAnalyzerFetchWrapper = null;
        huntAnalyzerOriginalFetch = null;
        
        // 6. Reset critical state only
        HuntAnalyzerState.session.count = 0;
        HuntAnalyzerState.session.isActive = false;
        HuntAnalyzerState.data.sessions = [];
        HuntAnalyzerState.data.aggregatedLoot.clear();
        HuntAnalyzerState.data.aggregatedCreatures.clear();
        
        
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
            if (visibilityChangeHandler) {
                document.removeEventListener('visibilitychange', visibilityChangeHandler);
                visibilityChangeHandler = null;
            }
            if (pageHideHandler) {
                window.removeEventListener('pagehide', pageHideHandler);
                pageHideHandler = null;
            }
            if (persistenceSaveDebounceTimeoutId) {
                clearTimeout(persistenceSaveDebounceTimeoutId);
                persistenceSaveDebounceTimeoutId = null;
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
        
        if (modName === 'Super Mods/Hunt Analyzer.js' && !enabled) {
            cleanupHuntAnalyzer();
        }
    }
};
window.addEventListener('message', windowMessageHandler);

// Save data before page unload
beforeUnloadHandler = () => {
    if (HuntAnalyzerState.settings.persistData) {
        flushHuntAnalyzerDataAsync().catch(() => {});
        saveHuntAnalyzerState();
    }
};
window.addEventListener('beforeunload', beforeUnloadHandler);

// Save when page is being hidden/unloaded, debounced to avoid duplicate writes
visibilityChangeHandler = () => {
    if (document.visibilityState === 'hidden') {
        debouncedPersistenceFlush();
    }
};
document.addEventListener('visibilitychange', visibilityChangeHandler);

pageHideHandler = () => {
    if (HuntAnalyzerState.settings.persistData) {
        flushHuntAnalyzerDataAsync().catch(() => {});
        saveHuntAnalyzerState();
    }
};
window.addEventListener('pagehide', pageHideHandler);

function getHuntAnalyzerPublicStats() {
    return {
        autoplayCount: HuntAnalyzerState.session.count,
        totalGoldQuantity: HuntAnalyzerState.totals.gold,
        totalCreatureDrops: HuntAnalyzerState.totals.creatures,
        totalEquipmentDrops: HuntAnalyzerState.totals.equipment,
        totalDustQuantity: HuntAnalyzerState.totals.dust,
        totalStaminaSpent: HuntAnalyzerState.totals.staminaSpent
    };
}

// Export functionality and expose state globally for Mod Settings integration
window.HuntAnalyzerState = HuntAnalyzerState;
window.saveHuntAnalyzerData = saveHuntAnalyzerData;
window.HuntAnalyzerAPI = {
    saveData: flushHuntAnalyzerDataAsync,
    loadData: completeHuntAnalyzerPersistenceLoad,
    exportAll: exportHuntAnalyzerDataForBackup,
    importAll: importHuntAnalyzerDataFromBackup,
    clearPersistedStorage: async () => {
        try {
            localStorage.removeItem(HUNT_ANALYZER_STORAGE_KEY);
        } catch (_e) { /* ignore */ }
        await idbClearAllSessions();
    },
    getStats: getHuntAnalyzerPublicStats
};

// Expose applyTheme function for Mod Settings integration
window.applyHuntAnalyzerTheme = applyTheme;

// Expose visibility function for Mod Settings integration
window.applyHuntAnalyzerVisibility = applyVisibilitySettings;

// Expose themes object for Mod Settings to dynamically list available themes
window.HUNT_ANALYZER_THEMES = HUNT_ANALYZER_THEMES;

// Listen for theme changes from Mod Settings via storage events
storageEventHandler = (e) => {
    if (e.key === HUNT_ANALYZER_SETTINGS_KEY && e.newValue) {
        try {
            const newSettings = JSON.parse(e.newValue);
            if (newSettings.theme && newSettings.theme !== HuntAnalyzerState.settings.theme) {
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
    getStats: getHuntAnalyzerPublicStats
};

console.log('[Hunt Analyzer] Mod initialization complete');