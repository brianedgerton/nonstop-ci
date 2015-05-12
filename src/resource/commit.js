var postal = require( "postal" );
var channel = postal.channel( "commits" );
var githubChannel = postal.channel( "github" );
var debug = require( "debug" )( "nonstop:hook" );

function onCommit( commit ) {
	debug( "GitHub reporting a commit for %s - %s", commit.repository.owner.name, commit.repository.name );
	channel.publish( "commit", commit );
}

function onFork( fork ) {
	debug( "GitHub detected a fork of %s from %s to %s ", fork.forkee.name, fork.forkee.owner.login, fork.repository.owner.login );
	githubChannel.publish( "fork", fork );
}

function onHook( data ) {
	debug( "GitHub reported hook creation at %s", data.hook.url );
}

function handler( envelope ) {
	try {
		if ( envelope.data.forkee ) {
			onFork( envelope.data );
		} else if ( envelope.data.hook ) {
			onHook( envelope.data );
		} else {
			onCommit( envelope.data );
		}
	} catch (err) {
		console.log( err.stack );
	}

	return {};
}

module.exports = handler;
