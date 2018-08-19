export class Path {
    private segs: string[] = [];
    private isDir = false;

    constructor(path: string) {
        if (path.endsWith('/')) {
            this.isDir = true;
            path = path.substring(0, path.length - 1);
        }
        this.segs = path.split('/');
    }

    private removeLastSeg() {
        this.segs.splice(-1, 1);
    }

    public join(relPath: string) {
        relPath.split('/').map((seg, i) => {
            if (seg === '.') {
                if (this.isDir) {
                    return;
                }
                this.removeLastSeg();
                this.isDir = true;
                return;
            }
            if (seg === '..') {
                if (this.isDir) {
                    this.removeLastSeg();
                    return;
                }
                this.removeLastSeg(); // file to dir
                this.removeLastSeg(); // dir to parent dir
                this.isDir = true;
                return;
            }
            if (seg.startsWith('.')) {
                throw new Error('invalid path, should be . or ..');
            }
            this.segs.push(seg);
        });
        if (!relPath.endsWith('/') && !relPath.endsWith('.')) {
            this.isDir = false;
        }
    }

    public toString(): string {
        return this.segs.join('/') + (this.isDir ? '/' : '');
    }
}
