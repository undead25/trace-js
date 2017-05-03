const gulp = require('gulp');
const rollup = require('rollup');
const typescript = require('rollup-plugin-typescript')
const resolve = require('rollup-plugin-node-resolve');
const babel = require('rollup-plugin-babel');
const uglify = require('rollup-plugin-uglify');
const pkg = require('./package.json');

const banner = `
/*!
 * ${pkg.name} v${pkg.version}
 * Licensed under the ${pkg.license} License.
 */`

gulp.task('production', () => {
  return rollup.rollup({
    entry: "./src/index.ts",
    plugins: [
      typescript(),
      resolve(),
      babel({
        exclude: 'node_modules/**'
      }),
      uglify()
    ],
  }).then((bundle) => {
    bundle.write({
      format: "umd",
      moduleName: "trace",
      dest: "./lib/trace.min.js",
      sourceMap: true
    });
  })
});

gulp.task('dev', () => {
  return rollup.rollup({
    entry: "./src/index.ts",
    plugins: [
      typescript(),
      resolve(),
      babel({
        exclude: 'node_modules/**'
      })
    ],
  }).then((bundle) => {
    bundle.write({
      format: "umd",
      moduleName: "trace",
      dest: "./lib/trace.js",
      sourceMap: true,
      banner
    });
  })
});

gulp.task('watch', () => {
  gulp.watch('./src/**/*.ts', ['dev', 'production']);
})

gulp.task('default', ['dev', 'production', 'watch']);
