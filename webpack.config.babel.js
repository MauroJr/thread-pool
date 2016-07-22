export default {
  context: __dirname + "/src",
  entry: "./index.js",
  output: {
    filename: "index.js",
    path: __dirname + "/bin",
    libraryTarget: 'umd',
    library: 'simple-scheduler',
    umdNamedDefine: true
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loaders: ["babel-loader"],
      }
    ],
  }
};
