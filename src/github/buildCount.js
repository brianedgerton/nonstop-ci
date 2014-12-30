var _ = require( 'lodash' ),
	when = require( 'when' ),
	path = require( 'path' ),
	store = require( './store.js' );

function getCount( projectKey, version, commit ) {
	var count = 0;
	return when.try( function( list ) {
		if( list && list.length > 0 ) {
			count = list[ 0 ].buildCount;	
		}
		return count;
	}, store.buildCount( projectKey, version, commit ) );
}

function nextCount( projectKey, version ) {
	var count = 0;
	return when.try( function( list ) {
		if( list && list.length > 0 ) {
			count = _.max( list, function( x ) { return x.buildCount; } ).buildCount;
		}
		return count + 1;
	}, store.version( projectKey, version ) );
}

function getOrNext( project, version, commit ) {
	return when.try( function( current, next ) {
			return current || next;
		},
		getCount( project, version, commit ),
		nextCount( project, version ) )
		.then( function( count ) {
			setCount( project, version, commit, count );
			return count;
		} );
}

function setCount( projectKey, version, commit, build ) {
	return store.buildCount( projectKey, version, commit, build );
}

module.exports = {
	get: getOrNext,
	set: setCount
};