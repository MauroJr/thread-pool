module.exports = function (payload, finish) {
  setTimeout(function () { finish(payload) }, 2000);
};
