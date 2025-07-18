// Dice Rolling Automator for Bestiary Arena
console.log('Dice Rolling Automator initializing...');

let diceRollerObserver;
let rollButtonObserver;

const defaultConfig = {
  rollDelay: 120,
  hp: 20,
  ad: 20,
  ap: 20,
  arm: 20,
  mr: 20
};

const config = Object.assign({}, defaultConfig, context.config);

let isRolling = false;
let rollCount = 0;

if (!api) {
  console.error('BestiaryModAPI not available');
}

const STAT_NAMES = {
  hp: 'Hitpoints',
  ad: 'Attack Damage',
  ap: 'Ability Power',
  arm: 'Armor',
  mr: 'Magic Resist'
};

function injectDiceRollerButtonStyles() {
  if (!document.getElementById('diceroller-btn-css')) {
    const style = document.createElement('style');
    style.id = 'diceroller-btn-css';
    style.textContent = `
      .diceroller-btn {
        background: url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat !important;
        border: 6px solid transparent !important;
        border-color: #ffe066 !important;
        border-image: url('https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png') 6 fill stretch !important;
        color: var(--theme-text, #e6d7b0) !important;
        font-weight: 700 !important;
        border-radius: 0 !important;
        box-sizing: border-box !important;
        transition: color 0.2s, border-image 0.1s !important;
        font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif !important;
        outline: none !important;
        position: relative !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 16px !important;
        padding: 7px 24px !important;
        cursor: pointer;
        flex: 1 1 0;
        min-width: 0;
        margin: 0 !important;
      }
      .diceroller-btn.pressed,
      .diceroller-btn:active {
        border-image: url('https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png') 6 fill stretch !important;
      }
    `;
    document.head.appendChild(style);
  }
}

function renderDiceRollerPanelNextToWidget() {
  injectDiceRollerButtonStyles();
  
  const h2s = document.querySelectorAll('h2.widget-top.widget-top-text');
  const h2 = Array.from(h2s).find(el =>
    el.querySelector('p') && el.querySelector('p').textContent.includes('Use Dice Manipulator')
  );
  if (!h2) {
    const oldPanel = document.getElementById('dice-roller-panel');
    if (oldPanel) oldPanel.remove();
    return;
  }
  const widgetContainer = h2.parentElement;
  if (!widgetContainer) return;
  if (widgetContainer.nextSibling && widgetContainer.nextSibling.id === 'dice-roller-panel') return;

  widgetContainer.style.flexShrink = '0';
  widgetContainer.style.flexGrow = '0';
  widgetContainer.style.width = widgetContainer.offsetWidth + 'px';

  const parent = widgetContainer.parentElement;
  if (parent) {
    parent.style.display = 'flex';
    parent.style.alignItems = 'flex-start';
  }

  const panel = document.createElement('div');
  panel.id = 'dice-roller-panel';
  panel.style.flexShrink = '0';
  panel.style.flexGrow = '0';
  panel.style.width = '200px';
  panel.style.maxWidth = '200px';
  panel.style.height = '300px';
  panel.style.minHeight = '300px';
  panel.style.boxSizing = 'border-box';

  const header = document.createElement('h2');
  header.className = 'widget-top widget-top-text';
  const headerP = document.createElement('p');
  headerP.textContent = 'Dice Rolling Automator';
  header.appendChild(headerP);

  const content = document.createElement('div');
  content.className = 'widget-bottom pixel-font-16 p-3 text-whiteRegular';

  const controlsSection = document.createElement('div');
  controlsSection.id = 'dice-roller-controls';
  controlsSection.style.marginBottom = '10px';
  controlsSection.style.display = 'flex';
  controlsSection.style.flexDirection = 'column';
  controlsSection.style.gap = '8px';
  controlsSection.style.alignItems = 'center';

  Object.entries(STAT_NAMES).forEach(([key, label]) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.flexDirection = 'row';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.gap = '8px';
    row.style.width = '100%';
    
    const labelEl = document.createElement('span');
    labelEl.textContent = label + ':';
    row.appendChild(labelEl);
    
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = '20';
    input.value = config[key] !== undefined ? config[key] : 20;
    input.style.width = '40px';
    input.style.textAlign = 'center';
    input.style.color = 'black';
    input.addEventListener('input', e => {
      let v = parseInt(e.target.value, 10);
      if (isNaN(v) || v < 0) v = 0;
      if (v > 20) v = 20;
      config[key] = v;
      input.value = v;
    });
    row.appendChild(input);
    controlsSection.appendChild(row);
  });

  const separator1 = document.createElement('hr');
  separator1.style.margin = '8px 0';
  separator1.style.width = '100%';
  controlsSection.appendChild(separator1);

  const row2 = document.createElement('div');
  row2.style.display = 'flex';
  row2.style.justifyContent = 'center';
  row2.style.width = '100%';
  row2.style.marginBottom = '0px';

  const autoRollBtn = document.createElement('button');
  autoRollBtn.textContent = 'Autoroll';
  autoRollBtn.className = 'diceroller-btn';
  autoRollBtn.onclick = () => {
    if (isRolling) {
      stopAutoRolling();
      updateAutoRollBtn();
    } else {
      startAutoRolling();
      updateAutoRollBtn();
    }
  };
  row2.appendChild(autoRollBtn);
  controlsSection.appendChild(row2);

  const separator2 = document.createElement('hr');
  separator2.style.margin = '8px 0';
  separator2.style.width = '100%';
  controlsSection.appendChild(separator2);
  content.appendChild(controlsSection);

  const statusSection = document.createElement('div');
  statusSection.id = 'roll-status';
  statusSection.style.marginBottom = '10px';
  statusSection.style.textAlign = 'center';
  statusSection.style.width = '100%';
  
  const statusLabel = document.createElement('div');
  statusLabel.textContent = 'Status:';
  statusLabel.style.fontWeight = 'bold';
  statusLabel.style.marginBottom = '4px';
  statusSection.appendChild(statusLabel);
  
  const statusMessage = document.createElement('div');
  statusMessage.id = 'status-message';
  statusMessage.textContent = 'Auto rolling stopped';
  statusSection.appendChild(statusMessage);
  
  content.appendChild(statusSection);

  panel.appendChild(header);
  panel.appendChild(content);

  widgetContainer.parentElement.insertBefore(panel, widgetContainer.nextSibling);
}

if (diceRollerObserver) {
  diceRollerObserver.disconnect();
}
diceRollerObserver = new MutationObserver(() => {
  renderDiceRollerPanelNextToWidget();
});
diceRollerObserver.observe(document.body, { childList: true, subtree: true });
renderDiceRollerPanelNextToWidget();

function updateAutoRollBtn() {
  const autoRollBtn = document.querySelector('#dice-roller-panel button');
  if (!autoRollBtn) return;
  if (isRolling) {
    autoRollBtn.textContent = `Stop (${rollCount})`;
  } else {
    autoRollBtn.textContent = 'Autoroll';
  }
}

function startAutoRolling() {
  if (isRolling) {
    updateStatus('Already rolling...');
    return;
  }
  isRolling = true;
  rollCount = 0;
  updateStatus('Starting auto roll...');
  updateAutoRollBtn();
  performRoll();
}

function stopAutoRolling() {
  isRolling = false;
  updateStatus('Auto rolling stopped');
  updateAutoRollBtn();
}

function findRollButton() {
  const btns = document.querySelectorAll('button.frame-1-green');
  for (const btn of btns) {
    const btnText = btn.textContent.trim().toLowerCase();
    const isVisible = !!(btn.offsetWidth || btn.offsetHeight || btn.getClientRects().length);
    if (!btn.disabled && btnText.includes('roll') && isVisible) {
      return btn;
    }
  }
  return null;
}

function waitForRollButtonAndClick(onSuccess, maxAttempts = 20, delay = 100) {
  let attempts = 0;
  function tryClick() {
    const rollButton = findRollButton();
    if (rollButton) {
      rollButton.click();
      if (onSuccess) onSuccess();
    } else if (attempts < maxAttempts) {
      attempts++;
      setTimeout(tryClick, delay);
    } else {
      updateStatus('Dice button not found - make sure you are in a dice rolling area');
      stopAutoRolling();
    }
  }
  tryClick();
}

function getCheckedStats() {
  const checkedStats = {};
  const statRows = document.querySelectorAll('div.flex.justify-between');
  
  for (const [key, label] of Object.entries(STAT_NAMES)) {
    const row = Array.from(statRows).find(div => {
      const span = div.querySelector('span');
      return span && span.textContent.trim() === label;
    });
    if (row) {
      const labelElement = row.closest('label');
      if (labelElement) {
        const checkbox = labelElement.querySelector('button[data-state]');
        if (checkbox) {
          const state = checkbox.getAttribute('data-state');
          checkedStats[key] = state === 'checked';
        }
      }
    }
  }
  
  return checkedStats;
}

function getStatsFromMainPanel() {
  const stats = {};
  const panel = document.querySelector('div.frame-pressed-1.surface-dark.flex.shrink-0.select-none.flex-col.justify-center.gap-1\\.5.px-2.py-1.pb-2');
  if (!panel) {
    return stats;
  }
  
  for (const [key, label] of Object.entries(STAT_NAMES)) {
    const row = Array.from(panel.querySelectorAll('div.flex.justify-between')).find(div => {
      const span = div.querySelector('span');
      return span && span.textContent.trim() === label;
    });
    if (row) {
      const valueSpan = row.querySelector('span.text-right.text-whiteExp');
      if (valueSpan) {
        const value = parseInt(valueSpan.textContent.trim(), 10);
        stats[key] = value;
      }
    }
  }
  return stats;
}

function performRoll() {
  try {
    waitForRollButtonAndClick(() => {
      rollCount++;
      updateStatus(`Rolled ${rollCount} times`);
      updateAutoRollBtn();
      setTimeout(() => {
        try {
          const stats = getStatsFromMainPanel();
          const checkedStats = getCheckedStats();
          
          let matches = false;
          for (const [statKey, isChecked] of Object.entries(checkedStats)) {
            if (isChecked && config[statKey] !== undefined && stats[statKey] === config[statKey]) {
              matches = true;
              break;
            }
          }
          
          if (matches) {
            stopAutoRolling();
            updateStatus(`Target gene reached after ${rollCount} rolls!`);
          } else if (isRolling) {
            setTimeout(() => {
              if (isRolling) performRoll();
            }, config.rollDelay);
          }
        } catch (e) {
          console.error('Error checking stat match after roll:', e);
        }
      }, 1050);
    });
  } catch (error) {
    console.error('Dice Roller Debug: Error performing roll:', error);
    updateStatus('Error performing roll');
    stopAutoRolling();
    updateAutoRollBtn();
  }
}

function updateStatus(message) {
  const statusElement = document.getElementById('status-message');
  if (statusElement) {
    statusElement.textContent = message;
  }
}

function cleanup() {
  isRolling = false;
  
  if (diceRollerObserver) {
    diceRollerObserver.disconnect();
    diceRollerObserver = null;
  }
  
  if (rollButtonObserver) {
    rollButtonObserver.disconnect();
    rollButtonObserver = null;
  }
  
  const customCSS = document.getElementById('diceroller-btn-css');
  if (customCSS) {
    customCSS.remove();
  }
  
  const dicePanel = document.getElementById('dice-roller-panel');
  if (dicePanel) {
    dicePanel.remove();
  }
  
  rollCount = 0;
  
  console.log('Dice Rolling Automator cleaned up');
}

exports = {
  startRolling: startAutoRolling,
  stopRolling: stopAutoRolling,
  updateConfig: (newConfig) => {
    Object.assign(config, newConfig);
  },
  cleanup: cleanup,
  getState: () => ({
    isRolling,
    rollCount,
    config
  })
};
