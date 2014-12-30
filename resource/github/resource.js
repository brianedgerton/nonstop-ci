var _ = require( "lodash" );
var when = require( "when" );
var github = require( "../../src/github/store.js" );

module.exports = function( host ) {
	return {
		name: "github",
		actions: [
			{
				alias: "list-org-repositories",
				verb: "get",
				topic: "organization.repositories",
				path: "organization/:org/repository",
				handle: function( envelope ) {
					github.watched( envelope.data.org )
						.then( null, function( err ) {
							envelope.reply( { statusCode: 500, data: { error: err } } );
						} )
						.then( function( data ) {
							var list = [],
								promises = _.map( data, function( x ) {
									return github.repository( x.organization, x.repository )
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
			{
				alias: "list-organizations",
				verb: "get",
				topic: "list.organizations",
				path: "organization",
				handle: function( envelope ) {
					github.watched()
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
		]
	};
};