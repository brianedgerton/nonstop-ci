var _ = require( "lodash" );
var when = require( "when" );
var nodeWhen = require( "when/node" );
var moment = require( "moment" );
var tokenApi = require( "./token.js" );
var ghUser, ghToken;
var GHAPI = require( "github" );
var databass = require( "./store.js" );
var debug = require( "debug" )( "nonstop:github:api" );

var github = new GHAPI( {
	version: "3.0.0",
	debug: false,
	protocol: "https",
	host: "api.github.com",
	timeout: 10000
} );

function authenticateBasic( credentials ) {
	github.authenticate( {
		type: "basic",
		username: credentials.user,
		password: credentials.password
	} );
}

function authenticateToken() {
	readToken();
	debug( "Authenticating to GitHub with OAuth token %s", ghToken );
	github.authenticate( {
		type: "oauth",
		token: ghToken
	} );
}

function checkToken() {
	return tokenApi.check();
}

function createHookFn( url ) {
	return function( org, repository ) {
		var create = nodeWhen.lift( github.repos.createHook );
		return create( {
			user: org,
			repo: repository,
			name: "web",
			events: [ "push", "fork", "create", "delete", "pull request" ],
			active: true,
			config: {
				url: url,
				content_type: "json", // jshint ignore:line
				insecure_ssl: 1 // jshint ignore:line
			}
		} )
			.then( function( data ) {
				debug( "Created new web hook for %s - %s", org, repository );
				databass.watched( org, repository );
				return data;
			}, function( err ) {
					debug( "Error creating web hook for %s - %s: %s", org, repository, err.stack );
					return false;
				} );
	};
}

function createToken( user, options, cb ) {
	var _cb;
	var _options;
	if ( _.isFunction( options ) ) {
		_cb = options;
		_options = {};
	} else {
		_options = options;
		_cb = cb;
	}

	var request = {
		scopes: [ "repo" ],
		note: "Token obtained by nonstop on " + moment( Date.now() ).toLocaleString()
	};

	if ( _options.twoFactorToken ) {
		request.headers = request.headers || {};
		request.headers[ "X-GitHub-OTP" ] = _options.twoFactorToken;
	}

	github.authorization.create( request, function( err, doc ) {
		if ( !err ) {
			tokenApi.write( doc.id, user, doc.token );
		}
		_cb( err, doc );
	} );
}

function fetchHookFn( hookMatch ) {

	return function( org, repository ) {
		var fetch = nodeWhen.lift( github.repos.getHooks );
		return fetch( { user: org, repo: repository } )
			.then( function( data ) {
				var hookExists = _.find( data, function( h ) {
					debug( "Hook for %s - %s found with URL %s", org, repository, h.config.url );
					return h.config.url.indexOf( hookMatch ) >= 0;
				} );
				if ( hookExists ) {
					databass.watched( org, repository );
				}
				return hookExists;
			} );
	};

}

function fetchBranch( org, repository, branch ) {
	var fetch = nodeWhen.lift( github.repos.getBranch );
	return fetch( {
		user: org,
		repo: repository,
		branch: branch
	} );
}

function fetchAllBranches( org, repository ) {
	return fetchBranches( org, repository );
}

function fetchLatestBranches( org, repository ) {
	return when.promise( function( resolve, reject ) {
		getHeadersFor( { organization: org, branchRepository: repository } )
			.then( function( headers ) {
				fetchBranches( org, repository, headers )
					.then( resolve, reject );
			} );
	} );
}

function fetchBranches( org, repository, headers ) {
	var fetch = nodeWhen.lift( github.repos.getBranches );
	return fetch( {
		user: org,
		repo: repository,
		per_page: 100, // jshint ignore:line
		headers: headers
	} )
		.then( null, function( err ) {
			return undefined;
		} )
		.then( function( data ) {
			if ( isUnchanged( data ) ) {
				return undefined;
			} else {
				debug( "Rates limit (branch: %s - %s [%s]): %s remaining: %s", org, repository, JSON.stringify( headers ), data.meta[ "x-ratelimit-limit" ], data.meta[ "x-ratelimit-remaining" ] );
				saveStampFor( { organization: org, branchRepository: repository }, data );
				return data;
			}
		} );
}

function fetchAllRepositories( owner ) {
	return fetchRepositories( owner );
}

function fetchLatestRepositories( owner ) {
	return when.promise( function( resolve, reject ) {
		getHeadersFor( { repositoryOwner: owner } )
			.then( function( headers ) {
				fetchRepositories( owner, headers )
					.then( resolve, reject );
			} );
	} );
}

function fetchRepositories( owner, headers ) {
	var fetchFromUser = nodeWhen.lift( github.repos.getFromUser );
	var fetchFromOrg = nodeWhen.lift( github.repos.getFromOrg );
	var args = owner == ghUser ?
		{ user: ghUser, sort: "updated", type: "all", per_page: 100 } : // jshint ignore:line
		{ org: owner, sort: "updated", per_page: 100 }; // jshint ignore:line
	var fetch = owner == ghUser ? fetchFromUser : fetchFromOrg;
	args.headers = headers;
	return fetch( args )
		.then( function( data ) {
			if ( isUnchanged( data ) ) {
				return undefined;
			} else {
				debug( "Rates limit (repos): %s remaining: %s", data.meta[ "x-ratelimit-limit" ], data.meta[ "x-ratelimit-remaining" ] );
				saveStampFor( { repositoryOwner: owner }, data );
				return data;
			}
		} );
}

function fetchOrgList() {
	return when.all( [
		fetchOrgs(),
		fetchUser()
	] )
		.then( function( list ) {
			var orgs = list[ 0 ].slice();
			orgs.push( list[ 1 ] );
			return orgs;
		} );
}

function fetchOrgs() {
	var key = { orgs: "orglist" };
	var fetch = nodeWhen.lift( github.orgs.getFromUser.bind( github.orgs ) );
	return when.promise( function( resolve, reject ) {
		getHeadersFor( key )
			.then( function( headers ) {
				var args = { user: ghUser, per_page: "100" }; // jshint ignore:line
				args.headers = headers;
				fetch( args )
					.then( null, function( err ) {
						databass.organizations().then( resolve );
					} )
					.then( function( data ) {
						if ( isUnchanged( data ) ) {
							databass.organizations().then( resolve );
						} else {
							debug( "Rates limit (orgs): %s remaining: %s", data.meta[ "x-ratelimit-limit" ], data.meta[ "x-ratelimit-remaining" ] );
							saveStampFor( key, data );
							resolve( data );
						}
					} );
			} );
	} );
}

function fetchUser() {
	var key = { userInfo: ghUser };
	var fetch = nodeWhen.lift( github.user.getFrom.bind( github.user ) );
	return when.promise( function( resolve, reject ) {
		getHeadersFor( key )
			.then( function( headers ) {
				var args = { user: ghUser };
				args.headers = headers;
				fetch( args )
					.then( null, function( err ) {
						databass.user( ghUser ).then( resolve );
					} )
					.then( function( data ) {
						if ( isUnchanged( data ) ) {
							databass.user( ghUser ).then( resolve );
						} else {
							debug( "Rates limit (user): %s remaining: %s", data.meta[ "x-ratelimit-limit" ], data.meta[ "x-ratelimit-remaining" ] );
							saveStampFor( key, data );
							resolve( data );
						}
					} );
			} );
	} );
}

function fetchLatestTree( org, repository, sha ) {
	return fetchTree( org, repository, sha );
}

function fetchTreeChanges( org, repository, sha ) {
	return when.promise( function( resolve, reject ) {
		getHeadersFor( { organization: org, treeRepository: repository, sha: sha } )
			.then( function( headers ) {
				fetchTree( org, repository, sha, headers )
					.then( resolve, reject );
			} );
	} );
}

function fetchTree( org, repository, sha, headers ) {
	var fetch = nodeWhen.lift( github.gitdata.getTree );
	return fetch( {
		user: org,
		repo: repository,
		sha: sha,
		recursive: true,
		headers: headers
	} )
		.then( function( data ) {
			if ( isUnchanged( data ) ) {
				return undefined;
			} else {
				debug( "Rates limit (tree): %s remaining: %s", data.meta[ "x-ratelimit-limit" ], data.meta[ "x-ratelimit-remaining" ] );
				saveStampFor( { organization: org, treeRepository: repository, sha: sha }, data );
				return data;
			}
		} );
}

function getHeadersFor( key ) {
	return databass.stamp( key )
		.then( null, function( err ) {
			return {};
		} )
		.then( function( data ) {
			var headers = {};
			if ( data.length && data[ 0 ].stamp ) {
				headers[ "If-Modified-Since" ] = data[ 0 ].stamp;
			}
			if ( data.length && data[ 0 ].tag ) {
				headers[ "If-None-Match" ] = data[ 0 ].tag;
			}
			return headers;
		} );
}

function isUnchanged( data ) {
	if ( data && data.meta && data.meta.status ) {
		return /^304/.test( data.meta.status );
	} else {
		return false;
	}
}

function readToken() {
	var data = tokenApi.read();
	ghUser = data.user;
	ghToken = data.token;
}

function saveStampFor( key, response ) {
	if ( response.meta ) {
		var etag = response.meta.etag;
		var lastModified = response.meta[ "last-modified" ];
		if ( etag || lastModified ) {
			databass.stamp( key, lastModified, etag );
		}

	}
}

module.exports = function( _config ) {
	var config = _config;

	var nonstopCi = config.nonstop.ci;
	var url = nonstopCi.url || "http://" + config.ngrok.subdomain + ".ngrok.com/api/commit";
	var hookMatch = url.split( "://" )[ 1 ];

	var wrapper = {
		authenticateBasic: authenticateBasic,
		authenticateToken: authenticateToken,
		checkToken: checkToken,
		createHook: createHookFn( url ),
		createToken: createToken,
		fetchBranch: fetchBranch,
		fetchAllBranches: fetchAllBranches,
		fetchLatestBranches: fetchLatestBranches,
		fetchHook: fetchHookFn( hookMatch ),
		fetchAllRepositories: fetchAllRepositories,
		fetchLatestRepositories: fetchLatestRepositories,
		fetchOrganizations: fetchOrgList,
		fetchLatestTree: fetchLatestTree,
		fetchTreeChanges: fetchTreeChanges,
		readToken: readToken,
		writeToken: tokenApi.write
	};

	return wrapper;
};
