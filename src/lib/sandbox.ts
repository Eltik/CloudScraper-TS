import * as vm from "vm";

const VM_OPTIONS = {
    filename: "iuam-challenge.js",
    contextOrigin: "cloudflare:iuam-challenge.js",
    contextCodeGeneration: { strings: true, wasm: false },
    timeout: 5000,
};

// eslint-disable-next-line @typescript-eslint/no-inferrable-types
const VM_ENV: string = `
  (function (global) {
    const cache = Object.create(null);
    const keys: string[] = [];
    const { body, href } = global;
    
    Object.defineProperties(global, {
      document: {
        value: {
          createElement: function () {
            return { firstChild: { href: href } };
          },
          getElementById: function (id: string) {
            if (keys.indexOf(id) === -1) {
              const re = new RegExp(' id=[\\'"]?' + id + '[^>]*>([^<]*)');
              const match = body.match(re);
      
              keys.push(id);
              cache[id] = match === null ? match : { innerHTML: match[1] };
            }
      
            return cache[id];
          }
        }
      },
      location: { value: { reload: function () {} } }  
    })
  }(this));
`;

interface ContextOptions {
    body: string;
    hostname: string;
}

export function evaluate(code: string, ctx: vm.Context): any {
    return vm.runInNewContext(VM_ENV + code, ctx, VM_OPTIONS);
}

export class Context {
    constructor(options?: Partial<ContextOptions>) {
        if (!options) options = { body: "", hostname: "" };

        const atob = Object.setPrototypeOf(function (str: string): string | undefined {
            try {
                // eslint-disable-next-line no-undef
                return Buffer.from(str, "base64").toString("binary");
            } catch (e) {}
        }, null);

        return Object.setPrototypeOf(
            {
                body: options.body || "",
                href: "http://" + (options.hostname || "") + "/",
                atob,
            },
            null
        );
    }
}
