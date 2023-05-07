import requestModule, { RequestPromiseOptions } from "request-promise";
export default class CloudScraper {
    private debugging;
    private HOST;
    private params;
    constructor(params: DefaultParams);
    request(options: RequestPromiseOptions): Promise<string>;
    private defaults;
    private validateRequest;
    private performRequest;
    private onRequestResponse;
    private onCloudflareResponse;
    private detectRecaptchaVersion;
    private validateResponse;
    private onChallenge;
    private onCaptcha;
    private onSubmitCaptcha;
    private onRedirectChallenge;
    private onRequestComplete;
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
export {};
