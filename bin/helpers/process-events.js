'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.spawn = spawn;
exports.onComplete = onComplete;

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _processBody = require('./process-body');

var _processBody2 = _interopRequireDefault(_processBody);

var _symbols = require('./symbols');

var _symbols2 = _interopRequireDefault(_symbols);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
  if (pool[_symbols2.default.TASK_QUEUE].length) {
    (function () {
      var task = pool[_symbols2.default.TASK_QUEUE].shift();
      pool.assign(task.task).then(function (data) {
        return task.resolve(data);
      }).catch(function (data) {
        return task.catch(data);
      });
    })();
  } else {
    console.log('Thread Pool: 1 new idle thread. ' + pool[_symbols2.default.WAITING].length + '/' + pool[_symbols2.default.MAX_SIZE] + ' threads idle.');
  }
}

/**
 * Creates a new child process from the processBody string.
 *
 * @param {Pool} pool  A thread pool instance.
 *
 * @return {ChildProcess}
 */
function spawn(pool) {

  /*
   * Create a child process.
   */
  var child = _child_process2.default.fork(null, [], {
    execPath: 'node',
    execArgv: ['-e', _processBody2.default]
  });

  /*
   * Add the process to the list of total processes.
   */
  pool[_symbols2.default.PIDS].push(child);

  /*
   * Set up 2 new properties to help work with promises.
   */
  child[_symbols2.default.RESOLVER] = null;
  child[_symbols2.default.REJECTER] = null;
  child[_symbols2.default.TIMER] = null;
  child[_symbols2.default.KILLSIGINT] = false;

  /*
   * When a child closes, fire a rejecter if we have one,
   * remove the child from our list of total pool processes,
   * and spawn a new child if we need it to resurrect.
   */
  child.on('close', function (data) {
    child[_symbols2.default.REJECTER] && child[_symbols2.default.REJECTER](data);
    pool[_symbols2.default.PIDS].splice(pool[_symbols2.default.PIDS].indexOf(child), 1);
    !child[_symbols2.default.KILLSIGINT] && spawn(pool, 'resurrect');
  });

  /*
   * When the child process sends back a `done` message...
   */
  child.on('message', function (msg) {
    switch (msg.type) {
      case 'done':
        return onComplete(pool, child, msg);
      default:
        return;
    }
  });

  /*
   * Put the child process into the waiting pool and check to
   * see if there are any tasks to be completed.
   */
  pool[_symbols2.default.WAITING].push(child);
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
function onComplete(pool, child, msg) {
  var resolver = child[_symbols2.default.RESOLVER];

  // Clear any running timers.
  child[_symbols2.default.TIMER] && clearTimeout(child[_symbols2.default.TIMER]);

  // Reset the resolver and rejecter.
  child[_symbols2.default.RESOLVER] = null;
  child[_symbols2.default.REJECTER] = null;
  child[_symbols2.default.TIMER] = null;

  // Put the child process back into the waiting pool.
  pool[_symbols2.default.WAITING].push(child);

  // Check to see if there are other tasks that need to
  // be completed.
  checkTaskQueue(pool);

  // Resolve the promise with the data from the child process.
  resolver && resolver(msg.data);
}