# thread-pool (BETA)

thread-pool is a simple thread pool manager for Node.js. (Currently in Beta)

It allows you to create a waiting pool of independent OS processes (threads),
each running Node.js, to which you can assign tasks and use promises to handle
the completion of those tasks.

## Usage

### Creating a Thread Pool

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
  task: (handler) => {
    setTimeout(() => handler.finish('I processed ' + handler.init), 3000);
  },
  init: 'foo',
  timeout: 10000
})
.then(data => console.log('Success!', data))
.catch(data => console.log('Failure!', data));
```

The `assign` method should be handed an object with three keys – `task`,
`init`, and `timeout`. The `task` key determines the actual task to be
accomplished. The `init` key determines the data that should be processed
within that task. The `timeout` key, which is optional, gives your task a
certain amount of time to finish. If it doesn't finish in that time, it is
automatically killed.

In this example, we've passed an actual function in for the `task` key. It
takes a single argument denoting an instance of a `Handler` class that
allows you to "handle" things on the thread. Here's what you get with
the `handler`:

1. `handler.init` - The data that was passed in via the `init` key in `pool.assign`.
2. `handler.finish` - A function to call when the thread has finished executing the task you assigned to it. It takes a single argument containing data to send back to the main thread.
3. `handler.err` - A function to be called when you want to manually shut down the thread from the inside.
4. `handler.send` - A function to be called when you want to send a message to the main thread. It takes a single argument containing data to send back to the main thread.

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
  init: 'foo'
})
.then(data => console.log('Success!', data))
.catch(data => console.log('Failure!', data));
```

Because thread-pool gives you Node.js processes, your task files should be
JS files. They will be `required` into your thread upon execution and
will have access to your whole project directory as normal. The only stipulation
is that your `task` file needs to export a single function taking the `handler`,
parameter. This will allow you to properly interface with
thread-pool. Like so:

```javascript
// example-task.js

import { whatever } from 'wherever';

export default function (handler) {
  handler.finish(`You sent me the payload ${handler.init}.`);
};
```

Behind the scenes, thread-pool will cache these tasks so that they will not
have to be read in every time they are used.

### Messaging

From the main application thread, you'll always treat your pool as a cohesive unit.
In other words, you won't be able to target a specific thread and tell it to take
any particular action once a task has been assigned to it.

**HOWEVER...**

Tasks being executed within the pool **_can_** pass messages back to the main thread
and, when that happens, the main thread **_can_** reply to those messages. Let's
start by looking at an example task file:

```javascript
// example-task.js

export default function (handler) {
  handler.send('Hello from one of the threads in your pool.')
         .onReply(data => {
           console.log('Parent replied with:', data);
         });
};
```

Whenever we want to send a message to the main thread, we'll use `handler.send`
and pass in whatever serializable data we want. If we're expecting a reply back
from the main thread, we can trap it with a subsequent call to `onReply`.

Now let's take a look at the main thread:

```javascript
import { Pool } from 'thread-pool';

const pool = new Pool();

pool.onMessage((data, reply) => {
  console.log('Pool sent me:', data);
  reply('Hello to you too.');
});

pool.assign({ task: './example-task' });
```

We can trap all incoming messages from the pool by calling `pool.onMessage`. The
message handler we pass to this method accepts two arguments denoting (first)
the data that came through and (second) a reply function. By calling the reply
function, we can pass data back as a response to this specific message.

A nice convention might be to pass along an object containing both a message
type as well as any other necessary data, then set up an `onMessage` handler
that routes messages to appropriate processes. For example...

**Inside a task file...**
```javascript
handler.send({
  type: 'FOO',
  data: { ... }
});

handler.send({
  type: 'BAR',
  data: { ... }
});
```

**Inside the main application...**
```javascript
pool.onMessage((data, reply) => {
  switch (data.type) {
    case 'FOO' : return reply(something(data.data));
    case 'BAR' : return reply(somethingElse(data.data));
    default    : throw new Error('Bad message type.');
  }
});
```

## What happens when there's an error inside a thread?

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
threads in the pool and these threads will not have access to in-memory code
held by the main thread.

As such, this should not cause problems as long as your thread tasks are already
pre-processed in such a way that all dialect-specific libraries and polyfills
have been included in them, and all the files they import are also already
pre-processed.

To illustrate a little more clearly, JS processors often work like this:

1. Gather all files to be compiled together.
2. Inject dialect-specific dependency code ONCE, at the top of the output.
3. Generate code for imports and exports ONCE, at the top of the output.
4. Process and concatenate files as necessary.
5. Write the output.

Because processors try really hard not to be wasteful, you could easily end
up with task files that rely upon dialect-specific dependency code that isn't
actually written in those files. Then, when an independent process attempts to
execute that task, it won't have access to that code. So, to avoid this, simply
make sure that your task files are processed independently of the rest of your
application.

## Context Considerations

If you pass in a function rather than a file for your thread task, keep in mind
that the function has to be stringified, passed to a new thread, and then
re-evaluated. As such, it will not have access to any context from within the
main thread, including any reference to `this` within the main thread, closure
variables, etc.
