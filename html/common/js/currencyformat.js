/**
* Converts an amount from a source currency to a target currency.
*
* @param amount The amount to format. May be a BigNumber object, number, or a string.
* @param fromCurrency The currency that the 'amount' parameter is currently in (to be converted from). Valid values include: "btc", "satoshis", and "tokens".
* @param toCurrency The currency to convert the 'amount' to. Valid values include: "btc", "satoshis", and "tokens".
*
* @return A BigNumber object containing the 'amount' in the 'toCurrency' value, or null if the conversion could not be completed (e.g. one of the parameters was invalid).
*/
function convertAmount (amount, fromCurrency, toCurrency) {
	if ((amount == undefined) || (amount == null)) {
		return (null);
	}
	try {
		if ((typeof(amount["lessThanOrEqualTo"]) == "function") && (typeof(amount["plus"]) == "function") && (typeof(amount["minus"]) == "function") && (typeof(amount["times"]) == "function")) {
			//already a BigNumber, nothing to do
		} else {
			amount = new BigNumber(String(amount));
		}
		var btc_per_satoshi = new BigNumber("0.00000001");
		var tokens_per_btc = new BigNumber("10000"); //we'll need to get this from an API call!
		switch (toCurrency) {
			case "btc": switch (fromCurrency) {
							case "btc": 
								return (amount);
								break;
							case "satoshis": 
								return (amount.times(btc_per_satoshi));
								break;
							case "tokens": 
								return (amount.dividedBy(tokens_per_btc));
								break;
							default:
								console.log ("convertAmount: unrecognized fromCurrency \""+toCurrency+"\"");
								break;
						};
						break;
			case "satoshis":
					switch (fromCurrency) {
							case "btc": 
								return (amount.dividedBy(btc_per_satoshi));
								break;
							case "satoshis": 
								return (amount);
								break;
							case "tokens": 
								return (amount.times(tokens_per_btc));
								break;
							default:
								console.log ("convertAmount: unrecognized fromCurrency \""+toCurrency+"\"");
								break;
						};
						break;
			case "tokens": 
						switch (fromCurrency) {
							case "btc": 
								return (amount.times(tokens_per_btc));
								break;
							case "satoshis": 
								return (amount.times(btc_per_satoshi).times(tokens_per_btc));
								break;
							case "tokens": 
								return (amount);
								break;
							default:
								console.log ("convertAmount: unrecognized fromCurrency \""+toCurrency+"\"");
								break;
						};
						break;
			default: 
				console.log ("convertAmount: unrecognized toCurrency \""+toCurrency+"\"");
				return (null);	
				break;
		}
	} catch (err) {
		console.log ("convertAmount: "+err);
		return (null);
	}
}