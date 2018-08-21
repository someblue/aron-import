'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { ImportSorter } from './import-sorter';
import { AngularTemplateFormatterExtension } from './angular-template-formatter.ext';
import { Edition } from './vscode-edition';
import { Logger } from './logger/logger';

function execEditions(...editionThenables: Thenable<Edition>[]): Thenable<any> | null {
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

function displayErrorMessage() {
    vscode.window.showErrorMessage('Aron encounter error, check more details on View -> Output -> Aron');
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    const importSorter = new ImportSorter();
    const angularTemplateFormatterExt = new AngularTemplateFormatterExtension();

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    const aronImportSortCommand = vscode.commands.registerCommand('extension.aronImportSort', () => {
        try {
            execEditions(importSorter.work());
        } catch (e) {
            Logger.error(`error on execute aronImportSort command [${e}]`);
            displayErrorMessage();
        }
    });

    const aronImportEnableCommand = vscode.commands.registerCommand('extension.aronImportEnable', () => {
        importSorter.enabled = true;
    });

    const aronImportDisableCommand = vscode.commands.registerCommand('extension.aronImportDisable', () => {
        importSorter.enabled = false;
    });

    const angularTemplateFormatCommand = vscode.commands.registerCommand('extension.aronTemplateFormat', () => {
        try {
            execEditions(angularTemplateFormatterExt.formatVscodeDocument());
        } catch (e) {
            Logger.error(`error on execute aronTemplateFormat command [${e}]`);
            displayErrorMessage();
        }
    });

    const angularTemplateFormatterEnableCommand = vscode.commands.registerCommand('extension.aronTemplateFormatEnable', () => {
        angularTemplateFormatterExt.enabled = true;
    });

    const angularTemplateFormatterDisableCommand = vscode.commands.registerCommand('extension.aronTemplateFormatDisable', () => {
        angularTemplateFormatterExt.enabled = false;
    });

    const onWillSaveTextDocumentEvent = vscode.workspace.onWillSaveTextDocument(e => {
        try {
            Logger.info(`detect file [${e.document.fileName}] save event`);

            let thenable = execEditions(
                angularTemplateFormatterExt.formatVscodeDocument(),
                importSorter.work(),
            );
            if (thenable) {
                e.waitUntil(thenable);
            }
        } catch (e) {
            Logger.error(`error on save document event [${e}]`);
            displayErrorMessage();
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

    Logger.info('aron has activated');
}

// this method is called when your extension is deactivated
export function deactivate() {
}
