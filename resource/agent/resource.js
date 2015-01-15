var _ = require( "lodash" );
var request = require( "request" );
var postal = require( "postal" );
var channel = postal.channel( "agents" );
var token = require( "../../src/github/token.js" );
var ghtoken = token.read().token;
var commits = postal.channel( "commits" );
var buildCount = require( "../../src/github/buildCount.js" );

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

	function getProjectId( data ) {
		return [ data.owner, data.project, data.branch ].join( "/" );
	}

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
			},
			{
				alias: "get-build",
				method: "get",
				topic: "get.build",
				url: "build/:owner/:project/:branch/:version/:commit",
				handle: function( envelope ) {
					var data = envelope.data,
						projectId = getProjectId( data ),
						commit = data.commit,
						version = data.version;
					buildCount.get( projectId, version, commit )
						.then( function( count ) {
							envelope.reply( { data: { count: count } } );
						} )
						.then( null, function( err ) {
							envelope.reply( { statusCode: 500, data: err } );
						} );
				}
			},
			{
				alias: "set-build",
				method: "post",
				topic: "set.build",
				url: "build/",
				handle: function( envelope ) {
					var projectId = getProjectId( envelope ),
						data = envelope.data,
						commit = data.commit,
						version = data.version,
						count = data.buildCount;
					buildCount.set( projectId, version, commit, count )
						.then( function( count ) {
							envelope.reply( { data: { count: count } } );
						} )
						.then( null, function( err ) {
							envelope.reply( { statusCode: 500, data: err } );
						} );
				}
			}
		]
	};
};
