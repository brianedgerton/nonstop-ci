var _ = require( "lodash" );
var when = require( "when" );
var store = require( "../../src/github/store.js" );

module.exports = function( host ) {
	return {
		name: "github",
		actions: {
			"list-org-repositories": {
				method: "get",
				topic: "organization.repositories",
				url: "organization/:org/repository",
				handle: function( envelope ) {
					store.watched( envelope.data.org )
						.then( null, function( err ) {
							envelope.reply( { statusCode: 500, data: { error: err } } );
						} )
						.then( function( data ) {
							var list = [],
								promises = _.map( data, function( x ) {
									return store.repository( x.organization, x.repository )
										.then( function( data ) {
											list.push( data[ 0 ].repository );
										} );
								} );
							when.all( promises )
								.done( function() {
									envelope.reply( { data: list } );
								} );
						} );
				}
			},
			"list-organizations": {
				method: "get",
				topic: "list.organizations",
				url: "organization",
				handle: function( envelope ) {
					store.watched()
						.then( null, function( err ) {
							envelope.reply( { statusCode: 500, data: { error: err } } );
						} )
						.then( function( data ) {
							var list = _.map( data, function( x ) {
								return x.organization;
							} );
							envelope.reply( { data: list } );
						} );
				}
			}
		}
	};
};
