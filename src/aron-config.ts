import * as fs from 'fs';

export class AronConfig {
    public customLibraryPatterns: string[] = [];

    public static parse(filePath: string): Thenable<AronConfig> {
        return new Promise((resolve, reject) => {
            this.findFirstExistFile(this.aronConfigPossibleLocation(filePath))
                .then(
                    aronConfigFilePath => {
                        if (!aronConfigFilePath) {
                            resolve(undefined);
                        }
                        fs.readFile(aronConfigFilePath, (err, data) => {
                            if (err) {
                                reject(err);
                            }
                            const configRawObject = JSON.parse(data.toString());
                            const aronConfig = new AronConfig();
                            aronConfig.customLibraryPatterns = configRawObject.customLibraryPatterns;
                            resolve(aronConfig);
                        });
                    },
                    err => {
                        reject(err);
                    },
            );
        });
    }

    private static aronConfigPossibleLocation(filePath: string): string[] {
        let files = [];
        while (filePath) {
            var dir = filePath.substring(0, filePath.lastIndexOf('/'));
            if (dir === '') {
                break;
            }
            files.push(dir + '/aron.json');
            filePath = dir;
        }
        return files;
    }

    private static findFirstExistFile(filePaths: string[]): Thenable<string> {
        return new Promise((resolve, reject) => {
            let failCount = 0;
            let hasFound = false;
            filePaths.forEach(fp => {
                fs.access(fp, fs.constants.R_OK, (err) => {
                    if (hasFound) {
                        return;
                    }
                    if (!err) {
                        hasFound = true;
                        resolve(fp);
                    }
                    failCount++;
                    if (failCount >= filePaths.length) {
                        resolve('');
                    }
                });
            });
        });
    }
}
