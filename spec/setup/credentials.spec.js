var should = require( "should" );
var when = require( "when" );
var sinon = require( "sinon" );
var credFactory = require( "../../src/setup/credentials.js" );
var server;
var auth;
var credentials;

describe( "Credentials Setup", function() {

	before( function() {
		auth = {
			createRole: sinon.stub().returns( when( true ) ),
			createUser: sinon.stub().returns( when( true ) ),
			changeUserRoles: sinon.stub().returns( when( true ) ),
			createToken: sinon.stub().returns( when( true ) ),
			changeActionRoles: sinon.stub().returns( when( true ) )
		};
		server = {
			auth: auth
		};

		credentials = credFactory( server );
	} );

	describe( "when creating credentials", function() {
		var creds = { user: "frosty the snowman", password: "test123" };
		var request;
		before( function() {
			request = credentials.createCredentials( creds );
		} );

		it( "should create the proper role", function() {
			auth.createRole.getCall( 0 ).args[ 0 ].should.equal( "agent" );
		} );

		it( "should create the proper user", function() {
			auth.createUser.getCall( 0 ).args.should.eql( [ creds.user, creds.password ] );
		} );

		it( "should update the new user's role", function() {
			auth.changeUserRoles.getCall( 0 ).args.should.eql( [
				creds.user,
				[ "agent" ],
				"add"
			] );
		} );

		it( "should create a token for that user", function() {
			var args = auth.createToken.getCall( 0 ).args;
			args[ 0 ].should.equal( creds.user );
			args[ 1 ].length.should.equal( 36 );
		} );

		it( "should create action roles for the new user", function() {
			auth.changeActionRoles.calledThrice.should.be.ok;
			var args1 = auth.changeActionRoles.getCall( 0 ).args;
			var args2 = auth.changeActionRoles.getCall( 1 ).args;
			var args3 = auth.changeActionRoles.getCall( 2 ).args;

			args1.should.eql( [
				"agent.register",
				[ "agent" ],
				"add"
			] );

			args2.should.eql( [
				"agent.get-build",
				[ "agent" ],
				"add"
			] );

			args3.should.eql( [
				"agent.set-build",
				[ "agent" ],
				"add"
			] );

		} );

		it( "should return the created token", function( done ) {
			request.then( function( token ) {
				token.length.should.equal( 36 );
				done();
			} );
		} );

	} );

} );