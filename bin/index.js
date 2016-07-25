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
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       task: function (handler) {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         finish('i got ' + handler.init);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       },
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       init: 'hello'
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     })
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     .then(data => {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       console.log('pool sent back', data);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     });
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _processEvents = require('./helpers/process-events');

var _processEvents2 = _interopRequireDefault(_processEvents);

var _symbols = require('./helpers/symbols');

var _symbols2 = _interopRequireDefault(_symbols);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

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
    child[_symbols2.default.TIMER] = setTimeout(function () {
      return child.kill('SIGINT');
    }, taskObj.timeout);
  }
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

    this[_symbols2.default.MAX_SIZE] = size;
    this[_symbols2.default.HANDLER] = null;
    this[_symbols2.default.WAITING] = [];
    this[_symbols2.default.TASK_QUEUE] = [];
    this[_symbols2.default.PIDS] = [];
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
      var amount = this[_symbols2.default.MAX_SIZE] - this[_symbols2.default.WAITING].length;
      for (var i = 0; i < amount; i += 1) {
        (0, _processEvents2.default)(this);
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
      this[_symbols2.default.PIDS].forEach(function (child) {
        child.kill('SIGINT');
        child[_symbols2.default.KILLSIGINT] = true;
      });
      this[_symbols2.default.PIDS] = [];
      console.log('Thread Pool: All processes terminated.');
    }

    /**
     * Assigns a task to one of the child processes in our pool and spits out
     * a promise so we can handle the return from the child process.
     *
     * @param  {Object} taskObj  Describes the task to be completed.
     *                           Keys are `task`, `init`, `timeout`.
     *
     * @return {Promise}
     */

  }, {
    key: 'assign',
    value: function assign(taskObj) {
      var _this = this;

      return new Promise(function (resolve, reject) {

        /*
         * If there is a process waiting to receive a task...
         */
        if (_this[_symbols2.default.WAITING].length) {

          /*
           * Remove the child process from the waiting pool.
           */
          var child = _this[_symbols2.default.WAITING].pop();

          /*
           * Send the child process the task.
           */
          sendTaskToChild(child, taskObj);

          /*
           * Attach a resolver and a rejecter to our child process.
           */
          child[_symbols2.default.RESOLVER] = resolve;
          child[_symbols2.default.REJECTER] = reject;

          /*
           * If we are not able to assign the task...
           */
        } else {

          /*
           * Push the task to the task queue and wait for another child process
           * to finish and pick it up.
           */
          _this[_symbols2.default.TASK_QUEUE].push({
            task: taskObj,
            resolve: resolve,
            reject: reject
          });

          console.log('Thread Pool: New task waiting for idle thread. ' + _this[_symbols2.default.TASK_QUEUE].length + ' tasks waiting.');
        }
      });
    }

    /**
     * Allow the user to handle incoming messages from child processes.
     *
     * @param  {Function} fn Accepts a `data` argument and a `reply` function
     *                       which allows the user to
     *                       send a reply back to the process.
     *
     * @return {undefined}
     */

  }, {
    key: 'onMessage',
    value: function onMessage(fn) {
      this[_symbols2.default.HANDLER] = fn;
    }
  }]);

  return Pool;
}();