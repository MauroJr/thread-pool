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
     * The handler will be the message handler for incoming message replies.
     */
    const __cache           = {};
    let   __messageHandlers = {};
    let   __counter         = -1;

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
     * Gernates an identifier for messages sent.
     *
     * @return {String}
     */
    function genId() {
      if (__counter > 9999999999) {
        __counter = -1;
      }
      return `${+new Date}:${__counter}`;
    }

    /**
     * @class
     *
     * Provide the user with all the necessary tools.
     *
     * @param  {Any}  init   The initial data coming in upon assignment.
     *
     * @return {undefined}
     */
    function Handler(init) {
      this.init = init;
    }

    /*
     * Define the prototype for the Handler class.
     */
    Handler.prototype = {

      /**
       * Allow the user to complete a task and put this child process
       * back into the pool.
       *
       * @param  {Any} output Serializable data to send back to the main thread.
       *
       * @return {undefined}
       */
      finish: output => {
        process.send({
          type: 'done',
          data: output
        });
        __messageHandlers = {};
      },

      /**
       * Kills this thread.
       *
       * @return {undefined}
       */
      err: () => {
        process.exit(1);
      },

      /**
       * Let the user send data to the main thread.
       *
       * @param {Any}  data  Data to be sent.
       *
       * @type {Object} Contains a method called `onReply` that lets
       *                the user handle a reply to this message.
       */
      send: data => {
        const id = genId();
        process.send({ type: 'message', data: data, id: id });
        return { onReply: (fn) => __messageHandlers[id] = fn };
      }

    };

    /**
     * Executes a task passed in via a process message.
     *
     * @param  {Object} msg Contains all message data.
     *
     * @return {undefined{}
     */
    function execTask(msg) {
      let task;
      msg.isFunction ? eval(`task = ${sanitizeFn(msg.data.task)}`)
                     : (task = req(msg.data.task));
      task.call(this, new Handler(JSON.parse(msg.data.init)));
    }

    /**
     * If the user has set up a reply handler, call it when
     * a reply comes in.
     *
     * @param  {Object} msg The message that came in.
     *
     * @return {undefined}
     */
    function handleReply(msg) {
      if (__messageHandlers[msg.id]) {
        __messageHandlers[msg.id](msg.data);
        delete __messageHandlers[msg.id];
      }
    }

    /*
     * Handles incoming messages from the main thread.
     */
    process.on('message', msg => {
      switch(msg.type) {
        case 'task'  : return execTask(msg);
        case 'reply' : return handleReply(msg);
        default      : return;
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
