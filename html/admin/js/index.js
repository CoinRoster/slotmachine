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

var defaultTransferTargetAddress = "mqRSzumcT9mXcjZbSr5LTsJXABAXpj42kQ"; // default transfer-to Bitcoin address for use with dormant accounts
var blockchainAPI = new Object();
blockchainAPI.mainnet = new Object();
blockchainAPI.testnet = new Object();
blockchainAPI.mainnet.checkBalanceAddress = "https://lockexplorer.com/api/addr/%addr%";
blockchainAPI.testnet.checkBalanceAddress = "https://testnet.blockexplorer.com/api/addr/%addr%";


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

function getDormantAccounts() {
	callServerMethod("admin_getAccounts",{"type":"dormant"}, onGetDormantAccounts);
}

function onTxTablePreviousClick() {
	_txTablePageNum--;
	var txTable = buildRakeTransactionTable(currentTransactionsData, _txTableItemsPerPage, _txTablePageNum);
	$("#rakeAccountHistory").replaceWith(txTable);
}

function onTxTableNextClick() {
	_txTablePageNum++;
	var txTable = buildRakeTransactionTable(currentTransactionsData, _txTableItemsPerPage, _txTablePageNum);
	$("#rakeAccountHistory").replaceWith(txTable);
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
	var txTable = buildRakeTransactionTable(currentTransactionsData, _txTableItemsPerPage, _txTablePageNum);
	txTable += generatePagerDiv("rakeTransactionsPager")
	$("#rakeAccountHistory").replaceWith(txTable);
	paginateSortableTable("#rakeAccountHistory table", "#rakeTransactionsPager");
}

function onTxTableRefreshClick() {
	_txTablePageNum = 0;
	getTransactions();
}

function buildRakeTransactionTable(collatedTxArray, itemsPerPage, pageNum) {
	if ((itemsPerPage == null) || (itemsPerPage == undefined) || (isNaN(itemsPerPage))) {
		itemsPerPage = _txTableItemsPerPage;
	}
	if ((pageNum == null) || (pageNum == undefined) || (isNaN(pageNum))) {
		pageNum = 0;
	}
	var returnHTML = "<div id=\"rakeAccountHistory\"><table>";
	returnHTML += "<thead><tr>";
	returnHTML += "<th class=\"header\">Date</th>";
	returnHTML += "<th class=\"header\">Type</th>";
	returnHTML += "<th class=\"header\">Total Value (btc)</th>";
	returnHTML += "<th class=\"header\">Amount</th>";
	returnHTML += "</tr></thead>";
	var startIndex = itemsPerPage * pageNum;
	var endIndex = startIndex + itemsPerPage - 1;
	if (endIndex > (collatedTxArray.length - 1)) {
		endIndex = collatedTxArray.length - 1;
	}
	returnHTML += "<tbody>";
	var investmentHistory = new Object();
	for (var count=startIndex; count <= endIndex; count++) {
		try {			
			var currentTx = collatedTxArray[count];						
			for (var count2 = 0; count2<currentTx.investments.length; count2++) {
				var investmentID = currentTx.investments[count2].investment_id; //incorrect! currently always "poloniex"
				var investmentBalanceBTC = currentTx.investments[count2].user_investment_btc;
				var userInvestmentBalanceBTC = currentTx.investments[count2].user_investment_btc;
				var userInvestmentBaseBTC = currentTx.investments[count2].user_investment_base_btc;	
				var rowHTML = "<tr>";
				rowHTML += "<td>"
				rowHTML += createDateTimeString(new Date(currentTx.timestamp));
				rowHTML += "</td>";			
				rowHTML += "<td>"+currentTx.name+"</td>";
				rowHTML += "<td>"+investmentBalanceBTC+"</td>";				
				rowHTML += "<td><span id\"rake_transaction\">"+currentTx.investments[count2].change+"</span></td>";
				rowHTML += "</tr>";
				returnHTML += rowHTML;
			}
		} catch (err) {
			alert (err)
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
	$(".transferButton").each(function(index) {
		var sourceAccount = $(this).attr("data");
		if (sourceAccount == currentBatchTransferAccount) {
			$(this).replaceWith("<button class=\"transferButton\" data =\""+sourceAccount+"\" disabled>Transfer Complete</button>");
		}
	});
	setTimeout(transferNextBatchedAccount, 2500);
}

function onTransferAccountFunds(resultData) {
	$(".transferButton").each(function(index) {
		var sourceAccount = $(this).attr("data");
		if (sourceAccount == currentBatchTransferAccount) {
			$(this).replaceWith("<button class=\"transferButton\" data =\""+sourceAccount+"\" disabled>Transfer Complete</button>");
			//removes row and updates table sorter index:
			//$(this).closest('tr').remove();
			//$("#balanceSheet table").trigger("update");
		}
	});
}

function buildBalanceSheet(accountsArray) {
	var returnHTML = "<div id=\"balanceSheet\"><table>";
	returnHTML += "<thead><tr>";
	returnHTML += "<th class=\"header\">Account</th>";
	returnHTML += "<th class=\"header\">blockchain Balance (BTC)</th>";
	returnHTML += "<th class=\"header\">Last Login</th>";
	returnHTML += "<th class=\"header\">Actions</th>";
	returnHTML += "</tr></thead>";
	returnHTML += "<tbody>";
	returnHTML += "</tbody>";
	returnHTML += "</table>";
	return (returnHTML);
}

function getLiveAccountBalances(accountsArray) {
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
		onGetBlockchainBalance(data, currentAccount, accountsArray);
	}));
}



function onGetBlockchainBalance(returnData, currentAccount, accountsArray) {
	console.log (JSON.stringify(returnData));
	addNewAccountRow(currentAccount, returnData.balance);
	getLiveAccountBalances(accountsArray);
}

function addNewAccountRow(currentAccount, balance) {
	var onClickJS = "transferAccountFunds(\""+balance+"\", \""+currentAccount.btc_account+"\",null,this)"; //JavaScript function to invoke, including parameter(s), when "transfer" action button is clicked
	var row = "<tr>";
	row += "<td>"+currentAccount.btc_account+"</td>";
	row += "<td>"+balance+"</td>";
	row += "<td>"+createDateTimeString(new Date(currentAccount.last_login))+"</td>";
	row += "<td><button class=\"transferButton\" onclick='"+onClickJS+"' data=\""+currentAccount.btc_account+"\">Transfer All Funds</button></td>";
	row += "</tr>";
	$row = $(row),
	$("#balanceSheet table").find("tbody").append($row).trigger("addRows", [$row, true]);
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
		getDormantAccounts();
	}
}

function onGetDormantAccounts(returnData) {
	console.log(JSON.stringify(returnData));
	if ((returnData["error"] != undefined) && (returnData["error"] != null) && (returnData["error"] != "")) {
		alert (returnData.error.message);
	} else {
		var accountsTable = buildBalanceSheet(returnData.result.dormant);
		accountsTable += generatePagerDiv("balanceSheetPager");
		$("#balanceSheet").replaceWith(accountsTable);
		paginateSortableTable("#balanceSheet table", "#balanceSheetPager");
		getLiveAccountBalances(returnData.result.dormant);
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