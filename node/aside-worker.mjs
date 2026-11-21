// Mare Liberum · the helper beside the node (see aside.mjs): one function, one page, then it is gone
import { parentPort, workerData } from 'node:worker_threads';
const { file, name, args } = workerData;
try { const mod = await import(file); parentPort.postMessage({ ok: mod[name](...args) }); } catch (e) { parentPort.postMessage({ err: String(e?.message || e) }); }
