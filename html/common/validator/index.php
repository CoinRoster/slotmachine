<!DOCTYPE html>	
<html>
	
	<head>
		<title>Provably Fair Slot Machine (AES) Game Validator</title>
		<!-- hide mobile highlights -->
		<style>*{-webkit-tap-highlight-color: rgba(0, 0, 0, 0);}</style>
	</head>
		
	<!-- jQuery -->
	<script language="JavaScript" src="/common/js/libs/jquery-3.2.1.min.js"></script>	
	<!-- jQuery UI -->
	<script language="JavaScript" src="/common/js/libs/jquery-ui.min.js"></script>	
	<!-- BigNumber.js -->
	<script language="JavaScript" src="/common/js/libs/bignumber.min.js"></script>
	<!-- aes-js -->
	<script language="JavaScript" src="/common/js/libs/aes-js.js"></script>
	<!-- Main validator script -->
	<script language="JavaScript" src="/common/validator/js/validator.js"></script>	
			
	<!-- jQuery styles -->
	<link rel="stylesheet" href="/common/styles/jquery-ui.theme.css">
	<!-- Main validator style -->
	<link rel="stylesheet" href="/common/validator/styles/validator.css">
		
	<script language="JavaScript">
		function updateValidationData(validationData) {
			$("#inputField #validationData").val(validationData);
			onValidateClick({}); //validator.js
		}
	</script>
	
	<body onload="start_popup()">
		<div id="inputField">Paste validation data here: <input type="text" id="validationData" name="validationData" value="<?php $rawpostdata = file_get_contents("php://input"); if ($rawpostdata == "") { echo ("{VALIDATIONDATA}"); } else {echo ($rawpostdata);} ?>"></div>
		<br>
		<input type="submit" id="submit" value="Check Now!">
		<div id="result"></div>
		<br>
		<img id="thumbsUp" src="/common/validator/assets/thumbsup.png"/>
		<img id="thumbsDown" src="/common/validator/assets/thumbsdown.png"/>
		<img id="warning" src=""/>
		<div id="download"><a href="download/validator1.0.zip" target="_blank">Download validator source code</a></div>
	</body>
</html>