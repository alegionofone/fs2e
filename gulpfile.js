const gulp = require('gulp');
const less = require('gulp-less');
const path = require('path');

// Compile LESS to CSS
function styles() {
  return gulp.src('./styles/fs2e.less')
    .pipe(less({ paths: [ path.join(__dirname, 'styles') ] }))
    .pipe(gulp.dest('./styles'));
}

gulp.task('styles', styles);
gulp.task('default', gulp.series('styles'));
