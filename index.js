import { genProcessAll, genProcessWorker } from "./processor.js";
import * as ConcurrentPromise from "./concurrent-promise.js";

const STARTING_URL = "https://en.m.wikipedia.org/wiki/Avicii";

const MAX_PROCESSED = 5000;
const MAX_LINKS_PER_PAGE = 50;

const WORKER_CONCURRENCY = 20;
const WORKER_BATCH_SIZE = 10;
const WORKER_TIMEOUT = 3000;

const ASYNC_CONCURRENCY = 50;
const ASYNC_TIMEOUT = 1000;

const USE_WORKERS = new Set(process.argv).has('-m');

const genProcess = USE_WORKERS ? genProcessWorker : genProcessAll;

function now() {
  return new Date().getTime();
}

async function main() {
  const queue = [STARTING_URL];
  const seen = new Set(queue);
  let totalValue = 0;
  let totalProcessed = 0;
  let totalDeduped = 0;

  let maxMemoryUsage = 0;

  const startTime = now();

  function onProgress({pending, total, timeout}) {
    const memoryUsage = (process.memoryUsage.rss() / (1024 * 1024)).toFixed(1);
    maxMemoryUsage = Math.max(maxMemoryUsage, memoryUsage);

    const cpuUsage = (process.cpuUsage().user / 1000000).toFixed(1);

    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(`[${now()-startTime}ms] — [${maxMemoryUsage}MB][${cpuUsage}s] — [Batches] Pending: ${pending}, Timed out: ${timeout}, total: ${total} — [Queue] Processed: ${totalProcessed}, Deduped: ${totalDeduped}, Length: ${queue.length} — [Value] ${totalValue}`);
  }

  function onDo() {
    if (queue.length === 0) {
      return null;
    }

    const batch = queue.splice(0, USE_WORKERS ? WORKER_BATCH_SIZE : 1);
    totalProcessed += batch.length;

    return genProcess(batch, MAX_LINKS_PER_PAGE);
  }

  function onResult({ value, count, links }) {
    totalValue += value;

    const linksToKeep = links.filter(link => !seen.has(link));
    totalDeduped += (links.length - linksToKeep.length);

    const numLinksToKeep = Math.max(MAX_PROCESSED - totalProcessed - queue.length, 0);
    const linksToProcess = linksToKeep.splice(0, numLinksToKeep);
    linksToProcess.forEach(l => seen.add(l));
    queue.push(...linksToProcess);
  }

  await ConcurrentPromise.allWithMaxConcurrency({
    maxConcurrency: USE_WORKERS ? WORKER_CONCURRENCY : ASYNC_CONCURRENCY,
    maxWaitTime: USE_WORKERS ? WORKER_TIMEOUT : ASYNC_TIMEOUT,
    onDo,
    onResult,
    onProgress,
  });

  return { totalValue, totalProcessed, totalDeduped };
}

main();
