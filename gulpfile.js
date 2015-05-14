var gulp = require( "gulp" ),
	bg = require( "biggulp" )( gulp ),
	processhost = require( "processhost" )(),
	jshint = require( "gulp-jshint" );

gulp.task( "default", [ "continuous-test", "watch" ] );

gulp.task( "test", function() {
	return bg.testOnce();
} );

gulp.task( "coverage", bg.showCoverage() );

gulp.task( "continuous-test", bg.withCoverage() );

gulp.task( "watch", function() {
	return bg.watch( [ "continuous-test" ] );
} );

gulp.task( "lint", function() {
	return gulp.src( [ "./src/**/*.js", "./spec/**/*.js" ] )
		.pipe( jshint() )
		.pipe( jshint.reporter( "jshint-stylish" ) );
} );

gulp.task( "start", function() {
	processhost.start( "server", {
		command: "node",
		args: [ "./src/index.js" ],
		stdio: "inherit",
		restart: true
	} );
} );

gulp.task( "docker:build", function() {
	var spawn = require( "child_process" ).spawn;
	var pkg = require( "./package.json" );

	var version = pkg.version;
	var name = pkg.docker.name || pkg.name;
	var org = pkg.docker.org;

	var tag = org + "/" + name + ":" + version;

	var child = spawn( "docker", [ "build", "-t", tag, "." ], {
		stdio: "inherit"
	} );

	return child;
} );
