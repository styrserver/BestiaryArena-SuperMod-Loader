# Privacy Policy - Bestiary Arena SuperMod Loader

## Last updated: June 12, 2026

This privacy policy describes how Bestiary Arena SuperMod Loader ("we", "our", or "extension") collects, uses, and shares information.

## Information We Collect

The Bestiary Arena SuperMod Loader was designed with a focus on user privacy. Our extension:

- **Does not collect** personally identifiable information for us to sell or aggregate on our own servers.
- **Does not track** your browsing history across unrelated sites.
- **Does not sell** user data to third parties.

The extension primarily stores, on your device:

1. Mod IDs (for example GitHub Gist IDs or other sources you choose to add).
2. Cached mod content to improve performance.
3. Local preferences, such as which mods are active and related settings.

This data is stored locally in your browser using extension storage APIs (including `chrome.storage`, and where needed `unlimitedStorage` for larger caches). It is **not** uploaded automatically to our Firebase backend; it stays in the extension unless you use an optional sync feature that explicitly sends data there.

**Site storage:** Injected mods run in the context of Bestiary Arena pages. Some mods may also write data to that site’s storage (for example `localStorage`) for features such as run tracking. That data remains on your device under the game’s origin unless a mod feature you enable sends it elsewhere.

## Extension Permissions

Our extension requires the following permissions:

- **storage** / **unlimitedStorage**: To save your settings and local mod cache.
- **scripting**: To inject mod code into the Bestiary Arena website.
- **activeTab**: When you open the extension popup, temporary access to the current tab so toggles and messages reach the open game tab (not broad browsing-history access).
- **Host access to bestiaryarena.com**: To run mods on the game site and communicate with open Bestiary Arena tabs. Automatic mod loading uses the content script on game pages, not the `tabs` permission.

**Optional host access** (requested only when you open the popup or import a remote mod):

- **gist.githubusercontent.com** and **raw.githubusercontent.com**: To download Gist or raw GitHub mod sources you choose to add.

## Network Access

The extension and bundled mods may communicate with the following destinations, depending on what you configure and which mods you use:

- **gist.githubusercontent.com** and **raw.githubusercontent.com** (optional): To download mod sources you add (Gists and raw GitHub file URLs supported by the loader). GitHub handles these requests under [GitHub’s policies](https://docs.github.com/en/site-policy).
- **bestiaryarena.com** (and subdomains): Where the game runs and mods are applied. Bundled mods may also call the game’s own **API** endpoints on that host (for example `bestiaryarena.com/api/...`). The game’s operator handles that traffic under their own terms.
- **bestiary-arena-ranking.vercel.app**: Cyclopedia Rankings API (public leaderboard data).
- **bestiaryarena.wiki.gg**: Links in the extension UI only; rankings use the Vercel API above.

### Firebase

**Optional feature use.** Some features (for example best-runs backup/sync in Mod Settings, VIP List, Guilds, Quests, and Challenges) can read or write data to our **Firebase Realtime Database** instance at `vip-list-messages-default-rtdb.europe-west1.firebasedatabase.app` when you enable those features or use those mods. The database runs on **Google Firebase** infrastructure; Google’s processing is described in [Google’s Privacy Policy](https://policies.google.com/privacy). We choose what paths and rules apply in our Firebase project; you choose whether to upload data (for example encrypted best runs) by turning those options on.

We do **not** operate the Bestiary Arena game or GitHub.

## Data Sharing

We do not sell your data.

When you use **remote mod sources**, your browser sends requests to **GitHub** as described above. When you use **optional Firebase-backed features**, your browser sends the relevant payloads to **our Firebase project** (hosted by Google) as described above. Core extension settings and mod cache remain local unless a feature you enable uploads them.

## Third-Party Code

The mods you choose to install may contain third-party code. While we do our best to ensure safety, we cannot be responsible for the content of these mods. We recommend only installing mods from trusted sources.

## Changes to This Privacy Policy

We may update our Privacy Policy periodically. We will notify you of any changes by posting the new Privacy Policy on this page.

## Contact

If you have questions about this Privacy Policy, please contact us via the project repository:

- GitHub: [BestiaryArena-SuperMod-Loader](https://github.com/styrserver/BestiaryArena-SuperMod-Loader)

The original mod loader this project builds on: [bestiary-arena-mod-loader](https://github.com/TheMegafuji/bestiary-arena-mod-loader)
