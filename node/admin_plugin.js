var fs = require("fs"); //standard filesystem module
var path = require("path"); //standard path resolution module
var db = require("./db.js"); //MySQL database
const plugins = require("./plugins.js"); //plugins manager
const querystring = require('querystring');
const filesystem = require('fs');
const http = require("http");
const request = require("request");
const crypto = require ("crypto");
const aesjs = require("aes-js");
const BigNumber = require('bignumber.js');
BigNumber.config({ EXPONENTIAL_AT: 1e+9, DECIMAL_PLACES: 8});
BigNumber.prototype.lessThan = BigNumber.prototype.isLessThan;
BigNumber.prototype.greaterThan = BigNumber.prototype.isGreaterThan;
BigNumber.prototype.greaterThanOrEqualTo = BigNumber.prototype.isGreaterThanOrEqualTo;
BigNumber.prototype.lessThanOrEqualTo = BigNumber.prototype.isLessThanOrEqualTo;
BigNumber.prototype.equals = BigNumber.prototype.isEqualTo;
BigNumber.prototype.add = BigNumber.prototype.plus;
const bitcoin = require('bitcoinjs-lib');
const bip32 = require('bip32-utils');

//Global game server configuration:
var serverConfig = require("./game_server_config.js");


var trace = function(msg){console.log("   "+msg);}; //trace function (formatted console.log output); should be replaced when "start" is invoked

exports.pluginInfo = {
	"name":"Administration Plugin",
	"description":"Provides administrative site-wide functionality",
	"version":"1.0",
	"rpc":[
		{
			external : "admin_getRakeStats",
			internal : "rpc_getRakeStats"
		},
		{
			external : "admin_getAccounts",
			internal : "rpc_getAccounts"
		},
		{
			external : "admin_transferAccountFunds",
			internal : "rpc_transferAccountFunds"
		}
	],
	"dbschema":{},
	"onInstallCallback":null,
	"activeInstalls":0
}

exports.install = (onInstallCallback) => {	
	trace ("Triggered install process in "+exports.pluginInfo.name);
	exports.pluginInfo.onInstallCallback = onInstallCallback;
	db.connect(exports.onDBConnect, exports.onDBConnectFail);
}

exports.onDBConnect = (connection) => {
	trace ("Install has successfully connected to the database.");
	for (var tableName in exports.pluginInfo.dbschema) {
		var tableSchema = exports.pluginInfo.dbschema[tableName];
		for (var columnName in tableSchema) {
			var columnType = tableSchema[columnName];
			exports.pluginInfo.activeInstalls++;
			exports.createColumn (columnName, columnType, connection, global.database_name, tableName);
		}
	}	
}

exports.onDBConnectFail = () => {
	exports.pluginInfo.onInstallCallback(false, "Could not establish connection to database.");
}

exports.onCreateColumn = () => {	
	exports.pluginInfo.activeInstalls--;	
	if (exports.pluginInfo.activeInstalls == 0) {
		db.closeAll();
		exports.pluginInfo.onInstallCallback(true, exports.pluginInfo);
	}
}

exports.createColumn = (columnName, columnSchema, connection, databaseName, tableName) => {
	console.log("   Attempting to create new column: \""+columnName+"\" ("+JSON.stringify(columnSchema)+")");	
	connection.query("ALTER TABLE `"+databaseName+"`.`"+tableName+"` ADD `"+columnName+"` " + columnSchema.toString(), function(error, result, fields) {
		if (error==null) {
			console.log ("      Column \"" + columnName + "\" successfully created on table \"" + tableName + "\".");
		} else if (error.toString().indexOf("ER_DUP_FIELDNAME") > -1) {
			console.log ("      Column \"" + columnName + "\" already exists on table \"" + tableName + "\". Skipping.");
		} else {
			console.log ("      Error creating column \""+columnName+"\" on table \"" + tableName + " \": "+error);
		}
		exports.onCreateColumn();
	});	
}

exports.onInstallComplete = () => {
	trace ("onInstallComplete!");
	exports.onInstallCallback (true, "Database successfully set up.");
}


exports.start = (traceFunc) => {
	trace = traceFunc;
	trace (exports.pluginInfo.name+" v "+exports.pluginInfo.version+" started."); 
}

function checkParameter (requestData, param) {
	if ((requestData["params"] == null) || (requestData["params"] == null)) {
		return (false);		
	}
	if (requestData.params[param] == undefined) {		
		return (false);
	}
	return (true);
}

var rpc_getRakeStats = function* (postData, requestObj, responseObj, batchResponses, replyResult, replyError) {
	var generator = yield;
	var requestData = JSON.parse(postData);		
	var responseData = new Object();		
	var rakeQueryResult = yield db.query("SELECT * FROM `gaming`.`investment_txs` WHERE `account`=\"RAKE_ACCOUNT\" ORDER BY `last_update` DESC", generator);	
	if (rakeQueryResult.error != null) {
		trace ("Database error on rpc_getRakeStats: "+rakeQueryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
		return;
	}
	responseData.transactions = new Array();
	for (var count=0; count<rakeQueryResult.rows.length; count++) {
		var txObj = new Object();
		txObj.name = rakeQueryResult.rows[count].name;
		txObj.timestamp = rakeQueryResult.rows[count].last_update;
		txObj.investments = JSON.parse(rakeQueryResult.rows[count].investments);
		responseData.transactions.push(txObj);
	}
	global.assertAnyValue("Infinity", "0", responseData);
	global.assertAnyValue("NaN", "0", responseData);	
	replyResult(postData, requestObj, responseObj, batchResponses, responseData);	
}
exports.rpc_getRakeStats = rpc_getRakeStats;

var rpc_getAccounts = function* (postData, requestObj, responseObj, batchResponses, replyResult, replyError) {
	var generator = yield;
	var requestData = JSON.parse(postData);	
	if (checkParameter(requestData, "type") == false) {
		trace ("Database error on rpc_getAccounts: "+rakeQueryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "Required parameter \"type\" not found.");
		return;
	}
	var responseData = new Object();
	var accountTypes = requestData.params.type.split(",");
	for (var count = 0; count < accountTypes.length; count++) {
		switch (accountTypes[count].split(" ").join("")) {
			case "havebalance":
				//var SQL = "SELECT * FROM `gaming`.`accounts` WHERE `btc_balance_available`=\"0\" AND `deposit_complete`=1 AND `btc_deposit_account` IS NULL AND `index` IN (SELECT MAX(`index`) FROM `gaming`.`accounts` GROUP BY `btc_account`)";
				var SQL = "SELECT * FROM `gaming`.`accounts` WHERE `deposit_complete`=1 AND (`btc_balance_available`!=\"0\" OR `btc_balance_verified`!=\"0\") AND `index` IN (SELECT MAX(`index`) FROM `gaming`.`accounts` GROUP BY `btc_account`)";
				var accountsQueryResult = yield db.query(SQL, generator);	
				if (accountsQueryResult.error != null) {
					trace ("Database error on rpc_getAccounts: "+accountsQueryResult.error);
					trace ("   Request ID: "+requestData.id);
					replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
					return;
				}
				responseData.accounts = new Array();
				for (var count1 = 0; count1 < accountsQueryResult.rows.length; count1++) {
					var currentResult = accountsQueryResult.rows[count1];
					var accountObj = new Object();
					accountObj.btc_account = currentResult.btc_account;
					accountObj.btc_balance_verified = currentResult.btc_balance_verified;
					accountObj.last_login = currentResult.last_login;
					accountObj.affiliate = currentResult.affiliate;
					accountObj.email = currentResult.email;
					accountObj.last_deposit_check = currentResult.last_deposit_check;
					responseData.accounts.push(accountObj);
				}
				break;
			case "wallets":
				responseData.wallets = new Array();
				for (var count1 = 0; count1 < serverConfig.withdrawalAccounts.length; count1++) {
					var accountObj = new Object();
					if ((serverConfig.APIInfo.blockcypher.network == "btc/test3") && (serverConfig.withdrawalAccounts[count1].type == "tbtc")) {
						//testnet
						accountObj.btc_account = serverConfig.withdrawalAccounts[count1].account;
						responseData.wallets.push(accountObj);
					} else if (serverConfig.APIInfo.blockcypher.network == "btc/main") {
						accountObj.btc_account = serverConfig.withdrawalAccounts[count1].account;
						responseData.wallets.push(accountObj);
					}

				}
				break;
			case "coldstorage":
				responseData.coldstorage = new Array();
				for (var count1 = 0; count1 < serverConfig.coldStorageAccounts.length; count1++) {
					accountObj = new Object();
					if ((serverConfig.APIInfo.blockcypher.network == "btc/test3") && (serverConfig.coldStorageAccounts[count1].type == "tbtc")) {
						//testnet
						accountObj.btc_account = serverConfig.coldStorageAccounts[count1].account;
						responseData.coldstorage.push(accountObj);
					} else if (serverConfig.APIInfo.blockcypher.network == "btc/main") {
						accountObj.btc_account = serverConfig.coldStorageAccounts[count1].account;
						responseData.coldstorage.push(accountObj);
					}
				}
				break;
			default: 
				replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "Unrecognized accounts type: \""+accountTypes[count].split(" ").join("")+"\"");
				return;
				break;
		}
	}
	replyResult(postData, requestObj, responseObj, batchResponses, responseData);	
}
exports.rpc_getAccounts = rpc_getAccounts;

var rpc_transferAccountFunds = function* (postData, requestObj, responseObj, batchResponses) {
	var generator = yield;
	var requestData = JSON.parse(postData);
	//---- VERIFY PARAMETERS ----	
	checkParameter(requestData, "account");	
	checkParameter(requestData, "btc");	
	checkParameter(requestData, "receiver");
	var returnData = new Object();
	var queryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `btc_account`=\""+requestData.params.account+"\" ORDER BY `index` DESC LIMIT 1", generator);
	if (queryResult.error != null) {
		trace ("Database error on rpc_transferAccountFunds: "+queryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when processing the request.");
		return;
	}
	if (queryResult.rows.length == 0) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_NO_RESULTS, "Account \""+requestData.params.account+"\" was not found.");
		return;
	}
	//---- SET UP MAIN ACCOUNT VARIABLES ----
	var currentBTCBalance = new BigNumber(queryResult.rows[0].btc_balance_verified);
	var currentAvailBTCBalance = new BigNumber(queryResult.rows[0].btc_balance_available);
	var satoshiPerBTC = new BigNumber("100000000");
	var currentSatoshiBalance = currentBTCBalance.times(satoshiPerBTC);
	var currentAvailSatoshiBalance = currentAvailBTCBalance.times(satoshiPerBTC);
	currentAvailBTCBalance = currentAvailBTCBalance.minus(serverConfig.APIInfo.blockcypher.minerFee.dividedBy(satoshiPerBTC)); //subtract miner fee
	currentAvailSatoshiBalance = currentAvailSatoshiBalance.minus(serverConfig.APIInfo.blockcypher.minerFee);
	//var withdrawalBTC = new BigNumber(queryResult.rows[0].btc_balance_verified); //withdraw full amount according to our records
	var withdrawalBTC = new BigNumber(requestData.params.btc); //withdraw amount specified by admin interface (may not match our records!)
	//withdrawalBTC = withdrawalBTC.minus(new BigNumber("0.00000001")); //subtract 1 satoshi miner's fee
	withdrawalBTC = withdrawalBTC.minus(serverConfig.APIInfo.blockcypher.minerFee.dividedBy(satoshiPerBTC)); //subtract standard miner's fee
	var withdrawalSatoshis = withdrawalBTC.times(satoshiPerBTC);
	var extraData = JSON.parse(querystring.unescape(queryResult.rows[0].extra_data));
	wif = extraData.wif;
	txSkeleton = yield getTxSkeleton (generator, queryResult.rows[0].btc_account, requestData.params.receiver, withdrawalSatoshis.toString(10));
	trace ("  Created transaction skeleton:");
	trace(" ");
	trace(JSON.stringify(txSkeleton));
	trace(" ");
	if ((txSkeleton == undefined) || (txSkeleton == null)) {
		trace ("      Transaction skeleton couldn't be created.");
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_GAME_ACTION_ERROR, "There was a problem creating the transaction skeleton.");
		return;
	}
	if ((txSkeleton["error"] != null) && (txSkeleton["error"] != undefined) && (txSkeleton["error"] != "")) {
		trace ("      Error creating transaction skeleton: "+txSkeleton.error);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_GAME_ACTION_ERROR, "There was a problem creating the transaction.", txSkeleton.error);
		return;
	}
	var signedTx = signTxSkeleton (txSkeleton, wif);
	if (signedTx == null) {
		trace ("      Error signing transaction skeleton.");
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_GAME_ACTION_ERROR, "There was a problem signing the transaction.");
		return;
	}
	if (signedTx["errors"] != null) {
		trace ("      Error creating transaction: "+signedTx.errors[0].error);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_GAME_ACTION_ERROR, "There was a problem creating the transaction: \n\n"+signedTx.errors[0].error);
		return;
	}
	trace ("  Signed transaction:");
	trace(" ");
	trace(JSON.stringify(signedTx));
	trace(" ");
	var sentTx = yield sendTransaction(generator, signedTx);
	trace ("      Posted transaction: "+JSON.stringify(sentTx));
	trace(" ");
	trace(JSON.stringify(sentTx));
	trace(" ");
	returnData = sentTx;
	if ((sentTx["tx"] != undefined) && (sentTx["tx"] != null)) {
		if ((sentTx.tx["hash"] != null) && (sentTx.tx["hash"] != undefined) && (sentTx.tx["hash"] != "") && (sentTx.tx["hash"] != "NULL")) {
			var btcBalanceVerified = currentBTCBalance.minus(withdrawalBTC);
			btcBalanceVerified = btcBalanceVerified.minus(serverConfig.APIInfo.blockcypher.minerFee.dividedBy(satoshiPerBTC));
			if (btcBalanceVerified.lessThan(0)) {
				//more than original deposit withdrawn (via bankroll account)
				btcBalanceVerified = new BigNumber(0);
			}
			//reset the database entry
			//var dbUpdates = "`btc_balance_available`=\"0\",";	
			var dbUpdates =  "`btc_balance_verified`=\"0\",";
			dbUpdates += "`btc_deposit_account`=\""+requestData.params.receiver+"\",";
			dbUpdates += "`last_login`=NOW()";
			//update gaming.accounts
			global.logTx("   New confirmed balance in Bitcoin: "+currentBTCBalance.toString(10));
			//global.logTx("   New availabble balance in Bitcoin: "+btcBalanceVerified.toString(10));
			var txInfo = new Object();
			txInfo.type = "withdrawal";
			txInfo.subType = "internal";
			txInfo.info = new Object();
			txInfo.info.btc = withdrawalBTC.toString(10);
			var accountUpdateResult = yield global.updateAccount(queryResult, dbUpdates, txInfo, generator);
		}
	}
	replyResult(postData, requestObj, responseObj, batchResponses, returnData);
}
exports.rpc_transferAccountFunds = rpc_transferAccountFunds;

/**
* Returns a new Bitcoin transaction skeleton object from the BlockCypher API.
*
* @param generator The generator function to invoke when the asynchronous operation completes.
* @param fromAddr The sending address.
* @param toAddr The receiving address.
* @param sathoshis The number of satoshis to send in the transaction.
*/
function getTxSkeleton (generator, fromAddr, toAddr, sathoshis) {
	request({
		url: "https://api.blockcypher.com/v1/"+serverConfig.APIInfo.blockcypher.network+"/txs/new?token="+serverConfig.APIInfo.blockcypher.token,
		method: "POST",
		body:{"inputs":[{"addresses":[fromAddr]}], "outputs":[{"addresses":[toAddr], "value": Number(sathoshis)}], "fees":Number(serverConfig.APIInfo.blockcypher.minerFee.toString(10))},
		json: true  
	}, function (error, response, body){
		generator.next(body);
	});
	/*
	request({
		url: "https://api.blockcypher.com/v1/"+serverConfig.APIInfo.blockcypher.network+"/txs/new?token="+serverConfig.APIInfo.blockcypher.token,
		method: "POST",
		body:{"inputs":[{"addresses":[fromAddr]}], "outputs":[{"addresses":[toAddr], "value": Number(sathoshis)}], "fees":1},
		json: true  
	}, function (error, response, body){
		generator.next(body);
	});
	*/
}

/**
* Signs a transaction skeleton as generated by the BlockCypher API.
*
* @param txObject The skeleton transaction object generated by BlockCypher with transactions to sign.
* @param signingWIF The Wallet Import Format data to use for signing.
*
* @return The signed skeleton transaction object that may now be sent to the network.
*/
function signTxSkeleton (txObject, signingWIF) {
	if (serverConfig.APIInfo.blockcypher.network == "btc/test3") {
		//testnet
		var key = new bitcoin.ECPair.fromWIF(signingWIF, bitcoin.networks.testnet);
	} else {
		//main network
		key = new bitcoin.ECPair.fromWIF(signingWIF);
	}
	var pubkeys = [];
	try {
		var signatures  = txObject.tosign.map(function(tosign) {
			pubkeys.push(key.getPublicKeyBuffer().toString('hex'));
			return key.sign(Buffer.from(tosign, "hex")).toDER().toString("hex");
		});
		txObject.signatures  = signatures;
		txObject.pubkeys     = pubkeys;
	} catch (err) {
		txObject = null;
	}
	return (txObject);
}

/**
* Sends a raw, signed, skeleton Bitcoin transaction to the network via the BlockCypher API.
*
* @param generator The generator function to call when the asynchronous operation has completed.
* @param txObject The transaction to send.
*/
function sendTransaction(generator, txObject) {
	request({
		url: "https://api.blockcypher.com/v1/"+serverConfig.APIInfo.blockcypher.network+"/txs/send?token="+serverConfig.APIInfo.blockcypher.token,
		method: "POST",
		body: txObject,
		json: true    
	}, function (error, response, body){
		generator.next(body);
	});
}

/**
*
* @param postData The POST data included with the request.
* @param requestObj The request object (https://nodejs.org/api/http.html#http_class_http_incomingmessage).
* @param requestObj The response object (https://nodejs.org/api/http.html#http_class_http_serverresponse).
* @param batchResponses An object containing expected responses for a batch. If null, this function is not being called as part of a batch. Usually the contents of this
* 			object are handled by the HTTP request processor and responder and so should not be updated.
* @param code A Number that indicates the error type that occurred. This MUST be an integer.
* @param message A String providing a short description of the error. The message SHOULD be limited to a concise single sentence.
* @param data A Primitive or Structured value that contains additional information about the error. This may be omitted.
* The value of this member is defined by the Server (e.g. detailed error information, nested errors etc.).
*/
function replyError(postData, requestObj, responseObj, batchResponses, code, message, data) {	
	trace ("replyError: "+code+" "+message);
	try {
		var requestData=JSON.parse(postData);
	} catch (err) {
		requestData = new Object();
	}
	var responseData = new Object();
	responseData.jsonrpc = "2.0";
	if ((requestData["id"] == null) || (requestData["id"] == undefined)) {
		responseData.id = null;
	} else {
		responseData.id = requestData.id;
	}
	responseData.error = new Object();
	responseData.error.code = code;
	responseData.error.message = message;
	if (data != undefined) {
		responseData.error.data = data;
	}
	if (batchResponses != null) {			
		batchResponses.responses.push(responseData);				
		if (batchResponses.total == batchResponses.responses.length) {
			setDefaultHeaders(responseObj);
			responseObj.end(JSON.stringify(batchResponses.responses));
		}
	} else {
		setDefaultHeaders(responseObj);
		responseObj.end(JSON.stringify(responseData));
	}	
}

/**
* @param postData The POST data included with the request.
* @param requestObj The request object (https://nodejs.org/api/http.html#http_class_http_incomingmessage).
* @param requestObj The response object (https://nodejs.org/api/http.html#http_class_http_serverresponse).
* @param batchResponses An object containing expected responses for a batch. If null, this function is not being called as part of a batch. Usually the contents of this
* 			object are handled by the HTTP request processor and responder and so should not be updated.
* @param result The result of the RPC method.
*/
function replyResult(postData, requestObj, responseObj, batchResponses, result) {
	try {
		var requestData=JSON.parse(postData);
	} catch (err) {
		requestData = new Object();
	}
	var responseData = new Object();
	responseData.jsonrpc = "2.0";
	if ((requestData["id"] == null) || (requestData["id"] == undefined)) {
		responseData.id = null;
	} else {
		responseData.id = requestData.id;
	}
	responseData.result = result;	
	if (batchResponses != null) {
		batchResponses.responses.push(responseData);		
		if (batchResponses.total == batchResponses.responses.length) {
			setDefaultHeaders(responseObj);			
			responseObj.end(JSON.stringify(batchResponses.responses));
		}
	} else {
		setDefaultHeaders(responseObj);		
		responseObj.end(JSON.stringify(responseData));
	}
}

/**
* Adds the default HTTP headers, as defined in serverConfig.rpc_options.headers, to a response object.
*
* @param The response object to add default headers to.
*/
function setDefaultHeaders(responseObj) {
	for (var count=0; count < serverConfig.rpc_options.headers.length; count++) {
		var headerData = serverConfig.rpc_options.headers[count];
		for (var headerType in headerData) {
			responseObj.setHeader(headerType, headerData[headerType]);
		}
	}
}