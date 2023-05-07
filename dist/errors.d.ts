import * as original from 'request-promise-core/errors';
declare class CustomError extends original.RequestError {
    errorType: number;
    constructor(cause: any, options?: any, response?: any);
}
export declare class RequestError extends CustomError {
    name: string;
    constructor(cause: any, options?: any, response?: any);
}
export declare class CaptchaError extends CustomError {
    name: string;
    constructor(cause: any, options?: any, response?: any);
}
export declare class CloudflareError extends CustomError {
    name: string;
    message: string | undefined;
    constructor(cause: any, options?: any, response?: any);
}
export declare class ParserError extends CustomError {
    name: string;
    message: string;
    constructor(cause: any, options?: any, response?: any);
}
export declare const errors: any;
export {};
