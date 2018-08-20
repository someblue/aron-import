import * as vscode from 'vscode';

import { AngularTemplateFormatter } from './angular-template-formatter'

export class AngularTemplateFormatterExtension {
    private _enabled = false;

    get enabled(): boolean {
        return this._enabled;
    }

    set enabled(value: boolean) {
        this._enabled = value;
    }

    formatVscodeDocument() {
        if (!this.enabled) {
            return;
        }

        if (!vscode.window.activeTextEditor) {
            vscode.window.showInformationMessage('no active editor');
            return;
        }

        const doc = vscode.window.activeTextEditor.document;
        if (doc.languageId !== 'typescript') {
            return;
        }

        const docText = doc.getText();
        let result = /template\s*:\s*`([\s\S]*)`/.exec(docText);
        if (!result) {
            return;
        }

        const template = result[1];
        const templateStartOffset = docText.indexOf(template);
        const templateEndOffset = templateStartOffset + template.length;
        const templateStartPosition = doc.positionAt(templateStartOffset);
        const templateEndPosition = doc.positionAt(templateEndOffset);
        const templateRange = new vscode.Range(templateStartPosition, templateEndPosition);

        try {
            const formatter = new AngularTemplateFormatter();
            const formattedTemplate = formatter.work(template);
            vscode.window.activeTextEditor.edit(editBuilder => {
                editBuilder.replace(templateRange, '\n' + formattedTemplate + '\n    ');
            });
        } catch (e) {
            vscode.window.showInformationMessage('parse template fail');
        }
    }
}
