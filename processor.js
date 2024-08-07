import { load } from "cheerio";
import { isMainThread, parentPort, workerData, Worker } from "worker_threads";

const REGEXP = new RegExp(/\bBest\b/, "gi");

export function genProcessWorker(urls, max) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./processor.js', { workerData: { urls, max } });
    worker.on("message", resolve);
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0)
        reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}

export async function genProcessAll(urls, max) {
  const results = await Promise.all(urls.map(genProcessSingle));
  return {
    count: urls.length,
    value: results.reduce((acc, { value }) => acc + value, 0),
    links: Array.from(new Set(results.flatMap(({ links }) => links))).splice(0, max)
  }
}

async function genProcessSingle(url) {
  // Simulate a computationally heavy operation
  // await new Promise((resolve) => setTimeout(resolve, Math.random() * 2000));

  return await fetch(url)
    .then((res) => res.text())
    .then(load)
    .then((doc) => {
      const links = Array.from(doc('a[href^="/wiki/"]'))
        .map((el) => doc(el).attr("href"))
        .map((link) => new URL(link, url))
        .map(sanitizeUrl);
      const value = doc("p").text().match(REGEXP)?.length ?? 0;
      return { links, value };
    });
}

function sanitizeUrl(url) {
  url.hash = "";
  return url.href.toLowerCase();
}

if (!isMainThread) {
  genProcessAll(workerData.urls, workerData.max).then((res) => {
    parentPort.postMessage(res);
  });
}
