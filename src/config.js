var path = require( 'path' );

module.exports = require( 'configya' )(
	path.join( process.cwd(), './config.json' ),
	{
		ngrok: {
			token: undefined,
			subdomain: 'my-gh-hook'
		},
		nonstop: {
			ci: {
				port: 8855
			}
		}
	}
);
