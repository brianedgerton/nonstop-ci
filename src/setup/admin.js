var _ = require( "lodash" );
var when = require( "when" );
var sequence = require( "when/sequence" );
var server;
var auth;

function createAdmin() {

	return sequence( [ function() {
			return auth.createUser( "admin", "admin" );
		}, function() {
			return auth.createRole( "admin" );
		}, function() {
			return auth.createRole( "anonymous" );
		}, function() {
			return auth.changeUserRoles( "admin", [ "admin" ], "add" );
		}, function() {
			return when.promise( function( resolve ) {
				auth.getActions()
					.then( function( actions ) {
						when.all( _.map( actions, function( action ) {
							return auth.changeActionRoles( action.name, [ "admin" ], "add" );
						} ) ).then( resolve );
					} );
			} );
		}, function() {
			return auth.changeActionRoles( "commit.new", [ "anonymous" ], "add" );
		}
	] );

}

function hasAdmin() {
	return when.promise( function( resolve, reject ) {
		auth.getUsers()
			.then( function( list ) {
				var adminExists = _.any( list, function( user ) {
					return user.name === "admin";
				} );
				if ( adminExists ) {
					return resolve( true );
				} else {
					return reject( new Error( "No admin found." ) );
				}
			} );
	} );
}

module.exports = function( _server ) {
	server = _server;
	auth = server.auth;

	return {
		hasAdmin: hasAdmin,
		createAdmin: createAdmin
	};

};