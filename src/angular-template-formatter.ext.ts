import * as vscode from 'vscode';

import { AngularTemplateFormatter } from './angular-template-formatter';
import { ReplaceEdition, Edition, NullEdition } from './vscode-edition';

export class AngularTemplateFormatterExtension {
    private _enabled = true;

    get enabled(): boolean {
        return this._enabled;
    }

    set enabled(value: boolean) {
        this._enabled = value;
    }

    formatVscodeDocument(): Thenable<Edition> {
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

        const docText = doc.getText();
        let result = /template\s*:\s*`([\s\S]*?)`/.exec(docText);
        if (!result) {
            return NullEdition.asThenable;
        }

        const template = result[1];
        if (template.trim() === '') {
            return NullEdition.asThenable;
        }

        const templateStartOffset = docText.indexOf(template);
        const templateEndOffset = templateStartOffset + template.length;
        const templateStartPosition = doc.positionAt(templateStartOffset);
        const templateEndPosition = doc.positionAt(templateEndOffset);
        const templateRange = new vscode.Range(templateStartPosition, templateEndPosition);

        try {
            const formatter = new AngularTemplateFormatter();
            const formattedTemplate = formatter.work(template);
            return Promise.resolve(new ReplaceEdition(templateRange, '\n' + formattedTemplate + '\n    '));
        } catch (e) {
            vscode.window.showInformationMessage('parse template fail');
            return NullEdition.asThenable;
        }
    }
}
