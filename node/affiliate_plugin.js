require("./db_info.js"); //global database info
var db = require("./db.js"); //database connectivity
var serverConfig = require("./game_server_config.js"); //game server global config
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
var actions = new Array(); //affiliate actions, usually as retrieved from the affiliate_actions table at startup
const PAP = require ("./portable_account_plugin.js"); //Portable Account Plugin

var trace = function(msg){console.log("   "+msg);}; //trace function (formatted console.log output); should be replaced when "start" is invoked

exports.pluginInfo = {
	"name":"Affiliate Plugin",
	"description":"Plugin to manage affiliate / referral credits",
	"version":"1.0",
	"rpc":[
		{
			external : "getAffiliateLink",
			internal : "rpc_getAffiliateLink"
		},
		{
			external : "getAffiliateInfo",
			internal : "rpc_getAffiliateInfo"
		},
		{
			external : "getReferralInfo",
			internal : "rpc_getReferralInfo"
		}		
	],
	"dbschema":{
		"affiliates":{
				"index":{"primary_key":true},
				"id":"VARCHAR(1024) COMMENT 'The unique ID of the affiliate'",
				"account":"VARCHAR(1024) COMMENT 'The Bitcoin account of the associated affiliate'",
				"name":"VARCHAR(2048) COMMENT 'The affiliate full name'",
				"email":"VARCHAR(2048) COMMENT 'The affiliate email address'",
				"balance":"JSON COMMENT 'The affiliate current balance'",
				"last_update":"TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'The date and time that the row was last updated'"
			},
			"affiliate_actions":{
				"index":{"primary_key":true},
				"name":"VARCHAR(1024) COMMENT 'The name of the affiliate action'",
				"description":"VARCHAR(2048) COMMENT 'A brief description of the affiliate action'",
				"trigger":"VARCHAR(1024) COMMENT 'The RPC function that triggers the affiliate action'",
				"script":"TEXT COMMENT 'A JavaScript snippet to apply when the affiliate action is triggered'",
				"last_update":"TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'The date and time that the row was last updated'"
			}
	},
	"onInstallCallback":null,
	"activeInstalls":0,
	"_manager":null
}

// ---- RPC filters ----

var RPC_newAccount_gen = function *(requestData, parentGenerator) {	
	var generator = yield;
	if ((requestData.params["affiliateID"] != null) && (requestData.params["affiliateID"] != undefined) 
		&& (requestData.params["affiliateID"] != "") && (requestData.params["affiliateID"] != "NULL")) {
		var affiliateQueryResult = yield getAffiliateInfo(generator, requestData.params.affiliateID);
	} else {
		affiliateQueryResult = null;
	}	
	if ((affiliateQueryResult == undefined) || (affiliateQueryResult == null)) {
		requestData.affiliateID = null;
	} else {
		if (affiliateQueryResult["error"] != null) {
			requestData.params.affiliateID = null;
			setTimeout(function() {parentGenerator.next({"code":serverConfig.JSONRPC_SQL_ERROR,"message":"There was an error retrieving the affiliate information."});},1);
			return;
		}		
		if (affiliateQueryResult.rows.length > 0) {
			var affiliateInfo = affiliateQueryResult.rows[0]; //use the query result row for the affiliate
			requestData.params.affiliateID = affiliateInfo.id;			
		} else {
			requestData.params.affiliateID = null;
		}
	}	
	setTimeout(function() {parentGenerator.next(null);},1);
}
exports.RPC_newAccountGen = RPC_newAccount_gen;

function getActionTriggerRow(trigger) {
	for (var count=0; count<actions.length; count++) {
		if (actions[count].trigger == trigger) {
			return (actions[count]);
		}
	}
	return (null);
}

var RPC_jackpot_gen = function *(accountQueryResult, requestData, betInfoObj, parentGenerator) {	
	var generator = yield;
	var affiliateID = accountQueryResult.rows[0].affiliate;
	if ((affiliateID == undefined) || (affiliateID == "") || (affiliateID == "NULL")) {
		affiliateID = null;
	}
	if (affiliateID == null) {
		trace ("   No associated affiliate found for which to calculate credits / deductions.");
	} else {
		trace ("   Calculating affiliate credits / deductions for: "+ affiliateID);
		//var affiliateQueryResult = yield db.query("SELECT * FROM `gaming`.`affiliates` WHERE `id`=\""+affiliateID+"\" LIMIT 1", generator);	
		var affiliateQueryResult = yield db.query("SELECT * FROM `gaming`.`affiliates` WHERE `id`=\""+affiliateID+"\" ORDER BY `last_update` DESC LIMIT 1", generator);
		if (affiliateQueryResult.error != null) {
			trace ("Database error #1 on RPC_jackpot_gen: "+affiliateQueryResult.error);
			trace ("   Request ID: "+requestData.id);
			parentGenerator.next({"code":serverConfig.JSONRPC_SQL_ERROR, "message":"The database returned an error."});
			return;
		}
		if (affiliateQueryResult.rows.length > 0) {
			try {
				var affiliateBalance = JSON.parse(affiliateQueryResult.rows[0].balance);
			} catch (err) {
				affiliateBalance = new Object();
			}
			if ((affiliateBalance["btc"] == null) || (affiliateBalance["btc"] == undefined) || (affiliateBalance["btc"] == "")) {
				affiliateBalance.btc = "0";
			}
			var affiliate_balance_btc = new BigNumber(affiliateBalance.btc);
			var affiliate_balance_btc_pre = new BigNumber(affiliateBalance.btc);
			var bet_btc = new BigNumber(betInfoObj.btc);
			var bet_tokens = new BigNumber(betInfoObj.tokens);
			var tokens_per_btc = serverConfig.tokensPerBTC;	
			global.logTx("Updating credit for affiliate: "+affiliateID);
			global.logTx("   Pre-script affiliate balance in Bitcoin (affiliate_balance_btc): "+affiliate_balance_btc.toString(10));
			global.logTx("   Pre-script bet amount in Bitcoin (bet_btc): "+bet_btc.toString(10));
			global.logTx("   Pre-script bet amount in tokens (bet_tokens): "+bet_tokens.toString(10));
			global.logTx("   Pre-script tokens-per-Bitcoin multiplier (tokens_per_btc): "+tokens_per_btc.toString(10));
			global.logTx("   --- SCRIPT ---");
			var actionRow = getActionTriggerRow("jackpot");
			var script = null;
			if (actionRow != null) {
				script = actionRow.script;
			}
			try {
				if (script != null) {
					eval(script);
				}
			} catch (err) {
				trace (err);
			}
			var affiliate_balance_btc_delta = affiliate_balance_btc.minus(affiliate_balance_btc_pre);
			betInfoObj.btc = bet_btc.toString(10);
			betInfoObj.tokens = bet_tokens.toString(10);
			affiliateBalance.btc = affiliate_balance_btc.toString(10);
			if ((affiliateBalance["contributions"] == null) || (affiliateBalance["contributions"] == undefined) || (affiliateBalance["contributions"] == "")) {
				affiliateBalance.contributions = new Object();
			}
			var contributionsObj = affiliateBalance.contributions;
			var contribAccount = requestData.params.account;
			if ((contributionsObj[contribAccount] == null) || (contributionsObj[contribAccount] == undefined) || (contributionsObj[contribAccount] == "")) {
				contributionsObj[contribAccount] = new Object();
			}
			if ((contributionsObj[contribAccount]["btc"] == null) || (contributionsObj[contribAccount]["btc"] == undefined) || (contributionsObj[contribAccount]["btc"] == "")) {
				contributionsObj[contribAccount]["btc"] = "0";
			}
			if ((contributionsObj[contribAccount]["btc_total"] == null) || (contributionsObj[contribAccount]["btc_total"] == undefined) || (contributionsObj[contribAccount]["btc_total"] == "")) {
				contributionsObj[contribAccount]["btc_total"] = "0";
			}
			var currentContributionAmount = new BigNumber(contributionsObj[contribAccount].btc);
			var currentTotalContributionAmount = new BigNumber(contributionsObj[contribAccount].btc_total);
			currentTotalContributionAmount = currentTotalContributionAmount.plus(affiliate_balance_btc_delta);
			contributionsObj[contribAccount].btc_total = currentTotalContributionAmount.toString(10);
			contributionsObj[contribAccount].btc = affiliate_balance_btc_delta.toString(10);
			global.logTx("   Post-script affiliate balance in Bitcoin (affiliate_balance_btc): "+affiliate_balance_btc.toString(10));
			global.logTx("   Post-script bet amount in Bitcoin (bet_btc): "+bet_btc.toString(10));
			global.logTx("   Post-script bet amount in tokens (bet_tokens): "+bet_tokens.toString(10));
			global.logTx("   Post-script tokens-per-Bitcoin multiplier (tokens_per_btc): "+tokens_per_btc.toString(10));
			var insertFields = "`id`,";		
			insertFields += "`account`,";		
			insertFields += "`name`,";
			insertFields += "`email`,";
			insertFields += "`balance`,";
			insertFields += "`last_update`";
			global.assertAnyValue("NaN", "0", affiliateBalance);
			var insertValues = "\""+affiliateID+"\",";		
			insertValues += "\""+affiliateQueryResult.rows[0].account+"\",";		
			insertValues += "\""+affiliateQueryResult.rows[0].name+"\",";			
			insertValues += "\""+affiliateQueryResult.rows[0].email+"\",";
			insertValues += "'"+JSON.stringify(affiliateBalance)+"',";
			insertValues += "NOW()";
			var insertSQL = "INSERT INTO `gaming`.`affiliates` ("+insertFields+") VALUES ("+insertValues+")";
			var affiliateUpdateResult = yield db.query(insertSQL, generator);
			if (affiliateUpdateResult.error != null) {
				trace ("Database error #2 on RPC_jackpot_gen: "+affiliateUpdateResult.error);
				trace ("   Request ID: "+requestData.id);
				global.logTx("   Couldn't update the database!");
				parentGenerator.next({"code":serverConfig.JSONRPC_SQL_ERROR, "message":"The database returned an error."});
				return;
			}
			trace ("Affiliate \""+affiliateID+"\" balance updated to: "+affiliateBalance.btc+" (BTC)");
		} else {
			trace ("No matching 'id' found in 'affiliates' table: \""+affiliateID+"\"");
		}
	}
	setTimeout(function() {parentGenerator.next(null);},1);
}
exports.RPC_jackpotGen = RPC_jackpot_gen;

var RPC_dividend_gen = function *(txRow, paramObject, parentGenerator) {	
	var generator = yield;	
	var accountQueryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `btc_account`=\""+txRow.account+"\" ORDER BY `index` DESC LIMIT 1", generator);	
	if (accountQueryResult.error != null) {
		trace ("Database error #1 on RPC_dividend_gen: "+accountQueryResult.error);		
		setTimeout(function() {parentGenerator.next({"code":serverConfig.JSONRPC_SQL_ERROR, "message":"The database returned an error."});},1);
		return;
	}
	if (accountQueryResult.rows.length == 0) {
		trace ("   No such account: "+txRow.account);		
		setTimeout(function() {parentGenerator.next({"code":serverConfig.JSONRPC_SQL_ERROR, "message":"No such account."});},1);
		return;
	}
	var affiliateID = accountQueryResult.rows[0]["affiliate"];
	if ((affiliateID == undefined) || (affiliateID == null) || (affiliateID == "") || (affiliateID == "NULL")) {
		trace ("   No affiliate set for account.");
		setTimeout(function() {parentGenerator.next(null);},1);
		return;
	}
	var affiliateQueryResult = yield db.query("SELECT * FROM `gaming`.`affiliates` WHERE `id`=\""+affiliateID+"\" ORDER BY  `last_update` DESC LIMIT 1", generator);	
	if (affiliateQueryResult.error != null) {
		trace ("Database error #2 on RPC_dividend_gen: "+affiliateQueryResult.error);
		setTimeout(function() {parentGenerator.next({"code":serverConfig.JSONRPC_SQL_ERROR, "message":"The database returned an error."});},1);
		return;
	}
	if (affiliateQueryResult.rows.length == 0) {
		trace ("   No such affiliate: "+affiliateID);		
		setTimeout(function() {parentGenerator.next(null);},1);
		return;
	}
	trace ("Applying affiliate dividend calculations to: "+affiliateQueryResult.rows[0].id);
	trace ("                                    Account: "+affiliateQueryResult.rows[0].account);
	if ((affiliateQueryResult.rows[0].balance == null) || (affiliateQueryResult.rows[0].balance == "NULL") || (affiliateQueryResult.rows[0].balance == "")) {
		affiliateQueryResult.rows[0].balance = "{}";
	}	
	try {
		var affiliateBalance = JSON.parse(affiliateQueryResult.rows[0].balance);
	} catch (err) {
		affiliateBalance = new Object();
	}
	if ((affiliateBalance["btc"] == null) || (affiliateBalance["btc"] == undefined) || (affiliateBalance["btc"] == "")) {
		affiliateBalance.btc = "0";
	}
	paramObject.affiliate_btc_balance = new BigNumber(affiliateBalance.btc);
	paramObject.affiliate_btc_credit = new BigNumber(0); 
	var actionRow = getActionTriggerRow("dividend");	
	var script = null;
	if (actionRow != null) {
		script = actionRow.script;
	}
	try {
		if (script != null) {
			with (paramObject) {
				eval(script);
			}
		}
	} catch (err) {
		trace (err);
	}
	trace ("   Investment affiliate credit: "+paramObject.affiliate_btc_credit);
	/*
	affiliateBalance.btc = paramObject.affiliate_btc_balance.toString(10);
	var insertFields = "`id`,";		
	insertFields += "`account`,";		
	insertFields += "`name`,";
	insertFields += "`email`,";
	insertFields += "`balance`,";
	insertFields += "`last_update`";
	global.assertAnyValue("NaN", "0", affiliateBalance);
	var insertValues = "\""+affiliateID+"\",";		
	insertValues += "\""+affiliateQueryResult.rows[0].account+"\",";		
	insertValues += "\""+affiliateQueryResult.rows[0].name+"\",";			
	insertValues += "\""+affiliateQueryResult.rows[0].email+"\",";
	insertValues += "'"+JSON.stringify(affiliateBalance)+"',";
	insertValues += "NOW()";
	var insertSQL = "INSERT INTO `gaming`.`affiliates` ("+insertFields+") VALUES ("+insertValues+")";
	var affiliateUpdateResult = yield db.query(insertSQL, generator);
	if (affiliateUpdateResult.error != null) {
		trace ("Database error #2 on RPC_dividend_gen: "+affiliateUpdateResult.error);		
		global.logTx("   Couldn't add record to the database!");
		parentGenerator.next({"code":serverConfig.JSONRPC_SQL_ERROR, "message":"The database returned an error."});
		return;
	}
	trace ("Affiliate \""+affiliateID+"\" balance updated to: "+affiliateBalance.btc+" (BTC)");
	*/
	setTimeout(function() {parentGenerator.next(null);},1);
}
exports.RPC_dividendGen = RPC_dividend_gen;

// ---- RPC methods ----

var rpc_getAffiliateLink = function* (postData, requestObj, responseObj, batchResponses, replyResult, replyError) {
	var generator = yield;
	var requestData = JSON.parse(postData);		
	var responseData = new Object();	
	var checkResult = exports.checkParameter(requestData, "account");
	if (checkResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, checkResult.code, checkResult.message);	
		return;
	}	
	var accountQueryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `btc_account`=\""+requestData.params.account+"\" ORDER BY `index` DESC LIMIT 1", generator);	
	if (accountQueryResult.error != null) {
		trace ("Database error #1 on rpc_getAffiliateLink: "+accountQueryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
		return;
	}
	if (accountQueryResult.rows.length == 0) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_NO_RESULTS, "No matching account.");
		return;
	}	
	var affiliateQueryResult = yield db.query("SELECT * FROM `gaming`.`affiliates` WHERE `account`=\""+requestData.params.account+"\" ORDER BY `last_update` DESC LIMIT 1", generator);
	if (affiliateQueryResult.error != null) {
		trace ("Database error #2 on rpc_getAffiliateLink: "+affiliateQueryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
		return;
	}
	var accountEmail = "";
	if ((accountQueryResult.rows[0]["email"] != null) && (accountQueryResult.rows[0]["email"] != undefined) && (accountQueryResult.rows[0]["email"] != "NULL")) {
		accountEmail = accountQueryResult.rows[0].email;
	}
	responseData.account = requestData.params.account;	
	if (affiliateQueryResult.rows.length == 0) {
		//create new affiliate info
		var hash = crypto.createHash('sha256');
		hash.update(responseData.account); //just use hash of account address for now
		var hashDigest = hash.digest('hex');
		responseData.affiliateID = hashDigest;
		var insertFields = "(";
		insertFields += "`id`,";
		insertFields += "`account`,";
		insertFields += "`name`,";
		insertFields += "`email`,"
		insertFields += "`balance`,";
		insertFields += "`last_update`";
		insertFields += ")";
		var insertValues = "("
		insertValues += "\""+responseData.affiliateID+"\","; 
		insertValues += "\""+responseData.account+"\","; 
		insertValues += "\"\",";
		insertValues += "\""+accountEmail+"\",";
		insertValues += "\"{}\",";
		insertValues += "NOW()";
		insertValues += ")";
		var queryResult = yield db.query("INSERT INTO `gaming`.`affiliates` "+insertFields+" VALUES "+insertValues, generator);	
		if (queryResult.error != null) {
			trace ("Database error #3 on rpc_getAffiliateLink: "+queryResult.error);		
			trace ("   Request ID: "+requestData.id);
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was an error creating a new account address.");
			return;
		}
	} else {
		//return existing affiliate info
		responseData.affiliateID = affiliateQueryResult.rows[0].id;
	}
	responseData.url = serverConfig.rootWebURL + "?af="+responseData.affiliateID;
	replyResult(postData, requestObj, responseObj, batchResponses, responseData);	
}
exports.rpc_getAffiliateLink = rpc_getAffiliateLink;

var rpc_getAffiliateInfo = function* (postData, requestObj, responseObj, batchResponses, replyResult, replyError) {
	var generator = yield;
	var requestData = JSON.parse(postData);		
	var responseData = new Object();	
	var checkResult = exports.checkParameter(requestData, "affiliateID");
	if (checkResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, checkResult.code, checkResult.message);	
		return;
	}
	if ((requestData.params["limit"] != null) && (requestData.params["limit"] != undefined) && (requestData.params["limit"] != "")) {
		var limit = requestData.params.limit;
	} else {
		limit = {"num":20}; //default limit (most recent 20 items)
	}
	var dateLimit = false;
	if ((limit["startDate"] != undefined) && (limit["startDate"] != null) && (limit["startDate"] != null)) {
		if ((limit["endDate"] == null) || (limit["endDate"] == undefined) || (limit["endDate"] == "")) {
			var now = new Date();
			limit.endDate = getMySQLTimeStamp(now);
		} else {
			limit.endDate = new Date(limit.endDate);
			limit.endDate = getMySQLTimeStamp(limit.endDate);
		}
		limit.startDate = new Date(limit.startDate);
		limit.startDate = getMySQLTimeStamp(limit.startDate);
		dateLimit = true;
	}
	if (dateLimit) {
		affiliateQueryResult = yield db.query("SELECT * FROM `gaming`.`affiliates` WHERE `id`=\""+requestData.params.affiliateID+"\" AND `last_update` BETWEEN \""+limit.startDate+"\" AND \""+limit.endDate+"\" ORDER BY `last_update` DESC LIMIT "+String(limit.num), generator);
	} else {
		affiliateQueryResult = yield db.query("SELECT * FROM `gaming`.`affiliates` WHERE `id`=\""+requestData.params.affiliateID+"\" ORDER BY `last_update` DESC LIMIT "+String(limit.num), generator);
	}
	if (affiliateQueryResult.error != null) {
		trace ("Database error #1 on rpc_getAffiliateInfo: "+affiliateQueryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database query returned an error.");
		return;
	}
	var resultRows = affiliateQueryResult.rows;
	for (var count=0; count < resultRows.length; count++) {
		//strip unnecessary information from result
		delete resultRows[count].index;
		delete resultRows[count].account;
		delete resultRows[count].id;
		delete resultRows[count].name;
		delete resultRows[count].email;
		resultRows[count].balance = JSON.parse(resultRows[count].balance);
		if (typeof(resultRows[count].balance["contributions"]) == "object") {
			var newContrObj = new Object();
			for (var account in resultRows[count].balance.contributions) {
				//hash account numbers to preserve privacy
				var hash = crypto.createHash('sha1');
				hash.update(account);
				var accountHash =  hash.digest('hex');
				newContrObj[accountHash] = resultRows[count].balance.contributions[account];
			}
			resultRows[count].balance.contributions = newContrObj;
		}
	}
	responseData.info = resultRows;
	replyResult(postData, requestObj, responseObj, batchResponses, responseData);	
}
exports.rpc_getAffiliateInfo = rpc_getAffiliateInfo;

var rpc_getReferralInfo = function* (postData, requestObj, responseObj, batchResponses, replyResult, replyError) {
	var generator = yield;
	var requestData = JSON.parse(postData);		
	var responseData = new Object();	
	var checkResult = exports.checkParameter(requestData, "affiliateID");
	var checkResult = exports.checkParameter(requestData, "referral");
	if (checkResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, checkResult.code, checkResult.message);	
		return;
	}
	if ((requestData.params["limit"] != null) && (requestData.params["limit"] != undefined) && (requestData.params["limit"] != "")) {
		var limit = requestData.params.limit;
	} else {
		limit = {"num":20}; //default limit (most recent 20 items)
	}
	var dateLimit = false;
	if ((limit["startDate"] != undefined) && (limit["startDate"] != null) && (limit["startDate"] != null)) {
		if ((limit["endDate"] == null) || (limit["endDate"] == undefined) || (limit["endDate"] == "")) {
			var now = new Date();
			limit.endDate = getMySQLTimeStamp(now);
		} else {
			limit.endDate = new Date(limit.endDate);
			limit.endDate = getMySQLTimeStamp(limit.endDate);
		}
		limit.startDate = new Date(limit.startDate);
		limit.startDate = getMySQLTimeStamp(limit.startDate);
		dateLimit = true;
	}
	if (dateLimit) {
		affiliateQueryResult = yield db.query("SELECT * FROM `gaming`.`affiliates` WHERE `id`=\""+requestData.params.affiliateID+"\" AND `last_update` BETWEEN \""+limit.startDate+"\" AND \""+limit.endDate+"\" ORDER BY `last_update` DESC LIMIT "+String(limit.num), generator);
	} else {
		affiliateQueryResult = yield db.query("SELECT * FROM `gaming`.`affiliates` WHERE `id`=\""+requestData.params.affiliateID+"\" ORDER BY `last_update` DESC LIMIT "+String(limit.num), generator);
	}
	if (affiliateQueryResult.error != null) {
		trace ("Database error #1 on rpc_getAffiliateInfo: "+affiliateQueryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database query returned an error.");
		return;
	}
	var resultRows = affiliateQueryResult.rows;
	var returnInfo = new Array();
	var currentContBTC = "";
	var currentContBTCTotal = "";
	for (var count=0; count < resultRows.length; count++) {
		//strip unnecessary information from result
		resultRows[count].balance = JSON.parse(resultRows[count].balance);
		if (typeof(resultRows[count].balance["contributions"]) == "object") {
			var newContrObj = new Object();
			for (var account in resultRows[count].balance.contributions) {
				//hash account numbers to preserve privacy
				var hash = crypto.createHash('sha1');
				hash.update(account);
				var accountHash =  hash.digest('hex');
				if (accountHash == requestData.params.referral) {
					var dataObj = new Object();
					dataObj.last_update = resultRows[count].last_update;
					dataObj.btc = resultRows[count].balance.contributions[account].btc;
					dataObj.btc_total = resultRows[count].balance.contributions[account].btc_total;
					if ((currentContBTC != dataObj.btc) || (currentContBTCTotal != dataObj.btc_total )) {
						//store only unique entries since historic data is carried over in each transaction
						returnInfo.push (dataObj);
					}
					currentContBTC = dataObj.btc;
					currentContBTCTotal = dataObj.btc_total;
				}
			}
		}
	}
	responseData.referral = requestData.params.referral;
	responseData.info = returnInfo;
	replyResult(postData, requestObj, responseObj, batchResponses, responseData);	
}
exports.rpc_getReferralInfo = rpc_getReferralInfo;

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
		connection.query("CREATE TABLE `"+databaseName+"`.`"+tableName, function(error, result, fields) {
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
		connection.query("CREATE TABLE `"+databaseName+"`.`"+tableName+"` "+primaryKeyObj.SQLInsert+"", function(error, result, fields) {
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
			console.log ("      Error creating column \""+columnName+"\" on table \"" + tableName + " \": "+error);
		}
		exports.onCreateColumn();
	});	
}

exports.onInstallComplete = () => {	
	exports.onInstallCallback (true, "Database successfully set up.");
}

// ---- UTILITY FUNCTIONS ----

exports.checkParameter = (requestData, param) => {
	if ((requestData["params"] == null) || (requestData["params"] == undefined)) {
		return ({"code":serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "message":"Required \"params\" not found in request."});		
	}
	if (requestData.params[param] == undefined) {		
		return ({"code":serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "message":"Required parameter \""+param+"\" not found in request."});		
	}
	return (null);
}

function getAffiliateInfo(generator, affiliateID) {
	db.query("SELECT * FROM `gaming`.`affiliates` WHERE `id`=\""+affiliateID+"\" LIMIT 1", generator);
}

/**
* Aggregates affiliate credits retreieved from the database, usually for a given time period.
*
* @param affiliateQueryResult The affiliate query result to produce aggregate information for. Query results MUST be stored in ascending temporal (date/time) order in
* order to correctly track credit changes over time.
*
* @return An object containing an 'affiliate' child object which contains name-value pairs for individual affiliates (by ID), and their associated aggregate credits (as strings), and
* a `total_btc` property containing the total aggregate credits for all affiliates, as a string. Null is returned if the `affiliateQueryResult` object can't be properly parsed.
*/
exports.aggregateAffiliateCredits = (affiliateQueryResult) => {
	if ((affiliateQueryResult["rows"] == null) || (affiliateQueryResult["rows"] == undefined) || (affiliateQueryResult["rows"] == "")) {
		return (null);
	}
	var returnObj = new Object();
	returnObj.affiliate = new Object();
	if (affiliateQueryResult.rows.length == 0) {
		returnObj.total_btc = "0";
		return (returnObj);
	}
	var historyObj = new Object(); //processing history for affiliates to prevent duplicate calculations
	for (var count=0; count < affiliateQueryResult.rows.length; count++) {		
		var currentRow = affiliateQueryResult.rows[count];
		var affiliateID = currentRow.id;
		var account = currentRow.account;
		var balanceObj = JSON.parse(currentRow.balance);
		addAffiliateCredits(affiliateID, balanceObj, historyObj, returnObj);
		if ((balanceObj["contributions"] != null) && (balanceObj["contributions"] != undefined) && (balanceObj["contributions"] != "")) {			
			historyObj[affiliateID] = balanceObj.contributions;						
		}		
	}
	var affiliatesTotal = new BigNumber("0");
	for (var affiliate in returnObj.affiliate) {		
		var currentAffiliateTotal = new BigNumber(returnObj.affiliate[affiliate]);
		affiliatesTotal = affiliatesTotal.plus(currentAffiliateTotal);
	}
	returnObj.total_btc = affiliatesTotal.toString(10);	
	return (returnObj);
}

var applyAffiliateGamePlayCredits = function* () {
	var generator = yield;
	var previousContrTotals = new Object();
	var accountCreditTotals = new Object();
	var affStartDateObj=new Date();
	affStartDateObj.setHours(affStartDateObj.getHours()-24); //24 hours prior to now
	var affEndDateObj=new Date(); //now
	var startPeriodAff = getMySQLTimeStamp(affStartDateObj);
	var endPeriodAff = getMySQLTimeStamp(affEndDateObj);
	var affiliateQuerySQL = "SELECT * FROM `gaming`.`affiliates` WHERE `last_update` BETWEEN \""+startPeriodAff+"\" AND \""+endPeriodAff+"\" ORDER BY `index` ASC";
	var affiliateQueryResult = yield db.query(affiliateQuerySQL, generator);
	for (var count = 0; count < affiliateQueryResult.rows.length; count++) {
		var currentAffiliateRow = affiliateQueryResult.rows[count];
		var targetAccount = currentAffiliateRow.account;
		var last_update = new Date(currentAffiliateRow.last_update);
		var balanceObj = JSON.parse(currentAffiliateRow.balance);
		var total_contributions = new BigNumber(0);
		for (var contributorAccount in balanceObj.contributions) {
			var currentContribution = balanceObj.contributions[contributorAccount];
			if (previousContrTotals[contributorAccount] != currentContribution.btc_total) {
				if ((accountCreditTotals[targetAccount] == null) || (accountCreditTotals[targetAccount] == undefined)) {
					accountCreditTotals[targetAccount] = new BigNumber(0);
				}
				accountCreditTotals[targetAccount] = accountCreditTotals[targetAccount].plus(new BigNumber(currentContribution.btc)); //add the current contribution
			}
			previousContrTotals[contributorAccount] = currentContribution.btc_total;
		}
	}
	for (var account in accountCreditTotals) {
		var accountQuerySQL = "SELECT * FROM `gaming`.`accounts` WHERE `btc_account`=\""+account+"\" ORDER BY `index` DESC LIMIT 1";
		var accountQueryResult = yield db.query(accountQuerySQL, generator);
		var currentAccountRow = accountQueryResult.rows[0]; //should exist!
		var current_available_balance_btc = new BigNumber(currentAccountRow.btc_balance_available);
		trace ("Applying affiliate game credit to account: "+account+" with "+accountCreditTotals[account].toString(10));
		trace ("   Current account balance: "+current_available_balance_btc.toString(10));
		current_available_balance_btc = current_available_balance_btc.plus(accountCreditTotals[account]);
		trace ("   Updated account balance: "+current_available_balance_btc.toString(10));
		var dbUpdates = "`btc_balance_available`=\""+current_available_balance_btc.toString(10)+"\",";
		dbUpdates += "`last_login`=NOW(),";	
		dbUpdates += "`last_deposit_check`=NOW()";	
		//update gaming.accounts
		var txInfo = new Object();
		txInfo.type = "affiliate_credit";
		txInfo.subType = "game";
		txInfo.info = new Object();
		txInfo.info.btc = accountCreditTotals[targetAccount].toString(10);
		txInfo.info.btc_total = accountCreditTotals[account].toString(10);
		txInfo.info.btc_balance = current_available_balance_btc.toString(10);
		var accountUpdateResult = yield global.updateAccount(accountQueryResult, dbUpdates, txInfo, generator);
		if (accountUpdateResult.error != null) {
			trace ("Database error on applyAffiliateGamePlayCredits: "+accountUpdateResult.error);
		}
	}
}
exports.applyAffiliateGamePlayCredits = applyAffiliateGamePlayCredits;

/**
* @param account The affiliate account / address -- or the address providing the credit. This will be cross-referenced to determine what parent account, if any, to apply the credit to.
* @param creditAmount The amount to credit to the affiliate's parent account.
* @param investmentInfo Info object (result row) containing information about the investment being applied.
*/
var applyAffiliateInvestmentCredits = function* (account, creditAmount, investmentInfo) {
	var generator = yield;
	//look up affiliate account to determine registered affiliate id (if any)
	var accountQuerySQL = "SELECT * FROM `gaming`.`accounts` WHERE `btc_account`=\""+account+"\" ORDER BY `index` DESC LIMIT 1";
	var accountQueryResult = yield db.query(accountQuerySQL, generator);
	var currentAccountRow = accountQueryResult.rows[0];
	if ((currentAccountRow == null) || (currentAccountRow == undefined)) {
		trace ("Affiliate account \""+account+"\" not found.");
		return;
	}
	if ((currentAccountRow["affiliate"] == "") || (currentAccountRow["affiliate"] == null) || (currentAccountRow["affiliate"] == "NULL") || (currentAccountRow["affiliate"] == undefined)) {
		trace ("Affiliate account \""+account+"\" has no referrer.");
		return;
	}
	//look up affiliate id in the affiliates from above step
	var affiliateQuerySQL = "SELECT * FROM `gaming`.`affiliates` WHERE `id`=\""+currentAccountRow.affiliate+"\" ORDER BY `index` DESC LIMIT 1";
	var affiliateQueryResult = yield db.query(affiliateQuerySQL, generator);
	var currentAffiliateRow = affiliateQueryResult.rows[0];
	if ((currentAffiliateRow == "") || (currentAffiliateRow == null) || (currentAffiliateRow == "NULL")) {
		trace ("Affiliate \""+currentAccountRow.affiliate+"\" not found. Can't apply credit of "+creditAmount.toString(10)+" BTC");
		return;
	}
	//look up referrer (affiliate parent) account from affiliate row in step above
	accountQuerySQL = "SELECT * FROM `gaming`.`accounts` WHERE `btc_account`=\""+currentAffiliateRow.account+"\" ORDER BY `index` DESC LIMIT 1";
	accountQueryResult = yield db.query(accountQuerySQL, generator);
	var currentAccountRow = accountQueryResult.rows[0];
	if (accountQueryResult.rows.length == 0) {
		trace ("Affiliate parent account (referer) not found: "+currentAffiliateRow.account);
		return;
	}
	var current_available_balance_btc = new BigNumber(currentAccountRow.btc_balance_available);
	trace ("Source affiliate account: "+account);
	trace ("Crediting referrer account: "+currentAffiliateRow.account+" with "+creditAmount.toString(10)+" BTC");
	trace ("   Current referrer account balance: "+current_available_balance_btc.toString(10));
	current_available_balance_btc = current_available_balance_btc.plus(creditAmount);
	trace ("   Updated referrer account balance: "+current_available_balance_btc.toString(10));
	var dbUpdates = "`btc_balance_available`=\""+current_available_balance_btc.toString(10)+"\",";
	dbUpdates += "`last_login`=NOW(),";	
	dbUpdates += "`last_deposit_check`=NOW()";	
	//update gaming.accounts
	var txInfo = new Object();
	txInfo.type = "affiliate_credit";
	txInfo.subType = "investment";
	txInfo.info = new Object();
	txInfo.info.investment_id = investmentInfo.id;
	txInfo.info.investment_name = investmentInfo.name;
	txInfo.info.btc = creditAmount.toString(10);
	txInfo.info.btc_total = creditAmount.toString(10);
	txInfo.info.btc_balance = current_available_balance_btc.toString(10);
	//affiliateQueryResult instead of accountQueryResult!
	var accountUpdateResult = yield global.updateAccount(accountQueryResult, dbUpdates, txInfo, generator);
	if (accountUpdateResult.error != null) {
		trace ("Database error on applyAffiliateInvestmentCredits: "+accountUpdateResult.error);
	}
}
exports.applyAffiliateInvestmentCredits = applyAffiliateInvestmentCredits;

/**
* Adds unique credits for an affiliate from the current row.
*/
function addAffiliateCredits (affiliateID, balanceObj, historyObj, returnObj) {
	if ((balanceObj["contributions"] == null) || (balanceObj["contributions"] == undefined) || (balanceObj["contributions"] == "")) {
		return;
	}
	for (var referral in balanceObj.contributions) {
		var currentRefEntry = balanceObj.contributions[referral];				
		var previousRefEntry = getReferralInfo(affiliateID, referral, historyObj);		
		if ((returnObj.affiliate[affiliateID] == undefined) || (returnObj.affiliate[affiliateID] == null) || (returnObj.affiliate[affiliateID] == "")) {
			returnObj.affiliate[affiliateID] = "0";
		}
		if (previousRefEntry != null) {
			//only add current entry if it's different from previous entry, if one exists
			if ((currentRefEntry.btc != previousRefEntry.btc) || (currentRefEntry.btc_total != previousRefEntry.btc_total)) {
				var currentRefBTC = new BigNumber(returnObj.affiliate[affiliateID]);
				var entryRefBTC = new BigNumber(currentRefEntry.btc);				
				returnObj.affiliate[affiliateID] = currentRefBTC.plus(entryRefBTC).toString(10);
			}
		} else {
			currentRefBTC = new BigNumber(returnObj.affiliate[affiliateID]);
			entryRefBTC = new BigNumber(currentRefEntry.btc);			
			returnObj.affiliate[affiliateID] = currentRefBTC.plus(entryRefBTC).toString(10);
		}
	}
}

/**
* Gets a specific referral contribution object from the current history.
*/
function getReferralInfo(affiliateID, referral, historyObj) {
	if ((historyObj[affiliateID] == null) || (historyObj[affiliateID] == undefined) || (historyObj[affiliateID] == "")) {
		return (null);
	}	
	if ((historyObj[affiliateID][referral] == null) || (historyObj[affiliateID][referral] == undefined) || (historyObj[affiliateID][referral] == "")) {
		return (null);
	}	
	return (historyObj[affiliateID][referral]);
}

/**
* Loads and parses leaderboard data from the database. Should only be run at startup as this function parses through MANY rows.
*/
function *loadLeaderboardData() {
	trace ("Loading affiliates leaderboard data...");
	var generator = yield;
	var queryResult = yield db.query("SELECT * FROM `gaming`.`affiliates`", generator);
	if (queryResult.error == null) {
		for (var count=0; count < queryResult.rows.length; count++) {
			var currentResult = queryResult.rows[count];
			try {
				if (currentResult != null) {
					if ((currentResult["balance"] != null) && (currentResult["balance"] != undefined)) {
						currentResult.balance = JSON.parse(currentResult["balance"]);
						if ((global.leaderboardData["affiliate"] == null) || (global.leaderboardData["affiliate"] == undefined)) {
							global.leaderboardData["affiliate"] = new Object();
						}
						if ((global.leaderboardData.affiliate["id"] == undefined) || (global.leaderboardData.affiliate["id"] == "null") || (global.leaderboardData.affiliate["btc"] == "")) {
							global.leaderboardData.affiliate.id = null;
						}
						if ((global.leaderboardData.affiliate["btc"] == null) || (global.leaderboardData.affiliate["btc"] == undefined) || (global.leaderboardData.affiliate["btc"] == "null") || (global.leaderboardData.affiliate["btc"] == "")) {
							global.leaderboardData.affiliate.btc = "0";
						}
						if ((currentResult.balance["btc"] == null) || (currentResult.balance["btc"] == undefined) || (currentResult.balance["btc"] == "") || (currentResult.balance["btc"] == "null")) {
							currentResult.balance["btc"] = "0";
						}
						var currentHighestAffiliateBalance = new BigNumber(global.leaderboardData.affiliate.btc);
						var currentAffiliateBalance = new BigNumber(currentResult.balance.btc);
						if (currentAffiliateBalance.greaterThan(currentHighestAffiliateBalance)) {
							global.leaderboardData.affiliate.btc = currentResult.balance.btc;
							global.leaderboardData.affiliate.id = currentResult.id;
						}
					}
				}
			} catch (err) {
			}
		}
	}
	trace ("Affiliates leaderboard data loaded and parsed.");
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
		trace ("Affiliate plugin requires Portable Account Plugin version 1.1 (minimum)! Some functions may fail.");
	}
	db.query("SELECT * FROM `gaming`.`affiliate_actions`", exports.onLoadActions);
	trace ("   Importing affiliate action definitions from database...");	
	trace (exports.pluginInfo.name+" v "+exports.pluginInfo.version+" started."); 
	var gen = loadLeaderboardData();
	gen.next();
	gen.next(gen);
}

exports.onLoadActions = (result, error) => {		
	if (result.error != null) {
		trace ("Database error on startup: "+result.error);				
	} else {
		actions =  result.rows;
	}
	trace ("   ...imported "+String(actions.length)+" affiliate action definition(s).");
}