import { Worker } from 'node:worker_threads'
import { cpus } from 'node:os'

/**
 * @typedef {object} WorkerJob
 * @property {any} payload  – Arbitrary serialisable data posted to the worker.
 * @property {(data:any)=>any} [reviver] – Optional mapper applied on the worker’s response.
 */

/**
 * Simple fixed-size worker-thread pool using Node 22 constructs.
 *
 * Usage:
 * ```js
 * import { WorkerPool } from '@runtime/worker-pool.js'
 * const pool = new WorkerPool(new URL('./render-worker.js', import.meta.url))
 * const png = await pool.exec({ page: 42 })
 * await pool.destroy()
 * ```
 */
export class WorkerPool {
  /**
   * @param {URL|string} workerUrl  – Module URL/filename passed to each Worker().
   * @param {number} [size=Math.max(1,cpus().length-1)] – Number of workers.
   */
  constructor(workerUrl, size = Math.max(1, cpus().length - 1)) {
    this._workerUrl = workerUrl
    this._size = size
    /** @type {Array<Worker>} */
    this._workers = []
    /** @type {Array<()=>void>} */
    this._readyResolvers = []
    /** @type {Array<Promise<void>>} */
    this._readyPromises = []
    this._spawnWorkers()
    this._nextIndex = 0
  }

  _spawnWorkers() {
    for (let i = 0; i < this._size; i++) {
      const worker = new Worker(this._workerUrl, { argv: [String(i)] })
      const { promise, resolve } = Promise.withResolvers()
      worker.once('online', resolve)
      this._workers.push(worker)
      this._readyPromises.push(promise)
    }
  }

  /**
   * Waits for all workers to reach the 'online' state.
   * @returns {Promise<void>}
   */
  ready() {
    return Promise.all(this._readyPromises).then(() => {})
  }

  /**
   * Execute a job on the next free worker (round-robin scheduling).
   *
   * @template T
   * @param {WorkerJob|T} job – If a plain value is passed it becomes `{ payload: job }`.
   * @returns {Promise<any>}  – Resolved value from the worker.
   */
  exec(job) {
    /** @type {Required<WorkerJob>} */
    const normalized =
      typeof job === 'object' && job.payload !== undefined
        ? { reviver: v => v, ...job }
        : { payload: job, reviver: v => v }

    const worker = this._workers[this._nextIndex]
    this._nextIndex = (this._nextIndex + 1) % this._size

    return new Promise((resolve, reject) => {
      const abort = AbortSignal.timeout(30_000) // safety timeout
      const onMessage = msg => {
        abort.clear()
        resolve(normalized.reviver(msg))
      }
      const onError = err => {
        abort.clear()
        reject(err)
      }
      abort.addEventListener('abort', () => {
        worker.terminate().finally(() => reject(new Error('Worker timed out after 30 s')))
      })
      worker.once('message', onMessage)
      worker.once('error', onError)
      worker.postMessage(normalized.payload)
    })
  }

  /**
   * Gracefully terminate all workers.
   * @returns {Promise<void>}
   */
  async destroy() {
    await Promise.all(this._workers.map(w => w.terminate()))
  }
}
