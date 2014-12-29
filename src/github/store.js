var fs = require( 'fs-extra' );
fs.mkdirpSync( './data' );

var path = require( 'path' ),
	when = require( 'when' ),
	nodefn = require( 'when/node' ),
	_ = require( 'lodash' ),
	Datastore = require( 'nedb' ),
	getPath = function( name ) {
		return path.join( process.cwd(), 'data', name ) + '.db';
	},
	orglist = wrap( new Datastore( { filename: getPath( 'orgs' ), autoload: true } ) ),
	user = wrap( new Datastore( { filename: getPath( 'owner' ), autoload: true } ) ),
	repositories = wrap( new Datastore( { filename: getPath( 'repos' ), autoload: true } ) ),
	contents = wrap( new Datastore( { filename: getPath( 'contents' ), autoload: true } ) ),
	stamps = wrap( new Datastore( { filename: getPath( 'stamps' ), autoload: true } ) ),
	versions = wrap( new Datastore( { filename: getPath( 'versions' ), autoload: true } ) ),
	watched = wrap( new Datastore( { filename: getPath( 'watched' ), autoload: true } ) ),
	commits = wrap( new Datastore( { filename: getPath( 'history' ), autoload: true } ) );

function wrap( db ) {
	return {
		remove: nodefn.lift( db.remove ).bind( db ),
		find: nodefn.lift( db.find ).bind( db ),
		insert: nodefn.lift( db.insert ).bind( db ),
		update: nodefn.lift( db.update ).bind( db )
	};
}

function purge( db, key, all ) {
	return db.remove( key, { multi: all } );
}

function fetch( db, pattern, map ) {
	map = map || function( x ) {
		return x;
	};
	return when.try( map, db.find( pattern ) );
}

function insert( db, doc ) {
	return db.insert( doc );
}

function update( db, pattern, change ) {
	return db.update( pattern, change, {} );
}

function upsert( db, pattern, doc ) {
	return db.update( pattern, doc, { upsert: true } );
}

function organizations( list ) {
	if ( list ) {
		return upsert( orglist, {}, list );
	} else {
		return fetch( orglist, {} );
	}
}

function user( owner, data ) {
	if ( data ) {
		return upsert( user, { user: owner }, data );
	} else {
		return fetch( user, { user: owner } );
	}
}

function repository( organization, repositoryName, commit ) {
	if ( commit ) {
		return when.all( [
			update( repositories,
				{ organization: organization, 'repository.name': repositoryName },
				{ $set: { 'repository.lastCommit': commit } } ),
			insert( commits,
				{ organization: organization, repository: repositoryName, commit: commit } )
		] );
	} else {
		return fetch( repositories, { organization: organization, 'repository.name': repositoryName } );
	}
}

function repositoryList( organization, list ) {
	if ( list ) {
		var promises = _.map( list, function( repository ) {
			return upsert( repositories,
				{ 'repository.name': repository.name },
				{
					organization: organization,
					repository: repository,
					pulled: Date.now()
				} );
		} );
		return when.all( promises );
	} else {
		return fetch( repositories, { organization: organization }, function( docs ) {
			return _.map( docs, function( doc ) {
				return doc.repository;
			} );
		} );
	}
}

function branches( organization, repository, branchList ) {
	if ( branchList ) {
		return update(
			repositories,
			{ 'repository.name': repository, organization: organization },
			{ $set: { 'repository.branches': branchList } }
		);
	} else {
		return fetch( repositories, { organization: organization, 'repository.name': repository }, function( docs ) {
			return _.map( docs, function( doc ) {
				return doc.repository.branches;
			} );
		} );
	}
}

function tree( organization, repository, sha, treeData ) {
	if ( treeData ) {
		return upsert( contents,
			{ organization: organization, repository: repository, sha: sha },
			{
				organization: organization,
				repository: repository,
				sha: sha,
				tree: treeData
			}
		);
	} else {
		return fetch( contents, { organization: organization, repository: repository, sha: sha } );
	}
}

function stamp( key, value, tag ) {
	if ( value || tag ) {
		var doc = _.merge( { stamp: value, tag: tag }, key );
		return upsert( stamps, key, { $set: { stamp: value, tag: tag } } );
	} else {
		return fetch( stamps, key );
	}
}

function watchList( organization, repository ) {
	if ( !organization ) {
		return fetch( watched, {} );
	} else if ( !repository ) {
		return fetch( watched, { organization: organization } );
	} else {
		return upsert( watched, { organization: organization, repository: repository }, { organization: organization, repository: repository } );
	}
}

function eraseCount( projectKey, projectVersion, commit ) {
	var key = { project: projectKey, version: projectVersion };
	if ( commit ) {
		key.commit = commit;
	}
	return purge( versions, key, true );
}

function buildCount( projectKey, projectVersion, commit, buildNumber ) {
	var key = { project: projectKey, version: projectVersion, commit: commit };
	if ( buildNumber ) {
		return upsert( versions, key,
			{ project: projectKey, version: projectVersion, commit: commit, buildCount: buildNumber } );
	} else {
		return fetch( versions, key );
	}
}

function version( projectKey, projectVersion ) {
	var key = { project: projectKey, version: projectVersion };
	return fetch( versions, key );
}

module.exports = {
	organizations: organizations,
	repository: repository,
	repositories: repositoryList,
	branches: branches,
	tree: tree,
	stamp: stamp,
	watched: watchList,
	buildCount: buildCount,
	eraseCount: eraseCount,
	version: version
};