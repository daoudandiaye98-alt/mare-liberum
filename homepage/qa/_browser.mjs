// One window of one engine, for the tools that look at the page in more than Chrome.
// A page on the open web is reached through the session's proxy where there is one (HTTPS_PROXY). Certificates are
// always checked. Chrome and WebKit read the authorities of the system. Firefox keeps a list of its own: when something
// stands on the way that it does not know (a proxy that ends TLS itself), FIREFOX_PROFILE names a profile that
// already trusts it:
//   certutil -N --empty-password -d sql:/tmp/ffprofile && certutil -A -n proxy -t "C,," -i <its certificate> -d sql:/tmp/ffprofile
import { webkit, firefox, chromium } from 'playwright-core';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const ENGINES = { webkit, firefox, chromium };
export const CHROME = { executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };
export async function open(name, url, options = {}) {
  const proxy = /^https:/.test(url || '') && process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const launch = { proxy, ...(name === 'chromium' ? CHROME : {}) };
  if (name === 'firefox' && process.env.FIREFOX_PROFILE) {
    // Firefox locks a profile while it runs: every window gets a copy of its own
    const dir = mkdtempSync(join(tmpdir(), 'ff-')); cpSync(process.env.FIREFOX_PROFILE, dir, { recursive: true });
    const ctx = await firefox.launchPersistentContext(dir, { ...launch, ...options });
    return { ctx, page: ctx.pages()[0] || await ctx.newPage(), close: async () => { await ctx.close(); try { rmSync(dir, { recursive: true, force: true }); } catch {} } };
  }
  const b = await ENGINES[name].launch(launch), ctx = await b.newContext(options);
  return { ctx, page: await ctx.newPage(), close: () => b.close() };
}
