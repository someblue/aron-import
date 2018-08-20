'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { ImportSorter } from './import-sorter';
import { AngularTemplateFormatterExtension } from './angular-template-formatter.ext';
import { Edition } from './vscode-edition';

function execEditions(...results: Array<Thenable<Edition | null> | null>): Thenable<any> | null {
    let editionThenables: Thenable<Edition | null>[] = [];
    results.forEach(e => {
        if (e) {
            editionThenables.push(e);
        }
    });

    if (editionThenables.length === 0) {
        return null;
    }

    return Promise.all(editionThenables)
        .then(editions => {
            if (!vscode.window.activeTextEditor) {
                return false;
            }
            return vscode.window.activeTextEditor.edit(editBuilder => {
                editions.forEach(e => e && e.exec(editBuilder));
            });
        });
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "aron-import" is now active!');

    const importSorter = new ImportSorter();
    const angularTemplateFormatterExt = new AngularTemplateFormatterExtension();

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    const aronImportSortCommand = vscode.commands.registerCommand('extension.aronImportSort', () => {
        execEditions(importSorter.work());
    });

    const aronImportEnableCommand = vscode.commands.registerCommand('extension.aronImportEnable', () => {
        importSorter.enabled = true;
    });

    const aronImportDisableCommand = vscode.commands.registerCommand('extension.aronImportDisable', () => {
        importSorter.enabled = false;
    });

    const angularTemplateFormatCommand = vscode.commands.registerCommand('extension.aronTemplateFormat', () => {
        execEditions(angularTemplateFormatterExt.formatVscodeDocument());
    });

    const angularTemplateFormatterEnableCommand = vscode.commands.registerCommand('extension.aronTemplateFormatEnable', () => {
        angularTemplateFormatterExt.enabled = true;
    });

    const angularTemplateFormatterDisableCommand = vscode.commands.registerCommand('extension.aronTemplateFormatDisable', () => {
        angularTemplateFormatterExt.enabled = false;
    });

    const onWillSaveTextDocumentEvent = vscode.workspace.onWillSaveTextDocument(e => {
        let thenable = execEditions(
            angularTemplateFormatterExt.formatVscodeDocument(),
            importSorter.work(),
        );
        if (thenable) {
            e.waitUntil(thenable);
        }
    });

    context.subscriptions.push(
        aronImportSortCommand,
        aronImportEnableCommand,
        aronImportDisableCommand,
        angularTemplateFormatCommand,
        angularTemplateFormatterEnableCommand,
        angularTemplateFormatterDisableCommand,
        onWillSaveTextDocumentEvent,
    );
}

// this method is called when your extension is deactivated
export function deactivate() {
}
