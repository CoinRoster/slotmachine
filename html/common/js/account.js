var ready = false;
var accountInfo = {};
var rpcMsgID = 0;
var availableInvestments = new Object();
var _txTableTopItemIndex = 0; //index of the currently display top item in the transaction history table
var _txTableItemsPerPage = 5; //items per page of the transaction history table
var currentTransactionsData = null; //currently loaded transactions data
var transactionTableOptions = new Object(); //transaction history filter options
transactionTableOptions.accountHistory = true;
transactionTableOptions.gameHistory = true;
transactionTableOptions.investmentHistory = true;
transactionTableOptions.affiliateHistory = true;
var displayCurrency = "tokens";
var passwordUpdateInterval = 10; //number of minutes that must elapse between subsequent password reset attempts (should reflect server setting)
BigNumber.config({ EXPONENTIAL_AT: 1e+9, DECIMAL_PLACES: 8, ROUNDING_MODE: BigNumber.ROUND_FLOOR });

function callServerMethod(methodName, params, resultCallback) {	
	var request = {"jsonrpc":"2.0", "id":String(rpcMsgID), "method":methodName, "params":params};			
	$.post(accountInfo.gameServerURL, 
			JSON.stringify(request),
			resultCallback);	
	request.callback = resultCallback;
	rpcMsgID++;
	return (request);
}

/**
* Copies data to the system clipboard.
*
* @param clipboardData The data to copy to the system clipboard.
*/
function copyToClipboard(clipboardData) {
    $("#clipboardProxy").val(clipboardData);
    $("#clipboardProxy").focus();
    $("#clipboardProxy").select();
    document.execCommand("copy");
}

function onCopyAffiliateLinkClick(event) {
	var affiliateLink = $("#affiliate #link").text();
	copyToClipboard (affiliateLink);
	alert ("Link has been copied to your system clipboard.");
}

function getAccountBalance() {
	if ((accountInfo.playerAccount == null) || (accountInfo.playerPassword == null) || 
		(accountInfo.playerAccount == undefined) || (accountInfo.playerPassword == undefined) || 
		(accountInfo.playerAccount == "") || (accountInfo.playerPassword == "")) {
			console.log("Can't get account balance. User is logged out.");
			return;
	}
	callServerMethod("getAccountBalance", {"account":accountInfo.playerAccount,"password":accountInfo.playerPassword,"refresh":true}, onGetAccountBalance);	
}

function getAllInvestments() {
	callServerMethod("getInvestmentsInfo",{},onGetAllInvestments);
}

function getOwnedInvestments() {
	if ((accountInfo.playerAccount == null) || (accountInfo.playerPassword == null) || 
		(accountInfo.playerAccount == undefined) || (accountInfo.playerPassword == undefined) || 
		(accountInfo.playerAccount == "") || (accountInfo.playerPassword == "")) {
			console.log("Can't get owned investments. User is logged out.");
			return;
	}
	callServerMethod("getInvestorInfo",{"account":accountInfo.playerAccount,"password":accountInfo.playerPassword}, onGetOwnedInvestments);
}

function getAffiliateLink() {
	if ((accountInfo.playerAccount == null) || (accountInfo.playerPassword == null) || 
		(accountInfo.playerAccount == undefined) || (accountInfo.playerPassword == undefined) || 
		(accountInfo.playerAccount == "") || (accountInfo.playerPassword == "")) {
			console.log("Can't get affiliate link. User is logged out.");
			return;
	}
	callServerMethod("getAffiliateLink",{"account":accountInfo.playerAccount,"password":accountInfo.playerPassword}, onGetAffiliateLink);
}

function getTransactions() {
	if ((accountInfo.playerAccount == null) || (accountInfo.playerPassword == null) || 
		(accountInfo.playerAccount == undefined) || (accountInfo.playerPassword == undefined) || 
		(accountInfo.playerAccount == "") || (accountInfo.playerPassword == "")) {
			console.log("Can't get transactions. User is logged out.");
			return;
	}
	var searchParams = new Object();
	searchParams.searchType = "recent";
	searchParams.txTypes = ["account", "investments", "affiliate", "bets", "wins"];
	searchParams.search = 1000;
	callServerMethod("getAccountTransactions",{"account":accountInfo.playerAccount,"password":accountInfo.playerPassword, "searchParams":searchParams}, onGetTransactions);
}
/*
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
										handled on the client by using the total result count included in the reply.*/

function getAffiliateInfo(affiliateID) {
	console.log ("Getting affiliate info for: "+affiliateID);
	/*
	//var startDate= new Date(1970,0,1,0,0,0,0);//since the beginning
	var startDate= new Date();
	startDate.setHours(0); //all transactions today
	startDate.setMinutes(0);
	startDate.setSeconds(0);
	var endDate= new Date();
	callServerMethod("getAffiliateInfo",{"affiliateID":affiliateID,"password":accountInfo.playerPassword,"limit":{"num":20,"startDate":startDate.toString(),"endDate":endDate.toString()}},onGetAffiliateInfo);
	*/
	//only get the most recent row by default
	callServerMethod("getAffiliateInfo",{"affiliateID":affiliateID,"password":accountInfo.playerPassword,"limit":{"num":1}},onGetAffiliateInfo);
}

function getReferralInfo(referralHash) {
	callServerMethod("getReferralInfo",{"affiliateID":accountInfo.affiliateID,"referral":referralHash, "password":accountInfo.playerPassword,"limit":{"num":20}},onGetReferralInfo);
}

function clearAllFields() {
	var investmentListHTML = "<ul id=\"availableInvestments\"></ul>";
	var investmentSelectHTML = "<select name=\"investmentsDeposit\" id=\"investmentSelectorDeposit\"></select>"; 
	var investmentSelectWithdrawHTML = "<select name=\"investmentsWithdraw\" id=\"investmentSelectorWithdraw\"></select>"; 
	var ownedInvestmentListHTML = "<ul id=\"ownedInvestments\"></ul>";
	$("#availableInvestments").replaceWith(investmentListHTML);		
	$("#investmentSelectorDeposit").replaceWith(investmentSelectHTML);
	$("#investmentSelectorWithdraw").replaceWith(investmentSelectWithdrawHTML);	
	$("#ownedInvestments").replaceWith(ownedInvestmentListHTML);
}

function onGetAccountBalance(returnData) {	
	if ((returnData["error"] != undefined) && (returnData["error"] != null) && (returnData["error"] != "")) {
		alert(returnData.error.message);
	} else {
		accountInfo.confirmedBTCBalance = returnData.result.balance.bitcoin_confirmed;
		accountInfo.unconfirmedBTCBalance = returnData.result.balance.bitcoin_unconfirmed;
		accountInfo.availableBTCBalance = returnData.result.balance.bitcoin;
	}
	getAllInvestments();
}

var allInvestments = null; //all available investments returned in last API response
var ownedInvestments = null; //all user-owned investments returned in last API response

function onGetAllInvestments(returnData) {
	if ((returnData["error"] != undefined) && (returnData["error"] != null) && (returnData["error"] != "")) {
		allInvestments = null;
		alert(returnData.error.message);
	} else {	
		allInvestments = returnData.result.investments;
		var investmentSelectHTML ="<select name=\"investmentsDeposit\" id=\"investmentSelectorDeposit\">";    
		var investmentWithdrawSelectHTML ="<select name=\"investmentsWithdraw\" id=\"investmentSelectorWithdraw\">";    
		for (var count=0; count<returnData.result.investments.length; count++) {
			var investmentBalance = returnData.result.investments[count].btc_balance;
			if ((investmentBalance==null) || (investmentBalance=="null") || (investmentBalance=="NULL") || (investmentBalance=="") || (investmentBalance==undefined)) {
				investmentBalance = "0";
			}
			availableInvestments[returnData.result.investments[count].id] = returnData.result.investments[count].name;
			investmentSelectHTML += "<option value=\""+returnData.result.investments[count].id+"\">"+returnData.result.investments[count].name+" ["+returnData.result.investments[count].id+"]</option>";
			investmentWithdrawSelectHTML += "<option value=\""+returnData.result.investments[count].id+"\">"+returnData.result.investments[count].name+" ["+returnData.result.investments[count].id+"]</option>";
		}
		investmentSelectHTML +="</select>";
		investmentWithdrawSelectHTML += "</select>";
		$("#investmentSelectorDeposit").replaceWith(investmentSelectHTML);	
		$("#investmentSelectorWithdraw").replaceWith(investmentWithdrawSelectHTML);	
	}
	getOwnedInvestments();
}

function onGetOwnedInvestments(returnData) {
	console.log(JSON.stringify(onGetOwnedInvestments));
	if ((returnData["error"] != undefined) && (returnData["error"] != null) && (returnData["error"] != "")) {
		//error is returned if no entries are found for the account
		var investmentListHTML = "<ul id=\"ownedInvestments\"><li>none</li>";
	} else {
		if (returnData.result.transactions.length > 0) {
			ownedInvestments = returnData.result.transactions[0].investments;
		} else {
			ownedInvestments = new Array(); //no transactions yet
		}
		var tableHTML = "<div id=\"investments\">"+buildInvestmentsTable(allInvestments, ownedInvestments)+"</div>";
		$("#investments").replaceWith(tableHTML);
		//$("#investments table").tablesorter({widgets: ['staticRow']});
		paginateSortableTable("#investments table", "#investmentsPager");
	}
	getAffiliateLink();
}

function buildInvestmentsTable(allInvestmentsArr, ownedInvestmentsArr) {
	var returnHTML = "<table id=\"investmentsTable\" class=\"tablesorter-blue\">";
	returnHTML += "<thead><tr>";
	returnHTML += "<th class=\"header\">Investment</th>";
	if (displayCurrency == "btc") {
		returnHTML += "<th class=\"header\">Book Value (BTC)</th>";
		returnHTML += "<th class=\"header\">Current Value (BTC)</th>";
		returnHTML += "<th class=\"header\">Change (BTC)</th>";
	} else if (displayCurrency == "satoshis") {
		returnHTML += "<th class=\"header\">Book Value (satoshis)</th>";
		returnHTML += "<th class=\"header\">Current Value (satoshis)</th>";
		returnHTML += "<th class=\"header\">Change (satoshis)</th>";
	} else if (displayCurrency == "tokens") {
		returnHTML += "<th class=\"header\">Book Value (tokens)</th>";
		returnHTML += "<th class=\"header\">Current Value (tokens)</th>";
		returnHTML += "<th class=\"header\">Change (tokens)</th>";
	} else {
		returnHTML += "<th class=\"header\">Book Value</th>";
		returnHTML += "<th class=\"header\">Current Value</th>";
		returnHTML += "<th class=\"header\">Change</th>";
	}
	returnHTML += "</tr></thead>";
	returnHTML += "<tbody>";
	if ((allInvestmentsArr["length"] == 0) || (allInvestmentsArr == undefined) || (allInvestmentsArr == null)) {
		returnHTML += "<tr><td>Investments information not available.</tr></td>";
	} else {
		var totalUserInvestmentBase = new BigNumber(0);
		var totalInvestmentsBalance = new BigNumber(0);
		var totalInvestmentsGains = new BigNumber(0);
		if ((accountInfo.availableBTCBalance == null) || (accountInfo.availableBTCBalance == undefined) || (accountInfo.availableBTCBalance == "")) {
			accountInfo.availableBTCBalance = "0";
		}
		if ((accountInfo.confirmedBTCBalance == null) || (accountInfo.confirmedBTCBalance == undefined) || (accountInfo.confirmedBTCBalance == "")) {
			accountInfo.confirmedBTCBalance = "0";
		}
		if ((accountInfo.unconfirmedBTCBalance == null) || (accountInfo.unconfirmedBTCBalance == undefined) || (accountInfo.unconfirmedBTCBalance == "")) {
			accountInfo.unconfirmedBTCBalance = "0";
		}
		var availBalance = new BigNumber(accountInfo.availableBTCBalance);
		var unconfirmedBalance = new BigNumber(accountInfo.unconfirmedBTCBalance);
		availBalance = availBalance.minus(unconfirmedBalance);
		if (availBalance.lessThan(0)) {
			availBalance = new BigNumber(0);
		}
		returnHTML += "<tr class=\"static\"><td><b>Available Balance:</b></td><td><b>"+convertAmount(availBalance, "btc", displayCurrency).toString(10)+"</b></td><td><b>"+convertAmount(availBalance, "btc", displayCurrency).toString(10)+"</b></td><td></td></tr>";
		totalUserInvestmentBase = totalUserInvestmentBase.plus(availBalance);
		totalInvestmentsBalance = totalInvestmentsBalance.plus(availBalance);
		for (var count = 0; count < allInvestmentsArr.length; count++) {
			var currentInvestment = allInvestmentsArr[count];
			var investmentBalance = currentInvestment.btc_total_balance;
			//var investmentBalance = currentInvestment.user_investment_base_btc;
			var investmentName = currentInvestment.name+" ("+currentInvestment.id+")";
			if ((investmentBalance == null) || (investmentBalance == "NULL")) {
				investmentBalance = currentInvestment.btc_balance;
				//investmentBalance = currentInvestment.user_investment_base_btc;
			}
			if ((investmentBalance == null) || (investmentBalance == "NULL")) {
				investmentBalance = "0";
			}
			var investmentGains = currentInvestment.btc_gains;
			if ((investmentGains == null) || (investmentGains == "NULL")) {
				investmentGains = "0";
			}
			var userInvestmentObj = getUserInvestment(currentInvestment.id, ownedInvestmentsArr);
			//alert (currentInvestment+": "+JSON.stringify(userInvestmentObj));
			if (userInvestmentObj == null) {
				var userInvestmentBase = "0";
				var userInvestmentTotal = "0";
			} else {
				userInvestmentBase = userInvestmentObj.user_investment_base_btc;
				userInvestmentTotal = userInvestmentObj.user_investment_btc;
				if ((currentInvestment.id == "smb") && (isNaN(userInvestmentObj["bankroll_multiplier"]) == false)) {
					//update multiplier inputs
					$("#bankrollMultiplier #multiplierInputForm #multiplierNumberInput").val(userInvestmentObj.bankroll_multiplier);
					$("#bankrollMultiplier #multiplierInputForm #multiplierRangeInput").val(Number(userInvestmentObj.bankroll_multiplier));
				}
			}
			var currentBaseValue = new BigNumber(userInvestmentBase);
			var currentTotalValue = new BigNumber(userInvestmentTotal);
			var investmentDelta = currentTotalValue.minus(currentBaseValue);
			totalUserInvestmentBase = totalUserInvestmentBase.plus(currentBaseValue);			
			totalInvestmentsBalance = totalInvestmentsBalance.plus(currentTotalValue);
			totalInvestmentsGains = totalInvestmentsGains.plus(investmentDelta);
			returnHTML += "<tr><td>"+investmentName+"</td><td>"+convertAmount(userInvestmentBase, "btc", displayCurrency).toString(10)+"</td><td>"+convertAmount(currentTotalValue, "btc", displayCurrency).toString(10)+"</td><td>"+convertAmount(investmentDelta, "btc", displayCurrency).toString(10)+"</td></tr>";
		}
	}
	try {
		returnHTML += "<tr class=\"static\"><td><b>TOTALS</b></td><td><b>"+convertAmount(totalUserInvestmentBase, "btc", displayCurrency).toString(10)+"</b></td><td><b>"+convertAmount(totalInvestmentsBalance, "btc", displayCurrency).toString(10)+"</b></td><td><b>"+convertAmount(totalInvestmentsGains, "btc", displayCurrency).toString(10)+"</b></td></tr>";
	} catch (err) {
	}
	returnHTML += "</tbody></table>";
	return (returnHTML);
}

function onTxTablePreviousClick() {	
	//_txTableTopItemIndex--;
	var txTable = buildTransactionTable(currentTransactionsData, _txTableItemsPerPage, "down");
	$("#transactionHistory").replaceWith(txTable);
}

function onTxTableNextClick() {	
	//_txTableTopItemIndex++;
	var txTable = buildTransactionTable(currentTransactionsData, _txTableItemsPerPage, "up");
	$("#transactionHistory").replaceWith(txTable);
}

function onTxHistoryOptionClick() {
	var options = new Object();
	if ($("#transactionHistoryOptions #options #accountTransactions").prop("checked")) {
		options.accountHistory = true;
	} else {
		options.accountHistory = false;
	}
	if ($("#transactionHistoryOptions #options #gameTransactions").prop("checked")) {
		options.gameHistory = true;
	} else {
		options.gameHistory = false;
	}
	if ($("#transactionHistoryOptions #options #investmentTransactions").prop("checked")) {
		options.investmentHistory = true;
	} else {
		options.investmentHistory = false;
	}
	if ($("#transactionHistoryOptions #options #affiliateTransactions").prop("checked")) {
		options.affiliateHistory = true;
	} else {
		options.affiliateHistory = false;
	}
	transactionTableOptions = options;
	_txTableTopItemIndex = 0;
	var txTable = buildTransactionTable(currentTransactionsData, _txTableItemsPerPage, "up");
	$("#transactionHistory").replaceWith(txTable);
	paginateSortableTable("#transactionHistory table", "#transactionHistoryPager");
}

function paginateSortableTable(tableSelector, pagerSelector) {
		var pagerOptions = {

		// target the pager markup - see the HTML block below
		container: $(pagerSelector),

		// use this url format "http:/mydatabase.com?page={page}&size={size}&{sortList:col}"
		ajaxUrl: null,

		// modify the url after all processing has been applied
		customAjaxUrl: function(table, url) { return url; },

		// ajax error callback from $.tablesorter.showError function
		// ajaxError: function( config, xhr, settings, exception ){ return exception; };
		// returning false will abort the error message
		ajaxError: null,

		// add more ajax settings here
		// see http://api.jquery.com/jQuery.ajax/#jQuery-ajax-settings
		ajaxObject: { dataType: 'json' },

		// process ajax so that the data object is returned along with the total number of rows
		ajaxProcessing: null,

		// Set this option to false if your table data is preloaded into the table, but you are still using ajax
		processAjaxOnInit: false,

		// output string - default is '{page}/{totalPages}'
		// possible variables: {size}, {page}, {totalPages}, {filteredPages}, {startRow}, {endRow}, {filteredRows} and {totalRows}
		// also {page:input} & {startRow:input} will add a modifiable input in place of the value
		// In v2.27.7, this can be set as a function
		// output: function(table, pager) { return 'page ' + pager.startRow + ' - ' + pager.endRow; }
		output: '{startRow:input} &ndash; {endRow} / {totalRows} rows',

		// apply disabled classname (cssDisabled option) to the pager arrows when the rows
		// are at either extreme is visible; default is true
		updateArrows: true,

		// starting page of the pager (zero based index)
		page: 0,

		// Number of visible rows - default is 10
		size: 10,

		// Save pager page & size if the storage script is loaded (requires $.tablesorter.storage in jquery.tablesorter.widgets.js)
		savePages : true,

		// Saves tablesorter paging to custom key if defined.
		// Key parameter name used by the $.tablesorter.storage function.
		// Useful if you have multiple tables defined
		storageKey:'tablesorter-pager',

		// Reset pager to this page after filtering; set to desired page number (zero-based index),
		// or false to not change page at filter start
		pageReset: 0,

		// if true, the table will remain the same height no matter how many records are displayed. The space is made up by an empty
		// table row set to a height to compensate; default is false
		fixedHeight: false,

		// remove rows from the table to speed up the sort of large tables.
		// setting this to false, only hides the non-visible rows; needed if you plan to add/remove rows with the pager enabled.
		removeRows: false,

		// If true, child rows will be counted towards the pager set size
		countChildRows: false,

		// css class names of pager arrows
		cssNext: '.next', // next page arrow
		cssPrev: '.prev', // previous page arrow
		cssFirst: '.first', // go to first page arrow
		cssLast: '.last', // go to last page arrow
		cssGoto: '.gotoPage', // select dropdown to allow choosing a page

		cssPageDisplay: '.pagedisplay', // location of where the "output" is displayed
		cssPageSize: '.pagesize', // page size selector - select dropdown that sets the "size" option

		// class added to arrows when at the extremes (i.e. prev/first arrows are "disabled" when on the first page)
		cssDisabled: 'disabled', // Note there is no period "." in front of this class name
		cssErrorRow: 'tablesorter-errorRow' // ajax error information row

	};
	$(tableSelector).tablesorter({
		theme: 'blue',
		widthFixed: true,
		widgets: ['zebra', 'filter', 'staticRow']
	}).tablesorterPager(pagerOptions); //tablesorterPager(pagerOptions);
}

function onTxTableRefreshClick() {
	_txTableTopItemIndex = 0;
	getTransactions();
}

function existsPreviousPage (collatedTxArray) {
	var startIndex = _txTableTopItemIndex;
	while (startIndex >= 0){
		try {
			startIndex--;
			var currentTx = collatedTxArray[startIndex][0];
			if ((currentTx == null) || (currentTx == undefined)) {
				return (false);
			}
			switch (currentTx.type) {
				case "accountTransactions":
					if (transactionTableOptions.accountHistory) {
						var delta = new Number(currentTx.delta);
						if (delta > 0) {
							var winDeposit = false;
							if (nextTx != null) {
								if (nextTx.type == "winsTransactions") {
									winDeposit = true;
								}
							}							
							if (!winDeposit) {
								return (true);
							}
						} else if (delta < 0) {
							var betWithdrawal = false;
							if (previousTx != null) {
								if (previousTx.type == "betsTransactions") {
									betWithdrawal = true;
								}
							}
							//only include non-betting withdrawals
							if (!betWithdrawal) {
								return (true);
							}
						} 									
					}
					break;
				case "investmentsTransactions":
					if (transactionTableOptions.investmentHistory) {						
						return (true);
					}
					break;
				case "affiliateTransactions":
					if (transactionTableOptions.affiliateHistory) {						
						return (true);
					}
					break;
				case "betsTransactions":
					if (transactionTableOptions.gameHistory) {						
						return (true);
					}
					break;
				case "winsTransactions":
					if (transactionTableOptions.gameHistory) {						
						var totalWins = new BigNumber(0);
						for (var gameID in currentTx.wins.games) {
							var currentWin = convertAmount(currentTx.wins.games[gameID].btc, "btc", displayCurrency);
							totalWins = totalWins.plus(currentWin);
						}
						if (totalWins.greaterThan(0)) {
							return (true);
						}						
					} 
					break;
				default:					
					break;
			}
		} catch (err) {
			console.log (err);
			//return (false);
		}		
	}	
	return (false);
}

function existsNextPage (collatedTxArray, itemsPerPage) {
	var numItems = 0;
	var startIndex = _txTableTopItemIndex;
	while ((numItems <= itemsPerPage) && (startIndex < collatedTxArray.length)){
		startIndex++;
		try {			
			var currentTx = collatedTxArray[startIndex][0];			
			if ((currentTx == null) || (currentTx == undefined)) {
				return (false);
			}
			if (startIndex > 0) {
				var previousTx = collatedTxArray[startIndex-1][0];
			} else {
				previousTx = null;
			}
			if (startIndex < collatedTxArray.length) {
				var nextTx = collatedTxArray[startIndex+1][0];
			} else {
				nextTx = null;
			}
			switch (currentTx.type) {
				case "accountTransactions":
					if (transactionTableOptions.accountHistory) {
						var delta = new Number(currentTx.delta);
						if (delta > 0) {
							var winDeposit = false;
							if (nextTx != null) {
								if (nextTx.type == "winsTransactions") {
									winDeposit = true;
								}
							}							
							if (!winDeposit) {
								numItems++;
							}
						} else if (delta < 0) {
							var betWithdrawal = false;
							if (previousTx != null) {
								if (previousTx.type == "betsTransactions") {
									betWithdrawal = true;
								}
							}
							//only include non-betting withdrawals
							if (!betWithdrawal) {
								numItems++;
							}
						}
					}
					break;
				case "investmentsTransactions":
					if (transactionTableOptions.investmentHistory) {
						numItems++;
					}
					break;
				case "affiliateTransactions":
					if (transactionTableOptions.affiliateHistory) {
						numItems++;					
					}
					break;
				case "betsTransactions":
					if (transactionTableOptions.gameHistory) {
						numItems++;						
					}
					break;
				case "winsTransactions":
					if (transactionTableOptions.gameHistory) {						
						var totalWins = new BigNumber(0);
						for (var gameID in currentTx.wins.games) {
							var currentWin = convertAmount(currentTx.wins.games[gameID].btc, "btc", displayCurrency);
							totalWins = totalWins.plus(currentWin);						
						}						
						if (totalWins.greaterThan(0)) {
							numItems++;
						}						
					} 
					break;
				default:					
					break;
			}			
			if (numItems > itemsPerPage) {				
				return (true);
			}
		} catch (err) {
			return (false);
		}		
	}		
	return (false);
}

function buildTransactionTable(collatedTxArray, itemsPerPage, direction) {
	if ((itemsPerPage == null) || (itemsPerPage == undefined) || (isNaN(itemsPerPage))) {
		itemsPerPage = _txTableItemsPerPage;
	}	
	var returnHTML = "<div id=\"transactionHistory\"><table id=\"transactionHistoryTable\" class=\"tablesorter-blue\">";
	returnHTML += "<thead><tr>";
	returnHTML += "<th class=\"header\">Date</th>";
	returnHTML += "<th class=\"header\">Type</th>";
	returnHTML += "<th class=\"header\">Description</th>";
	returnHTML += "<th class=\"header\">Amount</th>";	
	returnHTML += "</tr></thead>";	
	/*
	returnHTML += "<tfoot><tr>";
	if (existsPreviousPage(collatedTxArray)) {		
		returnHTML += "<td><small><a href=\"#\" onclick=\"onTxTablePreviousClick()\">PREVIOUS</a></small></td>";
	} else {
		returnHTML += "<td>&nbsp;</td>";
	}	
	returnHTML += "<td><small><a href=\"#\" onclick=\"onTxTableRefreshClick()\">REFRESH</a></small></td>";
	returnHTML += "<td>&nbsp;</td>";
	if (existsNextPage(collatedTxArray, itemsPerPage)) {
		returnHTML += "<td style=\"text-align:right;\"><small><a href=\"#\" onclick=\"onTxTableNextClick()\">NEXT</a></small></td>";
	} else {
		returnHTML += "<td>&nbsp;</td>";
	}		
	returnHTML += "</tr>";
	returnHTML += "</tfoot>";
	*/
	returnHTML += "<tbody>";
	var itemsRendered = 0;
	var previousAffiliateCont = null;
	itemsPerPage = 1000000000;
	while (itemsRendered < itemsPerPage) {
		try {
			if (direction == "up") {
				_txTableTopItemIndex++;
			} else {
				_txTableTopItemIndex--;
			}
			var currentTx = collatedTxArray[_txTableTopItemIndex][0];
			if (_txTableTopItemIndex > 0) {
				var previousTx = collatedTxArray[_txTableTopItemIndex-1][0];
			} else {
				previousTx = null;
			}
			if (_txTableTopItemIndex < collatedTxArray.length) {
				var nextTx = collatedTxArray[_txTableTopItemIndex+1][0];
			} else {
				nextTx = null;
			}
			var rowHTML = "<tr>";
			rowHTML += "<td>"			
			rowHTML += createDateTimeString(new Date(currentTx.timestamp));
			rowHTML += "</td>";
			switch (currentTx.type) {
				case "accountTransactions":
					if (transactionTableOptions.accountHistory) {
						//track previous transaction to determine if it's a deposit or withdrawal
						var delta = new Number(currentTx.delta);
						if (delta > 0) {
							var winDeposit = false;
							if (nextTx != null) {
								if (nextTx.type == "winsTransactions") {
									winDeposit = true;
								}
							}							
							if (!winDeposit) {
								rowHTML += "<td>Deposit</td>";
								//rowHTML += "<td><span id\"account_deposit\">Balance: <b>"+convertAmount(currentTx.btc_balance, "btc", displayCurrency).toString(10)+"</b> "+displayCurrency+" ";
								//rowHTML += "<small>("+convertAmount(currentTx.change, "btc", displayCurrency).toString(10)+" "+displayCurrency+")</small></span></td>";	
								rowHTML += "<td>New account balance: <b>"+convertAmount(currentTx.btc_balance, "btc", displayCurrency).toString(10)+"</b> "+displayCurrency+" </td>";
								rowHTML += "<td>"+convertAmount(currentTx.delta, "btc", displayCurrency).toString(10)+"</td>";
								rowHTML += "</tr>";	
								itemsRendered++;
							} else {
								rowHTML = "";
							}
						} else if (delta < 0) {
							var betWithdrawal = false;
							if (previousTx != null) {
								if (previousTx.type == "betsTransactions") {
									betWithdrawal = true;
								}
							}
							//only include non-betting withdrawals
							if (!betWithdrawal) {
								rowHTML += "<td>Withdrawal</td>";
								rowHTML += "<td>New account balance: <b>"+convertAmount(currentTx.btc_balance, "btc", displayCurrency).toString(10)+"</b> "+displayCurrency+" </td>";
								rowHTML += "<td>"+convertAmount(currentTx.delta, "btc", displayCurrency).toString(10)+"</td>";	
								rowHTML += "</tr>";	
								itemsRendered++;	
							} else {
								rowHTML = "";
							}
						} else {
							//do we want to include this? (change is always 0)
							//rowHTML += "<td>Account Update</td>";
							//rowHTML += "<td><span id\"account_update\">Balance: <b>"+convertAmount(currentTx.btc_balance, "btc", displayCurrency).toString(10)+"</b> "+displayCurrency+" <small>(no change)</small></span></td>";															
							//rowHTML += "</tr>";	
							//itemsRendered++;
							rowHTML = "";
						}
					} else {
						rowHTML = "";
					}
					break;
				case "investmentsTransactions":
					if (transactionTableOptions.investmentHistory) {
						//track previous transaction to determine if it's a deposit or withdrawal
						rowHTML = "";
						for (var count2 = 0; count2<currentTx.investments.length; count2++) {
							var deltaBTC = currentTx.investments[count2].delta;
							var changeBTC = currentTx.investments[count2].change;
							if (changeBTC != "0") {
								//0 transactions are usually initial deposits -- omit these for now
								rowHTML += "<tr>";
								rowHTML += "<td>"			
								rowHTML += createDateTimeString(new Date(currentTx.timestamp));
								rowHTML += "</td>";		
								rowHTML += "<td>Investments Transaction</td>";
								var investmentID = currentTx.investments[count2].investment_id;
								var investmentBalanceBTC = currentTx.investments[count2].investment_balance_btc;
								var userInvestmentBalanceBTC = currentTx.investments[count2].user_investment_btc;
								var userInvestmentBaseBTC = currentTx.investments[count2].user_investment_base_btc;
								rowHTML += "<td>";
								rowHTML += "\""+investmentID+"\" distribution: <b>"+convertAmount(userInvestmentBaseBTC, "btc", displayCurrency).toString(10)+"</b> "+displayCurrency+" book value / ";
								rowHTML += "<b>"+convertAmount(userInvestmentBalanceBTC, "btc", displayCurrency).toString(10)+" "+displayCurrency+"</b> current value.";
								rowHTML += "</td>";
								rowHTML += "<td><b>"+convertAmount(changeBTC, "btc", displayCurrency).toString(10)+"</b></td>";
								rowHTML += "</tr>";	
							} 
						}
						if (rowHTML != "") {
							itemsRendered++;
						}
					} else {
						rowHTML = "";
					}
					break;
				case "affiliateTransactions":
					if (transactionTableOptions.affiliateHistory) {						
						var currentAffiliateCont = getAffiliateContribution(currentTx.balance, previousAffiliateCont);						
						//track previous transaction to determine if it's a deposit or withdrawals
						rowHTML += "<td>Affiliate Transaction</td>";
						rowHTML += "<td>Referral: <b>"+currentAffiliateCont.account+"</b></td>";
						rowHTML += "<td>"+convertAmount(currentAffiliateCont.btc, "btc", displayCurrency).toString(10)+"</td>";
						rowHTML += "</tr>";	
						previousAffiliateCont = currentTx.balance;
						itemsRendered++;
					} else {
						rowHTML = "";
					}
					break;
				case "betsTransactions":
					if (transactionTableOptions.gameHistory) {
						var minusOne = new BigNumber(-1);
						rowHTML += "<td>Bet</td>";
						rowHTML += "<td></td>";
						rowHTML += "<td>"+convertAmount(currentTx.bet.btc, "btc", displayCurrency).times(minusOne).toString(10)+"</td>";
						rowHTML += "</tr>";	
						itemsRendered++;
					} else {
						rowHTML = "";
					}
					break;
				case "winsTransactions":
					if (transactionTableOptions.gameHistory) {
						rowHTML += "<td>Win</td>";
						rowHTML += "<td></td>";
						var totalWins = new BigNumber(0);
						for (var gameID in currentTx.wins.games) {
							var currentWin = convertAmount(currentTx.wins.games[gameID].btc, "btc", displayCurrency);
							totalWins = totalWins.plus(currentWin);
							rowHTML += "<td>"+currentWin.toString(10)+"</td>";
						}
						rowHTML += "</tr>";
						if (totalWins.greaterThan(0)) {
							itemsRendered++;
						} else {
							rowHTML = "";
						}
					} else {
						rowHTML = "";
					}
					break;
				default:					
					break;
			}			
			returnHTML += rowHTML;
		} catch (err) {
		}
		if (_txTableTopItemIndex > (collatedTxArray.length - 1)) {
			//end of available items
			itemsRendered = itemsPerPage;
			_txTableTopItemIndex = collatedTxArray.length - 1;
		}
		if (_txTableTopItemIndex < 0) {
			itemsRendered = itemsPerPage;
			_txTableTopItemIndex = 0;
		}
	}
	returnHTML += "</tbody></table></div>";	
	if (itemsRendered == 0) {
		return (null);
	}
	return (returnHTML);
}

function getAffiliateContribution (currentBalanceObj, previousBalanceObj) {
	if ((currentBalanceObj["contributions"] == null) || (currentBalanceObj["contributions"] == undefined)) {
		return (null);
	}
	var contributions = currentBalanceObj.contributions;
	for (var account in contributions) {
		//'account' is the contributing account (the account contributing to the current affiliate)
		var currentContribution = contributions[account];
		currentContribution.account = account;
		if ((previousBalanceObj == null) || (previousBalanceObj==undefined) || (previousBalanceObj["contributions"]==null) || (previousBalanceObj["contributions"]==undefined)) {
			return (currentContribution);
		}
		var previousContribution = previousBalanceObj.contributions[account];
		var currentTotalBTC = new BigNumber(currentContribution.btc_total);
		var previousTotalBTC = new BigNumber(previousContribution.btc_total);
		if (currentTotalBTC.equals(previousTotalBTC) == false) {
			return (currentContribution);
		}
	}
	return (null);
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

function collateTransactions(txResults) {
	var returnArray = new Array();
	var newestTxArray = null;
	var newestTxIndex = null;
	var newestTxType = null;
	var newestTxDate = new Date(1970,0,0);
	var itemsRemaining = true;
	var itemExtracted = false;
	var maxCount = 5000;
	while (itemsRemaining && (maxCount > 0)) {
		maxCount--;
		itemsRemaining = false;
		newestTxArray = null;
		newestTxIndex = null;
		newestTxType = null;
		itemExtracted = false;
		for (var txTypes in txResults) {
			var txArray = txResults[txTypes];			
			for (var count = 0; count < txArray.length; count++) {
				itemsRemaining = true;
				var currentTx = txArray[count];
				var currentTxDate = new Date(currentTx.timestamp);
				if (currentTxDate.valueOf() >= newestTxDate.valueOf()) {
					itemExtracted = true;
					newestTxArray = txArray;
					newestTxIndex = count;
					newestTxDate = currentTxDate;
					newestTxArray[newestTxIndex].type = txTypes; //retain transaction type information
				}
			}
		}
		if (newestTxArray != null) {
			returnArray.push(newestTxArray.splice(newestTxIndex, 1));
			
		}
		if (itemExtracted == false) {
			//if no item found with newest date, reset back to beginning
			newestTxDate = new Date(1970,0,0);
		}
	}
	//calculate deltas between values by running through array backwards (oldest to newest)
	var previousAccountTx = null;
	var previousInvestmentTx = null;
	for (count = returnArray.length-1; count >= 0; count--) {
		currentTx = returnArray[count][0];
		switch (currentTx.type) {
			case "accountTransactions":
				if (previousAccountTx != null) {
					var previousBalance = new BigNumber(previousAccountTx.btc_balance);
					var currentBalance = new BigNumber(currentTx.btc_balance);
					var delta = currentBalance.minus(previousBalance);
					currentTx.change = delta.toString(10);
					currentTx.delta = delta.toString(10);
				} else {
					currentTx.delta = "0";
					currentTx.change = "0";
				}
				previousAccountTx = currentTx;
				break;
			case "investmentsTransactions":
				insertInvestmentDeltas (previousInvestmentTx, currentTx);
				previousInvestmentTx = currentTx;
				break;
			default: break;
		}		
	}
	return (returnArray);
}

function getUserInvestment(investmentID, ownedInvestmentsArr) {
	for (var count = 0; count < ownedInvestmentsArr.length; count++) {
		if (ownedInvestmentsArr[count].investment_id == investmentID) {
			return (ownedInvestmentsArr[count]);
		}
	}
	return (null);
}

function insertInvestmentDeltas(previousInvestmentsTx, currentInvestmentsTx) {
	if (previousInvestmentsTx == undefined) {
		previousInvestmentsTx = null;
	}
	for (var count=0; count< currentInvestmentsTx.investments.length; count++) {
		var currentTx = currentInvestmentsTx.investments[count];
		currentTx.change = "0";
		currentTx.delta = "0 (initial deposit)";
		if (previousInvestmentsTx != null) {
			var previousTx = findInvestmentByID(currentTx.investment_id, previousInvestmentsTx.investments);
			if (previousTx != null) {
				previousInvBalance = new BigNumber(previousTx.user_investment_btc);
				currentInvBalance = new BigNumber(currentTx.user_investment_btc);
				currentTx.delta = currentInvBalance.minus(previousInvBalance);
				if (currentTx.delta.greaterThan(0)) {
					currentTx.change = "+"+currentTx.delta.toString(10);
				} else {
					currentTx.change = currentTx.delta.toString(10);
				}
				currentTx.delta = currentTx.delta.toString(10);
			}
		}
	}
}

function findInvestmentByID(investmentID, investmentsArr) {
	for (var count = 0; count < investmentsArr.length; count++) {
		if (investmentsArr[count].investment_id == investmentID) {
			return (investmentsArr[count]);
		}
	}
	return (null);
}

function onGetAffiliateLink(returnData) {
	if ((returnData["error"] != undefined) && (returnData["error"] != null) && (returnData["error"] != "")) {
		//affiliate link not available!
	} else {
		accountInfo.affiliateID = returnData.result.affiliateID;
		var affiliateLink = "<div id=\"link\"><a href=\""+returnData.result.url+"\" target=\"_blank\">"+returnData.result.url+"</a></div>"
		$("#affiliate #link").replaceWith(affiliateLink);
		getAffiliateInfo(returnData.result.affiliateID);
	}
}

function onGetTransactions(returnData) {
	//console.log(JSON.stringify(returnData));
	if ((returnData["error"] != undefined) && (returnData["error"] != null) && (returnData["error"] != "")) {
		alert (returnData.error.message);
	} else {
		_txTableTopItemIndex = 0;
		currentTransactionsData = collateTransactions(returnData.result);
		var txTable = buildTransactionTable(currentTransactionsData, _txTableItemsPerPage, "up");
		$("#transactionHistory").replaceWith(txTable);
		paginateSortableTable("#transactionHistory #transactionHistoryTable", "#transactionHistoryPager");
	}
}

function onGetAffiliateInfo(returnData) {
	if ((returnData["error"] != undefined) && (returnData["error"] != null) && (returnData["error"] != "")) {
		//affiliate link not available!
	} else {
		$("#affiliate").show();
		if ((returnData.result.info[0].balance["btc"] == undefined) || (returnData.result.info[0].balance["btc"] == null) || (returnData.result.info[0].balance["btc"] == "")) {
			var totalEarnings = "<div id=\"total\"><b>Total affiliate earnings (";
			switch (displayCurrency) {
				case "btc": totalEarnings += "BTC"; break;
				case "satoshis": totalEarnings += "satoshis"; break;
				case "tokens": totalEarnings += "tokens"; break;
				default: break;
			}
			totalEarnings += "):</b> 0</div><br/>";
			var infoTable = "";
		} else {
			totalEarnings = "<div id=\"total\"><b>Total affiliate earnings (";
			switch (displayCurrency) {
				case "btc": totalEarnings += "BTC"; break;
				case "satoshis": totalEarnings += "satoshis"; break;
				case "tokens": totalEarnings += "tokens"; break;
				default: break;
			}
			totalEarnings += "):</b> "+convertAmount(returnData.result.info[0].balance.btc, "btc", displayCurrency).toString(10)+"</div><br/>";
			infoTable = "<div id=\"details\"><table id=\"affiliateContributionsTable\" class=\"tablesorter-blue\">";
			infoTable += "<thead><tr>";
			infoTable += "<th class=\"header\"><b>Referral</b></th>";
			infoTable += "<th class=\"header\"><b>";
			switch (displayCurrency) {
				case "btc": infoTable += "BTC"; break;
				case "satoshis": infoTable += "Satoshis"; break;
				case "tokens": infoTable += "Tokens"; break;
				default: break;
			}
			infoTable += " (total contributions)</b></th>";
			infoTable += "</tr></thead>";
			infoTable += "<tbody>";
			if (typeof(returnData.result.info[0].balance.contributions) == "object") {
				var balanceInfoObj = returnData.result.info[0].balance.contributions;
				for (var item in balanceInfoObj) {
					infoTable += "<tr>";
					infoTable += "<td><a href=\"#\" onclick=\"getReferralInfo('"+item+"')\"> "+item+"</a></td>";
					infoTable += "<td>"+convertAmount(balanceInfoObj[item].btc_total, "btc", displayCurrency).toString(10)+"</td>";
					infoTable += "</tr>";
				}
			}
			infoTable += "</tbody>";
			infoTable += "</table></div>";
		}
		$("#affiliate #info").replaceWith("<div id=\"info\">"+totalEarnings+infoTable+"</div>");
	}
	paginateSortableTable("#affiliate #info #details #affiliateContributionsTable", "#affiliate #affiliateContributionsPager")
	//paginateSortableTable("#affiliate #info #details #affiliateContributions", "#affiliate #affiliateContributionsPager");
	$("#withdrawButton").removeClass("disabled").addClass("active");
	$("#depositButton").removeClass("disabled").addClass("active")
	getTransactions();
}

function onGetReferralInfo(returnData) {
	if ((returnData["error"] != undefined) && (returnData["error"] != null) && (returnData["error"] != "")) {
		//affiliate link not available!
	} else {
		try {
			var tableHeader = "<div id=\"total\"><b>Affiliate history for:</b> "+returnData.result.referral+"</div><br/>";
			var infoTable = "<div id=\"details\"><table id=\"affiliateContributionsTable\" class=\"tablesorter-blue\">";	
			infoTable += "<thead><tr>";
			switch (displayCurrency) {
				case "btc" :
					infoTable += "<th class=\"header\"><b>Bitcoin Contribution</b></th>";
					infoTable += "<th class=\"header\"><b>Bitcoin Total Contributions</b></th>";
					infoTable += "<th class=\"header\"><b>Date</b></th>";
					break;
				case "satoshis" :
					infoTable += "<th class=\"header\"><b>Satoshis Contribution</b></th>";
					infoTable += "<th class=\"header\"><b>Satoshis Total Contributions</b></th>";
					infoTable += "<th class=\"header\"><b>Date</b></th>";
					break;
				case "tokens" :
					infoTable += "<th class=\"header\"><b>Tokens Contribution</b></th>";
					infoTable += "<th class=\"header\"><b>Tokens Total Contributions</b></th>";
					infoTable += "<th class=\"header\"><b>Date</b></th>";
					break;
				default:
					infoTable += "<th class=\"header\"><b>Contribution</b></th>";
					infoTable += "<th class=\"header\"><b>Total Contributions</b></th>";
					infoTable += "<th class=\"header\"><b>Date</b></th>";
					break;
			}
			infoTable += "</tr></thead><tbody>";
			for (var count=0; count < returnData.result.info.length; count++) {
				var infoObj = returnData.result.info[count];
				infoTable += "<tr>";
				infoTable += "<td>"+convertAmount(infoObj.btc, "btc", displayCurrency)+"</td>";
				infoTable += "<td>"+convertAmount(infoObj.btc_total, "btc", displayCurrency)+"</td>";
				infoTable += "<td>"+createDateTimeString(new Date(infoObj.last_update))+"</td>"; //maybe convert to Date object for nicer display?
				infoTable += "</tr>";
			}
			infoTable += "</tbody></table></div>";
			infoTable += "<div id=\"backLink\"><a href=\"#\" onclick=\"getAffiliateInfo('"+accountInfo.affiliateID+"')\"><<< BACK</a></div>";
		} catch (err) {
			var tableHeader = "<div id=\"total\"><b>Affiliate history not found!<br/>";
			var infoTable = "";
		}
		$("#affiliate #info").replaceWith("<div id=\"info\">"+tableHeader+infoTable+"</div>");
		paginateSortableTable("#affiliate #info #details #affiliateContributionsTable", "#affiliate #affiliateContributionsPager")
	}
}

function onDepositClick(event) {
	if ($("#depositBuitton").hasClass("disabled")) {
		return;
	}
	try {
		var depositBTC = new BigNumber($("#depositAmountInput").val());
	} catch (err) {
		alert ("Enter a valid deposit amount.");
		return;
	}
	if (depositBTC.lessThanOrEqualTo(0)) {
		alert ("Deposit amount must be greater than 0.");
		return;
	}
	var accountBTC = new BigNumber(accountInfo.confirmedBTCBalance);
	if (accountBTC.lessThanOrEqualTo(0)) {
		//alert ("Insufficient confirmed funds to make deposit. Current funds: "+accountBTC.toString());
		//return;
	}
	accountBTC = accountBTC.minus(depositBTC);
	accountInfo.currentBTCBalance = accountBTC.toString();
	var updateObj = new Object();
	updateObj.account = accountInfo.playerAccount;
	updateObj.password = accountInfo.playerPassword;
	updateObj.investment_id = $("#investmentSelectorDeposit").val();
	updateObj.transaction = new Object();
	updateObj.transaction.deposit = new Object();
	updateObj.transaction.deposit.btc = depositBTC.toString();	
	clearAllFields();
	callServerMethod("updateInvestorInfo", updateObj, onCompleteDeposit);
}

function onWithdrawClick(event) {
	if ($("#withdrawButton").hasClass("disabled")) {
		return;
	}
	try {
		var withdrawBTC = new BigNumber($("#withdrawAmountInput").val());
	} catch (err) {
		alert ("Enter a valid withdrawal amount.");
		return;
	}
	if (withdrawBTC.lessThanOrEqualTo(0)) {
		alert ("Withdrawal amount must be greater than 0.");
		return;
	}
	$("#withdrawButton").removeClass("active").addClass("disabled");
	$("#depositButton").removeClass("active").addClass("disabled");
	var accountBTC = new BigNumber(accountInfo.confirmedBTCBalance);
	accountBTC = accountBTC.plus(withdrawBTC);
	accountInfo.currentBTCBalance = accountBTC.toString();
	var updateObj = new Object();
	updateObj.account = accountInfo.playerAccount;
	updateObj.password = accountInfo.playerPassword;
	updateObj.investment_id = $("#investmentSelectorWithdraw").val();
	updateObj.transaction = new Object();
	updateObj.transaction.withdraw = new Object();
	updateObj.transaction.withdraw.btc = withdrawBTC.toString();	
	clearAllFields();
	callServerMethod("updateInvestorInfo", updateObj, onCompleteWithdraw);
}

function onUpdateBRMClick(event) {
	event.preventDefault();
	var updateObj = new Object();
	updateObj.account = accountInfo.playerAccount;
	updateObj.password = accountInfo.playerPassword;
	updateObj.investment_id = "smb"
	updateObj.bankroll_multiplier = Number($("#bankrollMultiplier #multiplierInputForm #multiplierNumberInput").val());
	updateObj.transaction = new Object();
	updateObj.transaction.deposit = new Object();
	updateObj.transaction.deposit.btc = "0";
	callServerMethod("updateInvestorInfo", updateObj, onUpdateBRM);
}

function onUpdateBRM(returnData) {
	if ((returnData["error"] != undefined) && (returnData["error"] != null) && (returnData["error"] != "")) {
		alert(returnData.error.message);
	} else {
		alert("Bankroll multiplier updated.");
	}
}

function onCompleteDeposit(returnData) {
	if ((returnData["error"] != undefined) && (returnData["error"] != null) && (returnData["error"] != "")) {
		alert(returnData.error.message);
		getAccountBalance();
	} else {
		getAccountBalance();
	}
}

function onCompleteWithdraw(returnData) {
	if ((returnData["error"] != undefined) && (returnData["error"] != null) && (returnData["error"] != "")) {
		alert(returnData.error.message);
		getAccountBalance();
	} else {
		getAccountBalance();
	}
}

//called by external window handler to start main functionality
function setAccountInfo(accountInfoStr) {
	alert ("setAccountInfo");
	accountInfo = JSON.parse(accountInfoStr);
	for (var item in accountInfo) {
		alert (item+" = "+accountInfo[item]);
	}
	$("#depositButton").button();
    $("#depositButton").click(onDepositClick);
	$("#investmentSelectorDeposit").menu();
	getAccountBalance();
}

function updateAccountBalance(balanceVal, confBalanceVal, uncBalanceVal) {
	if ((balanceVal == null) || (balanceVal == undefined) || (balanceVal == "")) {
		balanceVal = "0";
	}
	if ((confBalanceVal == null) || (confBalanceVal == undefined) || (confBalanceVal == "")) {
		confBalanceVal = "0";
	}
	if ((uncBalanceVal == null) || (uncBalanceVal == undefined) || (uncBalanceVal == "")) {
		uncBalanceVal = "0";
	}
	var availBalance = new BigNumber(balanceVal);
	var unconfirmedBalance = new BigNumber(uncBalanceVal);
	availBalance = availBalance.minus(unconfirmedBalance);
	if (availBalance.lessThan(0)) {
		availBalance = new BigNumber(0);
	}
	$("#balance #amount").replaceWith("<div id=\"amount\">BTC "+String(availBalance)+" available, "+String(confBalanceVal)+" confirmed, "+String(uncBalanceVal)+" unconfirmed</div>");
}

function onBankrollMultiplierSliderInput(event) {
	var sliderValue = $("#bankrollMultiplier #multiplierInputForm #multiplierRangeInput").val();
	$("#bankrollMultiplier #multiplierInputForm #multiplierNumberInput").val(sliderValue);
}

function onBankrollMultiplierNumberInput(event) {
	var inputValue = $("#bankrollMultiplier #multiplierInputForm #multiplierNumberInput").val();
	$("#bankrollMultiplier #multiplierInputForm #multiplierRangeInput").val(Number(inputValue));
}

function onDisplayCurrencyUpdate(event) {
	if (localStorage.getItem("options") == null) {
		var options = new Object();
	} else {
		options = JSON.parse(localStorage.options);
	}
	options.displayCurrency = $("#displayCurrencySelector").val();
	displayCurrency = options.displayCurrency;
	localStorage.options = JSON.stringify(options);
	getAccountBalance();
}

/**
* Processes all settings changes made to localStorage by child (or parent) windows.
*/
function onSettingsChanged(event) {
	var loggedOut = false;
	try {
		if ((localStorage.playerAccount == null) ||	(localStorage.playerPassword == null) || 
			(localStorage.playerAccount == undefined) || (localStorage.playerPassword == undefined) ||
			(localStorage.playerAccount == "") || (localStorage.playerPassword == "")) {
				loggedOut = true;
		}
	} catch (err) {
		loggedOut = true;
	}
	if (loggedOut) {
		accountInfo.playerAccount = null;
		accountInfo.playerPassword = null;
		$("body").replaceWith("<body>You have been logged out of the main window. Please log in again and reload this page.</body>");
		window.close();
	}
}

/**
* Asserts any found primitive value (sring, number, boolean) to another value recursively within any complex object type. This function is NOT safe to use with circular references!
*
* @param valueToReplace The primitive value to recursively find and replace. 
* @param replaceValue The value to replace 'valueToReplace' by wherever found.
* @param dataObject The object within which to recursively search for 'valueToReplace' and replace with 'replaceValue'.
*/
function assertAnyValue(valueToReplace, replaceValue, dataObject) {
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


function onUpdatePasswordClick(event) {
	if (localStorage.getItem("lastPasswordUpdate") != null) {
		var lastUpdateObj = new Date(localStorage.lastPasswordUpdate);
		var lastUpdated = lastUpdateObj.valueOf()+(passwordUpdateInterval*60000); //passwordUpdateInterval is in minutes
		var deltaMinutes = (lastUpdated - Date.now()) / 60000;	
		if (deltaMinutes > 0) {			
		//	alert("You must wait at least "+String(Math.ceil(deltaMinutes))+" minute(s) before another password reset attempt.");
		//	return;
		}
	}
	var currentPassword = new String($("#updatePassword #currentPassword").val());
	var newPassword = new String($("#updatePassword #newPassword").val());
	var confirmPassword = new String($("#updatePassword #confirmPassword").val());	
	if ((currentPassword.split(" ").join("") == "") || (newPassword.split(" ").join("") == "") || (confirmPassword.split(" ").join("") == "")){
		alert ("Password fields must not be empty.");		
		return;
	};
	try {
		var accountUpdateObj = JSON.parse(localStorage.accountUpdate);
		if ((accountUpdateObj == null) || (accountUpdateObj == undefined)) {
			accountUpdateObj = new Object();
		}
	} catch (err) {
		accountUpdateObj = new Object();
	}	
	accountUpdateObj.playerPassword = newPassword;
	localStorage.accountUpdate = JSON.stringify(accountUpdateObj);
	var params = new Object();				  
	params.email = accountInfo.playerEmail;
	params.account = accountInfo.playerAccount;
	params.password = newPassword;
	params.currentPassword = currentPassword;
	params.resetCode = ""; //required parameter
	callServerMethod("passwordReset", params, onResetPassword);  
}

function onResetPassword(resultData) {	
	if (resultData.error != null) {
		alert(resultData.error.message);
	} else {
		var accountUpdateObj = JSON.parse(localStorage.accountUpdate);
		dateObj = new Date();		
		localStorage.lastPasswordUpdate = dateObj.toISOString();
		localStorage.playerPassword = accountUpdateObj.playerPassword;
		alert("Password successfully updated.");
	}
}

//window onload handler
function start() {
	// COMMENT SECTION BELOW IF STARTING AS POPUP
	accountInfo.playerAccount = localStorage.playerAccount;
	accountInfo.playerPassword = localStorage.playerPassword;
	accountInfo.playerEmail = localStorage.getItem("playerEmail");
	accountInfo.gameServerURL = localStorage.gameServerURL;	
	$("#depositButton").button();
    $("#depositButton").click(onDepositClick);
	$("#withdrawButton").button();
    $("#withdrawButton").click(onWithdrawClick);
	$("#withdrawButton").removeClass("active").addClass("disabled");
	$("#depositButton").removeClass("active").addClass("disabled")
	$("#bankrollMultiplier #multiplierInputForm #updateBRMButton").button();
	$("#bankrollMultiplier #multiplierInputForm #updateBRMButton").click(onUpdateBRMClick);
	$("#updatePassword #updatePasswordButton").button();
	$("#updatePassword #updatePasswordButton").click(onUpdatePasswordClick);
	$("#investmentSelectorDeposit").menu();
	$("#investmentSelectorWithdraw").menu();
	$("#bankrollMultiplier #multiplierInputForm #multiplierRangeInput").on("change", onBankrollMultiplierSliderInput);
	$("#bankrollMultiplier #multiplierInputForm #multiplierNumberInput").on("change", onBankrollMultiplierNumberInput);
	try {
		var options = JSON.parse(localStorage.options);
		displayCurrency = options.displayCurrency;
	} catch (err) {
		displayCurrency = "tokens";
	}
	var displayCurrencyHTML = "<select name=\"displayCurrency\" id=\"displayCurrencySelector\">";
	switch (displayCurrency) {
		case "btc":
			displayCurrencyHTML += "<option value=\"tokens\">Tokens</option>";
			displayCurrencyHTML += "<option value=\"btc\" selected=\"selected\">Bitcoins</option>";
			displayCurrencyHTML += "<option value=\"satoshis\">Satoshis</option>";
			break;
		case "satoshis":
			displayCurrencyHTML += "<option value=\"tokens\">Tokens</option>";
			displayCurrencyHTML += "<option value=\"btc\">Bitcoins</option>";
			displayCurrencyHTML += "<option value=\"satoshis\" selected=\"selected\">Satoshis</option>";
			break;
		case "tokens":
			displayCurrencyHTML += "<option value=\"tokens\" selected=\"selected\">Tokens</option>";
			displayCurrencyHTML += "<option value=\"btc\">Bitcoins</option>";
			displayCurrencyHTML += "<option value=\"satoshis\">Satoshis</option>";
			break;
		default:
			displayCurrencyHTML += "<option value=\"tokens\" selected=\"selected\">Tokens</option>";
			displayCurrencyHTML += "<option value=\"btc\">Bitcoins</option>";
			displayCurrencyHTML += "<option value=\"satoshis\">Satoshis</option>";
			break;
	}
	displayCurrencyHTML += "</select>";
	$("#displayCurrencySelector").replaceWith(displayCurrencyHTML);
	$("#displayCurrencySelector").on("change", onDisplayCurrencyUpdate);
	$(window).bind("storage", onSettingsChanged);
	getAccountBalance();
	// COMMENT SECTION ABOVE IF STARTING AS POPUP
	ready = true;
}