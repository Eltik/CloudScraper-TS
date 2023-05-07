"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errors = exports.ParserError = exports.CloudflareError = exports.CaptchaError = exports.RequestError = void 0;
const os = __importStar(require("os"));
const original = __importStar(require("request-promise-core/errors"));
const http = __importStar(require("http"));
const EOL = os.EOL;
const ERROR_CODES = {
    // Non-standard 5xx server error HTTP status codes
    520: "Web server is returning an unknown error",
    521: "Web server is down",
    522: "Connection timed out",
    523: "Origin is unreachable",
    524: "A timeout occurred",
    525: "SSL handshake failed",
    526: "Invalid SSL certificate",
    527: "Railgun Listener to Origin Error",
    530: "Origin DNS error",
    // Other codes
    1000: "DNS points to prohibited IP",
    1001: "DNS resolution error",
    1002: "Restricted or DNS points to Prohibited IP",
    1003: "Access Denied: Direct IP Access Not Allowed",
    1004: "Host Not Configured to Serve Web Traffic",
    1005: "Access Denied: IP of banned ASN/ISP",
    1010: "The owner of this website has banned your access based on your browser's signature",
    1011: "Access Denied (Hotlinking Denied)",
    1012: "Access Denied",
    1013: "HTTP hostname and TLS SNI hostname mismatch",
    1016: "Origin DNS error",
    1018: "Domain is misconfigured",
    1020: "Access Denied (Custom Firewall Rules)",
};
ERROR_CODES[1006] = ERROR_CODES[1007] = ERROR_CODES[1008] = "Access Denied: Your IP address has been banned";
function format(lines) {
    return EOL + lines.join(EOL) + EOL + EOL;
}
const BUG_REPORT = format(["### Cloudflare may have changed their technique, or there may be a bug.", "### Bug Reports: https://github.com/codemanki/cloudscraper/issues", "### Check the detailed exception message that follows for the cause."]);
class CustomError extends original.RequestError {
    errorType;
    constructor(cause, options, response) {
        super(cause, options, response);
        this.errorType = 0;
    }
}
class RequestError extends CustomError {
    name;
    constructor(cause, options, response) {
        super(cause, options, response);
        this.name = "RequestError";
        this.errorType = 0;
    }
}
exports.RequestError = RequestError;
class CaptchaError extends CustomError {
    name;
    constructor(cause, options, response) {
        super(cause, options, response);
        this.name = "CaptchaError";
        this.errorType = 1;
    }
}
exports.CaptchaError = CaptchaError;
class CloudflareError extends CustomError {
    name;
    message;
    constructor(cause, options, response) {
        super(cause, options, response);
        this.name = "CloudflareError";
        this.errorType = 2;
        if (!isNaN(cause)) {
            const description = ERROR_CODES[cause] || http.STATUS_CODES[cause];
            if (description) {
                this.message = cause + ", " + description;
            }
        }
    }
}
exports.CloudflareError = CloudflareError;
class ParserError extends CustomError {
    name;
    message = "";
    constructor(cause, options, response) {
        super(cause, options, response);
        this.name = "ParserError";
        this.errorType = 3;
        this.message = BUG_REPORT + this.message;
    }
}
exports.ParserError = ParserError;
// The following errors originate from promise-core and its dependents.
// Give them an errorType for consistency.
original.StatusCodeError.prototype.errorType = 5;
original.TransformError.prototype.errorType = 6;
// Export our custom errors along with StatusCodeError, etc.
exports.errors = {
    ...original,
    RequestError: RequestError,
    CaptchaError: CaptchaError,
    ParserError: ParserError,
    CloudflareError: CloudflareError,
};
