(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define("simple-scheduler", [], factory);
	else if(typeof exports === 'object')
		exports["simple-scheduler"] = factory();
	else
		root["simple-scheduler"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports) {

	"use strict";

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});

	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

	exports.getSchedule = getSchedule;
	exports.setSchedule = setSchedule;

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	/**
	 * Two symbols for use in removing a user's access to certain class properties.
	 */
	var QUEUE = Symbol();
	var PENDING = Symbol();

	/**
	 * Preps a queue for running in the next run loop.
	 *
	 * @param  {Scheduler} instance An instance of a Scheduler class.
	 *
	 * @return {undefined}
	 */
	function setPending(instance) {
	  instance[PENDING] = true;
	  setTimeout(function () {
	    return runQueue(instance);
	  }, 0);
	}

	/**
	 * Generate a function to be added to the queue that can resolve or
	 * reject a promise.
	 *
	 * @param  {Function} protocol The user's function to be queued.
	 * @param  {Function} resolve  A Promise resolver.
	 * @param  {Function} reject   A Promise rejecter.
	 *
	 * @return {Function}          Can be added to a queue.
	 */
	function procedureFactory(protocol, resolve, reject) {
	  return function () {
	    try {
	      resolve(protocol());
	    } catch (err) {
	      reject(err);
	    }
	  };
	}

	/**
	 * Iterates over queue and calls each function. Afterward,
	 * empties queue and sets isWaiting to false so that a new
	 * setTimeout can be created by the next instance of addToQueue.
	 *
	 * @param {Scheduler} instance An instance of a Scheduler class.
	 *
	 * @returns {undefined}
	 */
	function runQueue(instance) {
	  instance[QUEUE] && instance[QUEUE].forEach(function (item) {
	    return item();
	  });
	  instance[QUEUE] = [];
	  instance[PENDING] = false;
	}

	/**
	 * @class
	 *
	 * Contains all exposed scheduling abilities.
	 */

	var Scheduler = exports.Scheduler = function () {

	  /**
	   * @constructor
	   *
	   * Builds the class instance.
	   *
	   * @return {undefined}
	   */
	  function Scheduler() {
	    _classCallCheck(this, Scheduler);

	    runQueue(this);
	  }

	  /**
	   * Places an item into an event loop to be executed after the
	   * callstack is empty. As long as there is a queued function to be executed,
	   * queues will run after the callstack has emptied. If there is no
	   * function currently queued, there is no continuous interval attempting to
	   * run queues.
	   *
	   * @param {Function}  fn  A function to queue.
	   *
	   * @returns {Promise}     Resolves with the result of the function.
	   *                        Rejects with any error thrown by the function.
	   */


	  _createClass(Scheduler, [{
	    key: "queue",
	    value: function queue(protocol) {
	      var _this = this;

	      return new Promise(function (resolve, reject) {
	        _this[QUEUE].push(procedureFactory(protocol, resolve, reject));
	        !_this[PENDING] && setPending(_this);
	      });
	    }
	  }]);

	  return Scheduler;
	}();

	;

	/**
	 * Allow power users to view the upcoming schedule for a given
	 * scheduler instance.
	 *
	 * @param  {Scheduler} scheduler The scheduler instance.
	 *
	 * @return {Array}               A copy of the scheduler's schedule.
	 */
	function getSchedule(scheduler) {
	  return scheduler[QUEUE].slice();
	}

	/**
	 * Allow power users to manually update a given schedule. Abandons the
	 * previous schedule.
	 *
	 * @param  {Scheduler} scheduler   The scheduler instance.
	 * @param  {Array}     newSchedule Contains new functions to run.
	 *
	 * @return {Array}                 The new schedule.
	 */
	function setSchedule(scheduler, newSchedule) {
	  return scheduler[QUEUE] = newSchedule;
	}

/***/ }
/******/ ])
});
;