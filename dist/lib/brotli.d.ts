/// <reference types="node" />
/// <reference types="node" />
interface Brotli {
    isAvailable: boolean;
    decompress?: (buf: Buffer) => Buffer;
    optional?: (require: NodeRequire) => boolean;
}
declare const brotli: Brotli;
export default brotli;
