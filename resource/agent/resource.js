var _ = require( "lodash" );
var request = require( "request" );
var postal = require( "postal" );
var channel = postal.channel( "agents" );
var token = require( "../../src/github/token.js" );
var ghtoken = token.read().token;
var commits = postal.channel( "commits" );

module.exports = function( host ) {
	var agentList = {};

	commits.subscribe( "#", function( data ) {
		_.each( agentList, function( agent ) {
			var json = JSON.stringify( data ),
				options = {
					url: agent.url + "/api/commit",
					method: "post",
					headers: { "content-type": "application/json" },
					body: json
				};
			request( options, function( err, response ) {
				if ( err ) {
					console.log( "error reporting commit to agent", agent.url, err );
				} else {
					console.log( "successfully reported commit to agent", agent.url );
				}
			} );
		} );
	} );

	return {
		name: "agent",
		actions: [
			{
				alias: "register",
				method: "post",
				topic: "register",
				url: "",
				handle: function( envelope ) {
					console.log( "agent registered", envelope.data );
					agentList[ envelope.data.name ] = envelope.data;
					channel.publish( "registered", envelope.data );
					envelope.reply( { data: { token: ghtoken } } );
				}
			},
			{
				alias: "list",
				method: "get",
				topic: "list",
				url: "",
				handle: function( envelope ) {
					envelope.reply( agentList );
				}
			}
		]
	};
};
