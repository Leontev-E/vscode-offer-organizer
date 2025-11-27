# Offer Organizer
English | [Русский](README.md)

VS Code extension that sorts project root files by type and automatically rewrites code references.

## Features
- Moves files into: `css`, `js`, `img`, `video`, `fonts`, `data`, `audio`, `files`, `includes`.
- Updates links in `href`, `src`, `url(...)`, `import`, `@import`, `include/require`, and loose string mentions.
- Leaves root HTML and main PHP files (e.g., `index.php`) untouched; PHP includes go to `includes`.
- Handles name collisions by appending `-1`, `-2`, … to avoid overwrites.
- Safe move: retries with `copy + unlink`, does case-insensitive lookup, and reports skip reasons.

## Installation
### Prebuilt package
```bash
code --install-extension offer-organizer-0.0.8.vsix
```
(the VSIX is in the repo root).

### Build yourself
```bash
npm install
npx vsce package
code --install-extension offer-organizer-0.0.8.vsix
```

## Usage
- Command palette: `Offer Organizer: Разложить файлы по папкам`.
- Hotkey: `Ctrl+Alt+Shift+O` (when the editor is focused).
- Confirm the modal dialog before running.
- Only sorts files from the workspace root; nested directories are untouched.

## How it works
- Type detection by extension: CSS (`.css`), JS (`.js/.mjs/.cjs`), images (`.png/.jpg/.webp/.svg`, etc.), video, audio, fonts, data (`.json/.xml/.csv`), include-PHP (`header.php`, `footer.php`, `config.php`, `functions.php`, `helper*.php`, `inc_*`, `*_inc.php`, etc.), everything else → `files`.
- After moving, relative paths are recalculated for every text file (`.html/.htm/.php/.css/.js`).
- If a move fails, a warning shows the reason (missing or locked file, etc.).

## Author
- BoostClicks — Evgeny Leontyev — https://t.me/boostclicks  
- BoostClicks — https://boostclicks.ru/

License: MIT (see `LICENSE`).
