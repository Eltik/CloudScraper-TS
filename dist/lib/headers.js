"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.caseless = exports.getDefaultHeaders = void 0;
const browsers_json_1 = require("./browsers.json");
const brotli_1 = __importDefault(require("./brotli"));
function random(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function getChromeHeaders(options) {
    const { headers } = options;
    headers["User-Agent"] = random(options["User-Agent"]);
    if (!brotli_1.default.isAvailable && headers["Accept-Encoding"]) {
        headers["Accept-Encoding"] = headers["Accept-Encoding"].replace(/,?\s*\bbr\b\s*/i, "");
    }
    return headers;
}
function getDefaultHeaders(defaults) {
    const headers = getChromeHeaders(random(browsers_json_1.chrome));
    return { ...defaults, ...headers };
}
exports.getDefaultHeaders = getDefaultHeaders;
function caseless(headers) {
    const result = {};
    Object.keys(headers).forEach((key) => {
        result[key.toLowerCase()] = headers[key];
    });
    return result;
}
exports.caseless = caseless;
