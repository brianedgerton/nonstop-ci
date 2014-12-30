var when = require( 'when' );
var machina = require( 'machina' );
var debug = require( 'debug' )( 'command:branches' );

function createCommand( github, store, org, repository ) {
	var Machine = machina.Fsm.extend( {

		getHandle: function( topic ) {
			return function( data ) {
				this.handle( topic, data );
			}.bind( this );
		},

		fetchLatest: function() {
			debug( 'Attempting to fetch latest branches for %s - %s', org, repository );
			return github.fetchLatestBranches( org, repository )
				.then( this.getHandle( 'result' ), this.getHandle( 'error' ) );
		},

		fetch: function() {
			debug( 'Attempting to fetch *ALL* branches for %s - %s', org, repository );
			return github.fetchAllBranches( org, repository )
				.then( this.getHandle( 'result' ), this.getHandle( 'error' ) );
		},

		loadBranches: function() {
			debug( 'Attempting to load branches from storage for %s - %s', org, repository );
			return store.branches( org, repository )
				.then( function( data ) {
					return data[ 0 ];
				} )
				.then( this.getHandle( 'result' ), this.getHandle( 'error' ) );
		},

		read: function() {
			this.deferred = when.defer();
			this.handle( 'read' );
			return this.deferred.promise;
		},

		storeBranches: function( list ) {
			return store.branches( org, repository, list );
		},

		initialState: 'waiting',
		states: {
			waiting: {
				'read': function() {
					this.transition( 'checkingForUpdate' );
				}
			},
			checkingForUpdate: {
				_onEnter: function() {
					this.fetchLatest();
				},
				error: function( error ) {
					this.lastError = error;
					this.transition( 'checkingStorage' );
				},
				result: function( data ) {
					if ( data ) {
						this.storeBranches( data );
						this.deferred.resolve( { organization: org, repository: repository, branches: data } );
						this.transition( 'waiting' );
					} else {
						this.transition( 'checkingStorage' );
					}
				}
			},
			checkingStorage: {
				_onEnter: function() {
					this.loadBranches();
				},
				error: function( error ) {
					console.log( 'FAILED TO LOAD BRANCHES FOR', org, repository, 'with', error.stack );
					this.lastError = error;
					this.transition( 'getting' );
				},
				result: function( data ) {
					if ( data ) {
						this.deferred.resolve( { organization: org, repository: repository, branches: data } );
						this.transition( 'waiting' );
					} else {
						this.transition( 'getting' );
					}
				}
			},
			getting: {
				_onEnter: function() {
					this.fetch();
				},
				error: function( error ) {
					this.deferred.reject( error );
				},
				result: function( data ) {
					this.storeBranches( data );
					this.deferred.resolve( { organization: org, repository: repository, branches: data } );
					this.transition( 'waiting' );
				}
			}
		}
	} );

	return new Machine();
}


module.exports = function( github, store ) {
	return createCommand.bind( undefined, github, store );
};