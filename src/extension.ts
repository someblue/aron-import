'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { ImportSorter } from './import-sorter';
import { AngularTemplateFormatter } from './angular-template-formatter';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "aron-import" is now active!');

    const importSorter = new ImportSorter();
    const angularTemplateFormatter = new AngularTemplateFormatter();

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    const aronImportSortCommand = vscode.commands.registerCommand('extension.aron.import.sort', () => {
        importSorter.work();
    });

    const aronImportEnableCommand = vscode.commands.registerCommand('extension.aron.import.enable', () => {
        importSorter.enabled = true;
    });

    const aronImportDisableCommand = vscode.commands.registerCommand('extension.aron.import.disable', () => {
        importSorter.enabled = false;
    });

    const angularTemplateFormatCommand = vscode.commands.registerCommand('extension.aron.template.format', () => {
        angularTemplateFormatter.formatVscodeDocument();
    });

    const angularTemplateFormatterEnableCommand = vscode.commands.registerCommand('extension.aron.template.format.enable', () => {
        angularTemplateFormatter.enabled = true;
    });

    const angularTemplateFormatterDisableCommand = vscode.commands.registerCommand('extension.aron.template.format.disable', () => {
        angularTemplateFormatter.enabled = false;
    });

    const onWillSaveTextDocumentEvent = vscode.workspace.onWillSaveTextDocument(e => {
        angularTemplateFormatter.formatVscodeDocument();

        let workResult = importSorter.work();
        if (workResult) {
            e.waitUntil(workResult);
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