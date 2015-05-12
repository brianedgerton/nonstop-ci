var should = require( "should" );
var sinon = require( "sinon" );
var postal = require( "postal" );
var handler;
var channel;
var githubChannel;

describe.only( "Commit Resource Handler", function() {

	before( function() {
		handler = require( "../../src/resource/commit.js" );
		channel = postal.channel( "commits" );
		githubChannel = postal.channel( "github" );
	} );

	describe( "when the event was a fork", function() {

		var envelope = {
			data: {
				forkee: {
					name: "somerepo",
					owner: {
						login: "someuser"
					}
				},
				repository: {
					owner: {
						login: "newforkowner"
					}
				}
			}
		};
		var result;
		before( function( done ) {
			githubChannel.subscribe( "fork", function( data ) {
				result = data;
				done();
			} ).once();

			handler( envelope );
		} );

		it( "should publish a message on the github channel", function() {
			result.should.eql( envelope.data );
		} );

	} );

	describe( "when the event was a hook", function() {
		var envelope = {
			data: {
				hook: {}
			}
		};

		var published;

		before( function( done ) {
			published = false;
			githubChannel.subscribe( "fork", function( data ) {
				published = true;
			} ).once();

			channel.subscribe( "commit", function( data ) {
				published = true;
			} ).once();

			handler( envelope );

			setTimeout( function() {
				done();
			}, 500 );

		} );

		it( "should not publish any messages", function() {
			published.should.not.be.ok;
		} );
	} );

	describe( "when the event was a commit", function() {
		var envelope = {
			data: {
				repository: {
					owner: {
						name: "anowner",
						login: "newforkowner"
					}
				}
			}
		};
		var result;
		before( function( done ) {
			channel.subscribe( "commit", function( data ) {
				result = data;
				done();
			} ).once();

			handler( envelope );
		} );

		it( "should publish a message on the github channel", function() {
			result.should.eql( envelope.data );
		} );
	} );

} );
