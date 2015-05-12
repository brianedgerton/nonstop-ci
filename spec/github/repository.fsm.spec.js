var should = require( "should" );
var sinon = require( "sinon" );
var when = require( "when" );
var _ = require( "lodash" );
var machina = require( "machina" );
var config = require( "../../src/config" );
var store = require( "../../src/github/store.js" );
var github = require( "../../src/github/api" )( config );
var repoFsm = require( "../../src/github/repository.fsm" ).bind( undefined, config, github, store );

var org = "myorg";
var repo = require( "../fixtures/repos.json" )[ "from-org" ][ 0 ];
var branch = require( "../fixtures/branch.json" ).specialbranch;
var branchList = require( "../fixtures/branches.json" )[ "all-branches" ];
var machineName = org + ":" + repo.name;

var toIntercept = [ machineName ];

var fsm;

function patchTransition( machine ) {
	machine.transitionForReal = machine.transition;
	machine.transition = sinon.stub( machine, "transition" );
}

function startInterceptor() {
	machina.on( "newfsm", function( machine ) {
		if ( _.contains( toIntercept, machine.name ) ) {
			patchTransition( machine );
		}
	} );
}

function stopInterceptor() {
	machina.off( "newfsm" );
}

describe( "Repository FSM", function() {

	before( function() {
		startInterceptor();
		fsm = repoFsm( org, repo );
	} );

	after( function() {
		stopInterceptor();
	} );

	describe( "when getting a branch", function() {
		var fetch;

		before( function() {
			fetch = sinon.stub( github, "fetchBranch" ).returns( when( branch ) );
			fsm.getBranch();
		} );

		after( function() {
			fetch.restore();
		} );

		it( "should proxy to the github api", function() {
			fetch.getCall( 0 ).args.should.eql( [ org, repo.name, repo.default_branch ] );
			fsm.transition.lastCall.args[ 0 ].should.equal( "fetching-tree" );
		} );

		it( "should set the main branch", function() {
			fsm.mainBranch.should.eql( branch );
		} );

	} );

	describe( "when checking for a build file", function() {
		var originalFiles;
		var trueFilesYaml = [ { path: "index.js" }, { path: "config.json" }, { path: "src/nonstop.yaml" } ];
		var trueFilesJson = [ { path: "index.js" }, { path: "config.json" }, { path: "src/nonstop.json" } ];
		var falseFiles = [ { path: "index.js" }, { path: "config.json" }, { path: "server.js" } ];

		before( function() {
			originalFiles = fsm.files;
		} );

		after( function() {
			fsm.files = originalFiles;
		} );

		it( "should return true if a nonstop yaml file is present", function() {
			fsm.files = trueFilesYaml;
			fsm.hasBuildFile().should.be.ok;
		} );

		it( "should return true if a nonstop json file is present", function() {
			fsm.files = trueFilesJson;
			fsm.hasBuildFile().should.be.ok;
		} );

		it( "should return false if the file is not present", function() {
			fsm.files = falseFiles;
			should( fsm.hasBuildFile() ).not.be.ok;
		} );
	} );

	describe( "on branches", function() {
		describe( "when no data is given", function() {
			var get;
			before( function() {
				get = sinon.stub( fsm, "getBranch" );
			} );
			after( function() {
				get.restore();
			} );
			it( "should try to fetch the branch", function() {
				fsm.onBranches( {} );
				get.called.should.be.ok;
			} );
		} );

		describe( "when branch data is given", function() {

			before( function() {
				fsm.mainBranch = null;
				fsm.onBranches( { branches: branchList } );
			} );

			it( "should find and set the main branch", function() {
				fsm.mainBranch.should.eql( branchList[ 0 ] );
			} );

			it( "should transition to fetching tree", function() {
				fsm.transition.lastCall.args[ 0 ].should.equal( "fetching-tree" );
			} );

		} );
	} );

	describe( "when in fetching-branches state", function() {

		describe( "when branches are found", function() {
			var read;
			var onBranches;
			var localFsm;
			before( function() {
				localFsm = repoFsm( org, repo );
				read = sinon.stub( localFsm.branches, "read" ).returns( when( branchList ) );
				onBranches = sinon.stub( localFsm, "onBranches" );
				localFsm.transitionForReal( "fetching-branches" );
			} );

			after( function() {
				read.restore();
				onBranches.restore();
			} );

			it( "should pass the data to onBranches", function( done ) {
				_.defer( function() {
					onBranches.getCall( 0 ).args[ 0 ].should.eql( branchList );
					done();
				} );
			} );

		} );

		describe( "when no branches are found", function() {
			var read;
			var getBranch;
			var localFsm;
			before( function() {
				localFsm = repoFsm( org, repo );
				read = sinon.stub( localFsm.branches, "read" ).returns( when.reject( new Error( "Oh noes" ) ) );
				getBranch = sinon.stub( localFsm, "getBranch" );
				localFsm.transitionForReal( "fetching-branches" );
			} );

			after( function() {
				read.restore();
				getBranch.restore();
			} );

			it( "should hit the github api", function( done ) {
				_.defer( function() {
					getBranch.called.should.be.ok;
					done();
				} );
			} );
		} );
	} );

	describe( "when in fetching-tree state", function() {

		describe( "when no tree information is available", function() {
			var handle;
			var localFsm;
			before( function() {
				localFsm = repoFsm( org, repo );
				handle = sinon.stub( localFsm, "handle" );
				localFsm.tree = null;
				localFsm.mainBranch = null;
				localFsm.transitionForReal( "fetching-tree" );
			} );

			after( function() {
				handle.restore();
			} );

			it( "should stop", function() {
				handle.called.should.not.be.ok;
			} );

		} );

		describe( "when there is no tree but there is a main branch", function() {
			var handle;
			var localFsm;
			var treeCmd;
			var treeRead;
			before( function() {
				localFsm = repoFsm( org, repo );
				localFsm.tree = null;
				localFsm.mainBranch = {
					commit: {
						sha: "abc123"
					}
				};
				treeRead = sinon.stub().returns( when() );
				treeCmd = sinon.stub( localFsm, "treeCommand" ).returns( {
					read: treeRead
				} );
				handle = sinon.stub( localFsm, "handle" );
				localFsm.transitionForReal( "fetching-tree" );
			} );

			after( function() {
				treeCmd.restore();
				handle.restore();
			} );

			it( "should create the tree from the branch", function() {
				treeCmd.getCall( 0 ).args.should.eql( [
					org,
					repo.name,
					"abc123"
				] );
			} );

			it( "should try to read the tree", function() {
				treeRead.called.should.be.ok;
			} );

		} );

		describe( "when the tree is available", function() {
			var localFsm;
			var treeData = { tree: [ "file1.js", "file2.js" ] };
			before( function() {
				localFsm = repoFsm( org, repo );
				var treeRead = sinon.stub().returns( when( treeData ) );
				localFsm.tree = { read: treeRead };
				localFsm.transitionForReal( "fetching-tree" );
			} );

			it( "should set the repo files", function() {
				localFsm.files.should.eql( treeData.tree );
			} );

			it( "should transition to verifying hook", function() {
				localFsm.transition.lastCall.args[ 0 ].should.equal( "verifying-hook" );
			} );
		} );

		describe( "when the tree read fails", function() {
			var localFsm;
			before( function() {
				localFsm = repoFsm( org, repo );
				var treeRead = sinon.stub().returns( when.reject( new Error( "Your tree is lost" ) ) );
				localFsm.tree = { read: treeRead };
				global.setTimeout = sinon.stub( global, "setTimeout" );
				localFsm.transition.reset();
				localFsm.transitionForReal( "fetching-tree" );
			} );

			after( function() {
				global.setTimeout.restore();
			} );

			it( "should set a timer to attempt another fetch", function() {
				var args = global.setTimeout.getCall( 0 ).args;
				var cb = args[ 0 ];
				args[ 1 ].should.be.greaterThan( 0 );
				localFsm.transition.callCount.should.equal( 0 );

				cb();
				localFsm.transition.callCount.should.equal( 1 );
				localFsm.transition.getCall( 0 ).args[ 0 ].should.equal( "fetching-tree" );
			} );
		} );

	} );

	describe( "when in verifying-hook state", function() {
		describe( "when a build file is not present", function() {
			var localFsm;
			var buildFile;
			before( function() {
				localFsm = repoFsm( org, repo );
				buildFile = sinon.stub( localFsm, "hasBuildFile" ).returns( false );
				localFsm.transitionForReal( "verifying-hook" );
			} );
			it( "should transition to polling", function() {
				localFsm.transition.lastCall.args[ 0 ].should.equal( "polling" );
			} );

		} );

		describe( "when a build file is present", function() {
			var localFsm;
			var hasBuildFile;
			describe( "when the hook is found on the repository", function() {
				var fetchHook;
				before( function() {
					localFsm = repoFsm( org, repo );
					hasBuildFile = sinon.stub( localFsm, "hasBuildFile" ).returns( true );
					fetchHook = sinon.stub( github, "fetchHook" ).returns( when( true ) );
					localFsm.transitionForReal( "verifying-hook" );
				} );
				after( function() {
					fetchHook.restore();
				} );
				it( "should transition to polling", function() {
					localFsm.hasHook.should.be.ok;
					localFsm.transition.lastCall.args[ 0 ].should.equal( "polling" );
				} );
			} );

			describe( "when the hook is not found on the repository", function() {
				var fetchHook;
				var createHook;
				before( function() {
					localFsm = repoFsm( org, repo );
					hasBuildFile = sinon.stub( localFsm, "hasBuildFile" ).returns( true );
					fetchHook = sinon.stub( github, "fetchHook" ).returns( when( false ) );
					createHook = sinon.stub( github, "createHook" ).returns( when( true ) );
					localFsm.hasHook = false;
					localFsm.transitionForReal( "verifying-hook" );
				} );

				after( function() {
					fetchHook.restore();
					createHook.restore();
				} );

				it( "should attempt to create the webhook", function() {
					createHook.getCall( 0 ).args.should.eql( [
						org,
						repo.name
					] );
				} );

				it( "should transition to polling", function() {
					localFsm.transition.lastCall.args[ 0 ].should.equal( "polling" );
				} );
			} );

		} );

	} );

	describe( "when in the polling state", function() {
		var localFsm;
		before( function() {
			localFsm = repoFsm( org, repo );
			localFsm.hasHook = false;
			global.setInterval = sinon.stub( global, "setInterval" );
			localFsm.transitionForReal( "polling" );
		} );
		after( function() {
			global.setInterval.restore();
		} );
		it( "should attempt to fetch branches on a timer", function() {
			var args = global.setInterval.getCall( 0 ).args;
			args[ 1 ].should.be.greaterThan( 1000 );
			localFsm.transition.reset();
			args[ 0 ]();
			localFsm.transition.lastCall.args[ 0 ].should.equal( "fetching-branches" );
		} );
	} );

} );
