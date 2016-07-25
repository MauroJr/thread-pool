# thread-pool

thread-pool is a simple thread pool manager for Node.js. It allows you to create
a waiting pool of independent OS processes, each running Node.js, to which
you can assign tasks, using promises to handle the completion of those tasks.

## Usage

Import the `Pool` class and create a new pool, optionally passing in a pool
size. If you don't specify a size, the pool will default to giving you 5
threads.

```javascript
import { Pool } from 'thread-pool';

const pool = new Pool(5);
```

You now have 5 asynchronous Node.js processes ready to handle your heavy tasks.

When you are ready to pass a task off to one of these threads, use
`pool.assign`:

```javascript
pool.assign({
  task: (payload, finish, err) => {
    setTimeout(() => finish('I processed ' + payload), 3000);
  },
  payload: 'foo',
  timeout: 10000
})
.then(data => console.log('Success!', data))
.catch(data => console.log('Failure!', data));
```

The `assign` method should be handed an object with three keys – `task`,
`payload`, and `timeout`. The `task` key determines the actual task to be
accomplished. The `payload` key determines the data that should be processed
within that task. The `timeout` key, which is optional, gives your task a
certain amount of time to finish. If it doesn't finish in that time, it is
automatically killed.

In this example, we've passed an actual function in for the `task` key. Its
three arguments denote the payload (as defined in the `payload` key), a
`finish` function which is to be called when the thread has finished its task,
and an `err` function which is to be called when you want to manually shut
down the thread from the inside. The `finish` function takes a single data
argument that will be passed back to the main thread.

As shown in the example, `assign` returns a Promise object which resolves upon
successful completion of the task, and rejects whenever there was a problem.

When you call the `assign` method, thread-pool picks an idle thread and assigns
the task to that thread. If no threads are currently idle, your task will be
queued up to be executed as soon as one of the threads finishes its current
task. All of this is logged to the console so that you can determine whether
or not your pool size is correct.

Of course, it's less likely that you'll want to pass an actual function to
your pool and more likely that you'll want to tell it to execute a file. In
that case, simply pass in the path to your file instead of a function:

```javascript
pool.assign({
  task: './example-task',
  payload: 'foo'
})
.then(data => console.log('Success!', data))
.catch(data => console.log('Failure!', data));
```

Because thread-pool gives you Node.js processes, your task files should be
standard JS files. They will be `required` in to your thread upon execution and
will have access to your whole project directory as normal. The only stipulation
is that your `task` file needs to export a single function taking the `payload`,
`finish`, and `err` parameters. This will allow you to properly interface with
thread-pool. Like so:

```javascript
// example-task.js

import { whatever } from 'wherever';

export default function (payload, finish, err) {
  finish(`You sent me the payload ${payload}.`);
};
```

Behind the scenes, thread-pool will cache these tasks so that they will not
have to be read in every time they are used.

## What happens when there's an error?

Certain kinds of errors will result in a terminated thread. Also, if you call
the `err` function anywhere within your task, the thread will be terminated.
If that happens, obviously your task won't be completed. This is just
JavaScript, after all. However, if a thread dies, a new thread will be generated
in its place automatically. It won't be able to pick up where the old thread
left off, but it will be able to grab any queued up tasks and start running
with them.

Don't forget that you have `Promise#catch` that you can use to catch any error
that might result in your thread dying.

## Shutting Down a Pool

If you are done with your pool, you don't have to leave threads alive with
no purpose forever. Just call `pool.killAll()`. By calling this function,
every thread will be terminated immediately, whether or not their tasks have
been completed.

## Re-Initializing a Pool

If a pool has been shut down, you can bring it back to life by calling
`pool.up()`. Calling this function while a pool is still alive will not hurt
anything. It will simply make sure that there are live threads generated to
fill the size of your thread pool. So if no threads are alive, all of them
will be generated. If, somehow, one thread had permanently died, only one thread
would be generated. If all threads are alive, nothing happens.

## Considerations for ES6/7, TypeScript, CoffeeScript, etc.

If you are using a tool like Babel (or whatever) to compile your cutting-edge
JS dialect, keep in mind that your compiler can not automatically be applied to
threads in the pool. As such, this should not cause problems as long as your
thread tasks are already pre-processed in such a way that all dialect-centric
libraries and polyfills have been included in them, and all the files they
import are also already pre-processed.

However, if you were to import an unprocessed file that employed a non-native
technique, your thread would likely throw an error and die.

## Context Considerations

If you pass in a function rather than a file for your thread task, keep in mind
that the function has to be stringified, passed to a new thread, and then
re-evaluated. As such, it will not have access to any context from within the
main thread, including any reference to `this` within the main thread, closure
variables, etc.
