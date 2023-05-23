import * as zlib from "zlib";
import { decompress } from "brotli";

interface Brotli {
    isAvailable: boolean;
    decompress?: (buf: Buffer) => Buffer;
    optional?: (require: NodeRequire) => boolean;
}

const brotli: Brotli = {
    isAvailable: false,
};


const optional = (require: NodeRequire): boolean => {
    try {
        brotli.decompress = (buf: Buffer): Buffer => {
            // eslint-disable-next-line no-undef
            return Buffer.from(decompress(buf));
        };
        return typeof decompress === "function";
    } catch (error: any) {
        if (error.code !== "MODULE_NOT_FOUND") {
            throw error;
        }
    }
    return false;
};


// Check for node's built-in brotli support
if (typeof zlib.brotliDecompressSync === "function") {
    brotli.decompress = (buf: Buffer): Buffer => {
        return zlib.brotliDecompressSync(buf);
    };
    brotli.isAvailable = true;
// eslint-disable-next-line no-undef
} else if (optional(require)) {
    brotli.isAvailable = true;
}

export default brotli;

