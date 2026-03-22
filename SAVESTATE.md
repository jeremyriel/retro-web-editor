# WIRED — Web Interface Retro Editor for Desktop

## Project Location
`C:\Users\jriel2\WIRED\`

## What Is This
A lightweight, cross-platform desktop WYSIWYG HTML editor built with Electron. Modern alternative to Dreamweaver/BlueGriffon — open local HTML/CSS/JS files, edit visually or in code, and see changes live. Emphasis on memory efficiency.

Version 1.0. Made by Jeremy Riel, 2026. GNU GPL 3.0 License.
Website: www.jeremyriel.com

## Tech Stack
| Component | Choice | Why |
|---|---|---|
| Desktop framework | Electron 34+ | Cross-platform, mature |
| Bundler | electron-vite (Vite 6) | Fast HMR, handles Electron multi-process |
| Code editor | CodeMirror 6 | ~150KB core vs Monaco's 5-10MB |
| Live preview | Sandboxed iframe | Same renderer process (saves ~30-50MB vs webview) |
| UI framework | None (vanilla TypeScript) | No React/Vue overhead for ~20 inputs |
| Persistence | electron-store (~12KB) | Window state, recent files, theme |
| WCAG validation | axe-core | Industry-standard accessibility testing engine |
| Packaging | electron-builder | Windows (.nsis, .portable) + Mac (.dmg, .zip) |
| Language | TypeScript (strict) | Type safety for bidirectional sync + IPC |

## Project Structure
```
WIRED/
├── package.json              # name: "wired", main: "out/main/index.js"
├── electron-builder.yml      # appId: com.wired.editor, productName: WIRED, extraResources: copying/
├── README.md                 # GitHub-ready README with features, install, tutorial, license
├── copying/
│   └── LICENSE_GNU_GPL_3.0.txt  # Full GPL 3.0 license text
├── electron-vite.config.ts   # Uses default out/ directory for builds
├── tsconfig.json             # References tsconfig.node.json + tsconfig.web.json
├── tsconfig.node.json        # Covers src/main/, src/preload/
├── tsconfig.web.json         # Covers src/renderer/, src/shared/
├── architecture.md           # High-level architecture doc
├── launch.bat                # Double-click to launch on Windows
├── launch.sh                 # ./launch.sh to launch on Mac/Linux
├── .gitignore
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.ts          # Entry: window creation, app lifecycle, webSecurity:false for file:// in iframe
│   │   ├── ipc-handlers.ts   # All ipcMain.handle() registrations (file ops, autosave, Google Fonts, WCAG reports)
│   │   ├── file-manager.ts   # Open/save/save-as/autosave/linked file extraction
│   │   ├── menu.ts           # Native menu bar (File, Edit, View, Help)
│   │   └── window-state.ts   # electron-store: window bounds, theme, recent files (add/remove/clear)
│   ├── preload/
│   │   └── index.ts          # contextBridge API (window.api)
│   ├── renderer/
│   │   ├── index.html        # Shell HTML: toolbar, tabs, workspace, modals (about, license, link editor, recent files, Google Fonts, WCAG, hotkeys, recovery), help tooltip
│   │   ├── main.ts           # Renderer entry — wires all components, modals, zoom, help hovers, WCAG validator, Google Fonts
│   │   ├── style.css         # Full CSS: light/dark themes, zoom controls, modals, help tooltips, recent files, WCAG results, Google Fonts
│   │   ├── editor/
│   │   │   ├── code-editor.ts    # CodeMirror 6 wrapper (line wrapping, zoom in/out, theme-aware font size)
│   │   │   └── editor-tabs.ts    # Tab management (add/close/switch/dirty state/markDirty)
│   │   ├── preview/
│   │   │   ├── preview-frame.ts  # iframe management, <base href> injection, zoom via CSS transform
│   │   │   ├── drag-drop.ts      # Drag-and-drop toggle manager
│   │   │   └── grid-overlay.ts   # CSS grid overlay toggle
│   │   ├── toolbar/
│   │   │   └── toolbar.ts        # Formatting toolbar + WCAG validator, keyboard shortcuts, help hover toggle buttons
│   │   ├── properties/
│   │   │   ├── property-panel.ts # CSS properties + HTML attributes panel + Google Fonts button on font-family
│   │   │   └── color-picker.ts   # Color input widget (native + text)
│   │   ├── layout/
│   │   │   └── split-view.ts     # Resizable split pane, drag overlay to prevent iframe mouse capture
│   │   └── sync/
│   │       ├── sync-engine.ts    # Central bidirectional sync coordinator
│   │       ├── html-parser.ts    # Custom HTML parser with source position tracking
│   │       └── debounce.ts       # Debounce utility
│   └── shared/
│       ├── types.ts              # IPC channels, FileTab, SourceNode, PreviewMessage, etc.
│       └── constants.ts          # Autosave interval (2 min), grid size, CSS property groups, HTML attrs
├── logo.png                     # Source logo (2048x2048 pixel art)
└── resources/
    ├── icon.png                 # 256x256 window icon (runtime)
    ├── icon.ico                 # Multi-size Windows icon (packaging)
    └── icon.icns                # macOS icon (packaging)
```

## Architecture

### Process Model
- **Main process** (`src/main/`): File I/O via Node fs, native dialogs, menus, autosave timer, window state persistence via electron-store, Google Fonts metadata fetch, WCAG report file saving
- **Preload** (`src/preload/`): Strict `contextBridge` — exposes `window.api` object with typed methods. Renderer never touches Node/fs directly
- **Renderer** (`src/renderer/`): All UI — CodeMirror editor, iframe preview, property panel, toolbar, split view, sync engine, axe-core WCAG validation

### Bidirectional Sync (SyncEngine — `src/renderer/sync/sync-engine.ts`)
CodeMirror document is the **single source of truth**. All visual edits translate into code edits.

1. **Code → Preview**: CM6 change listener → 300ms debounce → rebuild source map → inject HTML into iframe `srcdoc`. CSS-only changes hot-swap `<style>` content (no full reload)
2. **Visual → Code**: Click/drag in iframe → `postMessage` to parent → SyncEngine maps DOM node to source position via CSS selector path → applies CM6 transaction
3. **Property → Code**: User changes CSS property or HTML attribute → SyncEngine edits inline style or attribute at source offset → CM6 transaction → preview updates
4. **Loop prevention**: Every edit tagged with origin (`'code'|'visual'|'property'`). SyncEngine ignores changes from the origin it just dispatched to

### Source Mapping (`src/renderer/sync/html-parser.ts`)
- Custom HTML parser records `{ startOffset, endOffset, openTagEnd }` per element
- CSS selector paths (e.g., `html:nth-of-type(1) > body:nth-of-type(1) > div.container:nth-of-type(1) > p:nth-of-type(2)`) match DOM nodes to source positions
- Same path computed in iframe DOM for clicked/dragged elements. Iframe `getSelectorPath` includes `<html>` and filters `wired-*` injected elements from sibling counts to match parser output
- Rebuilt on each code→preview sync

### Preview Iframe (`src/renderer/preview/preview-frame.ts`)
- Injects a `<script>` into iframe content that handles:
  - Click-to-select (sends `element-selected` postMessage with selector path, computed styles, attributes, bounding rect). Scrolls the code editor to the selected element and highlights (selects) the full opening tag.
  - Hover highlighting (sends `element-hovered` postMessage)
  - Drag-and-drop (HTML5 Drag API with insertion markers, sends `element-dragged` postMessage)
  - Ctrl+K / Cmd+K link editor (sends `link-edit-request` postMessage with selected text and existing link attributes)
- Injects `<style>` for DOM outline mode and image alt-text warnings (red dashed outline on `img:not([alt])`)
- Injects `<base href="file:///.../">` tag so relative paths (CSS, JS, images) resolve correctly
- Internal element IDs prefixed with `wired-` to avoid collision with user content
- `webSecurity: false` in main process to allow iframe srcdoc to load file:// resources

### IPC Contract (`src/shared/types.ts`)
All IPC channels defined in the `IPC` const object. Key channels:
- `file:open`, `file:save`, `file:save-as`, `file:read`
- `file:extract-linked` — scans HTML for `<link>` and `<script>` tags, returns paths
- `file:remove-recent`, `file:clear-recent`, `file:get-recent` — recent files management
- `license:read` — reads GPL 3.0 license text from copying/ folder
- `autosave:tick` — writes to `.~wired-{filename}.tmp`
- `autosave:check` — compares autosave vs original file, returns recovery content or null
- `autosave:discard` — deletes autosave temp file
- `fonts:fetch-google` — fetches Google Fonts metadata from public API (cached)
- `report:save` — shows native save dialog and writes text report file
- `dialog:confirm` — save/discard/cancel dialog
- `menu:action` — menu bar sends action strings to renderer
- `theme:get`, `theme:set` — persisted via electron-store

## Key Features — Implementation Status

### Fully Implemented
- **CodeMirror 6 editor** with HTML/CSS/JS language support, light + One Dark themes, **line wrapping** enabled, brighter selection highlight in dark mode (`rgba(81, 139, 219, 0.4)` override on One Dark)
- **Formatting toolbar**: Bold, Italic, Underline, Strikethrough, H1-H6 dropdown, Insert Link/Image/Table/Div/List, Alignment, WCAG Validator, Keyboard Shortcuts, Help Hovers toggle (all via inline SVG icons)
- **Tab system**: Multiple open files, dirty state tracking (orange dot), close with save prompt, `markDirty()` for recovered files
- **File I/O**: Open/Save/Save As via native dialogs, HTML file auto-detects linked CSS/JS and opens them as tabs. Both `openFile()` and `openFileFromPath()` have try/catch error handling.
- **Open Recent**: Modal popup (Ctrl+Shift+O or File > Open Recent) showing up to 10 recent files with type badges, full paths. Click to open, X to remove individual files, "Clear All" button. Persisted via electron-store.
- **Live preview**: iframe with 300ms debounced sync, CSS hot-swap, `<base href>` injection for correct relative path resolution
- **Bidirectional sync**: Click elements in preview → property panel populates + code editor scrolls to element source; property changes write back to code
- **Drag-and-drop**: Elements draggable in preview, drop events translate to source code reordering
- **Property panel**: CSS tab (Box Model, Typography, Layout, Colors, Position, Overflow groups) + HTML Attributes tab (context-sensitive by tag). Image-specific: alt-text missing warning, "Mark as decorative" checkbox (sets `alt=""` + `role="presentation"`). Font-family row has Google Fonts search button.
- **Color picker**: Native `<input type="color">` + text input, rgb→hex conversion
- **Split view**: Resizable pane with 3 modes (split/code-only/preview-only), **drag overlay** prevents iframe from capturing mouse during resize
- **Zoom controls**: Floating controls in bottom-right of each pane (semi-transparent, visible on hover). Code zoom: font size ±2px (8–32px range). Preview zoom: CSS transform scale ±10% (30–200%). Keyboard shortcuts + visible buttons with percentage display.
- **Grid overlay**: Fixed 20px CSS grid via `repeating-linear-gradient`, `pointer-events:none`
- **DOM outlines**: Injected CSS outlines on block elements, hover highlight
- **Autosave**: Every 2 minutes to `.~wired-{filename}.tmp`, also created immediately on file open. Cleaned up on save.
- **Autosave recovery**: On file open, checks for existing autosave that differs from the saved file. Prompts user with "Recover Unsaved Changes" modal offering "Restore Autosave" or "Discard Recovery". Dismissing the modal (close button, overlay click, Escape) treats as discard. `checkAndRecoverAutosave()` wrapped in try/catch — falls back to original content on any error. Restored files open as dirty (unsaved).
- **Save-on-exit**: Native Save/Don't Save/Cancel dialog for dirty files
- **Window state**: Position, size, maximized state persisted via electron-store
- **Theme persistence**: Light/dark preference saved and restored
- **Link editor**: Ctrl+K / Cmd+K in preview with text selected opens link editor modal. Supports URL, mailto, tel, and anchor link types. Options for target (same/new window), rel attributes (noopener/noreferrer/nofollow), and title tooltip. Edit existing links or remove them. Works via SyncEngine for existing `<a>` tags or inserts new links at cursor.
- **Google Fonts integration**: Browse, search, and add Google Fonts to the document. Small search icon button appears next to font-family input in CSS properties panel. Opens a modal with search, category filter (All/Sans Serif/Serif/Display/Handwriting/Monospace), and font previews rendered in each font. "Document Fonts" section shows already-linked Google Fonts for quick reuse. "Add & Use" inserts a `<link>` tag into the HTML `<head>` and sets font-family on the selected element. Font metadata fetched from Google's public API endpoint (cached in main process).
- **WCAG Validator**: Toolbar shield-check button or Edit > WCAG Validator. Runs axe-core v4.11 validation against the current HTML in a temporary hidden iframe (clean copy, no WIRED injected elements). Tests against WCAG 2.1 Level AA (wcag2a, wcag2aa, wcag21a, wcag21aa tags). Results modal shows: standard tested + axe-core link, summary stats (violations/needs review/passed/not applicable), violations grouped by impact (critical/serious/moderate/minor) with rule descriptions, help links, WCAG tags, and affected CSS selectors (up to 5 per rule). Passed rules in collapsible section. Re-run button for iterative fixing. Download report as .txt file via native save dialog — includes file name, date, axe version, full violation details with failure summaries.
- **Keyboard Shortcuts popup**: Toolbar keyboard icon button or View > Keyboard Shortcuts (Ctrl+/ / Cmd+/). Shows all hotkeys in a two-column modal grouped by File, Edit, Formatting, View, Zoom, Help. Note at bottom: "On macOS, use Cmd in place of Ctrl." All Ctrl-based shortcuts also work with Cmd on Mac (menu uses `CmdOrCtrl`, preview Ctrl+K checks `e.ctrlKey || e.metaKey`).
- **Native menu bar**: File (Open/Open Recent/Save/Save As), Edit (undo/redo/clipboard/WCAG Validator), View (view modes, grid, outlines, properties, themes, zoom, keyboard shortcuts, devtools), Help (Help Hovers, About). Theme radio buttons sync with persisted theme on startup and update when changed.
- **Help Hovers**: Toggle via toolbar ? button or Help > Toggle Help Hovers (F1). Shows descriptive tooltips on hover for all UI elements. Toast notification on activation. Dashed outline on hovered elements when active. Covers toolbar, tabs, editor, preview, properties, zoom controls, branding, and all modals.
- **About modal**: Version 1.0, Jeremy Riel 2026, GNU GPL 3.0 License (with "View License" link that opens license text popup), link to jeremyriel.com
- **App branding**: "WIRED: Web Interface Retro Editor for Desktop" in top-right toolbar area
- **WCAG 2.1 AA accessibility** (for the WIRED editor UI itself):
  - **Skip navigation link**: "Skip to editor" link appears on Tab from top of page, jumps focus to code editor
  - **ARIA landmarks & roles**: `role="banner"` on toolbar, `role="main"` on workspace, `role="region"` on properties panel, `role="dialog"` + `aria-modal` on modals, `role="tablist"`/`role="tab"`/`role="tabpanel"` on tabs and property tabs, `role="separator"` on split handle, `role="tooltip"` on help tooltip, `role="group"` on zoom controls, `role="presentation"` + `aria-hidden` on decorative elements (grid overlay, SVG icons, branding)
  - **ARIA labels**: All interactive elements have descriptive `aria-label` attributes (toolbar buttons, zoom buttons, close buttons, color pickers, code editor, tab close buttons with file names, split handle)
  - **ARIA state management**: `aria-selected` on tabs and property tabs, `aria-valuenow`/`aria-valuemin`/`aria-valuemax` on split handle separator, `aria-controls` linking property tabs to their panels, `aria-labelledby` on tab panels
  - **Live region announcements**: `aria-live="polite"` announcer element (`#a11y-announcer`) for screen reader status updates; `aria-live="polite"` on zoom level displays for real-time zoom percentage announcements
  - **Screen-reader-only utility class**: `.sr-only` CSS class for visually hidden but accessible content
  - **Focus management**: Focus trapping in modals (Tab/Shift+Tab cycles within modal, Escape closes), focus restoration to previously focused element on modal close, `aria-hidden="true"` set on `#app` while modal is open
  - **Keyboard navigation**: Arrow keys Left/Right navigate between tabs (with Home/End support), Arrow keys Left/Right resize split pane (with Home/End for min/max), roving `tabindex` on tab bar (active tab `tabindex="0"`, inactive `tabindex="-1"`)
  - **Focus indicators**: Global `:focus-visible` outline (`2px solid var(--accent)` with `2px offset`) on all focusable elements, custom focus style on split handle
  - **Reduced motion**: `@media (prefers-reduced-motion: reduce)` disables animations on help notifications, zoom control transitions, and help tooltips
  - **Color contrast (1.4.3 + 1.4.11)**: All text meets 4.5:1 minimum; all UI components and graphical objects meet 3:1 minimum. Per-theme `--accent-active-text` variable ensures text-on-accent contrast in both light (white on `#0066cc` = 5.57:1) and dark (`#1e1e1e` on `#4da6ff` = 6.52:1) themes. Dirty indicator uses darker `#b5540d` in light theme (4.95:1 on white) and brighter `#e67e22` in dark theme (5.85:1 on `#1e1e1e`). Split handle uses dedicated `--split-handle-color` for 3:1+ against adjacent pane backgrounds. Zoom controls minimum opacity raised to 0.75 to maintain contrast at rest
- **Launch scripts**: `launch.bat` (Windows) and `launch.sh` (Mac/Linux)
- **App logo/icon**: `logo.png` (2048x2048 pixel art, RGBA) in project root is the source asset. Generated icons in `resources/`: `icon.png` (256x256, runtime window icon), `icon.ico` (multi-size 16-256px, Windows packaging), `icon.icns` (macOS packaging). A 256x256 copy at `src/renderer/logo.png` is used in the UI (52KB bundled). Window icon loaded via `nativeImage.createFromPath()` in `src/main/index.ts` with dev/production path handling. Logo appears in: toolbar branding area (20x20, next to app name), About modal (128x128, centered, `image-rendering: pixelated` for pixel art). `electron-builder.yml` includes `icon.png` as an `extraResource` for packaged builds.

### Not Yet Implemented
- **Packaging**: electron-builder config exists but hasn't been tested end-to-end
- **File watching for external changes**: Not implemented
- **Cross-platform testing**: Only verified on Windows

## Commands
```bash
npm run dev          # Start in dev mode (hot reload)
npm run build        # Production build to out/
npm run package:win  # Package for Windows (nsis + portable)
npm run package:mac  # Package for Mac (dmg + zip)
```

Also: double-click `launch.bat` (Windows) or `./launch.sh` (Mac)

## Build Output
- electron-vite outputs to `out/` directory (not `dist/`)
- `out/main/index.js` — main process bundle (~607KB)
- `out/preload/index.js` — preload script (~2.6KB)
- `out/renderer/` — renderer HTML + CSS + JS (~2.5MB JS incl. axe-core, ~33KB CSS)

## Naming
- Originally called "SWYW" (See What You Want), renamed to **WIRED** (Web Interface Retro Editor for Desktop)
- All source references updated. Internal element IDs in preview iframe use `wired-` prefix
- Autosave temp files use `.~wired-` prefix
- package.json name: `wired`, electron-builder appId: `com.wired.editor`
- Project folder renamed to `WIRED/` on disk

## Key Bug Fixes Applied
1. **Preview not loading CSS/JS/images**: Fixed by injecting `<base href="file:///path/to/dir/">` into iframe content and setting `webSecurity: false` in Electron config
2. **Split handle not releasing click**: Fixed by adding a full-workspace drag overlay (`#drag-overlay`) that covers the iframe during resize, preventing mouse event capture
3. **Code not wrapping when pane narrowed**: Fixed by adding `EditorView.lineWrapping` to CodeMirror config and reducing min-width from 200px to 100px
4. **Selector path mismatch between iframe and parser**: Iframe's `getSelectorPath` excluded `<html>` from paths (stopped at `document.documentElement`) while the parser included it. Fixed by walking up to `nodeType === 1`, adding `nth-of-type(1)` for `<html>`, and filtering `wired-*` injected elements from sibling counts. This fixed click-to-select, property editing, and drag-and-drop sync.
5. **Theme radio buttons not synced on startup**: `currentThemeMenu` defaulted to `'light'` and `setMenuTheme()` was never called before `createMenu()`. Fixed by reading persisted theme and calling `setMenuTheme()` before menu creation; also rebuild menu on theme change via IPC.
6. **File open hanging on autosave recovery modal dismiss**: Recovery modal close button, overlay click, and Escape key closed the modal visually but never resolved the promise in `promptAutosaveRecovery()`, causing `openFile()` / `openFileFromPath()` to hang forever. Fixed by adding `dismissRecovery()` handler that resolves as `'discard'` on any modal dismiss. Also wrapped `checkAndRecoverAutosave()` in try/catch to fall back to original content on any error, and added try/catch to `openFile()` (which previously had none).
7. **WCAG report download not working + button text invisible in dark mode**: Two related issues — (a) the "Download Report (.txt)" button had no `:disabled` styles, so Chromium's default disabled styling overrode the custom color, making text invisible in dark mode; (b) the save dialog `defaultPath` was a bare filename without a directory, which on Windows could default to a restricted/unexpected directory and fail silently. Fixed by adding explicit `.link-btn:disabled` and `.link-btn-primary:disabled` CSS rules, passing the open file's directory path to the IPC handler for a proper `defaultPath` via `dirname(filePath)`, and adding try-catch error handling to the download click handler.

## Known Issues / Open Items
1. File watching for external changes not implemented
3. The `close` event handler in `src/main/index.ts` has an empty callback — dirty-state quit blocking is handled renderer-side but doesn't actually prevent window close via `e.preventDefault()`
4. Drag-and-drop source code reordering may produce incorrect offsets if source and target are in different nesting levels (edge case in `sync-engine.ts moveElement()`)
5. The HTML parser is custom/simple — doesn't handle all edge cases (e.g., template literals in inline scripts, CDATA sections, malformed HTML)
6. electron-builder deprecation warnings on some transitive dependencies (non-blocking)
7. axe-core adds ~1.4MB to renderer bundle — acceptable for desktop app but notable

## Dependencies (key ones)
- `electron` ^34.0.0
- `electron-vite` ^3.0.0
- `codemirror` ^6.0.0 (+ lang-html, lang-css, lang-javascript, theme-one-dark, autocomplete, search, state, view)
- `electron-store` ^10.0.0
- `axe-core` ^4.11.1
- `electron-builder` ^25.1.8
- `typescript` ^5.7.0
- `vite` ^6.0.0

## Menu Structure (current)
```
File
  Open...              Ctrl+O
  Open Recent...       Ctrl+Shift+O
  Save                 Ctrl+S
  Save As...           Ctrl+Shift+S
  ---
  Quit

Edit
  Undo / Redo / Cut / Copy / Paste / Select All
  ---
  WCAG Validator

View
  Toggle Code/Preview  Ctrl+\
  Code Only            Ctrl+1
  Split View           Ctrl+2
  Preview Only         Ctrl+3
  ---
  Toggle Grid Overlay  Ctrl+G
  Toggle DOM Outlines  Ctrl+Shift+G
  ---
  Toggle Properties    Ctrl+P
  ---
  Theme: Light / Dark
  ---
  Zoom In Code         Ctrl+=
  Zoom Out Code        Ctrl+-
  Reset Code Zoom      Ctrl+0
  ---
  Zoom In Preview      Ctrl+Shift+=
  Zoom Out Preview     Ctrl+Shift+-
  Reset Preview Zoom   Ctrl+Shift+0
  ---
  Keyboard Shortcuts   Ctrl+/
  ---
  Toggle DevTools
  Toggle Fullscreen

Help
  Toggle Help Hovers   F1
  ---
  About WIRED
```
