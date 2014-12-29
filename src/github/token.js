var fs = require( 'fs' ),
	path = require( 'path' ),
	tokenPath = path.resolve( process.cwd(), './api-token.json' );

function checkToken() {
	return fs.existsSync( tokenPath );
}

function readToken() {
	var json = fs.readFileSync( tokenPath );
	return JSON.parse( json );
}

function writeToken( id, user, token ) {
	var doc = {
			id: id,
			user: user,
			token: token
		},
		json = JSON.stringify( doc );
	fs.writeFileSync( tokenPath, json );
}

module.exports = {
	check: checkToken,
	read: readToken,
	write: writeToken
};