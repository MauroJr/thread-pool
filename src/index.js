/*
Concept:

import { Pool } from 'thread-pool';

const pool = new Pool();

pool.assign({
  task: function (payload, finish, err) {
    finish('i got ' + payload);
  },
  payload: 'hello'
})
.then(data => {
  console.log('pool sent back', data);
});
 */

import { spawn } from './helpers/process-events';
import symbols from './helpers/symbols';

/**
 * Parses a task and sends it along to a child process.
 *
 * @param  {ChildProcess} child    A child process slated to perform the task.
 * @param  {Object}       taskObj  Contains a description of the task and the
 *                                 payload for it.
 *
 * @return {undefined}
 */
function sendTaskToChild(child, taskObj) {
  const toSend = {type: 'task', data: taskObj, isFunction: false};

  /*
   * If the task comes in as a string, it's a path to a file containing
   * the task.
   */
  if (typeof taskObj.task === 'string') {
    child.send(toSend);

  /*
   * If it's a function, stringify the function and send that.
   */
  } else if (typeof taskObj.task === 'function') {
    toSend.data.task = taskObj.task.toString();
    toSend.isFunction = true;
    child.send(toSend);
  } else {
    throw new Error('Tasks may only be functions or paths to JavaScript files.');
  }

  /*
   * If we want this process to die after a certain amount of time,
   * set a timer to do that.
   */
  if (taskObj.timeout) {
    child[symbols.TIMER] = setTimeout(() => child.kill('SIGINT'), taskObj.timeout);
  }
}


/**
 * @class
 * @public
 *
 * Creates a sweet thread pool.
 */
export class Pool {

  /**
   * Instantiates the class.
   *
   * @param  {Number} size  Defaults to 5. The amount of threads to use.
   *
   * @return {undefined}
   */
  constructor(size = 5) {
    this[symbols.MAX_SIZE]   = size;
    this[symbols.WAITING]    = [];
    this[symbols.TASK_QUEUE] = [];
    this[symbols.PIDS]       = [];
    this.up();
  }

  /**
   * Spins up child process threads to be used in the pool.
   * Will not create more child processes than the max size set
   * for the pool.
   *
   * @return {undefined}
   */
  up() {
    const amount = this[symbols.MAX_SIZE] - this[symbols.WAITING].length;
    for (let i = 0; i < amount; i += 1) {
      spawn(this);
    }
    console.log('Thread Pool: All processes alive.');
  }

  /**
   * Kill all processes in the pool.
   *
   * @return {undefined}
   */
  killAll() {
    this[symbols.PIDS].forEach(child => {
      child.kill('SIGINT');
      child[symbols.KILLSIGINT] = true;
    });
    this[symbols.PIDS] = [];
    console.log('Thread Pool: All processes terminated.');
  }

  /**
   * Assigns a task to one of the child processes in our pool and spits out
   * a promise so we can handle the return from the child process.
   *
   * @param  {Object} taskObj  Describes the task to be completed.
   *                           Keys are `task` and `payload`.
   *
   * @return {Promise}
   */
  assign(taskObj) {
    return new Promise((resolve, reject) => {

      /*
       * If there is a process waiting to receive a task...
       */
      if (this[symbols.WAITING].length) {

        /*
         * Remove the child process from the waiting pool.
         */
        const child = this[symbols.WAITING].pop();

        /*
         * Send the child process the task.
         */
        sendTaskToChild(child, taskObj);

        /*
         * Attach a resolver and a rejecter to our child process.
         */
        child[symbols.RESOLVER] = resolve;
        child[symbols.REJECTER] = reject;

      /*
       * If we are not able to assign the task...
       */
      } else {

        /*
         * Push the task to the task queue and wait for another child process
         * to finish and pick it up.
         */
        this[symbols.TASK_QUEUE].push({
          task: taskObj,
          resolve: resolve,
          reject: reject
        });

        console.log(`Thread Pool: New task waiting for idle thread. ${this[symbols.TASK_QUEUE].length} tasks waiting.`);
      }
    });
  }

}
