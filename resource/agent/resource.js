var handlers = require( "../../src/resource/agent.js" );

module.exports = function( host, github ) {
	return {
		name: "agent",
		actions: [
			{
				alias: "register",
				method: "post",
				topic: "register",
				url: "",
				handle: function( envelope ) {
					console.log( "agent registered", envelope.data );
					var response = handlers.register( envelope, github );
					envelope.reply( response );
				}
			},
			{
				alias: "list",
				method: "get",
				topic: "list",
				url: "",
				handle: function( envelope ) {
					envelope.reply( handlers.list( envelope ) );
				}
			}
		]
	};
};
