var postal = require( "postal" );
var channel = postal.channel( "github" );
var _ = require( "lodash" );
var machina = require( "machina" );
var api = require( "./api.js" );
var store = require( "./store.js" );
var repository = require( "./repository" );
var debug = require( "debug" )( "strapping:fsm" );
var config = require( "../config.js" );
var repositories = require( "./commands/getRepositories.js" )( api, store );

var Machine = machina.Fsm.extend( {
	organizations: {},
	commands: {},

	createCommand: function( organization ) {
		if ( !this.commands[ organization ] ) {
			this.commands[ organization ] = repositories( organization );
		}
	},

	getHandle: function( topic ) {
		return function( data ) {
			this.handle( topic, data );
		}.bind( this );
	},

	onFork: function( data ) {
		var organization = data.forkee.owner.login;
		var repo = data.forkee;
		debug( "Creating repository instance to track fork at %s %s", organization, repo.name );
		var org = this.organizations[ organization ];
		store.repositories( organization, [ data.forkee ] );
		// wait a few seconds so GitHub"s API can "catch up" and provide honest answers
		setTimeout( function() {
			var instance = repository( organization, repo );
			if ( org && org.repositories ) {
				org.repositories[ repo.name ] = instance;
			} else {
				var list = {};
				list[ repo.name ] = instance;
				this.organizations[ organization ] = list;
			}
		}.bind( this ), 5000 );
	},

	onOrganizations: function( data ) {
		_.each( data, function( org ) {
			if ( _.contains( config.ignored.organizations, org.login ) ) {
				debug( "Skipping ignored organization %s", org.login );
			} else {
				debug( "Preparing to read repositories for %s", org.login );
				this.organizations[ org.login ] = org;
				this.createCommand( org.login );
			}
		}.bind( this ) );
		this.transition( "fetching-repositories" );
	},

	onRepositories: function( data ) {
		debug( "Retreived %d repositories for %s", data.repositories.length, data.organization );
		if ( !this.organizations[ data.organization ] ) {
			this.organizations[ data.organization ] = {};
		}
		var repos = this.organizations[ data.organization ];
		_.each( data.repositories, function( repo ) {
			if ( repo && repo.name && !repos[ repo.name ] ) {
				repos[ repo.name ] = repository( data.organization, repo );
			}
		} );
		this.organizations[ data.organization ].repositories = repos;
	},

	initialState: "initializing",
	states: {
		"authentication": {
			_onEnter: function() {
				if ( api.checkToken() ) {
					api.authenticateToken();
					this.transition( "fetching-organizations" );
				} else {
					console.log( "Cannot communicate with GitHub until an OAuth token has been established. Please restart the sevice and use the CLI menu to create one." );
				}
			},
			"fork": function( data ) {
				this.onFork( data );
			}
		},
		"initializing": {
			_onEnter: function() {
				channel.subscribe( "#", function( data, envelope ) {
					this.handle( envelope.topic, data );
				}.bind( this ) );
				this.transition( "authentication" );
			},
			"fork": function( data ) {
				this.onFork( data );
			}
		},
		"fetching-organizations": {
			_onEnter: function() {
				api.fetchOrganizations()
					.then( this.onOrganizations.bind( this ), this.getHandle( "organizations.failed" ) );
			},
			"fork": function( data ) {
				this.onFork( data );
			},
			"organizations.failed": function( err ) {
				debug( "Failed to retrieve list of organizations with %s", JSON.stringify( err ) );
				setTimeout( function() {
					this.transition( "fetching-organizations" );
				}.bind( this ), 5000 );
			}
		},
		"fetching-repositories": {
			_onEnter: function() {
				_.each( this.commands, function( command ) {
					command.read()
						.then( this.onRepositories.bind( this ) );
				}.bind( this ) );
			},
			"fork": function( data ) {
				this.onFork( data );
			}
		},
		"polling": {
			_onEnter: function() {
				setInterval( function() {
					this.transition( "fetching-organizations" );
				}.bind( this ), 300000 );
			},
			"fork": function( data ) {
				this.onFork( data );
			}
		}
	}
} );

module.exports = new Machine();