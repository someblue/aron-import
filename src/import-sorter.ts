'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { Path } from './path';
import { AronConfig } from './aron-config';

const projectAbsolutePathDepth = 2;

function stringContains(str: string, substr: string): boolean {
    return str.indexOf(substr) !== -1;
}

function convertToSlashPath(p: string): string {
    return p.replace(/\\/g, '/');
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

enum PathType {
    Untyped,
    Standrand,
    Library,
    ProjectAbsolute,
    ProjectRelative,
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

export class ImportSorter {
    private _enabled = true;

    get enabled(): boolean {
        return this._enabled;
    }

    set enabled(value: boolean) {
        this._enabled = value;
    }

    work(): Thenable<any> | null {
        if (!this.enabled) {
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
            const importSections = this.sortImportDeclares(importDeclares, aronConfig ? aronConfig.customLibraryPatterns : []);

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

    private moveCustomLibraryToLast(imports: ImportDeclare[], customLibraryPatterns: string[]): ImportDeclare[] {
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

    private sortImportDeclares(imports: ImportDeclare[], customLibraryPatterns: string[]): ImportDeclare[][] {
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
            this.moveCustomLibraryToLast(sortSpecificTypeImports(PathType.Library), customLibraryPatterns),
            sortSpecificTypeImports(PathType.ProjectAbsolute),
            sortSpecificTypeImports(PathType.ProjectRelative),
        ];
    }
}