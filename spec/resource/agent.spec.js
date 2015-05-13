var should = require( "should" );
var sinon = require( "sinon" );
var postal = require( "postal" );
var request = require( "request" );
var agentChannel = postal.channel( "agents" );
var commitChannel = postal.channel( "commits" );
var handler;
var channel;

describe( "Agent Resource Handler", function() {

	before( function() {
		handler = require( "../../src/resource/agent.js" );
		channel = postal.channel( "commits" );
	} );

	describe( "when listing agents", function() {
		var existingList;
		var sampleList = [ 1, 2, 3 ];
		before( function() {
			existingList = handler.agentList;
			handler.agentList = sampleList;
		} );

		after( function() {
			handler.agentList = existingList;
		} );

		it( "should return the list of agents", function() {
			handler.list().should.eql( sampleList );
		} );

	} );

	describe( "when registering an agent", function() {
		var envelope = {
			data: {
				name: "a new agent",
				url: "http://sendmeyourdata.com"
			}
		};
		var creds = { token: "123" };
		var github = {
			getCredentials: function() {
				return creds;
			}
		};
		var result;
		var response;
		before( function( done ) {
			agentChannel.subscribe( "registered", function( data ) {
				result = data;
				done();
			} );
			response = handler.register( envelope, github );
		} );

		after( function() {
			handler.agentList = {};
		} );

		it( "should publish a registered message", function() {
			result.should.eql( envelope.data );
		} );

		it( "should add the agent to the registered list", function() {
			handler.agentList[ "a new agent" ].should.eql( envelope.data );
		} );

		it( "should include the ghtoken in the response", function() {
			response.should.eql( {
				data: {
					token: "123"
				}
			} );
		} );
	} );

	describe( "when a commit is received", function() {
		var post;
		var commitMsg = {
			repo: "somerepo",
			owner: "sandwiches"
		};
		before( function( done ) {
			handler.agentList = {
				firstAgent: {
					name: "firstAgent",
					url: "http://firstAgent.com"
				},
				secondAgent: {
					name: "secondAgent",
					url: "http://secondAgent.com"
				}
			};

			post = sinon.stub( request, "post" );

			commitChannel.publish( "commit", commitMsg );

			setTimeout( function() {
				done();
			}, 500 );

		} );

		after( function() {
			handler.agentList = {};
		} );

		it( "should notify all agents", function() {
			var options1 = post.getCall( 0 ).args[ 0 ];
			var options2 = post.getCall( 1 ).args[ 0 ];

			var json = JSON.stringify( commitMsg );

			options1.should.eql( {
				url: "http://firstAgent.com/api/commit",
				method: "post",
				headers: { "content-type": "application/json" },
				body: json
			} );

			options2.should.eql( {
				url: "http://secondAgent.com/api/commit",
				method: "post",
				headers: { "content-type": "application/json" },
				body: json
			} );

		} );

	} );

} );
