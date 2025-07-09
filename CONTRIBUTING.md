# Contributing to Bestiary Arena SuperMod Loader

Thank you for your interest in contributing to the Bestiary Arena SuperMod Loader! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Contributing to Bestiary Arena SuperMod Loader](#contributing-to-bestiary-arena-supermod-loader)
  - [Table of Contents](#table-of-contents)
  - [Code of Conduct](#code-of-conduct)
  - [Getting Started](#getting-started)
  - [Development Setup](#development-setup)
    - [Prerequisites](#prerequisites)
    - [Setting Up the Development Environment](#setting-up-the-development-environment)
    - [Workflow](#workflow)
  - [Contribution Guidelines](#contribution-guidelines)
    - [Creating Issues](#creating-issues)
    - [Pull Requests](#pull-requests)
    - [Code Style](#code-style)
  - [Building and Testing](#building-and-testing)
  - [Documentation](#documentation)
  - [Creating Mods](#creating-mods)
    - [Best Practices for Mod Development](#best-practices-for-mod-development)
  - [Submitting Mods](#submitting-mods)

## Code of Conduct

We expect all contributors to be respectful and considerate of others. Any form of harassment or inappropriate behavior will not be tolerated. Our goal is to maintain a welcoming community for all contributors regardless of background or identity.

## Getting Started

If you're new to the project, we recommend starting with:

1. Install the extension following the instructions in the [README.md](README.md)
2. Try out the existing mods to get a feel for how they work
3. Read the [Mod Development Guide](docs/mod_development_guide.md) to understand the architecture

## Development Setup

### Prerequisites

- Git
- Google Chrome or compatible browser (Edge, Brave, etc.)
- Text editor or IDE (VSCode recommended)

### Setting Up the Development Environment

1. Fork the repository on GitHub
2. Clone your fork to your local machine:
   ```
   git clone https://github.com/YOUR_USERNAME/BestiaryArenaSuperModLoader.git
   cd BestiaryArenaSuperModLoader
   ```
3. Load the extension in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the directory containing the extension

### Workflow

1. Create a new branch for your feature or bugfix:
   ```
   git checkout -b feature/your-feature-name
   ```
2. Make your changes
3. Test your changes by reloading the extension in Chrome
4. Commit your changes:
   ```
   git commit -m "Description of your changes"
   ```
5. Push your changes to your fork:
   ```
   git push origin feature/your-feature-name
   ```
6. Create a Pull Request on GitHub

## Contribution Guidelines

### Creating Issues

When creating a new issue, please:

1. Check if a similar issue already exists
2. Use a descriptive title
3. Provide detailed information about the issue:
   - For bugs: Steps to reproduce, expected behavior, actual behavior, browser version
   - For features: Description of the feature, use cases, proposed implementation

### Pull Requests

When submitting a Pull Request:

1. Reference any related issues
2. Provide a clear description of the changes
3. Include screenshots if the changes affect the UI
4. Make sure your code passes all checks
5. Keep PRs focused on a single change to facilitate review

### Code Style

Please follow these guidelines for code style:

- Use 2-space indentation
- Follow JavaScript Standard Style
- Use meaningful variable and function names
- Include comments for complex logic
- Keep functions small and focused on a single task
- Avoid deep nesting of conditionals

## Building and Testing

The extension doesn't require a traditional build process, but you should:

1. Test your changes in Chrome by reloading the extension
2. Test with different mods enabled/disabled
3. Test on the latest version of Bestiary Arena
4. Verify that your changes don't break existing functionality

## Documentation

If you're adding new features or changing existing ones, please update the documentation:

1. Update relevant `.md` files in the `docs/` directory
2. Keep code examples up-to-date
3. Add screenshots if they help explain the feature
4. Follow the existing documentation style

## Creating Mods

If you want to contribute by creating mods:

1. Follow the [Mod Development Guide](docs/mod_development_guide.md)
2. Use the standardized UI components for consistent styling
3. Implement proper error handling
4. Test your mod thoroughly
5. Consider internationalization support

### Best Practices for Mod Development

- Use ES6+ features responsibly
- Follow the principle of least privilege
- Avoid excessive DOM manipulation
- Use the provided API methods instead of direct DOM access
- Cache DOM queries for better performance
- Clean up event listeners and timeouts when they're no longer needed

## Submitting Mods

If you've created a mod that you'd like to share:

1. Host your mod on GitHub Gist
2. Test it thoroughly with different game versions
3. Create documentation for your mod
4. Submit an issue with the "Mod Submission" label, including:
   - Gist URL
   - Description of the mod
   - Screenshots (if applicable)
   - Any special instructions

For exceptional mods, we may consider including them as built-in examples with proper attribution.

---

Thank you for contributing to the Bestiary Arena SuperMod Loader! Your efforts help improve the experience for all players.
