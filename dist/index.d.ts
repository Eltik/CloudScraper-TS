import requestModule from "request-promise";
import * as req from "request";
declare namespace cloudscraper {
    interface Options<T = any> extends req.CoreOptions {
        uri: string | req.UrlOptions;
    }
}
declare function request(options?: cloudscraper.Options, params?: DefaultParams): Promise<string>;
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
