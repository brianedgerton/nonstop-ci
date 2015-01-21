var _ = require( "lodash" );
var should = require( "should" );
var when = require( "when" );
var sinon = require( "sinon" );

var config;
var server;
var deps;
var boot;

var emptyConfig = { server: { auth: {} } };

function patchTransition( fsm ) {
	fsm.transitionForReal = _.clone( fsm.transition );
	fsm.transition = sinon.stub( fsm, "transition" );
}

function getApp( config ) {
	var app = boot( config );
	patchTransition( app );
	return app;
}

function createConfig( cfg ) {
	return _.merge( _.clone( emptyConfig ), cfg );
}

describe( "Boot FSM", function() {

	before( function() {
		config = require( "../src/config.js" );
		server = require( "../src/server.js" )( config );
		deps = {
			api: require( "../src/github/api.js" )( config ),
			server: server,
			prompt: require( "../src/setup/prompt.js" ),
			admin: require( "../src/setup/admin.js" )( server ),
			credentials: require( "../src/setup/credentials" )( server )
		};

		boot = require( "../src/boot.js" );
	} );

	describe( "when starting", function() {

		it( "should start out by checking for admin", function() {
			var app = getApp( emptyConfig );
			app.go();

			app.transition.getCall( 0 ).args[ 0 ].should.equal( "checkingForAdmin" );

		} );

	} );

	describe( "when checking for admin", function() {
		describe( "when an admin is found", function() {
			it( "should transition to the next stage", function( done ) {
				var cfg = createConfig( { admin: deps.admin } );
				cfg.admin.hasAdmin = sinon.stub( cfg.admin, "hasAdmin" ).returns( when( true ) );
				var app = getApp( cfg );

				app.transitionForReal( "checkingForAdmin" );

				_.defer( function() {
					app.transition.getCall( 0 ).args[ 0 ].should.equal( "checkingParameters" );
					cfg.admin.hasAdmin.restore();
					done();
				} );
			} );
		} );

		describe( "when an admin is not found", function() {
			it( "should transition to creating one", function( done ) {
				var cfg = createConfig( { admin: deps.admin } );
				cfg.admin.hasAdmin = sinon.stub( cfg.admin, "hasAdmin" ).returns( when.reject( new Error() ) );
				var app = getApp( cfg );

				app.transitionForReal( "checkingForAdmin" );

				_.defer( function() {
					app.transition.getCall( 0 ).args[ 0 ].should.equal( "createAdmin" );
					cfg.admin.hasAdmin.restore();
					done();
				} );
			} );
		} );
	} );

	describe( "when creating an admin", function() {
		var cfg;
		var clock;
		var app;
		before( function() {
			clock = sinon.useFakeTimers();
			cfg = createConfig( {
				admin: deps.admin,
				server: {
					start: sinon.stub(),
					stop: sinon.stub()
				}
			} );
			cfg.admin.createAdmin = sinon.stub( cfg.admin, "createAdmin" ).returns( when( true ) );
			app = getApp( cfg );

			app.transitionForReal( "createAdmin" );
		} );

		after( function() {
			clock.restore();
			cfg.admin.createAdmin.restore();
		} );

		it( "should start the server", function() {
			cfg.server.start.called.should.be.ok;
		} );

		it( "should wait 5 seconds before creating the admin and stopping the server", function( done ) {
			clock.tick( 4000 );
			cfg.admin.createAdmin.called.should.not.be.ok;

			clock.tick( 1001 );
			cfg.admin.createAdmin.called.should.be.ok;

			_.defer( function() {
				app.transition.getCall( 0 ).args[ 0 ].should.equal( "checkingParameters" );
				cfg.server.stop.called.should.be.ok;
				done();
			} );
		} );

	} );

	describe( "when checking parameters", function() {
		it( "should transition directly to start if prompt parameter is set", function() {
			var cfg = createConfig( { prompt: { start: true } } );
			var app = getApp( cfg );

			app.transitionForReal( "checkingParameters" );
			app.transition.getCall( 0 ).args[ 0 ].should.equal( "start" );
		} );

		it( "should transition to prompt if prompt start parameter is not set", function() {
			var cfg = createConfig( { prompt: {} } );
			var app = getApp( cfg );

			app.transitionForReal( "checkingParameters" );
			app.transition.getCall( 0 ).args[ 0 ].should.equal( "prompt" );
		} );
	} );

	describe( "when starting", function() {
		it( "should start the given server", function() {
			var cfg = createConfig( { server: { start: sinon.stub() } } );
			var app = getApp( cfg );

			app.transitionForReal( "start" );
			cfg.server.start.called.should.be.ok;
		} );
	} );

	describe( "when getting an agent token", function() {
		it( "should use the server auth to retrieve the tokens", function( done ) {
			var cfg = createConfig( {
				server: {
					auth: {
						getTokens: sinon.stub().returns( when( true ) )
					}
				}
			} );

			var app = getApp( cfg );

			app.transitionForReal( "agentToken" );

			_.defer( function() {
				cfg.server.auth.getTokens.getCall( 0 ).args[ 0 ].should.equal( "agent" );
				app.transition.getCall( 0 ).args[ 0 ].should.equal( "prompt" );
				done();
			} );
		} );

	} );

	describe( "when creating credentials", function() {
		it( "should use the credentials setup module", function( done ) {
			var someCredentials = { user: "Craig", password: "test123" };

			var credentialsMethod = sinon.stub( deps.prompt, "credentials" ).callsArgWith( 0, someCredentials );
			var createCredentials = sinon.stub( deps.credentials, "createCredentials" ).returns( when( "something" ) );
			var cfg = createConfig( {
				prompt: deps.prompt,
				credentials: deps.credentials
			} );

			var app = getApp( cfg );

			app.transitionForReal( "createCredentials" );

			_.defer( function() {

				createCredentials.getCall( 0 ).args[ 0 ].should.eql( someCredentials );
				credentialsMethod.restore();
				createCredentials.restore();

				done();
			} );

		} );
	} );

	describe( "when changing the admin password", function() {
		describe( "when providing matching passwords", function() {
			it( "should use the auth object to change properly", function( done ) {
				var passwords = { nextPassword: "test123", confirmPassword: "test123" };
				var passPrompt = sinon.stub( deps.prompt, "admin" ).callsArgWith( 0, passwords );
				var changePass = sinon.stub( deps.server.auth, "changePassword" ).returns( when( {} ) );

				var cfg = createConfig( {
					prompt: deps.prompt,
					server: deps.server
				} );

				var app = getApp( cfg );

				app.transitionForReal( "adminPassword" );

				_.defer( function() {
					changePass.getCall( 0 ).args.should.eql( [ "admin", passwords.nextPassword ] );
					passPrompt.restore();
					changePass.restore();

					app.transition.lastCall.args[ 0 ].should.equal( "prompt" );
					done();
				} );

			} );
		} );

		describe( "when providing mismatched passwords", function() {
			it( "should revert back to the prompt state", function( done ) {
				var passwords = { nextPassword: "test123", confirmPassword: "nope" };
				var passPrompt = sinon.stub( deps.prompt, "admin" ).callsArgWith( 0, passwords );
				var changePass = sinon.stub( deps.server.auth, "changePassword" ).returns( when( {} ) );

				var cfg = createConfig( {
					prompt: deps.prompt,
					server: deps.server
				} );

				var app = getApp( cfg );

				app.transitionForReal( "adminPassword" );

				_.defer( function() {
					changePass.called.should.not.be.ok;
					passPrompt.restore();
					changePass.restore();
					app.transition.lastCall.args[ 0 ].should.equal( "prompt" );
					done();
				} );
			} );
		} );

	} );

	describe( "when creating a token", function() {
		describe( "when only basic authentication is needed", function() {
			it( "should pass the credentials to the github api", function( done ) {
				var creds = { user: "myuser", password: "mypass" };
				var tokenPrompt = sinon.stub( deps.prompt, "token" ).callsArgWith( 0, creds );
				var createToken = sinon.stub( deps.api, "createToken" ).callsArgWith( 2, null, "sometoken" );

				var cfg = createConfig( {
					prompt: deps.prompt,
					api: deps.api
				} );

				var app = getApp( cfg );

				app.transitionForReal( "createToken" );

				_.defer( function() {
					createToken.getCall( 0 ).args[ 0 ].should.equal( "myuser" );
					tokenPrompt.restore();
					createToken.restore();
					app.transition.lastCall.args[ 0 ].should.equal( "prompt" );
					done();
				} );
			} );

			it( "should fail if an error happens", function( done ) {
				var creds = { user: "myuser", password: "mypass" };
				var tokenPrompt = sinon.stub( deps.prompt, "token" ).callsArgWith( 0, creds );
				var createToken = sinon.stub( deps.api, "createToken" ).callsArgWith( 2, new Error( "Uh oh" ) );

				var cfg = createConfig( {
					prompt: deps.prompt,
					api: deps.api
				} );

				var app = getApp( cfg );

				var fail = sinon.spy( app.states.createToken, "token.failed" );

				app.transitionForReal( "createToken" );

				_.defer( function() {
					fail.called.should.be.ok;
					tokenPrompt.restore();
					createToken.restore();
					app.transition.lastCall.args[ 0 ].should.equal( "prompt" );
					done();
				} );
			} );
		} );

		describe( "when two-factor authentication is necessary", function() {
			it( "should prompt for the auth code", function( done ) {
				var creds = { user: "myuser", password: "mypass" };
				var tokenResult = { token: "someauthtoken" };
				var tokenPrompt = sinon.stub( deps.prompt, "token" ).callsArgWith( 0, creds );
				var twoFactorPrompt = sinon.stub( deps.prompt, "twoFactor" ).callsArgWith( 0, tokenResult );
				var e = new Error( "2 Factor" );
				e.code = 401;
				var createToken = sinon.stub( deps.api, "createToken" );

				createToken.withArgs( creds.user, {} ).callsArgWith( 2, e );
				createToken.withArgs( creds.user, { twoFactorToken: tokenResult.token } ).callsArgWith( 2, null, "someauthtoken" );


				var cfg = createConfig( {
					prompt: deps.prompt,
					api: deps.api
				} );

				var app = getApp( cfg );

				app.transitionForReal( "createToken" );

				_.defer( function() {
					var args = createToken.lastCall.args;
					args[ 0 ].should.equal( "myuser" );
					args[ 1 ].should.eql( { twoFactorToken: tokenResult.token } );
					twoFactorPrompt.restore();
					tokenPrompt.restore();
					createToken.restore();
					app.transition.lastCall.args[ 0 ].should.equal( "prompt" );
					done();
				} );
			} );
		} );
	} );


} );
