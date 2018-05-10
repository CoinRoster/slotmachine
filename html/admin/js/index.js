var ready = false;
var accountInfo = {};
var rpcMsgID = 0;
var availableInvestments = new Object();
var _txTablePageNum = 0; // current page number within the transaction history table
var _txTableItemsPerPage = 5; //items per page of the transaction history table
var currentTransactionsData = null; //currently loaded transactions data
var transactionTableOptions = new Object(); //transaction history filter options
transactionTableOptions.accountHistory = true;
transactionTableOptions.gameHistory = true;
transactionTableOptions.investmentHistory = true;
transactionTableOptions.affiliateHistory = true;
var batchTransferAccounts = new Array();
var currentBatchTransferAccount = null;
var currentTransferButton = null;

//Sum of assets and liabilities as displayed in the balance sheet:
var assetsTotal = new BigNumber(0);
var liabilitiesTotal = new BigNumber(0);
var satoshisPerBitcoin = new BigNumber("100000000"); //as described

var defaultTransferTargetAddress = ""; // default transfer-to Bitcoin address for use with dormant accounts
var blockchainAPI = new Object();
blockchainAPI.mainnet = new Object();
blockchainAPI.testnet = new Object();
blockchainAPI.provider = "Blockchain.info"; //symbolic name
blockchainAPI.mainnet.checkBalanceAddress = "https://blockchain.info/q/addressbalance/%addr%?confirmations=0";
blockchainAPI.testnet.checkBalanceAddress = "https://testnet.blockchain.info/q/addressbalance/%addr%?confirmations=0";
//blockchainAPI.testnet.checkBalanceAddress = "https://testnet.blockexplorer.com/api/addr/%addr%";
//blockchainAPI.mainnet.checkBalanceAddress = "https://blockexplorer.com/api/addr/%addr%";



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

function getRakeStats() {
	var searchParams = new Object();
	searchParams.searchType = "recent";
	searchParams.txTypes = ["account", "investments", "affiliate", "bets", "wins"];
	searchParams.search = 1000;
	callServerMethod("admin_getRakeStats",{}, onGetRakeStats);
}

function getAssets() {
	callServerMethod("admin_getAccounts",{"type":"havebalance, wallets, coldstorage"}, onGetAssets);	
}

function getLiabilities() {
	callServerMethod("getInvestmentStats", {"user_balances":true, "investments_total":true, "investments_charts":true, "jackpots":true, "rake":true}, onGetLiabilities);
}

function onGetLiabilities(returnData) {	
	if ((returnData["error"] != undefined) && (returnData["error"] != null) && (returnData["error"] != "")) {
		alert(returnData.error.message);
	} else {
		var liabTable = buildBalanceSheetLiabilities(returnData.result);
		liabTable += generatePagerDiv("balanceSheetLiabilitiesPager");
		$("#balanceSheetLiabilities").replaceWith(liabTable);
		paginateSortableTable("#balanceSheetLiabilities table", "#balanceSheetLiabilitiesPager");
		updateLiabilitiesTotal(liabilitiesTotal.toString(10));
		getDividendTransactions();
	}
}

function getDividendTransactions() {
	callServerMethod("admin_getInvestmentsHistory", {}, onGetDividendTransactions);
}

function onGetDividendTransactions(returnData) {
	if ((returnData["error"] != undefined) && (returnData["error"] != null) && (returnData["error"] != "")) {
		alert(returnData.error.message);
	} else {
		var dtTable = buildDividendTransactionsTable(returnData.result);
		dtTable += generatePagerDiv("dividendTransactionsPager");
		$("#dividendTransactionsTable").replaceWith(dtTable);
		paginateSortableTable("#dividendTransactionsTable table", "#dividendTransactionsPager");
	}
	
}

function buildRakeTransactionTable(collatedTxArray) {
	var returnHTML = "<div id=\"rakeAccountHistory\"><table>";
	returnHTML += "<thead><tr>";
	returnHTML += "<th class=\"header\">Date</th>";
	returnHTML += "<th class=\"header\">Description</th>";
	returnHTML += "<th class=\"header\">Amount (BTC)</th>";
	returnHTML += "<th class=\"header\">Balance (BTC)</th>";
	returnHTML += "</tr></thead>";
	returnHTML += "<tbody>";
	var investmentHistory = new Object();
	for (var count = 0; count < collatedTxArray.length; count++) {
		try {			
			var currentTx = collatedTxArray[count];						
			for (var count2 = 0; count2 < currentTx.investments.length; count2++) {
				var investmentID = currentTx.investments[count2].investment_id;
				var investmentBalanceBTC = currentTx.investments[count2].user_investment_btc;
				var userInvestmentBalanceBTC = currentTx.investments[count2].user_investment_btc;
				var userInvestmentBaseBTC = currentTx.investments[count2].user_investment_base_btc;	
				var rowHTML = "<tr>";
				rowHTML += "<td>"
				rowHTML += createDateTimeString(new Date(currentTx.timestamp));
				rowHTML += "</td>";			
				rowHTML += "<td>"+currentTx.name+"</td>";
				rowHTML += "<td><span id\"rake_transaction\">"+currentTx.investments[count2].change+"</span></td>";
				rowHTML += "<td>"+investmentBalanceBTC+"</td>";	
				rowHTML += "</tr>";
				returnHTML += rowHTML;
			}
		} catch (err) {
			alert (err);
		}		
	}
	returnHTML += "</tbody></table></div>";
	return (returnHTML);
}

/**
* Transfers all of the confirmed funds from a specified Bitcoin account to a target Bitcoin account.
*
* @param btcAmount A numeric string representing the amount, in Bitcoin, to transfer.
* @param sourceAddress The source Bitcoin address from which to transfer all available funds.
* @param targetAddress The target Bitcoin address to which to transfer the funds to. If not supplied, null, or an empty string, the 'defaultTransferTargetAddress' value is used.
* @param sourceButton A reference to the source HTMLButton element invoking this function.
*
*/
function transferAccountFunds(btcAmount, sourceAddress, targetAddress, sourceButton) {
	if ((targetAddress==null) || (targetAddress==undefined) || (targetAddress=="")) {
		targetAddress = $("#transferTargetAddress").val();
	}
	if ((targetAddress==null) || (targetAddress==undefined) || (targetAddress=="")) {
		alert ("No target address specified. Cannot transfer funds.");
		throw (new Error("No target address specified. Cannot transfer funds."));
	}
	var params = new Object();
	params.account = sourceAddress;
	params.receiver = targetAddress;
	params.btc = btcAmount;
	currentBatchTransferAccount = sourceAddress;
	$(sourceButton).replaceWith("<button class=\"transferButton\" data =\""+sourceAddress+"\" disabled>Transfer pending...</button>");
	callServerMethod("admin_transferAccountFunds", params, onTransferAccountFunds);
}

function onTransferAllAccountsClick(event) {
	if (batchTransferAccounts.length > 0) {
		alert ("Multiple transfer operations ara still active!");
		return;
	}
	$(".transferButton").each(function(index) {
		var sourceAccount = $(this).attr("data");
		batchTransferAccounts.push(sourceAccount);
		$(this).replaceWith("<button class=\"transferButton\" data =\""+sourceAccount+"\" disabled>Transfer pending...</button>");
	});
	transferNextBatchedAccount();
}

function transferNextBatchedAccount() {
	if (batchTransferAccounts.length < 1) {
		//batch transfers are all done!
		return;
	}
	currentBatchTransferAccount = batchTransferAccounts.shift(); // take it off the top
	var	targetAddress = $("#transferTargetAddress").val();
	var params = new Object();
	params.account = currentBatchTransferAccount;
	params.receiver = targetAddress;
	callServerMethod("admin_transferAccountFunds", params, onTransferNextBatchedAccount);
}

function onTransferNextBatchedAccount(resultData) {
	if ((resultData["error"] != null) && (resultData["error"] != undefined)) {
		alert (resultData.error.message);
		$(".transferButton").each(function(index) {
			var sourceAccount = $(this).attr("data");
			if (sourceAccount == currentBatchTransferAccount) {
				$(this).replaceWith("<button class=\"transferButton\" data =\""+sourceAccount+"\" disabled>Transfer Failed!</button>");
			}
		});
	} else {
		$(".transferButton").each(function(index) {
			var sourceAccount = $(this).attr("data");
			if (sourceAccount == currentBatchTransferAccount) {
				$(this).replaceWith("<button class=\"transferButton\" data =\""+sourceAccount+"\" disabled>Transfer Complete</button>");
			}
		});
	}
	setTimeout(transferNextBatchedAccount, 2500);
}

function onTransferAccountFunds(resultData) {
	console.log(JSON.stringify(resultData));
	if ((resultData["error"] != null) && (resultData["error"] != undefined)) {
		alert (resultData.error.message);
		$(".transferButton").each(function(index) {
			var sourceAccount = $(this).attr("data");
			if (sourceAccount == currentBatchTransferAccount) {
				$(this).replaceWith("<button class=\"transferButton\" data =\""+sourceAccount+"\" disabled>Transfer Failed!</button>");
			}
		});
	} else {
		$(".transferButton").each(function(index) {
			var sourceAccount = $(this).attr("data");
			if (sourceAccount == currentBatchTransferAccount) {
				$(this).replaceWith("<button class=\"transferButton\" data =\""+sourceAccount+"\" disabled>Transfer Complete</button>");
				//removes row and updates table sorter index:
				//$(this).closest('tr').remove();
				//$("#balanceSheetAssets table").trigger("update");
			}
		});
	}
}

function buildBalanceSheetAssets(accountsArray) {
	var returnHTML = "<div id=\"balanceSheetAssets\"><table>";
	returnHTML += "<thead><tr>";
	returnHTML += "<th class=\"header\">Account</th>";
	returnHTML += "<th class=\"header\">"+blockchainAPI.provider+" Balance (BTC)</th>";
	returnHTML += "<th class=\"header\">Description</th>";
	returnHTML += "<th class=\"header\">Actions</th>";
	returnHTML += "</tr></thead>";
	returnHTML += "<tbody>";
	returnHTML += "</tbody>";
	returnHTML += "<tfoot>";
	returnHTML += "<tr class=\"header assetsTotalRow\"><td>TOTALS:</td>";
	returnHTML += "<td id=\"balanceTotal\"></td>";
	returnHTML += "<td></td>";
	returnHTML += "<td></td>";
	returnHTML += "</tr>";
	returnHTML += "</tfoot>";
	returnHTML += "</table>";
	return (returnHTML);
}

function buildBalanceSheetLiabilities(resultObj) {
	console.log("buildBalanceSheetLiabilities");
	console.log(JSON.stringify(resultObj));
	var returnHTML = "<div id=\"balanceSheetLiabilities\"><table>";
	returnHTML += "<thead><tr>";
	returnHTML += "<th class=\"header\">Account</th>";
	returnHTML += "<th class=\"header\">Balance (BTC)</th>";
	returnHTML += "<th class=\"header\">Description</th>";
	returnHTML += "</tr></thead>";
	returnHTML += "<tbody>";
	returnHTML += "<tr><td>In-Game Balances</td>";
	returnHTML += "<td>"+resultObj.user_balances.btc_available_total+"</td>";
	liabilitiesTotal = liabilitiesTotal.plus(new BigNumber(resultObj.user_balances.btc_available_total));
	returnHTML += "<td></td>";
	returnHTML += "</tr>";
	returnHTML += "<tr><td>Total Investment Balances</td>";
	var totalInvestmentsBalance = new BigNumber(resultObj.investments_total.btc_total_balance);
	totalInvestmentsBalance = totalInvestmentsBalance.plus(new BigNumber(resultObj.investments_total.btc_gains));
	returnHTML += "<td>"+totalInvestmentsBalance.toString(10)+"</td>";
	liabilitiesTotal = liabilitiesTotal.plus(totalInvestmentsBalance);
	returnHTML += "<td></td>";
	returnHTML += "</tr>";
	for (var count=0; count < resultObj.rake.length; count++) {
		var currentRakeInvestment = resultObj.rake[count];
		for (var count2 = 0; count2 < currentRakeInvestment.investments.length; count2++) {
			returnHTML += "<tr><td>Rake Account Balance</td>";
			var currentInvestment = currentRakeInvestment.investments[count2];
			returnHTML += "<td>"+currentInvestment.user_investment_btc+"</td>";
			returnHTML += "<td>"+currentRakeInvestment.name+"</td>";
			liabilitiesTotal = liabilitiesTotal.plus(new BigNumber(currentInvestment.user_investment_btc));
		}
	}
	returnHTML += "</tr>";
	returnHTML += "</tbody>";
	returnHTML += "<tfoot>";
	returnHTML += "<tr class=\"header liabilitiesTotalRow\"><td>TOTALS:</td>";
	returnHTML += "<td id=\"balanceTotal\"></td>";
	returnHTML += "<td></td>";
	returnHTML += "</tr>";
	returnHTML += "</tfoot>";
	returnHTML += "</table>";
	return (returnHTML);
}

function buildDividendTransactionsTable(resultArray) {
	console.log("buildDividendTransactionsTable");
	console.log(JSON.stringify(resultArray));
	var returnHTML = "<div id=\"dividendTransactionsTable\"><table>";
	returnHTML += "<thead><tr>";
	returnHTML += "<th class=\"header\">Date</th>";
	returnHTML += "<th class=\"header\">Description</th>";
	returnHTML += "<th class=\"header\">Gross Dividend</th>";
	returnHTML += "<th class=\"header\">Rake Amount</th>";
	returnHTML += "<th class=\"header\">Net Dividend</th>";
	returnHTML += "<th class=\"header\">Balance</th>";
	returnHTML += "</tr></thead>";
	returnHTML += "<tbody>";
	//NB: the following structure may change in future implementations if we need to include additional data!
	for (var count = 0; count < resultArray.length; count++) {
		var currentRowHTML = "";
		try {
			currentRowHTML += "<tr>";
			var currentItem = resultArray[count];
			var currentHistory = currentItem.history;
			var investmentsArr = currentHistory.investments; //resultArray[count].history.investments
			currentRowHTML += "<td>"+createDateTimeString(new Date(currentItem.timestamp))+"</td>"; //Date
			for (var count2 = 0; count2 < investmentsArr.length; count2++) {
				var currentInvestment = investmentsArr[count2];
				currentRowHTML += "<td>"+currentInvestment.name+"</td>"; //Description
				currentRowHTML += "<td>"+currentInvestment.gross_dividend_btc+"</td>"; //Gross Dividend
				currentRowHTML += "<td>"+currentInvestment.rake_amount_btc+"</td>"; //Rake Amount
				currentRowHTML += "<td>"+currentInvestment.net_dividend_btc+"</td>"; //Net Dividend
				currentRowHTML += "<td>"+currentInvestment.balance_btc+"</td>"; //Balance
			}
			currentRowHTML += "</tr>";
		} catch (err) {
			console.error(err.stack);
			currentRowHTML = "";
		}
		returnHTML += currentRowHTML;
	}
	returnHTML += "</tbody>";
	returnHTML += "<tfoot>";
	/*
	returnHTML += "<tr>";
	returnHTML += "<td></td>";
	returnHTML += "<td></td>";
	returnHTML += "<td></td>";
	returnHTML += "<td></td>";
	returnHTML += "<td></td>";
	returnHTML += "<td></td>";
	returnHTML += "</tr>";
	*/
	returnHTML += "</tfoot>";
	returnHTML += "</table>";
	return (returnHTML);
}


function updateAssetsTotal(value) {
	var balanceHTML = "<td id=\"balanceTotal\">"+value+"</div>";
	$(".assetsTotalRow #balanceTotal").replaceWith(balanceHTML);
}

function updateLiabilitiesTotal(value) {
	var balanceHTML = "<td id=\"balanceTotal\">"+value+"</div>";
	$(".liabilitiesTotalRow #balanceTotal").replaceWith(balanceHTML);
}

function getLiveAccountBalances(accountsArray, accountsType) {
	if (accountsArray.length == 0) {
		//all done
		$("#balanceSheetProgress").replaceWith("<div id=\"balanceSheetProgress\"></div>");
		return;
	}
	var progressHTML = "<div id=\"balanceSheetProgress\">Accounts remaining to retreive: "+accountsArray.length+"</div>";
	$("#balanceSheetProgress").replaceWith(progressHTML);
	var currentAccount = accountsArray.shift();
	var url = blockchainAPI.testnet.checkBalanceAddress.split("%addr%").join(currentAccount.btc_account).toString();
	console.log($.get(url, function(data) {
		onGetBlockchainBalance(data, currentAccount, accountsArray, accountsType);
	}));
}



function onGetBlockchainBalance(returnData, currentAccount, accountsArray, accountsType) {
	try {
		switch (accountsType) {
			case "havebalance":
				//Blockchain.info API return:
				if (String(returnData) != "0") {
					var satoshiBalance = new BigNumber(returnData);
					var btcBalance = satoshiBalance.dividedBy(satoshisPerBitcoin);
					assetsTotal = assetsTotal.plus(btcBalance);
					addNewAccountAssetRow(currentAccount, btcBalance.toString(10), accountsType);
					updateAssetsTotal(assetsTotal.toString(10));
				}
				/**
				//Block Explorer API return:
				addNewAccountAssetRow(currentAccount, returnData.balance);
				*/
				break;
			case "wallets":
				//Blockchain.info API return:
				if (String(returnData) != "0") {
					satoshiBalance = new BigNumber(returnData);
					btcBalance = satoshiBalance.dividedBy(satoshisPerBitcoin);
					assetsTotal = assetsTotal.plus(btcBalance);
					addNewAccountAssetRow(currentAccount, btcBalance.toString(10), accountsType);
					updateAssetsTotal(assetsTotal.toString(10));
				}
				/**
				//Block Explorer API return:
				addNewAccountAssetRow(currentAccount, returnData.balance);
				*/
				break;
			case "coldstorage":
				//Blockchain.info API return:
				if (String(returnData) != "0") {
					satoshiBalance = new BigNumber(returnData);
					btcBalance = satoshiBalance.dividedBy(satoshisPerBitcoin);
					assetsTotal = assetsTotal.plus(btcBalance);
					addNewAccountAssetRow(currentAccount, btcBalance.toString(10), accountsType);
					updateAssetsTotal(assetsTotal.toString(10));
				}
				/**
				//Block Explorer API return:
				addNewAccountAssetRow(currentAccount, returnData.balance);
				*/
				break;
		}
	} catch (err) {
	} finally {
		getLiveAccountBalances(accountsArray, accountsType);
	}
}

function addNewAccountAssetRow(currentAccount, balance, accountType) {
	var row = "<tr>";
	switch (accountType) {
		case "havebalance":
			var onClickJS = "transferAccountFunds(\""+balance+"\", \""+currentAccount.btc_account+"\",null,this)"; //JavaScript function to invoke, including parameter(s), when "transfer" action button is clicked
			row += "<td>"+currentAccount.btc_account+"</td>";
			row += "<td>"+balance+"</td>";
			//row += "<td>"+createDateTimeString(new Date(currentAccount.last_login))+"</td>";
			row += "<td>User</td>";
			row += "<td><button class=\"transferButton\" onclick='"+onClickJS+"' data=\""+currentAccount.btc_account+"\">Transfer All Funds</button></td>";
			row += "</tr>";
			$row = $(row),
			$("#balanceSheetAssets table").find("tbody").append($row).trigger("addRows", [$row, true]);
			break;
		case "wallets":
			row += "<td>"+currentAccount.btc_account+"</td>";
			row += "<td>"+balance+"</td>";
			row += "<td>Cash Register</td>";
			row += "<td></td>";
			row += "</tr>";
			$row = $(row),
			$("#balanceSheetAssets table").find("tfoot").prepend($row).trigger("addRows", [$row, true]);
			break;
		case "coldstorage":
			row += "<td>"+currentAccount.btc_account+"</td>";
			row += "<td>"+balance+"</td>";
			row += "<td>Cold Storage</td>";
			row += "<td></td>";
			row += "</tr>";
			$row = $(row),
			$("#balanceSheetAssets table").find("tfoot").prepend($row).trigger("addRows", [$row, true]);
			break;
	}
}

function createDateTimeString(dateObj) {
	var returnString = new String();
	returnString += String(dateObj.getHours())+":";
	if (dateObj.getMinutes() < 10) {
		returnString += "0";
	}
	returnString += String(dateObj.getMinutes())+":";
	if (dateObj.getSeconds() < 10) {
		returnString += "0";
	}
	returnString += String(dateObj.getSeconds())+" ";
	returnString += String(dateObj.getDate())+"/";
	returnString += String(dateObj.getMonth()+1)+"/";
	returnString += String(dateObj.getFullYear());
	return(returnString);
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

function insertInvestmentDeltas(previousInvestmentsTx, currentInvestmentsTx) {
	if (previousInvestmentsTx == undefined) {
		previousInvestmentsTx = null;
	}
	for (var count=0; count< currentInvestmentsTx.investments.length; count++) {
		var currentTx = currentInvestmentsTx.investments[count];
		currentTx.change = "0";
		currentTx.delta = "0 (initial depposit)";
		if (previousInvestmentsTx != null) {
			//this needs to be fixed on server end! -- currently only one investments element with wrong id is inserted for each rake transaction
			//var previousTx = findInvestmentByID(currentTx.investment_id, previousInvestmentsTx.investments);
			var previousTx = previousInvestmentsTx.investments[0];
			if (previousTx != null) {
				previousInvBalance = new BigNumber(previousTx.user_investment_btc);
				currentInvBalance = new BigNumber(currentTx.user_investment_btc);
				currentTx.delta = currentInvBalance.minus(previousInvBalance);				
				currentTx.change = currentTx.delta.toString(10);
				currentTx.delta = currentTx.delta.toString(10);
			}
		}
	}
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


function generatePagerDiv(divID) {
	var pagerDiv="<div id=\""+divID+"\" class=\"tablesorter-pager\">";
	pagerDiv+="<img src=\"../common/js/libs/tablesorter_addons/pager/first.png\" class=\"first disabled\" alt=\"First\" tabindex=\"0\">";
	pagerDiv+="<img src=\"../common/js/libs/tablesorter_addons/pager/prev.png\" class=\"prev disabled\" alt=\"Prev\" tabindex=\"0\">";
	pagerDiv+="<span class=\"pagedisplay\" data-pager-output-filtered=\"{startRow:input} – {endRow} / {filteredRows} of {totalRows} total rows\"><input type=\"text\" class=\"ts-startRow\" style=\"max-width:2em\" value=\"1\"> – 10 / 50 rows</span>";
	pagerDiv+="<img src=\"../common/js/libs/tablesorter_addons/pager/next.png\" class=\"next\" alt=\"Next\" tabindex=\"0\">";
	pagerDiv+="<img src=\"../common/js/libs/tablesorter_addons/pager/last.png\" class=\"last\" alt=\"Last\" tabindex=\"0\">";
	pagerDiv+="<select class=\"pagesize\" title=\"Items Percent page\">";
	pagerDiv+="<option value=\"10\">10</option>";
	pagerDiv+="<option value=\"20\">20</option>";
	pagerDiv+="<option value=\"30\">30</option>";
	pagerDiv+="<option value=\"all\">All Rows</option>";
	pagerDiv+="</select>";
	pagerDiv+="<select class=\"gotoPage\" title=\"Select page number\"><option value=\"1\">1</option><option value=\"2\">2</option><option value=\"3\">3</option><option value=\"4\">4</option><option value=\"5\">5</option></select>";
	pagerDiv+="</div>";
	return (pagerDiv);
}

function updateTransactionDeltas(transactionsArr) {
	var previousTxs = new Object();
	for (var count=0; count < transactionsArr.length ; count++) {
		var currentTx = transactionsArr[count];		
		insertInvestmentDeltas(previousTxs[currentTx.name], currentTx);
		previousTxs[currentTx.name] = currentTx;
	}
}

function onGetRakeStats(returnData) {	
	console.log(JSON.stringify(returnData));
	if ((returnData["error"] != undefined) && (returnData["error"] != null) && (returnData["error"] != "")) {
		alert (returnData.error.message);
	} else {
		_txTablePageNum = 0;
		currentTransactionsData = returnData.result.transactions;
		currentTransactionsData.reverse();
		updateTransactionDeltas(currentTransactionsData);
		currentTransactionsData.reverse();
		var txTable = buildRakeTransactionTable(currentTransactionsData, _txTableItemsPerPage, _txTablePageNum);
		$("#rakeAccountHistory").replaceWith(txTable);
		txTable += generatePagerDiv("rakeTransactionsPager")
		$("#rakeAccountHistory").replaceWith(txTable);
		paginateSortableTable("#rakeAccountHistory table", "#rakeTransactionsPager");
		getAssets();
		getLiabilities();
	}
}

function onGetAssets(returnData) {
	if ((returnData["error"] != undefined) && (returnData["error"] != null) && (returnData["error"] != "")) {
		alert (returnData.error.message);
	} else {
		var assetsTable = buildBalanceSheetAssets(returnData.result);
		assetsTable += generatePagerDiv("balanceSheetAssetsPager");
		$("#balanceSheetAssets").replaceWith(assetsTable);
		paginateSortableTable("#balanceSheetAssets table", "#balanceSheetAssetsPager");
		getLiveAccountBalances(returnData.result.accounts, "havebalance");
		getLiveAccountBalances(returnData.result.wallets, "wallets");
		getLiveAccountBalances(returnData.result.coldstorage, "coldstorage");
		updateAssetsTotal(assetsTotal.toString(10));
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


//window onload handler
function start() {
	$("#transferTargetAddress").val(defaultTransferTargetAddress);
	// COMMENT SECTION BELOW IF STARTING AS POPUP
	accountInfo.playerAccount = localStorage.playerAccount;
	accountInfo.playerPassword = localStorage.playerPassword;
	accountInfo.gameServerURL = localStorage.gameServerURL;	
	getRakeStats();
	// COMMENT SECTION ABOVE IF STARTING AS POPUP
	ready = true;
}