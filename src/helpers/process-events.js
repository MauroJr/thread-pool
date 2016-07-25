import cp from 'child_process';
import processBody from './process-body';
import symbols from './symbols';

/**
 * Whenever this function is called, we should be confident that
 * there is at least 1 child process waiting to receive a task.
 *
 * This function will check to see if there is a task queued to be
 * performed and will call `assign` to hand it off to the waiting
 * child process.
 *
 * The `assign` method will return a promise so when that promise
 * resolves, we should pass the resolution on to the `resolve`
 * function created when the waiting task was assigned. Same with
 * errors.
 *
 * @param  {Pool} pool An instance of a child process pool.
 *
 * @return {undefined}
 */
function checkTaskQueue(pool) {
  if (pool[symbols.TASK_QUEUE].length) {
    const task = pool[symbols.TASK_QUEUE].shift();
    pool.assign(task.task)
        .then(data => task.resolve(data))
        .catch(data => task.catch(data));
  } else {
    console.log(`Thread Pool: 1 new idle thread. ${pool[symbols.WAITING].length}/${pool[symbols.MAX_SIZE]} threads idle.`);
  }
}

/**
 * Creates a new child process from the processBody string.
 *
 * @param {Pool} pool  A thread pool instance.
 *
 * @return {ChildProcess}
 */
export function spawn(pool) {

  /*
   * Create a child process.
   */
  const child = cp.fork(null, [], {
    execPath: 'node',
    execArgv: ['-e', processBody]
  });

  /*
   * Add the process to the list of total processes.
   */
  pool[symbols.PIDS].push(child);

  /*
   * Set up 2 new properties to help work with promises.
   */
  child[symbols.RESOLVER]   = null;
  child[symbols.REJECTER]   = null;
  child[symbols.TIMER]      = null;
  child[symbols.KILLSIGINT] = false;

  /*
   * When a child closes, fire a rejecter if we have one,
   * remove the child from our list of total pool processes,
   * and spawn a new child if we need it to resurrect.
   */
  child.on('close', (data) => {
    child[symbols.REJECTER] && child[symbols.REJECTER](data);
    pool[symbols.PIDS].splice(pool[symbols.PIDS].indexOf(child), 1);
    !child[symbols.KILLSIGINT] && spawn(pool, 'resurrect');
  });

  /*
   * When the child process sends back a `done` message...
   */
  child.on('message', msg => {
    switch (msg.type) {
      case 'done' : return onComplete(pool, child, msg);
      default     : return;
    }
  });

  /*
   * Put the child process into the waiting pool and check to
   * see if there are any tasks to be completed.
   */
  pool[symbols.WAITING].push(child);
  checkTaskQueue(pool);
  return child;
}

/**
 * Procedure for when a process completes a task.
 *
 * @param  {Pool}         pool  A thread pool instance.
 * @param  {ChildProcess} child A thread.
 * @param  {Object}       msg   The message that came through from the child.
 *
 * @return {undefined}
 */
export function onComplete(pool, child, msg) {
  const resolver = child[symbols.RESOLVER];

  /*
   * Clear any running timers.
   */
  child[symbols.TIMER] && clearTimeout(child[symbols.TIMER]);

  /*
   * Reset the resolver and rejecter.
   */
  child[symbols.RESOLVER] = null;
  child[symbols.REJECTER] = null;
  child[symbols.TIMER]    = null;

  /*
   * Put the child process back into the waiting pool.
   */
  pool[symbols.WAITING].push(child);

  /*
   * Check to see if there are other tasks that need to
   * be completed.
   */
  checkTaskQueue(pool);

  /*
   * Resolve the promise with the data from the child process.
   */
  resolver && resolver(msg.data);
}
