import gulp from 'gulp';
import gutil from 'gulp-util';
import sequence from 'run-sequence';
import babel from 'gulp-babel';

gulp.task('build', () => {
  return gulp.src('src/**/*.js')
    .pipe(babel())
    .pipe(gulp.dest('bin'));
});
