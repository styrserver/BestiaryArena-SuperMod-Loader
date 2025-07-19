console.log('Yasir Extension initializing...');
(function yasirExtension() {
  if (!document.getElementById('yasir-extension-style')) {
    const style = document.createElement('style');
    style.id = 'yasir-extension-style';
    style.textContent = `td[data-full='true'] { width: 100px !important; max-width: 100px !important; min-width: 80px !important; }`;
    document.head.appendChild(style);
  }
  const yasirStatus = globalThis.state?.daily?.getSnapshot?.()?.context?.yasir;
  console.debug('Yasir Extension: Yasir status at launch', yasirStatus);
  console.debug('Yasir Extension: script loaded');
  const YASIR_OFFERS = {
    Ankrahmun: {
      buys: { key: 'insightStone5', itemId: 21383, inventoryKey: 'insightStone5', price: 10, currency: 'dust' }
    },
    Carlin: {
      buys: { key: 'summonScroll5', itemId: 21388, inventoryKey: 'summonScroll5', price: 10, currency: 'dust' }
    },
    'Liberty Bay': {
      buys: { key: 'diceManipulator5', itemId: 35909, inventoryKey: 'diceManipulator5', price: 10, currency: 'dust' }
    }
  };
  function getPlayerDust() {
    let playerDust = null;
    const playerContext = globalThis.state?.player?.getSnapshot?.()?.context;
    if (playerContext) {
      const possiblePaths = [
        playerContext.inventory?.dust,
        playerContext.inventory?.dust?.count,
        playerContext.resources?.dust,
        playerContext.player?.dust,
        playerContext.dust
      ];
      for (const dustValue of possiblePaths) {
        if (typeof dustValue === 'number' && !isNaN(dustValue) && dustValue > 0) {
          playerDust = dustValue;
          break;
        }
      }
    }
    if (playerDust) {
      console.debug('Yasir Extension: player dust', playerDust);
    } else {
      const dustDiv = Array.from(document.querySelectorAll('div')).find(div => {
        const hasTitle = div.getAttribute('title') === 'Dust';
        const img = div.querySelector('img[alt="Dust"]');
        return hasTitle || img;
      });
      if (dustDiv) {
        const span = dustDiv.querySelector('span');
        if (span) {
          const value = span.textContent.replace(/,/g, '');
          const domDust = parseInt(value, 10);
          if (!isNaN(domDust) && domDust > 0) {
            console.debug('Yasir Extension: player dust (from DOM)', domDust);
            playerDust = domDust;
          }
        }
      }
    }
    return playerDust || 0;
  }
  function injectIfYasirShop() {
    console.debug('Yasir Extension: checking for Yasir shop...');
    const shopTitle = Array.from(document.querySelectorAll('h2.widget-top p')).find(p => p.textContent && p.textContent.includes("Yasir's Shop"));
    if (!shopTitle) return false;
    console.debug('Yasir Extension: found Yasir shop title');
    const exchangeTable = Array.from(document.querySelectorAll('table')).find(t => t.innerText.includes('Exchange items for dust'));
    if (!exchangeTable) return false;
    exchangeTable.style.tableLayout = 'fixed';
    console.debug('Yasir Extension: found exchange table');
    const yasirLoc = globalThis.state?.daily?.getSnapshot?.()?.context?.yasir?.location;
    console.debug('Yasir Extension: yasirLoc', yasirLoc);
    const offer = YASIR_OFFERS[
      Object.keys(YASIR_OFFERS).find(
        k => k.toLowerCase() === (yasirLoc || '').toLowerCase()
      )
    ];
    if (!offer || !offer.buys) {
      console.debug('Yasir Extension: no offer for this location');
      return 'no-offer';
    }
    console.debug('Yasir Extension: today offer', offer);
    const { itemId, inventoryKey } = offer.buys;
    const stoneSprite = exchangeTable.querySelector('.sprite.item.id-' + itemId);
    let tradeRow = null;
    if (stoneSprite) {
      tradeRow = stoneSprite.closest('tr');
    }
    if (!tradeRow) {
      console.debug('Yasir Extension: trade row not found by item ID');
      return false;
    }
    if (tradeRow.querySelector('.yasir-slider-wrap')) {
      console.debug('Yasir Extension: slider already injected');
      // Continue to inject sell-offer slider
    } else {
      const playerDust = getPlayerDust();
      const maxAmount = globalThis.state?.player?.getSnapshot?.()?.context?.inventory?.[inventoryKey] || 0;
      console.debug('Yasir Extension: maxAmount', maxAmount);
      if (!maxAmount) {
        console.debug('Yasir Extension: no items available');
        // Continue to inject sell-offer slider
      } else {
        const tradeButton = tradeRow.querySelector('button');
        if (!tradeButton) {
          console.debug('Yasir Extension: trade button not found');
          // Continue to inject sell-offer slider
        } else {
          console.debug('Yasir Extension: injecting slider');
          // Remove entire dust <td>
          const dustTd = Array.from(tradeRow.querySelectorAll('td')).find(td => td.innerHTML.includes('dust-large.png'));
          if (dustTd && dustTd.parentNode) {
            dustTd.parentNode.removeChild(dustTd);
            console.log('Yasir Extension: removed entire dust <td>');
          }
          const sliderWrap = document.createElement('div');
          sliderWrap.className = 'yasir-slider-wrap flex items-center gap-2';
          sliderWrap.style.marginTop = '4px';
          const slider = document.createElement('input');
          slider.type = 'range';
          slider.min = '1';
          slider.max = maxAmount;
          slider.value = maxAmount;
          slider.style.width = '100px';
          slider.style.minWidth = '100px';
          slider.style.maxWidth = '100px';
          slider.style.verticalAlign = 'middle';
          const valueLabel = document.createElement('span');
          valueLabel.className = 'pixel-font-16 text-whiteHighlight';
          valueLabel.textContent = maxAmount;
          valueLabel.style.width = '40px';
          valueLabel.style.display = 'inline-block';
          // New dust <td> display
          const newDustTd = document.createElement('td');
          newDustTd.className = 'yasir-dust-td align-middle';
          newDustTd.style.width = '150px';
          newDustTd.style.minWidth = '150px';
          newDustTd.style.maxWidth = '150px';
          newDustTd.style.padding = '0';
          const dustDisplay = document.createElement('div');
          dustDisplay.className = 'yasir-dust-display pixel-font-16 text-whiteHighlight';
          dustDisplay.style.marginLeft = '8px';
          dustDisplay.style.display = 'inline-flex';
          dustDisplay.style.alignItems = 'center';
          dustDisplay.style.width = '100%';
          // Add dust icon
          const dustIcon = document.createElement('img');
          dustIcon.alt = 'dust';
          dustIcon.src = '/assets/icons/dust-large.png';
          dustIcon.className = 'pixelated';
          dustIcon.width = 32;
          dustIcon.height = 32;
          dustDisplay.appendChild(dustIcon);
          // Add dust value
          const dustValue = document.createElement('span');
          dustValue.textContent = (slider.value * 10).toLocaleString();
          dustDisplay.appendChild(dustValue);
          newDustTd.appendChild(dustDisplay);
          // Insert new <td> before the trade button's <td>
          if (tradeButton.closest('td')) {
            // Use flexbox for slider/Trade button cell
            const tradeTd = tradeButton.closest('td');
            tradeTd.style.display = 'flex';
            tradeTd.style.alignItems = 'center';
            tradeTd.style.justifyContent = 'center';
            tradeTd.style.gap = '8px';
            tradeTd.style.width = '160px';
            tradeTd.style.minWidth = '140px';
            tradeTd.style.maxWidth = '180px';
            // Remove absolute positioning from Trade button
            tradeButton.style.position = '';
            tradeButton.style.right = '';
            tradeButton.style.top = '';
            tradeButton.style.transform = '';
            tradeButton.style.margin = '';
            tradeButton.style.display = '';
            tradeButton.style.minWidth = '70px';
            tradeButton.style.marginLeft = '8px';
            tradeButton.closest('tr').insertBefore(newDustTd, tradeTd);
            console.log('Yasir Extension: inserted new dust <td>');
          }
          slider.addEventListener('input', () => {
            valueLabel.textContent = slider.value;
            dustValue.textContent = (slider.value * 10).toLocaleString();
            console.log('Yasir Extension: dustDisplay updated', dustValue.textContent);
          });
          sliderWrap.appendChild(slider);
          sliderWrap.appendChild(valueLabel);
          tradeButton.parentNode.insertBefore(sliderWrap, tradeButton);
          const origOnClick = tradeButton.onclick;
          tradeButton.onclick = function(e) {
            const amount = parseInt(slider.value, 10);
            console.debug('Yasir Extension: trade button clicked, amount', amount);
            if (amount > 0 && amount <= maxAmount) {
              // Example: sendDustExchangeRequest(amount);
            }
            if (typeof origOnClick === 'function') origOnClick.call(this, e);
          };
          console.debug('Yasir Extension: slider and handler injected');
        }
      }
    }
    // Inject slider for Yasir's sell offers (e.g., Exaltation Chest)
    const currentStockTable = Array.from(document.querySelectorAll('table')).find(t => t.innerText.includes('Current stock'));
    if (currentStockTable) {
      const playerDust = getPlayerDust();
      const rows = currentStockTable.querySelectorAll('tbody tr');
      rows.forEach(row => {
        if (row.querySelector('.yasir-sell-slider-wrap')) return;
        const tradeButton = row.querySelector('button');
        if (!tradeButton) return;
        const itemImg = row.querySelector('img[alt]');
        if (!itemImg) return;
        let price = 1;
        const priceMatch = tradeButton.textContent.match(/(\d+)/);
        if (priceMatch) price = parseInt(priceMatch[1], 10);
        let maxAmount = 1;
        if (price > 0) {
          maxAmount = Math.floor(playerDust / price);
        }
        if (maxAmount < 1) maxAmount = 1;
        const sliderWrap = document.createElement('div');
        sliderWrap.className = 'yasir-sell-slider-wrap flex items-center gap-2';
        sliderWrap.style.marginTop = '4px';
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '1';
        slider.max = maxAmount;
        slider.value = maxAmount;
        slider.style.width = '100px';
        slider.style.minWidth = '100px';
        slider.style.maxWidth = '100px';
        slider.style.verticalAlign = 'middle';
        const valueLabel = document.createElement('span');
        valueLabel.className = 'pixel-font-16 text-whiteHighlight';
        valueLabel.textContent = maxAmount;
        valueLabel.style.width = '40px';
        valueLabel.style.display = 'inline-block';
        slider.addEventListener('input', () => {
          valueLabel.textContent = slider.value;
          const totalCost = price * slider.value;
          console.debug('Yasir Extension: sell slider input', { value: slider.value, price, totalCost });
          const img = tradeButton.querySelector('img');
          if (img && img.nextSibling && img.nextSibling.nodeType === Node.TEXT_NODE) {
            img.nextSibling.textContent = totalCost;
            console.debug('Yasir Extension: updated button text node', totalCost);
          }
        });
        sliderWrap.appendChild(slider);
        sliderWrap.appendChild(valueLabel);
        tradeButton.parentNode.insertBefore(sliderWrap, tradeButton);
        const origOnClick = tradeButton.onclick;
        tradeButton.onclick = function(e) {
          const amount = parseInt(slider.value, 10);
          if (amount > 0 && amount <= maxAmount) {
            // Example: sendBuyRequest(amount);
          }
          if (typeof origOnClick === 'function') origOnClick.call(this, e);
        };
      });
    }
    return true;
  }
  // Inject slider for Yasir's sell offers (e.g., Exaltation Chest)
  const observer = new MutationObserver(() => {
    const result = injectIfYasirShop();
    if (result === true || result === 'no-offer') {
      observer.disconnect();
      console.debug('Yasir Extension: observer disconnected after injection');
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  injectIfYasirShop();
})(); 