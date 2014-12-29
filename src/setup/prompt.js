var _ = require( 'lodash' ),
	commander = require( 'commander' ),
	inquire = require( 'inquirer' );

var initialChoices = {
		adminPassword: 'Change admin password',
		createToken: 'Acquire GitHub OAuth token',
		createCredentials: 'Create agent credentials',
		agentToken: 'Retrieve agent token',
		start: 'Start service'
	},
	reverseLookup = {};
_.each( initialChoices, function( val, key ) { reverseLookup[ val ] = key; } );

commander
	.option( '-s, --start', 'Start service immediately' )
	.parse( process.argv );

function adminPrompt( cb ) {
	inquire.prompt( [
		{
			type: 'password',
			name: 'nextPassword',
			message: 'New password'
		},
		{
			type: 'password',
			name: 'confirmPassword',
			message: 'Confirm new password'
		}
	], cb );
}

function credentialsPrompt( cb ) {
	inquire.prompt( [
		{
			type: 'input',
			name: 'user',
			message: 'Agent username'
		},
		{
			type: 'password',
			name: 'password',
			message: 'Agent password'
		}
	], cb );
}

function initiatePrompt( choices, cb ) {
	inquire.prompt( [
		{
			type: 'list',
			name: 'initialization',
			message: 'Please select a task:',
			choices: choices
		}
	], cb );
}

function tokenPrompt( cb ) {
	inquire.prompt( [
		{
			type: 'input',
			name: 'user',
			message: 'GitHub Username'
		},
		{
			type: 'password',
			name: 'password',
			message: 'GitHub Password'
		}
	], cb );
}

module.exports = {
	admin: adminPrompt,
	choices: initialChoices,
	credentials: credentialsPrompt,
	initiate: initiatePrompt,
	lookup: reverseLookup,
	start: commander.start,
	token: tokenPrompt
};