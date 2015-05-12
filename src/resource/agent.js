var _ = require( "lodash" );
var request = require( "request" );
var postal = require( "postal" );
var channel = postal.channel( "agents" );
var token = require( "../../src/github/token.js" );
var ghtoken = token.read().token;
var commits = postal.channel( "commits" );

var api = {
	list: list,
	register: register,
	agentList: {},
	notifyAgent: notifyAgent
};

commits.subscribe( "#", function( data ) {
	_.each( api.agentList, notifyAgent.bind( undefined, data ) );
} );

function notifyAgent( data, agent ) {
	var json = JSON.stringify( data ),
		options = {
			url: agent.url + "/api/commit",
			method: "post",
			headers: { "content-type": "application/json" },
			body: json
		};
	request.post( options, function( err, response ) {
		if ( err ) {
			console.log( "error reporting commit to agent", agent.url, err );
		} else {
			console.log( "successfully reported commit to agent", agent.url );
		}
	} );
}

function list( envelope ) {
	return api.agentList;
}

function register( envelope ) {
	api.agentList[ envelope.data.name ] = envelope.data;
	channel.publish( "registered", envelope.data );

	return { data: { token: ghtoken } };
}

module.exports = api;
