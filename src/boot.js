var machina = require( "machina" );

module.exports = function( deps ) {
	var server = deps.server;
	var api = deps.api;
	var prompt = deps.prompt;
	var adminSetup = deps.admin;
	var credSetup = deps.credentials;

	var auth = server.auth;

	var Machine = machina.Fsm.extend( {

		go: function( options ) {
			this.options = options || {};
			this.transition( "checkingForAdmin" );
		},

		raiseAny: function( step ) {
			return function( err, result ) {
				var ev = step + "." + ( err ? "failed" : "done" );
				this.handle( ev, err || result );
			}.bind( this );
		},

		raiseResult: function( step ) {
			return function( result ) {
				this.handle( step + ".done", result );
			}.bind( this );
		},

		initialState: "waiting",

		states: {
			adminPassword: {
				_onEnter: function() {
					prompt.admin( this.raiseResult( "prompt" ) );
				},
				"prompt.done": function( passwords ) {
					if ( passwords.nextPassword === passwords.confirmPassword ) {
						auth.changePassword( "admin", passwords.nextPassword )
							.then( this.raiseResult( "changePassword" ) );
					} else {
						console.log( "Passwords must match in order to change the admin password." );
						this.transition( "prompt" );
					}
				},
				"changePassword.done": function() {
					console.log( "Admin password changed successfully" );
					this.transition( "prompt" );
				}
			},
			agentToken: {
				_onEnter: function() {
					auth.getTokens( "agent" )
						.then( function( tokens ) {
							console.log( "Agent tokens:", tokens );
							this.transition( "prompt" );
						}.bind( this ) );
				}
			},
			checkingForAdmin: {
				_onEnter: function() {
					adminSetup.hasAdmin()
						.then( function() {
							this.transition( "checkingParameters" );
						}.bind( this ) )
						.catch( function() {
							this.transition( "createAdmin" );
						}.bind( this ) );
				}
			},
			checkingParameters: {
				_onEnter: function() {
					var nextState = (prompt.start || this.options.server) ? "start" : "prompt";
					this.transition( nextState );
				}
			},
			createAdmin: {
				_onEnter: function() {
					server.start();
					console.log( "Initializing database..." );
					setTimeout( function() {
						adminSetup.createAdmin()
							.then( function() {
								server.stop();
								console.log( "Created admin account with default permissions" );
								this.transition( "checkingParameters" );
							}.bind( this ) );

					}.bind( this ), 5000 );
				}
			},
			createCredentials: {
				_onEnter: function() {
					prompt.credentials( this.raiseResult( "prompt" ) );
				},
				"prompt.done": function( credentials ) {
					credSetup.createCredentials( credentials )
						.then( function( token ) {
							console.log( "Agent credentials and permissions created. Agent token:", token );
							this.transition( "prompt" );
						}.bind( this ) );
				}
			},
			createToken: {
				_onEnter: function() {
					prompt.token( this.raiseResult( "prompt" ) );
				},
				"prompt.done": function( credentials, twoFactorResult ) {
					var options = {};
					if ( twoFactorResult ) {
						options.twoFactorToken = twoFactorResult.token;
					}

					api.authenticateBasic( credentials );
					api.createToken( credentials.user, options, function( err, token ) {
						if ( !err ) {
							return this.handle( "token.done" );
						}

						if ( err.code === 401 ) {
							return prompt.twoFactor( function( result ) {
								this.handle( "prompt.done", credentials, result );
							}.bind( this ) );
						}

						return this.handle( "token.failed", err );
					}.bind( this ) );
				},
				"token.done": function( token ) {
					this.transition( "prompt" );
				},
				"token.failed": function( err ) {
					console.log( "Could not acquire API Token from GitHub:", err );
					this.transition( "prompt" );
				}
			},
			prompt: {
				_onEnter: function() {
					var choices = [ prompt.choices.createCredentials, prompt.choices.adminPassword, prompt.choices.agentToken ];
					choices.push( api.checkToken() ? prompt.choices.start : prompt.choices.createToken );
					prompt.initiate( choices, this.raiseResult( "prompt" ) );
				},
				"prompt.done": function( choice ) {
					var nextState = prompt.lookup[ choice.initialization ];
					this.transition( nextState );
				}
			},
			start: {
				_onEnter: function() {
					server.start();
				}
			},
			waiting: {}
		}
	} );

	return new Machine();
};
