/*!
 * @overview es6-promise - a tiny implementation of Promises/A+.
 * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors (Conversion to ES6 API by Jake Archibald)
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/stefanpenner/es6-promise/master/LICENSE
 * @version   v4.2.8+1e68dce6
 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.ES6Promise = factory());
}(this, (function () { 'use strict';

function objectOrFunction(x) {
  var type = typeof x;
  return x !== null && (type === 'object' || type === 'function');
}

function isFunction(x) {
  return typeof x === 'function';
}



var _isArray = void 0;
if (Array.isArray) {
  _isArray = Array.isArray;
} else {
  _isArray = function (x) {
    return Object.prototype.toString.call(x) === '[object Array]';
  };
}

var isArray = _isArray;

var len = 0;
var vertxNext = void 0;
var customSchedulerFn = void 0;

var asap = function asap(callback, arg) {
  queue[len] = callback;
  queue[len + 1] = arg;
  len += 2;
  if (len === 2) {
    // If len is 2, that means that we need to schedule an async flush.
    // If additional callbacks are queued before the queue is flushed, they
    // will be processed by this flush that we are scheduling.
    if (customSchedulerFn) {
      customSchedulerFn(flush);
    } else {
      scheduleFlush();
    }
  }
};

function setScheduler(scheduleFn) {
  customSchedulerFn = scheduleFn;
}

function setAsap(asapFn) {
  asap = asapFn;
}

var browserWindow = typeof window !== 'undefined' ? window : undefined;
var browserGlobal = browserWindow || {};
var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
var isNode = typeof self === 'undefined' && typeof process !== 'undefined' && {}.toString.call(process) === '[object process]';

// test for web worker but not in IE10
var isWorker = typeof Uint8ClampedArray !== 'undefined' && typeof importScripts !== 'undefined' && typeof MessageChannel !== 'undefined';

// node
function useNextTick() {
  // node version 0.10.x displays a deprecation warning when nextTick is used recursively
  // see https://github.com/cujojs/when/issues/410 for details
  return function () {
    return process.nextTick(flush);
  };
}

// vertx
function useVertxTimer() {
  if (typeof vertxNext !== 'undefined') {
    return function () {
      vertxNext(flush);
    };
  }

  return useSetTimeout();
}

function useMutationObserver() {
  var iterations = 0;
  var observer = new BrowserMutationObserver(flush);
  var node = document.createTextNode('');
  observer.observe(node, { characterData: true });

  return function () {
    node.data = iterations = ++iterations % 2;
  };
}

// web worker
function useMessageChannel() {
  var channel = new MessageChannel();
  channel.port1.onmessage = flush;
  return function () {
    return channel.port2.postMessage(0);
  };
}

function useSetTimeout() {
  // Store setTimeout reference so es6-promise will be unaffected by
  // other code modifying setTimeout (like sinon.useFakeTimers())
  var globalSetTimeout = setTimeout;
  return function () {
    return globalSetTimeout(flush, 1);
  };
}

var queue = new Array(1000);
function flush() {
  for (var i = 0; i < len; i += 2) {
    var callback = queue[i];
    var arg = queue[i + 1];

    callback(arg);

    queue[i] = undefined;
    queue[i + 1] = undefined;
  }

  len = 0;
}

function attemptVertx() {
  try {
    var vertx = Function('return this')().require('vertx');
    vertxNext = vertx.runOnLoop || vertx.runOnContext;
    return useVertxTimer();
  } catch (e) {
    return useSetTimeout();
  }
}

var scheduleFlush = void 0;
// Decide what async method to use to triggering processing of queued callbacks:
if (isNode) {
  scheduleFlush = useNextTick();
} else if (BrowserMutationObserver) {
  scheduleFlush = useMutationObserver();
} else if (isWorker) {
  scheduleFlush = useMessageChannel();
} else if (browserWindow === undefined && typeof require === 'function') {
  scheduleFlush = attemptVertx();
} else {
  scheduleFlush = useSetTimeout();
}

function then(onFulfillment, onRejection) {
  var parent = this;

  var child = new this.constructor(noop);

  if (child[PROMISE_ID] === undefined) {
    makePromise(child);
  }

  var _state = parent._state;


  if (_state) {
    var callback = arguments[_state - 1];
    asap(function () {
      return invokeCallback(_state, child, callback, parent._result);
    });
  } else {
    subscribe(parent, child, onFulfillment, onRejection);
  }

  return child;
}

/**
  `Promise.resolve` returns a promise that will become resolved with the
  passed `value`. It is shorthand for the following:

  ```javascript
  let promise = new Promise(function(resolve, reject){
    resolve(1);
  });

  promise.then(function(value){
    // value === 1
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = Promise.resolve(1);

  promise.then(function(value){
    // value === 1
  });
  ```

  @method resolve
  @static
  @param {Any} value value that the returned promise will be resolved with
  Useful for tooling.
  @return {Promise} a promise that will become fulfilled with the given
  `value`
*/
function resolve$1(object) {
  /*jshint validthis:true */
  var Constructor = this;

  if (object && typeof object === 'object' && object.constructor === Constructor) {
    return object;
  }

  var promise = new Constructor(noop);
  resolve(promise, object);
  return promise;
}

var PROMISE_ID = Math.random().toString(36).substring(2);

function noop() {}

var PENDING = void 0;
var FULFILLED = 1;
var REJECTED = 2;

function selfFulfillment() {
  return new TypeError("You cannot resolve a promise with itself");
}

function cannotReturnOwn() {
  return new TypeError('A promises callback cannot return that same promise.');
}

function tryThen(then$$1, value, fulfillmentHandler, rejectionHandler) {
  try {
    then$$1.call(value, fulfillmentHandler, rejectionHandler);
  } catch (e) {
    return e;
  }
}

function handleForeignThenable(promise, thenable, then$$1) {
  asap(function (promise) {
    var sealed = false;
    var error = tryThen(then$$1, thenable, function (value) {
      if (sealed) {
        return;
      }
      sealed = true;
      if (thenable !== value) {
        resolve(promise, value);
      } else {
        fulfill(promise, value);
      }
    }, function (reason) {
      if (sealed) {
        return;
      }
      sealed = true;

      reject(promise, reason);
    }, 'Settle: ' + (promise._label || ' unknown promise'));

    if (!sealed && error) {
      sealed = true;
      reject(promise, error);
    }
  }, promise);
}

function handleOwnThenable(promise, thenable) {
  if (thenable._state === FULFILLED) {
    fulfill(promise, thenable._result);
  } else if (thenable._state === REJECTED) {
    reject(promise, thenable._result);
  } else {
    subscribe(thenable, undefined, function (value) {
      return resolve(promise, value);
    }, function (reason) {
      return reject(promise, reason);
    });
  }
}

function handleMaybeThenable(promise, maybeThenable, then$$1) {
  if (maybeThenable.constructor === promise.constructor && then$$1 === then && maybeThenable.constructor.resolve === resolve$1) {
    handleOwnThenable(promise, maybeThenable);
  } else {
    if (then$$1 === undefined) {
      fulfill(promise, maybeThenable);
    } else if (isFunction(then$$1)) {
      handleForeignThenable(promise, maybeThenable, then$$1);
    } else {
      fulfill(promise, maybeThenable);
    }
  }
}

function resolve(promise, value) {
  if (promise === value) {
    reject(promise, selfFulfillment());
  } else if (objectOrFunction(value)) {
    var then$$1 = void 0;
    try {
      then$$1 = value.then;
    } catch (error) {
      reject(promise, error);
      return;
    }
    handleMaybeThenable(promise, value, then$$1);
  } else {
    fulfill(promise, value);
  }
}

function publishRejection(promise) {
  if (promise._onerror) {
    promise._onerror(promise._result);
  }

  publish(promise);
}

function fulfill(promise, value) {
  if (promise._state !== PENDING) {
    return;
  }

  promise._result = value;
  promise._state = FULFILLED;

  if (promise._subscribers.length !== 0) {
    asap(publish, promise);
  }
}

function reject(promise, reason) {
  if (promise._state !== PENDING) {
    return;
  }
  promise._state = REJECTED;
  promise._result = reason;

  asap(publishRejection, promise);
}

function subscribe(parent, child, onFulfillment, onRejection) {
  var _subscribers = parent._subscribers;
  var length = _subscribers.length;


  parent._onerror = null;

  _subscribers[length] = child;
  _subscribers[length + FULFILLED] = onFulfillment;
  _subscribers[length + REJECTED] = onRejection;

  if (length === 0 && parent._state) {
    asap(publish, parent);
  }
}

function publish(promise) {
  var subscribers = promise._subscribers;
  var settled = promise._state;

  if (subscribers.length === 0) {
    return;
  }

  var child = void 0,
      callback = void 0,
      detail = promise._result;

  for (var i = 0; i < subscribers.length; i += 3) {
    child = subscribers[i];
    callback = subscribers[i + settled];

    if (child) {
      invokeCallback(settled, child, callback, detail);
    } else {
      callback(detail);
    }
  }

  promise._subscribers.length = 0;
}

function invokeCallback(settled, promise, callback, detail) {
  var hasCallback = isFunction(callback),
      value = void 0,
      error = void 0,
      succeeded = true;

  if (hasCallback) {
    try {
      value = callback(detail);
    } catch (e) {
      succeeded = false;
      error = e;
    }

    if (promise === value) {
      reject(promise, cannotReturnOwn());
      return;
    }
  } else {
    value = detail;
  }

  if (promise._state !== PENDING) {
    // noop
  } else if (hasCallback && succeeded) {
    resolve(promise, value);
  } else if (succeeded === false) {
    reject(promise, error);
  } else if (settled === FULFILLED) {
    fulfill(promise, value);
  } else if (settled === REJECTED) {
    reject(promise, value);
  }
}

function initializePromise(promise, resolver) {
  try {
    resolver(function resolvePromise(value) {
      resolve(promise, value);
    }, function rejectPromise(reason) {
      reject(promise, reason);
    });
  } catch (e) {
    reject(promise, e);
  }
}

var id = 0;
function nextId() {
  return id++;
}

function makePromise(promise) {
  promise[PROMISE_ID] = id++;
  promise._state = undefined;
  promise._result = undefined;
  promise._subscribers = [];
}

function validationError() {
  return new Error('Array Methods must be provided an Array');
}

var Enumerator = function () {
  function Enumerator(Constructor, input) {
    this._instanceConstructor = Constructor;
    this.promise = new Constructor(noop);

    if (!this.promise[PROMISE_ID]) {
      makePromise(this.promise);
    }

    if (isArray(input)) {
      this.length = input.length;
      this._remaining = input.length;

      this._result = new Array(this.length);

      if (this.length === 0) {
        fulfill(this.promise, this._result);
      } else {
        this.length = this.length || 0;
        this._enumerate(input);
        if (this._remaining === 0) {
          fulfill(this.promise, this._result);
        }
      }
    } else {
      reject(this.promise, validationError());
    }
  }

  Enumerator.prototype._enumerate = function _enumerate(input) {
    for (var i = 0; this._state === PENDING && i < input.length; i++) {
      this._eachEntry(input[i], i);
    }
  };

  Enumerator.prototype._eachEntry = function _eachEntry(entry, i) {
    var c = this._instanceConstructor;
    var resolve$$1 = c.resolve;


    if (resolve$$1 === resolve$1) {
      var _then = void 0;
      var error = void 0;
      var didError = false;
      try {
        _then = entry.then;
      } catch (e) {
        didError = true;
        error = e;
      }

      if (_then === then && entry._state !== PENDING) {
        this._settledAt(entry._state, i, entry._result);
      } else if (typeof _then !== 'function') {
        this._remaining--;
        this._result[i] = entry;
      } else if (c === Promise$1) {
        var promise = new c(noop);
        if (didError) {
          reject(promise, error);
        } else {
          handleMaybeThenable(promise, entry, _then);
        }
        this._willSettleAt(promise, i);
      } else {
        this._willSettleAt(new c(function (resolve$$1) {
          return resolve$$1(entry);
        }), i);
      }
    } else {
      this._willSettleAt(resolve$$1(entry), i);
    }
  };

  Enumerator.prototype._settledAt = function _settledAt(state, i, value) {
    var promise = this.promise;


    if (promise._state === PENDING) {
      this._remaining--;

      if (state === REJECTED) {
        reject(promise, value);
      } else {
        this._result[i] = value;
      }
    }

    if (this._remaining === 0) {
      fulfill(promise, this._result);
    }
  };

  Enumerator.prototype._willSettleAt = function _willSettleAt(promise, i) {
    var enumerator = this;

    subscribe(promise, undefined, function (value) {
      return enumerator._settledAt(FULFILLED, i, value);
    }, function (reason) {
      return enumerator._settledAt(REJECTED, i, reason);
    });
  };

  return Enumerator;
}();

/**
  `Promise.all` accepts an array of promises, and returns a new promise which
  is fulfilled with an array of fulfillment values for the passed promises, or
  rejected with the reason of the first passed promise to be rejected. It casts all
  elements of the passed iterable to promises as it runs this algorithm.

  Example:

  ```javascript
  let promise1 = resolve(1);
  let promise2 = resolve(2);
  let promise3 = resolve(3);
  let promises = [ promise1, promise2, promise3 ];

  Promise.all(promises).then(function(array){
    // The array here would be [ 1, 2, 3 ];
  });
  ```

  If any of the `promises` given to `all` are rejected, the first promise
  that is rejected will be given as an argument to the returned promises's
  rejection handler. For example:

  Example:

  ```javascript
  let promise1 = resolve(1);
  let promise2 = reject(new Error("2"));
  let promise3 = reject(new Error("3"));
  let promises = [ promise1, promise2, promise3 ];

  Promise.all(promises).then(function(array){
    // Code here never runs because there are rejected promises!
  }, function(error) {
    // error.message === "2"
  });
  ```

  @method all
  @static
  @param {Array} entries array of promises
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Promise} promise that is fulfilled when all `promises` have been
  fulfilled, or rejected if any of them become rejected.
  @static
*/
function all(entries) {
  return new Enumerator(this, entries).promise;
}

/**
  `Promise.race` returns a new promise which is settled in the same way as the
  first passed promise to settle.

  Example:

  ```javascript
  let promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 2');
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // result === 'promise 2' because it was resolved before promise1
    // was resolved.
  });
  ```

  `Promise.race` is deterministic in that only the state of the first
  settled promise matters. For example, even if other promises given to the
  `promises` array argument are resolved, but the first settled promise has
  become rejected before the other promises became fulfilled, the returned
  promise will become rejected:

  ```javascript
  let promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      reject(new Error('promise 2'));
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // Code here never runs
  }, function(reason){
    // reason.message === 'promise 2' because promise 2 became rejected before
    // promise 1 became fulfilled
  });
  ```

  An example real-world use case is implementing timeouts:

  ```javascript
  Promise.race([ajax('foo.json'), timeout(5000)])
  ```

  @method race
  @static
  @param {Array} promises array of promises to observe
  Useful for tooling.
  @return {Promise} a promise which settles in the same way as the first passed
  promise to settle.
*/
function race(entries) {
  /*jshint validthis:true */
  var Constructor = this;

  if (!isArray(entries)) {
    return new Constructor(function (_, reject) {
      return reject(new TypeError('You must pass an array to race.'));
    });
  } else {
    return new Constructor(function (resolve, reject) {
      var length = entries.length;
      for (var i = 0; i < length; i++) {
        Constructor.resolve(entries[i]).then(resolve, reject);
      }
    });
  }
}

/**
  `Promise.reject` returns a promise rejected with the passed `reason`.
  It is shorthand for the following:

  ```javascript
  let promise = new Promise(function(resolve, reject){
    reject(new Error('WHOOPS'));
  });

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = Promise.reject(new Error('WHOOPS'));

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  @method reject
  @static
  @param {Any} reason value that the returned promise will be rejected with.
  Useful for tooling.
  @return {Promise} a promise rejected with the given `reason`.
*/
function reject$1(reason) {
  /*jshint validthis:true */
  var Constructor = this;
  var promise = new Constructor(noop);
  reject(promise, reason);
  return promise;
}

function needsResolver() {
  throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
}

function needsNew() {
  throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
}

/**
  Promise objects represent the eventual result of an asynchronous operation. The
  primary way of interacting with a promise is through its `then` method, which
  registers callbacks to receive either a promise's eventual value or the reason
  why the promise cannot be fulfilled.

  Terminology
  -----------

  - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
  - `thenable` is an object or function that defines a `then` method.
  - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
  - `exception` is a value that is thrown using the throw statement.
  - `reason` is a value that indicates why a promise was rejected.
  - `settled` the final resting state of a promise, fulfilled or rejected.

  A promise can be in one of three states: pending, fulfilled, or rejected.

  Promises that are fulfilled have a fulfillment value and are in the fulfilled
  state.  Promises that are rejected have a rejection reason and are in the
  rejected state.  A fulfillment value is never a thenable.

  Promises can also be said to *resolve* a value.  If this value is also a
  promise, then the original promise's settled state will match the value's
  settled state.  So a promise that *resolves* a promise that rejects will
  itself reject, and a promise that *resolves* a promise that fulfills will
  itself fulfill.


  Basic Usage:
  ------------

  ```js
  let promise = new Promise(function(resolve, reject) {
    // on success
    resolve(value);

    // on failure
    reject(reason);
  });

  promise.then(function(value) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Advanced Usage:
  ---------------

  Promises shine when abstracting away asynchronous interactions such as
  `XMLHttpRequest`s.

  ```js
  function getJSON(url) {
    return new Promise(function(resolve, reject){
      let xhr = new XMLHttpRequest();

      xhr.open('GET', url);
      xhr.onreadystatechange = handler;
      xhr.responseType = 'json';
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send();

      function handler() {
        if (this.readyState === this.DONE) {
          if (this.status === 200) {
            resolve(this.response);
          } else {
            reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
          }
        }
      };
    });
  }

  getJSON('/posts.json').then(function(json) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Unlike callbacks, promises are great composable primitives.

  ```js
  Promise.all([
    getJSON('/posts'),
    getJSON('/comments')
  ]).then(function(values){
    values[0] // => postsJSON
    values[1] // => commentsJSON

    return values;
  });
  ```

  @class Promise
  @param {Function} resolver
  Useful for tooling.
  @constructor
*/

var Promise$1 = function () {
  function Promise(resolver) {
    this[PROMISE_ID] = nextId();
    this._result = this._state = undefined;
    this._subscribers = [];

    if (noop !== resolver) {
      typeof resolver !== 'function' && needsResolver();
      this instanceof Promise ? initializePromise(this, resolver) : needsNew();
    }
  }

  /**
  The primary way of interacting with a promise is through its `then` method,
  which registers callbacks to receive either a promise's eventual value or the
  reason why the promise cannot be fulfilled.
   ```js
  findUser().then(function(user){
    // user is available
  }, function(reason){
    // user is unavailable, and you are given the reason why
  });
  ```
   Chaining
  --------
   The return value of `then` is itself a promise.  This second, 'downstream'
  promise is resolved with the return value of the first promise's fulfillment
  or rejection handler, or rejected if the handler throws an exception.
   ```js
  findUser().then(function (user) {
    return user.name;
  }, function (reason) {
    return 'default name';
  }).then(function (userName) {
    // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
    // will be `'default name'`
  });
   findUser().then(function (user) {
    throw new Error('Found user, but still unhappy');
  }, function (reason) {
    throw new Error('`findUser` rejected and we're unhappy');
  }).then(function (value) {
    // never reached
  }, function (reason) {
    // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
    // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
  });
  ```
  If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.
   ```js
  findUser().then(function (user) {
    throw new PedagogicalException('Upstream error');
  }).then(function (value) {
    // never reached
  }).then(function (value) {
    // never reached
  }, function (reason) {
    // The `PedgagocialException` is propagated all the way down to here
  });
  ```
   Assimilation
  ------------
   Sometimes the value you want to propagate to a downstream promise can only be
  retrieved asynchronously. This can be achieved by returning a promise in the
  fulfillment or rejection handler. The downstream promise will then be pending
  until the returned promise is settled. This is called *assimilation*.
   ```js
  findUser().then(function (user) {
    return findCommentsByAuthor(user);
  }).then(function (comments) {
    // The user's comments are now available
  });
  ```
   If the assimliated promise rejects, then the downstream promise will also reject.
   ```js
  findUser().then(function (user) {
    return findCommentsByAuthor(user);
  }).then(function (comments) {
    // If `findCommentsByAuthor` fulfills, we'll have the value here
  }, function (reason) {
    // If `findCommentsByAuthor` rejects, we'll have the reason here
  });
  ```
   Simple Example
  --------------
   Synchronous Example
   ```javascript
  let result;
   try {
    result = findResult();
    // success
  } catch(reason) {
    // failure
  }
  ```
   Errback Example
   ```js
  findResult(function(result, err){
    if (err) {
      // failure
    } else {
      // success
    }
  });
  ```
   Promise Example;
   ```javascript
  findResult().then(function(result){
    // success
  }, function(reason){
    // failure
  });
  ```
   Advanced Example
  --------------
   Synchronous Example
   ```javascript
  let author, books;
   try {
    author = findAuthor();
    books  = findBooksByAuthor(author);
    // success
  } catch(reason) {
    // failure
  }
  ```
   Errback Example
   ```js
   function foundBooks(books) {
   }
   function failure(reason) {
   }
   findAuthor(function(author, err){
    if (err) {
      failure(err);
      // failure
    } else {
      try {
        findBoooksByAuthor(author, function(books, err) {
          if (err) {
            failure(err);
          } else {
            try {
              foundBooks(books);
            } catch(reason) {
              failure(reason);
            }
          }
        });
      } catch(error) {
        failure(err);
      }
      // success
    }
  });
  ```
   Promise Example;
   ```javascript
  findAuthor().
    then(findBooksByAuthor).
    then(function(books){
      // found books
  }).catch(function(reason){
    // something went wrong
  });
  ```
   @method then
  @param {Function} onFulfilled
  @param {Function} onRejected
  Useful for tooling.
  @return {Promise}
  */

  /**
  `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
  as the catch block of a try/catch statement.
  ```js
  function findAuthor(){
  throw new Error('couldn't find that author');
  }
  // synchronous
  try {
  findAuthor();
  } catch(reason) {
  // something went wrong
  }
  // async with promises
  findAuthor().catch(function(reason){
  // something went wrong
  });
  ```
  @method catch
  @param {Function} onRejection
  Useful for tooling.
  @return {Promise}
  */


  Promise.prototype.catch = function _catch(onRejection) {
    return this.then(null, onRejection);
  };

  /**
    `finally` will be invoked regardless of the promise's fate just as native
    try/catch/finally behaves
  
    Synchronous example:
  
    ```js
    findAuthor() {
      if (Math.random() > 0.5) {
        throw new Error();
      }
      return new Author();
    }
  
    try {
      return findAuthor(); // succeed or fail
    } catch(error) {
      return findOtherAuther();
    } finally {
      // always runs
      // doesn't affect the return value
    }
    ```
  
    Asynchronous example:
  
    ```js
    findAuthor().catch(function(reason){
      return findOtherAuther();
    }).finally(function(){
      // author was either found, or not
    });
    ```
  
    @method finally
    @param {Function} callback
    @return {Promise}
  */


  Promise.prototype.finally = function _finally(callback) {
    var promise = this;
    var constructor = promise.constructor;

    if (isFunction(callback)) {
      return promise.then(function (value) {
        return constructor.resolve(callback()).then(function () {
          return value;
        });
      }, function (reason) {
        return constructor.resolve(callback()).then(function () {
          throw reason;
        });
      });
    }

    return promise.then(callback, callback);
  };

  return Promise;
}();

Promise$1.prototype.then = then;
Promise$1.all = all;
Promise$1.race = race;
Promise$1.resolve = resolve$1;
Promise$1.reject = reject$1;
Promise$1._setScheduler = setScheduler;
Promise$1._setAsap = setAsap;
Promise$1._asap = asap;

/*global self*/
function polyfill() {
  var local = void 0;

  if (typeof global !== 'undefined') {
    local = global;
  } else if (typeof self !== 'undefined') {
    local = self;
  } else {
    try {
      local = Function('return this')();
    } catch (e) {
      throw new Error('polyfill failed because global object is unavailable in this environment');
    }
  }

  var P = local.Promise;

  if (P) {
    var promiseToString = null;
    try {
      promiseToString = Object.prototype.toString.call(P.resolve());
    } catch (e) {
      // silently ignored
    }

    if (promiseToString === '[object Promise]' && !P.cast) {
      return;
    }
  }

  local.Promise = Promise$1;
}

// Strange compat..
Promise$1.polyfill = polyfill;
Promise$1.Promise = Promise$1;

return Promise$1;

})));



//# sourceMappingURL=es6-promise.map

/*!
 * @overview es6-promise - a tiny implementation of Promises/A+.
 * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors (Conversion to ES6 API by Jake Archibald)
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/stefanpenner/es6-promise/master/LICENSE
 * @version   v4.2.8+1e68dce6
 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.ES6Promise = factory());
}(this, (function () { 'use strict';

function objectOrFunction(x) {
  var type = typeof x;
  return x !== null && (type === 'object' || type === 'function');
}

function isFunction(x) {
  return typeof x === 'function';
}



var _isArray = void 0;
if (Array.isArray) {
  _isArray = Array.isArray;
} else {
  _isArray = function (x) {
    return Object.prototype.toString.call(x) === '[object Array]';
  };
}

var isArray = _isArray;

var len = 0;
var vertxNext = void 0;
var customSchedulerFn = void 0;

var asap = function asap(callback, arg) {
  queue[len] = callback;
  queue[len + 1] = arg;
  len += 2;
  if (len === 2) {
    // If len is 2, that means that we need to schedule an async flush.
    // If additional callbacks are queued before the queue is flushed, they
    // will be processed by this flush that we are scheduling.
    if (customSchedulerFn) {
      customSchedulerFn(flush);
    } else {
      scheduleFlush();
    }
  }
};

function setScheduler(scheduleFn) {
  customSchedulerFn = scheduleFn;
}

function setAsap(asapFn) {
  asap = asapFn;
}

var browserWindow = typeof window !== 'undefined' ? window : undefined;
var browserGlobal = browserWindow || {};
var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
var isNode = typeof self === 'undefined' && typeof process !== 'undefined' && {}.toString.call(process) === '[object process]';

// test for web worker but not in IE10
var isWorker = typeof Uint8ClampedArray !== 'undefined' && typeof importScripts !== 'undefined' && typeof MessageChannel !== 'undefined';

// node
function useNextTick() {
  // node version 0.10.x displays a deprecation warning when nextTick is used recursively
  // see https://github.com/cujojs/when/issues/410 for details
  return function () {
    return process.nextTick(flush);
  };
}

// vertx
function useVertxTimer() {
  if (typeof vertxNext !== 'undefined') {
    return function () {
      vertxNext(flush);
    };
  }

  return useSetTimeout();
}

function useMutationObserver() {
  var iterations = 0;
  var observer = new BrowserMutationObserver(flush);
  var node = document.createTextNode('');
  observer.observe(node, { characterData: true });

  return function () {
    node.data = iterations = ++iterations % 2;
  };
}

// web worker
function useMessageChannel() {
  var channel = new MessageChannel();
  channel.port1.onmessage = flush;
  return function () {
    return channel.port2.postMessage(0);
  };
}

function useSetTimeout() {
  // Store setTimeout reference so es6-promise will be unaffected by
  // other code modifying setTimeout (like sinon.useFakeTimers())
  var globalSetTimeout = setTimeout;
  return function () {
    return globalSetTimeout(flush, 1);
  };
}

var queue = new Array(1000);
function flush() {
  for (var i = 0; i < len; i += 2) {
    var callback = queue[i];
    var arg = queue[i + 1];

    callback(arg);

    queue[i] = undefined;
    queue[i + 1] = undefined;
  }

  len = 0;
}

function attemptVertx() {
  try {
    var vertx = Function('return this')().require('vertx');
    vertxNext = vertx.runOnLoop || vertx.runOnContext;
    return useVertxTimer();
  } catch (e) {
    return useSetTimeout();
  }
}

var scheduleFlush = void 0;
// Decide what async method to use to triggering processing of queued callbacks:
if (isNode) {
  scheduleFlush = useNextTick();
} else if (BrowserMutationObserver) {
  scheduleFlush = useMutationObserver();
} else if (isWorker) {
  scheduleFlush = useMessageChannel();
} else if (browserWindow === undefined && typeof require === 'function') {
  scheduleFlush = attemptVertx();
} else {
  scheduleFlush = useSetTimeout();
}

function then(onFulfillment, onRejection) {
  var parent = this;

  var child = new this.constructor(noop);

  if (child[PROMISE_ID] === undefined) {
    makePromise(child);
  }

  var _state = parent._state;


  if (_state) {
    var callback = arguments[_state - 1];
    asap(function () {
      return invokeCallback(_state, child, callback, parent._result);
    });
  } else {
    subscribe(parent, child, onFulfillment, onRejection);
  }

  return child;
}

/**
  `Promise.resolve` returns a promise that will become resolved with the
  passed `value`. It is shorthand for the following:

  ```javascript
  let promise = new Promise(function(resolve, reject){
    resolve(1);
  });

  promise.then(function(value){
    // value === 1
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = Promise.resolve(1);

  promise.then(function(value){
    // value === 1
  });
  ```

  @method resolve
  @static
  @param {Any} value value that the returned promise will be resolved with
  Useful for tooling.
  @return {Promise} a promise that will become fulfilled with the given
  `value`
*/
function resolve$1(object) {
  /*jshint validthis:true */
  var Constructor = this;

  if (object && typeof object === 'object' && object.constructor === Constructor) {
    return object;
  }

  var promise = new Constructor(noop);
  resolve(promise, object);
  return promise;
}

var PROMISE_ID = Math.random().toString(36).substring(2);

function noop() {}

var PENDING = void 0;
var FULFILLED = 1;
var REJECTED = 2;

function selfFulfillment() {
  return new TypeError("You cannot resolve a promise with itself");
}

function cannotReturnOwn() {
  return new TypeError('A promises callback cannot return that same promise.');
}

function tryThen(then$$1, value, fulfillmentHandler, rejectionHandler) {
  try {
    then$$1.call(value, fulfillmentHandler, rejectionHandler);
  } catch (e) {
    return e;
  }
}

function handleForeignThenable(promise, thenable, then$$1) {
  asap(function (promise) {
    var sealed = false;
    var error = tryThen(then$$1, thenable, function (value) {
      if (sealed) {
        return;
      }
      sealed = true;
      if (thenable !== value) {
        resolve(promise, value);
      } else {
        fulfill(promise, value);
      }
    }, function (reason) {
      if (sealed) {
        return;
      }
      sealed = true;

      reject(promise, reason);
    }, 'Settle: ' + (promise._label || ' unknown promise'));

    if (!sealed && error) {
      sealed = true;
      reject(promise, error);
    }
  }, promise);
}

function handleOwnThenable(promise, thenable) {
  if (thenable._state === FULFILLED) {
    fulfill(promise, thenable._result);
  } else if (thenable._state === REJECTED) {
    reject(promise, thenable._result);
  } else {
    subscribe(thenable, undefined, function (value) {
      return resolve(promise, value);
    }, function (reason) {
      return reject(promise, reason);
    });
  }
}

function handleMaybeThenable(promise, maybeThenable, then$$1) {
  if (maybeThenable.constructor === promise.constructor && then$$1 === then && maybeThenable.constructor.resolve === resolve$1) {
    handleOwnThenable(promise, maybeThenable);
  } else {
    if (then$$1 === undefined) {
      fulfill(promise, maybeThenable);
    } else if (isFunction(then$$1)) {
      handleForeignThenable(promise, maybeThenable, then$$1);
    } else {
      fulfill(promise, maybeThenable);
    }
  }
}

function resolve(promise, value) {
  if (promise === value) {
    reject(promise, selfFulfillment());
  } else if (objectOrFunction(value)) {
    var then$$1 = void 0;
    try {
      then$$1 = value.then;
    } catch (error) {
      reject(promise, error);
      return;
    }
    handleMaybeThenable(promise, value, then$$1);
  } else {
    fulfill(promise, value);
  }
}

function publishRejection(promise) {
  if (promise._onerror) {
    promise._onerror(promise._result);
  }

  publish(promise);
}

function fulfill(promise, value) {
  if (promise._state !== PENDING) {
    return;
  }

  promise._result = value;
  promise._state = FULFILLED;

  if (promise._subscribers.length !== 0) {
    asap(publish, promise);
  }
}

function reject(promise, reason) {
  if (promise._state !== PENDING) {
    return;
  }
  promise._state = REJECTED;
  promise._result = reason;

  asap(publishRejection, promise);
}

function subscribe(parent, child, onFulfillment, onRejection) {
  var _subscribers = parent._subscribers;
  var length = _subscribers.length;


  parent._onerror = null;

  _subscribers[length] = child;
  _subscribers[length + FULFILLED] = onFulfillment;
  _subscribers[length + REJECTED] = onRejection;

  if (length === 0 && parent._state) {
    asap(publish, parent);
  }
}

function publish(promise) {
  var subscribers = promise._subscribers;
  var settled = promise._state;

  if (subscribers.length === 0) {
    return;
  }

  var child = void 0,
      callback = void 0,
      detail = promise._result;

  for (var i = 0; i < subscribers.length; i += 3) {
    child = subscribers[i];
    callback = subscribers[i + settled];

    if (child) {
      invokeCallback(settled, child, callback, detail);
    } else {
      callback(detail);
    }
  }

  promise._subscribers.length = 0;
}

function invokeCallback(settled, promise, callback, detail) {
  var hasCallback = isFunction(callback),
      value = void 0,
      error = void 0,
      succeeded = true;

  if (hasCallback) {
    try {
      value = callback(detail);
    } catch (e) {
      succeeded = false;
      error = e;
    }

    if (promise === value) {
      reject(promise, cannotReturnOwn());
      return;
    }
  } else {
    value = detail;
  }

  if (promise._state !== PENDING) {
    // noop
  } else if (hasCallback && succeeded) {
    resolve(promise, value);
  } else if (succeeded === false) {
    reject(promise, error);
  } else if (settled === FULFILLED) {
    fulfill(promise, value);
  } else if (settled === REJECTED) {
    reject(promise, value);
  }
}

function initializePromise(promise, resolver) {
  try {
    resolver(function resolvePromise(value) {
      resolve(promise, value);
    }, function rejectPromise(reason) {
      reject(promise, reason);
    });
  } catch (e) {
    reject(promise, e);
  }
}

var id = 0;
function nextId() {
  return id++;
}

function makePromise(promise) {
  promise[PROMISE_ID] = id++;
  promise._state = undefined;
  promise._result = undefined;
  promise._subscribers = [];
}

function validationError() {
  return new Error('Array Methods must be provided an Array');
}

var Enumerator = function () {
  function Enumerator(Constructor, input) {
    this._instanceConstructor = Constructor;
    this.promise = new Constructor(noop);

    if (!this.promise[PROMISE_ID]) {
      makePromise(this.promise);
    }

    if (isArray(input)) {
      this.length = input.length;
      this._remaining = input.length;

      this._result = new Array(this.length);

      if (this.length === 0) {
        fulfill(this.promise, this._result);
      } else {
        this.length = this.length || 0;
        this._enumerate(input);
        if (this._remaining === 0) {
          fulfill(this.promise, this._result);
        }
      }
    } else {
      reject(this.promise, validationError());
    }
  }

  Enumerator.prototype._enumerate = function _enumerate(input) {
    for (var i = 0; this._state === PENDING && i < input.length; i++) {
      this._eachEntry(input[i], i);
    }
  };

  Enumerator.prototype._eachEntry = function _eachEntry(entry, i) {
    var c = this._instanceConstructor;
    var resolve$$1 = c.resolve;


    if (resolve$$1 === resolve$1) {
      var _then = void 0;
      var error = void 0;
      var didError = false;
      try {
        _then = entry.then;
      } catch (e) {
        didError = true;
        error = e;
      }

      if (_then === then && entry._state !== PENDING) {
        this._settledAt(entry._state, i, entry._result);
      } else if (typeof _then !== 'function') {
        this._remaining--;
        this._result[i] = entry;
      } else if (c === Promise$2) {
        var promise = new c(noop);
        if (didError) {
          reject(promise, error);
        } else {
          handleMaybeThenable(promise, entry, _then);
        }
        this._willSettleAt(promise, i);
      } else {
        this._willSettleAt(new c(function (resolve$$1) {
          return resolve$$1(entry);
        }), i);
      }
    } else {
      this._willSettleAt(resolve$$1(entry), i);
    }
  };

  Enumerator.prototype._settledAt = function _settledAt(state, i, value) {
    var promise = this.promise;


    if (promise._state === PENDING) {
      this._remaining--;

      if (state === REJECTED) {
        reject(promise, value);
      } else {
        this._result[i] = value;
      }
    }

    if (this._remaining === 0) {
      fulfill(promise, this._result);
    }
  };

  Enumerator.prototype._willSettleAt = function _willSettleAt(promise, i) {
    var enumerator = this;

    subscribe(promise, undefined, function (value) {
      return enumerator._settledAt(FULFILLED, i, value);
    }, function (reason) {
      return enumerator._settledAt(REJECTED, i, reason);
    });
  };

  return Enumerator;
}();

/**
  `Promise.all` accepts an array of promises, and returns a new promise which
  is fulfilled with an array of fulfillment values for the passed promises, or
  rejected with the reason of the first passed promise to be rejected. It casts all
  elements of the passed iterable to promises as it runs this algorithm.

  Example:

  ```javascript
  let promise1 = resolve(1);
  let promise2 = resolve(2);
  let promise3 = resolve(3);
  let promises = [ promise1, promise2, promise3 ];

  Promise.all(promises).then(function(array){
    // The array here would be [ 1, 2, 3 ];
  });
  ```

  If any of the `promises` given to `all` are rejected, the first promise
  that is rejected will be given as an argument to the returned promises's
  rejection handler. For example:

  Example:

  ```javascript
  let promise1 = resolve(1);
  let promise2 = reject(new Error("2"));
  let promise3 = reject(new Error("3"));
  let promises = [ promise1, promise2, promise3 ];

  Promise.all(promises).then(function(array){
    // Code here never runs because there are rejected promises!
  }, function(error) {
    // error.message === "2"
  });
  ```

  @method all
  @static
  @param {Array} entries array of promises
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Promise} promise that is fulfilled when all `promises` have been
  fulfilled, or rejected if any of them become rejected.
  @static
*/
function all(entries) {
  return new Enumerator(this, entries).promise;
}

/**
  `Promise.race` returns a new promise which is settled in the same way as the
  first passed promise to settle.

  Example:

  ```javascript
  let promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 2');
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // result === 'promise 2' because it was resolved before promise1
    // was resolved.
  });
  ```

  `Promise.race` is deterministic in that only the state of the first
  settled promise matters. For example, even if other promises given to the
  `promises` array argument are resolved, but the first settled promise has
  become rejected before the other promises became fulfilled, the returned
  promise will become rejected:

  ```javascript
  let promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      reject(new Error('promise 2'));
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // Code here never runs
  }, function(reason){
    // reason.message === 'promise 2' because promise 2 became rejected before
    // promise 1 became fulfilled
  });
  ```

  An example real-world use case is implementing timeouts:

  ```javascript
  Promise.race([ajax('foo.json'), timeout(5000)])
  ```

  @method race
  @static
  @param {Array} promises array of promises to observe
  Useful for tooling.
  @return {Promise} a promise which settles in the same way as the first passed
  promise to settle.
*/
function race(entries) {
  /*jshint validthis:true */
  var Constructor = this;

  if (!isArray(entries)) {
    return new Constructor(function (_, reject) {
      return reject(new TypeError('You must pass an array to race.'));
    });
  } else {
    return new Constructor(function (resolve, reject) {
      var length = entries.length;
      for (var i = 0; i < length; i++) {
        Constructor.resolve(entries[i]).then(resolve, reject);
      }
    });
  }
}

/**
  `Promise.reject` returns a promise rejected with the passed `reason`.
  It is shorthand for the following:

  ```javascript
  let promise = new Promise(function(resolve, reject){
    reject(new Error('WHOOPS'));
  });

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = Promise.reject(new Error('WHOOPS'));

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  @method reject
  @static
  @param {Any} reason value that the returned promise will be rejected with.
  Useful for tooling.
  @return {Promise} a promise rejected with the given `reason`.
*/
function reject$1(reason) {
  /*jshint validthis:true */
  var Constructor = this;
  var promise = new Constructor(noop);
  reject(promise, reason);
  return promise;
}

function needsResolver() {
  throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
}

function needsNew() {
  throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
}

/**
  Promise objects represent the eventual result of an asynchronous operation. The
  primary way of interacting with a promise is through its `then` method, which
  registers callbacks to receive either a promise's eventual value or the reason
  why the promise cannot be fulfilled.

  Terminology
  -----------

  - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
  - `thenable` is an object or function that defines a `then` method.
  - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
  - `exception` is a value that is thrown using the throw statement.
  - `reason` is a value that indicates why a promise was rejected.
  - `settled` the final resting state of a promise, fulfilled or rejected.

  A promise can be in one of three states: pending, fulfilled, or rejected.

  Promises that are fulfilled have a fulfillment value and are in the fulfilled
  state.  Promises that are rejected have a rejection reason and are in the
  rejected state.  A fulfillment value is never a thenable.

  Promises can also be said to *resolve* a value.  If this value is also a
  promise, then the original promise's settled state will match the value's
  settled state.  So a promise that *resolves* a promise that rejects will
  itself reject, and a promise that *resolves* a promise that fulfills will
  itself fulfill.


  Basic Usage:
  ------------

  ```js
  let promise = new Promise(function(resolve, reject) {
    // on success
    resolve(value);

    // on failure
    reject(reason);
  });

  promise.then(function(value) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Advanced Usage:
  ---------------

  Promises shine when abstracting away asynchronous interactions such as
  `XMLHttpRequest`s.

  ```js
  function getJSON(url) {
    return new Promise(function(resolve, reject){
      let xhr = new XMLHttpRequest();

      xhr.open('GET', url);
      xhr.onreadystatechange = handler;
      xhr.responseType = 'json';
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send();

      function handler() {
        if (this.readyState === this.DONE) {
          if (this.status === 200) {
            resolve(this.response);
          } else {
            reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
          }
        }
      };
    });
  }

  getJSON('/posts.json').then(function(json) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Unlike callbacks, promises are great composable primitives.

  ```js
  Promise.all([
    getJSON('/posts'),
    getJSON('/comments')
  ]).then(function(values){
    values[0] // => postsJSON
    values[1] // => commentsJSON

    return values;
  });
  ```

  @class Promise
  @param {Function} resolver
  Useful for tooling.
  @constructor
*/

var Promise$2 = function () {
  function Promise(resolver) {
    this[PROMISE_ID] = nextId();
    this._result = this._state = undefined;
    this._subscribers = [];

    if (noop !== resolver) {
      typeof resolver !== 'function' && needsResolver();
      this instanceof Promise ? initializePromise(this, resolver) : needsNew();
    }
  }

  /**
  The primary way of interacting with a promise is through its `then` method,
  which registers callbacks to receive either a promise's eventual value or the
  reason why the promise cannot be fulfilled.
   ```js
  findUser().then(function(user){
    // user is available
  }, function(reason){
    // user is unavailable, and you are given the reason why
  });
  ```
   Chaining
  --------
   The return value of `then` is itself a promise.  This second, 'downstream'
  promise is resolved with the return value of the first promise's fulfillment
  or rejection handler, or rejected if the handler throws an exception.
   ```js
  findUser().then(function (user) {
    return user.name;
  }, function (reason) {
    return 'default name';
  }).then(function (userName) {
    // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
    // will be `'default name'`
  });
   findUser().then(function (user) {
    throw new Error('Found user, but still unhappy');
  }, function (reason) {
    throw new Error('`findUser` rejected and we're unhappy');
  }).then(function (value) {
    // never reached
  }, function (reason) {
    // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
    // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
  });
  ```
  If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.
   ```js
  findUser().then(function (user) {
    throw new PedagogicalException('Upstream error');
  }).then(function (value) {
    // never reached
  }).then(function (value) {
    // never reached
  }, function (reason) {
    // The `PedgagocialException` is propagated all the way down to here
  });
  ```
   Assimilation
  ------------
   Sometimes the value you want to propagate to a downstream promise can only be
  retrieved asynchronously. This can be achieved by returning a promise in the
  fulfillment or rejection handler. The downstream promise will then be pending
  until the returned promise is settled. This is called *assimilation*.
   ```js
  findUser().then(function (user) {
    return findCommentsByAuthor(user);
  }).then(function (comments) {
    // The user's comments are now available
  });
  ```
   If the assimliated promise rejects, then the downstream promise will also reject.
   ```js
  findUser().then(function (user) {
    return findCommentsByAuthor(user);
  }).then(function (comments) {
    // If `findCommentsByAuthor` fulfills, we'll have the value here
  }, function (reason) {
    // If `findCommentsByAuthor` rejects, we'll have the reason here
  });
  ```
   Simple Example
  --------------
   Synchronous Example
   ```javascript
  let result;
   try {
    result = findResult();
    // success
  } catch(reason) {
    // failure
  }
  ```
   Errback Example
   ```js
  findResult(function(result, err){
    if (err) {
      // failure
    } else {
      // success
    }
  });
  ```
   Promise Example;
   ```javascript
  findResult().then(function(result){
    // success
  }, function(reason){
    // failure
  });
  ```
   Advanced Example
  --------------
   Synchronous Example
   ```javascript
  let author, books;
   try {
    author = findAuthor();
    books  = findBooksByAuthor(author);
    // success
  } catch(reason) {
    // failure
  }
  ```
   Errback Example
   ```js
   function foundBooks(books) {
   }
   function failure(reason) {
   }
   findAuthor(function(author, err){
    if (err) {
      failure(err);
      // failure
    } else {
      try {
        findBoooksByAuthor(author, function(books, err) {
          if (err) {
            failure(err);
          } else {
            try {
              foundBooks(books);
            } catch(reason) {
              failure(reason);
            }
          }
        });
      } catch(error) {
        failure(err);
      }
      // success
    }
  });
  ```
   Promise Example;
   ```javascript
  findAuthor().
    then(findBooksByAuthor).
    then(function(books){
      // found books
  }).catch(function(reason){
    // something went wrong
  });
  ```
   @method then
  @param {Function} onFulfilled
  @param {Function} onRejected
  Useful for tooling.
  @return {Promise}
  */

  /**
  `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
  as the catch block of a try/catch statement.
  ```js
  function findAuthor(){
  throw new Error('couldn't find that author');
  }
  // synchronous
  try {
  findAuthor();
  } catch(reason) {
  // something went wrong
  }
  // async with promises
  findAuthor().catch(function(reason){
  // something went wrong
  });
  ```
  @method catch
  @param {Function} onRejection
  Useful for tooling.
  @return {Promise}
  */


  Promise.prototype.catch = function _catch(onRejection) {
    return this.then(null, onRejection);
  };

  /**
    `finally` will be invoked regardless of the promise's fate just as native
    try/catch/finally behaves
  
    Synchronous example:
  
    ```js
    findAuthor() {
      if (Math.random() > 0.5) {
        throw new Error();
      }
      return new Author();
    }
  
    try {
      return findAuthor(); // succeed or fail
    } catch(error) {
      return findOtherAuther();
    } finally {
      // always runs
      // doesn't affect the return value
    }
    ```
  
    Asynchronous example:
  
    ```js
    findAuthor().catch(function(reason){
      return findOtherAuther();
    }).finally(function(){
      // author was either found, or not
    });
    ```
  
    @method finally
    @param {Function} callback
    @return {Promise}
  */


  Promise.prototype.finally = function _finally(callback) {
    var promise = this;
    var constructor = promise.constructor;

    if (isFunction(callback)) {
      return promise.then(function (value) {
        return constructor.resolve(callback()).then(function () {
          return value;
        });
      }, function (reason) {
        return constructor.resolve(callback()).then(function () {
          throw reason;
        });
      });
    }

    return promise.then(callback, callback);
  };

  return Promise;
}();

Promise$2.prototype.then = then;
Promise$2.all = all;
Promise$2.race = race;
Promise$2.resolve = resolve$1;
Promise$2.reject = reject$1;
Promise$2._setScheduler = setScheduler;
Promise$2._setAsap = setAsap;
Promise$2._asap = asap;

/*global self*/
function polyfill() {
  var local = void 0;

  if (typeof global !== 'undefined') {
    local = global;
  } else if (typeof self !== 'undefined') {
    local = self;
  } else {
    try {
      local = Function('return this')();
    } catch (e) {
      throw new Error('polyfill failed because global object is unavailable in this environment');
    }
  }

  var P = local.Promise;

  if (P) {
    var promiseToString = null;
    try {
      promiseToString = Object.prototype.toString.call(P.resolve());
    } catch (e) {
      // silently ignored
    }

    if (promiseToString === '[object Promise]' && !P.cast) {
      return;
    }
  }

  local.Promise = Promise$2;
}

// Strange compat..
Promise$2.polyfill = polyfill;
Promise$2.Promise = Promise$2;

Promise$2.polyfill();

return Promise$2;

})));



//# sourceMappingURL=es6-promise.auto.map

(function webpackUniversalModuleDefinition(root, factory) {
    if(typeof exports === 'object' && typeof module === 'object')
        module.exports = factory();
    else if(typeof define === 'function' && define.amd)
        define([], factory);
    else if(typeof exports === 'object')
        exports["axios"] = factory();
    else
        root["axios"] = factory();
})(this, function() {
    return /******/ (function(modules) { // webpackBootstrap
        /******/ 	// The module cache
        /******/ 	var installedModules = {};
        /******/
        /******/ 	// The require function
        /******/ 	function __webpack_require__(moduleId) {
            /******/
            /******/ 		// Check if module is in cache
            /******/ 		if(installedModules[moduleId])
                /******/ 			return installedModules[moduleId].exports;
            /******/
            /******/ 		// Create a new module (and put it into the cache)
            /******/ 		var module = installedModules[moduleId] = {
                /******/ 			exports: {},
                /******/ 			id: moduleId,
                /******/ 			loaded: false
                /******/ 		};
            /******/
            /******/ 		// Execute the module function
            /******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
            /******/
            /******/ 		// Flag the module as loaded
            /******/ 		module.loaded = true;
            /******/
            /******/ 		// Return the exports of the module
            /******/ 		return module.exports;
            /******/ 	}
        /******/
        /******/
        /******/ 	// expose the modules object (__webpack_modules__)
        /******/ 	__webpack_require__.m = modules;
        /******/
        /******/ 	// expose the module cache
        /******/ 	__webpack_require__.c = installedModules;
        /******/
        /******/ 	// __webpack_public_path__
        /******/ 	__webpack_require__.p = "";
        /******/
        /******/ 	// Load entry module and return exports
        /******/ 	return __webpack_require__(0);
        /******/ })
        /************************************************************************/
        /******/ ([
            /* 0 */
            /***/ (function(module, exports, __webpack_require__) {

                module.exports = __webpack_require__(1);

                /***/ }),
            /* 1 */
            /***/ (function(module, exports, __webpack_require__) {

                'use strict';

                var utils = __webpack_require__(2);
                var bind = __webpack_require__(3);
                var Axios = __webpack_require__(4);
                var mergeConfig = __webpack_require__(22);
                var defaults = __webpack_require__(10);

                /**
                 * Create an instance of Axios
                 *
                 * @param {Object} defaultConfig The default config for the instance
                 * @return {Axios} A new instance of Axios
                 */
                function createInstance(defaultConfig) {
                    var context = new Axios(defaultConfig);
                    var instance = bind(Axios.prototype.request, context);

                    // Copy axios.prototype to instance
                    utils.extend(instance, Axios.prototype, context);

                    // Copy context to instance
                    utils.extend(instance, context);

                    return instance;
                }

                // Create the default instance to be exported
                var axios = createInstance(defaults);

                // Expose Axios class to allow class inheritance
                axios.Axios = Axios;

                // Factory for creating new instances
                axios.create = function create(instanceConfig) {
                    return createInstance(mergeConfig(axios.defaults, instanceConfig));
                };

                // Expose Cancel & CancelToken
                axios.Cancel = __webpack_require__(23);
                axios.CancelToken = __webpack_require__(24);
                axios.isCancel = __webpack_require__(9);

                // Expose all/spread
                axios.all = function all(promises) {
                    return Promise.all(promises);
                };
                axios.spread = __webpack_require__(25);

                module.exports = axios;

                // Allow use of default import syntax in TypeScript
                module.exports.default = axios;


                /***/ }),
            /* 2 */
            /***/ (function(module, exports, __webpack_require__) {

                'use strict';

                var bind = __webpack_require__(3);

                /*global toString:true*/

                // utils is a library of generic helper functions non-specific to axios

                var toString = Object.prototype.toString;

                /**
                 * Determine if a value is an Array
                 *
                 * @param {Object} val The value to test
                 * @returns {boolean} True if value is an Array, otherwise false
                 */
                function isArray(val) {
                    return toString.call(val) === '[object Array]';
                }

                /**
                 * Determine if a value is undefined
                 *
                 * @param {Object} val The value to test
                 * @returns {boolean} True if the value is undefined, otherwise false
                 */
                function isUndefined(val) {
                    return typeof val === 'undefined';
                }

                /**
                 * Determine if a value is a Buffer
                 *
                 * @param {Object} val The value to test
                 * @returns {boolean} True if value is a Buffer, otherwise false
                 */
                function isBuffer(val) {
                    return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor)
                        && typeof val.constructor.isBuffer === 'function' && val.constructor.isBuffer(val);
                }

                /**
                 * Determine if a value is an ArrayBuffer
                 *
                 * @param {Object} val The value to test
                 * @returns {boolean} True if value is an ArrayBuffer, otherwise false
                 */
                function isArrayBuffer(val) {
                    return toString.call(val) === '[object ArrayBuffer]';
                }

                /**
                 * Determine if a value is a FormData
                 *
                 * @param {Object} val The value to test
                 * @returns {boolean} True if value is an FormData, otherwise false
                 */
                function isFormData(val) {
                    return (typeof FormData !== 'undefined') && (val instanceof FormData);
                }

                /**
                 * Determine if a value is a view on an ArrayBuffer
                 *
                 * @param {Object} val The value to test
                 * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
                 */
                function isArrayBufferView(val) {
                    var result;
                    if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
                        result = ArrayBuffer.isView(val);
                    } else {
                        result = (val) && (val.buffer) && (val.buffer instanceof ArrayBuffer);
                    }
                    return result;
                }

                /**
                 * Determine if a value is a String
                 *
                 * @param {Object} val The value to test
                 * @returns {boolean} True if value is a String, otherwise false
                 */
                function isString(val) {
                    return typeof val === 'string';
                }

                /**
                 * Determine if a value is a Number
                 *
                 * @param {Object} val The value to test
                 * @returns {boolean} True if value is a Number, otherwise false
                 */
                function isNumber(val) {
                    return typeof val === 'number';
                }

                /**
                 * Determine if a value is an Object
                 *
                 * @param {Object} val The value to test
                 * @returns {boolean} True if value is an Object, otherwise false
                 */
                function isObject(val) {
                    return val !== null && typeof val === 'object';
                }

                /**
                 * Determine if a value is a Date
                 *
                 * @param {Object} val The value to test
                 * @returns {boolean} True if value is a Date, otherwise false
                 */
                function isDate(val) {
                    return toString.call(val) === '[object Date]';
                }

                /**
                 * Determine if a value is a File
                 *
                 * @param {Object} val The value to test
                 * @returns {boolean} True if value is a File, otherwise false
                 */
                function isFile(val) {
                    return toString.call(val) === '[object File]';
                }

                /**
                 * Determine if a value is a Blob
                 *
                 * @param {Object} val The value to test
                 * @returns {boolean} True if value is a Blob, otherwise false
                 */
                function isBlob(val) {
                    return toString.call(val) === '[object Blob]';
                }

                /**
                 * Determine if a value is a Function
                 *
                 * @param {Object} val The value to test
                 * @returns {boolean} True if value is a Function, otherwise false
                 */
                function isFunction(val) {
                    return toString.call(val) === '[object Function]';
                }

                /**
                 * Determine if a value is a Stream
                 *
                 * @param {Object} val The value to test
                 * @returns {boolean} True if value is a Stream, otherwise false
                 */
                function isStream(val) {
                    return isObject(val) && isFunction(val.pipe);
                }

                /**
                 * Determine if a value is a URLSearchParams object
                 *
                 * @param {Object} val The value to test
                 * @returns {boolean} True if value is a URLSearchParams object, otherwise false
                 */
                function isURLSearchParams(val) {
                    return typeof URLSearchParams !== 'undefined' && val instanceof URLSearchParams;
                }

                /**
                 * Trim excess whitespace off the beginning and end of a string
                 *
                 * @param {String} str The String to trim
                 * @returns {String} The String freed of excess whitespace
                 */
                function trim(str) {
                    return str.replace(/^\s*/, '').replace(/\s*$/, '');
                }

                /**
                 * Determine if we're running in a standard browser environment
                 *
                 * This allows axios to run in a web worker, and react-native.
                 * Both environments support XMLHttpRequest, but not fully standard globals.
                 *
                 * web workers:
                 *  typeof window -> undefined
                 *  typeof document -> undefined
                 *
                 * react-native:
                 *  navigator.product -> 'ReactNative'
                 * nativescript
                 *  navigator.product -> 'NativeScript' or 'NS'
                 */
                function isStandardBrowserEnv() {
                    if (typeof navigator !== 'undefined' && (navigator.product === 'ReactNative' ||
                        navigator.product === 'NativeScript' ||
                        navigator.product === 'NS')) {
                        return false;
                    }
                    return (
                        typeof window !== 'undefined' &&
                        typeof document !== 'undefined'
                    );
                }

                /**
                 * Iterate over an Array or an Object invoking a function for each item.
                 *
                 * If `obj` is an Array callback will be called passing
                 * the value, index, and complete array for each item.
                 *
                 * If 'obj' is an Object callback will be called passing
                 * the value, key, and complete object for each property.
                 *
                 * @param {Object|Array} obj The object to iterate
                 * @param {Function} fn The callback to invoke for each item
                 */
                function forEach(obj, fn) {
                    // Don't bother if no value provided
                    if (obj === null || typeof obj === 'undefined') {
                        return;
                    }

                    // Force an array if not already something iterable
                    if (typeof obj !== 'object') {
                        /*eslint no-param-reassign:0*/
                        obj = [obj];
                    }

                    if (isArray(obj)) {
                        // Iterate over array values
                        for (var i = 0, l = obj.length; i < l; i++) {
                            fn.call(null, obj[i], i, obj);
                        }
                    } else {
                        // Iterate over object keys
                        for (var key in obj) {
                            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                                fn.call(null, obj[key], key, obj);
                            }
                        }
                    }
                }

                /**
                 * Accepts varargs expecting each argument to be an object, then
                 * immutably merges the properties of each object and returns result.
                 *
                 * When multiple objects contain the same key the later object in
                 * the arguments list will take precedence.
                 *
                 * Example:
                 *
                 * ```js
                 * var result = merge({foo: 123}, {foo: 456});
                 * console.log(result.foo); // outputs 456
                 * ```
                 *
                 * @param {Object} obj1 Object to merge
                 * @returns {Object} Result of all merge properties
                 */
                function merge(/* obj1, obj2, obj3, ... */) {
                    var result = {};
                    function assignValue(val, key) {
                        if (typeof result[key] === 'object' && typeof val === 'object') {
                            result[key] = merge(result[key], val);
                        } else {
                            result[key] = val;
                        }
                    }

                    for (var i = 0, l = arguments.length; i < l; i++) {
                        forEach(arguments[i], assignValue);
                    }
                    return result;
                }

                /**
                 * Function equal to merge with the difference being that no reference
                 * to original objects is kept.
                 *
                 * @see merge
                 * @param {Object} obj1 Object to merge
                 * @returns {Object} Result of all merge properties
                 */
                function deepMerge(/* obj1, obj2, obj3, ... */) {
                    var result = {};
                    function assignValue(val, key) {
                        if (typeof result[key] === 'object' && typeof val === 'object') {
                            result[key] = deepMerge(result[key], val);
                        } else if (typeof val === 'object') {
                            result[key] = deepMerge({}, val);
                        } else {
                            result[key] = val;
                        }
                    }

                    for (var i = 0, l = arguments.length; i < l; i++) {
                        forEach(arguments[i], assignValue);
                    }
                    return result;
                }

                /**
                 * Extends object a by mutably adding to it the properties of object b.
                 *
                 * @param {Object} a The object to be extended
                 * @param {Object} b The object to copy properties from
                 * @param {Object} thisArg The object to bind function to
                 * @return {Object} The resulting value of object a
                 */
                function extend(a, b, thisArg) {
                    forEach(b, function assignValue(val, key) {
                        if (thisArg && typeof val === 'function') {
                            a[key] = bind(val, thisArg);
                        } else {
                            a[key] = val;
                        }
                    });
                    return a;
                }

                module.exports = {
                    isArray: isArray,
                    isArrayBuffer: isArrayBuffer,
                    isBuffer: isBuffer,
                    isFormData: isFormData,
                    isArrayBufferView: isArrayBufferView,
                    isString: isString,
                    isNumber: isNumber,
                    isObject: isObject,
                    isUndefined: isUndefined,
                    isDate: isDate,
                    isFile: isFile,
                    isBlob: isBlob,
                    isFunction: isFunction,
                    isStream: isStream,
                    isURLSearchParams: isURLSearchParams,
                    isStandardBrowserEnv: isStandardBrowserEnv,
                    forEach: forEach,
                    merge: merge,
                    deepMerge: deepMerge,
                    extend: extend,
                    trim: trim
                };


                /***/ }),
            /* 3 */
            /***/ (function(module, exports) {

                'use strict';

                module.exports = function bind(fn, thisArg) {
                    return function wrap() {
                        var args = new Array(arguments.length);
                        for (var i = 0; i < args.length; i++) {
                            args[i] = arguments[i];
                        }
                        return fn.apply(thisArg, args);
                    };
                };


                /***/ }),
            /* 4 */
            /***/ (function(module, exports, __webpack_require__) {

                'use strict';

                var utils = __webpack_require__(2);
                var buildURL = __webpack_require__(5);
                var InterceptorManager = __webpack_require__(6);
                var dispatchRequest = __webpack_require__(7);
                var mergeConfig = __webpack_require__(22);

                /**
                 * Create a new instance of Axios
                 *
                 * @param {Object} instanceConfig The default config for the instance
                 */
                function Axios(instanceConfig) {
                    this.defaults = instanceConfig;
                    this.interceptors = {
                        request: new InterceptorManager(),
                        response: new InterceptorManager()
                    };
                }

                /**
                 * Dispatch a request
                 *
                 * @param {Object} config The config specific for this request (merged with this.defaults)
                 */
                Axios.prototype.request = function request(config) {
                    /*eslint no-param-reassign:0*/
                    // Allow for axios('example/url'[, config]) a la fetch API
                    if (typeof config === 'string') {
                        config = arguments[1] || {};
                        config.url = arguments[0];
                    } else {
                        config = config || {};
                    }

                    config = mergeConfig(this.defaults, config);

                    // Set config.method
                    if (config.method) {
                        config.method = config.method.toLowerCase();
                    } else if (this.defaults.method) {
                        config.method = this.defaults.method.toLowerCase();
                    } else {
                        config.method = 'get';
                    }

                    // Hook up interceptors middleware
                    var chain = [dispatchRequest, undefined];
                    var promise = Promise.resolve(config);

                    this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
                        chain.unshift(interceptor.fulfilled, interceptor.rejected);
                    });

                    this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
                        chain.push(interceptor.fulfilled, interceptor.rejected);
                    });

                    while (chain.length) {
                        promise = promise.then(chain.shift(), chain.shift());
                    }

                    return promise;
                };

                Axios.prototype.getUri = function getUri(config) {
                    config = mergeConfig(this.defaults, config);
                    return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '');
                };

                // Provide aliases for supported request methods
                utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
                    /*eslint func-names:0*/
                    Axios.prototype[method] = function(url, config) {
                        return this.request(utils.merge(config || {}, {
                            method: method,
                            url: url
                        }));
                    };
                });

                utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
                    /*eslint func-names:0*/
                    Axios.prototype[method] = function(url, data, config) {
                        return this.request(utils.merge(config || {}, {
                            method: method,
                            url: url,
                            data: data
                        }));
                    };
                });

                module.exports = Axios;


                /***/ }),
            /* 5 */
            /***/ (function(module, exports, __webpack_require__) {

                'use strict';

                var utils = __webpack_require__(2);

                function encode(val) {
                    return encodeURIComponent(val).
                    replace(/%40/gi, '@').
                    replace(/%3A/gi, ':').
                    replace(/%24/g, '$').
                    replace(/%2C/gi, ',').
                    replace(/%20/g, '+').
                    replace(/%5B/gi, '[').
                    replace(/%5D/gi, ']');
                }

                /**
                 * Build a URL by appending params to the end
                 *
                 * @param {string} url The base of the url (e.g., http://www.google.com)
                 * @param {object} [params] The params to be appended
                 * @returns {string} The formatted url
                 */
                module.exports = function buildURL(url, params, paramsSerializer) {
                    /*eslint no-param-reassign:0*/
                    if (!params) {
                        return url;
                    }

                    var serializedParams;
                    if (paramsSerializer) {
                        serializedParams = paramsSerializer(params);
                    } else if (utils.isURLSearchParams(params)) {
                        serializedParams = params.toString();
                    } else {
                        var parts = [];

                        utils.forEach(params, function serialize(val, key) {
                            if (val === null || typeof val === 'undefined') {
                                return;
                            }

                            if (utils.isArray(val)) {
                                key = key + '[]';
                            } else {
                                val = [val];
                            }

                            utils.forEach(val, function parseValue(v) {
                                if (utils.isDate(v)) {
                                    v = v.toISOString();
                                } else if (utils.isObject(v)) {
                                    v = JSON.stringify(v);
                                }
                                parts.push(encode(key) + '=' + encode(v));
                            });
                        });

                        serializedParams = parts.join('&');
                    }

                    if (serializedParams) {
                        var hashmarkIndex = url.indexOf('#');
                        if (hashmarkIndex !== -1) {
                            url = url.slice(0, hashmarkIndex);
                        }

                        url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
                    }

                    return url;
                };


                /***/ }),
            /* 6 */
            /***/ (function(module, exports, __webpack_require__) {

                'use strict';

                var utils = __webpack_require__(2);

                function InterceptorManager() {
                    this.handlers = [];
                }

                /**
                 * Add a new interceptor to the stack
                 *
                 * @param {Function} fulfilled The function to handle `then` for a `Promise`
                 * @param {Function} rejected The function to handle `reject` for a `Promise`
                 *
                 * @return {Number} An ID used to remove interceptor later
                 */
                InterceptorManager.prototype.use = function use(fulfilled, rejected) {
                    this.handlers.push({
                        fulfilled: fulfilled,
                        rejected: rejected
                    });
                    return this.handlers.length - 1;
                };

                /**
                 * Remove an interceptor from the stack
                 *
                 * @param {Number} id The ID that was returned by `use`
                 */
                InterceptorManager.prototype.eject = function eject(id) {
                    if (this.handlers[id]) {
                        this.handlers[id] = null;
                    }
                };

                /**
                 * Iterate over all the registered interceptors
                 *
                 * This method is particularly useful for skipping over any
                 * interceptors that may have become `null` calling `eject`.
                 *
                 * @param {Function} fn The function to call for each interceptor
                 */
                InterceptorManager.prototype.forEach = function forEach(fn) {
                    utils.forEach(this.handlers, function forEachHandler(h) {
                        if (h !== null) {
                            fn(h);
                        }
                    });
                };

                module.exports = InterceptorManager;


                /***/ }),
            /* 7 */
            /***/ (function(module, exports, __webpack_require__) {

                'use strict';

                var utils = __webpack_require__(2);
                var transformData = __webpack_require__(8);
                var isCancel = __webpack_require__(9);
                var defaults = __webpack_require__(10);

                /**
                 * Throws a `Cancel` if cancellation has been requested.
                 */
                function throwIfCancellationRequested(config) {
                    if (config.cancelToken) {
                        config.cancelToken.throwIfRequested();
                    }
                }

                /**
                 * Dispatch a request to the server using the configured adapter.
                 *
                 * @param {object} config The config that is to be used for the request
                 * @returns {Promise} The Promise to be fulfilled
                 */
                module.exports = function dispatchRequest(config) {
                    throwIfCancellationRequested(config);

                    // Ensure headers exist
                    config.headers = config.headers || {};

                    // Transform request data
                    config.data = transformData(
                        config.data,
                        config.headers,
                        config.transformRequest
                    );

                    // Flatten headers
                    config.headers = utils.merge(
                        config.headers.common || {},
                        config.headers[config.method] || {},
                        config.headers
                    );

                    utils.forEach(
                        ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
                        function cleanHeaderConfig(method) {
                            delete config.headers[method];
                        }
                    );

                    var adapter = config.adapter || defaults.adapter;

                    return adapter(config).then(function onAdapterResolution(response) {
                        throwIfCancellationRequested(config);

                        // Transform response data
                        response.data = transformData(
                            response.data,
                            response.headers,
                            config.transformResponse
                        );

                        return response;
                    }, function onAdapterRejection(reason) {
                        if (!isCancel(reason)) {
                            throwIfCancellationRequested(config);

                            // Transform response data
                            if (reason && reason.response) {
                                reason.response.data = transformData(
                                    reason.response.data,
                                    reason.response.headers,
                                    config.transformResponse
                                );
                            }
                        }

                        return Promise.reject(reason);
                    });
                };


                /***/ }),
            /* 8 */
            /***/ (function(module, exports, __webpack_require__) {

                'use strict';

                var utils = __webpack_require__(2);

                /**
                 * Transform the data for a request or a response
                 *
                 * @param {Object|String} data The data to be transformed
                 * @param {Array} headers The headers for the request or response
                 * @param {Array|Function} fns A single function or Array of functions
                 * @returns {*} The resulting transformed data
                 */
                module.exports = function transformData(data, headers, fns) {
                    /*eslint no-param-reassign:0*/
                    utils.forEach(fns, function transform(fn) {
                        data = fn(data, headers);
                    });

                    return data;
                };


                /***/ }),
            /* 9 */
            /***/ (function(module, exports) {

                'use strict';

                module.exports = function isCancel(value) {
                    return !!(value && value.__CANCEL__);
                };


                /***/ }),
            /* 10 */
            /***/ (function(module, exports, __webpack_require__) {

                'use strict';

                var utils = __webpack_require__(2);
                var normalizeHeaderName = __webpack_require__(11);

                var DEFAULT_CONTENT_TYPE = {
                    'Content-Type': 'application/x-www-form-urlencoded'
                };

                function setContentTypeIfUnset(headers, value) {
                    if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
                        headers['Content-Type'] = value;
                    }
                }

                function getDefaultAdapter() {
                    var adapter;
                    if (typeof XMLHttpRequest !== 'undefined') {
                        // For browsers use XHR adapter
                        adapter = __webpack_require__(12);
                    } else if (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') {
                        // For node use HTTP adapter
                        adapter = __webpack_require__(12);
                    }
                    return adapter;
                }

                var defaults = {
                    adapter: getDefaultAdapter(),

                    transformRequest: [function transformRequest(data, headers) {
                        normalizeHeaderName(headers, 'Accept');
                        normalizeHeaderName(headers, 'Content-Type');
                        if (utils.isFormData(data) ||
                            utils.isArrayBuffer(data) ||
                            utils.isBuffer(data) ||
                            utils.isStream(data) ||
                            utils.isFile(data) ||
                            utils.isBlob(data)
                        ) {
                            return data;
                        }
                        if (utils.isArrayBufferView(data)) {
                            return data.buffer;
                        }
                        if (utils.isURLSearchParams(data)) {
                            setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
                            return data.toString();
                        }
                        if (utils.isObject(data)) {
                            setContentTypeIfUnset(headers, 'application/json;charset=utf-8');
                            return JSON.stringify(data);
                        }
                        return data;
                    }],

                    transformResponse: [function transformResponse(data) {
                        /*eslint no-param-reassign:0*/
                        if (typeof data === 'string') {
                            try {
                                data = JSON.parse(data);
                            } catch (e) { /* Ignore */ }
                        }
                        return data;
                    }],

                    /**
                     * A timeout in milliseconds to abort a request. If set to 0 (default) a
                     * timeout is not created.
                     */
                    timeout: 0,

                    xsrfCookieName: 'XSRF-TOKEN',
                    xsrfHeaderName: 'X-XSRF-TOKEN',

                    maxContentLength: -1,

                    validateStatus: function validateStatus(status) {
                        return status >= 200 && status < 300;
                    }
                };

                defaults.headers = {
                    common: {
                        'Accept': 'application/json, text/plain, */*'
                    }
                };

                utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
                    defaults.headers[method] = {};
                });

                utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
                    defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE);
                });

                module.exports = defaults;


                /***/ }),
            /* 11 */
            /***/ (function(module, exports, __webpack_require__) {

                'use strict';

                var utils = __webpack_require__(2);

                module.exports = function normalizeHeaderName(headers, normalizedName) {
                    utils.forEach(headers, function processHeader(value, name) {
                        if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
                            headers[normalizedName] = value;
                            delete headers[name];
                        }
                    });
                };


                /***/ }),
            /* 12 */
            /***/ (function(module, exports, __webpack_require__) {

                'use strict';

                var utils = __webpack_require__(2);
                var settle = __webpack_require__(13);
                var buildURL = __webpack_require__(5);
                var buildFullPath = __webpack_require__(16);
                var parseHeaders = __webpack_require__(19);
                var isURLSameOrigin = __webpack_require__(20);
                var createError = __webpack_require__(14);

                module.exports = function xhrAdapter(config) {
                    return new Promise(function dispatchXhrRequest(resolve, reject) {
                        var requestData = config.data;
                        var requestHeaders = config.headers;

                        if (utils.isFormData(requestData)) {
                            delete requestHeaders['Content-Type']; // Let the browser set it
                        }

                        var request = new XMLHttpRequest();

                        // HTTP basic authentication
                        if (config.auth) {
                            var username = config.auth.username || '';
                            var password = config.auth.password || '';
                            requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
                        }

                        var fullPath = buildFullPath(config.baseURL, config.url);
                        request.open(config.method.toUpperCase(), buildURL(fullPath, config.params, config.paramsSerializer), true);

                        // Set the request timeout in MS
                        request.timeout = config.timeout;

                        // Listen for ready state
                        request.onreadystatechange = function handleLoad() {
                            if (!request || request.readyState !== 4) {
                                return;
                            }

                            // The request errored out and we didn't get a response, this will be
                            // handled by onerror instead
                            // With one exception: request that using file: protocol, most browsers
                            // will return status as 0 even though it's a successful request
                            if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
                                return;
                            }

                            // Prepare the response
                            var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
                            var responseData = !config.responseType || config.responseType === 'text' ? request.responseText : request.response;
                            var response = {
                                data: responseData,
                                status: request.status,
                                statusText: request.statusText,
                                headers: responseHeaders,
                                config: config,
                                request: request
                            };

                            settle(resolve, reject, response);

                            // Clean up request
                            request = null;
                        };

                        // Handle browser request cancellation (as opposed to a manual cancellation)
                        request.onabort = function handleAbort() {
                            if (!request) {
                                return;
                            }

                            reject(createError('Request aborted', config, 'ECONNABORTED', request));

                            // Clean up request
                            request = null;
                        };

                        // Handle low level network errors
                        request.onerror = function handleError() {
                            // Real errors are hidden from us by the browser
                            // onerror should only fire if it's a network error
                            reject(createError('Network Error', config, null, request));

                            // Clean up request
                            request = null;
                        };

                        // Handle timeout
                        request.ontimeout = function handleTimeout() {
                            var timeoutErrorMessage = 'timeout of ' + config.timeout + 'ms exceeded';
                            if (config.timeoutErrorMessage) {
                                timeoutErrorMessage = config.timeoutErrorMessage;
                            }
                            reject(createError(timeoutErrorMessage, config, 'ECONNABORTED',
                                request));

                            // Clean up request
                            request = null;
                        };

                        // Add xsrf header
                        // This is only done if running in a standard browser environment.
                        // Specifically not if we're in a web worker, or react-native.
                        if (utils.isStandardBrowserEnv()) {
                            var cookies = __webpack_require__(21);

                            // Add xsrf header
                            var xsrfValue = (config.withCredentials || isURLSameOrigin(fullPath)) && config.xsrfCookieName ?
                                cookies.read(config.xsrfCookieName) :
                                undefined;

                            if (xsrfValue) {
                                requestHeaders[config.xsrfHeaderName] = xsrfValue;
                            }
                        }

                        // Add headers to the request
                        if ('setRequestHeader' in request) {
                            utils.forEach(requestHeaders, function setRequestHeader(val, key) {
                                if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
                                    // Remove Content-Type if data is undefined
                                    delete requestHeaders[key];
                                } else {
                                    // Otherwise add header to the request
                                    request.setRequestHeader(key, val);
                                }
                            });
                        }

                        // Add withCredentials to request if needed
                        if (!utils.isUndefined(config.withCredentials)) {
                            request.withCredentials = !!config.withCredentials;
                        }

                        // Add responseType to request if needed
                        if (config.responseType) {
                            try {
                                request.responseType = config.responseType;
                            } catch (e) {
                                // Expected DOMException thrown by browsers not compatible XMLHttpRequest Level 2.
                                // But, this can be suppressed for 'json' type as it can be parsed by default 'transformResponse' function.
                                if (config.responseType !== 'json') {
                                    throw e;
                                }
                            }
                        }

                        // Handle progress if needed
                        if (typeof config.onDownloadProgress === 'function') {
                            request.addEventListener('progress', config.onDownloadProgress);
                        }

                        // Not all browsers support upload events
                        if (typeof config.onUploadProgress === 'function' && request.upload) {
                            request.upload.addEventListener('progress', config.onUploadProgress);
                        }

                        if (config.cancelToken) {
                            // Handle cancellation
                            config.cancelToken.promise.then(function onCanceled(cancel) {
                                if (!request) {
                                    return;
                                }

                                request.abort();
                                reject(cancel);
                                // Clean up request
                                request = null;
                            });
                        }

                        if (requestData === undefined) {
                            requestData = null;
                        }

                        // Send the request
                        request.send(requestData);
                    });
                };


                /***/ }),
            /* 13 */
            /***/ (function(module, exports, __webpack_require__) {

                'use strict';

                var createError = __webpack_require__(14);

                /**
                 * Resolve or reject a Promise based on response status.
                 *
                 * @param {Function} resolve A function that resolves the promise.
                 * @param {Function} reject A function that rejects the promise.
                 * @param {object} response The response.
                 */
                module.exports = function settle(resolve, reject, response) {
                    var validateStatus = response.config.validateStatus;
                    if (!validateStatus || validateStatus(response.status)) {
                        resolve(response);
                    } else {
                        reject(createError(
                            'Request failed with status code ' + response.status,
                            response.config,
                            null,
                            response.request,
                            response
                        ));
                    }
                };


                /***/ }),
            /* 14 */
            /***/ (function(module, exports, __webpack_require__) {

                'use strict';

                var enhanceError = __webpack_require__(15);

                /**
                 * Create an Error with the specified message, config, error code, request and response.
                 *
                 * @param {string} message The error message.
                 * @param {Object} config The config.
                 * @param {string} [code] The error code (for example, 'ECONNABORTED').
                 * @param {Object} [request] The request.
                 * @param {Object} [response] The response.
                 * @returns {Error} The created error.
                 */
                module.exports = function createError(message, config, code, request, response) {
                    var error = new Error(message);
                    return enhanceError(error, config, code, request, response);
                };


                /***/ }),
            /* 15 */
            /***/ (function(module, exports) {

                'use strict';

                /**
                 * Update an Error with the specified config, error code, and response.
                 *
                 * @param {Error} error The error to update.
                 * @param {Object} config The config.
                 * @param {string} [code] The error code (for example, 'ECONNABORTED').
                 * @param {Object} [request] The request.
                 * @param {Object} [response] The response.
                 * @returns {Error} The error.
                 */
                module.exports = function enhanceError(error, config, code, request, response) {
                    error.config = config;
                    if (code) {
                        error.code = code;
                    }

                    error.request = request;
                    error.response = response;
                    error.isAxiosError = true;

                    error.toJSON = function() {
                        return {
                            // Standard
                            message: this.message,
                            name: this.name,
                            // Microsoft
                            description: this.description,
                            number: this.number,
                            // Mozilla
                            fileName: this.fileName,
                            lineNumber: this.lineNumber,
                            columnNumber: this.columnNumber,
                            stack: this.stack,
                            // Axios
                            config: this.config,
                            code: this.code
                        };
                    };
                    return error;
                };


                /***/ }),
            /* 16 */
            /***/ (function(module, exports, __webpack_require__) {

                'use strict';

                var isAbsoluteURL = __webpack_require__(17);
                var combineURLs = __webpack_require__(18);

                /**
                 * Creates a new URL by combining the baseURL with the requestedURL,
                 * only when the requestedURL is not already an absolute URL.
                 * If the requestURL is absolute, this function returns the requestedURL untouched.
                 *
                 * @param {string} baseURL The base URL
                 * @param {string} requestedURL Absolute or relative URL to combine
                 * @returns {string} The combined full path
                 */
                module.exports = function buildFullPath(baseURL, requestedURL) {
                    if (baseURL && !isAbsoluteURL(requestedURL)) {
                        return combineURLs(baseURL, requestedURL);
                    }
                    return requestedURL;
                };


                /***/ }),
            /* 17 */
            /***/ (function(module, exports) {

                'use strict';

                /**
                 * Determines whether the specified URL is absolute
                 *
                 * @param {string} url The URL to test
                 * @returns {boolean} True if the specified URL is absolute, otherwise false
                 */
                module.exports = function isAbsoluteURL(url) {
                    // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
                    // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
                    // by any combination of letters, digits, plus, period, or hyphen.
                    return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
                };


                /***/ }),
            /* 18 */
            /***/ (function(module, exports) {

                'use strict';

                /**
                 * Creates a new URL by combining the specified URLs
                 *
                 * @param {string} baseURL The base URL
                 * @param {string} relativeURL The relative URL
                 * @returns {string} The combined URL
                 */
                module.exports = function combineURLs(baseURL, relativeURL) {
                    return relativeURL
                        ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
                        : baseURL;
                };


                /***/ }),
            /* 19 */
            /***/ (function(module, exports, __webpack_require__) {

                'use strict';

                var utils = __webpack_require__(2);

                // Headers whose duplicates are ignored by node
                // c.f. https://nodejs.org/api/http.html#http_message_headers
                var ignoreDuplicateOf = [
                    'age', 'authorization', 'content-length', 'content-type', 'etag',
                    'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
                    'last-modified', 'location', 'max-forwards', 'proxy-authorization',
                    'referer', 'retry-after', 'user-agent'
                ];

                /**
                 * Parse headers into an object
                 *
                 * ```
                 * Date: Wed, 27 Aug 2014 08:58:49 GMT
                 * Content-Type: application/json
                 * Connection: keep-alive
                 * Transfer-Encoding: chunked
                 * ```
                 *
                 * @param {String} headers Headers needing to be parsed
                 * @returns {Object} Headers parsed into an object
                 */
                module.exports = function parseHeaders(headers) {
                    var parsed = {};
                    var key;
                    var val;
                    var i;

                    if (!headers) { return parsed; }

                    utils.forEach(headers.split('\n'), function parser(line) {
                        i = line.indexOf(':');
                        key = utils.trim(line.substr(0, i)).toLowerCase();
                        val = utils.trim(line.substr(i + 1));

                        if (key) {
                            if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
                                return;
                            }
                            if (key === 'set-cookie') {
                                parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
                            } else {
                                parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
                            }
                        }
                    });

                    return parsed;
                };


                /***/ }),
            /* 20 */
            /***/ (function(module, exports, __webpack_require__) {

                'use strict';

                var utils = __webpack_require__(2);

                module.exports = (
                    utils.isStandardBrowserEnv() ?

                        // Standard browser envs have full support of the APIs needed to test
                        // whether the request URL is of the same origin as current location.
                        (function standardBrowserEnv() {
                            var msie = /(msie|trident)/i.test(navigator.userAgent);
                            var urlParsingNode = document.createElement('a');
                            var originURL;

                            /**
                             * Parse a URL to discover it's components
                             *
                             * @param {String} url The URL to be parsed
                             * @returns {Object}
                             */
                            function resolveURL(url) {
                                var href = url;

                                if (msie) {
                                    // IE needs attribute set twice to normalize properties
                                    urlParsingNode.setAttribute('href', href);
                                    href = urlParsingNode.href;
                                }

                                urlParsingNode.setAttribute('href', href);

                                // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
                                return {
                                    href: urlParsingNode.href,
                                    protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
                                    host: urlParsingNode.host,
                                    search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
                                    hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
                                    hostname: urlParsingNode.hostname,
                                    port: urlParsingNode.port,
                                    pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
                                        urlParsingNode.pathname :
                                        '/' + urlParsingNode.pathname
                                };
                            }

                            originURL = resolveURL(window.location.href);

                            /**
                             * Determine if a URL shares the same origin as the current location
                             *
                             * @param {String} requestURL The URL to test
                             * @returns {boolean} True if URL shares the same origin, otherwise false
                             */
                            return function isURLSameOrigin(requestURL) {
                                var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
                                return (parsed.protocol === originURL.protocol &&
                                    parsed.host === originURL.host);
                            };
                        })() :

                        // Non standard browser envs (web workers, react-native) lack needed support.
                        (function nonStandardBrowserEnv() {
                            return function isURLSameOrigin() {
                                return true;
                            };
                        })()
                );


                /***/ }),
            /* 21 */
            /***/ (function(module, exports, __webpack_require__) {

                'use strict';

                var utils = __webpack_require__(2);

                module.exports = (
                    utils.isStandardBrowserEnv() ?

                        // Standard browser envs support document.cookie
                        (function standardBrowserEnv() {
                            return {
                                write: function write(name, value, expires, path, domain, secure) {
                                    var cookie = [];
                                    cookie.push(name + '=' + encodeURIComponent(value));

                                    if (utils.isNumber(expires)) {
                                        cookie.push('expires=' + new Date(expires).toGMTString());
                                    }

                                    if (utils.isString(path)) {
                                        cookie.push('path=' + path);
                                    }

                                    if (utils.isString(domain)) {
                                        cookie.push('domain=' + domain);
                                    }

                                    if (secure === true) {
                                        cookie.push('secure');
                                    }

                                    document.cookie = cookie.join('; ');
                                },

                                read: function read(name) {
                                    var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
                                    return (match ? decodeURIComponent(match[3]) : null);
                                },

                                remove: function remove(name) {
                                    this.write(name, '', Date.now() - 86400000);
                                }
                            };
                        })() :

                        // Non standard browser env (web workers, react-native) lack needed support.
                        (function nonStandardBrowserEnv() {
                            return {
                                write: function write() {},
                                read: function read() { return null; },
                                remove: function remove() {}
                            };
                        })()
                );


                /***/ }),
            /* 22 */
            /***/ (function(module, exports, __webpack_require__) {

                'use strict';

                var utils = __webpack_require__(2);

                /**
                 * Config-specific merge-function which creates a new config-object
                 * by merging two configuration objects together.
                 *
                 * @param {Object} config1
                 * @param {Object} config2
                 * @returns {Object} New object resulting from merging config2 to config1
                 */
                module.exports = function mergeConfig(config1, config2) {
                    // eslint-disable-next-line no-param-reassign
                    config2 = config2 || {};
                    var config = {};

                    var valueFromConfig2Keys = ['url', 'method', 'params', 'data'];
                    var mergeDeepPropertiesKeys = ['headers', 'auth', 'proxy'];
                    var defaultToConfig2Keys = [
                        'baseURL', 'url', 'transformRequest', 'transformResponse', 'paramsSerializer',
                        'timeout', 'withCredentials', 'adapter', 'responseType', 'xsrfCookieName',
                        'xsrfHeaderName', 'onUploadProgress', 'onDownloadProgress',
                        'maxContentLength', 'validateStatus', 'maxRedirects', 'httpAgent',
                        'httpsAgent', 'cancelToken', 'socketPath'
                    ];

                    utils.forEach(valueFromConfig2Keys, function valueFromConfig2(prop) {
                        if (typeof config2[prop] !== 'undefined') {
                            config[prop] = config2[prop];
                        }
                    });

                    utils.forEach(mergeDeepPropertiesKeys, function mergeDeepProperties(prop) {
                        if (utils.isObject(config2[prop])) {
                            config[prop] = utils.deepMerge(config1[prop], config2[prop]);
                        } else if (typeof config2[prop] !== 'undefined') {
                            config[prop] = config2[prop];
                        } else if (utils.isObject(config1[prop])) {
                            config[prop] = utils.deepMerge(config1[prop]);
                        } else if (typeof config1[prop] !== 'undefined') {
                            config[prop] = config1[prop];
                        }
                    });

                    utils.forEach(defaultToConfig2Keys, function defaultToConfig2(prop) {
                        if (typeof config2[prop] !== 'undefined') {
                            config[prop] = config2[prop];
                        } else if (typeof config1[prop] !== 'undefined') {
                            config[prop] = config1[prop];
                        }
                    });

                    var axiosKeys = valueFromConfig2Keys
                        .concat(mergeDeepPropertiesKeys)
                        .concat(defaultToConfig2Keys);

                    var otherKeys = Object
                        .keys(config2)
                        .filter(function filterAxiosKeys(key) {
                            return axiosKeys.indexOf(key) === -1;
                        });

                    utils.forEach(otherKeys, function otherKeysDefaultToConfig2(prop) {
                        if (typeof config2[prop] !== 'undefined') {
                            config[prop] = config2[prop];
                        } else if (typeof config1[prop] !== 'undefined') {
                            config[prop] = config1[prop];
                        }
                    });

                    return config;
                };


                /***/ }),
            /* 23 */
            /***/ (function(module, exports) {

                'use strict';

                /**
                 * A `Cancel` is an object that is thrown when an operation is canceled.
                 *
                 * @class
                 * @param {string=} message The message.
                 */
                function Cancel(message) {
                    this.message = message;
                }

                Cancel.prototype.toString = function toString() {
                    return 'Cancel' + (this.message ? ': ' + this.message : '');
                };

                Cancel.prototype.__CANCEL__ = true;

                module.exports = Cancel;


                /***/ }),
            /* 24 */
            /***/ (function(module, exports, __webpack_require__) {

                'use strict';

                var Cancel = __webpack_require__(23);

                /**
                 * A `CancelToken` is an object that can be used to request cancellation of an operation.
                 *
                 * @class
                 * @param {Function} executor The executor function.
                 */
                function CancelToken(executor) {
                    if (typeof executor !== 'function') {
                        throw new TypeError('executor must be a function.');
                    }

                    var resolvePromise;
                    this.promise = new Promise(function promiseExecutor(resolve) {
                        resolvePromise = resolve;
                    });

                    var token = this;
                    executor(function cancel(message) {
                        if (token.reason) {
                            // Cancellation has already been requested
                            return;
                        }

                        token.reason = new Cancel(message);
                        resolvePromise(token.reason);
                    });
                }

                /**
                 * Throws a `Cancel` if cancellation has been requested.
                 */
                CancelToken.prototype.throwIfRequested = function throwIfRequested() {
                    if (this.reason) {
                        throw this.reason;
                    }
                };

                /**
                 * Returns an object that contains a new `CancelToken` and a function that, when called,
                 * cancels the `CancelToken`.
                 */
                CancelToken.source = function source() {
                    var cancel;
                    var token = new CancelToken(function executor(c) {
                        cancel = c;
                    });
                    return {
                        token: token,
                        cancel: cancel
                    };
                };

                module.exports = CancelToken;


                /***/ }),
            /* 25 */
            /***/ (function(module, exports) {

                'use strict';

                /**
                 * Syntactic sugar for invoking a function and expanding an array for arguments.
                 *
                 * Common use case would be to use `Function.prototype.apply`.
                 *
                 *  ```js
                 *  function f(x, y, z) {}
                 *  var args = [1, 2, 3];
                 *  f.apply(null, args);
                 *  ```
                 *
                 * With `spread` this example can be re-written.
                 *
                 *  ```js
                 *  spread(function(x, y, z) {})([1, 2, 3]);
                 *  ```
                 *
                 * @param {Function} callback
                 * @returns {Function}
                 */
                module.exports = function spread(callback) {
                    return function wrap(arr) {
                        return callback.apply(null, arr);
                    };
                };


                /***/ })
            /******/ ])
});
;
//# sourceMappingURL=axios.map
(function(window, factory) {
	var lazySizes = factory(window, window.document);
	window.lazySizes = lazySizes;
	if(typeof module == 'object' && module.exports){
		module.exports = lazySizes;
	}
}(window, function l(window, document) {
	'use strict';
	/*jshint eqnull:true */
	if(!document.getElementsByClassName){return;}

	var lazysizes, lazySizesConfig;

	var docElem = document.documentElement;

	var Date = window.Date;

	var supportPicture = window.HTMLPictureElement;

	var _addEventListener = 'addEventListener';

	var _getAttribute = 'getAttribute';

	var addEventListener = window[_addEventListener];

	var setTimeout = window.setTimeout;

	var requestAnimationFrame = window.requestAnimationFrame || setTimeout;

	var requestIdleCallback = window.requestIdleCallback;

	var regPicture = /^picture$/i;

	var loadEvents = ['load', 'error', 'lazyincluded', '_lazyloaded'];

	var regClassCache = {};

	var forEach = Array.prototype.forEach;

	var hasClass = function(ele, cls) {
		if(!regClassCache[cls]){
			regClassCache[cls] = new RegExp('(\\s|^)'+cls+'(\\s|$)');
		}
		return regClassCache[cls].test(ele[_getAttribute]('class') || '') && regClassCache[cls];
	};

	var addClass = function(ele, cls) {
		if (!hasClass(ele, cls)){
			ele.setAttribute('class', (ele[_getAttribute]('class') || '').trim() + ' ' + cls);
		}
	};

	var removeClass = function(ele, cls) {
		var reg;
		if ((reg = hasClass(ele,cls))) {
			ele.setAttribute('class', (ele[_getAttribute]('class') || '').replace(reg, ' '));
		}
	};

	var addRemoveLoadEvents = function(dom, fn, add){
		var action = add ? _addEventListener : 'removeEventListener';
		if(add){
			addRemoveLoadEvents(dom, fn);
		}
		loadEvents.forEach(function(evt){
			dom[action](evt, fn);
		});
	};

	var triggerEvent = function(elem, name, detail, noBubbles, noCancelable){
		var event = document.createEvent('Event');

		if(!detail){
			detail = {};
		}

		detail.instance = lazysizes;

		event.initEvent(name, !noBubbles, !noCancelable);

		event.detail = detail;

		elem.dispatchEvent(event);
		return event;
	};

	var updatePolyfill = function (el, full){
		var polyfill;
		if( !supportPicture && ( polyfill = (window.picturefill || lazySizesConfig.pf) ) ){
			if(full && full.src && !el[_getAttribute]('srcset')){
				el.setAttribute('srcset', full.src);
			}
			polyfill({reevaluate: true, elements: [el]});
		} else if(full && full.src){
			el.src = full.src;
		}
	};

	var getCSS = function (elem, style){
		return (getComputedStyle(elem, null) || {})[style];
	};

	var getWidth = function(elem, parent, width){
		width = width || elem.offsetWidth;

		while(width < lazySizesConfig.minSize && parent && !elem._lazysizesWidth){
			width =  parent.offsetWidth;
			parent = parent.parentNode;
		}

		return width;
	};

	var rAF = (function(){
		var running, waiting;
		var firstFns = [];
		var secondFns = [];
		var fns = firstFns;

		var run = function(){
			var runFns = fns;

			fns = firstFns.length ? secondFns : firstFns;

			running = true;
			waiting = false;

			while(runFns.length){
				runFns.shift()();
			}

			running = false;
		};

		var rafBatch = function(fn, queue){
			if(running && !queue){
				fn.apply(this, arguments);
			} else {
				fns.push(fn);

				if(!waiting){
					waiting = true;
					(document.hidden ? setTimeout : requestAnimationFrame)(run);
				}
			}
		};

		rafBatch._lsFlush = run;

		return rafBatch;
	})();

	var rAFIt = function(fn, simple){
		return simple ?
			function() {
				rAF(fn);
			} :
			function(){
				var that = this;
				var args = arguments;
				rAF(function(){
					fn.apply(that, args);
				});
			}
		;
	};

	var throttle = function(fn){
		var running;
		var lastTime = 0;
		var gDelay = lazySizesConfig.throttleDelay;
		var rICTimeout = lazySizesConfig.ricTimeout;
		var run = function(){
			running = false;
			lastTime = Date.now();
			fn();
		};
		var idleCallback = requestIdleCallback && rICTimeout > 49 ?
			function(){
				requestIdleCallback(run, {timeout: rICTimeout});

				if(rICTimeout !== lazySizesConfig.ricTimeout){
					rICTimeout = lazySizesConfig.ricTimeout;
				}
			} :
			rAFIt(function(){
				setTimeout(run);
			}, true)
		;

		return function(isPriority){
			var delay;

			if((isPriority = isPriority === true)){
				rICTimeout = 33;
			}

			if(running){
				return;
			}

			running =  true;

			delay = gDelay - (Date.now() - lastTime);

			if(delay < 0){
				delay = 0;
			}

			if(isPriority || delay < 9){
				idleCallback();
			} else {
				setTimeout(idleCallback, delay);
			}
		};
	};

	//based on http://modernjavascript.blogspot.de/2013/08/building-better-debounce.html
	var debounce = function(func) {
		var timeout, timestamp;
		var wait = 99;
		var run = function(){
			timeout = null;
			func();
		};
		var later = function() {
			var last = Date.now() - timestamp;

			if (last < wait) {
				setTimeout(later, wait - last);
			} else {
				(requestIdleCallback || run)(run);
			}
		};

		return function() {
			timestamp = Date.now();

			if (!timeout) {
				timeout = setTimeout(later, wait);
			}
		};
	};

	(function(){
		var prop;

		var lazySizesDefaults = {
			lazyClass: 'lazyload',
			loadedClass: 'lazyloaded',
			loadingClass: 'lazyloading',
			preloadClass: 'lazypreload',
			errorClass: 'lazyerror',
			//strictClass: 'lazystrict',
			autosizesClass: 'lazyautosizes',
			srcAttr: 'data-src',
			srcsetAttr: 'data-srcset',
			sizesAttr: 'data-sizes',
			//preloadAfterLoad: false,
			minSize: 40,
			customMedia: {},
			init: true,
			expFactor: 1.5,
			hFac: 0.8,
			loadMode: 2,
			loadHidden: true,
			ricTimeout: 0,
			throttleDelay: 125,
		};

		lazySizesConfig = window.lazySizesConfig || window.lazysizesConfig || {};

		for(prop in lazySizesDefaults){
			if(!(prop in lazySizesConfig)){
				lazySizesConfig[prop] = lazySizesDefaults[prop];
			}
		}

		window.lazySizesConfig = lazySizesConfig;

		setTimeout(function(){
			if(lazySizesConfig.init){
				init();
			}
		});
	})();

	var loader = (function(){
		var preloadElems, isCompleted, resetPreloadingTimer, loadMode, started;

		var eLvW, elvH, eLtop, eLleft, eLright, eLbottom;

		var defaultExpand, preloadExpand, hFac;

		var regImg = /^img$/i;
		var regIframe = /^iframe$/i;

		var supportScroll = ('onscroll' in window) && !(/(gle|ing)bot/.test(navigator.userAgent));

		var shrinkExpand = 0;
		var currentExpand = 0;

		var isLoading = 0;
		var lowRuns = -1;

		var resetPreloading = function(e){
			isLoading--;
			if(e && e.target){
				addRemoveLoadEvents(e.target, resetPreloading);
			}

			if(!e || isLoading < 0 || !e.target){
				isLoading = 0;
			}
		};

		var isNestedVisible = function(elem, elemExpand){
			var outerRect;
			var parent = elem;
			var visible = getCSS(document.body, 'visibility') == 'hidden' || (getCSS(elem.parentNode, 'visibility') != 'hidden' && getCSS(elem, 'visibility') != 'hidden');

			eLtop -= elemExpand;
			eLbottom += elemExpand;
			eLleft -= elemExpand;
			eLright += elemExpand;

			while(visible && (parent = parent.offsetParent) && parent != document.body && parent != docElem){
				visible = ((getCSS(parent, 'opacity') || 1) > 0);

				if(visible && getCSS(parent, 'overflow') != 'visible'){
					outerRect = parent.getBoundingClientRect();
					visible = eLright > outerRect.left &&
						eLleft < outerRect.right &&
						eLbottom > outerRect.top - 1 &&
						eLtop < outerRect.bottom + 1
					;
				}
			}

			return visible;
		};

		var checkElements = function() {
			var eLlen, i, rect, autoLoadElem, loadedSomething, elemExpand, elemNegativeExpand, elemExpandVal, beforeExpandVal;

			var lazyloadElems = lazysizes.elements;

			if((loadMode = lazySizesConfig.loadMode) && isLoading < 8 && (eLlen = lazyloadElems.length)){

				i = 0;

				lowRuns++;

				if(preloadExpand == null){
					if(!('expand' in lazySizesConfig)){
						lazySizesConfig.expand = docElem.clientHeight > 500 && docElem.clientWidth > 500 ? 500 : 370;
					}

					defaultExpand = lazySizesConfig.expand;
					preloadExpand = defaultExpand * lazySizesConfig.expFactor;
				}

				if(currentExpand < preloadExpand && isLoading < 1 && lowRuns > 2 && loadMode > 2 && !document.hidden){
					currentExpand = preloadExpand;
					lowRuns = 0;
				} else if(loadMode > 1 && lowRuns > 1 && isLoading < 6){
					currentExpand = defaultExpand;
				} else {
					currentExpand = shrinkExpand;
				}

				for(; i < eLlen; i++){

					if(!lazyloadElems[i] || lazyloadElems[i]._lazyRace){continue;}

					if(!supportScroll){unveilElement(lazyloadElems[i]);continue;}

					if(!(elemExpandVal = lazyloadElems[i][_getAttribute]('data-expand')) || !(elemExpand = elemExpandVal * 1)){
						elemExpand = currentExpand;
					}

					if(beforeExpandVal !== elemExpand){
						eLvW = innerWidth + (elemExpand * hFac);
						elvH = innerHeight + elemExpand;
						elemNegativeExpand = elemExpand * -1;
						beforeExpandVal = elemExpand;
					}

					rect = lazyloadElems[i].getBoundingClientRect();

					if ((eLbottom = rect.bottom) >= elemNegativeExpand &&
						(eLtop = rect.top) <= elvH &&
						(eLright = rect.right) >= elemNegativeExpand * hFac &&
						(eLleft = rect.left) <= eLvW &&
						(eLbottom || eLright || eLleft || eLtop) &&
						(lazySizesConfig.loadHidden || getCSS(lazyloadElems[i], 'visibility') != 'hidden') &&
						((isCompleted && isLoading < 3 && !elemExpandVal && (loadMode < 3 || lowRuns < 4)) || isNestedVisible(lazyloadElems[i], elemExpand))){
						unveilElement(lazyloadElems[i]);
						loadedSomething = true;
						if(isLoading > 9){break;}
					} else if(!loadedSomething && isCompleted && !autoLoadElem &&
						isLoading < 4 && lowRuns < 4 && loadMode > 2 &&
						(preloadElems[0] || lazySizesConfig.preloadAfterLoad) &&
						(preloadElems[0] || (!elemExpandVal && ((eLbottom || eLright || eLleft || eLtop) || lazyloadElems[i][_getAttribute](lazySizesConfig.sizesAttr) != 'auto')))){
						autoLoadElem = preloadElems[0] || lazyloadElems[i];
					}
				}

				if(autoLoadElem && !loadedSomething){
					unveilElement(autoLoadElem);
				}
			}
		};

		var throttledCheckElements = throttle(checkElements);

		var switchLoadingClass = function(e){
			addClass(e.target, lazySizesConfig.loadedClass);
			removeClass(e.target, lazySizesConfig.loadingClass);
			addRemoveLoadEvents(e.target, rafSwitchLoadingClass);
			triggerEvent(e.target, 'lazyloaded');
		};
		var rafedSwitchLoadingClass = rAFIt(switchLoadingClass);
		var rafSwitchLoadingClass = function(e){
			rafedSwitchLoadingClass({target: e.target});
		};

		var changeIframeSrc = function(elem, src){
			try {
				elem.contentWindow.location.replace(src);
			} catch(e){
				elem.src = src;
			}
		};

		var handleSources = function(source){
			var customMedia;

			var sourceSrcset = source[_getAttribute](lazySizesConfig.srcsetAttr);

			if( (customMedia = lazySizesConfig.customMedia[source[_getAttribute]('data-media') || source[_getAttribute]('media')]) ){
				source.setAttribute('media', customMedia);
			}

			if(sourceSrcset){
				source.setAttribute('srcset', sourceSrcset);
			}
		};

		var lazyUnveil = rAFIt(function (elem, detail, isAuto, sizes, isImg){
			var src, srcset, parent, isPicture, event, firesLoad;

			if(!(event = triggerEvent(elem, 'lazybeforeunveil', detail)).defaultPrevented){

				if(sizes){
					if(isAuto){
						addClass(elem, lazySizesConfig.autosizesClass);
					} else {
						elem.setAttribute('sizes', sizes);
					}
				}

				srcset = elem[_getAttribute](lazySizesConfig.srcsetAttr);
				src = elem[_getAttribute](lazySizesConfig.srcAttr);

				if(isImg) {
					parent = elem.parentNode;
					isPicture = parent && regPicture.test(parent.nodeName || '');
				}

				firesLoad = detail.firesLoad || (('src' in elem) && (srcset || src || isPicture));

				event = {target: elem};

				if(firesLoad){
					addRemoveLoadEvents(elem, resetPreloading, true);
					clearTimeout(resetPreloadingTimer);
					resetPreloadingTimer = setTimeout(resetPreloading, 2500);

					addClass(elem, lazySizesConfig.loadingClass);
					addRemoveLoadEvents(elem, rafSwitchLoadingClass, true);
				}

				if(isPicture){
					forEach.call(parent.getElementsByTagName('source'), handleSources);
				}

				if(srcset){
					elem.setAttribute('srcset', srcset);
				} else if(src && !isPicture){
					if(regIframe.test(elem.nodeName)){
						changeIframeSrc(elem, src);
					} else {
						elem.src = src;
					}
				}

				if(isImg && (srcset || isPicture)){
					updatePolyfill(elem, {src: src});
				}
			}

			if(elem._lazyRace){
				delete elem._lazyRace;
			}
			removeClass(elem, lazySizesConfig.lazyClass);

			rAF(function(){
				if( !firesLoad || (elem.complete && elem.naturalWidth > 1)){
					if(firesLoad){
						resetPreloading(event);
					} else {
						isLoading--;
					}
					switchLoadingClass(event);
				}
			}, true);
		});

		var unveilElement = function (elem){
			var detail;

			var isImg = regImg.test(elem.nodeName);

			//allow using sizes="auto", but don't use. it's invalid. Use data-sizes="auto" or a valid value for sizes instead (i.e.: sizes="80vw")
			var sizes = isImg && (elem[_getAttribute](lazySizesConfig.sizesAttr) || elem[_getAttribute]('sizes'));
			var isAuto = sizes == 'auto';

			if( (isAuto || !isCompleted) && isImg && (elem[_getAttribute]('src') || elem.srcset) && !elem.complete && !hasClass(elem, lazySizesConfig.errorClass) && hasClass(elem, lazySizesConfig.lazyClass)){return;}

			detail = triggerEvent(elem, 'lazyunveilread').detail;

			if(isAuto){
				 autoSizer.updateElem(elem, true, elem.offsetWidth);
			}

			elem._lazyRace = true;
			isLoading++;

			lazyUnveil(elem, detail, isAuto, sizes, isImg);
		};

		var onload = function(){
			if(isCompleted){return;}
			if(Date.now() - started < 999){
				setTimeout(onload, 999);
				return;
			}
			var afterScroll = debounce(function(){
				lazySizesConfig.loadMode = 3;
				throttledCheckElements();
			});

			isCompleted = true;

			lazySizesConfig.loadMode = 3;

			throttledCheckElements();

			addEventListener('scroll', function(){
				if(lazySizesConfig.loadMode == 3){
					lazySizesConfig.loadMode = 2;
				}
				afterScroll();
			}, true);
		};

		return {
			_: function(){
				started = Date.now();

				lazysizes.elements = document.getElementsByClassName(lazySizesConfig.lazyClass);
				preloadElems = document.getElementsByClassName(lazySizesConfig.lazyClass + ' ' + lazySizesConfig.preloadClass);
				hFac = lazySizesConfig.hFac;

				addEventListener('scroll', throttledCheckElements, true);

				addEventListener('resize', throttledCheckElements, true);

				if(window.MutationObserver){
					new MutationObserver( throttledCheckElements ).observe( docElem, {childList: true, subtree: true, attributes: true} );
				} else {
					docElem[_addEventListener]('DOMNodeInserted', throttledCheckElements, true);
					docElem[_addEventListener]('DOMAttrModified', throttledCheckElements, true);
					setInterval(throttledCheckElements, 999);
				}

				addEventListener('hashchange', throttledCheckElements, true);

				//, 'fullscreenchange'
				['focus', 'mouseover', 'click', 'load', 'transitionend', 'animationend', 'webkitAnimationEnd'].forEach(function(name){
					document[_addEventListener](name, throttledCheckElements, true);
				});

				if((/d$|^c/.test(document.readyState))){
					onload();
				} else {
					addEventListener('load', onload);
					document[_addEventListener]('DOMContentLoaded', throttledCheckElements);
					setTimeout(onload, 20000);
				}

				if(lazysizes.elements.length){
					checkElements();
					rAF._lsFlush();
				} else {
					throttledCheckElements();
				}
			},
			checkElems: throttledCheckElements,
			unveil: unveilElement
		};
	})();


	var autoSizer = (function(){
		var autosizesElems;

		var sizeElement = rAFIt(function(elem, parent, event, width){
			var sources, i, len;
			elem._lazysizesWidth = width;
			width += 'px';

			elem.setAttribute('sizes', width);

			if(regPicture.test(parent.nodeName || '')){
				sources = parent.getElementsByTagName('source');
				for(i = 0, len = sources.length; i < len; i++){
					sources[i].setAttribute('sizes', width);
				}
			}

			if(!event.detail.dataAttr){
				updatePolyfill(elem, event.detail);
			}
		});
		var getSizeElement = function (elem, dataAttr, width){
			var event;
			var parent = elem.parentNode;

			if(parent){
				width = getWidth(elem, parent, width);
				event = triggerEvent(elem, 'lazybeforesizes', {width: width, dataAttr: !!dataAttr});

				if(!event.defaultPrevented){
					width = event.detail.width;

					if(width && width !== elem._lazysizesWidth){
						sizeElement(elem, parent, event, width);
					}
				}
			}
		};

		var updateElementsSizes = function(){
			var i;
			var len = autosizesElems.length;
			if(len){
				i = 0;

				for(; i < len; i++){
					getSizeElement(autosizesElems[i]);
				}
			}
		};

		var debouncedUpdateElementsSizes = debounce(updateElementsSizes);

		return {
			_: function(){
				autosizesElems = document.getElementsByClassName(lazySizesConfig.autosizesClass);
				addEventListener('resize', debouncedUpdateElementsSizes);
			},
			checkElems: debouncedUpdateElementsSizes,
			updateElem: getSizeElement
		};
	})();

	var init = function(){
		if(!init.i){
			init.i = true;
			autoSizer._();
			loader._();
		}
	};

	lazysizes = {
		cfg: lazySizesConfig,
		autoSizer: autoSizer,
		loader: loader,
		init: init,
		uP: updatePolyfill,
		aC: addClass,
		rC: removeClass,
		hC: hasClass,
		fire: triggerEvent,
		gW: getWidth,
		rAF: rAF,
	};

	return lazysizes;
}
));

(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else {
		var a = factory();
		for(var i in a) (typeof exports === 'object' ? exports : root)[i] = a[i];
	}
})(typeof self !== 'undefined' ? self : this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 7);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /* globals jQuery */

exports.lory = lory;

var _detectPrefixes = __webpack_require__(1);

var _detectPrefixes2 = _interopRequireDefault(_detectPrefixes);

var _detectSupportsPassive = __webpack_require__(2);

var _detectSupportsPassive2 = _interopRequireDefault(_detectSupportsPassive);

var _dispatchEvent = __webpack_require__(3);

var _dispatchEvent2 = _interopRequireDefault(_dispatchEvent);

var _defaults = __webpack_require__(6);

var _defaults2 = _interopRequireDefault(_defaults);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var slice = Array.prototype.slice;

function lory(slider, opts) {
    var position = void 0;
    var slidesWidth = void 0;
    var frameWidth = void 0;
    var slides = void 0;

    /**
     * slider DOM elements
     */
    var frame = void 0;
    var slideContainer = void 0;
    var prevCtrl = void 0;
    var nextCtrl = void 0;
    var prefixes = void 0;
    var transitionEndCallback = void 0;

    var index = 0;
    var options = {};
    var touchEventParams = (0, _detectSupportsPassive2.default)() ? { passive: true } : false;

    /**
     * if object is jQuery convert to native DOM element
     */
    if (typeof jQuery !== 'undefined' && slider instanceof jQuery) {
        slider = slider[0];
    }

    /**
     * private
     * set active class to element which is the current slide
     */
    function setActiveElement(slides, currentIndex) {
        var _options = options,
            classNameActiveSlide = _options.classNameActiveSlide;


        slides.forEach(function (element, index) {
            if (element.classList.contains(classNameActiveSlide)) {
                element.classList.remove(classNameActiveSlide);
            }
        });

        slides[currentIndex].classList.add(classNameActiveSlide);
    }

    /**
     * private
     * setupInfinite: function to setup if infinite is set
     *
     * @param  {array} slideArray
     * @return {array} array of updated slideContainer elements
     */
    function setupInfinite(slideArray) {
        var _options2 = options,
            infinite = _options2.infinite;


        var front = slideArray.slice(0, infinite);
        var back = slideArray.slice(slideArray.length - infinite, slideArray.length);

        front.forEach(function (element) {
            var cloned = element.cloneNode(true);

            slideContainer.appendChild(cloned);
        });

        back.reverse().forEach(function (element) {
            var cloned = element.cloneNode(true);

            slideContainer.insertBefore(cloned, slideContainer.firstChild);
        });

        slideContainer.addEventListener(prefixes.transitionEnd, onTransitionEnd);

        return slice.call(slideContainer.children);
    }

    /**
     * [dispatchSliderEvent description]
     * @return {[type]} [description]
     */
    function dispatchSliderEvent(phase, type, detail) {
        (0, _dispatchEvent2.default)(slider, phase + '.lory.' + type, detail);
    }

    /**
     * translates to a given position in a given time in milliseconds
     *
     * @to        {number} number in pixels where to translate to
     * @duration  {number} time in milliseconds for the transistion
     * @ease      {string} easing css property
     */
    function translate(to, duration, ease) {
        var style = slideContainer && slideContainer.style;

        if (style) {
            style[prefixes.transition + 'TimingFunction'] = ease;
            style[prefixes.transition + 'Duration'] = duration + 'ms';
            style[prefixes.transform] = 'translateX(' + to + 'px)';
        }
    }

    /**
     * returns an element's width
     */
    function elementWidth(element) {
        return element.getBoundingClientRect().width || element.offsetWidth;
    }

    /**
     * slidefunction called by prev, next & touchend
     *
     * determine nextIndex and slide to next postion
     * under restrictions of the defined options
     *
     * @direction  {boolean}
     */
    function slide(nextIndex, direction) {
        var _options3 = options,
            slideSpeed = _options3.slideSpeed,
            slidesToScroll = _options3.slidesToScroll,
            infinite = _options3.infinite,
            rewind = _options3.rewind,
            rewindPrev = _options3.rewindPrev,
            rewindSpeed = _options3.rewindSpeed,
            ease = _options3.ease,
            classNameActiveSlide = _options3.classNameActiveSlide,
            _options3$classNameDi = _options3.classNameDisabledNextCtrl,
            classNameDisabledNextCtrl = _options3$classNameDi === undefined ? 'disabled' : _options3$classNameDi,
            _options3$classNameDi2 = _options3.classNameDisabledPrevCtrl,
            classNameDisabledPrevCtrl = _options3$classNameDi2 === undefined ? 'disabled' : _options3$classNameDi2;


        var duration = slideSpeed;

        var nextSlide = direction ? index + 1 : index - 1;
        var maxOffset = Math.round(slidesWidth - frameWidth);

        dispatchSliderEvent('before', 'slide', {
            index: index,
            nextSlide: nextSlide
        });

        /**
         * Reset control classes
         */
        if (prevCtrl) {
            prevCtrl.classList.remove(classNameDisabledPrevCtrl);
        }
        if (nextCtrl) {
            nextCtrl.classList.remove(classNameDisabledNextCtrl);
        }

        if (typeof nextIndex !== 'number') {
            if (direction) {
                if (infinite && index + infinite * 2 !== slides.length) {
                    nextIndex = index + (infinite - index % infinite);
                } else {
                    nextIndex = index + slidesToScroll;
                }
            } else {
                if (infinite && index % infinite !== 0) {
                    nextIndex = index - index % infinite;
                } else {
                    nextIndex = index - slidesToScroll;
                }
            }
        }

        nextIndex = Math.min(Math.max(nextIndex, 0), slides.length - 1);

        if (infinite && direction === undefined) {
            nextIndex += infinite;
        }

        if (rewindPrev && Math.abs(position.x) === 0 && direction === false) {
            nextIndex = slides.length - 1;
            duration = rewindSpeed;
        }

        var nextOffset = Math.min(Math.max(slides[nextIndex].offsetLeft * -1, maxOffset * -1), 0);

        if (rewind && Math.abs(position.x) === maxOffset && direction) {
            nextOffset = 0;
            nextIndex = 0;
            duration = rewindSpeed;
        }

        /**
         * translate to the nextOffset by a defined duration and ease function
         */
        translate(nextOffset, duration, ease);

        /**
         * update the position with the next position
         */
        position.x = nextOffset;

        /**
         * update the index with the nextIndex only if
         * the offset of the nextIndex is in the range of the maxOffset
         */
        if (slides[nextIndex].offsetLeft <= maxOffset) {
            index = nextIndex;
        }

        if (infinite && (nextIndex === slides.length - infinite || nextIndex === slides.length - slides.length % infinite || nextIndex === 0)) {
            if (direction) {
                index = infinite;
            }

            if (!direction) {
                index = slides.length - infinite * 2;
            }

            position.x = slides[index].offsetLeft * -1;

            transitionEndCallback = function transitionEndCallback() {
                translate(slides[index].offsetLeft * -1, 0, undefined);
            };
        }

        if (classNameActiveSlide) {
            setActiveElement(slice.call(slides), index);
        }

        /**
         * update classes for next and prev arrows
         * based on user settings
         */
        if (prevCtrl && !infinite && !rewindPrev && nextIndex === 0) {
            prevCtrl.classList.add(classNameDisabledPrevCtrl);
        }

        if (nextCtrl && !infinite && !rewind && nextIndex + 1 === slides.length) {
            nextCtrl.classList.add(classNameDisabledNextCtrl);
        }

        dispatchSliderEvent('after', 'slide', {
            currentSlide: index
        });
    }

    /**
     * public
     * setup function
     */
    function setup() {
        dispatchSliderEvent('before', 'init');

        prefixes = (0, _detectPrefixes2.default)();
        options = _extends({}, _defaults2.default, opts);

        var _options4 = options,
            classNameFrame = _options4.classNameFrame,
            classNameSlideContainer = _options4.classNameSlideContainer,
            classNamePrevCtrl = _options4.classNamePrevCtrl,
            classNameNextCtrl = _options4.classNameNextCtrl,
            _options4$classNameDi = _options4.classNameDisabledNextCtrl,
            classNameDisabledNextCtrl = _options4$classNameDi === undefined ? 'disabled' : _options4$classNameDi,
            _options4$classNameDi2 = _options4.classNameDisabledPrevCtrl,
            classNameDisabledPrevCtrl = _options4$classNameDi2 === undefined ? 'disabled' : _options4$classNameDi2,
            enableMouseEvents = _options4.enableMouseEvents,
            classNameActiveSlide = _options4.classNameActiveSlide,
            initialIndex = _options4.initialIndex;


        index = initialIndex;
        frame = slider.getElementsByClassName(classNameFrame)[0];
        slideContainer = frame.getElementsByClassName(classNameSlideContainer)[0];
        prevCtrl = slider.getElementsByClassName(classNamePrevCtrl)[0];
        nextCtrl = slider.getElementsByClassName(classNameNextCtrl)[0];

        position = {
            x: slideContainer.offsetLeft,
            y: slideContainer.offsetTop
        };

        if (options.infinite) {
            slides = setupInfinite(slice.call(slideContainer.children));
        } else {
            slides = slice.call(slideContainer.children);

            if (prevCtrl && !options.rewindPrev) {
                prevCtrl.classList.add(classNameDisabledPrevCtrl);
            }

            if (nextCtrl && slides.length === 1 && !options.rewind) {
                nextCtrl.classList.add(classNameDisabledNextCtrl);
            }
        }

        reset();

        if (classNameActiveSlide) {
            setActiveElement(slides, index);
        }

        if (prevCtrl && nextCtrl) {
            prevCtrl.addEventListener('click', prev);
            nextCtrl.addEventListener('click', next);
        }

        frame.addEventListener('touchstart', onTouchstart, touchEventParams);

        if (enableMouseEvents) {
            frame.addEventListener('mousedown', onTouchstart);
            frame.addEventListener('click', onClick);
        }

        options.window.addEventListener('resize', onResize);

        dispatchSliderEvent('after', 'init');
    }

    /**
     * public
     * reset function: called on resize
     */
    function reset() {
        var _options5 = options,
            infinite = _options5.infinite,
            ease = _options5.ease,
            rewindSpeed = _options5.rewindSpeed,
            rewindOnResize = _options5.rewindOnResize,
            classNameActiveSlide = _options5.classNameActiveSlide,
            initialIndex = _options5.initialIndex;


        slidesWidth = elementWidth(slideContainer);
        frameWidth = elementWidth(frame);

        if (frameWidth === slidesWidth) {
            slidesWidth = slides.reduce(function (previousValue, slide) {
                return previousValue + elementWidth(slide);
            }, 0);
        }

        if (rewindOnResize) {
            index = initialIndex;
        } else {
            ease = null;
            rewindSpeed = 0;
        }

        if (infinite) {
            translate(slides[index + infinite].offsetLeft * -1, 0, null);

            index = index + infinite;
            position.x = slides[index].offsetLeft * -1;
        } else {
            translate(slides[index].offsetLeft * -1, rewindSpeed, ease);
            position.x = slides[index].offsetLeft * -1;
        }

        if (classNameActiveSlide) {
            setActiveElement(slice.call(slides), index);
        }
    }

    /**
     * public
     * slideTo: called on clickhandler
     */
    function slideTo(index) {
        slide(index);
    }

    /**
     * public
     * returnIndex function: called on clickhandler
     */
    function returnIndex() {
        return index - options.infinite || 0;
    }

    /**
     * public
     * prev function: called on clickhandler
     */
    function prev() {
        slide(false, false);
    }

    /**
     * public
     * next function: called on clickhandler
     */
    function next() {
        slide(false, true);
    }

    /**
     * public
     * destroy function: called to gracefully destroy the lory instance
     */
    function destroy() {
        dispatchSliderEvent('before', 'destroy');

        // remove event listeners
        frame.removeEventListener(prefixes.transitionEnd, onTransitionEnd);
        frame.removeEventListener('touchstart', onTouchstart, touchEventParams);
        frame.removeEventListener('touchmove', onTouchmove, touchEventParams);
        frame.removeEventListener('touchend', onTouchend);
        frame.removeEventListener('mousemove', onTouchmove);
        frame.removeEventListener('mousedown', onTouchstart);
        frame.removeEventListener('mouseup', onTouchend);
        frame.removeEventListener('mouseleave', onTouchend);
        frame.removeEventListener('click', onClick);

        options.window.removeEventListener('resize', onResize);

        if (prevCtrl) {
            prevCtrl.removeEventListener('click', prev);
        }

        if (nextCtrl) {
            nextCtrl.removeEventListener('click', next);
        }

        // remove cloned slides if infinite is set
        if (options.infinite) {
            Array.apply(null, Array(options.infinite)).forEach(function () {
                slideContainer.removeChild(slideContainer.firstChild);
                slideContainer.removeChild(slideContainer.lastChild);
            });
        }

        dispatchSliderEvent('after', 'destroy');
    }

    // event handling

    var touchOffset = void 0;
    var delta = void 0;
    var isScrolling = void 0;

    function onTransitionEnd() {
        if (transitionEndCallback) {
            transitionEndCallback();

            transitionEndCallback = undefined;
        }
    }

    function onTouchstart(event) {
        var _options6 = options,
            enableMouseEvents = _options6.enableMouseEvents;

        var touches = event.touches ? event.touches[0] : event;

        if (enableMouseEvents) {
            frame.addEventListener('mousemove', onTouchmove);
            frame.addEventListener('mouseup', onTouchend);
            frame.addEventListener('mouseleave', onTouchend);
        }

        frame.addEventListener('touchmove', onTouchmove, touchEventParams);
        frame.addEventListener('touchend', onTouchend);

        var pageX = touches.pageX,
            pageY = touches.pageY;


        touchOffset = {
            x: pageX,
            y: pageY,
            time: Date.now()
        };

        isScrolling = undefined;

        delta = {};

        dispatchSliderEvent('on', 'touchstart', {
            event: event
        });
    }

    function onTouchmove(event) {
        var touches = event.touches ? event.touches[0] : event;
        var pageX = touches.pageX,
            pageY = touches.pageY;


        delta = {
            x: pageX - touchOffset.x,
            y: pageY - touchOffset.y
        };

        if (typeof isScrolling === 'undefined') {
            isScrolling = !!(isScrolling || Math.abs(delta.x) < Math.abs(delta.y));
        }

        if (!isScrolling && touchOffset) {
            translate(position.x + delta.x, 0, null);
        }

        // may be
        dispatchSliderEvent('on', 'touchmove', {
            event: event
        });
    }

    function onTouchend(event) {
        /**
         * time between touchstart and touchend in milliseconds
         * @duration {number}
         */
        var duration = touchOffset ? Date.now() - touchOffset.time : undefined;

        /**
         * is valid if:
         *
         * -> swipe attempt time is over 300 ms
         * and
         * -> swipe distance is greater than 25px
         * or
         * -> swipe distance is more then a third of the swipe area
         *
         * @isValidSlide {Boolean}
         */
        var isValid = Number(duration) < 300 && Math.abs(delta.x) > 25 || Math.abs(delta.x) > frameWidth / 3;

        /**
         * is out of bounds if:
         *
         * -> index is 0 and delta x is greater than 0
         * or
         * -> index is the last slide and delta is smaller than 0
         *
         * @isOutOfBounds {Boolean}
         */
        var isOutOfBounds = !index && delta.x > 0 || index === slides.length - 1 && delta.x < 0;

        var direction = delta.x < 0;

        if (!isScrolling) {
            if (isValid && !isOutOfBounds) {
                slide(false, direction);
            } else {
                translate(position.x, options.snapBackSpeed);
            }
        }

        touchOffset = undefined;

        /**
         * remove eventlisteners after swipe attempt
         */
        frame.removeEventListener('touchmove', onTouchmove);
        frame.removeEventListener('touchend', onTouchend);
        frame.removeEventListener('mousemove', onTouchmove);
        frame.removeEventListener('mouseup', onTouchend);
        frame.removeEventListener('mouseleave', onTouchend);

        dispatchSliderEvent('on', 'touchend', {
            event: event
        });
    }

    function onClick(event) {
        if (delta.x) {
            event.preventDefault();
        }
    }

    function onResize(event) {
        if (frameWidth !== elementWidth(frame)) {
            reset();

            dispatchSliderEvent('on', 'resize', {
                event: event
            });
        }
    }

    // trigger initial setup
    setup();

    // expose public api
    return {
        setup: setup,
        reset: reset,
        slideTo: slideTo,
        returnIndex: returnIndex,
        prev: prev,
        next: next,
        destroy: destroy
    };
}

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = detectPrefixes;
/**
 * Detecting prefixes for saving time and bytes
 */
function detectPrefixes() {
    var transform = void 0;
    var transition = void 0;
    var transitionEnd = void 0;

    (function () {
        var el = document.createElement('_');
        var style = el.style;

        var prop = void 0;

        if (style[prop = 'webkitTransition'] === '') {
            transitionEnd = 'webkitTransitionEnd';
            transition = prop;
        }

        if (style[prop = 'transition'] === '') {
            transitionEnd = 'transitionend';
            transition = prop;
        }

        if (style[prop = 'webkitTransform'] === '') {
            transform = prop;
        }

        if (style[prop = 'msTransform'] === '') {
            transform = prop;
        }

        if (style[prop = 'transform'] === '') {
            transform = prop;
        }

        document.body.insertBefore(el, null);
        style[transform] = 'translateX(0)';
        document.body.removeChild(el);
    })();

    return {
        transform: transform,
        transition: transition,
        transitionEnd: transitionEnd
    };
}

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = detectSupportsPassive;
function detectSupportsPassive() {
    var supportsPassive = false;

    try {
        var opts = Object.defineProperty({}, 'passive', {
            get: function get() {
                supportsPassive = true;
            }
        });

        window.addEventListener('testPassive', null, opts);
        window.removeEventListener('testPassive', null, opts);
    } catch (e) {}

    return supportsPassive;
}

/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = dispatchEvent;

var _customEvent = __webpack_require__(4);

var _customEvent2 = _interopRequireDefault(_customEvent);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * dispatch custom events
 *
 * @param  {element} el         slideshow element
 * @param  {string}  type       custom event name
 * @param  {object}  detail     custom detail information
 */
function dispatchEvent(target, type, detail) {
    var event = new _customEvent2.default(type, {
        bubbles: true,
        cancelable: true,
        detail: detail
    });

    target.dispatchEvent(event);
}

/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(global) {
var NativeCustomEvent = global.CustomEvent;

function useNative () {
  try {
    var p = new NativeCustomEvent('cat', { detail: { foo: 'bar' } });
    return  'cat' === p.type && 'bar' === p.detail.foo;
  } catch (e) {
  }
  return false;
}

/**
 * Cross-browser `CustomEvent` constructor.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent.CustomEvent
 *
 * @public
 */

module.exports = useNative() ? NativeCustomEvent :

// IE >= 9
'undefined' !== typeof document && 'function' === typeof document.createEvent ? function CustomEvent (type, params) {
  var e = document.createEvent('CustomEvent');
  if (params) {
    e.initCustomEvent(type, params.bubbles, params.cancelable, params.detail);
  } else {
    e.initCustomEvent(type, false, false, void 0);
  }
  return e;
} :

// IE <= 8
function CustomEvent (type, params) {
  var e = document.createEventObject();
  e.type = type;
  if (params) {
    e.bubbles = Boolean(params.bubbles);
    e.cancelable = Boolean(params.cancelable);
    e.detail = params.detail;
  } else {
    e.bubbles = false;
    e.cancelable = false;
    e.detail = void 0;
  }
  return e;
}

/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(5)))

/***/ }),
/* 5 */
/***/ (function(module, exports) {

var g;

// This works in non-strict mode
g = (function() {
	return this;
})();

try {
	// This works if eval is allowed (see CSP)
	g = g || Function("return this")() || (1,eval)("this");
} catch(e) {
	// This works if the window reference is available
	if(typeof window === "object")
		g = window;
}

// g can still be undefined, but nothing to do about it...
// We return undefined, instead of nothing here, so it's
// easier to handle this case. if(!global) { ...}

module.exports = g;


/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = {
  /**
   * slides scrolled at once
   * @slidesToScroll {Number}
   */
  slidesToScroll: 1,

  /**
   * time in milliseconds for the animation of a valid slide attempt
   * @slideSpeed {Number}
   */
  slideSpeed: 300,

  /**
   * time in milliseconds for the animation of the rewind after the last slide
   * @rewindSpeed {Number}
   */
  rewindSpeed: 600,

  /**
   * time for the snapBack of the slider if the slide attempt was not valid
   * @snapBackSpeed {Number}
   */
  snapBackSpeed: 200,

  /**
   * Basic easing functions: https://developer.mozilla.org/de/docs/Web/CSS/transition-timing-function
   * cubic bezier easing functions: http://easings.net/de
   * @ease {String}
   */
  ease: 'ease',

  /**
   * if slider reached the last slide, with next click the slider goes back to the startindex.
   * use infinite or rewind, not both
   * @rewind {Boolean}
   */
  rewind: false,

  /**
   * number of visible slides or false
   * use infinite or rewind, not both
   * @infinite {number}
   */
  infinite: false,

  /**
   * the slide index to show when the slider is initialized.
   * @initialIndex {number}
   */
  initialIndex: 0,

  /**
   * class name for slider frame
   * @classNameFrame {string}
   */
  classNameFrame: 'js_frame',

  /**
   * class name for slides container
   * @classNameSlideContainer {string}
   */
  classNameSlideContainer: 'js_slides',

  /**
   * class name for slider prev control
   * @classNamePrevCtrl {string}
   */
  classNamePrevCtrl: 'js_prev',

  /**
   * class name for slider next control
   * @classNameNextCtrl {string}
   */
  classNameNextCtrl: 'js_next',

  /**
   * class name for current active slide
   * if emptyString then no class is set
   * @classNameActiveSlide {string}
   */
  classNameActiveSlide: 'active',

  /**
   * enables mouse events for swiping on desktop devices
   * @enableMouseEvents {boolean}
   */
  enableMouseEvents: false,

  /**
   * window instance
   * @window {object}
   */
  window: typeof window !== 'undefined' ? window : null,

  /**
   * If false, slides lory to the first slide on window resize.
   * @rewindOnResize {boolean}
   */
  rewindOnResize: true
};

/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(0);


/***/ })
/******/ ]);
});
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.Pristine = factory());
}(this, (function () { 'use strict';

var lang = {
    required: "Dit veld is verplicht",
    email: "Dit is geen geldig e-mail adres",
    number: "Dit is geen geldig nummer",
    url: "Dit is geen geldige url",
    tel: "Dit is geen geldig telefoonnummer",
    maxlength: "Dit veld mag maximaal ${1} karakters bevatten",
    minlength: "Dti veld moet minimaal ${1} karakters bevatten",
    min: "Minimum value for this field is ${1}",
    max: "Maximum value for this field is ${1}",
    pattern: "Input must match the pattern ${1}"
};

function findAncestor(el, cls) {
    while ((el = el.parentElement) && !el.classList.contains(cls)) {}
    return el;
}

function tmpl(o) {
    var _arguments = arguments;

    return this.replace(/\${([^{}]*)}/g, function (a, b) {
        return _arguments[b];
    });
}

function groupedElemCount(input) {
    return input.pristine.self.form.querySelectorAll('input[name="' + input.getAttribute('name') + '"]:checked').length;
}

var defaultConfig = {
    classTo: 'form-group',
    errorClass: 'has-danger',
    successClass: 'has-success',
    errorTextParent: 'form-group',
    errorTextTag: 'div',
    errorTextClass: 'text-help'
};

var PRISTINE_ERROR = 'pristine-error';
var SELECTOR = "input:not([type^=hidden]):not([type^=submit]), select, textarea";
var ALLOWED_ATTRIBUTES = ["required", "min", "max", 'minlength', 'maxlength', 'pattern'];

var validators = {};

var _ = function _(name, validator) {
    validator.name = name;
    if (!validator.msg) validator.msg = lang[name];
    if (validator.priority === undefined) validator.priority = 1;
    validators[name] = validator;
};

_('text', { fn: function fn(val) {
        return true;
    }, priority: 0 });
_('required', { fn: function fn(val) {
        return this.type === 'radio' || this.type === 'checkbox' ? groupedElemCount(this) : val !== undefined && val !== '';
    }, priority: 99, halt: true });
_('email', { fn: function fn(val) {
        return !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    } });
_('number', { fn: function fn(val) {
        return !val || !isNaN(parseFloat(val));
    }, priority: 2 });
_('integer', { fn: function fn(val) {
        return val && /^\d+$/.test(val);
    } });
_('minlength', { fn: function fn(val, length) {
        return !val || val.length >= parseInt(length);
    } });
_('maxlength', { fn: function fn(val, length) {
        return !val || val.length <= parseInt(length);
    } });
_('min', { fn: function fn(val, limit) {
        return !val || (this.type === 'checkbox' ? groupedElemCount(this) >= parseInt(limit) : parseFloat(val) >= parseFloat(limit));
    } });
_('max', { fn: function fn(val, limit) {
        return !val || (this.type === 'checkbox' ? groupedElemCount(this) <= parseInt(limit) : parseFloat(val) <= parseFloat(limit));
    } });
_('pattern', { fn: function fn(val, pattern) {
        var m = pattern.match(new RegExp('^/(.*?)/([gimy]*)$'));return !val || new RegExp(m[1], m[2]).test(val);
    } });

function Pristine(form, config, live) {

    var self = this;

    init(form, config, live);

    function init(form, config, live) {

        form.setAttribute("novalidate", "true");

        self.form = form;
        self.config = config || defaultConfig;
        self.live = !(live === false);
        self.fields = Array.from(form.querySelectorAll(SELECTOR)).map(function (input) {

            var fns = [];
            var params = {};
            var messages = {};

            [].forEach.call(input.attributes, function (attr) {
                if (/^data-pristine-/.test(attr.name)) {
                    var name = attr.name.substr(14);
                    if (name.endsWith('-message')) {
                        messages[name.slice(0, name.length - 8)] = attr.value;
                        return;
                    }
                    if (name === 'type') name = attr.value;
                    _addValidatorToField(fns, params, name, attr.value);
                } else if (~ALLOWED_ATTRIBUTES.indexOf(attr.name)) {
                    _addValidatorToField(fns, params, attr.name, attr.value);
                } else if (attr.name === 'type') {
                    _addValidatorToField(fns, params, attr.value);
                }
            });

            fns.sort(function (a, b) {
                return b.priority - a.priority;
            });

            self.live && input.addEventListener(!~['radio', 'checkbox'].indexOf(input.getAttribute('type')) ? 'input' : 'change', function (e) {
                self.validate(e.target);
            }.bind(self));

            return input.pristine = { input: input, validators: fns, params: params, messages: messages, self: self };
        }.bind(self));
    }

    function _addValidatorToField(fns, params, name, value) {
        var validator = validators[name];
        if (validator) {
            fns.push(validator);
            if (value) {
                var valueParams = value.split(',');
                valueParams.unshift(null); // placeholder for input's value
                params[name] = valueParams;
            }
        }
    }

    /***
     * Checks whether the form/input elements are valid
     * @param input => input element(s) or a jquery selector, null for full form validation
     * @param silent => do not show error messages, just return true/false
     * @returns {boolean} return true when valid false otherwise
     */
    self.validate = function (input, silent) {
        silent = input && silent === true || input === true;
        var fields = self.fields;
        if (input !== true && input !== false) {
            if (input instanceof HTMLElement) {
                fields = [input.pristine];
            } else if (input instanceof NodeList || input instanceof (window.$ || Array) || input instanceof Array) {
                fields = Array.from(input).map(function (el) {
                    return el.pristine;
                });
            }
        }

        var valid = true;

        for (var i in fields) {
            var field = fields[i];
            if (_validateField(field)) {
                !silent && _showSuccess(field);
            } else {
                valid = false;
                !silent && _showError(field);
            }
        }
        return valid;
    };

    /***
     * Get errors of a specific field or the whole form
     * @param input
     * @returns {Array|*}
     */
    self.getErrors = function (input) {
        if (!input) {
            var erroneousFields = [];
            for (var i = 0; i < self.fields.length; i++) {
                var field = self.fields[i];
                if (field.errors.length) {
                    erroneousFields.push({ input: field.input, errors: field.errors });
                }
            }
            return erroneousFields;
        }
        return input.length ? input[0].pristine.errors : input.pristine.errors;
    };

    /***
     * Validates a single field, all validator functions are called and error messages are generated
     * when a validator fails
     * @param field
     * @returns {boolean}
     * @private
     */
    function _validateField(field) {
        var errors = [];
        var valid = true;
        for (var i in field.validators) {
            var validator = field.validators[i];
            var params = field.params[validator.name] ? field.params[validator.name] : [];
            params[0] = field.input.value;
            if (!validator.fn.apply(field.input, params)) {
                valid = false;
                var error = field.messages[validator.name] || validator.msg;
                errors.push(tmpl.apply(error, params));
                if (validator.halt === true) {
                    break;
                }
            }
        }
        field.errors = errors;
        return valid;
    }

    /***
     *
     * @param elemOrName => The dom element when validator is applied on a specific field. A string when it's
     * a global validator
     * @param fn => validator function
     * @param msg => message to show when validation fails. Supports templating. ${0} for the input's value, ${1} and
     * so on are for the attribute values
     * @param priority => priority of the validator function, higher valued function gets called first.
     * @param halt => whether validation should stop for this field after current validation function
     */
    self.addValidator = function (elemOrName, fn, msg, priority, halt) {
        if (typeof elemOrName === 'string') {
            _(elemOrName, { fn: fn, msg: msg, priority: priority, halt: halt });
        } else if (elemOrName instanceof HTMLElement) {
            elemOrName.pristine.validators.push({ fn: fn, msg: msg, priority: priority, halt: halt });
            elemOrName.pristine.validators.sort(function (a, b) {
                return b.priority - a.priority;
            });
        }
    };

    /***
     * An utility function that returns a 2-element array, first one is the element where error/success class is
     * applied. 2nd one is the element where error message is displayed. 2nd element is created if doesn't exist and cached.
     * @param field
     * @returns {*}
     * @private
     */
    function _getErrorElements(field) {
        if (field.errorElements) {
            return field.errorElements;
        }
        var errorClassElement = findAncestor(field.input, self.config.classTo);
        var errorTextParent = null,
            errorTextElement = null;
        if (self.config.classTo === self.config.errorTextParent) {
            errorTextParent = errorClassElement;
        } else {
            errorTextParent = errorClassElement.querySelector(self.errorTextParent);
        }
        if (errorTextParent) {
            errorTextElement = errorTextParent.querySelector('.' + PRISTINE_ERROR);
            if (!errorTextElement) {
                errorTextElement = document.createElement(self.config.errorTextTag);
                errorTextElement.className = PRISTINE_ERROR + ' ' + self.config.errorTextClass;
                errorTextParent.appendChild(errorTextElement);
                errorTextElement.pristineDisplay = errorTextElement.style.display;
            }
        }
        return field.errorElements = [errorClassElement, errorTextElement];
    }

    function _showError(field) {
        var errorElements = _getErrorElements(field);
        var errorClassElement = errorElements[0],
            errorTextElement = errorElements[1];

        if (errorClassElement) {
            errorClassElement.classList.remove(self.config.successClass);
            errorClassElement.classList.add(self.config.errorClass);
        }
        if (errorTextElement) {
            errorTextElement.innerHTML = field.errors.join('<br/>');
            errorTextElement.style.display = errorTextElement.pristineDisplay || '';
        }
    }

    /***
     * Adds error to a specific field
     * @param input
     * @param error
     */
    self.addError = function (input, error) {
        input = input.length ? input[0] : input;
        input.pristine.errors.push(error);
        _showError(input.pristine);
    };

    function _removeError(field) {
        var errorElements = _getErrorElements(field);
        var errorClassElement = errorElements[0],
            errorTextElement = errorElements[1];
        if (errorClassElement) {
            // IE > 9 doesn't support multiple class removal
            errorClassElement.classList.remove(self.config.errorClass);
            errorClassElement.classList.remove(self.config.successClass);
        }
        if (errorTextElement) {
            errorTextElement.innerHTML = '';
            errorTextElement.style.display = 'none';
        }
        return errorElements;
    }

    function _showSuccess(field) {
        var errorClassElement = _removeError(field)[0];
        errorClassElement && errorClassElement.classList.add(self.config.successClass);
    }

    /***
     * Resets the errors
     */
    self.reset = function () {
        for (var i in self.fields) {
            self.fields[i].errorElements = null;
        }
        Array.from(self.form.querySelectorAll('.' + PRISTINE_ERROR)).map(function (elem) {
            elem.parentNode.removeChild(elem);
        });
        Array.from(self.form.querySelectorAll('.' + self.config.classTo)).map(function (elem) {
            elem.classList.remove(self.config.successClass);
            elem.classList.remove(self.config.errorClass);
        });
    };

    /***
     * Resets the errors and deletes all pristine fields
     */
    self.destroy = function () {
        self.reset();
        self.fields.forEach(function (field) {
            delete field.input.pristine;
        });
        self.fields = [];
    };

    self.setGlobalConfig = function (config) {
        defaultConfig = config;
    };

    return self;
}

return Pristine;

})));

function throttle(fn, wait) {
    var time = Date.now();
    return function() {
        if ((time + wait - Date.now()) < 0) {
            fn();
            time = Date.now();
        }
    }
}

function is_touch_device() {
    var prefixes = ' -webkit- -moz- -o- -ms- '.split(' ');
    var mq = function(query) {
        return window.matchMedia(query).matches;
    }

    if (('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch) {
        return true;
    }

    // include the 'heartz' as a way to have a non matching MQ to help terminate the join
    // https://git.io/vznFH
    var query = ['(', prefixes.join('touch-enabled),('), 'heartz', ')'].join('');
    return mq(query);
}

(function(funcName, baseObj) {
    "use strict";
    // The public function name defaults to window.docReady
    // but you can modify the last line of this function to pass in a different object or method name
    // if you want to put them in a different namespace and those will be used instead of
    // window.docReady(...)
    funcName = funcName || "docReady";
    baseObj = baseObj || window;
    var readyList = [];
    var readyFired = false;
    var readyEventHandlersInstalled = false;

    // call this when the document is ready
    // this function protects itself against being called more than once
    function ready() {
        if (!readyFired) {
            // this must be set to true before we start calling callbacks
            readyFired = true;
            for (var i = 0; i < readyList.length; i++) {
                // if a callback here happens to add new ready handlers,
                // the docReady() function will see that it already fired
                // and will schedule the callback to run right after
                // this event loop finishes so all handlers will still execute
                // in order and no new ones will be added to the readyList
                // while we are processing the list
                readyList[i].fn.call(window, readyList[i].ctx);
            }
            // allow any closures held by these functions to free
            readyList = [];
        }
    }

    function readyStateChange() {
        if ( document.readyState === "complete" ) {
            ready();
        }
    }

    // This is the one public interface
    // docReady(fn, context);
    // the context argument is optional - if present, it will be passed
    // as an argument to the callback
    baseObj[funcName] = function(callback, context) {
        if (typeof callback !== "function") {
            throw new TypeError("callback for docReady(fn) must be a function");
        }
        // if ready has already fired, then just schedule the callback
        // to fire asynchronously, but right away
        if (readyFired) {
            setTimeout(function() {callback(context);}, 1);
            return;
        } else {
            // add the function and context to the list
            readyList.push({fn: callback, ctx: context});
        }
        // if document already ready to go, schedule the ready function to run
        // IE only safe when readyState is "complete", others safe when readyState is "interactive"
        if (document.readyState === "complete" || (!document.attachEvent && document.readyState === "interactive")) {
            setTimeout(ready, 1);
        } else if (!readyEventHandlersInstalled) {
            // otherwise if we don't have event handlers installed, install them
            if (document.addEventListener) {
                // first choice is DOMContentLoaded event
                document.addEventListener("DOMContentLoaded", ready, false);
                // backup is window load event
                window.addEventListener("load", ready, false);
            } else {
                // must be IE
                document.attachEvent("onreadystatechange", readyStateChange);
                window.attachEvent("onload", ready);
            }
            readyEventHandlersInstalled = true;
        }
    }
})("docReady", window);
// modify this previous line to pass in your own method name
// and object for the method to be attached to
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/*! Canvi - v1.0.0 - 2017-7-20
* Canvi is a simple, but customizable, responsive off-canvas navigation.
* GITHUB repo link
* by Adam Laki / Pine */

var Canvi = '';

(function () {

    /*
     * Canvi constructor
     */

    Canvi = function Canvi() {

        'use strict';

        /*
         * Set the defaults
         */

        // Global element references

        var pushContent = '',
            body = document.querySelector('body'),
            content = '',
            options = {},
            defaults = {},
            openButton = '',
            overlay = '',
            navbar = '',
            transitionEvent = _whichTransitionEvent(),
            isOpen = false;

        // Default values
        defaults = {
            content: '.canvi-content',
            isDebug: false,
            navbar: '.canvi-navbar',
            speed: '0.3s',
            openButton: '.canvi-open-button',
            position: 'left',
            pushContent: true,
            width: '300px'

            // Create our options from the defaults and the given values from the constructor
        };if (arguments[0] && _typeof(arguments[0]) === "object") {
            options = _extendDefaults(defaults, arguments[0]);
        }

        // Select default elements from the options
        openButton = document.querySelector(options.openButton);
        navbar = document.querySelector(options.navbar);
        content = document.querySelector(options.content);

        /*
         * Call the init of Canvi and start the fun
         */

        initCanvi();

        function initCanvi() {
            if (options.isDebug) console.log('%c %s', 'color: #e01a51; font-style: italic;', 'CANVI: Init is running...');
            if (options.isDebug) _objectLog();

            _buildMarkup();
            _initializeMainEvents();

            // Trigger Custom Event
            _triggerCanviEvent('canvi.init');

            navbar.setAttribute('inert', '');
            navbar.setAttribute('aria-hidden', 'true');
        }

        /********************************
         * Public methods
         ********************************/

        /*
         * Open of Canvi function
         */

        function openCanvi() {
            if (options.isDebug) console.log('%c %s', 'color: #e01a51; font-style: italic;', 'CANVI: Open is running...');

            // Trigger Custom Event
            _triggerCanviEvent('canvi.before-open');

            _buildOverlay();
            _setZindex();

            // Add open classes
            content.classList.add('is-canvi-open');
            body.classList.add('is-canvi-open');
            navbar.classList.add('is-canvi-open');

            _responsiveWidth();

            if (options.pushContent === true) {
                content.addEventListener(transitionEvent, _transtionOpenEnd);
            } else {
                navbar.addEventListener(transitionEvent, _transtionOpenEnd);
            }

            navbar.removeAttribute('inert');
            navbar.removeAttribute('aria-hidden');

            isOpen = true;
        }

        /*
         * Close of Canvi function
         */

        function closeCanvi() {
            if (options.isDebug) console.log('%c %s', 'color: #e01a51; font-style: italic;', 'CANVI: Close is running...');

            if (isOpen === true) {
                // Trigger Custom Event
                _triggerCanviEvent('canvi.before-close');

                overlay.classList.add('canvi-animate-out');

                // Remove open classes
                //content.style.transform = 'translateX(0)';
                body.classList.remove('is-canvi-open');
                navbar.classList.remove('is-canvi-open');

                if (options.pushContent === true) {
                    content.addEventListener(transitionEvent, _transitionCloseEnd);
                } else {
                    navbar.addEventListener(transitionEvent, _transitionCloseEnd);
                }

                navbar.setAttribute('inert', '');
                navbar.setAttribute('aria-hidden', 'true');

                isOpen = false;
            }
        }

        /*
         * Toggle of Canvi function
         */

        function toggleCanvi() {
            if (options.isDebug) console.log('%c %s', 'color: #e01a51; font-style: italic;', 'CANVI: Toggle is running...');

            if (navbar.classList.contains('is-canvi-open') && content.classList.contains('is-canvi-open')) {
                closeCanvi();
            } else {
                openCanvi();
            }
        }

        /********************************
         * Private methods
         ********************************/

        /*
         * Extend the default markup with some specific values
         */

        function _buildMarkup() {
            if (options.isDebug) console.log('%c %s', 'color: #ccc; font-style: italic;', 'CANVI: Build markup...');

            // Set position value, from options 
            if (options.position) {
                navbar.setAttribute('data-position', options.position);
                navbar.setAttribute('data-push-content', options.pushContent);
            }

            // Set the width of the navbar
            navbar.style.width = options.width;

            // Set ready class to the body
            body.classList.add('is-canvi-ready');
        }

        /*
         * Extend the default markup with some specific values
         */

        function _responsiveWidth() {
            if (navbar.classList.contains('is-canvi-open') && window.matchMedia('(min-width: 0px)').matches) {
                navbar.style.width = options.width;
                _responsiveWidthHelper(options.width);
            }

            if (navbar.classList.contains('is-canvi-open') && Array.isArray(options.responsiveWidths) && options.responsiveWidths.length > -1) {
                options.responsiveWidths.forEach(function (element) {
                    if (window.matchMedia('(min-width: ' + element.breakpoint + ')').matches) {
                        navbar.style.width = element.width;

                        _responsiveWidthHelper(element.width);
                    }
                });
            }
        }

        /*
         * Simple helper for the _responsiveWidth function
         */

        function _responsiveWidthHelper(width) {
            if (options.pushContent === true && options.position === 'left') {
                content.style.transform = 'translateX(' + width + ')';
            }

            if (options.pushContent === true && options.position === 'right') {
                content.style.transform = 'translateX(-' + width + ')';
            }
        }

        /*
         * Build the overlay when the menu is opened
         */

        function _buildOverlay() {
            if (options.isDebug) console.log('%c %s', 'color: #32da94; font-style: italic;', 'CANVI: Build overlay...');

            // If overlay is true, add
            if (!content.querySelector('.canvi-overlay')) {
                overlay = document.createElement('div');
                overlay.className = 'canvi-overlay';
                content.appendChild(overlay);
            }

            // Add close event to the overlay
            overlay.addEventListener('click', closeCanvi);

            _setTransitionSpeed();
        }

        /*
         * Destroy the overlay when the menu is closed
         */

        function _removeOverlay() {
            if (options.isDebug) console.log('%c %s', 'color: #32da94; font-style: italic;', 'CANVI: Remove overlay...');
            if (options.isDebug) console.log('%c %s', 'color: #999; font-style: italic;', '---------');

            // If overlay is true, remove
            if (overlay) {
                content.removeChild(overlay);

                // Destroy the overlay event
                overlay.removeEventListener('click', closeCanvi);
            }
        }

        /*
         * Init main events
         */

        function _initializeMainEvents() {
            if (options.isDebug) console.log('%c %s', 'color: #ccc; font-style: italic;', 'CANVI: Init main events...');
            if (options.isDebug) console.log('%c %s', 'color: #999; font-style: italic;', '---------');

            if (openButton) {
                openButton.addEventListener('click', openCanvi);
            }

            window.addEventListener('resize', _responsiveWidth);
        }

        /*
         * Trantions, animation ends
         */

        function _transtionOpenEnd(e) {
            if (e.propertyName !== 'transform') return;

            if (options.isDebug) console.log('%c %s', 'color: #ff7600; font-style: italic;', 'CANVI: Open transition end...');
            if (options.isDebug) console.log('%c %s', 'color: #999; font-style: italic;', '---------');

            // Trigger Custom Event
            _triggerCanviEvent('canvi.after-open');

            if (options.pushContent === true) {
                content.removeEventListener(transitionEvent, _transtionOpenEnd);
            } else {
                navbar.removeEventListener(transitionEvent, _transtionOpenEnd);
            }
        }

        function _transitionCloseEnd(e) {
            if (e.propertyName !== 'transform') return;

            if (options.isDebug) console.log('%c %s', 'color: #ff7600; font-style: italic;', 'CANVI: Close transition end...');

            _triggerCanviEvent('canvi.after-close');
            _removeOverlay();

            if (options.pushContent === true) {
                content.removeEventListener(transitionEvent, _transitionCloseEnd);
            } else {
                navbar.removeEventListener(transitionEvent, _transitionCloseEnd);
            }

            _resetZindex();

            content.classList.remove('is-canvi-open');
        }

        /*
         * Modify transition speed
         */

        function _setTransitionSpeed() {
            navbar.style.transitionDuration = options.speed;
            content.style.transitionDuration = options.speed;
            overlay.style.animationDuration = options.speed;
        }

        /*
         * Modify z-index values when navigation is pushed
         */

        function _setZindex() {
            if (options.pushContent === true) {
                navbar.style.zIndex = 20;
                content.style.zIndex = 40;
            } else {
                navbar.style.zIndex = 25;
                content.style.zIndex = 5;
            }
        }

        function _resetZindex() {
            if (options.pushContent === true) {
                navbar.style.zIndex = 1;
                content.style.zIndex = 5;
            } else {
                navbar.style.zIndex = 25;
                content.style.zIndex = 5;
            }
        }

        /*
         * Close on keyup
         */

        body.addEventListener('keyup', function (e) {
            if (e.keyCode == 27) {
                closeCanvi();
            }
        });

        /********************************
         * Utilities
         ********************************/

        /*
         * Extend the defaults with the option
         */

        function _extendDefaults(source, properties) {
            var property;

            for (property in properties) {
                if (properties.hasOwnProperty(property)) {
                    source[property] = properties[property];
                }
            }

            return source;
        }

        /*
         * Catch transtion end
         */

        function _whichTransitionEvent() {
            var t;
            var el = document.createElement('fakeelement');
            var transitions = {
                'transition': 'transitionend',
                'OTransition': 'oTransitionEnd',
                'MozTransition': 'transitionend',
                'WebkitTransition': 'webkitTransitionEnd'
            };

            for (t in transitions) {
                if (el.style[t] !== undefined) {
                    return transitions[t];
                }
            }
        }

        /*
         * Custom event helper
         */

        function _triggerCanviEvent(name) {
            /*var canviEvent = new CustomEvent(name, {
                detail: {
                    navbar: navbar,
                    openButton: openButton,
                    content: content
                }
            });

            body.dispatchEvent(canviEvent);*/
        }

        /*
         * Log Canvi object
         */

        function _objectLog() {
            console.groupCollapsed('Canvi Object');
            console.log('Open Button: ', openButton);
            console.log('Navbar: ', navbar);
            console.log('Content: ', content);
            console.groupEnd();
        }

        /********************************
         * Return public functions
         ********************************/

        return {
            open: openCanvi,
            close: closeCanvi,
            toggle: toggleCanvi
        };
    };
})();
/**
 * SmoothParallax 1.1.2
 *
 * File smooth-parallax.js.
 *
 * Yet another parallax script. Smooth parallax is intended to make it a lot easier to
 * make objects move vertically or horizontally when scroll, being it images,
 * divs or what-have-you. Use this script to add background or foreground parallax
 * effect to your website.
 *
 * Website: https://diegoversiani.me/smooth-parallax
 * Github: https://github.com/diegoversiani/smooth-parallax
 *
 * Author: Diego Versiani
 * Contact: https://diegoversiani.me/
 *
 * Based on the work of:
 * Rachel Smith: https://codepen.io/rachsmith/post/how-to-move-elements-on-scroll-in-a-way-that-doesn-t-suck-too-bad
 */
(function (root, factory) {
    if ( typeof define === 'function' && define.amd ) {
        define([], factory(root));
    } else if ( typeof exports === 'object' ) {
        module.exports = factory(root);
    } else {
        root.SmoothParallax = factory(root);
    }
})(typeof global !== 'undefined' ? global : this.window || this.global, function (root) {

    'use strict';

    //
    // Variables
    //

    var window = root; // Map window to root to avoid confusion
    var _container;
    var _width, _height, _scrollHeight, _viewPortHeight;
    var _scrollPercent = 0;
    var _scrollOffset = 0;
    var _movingElements = [];
    var _positions = [];
    var _basePercentageOnOptions = [ 'containerVisibility', 'pageScroll' ];
    var _settings;
    var publicMethods = {}; // Placeholder for public methods

    // Default settings
    var defaults = {
        basePercentageOn: 'containerVisibility', // See `_basePercentageOnOptions` for more options
        decimalPrecision: 2
    };


    //
    // Methods
    //

    /**
     * Merge two or more objects. Returns a new object.
     * @private
     * @param {Boolean}  deep     If true, do a deep (or recursive) merge [optional]
     * @param {Object}   objects  The objects to merge together
     * @returns {Object}          Merged values of defaults and options
     */
    var extend = function () {
        // Variables
        var extended = {};
        var deep = false;
        var i = 0;
        var length = arguments.length;

        // Check if a deep merge
        if ( Object.prototype.toString.call( arguments[0] ) === '[object Boolean]' ) {
            deep = arguments[0];
            i++;
        }

        // Merge the object into the extended object
        var merge = function (obj) {
            for ( var prop in obj ) {
                if ( Object.prototype.hasOwnProperty.call( obj, prop ) ) {
                    // If deep merge and property is an object, merge properties
                    if ( deep && Object.prototype.toString.call(obj[prop]) === '[object Object]' ) {
                        extended[prop] = extend( true, extended[prop], obj[prop] );
                    } else {
                        extended[prop] = obj[prop];
                    }
                }
            }
        };

        // Loop through each object and conduct a merge
        for ( ; i < length; i++ ) {
            var obj = arguments[i];
            merge(obj);
        }

        return extended;
    };



    /**
     * Get movable element container
     * @private
     */
    var getElementContainer = function ( element ) {
        var containerSelector = element.getAttribute( 'container' );
        _container = element.parentNode;

        if ( containerSelector != '' && document.querySelector( containerSelector ) ) {
            _container = document.querySelector( containerSelector );
        }

        return _container;
    };



    /**
     * Calculate page percent scrolled.
     * @private
     */
    var calculatePageScrollPercent = function () {
        var documentElement = document.documentElement || document.body;
        _height = documentElement.scrollHeight;
        _scrollOffset = window.pageYOffset || documentElement.scrollTop;
        return _scrollOffset / ( _height - documentElement.clientHeight );
    };



    /**
     * Calculate variables used to determine elements position
     * @private
     */
    var calculatePercent = function ( positionData ) {
        _viewPortHeight = window.innerHeight;

        // Based on `containerVisibility`
        if ( _settings.basePercentageOn == 'containerVisibility' ) {
            _height = positionData.container.scrollHeight;
            _scrollOffset = _viewPortHeight - positionData.container.getBoundingClientRect().top;
            _scrollPercent = _scrollOffset / _height;
        }

        // Based on `pageScroll`
        if ( _settings.basePercentageOn == 'pageScroll' ) {
            _scrollPercent = calculatePageScrollPercent();
        }

        // Normalize scrollPercentage from 0 to 1
        if ( _scrollPercent < 0 ) {
            _scrollPercent = 0;
        }
        else if ( _scrollPercent > 1 ) {
            _scrollPercent = 1;
        }
    };



    /**
     * Get position data object for the element.
     * @returns {Object} Position data object for element or false if not found.
     */
    var getPositionDataByElement = function ( el ) {
        for (var i = 0; i < _positions.length; i++) {
            if ( _positions[i].element == el ) {
                return _positions[i];
            }
        }

        // Return false if not found
        return false;
    }



    /**
     * Initializes positions for each moving element.
     * @private
     */
    var initializeMovingElementsPosition = function () {
        var startPercent,
            startX,
            startY,
            endPercent,
            endX,
            endY,
            baseSizeOn,
            baseSizeOnOptions = [ 'elementsize', 'containerSize' ];

        _movingElements = document.querySelectorAll('[smooth-parallax]');

        for (var i = 0; i < _movingElements.length; i++) {
            startPercent = parseFloat(_movingElements[i].getAttribute( 'start-movement' )) || 0;
            startX = parseFloat(_movingElements[i].getAttribute( 'start-position-x' )) || 0;
            startY = parseFloat(_movingElements[i].getAttribute( 'start-position-y' )) || 0;
            endPercent = parseFloat(_movingElements[i].getAttribute( 'end-movement' )) || 1;
            endX = parseFloat(_movingElements[i].getAttribute( 'end-position-x' )) || 0;
            endY = parseFloat(_movingElements[i].getAttribute( 'end-position-y' )) || 0;
            baseSizeOn = _movingElements[i].getAttribute( 'base-size' );

            if ( baseSizeOnOptions.indexOf( baseSizeOn ) == -1 ) {
                baseSizeOn = 'elementSize'; // Default value
            }

            var elementPosition = {
                element: _movingElements[i],
                container: getElementContainer( _movingElements[i] ),
                baseSizeOn: baseSizeOn,
                start: {
                    percent: startPercent,
                    x: startX,
                    y: startY
                },
                end: {
                    percent: endPercent,
                    x: endX,
                    y: endY
                },
                diff: {
                    percent: endPercent - startPercent,
                    x: endX - startX,
                    y: endY - startY,
                },
                target: {},
                current: {}
            };

            _positions.push( elementPosition );
        }
    };

    /**
     * Updates moving elements position.
     * @private
     */
    var updateElementsPosition = function () {
        for (var i = 0; i < _movingElements.length; i++) {
            var p = _positions[i],
                baseWidth,
                baseHeight,
                transformValue;

            // Try get element's size with `scrollWidth` and `scrollHeight`
            // otherwise use `getComputedStyle` which is more expensive
            if ( p.baseSizeOn == 'elementSize' ) {
                baseWidth = _movingElements[i].scrollWidth || parseFloat( window.getComputedStyle( _movingElements[i] ).width );
                baseHeight = _movingElements[i].scrollHeight || parseFloat( window.getComputedStyle( _movingElements[i] ).height );
            }
            else if ( p.baseSizeOn == 'containerSize' ) {
                baseWidth = p.container.scrollWidth - (_movingElements[i].scrollWidth || parseFloat( window.getComputedStyle( _movingElements[i] ).width ) );
                baseHeight = p.container.scrollHeight - (_movingElements[i].scrollHeight  || parseFloat( window.getComputedStyle( _movingElements[i] ).height ) );
            }

            // Need to calculate percentage for each element
            // when based on `containerVisibility`
            calculatePercent( p );

            // calculate target position
            if(_scrollPercent <= p.start.percent) {
                p.target.x = p.start.x * baseWidth;
                p.target.y = p.start.y * baseHeight;
            }
            else if(_scrollPercent >= p.end.percent) {
                p.target.x = p.end.x * baseWidth;
                p.target.y = p.end.y * baseHeight;
            }
            else {
                p.target.x = p.start.x * baseWidth + ( p.diff.x * ( _scrollPercent - p.start.percent ) / p.diff.percent * baseWidth );
                p.target.y = p.start.y * baseHeight + ( p.diff.y * ( _scrollPercent - p.start.percent ) / p.diff.percent * baseHeight );
            }

            // easing with linear interpolation
            if( !p.current.x || !p.current.y) {
                p.current.x = p.target.x;
                p.current.y = p.target.y;
            } else {
                p.current.x = p.current.x + (p.target.x - p.current.x) * 0.1;
                p.current.y = p.current.y + (p.target.y - p.current.y) * 0.1;
            }

            // Round to decimal precision to prevent
            // too many calculation trips
            p.current.x = parseFloat( p.current.x.toFixed( _settings.decimalPrecision ) );
            p.current.y = parseFloat( p.current.y.toFixed( _settings.decimalPrecision ) );

            // update element style
            _movingElements[i].style.transform = 'translate(' + p.current.x + 'px, ' + p.current.y + 'px)';
        }
    };

    /**
     * Keep updating elements position infinitelly.
     * @private
     */
    var loopUpdatePositions = function () {
        updateElementsPosition();
        requestAnimationFrame( loopUpdatePositions );
    };

    /**
     * Keep updating elements position infinitelly.
     * @private
     */
    var isSupported = function () {
        var supported = true;

        // Test basePercentageOn settings
        if ( _basePercentageOnOptions.indexOf( _settings.basePercentageOn ) == -1 ) {
            supported = false;
            console.error( 'Value not supported for setting basePercentageOn: ' + _settings.basePercentageOn );
        }

        // TODO: ADD feature test for `querySelector`
        // TODO: ADD feature test for css property `translate3d`

        return supported;
    };

    /**
     * Initializes plugin
     */
    publicMethods.init = function ( options ) {
        // Merge user options with defaults
        _settings = extend( defaults, options || {} );
        _settings.decimalPrecision = parseInt( _settings.decimalPrecision ) || defaults.decimalPrecision;

        // Bail early if not supported
        if ( !isSupported() ) { return; }

        // Initialize variables
        initializeMovingElementsPosition();
        loopUpdatePositions();
    };

    /**
     * Get scroll percentage for the element or page.
     * @param {string} el Target element css selector.
     * @return {float} Scroll percentage for the element or the page.
     */
    publicMethods.getScrollPercent = function ( selector ) {
        // Calculate page scroll if no selector was passed
        if ( selector == undefined ) {
            return calculatePageScrollPercent();
        }

        // Find element
        // Return false if not found
        var el = document.querySelector( selector );
        if ( el == null ) return false;

        // Calculate element scroll percent
        var positionData = getPositionDataByElement( el );
        if ( positionData ) {
            calculatePercent( positionData );
            return _scrollPercent;
        }

        // Return false otherwise
        return false;
    };


    //
    // Public APIs
    //
    return publicMethods;

});
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Sticky.js
 * Library for sticky elements written in vanilla javascript. With this library you can easily set sticky elements on your website. It's also responsive.
 *
 * @version 1.2.0
 * @author Rafal Galus <biuro@rafalgalus.pl>
 * @website https://rgalus.github.io/sticky-js/
 * @repo https://github.com/rgalus/sticky-js
 * @license https://github.com/rgalus/sticky-js/blob/master/LICENSE
 */

var Sticky = function () {
    /**
     * Sticky instance constructor
     * @constructor
     * @param {string} selector - Selector which we can find elements
     * @param {string} options - Global options for sticky elements (could be overwritten by data-{option}="" attributes)
     */
    function Sticky() {
        var selector = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        _classCallCheck(this, Sticky);

        this.selector = selector;
        this.elements = [];

        this.version = '1.2.0';

        this.vp = this.getViewportSize();
        this.body = document.querySelector('body');

        this.options = {
            wrap: options.wrap || false,
            marginTop: options.marginTop || 0,
            stickyFor: options.stickyFor || 0,
            stickyClass: options.stickyClass || null,
            stickyContainer: options.stickyContainer || 'body'
        };

        this.updateScrollTopPosition = this.updateScrollTopPosition.bind(this);

        this.updateScrollTopPosition();
        window.addEventListener('load', this.updateScrollTopPosition);
        window.addEventListener('scroll', this.updateScrollTopPosition);

        this.run();
    }

    /**
     * Function that waits for page to be fully loaded and then renders & activates every sticky element found with specified selector
     * @function
     */


    Sticky.prototype.run = function run() {
        var _this = this;

        // wait for page to be fully loaded
        var pageLoaded = setInterval(function () {
            if (document.readyState === 'complete') {
                clearInterval(pageLoaded);

                var elements = document.querySelectorAll(_this.selector);
                _this.forEach(elements, function (element) {
                    return _this.renderElement(element);
                });
            }
        }, 10);
    };

    /**
     * Function that assign needed variables for sticky element, that are used in future for calculations and other
     * @function
     * @param {node} element - Element to be rendered
     */


    Sticky.prototype.renderElement = function renderElement(element) {
        var _this2 = this;

        // create container for variables needed in future
        element.sticky = {};

        // set default variables
        element.sticky.active = false;

        element.sticky.marginTop = parseInt(element.getAttribute('data-margin-top')) || this.options.marginTop;
        element.sticky.stickyFor = parseInt(element.getAttribute('data-sticky-for')) || this.options.stickyFor;
        element.sticky.stickyClass = element.getAttribute('data-sticky-class') || this.options.stickyClass;
        element.sticky.wrap = element.hasAttribute('data-sticky-wrap') ? true : this.options.wrap;
        // @todo attribute for stickyContainer
        // element.sticky.stickyContainer = element.getAttribute('data-sticky-container') || this.options.stickyContainer;
        element.sticky.stickyContainer = this.options.stickyContainer;

        element.sticky.container = this.getStickyContainer(element);
        element.sticky.container.rect = this.getRectangle(element.sticky.container);

        element.sticky.rect = this.getRectangle(element);

        // fix when element is image that has not yet loaded and width, height = 0
        if (element.tagName.toLowerCase() === 'img') {
            element.onload = function () {
                return element.sticky.rect = _this2.getRectangle(element);
            };
        }

        if (element.sticky.wrap) {
            this.wrapElement(element);
        }

        // activate rendered element
        this.activate(element);
    };

    /**
     * Wraps element into placeholder element
     * @function
     * @param {node} element - Element to be wrapped
     */


    Sticky.prototype.wrapElement = function wrapElement(element) {
        element.insertAdjacentHTML('beforebegin', '<span></span>');
        element.previousSibling.appendChild(element);
    };

    /**
     * Function that activates element when specified conditions are met and then initalise events
     * @function
     * @param {node} element - Element to be activated
     */


    Sticky.prototype.activate = function activate(element) {
        if (element.sticky.rect.top + element.sticky.rect.height < element.sticky.container.rect.top + element.sticky.container.rect.height && element.sticky.stickyFor < this.vp.width && !element.sticky.active) {
            element.sticky.active = true;
        }

        if (this.elements.indexOf(element) < 0) {
            this.elements.push(element);
        }

        if (!element.sticky.resizeEvent) {
            this.initResizeEvents(element);
            element.sticky.resizeEvent = true;
        }

        if (!element.sticky.scrollEvent) {
            this.initScrollEvents(element);
            element.sticky.scrollEvent = true;
        }

        this.setPosition(element);
    };

    /**
     * Function which is adding onResizeEvents to window listener and assigns function to element as resizeListener
     * @function
     * @param {node} element - Element for which resize events are initialised
     */


    Sticky.prototype.initResizeEvents = function initResizeEvents(element) {
        var _this3 = this;

        element.sticky.resizeListener = function () {
            return _this3.onResizeEvents(element);
        };
        window.addEventListener('resize', element.sticky.resizeListener);
    };

    /**
     * Removes element listener from resize event
     * @function
     * @param {node} element - Element from which listener is deleted
     */


    Sticky.prototype.destroyResizeEvents = function destroyResizeEvents(element) {
        window.removeEventListener('resize', element.sticky.resizeListener);
    };

    /**
     * Function which is fired when user resize window. It checks if element should be activated or deactivated and then run setPosition function
     * @function
     * @param {node} element - Element for which event function is fired
     */


    Sticky.prototype.onResizeEvents = function onResizeEvents(element) {
        this.vp = this.getViewportSize();

        element.sticky.rect = this.getRectangle(element);
        element.sticky.container.rect = this.getRectangle(element.sticky.container);

        if (element.sticky.rect.top + element.sticky.rect.height < element.sticky.container.rect.top + element.sticky.container.rect.height && element.sticky.stickyFor < this.vp.width && !element.sticky.active) {
            element.sticky.active = true;
        } else if (element.sticky.rect.top + element.sticky.rect.height >= element.sticky.container.rect.top + element.sticky.container.rect.height || element.sticky.stickyFor >= this.vp.width && element.sticky.active) {
            element.sticky.active = false;
        }

        this.setPosition(element);
    };

    /**
     * Function which is adding onScrollEvents to window listener and assigns function to element as scrollListener
     * @function
     * @param {node} element - Element for which scroll events are initialised
     */


    Sticky.prototype.initScrollEvents = function initScrollEvents(element) {
        var _this4 = this;

        element.sticky.scrollListener = function () {
            return _this4.onScrollEvents(element);
        };
        window.addEventListener('scroll', element.sticky.scrollListener);
    };

    /**
     * Removes element listener from scroll event
     * @function
     * @param {node} element - Element from which listener is deleted
     */


    Sticky.prototype.destroyScrollEvents = function destroyScrollEvents(element) {
        window.removeEventListener('scroll', element.sticky.scrollListener);
    };

    /**
     * Function which is fired when user scroll window. If element is active, function is invoking setPosition function
     * @function
     * @param {node} element - Element for which event function is fired
     */


    Sticky.prototype.onScrollEvents = function onScrollEvents(element) {
        if (element.sticky.active) {
            this.setPosition(element);
        }
    };

    /**
     * Main function for the library. Here are some condition calculations and css appending for sticky element when user scroll window
     * @function
     * @param {node} element - Element that will be positioned if it's active
     */


    Sticky.prototype.setPosition = function setPosition(element) {
        this.css(element, { position: '', width: '', top: '', left: '' });

        if (this.vp.height < element.sticky.rect.height || !element.sticky.active) {
            return;
        }

        if (!element.sticky.rect.width) {
            element.sticky.rect = this.getRectangle(element);
        }

        if (element.sticky.wrap) {
            this.css(element.parentNode, {
                display: 'block',
                width: element.sticky.rect.width + 'px',
                height: element.sticky.rect.height + 'px'
            });
        }
        var stuckEvent = document.createEvent('Event');
        stuckEvent.initEvent('stuck', true, true);

        var unstuckEvent = document.createEvent('Event');
        unstuckEvent.initEvent('unstuck', true, true);

        if (element.sticky.rect.top === 0 && element.sticky.container === this.body) {
            this.css(element, {
                position: 'fixed',
                top: element.sticky.rect.top + 'px',
                left: element.sticky.rect.left + 'px',
                width: element.sticky.rect.width + 'px'
            });
        } else if (this.scrollTop > element.sticky.rect.top - element.sticky.marginTop) {
            this.css(element, {
                position: 'fixed',
                width: element.sticky.rect.width + 'px',
                left: element.sticky.rect.left + 'px'
            });

            if (this.scrollTop + element.sticky.rect.height + element.sticky.marginTop > element.sticky.container.rect.top + element.sticky.container.offsetHeight) {

                if (element.sticky.stickyClass) {
                    element.classList.remove(element.sticky.stickyClass);
                    window.document.dispatchEvent(unstuckEvent);
                }

                this.css(element, {
                    top: element.sticky.container.rect.top + element.sticky.container.offsetHeight - (this.scrollTop + element.sticky.rect.height) + 'px' });
            } else {
                if (element.sticky.stickyClass) {
                    element.classList.add(element.sticky.stickyClass);
                    window.document.dispatchEvent(stuckEvent);
                }

                this.css(element, { top: element.sticky.marginTop + 'px' });
            }
        } else {
            if (element.sticky.stickyClass) {
                element.classList.remove(element.sticky.stickyClass);
                window.document.dispatchEvent(unstuckEvent);
            }

            this.css(element, { position: '', width: '', top: '', left: '' });

            if (element.sticky.wrap) {
                this.css(element.parentNode, { display: '', width: '', height: '' });
            }
        }
    };

    /**
     * Function that updates element sticky rectangle (with sticky container), then activate or deactivate element, then update position if it's active
     * @function
     */


    Sticky.prototype.update = function update() {
        var _this5 = this;

        this.forEach(this.elements, function (element) {
            element.sticky.rect = _this5.getRectangle(element);
            element.sticky.container.rect = _this5.getRectangle(element.sticky.container);

            _this5.activate(element);
            _this5.setPosition(element);
        });
    };

    /**
     * Destroys sticky element, remove listeners
     * @function
     */


    Sticky.prototype.destroy = function destroy() {
        var _this6 = this;

        this.forEach(this.elements, function (element) {
            _this6.destroyResizeEvents(element);
            _this6.destroyScrollEvents(element);
            delete element.sticky;
        });
    };

    /**
     * Function that returns container element in which sticky element is stuck (if is not specified, then it's stuck to body)
     * @function
     * @param {node} element - Element which sticky container are looked for
     * @return {node} element - Sticky container
     */


    Sticky.prototype.getStickyContainer = function getStickyContainer(element) {
        var container = element.parentNode;

        while (!container.hasAttribute('data-sticky-container') && !container.parentNode.querySelector(element.sticky.stickyContainer) && container !== this.body) {
            container = container.parentNode;
        }

        return container;
    };

    /**
     * Function that returns element rectangle & position (width, height, top, left)
     * @function
     * @param {node} element - Element which position & rectangle are returned
     * @return {object}
     */


    Sticky.prototype.getRectangle = function getRectangle(element) {
        this.css(element, { position: '', width: '', top: '', left: '' });

        var width = Math.max(element.offsetWidth, element.clientWidth, element.scrollWidth);
        var height = Math.max(element.offsetHeight, element.clientHeight, element.scrollHeight);

        var top = 0;
        var left = 0;

        do {
            top += element.offsetTop || 0;
            left += element.offsetLeft || 0;
            element = element.offsetParent;
        } while (element);

        return { top: top, left: left, width: width, height: height };
    };

    /**
     * Function that returns viewport dimensions
     * @function
     * @return {object}
     */


    Sticky.prototype.getViewportSize = function getViewportSize() {
        return {
            width: Math.max(document.documentElement.clientWidth, window.innerWidth || 0),
            height: Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
        };
    };

    /**
     * Function that updates window scroll position
     * @function
     * @return {number}
     */


    Sticky.prototype.updateScrollTopPosition = function updateScrollTopPosition() {
        this.scrollTop = (window.pageYOffset || document.scrollTop) - (document.clientTop || 0) || 0;
    };

    /**
     * Helper function for loops
     * @helper
     * @param {array}
     * @param {function} callback - Callback function (no need for explanation)
     */


    Sticky.prototype.forEach = function forEach(array, callback) {
        for (var i = 0, len = array.length; i < len; i++) {
            callback(array[i]);
        }
    };

    /**
     * Helper function to add/remove css properties for specified element.
     * @helper
     * @param {node} element - DOM element
     * @param {object} properties - CSS properties that will be added/removed from specified element
     */


    Sticky.prototype.css = function css(element, properties) {
        for (var property in properties) {
            if (properties.hasOwnProperty(property)) {
                element.style[property] = properties[property];
            }
        }
    };

    return Sticky;
}();

/**
 * Export function that supports AMD, CommonJS and Plain Browser.
 */


(function (root, factory) {
    if (typeof exports !== 'undefined') {
        module.exports = factory;
    } else if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else {
        root.Sticky = factory;
    }
})(this, Sticky);
//var string = "Zaken simpel maken is het moeilijkste wat er is. Wij helpen verder online.";
var string = "Brik is een digital design en development bureau. Wij bedenken, ontwerpen en realiseren je digitale ambities.";
var str = string.split("");
//var string2 = "Wij helpen verder online.";
//var str2 = string2.split("");
var el = document.getElementById('str');
//var el2 = document.getElementById('str2');
var svgLogo = document.getElementById('svgLogo');
var header = document.getElementById('homeHeader');
var body = document.getElementsByTagName('body');
var menuContainer = document.getElementsByClassName('menuContainer');
var menuContainers = document.querySelectorAll('.menuContainer');
var menuButtons = document.querySelectorAll('.menuIcon .hamburger');
var isIE11 = !!window.MSInputMethodContext && !!document.documentMode;
var skipIntro = getCookie('skipIntro');

if(isIE11) {
    body[0].classList.add('thisIsIE11-Juck')
}

if(skipIntro != 'true' && header != null) {
    window.scrollTo(0, 0);
    header.classList.add('animated');
    (function animate() {
        if (el != null) {
            str.length > 0 ? el.innerHTML += str.shift() : clearTimeout(running);
            var lazyloadImage = document.querySelectorAll('#projectsContainer img.lazyload');
            for (var i = 0, len = lazyloadImage.length; i < len; i++) {
                var imageToLoad = lazyloadImage[i];
                lazySizes.loader.unveil(imageToLoad);
            }
            if (el.innerHTML.length < string.length) {
                var running = setTimeout(animate, (Math.floor(Math.random() * 20) + 25));
            } else {
                svgLogo.classList.remove('noStroke');
                header.classList.add('animate');
                subtitle.classList.add('animate');
                if(isIE11) {
                    header.classList.add('animateie11');
                }
                setTimeout(function () {
                    body[0].classList.remove('bounded');
                    menuContainer[0].classList.add('show');
                }, 2000);
                setCookie('skipIntro', 'true', 1);
            }
        }
    })();
} else {
    if(el != null) {
        el.innerHTML = string;
        body[0].classList.remove('bounded');
        svgLogo.classList.remove('noStroke');
        header.classList.add('show');
        menuContainer[0].classList.add('show');
    }
}

var sticky = new Sticky('.sticky');
window.document.addEventListener('stuck', function() {
    header.classList.add('isStuck');

    var lazyloadImage = document.querySelectorAll('#projectsContainer img.lazyload');
    for (var i = 0, len = lazyloadImage.length; i < len; i++) {
        var imageToLoad = lazyloadImage[i];
        lazySizes.loader.unveil(imageToLoad);
    }
});
window.document.addEventListener('unstuck', function() {
    header.classList.remove('isStuck');
});

var clearProject = null;
var links = document.querySelectorAll('.namesList a');
var changeBodyColor = null;

if(is_touch_device()) {
    document.body.classList.add('touchy');

    var windowHeight = (Math.max(document.documentElement.clientHeight, window.innerHeight || 0))/2;


    window.addEventListener('scroll', function () {
        for (var i = 0, len = links.length; i < len; i++) {
            projectLink = links[i];
            if(projectLink.getBoundingClientRect().y < (windowHeight + 50) && projectLink.getBoundingClientRect().y > (windowHeight - 50) - projectLink.getBoundingClientRect().height) {
                projectLink.classList.add('active');
                activateProject(projectLink);
            } else {
                projectLink.classList.remove('active');
            }
        }

        var activeProjectLinks = document.querySelectorAll('#namesList a.active');
        if(activeProjectLinks.length == 0) {
            clearProjects();
        }
    });



} else {

    [].forEach.call(links, function (link) {

        link.addEventListener('mouseenter', function () {
            activateProject(this);
        });

        link.addEventListener('mouseleave', function () {
            clearProjects();
        });
    });
}

docReady(function() {
    loadContentPage();
});

function clearProjects() {
    clearProject = setTimeout(function() {
        clearBodyColor();
        if(changeBodyColor != null) {
            clearTimeout(changeBodyColor);
        }
        clearShownImages();
    }, 100);
}

function activateProject(linkElm) {
    if (clearProject != null) {
        clearTimeout(clearProject);
    }
    var imageClass = linkElm.getAttribute('data-class');
    if (imageClass != null) {

        var projectElm = document.querySelector('.project.' + imageClass);

        if (projectElm != null) {
            clearKeepOpen();
            clearShownImages();
            projectElm.classList.add('show');
            if(changeBodyColor != null) {
                clearTimeout(changeBodyColor);
            }
            changeBodyColor = setTimeout(function() {
                clearBodyColor();
                var colorClass = projectElm.getAttribute('data-color');
                if(colorClass != null) {
                    document.body.classList.add(colorClass);
                }
            },1000);
        }
    }
}


/// SETUP MENU
for (var i = 0, len = menuButtons.length; i < len; i++) {
    menuButtons[i].addEventListener('click', function(){
        this.classList.toggle('is-active');
        if(menuContainers.length > 0) {
            var menuContainer = menuContainers[0];
            menuContainer.classList.toggle('is-active');
        }
    });
}

// SETUP OFF CANVAS
var canviElms = document.querySelectorAll('.canvi-navbar');
if(canviElms.length > 0) {
    var canviContent = new Canvi({
        content: '.canvi-content',
        navbar: '.canvi-navbar',
        position: 'right',
        pushContent: false,
        width: '90vw'
    });
}

// SETUP AJAX CONTENT CALLS

var canvasContent = document.getElementById('ajaxContentContainer');
document.querySelector('body').addEventListener('click', function(e) {
    var matches = event.target.matches ? event.target.matches('.ajaxContent') : event.target.msMatchesSelector('.ajaxContent');
    if (matches) {
        e.preventDefault();


        var linkElm = event.target;

        // Check if this was a project link to lock the project
        var dataClass = linkElm.getAttribute('data-class');
        if(dataClass != null) {
            var projectElm = document.querySelector('.project.' + dataClass);
            if (projectElm != null) {
                projectElm.classList.add('keepOpen');
            }
        }

        var linkUrl = linkElm.getAttribute('href');
        var linkTarget = linkElm.getAttribute('target');

        if(linkUrl != null) {
            if (linkTarget == null || linkTarget != '_blank') {

                loadAjaxContent(linkUrl);
                history.pushState('async|'+linkUrl, null, linkUrl);

            } else if (linkTarget != '_blank') {
                window.open(linkUrl);
            }
        }
    }
});

if(canvasContent != null) {
    canvasContent.addEventListener('click', function (e) {
        var matches = event.target.matches ? event.target.matches('.backButton') : event.target.msMatchesSelector('.backButton');
        if (matches) {
            e.preventDefault();
            canviContent.close();
        }
    });
}

window.addEventListener('popstate', function(e) {
    e.preventDefault();
    if(e.state != null) {
        var stateData = e.state.split('|');

        if(stateData[0] == 'async') {

            if(canvasContent != null) {
                if (stateData[1] != null) {
                    loadAjaxContent(stateData[1]);
                } else {
                    canviContent.close();
                    canvasContent.innerHTML = '';
                }
            } else {
                window.location = stateData[1];
            }
        } else {
            window.location = stateData[1];
        }
    } else {
        if(canvasContent != null) {
            canviContent.close();
            canvasContent.innerHTML = '';
        } else {
            window.location = '/';
        }
    }
});

/*document.querySelector('body').addEventListener('canvi.before-open', function(e) {
    console.log('Catch Canvi before-open event...');
})*/

// SETUP CONTENT PAGES

function loadContentPage() {

    Array.prototype.slice.call(document.querySelectorAll('.contentSlider')).forEach(function (element, index) {
        lory(element, {

        });
    });

    var floatingLabelInputs = document.querySelectorAll('.floatingLabel input, .floatingLabel textarea');
    for (var i = 0, len = floatingLabelInputs.length; i < len; i++) {
        var input = floatingLabelInputs[i];
        input.addEventListener("focus", function(e) {
            this.parentNode.classList.add('hasValue');
            this.parentNode.classList.add('hasFocus');
        });
        input.addEventListener("blur", function(e) {
            if (this.value.length == 0) {
                this.parentNode.classList.remove('hasValue');
            }
            this.parentNode.classList.remove('hasFocus');
        });
    }
    var fileInputs = document.querySelectorAll('input[type=file]');
    for (var i = 0, len = fileInputs.length; i < len; i++) {
        var input = fileInputs[i];
        input.addEventListener("change", function(e) {
            var fullPath = this.value;
            if (fullPath) {
                var startIndex = (fullPath.indexOf('\\') >= 0 ? fullPath.lastIndexOf('\\') : fullPath.lastIndexOf('/'));
                var filename = fullPath.substring(startIndex);
                if (filename.indexOf('\\') === 0 || filename.indexOf('/') === 0) {
                    filename = filename.substring(1);
                }
                var labelElement = this.parentNode.querySelector('label[for='+this.id+']');
                labelElement.innerHTML = filename;
            }
        });
    }

    document.addEventListener('input', function (event) {
        if (event.target.tagName.toLowerCase() !== 'textarea') return;
        autoExpand(event.target);
    }, false);

    var ajaxForms = document.querySelectorAll('form.ajaxForm');

    for (var i = 0, len = ajaxForms.length; i < len; i++) {
        var form = ajaxForms[i];
        if (!form.classList.contains('processed')) {
            form.classList.add('processed');
            var pristine = new Pristine(form);

            form.addEventListener("submit", function(e) {
                e.preventDefault();

                var formIsValid = pristine.validate();
                if (formIsValid) {
                    var form = e.target;
                    var inputs = form.querySelectorAll('input[type="file"]:not([disabled])')
                    inputs.forEach(function(input) {
                        if (input.files.length > 0) return
                        input.setAttribute('disabled', '')
                    })
                    var data = new FormData(form)
                    inputs.forEach(function(input) {
                        input.removeAttribute('disabled')
                    })
                    var submitButton = form.querySelector('button[type=submit]');
                    submitButton.classList.add('loading');

                    var request = new XMLHttpRequest()

                    request.onreadystatechange = function() {
                        if (request.readyState === 4 && request.status === 200) {
                            var thankYou = this.querySelector('div.succesMessage');
                            var formContainer = this.querySelector('div.formContainer');
                            if (thankYou != null && formContainer != null) {
                                formContainer.style.display = 'none';
                                thankYou.style.display = 'block';
                                thankYou.style.opacity = 1;
                            }
                        } else if (request.readyState === 4 && request.status > 200) {
                            var submitButton = this.querySelector('button[type=submit]');
                            submitButton.classList.remove('loading');
                        }
                    }.bind(form);

                    request.open(form.method, form.getAttribute('action'));
                    request.send(data);
                }
            })
        }
    }
}

function loadAjaxContent(linkUrl) {

    linkUrl = linkUrl+'?ajax=true';

    canvasContent.innerHTML = '';

    //RESET hamburgerMenu
    var menuContainer = menuContainers[0];
    menuContainer.classList.remove('is-active');
    for (var i = 0, len = menuButtons.length; i < len; i++) {
        menuButtons[i].classList.remove('is-active');
    }

    axios.get(linkUrl, {
        headers: {'X-Requested-With': 'XMLHttpRequest'}
    })
        .then(function (response) {
            canvasContent.innerHTML = response.data;
            Array.prototype.slice.call(document.querySelectorAll('.projectNavigation')).forEach(function (element, index) {
                setTimeout(function () {
                    this.classList.add('open');
                    loadContentPage();
                }.bind(element), 500);
            });
        })
        .catch(function (error) {
            alert('Er ging iets mis met het inladen van de content. Probeer het later nogmaals.')
            canviContent.close();
        })
        .then(function () {
            // always executed
        });

    var isOpen = document.querySelector('body').classList.contains('is-canvi-open');
    if (isOpen == false) {
        canviContent.open();
    }
}


function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function clearKeepOpen() {
    var shownImages = document.querySelectorAll('.project.keepOpen');
    [].forEach.call(shownImages, function (el) {
        el.classList.remove("keepOpen");
    });
}
function clearShownImages() {
    var shownImages = document.querySelectorAll('.project.show');
    [].forEach.call(shownImages, function (el) {
        el.classList.remove("show");
    });
}
function clearBodyColor() {
    document.body.classList.remove('pink');
    document.body.classList.remove('yellow');
    document.body.classList.remove('green');
    document.body.classList.remove('blue');
}

var autoExpand = function (field) {

    // Reset field height
    field.style.height = 'inherit';

    // Get the computed styles for the element
    var computed = window.getComputedStyle(field);

    // Calculate the height
    var height = parseInt(computed.getPropertyValue('border-top-width'), 10)
        + parseInt(computed.getPropertyValue('padding-top'), 10)
        + field.scrollHeight
        + parseInt(computed.getPropertyValue('padding-bottom'), 10)
        + parseInt(computed.getPropertyValue('border-bottom-width'), 10);

    field.style.height = height + 'px';

};