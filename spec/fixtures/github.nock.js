var _ = require( "lodash" );
var qs = require( "querystring" );
var fs = require( "fs" );
var path = require( "path" );
var nock = require( "nock" );
var dir = __dirname;
var githubRoot = "https://api.github.com";
var GHAPI = require( "github" );
var HttpStatus = require( 'http-status-codes' );

var github = new GHAPI( {
	version: "3.0.0",
	debug: false,
	protocol: "https",
	host: "api.github.com",
	timeout: 10000
} );

var ghRoutes = github[ "3.0.0" ].routes;

var fixtures = _.reduce( fs.readdirSync( dir ), function( memo, file ) {
	var filepath = dir + "/" + file;
	var stats = fs.statSync( filepath );
	if ( stats.isFile() && path.extname( file ) === ".json" ) {
		var key = path.basename( file, ".json" );
		memo[ key ] = require( filepath );
	}
	return memo;
}, {} );

function objFindRecursive( obj, keys ) {
	var k = keys.shift();

	if ( k in obj ) {
		var val = obj[ k ];
		if ( keys.length > 0 ) {
			return objFindRecursive( val, keys );
		} else {
			return val;
		}
	} else {
		return undefined;
	}

}

function patchReply( scope ) {

	scope._reply = scope.reply;

	scope.reply = function( status, data, _headers ) {
		var headers = _headers || {};
		var statusString = status + " " + HttpStatus.getStatusText( status );
		headers = _.merge( headers, { status: statusString } );
		return this._reply( status, data, headers );
	};

	return scope;
}

function replyWithFixture( status, key, headers ) {
	var keys = key.split( ":" );
	var fixture = objFindRecursive( fixtures, keys );
	return this.reply( status, fixture, headers );
}

function setupRoute( scope, route, params, options ) {
	var method = route.method.toLowerCase();
	var url = setupUrl( route.url, params );
	return scope[ method ]( url, options );
}

function setupUrl( url, params ) {
	var toRemove = [];
	var split = _.map( url.split( "/" ), function( segment ) {
		if ( segment.charAt( 0 ) === ":" ) {
			var key = segment.slice( 1 );
			if ( params[ key ] ) {
				toRemove.push( key );
				return params[ key ];
			}
		}
		return segment;
	} );

	var urlStr = split.join( "/" );

	var query = _.pick( params, function( value, objKey ) {
		return !_.contains( toRemove, objKey );
	} );

	if ( _.isEmpty( query ) ) {
		return urlStr;
	} else {
		return urlStr + "?" + qs.stringify( query );
	}

}

var api = {

	nock: nock,

	fixtures: fixtures,

	github: function( key, params, options ) {

		var keys = key.split( ":" );
		var route = objFindRecursive( ghRoutes, keys );

		var scope = nock( githubRoot );
		// .defaultReplyHeaders({
		// 	"x-ratelimit-limit": 5000,
		// 	"x-ratelimit-remaining": 4999
		// });

		scope = setupRoute( scope, route, params, options );

		scope = patchReply( scope );

		scope.replyWithFixture = replyWithFixture;

		return scope;
	},

	reset: function() {
		nock.cleanAll();
	}

};

module.exports = api;
