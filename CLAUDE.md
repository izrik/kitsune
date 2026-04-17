# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kitsune is a Firefox extension that allows users to manage tabs and windows by setting custom window titles. The extension adds a browser action popup that lets users set a title for the current window, which is then displayed in the window's title bar with a prefix format.

## Architecture

### Core Components

- **kitsune.js**: Main module containing the `DataStore` class for persistent storage and window management functions
  - `DataStore`: Handles saving/loading window titles using Firefox's sessions API
  - `refreshAppearanceForWindow()`: Updates the window title display
- **popup/**: Browser action popup interface
  - `popup.html`: Simple form for title input
  - `popup.js`: Handles form submission and window title updates
- **manifest.json**: Extension configuration (manifest v2)

### Data Flow

1. User clicks browser action → popup opens
2. Popup loads current window title from storage
3. User enters new title → form submission
4. Title saved to browser sessions storage
5. Window title updated with `[title]` prefix
6. Popup closes

### Storage Strategy

The extension uses Firefox's `browser.sessions` API to store window titles, ensuring persistence across browser sessions while associating titles with specific windows.

## Development

### No Build Process

This is a vanilla JavaScript extension with no build step required. Files are served directly to the browser.

### Loading the Extension

For development in Firefox:
1. Navigate to `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select `manifest.json` from the project directory

### Testing

Manual testing only - no automated test suite. Test by:
1. Loading extension in Firefox
2. Opening multiple windows
3. Setting titles via browser action popup
4. Verifying titles persist across sessions

### File Structure

```
/
├── kitsune.js          # Core data store and window management
├── manifest.json       # Extension manifest (v2)
├── popup/
│   ├── popup.html      # Browser action popup UI
│   └── popup.js        # Popup interaction logic
└── icons/
    └── bolt.png        # Extension icon
```

## Browser APIs Used

- `browser.sessions`: Window-specific value storage
- `browser.windows`: Window management and title updates
- `browser.windows.getCurrent()`: Get active window reference

## Permissions

- `activeTab`: Access to current tab
- `sessions`: Persistent storage per window
- `storage`: Extension storage access