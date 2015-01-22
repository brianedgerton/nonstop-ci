var should = require( "should" );
var _ = require( "lodash" );
var sinon = require( "sinon" );
var when = require( "when" );
var mocker = require( "../fixtures/github.nock.js" );

var databass = require( "../../src/github/store" );
var tokenApi = require( "../../src/github/token" );
var api = require( "../../src/github/api" )( { nonstop: { ci: { url: "https://nonstop-ci.com/commits" } } } );


function setUserToken( userToken ) {
	var readToken = sinon.stub( tokenApi, "read" ).returns( userToken );
	api.readToken();
	readToken.restore();
}

function resetUserToken() {
	setUserToken( { user: null, token: null } );
}

describe( "Github API Wrapper", function() {

	describe( "when checking a token", function() {
		it( "should proxy directly to the token api", function() {
			var check = sinon.stub( tokenApi, "check" );
			api.checkToken();
			check.called.should.be.ok;
			check.restore();
		} );
	} );

	describe( "when creating a web hook", function() {
		var request;
		var watched;
		var reqBody = {
			"config": {
				"url": "https://nonstop-ci.com/commits",
				"content_type": "json",
				"insecure_ssl": 1
			},
			"events": [ "push", "fork", "create", "delete", "pull request" ],
			"active": true,
			"name": "web"
		};


		before( function() {
			mocker.github( "repos:create-hook", { user: "myuser", repo: "myrepo" }, reqBody )
				.replyWithFixture( 200, "hooks:created" );

			watched = sinon.stub( databass, "watched" );

			request = api.createHook( "myuser", "myrepo" );
		} );

		after( function() {
			watched.restore();
			mocker.reset();
		} );

		it( "should save the repository as watched", function( done ) {
			watched.called.should.be.ok;
			watched.getCall( 0 ).args.should.eql( [ "myuser", "myrepo" ] );
			done();
		} );

	} );

	describe( "when creating a token", function() {
		describe( "when using regular authentication", function() {
			var request;
			var write;
			var token = "abcdefgh12345678";
			var reqBody = function( body ) {
				return _.isEqual( body.scopes, [ "repo" ] );
			};


			before( function() {
				mocker.github( "authorization:create", {}, reqBody )
					.replyWithFixture( 200, "authorizations:created" );

				write = sinon.stub( tokenApi, "write" );
			} );

			after( function() {
				write.restore();
				mocker.reset();
			} );

			it( "should write the returned token", function( done ) {
				api.createToken( "myuser", function( err, doc ) {
					write.called.should.be.ok;
					write.getCall( 0 ).args.should.eql( [ 1, "myuser", token ] );
					done();
				} );
			} );
		} );

		describe( "when using two factor authentication", function() {
			var request;
			var write;
			var token = "abcdefgh12345678";
			var twofaToken = "123abc";
			var reqBody = function( body ) {
				return _.isEqual( body.scopes, [ "repo" ] );
			};


			before( function() {
				mocker.github( "authorization:create", {}, reqBody )
					.matchHeader( "x-github-otp", twofaToken )
					.replyWithFixture( 200, "authorizations:created" );

				write = sinon.stub( tokenApi, "write" );
			} );

			after( function() {
				write.restore();
				mocker.reset();
			} );

			it( "should write the returned token", function( done ) {
				api.createToken( "myuser", { twoFactorToken: twofaToken }, function( err, doc ) {
					write.called.should.be.ok;
					write.getCall( 0 ).args.should.eql( [ 1, "myuser", token ] );
					done();
				} );
			} );
		} );

	} );

	describe( "when fetching a hook", function() {

		describe( "when the hook is present", function() {
			var watched;
			before( function() {
				watched = sinon.stub( databass, "watched" );
				mocker.github( "repos:get-hooks", { user: "myuser", repo: "myrepo" } )
					.replyWithFixture( 200, "hooks:hook-present" );
			} );

			after( function() {
				mocker.reset();
				watched.restore();
			} );

			it( "should store the repository as watched", function( done ) {
				api.fetchHook( "myuser", "myrepo" )
					.then( function( result ) {
						watched.called.should.be.ok;
						watched.getCall( 0 ).args.should.eql( [ "myuser", "myrepo" ] );
						done();
					} );
			} );
		} );

		describe( "when the hook is not present", function() {
			var watched;
			before( function() {
				watched = sinon.stub( databass, "watched" );
				mocker.github( "repos:get-hooks", { user: "myuser", repo: "myrepo" } )
					.replyWithFixture( 200, "hooks:no-hook-present" );
			} );

			after( function() {
				mocker.reset();
				watched.restore();
			} );

			it( "should not store the repository as watched", function( done ) {
				api.fetchHook( "myuser", "myrepo" )
					.then( function( result ) {
						watched.called.should.not.be.ok;
						done();
					} );
			} );
		} );

	} );

	describe( "when fetching a branch", function() {
		before( function() {
			mocker.github( "repos:get-branch", { user: "myuser", repo: "myrepo", branch: "specialbranch" } )
				.replyWithFixture( 200, "branch:specialbranch" );
		} );

		after( function() {
			mocker.reset();
		} );

		it( "should find the correct branch on the repository", function( done ) {
			api.fetchBranch( "myuser", "myrepo", "specialbranch" )
				.then( function( result ) {
					result.name.should.equal( "specialbranch" );
					done();
				} );
		} );
	} );

	describe( "when fetching all branches", function() {
		var request;
		var stamp;
		var headers = {
			"ETag": "686897696a7c876b7e",
			"Last-Modified": "Wed, 15 Nov 1995 04:58:08 GMT"
		};

		before( function() {
			stamp = sinon.stub( databass, "stamp" );
			mocker.github( "repos:get-branches", { user: "myuser", repo: "myrepo", per_page: 100 } )
				.replyWithFixture( 200, "branches:all-branches", headers );
			request = api.fetchAllBranches( "myuser", "myrepo" );
		} );

		after( function() {
			stamp.restore();
			mocker.reset();
		} );

		it( "should retrieve the list of all branches", function( done ) {
			request.then( function( branches ) {
				branches.length.should.equal( 3 );
				done();
			} );
		} );

		it( "should save the etag and last modified information", function( done ) {
			request.then( function() {
				var args = stamp.getCall( 0 ).args;
				args[ 0 ].should.eql( { organization: "myuser", branchRepository: "myrepo" } );
				args[ 1 ].should.eql( headers[ "Last-Modified" ] );
				args[ 2 ].should.equal( headers[ "ETag" ] );
				done();
			} );
		} );

	} );

	describe( "when fetching latest branches", function() {
		var request;
		var stamp;
		var headers = {
			tag: "686897696a7c876b7e",
			stamp: "Wed, 15 Nov 1995 04:58:08 GMT"
		};

		before( function() {
			stamp = sinon.stub( databass, "stamp" ).returns( when( [ headers ] ) );
			mocker.github( "repos:get-branches", { user: "myuser", repo: "myrepo", per_page: 100 } )
				.reply( 304 );
			request = api.fetchLatestBranches( "myuser", "myrepo" );
		} );

		after( function() {
			stamp.restore();
			mocker.reset();
		} );

		it( "should return undefined if nothing has changed", function( done ) {
			request.then( function( result ) {
				stamp.getCall( 0 ).args[ 0 ].should.eql( { organization: "myuser", branchRepository: "myrepo" } );
				should( result ).not.be.ok;
				done();
			} );
		} );
	} );

	describe( "when fetching all repositories", function() {
		describe( "when a github user is not present", function() {
			var request;
			var stamp;
			var headers = {
				"ETag": "686897696a7c876b7e",
				"Last-Modified": "Wed, 15 Nov 1995 04:58:08 GMT"
			};
			before( function() {
				stamp = sinon.stub( databass, "stamp" );
				mocker.github( "repos:get-from-org", { org: "myorg", per_page: 100 } )
					.replyWithFixture( 200, "repos:from-org", headers );

				request = api.fetchAllRepositories( "myorg" );
			} );

			after( function() {
				stamp.restore();
				mocker.reset();
			} );

			it( "should retrieve the list from the organization", function( done ) {
				request.then( function( repos ) {
					repos.length.should.equal( 2 );
					done();
				} );
			} );

			it( "should save the etag and last modified information", function( done ) {
				request.then( function() {
					var args = stamp.getCall( 0 ).args;
					args[ 0 ].should.eql( { repositoryOwner: "myorg" } );
					args[ 1 ].should.eql( headers[ "Last-Modified" ] );
					args[ 2 ].should.equal( headers[ "ETag" ] );
					done();
				} );
			} );

		} );

		describe( "when a github user is present", function() {
			var request;
			var stamp;
			var readToken;

			before( function() {
				setUserToken( { user: "myuser", token: "sometoken" } );
				stamp = sinon.stub( databass, "stamp" );
				mocker.github( "repos:get-from-user", { user: "myuser", type: "all", sort: "updated", per_page: 100 } )
					.replyWithFixture( 200, "repos:from-user" );

				request = api.fetchAllRepositories( "myuser" );
			} );

			after( function() {
				resetUserToken();
				stamp.restore();
				mocker.reset();
			} );

			it( "should retrieve the list from the user", function( done ) {
				request.then( function( repos ) {
					repos.length.should.equal( 1 );
					done();
				} );
			} );
		} );

	} );

	describe( "when fetching latest repositories", function() {
		var request;
		var stamp;
		var headers = {
			tag: "686897696a7c876b7e",
			stamp: "Wed, 15 Nov 1995 04:58:08 GMT"
		};

		before( function() {
			stamp = sinon.stub( databass, "stamp" ).returns( when( [ headers ] ) );
			mocker.github( "repos:get-from-org", { org: "myorg", per_page: 100 } )
				.reply( 304 );
			request = api.fetchLatestRepositories( "myorg" );
		} );

		after( function() {
			stamp.restore();
			mocker.reset();
		} );

		it( "should return undefined if nothing has changed", function( done ) {
			request.then( function( result ) {
				stamp.getCall( 0 ).args[ 0 ].should.eql( { repositoryOwner: "myorg" } );
				should( result ).not.be.ok;
				done();
			} );
		} );
	} );

	describe( "when fetching a user's list of organizations", function() {

		describe( "when retrieving the full list", function() {
			var request;
			var stamp;
			var userToken = { user: "brian", token: "brianstoken" };
			var orgHeaders = {
				"ETag": "686897696a7c876b7e",
				"Last-Modified": "Wed, 15 Nov 1995 04:58:08 GMT"
			};
			var userHeaders = {
				"ETag": "686897696a7c876b7f",
				"Last-Modified": "Wed, 15 Nov 1998 04:58:08 GMT"
			};

			before( function() {
				setUserToken( userToken );
				stamp = sinon.stub( databass, "stamp" );

				stamp.withArgs( { orgs: "orglist" } ).returns( when( {} ) );
				stamp.withArgs( { userInfo: userToken.user } ).returns( when( {} ) );

				mocker.github( "orgs:get-from-user", { user: userToken.user, per_page: 100 } )
					.replyWithFixture( 200, "organizations:from-user", orgHeaders );

				mocker.github( "user:get-from", { user: userToken.user } )
					.replyWithFixture( 200, "user:octocat", userHeaders );

				request = api.fetchOrganizations();
			} );

			after( function() {
				resetUserToken();
				stamp.restore();
				mocker.reset();
			} );

			it( "should return the correct results", function( done ) {
				request.then( function( orgs ) {
					orgs.length.should.equal( 3 );
					done();
				} );
			} );

			it( "should save the etag and last modified information", function( done ) {
				request.then( function() {

					var args = stamp.getCall( 2 ).args;
					args[ 0 ].should.eql( { orgs: "orglist" } );
					args[ 1 ].should.eql( orgHeaders[ "Last-Modified" ] );
					args[ 2 ].should.equal( orgHeaders[ "ETag" ] );

					var args2 = stamp.getCall( 3 ).args;
					args2[ 0 ].should.eql( { userInfo: userToken.user } );
					args2[ 1 ].should.eql( userHeaders[ "Last-Modified" ] );
					args2[ 2 ].should.equal( userHeaders[ "ETag" ] );
					done();
				} );
			} );
		} );

		describe( "when retrieving unchanged data", function() {
			var request;
			var stamp;
			var dbOrgs;
			var dbUser;
			var userToken = { user: "brian", token: "brianstoken" };
			var orgHeaders = {
				"tag": "686897696a7c876b7e",
				"stamp": "Wed, 15 Nov 1995 04:58:08 GMT"
			};
			var userHeaders = {
				"tag": "686897696a7c876b7f",
				"stamp": "Wed, 15 Nov 1998 04:58:08 GMT"
			};

			before( function() {
				setUserToken( userToken );

				dbOrgs = sinon.stub( databass, "organizations" ).returns( when( [ 1, 2 ] ) );
				dbUser = sinon.stub( databass, "user" ).returns( when( 3 ) );

				stamp = sinon.stub( databass, "stamp" );
				stamp.withArgs( { orgs: "orglist" } ).returns( when( [ orgHeaders ] ) );
				stamp.withArgs( { userInfo: userToken.user } ).returns( when( [ userHeaders ] ) );

				mocker.github( "orgs:get-from-user", { user: userToken.user, per_page: 100 } )
					.matchHeader( "if-modified-since", orgHeaders.stamp )
					.matchHeader( "if-none-match", orgHeaders.tag )
					.reply( 304 );

				mocker.github( "user:get-from", { user: userToken.user } )
					.matchHeader( "if-modified-since", userHeaders.stamp )
					.matchHeader( "if-none-match", userHeaders.tag )
					.reply( 304 );

				request = api.fetchOrganizations();
			} );

			after( function() {
				resetUserToken();
				stamp.restore();
				dbOrgs.restore();
				dbUser.restore();
				mocker.reset();
			} );

			it( "should return the correct results", function( done ) {
				request.then( function( orgs ) {
					orgs.length.should.equal( 3 );
					done();
				} );
			} );

			it( "should retrieve the information from the database", function( done ) {
				request.then( function() {

					dbOrgs.called.should.be.ok;
					dbUser.called.should.be.ok;

					stamp.callCount.should.equal( 2 );
					done();
				} );
			} );
		} );
	} );

	describe( "when fetching the latest tree", function() {
		describe( "when the data is new", function() {
			var stamp;
			var request;
			var sha = "fc6274d15fa3ae2ab983129fb037999f264ba9a7";
			var userToken = { user: "brian", token: "brianstoken" };
			var responseHeaders = {
				"ETag": "686897696a7c876b7e",
				"Last-Modified": "Wed, 15 Nov 1995 04:58:08 GMT"
			};

			before( function() {
				setUserToken( userToken );
				stamp = sinon.stub( databass, "stamp" );

				mocker.github( "gitdata:get-tree", { user: userToken.user, repo: "octocat", sha: sha, recursive: true } )
					.replyWithFixture( 200, "tree:octocat", responseHeaders );

				request = api.fetchLatestTree( userToken.user, "octocat", sha );
			} );

			after( function() {
				resetUserToken();
				stamp.restore();
				mocker.reset();
			} );

			it( "should return the correct results", function( done ) {
				request.then( function( tree ) {
					tree.sha.should.equal( sha );
					done();
				} );
			} );

			it( "should cache the results", function( done ) {
				request.then( function( result ) {
					var args = stamp.getCall( 0 ).args;
					args[ 0 ].should.eql( { organization: userToken.user, treeRepository: "octocat", sha: sha } );
					args[ 1 ].should.eql( responseHeaders[ "Last-Modified" ] );
					args[ 2 ].should.eql( responseHeaders.ETag );
					done();
				} );
			} );
		} );

		describe( "when the data has not changed", function() {
			var stamp;
			var request;
			var sha = "fc6274d15fa3ae2ab983129fb037999f264ba9a7";
			var userToken = { user: "brian", token: "brianstoken" };
			var stampHeaders = {
				"tag": "686897696a7c876b7e",
				"stamp": "Wed, 15 Nov 1995 04:58:08 GMT"
			};

			before( function() {
				setUserToken( userToken );
				stamp = sinon.stub( databass, "stamp" );

				stamp.withArgs( { organization: userToken.user, treeRepository: "octocat", sha: sha } )
					.returns( when( [ stampHeaders ] ) );

				mocker.github( "gitdata:get-tree", { user: userToken.user, repo: "octocat", sha: sha, recursive: true } )
					.matchHeader( "if-modified-since", stampHeaders.stamp )
					.matchHeader( "if-none-match", stampHeaders.tag )
					.reply( 304 );

				request = api.fetchTreeChanges( userToken.user, "octocat", sha );
			} );

			after( function() {
				resetUserToken();
				stamp.restore();
				mocker.reset();
			} );

			it( "should return the correct results", function( done ) {
				request.then( function( tree ) {
					should( tree ).not.be.ok;
					done();
				} );
			} );

			it( "should not cache the results", function( done ) {
				request.then( function( result ) {
					stamp.callCount.should.equal( 1 );
					done();
				} );
			} );
		} );
	} );

} );
