'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Pool = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
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

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MAX_SIZE = Symbol();
var WAITING = Symbol();
var TASK_QUEUE = Symbol();
var PIDS = Symbol();
var RESOLVER = Symbol();
var REJECTER = Symbol();
var KILLSIGINT = Symbol();
var TIMER = Symbol();

/**
 * Generate a string to be used as the body of each child process.
 */
var processBody = function () {

  /**
   * This function will be invoked immediately upon evaluating the child
   * process.
   */
  var body = function body() {
    var __cache = {};
    function finish(output) {
      process.send({
        type: 'done',
        data: output
      });
    }
    function err() {
      process.exit(1);
    }
    function req(path) {
      var required = require(path);
      return required.default || required;
    }
    process.on('message', function (msg) {
      var task, payload, taskTxt;
      if (msg.type === 'task') {
        payload = JSON.parse(msg.data.payload);
        if (msg.isFunction) {
          taskTxt = msg.data.task.trim().replace(/^function\s*\(/, 'function __(');
          eval('task = ' + taskTxt);
        } else {
          task = __cache[msg.data.task] = __cache[msg.data.task] || req(msg.data.task);
        }
        task.call(this, payload, finish, err);
      }
    });
  };
  return '(' + body.toString() + '());';
}();

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
  if (pool[TASK_QUEUE].length) {
    (function () {
      var task = pool[TASK_QUEUE].shift();
      pool.assign(task.task).then(function (data) {
        return task.resolve(data);
      }).catch(function (data) {
        return task.catch(data);
      });
    })();
  } else {
    console.log('Thread Pool: 1 new idle thread. ' + pool[WAITING].length + '/' + pool[MAX_SIZE] + ' threads idle.');
  }
}

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
  var toSend = { type: 'task', data: taskObj, isFunction: false };

  // If the task comes in as a string, it's a path to a file containing
  // the task.
  if (typeof taskObj.task === 'string') {
    child.send(toSend);

    // If it's a function, stringify the function and send that.
  } else if (typeof taskObj.task === 'function') {
    toSend.data.task = taskObj.task.toString();
    toSend.isFunction = true;
    child.send(toSend);
  } else {
    throw new Error('Tasks may only be functions or paths to JavaScript files.');
  }

  // If we want this process to die after a certain amount of time,
  // set a timer to do that.
  if (taskObj.timeout) {
    child[TIMER] = setTimeout(function () {
      return child.kill('SIGINT');
    }, taskObj.timeout);
  }
}

/**
 * Creates a new child process from the processBody string.
 *
 * @return {ChildProcess}
 */
function spawnChild(pool, resurrect) {

  // Create a child process.
  var child = _child_process2.default.fork(null, [], {
    execPath: 'node',
    execArgv: ['-e', processBody]
  });

  // Add the process to the list of total processes.
  pool[PIDS].push(child);

  // Set up 2 new properties to help work with promises.
  child[RESOLVER] = null;
  child[REJECTER] = null;
  child[TIMER] = null;
  child[KILLSIGINT] = false;

  // When a child closes, fire a rejecter if we have one,
  // remove the child from our list of total pool processes,
  // and spawn a new child if we need it to resurrect.
  child.on('close', function (data) {
    if (child[REJECTER]) {
      child[REJECTER](data);
    }
    pool[PIDS].splice(pool[PIDS].indexOf(child), 1);
    if (resurrect === 'resurrect' && !child[KILLSIGINT]) {
      spawnChild(pool, 'resurrect');
    }
  });

  // When the child process sends back a `done` message...
  child.on('message', function (msg) {
    if (msg.type === 'done') {
      var resolver = child[RESOLVER];

      // Clear any running timers.
      child[TIMER] && clearTimeout(child[TIMER]);

      // Reset the resolver and rejecter.
      child[RESOLVER] = null;
      child[REJECTER] = null;
      child[TIMER] = null;

      // Put the child process back into the waiting pool.
      pool[WAITING].push(child);

      // Check to see if there are other tasks that need to
      // be completed.
      checkTaskQueue(pool);

      // Resolve the promise with the data from the child process.
      resolver && resolver(msg.data);
    }
  });

  // Put the child process into the waiting pool and check to
  // see if there are any tasks to be completed.
  pool[WAITING].push(child);
  checkTaskQueue(pool);
  return child;
}

/**
 * @class
 * @public
 *
 * Creates a sweet thread pool.
 */

var Pool = exports.Pool = function () {

  /**
   * Instantiates the class.
   *
   * @param  {Number} size  Defaults to 5. The amount of threads to use.
   *
   * @return {undefined}
   */
  function Pool() {
    var size = arguments.length <= 0 || arguments[0] === undefined ? 5 : arguments[0];

    _classCallCheck(this, Pool);

    this[MAX_SIZE] = size;
    this[WAITING] = [];
    this[TASK_QUEUE] = [];
    this[PIDS] = [];
    this.up();
  }

  /**
   * Spins up child process threads to be used in the pool.
   * Will not create more child processes than the max size set
   * for the pool.
   *
   * @return {undefined}
   */


  _createClass(Pool, [{
    key: 'up',
    value: function up() {
      var amount = this[MAX_SIZE] - this[WAITING].length;
      for (var i = 0; i < amount; i += 1) {
        spawnChild(this, 'resurrect');
      }
      console.log('Thread Pool: All processes alive.');
    }

    /**
     * Kill all processes in the pool.
     *
     * @return {undefined}
     */

  }, {
    key: 'killAll',
    value: function killAll() {
      this[PIDS].forEach(function (child) {
        child.kill('SIGINT');
        child[KILLSIGINT] = true;
      });
      this[PIDS] = [];
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

  }, {
    key: 'assign',
    value: function assign(taskObj) {
      var _this = this;

      return new Promise(function (resolve, reject) {

        // If there is a process waiting to receive a task...
        if (_this[WAITING].length) {

          // Remove the child process from the waiting pool.
          var child = _this[WAITING].pop();

          // Send the child process the task.
          sendTaskToChild(child, taskObj);

          // Attach a resolver and a rejecter to our child process.
          child[RESOLVER] = resolve;
          child[REJECTER] = reject;

          // If we are not able to assign the task...
        } else {

          // Push the task to the task queue and wait for another child process
          // to finish and pick it up.
          _this[TASK_QUEUE].push({
            task: taskObj,
            resolve: resolve,
            reject: reject
          });

          console.log('Thread Pool: New task waiting for idle thread. ' + _this[TASK_QUEUE].length + ' tasks waiting.');
        }
      });
    }
  }]);

  return Pool;
}();