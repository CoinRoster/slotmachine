'use strict';
require("./db_info.js"); //global database info
var db = require("./db.js"); //database connectivity
var serverConfig = require("./game_server_config.js"); //game server global config
const fs = require("fs");
const vm = require('vm');
const request = require("request");
const crypto = require('crypto'); //used to hash passwords
const BigNumber = require('bignumber.js'); //big number calculations
BigNumber.config({ EXPONENTIAL_AT: 1e+9, DECIMAL_PLACES: 8});
BigNumber.prototype.lessThan = BigNumber.prototype.isLessThan;
BigNumber.prototype.greaterThan = BigNumber.prototype.isGreaterThan;
BigNumber.prototype.greaterThanOrEqualTo = BigNumber.prototype.isGreaterThanOrEqualTo;
BigNumber.prototype.lessThanOrEqualTo = BigNumber.prototype.isLessThanOrEqualTo;
BigNumber.prototype.equals = BigNumber.prototype.isEqualTo;
BigNumber.prototype.add = BigNumber.prototype.plus;
const PAP = require ("./portable_account_plugin.js"); //Portable Account Plugin

var trace = function(msg){console.log("   "+msg);}; //trace function (formatted console.log output); should be replaced when "start" is invoked

exports.pluginInfo = {
	"name":"Investment Plugin",
	"description":"Plugin to manage individual user investments",
	"version":"1.2",
	"rpc":[
		{
			external : "getInvestmentsInfo",
			internal : "rpc_getInvestmentsInfo"
		},
		{
			external : "getInvestorInfo",
			internal : "rpc_getInvestorInfo"
		},
		{
			external : "updateInvestorInfo",
			internal : "rpc_updateInvestorInfo"
		},		
		{
			external : "getInvestmentStats",
			internal : "rpc_getInvestmentStats"
		}
	],
	"dbschema":{
		"investments":{
				"index":{"primary_key":true},
				"id":"VARCHAR(1024) COMMENT 'The referential identifier of the investment'",
				"name":"VARCHAR(2048) COMMENT 'The human-readable name of the investment'",
				"btc_balance":"VARCHAR(512) COMMENT 'The current total Bitcoin balance of all investments'",
				"btc_gains":"VARCHAR(512) COMMENT 'The gains or losses of the investment during the last update cycle'",
				"btc_total_balance":"VARCHAR(512) COMMENT 'The current total Bitcoin balance of all investments plus gains or losses'",
				"btc_balance_snapshot":"VARCHAR(512) COMMENT 'The Bitcoin balance of the investment at the beginning of the current sampling period'",
				"last_update":"TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'The date and time that the row was last updated'"
			},
			"investment_txs":{
				"index":{"primary_key":true},
				"account":"VARCHAR(1024) COMMENT 'The source account posting the transaction'",
				"name":"VARCHAR(2048) COMMENT 'Human-readable name of transaction or account'",
				"investments":"JSON COMMENT 'JSON-encoded object containing current investments and their balances'",
				"last_update":"TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'The date and time that the row was last updated'"
			},
			"investments_history":{
				"index":{"primary_key":true},
				"history":"JSON COMMENT 'JSON-encoded object containing the global update history for an investment (e.g. nightly dividend payment)'",
				"last_update":"TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'The date and time that the row was last updated'"
			}
	},
	"timerFunctions":[
		{
			"time":"00:01",
			"func":"payDividends"
		}
	],
	"rake": {
		"address":"RAKE_ACCOUNT",
		"percent":new BigNumber("0.05")
	},
	"affiliate": {
		"percent":new BigNumber("0.05")
	},
	"onInstallCallback":null,
	"activeInstalls":0,
	"_manager":null
}

var timer_payDividends = require("./external_functions/investment_plugin/timer_payDividends.js"); // single export function file
exports.payDividends = timer_payDividends; //link to timer function definition (pluginInfo.timerFunctions.func = "payDividends")

/**
* Generates a script context object for any externally loaded function so that it can operate as if a part of this code. Required by the plugin manager.
*/
exports.scriptContext = function() {
	var contextObj = new Object();
	//Include any "public" references or values here:
	contextObj.trace = trace;
	contextObj.exports = exports;
	contextObj.db = db;
	contextObj.fs = fs;
	contextObj.serverConfig = serverConfig;
	contextObj.crypto = crypto;
	contextObj.request = request;
	contextObj.BigNumber = BigNumber;
	contextObj.PAP = PAP;
	contextObj.getMySQLTimeStamp = getMySQLTimeStamp;
	contextObj.excludeDuplicate = excludeDuplicate;
	contextObj.getLastInvestmentTx = getLastInvestmentTx;
	contextObj.findInvestment = findInvestment;
	contextObj.resultsContainValue = resultsContainValue;
	return (contextObj);
}

function excludeDuplicate(dupField, queryResults) {
	var returnResults = new Array();
	for (var count = 0; count < queryResults.length; count++) {
		var currentResult = queryResults[count];
		if (resultsContainValue(returnResults, dupField, currentResult.account) == false) {
			returnResults.push (currentResult);
		}
	}
	return (returnResults);
}

function getLastInvestmentTx(account, transactionResults) {		
	for (var count=0; count < transactionResults.length; count++) {		
		if (transactionResults[count].account == account) {
			return (transactionResults[count]);
		}
	}
	return (null);
}

function findInvestment(investmentID, investmentArray) {
	if (typeof(investmentArray) == "string") {
		investmentArray = JSON.parse(investmentArray);
	}
	for (var count=0; count<investmentArray.length; count++) {
		if (investmentArray[count].investment_id == investmentID) {
			return (investmentArray[count]);
		}
	}
	return (null);
}

function resultsContainValue (resultsArray, field, value) {
	for (var count=0; count<resultsArray.length; count++) {
		if (resultsArray[count][field] == value) {
			return (true);
		}
	}
	return (false);
}

// ---- PLUGIN INSTALLATION ROUTINES ----

exports.install = (onInstallCallback) => {	
	trace ("Triggered install process in "+exports.pluginInfo.name);
	exports.pluginInfo.onInstallCallback = onInstallCallback;
	db.connect(exports.onDBConnect, exports.onDBConnectFail);
}

exports.onDBConnect = (connection) => {
	trace ("Install has successfully connected to the database.");
	for (var tableName in exports.pluginInfo.dbschema) {
		var tableSchema = exports.pluginInfo.dbschema[tableName];
		exports.createTable (connection, global.database_name, tableSchema, tableName);
		for (var columnName in tableSchema) {
			var columnType = tableSchema[columnName];
			if (typeof(columnType) != "object") {
				exports.pluginInfo.activeInstalls++;
				exports.createColumn (columnName, columnType, connection, global.database_name, tableName);
			}
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

exports.createTable = (connection, databaseName, tableSchema, tableName) => {
	console.log("exports.createTable");
	var primaryKeyObj = exports.getPrimaryKeyForCreate(tableSchema, tableName);
	if (primaryKeyObj == null) {
		console.log ("   Table \""+tableName+"\" does not define a primary key.");
		db.query("CREATE TABLE `"+databaseName+"`.`"+tableName, function(error, result, fields) {
			if (error==null) {
				console.log ("   Table \""+tableName+"\" successfully created.");
			} else if (error.toString().indexOf("ER_TABLE_EXISTS_ERROR") > -1) {
				console.log ("   Table \""+tableName+"\" already exists. Skipping.");
			} else {
				console.log ("   Error creating \""+tableName+"\": "+error);
			}		
		});
	} else {
		console.log ("   Primary key for table \""+tableName+"\": "+primaryKeyObj.column);
		db.query("CREATE TABLE `"+databaseName+"`.`"+tableName+"` "+primaryKeyObj.SQLInsert+"", function(error, result, fields) {
			if (error==null) {
				console.log ("   Table \""+tableName+"\" successfully created.");
			} else if (error.toString().indexOf("ER_TABLE_EXISTS_ERROR") > -1) {
				console.log ("   Table \""+tableName+"\" already exists. Skipping.");
			} else {
				console.log ("   Error creating \""+tableName+"\": "+error);
			}		
		});	
	}
}

exports.getPrimaryKeyForCreate = (tableSchema, tableName) => {	
	for (var column in tableSchema) {
		var currentColumn = tableSchema[column];		
		if (exports.columnIsPrimaryKey(currentColumn)) {
			var returnObj = new Object();
			returnObj.SQLInsert = "(`"+tableName+"`.`"+column+"` BIGINT NOT NULL AUTO_INCREMENT, PRIMARY KEY (`"+column+"`));";
			returnObj.column = column;
			returnObj.type = "BIGINT NOT NULL AUTO_INCREMENT";
			return (returnObj);
		}
	}	
	return (null);
}

exports.columnIsPrimaryKey = (columnSchema) => {
	try {
		if (columnSchema.primary_key == true) {
			return (true);
		}
	} catch (err) {
	}
	return (false);
}

exports.createColumn = (columnName, columnSchema, connection, databaseName, tableName) => {
	console.log("   Attempting to create new column: \""+columnName+"\" ("+JSON.stringify(columnSchema)+")");	
	db.query("ALTER TABLE `"+databaseName+"`.`"+tableName+"` ADD `"+columnName+"` " + columnSchema.toString(), function(result) {
		if (result.error == null) {
			console.log ("      Column \"" + columnName + "\" successfully created on table \"" + tableName + "\".");
		} else if (result.error.toString().indexOf("ER_DUP_FIELDNAME") > -1) {
			console.log ("      Column \"" + columnName + "\" already exists on table \"" + tableName + "\". Skipping.");
		} else {
			console.log ("      Error creating column \""+columnName+"\" on table \"" + tableName + " \": "+result.error);
		}
		exports.onCreateColumn();
	});	
}

exports.onInstallComplete = () => {	
	exports.onInstallCallback (true, "Database successfully set up.");
}

/**
* Main plugin start function. Typically invoked by game server.
*
* @oaram traceFunc A reference to a custom log output function to be used by the plugin. If omitted, a default one is used instead.
*/
exports.start = (traceFunc) => {
	trace = traceFunc;
	var PAPMajor = parseInt(PAP.pluginInfo.version.split(".")[0]);
	var PAPMinor = parseInt(PAP.pluginInfo.version.split(".")[1]);
	if ((PAPMajor == 1) && (PAPMinor < 1)) {
		trace ("Investment plugin requires Portable Account Plugin version 1.1 (minimum)! Some functions may fail.");
	}
	trace (exports.pluginInfo.name+" v "+exports.pluginInfo.version+" started."); 
}

var RPC_onBet_gen = function *(accountQueryResult, postData, betInfo, parentGenerator) {
	var generator = yield;
	var requestData = JSON.parse(postData);
	trace ("Bet amount (BTC): "+betInfo.btc);
	trace ("Jackpot deduction (BTC): "+betInfo.deduction);	
	//selects the newest row, by 'last_update'
	var investmentQueryResult = yield db.query("SELECT * FROM `gaming`.`investments` WHERE `index` IN (SELECT MAX(`index`) FROM `gaming`.`investments` GROUP BY `id`)", generator);
	//var investmentQueryResult = yield db.query("SELECT * FROM (SELECT * FROM `gaming`.`investments` ORDER BY `last_update` DESC) x GROUP BY `id`", generator); //the "x" is a table alias required by MySQL
	for (var count=0; count<investmentQueryResult.rows.length; count++) {
		//how do we get this functionality into external files?
		serverConfig.gameConfigs[requestData.params.gameID].bankrollID
		switch (investmentQueryResult.rows[count].id) {
			case serverConfig.gameConfigs[requestData.params.gameID].bankrollID:				
				trace ("   Updating \""+serverConfig.gameConfigs[requestData.params.gameID].bankrollID+"\" investment gains.");
				if ((investmentQueryResult.rows[count].btc_gains==null) || (investmentQueryResult.rows[count].btc_gains=="") || (investmentQueryResult.rows[count].btc_gains==undefined)) {
					investmentQueryResult.rows[count].btc_gains = "0";
				}
				var gainsBalance = new BigNumber(investmentQueryResult.rows[count].btc_gains);				
				trace ("  Previous balance: "+gainsBalance.toString(10));
				gainsBalance = gainsBalance.plus(betInfo.btc).minus(betInfo.deduction); //include jackpot deduction		
				investmentQueryResult.rows[count].btc_gains = gainsBalance.toString(10);
				trace ("  New balance: "+gainsBalance.toString(10));
				var insertFields = "`id`,";
				insertFields += "`name`,";
				insertFields += "`btc_balance`,";
				insertFields += "`btc_balance_snapshot`,";
				insertFields += "`btc_total_balance`,";
				insertFields += "`btc_gains`,";
				insertFields += "`last_update`";
				var insertValues = "\""+investmentQueryResult.rows[count].id+"\",";		
				insertValues += "\""+investmentQueryResult.rows[count].name+"\",";
				if (investmentQueryResult.rows[count].btc_balance == null) {
					insertValues += "NULL,";
				} else {
					insertValues += "\""+investmentQueryResult.rows[count].btc_balance+"\",";
				}
				if (investmentQueryResult.rows[count].btc_balance_snapshot == null) {
					insertValues += "NULL,";
				} else {
					insertValues += "\""+investmentQueryResult.rows[count].btc_balance_snapshot+"\",";
				}
				if (investmentQueryResult.rows[count].btc_total_balance == null) {
					insertValues += "NULL,";
				} else {
					insertValues += "\""+investmentQueryResult.rows[count].btc_total_balance+"\",";
				}
				insertValues += "\""+gainsBalance.toString(10)+"\",";
				insertValues += "NOW(6)";
				trace ("RPC_onBet_gen inserting into investments table");
				var insertSQL = "INSERT INTO `gaming`.`investments` ("+insertFields+") VALUES ("+insertValues+")";
				var investmentUpdateResult = yield db.query(insertSQL, generator);
				break;
			default: break;
		} 
	}	
	parentGenerator.next(null);
}
exports.RPC_onBetGen = RPC_onBet_gen;

var RPC_onWin_gen = function *(accountQueryResult, postData, winInfo, parentGenerator) {	
	var generator = yield;
	var requestData = JSON.parse(postData);	
	var investmentQueryResult = yield db.query("SELECT * FROM `gaming`.`investments` WHERE `index` IN (SELECT MAX(`index`) FROM `gaming`.`investments` GROUP BY `id`)", generator);
	//var investmentQueryResult = yield db.query("SELECT * FROM (SELECT * FROM `gaming`.`investments` ORDER BY `last_update` DESC) AS x GROUP BY `id`", generator);
	trace ("Win amount (BTC): "+winInfo.btc);	
	for (var count=0; count<investmentQueryResult.rows.length; count++) {
		//how do we get this functionality into external files?
		switch (investmentQueryResult.rows[count].id) {
			case "bankroll":		
				if ((investmentQueryResult.rows[count].btc_gains==null) || (investmentQueryResult.rows[count].btc_gains=="") || (investmentQueryResult.rows[count].btc_gains==undefined)) {
					investmentQueryResult.rows[count].btc_gains = "0";
				}
				var gainsBalance = new BigNumber(investmentQueryResult.rows[count].btc_gains);
				var previousGains = investmentQueryResult.rows[count].btc_gains;
				gainsBalance = gainsBalance.minus(winInfo.btc); //include jackpot deduction	
				investmentQueryResult.rows[count].btc_gains = gainsBalance.toString(10);
				/*
				var dbUpdates = "`btc_gains`=\""+gainsBalance.toString(10)+"\",";	
				dbUpdates += "`last_update`=NOW()";	
				var investmentUpdateResult = yield db.query("UPDATE `gaming`.`investments` SET "+dbUpdates+" WHERE `index`="+investmentQueryResult.rows[0].index+" LIMIT 1", generator);				
				*/
				if (previousGains != gainsBalance.toString(10)) {
					var insertFields = "`id`,";
					insertFields += "`name`,";
					insertFields += "`btc_balance`,";
					insertFields += "`btc_balance_snapshot`,";
					insertFields += "`btc_total_balance`,";
					insertFields += "`btc_gains`,";
					insertFields += "`last_update`";
					var insertValues = "\""+investmentQueryResult.rows[count].id+"\",";		
					insertValues += "\""+investmentQueryResult.rows[count].name+"\",";
					if (investmentQueryResult.rows[count].btc_balance == null) {
						insertValues += "NULL,";
					} else {
						insertValues += "\""+investmentQueryResult.rows[count].btc_balance+"\",";
					}
					if (investmentQueryResult.rows[count].btc_balance_snapshot == null) {
						insertValues += "NULL,";
					} else {
						insertValues += "\""+investmentQueryResult.rows[count].btc_balance_snapshot+"\",";
					}
					if (investmentQueryResult.rows[count].btc_total_balance == null) {
						insertValues += "NULL,";
					} else {
						insertValues += "\""+investmentQueryResult.rows[count].btc_total_balance+"\",";
					}
					insertValues += "\""+gainsBalance.toString(10)+"\",";
					insertValues += "NOW(6)";
	
					trace ("   Adjusted gains balance for investment \""+investmentQueryResult.rows[count].id+"\": "+gainsBalance.toString(10));
					trace ("RPC_onWin_gen inserting into investments table");
					var insertSQL = "INSERT INTO `gaming`.`investments` ("+insertFields+") VALUES ("+insertValues+")";
					var investmentUpdateResult = yield db.query(insertSQL, generator);
				}
				break;
			default: break;
		} 
	}	
	parentGenerator.next(null);
}
exports.RPC_onWinGen = RPC_onWin_gen;

exports.checkParameter = (requestData, param) => {
	if ((requestData["params"] == null) || (requestData["params"] == undefined)) {
		return ({"code":serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "message":"Required \"params\" not found in request."});		
	}
	if (requestData.params[param] == undefined) {		
		return ({"code":serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "message":"Required parameter \""+param+"\" not found in request."});		
	}
	return (null);
}

var rpc_updateInvestorInfo = function* (postData, requestObj, responseObj, batchResponses, replyResult, replyError) {
	var generator = yield;
	var requestData = JSON.parse(postData);		
	var responseData = new Object();	
	var checkResult = exports.checkParameter(requestData, "account");
	if (checkResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, checkResult.code, checkResult.message);	
		return;
	}
	checkResult = exports.checkParameter(requestData, "password");
	if (checkResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, checkResult.code, checkResult.message);	
		return;
	}
	checkResult = exports.checkParameter(requestData, "investment_id");
	if (checkResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, checkResult.code, checkResult.message);	
		return;
	}
	checkResult = exports.checkParameter(requestData, "transaction");
	if (checkResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, checkResult.code, checkResult.message);	
		return;
	}
	if ((requestData.params.transaction["deposit"] == undefined) && (requestData.params.transaction["withdraw"] == undefined)) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "No \"deposit\" or \"withdraw\" object found in transaction.");	
		return;
	}
	if (isNaN(requestData.params["bankroll_multiplier"])) {
		requestData.params.bankroll_multiplier = 1; //default bankroll multiplier
	}
	var depositing = false; //depositing to investment?
	if ((requestData.params.transaction["deposit"] != undefined) && (requestData.params.transaction["deposit"] != null) && (requestData.params.transaction["deposit"] != "")) {
		depositing = true;
	}
	var investmentQueryResult = yield db.query("SELECT * FROM `gaming`.`investments` WHERE `id`=\""+requestData.params.investment_id+"\" ORDER BY `index` DESC LIMIT 1", generator);
	if (investmentQueryResult.error != null) {
		trace ("Database error on rpc_updateInvestorInfo: "+investmentQueryResult.error);		
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
		return;
	}	
	if (investmentQueryResult.rows.length == 0) {
		trace ("No matching investment: \""+requestData.params.investment_id+"\"");
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_NO_RESULTS, "No matching investment.", requestData.params.investment_id);
		return;
	}
	var accountQueryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `btc_account`=\""+requestData.params.account+"\" ORDER BY `index` DESC LIMIT 1", generator);
	if (PAP.authenticated(accountQueryResult, postData) == false) {
		trace ("Authentication failed for account " + requestData.params.account);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_AUTH_ERROR, "Login failed.");
		return;
	}
	if (accountQueryResult.error != null) {
		trace ("Database error on rpc_updateInvestorInfo: "+accountQueryResult.error);		
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
		return;
	}	
	if (accountQueryResult.rows.length == 0) {
		trace ("No matching account address: "+requestData.params.account);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_NO_RESULTS, "No matching account.", requestData.params.account);
		return;
	}
	if ((accountQueryResult.rows[0].btc_balance_verified == null) || (accountQueryResult.rows[0].btc_balance_verified == undefined) || (accountQueryResult.rows[0].btc_balance_verified == "NULL") || (accountQueryResult.rows[0].btc_balance_verified == "")) {
		accountQueryResult.rows[0].btc_balance_verified = "0";
	}
	if ((accountQueryResult.rows[0].btc_balance_available == null) || (accountQueryResult.rows[0].btc_balance_available == undefined) || (accountQueryResult.rows[0].btc_balance_available == "NULL") || (accountQueryResult.rows[0].btc_balance_available == "")) {
		accountQueryResult.rows[0].btc_balance_available = "0";
	}
	if ((accountQueryResult.rows[0].btc_balance_total == null) || (accountQueryResult.rows[0].btc_balance_total == undefined) || (accountQueryResult.rows[0].btc_balance_total == "NULL") || (accountQueryResult.rows[0].btc_balance_total == "")) {
		accountQueryResult.rows[0].btc_balance_total = "0";
	}
	if ((accountQueryResult.rows[0].btc_balance_total_previous == null) || (accountQueryResult.rows[0].btc_balance_total_previous == undefined) || (accountQueryResult.rows[0].btc_balance_total_previous == "NULL") || (accountQueryResult.rows[0].btc_balance_total_previous == "")) {
		accountQueryResult.rows[0].btc_balance_total_previous = "0";
	}
	if ((investmentQueryResult.rows[0].btc_balance == null) || (investmentQueryResult.rows[0].btc_balance == undefined) || (investmentQueryResult.rows[0].btc_balance == "NULL") || (investmentQueryResult.rows[0].btc_balance == "")) {
		investmentQueryResult.rows[0].btc_balance = "0";
	}
	var btc_balance_conf = new BigNumber(accountQueryResult.rows[0].btc_balance_verified);
	var btc_balance_avail = new BigNumber(accountQueryResult.rows[0].btc_balance_available);
	var btc_balance_total = new BigNumber(accountQueryResult.rows[0].btc_balance_total);
	var btc_investment_balance = new BigNumber(investmentQueryResult.rows[0].btc_balance);
	if ((investmentQueryResult.rows[0].btc_total_balance == null) || (investmentQueryResult.rows[0].btc_total_balance == "NULL") || (investmentQueryResult.rows[0].btc_total_balance == "")) {
		var btc_investment_total_balance = new BigNumber(investmentQueryResult.rows[0].btc_balance);
	} else {
		var btc_investment_total_balance = new BigNumber(investmentQueryResult.rows[0].btc_total_balance);		
	}
	if (btc_balance_conf.equals(0)) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_ACTION_ERROR, "Deposit not yet confirmed.");
		return;
	}
	//create transaction amount based on transaction type
	if (depositing) {
		try {
			var btc_tx_amount = new BigNumber(requestData.params.transaction.deposit.btc);			
		} catch (err) {
			trace ("Invalid deposit object format: "+err);
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "Invalid deposit transaction object. Expecting \"btc\":\"NUMERIC_VALUE\"");
			return;
		}
	} else {
		try {			
			btc_tx_amount = new BigNumber(requestData.params.transaction.withdraw.btc);			
		} catch (err) {
			trace ("Invalid deposit object format: "+err);
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "Invalid deposit transaction object. Expecting \"btc\":\"NUMERIC_VALUE\"");
			return;
		}
	}
	var adj_btc_tx_amount = new BigNumber(btc_tx_amount.toString(10)); //adjusted transaction amount
	var current_btc_balance_conf = new BigNumber(accountQueryResult.rows[0].btc_balance_verified);
	var current_btc_balance_total = new BigNumber(accountQueryResult.rows[0].btc_balance_total);
	var current_btc_balance_avail = new BigNumber(accountQueryResult.rows[0].btc_balance_available);
	var current_btc_balance_total_previous = new BigNumber(accountQueryResult.rows[0].btc_balance_total_previous);	
	var btc_per_satoshis = new BigNumber("0.00000001");	
	if (depositing) {
		var accountInfo = yield checkAccountBalance(generator, requestData.params.account);
		if ((accountInfo != undefined) && (accountInfo != null)) {
			var update_btc_balance_conf = new BigNumber(String(accountInfo.balance)); //convert from Satoshis to Bitcoin
			update_btc_balance_conf = update_btc_balance_conf.times(btc_per_satoshis);
			var update_btc_balance_unc = new BigNumber(String(accountInfo.unconfirmed_balance)); //convert from Satoshis to Bitcoin
			update_btc_balance_unc = update_btc_balance_unc.times(btc_per_satoshis);
			var update_btc_balance_total = new BigNumber(String(accountInfo.final_balance));
		} else {
			update_btc_balance_unc = new BigNumber(0);
		}
	} else {
		update_btc_balance_unc = new BigNumber(0);
	}
	var btc_balance_conf = current_btc_balance_conf;
	var btc_balance_avail = current_btc_balance_avail;
	var btc_balance_total = current_btc_balance_total;
	var btc_balance_total_previous = current_btc_balance_total_previous;	
	if (depositing) {
		//check to make sure current account balance supports deposit (to investment)		
		btc_balance_avail = btc_balance_avail.minus(btc_tx_amount);
		btc_investment_balance = btc_investment_balance.plus(btc_tx_amount);
		btc_investment_total_balance = btc_investment_total_balance.plus(btc_tx_amount);
		if (btc_balance_avail.minus(update_btc_balance_unc).lessThan(0)) {
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_ACTION_ERROR, "Requested transaction exceeds available balance.");
			return;
		}
	} else {
		btc_balance_avail = btc_balance_avail.plus(btc_tx_amount);
		btc_investment_balance = btc_investment_balance.minus(btc_tx_amount);
		btc_investment_total_balance = btc_investment_total_balance.minus(btc_tx_amount);
	}
	//get latest investor row
	var investorQueryResult = yield db.query("SELECT * FROM `gaming`.`investment_txs` WHERE `account`=\""+requestData.params.account+"\" ORDER BY  `last_update` DESC LIMIT 1", generator);	
	var total_investment_amount = new BigNumber(0);		
	if (investorQueryResult.error != null) {
		trace ("Database error on rpc_updateInvestorInfo: "+investorQueryResult.error);		
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
		return;
	}		
	if (investorQueryResult.rows.length == 0) {		
		if (!depositing) {
			trace ("No investment records exist for specified account: "+requestData.params.account);		
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "No investment records exist for specified account.");
			return;
		}
		//create new row, deposit required
		var investments = new Array();
		var investmentObj = new Object();
		investmentObj.investment_id = requestData.params.investment_id;
		try {
			investmentObj.user_investment_btc = requestData.params.transaction.deposit.btc;
			investmentObj.user_investment_base_btc = requestData.params.transaction.deposit.btc;
			investmentObj.user_investment_exclude_btc = "0"; //requestData.params.transaction.deposit.btc; //the latest deposit/withdrawal by the user to be excluded from 
		} catch (err) {
			trace ("Invalid initial deposit object format: "+err);
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "Invalid initial deposit transaction object. Expecting \"btc\":\"NUMERIC_VALUE\"");
			return;
		}
		investmentObj.investment_balance_btc = btc_investment_total_balance.toString(10);
		investmentObj.bankroll_multiplier = requestData.params.bankroll_multiplier;
		investments.push(investmentObj);
	} else {
		//use existing row
		investments = JSON.parse(investorQueryResult.rows[0].investments);
		var investmentUpdated = false;
		for (var count = 0; count < investments.length; count++) {
			var currentInvestment = investments[count];
			if (currentInvestment.investment_id == requestData.params.investment_id) {
				try {
					if ((typeof(currentInvestment["user_investment_exclude_btc"]) != "string") || (currentInvestment["user_investment_exclude_btc"] == "")) {
						currentInvestment.user_investment_exclude_btc = "0";
					}
					var btc_currentDeposit = new BigNumber(currentInvestment.user_investment_btc);
					var btc_currentBaseDeposit = new BigNumber(currentInvestment.user_investment_base_btc);
					var btc_userInvestmentExclude = new BigNumber(currentInvestment.user_investment_exclude_btc);
					if (depositing) {
						btc_currentDeposit = btc_currentDeposit.plus(btc_tx_amount);
						btc_currentBaseDeposit = btc_currentBaseDeposit.plus(btc_tx_amount);
					} else {
						//calculate adjusted withdrawal amount to subtract from base investment amounts
						//adj_btc_tx_amount = btc_tx_amount.times(btc_currentBaseDeposit.dividedBy(btc_currentDeposit));
						adj_btc_tx_amount = btc_currentBaseDeposit.times(btc_tx_amount.dividedBy(btc_currentDeposit));
						btc_currentDeposit = btc_currentDeposit.minus(btc_tx_amount);
						btc_currentBaseDeposit = btc_currentBaseDeposit.minus(adj_btc_tx_amount);
						//revert and adjust btc base investment balance
						btc_investment_balance = btc_investment_balance.plus(btc_tx_amount).minus(adj_btc_tx_amount);
					}
					currentInvestment.user_investment_base_btc = btc_currentBaseDeposit.toString(10);
					currentInvestment.user_investment_btc = btc_currentDeposit.toString(10);
					currentInvestment.investment_balance_btc = btc_investment_total_balance.toString(10);
					currentInvestment.user_investment_exclude_btc = btc_userInvestmentExclude.toString(10);
					currentInvestment.bankroll_multiplier = requestData.params.bankroll_multiplier;
					investmentObj = currentInvestment;
					investmentUpdated = true;
				} catch (err) {
					trace ("Couldn't update \"btc\" amount on investment object \""+requestData.params.investment_id+"\": "+err);		
					replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
					return;
				}
				break;
			}
		}	
		if (!investmentUpdated) {
			if (!depositing) {
				trace ("Account \""+requestData.params.account+"\" has no investment in \""+requestData.params.investment_id+"\"");	
				replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_ACTION_ERROR, "No investment record for account found.");
				return;
			}
			trace ("No existing investment_txs rows  to update. Creating new one for user.");
			//no existing rows to update so create new one (to be added below)
			var investmentObj = new Object();
			investmentObj.investment_id = requestData.params.investment_id;
			try {
				investmentObj.user_investment_base_btc = requestData.params.transaction.deposit.btc;
				investmentObj.user_investment_btc = requestData.params.transaction.deposit.btc;
				investmentObj.user_investment_exclude_btc = "0";
			} catch (err) {
				trace ("Invalid initial deposit object format: "+err);
				replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "Invalid initial deposit transaction object. Expecting \"btc\":\"NUMERIC_VALUE\"");
				return;
			}
			investmentObj.investment_balance_btc = btc_investment_total_balance.toString(10);
			investmentObj.bankroll_multiplier = requestData.params.bankroll_multiplier;
			investments.push(investmentObj);
		}
	}
	//update 'accounts' table
	var dbUpdates = "`btc_balance_available`=\""+btc_balance_avail.toString(10)+"\",`last_login`=NOW()";
	var txInfo = new Object();
	if (depositing) {
		txInfo.type = "deposit";
	} else {
		txInfo.type = "withdrawal";		
	}
	txInfo.subType = "investment";
	txInfo.info = new Object();	
	txInfo.info.btc = btc_tx_amount.toString(10);
	txInfo.info.investment_id = investmentQueryResult.rows[0].id;
	txInfo.info.investment_name = investmentQueryResult.rows[0].name;
	if ((investmentQueryResult.rows[0].btc_total_balance == null) || (investmentQueryResult.rows[0].btc_total_balance == "NULL") || (investmentQueryResult.rows[0].btc_total_balance == "")) {
		investmentQueryResult.rows[0].btc_total_balance="0";
	}
	if ((investmentQueryResult.rows[0].btc_gains == null) || (investmentQueryResult.rows[0].btc_gains == "NULL") || (investmentQueryResult.rows[0].btc_gains == "")) {
		investmentQueryResult.rows[0].btc_gains="0";
	}
	if ((investmentQueryResult.rows[0].btc_balance == null) || (investmentQueryResult.rows[0].btc_balance == "NULL") || (investmentQueryResult.rows[0].btc_balance == "")) {
		investmentQueryResult.rows[0].btc_balance="0";
	}
	var totalBalance = new BigNumber (investmentQueryResult.rows[0].btc_total_balance);
	var gains = new BigNumber (investmentQueryResult.rows[0].btc_gains);
	txInfo.info.investment_balance_btc = totalBalance.plus(gains).toString(10);
	var accountUpdateResult = yield global.updateAccount(accountQueryResult, dbUpdates, txInfo, generator);
	if (accountUpdateResult.error != null) {
		trace ("Database error on rpc_updateInvestorInfo: "+accountUpdateResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when updating the account.");
		return;
	}
	if (accountQueryResult.rows[0].auth_status == 2) {
		var accountPlugin = exports.pluginInfo._manager.getPlugin("Portable Account Plugin");
		var dateStr = new Date().toISOString();
		if (depositing) {
			accountPlugin.sendEmail("myfruitgame@gmail.com", 
				accountQueryResult.rows[0].email,
				"Investment Update (Deposit)", 
				"You deposited BTC"+btc_tx_amount.toString(10)+" to investment \""+requestData.params.investment_id+"\" on "+dateStr+". Available BTC balance is now: "+btc_balance_avail.toString(10)
			);
		} else {
			accountPlugin.sendEmail("myfruitgame@gmail.com", 
				accountQueryResult.rows[0].email,
				"Investment Update (Withdrawal)", 
				"You withdrew BTC"+btc_tx_amount.toString(10)+" from investment \""+requestData.params.investment_id+"\" on "+dateStr+". Available BTC balance now: "+btc_balance_avail.toString(10)
			);
		}
	}
	//update 'investments' table
	var insertFields = "`id`,";
	insertFields += "`name`,";
	insertFields += "`btc_balance`,";
	insertFields += "`btc_balance_snapshot`,";
	insertFields += "`btc_total_balance`,";
	insertFields += "`btc_gains`,";
	insertFields += "`last_update`";
	var insertValues = "\""+investmentQueryResult.rows[0].id+"\",";		
	insertValues += "\""+investmentQueryResult.rows[0].name+"\",";
	insertValues += "\""+btc_investment_balance.toString(10)+"\",";
	if (investmentQueryResult.rows[0].btc_balance_snapshot == null) {
		insertValues += "NULL,";
	} else {
		insertValues += "\""+investmentQueryResult.rows[0].btc_balance_snapshot+"\",";
	}
	if (investmentQueryResult.rows[0].btc_total_balance == null) {
		insertValues += "NULL,";
	} else {
		insertValues += "\""+btc_investment_total_balance.toString(10)+"\",";
	}
	if (investmentQueryResult.rows[0].btc_gains == null) {
		insertValues += "NULL,";
	} else {
		insertValues += "\""+investmentQueryResult.rows[0].btc_gains+"\",";
	}
	insertValues += "NOW()";
	var insertSQL = "INSERT INTO `gaming`.`investments` ("+insertFields+") VALUES ("+insertValues+")";
	var investmentUpdateResult = yield db.query(insertSQL, generator);
	if (investmentUpdateResult.error != null) {
		trace ("Database error on rpc_updateInvestorInfo: "+investmentUpdateResult.error);		
		trace ("   SQL: "+updateSQL);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when processing the request.");
		return;
	}
	//add new row to 'investment_txs' table	
	var insertFields = "`account`,";
	if ((requestData.params["name"] != undefined) && (requestData.params["name"] != null) && (requestData.params["name"] != "")) {
		insertFields += "`name`,";
	}
	insertFields += "`investments`,";
	insertFields += "`last_update`";
	global.assertAnyValue("NaN", "0", investments);
	var insertValues = "\""+requestData.params.account+"\",";
	if ((requestData.params["name"] != undefined) && (requestData.params["name"] != null) && (requestData.params["name"] != "")) {
		insertValues += "\""+requestData.params.name+"\",";
	}
	insertValues += "'"+JSON.stringify(investments)+"',";
	insertValues += "NOW()";
	var insertSQL = "INSERT INTO `gaming`.`investment_txs` ("+insertFields+") VALUES ("+insertValues+")";
	var txInsertResult = yield db.query(insertSQL, generator);
	if (txInsertResult.error != null) {
		trace ("Database error on rpc_updateInvestorInfo: "+txInsertResult.error);
		trace ("   SQL: "+insertSQL);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when processing the request.");
		return;
	}
	replyResult(postData, requestObj, responseObj, batchResponses, "OK");	
}
exports.rpc_updateInvestorInfo = rpc_updateInvestorInfo;

function checkAccountBalance(generator, account) {
	request({
		url: "https://api.blockcypher.com/v1/"+serverConfig.APIInfo.blockcypher.network+"/addrs/"+account+"/full",
		method: "GET",
		json: true		
	}, function (error, response, body){   		
		generator.next(body);				
	});
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

var rpc_getInvestmentsInfo = function* (postData, requestObj, responseObj, batchResponses, replyResult, replyError) {
	var generator = yield;
	var requestData = JSON.parse(postData);		
	var responseData = new Object();
	responseData.investments = new Array();
	var investmentsQueryResult = yield db.query("SELECT * FROM `gaming`.`investments` WHERE `index` IN (SELECT MAX(`index`) FROM `gaming`.`investments` GROUP BY `id`)", generator);
	if (investmentsQueryResult.error != null) {
		trace ("Database error on rpc_getInvestmentsInfo: "+investmentsQueryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
		return;
	}
	for (var count=0; count<investmentsQueryResult.rows.length; count++) {
		var newInvestment = new Object();
		newInvestment.id = investmentsQueryResult.rows[count].id;
		newInvestment.name = investmentsQueryResult.rows[count].name;
		newInvestment.btc_balance = investmentsQueryResult.rows[count].btc_balance;
		newInvestment.btc_gains = investmentsQueryResult.rows[count].btc_gains;
		newInvestment.btc_total_balance = investmentsQueryResult.rows[count].btc_total_balance;
		responseData.investments.push (newInvestment);
	}
	global.assertAnyValue("NaN", "0", responseData);
	replyResult(postData, requestObj, responseObj, batchResponses, responseData);	
}
exports.rpc_getInvestmentsInfo=rpc_getInvestmentsInfo;

var rpc_getInvestorInfo = function* (postData, requestObj, responseObj, batchResponses, replyResult, replyError) {
	var generator = yield;
	var requestData = JSON.parse(postData);		
	var responseData = new Object();	
	var checkResult = exports.checkParameter(requestData, "account");
	if (checkResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, checkResult.code, checkResult.message);	
		return;
	}
	checkResult = exports.checkParameter(requestData, "password");
	if (checkResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, checkResult.code, checkResult.message);	
		return;
	}
	var transactionHistory = 6; //default number of most recent items
	var THPage = 0; //offset page within the transaction history (for pagination)
	if ((requestData.params["history"] != undefined) && (requestData.params["history"] != null) && (requestData.params["history"] != "")) {
		transactionHistory = parseInt (requestData.params.history);
		if (isNaN(transactionHistory)) {
			transactionHistory = 6;
		}
	}
	if ((requestData.params["page"] != undefined) && (requestData.params["page"] != null) && (requestData.params["page"] != "")) {
		transactionHistory = parseInt (requestData.params.history);
		if (isNaN(transactionHistory)) {
			transactionHistory = 6;
		}
	}
	var investorQueryResult = yield db.query("SELECT * FROM `gaming`.`investment_txs` WHERE `account`=\""+requestData.params.account+"\" ORDER BY `index` DESC LIMIT "+String(transactionHistory)+" OFFSET "+THPage, generator);	
	if (investorQueryResult.error != null) {
		trace ("Database error on rpc_getInvestorInfo: "+investorQueryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
		return;
	}	
	/*if (investorQueryResult.rows.length == 0) {
		trace ("No matching address");
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_NO_RESULTS, "No matching account.", requestData.params.email);
		return;
	}*/
	var accountQueryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `btc_account`=\""+requestData.params.account+"\" ORDER BY `index` DESC LIMIT 1", generator);
	if (PAP.authenticated(accountQueryResult, postData) == false) {
		trace ("Authentication failed for account " + requestData.params.account);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_AUTH_ERROR, "Login failed.");
		return;
	}
	var returnObj = new Object();		
	returnObj.transactions = new Array();
	for (var count=0; count<investorQueryResult.rows.length; count++) {
		var currentRow = investorQueryResult.rows[count];
		currentRow.timestamp = currentRow.last_update;
		delete currentRow.index;
		delete currentRow.last_update;
		currentRow.investments = JSON.parse(currentRow.investments);
		returnObj.transactions.push(currentRow);		
	}
	global.assertAnyValue("NaN", "0", returnObj);
	replyResult(postData, requestObj, responseObj, batchResponses, returnObj);	
}
exports.rpc_getInvestorInfo = rpc_getInvestorInfo;

exports.getInvestmentByID = (investments, id) => {
	for (var count=0; count<investments.length; count++) {
		if (investments[count].id == id) {
			return (investments[count]);
		}
	}
	return (null);
}

var rpc_getInvestmentStats = function* (postData, requestObj, responseObj, batchResponses, replyResult, replyError) {
	var generator = yield;
	var requestData = JSON.parse(postData);		
	var responseData = new Object();	
	if (requestData.params["user_balances"] == true) {
		var accountsQueryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `index` IN (SELECT MAX(`index`) FROM `gaming`.`accounts` GROUP BY `btc_account`)", generator);	
		if (accountsQueryResult.error != null) {
			trace ("Database error on rpc_getInvestmentStats: "+accountsQueryResult.error);
			trace ("   Request ID: "+requestData.id);
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
			return;
		}
		responseData.user_balances = new Object();
		var totalAvailableBalance = new BigNumber(0);
		for (var count=0; count<accountsQueryResult.rows.length; count++) {
			var currentRow = accountsQueryResult.rows[count];
			if ((currentRow.btc_balance_available == null) || (currentRow.btc_balance_available == "") || (currentRow.btc_balance_available == "NULL") || (currentRow.btc_balance_available == "null")) {
				currentRow.btc_balance_available = "0";
			}
			var currentAvailableBalance = new BigNumber(currentRow.btc_balance_available);			
			totalAvailableBalance = totalAvailableBalance.plus(currentAvailableBalance);			
		}
		responseData.user_balances.btc_available_total = totalAvailableBalance.toString(10);
	}
	if (requestData.params["investments_total"] == true) {
		var investmentsQueryResult = yield db.query("SELECT * FROM `gaming`.`investments` WHERE `index` IN (SELECT MAX(`index`) FROM `gaming`.`investments` GROUP BY `id`)", generator);	
		if (investmentsQueryResult.error != null) {
			trace ("Database error on rpc_getInvestmentStats: "+investmentsQueryResult.error);
			trace ("   Request ID: "+requestData.id);
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
			return;
		}
		responseData.investments_total = new Object();
		var balance = new BigNumber(0);
		var balanceSnapshot = new BigNumber(0);
		var totalBalance = new BigNumber(0);
		var gains = new BigNumber(0);
		var latestUpdate = new Date(1970,0,0,0,0,0,0);
		for (var count=0; count<investmentsQueryResult.rows.length; count++) {
			var currentRow = investmentsQueryResult.rows[count];					
			if ((currentRow.btc_balance == null) || (currentRow.btc_balance == "") || (currentRow.btc_balance == "NULL") || (currentRow.btc_balance == "null")) {
				currentRow.btc_balance = "0";
			}
			if ((currentRow.btc_balance_snapshot == null) || (currentRow.btc_balance_snapshot == "") || (currentRow.btc_balance_snapshot == "NULL") || (currentRow.btc_balance_snapshot == "null")) {
				currentRow.btc_balance_snapshot = "0";
			}
			if ((currentRow.btc_total_balance == null) || (currentRow.btc_total_balance == "") || (currentRow.btc_total_balance == "NULL") || (currentRow.btc_total_balance == "null")) {
				currentRow.btc_total_balance = "0";
			}
			if ((currentRow.btc_gains == null) || (currentRow.btc_gains == "") || (currentRow.btc_gains == "NULL") || (currentRow.btc_gains == "null")) {
				currentRow.btc_gains = "0";
			}
			if ((currentRow.last_update == null) || (currentRow.last_update == "") || (currentRow.last_update == "NULL") || (currentRow.last_update == "null")) {
				var updatedAt = new Date(1970,0,0,0,0,0,0);				
			} else {
				updatedAt = new Date(currentRow.last_update);
			}
			if (updatedAt.valueOf() > latestUpdate.valueOf()) {
				latestUpdate = updatedAt;
			}
			balance = balance.plus(new BigNumber(currentRow.btc_balance));
			balanceSnapshot = balanceSnapshot.plus(new BigNumber(currentRow.btc_balance_snapshot));
			totalBalance = totalBalance.plus(new BigNumber(currentRow.btc_total_balance));
			gains = gains.plus(new BigNumber(currentRow.btc_gains));
		}
		responseData.investments_total.btc_balance = balance.toString(10);
		responseData.investments_total.btc_balance_snapshot = balanceSnapshot.toString(10);
		responseData.investments_total.btc_total_balance = totalBalance.toString(10);
		responseData.investments_total.btc_gains = gains.toString(10);
		responseData.investments_total.latest_update = latestUpdate.toISOString();
	}
	if (requestData.params["investments_arp"] == true) {
		var historyDays = 5; //days of investment history to retrieve
		var startDateObj = new Date();
		startDateObj.setDate(startDateObj.getDate()-historyDays);
		var startPeriod = getMySQLTimeStamp(startDateObj);
		var endDateObj = new Date();
		var endPeriod = getMySQLTimeStamp(endDateObj);		
		//var investmentsQuerySQL = "SELECT * FROM `gaming`.`investments` WHERE `last_update` BETWEEN \""+startPeriod+"\" AND \""+endPeriod+"\" ORDER BY `last_update` ASC";
		var investmentsQuerySQL = "SELECT * FROM `gaming`.`investments` WHERE `index` IN (SELECT MAX(`index`) FROM `gaming`.`investments` GROUP BY `id`)";
		var investmentsQueryResult = yield db.query(investmentsQuerySQL, generator);		
		var investmentStatusObj = new Object();
		if (investmentsQueryResult.error != null) {
			trace ("Database error on rpc_getInvestmentStats: "+investmentsQueryResult.error);
			trace ("   Request ID: "+requestData.id);
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
			return;
		}
		responseData.investments_arp = new Array();
		for (var count=0; count<investmentsQueryResult.rows.length; count++) {
			var currentRow = investmentsQueryResult.rows[count];
			if ((investmentStatusObj[currentRow.id] == undefined) || (investmentStatusObj[currentRow.id] == null)) {
				investmentStatusObj[currentRow.id] = new Object();	
				investmentStatusObj[currentRow.id].name = currentRow.name;
				investmentStatusObj[currentRow.id].base_deposit = new BigNumber(0);
				investmentStatusObj[currentRow.id].total_gains = new BigNumber(0);				
			} else {				
				var previousRow = investmentStatusObj[currentRow.id].previousRow;
				if (currentRow.btc_total_balance != previousRow.btc_total_balance) {					
					//dividends payment function (above) has been triggered at this point; previous row is just before function call	
					if ((previousRow.btc_gains == null) || (previousRow.btc_gains == "") || (previousRow.btc_gains == undefined) || (previousRow.btc_gains == "NULL") || (previousRow.btc_gains == "null")) {
						previousRow.btc_gains = "0";
					}
					investmentStatusObj[currentRow.id].total_gains = investmentStatusObj[currentRow.id].total_gains.plus(new BigNumber(previousRow.btc_gains));
					if ((currentRow.btc_balance == null) || (currentRow.btc_balance == "") || (currentRow.btc_balance == undefined) || (currentRow.btc_balance == "NULL") || (currentRow.btc_balance == "null")) {
						currentRow.btc_balance = "0";
					}					
					investmentStatusObj[currentRow.id].base_deposit = new BigNumber(currentRow.btc_balance); //store most current base deposit amount
				}
			}
			if ((currentRow.btc_total_balance == null) || (currentRow.btc_total_balance == "") || (currentRow.btc_total_balance == undefined) || (currentRow.btc_total_balance == "NULL") || (currentRow.btc_balance_snapshot == "null")) {
				currentRow.btc_total_balance = "0";
			}	
			if ((currentRow.btc_gains == null) || (currentRow.btc_gains == "") || (currentRow.btc_gains == undefined) || (currentRow.btc_gains == "NULL") || (currentRow.btc_gains == "null")) {
				currentRow.btc_gains = "0";
			}
			investmentStatusObj[currentRow.id].base_deposit = new BigNumber(0);
			investmentStatusObj[currentRow.id].total_balance = new BigNumber(0);
			investmentStatusObj[currentRow.id].current_gains = new BigNumber(0);
			try {
				investmentStatusObj[currentRow.id].base_deposit = new BigNumber(currentRow.btc_balance);
				investmentStatusObj[currentRow.id].total_balance = new BigNumber(currentRow.btc_total_balance);
				investmentStatusObj[currentRow.id].current_gains = new BigNumber(currentRow.btc_gains);
			} catch (err) {
			}
			investmentStatusObj[currentRow.id].previousRow = currentRow;
		}
		for (var investmentID in investmentStatusObj) {
			var investmentObj = new Object();
			investmentObj.id = investmentID;
			investmentObj.name = investmentStatusObj[investmentID].name;
			investmentObj.btc_gains_total = investmentStatusObj[investmentID].total_gains.toString(10);
			investmentObj.btc_gains_current = investmentStatusObj[investmentID].current_gains.toString(10);
			investmentObj.btc_balance_total = investmentStatusObj[investmentID].total_balance.toString(10);
			investmentObj.btc_base_deposit = investmentStatusObj[investmentID].base_deposit.toString(10);
			responseData.investments_arp.push(investmentObj);
		}
	}
	if (requestData.params["investments_charts"] == true) {
		var historyDays = 5; //days of investment history to retrieve
		var startDateObj = new Date();
		startDateObj.setDate(startDateObj.getDate()-historyDays);
		var startPeriod = getMySQLTimeStamp(startDateObj);
		var endDateObj = new Date();
		var endPeriod = getMySQLTimeStamp(endDateObj);		
		var investmentsQuerySQL = "SELECT * FROM `gaming`.`investments` WHERE `last_update` BETWEEN \""+startPeriod+"\" AND \""+endPeriod+"\" ORDER BY `last_update` ASC";				
		var investmentsQueryResult = yield db.query(investmentsQuerySQL, generator);		
		var investmentStatusObj = new Object();
		if (investmentsQueryResult.error != null) {
			trace ("Database error on rpc_getInvestmentStats: "+investmentsQueryResult.error);
			trace ("   Request ID: "+requestData.id);
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
			return;
		}
		responseData.investments_charts = new Object();		
		var currentRow = null
		for (var count=0; count<investmentsQueryResult.rows.length; count++) {
			currentRow = investmentsQueryResult.rows[count];
			if ((responseData.investments_charts[currentRow.id] == undefined) || (responseData.investments_charts[currentRow.id] == null)) {
				responseData.investments_charts[currentRow.id] = Object();
				responseData.investments_charts[currentRow.id].btc_gains = new Object();
				responseData.investments_charts[currentRow.id].btc_gains.name = currentRow.name;
				responseData.investments_charts[currentRow.id].btc_gains.id = currentRow.id;
				responseData.investments_charts[currentRow.id].btc_gains.data = new Array();
				responseData.investments_charts[currentRow.id].btc_investment_total = new Object();
				responseData.investments_charts[currentRow.id].btc_investment_total.name = currentRow.name;
				responseData.investments_charts[currentRow.id].btc_investment_total.id = currentRow.id;
				responseData.investments_charts[currentRow.id].btc_investment_total.data = new Array();
				responseData.investments_charts[currentRow.id]._previousRow = null;
			}
			var currentGainsData = responseData.investments_charts[currentRow.id].btc_gains.data;
			var currentTotalsData = responseData.investments_charts[currentRow.id].btc_investment_total.data;
			var newChartObj = new Array();
			var newChartObj2 = new Array();
			var dateObj = new Date(currentRow.last_update);
			newChartObj.push(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), dateObj.getHours(), dateObj.getMinutes()));
			newChartObj2.push(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), dateObj.getHours(), dateObj.getMinutes()));
			if ((currentRow.btc_gains == null) || (currentRow.btc_gains == "") || (currentRow.btc_gains == "null") || (currentRow.btc_gains == "NULL")) {
				currentRow.btc_gains = 0;
			}
			newChartObj.push(Number(currentRow.btc_gains));
			newChartObj2.push(Number(currentRow.btc_total_balance));
			if (responseData.investments_charts[currentRow.id]._previousRow != null) {
				var currentDate = new Date(currentRow.last_update);
				currentDate.setSeconds(0);
				currentDate.setMilliseconds(0);
				var previousDate = new Date(responseData.investments_charts[currentRow.id]._previousRow.last_update);
				previousDate.setSeconds(0);
				previousDate.setMilliseconds(0);
				if (currentDate.valueOf() == previousDate.valueOf()) {
					//include only the most recent data point when date/time are the same as previous one
					currentGainsData.pop();
					currentGainsData.push(newChartObj);
					currentTotalsData.pop();
					currentTotalsData.push(newChartObj2);
				} else {
					currentGainsData.push(newChartObj);
					currentTotalsData.push(newChartObj2);
				}
			} else {
				currentGainsData.push(newChartObj);
				currentTotalsData.push(newChartObj2);
			}
			responseData.investments_charts[currentRow.id]._previousRow = currentRow;
		}
		if (currentRow != null) {
			delete responseData.investments_charts[currentRow.id]._previousRow;
		}
	}
	if (requestData.params["jackpots"] == true) {
		var jackpotsQueryResult = yield db.query("SELECT * FROM `gaming`.`jackpots`", generator);		
		if (jackpotsQueryResult.error != null) {
			trace ("Database error on rpc_getInvestmentStats: "+jackpotsQueryResult.error);
			trace ("   Request ID: "+requestData.id);
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
			return;
		}
		responseData.jackpots = new Array();
		for (count=0; count < jackpotsQueryResult.rows.length; count++) {
			var jackpotObj =new Object();
			jackpotObj.id = jackpotsQueryResult.rows[count].jackpot_id;
			jackpotObj.bet_multiplier = jackpotsQueryResult.rows[count].bet_multiplier;
			jackpotObj.btc = jackpotsQueryResult.rows[count].btc_total;
			jackpotObj.btc_base = jackpotsQueryResult.rows[count].btc_base;
			jackpotObj.timestamp = jackpotsQueryResult.rows[count].last_update;
			responseData.jackpots.push (jackpotObj);
		}
	}
	if (requestData.params["rake"] == true) {
		var investmentTxsQuerySQL = "SELECT * FROM `gaming`.`investment_txs` WHERE `account`=\"RAKE_ACCOUNT\" ORDER BY `last_update` DESC LIMIT 1";				
		var investmentTxsQueryResult = yield db.query(investmentTxsQuerySQL, generator);		
		if (investmentTxsQueryResult.error != null) {
			trace ("Database error on rpc_getInvestmentStats: "+investmentTxsQueryResult.error);
			trace ("   Request ID: "+requestData.id);
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
			return;
		}
		responseData.rake = new Array();
		if ((investmentTxsQueryResult["rows"] != null) && (investmentTxsQueryResult["rows"] != undefined)) {
			if (investmentTxsQueryResult.rows.length > 0) {
				investmentTxsQueryResult.rows[0].investments = JSON.parse(investmentTxsQueryResult.rows[0].investments);
				responseData.rake.push(investmentTxsQueryResult.rows[0]); //only return the latest row for the rake account
			}
		}
	}
	global.assertAnyValue("NaN", "0", responseData);
	replyResult(postData, requestObj, responseObj, batchResponses, responseData);	
}
exports.rpc_getInvestmentStats = rpc_getInvestmentStats;