var ready = false;
var accountInfo = {};
var rpcMsgID = 0;
var availableInvestments = new Object();
var progressiveJackpots = new Array(); //most recently loaded progressive jackpots data
var displayCurrency = "tokens";
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

function getInvestmentStats(excludeCharts) {
	if (excludeCharts) {
		callServerMethod("getInvestmentStats", {"user_balances":true, "investments_total":true, "investments_arp":true, "jackpots":true}, onGetInvestmentStats);	
	} else {
		callServerMethod("getInvestmentStats", {"user_balances":true, "investments_total":true, "investments_arp":true, "investments_charts":true, "jackpots":true}, onGetInvestmentStats);
	}
	setTimeout(getInvestmentStats, 5000, true);
}

function onGetInvestmentStats(returnData) {	
	if ((returnData["error"] != undefined) && (returnData["error"] != null) && (returnData["error"] != "")) {
		alert(returnData.error.message);
	} else {
		var statsTables = buildStatsTables(returnData.result);
		//alert (JSON.stringify(returnData.result));
		$("#stats").replaceWith("<div id=\"stats\">"+statsTables+"</div>");
		paginateSortableTable("#stats #investments", "#stats #investmentsPager");
		paginateSortableTable("#stats #jackpots", "#stats #jackpotsPager");
		if ((returnData.result["investments_charts"] != undefined) && (returnData.result["investments_charts"] != null)) {
			var gainsChartData = consolidateChartData("btc_gains", returnData.result);
			var chartOptions = {			
				maintTitle:"Investment Totals ("+displayCurrency+")"
			}
			var currentInvestmentTotal = Number(returnData.result.investments_arp[0].btc_balance_total);
			if (currentInvestmentTotal == 0) {
				currentInvestmentTotal = Number(returnData.result.investments_arp[0].btc_base_deposit);
			}
			chartOptions.minYValue = Number.MAX_VALUE;
			chartOptions.maxYValue = Number.MIN_VALUE;
			//convert Bitcoin values to currently selected currency
			for (var count=0; count < gainsChartData[0].data.length; count++) {
				gainsChartData[0].data[count][1] = Number(convertAmount(gainsChartData[0].data[count][1], "btc", displayCurrency).toFormat()) + currentInvestmentTotal;
				if (gainsChartData[0].data[count][1] < chartOptions.minYValue) {
					chartOptions.minYValue = gainsChartData[0].data[count][1];
				}
				if (gainsChartData[0].data[count][1] > chartOptions.maxYValue) {
					chartOptions.maxYValue = gainsChartData[0].data[count][1];
				}
			}
			generateMultiLineChart("charts", chartOptions, gainsChartData) 
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

function consolidateChartData (dataName, chartResultData) {
	var returnData = new Array();
	for (var investmentID in chartResultData.investments_charts) {		
		var currentChartItem = chartResultData.investments_charts[investmentID];
		if ((currentChartItem[dataName] != null) && (currentChartItem[dataName] != undefined)) {
			returnData.push(currentChartItem[dataName]);
		}		
	}
	return (returnData);
}

function userIsLoggedIn() {
	var accountSet = false;
	var passwordSet = false;
	if ((accountInfo.playerAccount != "") && (accountInfo.playerAccount != null) && (accountInfo.playerAccount != undefined)) {
		accountSet=true;
	}
	if ((accountInfo.playerPassword != "") && (accountInfo.playerPassword != null) && (accountInfo.playerPassword != undefined)) {
		passwordSet=true;
	}
	if (accountSet && passwordSet) {
		return (true);
	} else {
		return (false);
	}
}


function onProgressiveAlertClick(index) {
	alert ("onProgressiveAlertClick: "+progressiveJackpots[index].id);
}


function buildStatsTables(resultObj) {	
	var returnHTML = "";
	returnHTML += "<table id=\"jackpots\" class=\"tablesorter-blue\">";
	returnHTML += "<thead><tr class=\"investment_header\">";
	returnHTML += "<th class=\"header\">Jackpots ID</th>";
	returnHTML += "<th class=\"header\">Current Progressive Amount ("+displayCurrency+")</th>";
	returnHTML += "<th class=\"header\">Liability ("+displayCurrency+")</th>";
	returnHTML += "<th class=\"header\">Last Updated</th>";
	if (userIsLoggedIn()) {
		returnHTML += "<th>Alert</th>";
	}
	returnHTML += "</tr><thead>";
	returnHTML += "<tbody class=\"investment_value\">";
	var precisionVal = new BigNumber("100000000");	
	if ((resultObj["jackpots"] != null) && (resultObj["jackpots"] != undefined)) {
		progressiveJackpots = resultObj.jackpots;
		for (var count=0; count < resultObj.jackpots.length; count++) {
			var tokensPerBTC = new BigNumber("10000"); // get this from game main config / API result
			var totalProgressiveAmount = new BigNumber(500); //get this from localStorage.config
			totalProgressiveAmount = totalProgressiveAmount.dividedBy(tokensPerBTC);
			totalProgressiveAmount = totalProgressiveAmount.plus(new BigNumber(resultObj.jackpots[count].btc));
			returnHTML += "<tr>";												
			returnHTML += "<td>"+resultObj.jackpots[count].id+"</td>";			
			returnHTML += "<td>"+totalProgressiveAmount.toFormat()+"</td>";			
			returnHTML += "<td>"+convertAmount(resultObj.jackpots[count].btc, "btc", displayCurrency).toFormat()+"</td>";			
			returnHTML += "<td>"+createDateTimeString(new Date(resultObj.jackpots[count].timestamp))+"</td>";
			if (userIsLoggedIn()) {
				returnHTML += "<td><button id=\"\" onclick=\"onProgressiveAlertClick("+String(count)+")\">SET ALERT</button></td>";
			}
			returnHTML += "</tr>";
		}
	}
	returnHTML += "</tbody></table>";
	returnHTML += generatePagerDiv("jackpotsPager");
	//-----------------------------------------
	returnHTML += "<table  id=\"investments\" class=\"tablesorter-blue\">";
	returnHTML += "<thead><tr class=\"investment_header\">";
	returnHTML += "<th class=\"header\">Investment</th>";
	returnHTML += "<th class=\"header\">Book Value ("+displayCurrency+")</th>";
	returnHTML += "<th class=\"header\">Current Value ("+displayCurrency+")</th>";
	returnHTML += "<th class=\"header\">Change ("+displayCurrency+")</th>";	
	returnHTML += "<th class=\"header\">Percent Change</th>";
	returnHTML += "</tr><thead>";
	returnHTML += "<tbody class=\"investment_value\"><tr class=\"static\">";
	returnHTML += "<td><b>In-Game Balances</b></td>";	
	returnHTML += "<td><b>"+convertAmount(resultObj.user_balances.btc_available_total, "btc", displayCurrency).toFormat()+"</b></td>";
	returnHTML += "<td><b>"+convertAmount(resultObj.user_balances.btc_available_total, "btc", displayCurrency).toFormat()+"</b></td>";
	returnHTML += "<td></td><td></td></tr>";
	var usersBalance = new BigNumber(resultObj.user_balances.btc_available_total);
	var column1Total = new BigNumber(0);
	var column2Total = new BigNumber(0);
	var column3Total = new BigNumber(0);
	var column4Total = new BigNumber(0);
	column1Total = column1Total.plus(usersBalance);
	column2Total = column2Total.plus(usersBalance);
	for (var count=0; count < resultObj.investments_arp.length; count++) {
		returnHTML += "<tr>";
		var currentInvestment = resultObj.investments_arp[count];
		returnHTML += "<td><b>"+currentInvestment.name+"</b></td>";				
		var baseDeposit = new BigNumber(currentInvestment.btc_base_deposit);
		var balanceTotal = new BigNumber(currentInvestment.btc_balance_total);
		if (balanceTotal.equals(0)) {
			balanceTotal = new BigNumber(baseDeposit.toFormat());
		}
		var gainsCurrent = new BigNumber(currentInvestment.btc_gains_current);	
		var gainsTotal = balanceTotal.plus(gainsCurrent);
		var balanceDelta = gainsTotal.minus(balanceTotal);
		//var gainsTotal = balanceTotal.minus(baseDeposit);
		column1Total = column1Total.plus(balanceTotal);
		column2Total = column2Total.plus(gainsTotal);
		column3Total = column3Total.plus(balanceDelta);
		returnHTML += "<td><b>"+convertAmount(balanceTotal, "btc", displayCurrency).toFormat()+"<b></td>";		
		returnHTML += "<td><b>"+convertAmount(gainsTotal, "btc", displayCurrency).toFormat()+"</b></td>";		
		//returnHTML += "<td><b>"+convertAmount(currentInvestment.btc_gains_total, "btc", displayCurrency).toFormat()+"</b></td>";		
		returnHTML += "<td><b>"+convertAmount(balanceDelta, "btc", displayCurrency).toFormat()+"</b></td>";	
		/*
		var gains_sum = new BigNumber(currentInvestment.btc_gains_total);
		var base_deposit = new BigNumber(currentInvestment.btc_base_deposit);		
		if (gainsTotal.equals(0)) {
			var arp = new BigNumber(0);
		} else {
			arp = gainsTotal.dividedBy(base_deposit).times(new BigNumber(100));			
		}
		arp = arp.times(precisionVal).floor().dividedBy(precisionVal);
		column4Total = column4Total.plus(arp);
		if (arp.equals(0)) {
			returnHTML += "<td><b>0%<b></td>";
		} else {
			returnHTML += "<td><b>"+arp.toPrecision(8)+"%<b></td>";
		}
		returnHTML += "</tr>";
		*/
		if (gainsTotal.equals(0)) {
			var percentChange = new BigNumber(0);
		} else {
			percentChange = gainsTotal.dividedBy(balanceTotal).times(new BigNumber(100));			
		}
		percentChange = percentChange.times(precisionVal).floor().dividedBy(precisionVal);
		returnHTML += "<td><b>"+percentChange.minus(new BigNumber(100))+"%<b></td>";
		column4Total = column4Total.plus(percentChange.minus(new BigNumber(100)));
	}
	column1Total = column1Total.times(precisionVal).floor().dividedBy(precisionVal);
	column2Total = column2Total.times(precisionVal).floor().dividedBy(precisionVal);
	column3Total = column3Total.times(precisionVal).floor().dividedBy(precisionVal);
	column4Total = column4Total.times(precisionVal).floor().dividedBy(precisionVal);
	returnHTML += "<tr class=\"static\">";
	returnHTML += "<td>TOTALS</td>";
	returnHTML += "<td class=\"total\"><b>"+convertAmount(column1Total.toFormat(), "btc", displayCurrency).toFormat()+"<b></td>";		
	returnHTML += "<td class=\"total\"><b>"+convertAmount(column2Total.toFormat(), "btc", displayCurrency).toFormat()+"</b></td>";		
	returnHTML += "<td class=\"total\"><b>"+convertAmount(column3Total.toFormat(), "btc", displayCurrency).toFormat()+"</b></td>";	
	returnHTML += "<td class=\"total\"><b>"+convertAmount(column4Total.toFormat(), "btc", displayCurrency).toFormat()+"%</b></td>";
	returnHTML += "</tr>";
	returnHTML += "</tbody></table>";
	returnHTML += generatePagerDiv("investmentsPager");
	return (returnHTML);
}

function generatePagerDiv(divID) {
	var pagerDiv="<div id=\""+divID+"\" class=\"tablesorter-pager\">";
	pagerDiv+="<img src=\"./common/js/libs/tablesorter_addons/pager/first.png\" class=\"first disabled\" alt=\"First\" tabindex=\"0\">";
	pagerDiv+="<img src=\"./common/js/libs/tablesorter_addons/pager/prev.png\" class=\"prev disabled\" alt=\"Prev\" tabindex=\"0\">";
	pagerDiv+="<span class=\"pagedisplay\" data-pager-output-filtered=\"{startRow:input} – {endRow} / {filteredRows} of {totalRows} total rows\"><input type=\"text\" class=\"ts-startRow\" style=\"max-width:2em\" value=\"1\"> – 10 / 50 rows</span>";
	pagerDiv+="<img src=\"./common/js/libs/tablesorter_addons/pager/next.png\" class=\"next\" alt=\"Next\" tabindex=\"0\">";
	pagerDiv+="<img src=\"./common/js/libs/tablesorter_addons/pager/last.png\" class=\"last\" alt=\"Last\" tabindex=\"0\">";
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

function generateMultiLineChart(chartContainerDiv, options, chartDataArray) {
	var chartOptions = new Object();
	chartOptions.chart = new Object();
	chartOptions.chart.zoomType = "x";
	chartOptions.chart.type = "line"	
	chartOptions.title = {text:options.mainTitle};
	chartOptions.subtitle = {text:document.ontouchstart === undefined ? 'Click and drag in the plot area to zoom in' : 'Pinch the chart to zoom in'};
	chartOptions.xAxis = {type:'datetime', dateTimeLabelFormats:{month: '%e. %b', year: '%b'}, title:{text: 'Date'}};
	chartOptions.yAxis = {title:{text:displayCurrency}, min:options.minYValue, max:options.maxYValue};
	chartOptions.tooltip = {headerFormat:"<b>{series.name}</b><br>", pointFormat:"{point.x:%e. %b}: {point.y:.4f} "+displayCurrency};
	chartOptions.plotOptions = {spline: {marker: {enabled: true}}};			
	chartOptions.series = chartDataArray;
	Highcharts.chart(chartContainerDiv, chartOptions);
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

/**
* Processes all settings changes made to localStorage by child windows.
*/
function onSettingsChanged(event) {
	try {
		var options = JSON.parse(localStorage.options);
		displayCurrency = options.displayCurrency;
		getInvestmentStats();
	} catch (err) {
		alert (err);
	}
}

//window onload handler
function start() {
	// COMMENT SECTION BELOW IF STARTING AS POPUP
	accountInfo.playerAccount = localStorage.playerAccount;
	accountInfo.playerPassword = localStorage.playerPassword;
	accountInfo.gameServerURL = localStorage.gameServerURL;	
	//COMMENT ENDS
	try {
		var options = JSON.parse(localStorage.options);
		displayCurrency = options.displayCurrency;
	} catch (err) {
		displayCurrency = "tokens";
	}
	$(window).bind("storage", onSettingsChanged);
	getInvestmentStats();
	ready = true;
}