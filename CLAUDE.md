# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start              # Build dev + start local server on port 8081
npm test               # Run full test suite (Mocha)
npm run lint           # ESLint check
npm run lint_fix       # Auto-fix ESLint issues
npm run build_dev      # Build engine and website with sourcemaps → build/website_dev/
npm run build_engine   # Build minified global bundle (o3dv.min.js)
npm run build_engine_module  # Build ES module + TypeScript declarations (Rollup)
npm run build_website  # Build website bundle only
npm run create_dist    # Full dist: docs + build + lint + test
```

There is no built-in way to run a single test file; Mocha runs the full suite via `test/test.js`. Individual test files can be invoked directly with `npx mocha test/tests/<file>` after the globals in `test/utils/globals.js` are loaded, but the easiest approach is to run the full suite.

## Architecture

The project has two distinct targets built from a shared codebase:

1. **Engine library** (`source/engine/`) — a standalone 3D engine published to npm. Public API is the single `source/engine/main.js` which re-exports everything under the `OV` namespace.
2. **Website** (`source/website/`) — a full web application built on top of the engine.

### Engine layer (`source/engine/`)

| Directory | Purpose |
|-----------|---------|
| `core/` | Base utilities: `IsDefined`, `EventNotifier`, `TaskRunner`, localization |
| `geometry/` | Math primitives: `Coord2D/3D`, `Matrix`, `Quaternion`, `Box3D`, `Octree`, `Transformation`, `Tween` |
| `model/` | 3D data structures: `Model`, `Mesh`, `Node`, `Material`, `Color`, `Property`, topology, units |
| `import/` | Format parsers — one file per format (3dm, 3ds, 3mf, amf, bim, dae, fbx, fcstd, glTF, IFC, IGES, STEP, STL, OBJ, OFF, PLY, VRML, SVG) |
| `export/` | Format writers — obj, stl, ply, off, gltf, 3dm, bim |
| `io/` | `BinaryReader/Writer`, file utilities, buffer utils, external library loading |
| `threejs/` | Bridge to Three.js: `ThreeConverter`, `ThreeModelLoader`, `ThreeUtils` |
| `viewer/` | UI/interaction: `Viewer`, `Camera`, `Navigation`, `ViewerModel`, `SectionModel`, `ShadingModel` |
| `parameters/` | URL and configuration parameter parsing |

**Data flow:** File input → format-specific Importer → `Model` (intermediate representation) → `ThreeConverter` → Three.js scene → `Viewer` canvas. Exporters consume the `Model` directly.

### Website layer (`source/website/`)

`website.js` is the main application controller. Other notable files: `sidebar.js` (settings panel), `navigator.js` (model tree), `dialog.js` (modals), `measuretool.js` (measurement UI).

### Tests (`test/`)

`test/test.js` is the Mocha entry point. It calls `SetGlobals()` from `test/utils/globals.js` to mock browser APIs (FileReader, Blob, document, atob) before importing 24+ test suites from `test/tests/`. Sample 3D model files used as fixtures live in `test/testfiles/`.

### Build tooling (`tools/`)

- `rollup.js` — Rollup config for the ES module build; `three` and `fflate` are external peers
- `local_server.js` — Node.js dev server; supports `/local-model?path=...` for loading local files
- Several Python scripts for docs generation, icon font generation, packaging, and auto-generating `main.js` exports

## ESLint conventions

ES2021, browser globals, plus these project globals: `OV`, `THREE`, `fflate`, `Pickr`, `DracoDecoderModule`, `rhino3dm`, `WebIFC`, `occtimportjs`. Rules enforce: semicolons, `const`/`let` (no `var`), no `eval`, `prefer-arrow-callback`, single quotes.

## Distribution

- Global bundle: `o3dv.min.js` (exposes `OV` on `window`)
- ES module: built with Rollup, ships TypeScript declarations
- Peer dependencies (not bundled): `three`, `fflate`
