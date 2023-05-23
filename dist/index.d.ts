import requestModule from "request-promise";
import * as req from "request";
declare namespace cloudscraper {
    interface Options extends req.CoreOptions {
        uri: string | req.UrlOptions;
    }
}
export interface Options extends req.CoreOptions {
    uri: string | req.UrlOptions;
}
declare function request(options?: cloudscraper.Options, params?: DefaultParams, retries?: number): Promise<Response>;
interface DefaultParams {
    requester?: typeof requestModule;
    jar?: any;
    headers?: Record<string, string>;
    cloudflareMaxTimeout?: number;
    followAllRedirects?: boolean;
    challengesToSolve?: number;
    decodeEmails?: boolean;
    gzip?: boolean;
    agentOptions?: {
        ciphers: string;
    };
}
export default request;
