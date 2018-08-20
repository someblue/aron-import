export class StringUtil {
    static occurCount(str: string, char: string): number {
        if (char.length !== 1) {
            throw new Error('[StringUtil.OccurCount] the length of char must be 1');
        }
        let count = 0;
        for (let i = 0; i < str.length; i++) {
            if (str[i] === char) {
                count++;
            }
        }
        return count;
    }

    static generate(repeat: number, text: string = ' '): string {
        return new Array(repeat).fill(text).join('');
    }
}