// A utility function that keeps spinning up jobs to process and keeps number of
// pending jobs below a given max concurrency.
//
// - maxConcurrency: maximum number of jobs running concurrently at any given time
// - maxWaitTime: maximum time to wait for a job to finish before giving up
// - onDo: a function that returns a promise (a job) or null if there's nothing more to do
// - onResult: a function that is called with the result of a job when it finishes
// - onProgress: a function that is called with the number of pending jobs and the total number of jobs processed so far
export async function allWithMaxConcurrency({ maxConcurrency, maxWaitTime, onDo, onResult, onProgress }) {
    let pendingCount = 0;
    let timeoutCount = 0;
    let totalCount = 0;

    function reportProgress() {
        onProgress?.({
            pending: pendingCount,
            timeout: timeoutCount,
            total: totalCount,
        });
    }

    while (true) {
        // unless max concurrency reached, try to process something
        if (pendingCount < maxConcurrency) {
            let promise = onDo();

            // if a job is available, wait for it
            // and keep doing that until max concurrency is reached
            // or there's nothing more to do
            if (promise != null) {
                pendingCount++;
                totalCount++;
                reportProgress();

                if (maxWaitTime != null) {
                    promise = Promise.race([promise, new Promise(resolve => setTimeout(resolve, maxWaitTime))]);
                }
                promise.then(result => {
                    pendingCount--;
                    if (result == null) {
                        timeoutCount++;
                    } else {
                        onResult(result);
                    }
                    reportProgress();
                });
                continue;
            }

            // if nothing more to process and nothing pending, exit.
            if (pendingCount === 0) {
                break;
            }
        }

        // if there are pending jobs, just clock on until
        // until either jobs finish and fall below max concurrency
        // or all jobs finish.
        if (pendingCount > 0) {
            await new Promise(setImmediate);
        }
    }
}
