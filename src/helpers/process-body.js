/**
 * Generate a string to be used as the body of each child process.
 */
function genProcessBody() {

  /**
   * This function will be invoked immediately upon evaluating the child
   * process.
   */
  const body = function () {

    /*
     * The cache holds task files that have already been read in once.
     */
    const __cache = {};

    /**
     * Allow the user to complete a task and put this child process
     * back into the pool.
     *
     * @param  {Any} output Serializable data to send back to the main thread.
     *
     * @return {undefined}
     */
    function finish(output) {
      process.send({
        type: 'done',
        data: output
      });
    }

    /**
     * Kills this thread.
     *
     * @return {undefined}
     */
    function err() {
      process.exit(1);
    }

    /**
     * Handles `require` based on whether any ES6 transpiling has
     * already occurred on a file.
     *
     * @param  {String} path The path to the file.
     *
     * @return {Any}         The required code.
     */
    function req(path) {
      if (__cache[path]) {
        return __cache[path];
      } else {
        const required = require(path);
        const captured = required.default ? required.default : required;
        __cache[path]  = captured;
        return captured;
      }
    }

    /**
     * If we get a function task from the main thread, make sure it's
     * actually callable.
     *
     * @param  {String} text A stringified function.
     *
     * @return {String}      A sanitized string.
     */
    function sanitizeFn(text) {
      return text.trim().replace(/^function\s*\(/, 'function __(');
    }

    /**
     * Executes a task passed in via a process message.
     *
     * @param  {Object} msg Contains all message data.
     *
     * @return {undefined{}
     */
    function execTask(msg) {
      let task;
      const payload  = JSON.parse(msg.data.payload);
      msg.isFunction ? eval(`task = ${sanitizeFn(msg.data.task)}`)
                     : (task = req(msg.data.task));
      task.call(this, payload, finish, err);
    }

    /*
     * Handles incoming messages from the main thread.
     */
    process.on('message', msg => {
      switch(msg.type) {
        case 'task' : return execTask(msg);
        default     : return;
      }
    });
  };

  /*
   * Make sure we're producing a string.
   */
  return `(${body.toString()}());`;
}

/*
 * Export the generated string.
 */
export default genProcessBody();
