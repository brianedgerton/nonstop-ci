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

describe( "get branches command", function() {

	before( function() {
		github = require( "../../../src/github/api" )( { nonstop: { ci: { url: "https://nonstop-ci.com/commits" } } } );
		databass = require( "../../../src/github/store" );
		createCommand = require( "../../../src/github/commands/getBranches" )( github, databass );
		command = createCommand( org, repo );
	} );

	describe( "when fetching latest branches", function() {
		var fetch;
		var handle;
		before( function() {
			handle = sinon.stub( command, "handle" );
			fetch = sinon.stub( github, "fetchLatestBranches" ).returns( when( "SUCCESS" ) );
		} );

		after( function() {
			fetch.restore();
			handle.restore();
		} );

		it( "should proxy to github", function( done ) {
			command.fetchLatest().then( function() {
				fetch.getCall( 0 ).args.should.eql( [ org, repo ] );
				handle.getCall( 0 ).args.should.eql( [ "result", "SUCCESS" ] );
				done();
			} );
		} );
	} );

	describe( "when fetching all branches", function() {
		var fetch;
		var handle;
		before( function() {
			handle = sinon.stub( command, "handle" );
			fetch = sinon.stub( github, "fetchAllBranches" ).returns( when( "SUCCESS" ) );
		} );

		after( function() {
			fetch.restore();
			handle.restore();
		} );

		it( "should proxy to github", function( done ) {
			command.fetch().then( function() {
				fetch.getCall( 0 ).args.should.eql( [ org, repo ] );
				handle.getCall( 0 ).args.should.eql( [ "result", "SUCCESS" ] );
				done();
			} );
		} );
	} );

	describe( "when loading branches", function() {
		var fetch;
		var handle;
		before( function() {
			handle = sinon.stub( command, "handle" );
			fetch = sinon.stub( databass, "branches" ).returns( when( [ "SUCCESS" ] ) );
		} );

		after( function() {
			fetch.restore();
			handle.restore();
		} );

		it( "should use the data store", function( done ) {
			command.loadBranches().then( function() {
				fetch.getCall( 0 ).args.should.eql( [ org, repo ] );
				handle.getCall( 0 ).args.should.eql( [ "result", "SUCCESS" ] );
				done();
			} );
		} );
	} );

	describe( "when storing branches", function() {
		var store;
		before( function() {
			store = sinon.stub( databass, "branches" ).returns( when( [ "SUCCESS" ] ) );
		} );

		after( function() {
			store.restore();
		} );

		it( "should use the data store", function( done ) {
			command.storeBranches( [ 1, 2, 3 ] ).then( function() {
				store.getCall( 0 ).args.should.eql( [ org, repo, [ 1, 2, 3 ] ] );
				done();
			} );
		} );
	} );

	describe( "when reading branches", function() {
		describe( "when an update is found", function() {
			var fetch;
			var request;
			var transition;
			var store;
			before( function() {
				transition = sinon.spy( command, "transition" );
				store = sinon.stub( command, "storeBranches" );
				fetch = sinon.stub( command, "fetchLatest", function() {
					return this.handle( "result", [ "branch1", "branch2" ] );
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
						branches: [ "branch1", "branch2" ]
					} );
					done();
				} );
			} );

			it( "should store the branch data", function( done ) {
				request.then( function() {
					store.getCall( 0 ).args[ 0 ].should.eql( [ "branch1", "branch2" ] );
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
				var loadBranches;
				var request;
				before( function() {
					transition.reset();
					loadBranches = sinon.stub( command, "loadBranches", function() {
						return this.handle( "result", [ "loadedBranch1", "loadedBranch2" ] );
					} );
					request = command.read();
				} );

				after( function() {
					loadBranches.restore();
				} );

				it( "should return the stored data", function( done ) {
					request.then( function( data ) {
						data.should.eql( {
							organization: org,
							repository: repo,
							branches: [ "loadedBranch1", "loadedBranch2" ]
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
				var loadBranches;
				before( function() {
					loadBranches = sinon.stub( command, "loadBranches", function() {
						return this.handle( "result" );
					} );
				} );

				after( function() {
					loadBranches.restore();
				} );

				describe( "when the full data is retrieved from github", function() {
					var fetch;
					var store;
					var request;
					before( function() {
						transition.reset();
						store = sinon.stub( command, "storeBranches" );
						fetch = sinon.stub( command, "fetch", function() {
							return this.handle( "result", [ "branch1", "branch2" ] );
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
								branches: [ "branch1", "branch2" ]
							} );
							done();
						} );
					} );

					it( "should store the data", function( done ) {
						request.then( function() {
							store.getCall( 0 ).args[ 0 ].should.eql( [ "branch1", "branch2" ] );
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
