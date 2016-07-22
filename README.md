# simple-scheduler

simple-scheduler is a tiny module for queuing up asynchronous actions. As long
as there is at least 1 action queued, it will run automatically within another
run loop. However, if there are no actions queued, there is no perpetual
timer running, looking for queued actions.

## Usage

Import the `Scheduler` class and create a new scheduler. Each scheduler
instance will keep its own queue of actions to run.

```javascript
import { Scheduler } from 'simple-scheduler';

const scheduler = new Scheduler();
```

Next, queue up a function to run asynchronously. If you'd like to do something
after the function runs, use the returned Promise object.

```javascript
scheduler.queue(() => return 4)
         .then(result => console.log(result));
// Asynchronously logs 4 to the console.
```

That's essentially all there is to it. If you are crazy and don't like to use
tools how they are intended (or if you have an edge case that requires)
something like this, you also have access to 2 functions allowing you to
view a schedule and replace a schedule respectively:

```javascript
import { getSchedule, setSchedule } from 'simple-scheduler';

let mySchedule = getSchedule(scheduler);

console.log(mySchedule);

schedule.splice(2, 1)

setSchedule(sheduler, mySchedule);
```
