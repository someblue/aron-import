import * as vscode from 'vscode';

export interface Edition {
    exec(edit: vscode.TextEditorEdit): any;
}

export class ReplaceEdition implements Edition {
    constructor(
        public range: vscode.Range,
        public text: string,
    ) { }

    exec(edit: vscode.TextEditorEdit): any {
        edit.replace(this.range, this.text);
    }
}
