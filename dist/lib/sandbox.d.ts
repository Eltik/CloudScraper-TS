/// <reference types="node" />
import * as vm from "vm";
interface ContextOptions {
    body: string;
    hostname: string;
}
export declare function evaluate(code: string, ctx: vm.Context): any;
export declare class Context {
    constructor(options?: Partial<ContextOptions>);
}
export {};
