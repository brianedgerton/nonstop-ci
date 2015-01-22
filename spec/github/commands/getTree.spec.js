var should = require( "should" );
var sinon = require( "sinon" );
var when = require( "when" );
var _ = require( "lodash" );
var github;
var databass;
var createCommand;
var command;
var org = "myorg";
var repo = "myrepo";
var sha = "abc123";
var someTree = { sha: "asdf;klj", url: "http://github/my/repo/tree/sha" };

describe( "get tree command", function() {

	before( function() {
		github = require( "../../../src/github/api" )( { nonstop: { ci: { url: "https://nonstop-ci.com/commits" } } } );
		databass = require( "../../../src/github/store" );
		createCommand = require( "../../../src/github/commands/getTree" )( github, databass );
		command = createCommand( org, repo, sha );
	} );

	describe( "when fetching latest trees", function() {
		var fetch;
		var handle;
		before( function() {
			handle = sinon.stub( command, "handle" );
			fetch = sinon.stub( github, "fetchTreeChanges" ).returns( when( "SUCCESS" ) );
		} );

		after( function() {
			fetch.restore();
			handle.restore();
		} );

		it( "should proxy to github", function( done ) {
			command.fetchLatest().then( function() {
				fetch.getCall( 0 ).args.should.eql( [ org, repo, sha ] );
				handle.getCall( 0 ).args.should.eql( [ "result", "SUCCESS" ] );
				done();
			} );
		} );
	} );

	describe( "when fetching the whole tree", function() {
		var fetch;
		var handle;
		before( function() {
			handle = sinon.stub( command, "handle" );
			fetch = sinon.stub( github, "fetchLatestTree" ).returns( when( "SUCCESS" ) );
		} );

		after( function() {
			fetch.restore();
			handle.restore();
		} );

		it( "should proxy to github", function( done ) {
			command.fetch().then( function() {
				fetch.getCall( 0 ).args.should.eql( [ org, repo, sha ] );
				handle.getCall( 0 ).args.should.eql( [ "result", "SUCCESS" ] );
				done();
			} );
		} );
	} );

	describe( "when loading trees", function() {
		var fetch;
		var handle;
		before( function() {
			handle = sinon.stub( command, "handle" );
			fetch = sinon.stub( databass, "tree" ).returns( when( [ { tree: "SUCCESS" } ] ) );
		} );

		after( function() {
			fetch.restore();
			handle.restore();
		} );

		it( "should use the data store", function( done ) {
			command.loadTree().then( function() {
				fetch.getCall( 0 ).args.should.eql( [ org, repo, sha ] );
				handle.getCall( 0 ).args.should.eql( [ "result", "SUCCESS" ] );
				done();
			} );
		} );
	} );

	describe( "when storing trees", function() {
		var store;
		before( function() {
			store = sinon.stub( databass, "tree" ).returns( when( [] ) );
		} );

		after( function() {
			store.restore();
		} );

		it( "should use the data store", function( done ) {
			command.storeTree( someTree ).then( function() {
				store.getCall( 0 ).args.should.eql( [ org, repo, sha, someTree ] );
				done();
			} );
		} );
	} );

	describe( "when reading trees", function() {
		describe( "when an update is found", function() {
			var fetch;
			var request;
			var transition;
			var store;
			before( function() {
				transition = sinon.spy( command, "transition" );
				store = sinon.stub( command, "storeTree" );
				fetch = sinon.stub( command, "fetchLatest", function() {
					return this.handle( "result", { tree: someTree } );
				} );
				request = command.read();
			} );

			after( function() {
				store.restore();
				fetch.restore();
				transition.restore();
			} );

			it( "should return the data", function( done ) {
				request.then( function( data ) {
					data.should.eql( {
						organization: org,
						repository: repo,
						tree: someTree
					} );
					done();
				} );
			} );

			it( "should store the tree data", function( done ) {
				request.then( function() {
					store.getCall( 0 ).args[ 0 ].should.eql( { tree: someTree } );
					done();
				} );
			} );

			it( "should transition back to waiting", function( done ) {
				request.then( function() {
					transition.lastCall.args.should.eql( [ "waiting" ] );
					done();
				} );
			} );

		} );

		describe( "when an update is not found", function() {
			var fetchLatest;
			var transition;
			before( function() {
				transition = sinon.spy( command, "transition" );
				fetchLatest = sinon.stub( command, "fetchLatest", function() {
					return this.handle( "result" );
				} );
			} );

			after( function() {
				fetchLatest.restore();
				transition.restore();
			} );

			describe( "when the data is found in storage", function() {
				var loadTree;
				var request;
				before( function() {
					transition.reset();
					loadTree = sinon.stub( command, "loadTree", function() {
						return this.handle( "result", { tree: someTree } );
					} );
					request = command.read();
				} );

				after( function() {
					loadTree.restore();
				} );

				it( "should return the stored data", function( done ) {
					request.then( function( data ) {
						data.should.eql( {
							organization: org,
							repository: repo,
							tree: someTree
						} );
						done();
					} );
				} );

				it( "should transition back to waiting", function( done ) {
					request.then( function() {
						transition.lastCall.args.should.eql( [ "waiting" ] );
						done();
					} );
				} );

			} );

			describe( "when the data is not found in storage", function() {
				var loadTree;
				before( function() {
					loadTree = sinon.stub( command, "loadTree", function() {
						return this.handle( "result" );
					} );
				} );

				after( function() {
					loadTree.restore();
				} );

				describe( "when the full data is retrieved from github", function() {
					var fetch;
					var store;
					var request;
					before( function() {
						transition.reset();
						store = sinon.stub( command, "storeTree" );
						fetch = sinon.stub( command, "fetch", function() {
							return this.handle( "result", { tree: someTree } );
						} );
						request = command.read();
					} );

					after( function() {
						store.restore();
						fetch.restore();
					} );

					it( "should return the correct data", function( done ) {
						request.then( function( data ) {
							data.should.eql( {
								organization: org,
								repository: repo,
								tree: someTree
							} );
							done();
						} );
					} );

					it( "should store the data", function( done ) {
						request.then( function() {
							store.getCall( 0 ).args[ 0 ].should.eql( { tree: someTree } );
							done();
						} );
					} );

					it( "should transition back to waiting", function( done ) {
						request.then( function() {
							transition.lastCall.args[ 0 ].should.equal( "waiting" );
							done();
						} );
					} );

				} );

			} );


		} );
	} );

} );
