import * as vscode from 'vscode';

export class Logger {
    private static readonly channelName = 'Aron';

    private static channel: vscode.OutputChannel;

    private static tryCreateChannel() {
        if (!this.channel) {
            this.channel = vscode.window.createOutputChannel(this.channelName);
        }
    }

    private static prefix(text: string): string {
        const now = new Date();
        return `[${now.getHours()}:${now.getMinutes()}:${now.getSeconds()} ${text}]`;
    }

    static info(content: string) {
        this.tryCreateChannel();
        this.channel.appendLine(`${this.prefix('INFO ')} ${content}`);
    }

    static error(content: string) {
        this.tryCreateChannel();
        this.channel.appendLine(`${this.prefix('ERROR')} ${content}`);
    }
}