'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { Path } from './path';
import { AronConfig } from './aron-config';
import { ReplaceEdition, Edition, NullEdition } from './vscode-edition';

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
    public isComment = false;
    public hasTokenPart = false;
    public text = '';
    public tokens = '';
    public path = '';
    public type = PathType.Untyped;

    public static parse(text: string): ImportDeclare | undefined {
        let importDeclare = new ImportDeclare();

        const hasTokenPartRe = /import (.*) from ['"]([a-zA-Z0-9@/\-_\.]*)['"]/;
        const hasTokenPartResult = hasTokenPartRe.exec(text);
        if (hasTokenPartResult) {
            importDeclare.hasTokenPart = false;
            importDeclare.tokens = hasTokenPartResult[1];
            importDeclare.path = hasTokenPartResult[2];
        }

        const noTokenPartRe = /import\s+['"]([a-zA-Z0-9@/\-_\.]*)['"]/;
        const noTokenPartResult = noTokenPartRe.exec(text);
        if (noTokenPartResult) {
            importDeclare.hasTokenPart = true;
            importDeclare.path = noTokenPartResult[1];
        }

        if (!hasTokenPartResult && !noTokenPartResult) {
            return undefined;
        }

        importDeclare.text = text;
        if (text.trim().startsWith("//")) {
            importDeclare.isComment = true;
        }
        return importDeclare;
    }

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

    public render(): string {
        let text = this.hasTokenPart ?
            `import '${this.path}';` :
            `import ${this.tokens} from '${this.path}';`;
        if (this.isComment) {
            text = '// ' + text;
        }
        return text;
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

    work(): Thenable<Edition> {
        if (!this.enabled) {
            return NullEdition.asThenable;
        }

        if (!vscode.window.activeTextEditor) {
            vscode.window.showInformationMessage('no active editor');
            return NullEdition.asThenable;
        }

        const doc = vscode.window.activeTextEditor.document;

        if (doc.languageId !== 'typescript') {
            return NullEdition.asThenable;
        }

        let importDeclares: ImportDeclare[] = [];
        let startPos: vscode.Position;
        let endPos: vscode.Position;
        for (let i = 0; i < doc.lineCount; i++) {
            const line = doc.lineAt(i);
            if (line.text.trim() === '') {
                continue;
            }

            const importDeclare = ImportDeclare.parse(line.text);
            if (!importDeclare) {
                break;
            }

            if (i === 0) {
                startPos = line.range.start;
            }
            endPos = line.range.end;

            importDeclares.push(importDeclare);
        }

        if (!importDeclares.length) {
            return NullEdition.asThenable;
        }

        const docPath = convertToSlashPath(doc.uri.fsPath);
        return AronConfig.parse(docPath).then(aronConfig => {
            if (!vscode.window.activeTextEditor) {
                return NullEdition.instance;
            }

            importDeclares.forEach(e => e.normalizePath(docPath));
            const importSections = this.sortImportDeclares(importDeclares, aronConfig ? aronConfig.customLibraryPatterns : []);
            const importSectionsString = importSections
                .filter(sec => sec.length > 0)
                .map(sec => {
                    return sec.map(e => e.render()).join('\n');
                })
                .join('\n\n');

            return new ReplaceEdition(new vscode.Range(startPos, endPos), importSectionsString);
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
