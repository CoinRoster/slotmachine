/**
* Game server plugins handler.
*/
const filesystem = require('fs');

//Global game server configuration:
var serverConfig = require("./game_server_config.js");

var _plugins  = new Array(); //registered plugins
var registryFilePath = "./plugins_registry.json";
var _timerFunctions = new Array(); //plugin timer functions registered 
const _timerCheckInterval = 1000; //milliseconds to check for timer function(s) execution
var trace = function(msg){console.log(msg);}; //trace function (formatted console.log output); should be replaced when "start" is invoked

exports._activePluginInstalls = 0; //number of currently active installs
exports._gameServer = null; //reference to the main game server object

/**
* Installs a new plugin.
*
* @param pluginFilePath The file path to the new plugin to install. The ".js" may be omitted.
*/
exports.install = (pluginFilePath) => {	
	try {
		var pluginData = filesystem.readFileSync(pluginFilePath);
	} catch (err) {		
		try {			
			pluginFilePath += ".js";
			var pluginData = filesystem.readFileSync(pluginFilePath);		
		} catch (err) {
			trace ("   Plugin not found!");
			return;
		}
	}
	try {
		var rawRegistryData = filesystem.readFileSync(registryFilePath);		
	} catch (err) {
		rawRegistryData = "[]";
		filesystem.writeFileSync(registryFilePath, rawRegistryData);
	}
	_plugins = JSON.parse(rawRegistryData);	
	pluginFilePath = "./"+pluginFilePath;
	trace ("   Using install path: "+pluginFilePath);
	var pluginObj = new Object();
	pluginObj.path = pluginFilePath;
	var verify = false;
	for (var count=0; count<_plugins.length; count++) {
		if (_plugins[count].path == pluginFilePath) {
			verify = true;
			trace ("   Plugin already installed? Searching installation...");
			break;
		}
	}	
	try {
		var newPlugin = require(pluginFilePath);
		if (verify == false) {
			trace ("   Installing \""+newPlugin.pluginInfo.name+" v"+newPlugin.pluginInfo.version+"\"...");			
			pluginObj.version = newPlugin.pluginInfo.version;
			_plugins.push(pluginObj);
			filesystem.writeFileSync(registryFilePath, JSON.stringify(_plugins));
			exports._activePluginInstalls++;
			newPlugin.install(exports.onInstall);
		} else {
			trace ("   Found existing plugin: \""+newPlugin.pluginInfo.name+" v"+newPlugin.pluginInfo.version+"\"");	
		}	
	} catch (err) {
		trace ("   Error Loading plugin: "+err);		
	}
}

/**
* Retrieves a reference to an installed and running plugin by a specified name, as defined in the 'name' property of the plugins 'pluginInfo' object.
*
* @param pluginName The name of the installed and running plugin to retreive a reference to.
*
* @return A reference to the installed and active plugin or null if none can be found.
*/
exports.getPlugin = (pluginName) => {
	for (var count=0; count < _plugins.length; count++) {
		var pluginEntry = _plugins[count];
		if (pluginEntry.plugin.pluginInfo.name == pluginName) {
			return (pluginEntry.plugin);
		}
	}
	return (null);
}

/**
* Callback function invoked when a plugin install process has completed.
* 
* @param success True if the installation was successful, false otherwise.
* @param info An object containing additional information about the successful or failed installation.
*/
exports.onInstall = (success, info) => {
	exports._activePluginInstalls--;
	if (success) {
		trace ("Plugin "+info.name+" successfully installed.");
	} else {
		trace (info); //just a string
	}	
}

/**
* Starts the plugin handler.
*
* @param traceFunc The logging output function to use for all plugins.
* @param serverRef A reference to the main game server object
*/
exports.start = (traceFunc, serverRef) => {
	trace = traceFunc;
	exports._gameServer = serverRef;
	trace ("Loading plugins:");
	try {
		var rawRegistryData = filesystem.readFileSync(registryFilePath);		
	} catch (err) {
		rawRegistryData = "[]";
		filesystem.writeFileSync(registryFilePath, rawRegistryData);
	}
	_plugins = JSON.parse(rawRegistryData);
	for (var count=0; count < _plugins.length; count++) {		
		var currentPlugin = require(_plugins[count].path);
		currentPlugin.pluginInfo._manager = this;
		trace ("   #"+String(count+1)+" "+currentPlugin.pluginInfo.name+" v"+currentPlugin.pluginInfo.version+" loaded");
		_plugins[count].plugin = currentPlugin;
		currentPlugin.start(trace);
		try {
			for (var count2=0; count2<currentPlugin.pluginInfo.timerFunctions.length; count2++) {
				trace ("   >>> registering timed function execution @ "+currentPlugin.pluginInfo.timerFunctions[count2].time);
				currentPlugin.pluginInfo.timerFunctions[count2].plugin = currentPlugin; //add circular reference
				exports.registerTimerFunction(currentPlugin.pluginInfo.timerFunctions[count2]);
			}
		} catch (err) {
		}
		if (_timerFunctions.length > 0) {
			setTimeout(exports.timerHandler, _timerCheckInterval);
		}
	}
}

/**
* Registers a new timer function with the plugin manager.
*
* @param tfDefinition An object containing information about the timer function to register. Expected properties include:
*			time (String): The "hours:minutes" based time to invoke the timer function at (in 24-hour format with midnight being "00:00"). 
*			func (String): The name of the function to invoke within the plugin at the specified time.
*/
exports.registerTimerFunction = (tfDefinition) => {
	_timerFunctions.push(tfDefinition);
}

/**
* Called every _timerCheckInterval to manage the execution of registered timer functions.
*/
exports.timerHandler = () => {	
	var parsedFunctions = new Array();	
	for (var count=0; count<_timerFunctions.length; count++) {		
		if (exports.timerFunctionCanExecute(_timerFunctions[count])) {
			parsedFunctions.push(_timerFunctions[count]);
			var executed = exports.timerFunctionExecute(_timerFunctions[count]);
			if (executed) {
				//store state?
			}
		} else {			
		}
	}	
	_timerFunctions = parsedFunctions;
	if (_timerFunctions.length > 0) {
		setTimeout(exports.timerHandler, _timerCheckInterval);
	}
}

/**
* Returns true if referenced function is executable, false otherwise.
*
* @param tfDefinition The timer function definition object to evaluate.
*
* @return True if the named tfDefinition.func function is executable, false otherwise.
*/
exports.timerFunctionCanExecute = (tfDefinition) => {	
	try {
		if (typeof(tfDefinition.plugin[tfDefinition.func]) == "function") {
			return (true)
		}
	} catch (err) {
	}
	return (false);	
}

/**
* Attempts to execute a timer function.
*
* @param tfDefinition The timer function definition object to attempt to execute.
*
* @return True if the named tfDefinition.func function was just executed at the time defined in
*			tfDefinition.time. False is returned if the timer function could not be executed either
*			because the time has not yet arrived or there was a problem calling the function.
*/
exports.timerFunctionExecute = (tfDefinition) => {
	var timeSplit = tfDefinition.time.split(":");
	var hours = parseInt(timeSplit[0]);
	var minutes = parseInt(timeSplit[1]);
	var now = new Date();
	//trigger immediately on startup, used for testing:
	hours = now.getHours();
	minutes = now.getMinutes();
	var h24MS = 86400000; //24 hours in milliseconds
	var h12MS = 43200000; //12 hours in milliseconds
	//var h1MS = 3600000; //1 hour in milliseconds
	if ((tfDefinition["lastCalled"] == undefined) || (tfDefinition["lastCalled"] == null)) {
		tfDefinition.lastCalled = Date.now() - h24MS; //default: last called 24 hours ago
	}
	if ((hours == now.getHours()) && (minutes == now.getMinutes()) && ((Date.now() - tfDefinition.lastCalled) > h12MS)) {
		if ((tfDefinition.plugin.pluginInfo != undefined) && (tfDefinition.plugin.pluginInfo != null)) {
			trace ("Trigerring timed execution in plugin \""+tfDefinition.plugin.pluginInfo.name+"\" @ "+now.toTimeString());
		} else {
			trace ("Trigerring timed execution in global scope @ "+now.toTimeString())				
		}
		var gen = tfDefinition.plugin[tfDefinition.func](); //execute generator
		gen.next();
		gen.next(gen);	
		tfDefinition.lastCalled = Date.now();
		return (true);
	}
	return (false);
}

/**
* Returns true if a specific RPC method has been defined in a plugin.
*
* @param methodName The name of the RPC method to search for.
*
* @return True if the specified method exists in a registered plugin, false otherwise.
*/
exports.rpcMethodExists = (methodName) => {
	for (var count=0; count < _plugins.length; count++) {		
		var currentPlugin = _plugins[count].plugin;	
		var methods = currentPlugin.pluginInfo.rpc;
		for (var count2=0; count2<methods.length; count2++) {
			if (methods[count2].external == methodName) {
				return (true);
			}
		}
	}
	return (false);
}

exports.rpc_invoke = (method, postData, requestObj, responseObj, batchResponses, replyResultFunc, replyErrorFunc) => {
	for (var count=0; count < _plugins.length; count++) {		
		var currentPlugin = _plugins[count].plugin;	
		for (var count2 = 0; count2<currentPlugin.pluginInfo.rpc.length; count2++) {
			var currentRPCRef = currentPlugin.pluginInfo.rpc[count2];
			if (currentRPCRef.external == method) {
				var gen = currentPlugin[currentRPCRef.internal](postData, requestObj, responseObj, batchResponses, replyResultFunc, replyErrorFunc);
				gen.next();
				gen.next(gen);
			}
		}		
	}
}

/**
* Apply RPC plugin filters to any pre-new-account action
*/
exports.RPC_newAccount = (parsedRequestData, generator) => {
	for (var count=0; count < _plugins.length; count++) {		
		var currentPlugin = _plugins[count].plugin;
		try {
			if (typeof(currentPlugin["RPC_newAccount"]) == "function") {
				//try standard RPC filter
				var filterResult = currentPlugin.RPC_newAccount(parsedRequestData);
			} else if (typeof(currentPlugin["RPC_newAccountGen"]) == "function") {				
				//try generator filter
				var gen = currentPlugin.RPC_newAccountGen(parsedRequestData, generator);				
				gen.next();				
				filterResult = gen.next(gen);
			} else {
				//RPC filter function not implemented
				filterResult = null;
			}			
		} catch (err) {
			trace ("plugins.RPC_newAccount error: "+err);
			return ({"code":serverConfig.JSONRPC_INTERNAL_ERROR,"msg":err});
		}
	}
}

/**
* Apply RPC plugin filters to any login action
*/
exports.RPC_login = (accountQueryResult, postData, generator) => {
	for (var count=0; count < _plugins.length; count++) {		
		var currentPlugin = _plugins[count].plugin;
		try {
			if (typeof(currentPlugin["RPC_login"]) == "function") {				
				//try standard RPC filter
				var filterResult = currentPlugin.RPC_login(accountQueryResult, postData, generator);								
				generatorCBDelay(generator, filterResult);
			} else if (typeof(currentPlugin["RPC_loginGen"]) == "function") {
				//try generator filter
				var gen = currentPlugin.RPC_loginGen(accountQueryResult, postData, generator);
				gen.next();
				filterResult = gen.next(gen);				
			} else {
				//RPC filter function not implemented
				filterResult = null;
			}			
		} catch (err) {
			trace ("plugins.RPC_login error: "+err);
			return ({"code":serverConfig.JSONRPC_INTERNAL_ERROR,"msg":err});
		}
	}
}

function generatorCBDelay(generator, resultObj) {
	setTimeout(function() {		
		generator.next(resultObj);
	}, 1);
}

/**
* Apply RPC pre-bet plugin filters
*/
exports.RPC_bet = (accountQueryResult, requestData, generator) => {
	for (var count=0; count < _plugins.length; count++) {		
		var currentPlugin = _plugins[count].plugin;
		try {
			if (typeof(currentPlugin["RPC_bet"]) == "function") {
				//try standard RPC filter
				var filterResult = currentPlugin.RPC_bet(accountQueryResult, postData, generator);
				generatorCBDelay(generator, filterResult);
				return;
			} else if (typeof(currentPlugin["RPC_betGen"]) == "function") {
				//try generator filter
				var gen = currentPlugin.RPC_betGen(accountQueryResult, postData, generator);
				gen.next();
				filterResult = gen.next(gen);
				return;
			} else {
				//RPC filter function not implemented
				filterResult = null;
			}			
		} catch (err) {
			trace ("plugins.RPC_bet error: "+err);
			return ({"code":serverConfig.JSONRPC_INTERNAL_ERROR,"msg":err});
		}
	}
	setTimeout(function() {generator.next(filterResult);}, 1);
}

/**
* Apply RPC pre-dividend-calculation plugin filters
*/
exports.RPC_dividend = (accountQueryResult, requestData, betInfoObj, generator) => {	
	for (var count=0; count < _plugins.length; count++) {		
		var currentPlugin = _plugins[count].plugin;
		try {
			if (typeof(currentPlugin["RPC_dividend"]) == "function") {
				//try standard RPC filter
				var filterResult = currentPlugin.RPC_dividend(accountQueryResult, requestData, betInfoObj, generator);			
				generatorCBDelay(generator, filterResult);
			} else if (typeof(currentPlugin["RPC_dividendGen"]) == "function") {
				//try generator filter
				var gen = currentPlugin.RPC_dividendGen(accountQueryResult, requestData, betInfoObj, generator);
				gen.next();
				filterResult = gen.next(gen);
			} else {
				//RPC filter function not implemented
				filterResult = null;
			}			
		} catch (err) {
			trace ("plugins.RPC_dividend error: "+err);
			return ({"code":serverConfig.JSONRPC_INTERNAL_ERROR,"msg":err});
		}
	}
}

/**
* Apply RPC pre-jackpot-calculation plugin filters
*/
exports.RPC_jackpot = (accountQueryResult, requestData, betInfoObj, generator) => {
	for (var count=0; count < _plugins.length; count++) {		
		var currentPlugin = _plugins[count].plugin;
		try {
			if (typeof(currentPlugin["RPC_jackpot"]) == "function") {
				//try standard RPC filter
				var filterResult = currentPlugin.RPC_jackpot(accountQueryResult, requestData, betInfoObj, generator);			
				generatorCBDelay(generator, filterResult);
			} else if (typeof(currentPlugin["RPC_jackpotGen"]) == "function") {
				//try generator filter
				var gen = currentPlugin.RPC_jackpotGen(accountQueryResult, requestData, betInfoObj, generator);
				gen.next();
				filterResult = gen.next(gen);
			} else {
				//RPC filter function not implemented
				filterResult = null;
			}			
		} catch (err) {
			trace ("plugins.RPC_jackpot error: "+err);
			return ({"code":serverConfig.JSONRPC_INTERNAL_ERROR,"msg":err});
		}
	}
}

/**
* Apply RPC post-bet plugin filters
*/
exports.RPC_onBet = (accountQueryResult, postData, betInfo, generator) => {
	for (var count=0; count < _plugins.length; count++) {		
		var currentPlugin = _plugins[count].plugin;
		try {
			if (typeof(currentPlugin["RPC_onBet"]) == "function") {
				//try standard RPC filter
				var filterResult = currentPlugin.RPC_onBet(accountQueryResult, postData, betInfo, generator);
				generatorCBDelay(generator, filterResult);
			} else if (typeof(currentPlugin["RPC_onBetGen"]) == "function") {
				//try generator filter
				var gen = currentPlugin.RPC_onBetGen(accountQueryResult, postData, betInfo, generator);
				gen.next();
				filterResult = gen.next(gen);
			} else {
				//RPC filter function not implemented
				filterResult = null;
			}			
		} catch (err) {
			trace ("plugins.RPC_onBet error: "+err);
			return ({"code":serverConfig.JSONRPC_INTERNAL_ERROR,"msg":err});
		}
	}
}

/**
* Apply RPC post-win plugin filters.
*/
exports.RPC_onWin = (accountQueryResult, postData, winInfo, generator) => {
	for (var count=0; count < _plugins.length; count++) {		
		var currentPlugin = _plugins[count].plugin;
		try {
			if (typeof(currentPlugin["RPC_onWin"]) == "function") {
				//try standard RPC filter
				var filterResult = currentPlugin.RPC_onWin(accountQueryResult, postData, winInfo, generator);
				generatorCBDelay(generator, filterResult);
			} else if (typeof(currentPlugin["RPC_onWinGen"]) == "function") {
				//try generator filter
				var gen = currentPlugin.RPC_onWinGen(accountQueryResult, postData, winInfo, generator);
				gen.next();
				filterResult = gen.next(gen);
			} else {
				//RPC filter function not implemented
				filterResult = null;
			}
		} catch (err) {
			trace ("plugins.RPC_onWin error: "+err);
			return ({"code":serverConfig.JSONRPC_INTERNAL_ERROR,"msg":err});
		}
	}
}

/**
* Script has been started from the command line.
*/
function cli_start() {
	trace ("Plugins Handler Command Line Interface");
	trace ("--------------------------------------");
	try {
		switch (process.argv[2]) {
			case "install": 
				exports.install (process.argv[3]);
				break;
			default:
				break;
		}
	} catch (err) {
		trace (err);
	}
}
if ((process.env["windir"] != "") && (process.env["windir"] != undefined) && (process.env["windir"] != null)) {
	console.log ("Windows environment detected.");
	var currentScriptSplit = process.argv[1].split("\\");
} else {
	console.log ("UNIX/Linux environment detected.");
	currentScriptSplit = process.argv[1].split("/");
}
var currentScript = currentScriptSplit[currentScriptSplit.length-1];
if (currentScript == "plugins") {
	cli_start();
}