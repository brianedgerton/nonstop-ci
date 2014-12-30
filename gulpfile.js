var processhost = require( "processhost" )();
var gulp = require( "gulp" );
var mocha = require( "gulp-mocha" );
var istanbul = require( "gulp-istanbul" );
var jshint = require( "gulp-jshint" );
var open = require( "open" ); //jshint ignore:line
var testFiles = "./spec/**/*.spec.js";

gulp.task( "test", function( done ) {
	gulp.src( testFiles )
		.pipe( mocha( {
			reporter: "spec"
		} ) )
		.on( "error", function( err ) {
			console.log( err.stack );
		} )
		.on( "end", function() {
			// setTimeout( function() {
			// 	console.log( process._getActiveRequests() );
			// 	console.log( process._getActiveHandles() );
			// }, 2000 );
			done();
		} );
} );

gulp.task( "watch", [ "test" ], function() {
	gulp.watch( [ testFiles, "./src/**" ], [ "test" ] );
} );

gulp.task( "coverage", function( cb ) {
	gulp.src( [ "./src/**/*.js" ] )
		.pipe( istanbul() ) // Covering files
		.pipe( istanbul.hookRequire() ) // Force `require` to return covered files
		.on( "finish", function() {
			gulp.src( testFiles )
				.pipe( mocha() )
				.pipe( istanbul.writeReports() ) // Creating the reports after tests runned
				.on( "end", function() {
					open( "./coverage/lcov-report/index.html" );
					cb();
				} );
		} );
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