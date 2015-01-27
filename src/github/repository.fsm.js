var _ = require( "lodash" );
var machina = require( "machina" );
var debug = require( "debug" )( "github:repository" );

var branchesMod = require( "./commands/getBranches.js" );
var treeMod = require( "./commands/getTree.js" );

module.exports = function( config, api, store, organization, repository ) {
	var branches = branchesMod( api, store );
	var tree = treeMod( api, store );

	var Repository = machina.Fsm.extend( {
		name: [ organization, repository.name ].join( ":" ),
		initialState: "fetching-branches",
		organization: organization,
		repository: repository,
		treeCommand: tree,
		branches: branches( organization, repository.name ),
		trees: undefined,
		files: {},

		getBranch: function() {
			debug( "Attempting to read default branch %s for %s - %s", repository.default_branch, organization, repository.name );
			api.fetchBranch( organization, repository.name, repository.default_branch )
				.then( function( data ) {
					this.mainBranch = data;
					this.transition( "fetching-tree" );
				}.bind( this ),
					this.getHandle( "branch.failed" ) );
		},

		getHandle: function( topic ) {
			return function( data ) {
				this.handle( topic, data );
			}.bind( this );
		},

		hasBuildFile: function() {
			return _.find( this.files, function( file ) {
				return /nonstop[.]yaml/.test( file.path );
			} );
		},

		onBranches: function( data ) {
			if ( data && data.branches ) {
				debug( "Fetched %d branches for %s - %s", _.keys( data.branches ).length, organization, repository.name );
				this.mainBranch = _.find( data.branches, function( branch ) {
					return branch.name == this.repository.default_branch;
				}.bind( this ) );
				this.transition( "fetching-tree" );
			} else {
				this.getBranch();
			}
		},

		states: {
			"fetching-branches": {
				_onEnter: function() {
					debug( "Fetching branches for %s - %s", organization, repository.name );
					this.branches.read()
						.then( this.onBranches.bind( this ), this.getHandle( "branches.failed" ) );
				},
				"branches.failed": function( failure ) {
					debug( "FAILED TO FETCH BRANCHES for %s - %s: %s", organization, repository.name, JSON.stringify( failure ) );
					this.getBranch();
				},
				"branch.failed": function( failure ) {
					debug( "FAILED TO FETCH DEFAULT BRANCH for %s - %s: %s", organization, repository.name, JSON.stringify( failure ) );
					debug( "Shutting down polling for repository %s - %s as it appears it has moved or has become unavailable", organization, repository.name );
				}
			},
			"fetching-tree": {
				_onEnter: function() {
					debug( "Checking %s - %s main branch for build file", organization, repository.name );
					if ( !this.tree ) {
						if ( this.mainBranch && this.mainBranch.commit.sha ) {
							this.tree = this.treeCommand( this.organization, this.repository.name, this.mainBranch.commit.sha );
						} else {
							debug( "Main branch %s for %s - %s is showing no commit data. Cannot proceed.", repository.default_branch, organization, repository.name, this.mainBranch );
							debug( "Shutting down polling for repository %s - %s as it appears no commit data is available", organization, repository.name );
							return;
						}
					}
					this.tree.read()
						.then( this.getHandle( "tree.fetched" ), this.getHandle( "tree.failed" ) );
				},
				"tree.fetched": function( data ) {
					this.files = data.tree;
					this.transition( "verifying-hook" );
				},
				"tree.failed": function( failure ) {
					debug( "FAILED TO FETCH TREE for %s - %s [%s]: %s", this.organization, this.repository.name, this.repository.default_branch, JSON.stringify( failure ) );
					setTimeout( function() {
						this.transition( "fetching-tree" );
					}.bind( this ), 5000 );
				}
			},
			"verifying-hook": {
				_onEnter: function() {
					if ( this.hasBuildFile() ) {
						api.fetchHook( this.organization, this.repository.name )
							.then( function( found ) {
								if ( found ) {
									this.handle( "hook.found" );
								} else {
									this.handle( "hook.missing" );
								}
							}.bind( this ), this.getHandle( "hook.missing" ) );
					} else {
						this.transition( "polling" );
					}
				},
				"hook.missing": function() {
					debug( "Build file found in %s - %s, creating web hook", this.organization, this.repository.name );
					api.createHook( this.organization, this.repository.name )
						.then( function() {
							this.hasHook = true;
							this.transition( "polling" );
						}.bind( this ), function( err ) {
								this.transition( "polling" );
							}.bind( this ) );

				},
				"hook.found": function() {
					debug( "Webhook exists for %s - %s", this.organization, this.repository.name );
					this.hasHook = true;
					this.transition( "polling" );
				}
			},
			"polling": {
				_onEnter: function() {
					if ( !this.hasHook ) {
						setInterval( function() {
							this.transition( "fetching-branches" );
						}.bind( this ), 300000 );
					}
				}
			}
		}
	} );
	return new Repository();
};
