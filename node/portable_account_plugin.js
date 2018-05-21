var db = require("./db.js");
require("./db_info.js"); //load global database info
var serverConfig = require("./game_server_config.js"); //game server global config
const crypto = require('crypto'); //used to hash passwords
var nodemailer = require('nodemailer'); //used for sending emails


var trace = function(msg){console.log("   "+msg);}; //trace function (formatted console.log output); should be replaced when "start" is invoked

exports.pluginInfo = {
	"name":"Portable Account Plugin",
	"description":"",
	"version":"1.2",
	"rpc":[
		{
			external : "updateAccountInfo",
			internal : "rpc_updateAccountInfo"
		},
		{
			external : "getAccountInfo",
			internal : "rpc_getAccountInfo"
		},
		{
			external: "authenticateAccount",
			internal: "rpc_authenticateAccount"
		},
		{
			external: "authenticateRequest",
			internal: "rpc_authenticateRequest"
		},
		{
			external: "requestPasswordReset",
			internal: "rpc_requestPasswordReset"
		},
		{
			external: "passwordReset",
			internal: "rpc_passwordReset"
		}
	],
	"dbschema":{
		"accounts":{
				"email":"VARCHAR(2048) COMMENT 'The email address for the user'",
				"password":"VARCHAR(256) COMMENT 'The hashed password for the user'",
				"last_login_attempt":"TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
				"locked":"BOOLEAN DEFAULT FALSE",
				"auth_status":"INT DEFAULT 0",
				"auth_code":"VARCHAR(256)"
			}
	},
	"onInstallCallback":null,
	"activeInstalls":0,
	"passwordResetInterval":10
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
	trace ("onInstallComplete!");
	exports.onInstallCallback (true, "Database successfully set up.");
}


exports.start = (traceFunc) => {
	trace = traceFunc;
	trace (exports.pluginInfo.name+" v "+exports.pluginInfo.version+" started.");
}

exports.RPC_login = (accountQueryResult, postData, parentGenerator) => {
	if ((accountQueryResult.rows[0].password == null) || (accountQueryResult.rows[0].password == "")) {
		var passwordSet = false;
	} else {
		passwordSet = true;
	}
	var requestData = JSON.parse(postData);
	if (passwordSet) {
		//password has been set
		if ((requestData.params["password"] == undefined) || (requestData.params["password"] == null) || (requestData.params["password"] == "")) {
			//password not supplied in parameters
			trace ("   Authentication error. Password not supplied.");
			return({"code":serverConfig.JSONRPC_AUTH_ERROR, "message":"Authentication error."});
		}
		var hash = crypto.createHash('sha256');
		hash.update(requestData.params.password);
		var hashDigest = hash.digest('hex');
		if (accountQueryResult.rows[0].password != hashDigest) {
			//passwords don't match
			trace ("   Authentication error. Password not valid.");
			return({"code":serverConfig.JSONRPC_AUTH_ERROR, "message":"Authentication error."});
		}
		var status2FA = exports.auth2FA(accountQueryResult, postData);
		if (status2FA < 0) {
			trace ("   2FA authentication error (unknown status).");
			return({"code":serverConfig.JSONRPC_ACCOUNT_ERROR, "message":"2-factor authentication error (unknown status)."});
		}
		if (status2FA == 1) {
			trace ("   2FA authentication error (verification incomplete).");
			return({"code":serverConfig.JSONRPC_ACCOUNT_ERROR, "message":"2-factor authentication error (verification incomplete)."});
		}
		//statuses 0 (not started) and 2 (completed) are valid
	} else {
		trace ("   No password set for account.");
		//no password has been set
	}
	return (null);
}

/**
* Returns true if the current user is authenticated: has a password set and has matched that password in the request.
*
* @param accountQueryResult MySQL query result object for the associated account.
* @param postData The POST data included with the request.
*
* Added in v1.1
*/
exports.authenticated = (accountQueryResult, postData) => {
	try {
		if ((accountQueryResult.rows[0].password == null) || (accountQueryResult.rows[0].password == "")) {
			return (false);
		}
		var requestData = JSON.parse(postData);
		if ((requestData.params["password"] == undefined) || (requestData.params["password"] == null) || (requestData.params["password"] == "")) {
			return (false);
		}
		var hash = crypto.createHash('sha256');
		hash.update(requestData.params.password);
		var hashDigest = hash.digest('hex');
		if (accountQueryResult.rows[0].password != hashDigest) {
			return (false);
		}
		var auth_status = parseInt(String(accountQueryResult.rows[0].auth_status));
		if (isNaN(auth_status)) {
			auth_status = 0;
		}
		if (auth_status == 1) {

		}
	} catch (err) {
		return (false);
	}
	return (true);
}

/**
* Returns the current user's 2FA status.
*
* @param accountQueryResult MySQL query result object for the associated account.
* @param postData The POST data included with the request.
*
* Added in v1.2
*
* @return -1: could not determine athentication status, 0: authentication not started, 1: in the process of being authenticated, 2: authenticated
*/
exports.auth2FA = (accountQueryResult, postData) => {
	try {
		if (accountQueryResult.rows[0]["auth_status"] == undefined) {
			//may not be supported, requires database upgrade
			return (-1);
		}
		if ((accountQueryResult.rows[0].auth_status == null) || (accountQueryResult.rows[0].auth_status == "NULL")) {
			accountQueryResult.rows[0].auth_status = 0;
		}
		var auth_status = parseInt(String(accountQueryResult.rows[0].auth_status));
		if (isNaN(auth_status)) {
			auth_status = 0;
		}
		switch (auth_status) {
			case 0: return (0); break;
			case 1: return (1); break;
			case 2: return (2); break;
			case 3: return (2); break;
			default: return (-1); break;
		}
	} catch (err) {
		return (-1);
	}
	return (0);
}

exports.sendEmail = (addressFrom, addressTo, subject, message, options) => {
	// console.log(process.versions); //quick way to see if latest version of Node is installed! (should be >7)
	//using sendmail (make sure it's installed first!)
	var transporter = nodemailer.createTransport({
		sendmail: true,
		newline: 'unix',
		path: '/usr/sbin/sendmail',
		args:["-f", addressFrom]
	});
	transporter.sendMail({
		from: addressFrom,
		to: addressTo,
		subject: subject,
		text: message
	}, (err, info) => {
		if (err == null) {
			trace("Email queued successfully:");
			trace(JSON.stringify(info.envelope));
			trace("Message ID: "+info.messageId);
		} else {
			trace("Email cannot be queued:");
			trace(err);
		}
	});
}

exports.checkParameter = (requestData, param) => {
	if ((requestData["params"] == null) || (requestData["params"] == undefined)) {
		return ({"code":serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "message":"Required \"params\" not found in request."});
	}
	if (requestData.params[param] == undefined) {
		return ({"code":serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "message":"Required parameter \""+param+"\" not found in request."});
	}
	return (null);
}

var rpc_updateAccountInfo = function* (postData, requestObj, responseObj, batchResponses, replyResult, replyError) {
	var generator = yield;
	var requestData = JSON.parse(postData);
	var responseData = new Object();
	var checkResult = exports.checkParameter(requestData, "account");
	if (checkResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, checkResult.code, checkResult.message);
		return;
	}
	var queryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `btc_account`=\""+requestData.params.account+"\" ORDER BY `index` DESC LIMIT 1", generator);
	if (queryResult.error != null) {
		trace ("Database error on rpc_updateAccountInfo: "+queryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
		return;
	}
	if (queryResult.rows.length == 0) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_NO_RESULTS, "No matching account.", requestData.params.account);
		return;
	}
	if ((queryResult.rows[0].password == null) || (queryResult.rows[0].password == undefined) || (queryResult.rows[0].password == "") || (queryResult.rows[0].password == "Null") || (queryResult.rows[0].password == "NULL")) {
		var passwordSet = false;
	} else {
		passwordSet = true;
	}
	if (passwordSet) {
		var checkResult = exports.checkParameter(requestData, "password");
		if (checkResult != null) {
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_AUTH_ERROR, "Authentication error.");
			return;
		}
		var hash = crypto.createHash('sha256');
		hash.update(requestData.params.password);
		var hashDigest = hash.digest('hex');
		if (queryResult.rows[0].password != hashDigest) {
			//passwords don't match
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_AUTH_ERROR, "Authentication error.");
			return;
		}
	} else {
		requestData.params.new_password = requestData.params.password;
	}
	var use2FAE = false;
	var auth_status = parseInt(String(queryResult.rows[0].auth_status));
	if (isNaN(auth_status)) {
		auth_status = 0;
	}
	if (requestData.params["use2FAE"] == true) {
		var _2FAEToken = generate2FAEToken(requestData.params.account, requestData.params.email);
		use2FAE = true;
	}
	var emailCheckResult = exports.checkParameter(requestData, "email");
	var newPasswordCheckResult = exports.checkParameter(requestData, "new_password");
	if ((emailCheckResult != null) && (newPasswordCheckResult != null)) {
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "Nothing to update.");
		return;
	}
	var dbUpdates = "";
	if (emailCheckResult == null) {
		if (requestData.params.email == "") {
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "Email can't be empy string.");
			return;
		}
		var emailQueryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `email`=\""+requestData.params.email+"\" ORDER BY `index` DESC LIMIT 1", generator);
		if (emailQueryResult.error != null) {
			trace ("Database error on rpc_updateAccountInfo: "+emailQueryResult.error);
			trace ("   Request ID: "+requestData.id);
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
			return;
		}
		if (emailQueryResult.rows.length > 0) {
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_ACTION_ERROR, "Email already registered.");
			return;
		}
		//optional email address update
		dbUpdates += "`email`=\""+requestData.params.email+"\",";
	}
	if (newPasswordCheckResult == null) {
		if (requestData.params.new_password == "") {
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_INVALID_PARAMS_ERROR, "New password can't be empy string.");
			return;
		}
		//optional password update
		var newHash = crypto.createHash('sha256');
		newHash.update(requestData.params.new_password);
		dbUpdates += "`password`=\""+newHash.digest("hex")+"\",";
	}
	if (use2FAE && (auth_status == 0)) {
		trace ("   Generated 2FAE token: "+_2FAEToken);
		trace ("   Sending authentication email to: "+requestData.params.email);
		var authURL = serverConfig.rootWebURL+"/?auth="+_2FAEToken;
		dbUpdates += "`auth_status`=1,`auth_code`=\""+_2FAEToken+"\",";
		exports.sendEmail("myfruitgame@gmail.com",
			requestData.params.email,
			"Please authenticate your Bitcoin Slot Machine account",
			"Please click on the following URL or paste it into your browser to complete your account authentication: "+authURL
		);
	}
	dbUpdates += "`last_login`=NOW(),`last_login_attempt`=NOW(),`locked`=FALSE";
	var txInfo = new Object(); //to be included with database insert
	txInfo.type = "account_update";
	var accountUpdateResult = yield global.updateAccount(queryResult, dbUpdates, txInfo, generator);
	replyResult(postData, requestObj, responseObj, batchResponses, "OK");
}
exports.rpc_updateAccountInfo = rpc_updateAccountInfo;

/**
* Generates a 2-Factor Authentication Email token. This token is generated bo hashing the concatenation of the paramaters
* plus the ISO date/time string of the current system time.
*
* @param accountAddress The account address to include in the 2FAE token.
* @param email The associated email address to include in the 2FAE token.
*
* @return A SHA256 hash of the concatenation of the account address, email, and current system time as an ISO string.
*/
function generate2FAEToken(accountAddress, email) {
	var newHash = crypto.createHash('sha256');
	var dateStr = new Date().toISOString();
	newHash.update(accountAddress + email + dateStr);
	return(newHash.digest("hex"));
}


var rpc_getAccountInfo = function* (postData, requestObj, responseObj, batchResponses, replyResult, replyError) {
	var generator = yield;
	trace ("rpc_getAccountInfo");
	var requestData = JSON.parse(postData);
	var responseData = new Object();
	var checkResult = exports.checkParameter(requestData, "email");
	if (checkResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, checkResult.code, checkResult.message);
		return;
	}
	var queryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `email`=\""+requestData.params.email+"\" ORDER BY `index` DESC LIMIT 1", generator);
	if (queryResult.error != null) {
		trace ("Database error on RPC_getAccountBalance: "+queryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
		return;
	}
	if (queryResult.rows.length == 0) {
		trace ("No matching address");
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_NO_RESULTS, "No matching email address.", requestData.params.email);
		return;
	}
	if ((queryResult.rows[0].password == null) || (queryResult.rows[0].password == undefined) || (queryResult.rows[0].password == "") || (queryResult.rows[0].password == "Null") || (queryResult.rows[0].password == "NULL")) {
		var passwordSet = false;
	} else {
		passwordSet = true;
	}
	if (passwordSet) {
		var checkResult = exports.checkParameter(requestData, "password");
		if (checkResult != null) {
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_AUTH_ERROR, "Authentication error.");
			return;
		}
		var hash = crypto.createHash('sha256');
		hash.update(requestData.params.password);
		var hashDigest = hash.digest('hex');
		if (queryResult.rows[0].password != hashDigest) {
			//passwords don't match
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_AUTH_ERROR, "Authentication error.");
			return;
		}
	} else {
		requestData.params.new_password = requestData.params.password;
	}
	var returnObj = new Object();
	returnObj.account = queryResult.rows[0].btc_account;
	returnObj.email = queryResult.rows[0].email;
	returnObj.last_login = queryResult.rows[0].last_login;
	replyResult(postData, requestObj, responseObj, batchResponses, returnObj);
}
exports.rpc_getAccountInfo = rpc_getAccountInfo;

var rpc_authenticateAccount = function* (postData, requestObj, responseObj, batchResponses, replyResult, replyError) {
	var generator = yield;
	trace ("rpc_authenticateAccount");
	var requestData = JSON.parse(postData);
	var responseData = new Object();
	var checkResult = exports.checkParameter(requestData, "account");
	var checkResult = exports.checkParameter(requestData, "auth");
	if (checkResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, checkResult.code, checkResult.message);
		return;
	}
	var queryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `btc_account`=\""+requestData.params.account+"\" ORDER BY `index` DESC LIMIT 1", generator);
	if (queryResult.error != null) {
		trace ("Database error on RPC_getAccountBalance: "+queryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
		return;
	}
	if (queryResult.rows.length == 0) {
		trace ("No matching address");
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_NO_RESULTS, "No matching account.", requestData.params.account);
		return;
	}
	var filterResult = exports.RPC_login(queryResult, postData, generator);
	if (filterResult != null) {
		//account errors like incomplete authentication are handled below!
		if (filterResult.code != serverConfig.JSONRPC_ACCOUNT_ERROR) {
			replyError(postData, requestObj, responseObj, batchResponses, filterResult.code, filterResult.message, requestData.params.account);
			return;
		}
	}
	if ((queryResult.rows[0]["auth_status"] == undefined) || (queryResult.rows[0]["auth_status"] == null) || (queryResult.rows[0]["auth_status"] == "") || (queryResult.rows[0]["auth_status"] == "NULL")) {
		queryResult.rows[0]["auth_status"] = 0;
	}
	var auth_status = parseInt(String(queryResult.rows[0].auth_status));
	if (isNaN(auth_status)) {
		auth_status = 0;
	}
	if (auth_status == 2) {
		trace ("Account already authenticated");
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_ACCOUNT_ERROR, "Account already authenticated.", requestData.params.account);
		return;
	}
	if (auth_status == 0) {
		trace ("2-Factor Authentication not enabled for account.");
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_ACCOUNT_ERROR, "2-Factor Authentication not enabled for account.", requestData.params.account);
		return;
	}
	var auth_code_db = queryResult.rows[0].auth_code;
	var auth_code_user = requestData.params.auth;
	if (auth_code_db == auth_code_user) {
		var dbUpdates = "`auth_code`=NULL,`auth_status`=2,`last_login`=NOW()";
		var txInfo = new Object();
		txInfo.type = "account_update";
		accountUpdateResult = yield global.updateAccount(queryResult, dbUpdates, txInfo, generator);
		if (accountUpdateResult.error != null) {
			trace ("Database error on rpc_authenticateAccount: "+accountUpdateResult.error);
			trace ("   Request ID: "+requestData.id);
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when updating the account.");
			return;
		}
		replyResult(postData, requestObj, responseObj, batchResponses, "OK");
	} else {
		trace ("Supplied 2-Factor Authentication code doesn't match stored one.");
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_ACCOUNT_ERROR, "2-Factor Authentication code does not match one for account.", requestData.params.account);
		return;
	}
}
exports.rpc_authenticateAccount = rpc_authenticateAccount;


var rpc_authenticateRequest = function* (postData, requestObj, responseObj, batchResponses, replyResult, replyError) {
	var generator = yield;
	trace ("rpc_authenticateRequest");
	var requestData = JSON.parse(postData);
	var responseData = new Object();
	var checkResult = exports.checkParameter(requestData, "account");
	if (checkResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, checkResult.code, checkResult.message);
		return;
	}
	var queryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `btc_account`=\""+requestData.params.account+"\" ORDER BY `index` DESC LIMIT 1", generator);
	if (queryResult.error != null) {
		trace ("Database error on rpc_authenticateRequest: "+queryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
		return;
	}
	if (queryResult.rows.length == 0) {
		trace ("No matching address");
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_NO_RESULTS, "No matching account.", requestData.params.account);
		return;
	}
	var filterResult = exports.RPC_login(queryResult, postData, generator);
	if (filterResult != null) {
		//account errors like incomplete authentication are handled below!
		if (filterResult.code != serverConfig.JSONRPC_ACCOUNT_ERROR) {
			replyError(postData, requestObj, responseObj, batchResponses, filterResult.code, filterResult.message, requestData.params.account);
			return;
		}
	}
	if ((queryResult.rows[0]["auth_status"] == undefined) || (queryResult.rows[0]["auth_status"] == null) || (queryResult.rows[0]["auth_status"] == "") || (queryResult.rows[0]["auth_status"] == "NULL")) {
		queryResult.rows[0]["auth_status"] = 0;
	}
	var auth_status = parseInt(String(queryResult.rows[0].auth_status));
	if (isNaN(auth_status)) {
		auth_status = 0;
	}
	if (auth_status == 2) {
		trace ("Account already authenticated");
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_ACCOUNT_ERROR, "Account already authenticated.", requestData.params.account);
		return;
	}
	if (auth_status == 0) {
		trace ("2-Factor Authentication not enabled for account.");
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_ACCOUNT_ERROR, "2-Factor Authentication not enabled for account.", requestData.params.account);
		return;
	}
	var authURL = serverConfig.rootWebURL+"/?auth="+queryResult.rows[0].auth_code;
	exports.sendEmail("myfruitgame@gmail.com",
			queryResult.rows[0].email,
			"(Resend) Please authenticate your Bitcoin Slot Machine account",
			"Please click on the following URL or paste it into your browser to complete your account authentication: "+authURL
		);
	replyResult(postData, requestObj, responseObj, batchResponses, "OK");
}
exports.rpc_authenticateRequest = rpc_authenticateRequest;

var rpc_requestPasswordReset = function* (postData, requestObj, responseObj, batchResponses, replyResult, replyError) {
	var generator = yield;
	var requestData = JSON.parse(postData);
	var responseData = new Object();
	var checkResult = exports.checkParameter(requestData, "email");
	if (checkResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, checkResult.code, checkResult.message);
		return;
	}
	var queryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `email`=\""+requestData.params.email+"\" ORDER BY `index` DESC LIMIT 1", generator);
	var lastResetQueryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `email`=\""+requestData.params.email+"\" AND `auth_status`=3 ORDER BY `index` DESC LIMIT 1", generator);
	if (queryResult.error != null) {
		trace ("Database error on rpc_requestPasswordReset: "+queryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
		return;
	}
	if (lastResetQueryResult.error == null) {
		if (lastResetQueryResult.rows.length > 0) {
			var lastPasswordResetObj = new Date(lastResetQueryResult.rows[0].last_login);
			var lastPasswordReset = lastPasswordResetObj.valueOf() + (exports.pluginInfo.passwordResetInterval * 60000);
			var resetDelta = (lastPasswordReset - Date.now()) / 60000;
			if (resetDelta > 0) {
				var errMsg = "Your must wait at least "+String(Math.ceil(resetDelta))+" ";
				if (resetDelta >= 2) {
					errMsg += "minutes ";
				} else {
					errMsg += "minute ";
				}
				errMsg += "before attempting another password reset.";
				replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_ACTION_ERROR, errMsg, {minutes:Math.ceil(resetDelta)});
				return;
			}
		}
	}
	if (queryResult.rows.length == 0) {
		trace ("No matching email address.");
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_NO_RESULTS, "No matching email address.", requestData.params.email);
		return;
	}
	if ((queryResult.rows[0]["auth_status"] == undefined) || (queryResult.rows[0]["auth_status"] == null) || (queryResult.rows[0]["auth_status"] == "") || (queryResult.rows[0]["auth_status"] == "NULL")) {
		queryResult.rows[0]["auth_status"] = 0;
	}
	var auth_status = parseInt(String(queryResult.rows[0].auth_status));
	if (isNaN(auth_status)) {
		auth_status = 0;
	}
	if (auth_status == 3) {
		trace ("Password request already in process.");
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_ACCOUNT_ERROR, "A password reset email has already been sent.");
		return;
	}
	if (auth_status == 0) {
		trace ("Email address not authenticated.");
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_ACCOUNT_ERROR, "The email address has not been authenticated.", requestData.params.email);
		return;
	}
	var resetCode = generate2FAEToken(queryResult.rows[0].btc_account, queryResult.rows[0].email);
	var resetURL = serverConfig.rootWebURL+"/?passreset="+resetCode;
	exports.sendEmail("myfruitgame@gmail.com",
		queryResult.rows[0].email,
		"Your password reset email",
		"Please click on the following URL to reset your password: "+resetURL
	);
	var returnObj = new Object();
	returnObj.resetURL = resetURL;
	returnObj.resetCode = resetCode;
	var dbUpdates = "`auth_code`=NULL,`auth_status`=3,`auth_code`=\""+resetCode+"\",`last_login`=NOW()";
	var txInfo = new Object();
	txInfo.type = "account_update";
	txInfo.subType = "password";
	accountUpdateResult = yield global.updateAccount(queryResult, dbUpdates, txInfo, generator);
	if (accountUpdateResult.error != null) {
		trace ("Database error on rpc_requestPasswordReset: "+accountUpdateResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when updating the account.");
		return;
	}
	replyResult(postData, requestObj, responseObj, batchResponses, returnObj);
}
exports.rpc_requestPasswordReset = rpc_requestPasswordReset;

var rpc_passwordReset = function* (postData, requestObj, responseObj, batchResponses, replyResult, replyError) {
	var generator = yield;
	var requestData = JSON.parse(postData);
	var responseData = new Object();
	var checkResult = exports.checkParameter(requestData, "email");
	if (checkResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, checkResult.code, checkResult.message);
		return;
	}
	checkResult = exports.checkParameter(requestData, "resetCode");
	if (checkResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, checkResult.code, checkResult.message);
		return;
	}
	checkResult = exports.checkParameter(requestData, "password");
	if (checkResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, checkResult.code, checkResult.message);
		return;
	}
	var currentPassword = null;
	var currentPasswordHash = null;
	try {
		if (typeof(requestData.params["currentPassword"]) == "string") {
			var currentPassword = new String(requestData.params.currentPassword);
			currentPassword = currentPassword.split(" ").join("");
			if (currentPassword != "") {
				var hash = crypto.createHash('sha256');
				hash.update(currentPassword);
				currentPasswordHash = hash.digest('hex');
			} else {
				currentPassword = null;
				currentPasswordHash = null;
			}
		}
	} catch (err) {
		currentPassword = null;
		currentPasswordHash = null;
	}
	if (checkResult != null) {
		replyError(postData, requestObj, responseObj, batchResponses, checkResult.code, checkResult.message);
		return;
	}
	if (currentPassword == null) {
		var queryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `email`=\""+requestData.params.email+"\" AND `auth_code`=\""+requestData.params.resetCode+"\" ORDER BY `index` DESC LIMIT 1", generator);
	} else {
		queryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `email`=\""+requestData.params.email+"\" ORDER BY `index` DESC LIMIT 1", generator);
	}
	if (queryResult.error != null) {
		trace ("Database error on rpc_passwordReset: "+queryResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "The database returned an error.");
		return;
	}
	if (queryResult.rows.length == 0) {
		trace ("No matching records.");
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_NO_RESULTS, "No email address with matching reset code found.", {"email":requestData.params.email, "resetCode":requestData.params.resetCode});
		return;
	}
	if (currentPassword != null) {
		if (currentPasswordHash != queryResult.rows[0].password) {
			replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_AUTH_ERROR, "Authentication error.");
			return;
		}
		trace ("Update passwords match. Ignoring existing reset state.");
	}
	if ((queryResult.rows[0]["auth_status"] == undefined) || (queryResult.rows[0]["auth_status"] == null) || (queryResult.rows[0]["auth_status"] == "") || (queryResult.rows[0]["auth_status"] == "NULL")) {
		queryResult.rows[0].auth_status = 0;
	}
	var auth_status = parseInt(String(queryResult.rows[0].auth_status));
	if (isNaN(auth_status)) {
		auth_status = 0;
	}
	if ((auth_status != 3) && (currentPassword == null)){
		trace ("Password request not in process and current password not provided.");
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_ACCOUNT_ERROR, "Cannot reset password at this time.");
		return;
	}
	hash = crypto.createHash('sha256');
	hash.update(requestData.params.password);
	var hashDigest = hash.digest('hex');
	var dbUpdates = "`auth_code`=NULL,`password`=\""+hashDigest+"\",`auth_status`=2,`auth_code`=NULL,`last_login`=NOW()";
	var txInfo = new Object();
	txInfo.type = "account_update";
	txInfo.subType = "password_reset";
	accountUpdateResult = yield global.updateAccount(queryResult, dbUpdates, txInfo, generator);
	if (accountUpdateResult.error != null) {
		trace ("Database error on rpc_passwordReset: "+accountUpdateResult.error);
		trace ("   Request ID: "+requestData.id);
		replyError(postData, requestObj, responseObj, batchResponses, serverConfig.JSONRPC_SQL_ERROR, "There was a database error when updating the account.");
		return;
	}
	exports.sendEmail("myfruitgame@gmail.com",
			queryResult.rows[0].email,
			"Your password has been reset",
			"Your password was successfully reset on "+createDateTimeString(new Date())
		);
	replyResult(postData, requestObj, responseObj, batchResponses, "OK");
}
exports.rpc_passwordReset = rpc_passwordReset;

/**
* Returns a human-readable, formatted date/time string.
*/
function createDateTimeString (dateObj) {
	var returnStr = "";
	switch (dateObj.getDay()) {
		case 0: returnStr = "Sunday"; break;
		case 1: returnStr = "Monday"; break;
		case 2: returnStr = "Tuesday"; break;
		case 3: returnStr = "Wednesday"; break;
		case 4: returnStr = "Thursday"; break;
		case 5: returnStr = "Friday"; break;
		case 6: returnStr = "Saturday"; break;
		default: break;
	}
	returnStr += ", ";
	switch (dateObj.getMonth()) {
		case 0: returnStr += "January"; break;
		case 1: returnStr += "February"; break;
		case 2: returnStr += "March"; break;
		case 3: returnStr += "April"; break;
		case 4: returnStr += "May"; break;
		case 5: returnStr += "June"; break;
		case 6: returnStr += "July"; break;
		case 7: returnStr += "August"; break;
		case 8: returnStr += "September"; break;
		case 9: returnStr += "October"; break;
		case 10: returnStr += "November"; break;
		case 11: returnStr += "December"; break;
		default: break;
	}
	returnStr += " ";
	returnStr += String(dateObj.getDate());
	returnStr += ", ";
	returnStr += String(dateObj.getFullYear());
	return (returnStr);

}
