var config = require( "./config.js" );
var api = require( "./github/api.js" )( config );
var server = require( "./server.js" )( config );
var prompt = require( "./setup/prompt.js" );
var admin = require( "./setup/admin.js" )( server );
var credentials = require( "./setup/credentials" )( server );

var app = require( "./boot.js" )( {
	server: server,
	api: api,
	prompt: prompt,
	admin: admin,
	credentials: credentials
} );

app.go();