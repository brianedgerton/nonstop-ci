var should = require( "should" );
var sinon = require( "sinon" );
var fs = require( "fs" );
var tokenUtil = require( "../../src/github/token.js" );
var tokenFile = process.cwd() + "/api-token.json";
describe( "Token Utility", function() {

	describe( "when reading a token", function() {
		it( "should return parsed JSON", function() {
			var expected = { something: true };
			var read = sinon.stub( fs, "readFileSync" ).returns( JSON.stringify( expected ) );

			var token = tokenUtil.read();
			token.should.eql( expected );
			read.lastCall.args[ 0 ].should.equal( tokenFile );
			read.restore();
		} );
	} );

	describe( "when writing a token", function() {
		it( "should write a JSON string to file", function() {
			var creds = { id: 123, user: "someuser", token: "sometoken" };
			var write = sinon.stub( fs, "writeFileSync" );

			tokenUtil.write( creds.id, creds.user, creds.token );

			write.lastCall.args.should.eql( [ tokenFile, JSON.stringify( creds ) ] );

			write.restore();
		} );
	} );

	describe( "when checking a token file", function() {
		it( "should return the result whether or not the file exists", function() {
			var exists = sinon.stub( fs, "existsSync" ).returns( true );
			tokenUtil.check().should.be.ok;
			exists.lastCall.args[ 0 ].should.equal( tokenFile );
			exists.restore();
		} );
	} );

} );
