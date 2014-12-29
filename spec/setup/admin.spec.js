var should = require( "should" );
var when = require( "when" );
var sinon = require( "sinon" );
var adminFactory = require( "../../src/setup/admin.js" );
var server;
var auth;
var admin;

describe( "Admin Setup", function() {

	before( function() {
		auth = {
			createRole: sinon.stub().returns( when( true ) ),
			createUser: sinon.stub().returns( when( true ) ),
			changeUserRoles: sinon.stub().returns( when( true ) ),
			changeActionRoles: sinon.stub().returns( when( true ) ),
			getUsers: sinon.stub().returns( when( [] ) ),
			getActions: sinon.stub().returns( when( [
				{ name: "create.all" },
				{ name: "delete.all" }
			] ) )
		};
		server = {
			auth: auth
		};

		admin = adminFactory( server );
	} );

	describe( "when creating an admin", function() {
		var request;
		before( function() {
			request = admin.createAdmin();
		} );

		it( "should create the user object", function() {
			auth.createUser.getCall( 0 ).args.should.eql( [ "admin", "admin" ] );
		} );

		it( "should create the admin role", function() {
			auth.createRole.getCall( 0 ).args.should.eql( [ "admin" ] );
		} );

		it( "should create an anonymous role", function() {
			auth.createRole.getCall( 1 ).args.should.eql( [ "anonymous" ] );
		} );

		it( "should add the admin's role", function() {
			auth.changeUserRoles.getCall( 0 ).args.should.eql( [ "admin", [ "admin" ], "add" ] );
		} );

		it( "should add all action roles to admin", function() {
			auth.changeActionRoles.getCall( 0 ).args.should.eql( [ "create.all", [ "admin" ], "add" ] );
			auth.changeActionRoles.getCall( 1 ).args.should.eql( [ "delete.all", [ "admin" ], "add" ] );
			auth.changeActionRoles.getCall( 2 ).args.should.eql( [ "commit.new", [ "anonymous" ], "add" ] );
		} );

	} );

	describe( "when checking to see if admin exists", function() {
		it( "should error if user does not exist", function( done ) {
			admin.hasAdmin()
				.catch( function( err ) {
					err.should.be.an.Error;
					done();
				} );
		} );

		it( "should return true if an admin does exist", function( done ) {
			auth.getUsers.returns( when( [ { name: "admin" } ] ) );
			admin.hasAdmin()
				.then( function( result ) {
					result.should.be.ok;
					auth.getUsers.returns( when( [] ) );
					done();
				} );
		} );
	} );

} );