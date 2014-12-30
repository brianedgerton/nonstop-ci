var when = require( 'when' );
var machina = require( 'machina' );
var debug = require( 'debug' )( 'command:repositories' );

function createCommand( github, store, org ) {
	var Machine = machina.Fsm.extend( {

		getHandle: function( topic ) {
			return function( data ) {
				this.handle( topic, data );
			}.bind( this );
		},

		fetchLatest: function() {
			debug( 'Attempting to get latest repositories for %s', org );
			return github.fetchLatestRepositories( org )
				.then( this.getHandle( 'result' ), this.getHandle( 'error' ) );
		},

		fetch: function() {
			debug( 'Attempting to get *ALL* repositories for %s', org );
			return github.fetchAllRepositories( org )
				.then( this.getHandle( 'result' ), this.getHandle( 'error' ) );
		},

		loadRepositories: function() {
			debug( 'Attempting to load repositories from storage for %s', org );
			return store.repositories( org )
				.then( function( data ) {
					return data;
				} )
				.then( this.getHandle( 'result' ), this.getHandle( 'error' ) );
		},

		read: function() {
			this.deferred = when.defer();
			this.handle( 'read' );
			return this.deferred.promise;
		},

		storeList: function( list ) {
			return store.repositories( org, list );
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
						this.storeList( data );
						this.deferred.resolve( { organization: org, repositories: data } );
						this.transition( 'waiting' );
					} else {
						this.transition( 'checkingStorage' );
					}
				}
			},
			checkingStorage: {
				_onEnter: function() {
					this.loadRepositories();
				},
				error: function( error ) {
					this.lastError = error;
					this.transition( 'getting' );
				},
				result: function( data ) {
					if ( data ) {
						this.deferred.resolve( { organization: org, repositories: data } );
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
					this.storeList( data );
					this.deferred.resolve( { organization: org, repositories: data } );
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