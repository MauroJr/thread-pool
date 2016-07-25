module.exports = function (handler) {
  handler.send('Hello there').onReply(function (data) {
    console.log('Got reply from main thread', data);
  });
  setTimeout(function () {
    handler.finish(handler.init);
  }, 2000);
};
