// Test everything.

var Pool = require('../bin/index').Pool;

var pool = new Pool(5);

function go() {
  for (var i = 1; i < 16; i += 1) {
    pool.assign({
      // task: (i % 2 === 0 ? function(handler){setTimeout(function(){handler.finish(handler.init)},3000)}
      //                    : function(handler){setTimeout(function(){handler.finish(handler.init)},1000)}),
      task: './test/example-task',
      init: i,
      //timeout: 2000
    })
    .then(function (data) { console.log('finished with', data) })
    .catch(function (data) { console.log('DIED') });
  }
}

pool.onMessage(function (data, reply) {
  reply(data);
});

go();

// setTimeout(function () {
//   pool.killAll();
// }, 6000);
//
// setTimeout(function () {
//   pool.up();
// }, 8000);
