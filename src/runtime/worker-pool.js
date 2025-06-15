import { Worker } from 'node:worker_threads'
import { cpus } from 'node:os'

/**
 * @typedef {object} WorkerJob
 * @property {any} payload  – Arbitrary serialisable data posted to the worker.
 * @property {(data:any)=>any} [reviver] – Optional mapper applied on the worker’s response.
 */

/**
 * A robust, fixed-size worker-thread pool with intelligent task queuing.
 *
 * This implementation improves upon simple round-robin scheduling by maintaining
 * a queue of pending jobs and a pool of idle workers. When a job is submitted,
 * it's added to the queue. An idle worker will immediately pick it up. If all
 * workers are busy, the job waits in the queue until a worker becomes free.
 * This ensures optimal resource utilization, especially when tasks have
 * variable completion times.
 *
 * It also includes job timeouts and automatic replacement of failed workers.
 *
 * Usage:
 * ```js
 * import { WorkerPool } from '@runtime/worker-pool.js'
 * const pool = new WorkerPool(new URL('./render-worker.js', import.meta.url))
 * await pool.ready() // Wait for workers to be online
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
    /** @type {Array<Worker>} */
    this._idleWorkers = []
    /** @type {Array<{ job: Required<WorkerJob>, resolve: (v: any) => void, reject: (r: any) => void, timer: NodeJS.Timeout | null }>} */
    this._queue = []
    /** @type {Promise<void>} */
    this._readyPromise = this._spawnWorkers()
  }

  async _spawnWorkers() {
    const onlinePromises = []
    for (let i = 0; i < this._size; i++) {
      onlinePromises.push(this._createWorker())
    }
    await Promise.all(onlinePromises)
  }

  _createWorker() {
    const { promise, resolve } = Promise.withResolvers()
    const worker = new Worker(this._workerUrl)

    const onMessage = result => {
      const task = worker.currentTask
      if (!task) return
      if (task.timer) clearTimeout(task.timer)
      worker.currentTask = null
      task.resolve(task.job.reviver(result))
      this._returnWorkerToPool(worker)
    }

    const onError = err => {
      const task = worker.currentTask
      if (task) {
        if (task.timer) clearTimeout(task.timer)
        task.reject(err)
        worker.currentTask = null
      }
      worker.removeAllListeners()
      this._replaceWorker(worker)
    }

    worker.once('online', () => {
      this._workers.push(worker)
      this._idleWorkers.push(worker)
      this._dispatch()
      resolve()
    })

    worker.on('message', onMessage)
    worker.on('error', onError)

    return promise
  }

  _returnWorkerToPool(worker) {
    this._idleWorkers.push(worker)
    this._dispatch()
  }

  async _replaceWorker(worker) {
    console.warn(`Worker failed or timed out. Terminating and replacing...`)
    const idx = this._workers.indexOf(worker)
    if (idx > -1) this._workers.splice(idx, 1)

    const idleIdx = this._idleWorkers.indexOf(worker)
    if (idleIdx > -1) this._idleWorkers.splice(idleIdx, 1)

    await worker.terminate()
    await this._createWorker()
  }

  _dispatch() {
    if (this._queue.length === 0 || this._idleWorkers.length === 0) {
      return
    }

    const worker = this._idleWorkers.pop()
    const task = this._queue.shift()

    const onTimeout = () => {
      task.reject(new Error(`Worker job timed out after 30s`))
      worker.currentTask = null
      // The worker is now in an unknown state, replace it
      worker.removeAllListeners()
      this._replaceWorker(worker)
    }

    task.timer = setTimeout(onTimeout, 30_000)
    worker.currentTask = task

    worker.postMessage(task.job.payload)
  }

  /**
   * Waits for all workers to reach the 'online' state.
   * @returns {Promise<void>}
   */
  ready() {
    return this._readyPromise
  }

  /**
   * Execute a job on an available worker. If all workers are busy,
   * the job is queued until one becomes free.
   *
   * @template T
   * @param {WorkerJob|T} job – If a plain value is passed it becomes `{ payload: job }`.
   * @returns {Promise<any>}  – Resolved value from the worker.
   */
  exec(job) {
    /** @type {Required<WorkerJob>} */
    const normalizedJob =
      typeof job === 'object' && job.payload !== undefined
        ? { reviver: v => v, ...job }
        : { payload: job, reviver: v => v }

    return new Promise((resolve, reject) => {
      this._queue.push({ job: normalizedJob, resolve, reject, timer: null })
      this._dispatch()
    })
  }

  /**
   * Gracefully terminate all workers. Any pending jobs will be discarded.
   * @returns {Promise<void>}
   */
  async destroy() {
    this._queue = []
    await Promise.all(this._workers.map(w => w.terminate()))
    this._workers = []
    this._idleWorkers = []
  }
}
