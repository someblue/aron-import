'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';

const projectAbsolutePathDepth = 2;

let aronImportEnable = true;

enum PathType {
    Untyped,
    Standrand,
    Library,
    ProjectAbsolute,
    ProjectRelative,
}

function stringContains(str: string, substr: string): boolean {
    return str.indexOf(substr) !== -1;
}

function convertToSlashPath(p: string): string {
    return p.replace(/\\/g, '/');
}

export class AronConfig {
    public customLibraryPatterns: string[] = [];

    public static parse(filePath: string): Thenable<AronConfig> {
        return new Promise((resolve, reject) => {
            this.findFirstExistFile(this.aronConfigPossibleLocation(filePath))
                .then(
                    aronConfigFilePath => {
                        if (!aronConfigFilePath) {
                            resolve(undefined);
                        }
                        fs.readFile(aronConfigFilePath, (err, data) => {
                            if (err) {
                                reject(err);
                            }
                            const configRawObject = JSON.parse(data.toString());
                            const aronConfig = new AronConfig();
                            aronConfig.customLibraryPatterns = configRawObject.customLibraryPatterns;
                            resolve(aronConfig);
                        });
                    },
                    err => {
                        reject(err);
                    },
            );
        });
    }

    private static aronConfigPossibleLocation(filePath: string): string[] {
        let files = [];
        while (filePath) {
            var dir = filePath.substring(0, filePath.lastIndexOf('/'));
            if (dir === '') {
                break;
            }
            files.push(dir + '/aron.json');
            filePath = dir;
        }
        return files;
    }

    private static findFirstExistFile(filePaths: string[]): Thenable<string> {
        return new Promise((resolve, reject) => {
            let failCount = 0;
            let hasFound = false;
            filePaths.forEach(fp => {
                fs.access(fp, fs.constants.R_OK, (err) => {
                    if (hasFound) {
                        return;
                    }
                    if (!err) {
                        hasFound = true;
                        resolve(fp);
                    }
                    failCount++;
                    if (failCount >= filePaths.length) {
                        resolve('');
                    }
                });
            });
        });
    }
}

class Path {
    private segs: string[] = [];
    private isDir = false;

    constructor(path: string) {
        if (path.endsWith('/')) {
            this.isDir = true;
            path = path.substring(0, path.length - 1);
        }
        this.segs = path.split('/');
    }

    private removeLastSeg() {
        this.segs.splice(-1, 1);
    }

    public join(relPath: string) {
        relPath.split('/').map((seg, i) => {
            if (seg === '.') {
                if (this.isDir) {
                    return;
                }
                this.removeLastSeg();
                this.isDir = true;
                return;
            }
            if (seg === '..') {
                if (this.isDir) {
                    this.removeLastSeg();
                    return;
                }
                this.removeLastSeg(); // file to dir
                this.removeLastSeg(); // dir to parent dir
                this.isDir = true;
                return;
            }
            if (seg.startsWith('.')) {
                throw new Error('invalid path, should be . or ..');
            }
            this.segs.push(seg);
        });
        if (!relPath.endsWith('/') && !relPath.endsWith('.')) {
            this.isDir = false;
        }
    }

    public toString(): string {
        return this.segs.join('/') + (this.isDir ? '/' : '');
    }
}

function pathJoin(absPath: string, relPath: string): string {
    let p = new Path(absPath);
    p.join(relPath);
    return p.toString();
}

function stringCommonPrefix(a: string, b: string): string {
    let equalCharIndex = -1;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a.charAt(i) === b.charAt(i)) {
            equalCharIndex = i;
        } else {
            break;
        }
    }
    if (equalCharIndex === -1) {
        return '';
    }
    return a.substring(0, equalCharIndex + 1);
}

class ImportDeclare {
    public text = '';
    public tokens = '';
    public path = '';
    public type = PathType.Untyped;

    public normalizePath(fileAbsPath: string) {
        if (stringContains(this.path, '@angular')) {
            this.type = PathType.Standrand;
            if (this.path.indexOf('@angular') > 0) {
                this.path = this.path.substring(this.path.indexOf('@angular'));
            }
            return;
        }

        if (stringContains(this.path, 'node_modules/') ||
            (!this.path.startsWith('.') && !this.path.startsWith('app/'))) {
            this.type = PathType.Library;
            if (stringContains(this.path, 'node_modules/')) {
                this.path = this.path.substring(this.path.indexOf('node_modules/') + 'node_modules/'.length);
            }
            return;
        }

        if (this.path.startsWith('app/')) {
            this.type = PathType.ProjectAbsolute;
            return;
        }

        // must starts with ./ or ../
        const absPath = pathJoin(fileAbsPath, this.path);
        if (!stringContains(absPath, '/app/')) {
            throw new Error(`invalid path, path [${absPath}] not contains /app/`);
        }
        let commonPrefixPath = stringCommonPrefix(absPath, fileAbsPath);
        const commonPrefixPathDepth = commonPrefixPath.substring(commonPrefixPath.indexOf('/app/') + 1).split('/').length - 1;
        if (commonPrefixPathDepth <= projectAbsolutePathDepth) {
            this.type = PathType.ProjectAbsolute;
            this.path = absPath.substring(absPath.indexOf('/app/') + 1);
            return;
        }

        this.type = PathType.ProjectRelative;
        return;
    }
}

function moveCustomLibraryToLast(imports: ImportDeclare[], customLibraryPatterns: string[]): ImportDeclare[] {
    // const customLibraryPatterns = vscode.workspace.getConfiguration('aron.import').get<string[]>('customLibraryPatterns', []);
    const customLibraryRegexs = customLibraryPatterns.map(e => new RegExp(e));
    let thirdPartyLibrarys: ImportDeclare[] = [];
    let customLibrarys: ImportDeclare[] = [];
    imports.forEach(e => {
        const isCustomLibrary = customLibraryRegexs.some(reg => reg.test(e.path));
        if (isCustomLibrary) {
            customLibrarys.push(e);
        } else {
            thirdPartyLibrarys.push(e);
        }
    });
    return [
        ...thirdPartyLibrarys,
        ...customLibrarys,
    ];
}

function sortImportDeclares(imports: ImportDeclare[], customLibraryPatterns: string[]): ImportDeclare[][] {
    const sortSpecificTypeImports = (type: PathType) => {
        return imports.filter(e => e.type === type).sort((a, b) => {
            if (a.path < b.path) {
                return -1;
            } else if (a.path > b.path) {
                return 1;
            }
            return 0;
        });
    };
    return [
        sortSpecificTypeImports(PathType.Standrand),
        moveCustomLibraryToLast(sortSpecificTypeImports(PathType.Library), customLibraryPatterns),
        sortSpecificTypeImports(PathType.ProjectAbsolute),
        sortSpecificTypeImports(PathType.ProjectRelative),
    ];
}

function work(): Thenable<any> | null {
    if (!aronImportEnable) {
        return null;
    }

    if (!vscode.window.activeTextEditor) {
        vscode.window.showInformationMessage('no active editor');
        return null;
    }

    const doc = vscode.window.activeTextEditor.document;

    if (doc.languageId !== 'typescript') {
        return null;
    }

    let importDeclares: ImportDeclare[] = [];
    let startPos: vscode.Position;
    let endPos: vscode.Position;
    for (let i = 0; i < doc.lineCount; i++) {
        const line = doc.lineAt(i);
        if (line.text.trim() === '') {
            continue;
        }

        const re = /import (.*) from ['"]([a-zA-Z0-9@/\-_\.]*)['"]/;
        const result = re.exec(line.text);
        if (!result) {
            break;
        }

        if (i === 0) {
            startPos = line.range.start;
        }
        endPos = line.range.end;
        let importDeclare = new ImportDeclare();
        importDeclare.text = line.text;
        importDeclare.tokens = result[1];
        importDeclare.path = result[2];
        importDeclares.push(importDeclare);
    }

    if (!importDeclares.length) {
        return null;
    }

    const docPath = convertToSlashPath(doc.uri.fsPath);
    return AronConfig.parse(docPath).then(aronConfig => {
        if (!vscode.window.activeTextEditor) {
            return false;
        }

        importDeclares.forEach(e => e.normalizePath(docPath));
        const importSections = sortImportDeclares(importDeclares, aronConfig ? aronConfig.customLibraryPatterns : []);

        return vscode.window.activeTextEditor.edit(editBuilder => {
            editBuilder.replace(
                new vscode.Range(startPos, endPos),
                importSections
                    .filter(sec => sec.length > 0)
                    .map(sec => {
                        return sec.map(e => `import ${e.tokens} from '${e.path}';`).join('\n');
                    })
                    .join('\n\n'));
        });
    });
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "aron-import" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    const aronImportSortCommand = vscode.commands.registerCommand('extension.aron.import.sort', () => {
        work();
    });

    const aronImportEnableCommand = vscode.commands.registerCommand('extension.aron.import.enable', () => {
        aronImportEnable = true;
    });

    const aronImportDisableCommand = vscode.commands.registerCommand('extension.aron.import.disable', () => {
        aronImportEnable = false;
    });

    const onWillSaveTextDocumentEvent = vscode.workspace.onWillSaveTextDocument(e => {
        let workResult = work();
        if (workResult) {
            e.waitUntil(workResult);
        }
    });

    console.log('on will save register');

    context.subscriptions.push(
        aronImportSortCommand,
        aronImportEnableCommand,
        aronImportDisableCommand,
        onWillSaveTextDocumentEvent,
    );
}

// this method is called when your extension is deactivated
export function deactivate() {
}