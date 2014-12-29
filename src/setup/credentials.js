var _ = require( "lodash" );
var uuid = require( "node-uuid" );
var when = require( "when" );
var sequence = require( "when/sequence" );
var server;
var auth;

function createCredentials( credentials ) {
	var role = "agent";
	var token = uuid.v4();
	var agentActions = [ "agent.register", "agent.get-build", "agent.set-build" ];
	var list = [ function() {
			return auth.createRole( role );
		}, function() {
			return auth.createUser( credentials.user, credentials.password );
		}, function() {
			return auth.changeUserRoles( credentials.user, [ role ], "add" );
		}, function() {
			return auth.createToken( credentials.user, token );
		}
	];
	var setRoles = _.map( agentActions, function( action ) {
		return function() {
			return auth.changeActionRoles( action, [ role ], "add" );
		};
	} );
	list = list.concat( setRoles );

	return when.promise( function( resolve, reject ) {
		sequence( list )
			.then( function() {
				resolve( token );
			} );
	} );
}

module.exports = function( _server ) {

	server = _server;
	auth = server.auth;

	return {
		createCredentials: createCredentials
	};

};