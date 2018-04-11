/**
* Creates a JSON-RPC gaming server with MySQL integration.
*/
//Required modules:
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
//polyfill for new versions of BigNumber
BigNumber.prototype.lessThan = BigNumber.prototype.isLessThan;
BigNumber.prototype.greaterThan = BigNumber.prototype.isGreaterThan;
BigNumber.prototype.greaterThanOrEqualTo = BigNumber.prototype.isGreaterThanOrEqualTo;
BigNumber.prototype.lessThanOrEqualTo = BigNumber.prototype.isLessThanOrEqualTo;
BigNumber.prototype.equals = BigNumber.prototype.isEqualTo;
BigNumber.prototype.add = BigNumber.prototype.plus;
const bitcoin = require('bitcoinjs-lib');
const bip32 = require('bip32-utils');

//Global databse information:
require("./db_info.js"); 

//Global game server configuration:
var serverConfig = require("./game_server_config.js");

var txLogStream = null; //transaction log file stream
var debugLogStream = null; //debug log file stream

global.leaderboardData = new Object(); //leaderboard data updated by the game server

/**
* Global handler to process all uncaught exceptions so that server can remain running.
*/
process.on('uncaughtException', (err) => {
	//add email functionality to notify admins
	try {
		var traceMsg = serverConfig._log_prefix;
		if (serverConfig._log_include_timestamp) {
			traceMsg += "["+createTimeDateStamp()+"] ";
		}
		traceMsg += err;
		traceMsg += err.stack;
		console.error(traceMsg);
		global.logDebug(traceMsg);
	} catch (err) {
	}
	try {
		var accountPlugin = plugins.getPlugin("Portable Account Plugin");
		var dateStr = getMySQLTimeStamp(new Date());
		var message = "The server at myfruitgame.com experienced a runtime error @ "+dateStr+":\n\n";
		message += err;
		message += err.stack;
		for (var count = 0; count < serverConfig.adminEmails.length; count++) {
			var currentAdminEmail = serverConfig.adminEmails[count];
			accountPlugin.sendEmail("myfruitgame@gmail.com", currentAdminEmail, "Server Runtime Error (!)", message);
		}
	} catch (err) {
	}
});


//*************************** RPC FUNCTIONS *************************************

/**
* newGamingAccount [RPC/generator]: Generates a new gaming account via an external service.
*
* @param postData The POST data included with the request. No parameters are required for this method.
* @param requestObj The request object (https://nodejs.org/api/http.html#http_class_http_incomingmessage).
* @param requestObj The response object (https://nodejs.org/api/http.html#http_class_http_serverresponse).
* @param batchResponses An object containing expected responses for a batch. If null, this function is not being called as part of a batch. Usually the contents of this
* 			object are handled by the HTTP request processor and responder and so should not be updated.
*/
function *RPC_newGamingAccount (postData, requestObj, responseObj, batchResponses) {
	var generator = yield;
	var requestData = JSON.parse(postData);
	var responseData = new Object();
	var serviceResponse = yield getNewAccountAddress(generator);
	//Hard-coded address response for testing:
	//var serviceResponse = new Object();
	//serviceResponse.address = "TEST";
	if ((serviceResponse["error"] != null) && (serviceResponse["error"] != undefined)) {
		trace ("API error response on RPC_newGamingAccount: "+serviceResponse.error);		
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_API_ERROR, "Experiencing one or more API failures when creating an account.");
		return;
	}
	var filterResult = yield plugins.RPC_newAccount(requestData, generator);	
	if (filterResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, filterResult.code, filterResult.message, requestData.params.account);
		return;
	}
	if ((serviceResponse["address"] == null) || (serviceResponse["address"] == undefined)) {
		trace ("API error response on RPC_newGamingAccount: "+serviceResponse);		
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_API_ERROR, "Experiencing one or more API failures when creating an account.");
		return;
	}	
	responseData.account=serviceResponse.address;
	var affiliateID = requestData.params.affiliateID; //updated by affiliate plugin, will be null if no valid affiliate exists
	trace ("Created new account address: "+responseData.account);
	if (affiliateID == null) {
		trace ("   Registered with affiliate: none");
	} else {
		trace ("   Registered with affiliate: "+affiliateID);
	}
	var newAccountInfo = Object();
	newAccountInfo.privateKey = serviceResponse.private;
	newAccountInfo.publicKey = serviceResponse.public;
	newAccountInfo.wif = serviceResponse.wif;
	var txInfo = new Object();
	txInfo.type = "account";
	txInfo.subType = "create";
	var insertFields = "(";
	insertFields += "`btc_account`,";
	insertFields += "`btc_balance_verified`,";
	insertFields += "`btc_balance_available`,";
	insertFields += "`tx_info`,";
	insertFields += "`extra_data`,"
	insertFields += "`affiliate`";
	insertFields += ")";
	var insertValues = "("
	insertValues += "\""+responseData.account+"\","; 
	insertValues += "\"0\",";
	insertValues += "\"0\",";
	insertValues += "\"{}\",";
	insertValues += "\""+querystring.escape(JSON.stringify(newAccountInfo))+"\",";
	if (affiliateID == null) {
		insertValues += "NULL"; //proper MySQL null
	} else {
		insertValues += "\""+affiliateID+"\"";
	}
	insertValues += ")";
	var queryResult = yield db.query("INSERT INTO `gaming`.`accounts` "+insertFields+" VALUES "+insertValues, generator);	
	if (queryResult.error != null) {
		trace ("Database error on RPC_newGamingAccount!: "+queryResult.error);		
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was an error creating a new account address.");
		return;
	}
	//include fees information
	responseData.fees = new Object();
	for (var APIName in serverConfig.APIInfo) {
		var currentAPI = serverConfig.APIInfo[APIName];
		var satoshiPerBTC = new BigNumber("100000000");
		responseData.fees.bitcoin = currentAPI.minerFee.dividedBy(satoshiPerBTC).toString(10);
		responseData.fees.satoshis = currentAPI.minerFee.toString(10);		
	}
	replyResult(postData, requestObj, responseObj, batchResponses, responseData);
}

/**
* checkAccountDeposit [RPC/generator]: Checks to see if a generated account has received a new deposit via an external service.
*
* @param postData The POST data included with the request.  JSON object must contain:
						account (String): The Bitcoin account to check for a deposit.
						password (String, optional): A password for the associated account.
* @param requestObj The request object (https://nodejs.org/api/http.html#http_class_http_incomingmessage).
* @param requestObj The response object (https://nodejs.org/api/http.html#http_class_http_serverresponse).
* @param batchResponses An object containing expected responses for a batch. If null, this function is not being called as part of a batch. Usually the contents of this
* 			object are handled by the HTTP request processor and responder and so should not be updated.
*/
function *RPC_checkAccountDeposit (postData, requestObj, responseObj, batchResponses) {
	var generator = yield;
	var requestData = JSON.parse(postData);
	var responseData = new Object();
	checkParameter(requestData, "account");
	var queryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `btc_account`=\""+requestData.params.account+"\" ORDER BY `index` DESC LIMIT 1", generator);	
	if (queryResult.error != null) {
		trace ("Database error on RPC_checkAccountDeposit: "+queryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
		return;
	}
	if (queryResult.rows.length == 0) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_NO_RESULTS, "No matching account.", requestData.params.account);
		return;
	}
	var filterResult = yield plugins.RPC_login(queryResult, postData, generator);	
	if (filterResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, filterResult.code, filterResult.message, requestData.params.account);
		return;
	}
	trace ("Checking last check interval...");;
	var lastCheckDateObj = new Date(queryResult.rows[0].last_deposit_check);	
	if ((Date.now() - lastCheckDateObj.valueOf()) < (serverConfig.depositCheckInterval * 1000)) {
		trace ("...not yet time for a live update.");
		//deposit check interval has not elapsed yet
		responseData.balance = new Object();
		responseData.balance.bitcoin = String(queryResult.rows[0].btc_balance_verified);
		responseData.balance.bitcoin_unconfirmed = String(queryResult.rows[0].btc_balance_available);		
		responseData.deposit_complete = queryResult.rows[0].deposit_complete; 
		responseData.deposit_updated = false; 
		var tokens = new BigNumber(responseData.balance.bitcoin_unconfirmed.toString(10));	
		tokens = tokens.times(serverConfig.tokensPerBTC);
		responseData.balance.tokens = tokens.toString(10);
		replyResult(postData, requestObj, responseObj, batchResponses, responseData);
		return;
	}
	trace ("Checking available balance...");
	//---- CHECK & UPDATE ACCOUNT INFORMATION IF BALANCE IS 0 ----
	var currentAvailableBalance = new BigNumber(queryResult.rows[0].btc_balance_available);
	responseData.deposit_complete = queryResult.rows[0].deposit_complete;
	//if balance = 0
	if (currentAvailableBalance.equals(0) && (queryResult.rows[0].deposit_complete != true)) {
		if (serverConfig.autoDeposit != null) {
			var accountInfo = serverConfig.autoDeposit;
		} else {
			var accountInfo = yield checkAccountBalance(generator, requestData.params.account);
		}
		trace("Retrieved account info: ");
		trace(JSON.stringify(accountInfo));
		var btc_per_satoshis = new BigNumber("0.00000001");
		var bitcoinAmount =  new BigNumber(accountInfo.balance);
		bitcoinAmount = bitcoinAmount.times(btc_per_satoshis);
		bitcoinAmount = Number(bitcoinAmount);
		var uc_bitcoinAmount = new BigNumber(accountInfo.unconfirmed_balance);
		uc_bitcoinAmount = uc_bitcoinAmount.times(btc_per_satoshis);
		uc_bitcoinAmount = Number(uc_bitcoinAmount);
		var total_oc_bitcoin =new BigNumber(accountInfo.final_balance);
		total_oc_bitcoin = total_oc_bitcoin.times(btc_per_satoshis);
		total_oc_bitcoin = Number(total_oc_bitcoin.toString(10));				
		if (serverConfig.allowUnconfirmedDeposit) {
			if ((uc_bitcoinAmount > 0) || (bitcoinAmount > 0)) {
				var btcDeposited = null;
				if (bitcoinAmount == 0) {
					btcDeposited = String(uc_bitcoinAmount);
					var dbUpdates = "`btc_balance_verified`=\""+String(bitcoinAmount)+"\",`btc_balance_available`=\""+String(uc_bitcoinAmount)+"\",`btc_balance_total`=\""+String(total_oc_bitcoin)+"\",`btc_balance_total_previous`=\""+String(total_oc_bitcoin)+"\",`deposit_complete`=TRUE,`last_deposit_check`=NOW(),`last_login`=NOW()";	
				} else {
					//uncofirmed balance may be 0 at this point
					btcDeposited = String(bitcoinAmount);
					dbUpdates = "`btc_balance_verified`=\""+String(bitcoinAmount)+"\",`btc_balance_available`=\""+String(bitcoinAmount)+"\",`btc_balance_total`=\""+String(total_oc_bitcoin)+"\",`btc_balance_total_previous`=\""+String(total_oc_bitcoin)+"\",`deposit_complete`=TRUE,`last_deposit_check`=NOW(),`last_login`=NOW()";	
				}
				if (queryResult.rows[0].auth_status == 2) {
					var accountPlugin = plugins.getPlugin("Portable Account Plugin");
					var dateStr = new Date().toISOString();
					var message = "A new deposit has been detected on the blockchain for your account.\n";
					message += "Confirmed blockchain balance (BTC): "+String(bitcoinAmount)+"\n";
					message += "Unconfirmed blockchain balance (BTC): "+String(bitcoinAmount)+"\n";
					message += "Available balance (BTC): "+btcDeposited;
					accountPlugin.sendEmail("myfruitgame@gmail.com", queryResult.rows[0].email, "New Deposit", message);
				}
				var currentBTCTotal = new BigNumber(queryResult.rows[0].btc_balance_total);
				var liveBTCTotal = new BigNumber(accountInfo.final_balance);
				var deltaBTC = liveBTCTotal.minus(currentBTCTotal);
				global.logTx("Detected blockchain balance change for account: "+requestData.params.account);
				global.logTx("   Last live API update of balances: "+queryResult.rows[0].last_deposit_check);
				global.logTx("   Available Bitcoin balance (currently in database): "+queryResult.rows[0].btc_balance_available);
				global.logTx("   Confirmed Bitcoin balance (currently in database): "+queryResult.rows[0].btc_balance_verified);
				global.logTx("   Total Bitcoin balance (currently in database): "+queryResult.rows[0].btc_balance_total);
				global.logTx("   Total Bitcoin balance at last check (currently in database): "+queryResult.rows[0].btc_balance_total_previous);
				global.logTx("   Confirmed Bitcoin balance (as reported by API): "+bitcoinAmount.toString(10));
				global.logTx("   Unconfirmed Bitcoin balance (as reported by API): "+uc_bitcoinAmount.toString(10));
				global.logTx("   Total Bitcoin balance (as reported by API): "+total_oc_bitcoin.toString(10));
				global.logTx("   Change: "+deltaBTC.toString(10));
				//update gaming.accounts
				var txInfo = new Object();
				txInfo.type = "deposit";
				txInfo.info = new Object();
				txInfo.info.btc = deltaBTC.toString(10);
				if (deltaBTC.isGreaterThan(0)) {
					var accountUpdateResult = yield global.updateAccount(queryResult, dbUpdates, txInfo, generator);
					if (accountUpdateResult.error != null) {
						trace ("Database error on RPC_checkAccountDeposit: "+accountUpdateResult.error);		
						trace ("   Request ID: "+requestData.id);
						global.logTx ("   Could not record to database!");
						replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when updating the account.");
						return;
					}
				}
				responseData.balance = new Object();
				responseData.balance.bitcoin = String(bitcoinAmount);
				responseData.balance.bitcoin_unconfirmed = String(uc_bitcoinAmount);
				tokens = new BigNumber(responseData.balance.bitcoin_unconfirmed);	
				tokens = tokens.times(serverConfig.tokensPerBTC);
				responseData.balance.tokens = tokens.toString(10);
				responseData.deposit_complete = true;
				responseData.deposit_updated = true;
			}
		} else {
			if (bitcoinAmount > 0) {		
				responseData.balance = new Object();
				responseData.balance.bitcoin = String(bitcoinAmount);
				responseData.balance.bitcoin_unconfirmed = String(uc_bitcoinAmount);
				tokens = new BigNumber(responseData.balance.bitcoin_unconfirmed);	
				tokens = tokens.times(serverConfig.tokensPerBTC);
				responseData.balance.tokens = tokens.toString(10);				
				currentBTCTotal = new BigNumber(queryResult.rows[0].btc_balance_total);
				liveBTCTotal = new BigNumber(accountInfo.final_balance);
				deltaBTC = liveBTCTotal.minus(currentBTCTotal);
				//update gaming.accounts
				var txInfo = new Object();
				txInfo.type = "deposit";
				txInfo.info = new Object();
				txInfo.info.btc = deltaBTC.toString(10);
				if (deltaBTC.isGreaterThan(0)) {
					var dbUpdates = "`btc_balance_verified`=\""+responseData.balance.bitcoin+"\",`btc_balance_available`=\""+responseData.balance.bitcoin+"\",`last_deposit_check`=NOW(),`deposit_complete`=TRUE,`last_login`=NOW()";					
					accountUpdateResult = yield global.updateAccount(queryResult, dbUpdates, txInfo, generator);
					if (accountUpdateResult.error != null) {
						trace ("Database error on RPC_checkAccountDeposit: "+accountUpdateResult.error);		
						trace ("   Request ID: "+requestData.id);
						replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when updating the account.");
						return;
					}
				}
				responseData.deposit_complete = true;
				responseData.deposit_updated = true;
			}
		}
	} else {
		if (queryResult.rows[0].deposit_complete) {
			trace ("Deposit is completed...");
			var accountInfo=yield checkAccountBalance(generator, requestData.params.account);
			if ((accountInfo == null) || (accountInfo == undefined)) {
				replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_API_ERROR, "An external API cannot be reached.");
				return;
			}
			var btc_per_satoshis = new BigNumber("0.00000001");
			var blockchainBTCBalance = new BigNumber(accountInfo.balance); //convert from Satoshis to Bitcoin		
			blockchainBTCBalance = blockchainBTCBalance.times(btc_per_satoshis);
			var uc_blockchainBTCBalance = new BigNumber(accountInfo.unconfirmed_balance);
			uc_blockchainBTCBalance = uc_blockchainBTCBalance.times(btc_per_satoshis);
			var total_oc_bitcoin = new BigNumber(accountInfo.final_balance);
			total_oc_bitcoin = total_oc_bitcoin.times(btc_per_satoshis);
			var verifiedBTCBalance = new BigNumber(queryResult.rows[0].btc_balance_verified);
			var availableBTCBalance = new BigNumber(queryResult.rows[0].btc_balance_available);
			var current_oc_bitcoin = new BigNumber(queryResult.rows[0].btc_balance_total);			
			var deltaBTC = total_oc_bitcoin.minus(current_oc_bitcoin);				
			availableBTCBalance = availableBTCBalance.plus(deltaBTC);
			verifiedBTCBalance = blockchainBTCBalance;
			if ((total_oc_bitcoin.equals(current_oc_bitcoin) == false)) {
				//new deposit detected			
				var dbUpdates = "`btc_balance_verified`=\""+verifiedBTCBalance.toString(10)+"\",";
				dbUpdates += "`btc_balance_available`=\""+availableBTCBalance.toString(10)+"\",";	
				dbUpdates += "`btc_balance_total`=\""+total_oc_bitcoin.toString(10)+"\",";
				dbUpdates += "`btc_balance_total_previous`=\""+total_oc_bitcoin.toString(10)+"\",";
				dbUpdates += "`last_login`=NOW(),";	
				dbUpdates += "`last_deposit_check`=NOW()";	
				if (queryResult.rows[0].auth_status == 2) {
					var accountPlugin = plugins.getPlugin("Portable Account Plugin");
					var dateStr = new Date().toISOString();
					var message = "A new deposit has been detected on the blockchain for your account.\n";
					message += "Confirmed blockchain balance (BTC): "+blockchainBTCBalance.toString(10)+"\n";
					message += "Unconfirmed blockchain balance (BTC): "+uc_blockchainBTCBalance.toString(10)+"\n";
					message += "Available balance (BTC): "+availableBTCBalance.toString(10);
					accountPlugin.sendEmail("myfruitgame@gmail.com", queryResult.rows[0].email, "New Deposit", message);						
				}
				//update gaming.accounts
				var txInfo = new Object();
				txInfo.type = "deposit";
				txInfo.info = new Object();
				txInfo.info.btc = deltaBTC.toString(10);
				if (deltaBTC.isGreaterThan(0)) {
					accountUpdateResult = yield global.updateAccount(queryResult, dbUpdates, txInfo, generator);
				}
			} else {				
				var dbUpdates = "`btc_balance_verified`=\""+blockchainBTCBalance.toString(10)+"\",";
				dbUpdates += "`btc_balance_available`=\""+availableBTCBalance.toString(10)+"\",";	
				dbUpdates += "`btc_balance_total`=\""+total_oc_bitcoin.toString(10)+"\",";
				dbUpdates += "`btc_balance_total_previous`=\""+total_oc_bitcoin.toString(10)+"\",";
				dbUpdates += "`last_login`=NOW(),";	
				dbUpdates += "`last_deposit_check`=NOW()";	
				//update gaming.accounts
				var txInfo = new Object();
				txInfo.type = "balance_check";
				//txInfo.info = new Object();
				//txInfo.info.btc = availableBTCBalance.toString(10);
				accountUpdateResult = yield global.updateAccount(queryResult, dbUpdates, txInfo, generator);
			}
			responseData.balance = new Object();
			responseData.balance.bitcoin = String(verifiedBTCBalance.toString(10));
			responseData.balance.bitcoin_unconfirmed = String(availableBTCBalance.toString(10));		
			responseData.deposit_complete = queryResult.rows[0].deposit_complete; 
			responseData.deposit_updated = true; 
			tokens = new BigNumber(responseData.balance.bitcoin_unconfirmed);	
			tokens = tokens.times(serverConfig.tokensPerBTC);
			responseData.balance.tokens = tokens.toString(10);
		} else {
			trace ("Deposit not completed...");
		}
	}
	//include fees information
	responseData.fees = new Object();
	for (var APIName in serverConfig.APIInfo) {
		var currentAPI = serverConfig.APIInfo[APIName];
		var satoshiPerBTC = new BigNumber("100000000");
		responseData.fees.bitcoin = currentAPI.minerFee.dividedBy(satoshiPerBTC).toString(10);
		responseData.fees.satoshis = currentAPI.minerFee.toString(10);		
	}	
	replyResult(postData, requestObj, responseObj, batchResponses, responseData);
}

/**
* getAccountBalance [RPC/generator]: Retrieves the available play balance (not deposit balance) for an account.
*
* @param postData The POST data included with the request.  JSON object must contain:
						account (String): The Bitcoin account to check the balance for.
						password (String, optional): A password for the associated account.
* @param requestObj The request object (https://nodejs.org/api/http.html#http_class_http_incomingmessage).
* @param requestObj The response object (https://nodejs.org/api/http.html#http_class_http_serverresponse).
* @param batchResponses An object containing expected responses for a batch. If null, this function is not being called as part of a batch. Usually the contents of this
* 			object are handled by the HTTP request processor and responder and so should not be updated.
*/
function *RPC_getAccountBalance (postData, requestObj, responseObj, batchResponses) {
	var generator = yield;
	var requestData = JSON.parse(postData);
	checkParameter(requestData, "account");
	var responseData = new Object();	
	var queryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `btc_account`=\""+requestData.params.account+"\" ORDER BY `index` DESC LIMIT 1", generator);	
	if (queryResult.error != null) {
		trace ("Database error on RPC_getAccountBalance: "+queryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
		return;
	}
	if (queryResult.rows.length == 0) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_NO_RESULTS, "No matching account.", requestData.params.account);
		return;
	}	
	var filterResult = yield plugins.RPC_login(queryResult, postData, generator);		
	if (filterResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, filterResult.code, filterResult.message, requestData.params.account);
		return;
	}
	var current_btc_balance_conf = new BigNumber(queryResult.rows[0].btc_balance_verified);
	var current_btc_balance_total = new BigNumber(queryResult.rows[0].btc_balance_total);
	var current_btc_balance_avail = new BigNumber(queryResult.rows[0].btc_balance_available);
	var current_btc_balance_total_previous = new BigNumber(queryResult.rows[0].btc_balance_total_previous);	
	responseData.account = requestData.params.account;
	responseData.balance = new Object();
	var live = false;
	if ((requestData.params["refresh"] == true) || (requestData.params["refresh"] == 1)) {		
		var btc_per_satoshis = new BigNumber("0.00000001");
		live = true;
		var accountInfo = yield checkAccountBalance(generator, requestData.params.account);
		if ((accountInfo != undefined) && (accountInfo != "undefined")) {
			//trace (JSON.stringify(accountInfo));
			var update_btc_balance_conf = new BigNumber(String(accountInfo.balance)); //convert from Satoshis to Bitcoin
			update_btc_balance_conf = update_btc_balance_conf.times(btc_per_satoshis);
			var update_btc_balance_unc = new BigNumber(String(accountInfo.unconfirmed_balance)); //convert from Satoshis to Bitcoin
			update_btc_balance_unc = update_btc_balance_unc.times(btc_per_satoshis);
			var update_btc_balance_total = new BigNumber(String(accountInfo.final_balance));
			update_btc_balance_total = update_btc_balance_total.times(btc_per_satoshis);			
			if (current_btc_balance_total_previous.equals(update_btc_balance_total) == false) {
				//a new deposit has been made since last check 
				var balanceDelta = update_btc_balance_total.minus(current_btc_balance_total_previous); //may be negative
				var btc_balance_conf = update_btc_balance_conf;
				var btc_balance_unc = update_btc_balance_unc;
				var btc_balance_avail = current_btc_balance_avail.plus(balanceDelta);
				var btc_balance_total = current_btc_balance_total.plus(balanceDelta);
				var btc_balance_total_previous = update_btc_balance_total;
				global.logTx("Detected blockchain balance change for account: "+requestData.params.account);
				global.logTx("   Last live API update of balances: "+queryResult.rows[0].last_deposit_check);
				global.logTx("   Confirmed BTC balance: "+btc_balance_conf.toString(10));
				global.logTx("   Unconfirmed BTC balance: "+btc_balance_unc.toString(10));
				global.logTx("   New available BTC balance: "+btc_balance_avail.toString(10));
				global.logTx("   New total BTC balance: "+btc_balance_total.toString(10));
				var txInfo = new Object();
				txInfo.type = "deposit";
				txInfo.info = new Object();
				txInfo.info.btc = balanceDelta.toString(10);
				if (balanceDelta.isGreaterThan(0)) {
					var dbUpdates = "`btc_balance_verified`=\""+btc_balance_conf.toString(10)+"\",`btc_balance_available`=\""+btc_balance_avail.toString(10)+"\",`btc_balance_total`=\""+btc_balance_total.toString(10)+"\",`btc_balance_total_previous`=\""+btc_balance_total_previous.toString(10)+"\",`last_login`=NOW()";			
					var accountUpdateResult = yield global.updateAccount(queryResult, dbUpdates, txInfo, generator);
					if (accountUpdateResult.error != null) {
						trace ("Database error on RPC_getAccountBalance: "+accountUpdateResult.error);		
						//trace ("   SQL: "+updateSQL);
						trace ("   Request ID: "+requestData.id);
						replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when updating the account.");
						return;
					}
				}
			} else {				
				btc_balance_conf = update_btc_balance_conf;
				btc_balance_unc = update_btc_balance_unc;
				btc_balance_avail = current_btc_balance_avail;
				btc_balance_total = current_btc_balance_total;
				btc_balance_total_previous = current_btc_balance_total_previous;
			}
			responseData.balance.bitcoin = btc_balance_avail.toString(10);
			responseData.balance.bitcoin_unconfirmed = btc_balance_unc.toString(10);
			responseData.balance.bitcoin_confirmed = btc_balance_conf.toString(10);
			var tokens = new BigNumber(btc_balance_avail.toString(10));	
			tokens = tokens.times(serverConfig.tokensPerBTC);
			responseData.balance.tokens = tokens.toString(10);
		} else {
			live = false;
		}
	} 
	if (!live) {
		responseData.balance.bitcoin = queryResult.rows[0].btc_balance_available;
		responseData.balance.bitcoin_confirmed = queryResult.rows[0].btc_balance_verified;
		var tokens = new BigNumber(queryResult.rows[0].btc_balance_available);	
		tokens = tokens.times(serverConfig.tokensPerBTC);
		responseData.balance.tokens = tokens.toString(10);
	}
	//add jackpot information if provided
	if ((requestData.params["gameID"] != null) && (requestData.params["gameID"] != undefined) && (requestData.params["gameID"] != "")) {
		if ((serverConfig.gameConfigs[requestData.params.gameID]["jackpotID"] != undefined) && 
			(serverConfig.gameConfigs[requestData.params.gameID]["jackpotID"] != null) &&
			(serverConfig.gameConfigs[requestData.params.gameID]["jackpotID"] != "")) {
			var jackpotQueryResult = yield db.query("SELECT * FROM `gaming`.`jackpots` WHERE `jackpot_id`=\""+serverConfig.gameConfigs[requestData.params.gameID].jackpotID+"\" LIMIT 1", generator);
			if (jackpotQueryResult.error != null) {
				jackpotQueryResult = null;
			}
		} else {
			jackpotQueryResult = null;
		}
		if (jackpotQueryResult != null) {
			responseData.jackpot = jackpotQueryResult.rows[0];
		}
	}
	//include fees information
	responseData.fees = new Object();
	for (var APIName in serverConfig.APIInfo) {
		var currentAPI = serverConfig.APIInfo[APIName];
		var satoshiPerBTC = new BigNumber("100000000");
		responseData.fees.bitcoin = currentAPI.minerFee.dividedBy(satoshiPerBTC).toString(10);
		responseData.fees.satoshis = currentAPI.minerFee.toString(10);		
	}
	replyResult(postData, requestObj, responseObj, batchResponses, responseData);
}

/**
* getAccountTransactions [RPC/generator]: Retrieves system-wide transactions for a specific account.
*
* @param postData The POST data included with the request.  JSON object must contain:
						account (String): The Bitcoin account to check the balance for.
						password (String, optional): A password for the associated account.
						searchParams (Object): An object containing one or more of the following search parameters:
							txTypes (Array): An array of strings specifying which transaction types to include in the reply. 
										Valid types include "account" for account-related transactions, "investment" for investment-related transactions, and
										"affiliate" for affiliate-related transactions. Other plugins may define new types so this list may not be complete.
							searchType (String): The type of search to perform. Valid search types are "date" and "recent".
							search (*): The search to be performed. 
										If searchType is "date", this must be an object with properties 'start' and 'end' containing ISO date strings of the 
										starting and end range to include in the search.
										is searchType is "recent", this must be a number (integer) denoting the number of most recent items to include in the reply.
							limitResults (Number, optional): If included, only this many results will be returned in the reply.
							page (Number, optional): The result page if limitResults is being used, igored otherwise. Default is 0 (first page). Pagination can be 
										handled on the client by using the total result count included in the reply.
* @param requestObj The request object (https://nodejs.org/api/http.html#http_class_http_incomingmessage).
* @param requestObj The response object (https://nodejs.org/api/http.html#http_class_http_serverresponse).
* @param batchResponses An object containing expected responses for a batch. If null, this function is not being called as part of a batch. Usually the contents of this
* 			object are handled by the HTTP request processor and responder and so should not be updated.
*/
function *RPC_getAccountTransactions (postData, requestObj, responseObj, batchResponses) {
	var generator = yield;
	var requestData = JSON.parse(postData);
	checkParameter(requestData, "account");
	checkParameter(requestData, "searchParams");
	var transactionTypes = requestData.params.searchParams["txTypes"];
	var searchType = requestData.params.searchParams["searchType"];
	var search = requestData.params.searchParams["search"];
	var limitResults = requestData.params.searchParams["limitResults"];
	var page = requestData.params.searchParams["page"];
	if ((transactionTypes == undefined) || (transactionTypes == null) || (transactionTypes == "") || (isNaN(transactionTypes["length"]))) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "Missing or invalid \"searchParams.txTypes\" object. Must be an array.");
		return;
	}
	if (transactionTypes.length == 0) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "\"searchParams.txTypes\" is empty. Include some transaction types.");
		return;
	}
	if ((searchType == undefined) || (searchType == null)) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "Missing \"searchParams.searchType\". Must be a string.");
		return;
	}
	if ((search == undefined) || (search == null)) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "Missing \"searchParams.search\".");
		return;
	}
	var queryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `btc_account`=\""+requestData.params.account+"\" ORDER BY `index` DESC LIMIT 1", generator);	
	if (queryResult.error != null) {
		trace ("Database error on RPC_getAccountTransactions: "+queryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
		return;
	}
	if (queryResult.rows.length == 0) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_NO_RESULTS, "No matching account.", requestData.params.account);
		return;
	}	
	var filterResult = yield plugins.RPC_login(queryResult, postData, generator);		
	if (filterResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, filterResult.code, filterResult.message, requestData.params.account);
		return;
	}
	var responseData = new Object();
	//user has logged in (or no password has been set)
	var includeAccount = false;
	var includeInvestments = false;
	var includeAffiliate = false;
	var includeBets = false;
	var includeWins = false;
	for (var count=0; count<transactionTypes.length; count++) {
		if (transactionTypes[count] == "account") {
			includeAccount = true;
		}
		if (transactionTypes[count] == "investments") {
			includeInvestments = true;
		}
		if (transactionTypes[count] == "affiliate") {
			includeAffiliate = true;
		}
		if (transactionTypes[count] == "bets") {
			includeBets = true;
		}
		if (transactionTypes[count] == "wins") {
			includeWins = true;
		}
	}
	var accountSQL = "SELECT * FROM `gaming`.`accounts` WHERE `btc_account`=\""+requestData.params.account+"\" ";
	var investmentsSQL = "SELECT * FROM `gaming`.`investment_txs` WHERE `account`=\""+requestData.params.account+"\" ";
	var affiliatesSQL = "SELECT * FROM `gaming`.`affiliates` WHERE `account`=\""+requestData.params.account+"\" ";
	var betsWinsSQL = "SELECT * FROM `gaming`.`games` WHERE `account`=\""+requestData.params.account+"\" ";
	if (searchType == "recent") {
		if (isNaN(search)) {
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "\"searchParams.search\" must be a number when \"searchParams.searchType\"=\"recent\"");
			return;
		}
		var limitSQL = "ORDER BY `index` DESC LIMIT "+String(search);
	} else if (searchType == "date") {
		try {
			var startDate = new Date(search.start);
			var startPeriod = getMySQLTimeStamp(startDate);
		} catch (err) {
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "Invalid \"searchParams.search.start\" value. Must be an ISO date/time string.");
			return;
		}
		try {
			var endDate = new Date(search.end);
			var endPeriod = getMySQLTimeStamp(endDate);
		} catch (err) {
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "Invalid \"searchParams.search.end\" value. Must be an ISO date/time string.");
			return;
		}
		limitSQL = "WHERE `last_login` BETWEEN \""+startPeriod+"\" AND \""+endPeriod+"\" ORDER BY `index` DESC";
	} else {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "\"searchParams.searchType\" is invalid. Must be \"date\" or \"recent\".");
		return;
	}
	accountSQL += limitSQL;
	investmentsSQL += "ORDER BY `index` DESC LIMIT 1"; //get only the latest row
	affiliatesSQL += limitSQL;
	betsWinsSQL += limitSQL;
	//this information should now be stored in the "accounts" table within the "tx_info" field
	includeAccount = true;
	includeInvestments = true;
	includeAffiliate = false;
	includeWins = false;
	includeBets = false;
	//at this point all required parameters have been validated
	if (includeAccount) {
		var accountQueryResult = yield db.query(accountSQL, generator);
	}
	if (includeInvestments) {
		var investmentsQueryResult = yield db.query(investmentsSQL, generator);
	}
	if (includeAffiliate) {
		var affiliateQueryResult = yield db.query(affiliatesSQL, generator);
	}
	if (includeWins || includeBets) {
		var betsWinsQueryResult = yield db.query(betsWinsSQL, generator);
	}
	if (isNaN(limitResults) == false) {
		if (isNaN(page)) {
			page = 0;
		}
		var startIndex = limitResults * page;
		var endIndex = limitResults * (page + 1);
	} else {
		startIndex = 0;
		endIndex = 1000;
	}
	//TODO: update pagination in SQL statement instead (this is not a great way to do this)
	if (includeAccount) {
		responseData.accountTransactions = new Array();
		if (startIndex < accountQueryResult.rows.length) {
			if (endIndex > (accountQueryResult.rows.length - 1)) {
				endIndex = accountQueryResult.rows.length - 1;
			}
		}
		for (var count = startIndex; count <= endIndex; count++) {
			var currentResult = accountQueryResult.rows[count];
			if (currentResult != undefined) {
				var resultObj = new Object();
				resultObj.btc_balance = currentResult.btc_balance_available;
				resultObj.timestamp = currentResult.last_login;
				resultObj.deposit_detected = currentResult.deposit_complete;
				resultObj.btc_verified = currentResult.btc_balance_verified;
				resultObj.txInfo = currentResult.tx_info;
				responseData.accountTransactions.push(resultObj);				
			}
		}
	}
	if (isNaN(limitResults) == false) {
		if (isNaN(page)) {
			page = 0;
		}
		startIndex = limitResults * page;
		endIndex = limitResults * (page + 1);
	} else {
		startIndex = 0;
		endIndex = 1000;
	}
	if (includeInvestments) {
		responseData.investmentsTransactions = new Array();
		if (startIndex < investmentsQueryResult.rows.length) {
			if (endIndex > (investmentsQueryResult.rows.length - 1)) {
				endIndex = investmentsQueryResult.rows.length - 1;
			}
		}
		for (var count = startIndex; count <= endIndex; count++) {
			var currentResult = investmentsQueryResult.rows[count];
			if (currentResult != undefined) {
				var resultObj = new Object();
				resultObj.investments = JSON.parse(currentResult.investments);
				resultObj.timestamp = currentResult.last_update;
				responseData.investmentsTransactions.push(resultObj);
			}
		}
	}
	if (isNaN(limitResults) == false) {
		if (isNaN(page)) {
			page = 0;
		}
		startIndex = limitResults * page;
		endIndex = limitResults * (page + 1);
	} else {
		startIndex = 0;
		endIndex = 1000;
	}
	if (includeAffiliate) {
		responseData.affiliateTransactions = new Array();
		if (startIndex < affiliateQueryResult.rows.length) {
			if (endIndex > (affiliateQueryResult.rows.length - 1)) {
				endIndex = affiliateQueryResult.rows.length - 1;
			}
		}
		for (var count = startIndex; count <= endIndex; count++) {
			var currentResult = affiliateQueryResult.rows[count];
			if (currentResult != undefined) {
				var resultObj = new Object();
				resultObj.balance = JSON.parse(currentResult.balance);
				resultObj.timestamp = currentResult.last_update;
				responseData.affiliateTransactions.push(resultObj);
			}
		}
	}
	if (isNaN(limitResults) == false) {
		if (isNaN(page)) {
			page = 0;
		}
		startIndex = limitResults * page;
		endIndex = limitResults * (page + 1);
	} else {
		startIndex = 0;
		endIndex = 1000;
	}
	if (includeBets || includeWins) {
		if (includeBets) {
			responseData.betsTransactions = new Array();
		}
		if (includeWins) {
			responseData.winsTransactions = new Array();
		}
		if (startIndex < betsWinsQueryResult.rows.length) {
			if (endIndex > (betsWinsQueryResult.rows.length - 1)) {
				endIndex = betsWinsQueryResult.rows.length - 1;
			}
		}
		for (var count = startIndex; count <= endIndex; count++) {
			var currentResult = betsWinsQueryResult.rows[count];
			if (currentResult != undefined) {
				var resultObjB = new Object();
				var resultObjW = new Object();
				resultObjB.timestamp = currentResult.date_time;
				resultObjW.timestamp = currentResult.date_time;
				if (includeBets) {
					resultObjB.bet = JSON.parse(querystring.unescape(currentResult.bet));
					responseData.betsTransactions.push(resultObjB);
				}
				if (includeWins) {
					resultObjW.wins = JSON.parse(currentResult.wins);
					responseData.winsTransactions.push(resultObjW);
				}
			}
		}
	}
	global.assertAnyValue("NaN", "0", responseData);
	replyResult(postData, requestObj, responseObj, batchResponses, responseData);
}

/**
* getJackpot [RPC/generator]: Retrieves jackpot information for a specific game.

* @param postData The POST data included with the request.  JSON object must contain:
						gameID (String): The game ID for which to retrieve jackpot information for.
* @param requestObj The request object (https://nodejs.org/api/http.html#http_class_http_incomingmessage).
* @param requestObj The response object (https://nodejs.org/api/http.html#http_class_http_serverresponse).
* @param batchResponses An object containing expected responses for a batch. If null, this function is not being called as part of a batch. Usually the contents of this
* 			object are handled by the HTTP request processor and responder and so should not be updated.
*/
function *RPC_getJackpot (postData, requestObj, responseObj, batchResponses) {
	var generator = yield;
	var requestData = JSON.parse(postData);
	checkParameter(requestData, "gameID");
	var responseData = new Object();
	//add jackpot information if provided
	if ((serverConfig.gameConfigs[requestData.params.gameID]["jackpotID"] != undefined) && 
		(serverConfig.gameConfigs[requestData.params.gameID]["jackpotID"] != null) &&
		(serverConfig.gameConfigs[requestData.params.gameID]["jackpotID"] != "")) {
		var jackpotQueryResult = yield db.query("SELECT * FROM `gaming`.`jackpots` WHERE `jackpot_id`=\""+serverConfig.gameConfigs[requestData.params.gameID].jackpotID+"\" LIMIT 1", generator);
		if (jackpotQueryResult.error != null) {
			jackpotQueryResult = null;
		}
	} else {
		jackpotQueryResult = null;
	}
	if (jackpotQueryResult != null) {
		responseData.jackpot = new Object();
		responseData.jackpot.tokens = jackpotQueryResult.rows[0].total;
		responseData.jackpot.bitcoin = jackpotQueryResult.rows[0].btc_total;
	}
	replyResult(postData, requestObj, responseObj, batchResponses, responseData);
}

/**
* getGameResults [RPC/generator]: Retrieves the generated, encrypted game results for the player to select from.
*
* @param postData The POST data included with the request. JSON object must contain:
*						gameID (String): Alpha-numeric game ID for which to get results.
*						bet (Object): 
							tokens (String or Number): Numeric string or numeric value representing the number of tokens in the bet.
						account (String): The Bitcoin account making the request.
						password (String, optional): A password for the associated account.
						nonce (String): A unique nonce for the player (not currently in use but must be included).									
* @param requestObj The request object (https://nodejs.org/api/http.html#http_class_http_incomingmessage).
* @param requestObj The response object (https://nodejs.org/api/http.html#http_class_http_serverresponse).
* @param batchResponses An object containing expected responses for a batch. If null, this function is not being called as part of a batch. Usually the contents of this
* 			object are handled by the HTTP request processor and responder and so should not be updated.
*/
function *RPC_getGameResults (postData, requestObj, responseObj, batchResponses) {
	var generator = yield;
	var requestData = JSON.parse(postData);
	//---- VERIFY PARAMETERS ----
	checkParameter(requestData, "gameID");
	checkParameter(requestData, "bet");
	checkParameter(requestData, "account");
	checkParameter(requestData, "nonce");	
	requestData.params.gameID = String(requestData.params.gameID);
	var betAmount = new BigNumber(requestData.params.bet["tokens"]);	
	var btcBetAmount = betAmount.dividedBy(serverConfig.tokensPerBTC);	
	if ((serverConfig.gameConfigs[requestData.params.gameID] == null) || (serverConfig.gameConfigs[requestData.params.gameID] == undefined)) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_GAME_CONFIG_ERROR, "Game ID \""+requestData.params.gameID+"\" not defined.");
		return;
	}
	if ((requestData.params.bet["tokens"] == null) || (requestData.params.bet["tokens"] == undefined) || (requestData.params.bet["tokens"] <= 0)) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "Parameter \"bet.tokens\" has invalid value: "+requestData.params.bet["tokens"]);
		return;
	}
	var betAllowed = false;
	for (var count = 0; count < serverConfig.gameConfigs[requestData.params.gameID].bets.length; count++) {
		var currentBetAmount = new BigNumber(serverConfig.gameConfigs[requestData.params.gameID].bets[count]);
		if (currentBetAmount.toString(10) == betAmount.toString(10)) {
			betAllowed = true;
			break;
		}
	}
	if (!betAllowed) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "Bet amount "+betAmount.toString(10)+" not allowed.");
		return;
	}
	var investmentQueryResult = yield db.query("SELECT * FROM `gaming`.`investments` WHERE `id`=\""+serverConfig.gameConfigs[requestData.params.gameID].bankrollID+"\" ORDER BY `index` DESC LIMIT 1", generator);
	if (investmentQueryResult.error != null) {
		trace ("Database error on RPC_getGameResults: "+investmentQueryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when processing the request.");
		return;
	}
	try {
		if (investmentQueryResult.rows.length == 0) {
			trace ("No investment record found for ID: \""+serverConfig.gameConfigs[requestData.params.gameID].bankrollID+"\"");
			var bankroll_balance_btc = new BigNumber(0);
		} else {
			bankroll_balance_btc = new BigNumber(investmentQueryResult.rows[0].btc_balance);
		}
	} catch (err) {
		bankroll_balance_btc = new BigNumber(0);
	}
	
	var maxBet = eval(serverConfig.gameConfigs[requestData.params.gameID].maxBet);
	if (maxBet.lessThan(btcBetAmount)) {
		var maxBetTokens = maxBet.times(serverConfig.tokensPerBTC);
		trace ("   Selected bet ("+btcBetAmount.toString(10)+" BTC) exceeds maximum ("+maxBet.toString(10)+" BTC, "+maxBetTokens.toString(10)+" tokens).");
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "Bet exceeds maximum bet amount of "+maxBet.toString(10)+" BTC ("+maxBetTokens.toString(10)+" tokens).", maxBet.toString(10));
		return;
	}
	//trace ("maxBet = "+maxBet.toString(10));
	var queryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `btc_account`=\""+requestData.params.account+"\" ORDER BY `index` DESC LIMIT 1", generator);
	if (queryResult.error != null) {
		trace ("Database error on RPC_getGameResults: "+queryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when processing the request.");
		return;
	}
	if (queryResult.rows.length == 0) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_NO_RESULTS, "Account \""+requestData.params.account+"\" was not found.");
		return;
	}
	if ((queryResult.rows[0].last_game_index != null) && (queryResult.rows[0].last_game_index > 0)) {
		var infoObject = new Object();
		infoObject.index = queryResult.rows[0].last_game_index;
		infoObject.account = requestData.params.account;
		infoObject.gameID = requestData.params.gameID;
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_GAME_ACTION_ERROR, "A game is still in progress.", infoObject);
		return;
	}
	var filterResult = yield plugins.RPC_login(queryResult, postData, generator);	
	if (filterResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, filterResult.code, filterResult.message, requestData.params.account);
		return;
	}
	//---- GENERATE INITIAL RESPONSE OBJECT ----
	var responseData = new Object();	
	var filterResult = yield plugins.RPC_bet(queryResult, requestData, generator);		
	if (filterResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, filterResult.code, filterResult.message, requestData.params.account);
		return;
	}
	var currentAvailBTCBalance = new BigNumber(queryResult.rows[0].btc_balance_available);	
	var currentConfBTCBalance = new BigNumber(queryResult.rows[0].btc_balance_verified);	
	var currentTokenBalance = currentAvailBTCBalance.times(serverConfig.tokensPerBTC);
	//---- CHECK & UPDATE ACCOUNT INFORMATION WHEN BALANCE LOW ----
	if (betAmount.greaterThan(currentTokenBalance)) {		
		//if balance = 0
		if (currentTokenBalance.equals(0) && (queryResult.rows[0].deposit_complete != true)) {
			if (serverConfig.autoDeposit != null) {
				var accountInfo = serverConfig.autoDeposit;
			} else {
				var accountInfo = yield checkAccountBalance(generator, requestData.params.account);
			}
			var btc_per_satoshi = new BigNumber("0.00000001");
			var bitcoinAmount =  new BigNumber(accountInfo.balance); //convert from Satoshis to Bitcoin
			bitcoinAmount=bitcoinAmount.times(btc_per_satoshi);
			var btcDelta = bitcoinAmount.minus(currentConfBTCBalance);
			bitcoinAmount=Number(bitcoinAmount.toString(10));			
			var uc_bitcoinAmount = new BigNumber(accountInfo.unconfirmed_balance);
			uc_bitcoinAmount=uc_bitcoinAmount.times(btc_per_satoshi);
			uc_bitcoinAmount=Number(uc_bitcoinAmount.toString(10));
			var total_oc_bitcoin = new BigNumber(accountInfo.final_balance);
			total_oc_bitcoin=total_oc_bitcoin.times(btc_per_satoshi);
			total_oc_bitcoin=Number(total_oc_bitcoin.toString(10));
			responseData.balance = new Object();
			responseData.balance.bitcoin = String(queryResult.rows[0].btc_balance_verified);
			responseData.balance.bitcoin_unconfirmed = String(queryResult.rows[0].btc_balance_available);
			var tokens = new BigNumber(responseData.balance.bitcoin_unconfirmed);	
			tokens = tokens.times(serverConfig.tokensPerBTC);
			responseData.balance.tokens = tokens.toString(10);
			if (serverConfig.allowUnconfirmedDeposit) {
				//currently enabled (in config)
				if ((uc_bitcoinAmount > 0) || (bitcoinAmount > 0)) {
					var newAvailBalance = null;
					if (bitcoinAmount == 0) {
						var dbUpdates = "`btc_balance_verified`=\""+String(bitcoinAmount)+"\",`btc_balance_available`=\""+String(uc_bitcoinAmount)+"\",`btc_balance_total`=\""+String(total_oc_bitcoin)+"\",`btc_balance_total_previous`=\""+String(total_oc_bitcoin)+"\",`deposit_complete`=TRUE,`last_login`=NOW()";	
						newAvailBalance = uc_bitcoinAmount.toString(10);
						currentTokenBalance = new BigNumber(String(uc_bitcoinAmount));
						currentTokenBalance = currentTokenBalance.times(serverConfig.tokensPerBTC);
					} else {
						//uncofirmed balance may be 0 at this point
						newAvailBalance = bitcoinAmount.toString(10);
						dbUpdates = "`btc_balance_verified`=\""+String(bitcoinAmount)+"\",`btc_balance_available`=\""+String(bitcoinAmount)+"\",`btc_balance_total`=\""+String(total_oc_bitcoin)+"\",`btc_balance_total_previous`=\""+String(total_oc_bitcoin)+"\",`deposit_complete`=TRUE,`last_login`=NOW()";	
						currentTokenBalance = new BigNumber(String(bitcoinAmount));
						currentTokenBalance = currentTokenBalance.times(serverConfig.tokensPerBTC);
					}
					if (queryResult.rows[0].auth_status == 2) {
						var accountPlugin = plugins.getPlugin("Portable Account Plugin");
						var dateStr = new Date().toISOString();
						var message = "A new deposit has been detected on the blockchain for your account.\n";
						message += "Confirmed blockchain balance (BTC): "+bitcoinAmount.toString(10)+"\n";
						message += "Unconfirmed blockchain balance (BTC): "+uc_bitcoinAmount.toString(10)+"\n";
						message += "Available balance (BTC): "+newAvailBalance;
						accountPlugin.sendEmail("myfruitgame@gmail.com", queryResult.rows[0].email, "New Deposit", message);						
					}
					global.logTx("Detected blockchain balance change for account: "+requestData.params.account);
					global.logTx("   Last live API update of balances: "+queryResult.rows[0].last_deposit_check);
					global.logTx("   Available Bitcoin balance (currently in database): "+queryResult.rows[0].btc_balance_available);
					global.logTx("   Confirmed Bitcoin balance (currently in database): "+queryResult.rows[0].btc_balance_verified);
					global.logTx("   Total Bitcoin balance (currently in database): "+queryResult.rows[0].btc_balance_total);
					global.logTx("   Total Bitcoin balance at last check (currently in database): "+queryResult.rows[0].btc_balance_total_previous);
					global.logTx("   Confirmed Bitcoin balance (as reported by API): "+bitcoinAmount.toString(10));
					global.logTx("   Unconfirmed Bitcoin balance (as reported by API): "+uc_bitcoinAmount.toString(10));
					global.logTx("   Total Bitcoin balance (as reported by API): "+total_oc_bitcoin.toString(10));
					//update gaming.accounts
					var txInfo = new Object();
					txInfo.type = "deposit";
					txInfo.info = new Object();
					txInfo.info.btc = btcDelta.toString(10);
					if (balanceDelta.isGreaterThan(0)) {
						var accountUpdateResult = yield global.updateAccount(queryResult, dbUpdates, txInfo, generator);
						if (accountUpdateResult.error != null) {
							trace ("Database error on RPC_getGameResults: "+accountUpdateResult.error);		
							trace ("   Request ID: "+requestData.id);
							txLog("    Couldn't update the database!");
							replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when updating the account.");
							return;
						}
					}
				}
			} else {
				//currently disabled (in config)
				if (bitcoinAmount > 0) {
					var dbUpdates = "`btc_balance_verified`=\""+responseData.balance.bitcoin+"\",`btc_balance_available`=\""+responseData.balance.bitcoin+"\",`deposit_complete`=TRUE,`last_login`=NOW()";	
					//update gaming.accounts
					var txInfo = new Object();
					txInfo.type = "balance_check";
					var accountUpdateResult = yield global.updateAccount(queryResult, dbUpdates, txInfo, generator);
					if (accountUpdateResult.error != null) {
						trace ("Database error on RPC_getGameResults: "+accountUpdateResult.error);		
						trace ("   Request ID: "+requestData.id);
						replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when updating the account.");
						return;
					}
				}
			}
		}
		if (betAmount.greaterThan(currentTokenBalance)) {
			//balance is still too low ... reply with error.
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_GAME_ACTION_ERROR, "Bet "+betAmount+" can't be placed. Available balance is "+currentTokenBalance);
			return;
		}
	}
	var betInfoObj = new Object();
	betInfoObj.tokens = betAmount.toString(10);
	betInfoObj.btc = btcBetAmount.toString(10);	
	var filterResult = yield plugins.RPC_jackpot(queryResult, requestData, betInfoObj, generator);		
	if (filterResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, filterResult.code, filterResult.message, requestData.params.account);
		return;
	}	
	//restore amounts that may have been updated in filter(s)
	btcBetAmount = new BigNumber(betInfoObj.btc);
	betAmount = new BigNumber(betInfoObj.tokens);
	global.logTx("Bet placed for game \""+requestData.params.gameID+"\" by account: "+requestData.params.account);
	global.logTx("   Available Bitcoin balance (currently in database): "+queryResult.rows[0].btc_balance_available);
	global.logTx("   Confirmed Bitcoin balance (currently in database): "+queryResult.rows[0].btc_balance_verified);
	global.logTx("   Total Bitcoin balance (currently in database): "+queryResult.rows[0].btc_balance_total);
	global.logTx("   Total bet amount in Bitcoin: "+betInfoObj.btc);
	global.logTx("   Total bet amount in tokens: "+betInfoObj.tokens);
	global.logTx("   Current tokens-per-Bitcoin multiplier: "+serverConfig.tokensPerBTC);
	//---- UPDATE JACKPOT AMOUNT ----	
	var gameJackpotID = serverConfig.gameConfigs[requestData.params.gameID]["jackpotID"];	
	betInfoObj = new Object();
	betInfoObj.btc = btcBetAmount;
	betInfoObj.deduction = new BigNumber(0);
	if ((gameJackpotID != null) && (gameJackpotID != undefined) && (gameJackpotID != "")) {
		var updateJackpotQueryResult = yield db.query("SELECT * FROM `gaming`.`jackpots` WHERE `jackpot_id`=\""+gameJackpotID+"\" LIMIT 1", generator);
		if (updateJackpotQueryResult.error != null) {
			trace ("Database error on RPC_getGameResults: "+updateJackpotQueryResult.error);
			trace ("   Request ID: "+requestData.id);
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when processing the request.");
			return;
		}
		if (updateJackpotQueryResult.rows.length > 0) {
			var dbJackpotID = updateJackpotQueryResult.rows[0].jackpot_id;
			var betContribution = new BigNumber(updateJackpotQueryResult.rows[0].bet_multiplier);
			//if ((updateJackpotQueryResult.rows[0].total == undefined) || (updateJackpotQueryResult.rows[0].total == null) || (updateJackpotQueryResult.rows[0].total == "NULL") || (updateJackpotQueryResult.rows[0].total == "")) {
			//	updateJackpotQueryResult.rows[0].total = "0";
			//}
			if ((updateJackpotQueryResult.rows[0].btc_total == undefined) || (updateJackpotQueryResult.rows[0].btc_total == null) || (updateJackpotQueryResult.rows[0].btc_total == "NULL") || (updateJackpotQueryResult.rows[0].btc_total == "")) {
				updateJackpotQueryResult.rows[0].btc_total = "0";
			}
			if ((betContribution != null) && (betContribution != undefined) && (betContribution != "") && (betContribution != "NULL")) {
				//var jackpotTotalTokens = new BigNumber(updateJackpotQueryResult.rows[0].total);
				var jackpotTotalBTC = new BigNumber(updateJackpotQueryResult.rows[0].btc_total);					
				//var contribution = betAmount.times(betContribution);					
				var contributionBTC = btcBetAmount.times(betContribution);				
				betInfoObj.deduction = contributionBTC;
				//jackpotTotalTokens = jackpotTotalTokens.add(contribution);
				jackpotTotalBTC = jackpotTotalBTC.add(contributionBTC);
				trace ("   Jackpot \""+dbJackpotID+"\" increased to: "+jackpotTotalBTC.toString(10)+" BTC");
				//var dbUpdates = "`total`="+jackpotTotalTokens.toString(10)+",";
				var dbUpdates = "`btc_total`=\""+jackpotTotalBTC.toString(10)+"\",";	
				dbUpdates += "`last_update`=NOW()";	
				var jackpotUpdateResult = yield db.query("UPDATE `gaming`.`jackpots` SET "+dbUpdates+" WHERE `jackpot_id`=\""+dbJackpotID+"\" AND `index`="+updateJackpotQueryResult.rows[0].index+" LIMIT 1", generator);
				responseData.jackpot = new Object();
				//responseData.jackpot.tokens = jackpotTotalTokens.toString(10);
				responseData.jackpot.bitcoin = jackpotTotalBTC.toString(10);
			}			
		}		
	}	
	var filterResult = yield plugins.RPC_onBet(queryResult, postData, betInfoObj, generator);
	if (filterResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, filterResult.code, filterResult.message, requestData.params.account);
		return;
	}
	// ---- GENERATE KEYS & IVs ----
	responseData.reelstopselections = new Array();	
	var numReels = 3;
	var keys = new Array();
	var ivs = new Array();
	for (count=0; count<numReels; count++) {
		keys.push(crypto.randomBytes(32)); //32 x 8 bits = 256 bits
		ivs.push(crypto.randomBytes(16)); //16 bytes
	}
	for (var count1 = 0; count1 < numReels; count1++) {
		var numReelSymbols = 20;
		responseData.reelstopselections.push([]);		
		for (var stopPosition = 0; stopPosition < numReelSymbols; stopPosition++) {
			var encryptedStopPosition = encrypt(stopPosition, keys[count1], ivs[count1]);
			responseData.reelstopselections[count1].push(encryptedStopPosition);			
		}
	}
	var numShuffles = 5;
	for (count1 = 0; count1 < numShuffles; count1++) {
		for (stopPosition = 0; stopPosition < numReels; stopPosition++) {
			responseData.reelstopselections[stopPosition] = shuffle(responseData.reelstopselections[stopPosition]);
		}
	}
	//---- CALCULATE BET(S) AND UPDATE BALANCE(S) ----
	var currentTokenBalance = currentTokenBalance.minus(betAmount);
	currentBTCBalance = currentTokenBalance.dividedBy(serverConfig.tokensPerBTC);
	//---- UPDATE DATABASE ----		
	//create array of keys/ivs to store with game data
	var keysArray = new Array();
	for (count=0; count<numReels; count++) {
		var newKeyObj = new Object();
		newKeyObj.key = keys[count];
		newKeyObj.iv = ivs[count];
		keysArray.push(newKeyObj);		
	}
	requestData.params.bet.btc = new BigNumber(requestData.params.bet.tokens);
	requestData.params.bet.btc = requestData.params.bet.btc.dividedBy(serverConfig.tokensPerBTC);
	requestData.params.bet.btc = requestData.params.bet.btc.toString(10);
	requestData.params.bet.btc_user_balance = currentBTCBalance.toString(10);
	requestData.params.bet.tokens_per_btc = serverConfig.tokensPerBTC.toString(10);
	var updateFields = "`account`,`game_id`,`results`,`keys`, `bet`, `complete`,`date_time`";
	var updateValues = "\""+requestData.params.account+"\", \""+requestData.params.gameID+"\", ";
	updateValues += "\""+querystring.escape(JSON.stringify(responseData))+"\", ";
	updateValues += "\"" +querystring.escape(JSON.stringify(keysArray))+"\", ";
	updateValues += "\"" +querystring.escape(JSON.stringify(requestData.params.bet))+"\", ";	
	updateValues += "false, ";
	updateValues += "NOW()";
	//update gaming.games
	var gamesUpdateResult = yield db.query("INSERT INTO `gaming`.`games` ("+updateFields+") VALUES ("+updateValues+")", generator);
	if (gamesUpdateResult.error != null) {
		trace ("Database error on RPC_getGameResults: "+gamesUpdateResult.error);		
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when processing the request.");
		return;
	}	
	var newGamesIndex = gamesUpdateResult.rows.insertId;	
	var dbUpdates = "`last_game_index`="+newGamesIndex+",";
	dbUpdates += "`btc_balance_available`=\""+currentBTCBalance.toString(10)+"\",";	
	dbUpdates += "`last_login`=NOW()";
	global.logTx("   New available Bitcoin balance: "+currentBTCBalance.toString(10));
	//update gaming.accounts
	var txInfo = new Object();
	txInfo.type = "bet";
	txInfo.info = new Object();
	txInfo.info.bet = requestData.params.bet;
	var accountUpdateResult = yield global.updateAccount(queryResult, dbUpdates, txInfo, generator);
	if (accountUpdateResult.error != null) {
		trace ("Database error on RPC_getGameResults: "+accountUpdateResult.error);		
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when processing the request.");
		return;
	}
	responseData.bet = requestData.params.bet;
	responseData.balance = new Object();
	responseData.balance.tokens = currentTokenBalance.toString(10);
	responseData.balance.bitcoin = currentBTCBalance.toString(10);
	var leaderboardData = new Object();
	leaderboardData.type = "bet";
	leaderboardData.gameID = requestData.params.gameID;
	leaderboardData.btc = requestData.params.bet.btc;
	leaderboardData.tokens = requestData.params.bet.tokens;
	leaderboardData.tokens_per_btc = requestData.params.bet.tokens_per_btc;
	updateLoaderboardData(leaderboardData);
	replyResult(postData, requestObj, responseObj, batchResponses, responseData);	
}

/**
* getGameStatus [RPC/generator]: Retrieves information for an in-progress game if one exists.
*
* @param postData The POST data included with the request. JSON object must contain:
*						gameID (String): Alpha-numeric game ID for which to get results.					
						account (String): The Bitcoin account making the request.
						password (String, optional): A password for the associated account.
						index (String): The primary key index of the game in the database
* @param requestObj The request object (https://nodejs.org/api/http.html#http_class_http_incomingmessage).
* @param requestObj The response object (https://nodejs.org/api/http.html#http_class_http_serverresponse).
* @param batchResponses An object containing expected responses for a batch. If null, this function is not being called as part of a batch. Usually the contents of this
* 			object are handled by the HTTP request processor and responder and so should not be updated.
*/
function *RPC_getGameStatus (postData, requestObj, responseObj, batchResponses) {
	var generator = yield;
	var requestData = JSON.parse(postData);
	//---- VERIFY PARAMETERS ----
	checkParameter(requestData, "index");
	checkParameter(requestData, "gameID");	
	checkParameter(requestData, "account");	
	var queryString = "SELECT * FROM `gaming`.`games` WHERE ";
	queryString += "`index`=\""+requestData.params.index+"\" AND";
	queryString += "`game_id`=\""+requestData.params.gameID+"\" AND";
	queryString += "`account`=\""+requestData.params.account+"\" ";
	queryString += "LIMIT 1"
	var gamesQueryResult = yield db.query(queryString, generator);
	if (gamesQueryResult.error != null) {
		trace ("Database error on RPC_getGameStatus: "+gamesQueryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when processing the request.");
		return;
	}
	if (gamesQueryResult.rows.length == 0) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_NO_RESULTS, "No open games matching supplied parameters.");
		return;
	}
	var accountQueryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `btc_account`=\""+requestData.params.account+"\" ORDER BY `index` DESC LIMIT 1", generator);
	if (accountQueryResult.error != null) {
		trace ("Database error on RPC_getGameStatus: "+accountQueryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when processing the request.");
		return;
	}
	if (accountQueryResult.rows.length == 0) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_NO_RESULTS, "Account \""+requestData.params.account+"\" was not found.");
		return;
	}
	var filterResult = yield plugins.RPC_login(accountQueryResult, postData, generator);
	if (filterResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, filterResult.code, filterResult.message, requestData.params.account);
		return;
	}
	var currentTokenBalance = new BigNumber(accountQueryResult.rows[0].btc_balance_available);
	currentTokenBalance = currentTokenBalance.times(serverConfig.tokensPerBTC);
	var responseData = new Object();
	responseData = JSON.parse(querystring.unescape(gamesQueryResult.rows[0].results));
	responseData.bet = JSON.parse(querystring.unescape(gamesQueryResult.rows[0].bet));
	responseData.balance = new Object();
	responseData.balance.bitcoin = accountQueryResult.rows[0].btc_balance_available;
	responseData.balance.tokens = currentTokenBalance.toString(10);
	responseData.balance.bitcoin_confirmed = accountQueryResult.rows[0].btc_balance_verified;	
	var tokens = new BigNumber(accountQueryResult.rows[0].btc_balance_available);	
	tokens = tokens.times(serverConfig.tokensPerBTC);
	responseData.balance.tokens = tokens.toString(10);
	//include fees information
	responseData.fees = new Object();
	for (var APIName in serverConfig.APIInfo) {
		var currentAPI = serverConfig.APIInfo[APIName];
		var satoshiPerBTC = new BigNumber("100000000");
		responseData.fees.bitcoin = currentAPI.minerFee.dividedBy(satoshiPerBTC).toString(10);
		responseData.fees.satoshis = currentAPI.minerFee.toString(10);
	}
	replyResult(postData, requestObj, responseObj, batchResponses, responseData);
}

/**
* selectResults [RPC/generator]: Selects the game results, calculates winnings, udpates the database, and completes the game.
*
* @param postData The POST data included with the request. JSON object must contain:
*						gameID (String): Alpha-numeric game ID for which to get results.
						account (String): The Bitcoin account making the request.
						password (String, optional): A password for the associated account.
						results (Array): An indexed array with one encrypted selection per reel.									
* @param requestObj The request object (https://nodejs.org/api/http.html#http_class_http_incomingmessage).
* @param requestObj The response object (https://nodejs.org/api/http.html#http_class_http_serverresponse).
* @param batchResponses An object containing expected responses for a batch. If null, this function is not being called as part of a batch. Usually the contents of this
* 			object are handled by the HTTP request processor and responder and so should not be updated.
*/
function *RPC_selectResults (postData, requestObj, responseObj, batchResponses) {
	var generator = yield;
	var requestData = JSON.parse(postData);
	//---- VERIFY PARAMETERS ----	
	checkParameter(requestData, "gameID");	
	checkParameter(requestData, "account");
	checkParameter(requestData, "results");
	var queryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `btc_account`=\""+requestData.params.account+"\" ORDER BY `index` DESC LIMIT 1", generator);
	if (queryResult.error != null) {
		trace ("Database error on RPC_selectResults: "+queryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when processing the request.");
		return;
	}
	if (queryResult.rows.length == 0) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_NO_RESULTS, "Account \""+requestData.params.account+"\" was not found.");
		return;
	}
	if ((queryResult.rows[0].last_game_index == null) || (queryResult.rows[0].last_game_index == 0) || (queryResult.rows[0].last_game_index == "") || (queryResult.rows[0].last_game_index == "NULL")) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_GAME_ACTION_ERROR, "No game is currently in progress.");
		return;
	}
	var filterResult = yield plugins.RPC_login(queryResult, postData, generator);
	if (filterResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, filterResult.code, filterResult.message, requestData.params.account);
		return;
	}
	//---- VERIFY RESULT SELECTIONS ----
	var queryString = "SELECT * FROM `gaming`.`games` WHERE ";
	queryString += "`index`=\""+queryResult.rows[0].last_game_index+"\" AND";
	queryString += "`game_id`=\""+requestData.params.gameID+"\" AND";
	queryString += "`account`=\""+requestData.params.account+"\" ";
	queryString += "LIMIT 1"
	var gamesQueryResult = yield db.query(queryString, generator);
	if (gamesQueryResult.error != null) {
		trace ("Database error on RPC_selectResults: "+gamesQueryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when processing the request.");
		return;
	}
	if (gamesQueryResult.rows.length == 0) {
		var dataObject = new Object();
		dataObject.index = queryResult.rows[0].last_game_index;
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_NO_RESULTS, "No such game record exists.", dataObject);
		return;
	}
	if (gamesQueryResult.rows[0].complete) {
		//game has already been completed, ensure accounts table entry is reset for user
		dbUpdates = "`last_game_index`=NULL,";
		dbUpdates += "`last_login`=NOW()";
		var txInfo = new Object();
		txInfo.type = "game_reset";
		var accountUpdateResult = yield global.updateAccount(queryResult, dbUpdates, txInfo, generator);
		dataObject = new Object();
		dataObject.index = queryResult.rows[0].last_game_index;
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_GAME_ACTION_ERROR, "The game is already complete.", dataObject);
		return;
	}	
	var resultsObject = JSON.parse(querystring.unescape(gamesQueryResult.rows[0].results));
	if (resultsObject.reelstopselections.length != requestData.params.results.length) {
		var dataObject = new Object();
		dataObject.selectionsNum = requestData.params.results.length;
		dataObject.gameSelectionsNum = resultsObject.reelstopselections.length;
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_GAME_ACTION_ERROR, "Number of selections do not match available game selections.", dataObject);
		return;
	}
	//---- VERIFY AGAINST STORED RESULT SELECTIONS ----
	for (var count=0; count < resultsObject.reelstopselections.length; count++) {
		var currentReelStops = resultsObject.reelstopselections[count];		
		var currentPlayerSelection = requestData.params.results[count];
		var found = false;
		for (var count2=0; count2 < currentReelStops.length; count2++) {
			if (currentPlayerSelection == currentReelStops[count2]) {
				found=true;				
			}
		}
		if (found == false) {
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_GAME_ACTION_ERROR, "Selections do not match available game selections.", resultsObject);
			return;
		}
	}	
	//---- EXTRACT DECRYPTION KEYS/IVs ----	
	var rawKeyData = JSON.parse(querystring.unescape(gamesQueryResult.rows[0].keys));	
	var keysArray = new Array();	
	for (var count=0; count < rawKeyData.length; count++) {
		var dataType = rawKeyData[count].key.type; //assume same for both key and iv
		switch (dataType) {
			case "Buffer" : 
						var keyBuff = new Buffer(rawKeyData[count].key.data);
						var ivBuff = new Buffer(rawKeyData[count].iv.data);						
						var keyObject = new Object();
						keyObject.key = keyBuff;
						keyObject.iv = ivBuff;
						keysArray.push(keyObject);
						break;
			default: break;
		}
	}	
	var returnData = new Object();
	returnData.encryptedResults = new Array();
	returnData.decryptedResults = new Array();
	returnData.keys = keysArray;
	for (count=0; count < requestData.params.results.length; count++) {
		var encryptedPosition = requestData.params.results[count];
		returnData.encryptedResults.push(encryptedPosition);
		var decryptedPosition = decrypt(encryptedPosition, keysArray[count].key, keysArray[count].iv);
		returnData.decryptedResults.push(decryptedPosition);
	}
	if ((serverConfig.gameConfigs[requestData.params.gameID]["jackpotID"] != undefined) && 
		(serverConfig.gameConfigs[requestData.params.gameID]["jackpotID"] != null) &&
		(serverConfig.gameConfigs[requestData.params.gameID]["jackpotID"] != "")) {
		var jackpotQueryResult = yield db.query("SELECT * FROM `gaming`.`jackpots` WHERE `jackpot_id`=\""+serverConfig.gameConfigs[requestData.params.gameID].jackpotID+"\" LIMIT 1", generator);
		if (jackpotQueryResult.error != null) {
			jackpotQueryResult = null;
		}
	} else {
		jackpotQueryResult = null;
	}	
	if (jackpotQueryResult != null) {
		returnData.jackpot = new Object();
		//returnData.jackpot.tokens = jackpotQueryResult.rows[0].total;
		returnData.jackpot.bitcoin = jackpotQueryResult.rows[0].btc_total;
	}
	var winInfoObj=new Object();
	winInfoObj.btc = new BigNumber(0);
	winInfoObj.deduction = new BigNumber(0);
	//Uncomment to enable jackpot win on every spin in 3-Reel Fruit Slots (these are simply the stop positions of the cherries on the reels, encoded as strings with leadings 0s):
	//returnData.decryptedResults = ["00000000000000000006","00000000000000000001","00000000000000000011"];
	var winInfo = generateWinInfo(serverConfig.gameConfigs[requestData.params.gameID], returnData.decryptedResults, jackpotQueryResult);
	returnData.reelsInfo = new Object();
	returnData.reelsInfo.symbols = winInfo.symbols; //copy objects individually to exclude multiplier (include elsewhere)
	returnData.reelsInfo.stopPositions = winInfo.stopPositions;
	returnData.bet = JSON.parse(querystring.unescape(gamesQueryResult.rows[0].bet));
	returnData.win = calculateWin(returnData.bet, ["tokens"], winInfo.multiplier, winInfo.jackpot);
	var currentTokenBalance = new BigNumber(queryResult.rows[0].btc_balance_available);
	var previousTokenBalance = new BigNumber(queryResult.rows[0].btc_balance_available);
	var tokensWon = new BigNumber (returnData.win.tokens);
	winInfoObj.btc = tokensWon.dividedBy(serverConfig.tokensPerBTC);
	currentTokenBalance = currentTokenBalance.times(serverConfig.tokensPerBTC);
	previousTokenBalance = previousTokenBalance.times(serverConfig.tokensPerBTC);
	currentTokenBalance = currentTokenBalance.add(tokensWon);	
	returnData.balance = new Object();
	returnData.balance.tokens = currentTokenBalance.toString(10);	
	var currentBTCBalance = currentTokenBalance.dividedBy(serverConfig.tokensPerBTC);
	returnData.balance.bitcoin = currentBTCBalance.toString(10);
	if ((returnData.reelsInfo.error != null) && (returnData.reelsInfo.error != undefined)) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_GAME_ACTION_ERROR, "Could not calculate win.", returnData.win.error);
		return;
	}
	//update jackpot info with new winner
	var dbUpdates = "`last_winner`=\""+requestData.params.account+"\",";
//	dbUpdates += "`total`=\""+currentBTCBalance.toString(10)+"\",";
	dbUpdates += "`btc_total`=\""+jackpotQueryResult.rows[0].btc_base+"\",";
	dbUpdates += "`last_update`=NOW()";
	if (returnData.win.jackpotWin == true) {
		//jackpot has been won ... update the database
		var jackpotUpdateResult = yield db.query("UPDATE `gaming`.`jackpots` SET "+dbUpdates+" WHERE `jackpot_id`=\""+jackpotQueryResult.rows[0].jackpot_id+"\" AND `index`="+jackpotQueryResult.rows[0].index+" LIMIT 1", generator);
		if (jackpotUpdateResult.error != null) {
			trace ("Database error on RPC_selectResult: "+accountUpdateResult.error);		
			trace ("   Request ID: "+requestData.id);
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when processing the request.");
			return;
		}
	}
	//clean up accounts table
	dbUpdates = "`last_game_index`=NULL,";
	dbUpdates += "`btc_balance_available`=\""+currentBTCBalance.toString(10)+"\",";
	var dateObj = new Date();
	dateObj.setSeconds(dateObj.getSeconds()+2); //forces the transaction to appear after bet/win info in history (NOW()+2 sometimes causes errors)	
	dbUpdates += "`last_login`=\""+getMySQLTimeStamp(dateObj)+"\"";
	global.logTx("Win calculated in game \""+requestData.params.gameID+"\" for account: "+requestData.params.account);
	global.logTx("   Available Bitcoin balance (currently in database): "+queryResult.rows[0].btc_balance_available);
	global.logTx("   Confirmed Bitcoin balance (currently in database): "+queryResult.rows[0].btc_balance_verified);
	global.logTx("   Total Bitcoin balance (currently in database): "+queryResult.rows[0].btc_balance_total);
	global.logTx("   Total current calculated token balance: "+previousTokenBalance.toString(10));
	global.logTx("   Tokens won: "+tokensWon.toString(10));
	global.logTx("   Total new calculated token balance: "+currentTokenBalance.toString(10));
	global.logTx("   New available Bitcoin balance: "+currentBTCBalance.toString(10));
	global.logTx("   Current tokens-per-Bitcoin multiplier: "+serverConfig.tokensPerBTC);
	//update gaming.accounts
	var txInfo = new Object();
	txInfo.type = "win";
	txInfo.info = new Object();
	txInfo.info.bet = returnData.bet;
	txInfo.info.win = returnData.win;
	txInfo.info.win.btc = winInfoObj.btc;
	var accountUpdateResult = yield global.updateAccount(queryResult, dbUpdates, txInfo, generator);
	if (accountUpdateResult.error != null) {
		trace ("Database error on RPC_selectResult: "+accountUpdateResult.error);		
		trace ("   Request ID: "+requestData.id);
		global.logTx("   Couldn't update database!");
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when processing the request.");
		return;
	}
	var filterResult = yield plugins.RPC_onWin(queryResult, postData, winInfoObj, generator);
	if (filterResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, filterResult.code, filterResult.message, requestData.params.account);
		return;
	}
	var selectionsObj = new Object();
	var winsObj = new Object();
	winsObj.games = new Object();
	winsObj.games[requestData.params.gameID] = new Object();
	winsObj.games[requestData.params.gameID].tokens = tokensWon.toString(10);
	winsObj.games[requestData.params.gameID].btc = tokensWon.dividedBy(serverConfig.tokensPerBTC).toString(10);
	winsObj.games[requestData.params.gameID].btc_user_balance = currentBTCBalance.toString(10);
	winsObj.games[requestData.params.gameID].tokens_per_btc = serverConfig.tokensPerBTC.toString(10);
	winsObj.games[requestData.params.gameID].jackpot_win = returnData.win.jackpotWin;
	selectionsObj.encrypted = returnData.encryptedResults;
	selectionsObj.decrypted = returnData.decryptedResults;
	var selectionsDBString = JSON.stringify(selectionsObj);
	var winsObjString = JSON.stringify(winsObj);
	var dbUpdates = "`complete`=true,";
	dbUpdates += "`selections`=\""+querystring.escape(selectionsDBString)+"\",";
	dbUpdates += "`wins`='"+winsObjString+"',";
	dbUpdates += "`date_time`=NOW()";	
	//update gaming.accounts -- don't add new row as this makes history appear incorrect without requiring a lot of sorting
	var accountUpdateResult = yield db.query("UPDATE `gaming`.`games` SET "+dbUpdates+" WHERE `account`=\""+requestData.params.account+"\" AND `index`="+gamesQueryResult.rows[0].index+" LIMIT 1", generator);
	if (accountUpdateResult.error != null) {
		trace ("Database error on RPC_selectResults 2: "+accountUpdateResult.error);		
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when processing the request.");
		return;
	}
	var leaderboardData = new Object();
	leaderboardData.type = "win";
	leaderboardData.gameID = requestData.params.gameID;
	leaderboardData.btc = winsObj.games[requestData.params.gameID].btc
	leaderboardData.tokens = winsObj.games[requestData.params.gameID].tokens
	leaderboardData.tokens_per_btc = winsObj.games[requestData.params.gameID].tokens_pers_btc;
	updateLoaderboardData(leaderboardData);
	replyResult(postData, requestObj, responseObj, batchResponses, returnData);
}


function updateLoaderboardData(updateObj) {
	if ((updateObj == null) || (updateObj == undefined)) {
		return;
	}
	if ((updateObj["gameID"] == null) || (updateObj["gameID"] == undefined) || (updateObj["gameID"] == "")) {
		return;
	}
	if ((updateObj["type"] == null) || (updateObj["type"] == undefined) || (updateObj["type"] == "")) {
		return;
	}
	if ((global.leaderboardData["last_bet"] == null) || (global.leaderboardData["last_bet"] == undefined)) {
		global.leaderboardData["last_bet"] = new Object();
	}
	if (updateObj.type == "win") {
		if ((global.leaderboardData["games"] == null) || (global.leaderboardData["games"] == undefined)) {
			global.leaderboardData["games"] = new Object();
		}
		if ((global.leaderboardData.games[updateObj.gameID] == null) || (global.leaderboardData.games[updateObj.gameID] == undefined)) {
			global.leaderboardData.games[updateObj.gameID] = new Object();
		}
		var gameDataObj = global.leaderboardData.games[updateObj.gameID];
		if ((gameDataObj["btc"] == null) || (gameDataObj["btc"] == undefined) || (gameDataObj["btc"] == "")) {
			gameDataObj["btc"] = "0";
		}
		if ((gameDataObj["tokens"] == null) || (gameDataObj["tokens"] == undefined) || (gameDataObj["tokens"] == "")) {
			gameDataObj["tokens"] = "0";
		}
		if ((gameDataObj["tokens_per_btc"] == null) || (gameDataObj["tokens_per_btc"] == undefined) || (gameDataObj["tokens_per_btc"] == "")) {
			gameDataObj["tokens_per_btc"] = "0";
		}
		var valueUpdated = false;
		if ((updateObj["btc"] != null) && (updateObj["btc"] != undefined) && (updateObj["btc"] != "")) {
			var currentValue = new BigNumber(gameDataObj.btc);
			var newValue = new BigNumber(updateObj.btc);
			if (newValue.greaterThan(currentValue)) {
				gameDataObj.btc = updateObj.btc;
				valueUpdated = true;
			}
		}
		if ((updateObj["tokens"] != null) && (updateObj["tokens"] != undefined) && (updateObj["tokens"] != "")) {
			currentValue = new BigNumber(gameDataObj.tokens);
			newValue = new BigNumber(updateObj.tokens);
			if (newValue.greaterThan(currentValue)) {
				gameDataObj.tokens = updateObj.tokens;
				valueUpdated = true;
			}
		}
		if ((updateObj["tokens_per_btc"] != null) && (updateObj["tokens_per_btc"] != undefined) && (updateObj["tokens_per_btc"] != "") && valueUpdated) {
			gameDataObj.tokens_per_btc = updateObj.tokens_per_btc;
		}
	} else if (updateObj.type == "bet") {
		var gameObj = new Object();
		gameObj.gameID = null;
		gameObj.btc = "0";
		gameObj.tokens = "0"
		gameObj.tokens_per_btc =  "0";
		if ((updateObj["gameID"] != null) && (updateObj["gameID"] != undefined) && (updateObj["gameID"] != "")) {
			gameObj.gameID = updateObj.gameID;
		}
		if ((updateObj["btc"] != null) && (updateObj["btc"] != undefined) && (updateObj["btc"] != "")) {
			gameObj.btc = updateObj.btc;
		}
		if ((updateObj["tokens"] != null) && (updateObj["tokens"] != undefined) && (updateObj["tokens"] != "")) {
			gameObj.tokens = updateObj.tokens;
		}
		if ((updateObj["tokens_per_btc"] != null) && (updateObj["tokens_per_btc"] != undefined) && (updateObj["tokens_per_btc"] != "")) {
			gameObj.tokens_per_btc = updateObj.tokens_per_btc;
		}
		gameObj.timestamp =  new Date().toISOString();
		global.leaderboardData.last_bet.push(gameObj);
		if (global.leaderboardData.last_bet.length > 10) {
			global.leaderboardData.last_bet.shift();
		}
		/*
		global.leaderboardData.last_bet.gameID = null;
		global.leaderboardData.last_bet.btc = "0";
		global.leaderboardData.last_bet.tokens = "0";
		global.leaderboardData.last_bet.tokens_per_btc = "0";
		global.leaderboardData.last_bet.timestamp = new Date().toISOString();
		if ((updateObj["btc"] != null) && (updateObj["btc"] != undefined) && (updateObj["btc"] != "")) {
			global.leaderboardData.last_bet.btc = updateObj.btc;
		}
		if ((updateObj["tokens"] != null) && (updateObj["tokens"] != undefined) && (updateObj["tokens"] != "")) {
			global.leaderboardData.last_bet.tokens = updateObj.tokens;
		}
		if ((updateObj["tokens_per_btc"] != null) && (updateObj["tokens_per_btc"] != undefined) && (updateObj["tokens_per_btc"] != "")) {
			global.leaderboardData.last_bet.tokens_per_btc = updateObj.tokens_per_btc;
		}
		if ((updateObj["gameID"] != null) && (updateObj["gameID"] != undefined) && (updateObj["gameID"] != "")) {
			global.leaderboardData.last_bet.gameID = updateObj.gameID;
		}
		*/
	}
}

/**
* cashOut [RPC/generator]: Cashes out the specified Bitcoin balance by invoking an external service.
*
* @param postData The POST data included with the request. JSON object must contain:
						account (String): The Bitcoin account making the request.
						password (String, optional): A password for the associated account.
						receiver (String): The Bitcoin account to send the available funds to.						
* @param requestObj The request object (https://nodejs.org/api/http.html#http_class_http_incomingmessage).
* @param requestObj The response object (https://nodejs.org/api/http.html#http_class_http_serverresponse).
* @param batchResponses An object containing expected responses for a batch. If null, this function is not being called as part of a batch. Usually the contents of this
* 			object are handled by the HTTP request processor and responder and so should not be updated.
*/
function *RPC_cashOut (postData, requestObj, responseObj, batchResponses) {
	var generator = yield;
	var requestData = JSON.parse(postData);
	//---- VERIFY PARAMETERS ----	
	checkParameter(requestData, "account");	
	checkParameter(requestData, "receiver");
	var returnData = new Object();
	trace ("Requesting cash out on account: "+requestData.params.account);
	trace ("                    sending to: "+requestData.params.receiver);
	if (requestData.params.account == "TEST") {
		trace ("                    bypassing...");
		returnData.txhash = "test";
		replyResult(postData, requestObj, responseObj, batchResponses, returnData);
		return;
	}
	var queryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `btc_account`=\""+requestData.params.account+"\" ORDER BY `index` DESC LIMIT 1", generator);
	if (queryResult.error != null) {
		trace ("Database error on RPC_cashOut: "+queryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when processing the request.");
		return;
	}
	if (queryResult.rows.length == 0) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_NO_RESULTS, "Account \""+requestData.params.account+"\" was not found.");
		return;
	}
	if (Number(queryResult.rows[0].last_game_index) > 0) {		
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_GAME_ACTION_ERROR, "A game is still in progress.");
		return;
	}
	var filterResult = yield plugins.RPC_login(queryResult, postData, generator);
	if (filterResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, filterResult.code, filterResult.message, requestData.params.account);
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
	var withdrawalBTC = new BigNumber(0);
	if ((requestData.params["btc"] != undefined) && (requestData.params["btc"] != "") && (requestData.params["btc"] != null)) {
		withdrawalBTC = new BigNumber(requestData.params.btc);
	} else {
		withdrawalBTC = new BigNumber(currentAvailBTCBalance);
	}
	var withdrawalSatoshis = new BigNumber(withdrawalBTC.toString(10));
	withdrawalSatoshis = withdrawalSatoshis.times(satoshiPerBTC);
	//---- CHECK ACCOUNT CONFIRMATIONS AND ALLOWABLE WITHDRAWALS ----
	global.logTx("Attempting cashout for account: "+requestData.params.account);
	global.logTx("   Target address: "+requestData.params.receiver);
	global.logTx("   Requested cashount amount in Bitcoins: "+currentBTCBalance.toString(10));
	global.logTx("   Current confirmed balance in Bitcoins: "+currentAvailBTCBalance.toString(10));
	global.logTx("   Current miner fee in Satoshis: "+serverConfig.APIInfo.blockcypher.minerFee.toString(10));
	if (currentBTCBalance.equals(0) && (serverConfig.allowUnconfirmedWithdrawal == false)) {
		trace ("   Not enough confirmations to withdraw. Checking blockchain balance...");
		var accountInfo=yield checkAccountBalance(generator, requestData.params.account);
		var btc_per_satoshi= new BigNumber("0.00000001");
		var bitcoinAmount =  new BigNumber(accountInfo.balance);
		bitcoinAmount = bitcoinAmount.times(btc_per_satoshi);
		bitcoinAmount = Number(bitcoinAmount.toString(10));
		var uc_bitcoinAmount = new BigNumber(accountInfo.unconfirmed_balance);	
		uc_bitcoinAmount = uc_bitcoinAmount.times(btc_per_satoshi);
		uc_bitcoinAmount = Number(uc_bitcoinAmount.toString(10));
		var total_oc_bitcoin = new BigNumber(accountInfo.final_balance);
		total_oc_bitcoin = total_oc_bitcoin.times(btc_per_satoshi);
		total_oc_bitcoin = Number(total_oc_bitcoin.toString(10));
		global.logTx("   Confirmed Bitcoin balance (as returned by API): "+bitcoinAmount.toString(10));
		global.logTx("   Unconfirmed Bitcoin balance (as returned by API): "+uc_bitcoinAmount.toString(10));
		global.logTx("   Total Bitcoin balance (as returned by API): "+total_oc_bitcoin.toString(10));
		var dbUpdates = "`btc_balance_verified`=\""+bitcoinAmount.toString(10)+"\",`btc_balance_total`=\""+total_oc_bitcoin.toString(10)+"\",`btc_balance_total_previous`=\""+total_oc_bitcoin.toString(10)+"\",`last_login`=NOW()";
		//update gaming.accounts
		var txInfo = new Object();
		txInfo.type = "balance_check";
		txInfo.info = new Object();
		txInfo.info.btc = bitcoinAmount;
		var accountUpdateResult = yield global.updateAccount(queryResult, dbUpdates, txInfo, generator);
		if (accountUpdateResult.error != null) {
			trace ("Database error on RPC_cashOut: "+accountUpdateResult.error);		
			trace ("   Request ID: "+requestData.id);
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when updating the account.");
			return;
		}
		currentBTCBalance = new BigNumber(accountInfo.balance);
		currentBTCBalance = currentBTCBalance.dividedBy(satoshiPerBTC);
		currentSatoshiBalance = new BigNumber(accountInfo.balance);		
		currentAvailSatoshiBalance = currentAvailBTCBalance.times(satoshiPerBTC);
		currentAvailSatoshiBalance = currentAvailSatoshiBalance.minus(serverConfig.APIInfo.blockcypher.minerFee);
		currentAvailBTCBalance = currentAvailSatoshiBalance.dividedBy(satoshiPerBTC);
	}
	if (currentBTCBalance.equals(0) && (serverConfig.allowUnconfirmedWithdrawal == false)) {
		trace ("      Confirmed balance is 0.");
		global.logTx ("   Not enough confirmations to cash out.")
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_GAME_ACTION_ERROR, "Your verified BTC balance is 0. More confirmations are necessary before you can cash out.");
		return;	
	}
	if (currentAvailSatoshiBalance.lessThanOrEqualTo(0)) {
		trace ("      Available balance minus miner fee is <= 0.");
		global.logTx ("   Available balance minus miner fee is less than or equal to 0.")
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_GAME_ACTION_ERROR, "Your available balance, minus the miner fee ("+serverConfig.APIInfo.blockcypher.minerFee.toString()+" satoshis) is insufficient to make a withdrawal.");
		return;	
	}
	trace ("   Enough confirmations to withdraw.");
	if (withdrawalBTC.greaterThanOrEqualTo(serverConfig.maxWithdrawal.btc)) {
		trace ("Withdrawal amount exceeds allowable limit. Sending administration notifications.");
		var accountPlugin = plugins.getPlugin("Portable Account Plugin");
		//do we want to create some sort of reference number for the user/admins here?
		for (var count=0; count < serverConfig.maxWithdrawal.emails.length; count++) {
			var currentAdminEmail = serverConfig.maxWithdrawal.emails[count];
			trace ("Sending over-limit notification to: "+currentAdminEmail);
			accountPlugin.sendEmail("myfruitgame@gmail.com", 
				currentAdminEmail,
				"Over Limit Withdrawal Request", 
				"Account "+requestData.params.account+" is requesting a large withdrawal of: "+withdrawalBTC.toString(10)+" BTC.\nAvailable balance: "+currentBTCBalance.toString(10)+" BTC."
			);
		}
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_GAME_ACTION_ERROR, "Withdrawal amount exceeds allowable maximum. A request has been sent to the administrators to process this transaction manually.");
		return;	
		
	}
	var extraData = JSON.parse(querystring.unescape(queryResult.rows[0].extra_data));
	if (currentAvailSatoshiBalance.greaterThan(currentSatoshiBalance)) {
		//withdraw from bankroll account
		trace ("      Making withdrawal from bankroll account.");
		if (serverConfig.APIInfo.blockcypher.network == "btc/test3") {
			var withdrawalAccount = serverConfig.getNextWithdrawalAccount("tbtc");
		} else {
			withdrawalAccount = serverConfig.getNextWithdrawalAccount("btc");
		}
		global.logTx("   Available balance exceeds deposit amount so using bankroll account as sender: "+withdrawalAccount);
		var wif = withdrawalAccount.wif;
		var txSkeleton = yield getTxSkeleton (generator, withdrawalAccount.account, requestData.params.receiver, withdrawalSatoshis.toString());
	} else {
		//withdraw from deposit account
		trace ("      Making withdrawal from deposit account.");
		wif = extraData.wif;
		txSkeleton = yield getTxSkeleton (generator, queryResult.rows[0].btc_account, requestData.params.receiver, withdrawalSatoshis.toString());
	}
	global.logTx ("  Created transaction:");
	global.logTx(" ");
	global.logTx(JSON.stringify(txSkeleton));
	global.logTx(" ");
	if ((txSkeleton == undefined) || (txSkeleton == null)) {
		trace ("      Transaction skeleton couldn't be created.");
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_GAME_ACTION_ERROR, "There was a problem creating your transaction.");
		return;
	}
	if ((txSkeleton["error"] != null) && (txSkeleton["error"] != undefined) && (txSkeleton["error"] != "")) {
		trace ("      Error creating transaction skeleton: "+txSkeleton.error);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_GAME_ACTION_ERROR, "There was a problem creating your transaction.");
		return;
	}
	var signedTx = signTxSkeleton (txSkeleton, wif);
	if (signedTx == null) {
		trace ("      Error signing transaction skeleton.");
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_GAME_ACTION_ERROR, "There was a problem creating your transaction.");
		return;
	}
	global.logTx ("  Signed transaction:");
	global.logTx(" ");
	global.logTx(JSON.stringify(signedTx));
	global.logTx(" ");
	var sentTx = yield sendTransaction(generator, signedTx);
	trace ("      Posted transaction: "+JSON.stringify(sentTx));
	global.logTx ("  Posted transaction:");
	global.logTx(" ");
	global.logTx(JSON.stringify(sentTx));
	global.logTx(" ");
	returnData = sentTx;
	if ((sentTx["tx"] != undefined) && (sentTx["tx"] != null)) {
		if ((sentTx.tx["hash"] != null) && (sentTx.tx["hash"] != undefined) && (sentTx.tx["hash"] != "") && (sentTx.tx["hash"] != "NULL")) {
			var btcBalanceVerified = currentBTCBalance.minus(withdrawalBTC);
			btcBalanceVerified = btcBalanceVerified.minus(serverConfig.APIInfo.blockcypher.minerFee.dividedBy(satoshiPerBTC));
			var btcBalanceAvail = new BigNumber(queryResult.rows[0].btc_balance_available);
			btcBalanceAvail = btcBalanceAvail.minus(withdrawalBTC);
			btcBalanceAvail = btcBalanceAvail.minus(serverConfig.APIInfo.blockcypher.minerFee.dividedBy(satoshiPerBTC));
			if (btcBalanceVerified.lessThan(0)) {
				btcBalanceVerified = new BigNumber(0);
			}
			if (btcBalanceAvail.lessThan(0)) {
				//can this ever happen?
				btcBalanceAvail = new BigNumber(0);
			}
			//reset the database entry
			var dbUpdates = "`btc_balance_available`=\""+btcBalanceAvail.toString(10)+"\",";	
			dbUpdates += "`btc_balance_verified`=\""+btcBalanceVerified.toString(10)+"\",";
			dbUpdates += "`btc_deposit_account`=\""+requestData.params.receiver+"\",";
			dbUpdates += "`last_login`=NOW()";
			//update gaming.accounts
			global.logTx("   New confirmed balance in Bitcoin: "+currentBTCBalance.toString(10));
			global.logTx("   New availabble balance in Bitcoin: "+btcBalanceVerified.toString(10));
			var txInfo = new Object();
			txInfo.type = "withdrawal";
			txInfo.info = new Object();
			txInfo.info.btc = withdrawalBTC.plus(serverConfig.APIInfo.blockcypher.minerFee.dividedBy(satoshiPerBTC)).toString(10);
			txInfo.info.recipientAddress = requestData.params.receiver;
			var accountUpdateResult = yield global.updateAccount(queryResult, dbUpdates, txInfo, generator);
		}
	}
	replyResult(postData, requestObj, responseObj, batchResponses, returnData);
}


function *RPC_getLeaderboard (postData, requestObj, responseObj, batchResponses) {
	var generator = yield;
	var requestData = JSON.parse(postData);
	var returnData = new Object();
	returnData.leaderboard = global.leaderboardData;
	replyResult(postData, requestObj, responseObj, batchResponses, returnData);
}

//*************************** UTILITY FUNCTIONS *************************************

function *updateAccountGen(accountQueryResult, updateObj, txInfo, generator) {
	var localGen = yield;
	if ((txInfo == null) || (txInfo == undefined)) {
		txInfo = new Object();
	}
	if (typeof(updateObj) == "string") {
		//updateObj is a string containing name/value pairs delimited by equal signs and separated by commas
		var updateSplit = updateObj.split(",");
		for (var count=0; count < updateSplit.length; count++) {
			var updateItemSplit = updateSplit[count].split("=");
			var itemName = updateItemSplit[0];
			itemName = itemName.split("`").join("");
			var itemValue = updateItemSplit[1];
			itemValue = itemValue.split("\"").join("");
			if ((itemValue == "NULL") || (itemValue == "null")) {
				itemValue = null; 
			}
			accountQueryResult.rows[0][itemName] = itemValue;
		}
	} else {
		//updateObj is an object containing name/value pairs
		for (var item in updateObj) {
			//overwrite existing data with update values
			accountQueryResult.rows[0][item] = updateObj[item];
		}
	}
	//construct INSERT fields and values
	var insertFields = "(";
	var insertValues = "(";
	for (item in accountQueryResult.rows[0]) {
		if (item != "tx_info") {
			var itemFlags = columnFlags(item, accountQueryResult);
			//don't include primary index field
			if (itemFlags != 16899) {
				var itemType = columnType(item, accountQueryResult);
				var itemValue = accountQueryResult.rows[0][item];
				insertFields += "`"+item+"`,"
				if (itemType == 7) {
					//timestamp field type
					itemValue = new String(itemValue);
					if (itemValue.toUpperCase().indexOf("NOW") > -1) {
						//include "NOW" timestamp as-is
						insertValues += itemValue+",";
					} else {
						//include JavaScript Date object as MySQL timestamp
						var dateObj = new Date(itemValue);
						insertValues += JSON.stringify(getMySQLTimeStamp(dateObj))+",";	
					}
				} else if (itemType == 1) {
					//boolean field type
					var itemValueTemp = itemValue;
					if (typeof(itemValue) == "string") {
						itemValueTemp = itemValueTemp.toUpperCase();
						itemValueTemp = itemValueTemp.split(" ").join("");
					}
					switch (itemValueTemp) {
						case "TRUE": insertValues += "TRUE,"; break;
						case "FALSE": insertValues += "FALSE,"; break;
						case "1": insertValues += "TRUE,"; break;
						case "0": insertValues += "FALSE,"; break;
						case "YES": insertValues += "TRUE,"; break;
						case "NO": insertValues += "FALSE,"; break;
						case "ON": insertValues += "TRUE,"; break;
						case "OFF": insertValues += "FALSE,"; break;
						default: 
							var boolValue = new Boolean(itemValueTemp);
							if (boolValue) {
								insertValues += "TRUE,";
							} else {
								insertValues += "FALSE,";
							}
							break;
					}
				} else {
					//all other field types
					if (typeof(itemValue) == "number") {
						insertValues += String(itemValue)+",";
					} else if ((itemValue == null) || (itemValue == "null") || (itemValue == "NULL")) {
						insertValues += "NULL,";
					} else {
						//all other values are stringified...
						insertValues += JSON.stringify(itemValue)+",";
					}
				}
			}
		}
	}
	var SQL = "SELECT * FROM `gaming`.`investment_txs` WHERE `account`=\""+accountQueryResult.rows[0].btc_account+"\" ORDER BY `index` DESC LIMIT 1";
	var investmentsQueryResult = yield db.query(SQL, localGen);
	if (investmentsQueryResult.error == null) {
		if (typeof(txInfo["info"]) != "object") {
			txInfo.info = new Object();
		}
		if (investmentsQueryResult.rows.length > 0) {
			txInfo.info.investments = JSON.parse(investmentsQueryResult.rows[0].investments);
		}		
	}	
	//chop off trailing commas
//	insertFields = insertFields.substring(0, insertFields.length-1);
//	insertValues = insertValues.substring(0, insertValues.length-1);
	insertFields += "`tx_info`";
	insertValues += "'"+JSON.stringify(txInfo)+"'";
	insertFields += ")";
	insertValues += ")";
	//create SQL statement
	SQL = "INSERT INTO `gaming`.`accounts` "+insertFields+" VALUES "+insertValues;
	//execute statement
	db.query (SQL, generator);
}

global.updateAccount = function(accountQueryResult, updateObj, txInfo, generator) {
	var gen = updateAccountGen(accountQueryResult, updateObj, txInfo, generator);
	gen.next();
	gen.next(gen);
}

function columnType(columnName, queryResult) {
	for (var count=0; count<queryResult.columns.length; count++) {
		var currentColumn = queryResult.columns[count];
		if (currentColumn.name == columnName) {
			return (currentColumn.type);
		}
	}
	return (-1);
}

function columnFlags(columnName, queryResult) {
	for (var count=0; count<queryResult.columns.length; count++) {
		var currentColumn = queryResult.columns[count];
		if (currentColumn.name == columnName) {
			return (currentColumn.flags);
		}
	}
	return (-1);
}

function getMySQLTimeStamp(dateObj) {
	if ((dateObj == undefined) || (dateObj == null) || (dateObj == "")) {
		var now = new Date();
	} else {
		now = dateObj;
	}
	var returnStr = new String();
	returnStr += String(now.getFullYear())+"-";
	returnStr += String(now.getMonth()+1)+"-";
	returnStr += String(now.getDate())+" ";	
	if (now.getHours() < 10) {
		returnStr += "0";
	}
	returnStr += String(now.getHours())+":";
	if (now.getMinutes() < 10) {
		returnStr += "0";
	}
	returnStr += String(now.getMinutes())+":";
	if (now.getSeconds() < 10) {
		returnStr += "0";
	}
	returnStr += String(now.getSeconds());
	return (returnStr);
}

/**
* Calculates the total win based on a given multiplier.
*
* @param bet The bet object containing the original bet amount(s).
* @param betFields The numeric string fields within the 'bet' object to calculate with and transpose to the output object.
* @param multiplier The BigNumber multiplier to calculate the winning amount(s) with.
* @param jackpot A database result row object containing information on an additional jackpot value to add to the win amount(s).
*
* @return An object conntaining the calculated win amount (totalWin), including any jackpot (jackpotWin).
*/
function calculateWin(bet, betFields, multiplier, jackpot) {
	var returnInfo = new Object();
	returnInfo.multiplier = multiplier;
	returnInfo.jackpotWin = false;
	for (var count=0; count < betFields.length; count++) {
		var currentFieldName  = betFields[count];
		var currentBetAmount = bet[currentFieldName];
		var betAmount = new BigNumber(currentBetAmount);
		var totalWin = betAmount.times(multiplier);
		if ((jackpot != null) && (jackpot != undefined)) {
			var minimumBet = new BigNumber(jackpot.minimum_bet);
			var jackpotBTC = new BigNumber(jackpot.btc_total);
			var jackpotTokens = jackpotBTC.times(serverConfig.tokensPerBTC);
			switch (currentFieldName) {
				//only token bets are currently supported
				case "tokens": 
					//only add jackpot tokens if bet meets minimum requirement, set in database
					if (betAmount.greaterThanOrEqualTo(minimumBet)) {
						//totalWin = totalWin.add(jackpotTokens);
						totalWin = jackpotTokens;
						returnInfo.jackpotWin = true;
					}
					break;
				default: break;
			}
		}
		returnInfo[currentFieldName] = totalWin.toString(10);
	}
	return (returnInfo);
}

/**
* Generates winning reel information object from a given game configuration and final (decrypted) stop positions.
*
* @param gameConfig The game configuration object to use to determine the win.
* @param stopPositions The plaintext or decrypted stop positions to check for a win.
* @param jackpotQueryResult The jackpot definition associated with this game, if any. If null, no jackpot is assumed.
*
* @return An object containing the winning information based on the game configuration and supplied stop positions. The object
* contains a 'symbols' array containing the winning symbols and whether or not those symbols counted toward the win. A 'jackpot'
* property includes the information of an associated jackpot, if available, or null otherwise.
*/
function generateWinInfo(gameConfig, stopPositions, jackpotQueryResult) {
	var returnInfo = new Object();	
	returnInfo.jackpot = null;
	if ((gameConfig == null) || (gameConfig == undefined)) {
		returnInfo.error = "Game configuration does not exist.";
		return (returnInfo);
	}	
	//create symbols array from stop positions	
	returnInfo.symbols = new Array();
	returnInfo.stopPositions = new Array();
	for (var count=0; count < stopPositions.length; count++) {
		var stopPos = parseInt(stopPositions[count]);
		returnInfo.stopPositions.push (stopPos);
		var symbolObject = new Object();
		symbolObject.index = gameConfig.reels[count][stopPos];		
		symbolObject.name = gameConfig.symbols[symbolObject.index].name;
		symbolObject.win = false;
		returnInfo.symbols.push(symbolObject);		
	}		
	returnInfo.multiplier = 0;
	//find highest matching multiplier
	for (count = 0; count < gameConfig.wins.length; count++) {
		var winDefinition = gameConfig.wins[count];
		var winSymbols = winDefinition.symbols;
		var matchesFound = 0;
		for (var count2 = 0; count2 < winSymbols.length; count2++) {
			var winningSymbolIndex = winSymbols[count2];
			if (winningSymbolIndex > -1) {
				if (winningSymbolIndex == returnInfo.symbols[count2].index) {
					returnInfo.symbols[count2].win = true;
					matchesFound++;
				} 
			} else {				
				matchesFound++;
			}
		}
		if (matchesFound == winSymbols.length) {
			returnInfo.multiplier = new BigNumber(winDefinition.multiplier);
			if ((winDefinition["jackpot"] != undefined) && (winDefinition["jackpot"] != null) && (winDefinition["jackpot"] != "")) {
				if ((jackpotQueryResult != undefined) && (jackpotQueryResult != null)) {
					returnInfo.jackpot = jackpotQueryResult.rows[0];
				}
			}
			break;
		} else {
			for (count2 = 0; count2 < returnInfo.symbols.length; count2++) {
				returnInfo.symbols[count2].win = false;
			}
		}
	}
	return (returnInfo);
}

/**
* Encrypts an input using a key and initialization vector.
*
* @param input String input to encrypt; must be less than or equal to 16 bytes long. Values shorter than 16 bytes are pre-padded with "0"s.
* @param key The encryption key to use to encrypt input. May be a Buffer or array.
* @param iv The initialization vector to use to encrypt input. May be a Buffer or array.
*
* @return The encrypted data as a hexadecimal string.
*/
function encrypt(input, key, iv) {
	if ((input == null) || (input == undefined) || (key == null) || (key == undefined) || (iv == null) || (iv == undefined)) {
		return (null)
	}
	input = String(input);
	if (input.length > 16) {
		return (null);
	}
	//create exactly 16-byte input
	var padLength= 16 - input.length;
	for (count = 0; count<padLength; count++) {
		input = "0" + input;
	}
	var textBytes = aesjs.utils.utf8.toBytes(input);
	var aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
	var encryptedBytes = aesCbc.encrypt(textBytes);
	var encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes);
	return (encryptedHex);
}

/**
* Decrypts an input using a key and initialization vector.
*
* @param input Hexadecimal string input to decrypt.
* @param key The encryption key to use to decrypt input. May be a Buffer or array.
* @param iv The initialization vector to use to decrypt input. May be a Buffer or array.
*
* @return The decrypted data as a plaintext string.
*/
function decrypt(input, key, iv) {
	var encryptedBytes = aesjs.utils.hex.toBytes(input); 
	var aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
	var decryptedBytes = aesCbc.decrypt(encryptedBytes);
	var decryptedText = aesjs.utils.utf8.fromBytes(decryptedBytes);
	return (decryptedText);	
}

/**
* Shuffles an array and returns the shuffled array.
*
* @param input The input array to shuffle. May have up to 65535 elements.
* 
* @return An array with randomnly shuffled elements of input
*/
function shuffle(input) {
	var output=new Array();
	var indexes=crypto.randomBytes(input.length*4); //4 bytes per position since we support up to 0xFFFF reel stops
	var offset=0;
	while (input.length>0) {
		var swapIndex=indexes.readUInt16LE(offset) % input.length;
		output.push(input.splice(swapIndex,1)[0]);
		offset+=2;
	}
	return (output);		
}

var busyAccounts = [];

/**
* Checks a Bitcoin account balance via an external API request.
*
* @param generator The generator function to return the API result to.
* @param account The Bitcoin account to check a balance for.
*/
function checkAccountBalance(generator, account) {
	for (var count=0; count < busyAccounts.length; count++) {
		if (busyAccounts[count] == account) {
			generator.next(null);
		}
	}
	busyAccounts.push(account);
	request({
		url: "https://api.blockcypher.com/v1/"+serverConfig.APIInfo.blockcypher.network+"/addrs/"+account+"/full",
		method: "GET",
		json: true		
	}, function (error, response, body) {		
		for (var count=0; count < busyAccounts.length; count++) {
			if (busyAccounts[count] == account) {
				busyAccounts.splice(count, 1);
				break;
			}
		}
		generator.next(body);				
	});	
}

/**
* Utility function to manually set the balance(s) of a specific account.
*
* @param account The account to update (must already exist in the database);
* @param verifiedBalance The verified balance amount, in Bitcoin, to set.
* @param availableBalance The available play balance amount, in Bitcoin, to set.
*/
function *setBalance(account, verifiedBalance, availableBalance) {
	var generator = yield;
	var dbUpdates = "`btc_balance_verified`=\""+verifiedBalance+"\",`btc_balance_available`=\""+availableBalance+"\"";
	var txInfo = new Object();
	txInfo.type = "balance_update";	
	var accountUpdateResult = yield global.updateAccount(queryResult, dbUpdates, txInfo, generator);
	if (accountUpdateResult.error != null) {
		trace ("Database error on setBalance: "+accountUpdateResult.error);
	}
}

/**
* Invokes an external service in order to generate a new Bitcoin account address.
* 
* @param generator The generator function invoking this method and expecting the resulting data.
*/
function getNewAccountAddress(generator) {			
	request({			  
		url: "https://api.blockcypher.com/v1/"+serverConfig.APIInfo.blockcypher.network+"/addrs",
		method: "POST",
		json: true    
	}, function (error, response, body){   
		/*
		body.address: newly-generated address
		body.private: private key
		body.public: public key
		body.wif: Wallet Import Format account data (https://en.bitcoin.it/wiki/Wallet_import_format)
		*/		
		generator.next(body);
	});
	//ShapeShift.io...
	//de0B295669a9FD93d5F28D9Ec85E40f4cb697BAe is the Ethereum address to send deposits to:
	/*
	request({
		url: "https://shapeshift.io/shift",
		method: "POST",
		{"withdrawal":"de0B295669a9FD93d5F28D9Ec85E40f4cb697BAe", "pair":"btc_eth"},
		json: true    
	}, function (error, response, body){   		
		generator.next(body);
	});	
	*/
} 

/**
*  Update affiliate-attributed bet amount(s).
* 
* @param generator The generator function invoking this method and expecting the resulting data.
* @param affiliateInfo An affiliate info object from the gaming.affiliates table structured as a row result from a db.query call.
* @param attributionUpdates An name-value object containing all of the attributed earning(s) to apply to the database.
* @param operation An operation to apply to the updated row values. Valid operations include "+", "-", "plus", "minus".
*
* @return An information object containing the result of the database update.
*/
function updateAffiliateAttribution(generator, affiliateInfo, attributionUpdates, operation) {
	if ((affiliateInfo == null) || (attributionUpdates == null) || (affiliateInfo == undefined) || (attributionUpdates == undefined)) {
		generator.next();
		return;
	}	
	var dbUpdates = new String();	
	for (var attributionField in attributionUpdates) {
		var existingValue = new BigNumber(affiliateInfo[attributionField]);
		var newValue = new BigNumber(attributionUpdates[attributionField]);
		switch (operation) {
			case "+" :
				newValue = existingValue.plus(newValue);
				break;
			case "plus" :
				newValue = existingValue.plus(newValue);
				break;
			case "-" :
				newValue = existingValue.minus(newValue);
				break;
			case "minus" :
				newValue = existingValue.minus(newValue);
				break;
			default: 
				newValue = existingValue;
				break;
		}
		dbUpdates += "`"+attributionField+"`=\""+newValue.toString(10)+"\",";
	}
	dbUpdates += "`last_play`=NOW()";
	db.query("UPDATE `gaming`.`affiliates` SET "+dbUpdates+" WHERE `affiliate_id`=\""+affiliateInfo.affiliate_id+"\" AND `index`="+affiliateInfo.index+" LIMIT 1", generator);
}

/**
*  Retrieves affiliate information for a specific affiliate.
* 
* @param generator The generator function invoking this method and expecting the resulting data.
* @param affiliatteID The ID of the affiliate to retrieve.
*
* @return An information object containing the result of a db.query call. Typically, if the result object's 'rows' property has a length of 0,
* no results were found.
*/
function getAffiliateInfo(generator, affiliatteID) {
	db.query("SELECT * FROM `gaming`.`affiliates` WHERE `affiliate_id`=\""+affiliatteID+"\" LIMIT 1", generator);
}

/**
*  Retrieves an affiliate ID for an account address.
* 
* @param generator The generator function invoking this method and expecting the resulting data.
* @param account The account for which to retrieve the affiliate information, if any.
* @param accountType The account type represented by the contents of the 'account' paramater. This should match a 
* 	field name in the gaming.accounts database. Default is "btc_account".
*
* @return An information object containing the result of a db.query call. Typically, if the result object's 'rows' property has a length of 0,
* no results were found.
*/
function getAffiliateForAccount(generator, account, accountType) {
	if ((accountType == null) || (accountType == "undefined") || (accountType == "")) {
		accountType ="btc_account";
	}
	if ((account == null) || (account == undefined) || (account == "null") || (account == "undefined") || (account == "")) {
		return;
	} else {
		db.query("SELECT `affiliate` FROM `gaming`.`accounts` WHERE `"+accountType+"`=\""+account+"\" LIMIT 1", generator);
	}
}

/**
* Receives a list of all inputs for an account.
*
* @param generator The generator function to invoke when thhe asynchronous operations has completed.
* @param btc_account The Bitcoin account address for which to retrieve inputs.
*/
function getIncomingTransactionsForAccount(generator, btc_account) {
	request({
		url: "https://api.blockcypher.com/v1/"+serverConfig.APIInfo.blockcypher.network+"/addrs/"+btc_account+"/full?limit=50&txlimit=10000",
		method: "GET",
		json: true    
	}, function (error, response, body){
		var transactions = null;
		if (error == null) {
			for (var count = 0; count < body.txs.length; count++) {
				var currentTransaction = body.txs[count];
				var inputAddresses = new Array();
				//parse the data out of the API response
				for (var count2 = 0; count2 < currentTransaction.inputs.length; count2++) {
					var currentInput = currentTransaction.inputs[count2];
					for (var count3 = 0; count3 < currentInput.addresses.length; count3++) {
						inputAddresses.push(currentInput.addresses[count3]);
					}
				}
				var txOuts = currentTransaction.outputs;
				for (count2 = 0; count2 < txOuts.length; count2++){
					var currentTxOut = txOuts[count2];
					var txOutAddresses = currentTxOut.addresses;
					for (count3 = 0; count3 < txOutAddresses.length; count3++) {
						var currentTxOutAddress = txOutAddresses[count3];
						if (currentTxOutAddress == btc_account) {
							if (transactions == null) {
								transactions = new Array();
							}
							var accountTransactionObj = new Object();
							accountTransactionObj.addresses = txOutAddresses;
							accountTransactionObj.senderAddresses = inputAddresses;
							accountTransactionObj.receivedAddress = btc_account;
							accountTransactionObj.txhash = currentTransaction.hash;
							accountTransactionObj.txIndex = count3;
							accountTransactionObj.total_tx_satoshis = String(currentTxOut.value);
							transactions.push(accountTransactionObj);
						}
					}
				}
			}
		} else {
			trace ("getIncomingTransactionsForAccount(\""+btc_account+"\") service responded with: "+error);
		}
		if (generator != null) {
			generator.next(transactions);
		}
	});
}

/**
* Derives an address from a root HD wallet address. (requires bitcoinjs-lib)
*
* @param rootAddressXPRV The base58 "xprv" HD wallet data.
* @param index The index of the derived address using the default path "m/0'/i" where 'i' is the index value. If 'derivePath'
*	is included this parameter is ignored.
* @param derivePath A custom address derivation path. If provided, 'index' is ignored.
*
* @return An object containing the derived address, keys, and other information.
*/
function deriveAddress(rootAddressXPRV, index, derivePath) {
	if ((derivePath != null) && (derivePath != undefined)) {
		var path = derivePath;
	} else {
		path = "m/0'/"+String(index); //http://bip32.org/ - external account master
	}
	var root = bitcoin.HDNode.fromBase58(rootAddressXPRV);
	var child = root.derivePath(path);
	/*
	//Using bip32-utils:
	var i = child.deriveHardened(0);
	var external = i.derive(0);
	var internal = i.derive(1);
	var account = new bip32.Account([
		new bip32.Chain(external.neutered()),
		new bip32.Chain(internal.neutered())
	])
	trace ("root="+root.getAddress());	
	trace ("account.getChainAddress(0)="+account.getChainAddress(0));
	child.xprv = rootAddressXPRV;
	child.xpub = account.derive(account.getChainAddress(0)).toBase58();
	*/
	/*
	//Using BlockCypher's API:
	//Adds the account created above to BlockCypher as a HD wallet
	request({
		url: "https://api.blockcypher.com/v1/btc/main/wallets/hd?token=fb7cf8296b9143a889913b1ce43688aa",
		method: "POST",
		body: {"name": "dev1", "extended_public_key": "xpub6CKPU4Z2znVZz7vVoadaBird7Pt3mAVVFPtUmkkXqDwrMAbVWRkSD16uLuArpjp3VypKg8reWXm3ygsh7PDGJgKwEdntfX8cmWZz7Fn564x"},
		json: true    
	}, function (error, response, body){
		console.log(error);
		console.log(JSON.stringify(body));
	});
	//get new derived address:
	request({
			url: "https://api.blockcypher.com/v1/btc/main/wallets/hd/dev1/addresses/derive?token=fb7cf8296b9143a889913b1ce43688aa",
			method: "POST",
			json: true    
		}, function (error, response, body){
			console.log(error);
			console.log(JSON.stringify(body));
		});
		
		//{"chains":[{"chain_addresses":[{"address":"19vgSNKNAKFmHzxv4d4K8bm6bhrVc7dhnj","public":"03892a1b527a3786e62dddea187f7c5b2f5eb8a35038beaf838bb02536f5d6dd72","path":"m/0"}]}]}
	*/
	return (child);
}

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

//*************************** RPC HANDLERS *************************************

/**
* Main RPC entry point where individual functions are triggered or an error is returned.
*
* @param postData The POST data included with the request.
* @param requestObj The request object (https://nodejs.org/api/http.html#http_class_http_incomingmessage).
* @param requestObj The response object (https://nodejs.org/api/http.html#http_class_http_serverresponse).
*/
function processRequest(postData, requestObj, responseObj) {
	try {
		var requestData=JSON.parse(postData);
	} catch (err) {
		replyError(postData, requestObj, responseObj, null, serverConfig.JSONRPC_PARSE_ERROR, "JSON-RPC data could not be parsed.");
		return;
	}	
	if ((requestData["length"] != null) && (requestData["length"] != undefined)) {
		if (isNaN(requestData.length)) {
			invokeRPCFunction(postData, requestObj, responseObj, null);
		} else {
			if (requestData.length > serverConfig.rpc_options.max_batch_requests) {
				replyError(postData, requestObj, responseObj, null, serverConfig.JSONRPC_INTERNAL_ERROR, "No more than "+serverConfig.rpc_options.max_batch_requests+" batched methods allowed. Request had "+String(requestData.length)+" methods.");
				return;
			}
			var batchResponses = new Object();
			batchResponses.responses = new Array();
			batchResponses.total = requestData.length;
			for (var count = 0; count < requestData.length; count++) {
				invokeRPCFunction(JSON.stringify(requestData[count]), requestObj, responseObj, batchResponses);
			}
		}
	} else {
		invokeRPCFunction(postData, requestObj, responseObj, null);
	}	
}

/**
* Invokes an individual RPC function.
*
* @param postData The POST data included with the request.
* @param requestObj The request object (https://nodejs.org/api/http.html#http_class_http_incomingmessage).
* @param requestObj The response object (https://nodejs.org/api/http.html#http_class_http_serverresponse).
* @param batchResponses An object containing expected responses for a batch. If null, this function is not being called as part of a batch. Usually the contents of this
* 			object are handled by the HTTP request processor and responder and so should not be updated.
*/
function invokeRPCFunction(postData, requestObj, responseObj, batchResponses) {
	var requestData=JSON.parse(postData);
	if (requestData.jsonrpc != "2.0") {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_REQUEST_ERROR, "Not a valid JSON-RPC 2.0 request. Request object must contain \"jsonrpc\":\"2.0\".");
		return;
	}
	if (requestData["method"] == undefined) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_REQUEST_ERROR, "Not a valid JSON-RPC 2.0 request. Request object must include a \"method\" endpoint.");	
		return;
	}
	if (requestData["method"] == null) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_REQUEST_ERROR, "Not a valid JSON-RPC 2.0 request. The \"method\" endpoint must not be Null.");	
		return;
	}
	//TODO: Make general exclusion list for functions we don't want to trace out here
	if ((String(requestData.method) != "getLeaderboard") && (String(requestData.method) != "getJackpot") && (String(requestData.method) != "getInvestmentStats")) {
		try {
			trace ("invokeRPCFunction(\""+requestData.method+"\") -> "+requestObj.socket.remoteAddress+":"+requestObj.socket.remotePort);
		} catch (err) {
			//will this ever happen? should we throw an exception?
			trace ("invokeRPCFunction(\""+requestData.method+"\") request from unknown host.");		
		}
	}
	requestData.method = new String(requestData.method);
	if (requestData.method.split(" ").join("").indexOf("rpc:") == 0) {
		trace ("   ...rejected \"rpc:\" system extension call is unsupported.");
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_REQUEST_ERROR, "System extensions (\"rpc:\" methods) are not currently supported.");	
		return;
	}
	try {
		var gen;		
		switch (String(requestData.method)) {
			case "newGamingAccount": 
				gen = RPC_newGamingAccount(postData, requestObj, responseObj, batchResponses);
				gen.next();
				gen.next(gen);
				break;
			case "checkAccountDeposit":
				gen = RPC_checkAccountDeposit(postData, requestObj, responseObj, batchResponses);
				gen.next();
				gen.next(gen);
				break;
			case "getAccountBalance": 
				gen = RPC_getAccountBalance(postData, requestObj, responseObj, batchResponses);			
				gen.next();
				gen.next(gen);
				break;
			case "getAccountTransactions":
				gen = RPC_getAccountTransactions(postData, requestObj, responseObj, batchResponses);			
				gen.next();
				gen.next(gen);
				break;	
			case "getJackpot":
				gen = RPC_getJackpot(postData, requestObj, responseObj, batchResponses);
				gen.next();
				gen.next(gen);
				break;
			case "getGameResults": 
				gen = RPC_getGameResults(postData, requestObj, responseObj, batchResponses);			
				gen.next();
				gen.next(gen);
				break;
			case "getGameStatus":
				gen = RPC_getGameStatus(postData, requestObj, responseObj, batchResponses);			
				gen.next();
				gen.next(gen);
				break;
			case "selectResults":
				gen = RPC_selectResults(postData, requestObj, responseObj, batchResponses);			
				gen.next();
				gen.next(gen);
				break;			
			case "cashOut":
				gen = RPC_cashOut(postData, requestObj, responseObj, batchResponses);
				gen.next();
				gen.next(gen);
				break;
			case "getLeaderboard":
				gen = RPC_getLeaderboard(postData, requestObj, responseObj, batchResponses);			
				gen.next();
				gen.next(gen);
				break;
			default:
				if (plugins.rpcMethodExists(String(requestData.method))) {
					plugins.rpc_invoke(String(requestData.method), postData, requestObj, responseObj, batchResponses, replyResult, replyError);
				} else {
					replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_METHOD_NOT_FOUND_ERROR, "Method \""+requestData.method+"\" not implemented.");			
				}
				break;				
		}
	} catch (err) {	
		trace (err);
		var messageSplit = String(err.message).split(":::");
		if (messageSplit.length == 1) {
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_INTERNAL_ERROR, "There was a fatal error while processing the request.", err.message);
		} else {
			replyError(postData, requestObj, responseObj, batchResponses, parseInt(messageSplit[0]), messageSplit[1]);
		}
	}
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

/**
* Checks for the existence of a parameter within supplied request data. If the parameter does not appear (undefined), an error
* if thrown in the format serverConfig.JSONRPC_INVALID_PARAMS_ERROR+":::Descriptive error message"
*
* @param requestData The data to check for the existence of the parameter (only the top level of the request object is examined)
* @param param The parameter to check for.
*/
function checkParameter(requestData, param) {
	if ((requestData["params"] == null) || (requestData["params"] == undefined)) {
		var err = new Error(serverConfig.JSONRPC_INVALID_PARAMS_ERROR+":::Required \"params\" not found in request.");
		throw (err);
	}
	if (requestData.params[param] == undefined) {
		err = new Error(serverConfig.JSONRPC_INVALID_PARAMS_ERROR+":::Required parameter \""+param+"\" not found in request.");
		throw (new Error(err));
	}
}

//*************************** STARTUP / GLOBAL FUNCTIONS *************************************

/**
* Stand-in logging function that adds additional debugging information to the console.
*/
function trace(msg) {
	try {
		var traceMsg = msg;
		traceMsg = serverConfig._log_prefix;
		if (serverConfig._log_include_timestamp) {
			traceMsg += "["+createTimeDateStamp()+"] ";
		}
		traceMsg += msg;
		console.log(traceMsg);
		global.logDebug(msg);
	} catch (err) {
	}
}

function createTimeDateStamp() {
	var dateObj = new Date(); //now
	var dateStamp = String(dateObj.getFullYear())+"-";
	var dateStamp = String(dateObj.getFullYear())+"-";
	if ((dateObj.getMonth()+1) < 10) {
		dateStamp += "0";
	}
	dateStamp += String(dateObj.getMonth()+1)+"-";
	if (dateObj.getDate() < 10) {
		dateStamp += "0";
	}
	dateStamp += String(dateObj.getDate())+" ";
	if (dateObj.getHours() < 10) {
		dateStamp += "0";
	}
	dateStamp += String(dateObj.getHours())+":";
	if (dateObj.getMinutes() < 10) {
		dateStamp += "0";
	}
	dateStamp += String(dateObj.getMinutes())+":";
	if (dateObj.getSeconds() < 10) {
		dateStamp += "0";
	}
	dateStamp += String(dateObj.getSeconds())+".";
	dateStamp += String(dateObj.getMilliseconds());		
	return (dateStamp);
}


/**
* Starts the logging system by checking and, if necessary, updating the debug and transaction log
* file paths, backing up any existing logs, and creating output streams for new logs.
*/
function startLogs() {
	var txLogFileDir = path.dirname(serverConfig.txLogFile);
	var debugLogFileDir = path.dirname(serverConfig.debugLogFile);
	//if target path doesn't exist, use current one
	if (!fs.existsSync(txLogFileDir)) {
		txLogFileDir = ".";
	}
	if (!fs.existsSync(debugLogFileDir)) {
		debugLogFileDir = ".";
	}
	var txLogFilePath = txLogFileDir + "/" + path.basename(serverConfig.txLogFile);
	var debugLogFilePath = debugLogFileDir + "/" + path.basename(serverConfig.debugLogFile);
	backupFile (txLogFilePath);
	backupFile (debugLogFilePath);
	const fileDefaults = {
	  flags: 'w',
	  encoding: 'utf8',
	  fd: null,
	  mode: 0o666,
	  autoClose: true
	};
	txLogStream = fs.createWriteStream(txLogFilePath, fileDefaults);
	debugLogStream = fs.createWriteStream(debugLogFilePath, fileDefaults);
	var dateObj = new Date();
	global.logDebug("Log started");
	global.logTx("Log started");
}

/**
* Backs up any existing file(s) so that a new one can be created.
*
* @param rootFilePath The root file path, including name and extension, of the file to create backups for. A new file with this name
* 			can then be safely created.
*/
function backupFile(rootFilePath) {
	trace ("Backing up existing file: "+rootFilePath);
	if (!fs.existsSync(rootFilePath)) {
		trace ("   No existing file exists to back up.");
		return;
	}
	var dateObj = new Date();
	var backupExt = String(dateObj.getFullYear())+"_"+String(dateObj.getMonth()+1)+"_"+String(dateObj.getDate());
	var backupFileName = rootFilePath+"."+backupExt;
	var versionExtension = 1;
	while (fs.existsSync(backupFileName+"."+String(versionExtension))) {
		versionExtension++;
	}
	fs.renameSync(rootFilePath, backupFileName+"."+String(versionExtension));
}

/**
* Logs a message to the default debug output log.
*
* @param message The message to log to the output file.
*/
global.logDebug = function (message) {
	if (debugLogStream != null) {
		if (serverConfig.debugLogFileFormat == "text") {
			debugLogStream.write("["+createTimeDateStamp()+"] "+message+"\r\n");
		}
	}
}

/**
* Logs a message to the default debug output log.
*
* @param message The message to log to the output file.
*/
global.logTx = function (transaction) {
	if (txLogStream != null) {
		if (serverConfig.txLogFileFormat == "text") {
			txLogStream.write("["+createTimeDateStamp()+"] "+transaction+"\r\n");
		}
	}
}

/**
* Reads and parses JSON game configuration data files.
*
* @param An indexed array of JSON file paths to load and parse.
*
* @return An object containing name-value pairs of parsed configuration objects. Each name is equal to the 'ID' property found within
* each JSON object. Null is returned if an 'ID' property can't be found, is empty, or if there was an error parsing the JSON data.
*/ 
function readGameConfigs(configPaths) {
	var configs = new Object();
	for (var count=0; count < configPaths.length; count++) {
		try {
			var newConfig = JSON.parse(filesystem.readFileSync(configPaths[count], 'utf8'));
			var ID = newConfig["ID"];
			if ((ID == null) || (ID == undefined) || (ID == "")) {
				trace ("Error reading game ID (\"ID\") from game config:"+ configPaths[count]);
				return (null);
			}
			ID = String(ID);
			configs[ID] = newConfig;
			trace ("   Loaded game configuration ("+ID+"):");
			trace (" ");
			trace (JSON.stringify(newConfig));
			trace (" ");
		} catch (err) {
			return (null);
		}
	}
	return (configs);
}

/**
* Main function invoked when the dabase connector (db), successfully connects.
*
* @param connection The main connection object provided by the database connector.
*
*/
function onConnect(connection) {
	if ((connection.threadId != undefined) && (connection.threadId != null)) {
		trace("Database connection established on thread: "+connection.threadId);
	} else {
		trace("Using stateless / atomic database connectivity. No thread ID assigned.");
	}
	startRPCServer();
}

/**
* Main function invoked when the dabase connector (db), fails to connect.
*
* @param connection The main connection object provided by the database connector that could not establish a connection.
*
*/
function onConnectFail(connection) {
	trace ("Database connection failed! Is MySQL daemon running?");
}

function *backupDatabase() {
	var generator = yield;
	trace("Starting database backup...");
	var tablesResult = yield db.getTables("gaming", generator);
	if ((tablesResult == null) || (tablesResult == undefined)) {
		trace ("Database query returned null or undefined result. Can't continue.");
		return;
	}
	if ((tablesResult.length < 1) || (tablesResult.length == undefined) || (tablesResult.length == null)) {
		trace ("No tables found for 'gaming' database. Nothing to back up.");
		return;
	}
	try {
		fs.mkdirSync(serverConfig.databaseBackupPath, 0o777);
		trace ("Created backup files archive folder: "+serverConfig.databaseBackupPath);
	} catch (err) {
	}
	var backupObj = new Object();
	backupObj.databases = new Object();
	backupObj.databases.gaming = new Object();
	backupObj.databases.gaming.table_names = tablesResult;
	backupObj.databases.gaming.tables = new Object();
	for (var count=0; count < tablesResult.length; count++) {
		var tableName = tablesResult[count];
		trace ("   Exporting \""+tableName+"\" table...");
		var queryResult = yield db.query ("SELECT * FROM `gaming`.`"+tableName+"`", generator);
		backupObj.databases.gaming.tables[tableName] = queryResult;		
	}
	var backupFilePath = serverConfig.databaseBackupPath.trim();	
	if (backupFilePath.substr(backupFilePath.length-1, 1) != "/") {
		//add trailing slash
		backupFilePath += "/";
	}
	var dateObj = new Date();
	var backupExt = String(dateObj.getFullYear())+"_"+String(dateObj.getMonth()+1)+"_"+String(dateObj.getDate());
	var backupFileName = backupFilePath+"gaming."+backupExt;
	var versionExtension = 1;
	while (fs.existsSync(backupFileName+"."+String(versionExtension)+".json")) {
		versionExtension++;
	}
	var fullBackupPath = backupFileName+"."+String(versionExtension)+".json";
	trace ("   Saving to: "+fullBackupPath);
	var options = {flag: 'w', encoding: 'utf8', mode: 0o666};
	fs.writeFileSync(fullBackupPath, JSON.stringify(backupObj), options);
}
global.backupDatabase = backupDatabase;

/**
* Asserts any primitive value (string, number, boolean) to another value recursively within any complex object type. This function is NOT safe to use with circular references!
*
* @param valueToReplace The primitive value to recursively find and replace. 
* @param replaceValue The value to replace 'valueToReplace' by wherever found.
* @param dataObject The object within which to recursively search for 'valueToReplace' and replace with 'replaceValue'.
*/
global.assertAnyValue = function (valueToReplace, replaceValue, dataObject) {
	try {
		if ((dataObject == null) || (dataObject == undefined)) {
			return;
		}
		if (typeof(dataObject["length"]) == "number") {
			//array type
			for (var item=0; item < dataObject.length; item++) {
				if (typeof(dataObject[item]) == "object") {
					//object reference found, search recursively
					assertAnyValue(valueToReplace, replaceValue, dataObject[item]);
				} else if (dataObject[item] == valueToReplace) {
					//match found, replace value
					dataObject[item] = replaceValue;
				} else {
					//no match, ignore value
				}
			}
		} else {
			//base object type
			for (var item in dataObject) {
				if (typeof(dataObject[item]) == "object") {
					assertAnyValue(valueToReplace, replaceValue, dataObject[item]);
				} else if (dataObject[item] == valueToReplace) {
					dataObject[item] = replaceValue;
				} else {
				}
			}
		}
	} catch (err) {
	}
}

/**
* Attempts to start the main JSON-RPC server daemon script.
*/
function startRPCServer() {	
	trace ("Starting plugins manager...");
	plugins.start(trace, this);	
	var gen = loadLeaderboardData();
	gen.next();
	gen.next(gen);
	trace ("Starting up JSON-RPC server...");
	rpc_server = http.createServer(handleHTTPRequest);
	try {
		rpc_server.listen(serverConfig.rpc_options.port, onRPCServerStart);		
		//var now = new Date();
		//var time = now.getHours()+":"+now.getMinutes();
		var time = "00:10";
		//trace ("   Registered database backup job @ "+time);
		//plugins.registerTimerFunction({"time":time,"func":"backupDatabase","plugin":global});
	} catch (err) {
		trace ("The requested port ("+serverConfig.rpc_options.port+") is already in use.");
	}
	try {
		var now = new Date();
		time = now.getHours()+":"+now.getMinutes();
		var message = "The game server was started at: "+time;
		for (var count=0; count < serverConfig.adminEmails.length; count++) {
			accountPlugin.sendEmail("myfruitgame@gmail.com", serverConfig.adminEmails[count], "Game Server Startup", message);
		}
	} catch (err) {
	}
}


/**
* Function invoked when the RPC server has been started or an error occured.
*
* @param error An error object specifiying the startup error, of null if successfully started.
*/
function onRPCServerStart() {
	trace ("JSON-RPC server is listening on port "+serverConfig.rpc_options.port+".");
}

/**
* Handles an HTTP request, usually assigned through `http.createServer(handleHTTPRequest)`
*
* @param requestObj HTTP request object (https://nodejs.org/api/http.html#http_class_http_incomingmessage).
* @param responseObj HTTP response object (https://nodejs.org/api/http.html#http_class_http_serverresponse).
*/
function handleHTTPRequest(requestObj, responseObj){	
	//only headers received at this point so read following POST data in chunks...
	if (requestObj.method == 'POST') {  
		var postData=new String();
		requestObj.on('data', function(chunk) {
			//reading message body...
			if ((chunk!=undefined) && (chunk!=null)) {
				postData+=chunk;
			}
		});		
		requestObj.on('end', function() {		  
			//message body fully read
			processRequest(postData, requestObj, responseObj)
		});
	 }    
}

/**
* Loads and parses leaderboard data from the database. Should only be run at startup as this function parses through MANY rows.
*/
function *loadLeaderboardData() {
	var generator = yield;
	trace ("Loading wins leaderboard data...");
	var queryResult = yield db.query("SELECT * FROM `gaming`.`games`", generator);
	if ((global.leaderboardData["last_bet"] == null) || (global.leaderboardData["last_bet"] == undefined)) {
		global.leaderboardData["last_bet"] = new Array();
	}
	if (queryResult.error == null) {
		for (var count=0; count < queryResult.rows.length; count++) {
			var currentResult = queryResult.rows[count];
			
			try {
				var betData = JSON.parse(querystring.unescape(currentResult.bet));
			} catch (err) {
				betData = null;
			}
			/*
			try {
				var selectionsData = JSON.parse(querystring.unescape(currentResult.bet));
			} catch (err) {
				selectionsData = null;
			}
			try {
				var resultsData = JSON.parse(querystring.unescape(currentResult.bet));
			} catch (err) {
				resultsData = null;
			}
			try {
				var keysData = JSON.parse(querystring.unescape(currentResult.bet));
			} catch (err) {
				keysData = null;
			}
			*/
			try {
				var winData = JSON.parse(currentResult.wins);
			} catch (err) {
				winData = null;
			}
			if (winData != null) {
				if ((winData["games"] != null) && (winData["games"] != undefined)) {
					//typically this will only contain one entry for the one game
					for (var gameID in winData.games) {
						//create default values for any that don't exist
						if ((global.leaderboardData["games"] == null) || (global.leaderboardData["games"] == undefined)) {
							global.leaderboardData["games"] = new Object();
						}
						if ((global.leaderboardData.games[gameID] == null) || (global.leaderboardData.games[gameID] == undefined)) {
							global.leaderboardData.games[gameID] = new Object();
						}
						if ((global.leaderboardData.games[gameID]["btc"] == null) || (global.leaderboardData.games[gameID]["btc"] == undefined) || (global.leaderboardData.games[gameID]["btc"] == "")) {
							global.leaderboardData.games[gameID]["btc"] = "0";
						}
						if ((global.leaderboardData.games[gameID]["tokens"] == null) || (global.leaderboardData.games[gameID]["tokens"] == undefined) || (global.leaderboardData.games[gameID]["tokens"] == "")) {
							global.leaderboardData.games[gameID]["tokens"] = "0";
						}
						if ((global.leaderboardData.games[gameID]["tokens_per_btc"] == null) || (global.leaderboardData.games[gameID]["tokens_per_btc"] == undefined) || (global.leaderboardData.games[gameID]["tokens_per_btc"] == "")) {
							global.leaderboardData.games[gameID]["tokens_per_btc"] == "0";
						}
						if ((winData.games[gameID]["btc"] == null) || (winData.games[gameID]["btc"] == undefined) || (winData.games[gameID]["btc"] == "")) {
							 winData.games[gameID]["btc"] = "0";
						}
						if ((winData.games[gameID]["tokens"] == null) || (winData.games[gameID]["tokens"] == undefined) || (winData.games[gameID]["tokens"] == "")) {
							 winData.games[gameID]["tokens"] = "0";
						}
						if ((winData.games[gameID]["tokens_per_btc"] == null) || (winData.games[gameID]["tokens_per_btc"] == undefined) || (winData.games[gameID]["tokens_per_btc"] == "")) {
							 winData.games[gameID]["tokens_per_btc"] = "0";
						}
						var gameObj = new Object();
						gameObj.gameID = gameID;
						gameObj.btc =  betData.btc;
						var tokens = new BigNumber(betData.btc);
						tokens = tokens.times(winData.games[gameID].tokens_per_btc);
						gameObj.tokens = tokens.toString(10);
						gameObj.tokens_per_btc =  winData.games[gameID].tokens_per_btc;
						gameObj.timestamp =  currentResult.date_time;
						global.leaderboardData.last_bet.push(gameObj);
						if (global.leaderboardData.last_bet.length > 10) {
							global.leaderboardData.last_bet.shift();
						}
						var currentHighestWin = new BigNumber(global.leaderboardData.games[gameID].btc); //or should we use tokens?
						var currentWin = new BigNumber(winData.games[gameID].btc);
						if (currentWin.greaterThan(currentHighestWin)) {
							global.leaderboardData.games[gameID].btc = winData.games[gameID].btc;
							global.leaderboardData.games[gameID].tokens = winData.games[gameID].btc;
							global.leaderboardData.games[gameID].tokens_per_btc = winData.games[gameID].tokens_per_btc
							global.leaderboardData.games[gameID].timestamp = currentResult.date_time;
						}
					}
				}
			}
		}
	}
	trace ("Wins leaderboard data loaded and parsed.");
}

/**
* Shuts down the server and all opened connections / databases / etc.
*/
function shutdown() {
	db.closeAll();
}

//***************************** MAIN START *****************************************

//Start the logging system
startLogs();
//Read and parse the game configurations
serverConfig.gameConfigs = readGameConfigs(serverConfig.gameConfigPaths);
//Start the database connection
if (serverConfig.gameConfigs != null) {
	db.connect(onConnect, onConnectFail);
}
	