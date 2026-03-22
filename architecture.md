# WIRED Architecture

## Process Model
- **Main process** (`src/main/`): File I/O, native dialogs, menus, autosave, window state persistence
- **Preload** (`src/preload/`): Strict `contextBridge` API — renderer never accesses Node/fs directly
- **Renderer** (`src/renderer/`): All UI — CodeMirror editor, iframe preview, property panel, toolbar, split view, sync engine

## Bidirectional Sync
CodeMirror document is the single source of truth. All edits flow through the SyncEngine:

1. **Code -> Preview**: CodeMirror change -> 300ms debounce -> rebuild source map -> inject HTML into iframe srcdoc
2. **Visual -> Code**: Click/drag in iframe -> postMessage -> SyncEngine maps CSS selector path to source offset -> CodeMirror transaction
3. **Property -> Code**: Property panel change -> SyncEngine updates inline style/attribute at source offset -> CodeMirror transaction
4. **Loop prevention**: Each edit tagged with origin (`code|visual|property`). SyncEngine ignores echoed changes.

## Source Mapping
- Custom HTML parser records `{ startOffset, endOffset, openTagEnd }` per element
- CSS selector paths (e.g., `body > div.container:nth-of-type(1) > p:nth-of-type(2)`) used to match DOM nodes to source positions
- Rebuilt on each code change (fast for typical HTML files)

## Key Design Decisions
- **Sandboxed iframe** (not webview): Same renderer process, saves ~30-50MB
- **CodeMirror 6** (not Monaco): ~150KB vs 5-10MB, modular/tree-shakeable
- **Vanilla TypeScript** (no React/Vue): ~20 property inputs don't justify framework overhead
- **electron-store**: Lightweight persistence for preferences and window state
- **CSS hot-swap**: Style-only changes update `<style>` tag in iframe without full reload
