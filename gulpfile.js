const gulp = require('gulp');
const rollup = require('rollup').rollup;
const typescript = require('rollup-plugin-typescript')
const resolve = require('rollup-plugin-node-resolve');
const babel = require('rollup-plugin-babel');
const uglify = require('rollup-plugin-uglify');
// const uglify = require('uglify-js')
const pkg = require('./package.json');

const banner = `
/*!
 * ${pkg.name} v${pkg.version}
 * Licensed under the ${pkg.license} License.
 */`;

const footer = `window.Trace = new _Trace()`

const packRollup = (options) => {
  let plugins = [
    typescript(),
    typescript(),
    babel({
      exclude: 'node_modules/**'
    }),
  ];
  if (options.minify) plugins.push(uglify());

  return rollup({
    entry: "./src/index.ts",
    plugins,
  }).then((bundle) => {
    bundle.write({
      format: options.format,
      moduleName: "_Trace",
      dest: options.dest,
      banner,
      footer,
      sourceMap: true
    });
  })
}

gulp.task('production', () => {
  return packRollup({
    dest: './lib/trace.min.js',
    format: 'umd',
    minify: true
  })
});

gulp.task('dev', () => {
  return packRollup({
    dest: './lib/trace.js',
    format: 'umd'
  })
});

gulp.task('watch', () => {
  gulp.watch('./src/**/*.ts', ['dev', 'production']);
})

gulp.task('default', ['dev', 'production', 'watch']);
