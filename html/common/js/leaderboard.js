var ready = false;
var accountInfo = {};
var rpcMsgID = 0;
var availableInvestments = new Object();
var displayCurrency = "tokens";
var lastBetDateTime = new Date(1970,0,0,0,0,0); //Date object containing the last bet date/time recorded from a server message
var numberFormat = {
    decimalSeparator: '.',
    groupSeparator: ',',
    groupSize: 3,
    secondaryGroupSize: 0,
    fractionGroupSeparator: ' ',
    fractionGroupSize: 0
}
BigNumber.config({ EXPONENTIAL_AT: 1e+9, DECIMAL_PLACES: 8, ROUNDING_MODE: BigNumber.ROUND_FLOOR, FORMAT:numberFormat });

function callServerMethod(methodName, params, resultCallback) {	
	var request = {"jsonrpc":"2.0", "id":String(rpcMsgID), "method":methodName, "params":params};			
	$.post(accountInfo.gameServerURL, 
			JSON.stringify(request),
			resultCallback);	
	request.callback = resultCallback;
	rpcMsgID++;
	return (request);
}

function getLeaderboardData() {
	callServerMethod("getLeaderboard", {}, onGetLeaderboardData);
}

function onGetLeaderboardData(resultData) {
	console.log(JSON.stringify(resultData));
	if ((resultData["error"] != null) && (resultData["error"] != null)) {
		alert (resultData.error.messagewindow);
	} else {
		populateLeaderboard(resultData.result.leaderboard);
	}
	setTimeout(getLeaderboardData, 1000);
}

function populateLeaderboard(leaderboardData) {
	var winHTML = "<span id=\"prompt\">Biggest win: </span>";
	for (var gameID in leaderboardData.games) {
		var dateObj = new Date(leaderboardData.games[gameID].timestamp);
		var dateStr = dateObj.getFullYear()+"-"+(dateObj.getMonth()+1)+"-"+dateObj.getDate();
		winHTML += "<span id=\"win\">"+getGameNameByID(gameID)+" paid "+convertAmount(leaderboardData.games[gameID].btc, "btc", displayCurrency).toFormat()+" "+displayCurrency+" @ "+dateStr+"&nbsp;&nbsp;</span>";
	}
	var leaderboardHTML = "<div id=\"leaderboard\">";
	leaderboardHTML += "<div id=\"biggestWin\">"+winHTML+"</small></div>";
	leaderboardHTML += "<div id=\"biggestAffiliate\"><span id=\"prompt\">Biggest affiliate: </span>"+convertAmount(leaderboardData.affiliate.btc, "btc", displayCurrency).toFormat()+" "+displayCurrency+" <small>(affiliate ID: "+leaderboardData.affiliate.id+")</small></div>";
	leaderboardHTML += "</div>";
	$("#leaderboard").replaceWith(leaderboardHTML);
	for (var count =0; count< leaderboardData.last_bet.length; count++) {
		var currentBetItem = leaderboardData.last_bet[count];
		if ((currentBetItem["timestamp"] != null) && (currentBetItem["timestamp"] != undefined)) {
			var currentBetDateTime = new Date(currentBetItem.timestamp);
			if (lastBetDateTime.valueOf() < currentBetDateTime.valueOf()) {
				lastBetDateTime = currentBetDateTime;
				var dateStr = createDateTimeString(lastBetDateTime);
				if ((currentBetItem.btc != null) && (currentBetItem.btc != undefined)) {
					var newBetHTML = "<p id=\"bet\">Game: "+getGameNameByID(currentBetItem.gameID)+"&nbsp;&nbsp;--&nbsp;&nbsp;Bet: "+convertAmount(currentBetItem.btc, "btc", displayCurrency).toFormat()+" "+displayCurrency+" @ "+dateStr+"</bet>";
				}
				$("#betsScroller #scrollContainer").prepend(newBetHTML);
			}
			//$('#betsScroller').animate({scrollTop: $('#betsScroller')[0].scrollHeight}, 2000);
		}
	}
}

function createDateTimeString(dateObj) {
	var returnString = new String();
	returnString += String(dateObj.getDate())+"/";
	returnString += String(dateObj.getMonth()+1)+"/";
	returnString += String(dateObj.getFullYear())+" ";
	returnString += String(dateObj.getHours())+":";
	if (dateObj.getMinutes() < 10) {
		returnString += "0";
	}
	returnString += String(dateObj.getMinutes())+":";
	if (dateObj.getSeconds() < 10) {
		returnString += "0";
	}
	returnString += String(dateObj.getSeconds());
	return(returnString);
}

function getGameNameByID(gameID) {
	switch (gameID) {
		case "0001" : return ("Progressive Bonus Fruit Slot"); break;
		default: return ("unknown"); break;
	}
}

/**
* Processes all settings changes made to localStorage by child windows.
*/
function onSettingsChanged(event) {
	try {
		var options = JSON.parse(localStorage.options);
		displayCurrency = options.displayCurrency;
		lastBetDateTime = new Date(1970,0,0,0,0,0);
		$("#betsScroller #scrollContainer").replaceWith("<div id=\"scrollContainer\"></div>");
		getLeaderboardData();
	} catch (err) {
		alert (err);
	}
}

/*
$(document).ready(function(){
    $('#messagewindow').animate({
        scrollTop: $('#messagewindow')[0].scrollHeight}, 2000);
});
*/

//window onload handler
function start() {
	// COMMENT SECTION BELOW IF STARTING AS POPUP
	accountInfo.playerAccount = localStorage.playerAccount;
	accountInfo.playerPassword = localStorage.playerPassword;
	accountInfo.gameServerURL = localStorage.gameServerURL;	
	// COMMENT SECTION ABOVE IF STARTING AS POPUP
	try {
		var options = JSON.parse(localStorage.options);
		displayCurrency = options.displayCurrency;
	} catch (err) {
		displayCurrency = "tokens";
	}
	$(window).bind("storage", onSettingsChanged);
	getLeaderboardData();
	ready = true;
}