//single export function definition:
var timer_payDividends = function *(context)  {
	with (context) {
		var generator = yield;
		trace (" -------------------------- TRIGGERED DIVIDENDS PAYMENT FUNCTION --------------------------")
		var dateObj = new Date();
		var historyObj = new Object(); //any history to store
		var startDateObj=new Date();
		startDateObj.setHours(0); //set to midnight of current day
		startDateObj.setMinutes(0);
		startDateObj.setSeconds(0);
		startDateObj.setHours(-48); //start of period is 48 hours prior
		var affStartDateObj=new Date(); //affiliate contributions inclusion start period
		affStartDateObj.setHours(0);
		affStartDateObj.setMinutes(0);
		affStartDateObj.setSeconds(0);
		affStartDateObj.setHours(-24); //start of period is 24 hours prior to midnight of current day
		var affEndDateObj=new Date(); //affiliate contributions inclusion end period, midnight of current day
		affEndDateObj.setHours(0);
		affEndDateObj.setMinutes(0);
		affEndDateObj.setSeconds(0);
		var endDateObj=new Date();
		endDateObj.setHours(0); //set to midnight of current day
		endDateObj.setMinutes(0);
		endDateObj.setSeconds(0);
		endDateObj.setHours(-24); //end of period is 24 hours prior
		endDateObj.setSeconds(-1); //1 second before midnight
		var startDateObjAlt=new Date();
		startDateObjAlt.setHours(0);
		startDateObjAlt.setMinutes(0);
		startDateObjAlt.setSeconds(0);
		startDateObjAlt.setHours(-49); //get 2 days' worth of entries
		var endDateObjAlt=new Date(); //current time
		var startPeriod = getMySQLTimeStamp(startDateObj);
		var endPeriod = getMySQLTimeStamp(endDateObj);
		var startPeriodAlt = getMySQLTimeStamp(startDateObjAlt);
		var endPeriodAlt = getMySQLTimeStamp(endDateObjAlt);
		var startPeriodAff = getMySQLTimeStamp(affStartDateObj);
		var endPeriodAff = getMySQLTimeStamp(affEndDateObj);
		trace ("                        Current: "+getMySQLTimeStamp(dateObj));
		trace ("   Transactions inclusion start: "+startPeriod);
		trace ("     Transactions inclusion end: "+endPeriod);
		trace ("      Transactions recent start: "+startPeriodAlt);
		trace ("        Transactions recent end: "+endPeriodAlt);
		trace ("     Affiliates inclusion start: "+startPeriodAff);
		trace ("       Affiliates inclusion end: "+endPeriodAff);
		historyObj.searchParams = new Object();
		historyObj.searchParams.startPeriod = startPeriod;
		historyObj.searchParams.endPeriod = endPeriod;
		historyObj.searchParams.startPeriodAlt = startPeriodAlt;
		historyObj.searchParams.endPeriodAlt = endPeriodAlt;
		historyObj.searchParams.startPeriodAff = startPeriodAff;
		historyObj.searchParams.endPeriodAff = endPeriodAff;
		var querySQL = "SELECT * FROM `gaming`.`investment_txs` WHERE `last_update` BETWEEN \""+startPeriod+"\" AND \""+endPeriod+"\" ORDER BY  `last_update` DESC";
		var txQueryResult = yield db.query(querySQL, generator);
		var newestQuerySQL = "SELECT * FROM `gaming`.`investment_txs` WHERE `last_update` BETWEEN \""+startPeriodAlt+"\" AND \""+endPeriodAlt+"\" ORDER BY  `last_update` DESC";
		var affiliateQuerySQL = "SELECT * FROM `gaming`.`affiliates` WHERE `last_update` BETWEEN \""+startPeriodAff+"\" AND \""+endPeriodAff+"\" ORDER BY `last_update` ASC";
		var newestTxQueryResult = yield db.query(newestQuerySQL, generator);
		var investmentsQueryResult = yield db.query("SELECT * FROM `gaming`.`investments` WHERE `index` IN (SELECT MAX(`index`) FROM `gaming`.`investments` GROUP BY `id`)", generator);
		var affiliateQueryResult = yield db.query(affiliateQuerySQL, generator);
		if (txQueryResult.error != null) {
			trace ("SQL: "+querySQL);
			trace ("Error when processing query: "+JSON.stringify(txQueryResult.error));
			return;
		}
		if (investmentsQueryResult.error != null) {
			trace ("SQL: SELECT * FROM `gaming`.`investments` WHERE `index` IN (SELECT MAX(`index`) FROM `gaming`.`investments` GROUP BY `id`)");
			trace ("Error when processing query: "+JSON.stringify(investmentsQueryResult.error));
			return;
		}
		if (affiliateQueryResult.error != null) {
			trace ("SQL: "+affiliateQuerySQL);
			trace ("Error when processing query: "+JSON.stringify(affiliateQueryResult.error));
			return;
		}
		var affiliate_plugin = exports.pluginInfo._manager.getPlugin("Affiliate Plugin");
		/*
		if (affiliate_plugin != null) {
			var affiliateCreditsInfo = affiliate_plugin.aggregateAffiliateCredits(affiliateQueryResult);
		} else {
			affiliateCreditsInfo = null;
			trace("Affiliate Plugin, required to calculate credit deductions, not found!");
		}
		*/
		var gen = affiliate_plugin.applyAffiliateGamePlayCredits(generator); //apply game play credits
		gen.next();
		var affiliateCreditsInfo =	yield gen.next(gen);
		historyObj.investments = new Array();
		for (var invCount = 0; invCount < investmentsQueryResult.rows.length; invCount++) {
			var localHistoryObj = new Object();
			var snapshot_available = true;
			var uniqueValidResults = excludeDuplicate("account", txQueryResult.rows); //unique results within allowable deposit time window
			var uniqueCurrentResults = excludeDuplicate("account", newestTxQueryResult.rows); //unique newest results
			var validRakeAccountResult = null; //the valid or allowable investment_txs table row for the rake account, if any.
			var currentRakeAccountResult = null; //the most recent investment_txs table row for the rake account, if any.
			if ((investmentsQueryResult.rows[invCount]["btc_balance_snapshot"] == "NULL") || (investmentsQueryResult.rows[invCount]["btc_balance_snapshot"] == null) || (investmentsQueryResult.rows[invCount]["btc_balance_snapshot"] == "")) {
				investmentsQueryResult.rows[invCount].btc_balance_snapshot = "0";
				snapshot_available = false;
			}
			if ((investmentsQueryResult.rows[invCount]["btc_balance"] == "NULL") || (investmentsQueryResult.rows[invCount]["btc_balance"] == null) || (investmentsQueryResult.rows[invCount]["btc_balance"] == "")) {
				investmentsQueryResult.rows[invCount].btc_balance = "0";
			}
			if ((investmentsQueryResult.rows[invCount]["btc_gains"] == "NULL") || (investmentsQueryResult.rows[invCount]["btc_gains"] == null) || (investmentsQueryResult.rows[invCount]["btc_gains"] == "")) {
				investmentsQueryResult.rows[invCount].btc_gains = "0";
			}
			var bankroll_balance = new BigNumber(investmentsQueryResult.rows[invCount].btc_balance);
			if ((investmentsQueryResult.rows[invCount]["btc_total_balance"] == "NULL") || (investmentsQueryResult.rows[invCount]["btc_total_balance"] == null) || (investmentsQueryResult.rows[invCount]["btc_total_balance"] == "")) {
				investmentsQueryResult.rows[invCount].btc_total_balance = investmentsQueryResult.rows[invCount].btc_balance;
			} else {
				investmentsQueryResult.rows[invCount].btc_total_balance = investmentsQueryResult.rows[invCount].btc_total_balance;
			}
			var investment_btc_balance = new BigNumber(investmentsQueryResult.rows[invCount].btc_balance);
			var investment_btc_balance_snapshot = new BigNumber(investmentsQueryResult.rows[invCount].btc_balance_snapshot);
			//causes doubling of base investment value when snapshot is 0
			//var investment_btc_balance_delta = investment_btc_balance.minus(investment_btc_balance_snapshot);
			var investment_btc_balance_delta = new BigNumber(0);
			var investment_btc_total_balance = new BigNumber(investmentsQueryResult.rows[invCount].btc_total_balance);
			var investment_btc_effective_balance = new BigNumber(0);
			var investment_btc_gains = new BigNumber(investmentsQueryResult.rows[invCount].btc_gains);
			var investment_btc_gains_full = new BigNumber(investmentsQueryResult.rows[invCount].btc_gains);
			var rake_amount_btc = investment_btc_gains.times(exports.pluginInfo.rake.percent);
			if (affiliateCreditsInfo != null) {
				var affiliate_amount_btc = new BigNumber(affiliateCreditsInfo.total_btc);
			} else {
				affiliate_amount_btc = new BigNumber(0);
			}
			trace (" ");
			trace ("                         Rake amount (BTC): "+rake_amount_btc.toString(10));
			trace ("   Total affiliate game play credits (BTC): "+affiliate_amount_btc.toString(10));
			//calculate total effective balance for investment
			for (var count=0; count < uniqueCurrentResults.length; count++) {
				var currentResult = uniqueCurrentResults[count];  //latest investment for account in database
				var validResult = getLastInvestmentTx(currentResult.account, uniqueValidResults); //latest investment for account in database within deposit time window, may be the same as currentResult
				if (validResult != null) {
					if (isNaN(validResult["bankroll_multiplier"])) {
						validResult.bankroll_multiplier = 1;
					}
					var matchingInvestment = findInvestment(investmentsQueryResult.rows[invCount].id, validResult.investments);
					if (matchingInvestment != null) {
						if ((matchingInvestment["bankroll_multiplier"] == null) || (matchingInvestment["bankroll_multiplier"] == undefined) || (matchingInvestment["bankroll_multiplier"] == "") || (matchingInvestment["bankroll_multiplier"] == "")) {
							matchingInvestment.bankroll_multiplier = 1;
						}
						var user_investment_btc = new BigNumber(matchingInvestment.user_investment_btc);
						var bankroll_multiplier = new BigNumber(matchingInvestment.bankroll_multiplier);
						investment_btc_effective_balance = investment_btc_effective_balance.plus(user_investment_btc.times(bankroll_multiplier));
					}
				}
			}
			localHistoryObj.id = investmentsQueryResult.rows[invCount].id;
			localHistoryObj.name = investmentsQueryResult.rows[invCount].name;
			localHistoryObj.gross_dividend_btc = investment_btc_gains.toString(10);
			localHistoryObj.rake_amount_btc = rake_amount_btc.toString(10);
			localHistoryObj.balance_btc = investment_btc_total_balance.plus(investment_btc_gains).toString(10); //balance should be post-gains
			localHistoryObj.affiliate_amount_inv_btc = new BigNumber(0); //total dividend amount distributed to affiliates
			localHistoryObj.affiliate_amount_game_btc = affiliate_amount_btc.toString(10); //affiliate game credits (see above)
			localHistoryObj.net_dividend_btc = new BigNumber(investment_btc_gains.toString(10));
			localHistoryObj.net_dividend_btc = localHistoryObj.net_dividend_btc.minus(rake_amount_btc);
			var investment_btc_gains = investment_btc_gains.minus(rake_amount_btc).minus(affiliate_amount_btc);
			var total_gains_dist_btc = new BigNumber("0"); //amount of total, pre-raked gains distributed to users, affiliates, etc.
			total_gains_dist_btc = total_gains_dist_btc.plus(affiliate_amount_btc);
			//we should only ever have 24-hours' worth of transactions to sort through here:
			for (count=0; count < uniqueCurrentResults.length; count++) {
				var currentResult = uniqueCurrentResults[count];  //latest investment for account in database
				var validResult = getLastInvestmentTx(currentResult.account, uniqueValidResults); //latest investment for account in database within deposit time window, may be the same as currentResult
				if (validResult == null) {
					validResult = new Object();
					validResult.account = currentResult.account;
					global.assertAnyValue("NaN", "0", currentResult);
					global.assertAnyValue("Infinity", "0", currentResult);
					global.assertAnyValue("-Infinity", "0", currentResult);
					global.assertAnyValue("NaN", "0", validResult);
					global.assertAnyValue("Infinity", "0", validResult);
					global.assertAnyValue("-Infinity", "0", validResult);
					if (snapshot_available) {
						var defaultInvestment = {
							user_investment_btc:"0",
							user_investment_base_btc:"0",
							investment_id:investmentsQueryResult.rows[invCount].id,
							investment_balance_btc:investment_btc_total_balance.plus(investment_btc_gains_full).plus(investment_btc_balance_delta).toString(10),
							bankroll_multiplier:1
						};
					} else {
						defaultInvestment = {
							user_investment_btc:"0",
							user_investment_base_btc:"0",
							investment_id:investmentsQueryResult.rows[invCount].id,
							investment_balance_btc:investment_btc_total_balance.plus(investment_btc_gains_full).toString(10),
							bankroll_multiplier:1
						};
					}
					var defaultInvestment = {
						user_investment_btc:"0",
						user_investment_base_btc:"0",
						investment_id:investmentsQueryResult.rows[invCount].id,
						investment_balance_btc:investment_btc_total_balance.toString(10),
						bankroll_multiplier:1
					};
					validResult.investments = JSON.stringify([defaultInvestment]);
				}
				var currentInvestments = JSON.parse(currentResult.investments);
				var validInvestments = JSON.parse(validResult.investments);
				if (currentResult.account == exports.pluginInfo.rake.address) {
					validRakeAccountResult = validResult;
					currentRakeAccountResult = currentResult;
				}
				for (count2 = 0; count2 < currentInvestments.length; count2++) {
					var currentInvestment = currentInvestments[count2]; //the current investment information object stored for the user (part of the contents of `investment_txs`.`investments` field)
					if ((currentInvestment.investment_balance_btc == "NULL") || (currentInvestment.investment_balance_btc == null) || (currentInvestment.investment_balance_btc == "")) {
						currentInvestment.investment_balance_btc = "0";
					}
					if (isNaN(currentInvestment["bankroll_multiplier"])) {
						currentInvestment.bankroll_multiplier = 1;
					}
					var current_user_investment_btc = new BigNumber(currentInvestment.user_investment_btc);
					var current_user_bankroll_multiplier = new BigNumber(currentInvestment.bankroll_multiplier);
					var current_user_effective_investment_btc = current_user_investment_btc.times(current_user_bankroll_multiplier);
					var current_user_investment_btc = new BigNumber(currentInvestment.user_investment_btc);
					var current_user_investment_balance_btc = new BigNumber(currentInvestment.investment_balance_btc);
					//var current_user_ownership_percent = current_user_investment_btc.dividedBy(investment_btc_total_balance);
					if (investment_btc_effective_balance.equals(0)) {
						var current_user_ownership_percent = new BigNumber(0);
					} else {
						current_user_ownership_percent = current_user_effective_investment_btc.dividedBy(investment_btc_effective_balance);
					}
					var validInvestment = findInvestment(currentInvestment.investment_id, validInvestments); //find investment in allowable calculations window that matches most recent investment
					if (validInvestment != null) {
						var valid_user_investment_btc = new BigNumber(validInvestment.user_investment_btc);
						var valid_user_investment_balance_btc = new BigNumber(validInvestment.investment_balance_btc);
						var valid_user_ownership_percent = valid_user_investment_btc.dividedBy(investment_btc_total_balance);
						//perform calculations but exclude rake account
						if (validResult.account != exports.pluginInfo.rake.address) {
							var paramObject = new Object();
							paramObject.investment_btc_balance = investment_btc_balance;
							paramObject.investment_btc_balance_snapshot = investment_btc_balance_snapshot ;
							paramObject.investment_btc_balance_delta = investment_btc_balance_delta ;
							paramObject.investment_btc_total_balance = investment_btc_total_balance;
							paramObject.investment_btc_gains = investment_btc_gains;
							paramObject.snapshot_available = snapshot_available;
							paramObject.rake_amount_btc = rake_amount_btc;
							paramObject.affiliate_amount_btc = affiliate_amount_btc;
							paramObject.current_user_investment_btc = current_user_investment_btc;
							paramObject.current_user_investment_balance_btc = current_user_investment_balance_btc;
							paramObject.current_user_ownership_percent = current_user_ownership_percent;
							paramObject.valid_user_investment_btc = valid_user_investment_btc;
							paramObject.valid_user_investment_balance_btc = valid_user_investment_balance_btc;
							paramObject.valid_user_ownership_percent = valid_user_ownership_percent;
							paramObject.total_gains_dist_btc = total_gains_dist_btc;
							var filterResult = yield exports.pluginInfo._manager.RPC_dividend(currentResult, paramObject, generator);
							if (filterResult != null) {
								try {
									trace("   Last filter did not return null! Error #"+filterResult.code+": "+filterResult.message);
									global.logTx("   Last filter did not return null! Error #"+filterResult.code+": "+filterResult.message);
								} catch (err) {
									trace("   Last filter did not return a standard error: "+err.toString());
									global.logTx("   Last filter did not return a standard error: "+err.toString());
								} finally {
									//keep going?
									//return;
								}
							}
							investment_btc_balance = paramObject.investment_btc_balance;
							investment_btc_balance_snapshot = paramObject.investment_btc_balance_snapshot;
							investment_btc_balance_delta = paramObject.investment_btc_balance_delta;
							investment_btc_total_balance = paramObject.investment_btc_total_balance;
							investment_btc_gains = paramObject.investment_btc_gains;
							snapshot_available = paramObject.snapshot_available;
							rake_amount_btc = paramObject.rake_amount_btc;
							localHistoryObj.rake_amount_btc = rake_amount_btc.toString(10);
							affiliate_amount_btc = paramObject.affiliate_amount_btc;
							current_user_investment_btc = paramObject.current_user_investment_btc;
							current_user_investment_balance_btc = paramObject.current_user_investment_balance_btc;
							current_user_ownership_percent = paramObject.current_user_ownership_percent;
							valid_user_investment_btc = paramObject.valid_user_investment_btc;
							valid_user_investment_balance_btc = paramObject.valid_user_investment_balance_btc;
							valid_user_ownership_percent = paramObject.valid_user_ownership_percent;
							total_gains_dist_btc = paramObject.total_gains_dist_btc;
							var user_dividend = investment_btc_gains_full.times(valid_user_ownership_percent).minus(rake_amount_btc.times(valid_user_ownership_percent));
							trace ("   Account \""+currentResult.account+"\" effective ownership percentage: "+valid_user_ownership_percent);
							//---- apply affiliate credits -----
							var affiliate_credit_btc = user_dividend.times(exports.pluginInfo.affiliate.percent);
							var gen = affiliate_plugin.applyAffiliateInvestmentCredits(currentResult.account, affiliate_credit_btc, investmentsQueryResult.rows[invCount], generator);
							gen.next();
							affiliate_credit_btc = yield gen.next(gen); //function may update value
							localHistoryObj.net_dividend_btc = localHistoryObj.net_dividend_btc.minus(affiliate_credit_btc);
							localHistoryObj.affiliate_amount_inv_btc = localHistoryObj.affiliate_amount_inv_btc.plus(affiliate_credit_btc);
							user_dividend = user_dividend.minus(affiliate_credit_btc);
							//----------------------------------
							total_gains_dist_btc = total_gains_dist_btc.plus(user_dividend);
							current_user_investment_btc = current_user_investment_btc.plus(user_dividend);
							validInvestment.user_investment_btc = current_user_investment_btc.toString(10);
							if (snapshot_available) {
								validInvestment.investment_balance_btc = investment_btc_total_balance.plus(investment_btc_gains_full).plus(investment_btc_balance_delta).toString(10);
							} else {
								validInvestment.investment_balance_btc = investment_btc_total_balance.plus(investment_btc_gains_full).toString(10);
							}
							validInvestment.user_investment_base_btc = currentInvestment.user_investment_base_btc;
							//add new row to 'investment_txs' table
							var insertFields = "`account`,";
							insertFields += "`name`,";
							insertFields += "`investments`,";
							insertFields += "`last_update`";
							global.assertAnyValue("NaN", "0", validInvestments);
							var insertValues = "\""+currentResult.account+"\",";
							insertValues += "\""+investmentsQueryResult.rows[invCount].name+" distribution\",";
							insertValues += "'"+JSON.stringify(validInvestments)+"',";
							insertValues += "NOW()";
							var txInfo = new Object();
							txInfo.info = new Object();
							txInfo.type = "investment";
							txInfo.subType = "distribution";
							txInfo.info.btc = user_dividend.toString(10);
							txInfo.info.btc_total = current_user_investment_btc.toString(10);
							txInfo.info.ownership_percent = valid_user_ownership_percent.toString(10);
							validInvestment.user_investment_exclude_btc = "0"; //reset deposit/withdrawal exclusion value since it's just been used
							txInfo.info.id = validInvestment.investment_id;
							txInfo.investments = validInvestments;
							trace ("Inserting transaction for: "+currentResult.account);
							var insertSQL = "INSERT INTO `gaming`.`investment_txs` ("+insertFields+") VALUES ("+insertValues+")";
							var txInsertResult = yield db.query(insertSQL, generator);
							if (txInsertResult.error != null) {
								global.logTx("   Couldn't add entry to database!");
								trace ("Database error on timer_payDividends: "+txInsertResult.error);
								trace ("   SQL: "+insertSQL);
							}
							var accountQueryResult = yield db.query("SELECT * FROM `gaming`.`accounts` WHERE `btc_account`=\""+validResult.account+"\" ORDER BY `index` DESC LIMIT 1", generator);
							var updateObj = new Object();
							updateObj.last_login = "NOW()";
							var accountUpdateResult = yield global.updateAccount(accountQueryResult, updateObj, txInfo, generator);
							if (accountQueryResult.rows[0].auth_status == 2) {
								var accountPlugin = exports.pluginInfo._manager.getPlugin("Portable Account Plugin");
								var dateStr = new Date().toISOString();
								var message = "Your investment balances have been updated with new gains / losses.\n\n";
								for (var count3=0; count3 < validInvestments.length; count3++) {
									message += "   "+validInvestments[count3].investment_id+": BTC"+validInvestments[count3].user_investment_btc+" (yours) / BTC"+validInvestments[count3].investment_balance_btc+" (total)\n";
								}
								accountPlugin.sendEmail("myfruitgame@gmail.com", accountQueryResult.rows[0].email, "Investment Update (Distribution)", message);
							}
						}
					}
				}
			}
			if (snapshot_available) {
				investment_btc_total_balance = investment_btc_total_balance.plus(investment_btc_gains_full).plus(investment_btc_balance_delta); //update the cumulative total balance for the investment
			} else {
				investment_btc_total_balance = investment_btc_total_balance.plus(investment_btc_gains_full);
			}
			var unallocated_gains_btc = investment_btc_gains_full.minus(total_gains_dist_btc);
			trace ("                Full gains (BTC): "+investment_btc_gains_full.toString(10));
			if (currentRakeAccountResult == null) {
				investments = new Array();
				var investmentObj = new Object();
				investmentObj.investment_id = investmentsQueryResult.rows[invCount].id;
				//investmentObj.user_investment_btc = unallocated_gains_btc.toString(10);
				investmentObj.user_investment_btc = rake_amount_btc.toString(10);
				investmentObj.investment_balance_btc = investment_btc_total_balance.toString(10);
				investmentObj.user_investment_base_btc = "0";
				investments.push (investmentObj);
				total_gains_dist_btc = total_gains_dist_btc.plus(unallocated_gains_btc);
				unallocated_gains_btc = new BigNumber(0);
			} else {
				var investments = JSON.parse(currentRakeAccountResult.investments);
				for (var count = 0; count<investments.length; count++) {
					investmentObj = investments[count];
					var current_rake_balance_btc = new BigNumber(investmentObj.user_investment_btc);
				//	current_rake_balance_btc = current_rake_balance_btc.plus(unallocated_gains_btc);
					current_rake_balance_btc = current_rake_balance_btc.plus(rake_amount_btc);
					investmentObj.user_investment_btc = current_rake_balance_btc.toString(10);
					investmentObj.investment_balance_btc = investment_btc_total_balance.toString(10);
					investmentObj.user_investment_base_btc = "0";
					total_gains_dist_btc = total_gains_dist_btc.plus(unallocated_gains_btc);
					unallocated_gains_btc = total_gains_dist_btc.minus(unallocated_gains_btc);
				}
			}
			//add new row to 'investment_txs' table
			var insertFields = "`account`,";
			insertFields += "`name`,";
			insertFields += "`investments`,";
			insertFields += "`last_update`";
			global.assertAnyValue("NaN", "0", investments);
			var insertValues = "\""+exports.pluginInfo.rake.address+"\",";
			insertValues += "\""+investmentsQueryResult.rows[invCount].name+" distribution\",";
			insertValues += "'"+JSON.stringify(investments)+"',";
			insertValues += "NOW(6)";
			var insertSQL = "INSERT INTO `gaming`.`investment_txs` ("+insertFields+") VALUES ("+insertValues+")";
			var txInsertResult = yield db.query(insertSQL, generator);
			if (txInsertResult.error != null) {
				trace ("Database error on timer_payDividends: "+txInsertResult.error);
				trace ("   SQL: "+insertSQL);
			}
			//add row to `investments` table
			insertFields = "`id`,";
			insertFields += "`name`,";
			insertFields += "`btc_balance`,";
			insertFields += "`btc_balance_snapshot`,";
			insertFields += "`btc_total_balance`,";
			insertFields += "`btc_gains`,";
			insertFields += "`last_update`";
			insertValues = "\""+investmentsQueryResult.rows[invCount].id+"\",";
			insertValues += "\""+investmentsQueryResult.rows[invCount].name+"\",";
			if (investmentsQueryResult.rows[invCount].btc_balance == null) {
				insertValues += "NULL,";
			} else {
				insertValues += "\""+investmentsQueryResult.rows[invCount].btc_balance+"\",";
			}
			insertValues += "\""+investment_btc_balance.toString(10)+"\",";
			insertValues += "\""+investment_btc_total_balance.toString(10)+"\",";
			insertValues += "\"0\",";
			insertValues += "NOW(6)";
			insertSQL = "INSERT INTO `gaming`.`investments` ("+insertFields+") VALUES ("+insertValues+")";
			var investmentUpdateResult = yield db.query(insertSQL, generator);
			if (investmentUpdateResult.error != null) {
				trace ("Database error on timer_payDividends: "+investmentUpdateResult.error);
				trace ("   SQL: "+insertSQL);
			}
			localHistoryObj.net_dividend_btc = localHistoryObj.net_dividend_btc.toString(10);
			localHistoryObj.affiliate_amount_inv_btc = localHistoryObj.affiliate_amount_inv_btc.toString(10);
			historyObj.investments.push(localHistoryObj);
		}
		insertFields = "`history`,";
		insertFields += "`last_update`";
		insertValues = "'"+JSON.stringify(historyObj)+"',";
		insertValues += "NOW()";
		insertSQL = "INSERT INTO `gaming`.`investments_history` ("+insertFields+") VALUES ("+insertValues+")";
		var historyUpdateResult = yield db.query(insertSQL, generator);
		if (historyUpdateResult.error != null) {
			trace ("Database error on timer_payDividends: "+historyUpdateResult.error);
			trace ("   SQL: "+insertSQL);
		}
		trace ("   Total gains distributed (BTC): "+total_gains_dist_btc.toString(10));
		trace (" ------------------------------------------------------------------------------------------");
	}
}
//bind sole definition to module exports:
module.exports = timer_payDividends;
