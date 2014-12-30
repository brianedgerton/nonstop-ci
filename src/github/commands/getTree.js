var when = require( 'when' );
var machina = require( 'machina' );


function createCommand( github, store, org, repository, sha ) {
	var Machine = machina.Fsm.extend( {

		getHandle: function( topic ) {
			return function( data ) {
				this.handle( topic, data );
			}.bind( this );
		},

		fetchLatest: function() {
			return github.fetchTreeChanges( org, repository, sha )
				.then( this.getHandle( 'result' ), this.getHandle( 'error' ) );
		},

		fetch: function() {
			return github.fetchLatestTree( org, repository, sha )
				.then( this.getHandle( 'result' ), this.getHandle( 'error' ) );
		},

		loadTree: function() {
			return store.tree( org, repository, sha )
				.then( function( data ) {
					return data[ 0 ].tree;
				} )
				.then( this.getHandle( 'result' ), this.getHandle( 'error' ) );
		},

		read: function() {
			this.deferred = when.defer();
			this.handle( 'read' );
			return this.deferred.promise;
		},

		storeTree: function( tree ) {
			return store.tree( org, repository, sha, tree );
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
						this.storeTree( data );
						this.deferred.resolve( { organization: org, repository: repository, tree: data.tree } );
						this.transition( 'waiting' );
					} else {
						this.transition( 'checkingStorage' );
					}
				}
			},
			checkingStorage: {
				_onEnter: function() {
					this.loadTree();
				},
				error: function( error ) {
					this.lastError = error;
					this.transition( 'getting' );
				},
				result: function( data ) {
					if ( data ) {
						this.deferred.resolve( { organization: org, repository: repository, tree: data.tree } );
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
					this.storeTree( data );
					this.deferred.resolve( { organization: org, repository: repository, tree: data.tree } );
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