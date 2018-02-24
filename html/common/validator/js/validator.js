// ---- GLOBAL MEMBERS ----

var validationData = null; //data to be validated
var failOnWarnings = false; //should warnings be considered validation failures?
//all validation tests (function references) to run, in order
var validationTest = [
			testVDStructure,
			testResultsRequest,
			testResultsResponse,
			testSelectResults,
			testSelectResponse,
			testWins
			];
//descriptive names of validation tests for 'validationTest' elements
var validationTestNames = [
			"Validation data structure test",
			"Results generation (spin) request test",
			"Generated results response test",
			"Results selection test",
			"Selection response (end game) test",
			"Winnings test"
			];
var currentValidationIndex = 0; //current text index within validationTest array
var ready = false; //is script ready to operate?
var done = false; //has script completed?

function onValidateClick(event) {
	$("#inputField").hide();
	$("#submit").hide();
	addInfo("Parsing validation data...");
	try {
		validationData = JSON.parse($("#validationData").val());
	} catch (err) {
		addResult("Couldn't parse validation data!", false);
		showFailResult();
		return;
	}
	addResult("Game validation data successfully parsed.", true);
	validateNext();
}

function validateNext() {
	if ((validationTest[currentValidationIndex] != undefined) && (validationTest[currentValidationIndex] != null)) {
		addInfo("&#8594;&nbsp;"+validationTestNames[currentValidationIndex]+" starting ...");
		if (validationTest[currentValidationIndex]()) {
			addResult(validationTestNames[currentValidationIndex]+" passed.", true);
		} else {
			addResult(validationTestNames[currentValidationIndex]+" failed!", false);
			showFailResult();
			return;
		}
		currentValidationIndex++;
		setTimeout(validateNext, 100);
	} else {
		addInfo("All tests have passed; the game was fair and correct.");
		showPassResult();
		done = true;
	}
}

// ---- TESTS ----

function testVDStructure() {
	if ((validationData == undefined) || (validationData == null)) {
		return (false);
	}
	validationData.isJackpotGame = false;
	try {
		addInfo ("&nbsp;&nbsp;&nbsp;Game: "+validationData.gameConfig.name);
		addInfo ("&nbsp;&nbsp;&nbsp;ID: "+validationData.gameConfig.ID);
		if ((validationData.gameConfig["jackpotID"] != undefined) && (validationData.gameConfig["jackpotID"] != null)) {
			addInfo ("&nbsp;&nbsp;&nbsp;Jackpot: yes");
			validationData.isJackpotGame = true;
		} else {
			addInfo ("&nbsp;&nbsp;&nbsp;Jackpot: no");
		}
	} catch (err) {
		addInfo ("Couldn't detect core game information in validation data.");
		return (false);
	}
	//attempt to detect JSON-RPC version of each child object as a test of existence
	try {
		if (validationData.resultsRequest.jsonrpc != "2.0") {
			addInfo ("Wrong JSON-RPC version of 'resultsRequest' object.");
			return (false);
		}
	} catch (err) {
		addInfo ("'resultsRequest' object is missing or incorrectly formatted.");
		return (false);
	}
	try {
		if (validationData.resultsResponse.jsonrpc != "2.0") {
			addInfo ("Wrong JSON-RPC version of 'resultsResponse' object.");
			return (false);
		}
	} catch (err) {
		addInfo ("'resultsResponse' object is missing or incorrectly formatted.");
		return (false);
	}
	try {
		if (validationData.selectRequest.jsonrpc != "2.0") {
			addInfo ("Wrong JSON-RPC version of 'selectRequest' object.");
			return (false);
		}
	} catch (err) {
		addInfo ("'selectRequest' object is missing or incorrectly formatted.");
		return (false);
	}
	try {
		if (validationData.selectResponse.jsonrpc != "2.0") {
			addInfo ("Wrong JSON-RPC version of 'selectResponse' object.");
			return (false);
		}
	} catch (err) {
		addInfo ("'selectResponse' object is missing or incorrectly formatted.");
		return (false);
	}
	return (true);
}

function testResultsRequest() {
	if ((validationData.gameConfig["bets"] == undefined) || (validationData.gameConfig["bets"] == null)) {
		addInfo("Allowable bets information not found in game configuration.");
		return (false);
	}
	if (validationData.gameConfig.bets.length == 0) {
		addInfo ("No allowable bets specified in game configuration.");
		return (false);
	}
	try {
		var playerBetTokens = String(validationData.resultsRequest.params.bet.tokens);
		var found = false;
		for (var count = 0; count < validationData.gameConfig.bets.length; count++) {
			var currentBetDefinition = String(validationData.gameConfig.bets[count]);
			if (currentBetDefinition == playerBetTokens) {
				found = true;
				break;
			}
		}
		if (found == false) {
			addInfo ("Player bet ("+playerBetTokens+" tokens) not allowed according to game configuration.");
			return (false);
		}
	} catch (err) {
		addInfo ("Token bet amount in parameters of 'resultsRequest' object not accessible.");
		return (false);
	}
	try {
		if (validationData.gameConfig.ID != validationData.resultsRequest.params.gameID) {
			targetGameID ("Target game ID in 'resultsRequest' object does not match the game configuration.");
			return (false);
		}
	} catch (err) {
		addInfo ("Game ID in 'resultsRequest' parameters not accessible.");
		return (false);
	}
	return (true);
}

function testResultsResponse() {
	if ((validationData.gameConfig["reels"] == undefined) || (validationData.gameConfig["reels"] == null)) {
		addInfo("No reels defined in game configuration.");
		return (false);
	}
	if (validationData.gameConfig.reels.length == 0) {
		addInfo ("Reels definition in game configuration is empty.");
		return (false);
	}
	try {
		if (validationData.resultsResponse.result.reelstopselections.length != validationData.gameConfig.reels.length) {
			addInfo ("Number of reel stop selections ("+validationData.resultsResponse.result.reelstopselections.length+") in 'resultsResponse' object doesn't match game definition ("+validationData.gameConfig.reels.length+").");
			return (false);
		}
	} catch (err) {
		addInfo ("Encrypted reel stop selections in 'resultsResponse' object not accessible.");
		return (false);
	}
	try {
		for (var count = 0; count < validationData.resultsResponse.result.reelstopselections.length; count++) {
			var reelStops = validationData.resultsResponse.result.reelstopselections[count];
			if (reelStops.length != validationData.gameConfig.reels[count].length) {
				addInfo ("Number of stop position selections for reel "+String(count+1)+" in 'resultsResponse' object does not match configuration.");
				return (false);
			}
		}
		if (validationData.resultsResponse.result.reelstopselections.length != validationData.gameConfig.reels.length) {
			addInfo ("Number of stop position selections ("+validationData.resultsResponse.result.reelstopselections.length+") in 'resultsResponse' object doesn't match game definition ("+validationData.gameConfig.reels.length+").");
			return (false);
		}
	} catch (err) {
		addInfo ("Stop position selections in 'resultsResponse' object not accessible.");
		return (false);
	}
	try {
		if (validationData.selectResponse.result.keys.length != validationData.gameConfig.reels.length) {
			addInfo ("Number of keys in 'selectResponse' object does not match number of reels in game configuration.");
			return (false);
		}
	} catch (err) {
		addInfo ("Encryption/Decryption keys in 'selectResponse' object not accessible.");
		return (false);
	}
	try {
		if (String(validationData.selectResponse.result.bet.tokens) != String(validationData.resultsRequest.params.bet.tokens)) {
			addInfo ("Token bet ("+validationData.selectResponse.result.bet.tokens+") in 'selectResponse' object does not match bet in 'resultsRequest' object ("+validationData.resultsRequest.params.bet.tokens+").");
			return (false);
		}
	} catch (err) {
		addInfo ("Token bet amount in 'selectResponse' object not accessible.");
		return (false);
	}
	try {
		var decryptedSelections = new Array();
		for (var count = 0; count < validationData.resultsResponse.result.reelstopselections.length; count++) {
			var reelStops = validationData.resultsResponse.result.reelstopselections[count];
			var reelKeyObject = validationData.selectResponse.result.keys[count];
			for (var count2 = 0; count2 < reelStops.length; count2++) {
				decryptedSelections.push(parseInt(decrypt(reelStops[count2], reelKeyObject.key.data, reelKeyObject.iv.data)));
			}
			var found = false;
			for (var currentStopPosition = 0; currentStopPosition < validationData.gameConfig.reels[count].length; currentStopPosition++) {
				found = false;
				for (count2 = 0; count2 < decryptedSelections.length; count2++) {
					if (decryptedSelections[count2] == currentStopPosition) {
						found = true;
					}
				}
				if (found == false) {
					addInfo ("Stop position "+currentStopPosition+" on reel "+String(count+1)+" not found in 'resultsResponse' object. Decryption failed or stop position does not exist.");
					return (false);
				}
			}
			decryptedSelections = new Array();
		}
		//all aupplied reel stop positions are now accounted for can be correctly decrypted; any other tests to run on this object?
	} catch (err) {
		addInfo ("Couldn't access or decrypt reel stop selections in 'resultsResponse' object ["+err+"].");
		return (false);
	}
	return (true);
}

function testSelectResults() {
	try {
		if (validationData.selectRequest.params.results.length != validationData.gameConfig.reels.length) {
			addInfo ("Number of reel stop selections ("+validationData.selectRequest.params.results.length+") in 'selectRequest' object doesn't match game definition ("+validationData.gameConfig.reels.length+").");
			return (false);
		}
	} catch (err) {
		addInfo ("Results selections in 'selectRequest' object not accessible.");
		return (false);
	}
	try {
		for (var count = 0; count < validationData.selectRequest.params.results.length; count++) {
			var currentResultSelection = validationData.selectRequest.params.results[count];
			var found = false;
			for (var count2 = 0; count2 < validationData.resultsResponse.result.reelstopselections[count].length; count2++) {
				var availableSelection = validationData.resultsResponse.result.reelstopselections[count][count2];
				if (availableSelection == currentResultSelection) {
					found = true;
					break;
				}
				if (found) break;
			}
			if (found == false) {
				addInfo ("Selection \""+currentResultSelection+"\" does not match one sent in 'resultsResponse' object.");
				return (false);
			}
		}
	} catch (err) {
		addInfo (err);
		return (false);
	}
	return (true);
}

function testSelectResponse() {
	try {
		if (validationData.selectRequest.params.results.length != validationData.selectResponse.result.encryptedResults.length) {
			addInfo ("Number of reported reel stop selections ("+validationData.selectResponse.result.encryptedResults.length+") in 'selectResponse' object doesn't match game definition ("+validationData.selectRequest.params.results.length+").");
			return (false);
		}
	} catch (err) {
		addInfo ("Encrypted result selections in 'selectResponse' object not accessible.");
		return (false);
	}
	try {
		if (validationData.selectResponse.result.decryptedResults.length != validationData.selectResponse.result.encryptedResults.length) {
			addInfo ("Number of encrypted reel stop selections ("+validationData.selectResponse.result.encryptedResults.length+") in 'selectResponse' object doesn't match the number of decrypted results ("+validationData.selectResponse.result.decryptedResults.length+").");
			return (false);
		}
	} catch (err) {
		addInfo ("Decrypted result selections in 'selectResponse' object not accessible.");
		return (false);
	}
	var stopPositions = new Array();
	for (var count = 0; count < validationData.selectResponse.result.encryptedResults.length; count++) {
		var encryptedResult = validationData.selectResponse.result.encryptedResults[count];
		var decryptedMatch = validationData.selectResponse.result.decryptedResults[count];
		var decryptedMatchInt = validationData.selectResponse.result.reelsInfo.stopPositions[count]
		var keyObject = validationData.selectResponse.result.keys[count];
		var decryptedResult = decrypt(encryptedResult, keyObject.key.data, keyObject.iv.data);
		if (decryptedMatch == decryptedResult) {
			if (decryptedMatchInt != parseInt(decryptedResult)) {
				addInfo ("Actual decrypted & parsed stop position "+String(count)+" doesn't match parsed stop position in 'selectResponse' reels information data.");
				return (false);
			}
			stopPositions.push(parseInt(decryptedResult));
		} else {
			addInfo ("Actual decrypted stop position "+String(count)+" doesn't match reported decrypted stop position.");
			return (false);
		}
	}
	var stopSymbols = new Array();
	try {
		for (count = 0; count < stopPositions.length; count++) {
			//push entire symbol object reference (not just index) from game config
			stopSymbols.push(validationData.gameConfig.symbols[validationData.gameConfig.reels[count][stopPositions[count]]]);
		}
	} catch (err) {
		addInfo("Can't reference a symbol in the game configuration ["+err+"].");
		return (false);
	}
	if (stopSymbols.length != validationData.gameConfig.reels.length) {
		addInfo ("Not enough matching symbol references for all reels defined in game configuration.");
		return (false);
	}
	try {
		for (count = 0; count < stopSymbols.length; count++) {
			var currentStopSymbol = stopSymbols[count];
			var reportedSymbol = validationData.selectResponse.result.reelsInfo.symbols[count];
			if ((currentStopSymbol.index != reportedSymbol.index) || (currentStopSymbol.name != reportedSymbol.name)) {
				addInfo ("Calculated stop symbol for reel "+String(count)+" does not match reported stop symbol.");
				return (false);
			}
		}
	} catch (err) {
		addInfo ("Couldn't access reels information data in 'selectResponse' object.");
		return (false);
	}
	for (count = 0; count < stopSymbols.length; count++) {
		addInfo("&nbsp;&nbsp;&nbsp;Reel #"+String(count+1)+" stop symbol: "+stopSymbols[count].name+" ("+stopSymbols[count].index+")");
	}
	return (true);
}

function testWins() {
	try {
		var reportedMultiplier = new BigNumber(validationData.selectResponse.result.win.multiplier);
	} catch (err) {
		addInfo ("Can't access win multiplier in 'selectResponse' object.");
		return (false);
	}
	try {
		var reportedFinalBalance = new BigNumber(validationData.selectResponse.result.balance.tokens);
	} catch (err) {
		addInfo ("Can't access final token balance amount in 'selectResponse' object.");
		return (false);
	}
	try {
		var initialBalanceTokens = new BigNumber(validationData.resultsResponse.result.balance.tokens);
	} catch (err) {
		addInfo ("Can't access starting token balance amount in 'resultsResponse' object.");
		return (false);
	}
	try {
		var betAmount = new BigNumber(validationData.selectResponse.result.bet.tokens);
	} catch (err) {
		addInfo ("Can't access token bet amount in 'selectResponse' object.");
		return (false);
	}
	try {
		if (validationData.isJackpotGame == true) {
			var jackpotAmount = new BigNumber(validationData.resultsResponse.result.balance.tokens);
		} else {
			jackpotAmount = -1;
		}
	} catch (err) {
		addInfo ("Can't access starting token balance amount in 'resultsResponse' object.");
		return (false);
	}
	//find actual multiplier based on win
	var winMultiplier = new BigNumber(0);
	for (var count = 0; count < validationData.gameConfig.wins.length; count++) {
		var currentWinDef = validationData.gameConfig.wins[count];
		if (matchesWin(validationData.selectResponse.result.reelsInfo.stopPositions, currentWinDef)) {
			winMultiplier = new BigNumber(currentWinDef.multiplier);
			break;
		}
	}
	if (winMultiplier.equals(reportedMultiplier) == false) {
		addInfo ("Reported winnings multiplier "+reportedMultiplier.toString()+" does not match evakuated multiplier "+winMultiplier.toString()+".");
		return (false);
	}
	var calculatedFinalBalance = initialBalanceTokens.plus(betAmount.times(winMultiplier));
	//console.log("calculatedFinalBalance="+calculatedFinalBalance.toString());
	//console.log("reportedFinalBalance="+reportedFinalBalance.toString());
	//jackpot not currently included in calculation
	if (calculatedFinalBalance.greaterThan(reportedFinalBalance)) {
		addInfo("Calculated final balance ("+calculatedFinalBalance.toString()+") is greater than reported final balance ("+reportedFinalBalance.toString()+").");
		return (false);
	}
	return (true);
}

// ---- UTILITY FUNCTIONS ----

function matchesWin(stopPositions, winDefinition) {
	var symbols = new Array();
	//convert stop positions to symbols
	for (var count = 0; count < stopPositions.length; count++) {
		symbols.push(validationData.gameConfig.symbols[validationData.gameConfig.reels[count][stopPositions[count]]]);
	}
	var matchCount = 0;
	for (count = 0; count < winDefinition.symbols.length; count++) {
		var currentWinSymbolIndex = winDefinition.symbols[count];
		if ((currentWinSymbolIndex == symbols[count].index) || (currentWinSymbolIndex < 0)) {
			matchCount++;
		}
	}
	if (matchCount == validationData.gameConfig.reels.length) {
		return (true);
	}
	return (false);
}

function addInfo(infoText) {
	$("#result").append(infoText+"<br>");
	//window.scrollTo(0,document.body.scrollHeight);
}

function addResult(resultText, success) {
	if ((success == undefined) || (success == null)) {
		success = true;
	}
	if (success) {
		$("#result").append("&#9745;&nbsp;"+resultText+"<br>");
	} else {
		$("#result").append("&#8999;&nbsp;"+resultText+"<br>");
	}
	//window.scrollTo(0,document.body.scrollHeight);
}

function showPassResult() {
//	$("#thumbsUp").css({"top":($("#result").outerHeight()+5)+"px","position":"absolute"}); //align to bottom of content
	$("#thumbsUp").show();	
	$("#download").show();	
	$("#thumbsDown").hide();
}

function showFailResult() {
//	$("#thumbsDown").css({"top":($("#result").outerHeight()+5)+"px","position":"absolute"}); //align to bottom of content
	$("#thumbsDown").show();
	$("#download").show();	
	$("#thumbsUp").hide();
}

function decrypt(input, key, iv) {
	var encryptedBytes = aesjs.utils.hex.toBytes(input); 
	var aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
	var decryptedBytes = aesCbc.decrypt(encryptedBytes);
	var decryptedText = aesjs.utils.utf8.fromBytes(decryptedBytes);
	return (decryptedText);	
}

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

// ---- STARTUP ----

function start() {
	$("#submit").click(onValidateClick);
	$("#thumbsUp").hide();
	$("#thumbsDown").hide();
	if ($("#validationData").val() == "{VALIDATIONDATA}") {
		$("#validationData").val("");
	} else {
		onValidateClick({});
	}
	ready = true;
}

/**
* Pop-up mode startup (no interactive UI).
*/
function start_popup() {
	$("#inputField").hide();
	$("#submit").hide();
	$("#submit").click(onValidateClick);
	$("#thumbsUp").hide();
	$("#thumbsDown").hide();
	$("#download").hide();	
	if ($("#validationData").val() == "{VALIDATIONDATA}") {
		$("#validationData").val("");
	} else {
		onValidateClick({});
	}
	ready = true;
}