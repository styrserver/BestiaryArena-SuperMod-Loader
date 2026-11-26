// Better Codex Mod for Bestiary Arena
(function () {
  if (window.__betterCodexLoaded) return;
  window.__betterCodexLoaded = true;

  const MOD_NAME = 'Better Codex';
  const TITLE = 'Better Codex';
  const TITLE_COLOR = '#32cd32';
  const SEARCH_ID = 'codex-search';
  const LOOKUP_RETRIES = 3;
  const LOOKUP_DELAY = 1000;
  // Card key -> { card, name, seen: holder ids already announced }.
  const TRACKED_KEY = 'better-codex-tracked';
  const TRACK_INTERVAL = 5 * 60 * 1000;
  // Least time between two tracked-card requests, to leave room in the request limit all mods share.
  const TRACK_GAP = 1000;
  // The first check runs as soon as the game has loaded your data, waiting at most this many seconds.
  const LOAD_WAIT_SECONDS = 60;
  // The only verdicts that may decline an offer: a rule it definitely breaks. An offer with a foil on
  // either side is left for you to decide, and so is anything that could not be read.
  const DECLINE_REASONS = new Set(['uneven', 'notOwned', 'lastCopy', 'alreadyOwned', 'lowerRarity']);
  // Ids of the trades auto-accept made, for the "Auto" tag in History. Only the newest are kept.
  const AUTO_TRADES_KEY = 'better-codex-auto-trades';
  const AUTO_TRADES_KEPT = 200;
  // '1' or '0': how "Only missing cards" was last left in the game's trade window.
  const ONLY_MISSING_KEY = 'better-codex-only-missing';
  // How long a trade toast stays on screen.
  const TOAST_MS = 10000;
  const AUTO_KEY = 'better-codex-auto-accept';
  // Off until the player says otherwise and confirms it.
  const AUTO_DEFAULTS = {
    accept: false, decline: false, missingOnly: true, sameRarity: true
  };
  // These outfits' sheets live in the game's override folder.
  const OVERRIDE_OUTFITS = new Set([145, 149, 1210, 1211]);
  // The footer button that opens the game's own Trades window (only on your own Codex).
  const TRADES_BUTTON = '.justify-end button[aria-haspopup="dialog"]:has(svg.lucide-handshake)';

  const t = (key) => api?.i18n?.t(`mods.betterCodex.${key}`) || key;

  let titleNode = null;
  let originalTitle = '';
  let opening = false;
  let disposed = false;
  // Lower-cased search text -> { player (null when there is none), at }.
  const players = new Map();
  // How long a looked-up player is kept. Checked when a search is shown anew, never under your eyes.
  const PLAYER_TTL = 5 * 60 * 1000;
  // The search text whose player is on screen.
  let shownKey = '';
  // Offer id:revision the game refused to accept: skipped, so it cannot hold back the ones after it.
  const failedAccepts = new Set();
  // The tracked cards as stored, until this or another tab writes them.
  let trackedCache = null;
  // Held while offers are handled, so two game tabs never accept at the same time.
  const OFFERS_LOCK = 'better-codex-offers';
  let lookupQuery = '';
  // The name whose lookup has not answered yet.
  let pendingLookup = '';
  let lookupTimer = null;
  let resultNodes = [];
  let hiddenNodes = [];
  // Whether the Extras view is shown in place of the game's cards.
  let extrasOpen = false;
  // The hidden cards, read once per opened Codex, as the sidebar counter needs them on every change.
  let hiddenCache = null;
  // { context, resolve }: the game's progress resolver for that player state.
  let progressCache = null;
  // The player state the Extras counter was last counted for.
  let countedFor = null;
  // The game's records card under an Extras map preview, unmounted when it goes.
  let recordsView = null;
  let drawObserver = null;
  let catalogRows = null;
  let gameLookups = null;
  // When an incomplete set of lookups is read again; 0 once it is complete.
  let lookupsRetryAt = 0;
  const LOOKUPS_RETRY = 60 * 1000;
  let webpackRequire = null;
  // Marker -> the game module holding it.
  const gameModules = new Map();
  // Category -> the words of the game's card preview, read from its code.
  const wordCache = new Map();
  // Last selected card, kept for when the virtual list scrolls it out of the DOM.
  let selected = null;
  // Card key -> { at, request } for the players holding spares of it.
  const spares = new Map();
  let sparesNode = null;
  let sparesTimer = null;
  let trackTimer = null;
  let checkingTracked = false;
  let lastTrackedRequest = 0;
  let checkingOffers = false;
  let autoNodes = [];
  // Offer id:revision already announced.
  const announced = new Set();
  let offerToast = null;

  // Matched by the search box id, not the title text, so it works in every game language.
  function applyTitle(dialog) {
    const heading = dialog.querySelector('h2.widget-top-text p');
    if (!heading) return;
    // Only the leading text node changes: the heading also holds React's own counter <span>.
    const node = heading.firstChild;
    if (node?.nodeType === Node.TEXT_NODE && node.nodeValue !== TITLE) {
      titleNode = node;
      originalTitle = node.nodeValue;
      node.nodeValue = TITLE;
    }
    const counter = heading.querySelector(':scope > span:not([data-better-codex-progress])');
    heading.style.color = TITLE_COLOR;
    if (!counter) return;
    // The counter keeps its own grey class.
    counter.style.fontStyle = 'italic';
    addProgress(heading, counter);
  }

  // "98%, 11 to go" after the game's counter, worked out from its "(owned/total)".
  function addProgress(heading, counter) {
    const [, owned, total] = counter.textContent.match(/(\d+)\/(\d+)/)?.map(Number) || [];
    if (!total) return;
    const left = Math.max(0, total - owned);
    const text = left
      ? ` · ${t('progress').replace('{percent}', Math.floor((owned / total) * 100)).replace('{count}', left)}`
      : ` · ${t('complete')}`;
    let progress = heading.querySelector(':scope > [data-better-codex-progress]');
    if (!progress) {
      progress = document.createElement('span');
      progress.setAttribute('data-better-codex-progress', '');
      progress.className = 'text-whiteDark';
      progress.style.fontStyle = 'italic';
      heading.appendChild(progress);
    }
    // Written only on change, as writing it is itself a DOM mutation.
    if (progress.textContent !== text) progress.textContent = text;
  }

  function restoreTitle() {
    if (!titleNode?.isConnected) return;
    const heading = titleNode.parentElement;
    titleNode.nodeValue = originalTitle;
    heading.querySelector(':scope > [data-better-codex-progress]')?.remove();
    heading.style.removeProperty('color');
    [...heading.children].forEach((element) => element.style.removeProperty('font-style'));
  }

  // =======================
  // Trade with a player by name
  // =======================

  function toast(key, name) {
    window.BAToast?.show({ mod: MOD_NAME, type: 'warning', message: t(key).replace('{name}', name) });
  }

  // Resolves with the first truthy find() result, or null after 10s / on cleanup.
  function waitFor(find) {
    return new Promise((resolve) => {
      let tries = 100;
      const poll = () => {
        if (disposed) return resolve(null);
        const found = find();
        if (found || --tries <= 0) return resolve(found || null);
        setTimeout(poll, 100);
      };
      setTimeout(poll, 100);
    });
  }

  // Returns the player's profile page data, or null if there is no such player. The page data
  // request is used because the profilePageData API carries no codexData (their cards).
  async function fetchPlayer(query) {
    const response = await fetch(`/profile/${encodeURIComponent(query)}`, { headers: { 'x-nextjs-data': '1' } });
    if (response.status === 404) {
      console.log('[Better Codex] No player named', query);
      return null;
    }
    if (!response.ok) throw new Error(`profile data HTTP ${response.status}`);
    const player = (await response.json())?.pageProps?.pageData;
    if (!player?.id || !player.name) {
      console.warn('[Better Codex] Profile data for', query, 'has no player');
      return null;
    }
    const codex = player.codexData?.codex;
    console.log('[Better Codex] Found player', player.name, 'id', player.id, 'cards:',
      codex ? Object.entries(codex).map(([category, cards]) => `${category} ${Object.keys(cards).length}`).join(', ') : 'no codexData');
    if (!codex) console.warn('[Better Codex] No codexData for', player.name, '- profile fields:', Object.keys(player).join(', '));
    return player;
  }

  // The game's open-trade function is private to its Trades window, which passes it to the open tab
  // as onOpen / onTrade (next to loadingPartnerId). Read it from React's props.
  function findOpenTrade(tradesDialog) {
    for (const element of tradesDialog.querySelectorAll('[role="tabpanel"][data-state="active"] *')) {
      let fiber = element[Object.keys(element).find((key) => key.startsWith('__reactFiber$'))];
      for (; fiber; fiber = fiber.return) {
        const props = fiber.memoizedProps;
        const openTrade = props && 'loadingPartnerId' in props && (props.onOpen || props.onTrade);
        if (typeof openTrade === 'function') return openTrade;
      }
    }
    return null;
  }

  // Opens the game's Trades window over the Codex and asks it for a trade with this player, so the
  // trade window and every rule about who may trade stay the game's. wantedCard pre-fills it.
  async function openTradeWith(player, wantedCard = null) {
    if (opening) return;
    opening = true;
    try {
      const tradesButton = document.getElementById(SEARCH_ID)?.closest('[role="dialog"]')?.querySelector(TRADES_BUTTON);
      if (!tradesButton) return toast('failed', player.name);
      tradesButton.click();
      const openTrade = await waitFor(() => {
        const trades = document.getElementById(tradesButton.getAttribute('aria-controls'));
        if (!trades) return null;
        const found = findOpenTrade(trades);
        // The History tab has no trade handler: focusing the first tab switches to Offers.
        if (!found) trades.querySelector('[role="tab"]')?.focus();
        return found;
      });
      if (disposed) return;
      if (!openTrade) {
        console.warn('[Better Codex] No open-trade handler in the Trades window');
        return toast('failed', player.name);
      }
      console.log('[Better Codex] Opening trade with', player.name, wantedCard || '');
      openTrade({ id: player.id, name: player.name }, wantedCard);
    } catch (error) {
      console.error('[Better Codex] Could not open trade:', error);
      toast('failed', player.name);
    } finally {
      opening = false;
    }
  }

  function isOwnName(name) {
    const ownName = globalThis.state?.player?.getSnapshot?.()?.context?.name;
    return !!ownName && ownName.toLowerCase() === name.toLowerCase();
  }

  // =======================
  // Player card
  // =======================

  // The game's outfit colour index (19 hues x 7 shades), as RGB multipliers.
  function outfitColor(index) {
    const hue = index % 19;
    const shade = Math.floor(index / 19);
    if (!hue) return Array(3).fill((7 - shade) / 7);
    const [saturation, value] = [[0.25, 1], [0.25, 0.75], [0.5, 0.75], [0.667, 0.75], [1, 1], [1, 0.75], [1, 0.5]][shade] || [0, 1];
    const sector = (hue / 18) * 6;
    const rest = sector - Math.floor(sector);
    const p = value * (1 - saturation);
    const q = value * (1 - saturation * rest);
    const u = value * (1 - saturation * (1 - rest));
    return [[value, u, p], [q, value, p], [p, value, u], [p, q, value], [u, p, value], [value, p, q]][Math.floor(sector) % 6];
  }

  // [left, top, right, bottom] of the opaque pixels, or null for an empty frame.
  function opaqueBounds(frame) {
    const { width, height } = frame;
    const data = frame.getContext('2d').getImageData(0, 0, width, height).data;
    let [left, top, right, bottom] = [width, height, -1, -1];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!data[4 * (y * width + x) + 3]) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
    return right < 0 ? null : [left, top, right, bottom];
  }

  // Draws the art of a frame, centred, on a square canvas at least one tile (32px) wide.
  function drawCropped(canvas, frame) {
    const bounds = opaqueBounds(frame);
    if (!bounds) return;
    const [left, top, right, bottom] = bounds;
    const w = right - left + 1;
    const h = bottom - top + 1;
    const size = Math.max(32, w, h);
    canvas.width = canvas.height = size;
    canvas.getContext('2d').drawImage(frame, left, top, w, h, Math.floor((size - w) / 2), Math.floor((size - h) / 2), w, h);
  }

  // As the game fills a Codex slot: unscaled, the art centred in its frame, then moved by the
  // card's own nudge from the game's table.
  function drawSlot(canvas, frame, category, id) {
    const bounds = opaqueBounds(frame);
    if (!bounds) return;
    const [left, top, right, bottom] = bounds;
    let nudge;
    try {
      nudge = getGameLookups().slotOffset[category]?.(id);
    } catch (error) {
      console.warn('[Better Codex] Offset failed for', category, id, error);
    }
    canvas.width = frame.width;
    canvas.height = frame.height;
    canvas.style.cssText = '';
    canvas.getContext('2d').drawImage(frame, 0, 0);
    const x = Math.round((frame.width - left - right - 1) / 2) + (nudge?.x || 0);
    const y = Math.round((frame.height - top - bottom - 1) / 2) + (nudge?.y || 0);
    canvas.parentElement.style.translate = `${x}px ${y}px`;
  }

  function loadFrame(url, onFrame, onError) {
    const image = new Image();
    image.onload = () => {
      const frame = document.createElement('canvas');
      frame.width = image.width;
      frame.height = image.height;
      frame.getContext('2d', { willReadFrequently: true }).drawImage(image, 0, 0);
      onFrame(frame);
    };
    image.onerror = () => {
      console.warn('[Better Codex] Sprite failed to load:', url);
      onError?.();
    };
    image.src = url;
  }

  // The sheet's left half is the outfit; the right half marks what each colour paints
  // (yellow head, red body, green legs, blue feet). The result keeps only the coloured left half.
  function loadOutfitFrame(url, look, onFrame, onError) {
    loadFrame(url, (frame) => {
      const context = frame.getContext('2d');
      const pixels = context.getImageData(0, 0, frame.width, frame.height);
      const data = pixels.data;
      const half = frame.width / 2;
      const [head, body, legs, feet] = [look.head, look.body, look.legs, look.feet].map(outfitColor);
      for (let y = 0; y < frame.height; y++) {
        for (let x = 0; x < half; x++) {
          const at = 4 * (y * frame.width + x);
          const mask = at + 4 * half;
          const [r, g, b] = [data[mask], data[mask + 1], data[mask + 2]];
          const color = r && g ? head : r ? body : g ? legs : b ? feet : null;
          if (color) for (let c = 0; c < 3; c++) data[at + c] *= color[c];
        }
      }
      frame.width = half;
      frame.getContext('2d').putImageData(pixels, 0, 0, 0, 0, half, frame.height);
      onFrame(frame);
    }, onError);
  }

  // Where the rider sits on this mount, or null when the game would show the outfit on foot.
  function riderOffset({ outfitId, mountId }) {
    if (!mountId) return null;
    const { mounts, mountable } = getGameLookups();
    const mount = mounts?.get(mountId);
    if (!mount || !mountable.has(outfitId)) return null;
    return mount.riderOffset || { x: 0, y: 0 };
  }

  // Drawn as the game does: the mount, then the rider against its bottom-right corner plus the offset.
  function drawOutfit(canvas, look, paint = drawCropped) {
    const onFoot = () => {
      const folder = OVERRIDE_OUTFITS.has(look.outfitId) ? 'playerOutfitOverride' : 'playerOutfit';
      loadOutfitFrame(`/assets/${folder}/${look.outfitId}.png`, look, (frame) => paint(canvas, frame));
    };
    let offset = null;
    try {
      offset = riderOffset(look);
    } catch (error) {
      console.warn('[Better Codex] Mount data unavailable:', error);
    }
    if (!offset) return onFoot();
    loadFrame(`/assets/playerMount/${look.mountId}.png`, (mount) => {
      loadOutfitFrame(`/assets/playerOutfitMounted/${look.outfitId}.png`, look, (rider) => {
        mount.getContext('2d').drawImage(rider, mount.width - rider.width + offset.x, mount.height - rider.height + offset.y);
        paint(canvas, mount);
      }, onFoot);
    }, onFoot);
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // The classes of the game's own profile table, as Cyclopedia's home page uses them.
  const ROW_CLASS = 'group/row odd:bg-grayBrightest even:bg-grayHighlight hover:bg-whiteDarkest hover:text-whiteBrightest';
  const LABEL_CLASS = 'bg-grayRegular px-1 text-whiteRegular group-hover/row:bg-grayHighlight';
  const VALUE_CLASS = 'px-1 align-middle [&:not(:first-child)]:table-frame-left text-center';
  const MAXED_COLOR = '#3ecf4a';

  function icon(src, alt) {
    const image = element('img', 'pixelated mr-1 inline-block -translate-y-0.5');
    image.src = src;
    image.alt = alt;
    image.width = image.height = 11;
    return image;
  }

  // sections: [headingKey, [[labelKey, iconSrc, value, { maxed }]]]
  function buildTable(sections) {
    const table = element('table', 'pixel-font-14 frame-pressed-1 w-full caption-bottom border-separate border-spacing-0 text-whiteRegular');
    const body = element('tbody', '');
    sections.forEach(([headingKey, rows]) => {
      const heading = element('tr', ROW_CLASS);
      const cell = element('td', 'bg-grayDark px-1 text-whiteHighlight table-frame-bottom', t(headingKey));
      cell.colSpan = 2;
      heading.appendChild(cell);
      body.appendChild(heading);
      rows.forEach(([labelKey, iconSrc, value, { maxed } = {}]) => {
        const row = element('tr', ROW_CLASS);
        const label = element('td', LABEL_CLASS);
        label.append(icon(iconSrc, t(labelKey)), t(labelKey));
        const data = element('td', VALUE_CLASS, String(value));
        if (maxed) data.style.color = MAXED_COLOR;
        row.append(label, data);
        body.appendChild(row);
      });
    });
    table.appendChild(body);
    return table;
  }

  function profileSections(player, counts) {
    const number = (value) => value.toLocaleString();
    const sections = [
      ['account', [
        ['level', '/assets/icons/achievement.png', typeof player.exp === 'number' ? Math.floor(player.exp / 400) + 1 : '-'],
        ['createdAt', '/assets/icons/migrate.png', player.createdAt ? new Date(player.createdAt).toLocaleDateString(api?.i18n?.getLocale?.()) : '-']
      ]]
    ];
    if (counts) {
      sections.push(['codexAll', [
        ['allCards', '/assets/icons/codex.png', `${counts.owned}/${counts.total}`, { maxed: counts.owned >= counts.total }],
        ...Object.entries(counts.categories).map(([category, text]) => {
          const [owned, max] = text.split('/').map(Number);
          return [category, `/assets/icons/${CATEGORY_ICONS[category]}.png`, text, { maxed: owned >= max }];
        }),
        ['exclusives', '/assets/icons/codex.png', number(counts.exclusives)],
        ['spares', '/assets/icons/codex.png', number(counts.spares)]
      ]]);
    }
    return sections;
  }

  function buildPlayerCard(player, counts) {
    const card = element('div', 'flex flex-col');
    // A height limit, so the table scrolls and the trade button below stays on screen.
    card.style.cssText = 'width:232px;max-height:min(500px, calc(100dvh - 220px));';
    const body = element('div', 'widget-bottom flex flex-col p-0');
    body.style.cssText = 'flex:1;min-height:0;';
    const portrait = element('div', 'container-slot surface-darker grid shrink-0 place-items-center overflow-hidden');
    portrait.style.height = '80px';
    const canvas = element('canvas', 'pixelated');
    canvas.width = canvas.height = 64;
    canvas.style.cssText = 'width:72px;height:72px;';
    drawOutfit(canvas, player);
    portrait.appendChild(canvas);
    const scroller = element('div', '');
    scroller.style.cssText = 'flex:1;min-height:0;overflow-y:auto;';
    scroller.appendChild(buildTable(profileSections(player, counts)));
    body.append(portrait, scroller);

    // Opens their profile in a new tab, as the game's own player links do.
    const title = element('div', 'widget-top widget-top-text py-[3px] text-center');
    const link = element('a', 'action-link', player.name);
    link.href = `/profile/${encodeURIComponent(player.name)}`;
    link.target = '_blank';
    link.rel = 'noreferrer';
    title.appendChild(link);
    card.append(title, body);
    return card;
  }

  // =======================
  // Cards that matter for a trade
  // =======================

  const CATEGORY_ICONS = { outfit: 'outfits', mount: 'mount', monster: 'creature', equip: 'equips', room: 'map', backpack: 'bag' };
  const CATEGORIES = ['outfit', 'mount', 'monster', 'backpack'];
  // The game's name for each category's id field.
  const CARD_ID_FIELDS = { outfit: 'outfitId', mount: 'mountId', monster: 'gameId', backpack: 'spriteId' };
  const RARITY_COLORS = { 1: '192, 192, 192', 2: '0, 240, 0', 3: '32, 160, 255', 4: '255, 104, 255', 5: '240, 240, 0' };
  const CAN_GIVE = '#32cd32';
  const CAN_GET = '#f8c810';

  // The game's own module whose source holds the marker, through webpack's require (read the same
  // way by Cyclopedia, docs/game_state_api.md "Codex").
  function getWebpackRequire() {
    if (!webpackRequire) {
      window.webpackChunk_N_E.push([[`better-codex-${Date.now()}`], {}, (req) => { webpackRequire = req; }]);
    }
    return webpackRequire;
  }

  function gameModule(marker) {
    const cached = gameModules.get(marker);
    if (cached) return cached;
    getWebpackRequire();
    const id = Object.keys(webpackRequire.m).find((key) => String(webpackRequire.m[key]).includes(marker));
    // A miss is not remembered: the chunk holding it may load later.
    if (id === undefined) return {};
    const found = webpackRequire(id);
    gameModules.set(marker, found);
    return found;
  }

  // The Codex catalog rows per category ({ card, codexAvailability }).
  function getCatalogRows() {
    if (catalogRows) return catalogRows;
    try {
      catalogRows = Object.values(gameModule('Unknown codex availability')).find((value) => value &&
        typeof value === 'object' && CATEGORIES.every((category) => Array.isArray(value[category]))) || null;
      if (catalogRows) {
        console.log('[Better Codex] Foil cards known:', CATEGORIES.map((category) =>
          `${category} ${catalogRows[category].filter((row) => row.card?.foil === true).length}`).join(', '));
      }
    } catch (error) {
      console.warn('[Better Codex] Card catalog unavailable:', error);
    }
    return catalogRows;
  }

  // Card names (outfit, mount and backpack rows carry none) and the game's per-creature sprite
  // offset, which its Codex applies around the creature sprite.
  function getGameLookups() {
    // This runs once per card drawn, so an incomplete result is read again only after a pause.
    if (gameLookups && (!lookupsRetryAt || Date.now() < lookupsRetryAt)) return gameLookups;
    gameLookups = { names: {}, creatureOffset: null, slotOffset: {}, groups: {}, foils: {}, mounts: null, mountable: new Set() };
    // A name table is an export whose values have a name and the card's id.
    const tables = { outfit: ['Rift Warrior":{id:', 'id'], mount: ['Widow Queen":{id:', 'id'], backpack: ['Raccoon Backpack":{spriteId:', 'spriteId'] };
    Object.entries(tables).forEach(([category, [marker, idField]]) => {
      const names = new Map();
      try {
        Object.values(gameModule(marker)).forEach((table) => {
          if (!table || typeof table !== 'object') return;
          // The mount map by id carries each rider offset.
          if (category === 'mount' && typeof table.get === 'function') gameLookups.mounts = table;
          (table instanceof Map ? Array.from(table.values()) : Object.values(table)).forEach((entry) => {
            if (entry?.name && entry[idField] !== undefined) names.set(Number(entry[idField]), entry.name);
            if (entry?.foil && entry[idField] !== undefined) {
              (gameLookups.foils[category] ||= new Set()).add(Number(entry[idField]));
            }
            if (category === 'outfit' && entry?.mountable) {
              gameLookups.mountable.add(entry.id);
              if (entry.alt) gameLookups.mountable.add(entry.alt);
            }
          });
        });
      } catch (error) {
        console.warn('[Better Codex] Names unavailable for', category, error);
      }
      console.log('[Better Codex] Names for', category, ':', names.size);
      gameLookups.names[category] = names;
    });
    try {
      // Picked by what it returns, as export names are minified.
      gameLookups.creatureOffset = Object.values(gameModule('Astronis:{x:')).find((value) => {
        if (typeof value !== 'function') return false;
        try {
          return Number.isFinite(value({ name: 'Astronis', lookType: 'outfit' })?.x);
        } catch (_) {
          return false;
        }
      }) || null;
    } catch (error) {
      console.warn('[Better Codex] Creature offsets unavailable:', error);
    }
    if (!gameLookups.creatureOffset) console.warn('[Better Codex] No creature offset function found');
    const groupMarkers = { outfit: 'warrior', mount: 'arachnid', monster: 'minotaur', backpack: 'classic' };
    Object.entries(groupMarkers).forEach(([category, first]) => {
      try {
        // The export holding { name: { en, pt } } per subgroup, in the order the Codex lists them.
        gameLookups.groups[category] = Object.values(gameModule(`${first}:{name:{en:`))
          .find((value) => value?.[first]?.name?.en);
      } catch (error) {
        console.warn('[Better Codex] Subgroup names unavailable for', category, error);
      }
      if (!gameLookups.groups[category]) console.warn('[Better Codex] No subgroup names for', category);
    });
    const offsetMarkers = { outfit: 'Hand of the Inquisition":{x:', mount: 'Festive Snowman":{x:' };
    Object.entries(offsetMarkers).forEach(([category, marker]) => {
      const ids = Array.from(gameLookups.names[category].keys());
      try {
        // The export that answers a card id with an { x, y }.
        gameLookups.slotOffset[category] = Object.values(gameModule(marker)).find((value) => {
          if (typeof value !== 'function') return false;
          try {
            return ids.some((id) => Number.isFinite(value(id)?.x));
          } catch (_) {
            return false;
          }
        });
      } catch (error) {
        console.warn('[Better Codex] Slot offsets unavailable for', category, error);
      }
      if (!gameLookups.slotOffset[category]) console.warn('[Better Codex] No slot offset function for', category);
    });
    console.log('[Better Codex] Mounts:', gameLookups.mounts?.size ?? 'none', '- mountable outfits:', gameLookups.mountable.size);
    const complete = gameLookups.creatureOffset && Object.values(gameLookups.names).every((names) => names.size);
    lookupsRetryAt = complete ? 0 : Date.now() + LOOKUPS_RETRY;
    return gameLookups;
  }

  // Their Codex numbers, counted by the game's own resolver as its Codex does. Per category the total
  // leaves out exclusive cards while the owned count includes the ones they hold; the overall figure
  // leaves exclusives out of both and counts them apart. Empty when they cannot be counted.
  function codexCounts(player) {
    try {
      const rows = getCatalogRows();
      const data = player.codexData;
      const resolver = Object.values(gameModule('Unknown codex availability'))
        .find((value) => typeof value === 'function' && String(value).includes('Unknown codex card source'));
      if (!rows || !data || !resolver) {
        console.warn('[Better Codex] Cannot count their Codex:', { rows: !!rows, data: !!data, resolver: !!resolver });
        return null;
      }
      const resolve = resolver({
        codex: data.codex,
        monsters: (player.monsters || []).filter((monster) => !monster.hidden),
        equips: player.equips || [],
        rooms: data.rooms || {},
        completedRegions: new Set(data.completedRegionIds || []),
        highscoreRoomIds: new Set(data.highscoreRoomIds || [])
      });
      const counts = { categories: {}, owned: 0, total: 0, exclusives: 0, spares: 0 };
      ['outfit', 'mount', 'monster', 'equip', 'room', 'backpack'].forEach((category) => {
        if (!rows[category]) return;
        let owned = 0;
        let total = 0;
        rows[category].forEach((row) => {
          const exclusive = row.codexAvailability === 'exclusive';
          const has = resolve(row.card).count > 0;
          // Duplicate pack cards, which can be sharded or traded.
          if (row.codexAvailability === 'pack' && CARD_ID_FIELDS[category]) {
            counts.spares += Math.max(0, (data.codex?.[category]?.[row.card[CARD_ID_FIELDS[category]]] || 0) - 1);
          }
          if (!exclusive) total++;
          if (!has) return;
          owned++;
          if (exclusive) counts.exclusives++;
          else counts.owned++;
        });
        counts.total += total;
        counts.categories[category] = `${owned}/${total}`;
      });
      return counts;
    } catch (error) {
      console.warn('[Better Codex] Could not count their Codex:', error);
      return null;
    }
  }

  // Cards only come from packs, so only those can be given away. A spare is any copy above the first.
  function tradeCards(player) {
    const rows = getCatalogRows();
    const mine = globalThis.state?.player?.getSnapshot?.()?.context?.codex;
    const theirs = player.codexData?.codex;
    if (!rows || !mine || !theirs) {
      console.warn('[Better Codex] Cannot compare cards:', { catalog: !!rows, mine: !!mine, theirs: !!theirs });
      return null;
    }
    const missing = [];
    const gettable = [];
    CATEGORIES.forEach((category) => {
      rows[category].forEach((row) => {
        const id = row.card?.[CARD_ID_FIELDS[category]];
        if (row.codexAvailability !== 'pack' || id === undefined) return;
        const own = myCopies(category, id);
        const their = theirs[category]?.[id] || 0;
        const card = { category, id, group: row.group, data: row.card };
        if (!their) missing.push({ ...card, copies: own, canGive: own > 1 });
        if (!own && their > 1) gettable.push({ ...card, copies: their });
      });
    });
    console.log('[Better Codex]', player.name, 'is missing', missing.length, '- you can give',
      missing.filter((card) => card.canGive).length, '- you can get', gettable.length);
    return { missing, gettable };
  }

  function sizedCanvas() {
    const canvas = element('canvas', 'pixelated');
    canvas.width = canvas.height = 32;
    canvas.style.cssText = 'width:32px;height:32px;';
    return canvas;
  }

  function itemSprite(id) {
    const box = element('div', `sprite item relative id-${id}`);
    const viewport = element('div', 'viewport');
    const sheet = element('img', 'spritesheet');
    sheet.alt = '';
    viewport.appendChild(sheet);
    box.appendChild(viewport);
    return box;
  }

  // As the game draws a creature: by its lookType, an animated outfit sheet or an item sprite.
  function creatureSprite(metadata, id) {
    const spriteId = metadata?.spriteId ?? id;
    if (metadata?.lookType !== 'outfit') return itemSprite(spriteId);
    const sprite = element('div', `sprite outfit pointer-events-none id-${spriteId} idle south`);
    sprite.style.translate = metadata.portraitTranslate || '';
    const viewport = element('div', 'viewport');
    const sheet = element('img', 'actor spritesheet');
    sheet.alt = '';
    viewport.appendChild(sheet);
    sprite.appendChild(viewport);
    const wrapper = element('div', 'pointer-events-none relative grid');
    try {
      const offset = getGameLookups().creatureOffset?.(metadata);
      if (offset) wrapper.style.translate = `${offset.x}px ${offset.y}px`;
    } catch (error) {
      console.warn('[Better Codex] Offset failed for', metadata.name, error);
    }
    wrapper.appendChild(sprite);
    return wrapper;
  }

  function cardImage({ category, id, data }, player) {
    if (category === 'backpack') return itemSprite(id);
    if (category === 'equip') return itemSprite(data.metadata.spriteId);
    if (category === 'room') {
      const image = element('img', 'pixelated relative max-w-none size-8');
      image.src = `/assets/room-thumbnails/${id}.png`;
      image.alt = '';
      return image;
    }
    if (category === 'monster') return creatureSprite(data.metadata, id);
    // Drawn only once scrolled into view, inside the wrapper drawSlot moves.
    const canvas = sizedCanvas();
    const paint = (target, frame) => drawSlot(target, frame, category, Number(id));
    canvas.betterCodexDraw = category === 'outfit'
      ? () => drawOutfit(canvas, { ...player, outfitId: Number(id), mountId: null }, paint)
      : () => loadFrame(`/assets/playerMount/${id}.png`, (frame) => paint(canvas, frame));
    drawObserver.observe(canvas);
    const wrapper = element('div', 'pointer-events-none relative grid');
    wrapper.appendChild(canvas);
    return wrapper;
  }

  // Looks like a slot of the game's own Codex.
  function buildSlot(card, player) {
    const rarity = card.data.rarity ?? card.data.metadata?.rarity ?? 1;
    const slot = element('div', 'container-slot surface-darker relative size-[34px]');
    slot.title = card.data.name ?? card.data.metadata?.name ??
      getGameLookups().names[card.category]?.get(Number(card.id)) ?? `#${card.id}`;
    const glow = element('div', 'absolute inset-0');
    glow.style.background = `radial-gradient(closest-side, rgba(${RARITY_COLORS[rarity] || RARITY_COLORS[1]}, 0.25), transparent)`;
    const art = element('div', 'absolute inset-0 grid grid-cols-[32px] grid-rows-[32px] place-content-center place-items-center overflow-hidden');
    art.appendChild(cardImage(card, player));
    const foil = card.data.foil || card.data.metadata?.foil;
    const border = element('div', `absolute inset-0 opacity-60 ${foil ? 'rarity-foil' : 'has-rarity'}`);
    if (!foil) border.dataset.rarity = rarity;
    slot.append(glow, art, border);
    if (card.copies > 1) {
      const count = element('span', 'pixel-font-14 absolute bottom-0 right-px z-2 text-whiteExp', `x${card.copies}`);
      slot.appendChild(count);
    }
    return slot;
  }

  // The two titles of the game's own Codex list: a category, then a separator per subgroup.
  function buildCategoryTitle(category, count) {
    const row = element('div', 'flex items-center gap-1.5 pt-1');
    row.append(icon(`/assets/icons/${CATEGORY_ICONS[category]}.png`, ''), element('span', 'truncate text-whiteBrightest', t(category)),
      element('span', 'pixel-font-14 ml-auto shrink-0 text-whiteDark', String(count)));
    return row;
  }

  function buildGroupTitle(name, count) {
    const row = element('div', 'pixel-font-14 flex items-center gap-2 pt-1');
    const line = element('div', 'separator my-0 min-w-0 flex-1');
    line.setAttribute('role', 'none');
    row.append(element('span', 'shrink-0 text-whiteRegular', name), line, element('span', 'shrink-0 text-whiteDark', String(count)));
    return row;
  }

  // Cards per category and subgroup; each card's name is its tooltip. wrap turns a slot into what is shown.
  function buildGrid(cards, player, wrap = (slot) => slot) {
    const list = element('div', 'grid content-start gap-1.5');
    const language = api?.i18n?.getLocale?.()?.startsWith('pt') ? 'pt' : 'en';
    CATEGORIES.forEach((category) => {
      const own = cards.filter((card) => card.category === category);
      if (!own.length) return;
      list.appendChild(buildCategoryTitle(category, own.length));
      const names = getGameLookups().groups[category] || {};
      const order = Object.keys(names);
      const groups = [...new Set(own.map((card) => card.group))].sort((a, b) => order.indexOf(a) - order.indexOf(b));
      groups.forEach((group) => {
        const members = own.filter((card) => card.group === group);
        const grid = element('div', 'flex flex-wrap');
        grid.style.cssText = 'gap:6px;padding:2px;';
        grid.append(...members.map((card) => wrap(buildSlot(card, player), card)));
        if (group !== undefined) list.appendChild(buildGroupTitle(names[group]?.name?.[language] || group, members.length));
        list.appendChild(grid);
      });
    });
    return list;
  }

  function buildSection(title, color, cards) {
    const section = element('div', 'grid content-start gap-1.5');
    const heading = element('div', '', title);
    heading.style.color = color;
    section.append(heading, cards);
    return section;
  }

  // Cards you can get open the trade with that card already asked for.
  function buildWantedGrid(cards, player) {
    return buildGrid(cards, player, (slot, { category, id }) => {
      slot.title = `${slot.title} - ${t('clickToTrade')}`;
      const button = element('button', 'focus-style-visible');
      button.type = 'button';
      button.addEventListener('click', () => openTradeWith(player, { category, [CARD_ID_FIELDS[category]]: Number(id) }));
      button.appendChild(slot);
      return button;
    });
  }

  // The cards they lack that you cannot give: only for reference, so folded away.
  function buildFolded(title, cards, player) {
    const section = element('div', 'grid content-start gap-1.5');
    const toggle = element('button', 'focus-style-visible pixel-font-14 text-left text-whiteDark');
    toggle.type = 'button';
    let grid = null;
    const label = () => { toggle.textContent = `${grid && grid.style.display !== 'none' ? '▾' : '▸'} ${title}`; };
    toggle.addEventListener('click', () => {
      if (!grid) {
        grid = buildGrid(cards, player);
        section.appendChild(grid);
      } else {
        grid.style.display = grid.style.display === 'none' ? '' : 'none';
      }
      label();
    });
    label();
    section.appendChild(toggle);
    return section;
  }

  function buildCards(player) {
    drawObserver = new IntersectionObserver((entries) => {
      entries.filter((entry) => entry.isIntersecting).forEach(({ target }) => {
        drawObserver.unobserve(target);
        target.betterCodexDraw();
      });
    });
    const list = element('div', 'grid content-start gap-3 p-2');
    const cards = tradeCards(player);
    if (!cards) {
      list.appendChild(element('div', 'pixel-font-14 text-whiteDark', t('cardsFailed')));
      return list;
    }
    const heading = (key, count) => t(key).replace('{name}', player.name).replace('{count}', count);
    const give = cards.missing.filter((card) => card.canGive);
    const others = cards.missing.filter((card) => !card.canGive);
    if (cards.gettable.length) {
      list.appendChild(buildSection(heading('canGet', cards.gettable.length), CAN_GET, buildWantedGrid(cards.gettable, player)));
    }
    if (give.length) list.appendChild(buildSection(heading('canGive', give.length), CAN_GIVE, buildGrid(give, player)));
    const matched = cards.gettable.length || give.length;
    if (!matched) list.appendChild(element('div', 'text-whiteRegular', heading('noTrades', 0)));
    if (others.length) {
      list.appendChild(buildFolded(heading(give.length ? 'theyAlsoMiss' : 'theyMiss', others.length), others, player));
    }
    return list;
  }

  // =======================
  // Player match in an empty card list
  // =======================

  function removeResult() {
    unmountRecords();
    drawObserver?.disconnect();
    drawObserver = null;
    resultNodes.forEach((node) => node.remove());
    hiddenNodes.forEach((node) => node.style.removeProperty('display'));
    resultNodes = [];
    hiddenNodes = [];
    shownKey = '';
  }

  // The game's own nodes are only hidden, never moved or removed, as React owns them.
  function hide(node) {
    if (node.style.display === 'none') return;
    node.style.display = 'none';
    hiddenNodes.push(node);
  }

  // Their cards go inside the list's scroll area, so the game's own scrollbar moves them; their
  // profile card and the trade button replace the preview.
  // Narrow layouts have no preview column, so there the button and profile card sit above the cards.
  function showResult(dialog, panel, player) {
    const preview = panel.nextElementSibling?.firstElementChild;
    // The content box of the game's scroll area, which its scrollbar measures.
    const content = panel.querySelector('[data-radix-scroll-area-viewport] > div');
    const current = resultNodes[0];
    if (current?.parentElement !== content || current.dataset.player !== player.name ||
        (preview && resultNodes[1]?.parentElement !== preview)) {
      removeResult();
      const counts = codexCounts(player);
      const cards = element('div', '');
      // The content box sizes itself to its children; without this the card rows would never wrap.
      cards.style.contain = 'inline-size';
      cards.dataset.player = player.name;
      cards.appendChild(buildCards(player));
      const button = element('button', dialog.querySelector(TRADES_BUTTON).className, t('tradeButton'));
      button.classList.remove('relative');
      paintButton(button, 'blue');
      button.type = 'button';
      button.addEventListener('click', () => openTradeWith(player));
      content.appendChild(cards);
      content.parentElement.scrollTop = 0;
      resultNodes.push(cards);
      const profile = element('div', 'grid justify-items-center gap-2');
      const playerCard = buildPlayerCard(player, counts);
      if (preview) {
        profile.append(playerCard, button);
        preview.appendChild(profile);
        resultNodes.push(profile);
      } else {
        // Full height, as the list around it already scrolls.
        playerCard.style.maxHeight = 'none';
        profile.classList.add('pt-2');
        profile.append(button, playerCard);
        cards.prepend(profile);
      }
      Object.entries(counts?.categories || {}).forEach(([category, text]) => {
        const row = dialog.querySelector(`nav button[data-category="${category}"]`);
        const count = row?.querySelector(':scope > span.ml-auto');
        if (!count) return;
        const theirs = element('span', count.className, text);
        hide(count);
        row.appendChild(theirs);
        resultNodes.push(theirs);
      });
    }
    // The panel's first child is the card list; what follows is the "No cards found" message.
    Array.from(panel.children).slice(1).filter((node) => !resultNodes.includes(node)).forEach(hide);
    Array.from(preview?.children || []).filter((node) => !resultNodes.includes(node)).forEach(hide);
  }

  // Waits for typing to pause: the game answers every unfinished name with a 404, which the browser
  // always logs. Only a failed request is retried, while that name is still in the search box.
  function scheduleLookup(query) {
    if (query === lookupQuery) return;
    lookupQuery = query;
    pendingLookup = query;
    clearTimeout(lookupTimer);
    lookupTimer = setTimeout(() => lookupPlayer(query, LOOKUP_RETRIES), LOOKUP_DELAY);
  }

  async function lookupPlayer(query, retries) {
    let player = null;
    try {
      player = await fetchPlayer(query);
    } catch (error) {
      console.warn('[Better Codex] Player lookup failed:', error);
      if (disposed) return;
      const stillWanted = query === lookupQuery && document.getElementById(SEARCH_ID)?.value.trim() === query;
      if (retries > 0 && stillWanted) {
        console.log('[Better Codex] Retrying lookup of', query, '-', retries, 'left');
        lookupTimer = setTimeout(() => lookupPlayer(query, retries - 1), 1000);
      } else if (query === lookupQuery) {
        // Not remembered: it is looked up again once the search text changes. lookupQuery stays, or
        // taking the placeholder down would start the same lookup over.
        pendingLookup = '';
        sync();
      }
      return;
    }
    if (disposed) return;
    if (pendingLookup === query) pendingLookup = '';
    players.set(query.toLowerCase(), { player, at: Date.now() });
    sync();
  }

  // In place of the game's "No cards found" until the name is answered.
  function showSearching(panel, query) {
    if (resultNodes[0]?.parentElement !== panel || resultNodes[0].dataset.searching !== query) {
      removeResult();
      const node = element('div', 'auto-centered pointer-events-none absolute w-full px-4 text-center text-whiteRegular',
        t('searchingPlayer'));
      node.dataset.searching = query;
      panel.appendChild(node);
      resultNodes.push(node);
    }
    Array.from(panel.children).slice(1).filter((child) => !resultNodes.includes(child)).forEach(hide);
  }

  // =======================
  // Extras: what the game hides from its Codex
  // =======================

  const EXTRA_CATEGORIES = [...CATEGORIES, 'equip', 'room'];

  // Read from the game's own tables, as the Codex view drops everything marked hidden.
  function hiddenCards() {
    const isHidden = (entry) => entry?.codexAvailability === 'hidden';
    const found = Object.fromEntries(EXTRA_CATEGORIES.map((category) => [category, []]));
    const add = (category, read) => {
      try {
        found[category] = read();
      } catch (error) {
        console.warn('[Better Codex] Hidden cards unavailable for', category, error);
      }
    };
    // Pack-card sources: shaped like the view's rows, without its room and equipment lists.
    const sources = () => Object.values(gameModule('Unknown codex availability')).find((value) =>
      value && CATEGORIES.every((category) => Array.isArray(value[category])) && !value.room);
    ['outfit', 'mount', 'backpack'].forEach((category) => add(category, () => sources()[category]
      .filter(isHidden)
      .map((row) => ({ category, id: row.card[CARD_ID_FIELDS[category]], data: { ...row.card, group: row.group } }))));
    // Creatures come from two tables keyed by id: the monster dictionary, whose entries hold their
    // metadata, and a smaller one holding the metadata itself.
    add('monster', () => {
      const tables = Object.values(gameModule('Monster [".concat(')).filter((value) => value &&
        typeof value === 'object' && Object.keys(value).length && Object.keys(value).every((id) => Number(id)));
      const dictionary = tables.find((table) => Object.values(table).every((entry) => entry?.metadata?.name));
      const extra = tables.find((table) => Object.values(table).every((entry) => entry?.name && entry.lookType));
      if (!dictionary) throw new Error('monster dictionary not found');
      return [...Object.entries(dictionary).map(([id, entry]) => [id, entry.metadata]), ...Object.entries(extra || {})]
        .filter(([, metadata]) => isHidden(metadata))
        .map(([id, metadata]) => ({ category: 'monster', id: Number(id), data: { metadata } }));
    });
    add('equip', () => {
      const list = [];
      for (let id = 1; ; id++) {
        let metadata;
        try {
          metadata = globalThis.state.utils.getEquipment(id)?.metadata;
        } catch (_) {
          // The game throws past the last id.
        }
        if (!metadata) return list;
        if (isHidden(metadata)) list.push({ category: 'equip', id, data: { metadata } });
      }
    });
    add('room', () => globalThis.state.utils.REGIONS.flatMap((region) => region.rooms).filter(isHidden)
      .map((room) => ({ category: 'room', id: room.id, data: { ...room, name: globalThis.state.utils.ROOM_NAME[room.id] } })));
    console.log('[Better Codex] Hidden cards:',
      EXTRA_CATEGORIES.map((category) => `${category} ${found[category].length}`).join(', '));
    return found;
  }

  function getHiddenCards() {
    return (hiddenCache ||= hiddenCards());
  }

  // The cards the game derives from what you have, as its own Codex names them.
  const DERIVED_CARDS = {
    monster: (id) => ({ source: 'monsters', category: 'monster', gameId: id }),
    equip: (id) => ({ source: 'equips', category: 'equip', gameId: id }),
    room: (id) => ({ source: 'rooms', category: 'room', roomId: id })
  };

  // The game's resolver indexes everything you have, so it is built once per player state: the sidebar
  // counter asks on every DOM change.
  function progressResolver() {
    const context = globalThis.state?.player?.getSnapshot?.()?.context;
    if (!context) return null;
    if (progressCache?.context !== context) {
      const build = Object.values(gameModule('Unknown codex availability'))
        .find((value) => typeof value === 'function' && String(value).includes('Unknown codex card source'));
      if (!build) return null;
      progressCache = {
        context,
        resolve: build({
          codex: context.codex,
          monsters: context.monsters || [],
          equips: context.equips || [],
          rooms: context.rooms || {},
          completedRegions: new Set(),
          highscoreRoomIds: new Set()
        })
      };
    }
    return progressCache.resolve;
  }

  // { count, rarity, foil } of a derived card from the game's progress resolver, or null.
  function ownProgress({ category, id }) {
    try {
      return progressResolver()?.(DERIVED_CARDS[category](id)) || null;
    } catch (error) {
      console.warn('[Better Codex] No progress for', category, id, error);
      return null;
    }
  }

  // What the game's Codex holds, which includes the outfits and mounts Outfiter unlocked. Extras shows
  // those as owned, as the game does; trades and tracking use ownsCard instead.
  function codexHolds({ category, id }) {
    return (globalThis.state?.player?.getSnapshot?.()?.context?.codex?.[category]?.[id] || 0) > 0;
  }

  // Outfits, mounts and backpacks are Codex cards; the others count once you have them in the game.
  function ownsExtra(card) {
    return DERIVED_CARDS[card.category] ? ownProgress(card)?.count > 0 : codexHolds(card);
  }

  // A derived card you have takes its rarity and foil from your progress, as in the game.
  function withProgress(card) {
    const progress = DERIVED_CARDS[card.category] && ownProgress(card);
    return progress?.count > 0 ? { ...card, data: { ...card.data, rarity: progress.rarity, foil: progress.foil } } : card;
  }

  // The classes of the game's own slots: hover and selection frame, and the dimming of a missing card.
  const SLOT_STATES = ['border-whiteDark', 'group-hover:unset-border-image', "group-data-[highlighted='true']:unset-border-image",
    'group-active:opacity-70', "group-data-[highlighted='true']:border-whiteBrightest"];

  function extraSlot(card, look) {
    // Creatures, maps and equipment are not Codex cards, so they have no copy count.
    const copies = CARD_ID_FIELDS[card.category] && card.category !== 'monster' ? myCopies(card.category, card.id) : 0;
    const slot = buildSlot({ ...card, copies }, look);
    slot.classList.add(...SLOT_STATES);
    if (card.category === 'room') {
      slot.insertBefore(element('div', 'absolute inset-0 shadow-[inset_0_0_4px_2px_rgba(0,0,0,0.8)]'), slot.children[2]);
    }
    const owned = ownsExtra(card);
    // The game marks the rarity of an owned creature, equipment or map in the corner.
    if (owned && DERIVED_CARDS[card.category]) {
      const { rarity, foil } = card.data;
      const star = foil ? 'shiny-star' : rarity > 1 && `star-tier-${rarity - 1}`;
      if (star) {
        const image = element('img', 'pixelated pointer-events-none absolute right-0 top-0 z-2 opacity-75');
        image.src = `/assets/icons/${star}.png`;
        image.alt = '';
        slot.appendChild(image);
      }
    }
    if (!owned) {
      const [glow, art] = slot.children;
      const border = slot.querySelector('.opacity-60');
      glow.remove();
      art.classList.add('data-[dimmed=true]:opacity-60', 'data-[dimmed=true]:grayscale');
      border.classList.add('data-[dimmed=true]:opacity-40');
      art.dataset.dimmed = border.dataset.dimmed = 'true';
    }
    return slot;
  }

  // How the game's card preview components name each category.
  const CARD_TYPES = { outfit: 'Outfit', mount: 'Mount', monster: 'Creature', equip: 'Equipment', room: 'Map', backpack: 'Backpack' };

  // The card type and rarity names of the game's own preview, as { type: { en, pt }, rarities: { en, pt } }.
  // The game keeps them private, so they are read from its code: the preview component names its
  // category and calls a rarity function, which picks from two tables { 1: ..., 5: ... }.
  // sources is webpack's module id -> factory.
  function parseCardWords(sources, type) {
    const preview = new RegExp(`flavor:\\(0,(\\w+)\\.(\\w+)\\)\\(\\w+\\),group:[^,]+,category:\\{en:"${type}",pt:"([^"]+)"\\}`);
    let found;
    let component;
    for (const factory of Object.values(sources)) {
      component = String(factory);
      found = component.match(preview);
      if (found) break;
    }
    if (!found) return null;
    const [, alias, exported, pt] = found;
    const moduleId = component.match(new RegExp(`[ ,]${alias}=\\w+\\((\\d+)\\)`))?.[1];
    const words = String(sources[moduleId] || '');
    const local = words.match(new RegExp(`[{,]${exported}:function\\(\\)\\{return (\\w+)\\}`))?.[1];
    const tables = words.match(new RegExp(`[ ,]${local}=\\w+=>\\(0,\\w+\\.\\w+\\)\\(\\)\\.translate\\((\\w+)\\[\\w+\\],(\\w+)\\[\\w+\\]\\)`));
    // A table's values in order of rarity, with the minifier's \xHH and \uHHHH escapes decoded.
    const values = (name) => {
      const body = words.match(new RegExp(`[ ,]${name}=\\{(1:"[^}]*)\\}`))?.[1] || '';
      return [...body.matchAll(/\d:"([^"]*)"/g)].map(([, value]) => value
        .replace(/\\(?:x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4}))/g, (_, x, u) => String.fromCharCode(parseInt(x || u, 16))));
    };
    return {
      type: { en: type, pt },
      rarities: tables ? { en: values(tables[1]), pt: values(tables[2]) } : { en: [], pt: [] }
    };
  }

  function cardWords(category) {
    if (!wordCache.has(category)) {
      let words = null;
      try {
        words = parseCardWords(getWebpackRequire().m, CARD_TYPES[category]);
      } catch (error) {
        console.warn('[Better Codex] Card words unreadable for', category, error);
      }
      if (!words?.rarities.en.length) console.warn('[Better Codex] No card words for', category);
      wordCache.set(category, words);
    }
    return wordCache.get(category);
  }

  // { name, quote } of a card's group; a map's group is its region.
  function cardGroup({ category, id, data }) {
    try {
      if (category !== 'room') return getGameLookups().groups[category]?.[(data.metadata || data).group];
      const region = globalThis.state.utils.REGIONS.find((entry) => entry.rooms.some((room) => room.id === id));
      return Object.values(gameModule('ankrahmun:{name:{en:')).find((value) => value?.ankrahmun?.quote)?.[region?.id];
    } catch (error) {
      console.warn('[Better Codex] No group for', category, id, error);
      return undefined;
    }
  }

  // The picture of the game's card preview, at its zoom.
  function previewArt(card, look, name) {
    if (card.category === 'room') {
      const image = element('img', 'pixelated max-w-none absolute inset-0 size-full object-cover');
      image.src = `/assets/room-thumbnails/${card.id}.png`;
      image.alt = name;
      return image;
    }
    const zoom = element('div', 'pointer-events-none relative grid');
    zoom.style.scale = ['outfit', 'mount', 'monster'].includes(card.category) ? '3' : '4';
    if (card.category === 'outfit' || card.category === 'mount') {
      const canvas = element('canvas', 'pixelated');
      // Cropped and centred, then shown at its own size so the zoom stays whole pixels.
      const paint = (target, frame) => {
        drawCropped(target, frame);
        target.style.width = `${target.width}px`;
        target.style.height = `${target.height}px`;
      };
      if (card.category === 'outfit') drawOutfit(canvas, { ...look, outfitId: Number(card.id), mountId: null }, paint);
      else loadFrame(`/assets/playerMount/${card.id}.png`, (frame) => paint(canvas, frame));
      zoom.appendChild(canvas);
    } else {
      zoom.appendChild(cardImage(card, look));
    }
    return zoom;
  }

  // The game's Change outfit window lists the outfits and mounts its Codex holds.
  function opensOutfitter(card) {
    return (card.category === 'outfit' || card.category === 'mount') && codexHolds(card);
  }

  function openOutfitter({ category, id }) {
    globalThis.state.menu.trigger.setState({
      fn: (menu) => ({
        ...menu,
        mode: 'outfitter',
        outfitter: { selectedId: id, selected: category },
        inventory: { selectedItem: false }
      })
    });
  }

  // The game's own "go to this map": its map picker for the room, unless the game holds you back.
  function openMapPicker({ id }) {
    try {
      const goToRoom = Object.values(gameModule('openGotoRoom:!1,mapPickerForm:'))
        .find((value) => typeof value === 'function' && String(value).includes('mapPickerForm'));
      globalThis.state.menu.trigger.setState({ fn: (menu) => ({ ...menu, inventory: { selectedItem: false } }) });
      goToRoom({ roomId: id, suggestedFloor: globalThis.state.player.getSnapshot().context.rooms?.[id]?.floor });
    } catch (error) {
      console.warn('[Better Codex] Could not open the map picker for', id, error);
    }
  }

  // What an Extras card opens, as its game counterpart does, or null: owned maps their map picker,
  // outfits and mounts your Codex holds the Change outfit window.
  function cardAction(card) {
    if (card.category === 'room') return ownsExtra(card) ? () => openMapPicker(card) : null;
    return opensOutfitter(card) ? () => openOutfitter(card) : null;
  }

  // As in the game, such a preview card is a button.
  function actionButton(action, frame) {
    const button = element('button', 'focus-style-visible shrink-0');
    button.type = 'button';
    button.appendChild(frame);
    button.addEventListener('click', action);
    return button;
  }

  // The game's own card preview.
  function buildExtraPreview(card, look, name, position) {
    unmountRecords();
    const metadata = card.data.metadata || card.data;
    const language = api?.i18n?.getLocale?.()?.startsWith('pt') ? 'pt' : 'en';
    const words = cardWords(card.category);
    const cardRarity = card.data.rarity ?? metadata.rarity;
    const rarity = cardRarity || 1;
    const foil = !!(card.data.foil ?? metadata.foil);
    const group = cardGroup(card);

    const preview = element('div', 'grid content-start justify-items-center');
    preview.style.cssText = 'min-height:0;overflow-y:auto;';
    const frame = element('div', 'relative flex shrink-0 flex-col');
    frame.style.cssText = 'width:232px;height:320px;';
    const title = element('div', 'widget-top widget-top-text flex items-center gap-1 py-[3px]');
    title.appendChild(element('span', 'truncate text-whiteBrightest', name));
    const star = foil ? '/assets/icons/shiny-star.png' : rarity > 1 && `/assets/icons/star-tier-lax-${rarity - 1}.png`;
    if (star) {
      const image = element('img', 'pixelated ml-auto shrink-0');
      image.src = star;
      image.alt = '';
      title.appendChild(image);
    }
    const body = element('div', 'widget-bottom grid flex-1 grid-rows-[auto_auto_1fr_auto] gap-1.5 p-1.5');
    const art = element('div', 'container-slot surface-darker relative grid h-[194px] place-items-center overflow-hidden');
    const glow = element('div', 'absolute inset-0');
    glow.style.background = `radial-gradient(circle at 50% 60%, rgba(${RARITY_COLORS[rarity] || RARITY_COLORS[1]}, 0.31), transparent 70%)`;
    const border = element('div', `pointer-events-none absolute inset-0 opacity-80 ${foil ? 'rarity-foil' : 'has-rarity'}`);
    border.style.borderImageWidth = '12px';
    if (!foil) border.dataset.rarity = rarity;
    const shadow = element('div', 'absolute inset-0 shadow-[inset_0_0_12px_4px_rgba(0,0,0,0.7)]');
    const picture = previewArt(card, look, name);
    // A map's picture is the backdrop; everything else sits on top of the frame.
    art.append(...(card.category === 'room' ? [glow, picture, shadow, border] : [glow, shadow, border, picture]));

    const line = element('div', 'pixel-font-14 flex items-center justify-between gap-2');
    const flavor = element('span', `shrink-0 ${foil ? 'text-foil' : 'has-rarity-text'}`,
      cardRarity ? words?.rarities[language][rarity - 1] || '' : '');
    if (!foil) flavor.dataset.rarity = rarity;
    line.append(element('span', 'truncate text-whiteDark', group?.name?.[language] || metadata.group || ''), flavor);
    const quote = element('div', 'tooltip-prose pixel-font-14 frame-pressed-1 surface-dark px-1.5 py-1 text-left');
    if (group?.quote) quote.appendChild(element('blockquote', '', `"${group.quote[language]}"`));
    const footer = element('div', 'pixel-font-14 flex items-center justify-between text-whiteDarker');
    footer.append(element('span', '', words?.type[language] || t(card.category)),
      element('span', '', `#${String(position.number).padStart(2, '0')}/${position.total}`));
    body.append(art, line, quote, footer);
    frame.append(title, body);

    const action = cardAction(card);
    preview.appendChild(action ? actionButton(action, frame) : frame);
    if (card.category === 'room') {
      preview.classList.add('gap-2');
      mountRecords(preview, card);
    }
    return preview;
  }

  // =======================
  // Map records
  // =======================

  // Where the game's records card gets its parts, read from the code of the module that holds it: the
  // names are minified. sources is webpack's module id -> factory.
  function parseRecordCard(sources) {
    const source = Object.values(sources).map(String).find((factory) => factory.includes('["Runs: ",'));
    if (!source) return null;
    const moduleOf = (alias) => source.match(new RegExp(`[ ,]${alias}=\\w+\\((\\d+)\\)`))?.[1];
    const call = (pattern) => {
      const [, alias, name] = source.match(pattern) || [];
      return alias ? { id: moduleOf(alias), name } : null;
    };
    const jsx = source.match(/\(0,(\w+)\.jsx\)\("div"/)?.[1];
    const found = {
      jsx: jsx && moduleOf(jsx),
      best: call(/pb:\(0,(\w+)\.(\w+)\)\(/),
      grade: call(/grade:\(0,(\w+)\.(\w+)\)\(\{rank/)
    };
    return found.jsx && found.best?.id && found.grade?.id ? found : null;
  }

  // The game's own records card for a map, mounted into node. world is the public Trophy Room data.
  function renderRecords(node, room, world) {
    const webpack = getWebpackRequire();
    const parts = parseRecordCard(webpack.m);
    const card = Object.values(gameModule('["Runs: ",'))
      .find((value) => String(value?.type || value).includes('["Runs: ",'));
    if (!parts || !card) throw new Error('records card not found');
    const { jsx } = webpack(parts.jsx);
    // The providers the game's app puts around it: tooltips, the outlined font and the language.
    const tooltips = Object.values(gameModule('"tooltip.open"')).find((value) => value?.displayName === 'TooltipProvider');
    const font = Object.values(gameModule('source:"outlined_text"'))
      .find((value) => typeof value === 'function' && String(value).includes('.Provider'));
    const language = Object.values(gameModule('locale:"en",isEn:!0,translate:'))
      .find((value) => typeof value === 'function' && String(value).includes('locale:'));
    if (!tooltips || !font || !language) throw new Error('records providers not found');

    const context = globalThis.state.player.getSnapshot().context;
    const { highscores } = world;
    const entry = {
      roomId: room.id,
      roomName: globalThis.state.utils.ROOM_NAME[room.id],
      pb: webpack(parts.best.id)[parts.best.name](room.id, context.rooms?.[room.id]),
      wrTicks: highscores.tick?.[room.id],
      wrFloor: highscores.floor?.[room.id]
    };
    const rank = highscores.rank?.[room.id];
    if (rank) {
      entry.wrRank = {
        ...rank,
        grade: webpack(parts.grade.id)[parts.grade.name]({ rank: rank.rank, maxTeamSize: room.maxTeamSize })
      };
    }
    // As on a profile, so the title is not a button that would open a hidden map.
    let tree = jsx(card, { entry, player: { type: 'profile', name: context.name } });
    tree = jsx(language, { locale: api?.i18n?.getLocale?.()?.startsWith('pt') ? 'pt' : 'en', children: tree });
    tree = jsx(font, { children: tree });
    const view = globalThis.state.utils.createUIComponent(node, tooltips, {}, tree);
    view.mount();
    return view;
  }

  async function mountRecords(preview, card) {
    const node = element('div', 'shrink-0');
    node.style.width = '232px';
    preview.appendChild(node);
    try {
      const world = await window.BestiaryModAPI.util.fetchTrophyRoomData();
      // Another card was picked, or the view closed, while waiting.
      if (disposed || !node.isConnected) return;
      unmountRecords();
      recordsView = renderRecords(node, card.data, world);
    } catch (error) {
      console.warn('[Better Codex] Map records unavailable for', card.id, error);
      node.remove();
    }
  }

  function unmountRecords() {
    try {
      recordsView?.unmount();
    } catch (error) {
      console.warn('[Better Codex] Map records not unmounted:', error);
    }
    recordsView = null;
  }

  // The category title of the game's Codex list: icon, name, owned/total and a progress bar.
  function buildExtraHeader(category, cards) {
    const owned = cards.filter(ownsExtra).length;
    const header = element('div', 'grid gap-1.5 pt-1');
    header.style.paddingInline = '8px';
    const row = element('div', 'flex items-center gap-1.5');
    const image = icon(`/assets/icons/${CATEGORY_ICONS[category]}.png`, '');
    image.className = 'pixelated shrink-0';
    row.append(image, element('span', 'truncate text-whiteBrightest', t(category)),
      element('span', 'pixel-font-14 ml-auto shrink-0 text-whiteDark', `${owned}/${cards.length}`));
    const bar = element('div', 'relative w-full border border-solid border-black bg-black frame-pressed-1 h-1.5');
    const track = element('div', 'absolute left-0 top-0 flex h-full w-full');
    const fill = element('div', 'h-full shrink-0');
    fill.style.width = `${(owned / cards.length) * 100}%`;
    fill.style.background = owned >= cards.length ? 'rgb(248, 200, 16)' : 'rgb(96, 192, 96)';
    track.appendChild(fill);
    bar.appendChild(track);
    header.append(row, bar);
    return header;
  }

  // The subgroup line of the game's Codex list, its count gold when complete.
  function buildExtraSeparator(name, cards) {
    const owned = cards.filter(ownsExtra).length;
    const row = element('div', 'pixel-font-14 flex items-center gap-2 pt-2');
    row.style.paddingInline = '8px';
    const line = element('div', 'separator my-0 min-w-0 flex-1');
    line.setAttribute('role', 'none');
    const count = element('span', "shrink-0 text-whiteDark data-[complete='true']:text-gold", `${owned}/${cards.length}`);
    count.dataset.complete = String(owned >= cards.length);
    row.append(element('span', 'shrink-0 text-whiteRegular', name), line, count);
    return row;
  }

  // The preview goes in the game's preview column, or above the cards on narrow layouts, which have none.
  function buildExtras(showPreview) {
    drawObserver = new IntersectionObserver((entries) => {
      entries.filter((entry) => entry.isIntersecting).forEach(({ target }) => {
        drawObserver.unobserve(target);
        target.betterCodexDraw();
      });
    });
    const list = element('div', 'grid content-start pb-2');
    // Outfits are drawn in your own colours.
    const look = globalThis.state?.player?.getSnapshot?.()?.context || {};
    const language = api?.i18n?.getLocale?.()?.startsWith('pt') ? 'pt' : 'en';
    const found = getHiddenCards();
    EXTRA_CATEGORIES.filter((category) => found[category].length).forEach((category) => {
      list.appendChild(buildExtraHeader(category, found[category]));
      // Subgroup name -> its cards, in the order found.
      const groups = new Map();
      found[category].forEach((card) => {
        const name = cardGroup(card)?.name?.[language] || (card.data.metadata || card.data).group || '';
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(card);
      });
      groups.forEach((members, name) => {
        if (name) list.appendChild(buildExtraSeparator(name, members));
        const grid = element('div', 'flex flex-wrap gap-1 py-0.5');
        grid.style.paddingInline = '8px';
        grid.append(...members.map((card, index) => {
          const shown = withProgress(card);
          const slot = extraSlot(shown, look);
          const button = element('button', 'group focus-style-visible size-fit');
          button.type = 'button';
          button.dataset.highlighted = 'false';
          button.appendChild(slot);
          button.addEventListener('dblclick', () => cardAction(card)?.());
          button.addEventListener('click', () => {
            list.querySelectorAll('[data-highlighted]').forEach((other) => { other.dataset.highlighted = String(other === button); });
            showPreview(buildExtraPreview(shown, look, slot.title, { number: index + 1, total: members.length }));
          });
          return button;
        }));
        list.appendChild(grid);
      });
    });
    if (!list.childElementCount) list.appendChild(element('div', 'pixel-font-14 text-whiteDark', t('noExtras')));
    return list;
  }

  // Takes the place of the game's list and preview, which are only hidden.
  function showExtras(panel) {
    const content = panel.querySelector('[data-radix-scroll-area-viewport] > div');
    if (!content) return;
    const column = panel.nextElementSibling;
    if (resultNodes[0]?.parentElement !== content || !resultNodes[0].dataset.extras ||
        (column && resultNodes[1]?.parentElement !== column)) {
      removeResult();
      const view = element('div', '');
      view.style.contain = 'inline-size';
      view.dataset.extras = 'true';
      const holder = element('div', 'grid min-h-0 content-start');
      // Takes both rows of the game's column, so a long ability text scrolls inside the card.
      holder.style.cssText = 'grid-row:1 / -1;grid-template-rows:minmax(0,1fr);';
      view.appendChild(buildExtras((preview) => {
        holder.replaceChildren(preview);
        if (!column) content.parentElement.scrollTop = 0;
      }));
      content.appendChild(view);
      content.parentElement.scrollTop = 0;
      resultNodes.push(view);
      if (column) column.appendChild(holder);
      else view.prepend(holder);
      resultNodes.push(holder);
    }
    [...content.children, ...Array.from(panel.children).slice(1), ...(panel.nextElementSibling?.children || [])]
      .filter((node) => !resultNodes.includes(node)).forEach(hide);
  }

  // One wrapper at the end of the sidebar, shaped like the ones around the game's category buttons.
  function syncExtrasButton(dialog) {
    const sibling = dialog.querySelector('nav button[data-category="backpack"]');
    if (!sibling) return;
    let button = dialog.querySelector('[data-better-codex-extras]');
    if (!button) {
      button = element('button', sibling.className);
      button.type = 'button';
      button.setAttribute('data-better-codex-extras', '');
      const label = element('span', 'truncate', t('extras'));
      const base = window.BESTIARY_EXTENSION_BASE_URL;
      button.append(icon(base ? `${base}assets/icons/icon-32.png` : '/assets/icons/codex.png', ''), label);
      button.firstChild.className = 'pixelated shrink-0';
      button.addEventListener('click', () => {
        extrasOpen = true;
        sync();
      });
      const wrapper = element('div', 'grid gap-px');
      wrapper.setAttribute('data-better-codex-extras-row', '');
      wrapper.appendChild(button);
      button.appendChild(element('span', 'pixel-font-14 ml-auto shrink-0 text-whiteDark'));
      sibling.closest('nav').appendChild(wrapper);
    }
    const active = String(extrasOpen);
    if (button.dataset.active !== active) button.dataset.active = active;

    const count = button.lastElementChild;
    // Counted again only when your data changed or the button is new.
    const context = globalThis.state?.player?.getSnapshot?.()?.context;
    if (countedFor === context && count.textContent) return;
    countedFor = context;
    const cards = Object.values(getHiddenCards()).flat();
    const owned = cards.filter(ownsExtra).length;
    // Written only on change, as writing it is itself a DOM mutation.
    if (count.textContent !== `${owned}/${cards.length}`) count.textContent = `${owned}/${cards.length}`;
    count.style.color = cards.length && owned >= cards.length ? MAXED_COLOR : '';
  }

  // Any of the game's own sidebar buttons goes back to the game's view.
  function closeExtras(event) {
    const button = event.target.closest?.('nav button');
    if (!extrasOpen || !button || button.hasAttribute('data-better-codex-extras') ||
        !button.closest('[role="dialog"]')?.querySelector(`#${SEARCH_ID}`)) return;
    extrasOpen = false;
    sync();
  }

  function syncResult(dialog, query) {
    const panel = dialog.querySelector('.frame-pressed-1.surface-dark.relative.min-h-0');
    if (extrasOpen && panel) return showExtras(panel);
    const list = panel?.querySelector('[data-radix-scroll-area-viewport] > div > div');
    // Only when the game has no cards to show, and only where trading is offered.
    if (!query || !list || list.childElementCount || !dialog.querySelector(TRADES_BUTTON)) return removeResult();
    const key = query.toLowerCase();
    const known = players.get(key);
    if (known && key !== shownKey && Date.now() - known.at > PLAYER_TTL) {
      players.delete(key);
      // Or scheduleLookup would take it for the lookup already made.
      lookupQuery = '';
    }
    if (!players.has(key)) {
      scheduleLookup(query);
      if (pendingLookup !== query) return removeResult();
      return showSearching(panel, query);
    }
    const { player } = players.get(key);
    if (!player || isOwnName(player.name)) return removeResult();
    showResult(dialog, panel, player);
    shownKey = key;
  }

  // =======================
  // Who has the selected card
  // =======================

  function removeSpares() {
    clearTimeout(sparesTimer);
    ['position', 'max-height', 'overflow-y'].forEach((name) => sparesNode?.parentElement?.style.removeProperty(name));
    sparesNode?.remove();
    sparesNode = null;
  }

  async function fetchSpares(card) {
    const input = encodeURIComponent(JSON.stringify({ 0: { json: { card } } }));
    const response = await fetch(`/api/trpc/trade.findSpares?batch=1&input=${input}`, {
      headers: { 'content-type': 'application/json', 'x-game-version': String(globalThis.state?.GAME_VERSION ?? '1') }
    });
    if (!response.ok) throw new Error(`findSpares HTTP ${response.status}`);
    return (await response.json())?.[0]?.result?.data?.json || [];
  }

  // Cached for 30s, like the game's own search.
  function getSpares(key, card) {
    const cached = spares.get(key);
    if (cached && Date.now() - cached.at < 30000) return cached.request;
    const request = fetchSpares(card);
    spares.set(key, { at: Date.now(), request });
    request.catch(() => spares.delete(key));
    return request;
  }

  function buildSpareRow(dialog, holder, card) {
    const row = element('div', 'frame-1 surface-regular flex items-center gap-1.5 p-1');
    const canvas = sizedCanvas();
    canvas.classList.add('shrink-0');
    drawOutfit(canvas, holder.look);
    const text = element('div', 'grid min-w-0');
    text.append(
      element('span', 'truncate text-whiteBrightest', holder.name),
      element('span', 'pixel-font-14 text-whiteDark', t('youNeed').replace('{count}', holder.sparesPlayerMisses))
    );
    const button = element('button', dialog.querySelector(TRADES_BUTTON).className, t('trade'));
    button.classList.remove('relative');
    button.classList.add('ml-auto');
    paintButton(button, 'blue');
    button.type = 'button';
    button.addEventListener('click', () => openTradeWith(holder, card));
    row.append(canvas, text, button);
    return row;
  }

  // =======================
  // Tracked cards: a toast when someone has a spare
  // =======================

  // Cards you now own are dropped on every read, as they no longer have a toggle to untick.
  function readTracked() {
    if (!trackedCache) {
      try {
        trackedCache = JSON.parse(localStorage.getItem(TRACKED_KEY)) || {};
      } catch (error) {
        console.warn('[Better Codex] Tracked cards unreadable:', error);
        return {};
      }
    }
    const tracked = trackedCache;
    const owned = Object.keys(tracked).filter((key) => ownsCard(...key.split(':').slice(1)));
    if (owned.length) {
      owned.forEach((key) => {
        console.log('[Better Codex] You now own', tracked[key].name, '- no longer tracked');
        delete tracked[key];
      });
      writeTracked(tracked);
    }
    return tracked;
  }

  function writeTracked(tracked) {
    trackedCache = tracked;
    localStorage.setItem(TRACKED_KEY, JSON.stringify(tracked));
  }

  // Another tab changed storage (a null key means it was cleared).
  function handleStorage(event) {
    if (event.key === TRACKED_KEY || event.key === null) trackedCache = null;
  }

  // Copies you really have: Outfiter's "unlock all" writes outfits and mounts you lack into the Codex.
  function myCopies(category, id) {
    if (window.Outfiter?.isAdded?.(category, id)) return 0;
    return globalThis.state?.player?.getSnapshot?.()?.context?.codex?.[category]?.[id] || 0;
  }

  function ownsCard(category, id) {
    return myCopies(category, id) > 0;
  }

  // One request per tracked card, spaced out. A holder is announced once, and again only if their
  // spare was gone in between.
  async function checkTracked() {
    if (checkingTracked) return;
    checkingTracked = true;
    try {
      const done = new Set();
      for (;;) {
        // Read each round, so a card ticked during a long run is checked in it.
        const next = Object.entries(readTracked()).find(([key]) => !done.has(key));
        if (!next) break;
        const [key, { card, name }] = next;
        done.add(key);
        const pause = lastTrackedRequest + TRACK_GAP - Date.now();
        if (pause > 0) await new Promise((resolve) => setTimeout(resolve, pause));
        if (disposed) return;
        lastTrackedRequest = Date.now();
        let holders;
        try {
          holders = await fetchSpares(card);
        } catch (error) {
          console.warn('[Better Codex] Tracked card check failed:', key, error);
          continue;
        }
        if (disposed) return;
        // Read again, as the card may have been unticked or received while waiting.
        const tracked = readTracked();
        const entry = tracked[key];
        if (!entry) continue;
        const fresh = holders.filter((holder) => !entry.seen.includes(holder.id));
        entry.seen = holders.map((holder) => holder.id);
        if (fresh.length) {
          window.BAToast?.show({
            mod: MOD_NAME,
            type: 'success',
            duration: TOAST_MS,
            message: t('available').replace('{card}', name).replace('{players}', fresh.slice(0, 3).map((holder) => holder.name).join(', '))
          });
        }
        writeTracked(tracked);
      }
    } finally {
      checkingTracked = false;
      const dialog = document.getElementById(SEARCH_ID)?.closest('[role="dialog"]');
      if (dialog && !disposed) markTracked(dialog);
    }
  }

  function scheduleTracked(delay) {
    clearTimeout(trackTimer);
    trackTimer = setTimeout(async () => {
      await checkOffers();
      await checkTracked();
      if (!disposed) scheduleTracked(TRACK_INTERVAL);
    }, delay);
  }

  function checkWhenLoaded(secondsLeft) {
    if (globalThis.state?.player?.getSnapshot?.()?.context?.loaded || secondsLeft <= 0) {
      console.log('[Better Codex] First check,', secondsLeft > 0 ? 'game data loaded' : 'game data still not loaded');
      return scheduleTracked(0);
    }
    trackTimer = setTimeout(() => checkWhenLoaded(secondsLeft - 1), 1000);
  }

  // The game's exclamation mark (4x9) on the tracked cards of its grid: grey while
  // watching, gold once the last check found a spare.
  function removeMark(mark) {
    mark.parentElement.style.removeProperty('position');
    mark.remove();
  }

  // Appended after the game's own children, and only changed when it differs, as this runs on every
  // DOM change.
  function markTracked(dialog) {
    const tracked = readTracked();
    dialog.querySelectorAll('[data-entry-key^="codex:"]').forEach((entry) => {
      const mark = entry.querySelector(':scope > [data-better-codex-mark]');
      const watched = tracked[entry.dataset.entryKey];
      if (!watched) {
        if (mark) removeMark(mark);
        return;
      }
      const filter = watched.seen.length ? '' : 'grayscale(1) brightness(1.1)';
      if (mark) {
        if (mark.style.filter !== filter) mark.style.filter = filter;
        return;
      }
      const badge = element('img', 'pixelated pointer-events-none absolute');
      badge.src = '/assets/icons/exclamationmark.png';
      badge.alt = '';
      badge.width = 4;
      badge.height = 9;
      badge.setAttribute('data-better-codex-mark', '');
      badge.style.cssText = 'top:2px;left:3px;z-index:3;';
      badge.style.filter = filter;
      entry.style.position = 'relative';
      entry.appendChild(badge);
    });
  }

  function buildTrackToggle(key, card, name) {
    const dialog = document.getElementById(SEARCH_ID).closest('[role="dialog"]');
    const button = element('button', dialog.querySelector(TRADES_BUTTON).className);
    button.classList.remove('relative');
    button.type = 'button';
    button.title = t('trackHint');
    const mark = icon('/assets/icons/exclamationmark.png', '');
    mark.width = 4;
    mark.height = 9;
    // The shared icon class lifts it 2px, which leaves this tall, thin mark above the button's centre.
    mark.classList.remove('-translate-y-0.5');
    button.append(mark, t('track'));
    const paint = () => {
      const on = !!readTracked()[key];
      paintButton(button, on ? 'green' : null);
      button.setAttribute('aria-pressed', String(on));
      mark.style.filter = on ? '' : 'grayscale(1)';
    };
    button.addEventListener('click', () => {
      const tracked = readTracked();
      const on = !tracked[key];
      if (on) tracked[key] = { card, name, seen: [] };
      else delete tracked[key];
      writeTracked(tracked);
      paint();
      markTracked(dialog);
      // Looked up at once, so the mark turns gold without waiting for the next round.
      if (on) checkTracked();
    });
    paint();
    return button;
  }

  // Where the selected card's holders go: the preview column, or on narrow layouts, which have none,
  // the popup a tapped card opens. null unless the game offers its own card search there, which it
  // only does for cards you can trade for.
  function spareSpot(dialog) {
    const column = dialog.querySelector('.frame-pressed-1.surface-dark.relative.min-h-0')?.nextElementSibling;
    if (column) {
      const box = column.children[1];
      const link = box?.querySelector(':scope > .action-link');
      return link ? { preview: column.firstElementChild, box, link } : null;
    }
    // The popup holds the card and then, as its search, a button.
    for (const popup of document.querySelectorAll('[role="dialog"]')) {
      const box = popup.querySelector(':scope > div > div.justify-items-center');
      if (box?.children[1]?.tagName === 'BUTTON') return { preview: box.firstElementChild, box, link: null };
    }
    return null;
  }

  // Below the game's own search for the card.
  function syncSpares(dialog) {
    const spot = spareSpot(dialog);
    const entry = dialog.querySelector('[data-entry-key^="codex:"][data-highlighted="true"]');
    if (entry) selected = { key: entry.dataset.entryKey, name: entry.firstElementChild?.title };
    const [, category, id] = selected?.key.split(':') || [];
    const field = CARD_ID_FIELDS[category];
    const previewName = spot?.preview?.querySelector('.widget-top span')?.textContent;
    if (!spot || !field || !dialog.querySelector(TRADES_BUTTON) ||
        (selected.name && previewName !== selected.name)) {
      return removeSpares();
    }
    const { box, link } = spot;
    const key = selected.key;
    if (sparesNode?.parentElement === box && sparesNode.dataset.card === key) return;

    removeSpares();
    const wrapper = element('div', 'grid content-start gap-1');
    wrapper.dataset.card = key;
    const node = element('div', 'grid content-start gap-1');
    node.style.overflowY = 'auto';
    node.style.maxHeight = '170px';
    node.appendChild(element('span', 'pixel-font-14 text-right text-whiteDark', t('searching')));
    const card = { category, [field]: Number(id) };
    // Only a card you are missing can be tracked.
    if (!ownsCard(category, id)) wrapper.appendChild(buildTrackToggle(key, card, previewName || selected.name || key));
    wrapper.appendChild(node);
    sparesNode = wrapper;
    box.appendChild(wrapper);
    if (!link) {
      console.log('[Better Codex] Card search added to the card popup:', key);
      wrapper.style.width = '232px';
      // So the popup scrolls on a short screen instead of running off it.
      box.style.maxHeight = 'calc(100dvh - 16px)';
      box.style.overflowY = 'auto';
    }
    // Laid on the left of the game's "Search for this card" row. It cannot be put inside that row, as
    // the row is React's.
    const toggle = wrapper.querySelector(':scope > button');
    if (toggle && link) {
      box.style.position = 'relative';
      toggle.style.cssText = 'position:absolute;left:0;';
      toggle.style.top = `${link.offsetTop + (link.offsetHeight - toggle.offsetHeight) / 2}px`;
    }
    // A short pause, so stepping through cards doesn't send a request for each.
    sparesTimer = setTimeout(async () => {
      try {
        const holders = await getSpares(key, card);
        if (sparesNode !== wrapper) return;
        console.log('[Better Codex] Players with', key, ':', holders.length);
        node.replaceChildren(...(holders.length
          ? holders.map((holder) => buildSpareRow(dialog, holder, card))
          : [element('span', 'pixel-font-14 text-right text-whiteDark', t('noPlayers'))]));
      } catch (error) {
        console.warn('[Better Codex] Card search failed:', error);
        if (sparesNode === wrapper) node.replaceChildren(element('span', 'pixel-font-14 text-right text-whiteDark', t('searchFailed')));
      }
    }, 400);
  }

  // =======================
  // Auto-accept incoming trade offers
  // =======================

  function readAuto() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(AUTO_KEY)) || {};
    } catch (error) {
      console.warn('[Better Codex] Auto-accept settings unreadable:', error);
    }
    return { ...AUTO_DEFAULTS, ...saved };
  }

  function writeAuto(changes) {
    localStorage.setItem(AUTO_KEY, JSON.stringify({ ...readAuto(), ...changes }));
  }

  // 'foil', 'plain' or 'unknown'. Two sources are read, the card catalog and the game's own card
  // tables, and a foil in either one counts. Anything that cannot be confirmed is 'unknown'.
  function foilState(category, id, matches, rows) {
    if (!matches.length || matches.some((entry) => typeof entry.card.foil !== 'boolean')) return 'unknown';
    if (matches.some((entry) => entry.card.foil || entry.card.metadata?.foil)) return 'foil';
    if (category === 'monster') {
      try {
        if (globalThis.state?.utils?.getMonster?.(id)?.metadata?.foil) return 'foil';
      } catch (_) {
        // Not every creature card is in this table; the catalog answered above.
      }
    } else {
      const table = getGameLookups().foils?.[category];
      if (!table?.size) return 'unknown';
      if (table.has(id)) return 'foil';
    }
    // Every category has foil cards, so one without any means its flags are no longer being read.
    return rows[category].some((entry) => entry.card?.foil === true) ? 'plain' : 'unknown';
  }

  // The offer's cards on one side with their catalog entries, or the reason they cannot be trusted.
  // Anything not recognised is refused, so a change in the game's data never lets a foil through.
  function resolveSide(items, rows, mayHoldFoil) {
    if (!Array.isArray(items) || !items.length) return { reason: 'unknownCard' };
    const cards = new Map();
    let holdsFoil = false;
    for (const item of items) {
      const card = item?.card;
      const field = CARD_ID_FIELDS[card?.category];
      if (item?.type !== 'card' || !field || !Number.isInteger(card[field]) || !Number.isInteger(item.amount) || item.amount < 1 ||
          Object.keys(card).some((key) => key !== 'category' && key !== field)) {
        return { reason: 'unknownCard' };
      }
      // Every entry of the card is looked at, as an id can be listed more than once.
      const matches = rows[card.category]?.filter((entry) => entry.card?.[field] === card[field]) || [];
      const foil = foilState(card.category, card[field], matches, rows);
      if (foil === 'foil' && !mayHoldFoil) return { reason: 'foil' };
      const row = matches[0];
      if (foil === 'unknown' || !Number.isFinite(row.card.rarity)) return { reason: 'unknownCard' };
      if (foil === 'foil') holdsFoil = true;
      if (row.codexAvailability !== 'pack') return { reason: 'unknownCard' };
      const key = `${card.category}:${card[field]}`;
      const known = cards.get(key);
      if (known) known.amount += item.amount;
      else {
        const name = row.card.metadata?.name || getGameLookups().names[card.category]?.get(card[field]) || key;
        cards.set(key, { category: card.category, id: card[field], amount: item.amount, rarity: row.card.rarity, name });
      }
    }
    return { cards: [...cards.values()], holdsFoil };
  }

  // Why an offer is not accepted (a string key), or null when it passes every rule. "give" is your side.
  function judgeOffer(offer, settings, rows, codex) {
    // Without a single foil in the catalog, its foil flags cannot be relied on.
    const catalogHasFoils = rows && Object.values(rows).some((list) => list.some((row) => row.card?.foil === true));
    if (!catalogHasFoils || !codex) return { reason: 'noData' };
    if (offer?.id === undefined || offer.revision === undefined || !offer.partner?.name || offer.proposedByPlayer) {
      return { reason: 'unknownCard' };
    }
    // You never give a foil; receiving one is allowed. No setting changes this.
    const give = resolveSide(offer.give, rows, false);
    const get = resolveSide(offer.get, rows, true);
    const reason = give.reason || get.reason;
    if (reason) return { reason };
    const sides = { give: give.cards, get: get.cards, holdsFoil: get.holdsFoil };
    const total = (cards) => cards.reduce((sum, card) => sum + card.amount, 0);
    const owned = (card) => codex[card.category]?.[card.id] || 0;
    if (total(give.cards) !== total(get.cards)) return { reason: 'uneven', ...sides };
    if (give.cards.some((card) => owned(card) < card.amount)) return { reason: 'notOwned', ...sides };
    // The game only offers spares in a trade; checked again as a mistake cannot be undone.
    if (give.cards.some((card) => owned(card) - card.amount < 1)) return { reason: 'lastCopy', ...sides };
    if (settings.missingOnly && get.cards.some((card) => owned(card) > 0 || card.amount > 1)) return { reason: 'alreadyOwned', ...sides };
    // Pair by pair, lowest with lowest; the sides have the same number of cards here.
    const rarities = (cards) => cards.flatMap((card) => Array(card.amount).fill(card.rarity)).sort((a, b) => a - b);
    const received = rarities(get.cards);
    if (settings.sameRarity && rarities(give.cards).some((rarity, index) => received[index] < rarity)) {
      return { reason: 'lowerRarity', ...sides };
    }
    return { reason: null, ...sides };
  }

  function tradeHeaders() {
    return { 'content-type': 'application/json', 'x-game-version': String(globalThis.state?.GAME_VERSION ?? '1') };
  }

  async function fetchOffers(afterTradeId) {
    const input = encodeURIComponent(JSON.stringify({ 0: { json: { afterTradeId } } }));
    const response = await fetch(`/api/trpc/trade.sync?batch=1&input=${input}`, { headers: tradeHeaders() });
    if (!response.ok) throw new Error(`trade.sync HTTP ${response.status}`);
    const data = (await response.json())?.[0]?.result?.data?.json;
    if (!Array.isArray(data?.received) || !Array.isArray(data.trades)) throw new Error('trade.sync answered in an unknown shape');
    return data;
  }

  // The server refuses an offer that changed since, as it is accepted by revision.
  async function acceptOffer(offer) {
    const response = await fetch('/api/trpc/trade.acceptOffer?batch=1', {
      method: 'POST',
      headers: tradeHeaders(),
      body: JSON.stringify({ 0: { json: { offerId: offer.id, revision: offer.revision } } })
    });
    if (!response.ok) throw new Error(`trade.acceptOffer HTTP ${response.status}`);
  }

  async function declineOffer(offer) {
    const response = await fetch('/api/trpc/trade.removeOffer?batch=1', {
      method: 'POST',
      headers: tradeHeaders(),
      body: JSON.stringify({ 0: { json: { offerId: offer.id } } })
    });
    if (!response.ok) throw new Error(`trade.removeOffer HTTP ${response.status}`);
  }

  // The game's query cache, held by a provider above every element it renders.
  function findQueryClient() {
    for (const element of document.querySelectorAll('header, main, button')) {
      let fiber = element[Object.keys(element).find((key) => key.startsWith('__reactFiber$'))];
      for (; fiber; fiber = fiber.return) {
        const client = fiber.memoizedProps?.client;
        if (typeof client?.invalidateQueries === 'function') return client;
      }
    }
    return null;
  }

  // Makes the game fetch its trades again: its offer list updates, and a finished trade reaches your
  // Codex at once instead of at the game's next five-minute sync.
  function refreshGameTrades() {
    try {
      const client = findQueryClient();
      if (!client) return console.warn('[Better Codex] Could not refresh the game\'s trades: no query client');
      client.invalidateQueries({ queryKey: [['trade', 'sync']] });
      console.log('[Better Codex] Asked the game to refresh its trades');
    } catch (error) {
      console.warn('[Better Codex] Could not refresh the game\'s trades:', error);
    }
  }

  function readAutoTrades() {
    try {
      const ids = JSON.parse(localStorage.getItem(AUTO_TRADES_KEY));
      return Array.isArray(ids) ? ids : [];
    } catch (error) {
      console.warn('[Better Codex] Auto-trade list unreadable:', error);
      return [];
    }
  }

  const sideSignature = (items) => (items || []).map((item) =>
    `${item.card?.category}:${item.card?.[CARD_ID_FIELDS[item.card?.category]]}x${item.amount}`).sort().join(',');

  // The accepted offer comes back from the sync as a finished trade; its id is what History is keyed
  // by. Run before the game applies it, while it is still newer than lastTradeId.
  async function recordAutoTrade(offer, afterTradeId) {
    try {
      const { trades } = await fetchOffers(afterTradeId);
      const made = trades.filter((trade) => sideSignature(trade.give) === sideSignature(offer.give) &&
        sideSignature(trade.get) === sideSignature(offer.get));
      if (!made.length) return console.warn('[Better Codex] Accepted trade not found in the sync, so not tagged');
      const ids = [...new Set([...readAutoTrades(), ...made.map((trade) => String(trade.id))])];
      localStorage.setItem(AUTO_TRADES_KEY, JSON.stringify(ids.slice(-AUTO_TRADES_KEPT)));
      console.log('[Better Codex] Auto trade recorded:', made.map((trade) => trade.id).join(', '));
    } catch (error) {
      console.warn('[Better Codex] Could not record the auto trade:', error);
    }
  }

  // A History entry's trade id is the React key of the component that draws it.
  function historyTradeId(group) {
    let fiber = group[Object.keys(group).find((key) => key.startsWith('__reactFiber$'))];
    for (; fiber; fiber = fiber.return) {
      if (fiber.memoizedProps?.partnerName) return fiber.key;
    }
    return null;
  }

  // An "Auto" tag appended to the header of the History entries auto-accept made.
  function markAutoTrades() {
    const groups = document.querySelectorAll('[role="dialog"] [role="tabpanel"][id$="-content-history"] [role="group"][aria-label]');
    if (!groups.length) return;
    const ids = new Set(readAutoTrades());
    groups.forEach((group) => {
      const header = group.querySelector(':scope > .widget-top');
      if (!header) return;
      const tag = header.querySelector(':scope > [data-better-codex-auto-tag]');
      const auto = ids.has(historyTradeId(group));
      if (!auto) return tag?.remove();
      if (tag) return;
      const node = element('span', 'ml-1', t('autoTag'));
      node.setAttribute('data-better-codex-auto-tag', '');
      node.style.color = '#ffd24a';
      header.appendChild(node);
    });
  }

  function describe(offer, verdict) {
    const names = (cards) => (cards || []).map((card) => (card.amount > 1 ? `${card.amount}x ${card.name}` : card.name)).join(', ');
    return t('offerText').replace('{name}', offer.partner?.name || '?')
      .replace('{give}', names(verdict.give) || '?').replace('{get}', names(verdict.get) || '?');
  }

  // Only one offer toast is ever on screen: a new one replaces the last.
  function tradeToast(type, message) {
    offerToast?.remove();
    offerToast = window.BAToast?.show({ mod: MOD_NAME, type, duration: TOAST_MS, message });
  }

  const offerKey = (offer) => `${offer.id}:${offer.revision}`;

  // One toast per check, the most important: an accepted trade, else declined offers, else offers
  // waiting for you. An offer is announced once.
  function announceOffers(received, done) {
    if (done) return tradeToast(done.type, done.message);
    const fresh = received.filter((offer) => !offer.proposedByPlayer && !announced.has(offerKey(offer)));
    if (!fresh.length) return console.log('[Better Codex] No new offer to announce');
    fresh.forEach((offer) => announced.add(offerKey(offer)));
    const names = [...new Set(fresh.map((offer) => offer.partner?.name || '?'))].slice(0, 3).join(', ');
    tradeToast('info', t('pendingToast').replace('{count}', fresh.length).replace('{players}', names));
  }

  // Tells you of waiting offers, and auto-accepts when switched on: at most one per check, and none
  // while a finished trade has not reached your Codex yet, so the last-copy check never counts a card
  // you no longer have.
  async function checkOffers() {
    if (checkingOffers) return;
    checkingOffers = true;
    try {
      // Skipped when another tab holds the lock, as that tab is handling the offers.
      if (!navigator.locks) await handleOffers();
      else await navigator.locks.request(OFFERS_LOCK, { ifAvailable: true }, (lock) => lock && handleOffers());
    } finally {
      checkingOffers = false;
    }
  }

  async function handleOffers() {
    try {
      const context = globalThis.state?.player?.getSnapshot?.()?.context;
      if (!Number.isInteger(context?.lastTradeId)) {
        console.warn('[Better Codex] Offer check skipped: no player data');
        return;
      }
      const { received, trades } = await fetchOffers(context.lastTradeId);
      if (disposed) return;
      console.log('[Better Codex] Offer check:', received.length, 'received,', trades.length, 'trades not applied yet');
      let done = null;
      const declined = [];
      const judged = readAuto().accept && !trades.length ? received : [];
      for (const offer of judged) {
        // Read each time: it may have been switched off while waiting.
        const settings = readAuto();
        if (!settings.accept) break;
        const verdict = judgeOffer(offer, settings, getCatalogRows(), globalThis.state.player.getSnapshot().context.codex);
        const text = describe(offer, verdict);
        const message = (key) => t(key).replace('{offer}', text);
        console.log('[Better Codex] Offer', offer.id, verdict.reason || 'passes', '-', text);
        if (verdict.reason) {
          if (settings.decline && DECLINE_REASONS.has(verdict.reason) && !verdict.holdsFoil) {
            try {
              await declineOffer(offer);
              declined.push(offer);
            } catch (error) {
              console.warn('[Better Codex] Declining offer', offer.id, 'failed:', error);
            }
          }
          continue;
        }
        if (failedAccepts.has(offerKey(offer))) continue;
        try {
          await acceptOffer(offer);
          await recordAutoTrade(offer, context.lastTradeId);
          done = { type: 'success', message: message('acceptedToast') };
        } catch (error) {
          console.warn('[Better Codex] Accepting offer', offer.id, 'failed:', error);
          failedAccepts.add(offerKey(offer));
          done = { type: 'error', message: message('failedToast') };
        }
        break;
      }
      if (disposed) return;
      // done is set by an accept, tried or successful.
      if (done || declined.length) refreshGameTrades();
      if (!done && declined.length) {
        const names = [...new Set(declined.map((offer) => offer.partner.name))].slice(0, 3).join(', ');
        done = { type: 'warning', message: t('declinedToast').replace('{count}', declined.length).replace('{players}', names) };
      }
      announceOffers(received.filter((offer) => !declined.includes(offer)), done);
    } catch (error) {
      console.warn('[Better Codex] Offer check failed:', error);
    }
  }

  function buildAutoPanel(buttonClass) {
    const panel = element('div', 'pixel-font-14 frame-pressed-1 surface-dark mt-2 grid gap-1 p-2 text-whiteRegular');
    panel.style.cssText = 'display:none;max-height:220px;overflow-y:auto;';
    const settings = readAuto();
    const changed = (changes) => {
      writeAuto(changes);
      announced.clear();
      // Changing a setting also tries refused offers again.
      failedAccepts.clear();
    };
    const checkbox = (key) => {
      const label = element('label', 'flex items-center gap-1');
      const box = element('input', 'focus-style-visible');
      box.type = 'checkbox';
      box.checked = !!settings[key];
      box.addEventListener('change', () => {
        changed({ [key]: box.checked });
      });
      label.append(box, t(key));
      return label;
    };
    // Turning it on takes a second, separate click, asked for in place of the button.
    const toggle = element('div', 'grid gap-1');
    const action = (key, color, onClick) => {
      const button = paintButton(element('button', buttonClass, t(key)), color);
      button.type = 'button';
      button.addEventListener('click', onClick);
      return button;
    };
    const set = (accept) => {
      changed({ accept });
      paintAutoButton(autoNodes[0]);
      showToggle();
      const codex = document.getElementById(SEARCH_ID)?.closest('[role="dialog"]');
      if (codex) markTradesButton(codex);
      // Offers already waiting are judged at once, not at the next scheduled check.
      if (accept) checkOffers();
    };
    const showToggle = () => {
      if (readAuto().accept) return toggle.replaceChildren(action('stopAccept', 'red', () => set(false)));
      toggle.replaceChildren(action('accept', 'blue', () => {
        const buttons = element('div', 'flex justify-center gap-2');
        buttons.append(action('confirmYes', 'green', () => set(true)), action('confirmNo', 'red', showToggle));
        toggle.replaceChildren(buildConfirmText(), buttons);
      }));
    };
    showToggle();
    // Styled as Mod Settings styles its warnings, and first so it is seen before anything is switched on.
    const warning = element('div', '', `⚠️ ${t('foilRule')} ⚠️`);
    warning.style.cssText = 'color:#ffc107;background:rgba(255,193,7,0.1);border:1px solid rgba(255,193,7,0.3);padding:6px;font-weight:bold;text-align:center;';
    panel.append(warning, toggle, element('div', 'separator my-0'),
      checkbox('missingOnly'), checkbox('sameRarity'), checkbox('decline'));
    return panel;
  }

  function removeAutoUi() {
    autoNodes.forEach((node) => node.remove());
    autoNodes = [];
  }

  // Gives a copied game button one of the game's own colours, or its plain look without one.
  function paintButton(button, color) {
    const classes = (name) => [`frame-1-${name}`, `active:frame-pressed-1-${name}`, `surface-${name}`];
    button.classList.remove('frame-1', 'active:frame-pressed-1', 'surface-regular', ...['red', 'green', 'blue'].flatMap(classes));
    button.classList.add(...(color ? classes(color) : ['frame-1', 'active:frame-pressed-1', 'surface-regular']));
    return button;
  }

  // The confirmation text, with its *marked* words underlined: gold, and red for the last one, which
  // is the warning that there is no way back. The marks are in the translations.
  function buildConfirmText() {
    const parts = t('confirmAccept').split('*');
    const text = element('div', 'text-center text-whiteBrightest');
    parts.forEach((part, index) => {
      if (index % 2 === 0) return text.append(part);
      const word = element('span', '', part);
      word.style.cssText = `text-decoration:underline;color:${index === parts.length - 2 ? '#ff6b6b' : '#ffc107'};`;
      text.appendChild(word);
    });
    return text;
  }

  // Green while auto-accept is on, red while off.
  function paintAutoButton(button) {
    if (button) paintButton(button, readAuto().accept ? 'green' : 'red');
  }

  // While auto-accept is on, the Codex's Trades button cycles through rainbow colours, as Autoseller
  // marks itself active. Only an attribute is set, as the button and its text are React's.
  const RAINBOW_STYLE_ID = 'better-codex-rainbow';

  function markTradesButton(dialog) {
    const button = dialog.querySelector(TRADES_BUTTON);
    if (!button) return;
    const on = readAuto().accept;
    if (button.hasAttribute('data-better-codex-on') === on) return;
    if (on && !document.getElementById(RAINBOW_STYLE_ID)) {
      const style = element('style', '');
      style.id = RAINBOW_STYLE_ID;
      const colors = ['#ff5555', '#ff9f43', '#ffe066', '#55e06a', '#55b8ff', '#c07bff', '#ff5555'];
      style.textContent = `@keyframes better-codex-rainbow { ${colors.map((color, index) =>
        `${Math.round((index / (colors.length - 1)) * 100)}% { color: ${color}; }`).join(' ')} }
        button[data-better-codex-on] { animation: better-codex-rainbow 3s linear infinite; }
        @media (prefers-reduced-motion: reduce) { button[data-better-codex-on] { animation: none; color: #ffe066; } }`;
      document.head.appendChild(style);
    }
    button.toggleAttribute('data-better-codex-on', on);
  }

  // A button in the footer of the game's Trades window, and its panel below. Both are appended after
  // the game's own children.
  function syncAutoAccept() {
    const body = document.querySelector('[role="dialog"] [id$="-trigger-offers"]')?.closest('.widget-bottom');
    const footer = body?.querySelector(':scope > .flex.justify-end');
    const close = footer?.querySelector(':scope > button:not([data-better-codex-auto])');
    if (!close) return;
    if (autoNodes[0]?.parentElement === footer) return;
    removeAutoUi();
    const button = element('button', close.className, t('autoAccept'));
    button.type = 'button';
    button.setAttribute('data-better-codex-auto', '');
    button.style.cssText = 'order:-1;margin-right:auto;';
    const panel = buildAutoPanel(close.className);
    button.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? '' : 'none';
    });
    autoNodes = [button, panel];
    paintAutoButton(button);
    footer.appendChild(button);
    body.appendChild(panel);
  }

  // The one checkbox of the game's "Trade with" window, which has "You" and partner tabs.
  function onlyMissingBox() {
    return document.querySelector('[role="dialog"] [id$="-trigger-give"]')
      ?.closest('[role="dialog"]')?.querySelector('label > button[role="checkbox"]') || null;
  }

  // Sets each newly shown checkbox as it was left, by clicking it so the game applies its own filter.
  function restoreOnlyMissing() {
    const box = onlyMissingBox();
    if (!box || box.hasAttribute('data-better-codex-restored')) return;
    box.setAttribute('data-better-codex-restored', '');
    const saved = localStorage.getItem(ONLY_MISSING_KEY);
    if (saved !== null && (saved === '1') !== (box.getAttribute('aria-checked') === 'true')) box.click();
  }

  // Read after the click, once the game has updated the box. Clicking its text clicks it too.
  function saveOnlyMissing(event) {
    const box = onlyMissingBox();
    if (!box || !box.parentElement.contains(event.target)) return;
    setTimeout(() => {
      if (!disposed && box.isConnected) localStorage.setItem(ONLY_MISSING_KEY, box.getAttribute('aria-checked') === 'true' ? '1' : '0');
    }, 0);
  }

  // Sidebar counts of categories and groups, yours or a searched player's.
  const SIDEBAR_COUNTS = 'nav button[data-category] > span.ml-auto, nav button[data-section] > span.ml-auto';

  function colorComplete(dialog) {
    dialog.querySelectorAll(SIDEBAR_COUNTS).forEach((count) => {
      const [owned, total] = count.textContent.split('/').map(Number);
      const color = total > 0 && owned >= total ? MAXED_COLOR : '';
      count.style.color = color;
    });
  }

  function handleInput(event) {
    if (event.target.id !== SEARCH_ID) return;
    extrasOpen = false;
    sync();
  }

  // Lets go of what was added to a window that is gone.
  function releaseCodex() {
    removeResult();
    removeSpares();
    titleNode = null;
    selected = null;
    extrasOpen = false;
    hiddenCache = null;
  }

  function sync() {
    // This runs on every DOM change, and everything below lives in a window.
    if (!document.querySelector('[role="dialog"]')) {
      releaseCodex();
      removeAutoUi();
      return;
    }
    syncAutoAccept();
    markAutoTrades();
    restoreOnlyMissing();
    const search = document.getElementById(SEARCH_ID);
    const dialog = search?.closest('[role="dialog"]');
    if (!dialog) return releaseCodex();
    applyTitle(dialog);
    syncExtrasButton(dialog);
    syncResult(dialog, search.value.trim());
    syncSpares(dialog);
    colorComplete(dialog);
    markTracked(dialog);
    markTradesButton(dialog);
  }

  let observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true, attributeFilter: ['data-highlighted', 'data-entry-key'] });
  document.addEventListener('input', handleInput);
  document.addEventListener('click', saveOnlyMissing, true);
  document.addEventListener('click', closeExtras, true);
  window.addEventListener('storage', handleStorage);
  sync();
  checkWhenLoaded(LOAD_WAIT_SECONDS);

  exports = {
    cleanup: () => {
      disposed = true;
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      document.removeEventListener('input', handleInput);
      document.removeEventListener('click', saveOnlyMissing, true);
      document.removeEventListener('click', closeExtras, true);
      document.querySelectorAll('[data-better-codex-extras-row]').forEach((row) => row.remove());
      extrasOpen = false;
      hiddenCache = null;
      progressCache = null;
      countedFor = null;
      window.removeEventListener('storage', handleStorage);
      trackedCache = null;
      failedAccepts.clear();
      gameModules.clear();
      wordCache.clear();
      webpackRequire = null;
      onlyMissingBox()?.removeAttribute('data-better-codex-restored');
      clearTimeout(lookupTimer);
      clearTimeout(trackTimer);
      pendingLookup = '';
      players.clear();
      removeResult();
      removeSpares();
      removeAutoUi();
      announced.clear();
      offerToast = null;
      spares.clear();
      document.getElementById(SEARCH_ID)?.closest('[role="dialog"]')
        ?.querySelectorAll(SIDEBAR_COUNTS).forEach((count) => count.style.removeProperty('color'));
      document.querySelectorAll('[data-better-codex-mark]').forEach(removeMark);
      document.querySelectorAll('[data-better-codex-auto-tag]').forEach((tag) => tag.remove());
      document.querySelectorAll('[data-better-codex-on]').forEach((button) => button.removeAttribute('data-better-codex-on'));
      document.getElementById(RAINBOW_STYLE_ID)?.remove();
      restoreTitle();
      titleNode = null;
      window.BAToast?.clearMod(MOD_NAME);
      window.__betterCodexLoaded = false;
    }
  };
})();
