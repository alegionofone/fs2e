// gulpfile.mjs — LESS → CSS pipeline for fs2e (Foundry v13)
import gulp from "gulp";
import less from "gulp-less";
import sourcemaps from "gulp-sourcemaps";
import cleanCSS from "gulp-clean-css";
import plumber from "gulp-plumber";

const paths = {
  entry: "styles/fs2e.less",
  watch: "styles/**/*.less",
  outDir: "styles"
};

// Dev build: sourcemaps, unminified (good for watching while you iterate)
function stylesDev() {
  return gulp
    .src(paths.entry, { allowEmpty: true })
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(less())
    .pipe(sourcemaps.write("."))
    .pipe(gulp.dest(paths.outDir));
}

// Prod build: minified, no sourcemaps (used by `npm run build`)
function stylesProd() {
  return gulp
    .src(paths.entry, { allowEmpty: true })
    .pipe(plumber())
    .pipe(less())
    .pipe(cleanCSS())
    .pipe(gulp.dest(paths.outDir));
}

// `gulp styles` (called by `npm run build`)
export const styles = stylesProd;

// `gulp watch` (called by `npm run watch`)
export const watch = gulp.series(stylesDev, function watcher() {
  return gulp.watch(paths.watch, stylesDev);
});

// default (optional): quick dev compile
export default stylesDev;
