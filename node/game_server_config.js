//Required modules:
const BigNumber = require('bignumber.js');
BigNumber.config({ EXPONENTIAL_AT: 1e+9, DECIMAL_PLACES: 8, ROUNDING_MODE: BigNumber.ROUND_FLOOR });

// *** Game Server Configuration ***

exports.txLogFile = "/var/log/game_server_transactions.log";
exports.txLogFileFormat = "text";
exports.debugLogFile = "/var/log/game_server_debug.log";
exports.debugLogFileFormat = "text";

exports.databaseBackupPath = "./db_backups/"; //path to nightly database backup files archive

exports.rootWebURL = "http://myfruitgame.com";  //the root web server URL from which game assets are served

exports.tokensPerBTC = new BigNumber("10000"); //tokens per Bitcoin rate
exports.autoDeposit = null;//{"balance":"10000000","unconfirmed_balance":0}; //automatic post-account-creation deposit (set to null to use live account values)

exports.allowUnconfirmedDeposit = true; //should uncofirmed Bitcoin deposits be recognized as soon as they appear on the network?
exports.allowUnconfirmedWithdrawal = false; //should withdrawals be allowed if deposits are unconfirmed? (false is highly recommended).
exports.depositCheckInterval = 20; //the number of seconds required to elapse between successive external deposit check API calls

exports.adminEmails = ["patrickbayca@gmail.com", "james@markdalemanagement.com"];
exports.largeWithdrawalNotificationEmails = ["patrickbayca@gmail.com", "james@markdalemanagement.com"];

//maximum withdrawal limits and related settings
exports.maxWithdrawal = {
	//maximum unapproved BTC withdrawal amount (up to and including)
	"btc": new BigNumber("2"),
	//contacts to notify of large withdrawal(s) request
	"emails": exports.largeWithdrawalNotificationEmails;
}

//accounts used for withdrawals that exceed original deposit amount (bankroll accounts)
exports.withdrawalAccounts = [
	{
		"type":"btc",
		"account":"1HjSwXFqL4B2GWB6Umt34PX9R69xvPRzUz", 
		"privateKey":"c3b2f4aabb1c9e7a2174f45466ca55dbf58885eec6b88f0a4cb68d7c18fe0bc9",
		"publicKey":"0272f3649c2c94d565e649a5245d07b9196d01c6ce82bcf0e56b774464a061cac9",
		"wif":"L3n8AF1T3efSHM7eP3E3P5QZbhkhir39bDsJzUn2neBCSk1YoSUC"
	},
	{	
		"type":"tbtc",
		"account":"mqyyssSuQ4tV2mfYuXtcZJ6tXhtKqdr6sX", 
		"privateKey":"8cb2b97c38e7162c7b9b4d17bdb34850330c7247a02fe6d7e0a8b3fe55ece11a",
		"publicKey":"03d92345040e56fa8399d299501824e2c4677e2e031f2988fc0174cb288248a4ae",
		"wif":"cSJCaYkib6zseyntVzeXHau1j8hNgG2epLYDCAEWi2oH58bkEEqX"
	}
]; 

exports.getNextWithdrawalAccount = (accountType) => {
	for (var count=0; count < exports.withdrawalAccounts.length; count++) {
		var currentAccount = exports.withdrawalAccounts[count]
		if (currentAccount.type == accountType) {
			//simply return the first match for now (using an index we can rotate through active accounts)
			return (currentAccount);
		}
	}
}

//external API access information such as tokens
exports.APIInfo={
	"blockcypher":
		{"token":"fb7cf8296b9143a889913b1ce43688aa",
		//or "btc/main", "btc/test3"
		"network":"btc/test3",
		//default miner fee in Satoshis (must be a BigNumber!)
		"minerFee": new BigNumber("55000")}
}; 

//Available game definition paths:
exports.gameConfigPaths = [
					"../html/common/game_configs/game_info_0001.json"
					]
exports.gameConfigs = new Object(); //populated with data loaded from files specified in 'gameConfigPaths'

//Log settings:
exports._log_prefix = ""; //game server log information prefix
exports._log_include_timestamp = true; //include a timestamp in the game server log information?

//JSON-RPC server options:
exports.rpc_options = {
  // Port that RPC server will listen on
  port: 8090,
  //Maximum number of batch JSON-RPC requests (more than this results in a JSONRPC_INTERNAL_ERROR error.
  max_batch_requests: 5,
  //Default response headers:
  headers: [
	{"Access-Control-Allow-Origin" : "*"},
	{"Content-Type" : "application/json"}
  ]
}

//Standards JSON-RPC error return code definitions:
exports.JSONRPC_PARSE_ERROR = -32700; // Parse error. Invalid JSON was received by the server. An error occurred on the server while parsing the JSON text.
exports.JSONRPC_REQUEST_ERROR = -32600; // Invalid Request. The JSON sent is not a valid Request object.
exports.JSONRPC_METHOD_NOT_FOUND_ERROR = -32601; // Method not found. The method does not exist / is not available.
exports.JSONRPC_INVALID_PARAMS_ERROR = -32602; // Invalid params. Invalid method parameter(s).
exports.JSONRPC_INTERNAL_ERROR = -32603; // Internal error. Internal JSON-RPC error.
//Custom JSON-RPC error return code definitions (-32000 to -32099):
exports.JSONRPC_SQL_ERROR = -32001; // Database error. The database responded with an error.
exports.JSONRPC_SQL_NO_RESULTS = -32002; // Database error. The query returned no results.
exports.JSONRPC_GAME_CONFIG_ERROR = -32003; // Game configuration error. The game does not exist or is misconfigured.
exports.JSONRPC_GAME_ACTION_ERROR = -32004; // Game action error. Invalid or disallowed game action requested.
exports.JSONRPC_API_ERROR = -32005; // API error. The game server encountered an external API error.
exports.JSONRPC_AUTH_ERROR = -32006; // Authentication error. Either the supplied username and/or password was incorrect.
exports.JSONRPC_ACCOUNT_ERROR = -32007; // Account error. The associated account cannot be used for this action (see included error message).
exports.JSONRPC_ACTION_ERROR = -32008; // Non-game action error. Invalid or disallowed non-game action requested.
