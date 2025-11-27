# Offer Organizer
[English](README.en.md) | Русский

## Как пользоваться
- Палитра команд: `Offer Organizer: Разложить файлы по папкам`.
- Горячая клавиша: `Ctrl+Alt+Shift+O` (когда курсор в редакторе).
- Подтвердите модальное окно. Раскладка идет только из корня открытого workspace; вложенные каталоги не трогаются.

## Что это и что умеет
- Раскладывает файлы из корня по папкам: `css`, `js`, `img`, `video`, `fonts`, `data`, `audio`, `files`, `includes`.
- Обновляет пути в `href`, `src`, `url(...)`, `import`, `@import`, `include/require` и свободных строковых упоминаниях.
- Не трогает корневые HTML и основные PHP-файлы (например, `index.php`); include-PHP складывает в `includes`.
- При совпадении имен добавляет суффикс `-1`, `-2`, … чтобы не перезаписать существующие файлы.
- Безопасный перенос: если `rename` не сработал, пытается `copy + unlink`, ищет файл без учета регистра и показывает причину пропуска.

## Установка
Готовый пакет:
```bash
code --install-extension offer-organizer-0.0.9.vsix
```
(VSIX лежит в корне репозитория).

Собрать самому:
```bash
npm install
npx vsce package
code --install-extension offer-organizer-0.0.9.vsix
```

## Как работает внутри
- Детектор типов по расширениям: CSS (`.css`), JS (`.js/.mjs/.cjs`), картинки (`.png/.jpg/.webp/.svg` и т.д.), видео, аудио, шрифты, данные (`.json/.xml/.csv`), include-PHP (`header.php`, `footer.php`, `config.php`, `functions.php`, `helper*.php`, `inc_*`, `*_inc.php` и др.), остальное — в `files`.
- После переноса пересчитываются относительные пути в `.html/.htm/.php/.css/.js`.
- Если перенос не удался, показывается предупреждение с причиной (файл отсутствует, заблокирован и т.п.).

## Автор
- BoostClicks — Евгений Леонтьев — https://t.me/boostclicks  
- BoostClicks — https://boostclicks.ru/

Лицензия: MIT (см. `LICENSE`).
