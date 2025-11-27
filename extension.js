const fs = require('fs');
const path = require('path');

let vscode;
try {
    vscode = require('vscode');
} catch (err) {
    vscode = null;
}

/**
 * Точка входа расширения.
 * @param {import('vscode').ExtensionContext} context
 */
function activate(context) {
    if (!vscode) {
        console.error('VS Code API недоступен: активация возможна только внутри редактора.');
        return;
    }

    console.log('Offer Organizer extension is now active');

    const disposable = vscode.commands.registerCommand('offerOrganizer.organizeProject', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Рабочая папка не открыта. Откройте проект и повторите попытку.');
            return;
        }

        const root = workspaceFolders[0].uri.fsPath;

        const yes = 'Да, разложить';
        const no = 'Отмена';
        const answer = await vscode.window.showWarningMessage(
            'Перенести файлы из корня в папки по типам (css, js, img, video, fonts, data, audio, files, includes) и обновить пути в коде?',
            { modal: true },
            yes,
            no
        );
        if (answer !== yes) {
            return;
        }

        try {
            await organizeOffer(root, { findTextFiles: defaultFindTextFiles });
            vscode.window.showInformationMessage('Готово: файлы разложены по папкам, пути обновлены.');
        } catch (err) {
            console.error(err);
            vscode.window.showErrorMessage('Ошибка при раскладке файлов: ' + err.message);
        }
    });

    context.subscriptions.push(disposable);
}

function deactivate() { }

/**
 * Разложить файлы из корня по папкам и обновить пути в коде.
 * @param {string} root
 * @param {{findTextFiles?: (root: string) => Promise<Array<{fsPath: string}>>}} [options]
 */
async function organizeOffer(root, options = {}) {
    const findTextFiles = options.findTextFiles || defaultFindTextFiles;

    /** @type {{ oldName: string; newRel: string; newAbs: string; }[]} */
    const movedFiles = [];
    /** @type {{file: string; reason: string;}[]} */
    const skippedMissing = [];

    // Категории файлов для раскладки
    const imageExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico', '.bmp', '.avif'];
    const cssExts = ['.css'];
    const jsExts = ['.js', '.mjs', '.cjs'];
    const videoExts = ['.mp4', '.webm', '.ogv', '.mov', '.avi', '.mkv'];
    const audioExts = ['.mp3', '.wav', '.ogg', '.aac'];
    const fontExts = ['.woff', '.woff2', '.ttf', '.otf', '.eot'];
    const dataExts = ['.json', '.xml', '.csv'];

    // PHP include-файлы, которые нужно складывать в includes
    const includePhpNames = [
        'header.php',
        'footer.php',
        'config.php',
        'functions.php',
        'helper.php',
        'helpers.php',
        'form.php',
        'forms.php',
        'includes.php'
    ];
    const includePhpPrefixes = ['inc_', 'include_', 'partials_'];
    const includePhpSuffixes = ['_inc.php', '_include.php', '_part.php'];

    const entries = fs.readdirSync(root, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isFile()) continue;

        const fileName = entry.name;

        // Не трогаем служебные файлы и саму сборку расширения
        if (
            fileName.startsWith('.') ||
            fileName === 'extension.js' ||
            fileName === 'package.json' ||
            fileName === 'package-lock.json'
        ) {
            continue;
        }

        const ext = path.extname(fileName).toLowerCase();
        const base = path.basename(fileName);

        let targetFolder = null;

        if (cssExts.includes(ext)) {
            targetFolder = 'css';
        } else if (jsExts.includes(ext)) {
            targetFolder = 'js';
        } else if (imageExts.includes(ext)) {
            targetFolder = 'img';
        } else if (videoExts.includes(ext)) {
            targetFolder = 'video';
        } else if (audioExts.includes(ext)) {
            targetFolder = 'audio';
        } else if (fontExts.includes(ext)) {
            targetFolder = 'fonts';
        } else if (dataExts.includes(ext)) {
            targetFolder = 'data';
        } else if (ext === '.php' && isIncludePhp(base, includePhpNames, includePhpPrefixes, includePhpSuffixes)) {
            targetFolder = 'includes';
        } else if (ext === '.php') {
            targetFolder = null;
        } else if (ext === '.html' || ext === '.htm') {
            targetFolder = null;
        } else {
            targetFolder = 'files';
        }

        if (!targetFolder) continue;

        const oldAbs = path.join(root, fileName);
        const newDir = path.join(root, targetFolder);

        if (!fs.existsSync(newDir)) {
            fs.mkdirSync(newDir, { recursive: true });
        }

        const destinationAbs = getAvailablePath(newDir, fileName);
        if (oldAbs === destinationAbs) continue;

        const moveResult = safeMoveFile(oldAbs, destinationAbs);
        if (!moveResult.ok) {
            skippedMissing.push({ file: oldAbs, reason: moveResult.reason || 'Не удалось перенести' });
            continue;
        }

        const newRel = normalizePath(path.relative(root, destinationAbs));
        movedFiles.push({ oldName: fileName, newRel, newAbs: destinationAbs });
    }

    if (movedFiles.length === 0) {
        return;
    }

    if (skippedMissing.length > 0) {
        const msg = `Некоторые файлы пропущены (не найдены или заблокированы): ${skippedMissing.map(p => `${path.basename(p.file)} [${p.reason}]`).join(', ')}`;
        if (vscode?.window) {
            vscode.window.showWarningMessage(msg);
        } else {
            console.warn(msg);
        }
    }

    const textExts = ['.html', '.htm', '.php', '.css', '.js'];
    const allFiles = await findTextFiles(root);
    const sortedMoved = movedFiles.sort((a, b) => b.oldName.length - a.oldName.length);

    for (const uri of allFiles) {
        const filePath = uri.fsPath || uri;
        const ext = path.extname(filePath).toLowerCase();
        if (!textExts.includes(ext)) continue;

        let content = fs.readFileSync(filePath, 'utf8');
        const original = content;
        const fileDir = path.dirname(filePath);

        for (const moved of sortedMoved) {
            const escaped = escapeRegExp(moved.oldName);
            const newRelFromFile = normalizePath(path.relative(fileDir, moved.newAbs));

            // HTML: href="file", href='./file', href='../file'
            const reHref = new RegExp(`(href\\s*=\\s*["'])(?:\\.\\/?|\\.\\.\\/)*${escaped}(["'])`, 'gi');
            content = content.replace(reHref, `$1${newRelFromFile}$2`);

            // HTML/JS: src="file"
            const reSrc = new RegExp(`(src\\s*=\\s*["'])(?:\\.\\/?|\\.\\.\\/)*${escaped}(["'])`, 'gi');
            content = content.replace(reSrc, `$1${newRelFromFile}$2`);

            // CSS: url(file) / url('./file') / url(../file)
            const reUrl = new RegExp(`(url\\(\\s*["']?)(?:\\.\\/?|\\.\\.\\/)*${escaped}(["']?\\s*\\))`, 'gi');
            content = content.replace(reUrl, `$1${newRelFromFile}$2`);

            // JS/TS imports: import x from './file'; import './file'
            const reImportFrom = new RegExp(`(from\\s+["'])(?:\\.\\/?|\\.\\.\\/)*${escaped}(["'])`, 'gi');
            content = content.replace(reImportFrom, `$1${newRelFromFile}$2`);
            const reSideEffectImport = new RegExp(`(import\\s+["'])(?:\\.\\/?|\\.\\.\\/)*${escaped}(["'])`, 'gi');
            content = content.replace(reSideEffectImport, `$1${newRelFromFile}$2`);

            // CSS @import "file.css";
            const reCssImport = new RegExp(`(@import\\s+(?:url\\(\\s*)?["'])(?:\\.\\/?|\\.\\.\\/)*${escaped}(["']\\s*\\)?;)`, 'gi');
            content = content.replace(reCssImport, `$1${newRelFromFile}$2`);

            // PHP include/require
            const reInclude = new RegExp(`(include|include_once|require|require_once)\\s*\\(\\s*["'](?:\\.\\/?|\\.\\.\\/)*${escaped}["']\\s*\\)`, 'gi');
            content = content.replace(reInclude, (match, incWord) => `${incWord}("${newRelFromFile}")`);

            const reIncludeNoParen = new RegExp(`(include|include_once|require|require_once)\\s+["'](?:\\.\\/?|\\.\\.\\/)*${escaped}["']`, 'gi');
            content = content.replace(reIncludeNoParen, (match, incWord) => `${incWord} "${newRelFromFile}"`);

            // Свободные упоминания: 'file.ext' / "file.ext" / (file.ext)
            const reLoose = new RegExp(`(["'\\(\\s])(?:\\.\\/?|\\.\\.\\/)*${escaped}(["'\\)\\s])`, 'g');
            content = content.replace(reLoose, `$1${newRelFromFile}$2`);
        }

        if (content !== original) {
            fs.writeFileSync(filePath, content, 'utf8');
        }
    }
}

/**
 * Получить уникальный путь, если файл с таким именем уже есть в целевой папке.
 * @param {string} dir
 * @param {string} fileName
 */
function getAvailablePath(dir, fileName) {
    const ext = path.extname(fileName);
    const name = path.basename(fileName, ext);
    let candidate = fileName;
    let counter = 1;

    while (fs.existsSync(path.join(dir, candidate))) {
        candidate = `${name}-${counter}${ext}`;
        counter += 1;
    }

    return path.join(dir, candidate);
}

/**
 * Найти файлы для замены ссылок. Использует VS Code при наличии, иначе — обход файловой системы.
 * @param {string} root
 */
async function defaultFindTextFiles(root) {
    if (vscode?.workspace?.findFiles) {
        return vscode.workspace.findFiles('**/*', '**/{node_modules,.git,.vscode}/**');
    }

    return fallbackFindFiles(root);
}

/**
 * Обход файловой системы, чтобы получить список файлов (fallback для тестов вне VS Code).
 * @param {string} root
 */
async function fallbackFindFiles(root) {
    const result = [];
    const queue = [root];
    const skipDirs = new Set(['node_modules', '.git', '.vscode']);

    while (queue.length) {
        const current = queue.pop();
        const entries = fs.readdirSync(current, { withFileTypes: true });

        for (const entry of entries) {
            if (skipDirs.has(entry.name)) continue;

            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                queue.push(fullPath);
            } else {
                result.push({ fsPath: fullPath });
            }
        }
    }

    return result;
}

/**
 * Проверить, относится ли файл к include PHP.
 * @param {string} baseName
 * @param {string[]} names
 * @param {string[]} prefixes
 * @param {string[]} suffixes
 * @returns {boolean}
 */
function isIncludePhp(baseName, names, prefixes, suffixes) {
    const lower = baseName.toLowerCase();

    if (names.includes(lower)) return true;

    for (const p of prefixes) {
        if (lower.startsWith(p)) return true;
    }
    for (const s of suffixes) {
        if (lower.endsWith(s)) return true;
    }

    return false;
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizePath(p) {
    return p.replace(/\\/g, '/');
}

/**
 * Попробовать найти файл с тем же именем (без учета регистра) в каталоге.
 * @param {string} filePath
 */
function findCaseInsensitive(filePath) {
    const dir = path.dirname(filePath);
    const target = path.basename(filePath).toLowerCase();

    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isFile() && entry.name.toLowerCase() === target) {
                return path.join(dir, entry.name);
            }
        }
    } catch (err) {
        return null;
    }
    return null;
}

/**
 * Проверить, существует ли путь (файл или ссылка).
 */
function pathExists(p) {
    try {
        fs.accessSync(p, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * Безопасно перенести файл: сначала rename, при ENOENT/EXDEV/EPERM/EBUSY/EACCES — copy+unlink.
 * Пытается найти файл с совпадающим именем без учета регистра, если исходный пропал.
 * Делает повторную попытку copy+unlink после проверки существования директории назначения.
 * @param {string} from
 * @param {string} to
 * @returns {{ok: boolean; reason?: string}}
 */
function safeMoveFile(from, to) {
    // Подстраховка: если исходник отсутствует, попробуем найти по регистронезависимому имени
    if (!pathExists(from)) {
        const alt = findCaseInsensitive(from);
        if (!alt) {
            return { ok: false, reason: 'Файл не найден (исходник отсутствует)' };
        }
        from = alt;
    }

    const ensureDir = () => {
        const dir = path.dirname(to);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    };

    try {
        ensureDir();
        fs.renameSync(from, to);
        return { ok: true };
    } catch (err) {
        if (!err || !err.code) return { ok: false, reason: err ? err.message : 'Неизвестная ошибка' };

        // Попробовать снова через copy+unlink
        if (['ENOENT', 'EXDEV', 'EPERM', 'EBUSY', 'EACCES'].includes(err.code)) {
            try {
                ensureDir();
                // Если после первой попытки файл пропал, поискать reg-insensitive
                if (!pathExists(from)) {
                    const alt = findCaseInsensitive(from);
                    if (alt) from = alt;
                }
                fs.copyFileSync(from, to);
                fs.unlinkSync(from);
                return { ok: true };
            } catch (copyErr) {
                return { ok: false, reason: `${copyErr?.code || 'ERROR'}: ${copyErr?.message || 'copy/unlink failed'}` };
            }
        }

        return { ok: false, reason: `${err.code}: ${err.message}` };
    }
}

module.exports = {
    activate,
    deactivate,
    organizeOffer,
};
