var ngrok = require( 'ngrok' );
var host = require( 'autohost' );
var authProvider = require( 'autohost-nedb-auth' )( {} );
var daedalus;

var config;

function start() {
	try {
		host.init( {
			port: config.nonstop.ci.port,
			socketIO: true,
			origin: 'nonstop-ci',
			anonymous: [ '/api/commit' ]
		}, authProvider );
		daedalus.register( config.nonstop.ci.port, [ '0.1.0', 'nonstop', 'ci' ] );
		ngrok.connect( {
			port: config.nonstop.ci.port,
			authtoken: config.ngrok.token,
			subdomain: config.ngrok.subdomain
		}, function( err, url ) {
				if ( err ) {
					console.log( err, url );
				} else {
					var githubFsm = require( './github/fsm.js' );
				}
			} );
	} catch (err) {
		console.log( 'Starting server failed with', err.stack );
	}
}

function stop() {
	host.stop();
}

var wrapper = {
	auth: authProvider,
	start: start,
	stop: stop
};

module.exports = function( _config ) {
	config = _config;

	daedalus = require( 'daedalus' )( 'nonstop-ci', config.consul );

	return wrapper;
};
