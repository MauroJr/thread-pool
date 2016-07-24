// Test everything.

var Pool = require('../bin/index').Pool;

var pool = new Pool(5);

function go() {
  for (var i = 1; i < 16; i += 1) {
    pool.assign({
      task: (i % 2 === 0 ? function(payload,finish){setTimeout(function(){finish(payload)},3000)}
                         : function(payload,finish){setTimeout(function(){finish(payload)},1000)}),
      // task: './test/example-task',
      payload: i,
      timeout: 2000
    })
    .then(function (data) { console.log('finished with', data) })
    .catch(function (data) { console.log('DIED') });
  }
}

go();

// setTimeout(function () {
//   pool.killAll();
// }, 6000);
//
// setTimeout(function () {
//   pool.up();
// }, 8000);
