import requestModule, { RequestPromiseOptions } from "request-promise";
declare function request(params?: DefaultParams, options?: RequestPromiseOptions): Promise<string>;
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
