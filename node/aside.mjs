// Mare Liberum · beside the node
// A page from the web can be written so that reading it takes minutes: thousands of opened comments or tags that
// are never closed, and every pattern that looks for the closing runs to the end of the page again. The node has one
// thread; while it reads such a page nobody else is answered, not even the server's own health check.
// So a stranger's page is never read in the node. It is read beside it, by a helper with a time limit and a small
// memory of its own. A page that cannot be read in time is given up; the node keeps answering all the while.
//   aside(file, name, args, { ms })   runs the exported function `name` of the module `file` on args, beside the node
// At most four helpers work at once; who comes when all are busy waits a few seconds, then is told so.
import { Worker } from 'node:worker_threads';

const AT_ONCE = 4, WAIT_MS = 8000;
let running = 0; const waiting = [];
export const asideStats = { read: 0, givenUp: 0, busy: 0 };
const slot = (wait) => new Promise((resolve, reject) => {
  if (running < AT_ONCE) { running++; return resolve(); }
  const item = { go: () => { clearTimeout(t); resolve(); } };
  const t = setTimeout(() => { const i = waiting.indexOf(item); if (i >= 0) waiting.splice(i, 1); asideStats.busy++; reject(Object.assign(new Error('the readers are all busy; try again in a moment'), { code: 'EBUSY' })); }, wait);
  waiting.push(item);
});
const free = () => { const next = waiting.shift(); if (next) next.go(); else running--; };

export async function aside(file, name, args, { ms = 3000, heapMb = 256, wait = WAIT_MS } = {}) {
  await slot(wait);
  try {
    return await new Promise((resolve, reject) => {
      let w;
      try { w = new Worker(new URL('./aside-worker.mjs', import.meta.url), { workerData: { file, name, args }, resourceLimits: { maxOldGenerationSizeMb: heapMb } }); }
      // a place without helpers (some hosted runtimes): read it here, as before
      catch { return import(file).then((mod) => resolve(mod[name](...args)), reject); }
      const t = setTimeout(() => { w.terminate(); asideStats.givenUp++; reject(Object.assign(new Error('this page could not be read in time'), { code: 'ESLOW' })); }, ms);
      w.once('message', (m) => { clearTimeout(t); w.terminate(); if (m && 'ok' in m) { asideStats.read++; resolve(m.ok); } else reject(new Error(String(m?.err || 'the page could not be read'))); });
      w.once('error', (e) => { clearTimeout(t); asideStats.givenUp++; reject(Object.assign(new Error('this page could not be read'), { code: 'ESLOW', cause: e })); });
    });
  } finally { free(); }
}
