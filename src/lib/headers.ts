import { chrome as chromeData } from './browsers.json';
import brotli from './brotli';

interface ChromeOptions {
  headers: Record<string, string>;
  'User-Agent': string[];
}

function random<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getChromeHeaders(options: ChromeOptions): Record<string, string> {
  const { headers } = options;

  headers['User-Agent'] = random(options['User-Agent']);

  if (!brotli.isAvailable && headers['Accept-Encoding']) {
    headers['Accept-Encoding'] = headers['Accept-Encoding'].replace(/,?\s*\bbr\b\s*/i, '');
  }

  return headers;
}

export function getDefaultHeaders(defaults: Record<string, string>): Record<string, string> {
  const headers = getChromeHeaders(random(chromeData as any));
  return { ...defaults, ...headers };
}

export function caseless(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};

  Object.keys(headers).forEach(key => {
    result[key.toLowerCase()] = headers[key];
  });

  return result;
}
