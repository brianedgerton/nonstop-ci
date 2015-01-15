var postal = require( "postal" );
var channel = postal.channel( "commits" );
var githubChannel = postal.channel( "github" );
var debug = require( "debug" )( "nonstop:hook" );

function onCommit( commit, host ) {
	debug( "GitHub reporting a commit for %s - %s", commit.repository.owner.name, commit.repository.name );
	channel.publish( "commit", commit );
}

function onFork( fork, host ) {
	debug( "GitHub detected a fork of %s from %s to %s ", fork.forkee.name, fork.forkee.owner.login, fork.repository.owner.login );
	githubChannel.publish( "fork", fork );
}

function onHook( data, host ) {
	debug( "GitHub reported hook creation at %s", data.hook.url );
}

module.exports = function( host ) {
	return {
		name: "commit",
		actions: [
			{
				alias: "new",
				method: "post",
				topic: "new",
				url: "",
				handle: function( envelope ) {
					try {
						if ( envelope.data.forkee ) {
							onFork( envelope.data, host );
						} else if ( envelope.data.hook ) {
							onHook( envelope.data, host );
						} else {
							onCommit( envelope.data, host );
						}
					} catch (err) {
						console.log( err.stack );
					}
					envelope.reply( {} );
				}
			}
		]
	};
};
