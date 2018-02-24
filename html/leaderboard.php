<!DOCTYPE html>
<html>
	<head>
		<title>Leaderboard</title>
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
		<!-- Leaderboard page code -->
		<script language="JavaScript" src="./common/js/leaderboard.js"></script>
		<!-- Currency formatter -->
		<script language="JavaScript" src="./common/js/currencyformat.js"></script>
		<!-- BigNumber library -->
		<script language="JavaScript" src="./common/js/libs/bignumber.min.js"></script>
		<!-- TableSorter library [http://tablesorter.com] -->
		<script language="JavaScript" src="./common/js/libs/jquery.tablesorter.min.js"></script> 
		<!-- TableSorter widget to support static rows [https://github.com/ascii-soup/Tablesorter-Static-Row-Plugin] -->
		<script language="JavaScript" src="./common/js/libs/jquery.tablesorter.staticrow.min.js"></script>
		 <!-- jQuery styles -->
		<link rel="stylesheet" href="./common/styles/jquery-ui.theme.css">
		<!-- Font Awesome Icons-->
		<link rel="stylesheet" href="./common/styles/font-awesome.min.css">
		<!-- Fonts -->
		<link href='./common/styles/CarterOne.css' rel='stylesheet'>
		<!-- Game styles -->
		<link rel="stylesheet" href="./styles/game.css">
		<link rel="stylesheet" href="./styles/leaderboard.css">
		<!-- Bootstrap JS-->
		<script src="./common/js/libs/bootstrap.min.js"></script>
	</head>
	<body onload="start()">
		<div id="leaderboard"><div id="biggestWin"></div><div id="biggestAffiliate"></div></div><br/>
		<div id="prompt">Latest bets:</div><div id="betsScroller"><div id="scrollContainer"></div></div>
	</body>
</html>