// ************* Global definitions ************* 

SLOTSGAME = new Object();
SLOTSGAME.version = "1.01"; //game engine version
SLOTSGAME.urlParameters = new Object(); //paramaters passed in the lopading URL
//SLOTSGAME.gameServerURL = "http://myfruitgame.com:8090"; //URL of the JSON-RPC gaming server
SLOTSGAME.gameServerURL = "http://104.236.235.114:8090"; //URL of the JSON-RPC gaming server
//SLOTSGAME.gameServerURL = "http://192.168.1.67:8090"; //URL of the JSON-RPC gaming server
//SLOTSGAME.gameServerURL = "http://127.0.0.1:8090"; //URL of the JSON-RPC gaming server
SLOTSGAME.testnet = true; //is game running on Bitcoin testnet? (this value should be set by the server)
SLOTSGAME.playerAccount = null; //current, active, verified player account
SLOTSGAME.displayCurrency = "tokens"; //currently selected display currency for all display items
SLOTSGAME.depositVerified = false; //has a deposit been made and verified for SLOTSGAME.playerAccount yet?
SLOTSGAME.depositCheckInterval = 60000; //check for deposit every 5000 milliseconds (5 seconds), if no deposit detected yet
SLOTSGAME.cashoutAccount = null; //cash out account address (usually only used during cashout process)
SLOTSGAME.suppress2FAWarnings = false; //suppress 2-Factor Authentication warnings (e.g. when an authentication action is currently active)?
SLOTSGAME.baseDimensions = {"width":560, "height":800}; //base or design dimensions of the game UI
SLOTSGAME.msgID = 1; //unique server message ID, incremented with each message
SLOTSGAME.requests = []; //array of last requests sent to the server, first is most recent. pruned at maxRequests
SLOTSGAME.maxRequests = 1000; //maximum number of requests to keep
SLOTSGAME.autospin = new Object(); //contains the current autospin settings such as triggers and limits
SLOTSGAME.lastSpinResults = {}; //server-returned object containing results of last completed spin+selection actions
SLOTSGAME.displayCurrency = "tokens"; //default display currency
SLOTSGAME.currentBalance = new BigNumber(0); //current account balance, usually in tokens
SLOTSGAME.currentBTCBalance = new BigNumber(0); //current account balance in Bitcoin
SLOTSGAME.previousBalance = new BigNumber(0); //balance previous to any betting commit action
SLOTSGAME.currentJackpotAmount = new BigNumber(0); //current jackpot amount for the game in BTC
SLOTSGAME.currentJackpotBTCAmount = new BigNumber(0); //current jackpot amount for the game
SLOTSGAME.baseJackpotAmount = new BigNumber(0); //base jackpot amount defined by the paytable (currentjackpotAmount is added to this)
SLOTSGAME.jackpotCheckInterval = 5000; //check updated jackpot amount every 5000 milliseconds (5 seconds)
SLOTSGAME.serverFees = {}; //transaction and other fees as reported by the server
SLOTSGAME.currentBetIndex = 0; //current index into allowed bet values array (from config)
SLOTSGAME.configPath = "../common/game_configs/game_info_0001.json"; //game configuration path
SLOTSGAME.config = {}; //parsed game configuration data
SLOTSGAME.loadQueue = {}; //PreloadJS queue
SLOTSGAME.reelIcons = []; //reel icon objects
SLOTSGAME.reelCanvasID = ["reel1","reel2","reel3"]; //element IDs of reel canvases
SLOTSGAME.reelCanvas = new Array(); //canvases for reel displays
SLOTSGAME.reelContainer = new Array(); //containers for static reels
SLOTSGAME.reelBlurContainer = new Array(); //containers for blurred (animating) reels
SLOTSGAME.reelBlurAmount = 110; //the blur amount, in pixels, to apply to the reel while spinning (0 disables blur)
SLOTSGAME.reelSpinSpeed = 83; //the speed at which the reels will spin, in pixels per 10 ms (negative values spin upward)
SLOTSGAME.reelSpinAcceleraton = 50; //the acceleration, in pixels, at which to spin up the reels
SLOTSGAME.reelsPrimeTime = 700; //time, in milliseconds, to animate the reel prime motion
SLOTSGAME.reelStopStagger = 1000; //delay, in millilseconds, to stagger the reel stops at (0 stops all reels simultaneously)
SLOTSGAME.reelStopCoordinates = new Array(); //array of arrays with coordinate offsets for each stop position (e.g. reelStopCoordinates[0][1] is the stop coordinate for reel 0, stop position 1)
SLOTSGAME.validationData = new Object(); //post-game validation data that can be sent to a local or third-party service for integrity verification

SLOTSGAME.reelSpinInterval = null; //timer interval used to animate reels when spinning
SLOTSGAME.currentReelSpeeds = new Array();
SLOTSGAME.reelsSpinning = false; //are any reels spinning?
SLOTSGAME.reelSpinning = new Array(); //is a specific reel spinning?
SLOTSGAME.autologoutTime = "00:08:00:00"; //automatically log player out every 8 hours (format is: "days:hours:minutes:seconds", leading 0s can be omitted if desired)

var numberFormat = {
    decimalSeparator: '.',
    groupSeparator: ',',
    groupSize: 3,
    secondaryGroupSize: 0,
    fractionGroupSeparator: ' ',
    fractionGroupSize: 0
}
BigNumber.config({ EXPONENTIAL_AT: 1e+9, DECIMAL_PLACES: 8, ROUNDING_MODE: BigNumber.ROUND_FLOOR, FORMAT:numberFormat });

var popupWindow = null; //reference to any currently active pop-up window

var autologoutTimerID = null; //timer ID of the current autologout timer tick
var autologoutTime = null; //ISO string formatted target date/time for the autologout. If the current system time exceeds this time and the logout timer it active then the player will be logged out.
var passwordUpdateInterval = 10; //number of minutes that must elapse between subsequent password reset attempts (should reflect server setting)

//******************* ADDED VARIABLES **********************
var mobileWidth = 60; //added to avoid reel images getting cut off
var logInHeaderPath = ".navbar .container .navbar-content #navbarTop .nav #logInHeaderButton" ; //path for the logIn in the header
var loginEmailInputPath = "#at-login #emailAddressInput";
var loginPasswordInputPath = "#at-login #passwordInput";
var registerEmailInputPath = "#at-register #emailAddressRegInput";
var registerPasswordInputPath = "#at-register #passwordRegInput";
var resetEmailInputPath = "#at-pwreset #resetEmailAddressInput";
var resetPasswordInputPath = "#at-pwreset #resetPasswordInput";
var resetConfirmPasswordInputPath = "#at-pwreset #resetPasswordInput";
var registerConfirmPasswordInputPath = "#at-register #confirmPasswordRegInput";
var accountHeaderDropdown ="body .navbar .container .navbar-content #navbarTop .nav #accountHeaderDropdown"; //path for the accountHeaderDropdown
var userName = "Username_001"; // username, should change later
var logOutPath = ".content #logOutModal .modal-dialog .modal-content .modal-footer #logOutButton"
var logInButtonPath = ".content #at-login .modal-dialog .modal-content .modal-body #logInButton";
var logInConfirmButtonPath = ".content #at-login-confirm .modal-dialog .modal-content .modal-body #logInConfirmButton";
var logInCancelButtonPath = ".content #at-login-confirm .modal-dialog .modal-content .modal-body #logInCancelButton";
var resetPasswordButtonPath = ".content #at-pwreset .modal-dialog .modal-content .modal-body #resetPasswordButton";
var loginDialogFooterPath = ".content #at-login .modal-dialog .modal-content .modal-footer";

var registerButtonPath = ".content #at-login .modal-dialog .modal-content .modal-body #registerButton";
var registerAnonymousButtonPath = ".content #at-login .modal-dialog .modal-content .modal-body #playAnonymouslyButton";
var doRegisterButtonPath = ".content #at-register .modal-dialog .modal-content .modal-body #doRegisterButton";
var register2FAECheckboxPath = ".content #at-register .modal-dialog .modal-content .modal-body #use2FAECheckbox";
var accountButtonPath = ".navbar .container .navbar-content #navbarTop .nav #myAccountButton";
var namePath = accountHeaderDropdown + " .dropdown-toggle #playerName";

var progressiveTableHeight = 50;


// ******************************* ADDED FUNCTIONS ************************

/**
* Should add proper log ins here
*/

function clearLoginForm() {
	$(loginEmailInputPath).val();
	$(loginPasswordInputPath).val();
	$(loginEmailInputPath).attr("autocomplete", "off");
	setTimeout(function() {$(loginEmailInputPath).val("");}, 2000); //this timeout appears to be neccessary for this to work
	$(loginPasswordInputPath).attr("autocomplete", "off");
	setTimeout(function() {$(loginPasswordInputPath).val("");}, 2000);
}

function clearRegistrationForm() {
	$(registerEmailInputPath).val();
	$(registerPasswordInputPath).val();
	$(registerConfirmPasswordInputPath).val();
	$(registerEmailInputPath).attr("autocomplete", "off");
	setTimeout(function() {$(registerEmailInputPath).val("");}, 2000); 
	$(registerPasswordInputPath).attr("autocomplete", "off");
	setTimeout(function() {$(registerPasswordInputPath).val("");}, 2000);
	$(registerConfirmPasswordInputPath).attr("autocomplete", "off");
	setTimeout(function() {$(registerConfirmPasswordInputPath).val("");}, 2000);
	
}

function onLogIn(){
	trace ("onLogIn()");
	if ((SLOTSGAME.playerAccount != null) && (SLOTSGAME.playerAccount != "")) {
		showLoginConfirmDialog();
	} else {
		onLoginConfirmClick(null);
	}
}

function onLoginConfirmClick(event) {
	var email = $(loginEmailInputPath).val();
	restartAutoLogoutTimer();
	if (!validateEmail(email)) {
		alert ("Please enter a valid email address!");
		$(accountHeaderDropdown).hide();
		return;
	}
	var password = $(loginPasswordInputPath).val();	
	password = password.split(" ").join("");
	if (password == "") {
		alert ("Password can't be blank!");
		return;
	}
	var accountUpdateObj = new Object();
	accountUpdateObj.playerPassword = password;
	accountUpdateObj.playerEmail = email;
	localStorage.accountUpdate = JSON.stringify(accountUpdateObj);
	var params = new Object();				  
	params.email = email;
	params.password = password;
	callServerMethod("getAccountInfo", params, onGetAccountInfo);  
}

function onLoginCancelClick(event) {
	restartAutoLogoutTimer();
	$('.content #at-login-confirm').modal("hide");
}

function onRegisterClick(event) {
	restartAutoLogoutTimer();
	showRegisterDialog();
}

function onRegisterAnonymousClick(event) {
	if ((SLOTSGAME.playerAccount != null) && (SLOTSGAME.playerAccount != "")) {
		return;
	}
	disableGameUI();
	getNewAccount();
}

function onResetPasswordClick(event) {
	restartAutoLogoutTimer();
	var lastUpdateObj = new Date(localStorage.lastPasswordUpdate);
	var lastUpdated = lastUpdateObj.valueOf()+(passwordUpdateInterval*60000); //passwordUpdateInterval is in minutes
	var deltaMinutes = (lastUpdated - Date.now()) / 60000;	
	if (deltaMinutes > 0) {
		$(accountHeaderDropdown).hide();
		$('.content #at-login').modal('hide');
		showError("You must wait at least "+String(Math.ceil(deltaMinutes))+" minute(s) before another password reset attempt.","Too Many Password Reset Attempts");
		return;
	}
	var email = $(loginEmailInputPath).val();
	if (!validateEmail(email)) {
		alert ("Please enter a valid registered email address!");
		$(accountHeaderDropdown).hide();
		return;
	};
	$('.content #at-login').modal('hide');
	disableGameUI();
	var accountUpdateObj = new Object();
	accountUpdateObj.playerEmail = email;
	localStorage.accountUpdate = JSON.stringify(accountUpdateObj);	
	var params = new Object();				  
	params.email = email;
	callServerMethod("requestPasswordReset", params, onResetPassword);  
}

function onResetPassword(resultData) {	
	if (resultData.error != null) {	
		if (resultData.error.code == -32007) {
			//password reset email already sent
			var dateObj = new Date();
			localStorage.lastPasswordUpdate = dateObj.toISOString();
		}
		showError(resultData.error.message);		
		$(".content #dialog").on( "dialogclose", enableGameUI);
	} else {
		dateObj = new Date();
		localStorage.lastPasswordUpdate = dateObj.toISOString();
		showError("Check your email for a password reset link.","Password Reset Email Sent");
	}
}

function onRegisterFullClick(event) {
	restartAutoLogoutTimer();
	event.preventDefault();
	var email = $(registerEmailInputPath).val();
	if (!validateEmail(email)) {
		alert ("Please enter a valid email address!");
		return;
	}
	var password = $(registerPasswordInputPath).val();	
	password = password.split(" ").join("");
	if (password == "") {
		alert ("Password can't be blank!");
		return;
	}
	var confirmPassword = $(registerConfirmPasswordInputPath).val();	
	confirmPassword = confirmPassword.split(" ").join("");
	if (password != confirmPassword) {
		alert ("Password must match confirmation password!");
		return;
	}
	var use2FAE = $(register2FAECheckboxPath).is(':checked');
	disableGameUI();
	var accountUpdateObj = new Object();
	accountUpdateObj.playerPassword = password;
	accountUpdateObj.playerEmail = email;
	accountUpdateObj.use2FAE = use2FAE;
	localStorage.accountUpdate = JSON.stringify(accountUpdateObj);				
	if ((SLOTSGAME.playerAccount != "") && (SLOTSGAME.playerAccount != null) && (SLOTSGAME.playerAccount != undefined)) {
		localStorage.playerAccount = SLOTSGAME.playerAccount;
		accountUpdateObj = JSON.parse(localStorage.accountUpdate);
		var params = new Object();
		params.email = accountUpdateObj.playerEmail;
		params.password =  accountUpdateObj.playerPassword;
		params.use2FAE = use2FAE;
		localStorage.playerPassword = params.password;
		localStorage.email = params.email;
		callServerMethod("updateAccountInfo", params, onUpdateAccountInfo);
	} else {
		var affiliateID = getURLParameter("af");
		callServerMethod("newGamingAccount", {"affiliateID":affiliateID}, onRegisterFullAddress);
	}
}

function onRegisterFullAddress(resultData) {
	if (resultData.error != null) {	
		if (resultData.error.code == -32006) {
			var request = getStoredRequestByID(resultData.id);
			showLoginDialog();
		} else {	
			showError(resultData.error.message);		
			$(".content #dialog").on( "dialogclose", enableGameUI);
		}
	} else {
		var accountUpdate = JSON.parse(localStorage.accountUpdate);	
		SLOTSGAME.playerAccount = resultData.result.account;
		SLOTSGAME.depositVerified = false;
		SLOTSGAME.serverFees = resultData.result.fees;
		localStorage.playerAccount = resultData.result.account;		
		localStorage.depositVerified = false;
		$(".content #gameUI #depositButton").hide();
		$(".content #gameUI #cashoutButton").hide();
		$(".content #depositAddress #prompt").replaceWith("<div id=\"prompt\">Deposit address:</div>");
		var accountUpdate = JSON.parse(localStorage.accountUpdate);
		var params = new Object();
		params.email = accountUpdate.playerEmail;
		params.password =  accountUpdate.playerPassword;
		params.use2FAE = accountUpdate.use2FAE;
		callServerMethod("updateAccountInfo", params, onUpdateAccountInfo);
	}
}

function onRegisterFullEmail(resultData) {
	if (resultData.error == null) {
		var accountUpdate = JSON.parse(localStorage.accountUpdate);
		localStorage.playerAccount = resultData.result.account;
		SLOTSGAME.playerAccount = resultData.result.account;	
		localStorage.playerAccount = resultData.result.account;
		localStorage.playerPassword = accountUpdate.playerPassword;
		localStorage.playerEmail = accountUpdate.playerEmail;		
		SLOTSGAME.playerEmail = accountUpdate.playerEmail;
		$(".content #depositAddress #prompt").replaceWith("<div id=\"prompt\">Deposit address:</div>");
		$(".content #depositAddress #value").replaceWith("<div id=\"value\">"+SLOTSGAME.playerAccount+"</div>");
		$(".content #gameUI #depositButton").hide();
		callServerMethod("getAccountBalance", {}, onGetBalance);
		enableGameUI();
	} else {
		if (resultData.error.code == -32006) {
			showError("Login Incorrect!");		
			$(".content #dialog").on( "dialogclose", enableGameUI);		
		} else if (resultData.error.code == -32007) {
			show2FAIncompleteDialog();
		} else {
			showError(resultData.error.message);		
			$(".content #dialog").on( "dialogclose", enableGameUI);
		}
	}
	checkDeposit();
}

function onGetAccountInfo (resultData) {
	$('.content #at-login').modal("hide");
	$('.content #at-register').modal("hide");
	if (resultData.error == null) {
		localStorage.playerAccount = resultData.result.account;
		SLOTSGAME.playerAccount = resultData.result.account;		
		try {
			var accountUpdate = JSON.parse(localStorage.accountUpdate);
			localStorage.playerPassword = accountUpdate.playerPassword;
			localStorage.playerEmail = accountUpdate.playerEmail;			
			SLOTSGAME.playerEmail = accountUpdate.playerEmail;
		} catch (err) {
			localStorage.remomveItem("playerPassword");
			localStorage.removeItem("playerEmail");			
			SLOTSGAME.playerEmail = null;
		}
		//localStorage.depositVerified = false;
		$(".content #depositAddress #prompt").replaceWith("<div id=\"prompt\">Deposit address:</div>");
		$(".content #depositAddress #value").replaceWith("<div id=\"value\">"+SLOTSGAME.playerAccount+"</div>");
		$(".content #gameUI #checkDepositButton").replaceWith("<button type=\"button\" class=\"btn btn-success btn-lg hidden-xs\" id=\"checkDepositButton\">CHECK FOR DEPOSIT</button>");
		$(".content #gameUI #checkDepositButton").button();
		$(".content #gameUI #checkDepositButton").click(onCheckDepositClick);
		$(".content #gameValidationButton").hide();
		$(".content #gameValidationCopyButton").hide();
		callServerMethod("getAccountBalance", {}, onGetBalance);	
		enableGameUI();
		//restart autologout timer every time a player successfully logs in
		stopAutoLogoutTimer();
		startAutoLogoutTimer(SLOTSGAME.autologoutTime);
	} else {
		if (resultData.error.code == -32006) {
			showError("Login Incorrect!");		
			$(".content #dialog").on( "dialogclose", enableGameUI);		
		} else if (resultData.error.code == -32007) {
			show2FAIncompleteDialog();
		} else {
			showError(resultData.error.message);		
			$(".content #dialog").on( "dialogclose", enableGameUI);
		}
	}
	setAccountLink();
}

function onUpdateAccountInfo(resultData) {
	if ((resultData["error"] == null) || (resultData["error"] == undefined)) {		
		var accountUpdate = JSON.parse(localStorage.accountUpdate);
		localStorage.playerPassword = accountUpdate.playerPassword;
		localStorage.playerEmail = accountUpdate.playerEmail;
		$(".content #depositAddress #prompt").replaceWith("<div id=\"prompt\">Deposit address:</div>");
		$(".content #depositAddress #value").replaceWith("<div id=\"value\">"+SLOTSGAME.playerAccount+"</div>");
		checkDeposit();
		$('.content #at-register').modal("hide");
		enableGameUI();
		if ((SLOTSGAME.playerAccount == null) || (SLOTSGAME.playerAccount == "")) {
			$(registerAnonymousButtonPath).show();
		}
	} else {	
		alert (resultData.error.message);
	}
	setAccountLink();
}


function onLogOut(){
	trace ("onLogOut()");
	clearStoredPlayerAccount();
	updateBalance(0);
	var loginHTML='<li id="logInHeaderButton"><a href="#" data-toggle="modal" data-target="#at-login"><span id="playerName"><i class="fa fa-sign-in" aria-hidden="true"></i> Login / Register</span></a></li>';
	$("#logInHeaderButton").replaceWith(loginHTML);
	$(".content #header #winAmount").replaceWith( "<div id=\"winAmount\">0</div>" );
	$(".content #depositAddress #prompt").replaceWith("<div id=\"prompt\"></div>");
	$(".content #depositAddress #value").replaceWith("<div id=\"value\"></div>");
	$(".content #gameUI #checkDepositButton").replaceWith("<button type=\"button\" class=\"btn btn-success btn-lg hidden-xs\" id=\"checkDepositButton\">DEPOSIT</button>");
	$(".content #gameUI #checkDepositButton").button();
	$(".content #gameUI #checkDepositButton").click(onCheckDepositClick);
    $(logInHeaderPath).show();
    $(accountHeaderDropdown).hide();
	$(".content #gameUI #cashoutButton").hide();
	$(".content #gameUI #depositButton").show();
	$(registerAnonymousButtonPath).show();
	clearLoginForm();
}

function onAutoplayClick(event) {
}

function onAutoplaySettingsClick(event) {
}


//For dynamically Adding Progressive Table on Top
function progressiveTable(imageScale) {
    if ((imageScale == undefined) || (imageScale == null)){
        imageScale = 110;
    }
    var uniqueCombinations = new Array();
    for (var count = 0; count < SLOTSGAME.config.wins.length; count++) {
        var currentWin = SLOTSGAME.config.wins[count];
        var winObj = storeUniqueWinObject(currentWin, uniqueCombinations);
    }
    for (count = 0; count < uniqueCombinations.length ; count++) {
        var combo = uniqueCombinations[count];
        if (combo._reelCount == SLOTSGAME.config.reels.length) {
            var wildcardIconIndex = -1;
            for (var count2=0; count2 < SLOTSGAME.config.reels.length; count2++) {
                if (combo.symbols[count2] > -1) {
                    wildcardIconIndex = combo.symbols[count2];
                }
                if (count2 == (SLOTSGAME.config.reels.length - 2)) {
                } else if (count2 == (SLOTSGAME.config.reels.length - 1)) {
                    var iconPath = SLOTSGAME.config.symbols[combo.symbols[wildcardIconIndex]].icon;
                }
            }
            if ((combo["jackpot"] != null) && (combo["jackpot"] != undefined) && (combo["jackpot"] != "")) {
                SLOTSGAME.baseJackpotAmount = new BigNumber(String(combo.multiplier));
            } 
        } else {
            var comboRow = "<tr height=\""+imageScale+"\">";
            for (var count2=0; count2 < SLOTSGAME.config.reels.length ; count2++) {
                var iconPath = SLOTSGAME.config.symbols[combo.symbols[count2]].icon;
                if(count == 0){
                    comboRow+="<td style=\"padding:0px\" align=\"center\" valign=\"middle\" width=\""+imageScale+"\">";
                    comboRow += "<img src=\""+iconPath+"\" width=\""+imageScale+"\" height=\""+imageScale+"\"></img>";
                    comboRow += "</td>";
                }
            }
            if ((combo["jackpot"] != null) && (combo["jackpot"] != undefined) && (combo["jackpot"] != "")) {
                SLOTSGAME.baseJackpotAmount = new BigNumber(String(combo.multiplier));
                comboRow += "<td style=\"padding:0px\" id=\"jackpot\" align=\"center\" valign=\"middle\"><div id=\"multiplier\">"+String(combo.multiplier)+"</div><div id=\"disclaimer\">WITH MAX BET</div><div id=\"value\"></div></td>";
            } 
            comboRow += "</tr>";
            if(count == 0){
                $(".content #progressive #container tr:last").before(comboRow); 
            }
        }
    }
    updatePaytableJackpot();
}


//For dynamically Adding Progressive Display on Top
function progressiveTableMenu(imageScale) {
    if ((imageScale == undefined) || (imageScale == null)){
        imageScale = 110;
    }
    var uniqueCombinations = new Array();
    for (var count = 0; count < SLOTSGAME.config.wins.length; count++) {
        var currentWin = SLOTSGAME.config.wins[count];
        var winObj = storeUniqueWinObject(currentWin, uniqueCombinations);
    }
    for (count = 0; count < uniqueCombinations.length ; count++) {
        var combo = uniqueCombinations[count];
        if (combo._reelCount == SLOTSGAME.config.reels.length) {
            var wildcardIconIndex = -1;
            for (var count2=0; count2 < SLOTSGAME.config.reels.length; count2++) {
                if (combo.symbols[count2] > -1) {
                    wildcardIconIndex = combo.symbols[count2];
                }
                if (count2 == (SLOTSGAME.config.reels.length - 2)) {
                } else if (count2 == (SLOTSGAME.config.reels.length - 1)) {
                    var iconPath = SLOTSGAME.config.symbols[combo.symbols[wildcardIconIndex]].icon;
                }
            }
            if ((combo["jackpot"] != null) && (combo["jackpot"] != undefined) && (combo["jackpot"] != "")) {
                SLOTSGAME.baseJackpotAmount = new BigNumber(String(combo.multiplier));
            } 
        } else {
            var comboRow = "<tr height=\""+imageScale+"\">";
            for (var count2=0; count2 < SLOTSGAME.config.reels.length ; count2++) {
                var iconPath = SLOTSGAME.config.symbols[combo.symbols[count2]].icon;
                if(count == 0){
                    comboRow+="<td align=\"center\" valign=\"middle\" width=\""+imageScale+"\">";
                    comboRow += "<img src=\""+iconPath+"\" width=\""+imageScale+"\" height=\""+imageScale+"\"></img>";
                    comboRow += "</td>";
                }
            }
            if ((combo["jackpot"] != null) && (combo["jackpot"] != undefined) && (combo["jackpot"] != "")) {
                SLOTSGAME.baseJackpotAmount = new BigNumber(String(combo.multiplier));
                comboRow += "<td id=\"jackpot\" align=\"center\" valign=\"middle\"><div id=\"multiplier\">"+String(combo.multiplier)+"</div><div id=\"value\"></div></td>";
            } 
            comboRow += "</tr>";
            if(count == 0){
                $(".content #menuModal  #progressiveStyle #progressiveMenu #container tr:last").before(comboRow); 
            }
        }
    }
    updatePaytableJackpot();
}


function showProgressiveTable(){
    $(".content #desktopProgressive #progressive").show(500);
    $(".content #desktopProgressive #progressiveTitle #hide").show();
    $(".content #desktopProgressive #progressiveTitle #show").hide();
   
   
   
}
function hideProgressiveTable(){
    $(".content #desktopProgressive #progressive").hide(500);
    $(".content #desktopProgressive #progressiveTitle #show").show();
    $(".content #desktopProgressive #progressiveTitle #hide").hide();
    
    
}

function noClick(){
    
}



// ***********************END OF ADDED FUNCTIONS ************************




// ************* Global / utility functions *************

/**
* Cross-browser-safe logging function.
*
* @param msg The message to send to the output log.
*/
function trace (msg) {
    try {
        console.log(msg);
    } catch (err) {
    }
}

/**
* Validates an input string for valid email address formatting.
*
* @param email The email string to validate.
*
* @return True if the 'email' parameter is a properly formatted email address.
*/
function validateEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

/**
* Provides a safe way to access the value of a browser URL parameter.
*
* @param paramName The URL paramater name to attempt to access.
*
* @return Either the value of the named parameter or null.
*/
function getURLParameter(paramName) {
    if (SLOTSGAME.urlParameters == null) {
        return (null);
    }
    if (SLOTSGAME.urlParameters[paramName] != undefined) {
        return (SLOTSGAME.urlParameters[paramName]);
    }
    return (null);
}

/**
* Loads the game configuration in SLOTSGAME.configPath
*/
function loadGameConfig() {
    SLOTSGAME.loadQueue = new createjs.LoadQueue(true);
    SLOTSGAME.loadQueue.on ("fileload", onLoadGameConfig, this);
    SLOTSGAME.loadQueue.on ("error", onLoadGameConfigError, this);
    trace ("Loading configuration file: "+SLOTSGAME.configPath);
    SLOTSGAME.loadQueue.loadFile({id:"config", src:SLOTSGAME.configPath, type:createjs.AbstractLoader.JSON});
}

/**
* Event listener invoked when the game configuration has been loaded.
*
* @param event A PreloadJS file load event object.
*/
function onLoadGameConfig(event) {
    SLOTSGAME.config = event.result;
	localStorage.config = event.result;
    trace ("Configuration loaded for \""+SLOTSGAME.config.name+"\" ["+SLOTSGAME.config.ID+"]:");
    trace (JSON.stringify(event.result));
    buildPaytable();
	SLOTSGAME.currentBetIndex=SLOTSGAME.config.bets.length - 1;
    updateBet(SLOTSGAME.currentBetIndex);
    updateJackpotAmount();
    loadReelIcons();
    progressiveTable(progressiveTableHeight);
    progressiveTableMenu(progressiveTableHeight);
}

/**
* Event listener invoked when the game configuration load reports an error.
*
* @param A PreloadJS file load event object.
*/
function onLoadGameConfigError(eventObj) {
    alert ("Could not load game configuration:\n\n"+SLOTSGAME.configPath);
}

/**
* Loads reel icons defined in SLOTSGAME.config
*/
function loadReelIcons() {
    trace ("Loading reel icons...");
    SLOTSGAME.loadQueue = new createjs.LoadQueue(true);
    SLOTSGAME.loadQueue.on ("fileload", onLoadReelIcon, this);
    SLOTSGAME.loadQueue.on ("complete", onReelIconsLoaded, this);
    SLOTSGAME.loadQueue.on ("error", onLoadReelIconError, this);
    for (var count = 0; count < SLOTSGAME.config.symbols.length; count++) {
        var currentSymbolObj = SLOTSGAME.config.symbols[count];
        trace ("Loading reel icon \""+currentSymbolObj.name+"\": "+currentSymbolObj.icon);
        SLOTSGAME.loadQueue.loadFile({id:"reelicon"+String(currentSymbolObj.index), data:currentSymbolObj, src:currentSymbolObj.icon, type:createjs.AbstractLoader.IMAGE});
    }
}

/**
* Invoked when a reel icon has finished loading.
*
* @param event A Preload.js load event object.
*/
function onLoadReelIcon(event) {
    trace ("Image loaded: "+JSON.stringify(event.item.data));
    event.item.data.image = event.result;
    event.item.data.imageRaw = event.rawResult;
    SLOTSGAME.reelIcons.push(event.item.data);
}

/**
* Invoked when a reel icon load returns an error.
*
* @param event A Preload.js load event object.
*/
function onLoadReelIconError(event) {
    trace ("Image loaded error: "+event.toString());
}

/**
* Invoked when all queued reel icon loads have completed.
*
* @param event A Preload.js load event object.
*/
function onReelIconsLoaded(event) {
    for (var count=0; count < SLOTSGAME.config.reels.length; count++) {
        SLOTSGAME.reelContainer[count] = createReel(count, SLOTSGAME.config.reels[count], 0);
        SLOTSGAME.reelBlurContainer[count] = createReel(count, SLOTSGAME.config.reels[count], SLOTSGAME.reelBlurAmount);
        SLOTSGAME.reelBlurContainer[count].visible = false;
        SLOTSGAME.currentReelSpeeds[count] = 0;
    }
}

/**
* Dynamically constructs the paytable from loaded configuration data.
*
* @param imageScale A number containing the image size, in pixels, or percent scale (string should include "%").
*/

function buildPaytable(imageScale) {
    if ((imageScale == undefined) || (imageScale == null)){
      //  imageScale = 110;
	    imageScale = 55;
    }
	var longestCombo = 0;
	//find longest symbol combination...
	for (var count=0; count <  SLOTSGAME.config.wins.length; count++) {
		var currentWin = SLOTSGAME.config.wins[count];
		if (currentWin.symbols.length > longestCombo) {
			longestCombo = currentWin.symbols.length;
		}
	}
	 $(".content .modal-dialog .modal-content .modal-body #paytable #container").replaceWith("<table id=\"container\"><tr><td></td></tr></table>");
	//generate header and insert empty columns to match longest possible symbol combination
	var headerRow = "<tr id=\"header\" height=\""+imageScale+"\"><td id=\"coins\" align=\"center\" valign=\"middle\" width=\""+imageScale+"\">COINS</td>";
	for (var count = 0; count < (longestCombo-1); count++) {
		headerRow += "<td id=\"coinAmount\" align=\"center\" width=\""+imageScale+"\" valign=\"middle\">&nbsp;</td>";
	}
	//add available coin amounts to header...
	for (count = 0; count < SLOTSGAME.config.bets.length; count++) {
		headerRow += "<td id=\"coinAmount\" align=\"center\" width=\""+imageScale+"\" valign=\"middle\">"+convertAmount(SLOTSGAME.config.bets[count], "tokens", SLOTSGAME.displayCurrency).toFormat()+"</td>";
	}
	headerRow += "</tr>";
	$(".content .modal-dialog .modal-content .modal-body #paytable #container tr:last").before(headerRow);
	var uniqueCombinations = new Array();
    for (count = 0; count < SLOTSGAME.config.wins.length; count++) {
        var currentWin = SLOTSGAME.config.wins[count];
        var winObj = storeUniqueWinObject(currentWin, uniqueCombinations);
    }
    for (count = 0; count < uniqueCombinations.length; count++) {
        var combo = uniqueCombinations[count];
        if (combo._reelCount == SLOTSGAME.config.reels.length) {
			//generate final row (ANY or wilcard combos)
            var comboRow = "<tr height=\""+imageScale+"\">";
            var wildcardIconIndex = -1;
			for (var count2=0; count2 < SLOTSGAME.config.reels.length; count2++) {
				if (combo.symbols[count2] > -1) {
					wildcardIconIndex = combo.symbols[count2];
				}
			   comboRow+="<td align=\"center\" valign=\"middle\" width=\""+imageScale+"\">";
				if (count2 == (SLOTSGAME.config.reels.length - 2)) {
					comboRow += "ANY";
				} else if (count2 == (SLOTSGAME.config.reels.length - 1)) {
					var iconPath = SLOTSGAME.config.symbols[combo.symbols[wildcardIconIndex]].icon;
					comboRow += "<img src=\""+iconPath+"\" width=\""+imageScale+"\" height=\""+imageScale+"\"></img>";
					comboRow += " ";
				} else {
					comboRow += " ";
				}
				comboRow += "</td>";
			}
			for (var coinCount = 0; coinCount < SLOTSGAME.config.bets.length; coinCount++) {
				var betAmount = new BigNumber(String(SLOTSGAME.config.bets[coinCount]));
				var multiplier = new BigNumber(String(combo.multiplier));
				var winAmount = betAmount.times(multiplier);
				winAmount = convertAmount(winAmount, "tokens", SLOTSGAME.displayCurrency);
				if ((combo["jackpot"] != null) && (combo["jackpot"] != undefined) && (combo["jackpot"] != "") && (coinCount == (SLOTSGAME.config.bets.length - 1))) {
					SLOTSGAME.baseJackpotAmount = new BigNumber(String(combo.multiplier));
					comboRow += "<td id=\"jackpot\" align=\"center\" valign=\"middle\"><div id=\"multiplier\">"+winAmount.toFormat()+"</div><div id=\"value\"></div></td>";				
				} else {
					comboRow += "<td id=\"multiplier\" align=\"center\" valign=\"middle\">"+winAmount.toFormat()+"</td>";
				}			
			}
            comboRow += "</tr>";
            $(".content .modal-dialog .modal-content .modal-body #paytable #container tr:last").before(comboRow);
        } else {
			//generate normal row
            var comboRow = "<tr height=\""+imageScale+"\">";			
			for (var count2=0; count2 < SLOTSGAME.config.reels.length; count2++) {
				var iconPath = SLOTSGAME.config.symbols[combo.symbols[count2]].icon;
				comboRow+="<td align=\"center\" valign=\"middle\" width=\""+imageScale+"\">";
				comboRow += "<img src=\""+iconPath+"\" width=\""+imageScale+"\" height=\""+imageScale+"\"></img>";
				comboRow += "</td>";
			}
			for (coinCount = 0; coinCount < SLOTSGAME.config.bets.length; coinCount++) {
				betAmount = new BigNumber(String(SLOTSGAME.config.bets[coinCount]));
				multiplier = new BigNumber(String(combo.multiplier));
				winAmount = betAmount.times(multiplier);
				winAmount = convertAmount(winAmount, "tokens", SLOTSGAME.displayCurrency);
				if ((combo["jackpot"] != null) && (combo["jackpot"] != undefined) && (combo["jackpot"] != "") && (coinCount == (SLOTSGAME.config.bets.length - 1))) {
					SLOTSGAME.baseJackpotAmount = new BigNumber(String(combo.multiplier));
					comboRow += "<td id=\"jackpot\" align=\"center\" valign=\"middle\"><div id=\"multiplier\">"+winAmount.toFormat()+"</div><div id=\"value\"></div></td>";				
				} else {
					comboRow += "<td id=\"multiplier\" align=\"center\" valign=\"middle\">"+winAmount.toFormat()+"</td>";
				}
			}
            comboRow += "</tr>";
            $(".content .modal-dialog .modal-content .modal-body #paytable #container tr:last").before(comboRow);
        }
    }
    updatePaytableJackpot();
}


/**
* Updates the jackpot amount on the paytable and other related UI elements such as header jackpot display.
*/
function updatePaytableJackpot() {
	var highestBet = new BigNumber(0);
	 for (var count = 0; count < SLOTSGAME.config.bets.length; count++) {
        var currentBet = new BigNumber(SLOTSGAME.config.bets[count]);
        if (currentBet.greaterThan(highestBet)) {
			highestBet = currentBet;
		}
    }	
	//var totalJackpotAmount = SLOTSGAME.baseJackpotAmount.times(highestBet).plus(SLOTSGAME.currentJackpotAmount);
	//totalJackpotAmount = convertAmount(totalJackpotAmount, "tokens", SLOTSGAME.displayCurrency);
	var totalJackpotAmount = SLOTSGAME.currentJackpotBTCAmount;
	totalJackpotAmount = convertAmount(totalJackpotAmount, "btc", SLOTSGAME.displayCurrency);
	$(".content #paytable #container #jackpot #multiplier").html(totalJackpotAmount.toFormat());
    $(".content #progressive #container #jackpot #multiplier").html(totalJackpotAmount.toFormat());
    $(".content #progressiveMenu #container #jackpot #multiplier").html(totalJackpotAmount.toFormat());
}

/**
* Helper function for 'buildPaytable' used to store a win information object uniquely.
*/
function storeUniqueWinObject(currentWin, existingWins) {
    for (var count=0; count<existingWins.length; count++) {
        var existingWin = existingWins[count];
        //compare uniqueness by 'name' attribute -- do we want to use another?
        if (existingWin.name == currentWin.name) {
            existingWin._reelCount++;
            return (existingWin);
        }
    }
    currentWin._reelCount = 1;
    existingWins.push (currentWin);
    return (existingWins[existingWins.length-1]);
}

/**
* Retrieves stored player account information from local browser storage, if available. 'SLOTSGAME.playerAccount' is
* updated with loaded data and the deposit dialog is automatically shown if a deposit has not yet been verified.
*
* @return True if the player account was successfully loaded and deposit verified, false otherwise.
*/
function getStoredPlayerAccount() {
    SLOTSGAME.playerAccount = null;
	SLOTSGAME.depositVerified = false;
	if (typeof(Storage) !== "undefined") {
		try {
			localStorage.gameServerURL = SLOTSGAME.gameServerURL;
			SLOTSGAME.playerAccount =  localStorage.playerAccount;
			SLOTSGAME.depositVerified = localStorage.depositVerified;
		} catch (err) {
			SLOTSGAME.playerAccount = null;
			SLOTSGAME.depositVerified = false;
		}
	}
	if ((SLOTSGAME.playerAccount == "null") || (SLOTSGAME.playerAccount == "NULL") || (SLOTSGAME.playerAccount == "Null")) {
		SLOTSGAME.playerAccount = null;
	}
	if ((SLOTSGAME.playerAccount == null) || (SLOTSGAME.playerAccount == undefined) || (SLOTSGAME.playerAccount == "")) {
		SLOTSGAME.depositVerified = false;
		return (false);
	}
	if ((SLOTSGAME.depositVerified == "false") || (SLOTSGAME.depositVerified == 0)) {
		SLOTSGAME.depositVerified = false;
	}
	return (true);
}

/**
* Clears browser-stored player account and deposit verified information.
*/
function clearStoredPlayerAccount() {
    if (typeof(Storage) !== "undefined") {
		localStorage.removeItem("playerAccount");
		localStorage.removeItem("depositVerified");
		localStorage.removeItem("playerPassword");
		localStorage.removeItem("playerEmail");
		localStorage.removeItem("accountUpdate");
	}
	SLOTSGAME.playerAccount = null;
	SLOTSGAME.depositVerified = false;	
	SLOTSGAME.playerEmail = null;
	//SLOTSGAME.cashoutAccount = null;
	SLOTSGAME.serverFees = null;
	SLOTSGAME.accountUpdate = null;
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

// ************* Button / click handlers *************

/**
* Invoked when the game's 'spin' button is clicked.
*/
function onSpinClick(event) {
	restartAutoLogoutTimer();
	if ((SLOTSGAME.autospin.active == true) && (event != null)) {
		stopAutospin();
		return;
	}
    if ((SLOTSGAME.playerAccount == null) || (SLOTSGAME.playerAccount == "")) {
		showLoginDialog();
        //showError("Player account has not been created yet. Click \"DEPOSIT\" to create one.", "No Account");
        return;
    } else {
		disableGameUI();
        if (SLOTSGAME.reelsSpinning == false) {
            $(".content #gameValidationButton").hide();
            $(".content #gameValidationCopyButton").hide();
            $(".content #header #winAmount").replaceWith( "<div id=\"winAmount\">0</div>" );
            var betAmount = new BigNumber(String(SLOTSGAME.config.bets[SLOTSGAME.currentBetIndex]));
            SLOTSGAME.previousBalance = new BigNumber(SLOTSGAME.currentBalance.toString());
            SLOTSGAME.currentBalance = SLOTSGAME.currentBalance.minus(betAmount);
            SLOTSGAME.validationData = new Object();
            SLOTSGAME.validationData.gameConfig = SLOTSGAME.config;
            updateBalance(SLOTSGAME.currentBalance);
            startReelSpin();
            getSpinResults(betAmount);
        }
	}
}

function onAutospinClick(event) {
	disableGameUI();
	restartAutoLogoutTimer();
	if (!stopAutospin()) {
		startAutospin();
	}
}

function onAutospinSettingsClick(event) {
	restartAutoLogoutTimer();
	if (SLOTSGAME.autospin.active == true) {
		return;
	}
	$('.content #autospinSettingsModal').modal("show");
}

function onChangeNumAutospins(event) {
	restartAutoLogoutTimer();
	var numSpins = $(".content #autospinSettingsModal #settings #numSpins").val();
	if (numSpins < 1) {
		numSpins = "unlimited";
	} else {
		numSpins = String(numSpins);
	}
	var numSpinsHTML = "<span id=\"spinsValue\">"+numSpins+"</span>";
	$(".content #autospinSettingsModal #settings #spinsValue").replaceWith(numSpinsHTML);
	SLOTSGAME.autospin.numSpins = Number($(".content #autospinSettingsModal #settings #numSpins").val());
	SLOTSGAME.autospin.currentSpin = 0;
}

function onChangeMinBalAutospins(event) {
	restartAutoLogoutTimer();
	var minBalance = $(".content #autospinSettingsModal #settings #minumBalance").val();
	if (minBalance == 0) {
		minBalance = "unlimited";
	} else {
		minBalance = String(minBalance);
	}
	var minBalanceHTML = "<span id=\"spinsValue\">"+minBalance+"</span>";
	SLOTSGAME.autospin.minBalance = $(".content #autospinSettingsModal #settings #minumBalance").val();
}

/**
* Invoked when the game's 'commit' button is clicked in the results selection dialog.
*
* @param event A jQuery UI event object.
*/
function onCommitSelectionsClick(event) {
	restartAutoLogoutTimer();
    var selections=new Array();
    for (var count=0; count < SLOTSGAME.config.reels.length; count++) {
        selections.push($("#gameUI #resultSelectors #reel"+String(count+1)+"Result").val());
    }
    $(".content #gameUI #resultSelectors").hide();
    submitSelections(selections);
}

/**
* Invoked when the game's 'paytable' button is clicked in order to show the paytable.
*
* @param event A jQuery UI event object.
*/
function onPaytableOpenClick(event) {
	restartAutoLogoutTimer();
    disableGameUI();
    $(".content #paytable").show();
}

/**
* Invoked when the game's 'validate game' button is clicked.
*
* @param event A jQuery UI event object.
*/
function onValidateGameClick(event) {
	restartAutoLogoutTimer();
    if (popupWindow != null) {
        popupWindow.close();
        popupWindow = null;
    }
    popupWindow = window.open('../common/validator/index.php', 'validatorPopupWindow','height=340, width=700, resizable=no, scrollbars=no, toolbar=no, menubar=no, location=no, directories=no, status=no');
    testPopupReady(0);
}

/**
* Invoked when the game's 'My Account' button is clicked.
*
* @param event A jQuery UI event object.
*/
function onAccountClick(event) {
	restartAutoLogoutTimer();
    if (popupWindow != null) {
        popupWindow.close();
        popupWindow = null;
    }	
	
    popupWindow = window.open('../account.php', 'accountPopupWindow','height=340, width=700, resizable=no, scrollbars=no, toolbar=no, menubar=no, location=no, directories=no, status=no');
	console.log ("testPopupReady");
    testPopupReady(1);
}

function onValidateDataCopyClick(event) {
	restartAutoLogoutTimer();
    copyToClipboard(JSON.stringify(SLOTSGAME.validationData));
}

function testPopupReady(popupType) {
    if (popupWindow["ready"] != true) {
        setTimeout(testPopupReady, 5, popupType);
        return;
    }	    
	switch (popupType) {
		//validator popup
		case 0:	
			popupWindow.updateValidationData(JSON.stringify(SLOTSGAME.validationData));
			break;
		//account / leaderboard / stats
		case 1:	
			setTimeout(2000, alert, "Setting open window info");
			var accountInfo = new Object();
			accountInfo.parentWindow = window;
			accountInfo.parentRef = this;
			accountInfo.gameServerURL = SLOTSGAME.gameServerURL;
			accountInfo.playerAccount = SLOTSGAME.playerAccount;
			try {				
				if ((localStorage.playerPassword != null) && (localStorage.playerPassword != "") && (localStorage.playerPassword != undefined)) {
					accountInfo.playerPassword = localStorage.playerPassword;
				}				
			} catch (err) {
				accountInfo.playerPassword = null;
			}
			accountInfo.depositVerified = SLOTSGAME.depositVerified;
			accountInfo.lastSpinResults = SLOTSGAME.lastSpinResults;
			accountInfo.currentBalance = SLOTSGAME.currentBalance.toString();
			accountInfo.currentBTCBalance = SLOTSGAME.currentBTCBalance.toString();
			accountInfo.previousBalance = SLOTSGAME.previousBalance.toString();			
			accountInfo.baseJackpotAmount = SLOTSGAME.baseJackpotAmount.toString();
			accountInfo.serverFees = SLOTSGAME.serverFees;			
			popupWindow.setAccountInfo(JSON.stringify(accountInfo));
			break;
		default: break;
	}
}

/**
* Invoked when the game's 'close' button is clicked on the paytable.
*
* @param event A jQuery UI event object.
*/
function onClosePaytableButtonClick(event) {
	restartAutoLogoutTimer();
    $(".content #paytable").hide();
    enableGameUI();
}

/**
* Invoked when the game's 'deposit' button is clicked.
*
* @param event A jQuery UI event object.
*/
function onDepositClick(event) {
	restartAutoLogoutTimer();
	showLoginDialog();
}

/**
* Invoked when the game's 'cash out' button is clicked.
*
* @param event A jQuery UI event object.
*/
function onCashoutClick(event) {
	restartAutoLogoutTimer();
	if (SLOTSGAME.autospin.active) {
		return;
	}
    $(".content #cashOutDialog").show();
	var availableBitcoin = new BigNumber(SLOTSGAME.currentBTCBalance);
	var fees = new BigNumber(SLOTSGAME.serverFees.bitcoin);
	availableBitcoin = availableBitcoin.minus(fees);
	$(".content #cashOutDialog #withdrawAmountField").val(availableBitcoin.toString());
	disableGameUI();
	$(".content #cashoutModal").modal("show");
		
}

function onConfirmCashoutClick(event) {
	restartAutoLogoutTimer();
    $("#dialog").dialog("close");
    var cashOutAddress = $(".content #cashOutDialog #addressField").val();
	var withdrawAmount = $(".content #cashOutDialog #withdrawAmountField").val();
	try {
		var withdrawBTC = new BigNumber(SLOTSGAME.cashoutAmount);
	} catch (err) {
		alert ("Enter a valid withdrawal amount, in Bitcoin.");
		return;
	}
	if (withdrawBTC.lessThanOrEqualTo(0)) {
		alert ("Withdrawal amount must be greater than 0.");
		return;
	}
	var availableBitcoin = new BigNumber(SLOTSGAME.currentBTCBalance);
	var fees = new BigNumber(SLOTSGAME.serverFees.bitcoin);
	availableBitcoin = availableBitcoin.minus(fees);
	if (withdrawBTC.greaterThan(availableBitcoin)) {
		showError ("Account balance insufficient for withdrawal.");
		return;
	}	
    if (cashOutAddress != "") {
		SLOTSGAME.cashoutAccount = cashOutAddress;
        callServerMethod("cashOut", {"receiver":cashOutAddress, "btc":withdrawBTC.toString()}, onDoCashOut);
    }
}


/**
* Invoked when the 'cash out' button is clicked on the cash out dialog.
*
* @param event A jQuery UI event object.
*/
function onDoCashOutClick(event) {
	restartAutoLogoutTimer();
    $(".content #cashOutDialog").hide();
	restartAutoLogoutTimer();
    var cashOutAddress = $(".content #cashOutDialog #addressField").val();
	var cashoutBTCAmount = $(".content #cashOutDialog #withdrawAmountField").val();
    SLOTSGAME.cashoutAccount = cashOutAddress;
	SLOTSGAME.cashoutAmount = cashoutBTCAmount;
    var fee = new BigNumber(SLOTSGAME.serverFees.bitcoin);
    var withdrawalAmount = new BigNumber(cashoutBTCAmount).plus(fee);
    var dialogMsg = "<div id=\"cashoutResultDialog\"><p>A miner's fee of BTC "+SLOTSGAME.serverFees.bitcoin+" will be deducted from the withdrawal amount.</p><p>Total withdrawal: BTC "+withdrawalAmount.toFormat()+"</p></div>";
    //Changed to Modal for mobile friendly
    $(".content #cashoutResult .modal-dialog .modal-content .modal-body #cashoutResultDialog").replaceWith(dialogMsg);
    $('.content #cashoutResult').modal('show');
}

/**
* Invoked when the 'cancel' button is clicked on the cash out dialog.
*
* @param event A jQuery UI event object.
*/
function onCancelCashOutClick(event) {
    restartAutoLogoutTimer();
	enableGameUI();
    $(".content #cashOutDialog").hide();
}


/**
* Invoked when the game's increase bet button is clicked.
*
* @param event A jQuery UI event object.
*/
function onIncreaseBetClick(event) {
	restartAutoLogoutTimer();
	if (SLOTSGAME.autospin.active) {
		return;
	}
    SLOTSGAME.currentBetIndex++;
    if (SLOTSGAME.currentBetIndex >= SLOTSGAME.config.bets.length) {
        SLOTSGAME.currentBetIndex = 0;
    }
    updateBet(SLOTSGAME.currentBetIndex);
}

function onCheckDepositClick(event) {
	restartAutoLogoutTimer();
	if (SLOTSGAME.autospin.active) {
		return;
	}
	if ((SLOTSGAME.playerAccount == null) || (SLOTSGAME.playerAccount == undefined) || (SLOTSGAME.playerAccount == "")) {
		$(".content #depositAddress #prompt").replaceWith("<div id=\"prompt\">A new deposit address is being generated.</div>");
		$(".content #depositAddress #value").replaceWith("<div id=\"value\"></div>");
		$(".content #gameUI #cashoutButton").show();
		$(".content #gameUI #depositButton").hide();
		getNewAccount();
	} else {
		callServerMethod("checkAccountDeposit", {}, onCheckDeposit);
	}
}

/**
* Invoked when the game's decrease bet button is clicked.
*
* @param event A jQuery UI event object.
*/
function onDecreaseBetClick(event) {
	restartAutoLogoutTimer();
	if (SLOTSGAME.autospin.active) {
		return;
	}
    SLOTSGAME.currentBetIndex--;
    if (SLOTSGAME.currentBetIndex < 0) {
        SLOTSGAME.currentBetIndex = SLOTSGAME.config.bets.length -1;
    }
    updateBet(SLOTSGAME.currentBetIndex);
}

// ************* RPC / Server request and response handlers *************

/**
* Main RPC request function. Constructs a standard JSON-RPC 2.0 request object and appends required
* game values before invoking a jQuery POST request to the gaming server.
*
* @param methodName The RPC method to invoke.
* @param params A native JavaScript object containing the parameters to include with the request.
* @param resultCallback The callback function to invoke when a result or error response is received from the server.
*/
function callServerMethod(methodName, params, resultCallback) {
	params.gameID = SLOTSGAME.config.ID;
	params.account = SLOTSGAME.playerAccount;
	params.nonce = 0;
	try {
		if (params["password"] == undefined) {
			if ((localStorage.playerPassword != null) && (localStorage.playerPassword != "") && (localStorage.playerPassword != undefined)) {
				params.password = localStorage.playerPassword;
			}
		}
	} catch (err) {}
	var request = {"jsonrpc":"2.0", "id":SLOTSGAME.msgID, "method":methodName, "params":params};	
	$.post(SLOTSGAME.gameServerURL, 
			JSON.stringify(request),
			resultCallback);
	trace (JSON.stringify(request));
	request.callback = resultCallback;
	SLOTSGAME.requests.unshift(request);
	if (SLOTSGAME.requests.length > SLOTSGAME.maxRequests) {
		SLOTSGAME.requests.pop();
	}
	SLOTSGAME.msgID++;	
	return (request);
}

function getStoredRequestByID(requestID) {
	for (var count = 0; count < SLOTSGAME.requests.length; count++) {
		if (SLOTSGAME.requests[count].id == requestID) {
			return (SLOTSGAME.requests[count]);
		}
	}
	return (null);
}

/**
  * Invokes the 'newGamingAccount' RPC method to generate a new account.
  */
function getNewAccount() {
    var affiliateID = getURLParameter("af"); //may be null
    callServerMethod("newGamingAccount", {"affiliateID":affiliateID}, onGetNewAccount);
}

/**
  * Callback method invoked when the 'newGamingAccount' RPC method returns a result from the gaming server.
  *
  * @param resultData The JSON-RPC 2.0 result object (parsed into a native data object), returned from the server.
  */
function onGetNewAccount(resultData) {
    if (resultData.error != null) {	
		if (resultData.error.code == -32006) {
			var request = getStoredRequestByID(resultData.id);
			showLoginDialog();
		} else {	
			showError(resultData.error.message);		
			$(".content #dialog").on( "dialogclose", enableGameUI);
		}
	} else {
		SLOTSGAME.playerAccount = resultData.result.account;
		SLOTSGAME.depositVerified = false;
		SLOTSGAME.serverFees = resultData.result.fees;
		localStorage.playerAccount = resultData.result.account;	
		localStorage.depositVerified = false;
		$(".content #depositAddress #prompt").replaceWith("<div id=\"prompt\">Deposit address:</div>");
		$(".content #depositAddress #value").replaceWith("<div id=\"value\">"+resultData.result.account+"</div>");
		$(".content #gameUI #checkDepositButton").replaceWith("<button type=\"button\" class=\"btn btn-success btn-lg hidden-xs\" id=\"checkDepositButton\">CHECK FOR DEPOSIT</button>");
		$(".content #gameUI #checkDepositButton").button();
		$(".content #gameUI #checkDepositButton").click(onCheckDepositClick);
		$(registerAnonymousButtonPath).hide();
		checkDeposit();	
	}
	setAccountLink();
}


/**
  * Invokes the 'checkAccountDeposit' RPC method to check the deposit for the 'SLOTSGAME.playerAccount' account.
  */
function checkDeposit() {
    callServerMethod("checkAccountDeposit", {"account":SLOTSGAME.playerAccount}, onCheckDeposit);
}

/**
  * Callback method invoked when the 'checkAccountDeposit' RPC method returns a result from the gaming server.
  *
  * @param resultData The JSON-RPC 2.0 result object (parsed into a native data object), returned from the server.
  */
function onCheckDeposit(resultData) {
    if (resultData.error != null) {	
		if (resultData.error.code == -32006) {
			var request = getStoredRequestByID(resultData.id);
			showLoginDialog();
		} else if (resultData.error.code == -32007) {
			show2FAIncompleteDialog();
		} else {
			showError(resultData.error.message);		
			$("#dialog").on("dialogclose", enableGameUI);
		}
	} else {
		try {
			var tokens = new BigNumber(resultData.result.balance.tokens);
		} catch (err) {
			tokens = new BigNumber(0);
		}
		try {
			var bitcoin = new BigNumber(resultData.result.balance.bitcoin);
		} catch (err) {
			bitcoin = new BigNumber(0);
		}
		try {
			var uc_bitcoin = new BigNumber(resultData.result.balance.bitcoin_unconfirmed);		
		} catch (err) {
			uc_bitcoin = new BigNumber(0);
		}
		if (tokens.equals(0) == false) {
			SLOTSGAME.depositVerified = true;
			if (typeof(Storage) !== "undefined") {
				try {					
					localStorage.depositVerified = true;
				} catch (err) {
				}
			}	
			SLOTSGAME.currentBalance = tokens;
			SLOTSGAME.currentBTCBalance = bitcoin;
			updateBalance(SLOTSGAME.currentBalance);			
			updateBet(0);
			enableGameUI();
		} else {
			setTimeout(checkDeposit, SLOTSGAME.depositCheckInterval);
		}
	}	
}

/**
  * Calls the 'getGameResults' RPC method to retrieve spin results.
  *
  * @param betAmount The bet amount to include with the request.
  */
function getSpinResults(betAmount) {
    SLOTSGAME.validationData.resultsRequest = callServerMethod("getGameResults", {"bet":{"tokens":String(betAmount)}}, onGetSpinResult);
}

/**
  * Callback method invoked when the 'getGameResults' RPC method returns a result from the gaming server.
  *
  * @param resultData The JSON-RPC 2.0 result object (parsed into a native data object), returned from the server.
  */
function onGetSpinResult(resultData) {
   if (resultData.error == null) {
		SLOTSGAME.validationData.resultsResponse = resultData;		
		//update bet and balance in case game is resuming
		 var betAmount = resultData.result.bet.tokens;
		 var balanceAmount = resultData.result.balance.tokens;
		 SLOTSGAME.currentBTCBalance = new BigNumber(resultData.result.balance.bitcoin);
		 var betIndex = -1;
		 for (var count=0; count<SLOTSGAME.config.bets.length; count++) {
			 if (betAmount == String(SLOTSGAME.config.bets[count])) {
				 betIndex = count;
				 break;
			 }
		 }
		 updateBet(betIndex);
		 updateBalance(balanceAmount);		 
		 if ($(".content #autoSelectResultsCheck").is(':checked')) {			 
			selectResults(resultData.result.reelstopselections);
		 } else {
			 for (count=0; count<resultData.result.reelstopselections.length; count++) {
				var currentReel = resultData.result.reelstopselections[count];
				populateResultSelector("#gameUI #resultSelectors #reel"+String(count+1)+"Result", currentReel);				
			}			
			$(".content #gameUI #resultSelectors").show();
		 }
	} else {
		stopAutospin();
		SLOTSGAME.currentBalance = new BigNumber(SLOTSGAME.previousBalance.toString());		
		if (resultData.error.code == -32006) {
			updateBalance(SLOTSGAME.currentBalance);
			setTimeout(stopReelSpinImmediate, (SLOTSGAME.reelsPrimeTime+100), [0,0,0]);;
			var request = getStoredRequestByID(resultData.id);
			showLoginDialog();
		} else if (resultData.error.code == -32007) {
			setTimeout(stopReelSpinImmediate, (SLOTSGAME.reelsPrimeTime+100), [0,0,0]);;
			show2FAIncompleteDialog();
		} else if (resultData.error.code == -32004) {
			if ((resultData.error["data"] != undefined) || (resultData.error["data"] != null)) {
				alert("Resuming unfinished game...");
				//previously started game is still in progress
				var statusInfo = resultData.error.data;
				callServerMethod("getGameStatus", {"index":statusInfo.index}, onGetSpinResult);
			} else {
				updateBalance(SLOTSGAME.currentBalance);
				setTimeout(stopReelSpinImmediate, (SLOTSGAME.reelsPrimeTime+100), [0,0,0]);;
				showError(resultData.error.message);
				$("#dialog").on("dialogclose", enableGameUI);
			}
		} else {
			updateBalance(SLOTSGAME.currentBalance);
			setTimeout(stopReelSpinImmediate, (SLOTSGAME.reelsPrimeTime+100), [0,0,0]);;
			showError(resultData.error.message);
			$("#dialog").on("dialogclose", enableGameUI);
		}
	}
}

/**
  * Callback method invoked when the 'cashOut' RPC method returns a result from the gaming server.
  *
  * @param resultData The JSON-RPC 2.0 result object (parsed into a native data object), returned from the server.
  */
function onDoCashOut(resultData) {
    trace(JSON.stringify(resultData));
	if ((resultData["error"] != null) && (resultData["error"] != undefined)) {		
		if (resultData.error.code == -32006) {
			var request = getStoredRequestByID(resultData.id);
			showLoginDialog();
		} else if (resultData.error.code == -32007) {
			show2FAIncompleteDialog();
		} else {
			showError(resultData.error.message);
			$("#dialog").on("dialogclose", enableGameUI);
		}
	} else {
		if ((resultData.result.tx["error"] != null) && (resultData.result.tx["error"] != null)) {
			showError(resultData.result.tx.error);
		} else {
			/*
			$("#dialog").on("dialogclose", null);
			var buttons = [
				{
				  text: "OK",
				  click: function() {
					  $("#dialog").dialog("close");
				  }
				}
			];
			*/
			if (SLOTSGAME.testnet) {
				showError ("You can check the state of the deposit by clicking <a href=\"https://live.blockcypher.com/btc-testnet/address/"+SLOTSGAME.cashoutAccount+"/\" target=\"_blank\">https://live.blockcypher.com/btc-testnet/address/"+SLOTSGAME.cashoutAccount+"/</a>", "Follow your deposit");
			} else {
				showError ("You can check the state of the deposit by clicking <a href=\"https://blockchain.info/address/"+SLOTSGAME.cashoutAccount+"\" target=\"_blank\">https://blockchain.info/address/"+SLOTSGAME.cashoutAccount+"</a>", "Follow your deposit");
			}
			callServerMethod("getAccountBalance", {}, onGetBalance); //update in-game balance
			/*
			clearStoredPlayerAccount(); //reset stored account data
			SLOTSGAME.currentBalance = new BigNumber(0);
			SLOTSGAME.previousBalance = new BigNumber(0);
			updateBalance(0);
			//reset UI
			$(".content #depositAddress #prompt").replaceWith("<div id=\"prompt\"></div>");
			$(".content #depositAddress #value").replaceWith("<div id=\"value\"></div>");
			enableGameUI();
			$(".content #gameUI #cashoutButton").hide();
			$(".content #gameUI #depositButton").show();
			$(".content #cashOutDialog").hide();
			*/
			enableGameUI();
		}
	}	
}

/**
  * Invokes the 'selectResults' RPC method to submit selected, encrypted results.
  */
function submitSelections(selections) {
    SLOTSGAME.validationData.selectRequest = callServerMethod("selectResults", {"results":selections}, onGetDecryptedSelections);
}

/**
  * Callback method invoked when the 'selectResults' RPC method returns a result from the gaming server.
  *
  * @param resultData The JSON-RPC 2.0 result object (parsed into a native data object), returned from the server.
  */
function onGetDecryptedSelections(resultData) {
   if (resultData.error == null) {
		SLOTSGAME.validationData.selectResponse = resultData;
		SLOTSGAME.currentBTCBalance = new BigNumber(resultData.result.balance.bitcoin);
		setTimeout(stopReelSpin, (SLOTSGAME.reelsPrimeTime+500), resultData.result.reelsInfo.stopPositions);	
		SLOTSGAME.lastSpinResults = resultData.result;					
	} else {
		stopAutospin();
		setTimeout(stopReelSpinImmediate, (SLOTSGAME.reelsPrimeTime+100), [0,0,0]);
		if (resultData.error.code == -32006) {
			var request = getStoredRequestByID(resultData.id);
			showLoginDialog();
		} else if (resultData.error.code == -32007) {
			show2FAIncompleteDialog();
		} else {
			showError(resultData.error.message);
			$("#dialog").on("dialogclose", enableGameUI);
		}
	}
}

/**
  * Updates the UI with the results of a game.
  *
  * @param resultsObject The JSON-RPC 2.0 result object containing the game results (as received from the game server, for example).
  */
function updateGameResults(resultsObject) {
    var reelsInfo = resultsObject.reelsInfo;
    var winInfo = resultsObject.win;
    var betInfo = resultsObject.bet;
    var balanceInfo = resultsObject.balance;
   // SLOTSGAME.currentJackpotAmount = new BigNumber(resultsObject.jackpot.tokens);
    SLOTSGAME.currentJackpotBTCAmount = new BigNumber(resultsObject.jackpot.bitcoin);
    $(".content #header #winAmount").replaceWith( "<div id=\"winAmount\">"+convertAmount(winInfo.tokens, "tokens", SLOTSGAME.displayCurrency).toFormat()+"</div>" );
    SLOTSGAME.currentBalance = new BigNumber(balanceInfo.tokens);
    updateBalance(balanceInfo.tokens);
    updatePaytableJackpot();
}

function updateJackpotAmount() {
    callServerMethod("getJackpot", {}, onGetJackpotUpdate);
}

function onGetJackpotUpdate(resultsObject) {
	//alert ("onGetJackpotUpdate: "+JSON.stringify(resultsObject));
    if ((resultsObject["error"] != null) && (resultsObject["error"] != undefined) && (resultsObject["error"] != "")) {
        //probably no such jackpot
    } else {
     //   var newJackpot = new BigNumber(resultsObject.result.jackpot.tokens);
		var newBTCJackpot = new BigNumber(resultsObject.result.jackpot.bitcoin);
        if (SLOTSGAME.currentJackpotBTCAmount.equals(newBTCJackpot)) {
            //no change
        } else {
            //jackpot value updated
       //   SLOTSGAME.currentJackpotAmount = newJackpot;
			SLOTSGAME.currentJackpotBTCAmount = newBTCJackpot;
            updatePaytableJackpot();
        }
        setTimeout(updateJackpotAmount, SLOTSGAME.jackpotCheckInterval);
    }
}

/**
  * Callback method invoked when the 'getAccountBalance' RPC method returns a result from the gaming server.
  *
  * @param resultData The JSON-RPC 2.0 result object (parsed into a native data object), returned from the server.
  */
function onGetBalance(resultObject) {
   if (resultObject.error == null) {
		try {
			SLOTSGAME.currentBalance = new BigNumber(resultObject.result.balance.tokens);
		} catch (err) {
			SLOTSGAME.currentBalance = new BigNumber(0);
		}
		SLOTSGAME.serverFees = resultObject.result.fees;
		SLOTSGAME.currentBTCBalance = new BigNumber(resultObject.result.balance.bitcoin);
		//SLOTSGAME.currentSatoshiBalance = 
		$(".content #gameUI #cashoutButton").show();
		$(".content #gameUI #depositButton").hide();
		updateBalance(SLOTSGAME.currentBalance);
	} else {
		if (resultObject.error.code == -32006) {
			var request = getStoredRequestByID(resultObject.id);
			showLoginDialog();
		} else if (resultObject.error.code == -32007) {
			show2FAIncompleteDialog();
		} else {
			showError(resultObject.error.message);
			$("#dialog").on("dialogclose", enableGameUI);
		}	
	}
}

function onCheckDeposit(resultObject) {
	if (resultObject.error == null) {
		onGetBalance(resultObject);
	} else {
		if (resultObject.error.code == -32006) {
			var request = getStoredRequestByID(resultObject.id);
			showLoginDialog();
		} else if (resultObject.error.code == -32007) {
			show2FAIncompleteDialog();
		} else {
			showError(resultObject.error.message);
			$("#dialog").on("dialogclose", enableGameUI);
		}
	}
}

// ************* UI handlers & renderers *************

/**
* Displays a modal password dialog with optional password and email update functionality.
*/
function showLoginDialog() {
	setTimeout(stopReelSpinImmediate, (SLOTSGAME.reelsPrimeTime+500), [0,0,0]);
	disableGameUI();
	$('.content #at-login').modal('show');
}

/**
* Displays a modal confirmation dialog if an existing address is about to be removed.
*/
function showLoginConfirmDialog() {
	setTimeout(stopReelSpinImmediate, (SLOTSGAME.reelsPrimeTime+500), [0,0,0]);
	disableGameUI();
	$('.content #at-login-confirm').modal('show');
}

/**
* Displays a modal registtration dialog with password & confirm, and email update functionality.
*/
function showRegisterDialog() {
	setTimeout(stopReelSpinImmediate, (SLOTSGAME.reelsPrimeTime+500), [0,0,0]);
	disableGameUI();
	$('.content #at-register').modal("show");
}

function request2FAEmail() {
	$("#dialog").dialog("close");
	callServerMethod("authenticateRequest", {}, onRequest2FAEmail);
}

function onRequest2FAEmail(resultData) {
	if (resultData.error == null) {
		showError("Authentication email has been sent. Please check your inbox.", "Email Sent");
	} else {
		showError(resultData.error.message, "Authentication Email Request Error");
	}	
}

function verify2FACode(code) {	
	SLOTSGAME.suppress2FAWarnings = true;
	showError("Authenticating your account...", "Authenticating Account");
	callServerMethod("authenticateAccount", {"auth":code}, onVerify2FACode);
}

function onVerify2FACode(resultData) {
	if (resultData.error == null) {
		showError("Congratulations!<br/><br/>You have successfully enabled 2-Factor Authentication for your account.", "2-Factor Authentication Enabled");	
	} else {
		showError(resultData.error.message, "Authentication Verification Error");
	}
	SLOTSGAME.suppress2FAWarnings = false;
}

function resetPassword(resetCode) {	
	var accountUpdateObj = JSON.parse(localStorage.accountUpdate);
	accountUpdateObj.resetCode = resetCode;
	$(resetEmailInputPath).val(accountUpdateObj.playerEmail);
	localStorage.accountUpdate = JSON.stringify(accountUpdateObj);
	$('.content #at-login').modal('hide');
	disableGameUI();
	showPasswordResetDialog();
}

function onDoResetPasswordClick(event) {
	restartAutoLogoutTimer();
	event.preventDefault();
	var password = $(resetPasswordInputPath).val();	
	password = password.split(" ").join("");
	if (password == "") {
		alert ("Password can't be blank!");
		return;
	}
	var confirmPassword = $(resetConfirmPasswordInputPath).val();	
	confirmPassword = confirmPassword.split(" ").join("");
	if (password != confirmPassword) {
		alert ("Password must match confirmation password!");
		return;
	}
	var email = $(resetEmailInputPath).val();
	if (!validateEmail(email)) {
		alert ("Please enter a valid and confirmed email address!");
		return;
	}	
	var accountUpdateObj = JSON.parse(localStorage.accountUpdate);
	disableGameUI();
	var accountUpdateObj = JSON.parse(localStorage.accountUpdate);
	var params = new Object();
	params.email = email;
	params.resetCode = accountUpdateObj.resetCode;
	params.password =  password;
	callServerMethod("passwordReset", params, onCompleteResetPassword);
}

function onCompleteResetPassword(resultData) {
	if ((resultData.error != null) && (resultData.error != undefined)) {
		showError(resultData.error.message);
	} else {
		alert ("Password has been successfully changed.");
		var dateObj = new Date();
		localStorage.lastPasswordUpdate = dateObj.toISOString();
		var accountUpdateObj = JSON.parse(localStorage.accountUpdate);
		$(loginEmailInputPath).val(accountUpdateObj.playerEmail);
		showLoginDialog();
	}
}

/**
* Displays a modal registtration dialog notifying the user that their 2-Factor registration process is incomplete.
*/
function show2FAIncompleteDialog() {
	if (SLOTSGAME.suppress2FAWarnings) {
		return;
	}	
	//$(loginDialogFooterPath).hide(); //hide register button
	setTimeout(stopReelSpinImmediate, (SLOTSGAME.reelsPrimeTime+500), [0,0,0]);
	disableGameUI();
	var dialogMsg ="You haven't completed 2-Factor Authentication yet.<br/>Please check your inbox for the email or ";
	dialogMsg += "<a href=\"#\" onclick=\"request2FAEmail()\">click here</a> ";
	dialogMsg += "to try sending again.";
	var dialogTitle = "Account Not Authenticated";
	showError(dialogMsg, dialogTitle);
}


/**
  * Updates the balance field with the specified amount.
  *
  * @param amount The token balance amount to update the UI with.
  */
function updateBalance(amount) {	
	$("#gameUI #balance #amount").replaceWith( "<div id=\"amount\">"+convertAmount(amount, "tokens", SLOTSGAME.displayCurrency).toFormat()+"</div>" );
}

/**
  * Updates the bet field with the specified amount.
  *
  * @param betIndex The index of the bet amount to update the UI with. The index value refers to an amount
  * specified in 'SLOTSGAME.config.bets'.
  */
function updateBet(betIndex) {	
    var amount = SLOTSGAME.config.bets[betIndex];	
	var amountStr = convertAmount(amount, "tokens", SLOTSGAME.displayCurrency).toFormat();	
	var sizeMultiplier = 0;	
	switch (SLOTSGAME.displayCurrency) {
		case "btc": 			
			sizeMultiplier = 1/4;
			break;
		case "satoshis":			
			sizeMultiplier = 1/5;
			break;
		case "tokens":			
			sizeMultiplier = 0;
			break;
	}	
	var topVal = 2 + Math.round(25 * sizeMultiplier);
	var leftVal = 0 - Math.round(6 * sizeMultiplier);
	var sizeVal = 25 - Math.round(60 * sizeMultiplier);
	var style = "position:relative;top:"+String(topVal)+"px;left:"+String(leftVal)+"px;font-size:"+String(sizeVal)+"px;";
    $("#gameUI #bet #amount").replaceWith( "<div id=\"amount\" style=\""+style+"\">"+amountStr+"</div>" );
}

/**
  * Shows an error dialog with a specific message and optional header title.
  *
  * @param msg The error message to display in the dialog.
  * @param type The error type to display in the dialog header (title). If omitted or blank, "Server Error" is used.
  */
function showError(msg, type) {
    //Changing it to Modal instead of dialog. To make it more mobile friendly
    dialogTitle = '<h4 id="modalTitle" class="modal-title">' + type + '<h4>';
    dialogMsg ='<p id="error">' + msg + '</p>'
    $(".content #errorModal .modal-dialog .modal-content .modal-header #modalTitle").replaceWith(type);
    $(".content #errorModal .modal-dialog .modal-content .modal-body #error").replaceWith(dialogMsg);


    $('.content #errorModal').modal('show');
    enableGameUI();
}

/**
* Shows a notification dialog with a specific message, title, and buttons.
*
* @param title The dialog title to display.
* @param msg The message to display in the dialog body.
* @param buttons An object defining the buttons to include in the dialog.
*/
function showNotification(title, msg, buttons) {
    $("#dialog").dialog("option", "title", title);
    $("#dialog").dialog({"dialogClass":"no-close"});
    $("#dialog").dialog("option", "closeText", "");
    $("#dialog").dialog("option", "width", 600);
    $("#dialog").dialog("option", "buttons", buttons);
    $("#dialog #message").replaceWith( "<div id=\"message\">"+msg+"</div>" );
    $("#dialog").dialog("open");
    $("#dialog").dialog({dialogClass: "ui-front"});
    $("#dialog").dialog( "option", "css", "z-index:9999" );
}

/**
* Updates the deposit notification dialog. A valid player account must be stored in 'localStorage.playerAccount' before calling this function.
*/
function showDepositDialog() {
    if ((localStorage.playerAccount == null) || (localStorage.playerAccount == undefined)) {
        $(".content #depositAddress #value").replaceWith("<div id=\"value\"></div>");
    } else {
        $(".content #depositAddress #value").replaceWith("<div id=\"value\">"+localStorage.playerAccount+"</div>");
    }
}

/**
* Displays the reset password dialog.
*/
function showPasswordResetDialog() {
    $('.content #at-pwreset').modal('show');
}

/**
* Populates a single result selector/dropdown with values.
*
* @param selectorQuery The jQuery selector string that points to the specified selector to update.
* @param items An array of items to populate the selector with. Any existing items will be removed first.
*/
function populateResultSelector(selectorQuery, items) {
    var selectorQueryOptions = selectorQuery+" option";
    $(selectorQueryOptions).remove();
    var newList = "";
    for (var count=0; count < items.length; count++) {
        newList+="<option value=\""+items[count]+"\">"+items[count]+"</option>";
    }
    $(selectorQuery).append(newList);
    $(selectorQuery).menu("refresh",true);
}

/**
* Randomly (automatically) selects reel stop positions before submitting them to the server.
*
* @param reelStopSelections Array of arrays containing the encrypted stop positions for each reel to select.
*/
function selectResults(reelStopSelections) {
    //automated selection
    var selections = new Array();
    for (var count=0; count<reelStopSelections.length; count++) {
        var currentReel = reelStopSelections[count];
        var selectionIndex = Math.round(Math.random()*(currentReel.length-1));
        selections.push(currentReel[selectionIndex]);
    }
    submitSelections(selections);
}

function startAutospin() {
	SLOTSGAME.autospin.currentSpin = 0;
	SLOTSGAME.autospin.active = true;
	nextAutospin(true);
}

function nextAutospin(initialSpin) {
	if (SLOTSGAME.autospin.active == false) {
		return;
	}
	restartAutoLogoutTimer();
	disableGameUI();
	var doSpin = true;
	var buttonHTML = "<button class=\"btn btn-warning btn-sm\" id=\"autospinButton\" style=\"width:49%;\">";
	var spinsLeft = 0;
	if ((SLOTSGAME.autospin.currentSpin > SLOTSGAME.autospin.numSpins) && (SLOTSGAME.autospin.numSpins > 0)){
		doSpin = false;
	} else {
		spinsLeft = SLOTSGAME.autospin.numSpins - SLOTSGAME.autospin.currentSpin;
	}
	if (SLOTSGAME.autospin.numSpins == 0) {
		buttonHTML += "SPINS: &infin;";
	} else {
		buttonHTML += "SPINS: "+ String(spinsLeft);
	}
	var currentBalance = SLOTSGAME.currentBalance;
	var minimumBalance = new BigNumber(SLOTSGAME.autospin.minBalance);
	if (minimumBalance.greaterThan(0)) {
		if (minimumBalance.greaterThanOrEqualTo(currentBalance)) {
			doSpin = false;
		}
	}
	if (doSpin) {
		if (initialSpin == true) {
			onSpinClick(null);
		} else {
			setTimeout(onSpinClick, 1500, null);
		}
	} else {
		SLOTSGAME.autospin.active = false;
		buttonHTML = "<button class=\"btn btn-info btn-sm\" id=\"autospinButton\" style=\"width:49%;\">";
		buttonHTML += "START AUTOSPIN";
		enableGameUI();
	}
	buttonHTML += "</button>";
	$("#autospinContainer #autospinButton").replaceWith(buttonHTML);
	$("#autospinContainer #autospinButton").button();
    $("#autospinContainer #autospinButton").click(onAutospinClick);
	SLOTSGAME.autospin.currentSpin++;
}

function pauseAutospin() {
	SLOTSGAME.autospin.active = false;
	enableGameUI();
}

function stopAutospin() {
	if (SLOTSGAME.autospin.active) {
		var buttonHTML = "<button class=\"btn btn-info btn-sm\" id=\"autospinButton\" style=\"width:49%;\">";
		buttonHTML += "START AUTOSPIN";
		$("#autospinContainer #autospinButton").replaceWith(buttonHTML);
		$("#autospinContainer #autospinButton").button();
		$("#autospinContainer #autospinButton").click(onAutospinClick);
		SLOTSGAME.autospin.active = false;
		enableGameUI();
		return (true);
	}
	return (false);
}

/**
* Starts the automatic logout functionality at the beginning of the period specified in the parameter. The localStorage object is used to
* store the elapsed time between sessions, if possible, otherwise this timeout is assumed to apply to a single session.
*
* @param timeString A string specifying the timeout period for the current player account to be automatically logged out. The format for this parameters is
*				"dd:hh:mm:ss". If portions are ommitted they are assumed to be the largest values. For example "10:30" is translated to 10 minutes and 30 seconds from now.
*/
function startAutoLogoutTimer(timeString) {
	var timePortions = timeString.split(":");
	var days = 0;
	var hours = 0;
	var minutes = 0;
	var seconds = 0;
	if (timePortions.length == 4) {
		days = new Number(timePortions[0]);
		hours = new Number(timePortions[1]);
		minutes = new Number(timePortions[2]);
		seconds = new Number(timePortions[3]);
	}
	if (timePortions.length == 3) {
		hours = new Number(timePortions[0]);
		minutes = new Number(timePortions[1]);
		seconds = new Number(timePortions[2]);
	}
	if (timePortions.length == 2) {
		minutes = new Number(timePortions[0]);
		seconds = new Number(timePortions[1]);
	}
	if (timePortions.length == 1) {
		seconds = new Number(timePortions[0]);
	}
	var timeout = new Date();
	timeout.setDate(timeout.getDate()+days);
	timeout.setHours(timeout.getHours()+hours);
	timeout.setMinutes(timeout.getMinutes()+minutes);
	timeout.setSeconds(timeout.getSeconds()+seconds);
	autologoutTime = timeout.toISOString();
	try {
		localStorage._autologout = autologoutTime;
	} catch (err) {
	}
	autologoutTimerID = setTimeout(onAutoLogoutTimerTick, 750); //check every 3/4 of a second -- adjust if this is causing performance problems!
}

/**
* Attempts to restart the autologout timer if either the `autologoutTime` variable is set of if a time can be found in the localStorage object.
*/
function restartAutoLogoutTimer() {
	if ((autologoutTime != null) && (autologoutTime != "")) {
		autologoutTimerID = setTimeout(onAutoLogoutTimerTick, 750);
		return;
	}
	if ((SLOTSGAME.playerAccount != null) && (SLOTSGAME.playerAccount != "") && (SLOTSGAME.playerPassword != null) && (SLOTSGAME.playerAccount != "")) {
		try {
			autologoutTime = localStorage._autologout;
			autologoutTimerID = setTimeout(onAutoLogoutTimerTick, 750);
			return;
		} catch (err) {
		}
	}
}

function onAutoLogoutTimerTick() {
	if ((autologoutTime == null) || (autologoutTime == "")) {
		//no timeout target specified!
		return;
	}
	var now = new Date();
	var target = new Date(autologoutTime);
	if (now.valueOf() > target.valueOf()) {
		if ((localStorage["playerPassword"] != null) && (localStorage["playerPassword"] != undefined) && (localStorage["playerPassword"] != "")) {
			//only clear out account if a password if present (not anonymous accounts!)
			autologoutTimerID = null;
			try {
				localStorage.removeItem("_autologout");
			} catch (err) {
			} finally {
				onLogOut();
				showError ("You have been automatically logged out for security reasons. Please log into your account again.");
			}
		}
	} else {
		autologoutTimerID = setTimeout(onAutoLogoutTimerTick, 750);
	}
}

function pauseAutoLogoutTimer() {
	if (autologoutTimerID != null) {
		clearTimeout(autologoutTimerID);
		autologoutTimerID = null;
	}
}

function stopAutoLogoutTimer() {
	pauseAutoLogoutTimer();
	autologoutTime = null;
	try {
		localStorage.removeItem("_autologout");
	} catch (err) {
	}
}

/**
* Enables all of the game's main user interface elements.
*/
function enableGameUI() {
    $(".content #spinButton").button("option", "disabled", false);
	$("#autospinContainer #autospinButton").button("option", "disabled", false);
	$("#autospinContainer #autospinSettingsButton").button("option", "disabled", false);
	$(".content #spinButton").button("option", "disabled", false);
    $(".content #gameUI #paytableButton").button("option", "disabled", false);
    $(".content #gameUI #bet #increaseBetButton").button("option", "disabled", false);
    $(".content #gameUI #bet #decreaseBetButton").button("option", "disabled", false);
    $(".content #gameUI #depositButton").button("option", "disabled", false);
    $(".content #gameUI #cashoutButton").button("option", "disabled", false);
    $(".content #autoSelectResultsCheck").checkboxradio("option", "disabled", false);
}

/**
* Disables all of the game's main user interface elements.
*/
function disableGameUI() {
    $(".content #spinButton").button("option", "disabled", true);
	$("#autospinContainer #autospinButton").button("option", "disabled", true);
	$("#autospinContainer #autospinSettingsButton").button("option", "disabled", true);
    $(".content #gameUI #paytableButton").button("option", "disabled", true);
    $(".content #gameUI #bet #increaseBetButton").button("option", "disabled", true);
    $(".content #gameUI #bet #decreaseBetButton").button("option", "disabled", true);
    $(".content #gameUI #depositButton").button("option", "disabled", true);
    $(".content #gameUI #cashoutButton").button("option", "disabled", true);
    $(".content #autoSelectResultsCheck").checkboxradio("option", "disabled", true);
}

/**
* Creates a blocking overlay with a text message.
*
* @param text The text to show in the overlay.
*/
function displayOverlay(text) {
    $("<table id='overlay'><tbody><tr><td>" + text + "</td></tr></tbody></table>").css({
        "position": "fixed",
        "top": "0px",
        "left": "0px",
        "width": "100%",
        "height": "100%",
        "background-color": "rgba(0,0,0,.5)",
        "z-index": "10000",
        "vertical-align": "middle",
        "text-align": "center",
        "color": "#fff",
        "font-size": "40px",
        "font-weight": "bold",
        "cursor": "wait"
    }).appendTo("body");
}

/**
* Removes the blocking overlay.
*/
function removeOverlay() {
    $("#overlay").remove();
}


/**
* Attempts to open the game interface in fullscreen mode.
*/
function goFullScreen() {
    //hide additional UI elements here
    if ($(".content").requestFullscreen) {
        $(".content").requestFullscreen();
    } else if ($(".content").msRequestFullscreen) {
        $(".content").msRequestFullscreen();
    } else if ($(".content").mozRequestFullScreen) {
        $(".content").mozRequestFullScreen();
    } else if ($(".content").webkitRequestFullscreen) {
        $(".content").webkitRequestFullscreen();
    }
}

/**
* Attempts to close the game interface which should be in fullscreen mode.
*/
function closeFullScreen() {
    if (document.cancelFullScreen) {
        document.cancelFullScreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.webkitCancelFullScreen) {
        document.webkitCancelFullScreen();
    }
    //restore additional UI elements here
}

// ************* Reel handlers & renderers *************

/**
* Gets an icon object containing information and the loaded image for a specific icon.
*
* @param iconIndex The index of the icon to retrieve. This index should match the icons
* defined in 'SLOTSGAME.reelIcons'.
*/
function getIconObject(iconIndex) {
    for (var count=0; count < SLOTSGAME.reelIcons.length; count++) {
        var currentIconObj = SLOTSGAME.reelIcons[count];
        if (currentIconObj.index == iconIndex) {
            return (currentIconObj);
        }
    }
    return (null);
}

/**
* Creates a reel strip image.
*
* @param reelNum The reel number to render into a strip image. The reel number is used as an index into
* existing canvases specified in 'SLOTSGAME.reelCanvas' so this array must exist first.
* @param iconIndexes An array of reel icon indexes to use to construct the strip.
* @param blurAmount The amount of vertical blur effect, in pixels, to apply to the generated strip.
*
* @return A container containing the generated reel strip added to the associated HTML5 canvas. The reel will
* have an additional 3 symbols added to the beginning and end of the strip (total of 6 extra symbols), to support
* seamless animation loops.
*/
function createReel(reelNum, iconIndexes, blurAmount) {
    var canvasRef = SLOTSGAME.reelCanvas[reelNum];
    var reelContainer = new createjs.Container();
    reelContainer.height = 0;
    SLOTSGAME.reelStopCoordinates[reelNum] = new Array();
    //add extra set of icons at beginning and end in order to create full loop
    for (var count = -3; count < (iconIndexes.length+3); count++) {
        if (count < 0) {
            var iconObj = getIconObject(iconIndexes[iconIndexes.length+count]);
        } else {
            iconObj = getIconObject(iconIndexes[count % iconIndexes.length]);
        }
        var bitmap = new createjs.Bitmap(iconObj.image);
        reelContainer.addChild(bitmap);
        reelContainer.height += bitmap.image.height ;
        bitmap.y = bitmap.image.height * count;
        //stop index is offset by 3 filler symbols at start!
        SLOTSGAME.reelStopCoordinates[reelNum].push(bitmap.y);
    }
    if (blurAmount > 0) {
        var blurFilter = new createjs.BlurFilter(0, blurAmount, 1);
        reelContainer.filters=[blurFilter];
    }
    var canvasWidth = $("#"+SLOTSGAME.reelCanvasID[reelNum]).width()+mobileWidth ;
    var canvasHeight = $("#"+SLOTSGAME.reelCanvasID[reelNum]).height();
    reelContainer.cache(0,(canvasHeight*-1),canvasWidth, (reelContainer.height + blurAmount)); //add extra cache height to accomodate blur
    canvasRef.addChild(reelContainer);
    canvasRef.update();
    return (reelContainer);
}

/**
* Begins the reel spin animation.
*/
function startReelSpin() {
    SLOTSGAME.reelsSpinning = true;
    if (SLOTSGAME.reelSpinSpeed > 0) {
        //spin down
        for (var count = 0; count < SLOTSGAME.config.reels.length; count++) {
            var reelContainer = SLOTSGAME.reelContainer[count];
            var canvasRef = SLOTSGAME.reelCanvas[count];
            var startingPosition = reelContainer.y;
            SLOTSGAME.reelSpinning[count] = true;
            //prime reel
            createjs.Tween.get(reelContainer).to({y:(startingPosition-100)}, (SLOTSGAME.reelsPrimeTime/2), createjs.Ease.cubicOut).to({y:(startingPosition)}, (SLOTSGAME.reelsPrimeTime/2), createjs.Ease.cubicIn).call(onReelPrimed);
            canvasRef.update();
        }
    } else {
        //spin up
        for (count = 0; count < SLOTSGAME.config.reels.length; count++) {
            reelContainer = SLOTSGAME.reelContainer[count];
            canvasRef = SLOTSGAME.reelCanvas[count];
            startingPosition = reelContainer.y;
            SLOTSGAME.reelSpinning[count] = true;
            //prime reel
            createjs.Tween.get(reelContainer).to({y:(startingPosition+100)}, (SLOTSGAME.reelsPrimeTime/2), createjs.Ease.cubicOut).to({y:(startingPosition)}, (SLOTSGAME.reelsPrimeTime/2), createjs.Ease.cubicIn).call(onReelPrimed);
            canvasRef.update();
        }
    }
}

/**
* Begins the staggered reel stop animation.
*
* @param stopPosition An array of numeric stop positions to stop the reels at. Each index in this array refers to a matching reel.
*/
function stopReelSpinImmediate(stopPositions) {
    SLOTSGAME.reelsSpinning = false;
    clearInterval(SLOTSGAME.reelSpinInterval);
    SLOTSGAME.reelSpinInterval = null;
    for (var count=0; count < SLOTSGAME.config.reels.length; count++) {
        var canvasRef = SLOTSGAME.reelCanvas[count];
        var positionIndex = stopPositions[count];
        SLOTSGAME.reelSpinning[count] = false;
        //add 2 to skip past repeating filler symbols at start of reel
        positionIndex += 2;
        if (positionIndex < 0) {
            positionIndex = SLOTSGAME.reelStopCoordinates[count].length + positionIndex;
        }
        var positionOffset = SLOTSGAME.reelStopCoordinates[count][positionIndex];
        SLOTSGAME.reelSpinning[count] = false;
        SLOTSGAME.reelBlurContainer[count].visible = false;
        SLOTSGAME.reelContainer[count].y = positionOffset * -1;
        SLOTSGAME.reelContainer[count].visible = true;
        canvasRef.update();
    }
}

/**
* Stops the reel spin animation for a specific reel.
*
* @param stopPosition An array of numeric stop positions to stop the reels at. Each index in this array refers to a matching reel.
* @param currentReel The reel number currently being stopped. If not specified or null, 0 is assumed.
*/
function stopReelSpin(stopPositions, currentReel) {
    if ((currentReel == null) || (currentReel==undefined)) {
        currentReel=0;
    }
    if (currentReel >= SLOTSGAME.config.reels.length) {
		nextAutospin();
        return;
    }
    var canvasRef = SLOTSGAME.reelCanvas[currentReel];
    var positionIndex = stopPositions[currentReel];
    SLOTSGAME.reelSpinning[currentReel] = false;
    //add 2 to skip past repeating filler symbols at start of reel
    positionIndex += 2;
    if (positionIndex < 0) {
        positionIndex = SLOTSGAME.reelStopCoordinates[currentReel].length + positionIndex;
    }
    var positionOffset = SLOTSGAME.reelStopCoordinates[currentReel][positionIndex];
    SLOTSGAME.reelSpinning[currentReel] = false;
    SLOTSGAME.reelBlurContainer[currentReel].visible = false;
    SLOTSGAME.reelContainer[currentReel].y = positionOffset * -1;
    SLOTSGAME.reelContainer[currentReel].visible = true;
    var animateObj = SLOTSGAME.reelContainer[currentReel];
    var targetPosition = animateObj.y;
    //bounce stop animation
    if (SLOTSGAME.reelSpinSpeed > 0) {
        createjs.Tween.get(animateObj).to({y:(targetPosition+100)}, (SLOTSGAME.reelsPrimeTime/2), createjs.Ease.cubicOut).to({y:(targetPosition)}, (SLOTSGAME.reelsPrimeTime/2), createjs.Ease.quadIn);
    } else {
        createjs.Tween.get(animateObj).to({y:(targetPosition-100)}, (SLOTSGAME.reelsPrimeTime/2), createjs.Ease.cubicOut).to({y:(targetPosition)}, (SLOTSGAME.reelsPrimeTime/2), createjs.Ease.quadIn);
    }
    currentReel++;
    setTimeout(stopReelSpin, SLOTSGAME.reelStopStagger, stopPositions, currentReel);
}

/**
* Event handler invoked when a reel had been primed (is ready to start full-speed spin animation).
*
* @param event A Tween.js event object.
*/
function onReelPrimed(event) {
    var reelContainer = event.target;
    var reelNum = -1;
    for (var count = 0; count<SLOTSGAME.config.reels.length; count++) {
        if (SLOTSGAME.reelContainer[count] == reelContainer) {
            reelNum = count;
            break;
        }
    }
    if (reelNum > -1) {
        var canvasRef = SLOTSGAME.reelCanvas[reelNum];
        SLOTSGAME.reelContainer[count].visible = false;
        SLOTSGAME.reelBlurContainer[count].y = SLOTSGAME.reelContainer[count].y;
        SLOTSGAME.reelBlurContainer[count].visible = true;
        canvasRef.update();
        if (SLOTSGAME.reelSpinInterval == null) {
            SLOTSGAME.reelSpinInterval = setInterval (reelSpinLoop, 10, SLOTSGAME.reelBlurContainer, reelNum);
        }
    } else {
        //something went very wrong!
    }
}

/**
* Function called on an interval to animate a spcific reel.
*
* @param containers An array of reel strip containers to animate.
* @param reelNum The specific reel number within 'containers' to animate.
*/
function reelSpinLoop(containers, reelNum) {
    var reelsUpdated = 0;
    for (var count = 0; count < containers.length; count++) {
        if (SLOTSGAME.reelSpinning[count]) {
            animateReelSpin(containers[count], count, SLOTSGAME.currentReelSpeeds[count]);
            SLOTSGAME.currentReelSpeeds[count] += SLOTSGAME.reelSpinAcceleraton;
            if (SLOTSGAME.currentReelSpeeds[count] > SLOTSGAME.reelSpinSpeed) {
                SLOTSGAME.currentReelSpeeds[count] = SLOTSGAME.reelSpinSpeed;
            }
            reelsUpdated++;
        }
    }
    if (reelsUpdated == 0) {
        //all spins have completed
        SLOTSGAME.reelsSpinning = false;
        clearInterval(SLOTSGAME.reelSpinInterval);
        SLOTSGAME.reelSpinInterval = null;
        onReelsSpinStop();
    }
}

/**
* Function called when all reels have completed their spin animations (bounce-back animation may still be active).
*/
function onReelsSpinStop() {
    enableGameUI();
    $(".content #gameValidationButton").show();
    $(".content #gameValidationCopyButton").show();
    setTimeout(updateGameResults, (SLOTSGAME.reelsPrimeTime+100), SLOTSGAME.lastSpinResults);
}

/**
* Animates a single frame of a reel spin.
*
* @param reelContainer The reel container to animate.
* @param reelNum The reel number associated with 'reelContainer'.
* @param incrementAmount The amount to move the reel by. Positive values move the reel downward, negative values move the reel
* upward. When
*/
function animateReelSpin(reelContainer, reelNum, incrementAmount) {
    //var reelContainer = SLOTSGAME.reelContainer[reelNum];
    var canvasRef = SLOTSGAME.reelCanvas[reelNum];
    var canvasHeight = $("#"+SLOTSGAME.reelCanvasID[reelNum]).height() * 2;
    reelContainer.y += incrementAmount;
    //spinning downward
    if (reelContainer.y > 0) {
        reelContainer.y = (reelContainer.height * -1) + canvasHeight + incrementAmount;
    }
    //spinning upward
    if (reelContainer.y < ((reelContainer.height * -1) + canvasHeight)) {
        reelContainer.y = incrementAmount;
    }
}

function setAccountLink() {	
	var accountSet = true;
	var passwordSet = true;
	var emailSet = true;	
	try {
		var playerAccount = localStorage.playerAccount;
	} catch (err) {
		playerAccount = null;
	}
	if ((playerAccount == null) || (playerAccount == undefined) || (playerAccount == "") || (playerAccount == "null")) {
		accountSet = false;
	}
	try {
		var playerEmail = localStorage.playerEmail;
	} catch (err) {
		playerEmail = null;
	}
	if ((playerEmail == null) || (playerEmail == undefined) || (playerEmail == "") || (playerEmail == "null")) {
		emailSet = false;
	}
	try {
		var playerPassword = localStorage.playerPassword;
	} catch (err) {
		playerPassword = null;
	}
	if ((playerPassword == null) || (playerPassword == undefined) || (playerPassword == "") || (playerPassword == "null")) {
		passwordSet = false;
	}
	if (accountSet == false) {
		trace ("Account not set");		
	} else if ((accountSet == true) && (passwordSet == false) && (emailSet == false)) {
		trace ("Setting register link");		
	} else {
		trace ("Setting update link");		
		$(logInHeaderPath).hide();
		$(namePath).replaceWith('<span id="playerName">' + playerEmail + '</span>');
		$(accountHeaderDropdown).show();
	}
}

/**
* Processes all settings changes made to localStorage by child windows.
*/
function onSettingsChanged(event) {
	try {
		var currentCurrency = SLOTSGAME.displayCurrency;
		var updatePassword = SLOTSGAME.displayCurrency;
		var options = JSON.parse(localStorage.options);
		SLOTSGAME.displayCurrency = options.displayCurrency;		
		updateBalance(SLOTSGAME.currentBalance);
		updateBet(SLOTSGAME.currentBetIndex);
		var winAmount = $(".content #header #winAmount").text();
		if ((winAmount == "") || (winAmount == null)) {
			winaAmount = "0";
		}
		$(".content #header #winAmount").replaceWith("<div id=\"winAmount\">"+convertAmount(winAmount, currentCurrency, SLOTSGAME.displayCurrency)+"</div>");
		buildPaytable();
	} catch (err) {
		alert (err);
	}
}

// ************* STARTUP *************

/**
* Main game start/entry function.
*/
function start() {
    trace ("Slots Game Engine version "+SLOTSGAME.version);
    trace (" ");
    trace ("Registering dynamic canvases...");
    trace ("Parsing URL parameters...");
    if (window.location.search) {
        if (window.location.search.length > 0) {
            var paramsStr = window.location.search.substr(1);
            var nameValues = paramsStr.split("&");
            for (var count = 0 ; count < nameValues.length; count++) {
                try {
                    var currentNameValue = nameValues[count];
                    var paramObj = currentNameValue.split("=");
                    var paramName = decodeURIComponent(paramObj[0]);
                    if (paramObj[1] != undefined) {
                        var paramValue = decodeURIComponent(paramObj[1]);
                    } else {
                        paramValue = null;
                    }
                    SLOTSGAME.urlParameters[paramName] = paramValue;
                } catch (err) {
                    trace ("   couldn't parse paramater: "+err);
                }
            }
        }
    } else {
        trace ("   window.location.search does not exist -- couldn't parse any URL parameters!");
    }
    for (count=0; count < SLOTSGAME.reelCanvasID.length; count++) {
        var reelCanvas = new createjs.Stage(SLOTSGAME.reelCanvasID[count]);
        reelCanvas.name = SLOTSGAME.reelCanvasID[count];
        createjs.Ticker.framerate = 30;
        createjs.Ticker.addEventListener("tick", reelCanvas);
        SLOTSGAME.reelCanvas.push(reelCanvas);
    }
    loadGameConfig();
    $(".content #spinButton").button();
    $(".content #spinButton").click(onSpinClick);
	$("#autospinContainer #autospinButton").button();
    $("#autospinContainer #autospinButton").click(onAutospinClick);
	$("#autospinContainer #autospinSettingsButton").button();
    $("#autospinContainer #autospinSettingsButton").click(onAutospinSettingsClick);
	$(".content #autospinSettingsModal #settings #numSpins").on("input", onChangeNumAutospins);
	var numSpinsHTML = "<span id=\"spinsValue\">"+$(".content #autospinSettingsModal #settings #numSpins").val()+"</span>";
	$(".content #autospinSettingsModal #settings #spinsValue").replaceWith(numSpinsHTML);
	$(".content #autospinSettingsModal #settings #minumBalance").on("input", onChangeMinBalAutospins);
	SLOTSGAME.autospin.minBalance = $(".content #autospinSettingsModal #settings #minumBalance").val();
	SLOTSGAME.autospin.numSpins = Number($(".content #autospinSettingsModal #settings #numSpins").val());
	SLOTSGAME.autospin.currentSpin = 0;
	SLOTSGAME.autospin.active = false;
    $(".content #dialog").dialog({
        dialogClass: "no-close",
        autoOpen: false,
        open: function (event, ui) {
            $('.content #dialog').parent('.ui-dialog').css('z-index', 1001).nextAll('.ui-widget-overlay').css('z-index', 1000);
        },
        buttons: [
            {
                text: "OK",
                click: function() {
                    $( this ).dialog( "close" );
                }
            }
        ]
    });		
	if (localStorage.getItem("lastPasswordUpdate") == null) {
		var dateObj = new Date(1970,0,1,0,0,0); //default last-update (not since start of UNIX epoch / PC clock)
		localStorage.lastPasswordUpdate = dateObj.toISOString();
	}
    $(".content #gameValidationButton").button();
    $(".content #gameValidationButton").click(onValidateGameClick);
    $(".content #gameValidationCopyButton").button();
    $(".content #gameValidationCopyButton").click(onValidateDataCopyClick);
    $(".content #gameValidationButton").hide();
    $(".content #gameValidationCopyButton").hide();
    $(".content #gameUI #paytableButton").button();
    $(".content #gameUI #paytableButton").click(onPaytableOpenClick);
    $(".content #paytableModal .modal-dialog .modal-content .modal-body #closePaytableButton").button();
    $(".content #paytableModal .modal-dialog .modal-content .modal-body .modal-footer #closePaytableButton").click(onClosePaytableButtonClick);
    $(".content #paytableModal .modal-dialog .modal-content .modal-header #closePaytableButton").button();
    $(".content #paytableModal .modal-dialog .modal-content .modal-header #closePaytableButton").click(onClosePaytableButtonClick);
    $(".content #gameUI #depositButton").button();
    $(".content #gameUI #depositButton").click(onDepositClick);
    $(".content #gameUI #cashoutButton").button();
    $(".content #gameUI #cashoutButton").click(onCashoutClick);
    $(".content #gameUI #bet #decreaseBetButton").button();
    $(".content #gameUI #bet #decreaseBetButton").click(onDecreaseBetClick);
    $(".content #autoSelectResultsCheck").checkboxradio();
    $(".content #gameUI #bet #increaseBetButton").button();
    $(".content #gameUI #bet #increaseBetButton").click(onIncreaseBetClick);
    $(".content #gameUI #resultSelectors #selectCommitButton").button();
    $(".content #gameUI #resultSelectors #selectCommitButton").click(onCommitSelectionsClick);
    $(".content #gameUI #resultSelectors #reel1Result").menu();
    $(".content #gameUI #resultSelectors #reel2Result").menu();
    $(".content #gameUI #resultSelectors #reel3Result").menu();
    //clearStoredPlayerAccount(); //reset stored account data
    if (getStoredPlayerAccount()) {
        $(".content #gameUI #depositButton").hide();
        if ((SLOTSGAME.playerAccount != null) && (SLOTSGAME.playerAccount != "")) {
            callServerMethod("getAccountBalance", {}, onGetBalance);
            $(".content #depositAddress #prompt").replaceWith("<div id=\"prompt\">Deposit address:</div>");
			$(".content #depositAddress #value").replaceWith("<div id=\"value\">"+SLOTSGAME.playerAccount+"</div>");
			//var loginHTML='<li id="logInHeaderButton"> <a href="#" data-toggle="modal" data-target="#at-login"><span id="playerName"> <i class="fa fa-sign-in" aria-hidden="true"></i> Register</span>  </a></li>';
			//$("#logInHeaderButton").replaceWith(loginHTML);
        }
        if (SLOTSGAME.depositVerified == false) {
            checkDeposit();
        }
    } else {
        $(".content #gameUI #cashoutButton").hide();
    }	
	//$(loginDialogFooterPath).hide(); //hide register button
    //******************* ADDED STUFF FOR INIT ****************************
	if ((SLOTSGAME.playerAccount == null) || (SLOTSGAME.playerAccount == undefined) || (SLOTSGAME.playerAccount == "")) {
		$(".content #gameUI #checkDepositButton").replaceWith("<button type=\"button\" class=\"btn btn-success btn-lg hidden-xs\" id=\"checkDepositButton\">DEPOSIT</button>");
	} else {
		$(".content #gameUI #checkDepositButton").replaceWith("<button type=\"button\" class=\"btn btn-success btn-lg hidden-xs\" id=\"checkDepositButton\">CHECK FOR DEPOSIT</button>");
	}
    $(".content #gameUI #checkDepositButton").button();
    $(".content #gameUI #checkDepositButton").click(onCheckDepositClick);
    // These buttons are for the modals
    $(".content #cashoutModal .modal-dialog .modal-content .modal-footer #doCashOutButton").button();
    $(".content #cashoutModal .modal-dialog .modal-content .modal-footer #doCashOutButton").click(onDoCashOutClick);
    $(".content #cashoutModal .modal-dialog .modal-content .modal-footer #cancelCashOutButton").button();
    $(".content #cashoutModal .modal-dialog .modal-content .modal-footer #cancelCashOutButton").click(onCancelCashOutClick);
    $(".content #cashoutModal .modal-dialog .modal-content .modal-header #cancelCashOutButton").button();
    $(".content #cashoutModal .modal-dialog .modal-content .modal-header #cancelCashOutButton").click(onCancelCashOutClick);

    $(".content #cashoutResult .modal-dialog .modal-content .modal-header #cashoutResultDialogButtonCancel").button();
    $(".content #cashoutResult .modal-dialog .modal-content .modal-header #cashoutResultDialogButtonCancel").click(enableGameUI);

    $(".content #cashoutResult .modal-dialog .modal-content .modal-footer #cashoutResultDialogButtonCancel").button();
    $(".content #cashoutResult .modal-dialog .modal-content .modal-footer #cashoutResultDialogButtonCancel").click(enableGameUI);

    $(".content #cashoutResult .modal-dialog .modal-content .modal-footer #cashoutResultDialogButtonOkay").button();
    $(".content #cashoutResult .modal-dialog .modal-content .modal-footer #cashoutResultDialogButtonOkay").click(onConfirmCashoutClick);

    $(".content #menuModal #menuPayTable").button();
    $(".content #menuModal #menuPayTable").click(onPaytableOpenClick);
    
    
    $(".content #desktopProgressive #progressiveTitle #show").hide();


    $(logOutPath).button();
    $(logOutPath).click(onLogOut); //logOutFunction
    $(logInButtonPath).button();
    $(logInButtonPath).click(onLogIn);
	$(logInConfirmButtonPath).button();
    $(logInConfirmButtonPath).click(onLoginConfirmClick);
	$(logInCancelButtonPath).button();
    $(logInCancelButtonPath).click(onLoginCancelClick);
	$(resetPasswordButtonPath).button();
	$(resetPasswordButtonPath).click(onDoResetPasswordClick);
	$(registerButtonPath).button();
	$(registerButtonPath).click(onRegisterClick);
	$(doRegisterButtonPath).button();
	$(doRegisterButtonPath).click(onRegisterFullClick);
	$(registerAnonymousButtonPath).button();
	$(registerAnonymousButtonPath).click(onRegisterAnonymousClick);
	if ((SLOTSGAME.playerAccount != null) && (SLOTSGAME.playerAccount != "")) {
		$(registerAnonymousButtonPath).hide();
	}
	$(accountButtonPath).button();
	$(accountButtonPath).click(onAccountClick);	
	
    // Hides the "my account" dropdown on header
    $(accountHeaderDropdown).hide();
    $(".content #desktopProgressive #progressiveTitle #show").click(showProgressiveTable);
    $(".content #desktopProgressive #progressiveTitle #hide").click(hideProgressiveTable);    
    hideProgressiveTable();
	setAccountLink(); 
	clearLoginForm();
	clearRegistrationForm();
	restartAutoLogoutTimer();
	var authCode = getURLParameter("auth");
	if (authCode != null) {
		verify2FACode(authCode);
	}
	var resetCode = getURLParameter("passreset");
	if (resetCode != null) {
		resetPassword(resetCode);
	}
	$(window).bind("storage", onSettingsChanged);
	try {
		var options = JSON.parse(localStorage.options);
		SLOTSGAME.displayCurrency = options.displayCurrency;
	} catch (err) {
		SLOTSGAME.displayCurrency = "tokens";
	}
}
