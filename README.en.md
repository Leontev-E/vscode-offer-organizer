# Offer Organizer
English | [Русский](README.md)

## How to use
- Command palette: `Offer Organizer: Разложить файлы по папкам` (sort files by folders).
- Hotkey: `Ctrl+Alt+Shift+O` (when the editor is focused).
- Confirm the modal dialog. Sorting runs only from the workspace root; nested folders stay untouched.

## What it is and what it does
- Sorts root files into folders: `css`, `js`, `img`, `video`, `fonts`, `data`, `audio`, `files`, `includes`.
- Rewrites references in `href`, `src`, `url(...)`, `import`, `@import`, `include/require`, and loose string mentions.
- Leaves root HTML and main PHP files (e.g., `index.php`) untouched; PHP includes go to `includes`.
- Handles name collisions by appending `-1`, `-2`, … to avoid overwriting.
- Safe move: if `rename` fails, it retries with `copy + unlink`, does a case-insensitive lookup, and reports skip reasons.

## Installation
Prebuilt package:
```bash
code --install-extension offer-organizer-0.0.9.vsix
```
(the VSIX is in the repo root).

Build yourself:
```bash
npm install
npx vsce package
code --install-extension offer-organizer-0.0.9.vsix
```

## How it works under the hood
- Type detection by extension: CSS (`.css`), JS (`.js/.mjs/.cjs`), images (`.png/.jpg/.webp/.svg`, etc.), video, audio, fonts, data (`.json/.xml/.csv`), include-PHP (`header.php`, `footer.php`, `config.php`, `functions.php`, `helper*.php`, `inc_*`, `*_inc.php`, etc.), everything else → `files`.
- After moving, relative paths are recalculated in `.html/.htm/.php/.css/.js`.
- If a move fails, a warning shows the reason (missing/locked file, etc.).

## Author
- BoostClicks — Evgeny Leontyev — https://t.me/boostclicks  
- BoostClicks — https://boostclicks.ru/

License: MIT (see `LICENSE`).
