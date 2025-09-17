# Thanks to [TheMegafuji](https://github.com/TheMegafuji/) and [MathiasBynens](https://github.com/mathiasbynens) for providing the original mod loader. You can find it here: https://github.com/TheMegafuji/bestiary-arena-mod-loader

# BestiaryArena SuperMod Loader

A browser extension that allows loading and managing custom mods for the Bestiary Arena game. This extension is a clone of the original Bestiary Arena Mod Loader with reworked mod loading, including advanced Super Mods like Cyclopedia and Hunt Analyzer. It provides a framework for creating, loading, and managing mods that can extend the game's functionality.

## Features

- **Mod Management**: Load mods from local files or GitHub Gists
- **Configuration System**: Save and manage mod configurations between sessions, with improved support for advanced mod settings
- **Standardized UI Components**: Game-styled UI elements for consistency across mods
- **Session Widget**: Real-time session stats for mods like Autoseller (e.g., sold/squeezed counts, gold/dust earned)
- **Internationalization**: Built-in translation support for mods
- **Game API Access**: Safe access to game state and functions
- **Developer-Friendly**: Comprehensive documentation and examples
- **Super Mods**: Advanced mods with comprehensive game enhancement features

## Installation

Firefox: https://addons.mozilla.org/en-US/firefox/addon/bestiaryarena-supermod-loader/

Chromium: https://chromewebstore.google.com/detail/bestiaryarena-supermod-lo/hloidpjbdbbhhkihgeeddnofmpgbffjd

## Alternative Installation

### Firefox Installation (Alternative)
1. Download the extension files from the [https://github.com/styrserver/BestiaryArena-SuperMod-Loader GitHub repository]
2. Clone this repository or download it as a ZIP file
3. Open Firefox and navigate to <code>about:debugging</code>
4. Click "This Firefox" tab
5. Click "Load Temporary Add-on" and select the <code>manifest_firefox.json</code> file

### Chromium Installation (Alternative)
1. Download the extension files from the [https://github.com/styrserver/BestiaryArena-SuperMod-Loader GitHub repository]
2. Unzip the files to a location on your computer
3. Open your Chrome-based browser (Chrome, Edge, Brave, etc.)
4. Go to <code>chrome://extensions/</code> in your browser
5. Enable "Developer mode" using the toggle in the top-right corner
6. Click "Load unpacked" and select the folder containing the extension files
7. The extension icon should now appear in your browser toolbar

## Using the Mod Loader

After installing the extension, navigate to [Bestiary Arena](https://bestiaryarena.com/). The extension will automatically inject its code into the game page.

To access the Mod Loader interface, click the extension icon in your browser toolbar.

### Extension Popup Interface

The extension provides a user-friendly popup interface for managing your mods. The popup interface allows you to enable/disable mods and access configuration options quickly.

### Loading Mods

There are two ways to load mods:

1. **Local Mods**: Place mod JavaScript files in the `mods/` directory and they will be available for loading.
2. **Gist Mods**: Enter a GitHub Gist hash ID in the mod loader interface to load a mod from GitHub.

### Managing Mods

You can enable, disable, and configure mods from the mod loader interface. Each mod can have its own configuration settings, which are saved between sessions.

## Mod Development

Mods can be written in JavaScript and have access to the game's state and a powerful API for interacting with the game. See the [Mod Development Guide](docs/mod_development_guide.md) for detailed information on creating mods.

### Standardized UI Components

The extension provides a set of UI components that match the game's style. These components ensure a consistent look and feel across all mods:

- **Modals**: Game-styled dialog windows
- **Scrollable Containers**: For content that exceeds the viewable area
- **Monster Portraits**: Display monsters with proper styling
- **Item Portraits**: Display items with proper styling
- **Room List Items**: Display rooms with proper styling
- **Navigation Breadcrumbs**: For hierarchical navigation

Example of using UI components:

```javascript
// Create a monster portrait
const monsterPortrait = api.ui.components.createMonsterPortrait({
  monsterId: 21,  // Monster ID
  level: 50,      // Monster level
  tier: 4,        // Monster tier (1-5)
  onClick: () => showMonsterDetails(21)
});
```

### Access to Game State

Mods have access to the game's state through `globalThis.state`, which provides information about:

- Player stats and inventory
- Monster database and current monsters
- Equipment and items
- Game board state
- Room information
- Game settings

## Project Structure

- `assets/` - Static assets such as fonts, icons, and scripts
  - `fonts/` - Custom fonts used by the UI components
  - `icons/` - Icons used by the extension and mods
  - `js/` - JavaScript libraries, including UI components
  - `locales/` - Internationalization files
- `content/` - Content scripts that are injected into the game page
  - `client.js` - Main client-side API and functionality
  - `injector.js` - Injects the client code into the game page
  - `local_mods.js` - Manages local mods
- `docs/` - Documentation for mod developers
- `database/` - Stores persistent data and tooltips used by mods (e.g., `media.txt`, `inventory-tooltips.js`)
- `mods/` - Local mod files, organized as follows:
  - `Official Mods/` - Core mods that provide essential gameplay enhancements and are included by default.
  - `Super Mods/` - Advanced mods with comprehensive features, included by default (see below for details).
  - `Test Mods/` - Mods for development/testing purposes.
- `popup/` - Extension popup UI
- `background.js` - Background script for the extension
- `manifest.json` - Extension manifest

## Documentation

- [Mod Development Guide](docs/mod_development_guide.md) - Comprehensive guide for mod developers
- [UI Management API](docs/ui_management.md) - Documentation for the UI Management API
- [UI Components Documentation](docs/ui_components.md) - Documentation for the UI Components
- [Client API Documentation](docs/client_api.md) - Complete reference for the game's Client API
- [Game State API Documentation](docs/game_state_api.md) - Complete reference for accessing and modifying game state

## Mods

The extension comes with several powerful mods that demonstrate different features:

### Super Mods

These are advanced mods that provide comprehensive game enhancement features. All 16 Super Mods listed below are included by default in this loader:

### Autoscroller
Automates summon scroll usage to collect specific creatures:
- Select target creatures from a comprehensive list
- Choose scroll tier (grey, green, blue, purple, yellow)
- Set stopping conditions (total creatures or tier-based targets)
- Configurable autoscroll speed with rate-limit protection
- Real-time tracking of found creatures and scroll usage

### Autoseller
Automatically sells or squeezes creatures based on gene thresholds and user settings:
- Configurable gene thresholds for selling and squeezing
- Minimum count triggers for batch actions
- Session widget displaying sold/squeezed counts and rewards
- Integrated with the mod loader's configuration system
- Real-time tracking of gold and dust earnings

### Better Analytics
Adds comprehensive damage per tick (DPT) tracking and real-time DPS calculations to the damage analyzer:
- Real-time damage per second (DPS) calculations displayed next to damage values
- Automatic tracking of damage changes throughout the game session
- Support for all game modes (manual, autoplay, sandbox)
- Auto-opening of the impact analyzer panel for seamless tracking
- Accurate DPS calculations using server game ticks for precise timing

### Better Cauldron
Enhances the native Monster Cauldron interface with powerful search and filter functionality:
- Real-time search through all monsters in your cauldron
- Filter monsters by rarity (Grey, Green, Blue, Purple, Yellow)
- Game-styled UI controls that integrate seamlessly with the existing interface
- Automatic detection and enhancement of the cauldron modal
- Efficient filtering system for managing large monster collections

### Better Forge
Comprehensive equipment management system with advanced disenchanting capabilities:
- Arsenal management with search and tier filtering functionality
- Batch disenchanting with confirmation system and progress tracking
- Real-time dust display and inventory updates
- Equipment search by name and filter by tier (T1-T5)
- Visual progress bar and status updates during disenchanting

### Better Highscores
Displays real-time leaderboard information for the current map:
- Show current map's tick and rank leaderboards in bottom left corner
- Real-time updates when switching between maps
- Automatic data fetching from the game's TRPC API
- Styled leaderboard display with medal colors (gold, silver, bronze)
- Manual refresh capability for up-to-date information

### Better Hy'genie
Enhances the Hy'genie fusion interface with quantity inputs, smart fusion ratios, and improved UI:
- Adds quantity input fields and custom fuse buttons to the Hy'genie modal
- Calculates maximum fusable amount based on inventory and fusion ratio
- Provides confirmation prompts and error feedback inside the tooltip
- Automatically refreshes inventory counts and UI after fusion
- Smart fusion ratio calculations for optimal resource usage

### Better Yasir
Enhances the Yasir shop interface with advanced features and improved usability:
- Add quantity input fields for buying and selling items
- Real-time price calculations and resource tracking
- Enhanced UI with better visual feedback and confirmation prompts
- Automatic inventory updates after transactions
- Support for all item types including equipment, consumables, and special items

### Configurator
Handles import/export of configuration data for the mod loader:
- Export complete configuration including active mods, settings, and game data
- Import configuration files to restore mod settings and game state
- Backup and restore localStorage data (setup labels, autoseller settings, etc.)
- User-friendly summary of what will be imported/exported
- Safe configuration management with confirmation dialogs

### Cyclopedia
A comprehensive game data viewer and player profile manager with advanced features:
- **Monster Database**: Browse and search all monsters with detailed stats, abilities, and locations
- **Equipment Database**: View all equipment with stats, tiers, and optimization recommendations
- **Player Profiles**: Search and view detailed player profiles with statistics and achievements
- **Leaderboards**: Access real-time leaderboards for maps, rankings, and competitions
- **Run Tracking**: View and analyze personal run history with RunTracker integration

### Dashboard Button
Quick access to the mod dashboard:
- Provides easy access to all mod features
- Integrates seamlessly with the game interface
- Streamlines mod management
- Centralized mod control and configuration
- One-click access to all mod functionality

### Dice Roller
Automates dice rolling for stat rerolling:
- Automatically clicks the roll button and checks for target stats
- Lets you set target values for each stat
- Stops rolling when a desired stat value is reached
- Displays roll count and status in a custom panel
- Configurable target thresholds for optimal stat optimization

### Hunt Analyzer
Advanced autoplay and loot tracking system:
- Track detailed statistics from autoplay sessions
- Monitor gold, dust, and item drops
- Analyze creature and equipment drop rates
- View session summaries and performance metrics
- Export data for further analysis

### Outfiter
Comprehensive outfit management system:
- Browse and preview all available outfits
- Save and manage custom outfit combinations
- Color customization for outfits
- Outfit storage and retrieval system
- Integration with game's outfit system

### Raid Hunter
Advanced raid automation system for Bestiary Arena:
- Automatically detects and joins available raids based on user preferences
- Configurable raid map selection with regional organization
- Auto-setup and autoplay integration for seamless raid execution
- Stamina monitoring and auto-refill integration with Bestiary Automator
- Real-time raid status monitoring with countdown timers
- Queue system for handling multiple raids efficiently
- Comprehensive settings panel for customization

### RunTracker
Local run data tracking and storage system:
- Automatically tracks and stores run data locally
- Stores run history with detailed statistics
- Replay data management and storage
- Integration with other mods for comprehensive tracking
- Hidden mod that works behind the scenes

### Official Mods

These are the core mods that provide essential gameplay enhancements. All 11 Official Mods listed below are included by default:

### Bestiary Automator
Automates routine gameplay actions to streamline your Bestiary Arena experience:
- Automatic stamina refilling when low
- Auto-collection of available rewards
- Automatic handling of Day Care tasks
- Customizable automation settings for safe and efficient play
- Streamlined gameplay experience with minimal manual intervention

### Board Analyzer
Analyzes and simulates board setups for optimal strategies and performance:
- Advanced board setup analysis and simulation
- Performance optimization recommendations
- Strategic planning tools for complex scenarios
- Testing environment for different configurations
- Useful for advanced planning and testing

### Custom Display
Enhances game visuals with two powerful features:
- Performance Mode: Strips down graphics for better performance on low-end devices
- Map Grid: Adds a coordinate grid overlay to help with positioning and planning
- Extensive customization settings for colors, visibility, and display options
- Real-time visual adjustments without page refresh
- Optimized performance for various device capabilities

### Hero Editor
A powerful tool that allows players to:
- Edit monster stats directly in the game
- Modify equipment attributes (stat type, tier)
- Apply changes instantly to the game board
- Save and load custom setups
- Perfect for testing different monster and equipment combinations without having to collect and level them in-game

### Highscore Improvements
Enhances the game's highscore display with additional statistics, improved sorting options, and visual enhancements:
- Detailed performance analysis
- Potential time improvements compared to top scores
- Room-by-room breakdown of performance
- Visual indicators for time differences
- Enhanced sorting and filtering options for better comparison

### Item Tier List
Displays equipment statistics and rankings, allowing players to compare items and make informed decisions about their loadouts:
- Item effectiveness by tier
- Stat optimizations for different monsters
- Best-in-slot recommendations
- Visual quality indicators
- Comprehensive equipment comparison and analysis

### Monster Tier List
Analyzes monster usage patterns and displays statistics and rankings, helping players identify the most effective monsters for different scenarios:
- Sortable tier list of monsters
- Usage statistics across different room types
- Win rate and performance metrics
- Visual representation of monster effectiveness
- Data-driven monster selection recommendations

### Setup Manager
Allows players to save, load, and manage team configurations for different maps:
- Multiple saved team setups per map
- Easy switching between configurations
- Automatic detection of map changes
- Custom naming of team configurations
- Integration with the game's auto-configure button

### Team Copier
Enables sharing team configurations with other players through:
- Copying team setup as JSON command
- Generating sharable links (compact or readable)
- Opening shared configurations in new windows
- Optional inclusion of game seeds for exact replays
- History of recently used seeds

### Tick Tracker
Tracks and displays the number of game ticks (and optionally milliseconds) for each session:
- Real-time tick tracking widget
- History of recent tick counts
- Option to show milliseconds conversion
- Copy and clear tick history with a single click
- Useful for speedrunners and performance analysis

### Turbo Mode
Speed up gameplay for faster testing and grinding:
- Increase game speed for faster progression
- Customizable speed multipliers
- Real-time tick display
- Perfect for testing strategies quickly
- Great for farming and grinding sessions

### Experimental Mods
Some mods in the `Test Mods/` folder are provided as examples or for development/testing. These are not enabled by default but can be activated or used as templates for your own mods.

### Board Advisor
Advanced board analysis and recommendations system:
- Room-based data storage and pattern analysis
- Performance predictions and optimization suggestions
- Learning from successful runs to improve recommendations
- Automatic analysis when board changes
- Configurable analysis depth and recommendation thresholds

## Contributing

Contributions are welcome! If you have a mod you'd like to share or improvements to the extension, please read our [Contribution Guidelines](CONTRIBUTING.md).

## Frequently Asked Questions

### Is this extension safe to use?
Yes! The mod loader doesn't modify any game files directly. It only adds features to your browser's version of the game. In case you have any doubts, the source code is fully available for inspection and review on GitHub.

### Will using mods get me banned?
This mod loader is designed for enhancing single-player gameplay. It was all made with consent from Alexandre Regali Seleghim (Xandjiji) which is the creator of Bestiary Arena.

### Do I need to update the extension?
Occasionally, you may need to update the extension when new game versions are released. Check the GitHub repository for updates.

### Can I create my own mods?
Yes! If you know JavaScript, you can create your own mods. Check the [Mod Development Guide](docs/mod_development_guide.md) for technical details.

### How do I report bugs or suggest features?
Visit the [GitHub Issues page](https://github.com/styrserver/BestiaryArena-SuperMod-Loader/issues) to report bugs or suggest new features.

## Troubleshooting

If you encounter any issues:

- **Mods not appearing?** Make sure you're on the Bestiary Arena website and the extension is enabled.
- **Game performance issues?** Try using the Performance Mode mod to improve game speed.
- **Extension not working after game update?** Check for extension updates on GitHub.
- **Specific mod not working?** Disable and re-enable the mod, or refresh the page.
- **Autoseller session widget not updating?** Ensure the mod is enabled and you have completed at least one battle for stats to appear.
- **Turbo Mode not working?** Make sure you're in a game session and try refreshing the page.
- **Board Analyzer issues?** Ensure you're in sandbox mode and have a valid board configuration.

## Credits

### Original Developers
- [TheMegafuji](https://github.com/TheMegafuji/) (In-game name: **megafuji**)
- [MathiasBynens](https://github.com/mathiasbynens) (In-game name: **mathiasbynens**)

### SuperMod Loader Maintainer
- [Muhamad](https://bestiaryarena.com/profile/muhamad) - Creator and maintainer of the Bestiary Arena SuperMod Loader

### Special Thanks
This project has been developed with the express consent and approval of the original Bestiary Arena game developer:
- [Alexandre Regali Seleghim (Xandjiji)](https://github.com/xandjiji)

## License

This project is licensed under the MIT License. See the LICENSE file for details. 