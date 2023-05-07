/* eslint-disable @typescript-eslint/no-use-before-define */
import requestModule, { RequestPromiseOptions } from "request-promise";
import * as req from "request";
import { evaluate, Context } from "./lib/sandbox";
import decodeEmails from "./lib/email-decode";
import { getDefaultHeaders, caseless } from "./lib/headers";
import brotli from "./lib/brotli";
import crypto from "crypto";
import { deprecate } from "util";

import { CaptchaError, CloudflareError, ParserError, RequestError } from "./errors";
import Symbol from "es6-symbol";

let debugging = false;
const HOST = Symbol("host");

declare namespace cloudscraper {
    interface Options<T = any> extends req.CoreOptions {
        uri: string | req.UrlOptions;
    }
}

async function request(options?: cloudscraper.Options, params?: DefaultParams): Promise<string> {
    const cloudscraper = defaults(params, requestModule);
    return cloudscraper(options);
}

function defaults(params?: DefaultParams, self?: any) {
    let defaultParams = {
        requester: requestModule,
        // Cookies should be enabled
        jar: requestModule.jar(),
        headers: getDefaultHeaders({ Host: HOST }),
        // Reduce Cloudflare's timeout to cloudflareMaxTimeout if it is excessive
        cloudflareMaxTimeout: 30000,
        // followAllRedirects - follow non-GET HTTP 3xx responses as redirects
        followAllRedirects: true,
        // Support only this max challenges in row. If CF returns more, throw an error
        challengesToSolve: 3,
        // Remove Cloudflare's email protection
        decodeEmails: false,
        // Support gzip encoded responses
        gzip: true,
        agentOptions: {
            // Removes a few problematic TLSv1.0 ciphers to avoid CAPTCHA
            ciphers: crypto.constants.defaultCipherList + ":!ECDHE+SHA:!AES128-SHA",
        },
    };

    // Object.assign requires at least nodejs v4, request only test/supports v6+
    defaultParams = Object.assign({}, defaultParams, params);

    const cloudscraper = (requestModule as any).defaults.call(self, defaultParams, (options) => {
        validateRequest(options);
        return performRequest(options, true);
    });

    // There's no safety net here, any changes apply to all future requests
    // that are made with this instance and derived instances.
    cloudscraper.defaultParams = defaultParams;

    // Expose the debug option
    Object.defineProperty(cloudscraper, "debug", {
        configurable: true,
        enumerable: true,
        set(value) {
            requestModule.debug = debugging = true;
        },
        get() {
            return debugging;
        },
    });

    return cloudscraper;
}

function validateRequest(options: { realEncoding: string; encoding: null; challengesToSolve: number; cloudflareMaxTimeout: number; requester: any }) {
    // Prevent overwriting realEncoding in subsequent calls
    if (!("realEncoding" in options)) {
        // Can't just do the normal options.encoding || 'utf8'
        // because null is a valid encoding.
        if ("encoding" in options) {
            (options as any).realEncoding = (options as any).encoding;
        } else {
            (options as any).realEncoding = "utf8";
        }
    }

    options.encoding = null;

    if (isNaN(options.challengesToSolve)) {
        throw new TypeError("Expected `challengesToSolve` option to be a number, " + "got " + typeof options.challengesToSolve + " instead.");
    }

    if (isNaN(options.cloudflareMaxTimeout)) {
        throw new TypeError("Expected `cloudflareMaxTimeout` option to be a number, " + "got " + typeof options.cloudflareMaxTimeout + " instead.");
    }

    if (typeof options.requester !== "function") {
        throw new TypeError("Expected `requester` option to be a function, got " + typeof options.requester + " instead.");
    }
}

// This function is wrapped to ensure that we get new options on first call.
// The options object is reused in subsequent calls when calling it directly.
function performRequest(options: { requester: any; callback: any }, isFirstRequest: boolean) {
    // This should be the default export of either request or request-promise.
    const requester = options.requester;

    // Note that request is always an instanceof ReadableStream, EventEmitter
    // If the requester is request-promise, it is also thenable.
    const request = requester(options);

    // We must define the host header ourselves to preserve case and order.
    if (request.getHeader("host") === HOST) {
        request.setHeader("host", request.uri.host);
    }

    // If the requester is not request-promise, ensure we get a callback.
    if (typeof request.callback !== "function") {
        throw new TypeError("Expected a callback function, got " + typeof request.callback + " instead.");
    }

    // We only need the callback from the first request.
    // The other callbacks can be safely ignored.
    if (isFirstRequest) {
        // This should be a user supplied callback or request-promise's callback.
        // The callback is always wrapped/bound to the request instance.
        options.callback = request.callback;
    }

    request.removeAllListeners("error").once("error", (error: any) => {
        onRequestResponse(options as any, error, request.response, request.body);
    });

    request.removeAllListeners("complete").once("complete", (response: any, body: any) => {
        onRequestResponse(options as any, null, response, body);
    });

    // Indicate that this is a cloudscraper request
    request.cloudscraper = true;
    return request;
}

// The argument convention is options first where possible, options
// always before response, and body always after response.
function onRequestResponse(
    options: { callback: any; json: any },
    error: null,
    response:
        | {
              headers: any;
              responseStartTime: number;
              isCloudflare: boolean;
              isHTML: boolean;
              body: Buffer;
              request: {
                  _jsonReviver: ((this: any, key: string, value: any) => any) | undefined;
              };
          }
        | undefined,
    body: string | Buffer | undefined
) {
    const callback = options.callback;

    // Encoding is null so body should be a buffer object
    if (error || !body || !body.toString) {
        // Pure request error (bad connection, wrong url, etc)
        return callback(new RequestError(error, options, response));
    }

    const headers = caseless(response?.headers);

    if (!response) {
        response = {} as any;
    }
    response!.responseStartTime = Date.now();
    response!.isCloudflare = /^(cloudflare|sucuri)/i.test("" + headers.server);
    response!.isHTML = /text\/html/i.test("" + headers["content-type"]);

    // If body isn't a buffer, this is a custom response body.
    // eslint-disable-next-line no-undef
    if (!Buffer.isBuffer(body)) {
        return callback(null, response, body);
    }

    // Decompress brotli compressed responses
    if (/\bbr\b/i.test("" + headers["content-encoding"])) {
        if (!brotli.isAvailable) {
            const cause = "Received a Brotli compressed response. Please install brotli";
            return callback(new RequestError(cause, options, response));
        }

        try {
            response!.body = body = brotli.decompress!(body);
        } catch (error) {
            return callback(new RequestError(error, options, response));
        }

        // Request doesn't handle brotli and would've failed to parse JSON.
        if (options.json) {
            try {
                response!.body = body = JSON.parse(body as any, response!.request._jsonReviver);
                // If successful, this isn't a challenge.
                return callback(null, response, body);
            } catch (error) {
                // Request's debug will log the failure, no need to duplicate.
            }
        }
    }

    if (response!.isCloudflare && response!.isHTML) {
        onCloudflareResponse(options as any, (response as any)!, (body as any)!);
    } else {
        onRequestComplete(options as any, response!, body!);
    }
}

function onCloudflareResponse(options: { callback: any; onCaptcha: any }, response: { statusCode: number }, body: string | any[]) {
    const callback = options.callback;

    if (body.length < 1) {
        // This is a 4xx-5xx Cloudflare response with an empty body.
        return callback(new CloudflareError(response.statusCode, options, response));
    }

    const stringBody = body.toString();

    if (!response) {
        response = {} as any;
    }

    try {
        validateResponse(options, response as any, stringBody);
    } catch (error) {
        if (error instanceof CaptchaError && typeof options.onCaptcha === "function") {
            // Give users a chance to solve the reCAPTCHA via services such as anti-captcha.com
            return onCaptcha(options, response as any, stringBody);
        }

        return callback(error);
    }

    const isChallenge = stringBody.indexOf("a = document.getElementById('jschl-answer');") !== -1;

    if (isChallenge) {
        return onChallenge(options as any, response as any, stringBody);
    }

    const isRedirectChallenge = stringBody.indexOf("You are being redirected") !== -1 || stringBody.indexOf("sucuri_cloudproxy_js") !== -1;

    if (isRedirectChallenge) {
        return onRedirectChallenge(options as any, response as any, stringBody);
    }

    // 503 status is always a challenge
    if (response.statusCode === 503) {
        return onChallenge(options as any, response as any, stringBody);
    }

    // All is good
    onRequestComplete(options as any, response as any, body);
}

function detectRecaptchaVersion(body: string | string[]) {
    // New version > Dec 2019
    if (/__cf_chl_captcha_tk__=(.*)/i.test(body as string)) {
        // Test for ver2 first, as it also has ver2 fields
        return "ver2";
        // Old version < Dec 2019
    } else if (body.indexOf("why_captcha") !== -1 || /cdn-cgi\/l\/chk_captcha/i.test(body as string)) {
        return "ver1";
    }

    return false;
}

function validateResponse(options: any, response: { isCaptcha: boolean }, body: string) {
    // Finding captcha
    // Old version < Dec 2019
    const recaptchaVer = detectRecaptchaVersion(body);
    if (recaptchaVer) {
        // Convenience boolean
        response.isCaptcha = true;
        throw new CaptchaError("captcha", options, response);
    }

    // Trying to find '<span class="cf-error-code">1006</span>'
    const match = body.match(/<\w+\s+class="cf-error-code">(.*)<\/\w+>/i);

    if (match) {
        const code = parseInt(match[1]);
        throw new CloudflareError(code, options, response);
    }

    return false;
}

function onChallenge(
    options: {
        callback: any;
        challengesToSolve: number;
        cloudflareTimeout: string;
        cloudflareMaxTimeout: number;
        headers: { Referer: any };
        uri: string;
        form: {};
        method: string;
        qs: {};
        baseUrl: undefined;
    },
    response: {
        request: { uri: any };
        challenge: string;
        responseStartTime: number;
    },
    body: string
) {
    const callback = options.callback;
    const uri = response.request.uri;
    // The query string to send back to Cloudflare
    const payload: any = {
        /* s, jschl_vc, pass, jschl_answer */
    };

    let cause: string;
    let error: { errorType: number };

    if (options.challengesToSolve === 0) {
        cause = "Cloudflare challenge loop";
        error = new CloudflareError(cause, options, response);
        error.errorType = 4;

        return callback(error);
    }

    let timeout = parseInt(options.cloudflareTimeout);
    let match: any;

    match = body.match(/name="(.+?)" value="(.+?)"/);

    if (match) {
        const hiddenInputName = match[1];
        payload[hiddenInputName] = match[2];
    }

    match = body.match(/name="jschl_vc" value="(\w+)"/);
    if (!match) {
        cause = "challengeId (jschl_vc) extraction failed";
        return callback(new ParserError(cause, options, response));
    }

    // eslint-disable-next-line @typescript-eslint/camelcase
    payload.jschl_vc = match[1];

    match = body.match(/name="pass" value="(.+?)"/);
    if (!match) {
        cause = "Attribute (pass) value extraction failed";
        return callback(new ParserError(cause, options, response));
    }

    payload.pass = match[1];

    match = body.match(/getElementById\('cf-content'\)[\s\S]+?setTimeout.+?\r?\n([\s\S]+?a\.value\s*=.+?)\r?\n(?:[^{<>]*},\s*(\d{4,}))?/);
    if (!match) {
        cause = "setTimeout callback extraction failed";
        return callback(new ParserError(cause, options, response));
    }

    if (isNaN(timeout)) {
        if (match[2] !== undefined) {
            timeout = parseInt(match[2]);

            if (timeout > options.cloudflareMaxTimeout) {
                if (debugging) {
                    // eslint-disable-next-line no-undef
                    console.warn("Cloudflare's timeout is excessive: " + timeout / 1000 + "s");
                }

                timeout = options.cloudflareMaxTimeout;
            }
        } else {
            cause = "Failed to parse challenge timeout";
            return callback(new ParserError(cause, options, response));
        }
    }

    // Append a.value so it's always returned from the vm
    response.challenge = match[1] + "; a.value";

    try {
        const ctx = new Context({ hostname: uri.hostname, body });
        // eslint-disable-next-line @typescript-eslint/camelcase
        payload.jschl_answer = evaluate(response.challenge, ctx);
    } catch (error: any) {
        error.message = "Challenge evaluation failed: " + error.message;
        return callback(new ParserError(error, options, response));
    }

    if (isNaN(payload.jschl_answer)) {
        cause = "Challenge answer is not a number";
        return callback(new ParserError(cause, options, response));
    }

    // Prevent reusing the headers object to simplify unit testing.
    options.headers = Object.assign({}, options.headers);
    // Use the original uri as the referer and to construct the answer uri.
    options.headers.Referer = uri.href;
    // Check is form to be submitted via GET or POST
    match = body.match(/id="challenge-form" action="(.+?)" method="(.+?)"/);
    if (match && match[2] && match[2] === "POST") {
        options.uri = uri.protocol + "//" + uri.host + match[1];
        // Pass the payload using body form
        options.form = payload;
        options.method = "POST";
    } else {
        // Whatever is there, fallback to GET
        options.uri = uri.protocol + "//" + uri.host + "/cdn-cgi/l/chk_jschl";
        // Pass the payload using query string
        options.qs = payload;
    }
    // Decrement the number of challenges to solve.
    options.challengesToSolve -= 1;
    // baseUrl can't be used in conjunction with an absolute uri
    if (options.baseUrl !== undefined) {
        options.baseUrl = undefined;
    }
    // Change required by Cloudflate in Jan-Feb 2020
    options.uri = options.uri.replace(/&amp;/g, "&");

    // Make request with answer after delay.
    timeout -= Date.now() - response.responseStartTime;
    // eslint-disable-next-line no-undef
    setTimeout(performRequest, timeout, options, false);
}

// Parses the reCAPTCHA form and hands control over to the user
function onCaptcha(
    options: { callback: any; onCaptcha: any },
    response: {
        captcha: {
            formMethod?: any;
            formActionUri?: any;
            submit?: any;
            siteKey?: any;
            uri?: any;
            form?: {};
            version?: string | boolean;
        };
        request: { uri: { href: any } };
        rayId: any;
    },
    body: string
) {
    const recaptchaVer = detectRecaptchaVersion(body);
    const isRecaptchaVer2 = recaptchaVer === "ver2";
    const callback = options.callback;
    // UDF that has the responsibility of returning control back to cloudscraper
    const handler = options.onCaptcha;
    // The form data to send back to Cloudflare
    const payload: any = {
        /* r|s, g-re-captcha-response */
    };

    let cause: string;
    let match: any[] | null;

    match = body.match(/<form(?: [^<>]*)? id=["']?challenge-form['"]?(?: [^<>]*)?>([\S\s]*?)<\/form>/);
    if (!match) {
        cause = "Challenge form extraction failed";
        return callback(new ParserError(cause, options, response));
    }

    const form = match[1];

    let siteKey: any;
    let rayId: any; // only for ver 2

    if (isRecaptchaVer2) {
        match = body.match(/\sdata-ray=["']?([^\s"'<>&]+)/);
        if (!match) {
            cause = "Unable to find cloudflare ray id";
            return callback(new ParserError(cause, options, response));
        }
        rayId = match[1];
    }

    match = body.match(/\sdata-sitekey=["']?([^\s"'<>&]+)/);
    if (match) {
        siteKey = match[1];
    } else {
        const keys: any[] = [];
        const re = /\/recaptcha\/api2?\/(?:fallback|anchor|bframe)\?(?:[^\s<>]+&(?:amp;)?)?[Kk]=["']?([^\s"'<>&]+)/g;

        while ((match = re.exec(body)) !== null) {
            // Prioritize the explicit fallback siteKey over other matches
            if (match[0].indexOf("fallback") !== -1) {
                keys.unshift(match[1]);
                if (!debugging) break;
            } else {
                keys.push(match[1]);
            }
        }

        siteKey = keys[0];

        if (!siteKey) {
            cause = "Unable to find the reCAPTCHA site key";
            return callback(new ParserError(cause, options, response));
        }

        if (debugging) {
            // eslint-disable-next-line no-undef
            console.warn("Failed to find data-sitekey, using a fallback:", keys);
        }
    }

    // Everything that is needed to solve the reCAPTCHA
    response.captcha = {
        siteKey,
        uri: response.request.uri,
        form: payload,
        version: recaptchaVer,
    };

    if (isRecaptchaVer2) {
        response.rayId = rayId;

        match = body.match(/id="challenge-form" action="(.+?)" method="(.+?)"/);
        if (!match) {
            cause = "Challenge form action and method extraction failed";
            return callback(new ParserError(cause, options, response));
        }
        response.captcha.formMethod = match[2];
        match = match[1].match(/\/(.*)/);
        response.captcha.formActionUri = match?.[0];
        payload.id = rayId;
    }

    Object.defineProperty(response.captcha, "url", {
        configurable: true,
        enumerable: false,
        get: deprecate(function () {
            return response.request.uri.href;
        }, "captcha.url is deprecated. Please use captcha.uri instead."),
    });

    // Adding formData
    match = form.match(/<input(?: [^<>]*)? name=[^<>]+>/g);
    if (!match) {
        cause = "Challenge form is missing inputs";
        return callback(new ParserError(cause, options, response));
    }

    const inputs = match;
    // Only adding inputs that have both a name and value defined
    for (let name: (string | number)[], value: any[], i = 0; i < inputs.length; i++) {
        name = inputs[i].match(/name=["']?([^\s"'<>]*)/);
        if (name) {
            value = inputs[i].match(/value=["']?([^\s"'<>]*)/);
            if (value) {
                payload[name[1]] = value[1];
            }
        }
    }

    // Sanity check
    if (!payload.s && !payload.r) {
        cause = "Challenge form is missing secret input";
        return callback(new ParserError(cause, options, response));
    }

    if (debugging) {
        // eslint-disable-next-line no-undef
        console.warn("Captcha:", response.captcha);
    }

    // The callback used to green light form submission
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const submit = function (error: Error) {
        if (error) {
            // Pass an user defined error back to the original request call
            return callback(new CaptchaError(error, options, response));
        }

        onSubmitCaptcha(options as any, response as any);
    };

    // This seems like an okay-ish API (fewer arguments to the handler)
    response.captcha.submit = submit;

    // We're handing control over to the user now.
    const thenable = handler(options, response, body);
    // Handle the case where the user returns a promise
    if (thenable && typeof thenable.then === "function") {
        thenable.then(submit, function (error: any) {
            if (!error) {
                // The user broke their promise with a falsy error
                submit(new Error("Falsy error"));
            } else {
                submit(error);
            }
        });
    }
}

function onSubmitCaptcha(
    options: {
        callback: any;
        qs: { __cf_chl_captcha_tk__: any };
        form: any;
        method: any;
        headers: { Referer: any };
        uri: string;
    },
    response: {
        request: { uri: any };
        captcha: {
            version: string;
            form: { [x: string]: any };
            formActionUri: string;
            formMethod: string;
        };
    }
) {
    const callback = options.callback;
    const uri = response.request.uri;
    const isRecaptchaVer2 = response.captcha.version === "ver2";

    if (!response.captcha.form["g-recaptcha-response"]) {
        const cause = "Form submission without g-recaptcha-response";
        return callback(new CaptchaError(cause, options, response));
    }

    if (isRecaptchaVer2) {
        options.qs = {
            // eslint-disable-next-line @typescript-eslint/camelcase
            __cf_chl_captcha_tk__: response?.captcha.formActionUri.match(/__cf_chl_captcha_tk__=(.*)/)?.[1],
        };

        options.form = response.captcha.form;
    } else {
        (options as any).qs = response.captcha.form;
    }

    options.method = response.captcha.formMethod || "GET";

    // Prevent reusing the headers object to simplify unit testing.
    options.headers = Object.assign({}, options.headers);
    // Use the original uri as the referer and to construct the form action.
    options.headers.Referer = uri.href;
    if (isRecaptchaVer2) {
        options.uri = uri.protocol + "//" + uri.host + response.captcha.formActionUri;
    } else {
        options.uri = uri.protocol + "//" + uri.host + "/cdn-cgi/l/chk_captcha";
    }

    performRequest(options as any, false);
}

function onRedirectChallenge(
    options: {
        callback: any;
        jar: {
            setCookie: (arg0: any, arg1: any, arg2: { ignoreError: boolean }) => void;
        };
        challengesToSolve: number;
    },
    response: { request: { uri: any }; challenge: string },
    body: string
) {
    const callback = options.callback;
    const uri = response.request.uri;

    const match = body.match(/S='([^']+)'/);
    if (!match) {
        const cause = "Cookie code extraction failed";
        return callback(new ParserError(cause, options, response));
    }

    const base64EncodedCode = match[1];
    // eslint-disable-next-line no-undef
    response.challenge = Buffer.from(base64EncodedCode, "base64").toString("ascii");

    try {
        // Evaluate cookie setting code
        const ctx = new Context();
        evaluate(response.challenge, ctx);

        options.jar.setCookie((ctx as any).options.document.cookie, uri.href, {
            ignoreError: true,
        });
    } catch (error: any) {
        error.message = "Cookie code evaluation failed: " + error.message;
        return callback(new ParserError(error, options, response));
    }

    options.challengesToSolve -= 1;

    performRequest(options as any, false);
}

function onRequestComplete(options: { callback: any; realEncoding: any; decodeEmails: any }, response: { isHTML: any; body: any }, body: { toString: (arg0: any) => any }) {
    const callback = options.callback;

    if (typeof options.realEncoding === "string") {
        body = body.toString(options.realEncoding);
        // The resolveWithFullResponse option will resolve with the response
        // object. This changes the response.body so it is as expected.

        if (response.isHTML && options.decodeEmails) {
            body = decodeEmails(body as any);
        }

        response.body = body;
    }

    callback(null, response, body);
}

interface DefaultParams {
    requester: typeof requestModule;
    jar: any;
    headers: Record<string, string>;
    cloudflareMaxTimeout: number;
    followAllRedirects: boolean;
    challengesToSolve: number;
    decodeEmails: boolean;
    gzip: boolean;
    agentOptions: {
        ciphers: string;
    };
}

export default request;
