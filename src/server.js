var ngrok = require( 'ngrok' );
var host = require( 'autohost' );
var _ = require( 'lodash' );
var authProvider = require( 'autohost-nedb-auth' )( {} );
var debug = require( 'debug' )( 'nonstop:server' );
var daedalus;
var server;
var config;
var api;

function start() {
	try {
		server = host( {
			port: config.nonstop.ci.port,
			socketIO: true,
			origin: 'nonstop-ci',
			anonymous: [ '/api/commit' ]
		}, authProvider );
		server.start();

		server.fount.register( 'github', api );

		if ( daedalus ) {
			daedalus.register( config.nonstop.ci.port, [ '0-1-0', 'nonstop', 'ci' ] );
		}

		ngrok.connect( {
			port: config.nonstop.ci.port,
			authtoken: config.ngrok.token,
			subdomain: config.ngrok.subdomain
		}, function( err, url ) {
			if ( err ) {
				console.log( err, url );
			} else {
				debug( "ngrok connected with url %s", url );
				var githubFsm = require( './github/main.fsm.js' );
			}
		} );
	} catch (err) {
		console.log( 'Starting server failed with', err.stack );
	}
}

function stop() {
	server.stop();
}

var wrapper = {
	auth: authProvider,
	start: start,
	stop: stop
};

module.exports = function( _config, _api ) {
	config = _config;
	api = _api;

	if ( config.consul === true || !_.isEmpty( config.consul ) ) {
		if ( config.consul === true ) {
			config.consul = {};
		}
		daedalus = require( 'daedalus' )( 'nonstop-ci', config.consul );
	}

	return wrapper;
};
