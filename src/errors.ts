import * as os from 'os';
import * as original from 'request-promise-core/errors';
import * as http from 'http';

const EOL = os.EOL;

interface CloudflareErrorCodes {
  [key: number]: string;
}

const ERROR_CODES = {
    // Non-standard 5xx server error HTTP status codes
    520: 'Web server is returning an unknown error',
    521: 'Web server is down',
    522: 'Connection timed out',
    523: 'Origin is unreachable',
    524: 'A timeout occurred',
    525: 'SSL handshake failed',
    526: 'Invalid SSL certificate',
    527: 'Railgun Listener to Origin Error',
    530: 'Origin DNS error',
    // Other codes
    1000: 'DNS points to prohibited IP',
    1001: 'DNS resolution error',
    1002: 'Restricted or DNS points to Prohibited IP',
    1003: 'Access Denied: Direct IP Access Not Allowed',
    1004: 'Host Not Configured to Serve Web Traffic',
    1005: 'Access Denied: IP of banned ASN/ISP',
    1010: 'The owner of this website has banned your access based on your browser\'s signature',
    1011: 'Access Denied (Hotlinking Denied)',
    1012: 'Access Denied',
    1013: 'HTTP hostname and TLS SNI hostname mismatch',
    1016: 'Origin DNS error',
    1018: 'Domain is misconfigured',
    1020: 'Access Denied (Custom Firewall Rules)'
  };
  
  ERROR_CODES[1006] =
      ERROR_CODES[1007] =
          ERROR_CODES[1008] = 'Access Denied: Your IP address has been banned';

function format(lines: string[]): string {
    return EOL + lines.join(EOL) + EOL + EOL;
  }

  const BUG_REPORT = format([
    '### Cloudflare may have changed their technique, or there may be a bug.',
    '### Bug Reports: https://github.com/codemanki/cloudscraper/issues',
    '### Check the detailed exception message that follows for the cause.'
  ]);
class CustomError extends original.RequestError {
  errorType: number;

  constructor(cause: any, options?: any, response?: any) {
    super(cause, options, response);
    this.errorType = 0;
  }
}

export class RequestError extends CustomError {
  name: string;
  constructor(cause: any, options?: any, response?: any) {
    super(cause, options, response);
    this.name = 'RequestError';
    this.errorType = 0;
  }
}

export class CaptchaError extends CustomError {
  name: string;
  constructor(cause: any, options?: any, response?: any) {
    super(cause, options, response);
    this.name = 'CaptchaError';
    this.errorType = 1;
  }
}

export class CloudflareError extends CustomError {
  name: string;
message: string | undefined;
  constructor(cause: any, options?: any, response?: any) {
    super(cause, options, response);
    this.name = 'CloudflareError';
    this.errorType = 2;

    if (!isNaN(cause)) {
      const description = ERROR_CODES[cause] || http.STATUS_CODES[cause];
      if (description) {
        this.message = cause + ', ' + description;
      }
    }
  }
}

export class ParserError extends CustomError {
  name: string;
    message = "";
  constructor(cause: any, options?: any, response?: any) {
    super(cause, options, response);
    this.name = 'ParserError';
    this.errorType = 3;
    this.message = BUG_REPORT + (this.message);
  }
}

// The following errors originate from promise-core and its dependents.
// Give them an errorType for consistency.
original.StatusCodeError.prototype.errorType = 5;
original.TransformError.prototype.errorType = 6;

// This replaces the RequestError for all libraries using request/promise-core
// and prevents silent failure.
Object.defineProperty(original, 'RequestError', {
  configurable: true,
  enumerable: true,
  writable: true,
  value: RequestError
});

// Export our custom errors along with StatusCodeError, etc.
export const errors = {
  ...original,
  RequestError: RequestError,
  CaptchaError: CaptchaError,
  ParserError: ParserError,
  CloudflareError: CloudflareError
};