var should = require( "should" );
var sinon = require( "sinon" );
var when = require( "when" );
var _ = require( "lodash" );
var github;
var databass;
var createCommand;
var command;
var org = "myorg";

describe( "get repositories command", function() {

	before( function() {
		github = require( "../../../src/github/api" )( { nonstop: { ci: { url: "https://nonstop-ci.com/commits" } } } );
		databass = require( "../../../src/github/store" );
		createCommand = require( "../../../src/github/commands/getRepositories" )( github, databass );
		command = createCommand( org );
	} );

	describe( "when fetching latest repositories", function() {
		var fetch;
		var handle;
		before( function() {
			handle = sinon.stub( command, "handle" );
			fetch = sinon.stub( github, "fetchLatestRepositories" ).returns( when( "SUCCESS" ) );
		} );

		after( function() {
			fetch.restore();
			handle.restore();
		} );

		it( "should proxy to github", function( done ) {
			command.fetchLatest().then( function() {
				fetch.getCall( 0 ).args.should.eql( [ org ] );
				handle.getCall( 0 ).args.should.eql( [ "result", "SUCCESS" ] );
				done();
			} );
		} );
	} );

	describe( "when fetching all repositories", function() {
		var fetch;
		var handle;
		before( function() {
			handle = sinon.stub( command, "handle" );
			fetch = sinon.stub( github, "fetchAllRepositories" ).returns( when( "SUCCESS" ) );
		} );

		after( function() {
			fetch.restore();
			handle.restore();
		} );

		it( "should proxy to github", function( done ) {
			command.fetch().then( function() {
				fetch.getCall( 0 ).args.should.eql( [ org ] );
				handle.getCall( 0 ).args.should.eql( [ "result", "SUCCESS" ] );
				done();
			} );
		} );
	} );

	describe( "when loading repositories", function() {
		var fetch;
		var handle;
		before( function() {
			handle = sinon.stub( command, "handle" );
			fetch = sinon.stub( databass, "repositories" ).returns( when( [ "SUCCESS" ] ) );
		} );

		after( function() {
			fetch.restore();
			handle.restore();
		} );

		it( "should use the data store", function( done ) {
			command.loadRepositories().then( function() {
				fetch.getCall( 0 ).args.should.eql( [ org ] );
				handle.getCall( 0 ).args.should.eql( [ "result", [ "SUCCESS" ] ] );
				done();
			} );
		} );
	} );

	describe( "when storing repositories", function() {
		var store;
		before( function() {
			store = sinon.stub( databass, "repositories" ).returns( when( [ "SUCCESS" ] ) );
		} );

		after( function() {
			store.restore();
		} );

		it( "should use the data store", function( done ) {
			command.storeList( [ 1, 2, 3 ] ).then( function() {
				store.getCall( 0 ).args.should.eql( [ org, [ 1, 2, 3 ] ] );
				done();
			} );
		} );
	} );

	describe( "when reading repositories", function() {
		describe( "when an update is found", function() {
			var fetch;
			var request;
			var transition;
			var store;
			before( function() {
				transition = sinon.spy( command, "transition" );
				store = sinon.stub( command, "storeList" );
				fetch = sinon.stub( command, "fetchLatest", function() {
					return this.handle( "result", [ "repository1", "repository2" ] );
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
						repositories: [ "repository1", "repository2" ]
					} );
					done();
				} );
			} );

			it( "should store the repository data", function( done ) {
				request.then( function() {
					store.getCall( 0 ).args[ 0 ].should.eql( [ "repository1", "repository2" ] );
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
				var loadRepositories;
				var request;
				before( function() {
					transition.reset();
					loadRepositories = sinon.stub( command, "loadRepositories", function() {
						return this.handle( "result", [ "loadedRepository1", "loadedRepository2" ] );
					} );
					request = command.read();
				} );

				after( function() {
					loadRepositories.restore();
				} );

				it( "should return the stored data", function( done ) {
					request.then( function( data ) {
						data.should.eql( {
							organization: org,
							repositories: [ "loadedRepository1", "loadedRepository2" ]
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
				var loadRepositories;
				before( function() {
					loadRepositories = sinon.stub( command, "loadRepositories", function() {
						return this.handle( "result" );
					} );
				} );

				after( function() {
					loadRepositories.restore();
				} );

				describe( "when the full data is retrieved from github", function() {
					var fetch;
					var store;
					var request;
					before( function() {
						transition.reset();
						store = sinon.stub( command, "storeList" );
						fetch = sinon.stub( command, "fetch", function() {
							return this.handle( "result", [ "repository1", "repository2" ] );
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
								repositories: [ "repository1", "repository2" ]
							} );
							done();
						} );
					} );

					it( "should store the data", function( done ) {
						request.then( function() {
							store.getCall( 0 ).args[ 0 ].should.eql( [ "repository1", "repository2" ] );
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
