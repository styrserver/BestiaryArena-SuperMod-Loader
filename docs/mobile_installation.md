# Mobile Installation Guide

This guide explains how to install BestiaryArena SuperMod Loader on mobile browsers:

- Android with Firefox
- iPhone/iPad with Orion Browser

## Android (Firefox)

1. Install Firefox for Android from Google Play.
2. Open Firefox and sign in with a Mozilla account (recommended so addon settings sync).
3. Open this addon page:
   - https://addons.mozilla.org/en-US/firefox/addon/bestiaryarena-supermod-loader/
4. Tap **Add to Firefox** and confirm permissions.
5. Open https://bestiaryarena.com/ and allow the page to fully reload.
6. Open Firefox's menu, then open the extension entry for BestiaryArena SuperMod Loader to verify it is enabled.

Notes:

- If mods do not appear right away, refresh Bestiary Arena once.
- If you use strict tracking protection, keep `bestiaryarena.com` allowed for normal extension behavior.

## iOS (Orion Browser)

1. Install Orion Browser from the App Store.
2. In Orion, open **Settings -> Extensions** and enable support for Firefox extensions.
3. Open this addon page in Orion:
   - https://addons.mozilla.org/en-US/firefox/addon/bestiaryarena-supermod-loader/
4. Tap **Add to Firefox** (Orion uses Firefox extension compatibility mode) and approve installation.
5. Confirm the extension is enabled in **Settings -> Extensions**.
6. Open https://bestiaryarena.com/ and refresh once after enabling the extension.

Important Orion notes:

- Orion runs extensions through WebKit compatibility layers, so behavior can differ from desktop Firefox.
- If a mod fails to load, open the extension popup and use **Debug -> Error Log**.
- For platform-specific technical details, see `docs/orion_ios_compatibility.md`.

## Troubleshooting (Mobile)

- **No mod effects in game:** Refresh the game tab and make sure the extension is enabled.
- **Popup opens but mod scripts fail:** Open **Debug -> Error Log**, copy the errors, then share them for diagnosis.
- **After update, still broken:** Disable and re-enable the extension, then reload Bestiary Arena.
