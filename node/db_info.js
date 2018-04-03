//Common / global database information:

global.database_name = "gaming"; //main database name
global.tables = {"accounts":
					{"index":{"primary_key":true},
					//generated Bitcoin account
					 "btc_account":"VARCHAR(37)",
					 //depositing account (default payout address)
					 "btc_deposit_account":"VARCHAR(37)",
					 //verified/deposited account balance
					 "btc_balance_verified":"VARCHAR(255)",
					 //total (verified + unverified) on-chain Bitcoin balance recorded at last check
					 "btc_balance_total":"VARCHAR(255)",
					 //available/live account balance
					 "btc_balance_available":"VARCHAR(255)",
					 "btc_balance_total_previous":"VARCHAR(255) DEFAULT \"0\" COMMENT 'The total (confirmed + unconfirmed) Bitcoin balance for the associated address at last check'",
					 //additional transaction info
					 "tx_info":"JSON COMMENT 'Additional transaction information associated with the row.'",
					 //has initial unconfirmed deposit already been made?
					 "deposit_complete":"BOOLEAN",
					 //additional data to include with the account, if any
					 "extra_data":"TEXT",
					 //index of last game played (should match a `games`.`index` entry)
					 "last_game_index":"BIGINT",
					 //last login date+time 
					 "last_login":"TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
					  //last deposit check date+time 
					 "last_deposit_check":"TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
					 //the affiliate identifier used to create this account; should match a gaming.affiliates.affiliate_id entry
					 "affiliate":"VARCHAR(255)"
					 },
				 "games":
					{"index":{"primary_key":true},
					//player account (should match an accounts.btc_account entry) 
					 "account":"VARCHAR(42)",
					 //id of the game being played
					 "game_id":"VARCHAR(20)",
					 //generated results
					 "results":"MEDIUMTEXT",
					 //encryption / decryption keys
					 "keys":"MEDIUMTEXT",
					 //encoded bet object
					 "bet":"TEXT",
					 //player selections
					 "selections":"MEDIUMTEXT",
					 //final game result
					 "wins":"JSON COMMENT 'The final results of the game(s) in tokens, Bitcoins, etc.'",
					 //has game fully completed?
					 "complete":"BOOLEAN",
					 //last login date+time 
					 "date_time":"TIMESTAMP DEFAULT CURRENT_TIMESTAMP"},
				"affiliates":
					{"index":{"primary_key":true},
					//affiliate identifier
					 "affiliate_id":"VARCHAR(255)",
					//an email address for the affiliate (should probably be verified)
					 "email":"VARCHAR(255)",
					//the last time that the affiliate last logged in
					 "last_login":"TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
					//the date and time that this affiliate has had some play activity associated with it
					 "last_play":"TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
					//the total gross amount of bets, in tokens, attributed to this affiliate
					 "bets_attributed":"VARCHAR(255)",
					//the total gross amount of Bitcoin bets attributed to this affiliate
					 "btc_bets_attributed":"VARCHAR(255)",
					//date and time joined
					 "joined":"TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
					 //additional information to include with the affiliate account
					 "extra_data":"TEXT"},
				"jackpots":
					{"index":{"primary_key":true},
					"jackpot_id":"VARCHAR(255) COMMENT 'The unique jackpot identifier'",
					//the amount to multiply an appropriate bet by and add to the totals; this may be a JavaScript snippet in the future
					"bet_multiplier":"MEDIUMTEXT",
					//the minimum bet required to trigger the jackpot
					"minimum_bet":"VARCHAR(255)",
					"btc_base":"VARCHAR(255) COMMENT 'Base or starting amount of Bitcoin for the jackpot; btc_total is reset to this value when the associated jackpot is won'",
					//total amount of Bitcoin currently in the jackpot
					"btc_total":"VARCHAR(255)",
					//the last time that the jackpot information changed
					"last_update":"TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
					//address of last jackpot winner (should accomodate Ethereum addresses too)
					"last_winner":"VARCHAR(42)",
					//additional information to include with this jackpot
					"extra_data":"TEXT"
					}				
				}; //table schema