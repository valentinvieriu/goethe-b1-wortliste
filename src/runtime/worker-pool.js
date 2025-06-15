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
  #workerUrl
  #size
  #workers = []
  #idleWorkers = []
  #queue = []
  #readyPromise
  #isClosing = false

  /**
   * @param {URL|string} workerUrl  – Module URL/filename passed to each Worker().
   * @param {number} [size=Math.max(1,cpus().length-1)] – Number of workers.
   */
  constructor(workerUrl, size = Math.max(1, cpus().length - 1)) {
    this.#workerUrl = workerUrl
    this.#size = size
    this.#readyPromise = this.#spawnWorkers()
  }

  async #spawnWorkers() {
    const onlinePromises = []
    for (let i = 0; i < this.#size; i++) {
      onlinePromises.push(this.#createWorker())
    }
    await Promise.all(onlinePromises)
  }

  #createWorker() {
    const { promise, resolve } = Promise.withResolvers()
    const worker = new Worker(this.#workerUrl)

    const onMessage = result => {
      const task = worker.currentTask
      if (!task) return
      if (task.timer) clearTimeout(task.timer)
      worker.currentTask = null
      task.resolve(task.job.reviver(result))
      this.#returnWorkerToPool(worker)
    }

    const onError = err => {
      const task = worker.currentTask
      if (task) {
        if (task.timer) clearTimeout(task.timer)
        task.reject(err)
        worker.currentTask = null
      }
      worker.removeAllListeners()
      this.#replaceWorker(worker)
    }

    // Handle unexpected termination (e.g. process.exit inside worker)
    const onExit = code => {
      // code 0 == graceful exit
      if (code !== 0) {
        const task = worker.currentTask
        if (task) {
          if (task.timer) clearTimeout(task.timer)
          task.reject(new Error(`Worker exited with code ${code}`))
          worker.currentTask = null
        }
        worker.removeAllListeners()
        this.#replaceWorker(worker)
      } else if (!worker.currentTask) {
        // If the worker exited gracefully while idle, simply replace it
        this.#replaceWorker(worker)
      }
    }

    worker.once('online', () => {
      this.#workers.push(worker)
      this.#idleWorkers.push(worker)
      this.#dispatch()
      resolve()
    })

    worker.on('message', onMessage)
    worker.on('error', onError)
    worker.on('exit', onExit)

    return promise
  }

  #returnWorkerToPool(worker) {
    this.#idleWorkers.push(worker)
    this.#dispatch()
  }

  async #replaceWorker(worker) {
    if (this.#isClosing) {
      // During shutdown just ensure the worker ends—no respawn, no noise
      try {
        await worker.terminate()
      } catch {}
      return
    }
    console.warn(`Worker failed or timed out. Terminating and replacing...`)
    const idx = this.#workers.indexOf(worker)
    if (idx > -1) this.#workers.splice(idx, 1)

    const idleIdx = this.#idleWorkers.indexOf(worker)
    if (idleIdx > -1) this.#idleWorkers.splice(idleIdx, 1)

    await worker.terminate()
    await this.#createWorker()
  }

  #dispatch() {
    // Drain the queue onto every idle worker that is available
    while (this.#queue.length > 0 && this.#idleWorkers.length > 0) {
      const worker = this.#idleWorkers.pop()
      const task = this.#queue.shift()

      // Allow callers to override timeout per job: pool.exec({payload, timeout: 10_000})
      const timeoutMs =
        typeof task.job.timeout === 'number' && task.job.timeout > 0 ? task.job.timeout : 30_000

      const onTimeout = () => {
        task.reject(new Error(`Worker job timed out after ${timeoutMs / 1000}s`))
        worker.currentTask = null
        // The worker is now in an unknown state, replace it
        worker.removeAllListeners()
        this.#replaceWorker(worker)
      }

      task.timer = setTimeout(onTimeout, timeoutMs)
      worker.currentTask = task

      worker.postMessage(task.job.payload)
    }
  }

  /**
   * Waits for all workers to reach the 'online' state.
   * @returns {Promise<void>}
   */
  ready() {
    return this.#readyPromise
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
      job && typeof job === 'object' && Object.hasOwn(job, 'payload')
        ? { reviver: v => v, ...job }
        : { payload: job, reviver: v => v }

    return new Promise((resolve, reject) => {
      this.#queue.push({ job: normalizedJob, resolve, reject, timer: null })
      this.#dispatch()
    })
  }

  /**
   * Gracefully terminate all workers. Any pending jobs will be discarded.
   * @returns {Promise<void>}
   */
  async destroy() {
    this.#isClosing = true
    // Fail fast for any tasks that never made it to a worker
    for (const pending of this.#queue) {
      if (pending.timer) clearTimeout(pending.timer)
      pending.reject(new Error('Worker pool destroyed before task execution'))
    }
    this.#queue = []

    // Detach listeners so onExit/onError won’t spawn new workers
    await Promise.all(
      this.#workers.map(async w => {
        w.removeAllListeners()
        await w.terminate()
      }),
    )
    this.#workers = []
    this.#idleWorkers = []
  }
}
