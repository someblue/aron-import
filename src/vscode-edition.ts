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

export class NullEdition implements Edition {
    private static _instance = new NullEdition();

    static get instance(): NullEdition {
        return this._instance;
    }

    static get asThenable(): Thenable<NullEdition> {
        return Promise.resolve(this.instance);
    }

    exec(edit: vscode.TextEditorEdit): any {
    }
}