var handler = require( "../../src/resource/commit" );

module.exports = function( host ) {
	return {
		name: "commit",
		actions: {
			new: {
				method: "post",
				topic: "new",
				url: "/",
				handle: function( envelope ) {
					var response = handler( envelope );
					envelope.reply( response );
				}
			}
		}
	};
};
