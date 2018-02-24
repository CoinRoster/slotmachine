<!DOCTYPE html>
<html>
	<head>
		<title>My Account</title>
		<!-- hide mobile highlights -->
		<style>
		* {
		-webkit-tap-highlight-color: rgba(0, 0, 0, 0);
		}
		</style>
		<!-- Added for bootstrap styling-->
		<link rel="stylesheet" href="./common/styles/bootstrap.min.css">
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<!-- jQuery -->
		<script language="JavaScript" src="./common/js/libs/jquery-3.2.1.min.js"></script>
		<!-- jQuery UI -->
		<script language="JavaScript" src="./common/js/libs/jquery-ui.min.js"></script>
		  <!-- jQuery Mobile-->
		<!-- script language="JavaScript" src="../common/js/libs/jquery.mobile-1.4.5.min.js"></script -->
		<!-- EaselJS (CreateJS) -->
		<script language="JavaScript" src="./common/js/libs/easeljs-0.8.2.min.js"></script>
		<!-- TweenJS (CreateJS) -->
		<script language="JavaScript" src="./common/js/libs/tweenjs-0.6.2.min.js"></script>
		<!-- SoundJS (CreateJS) -->
		<script language="JavaScript" src="./common/js/libs/soundjs-0.6.2.min.js"></script>
		<!-- PreloadJS (CreateJS) -->
		<script language="JavaScript" src="./common/js/libs/preloadjs-0.6.2.min.js"></script>
		<!-- BigNumber library -->
		<script language="JavaScript" src="./common/js/libs/bignumber.min.js"></script>
		<!-- Account page code -->
		<script language="JavaScript" src="./common/js/account.js"></script>
		<!-- Currency formatter -->
		<script language="JavaScript" src="./common/js/currencyformat.js"></script>
		<!-- BigNumber library -->
		<script language="JavaScript" src="./common/js/libs/bignumber.min.js"></script>
		<!-- TableSorter library [http://tablesorter.com] -->
		<script language="JavaScript" src="./common/js/libs/jquery.tablesorter.js"></script> 
		<!-- TableSorter widget to support static rows [https://github.com/ascii-soup/Tablesorter-Static-Row-Plugin] -->
		<script language="JavaScript" src="./common/js/libs/jquery.tablesorter.staticrow.min.js"></script>
		<!-- TableSorter widget to support pagination [https://github.com/ascii-soup/Tablesorter-Static-Row-Plugin] -->
		<!-- script language="JavaScript" src="./common/js/libs/tablesorter_addons/pager/jquery.tablesorter.widgets.js"></script -->
		<link rel="stylesheet" href="./common/js/libs/tablesorter_addons/pager/theme.blue.css">
		<link rel="stylesheet" href="./common/js/libs/tablesorter_addons/pager/jquery.tablesorter.pager.css">
		<script src="./common/js/libs/tablesorter_addons/pager/jquery.tablesorter.pager.js"></script>
		 <!-- jQuery styles -->
		<link rel="stylesheet" href="./common/styles/jquery-ui.theme.css">
		<!-- Font Awesome Icons-->
		<link rel="stylesheet" href="./common/styles/font-awesome.min.css">
		<!-- Fonts -->
		<link href='./common/styles/CarterOne.css' rel='stylesheet'>
		<!-- Game styles -->
		<link rel="stylesheet" href="./styles/game.css">
		<link rel="stylesheet" href="./styles/account.css">
		<!-- Bootstrap JS-->
		<script src="./common/js/libs/bootstrap.min.js"></script>
	</head>
	<body onload="start()">
		<div id="investments"></div>
		<div id="investmentsPager" class="tablesorter-pager">
			<img src="./common/js/libs/tablesorter_addons/pager/first.png" class="first disabled" alt="First" tabindex="0">
			<img src="./common/js/libs/tablesorter_addons/pager/prev.png" class="prev disabled" alt="Prev" tabindex="0">
			<span class="pagedisplay" data-pager-output-filtered="{startRow:input} – {endRow} / {filteredRows} of {totalRows} total rows"><input type="text" class="ts-startRow" style="max-width:2em" value="1"> – 10 / 50 rows</span>
			<img src="./common/js/libs/tablesorter_addons/pager/next.png" class="next" alt="Next" tabindex="0">
			<img src="./common/js/libs/tablesorter_addons/pager/last.png" class="last" alt="Last" tabindex="0">
			<select class="pagesize" title="Select page size">
				<option value="10">10</option>
				<option value="20">20</option>
				<option value="30">30</option>
				<option value="all">All Rows</option>
			</select>
			<select class="gotoPage" title="Select page number"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select>
		</div><br/>
		<input type="text" id="depositAmountInput" value="0"></input>
		<button class="btn btn-success" id="depositButton" data-toggle="tooltip" title="Deposit to an investment">DEPOSIT</button>&nbsp;to&nbsp;<select name="investmentsDeposit" id="investmentSelectorDeposit"></select>
		<input type="text" id="withdrawAmountInput" value="0"></input>
		<button class="btn btn-danger" id="withdrawButton" data-toggle="tooltip" title="Withdraw from an investment">WITHDRAW</button>&nbsp;from&nbsp;<select name="investmentsWithdraw" id="investmentSelectorWithdraw"></select>
		<br/><br/>
		<div id="bankrollMultiplier">
			<form id="multiplierInputForm">
				<datalist id="tickmarks">
					<option value="0.01" label="0.01">
					<option value="0.1" label="0.1">
					<option value="0.5" label="0.5">
					<option value="1" label="1">
					<option value="2" label="2">
					<option value="5" label="5">
					<option value="10" label="10">
					<option value="15" label="15">
					<option value="20" label="20">
				</datalist>
				<label for="multiplierRangeInput">Bankroll Multiplier: </label>
				<input type="range" id="multiplierRangeInput" min="0.01" max="20" step="0.01" list="tickmarks" value="1" />&nbsp;&nbsp;<input type="number" id="multiplierNumberInput" min="0.01" max="20" step="0.01" value="1" />&nbsp;&nbsp;
				<button class="btn btn-success" id="updateBRMButton" data-toggle="tooltip" title="Update slot game bankroll multiplier">Update Bankroll Multiplier</button>
			</form>
		</div>
		<br/><br/>
		<div id="updatePassword">			
			<header>CHANGE PASSWORD</header>
			<label for="currentPassword">Current Password: </label><input type="password" id="currentPassword" style="width:400px;" /><br/>
			<label for="newPassword">New Password: </label><input type="password" id="newPassword" style="width:400px;" /><br/>
			<label for="confirmPassword">Confirm Password: </label><input type="password" id="confirmPassword" style="width:400px;" /><br/>
			<button class="btn btn-success" id="updatePasswordButton" data-toggle="tooltip" title="Update password">Update Password</button>
		</div>
		<br/><br/>
		<div id="affiliate" style="display:none">
			<div id="prompt">Your unique affiliate link: </div><div id="link"></div><button id="copyAffiliateLinkButton" onclick="onCopyAffiliateLinkClick()" data-toggle="tooltip" title="Copy link to clipboard"><img src="./assets/clipboard.png"/></button><br/>
			<div id="info"></div>
			<div id="affiliateContributionsPager" class="tablesorter-pager">
				<img src="./common/js/libs/tablesorter_addons/pager/first.png" class="first disabled" alt="First" tabindex="0">
				<img src="./common/js/libs/tablesorter_addons/pager/prev.png" class="prev disabled" alt="Prev" tabindex="0">
				<span class="pagedisplay" data-pager-output-filtered="{startRow:input} – {endRow} / {filteredRows} of {totalRows} total rows"><input type="text" class="ts-startRow" style="max-width:2em" value="1"> – 10 / 50 rows</span>
				<img src="./common/js/libs/tablesorter_addons/pager/next.png" class="next" alt="Next" tabindex="0">
				<img src="./common/js/libs/tablesorter_addons/pager/last.png" class="last" alt="Last" tabindex="0">
				<select class="pagesize" title="Select page size">
					<option value="10">10</option>
					<option value="20">20</option>
					<option value="30">30</option>
					<option value="all">All Rows</option>
				</select>
				<select class="gotoPage" title="Select page number"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select>
			</div>
		</div>
		<br/><br/>
		<label for="displayCurrency">Display Currency: </label>
		<select name="displayCurrency" id="displayCurrencySelector">
			<option value="tokens" selected="selected">Tokens</option>
			<option value="btc">Bitcoins</option>
			<option value="satoshis">Satoshis</option>
		</select>
		<br/>
		<br/>
		<div id="transactionhistoryHeader">TRANSACTION HISTORY</div>
		<div id="transactionHistoryOptions">
			<form id="options">
				<input id="accountTransactions" type="checkbox" onclick="onTxHistoryOptionClick()" checked></input><label for="accountTransactions">Account Transactions</label>&nbsp;&nbsp;
				<input id="gameTransactions" type="checkbox" onclick="onTxHistoryOptionClick()" checked></input><label for="gameTransactions">Game Transactions</label>&nbsp;&nbsp;
				<input id="investmentTransactions" type="checkbox" onclick="onTxHistoryOptionClick()" checked></input><label for="investmentTransactions">Investments Transactions</label>&nbsp;&nbsp;
				<input id="affiliateTransactions" type="checkbox" onclick="onTxHistoryOptionClick()" checked></input><label for="affiliateTransactions">Affiliate Transactions</label>&nbsp;&nbsp;
			</form>
		</div>
		<div id="transactionHistory"></div>
		<div id="transactionHistoryPager" class="tablesorter-pager">
			<img src="./common/js/libs/tablesorter_addons/pager/first.png" class="first disabled" alt="First" tabindex="0">
			<img src="./common/js/libs/tablesorter_addons/pager/prev.png" class="prev disabled" alt="Prev" tabindex="0">
			<span class="pagedisplay" data-pager-output-filtered="{startRow:input} – {endRow} / {filteredRows} of {totalRows} total rows"><input type="text" class="ts-startRow" style="max-width:2em" value="1"> – 10 / 50 rows</span>
			<img src="./common/js/libs/tablesorter_addons/pager/next.png" class="next" alt="Next" tabindex="0">
			<img src="./common/js/libs/tablesorter_addons/pager/last.png" class="last" alt="Last" tabindex="0">
			<select class="pagesize" title="Select page size">
				<option value="10">10</option>
				<option value="20">20</option>
				<option value="30">30</option>
				<option value="all">All Rows</option>
			</select>
			<select class="gotoPage" title="Select page number"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select>
		</div>
		<input id="clipboardProxy" style="position:absolute;left:-9999px;top:-9999px;opacity: 0;" value="">
	</body>
</html>