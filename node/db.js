/**
* Standardized MySQL connectivity functions used throughout the game server.
*/
var mysql      = require('mysql');
var connection = mysql.createPool({
  host     : '127.0.0.1',
  user     : 'root',
  password : 'slotmachine'
});


/**
* Attempts to create a new pooled connection to the database using default settings.
*
* @param onConnect The callback function to invoke when the connection is successfully established.
* @param onFail The callback function to invoke when a connection can't be established.
*/
exports.connect = (onConnect, onFail) => {
	onConnect({}); //bypass in order to use atomic connectivity
	/*
	connection.getConnection(function(err, connectionInstance) {
	  if (err) {
		console.log(err);
		onFail(connectionInstance);
		return;
	  }
	  onConnect(connectionInstance);
	});
	*/
}

/**
* Returns an indexed list of all databases available on the default connection.
* 
* @param callback The asynchronous callback function to be invoked when the list of databases is retrieved. The database list, an indexed array,
* will be included as the callback's parameter; null will be included if there was an error retrieving the database list.
*/
exports.getDatabases = (callback) => {
	connection.getConnection(function(err, connectionInstance) {
		try {
			if (err) {
				console.error(err);
			} else {
				connectionInstance.query("SELECT SCHEMA_NAME AS `Database` FROM INFORMATION_SCHEMA.SCHEMATA", function (err, results, fields) {
					if (err == null) {
						var dbVar = fields[0].name;
						var returnNames = new Array();
						for (var item in results) {
							var currentItem=results[item];
							returnNames.push(currentItem[dbVar]);
						}
						callback(returnNames);
					} else {
					}
				});
			}
		} catch (err) {
		} finally {
			try {
				connectionInstance.release();
			} catch (err) {
			}
		}
	});
}

/**
* Returns an indexed list of all tables in a specific database.
* 
* @param dbName The name of the database for which to retrieve a list of available tables.
* @param generator The asynchronous callback or generator function to be invoked when the list of tables is retrieved. The table list, an indexed array,
* will be included as the callback's parameter; null will be included if there was an error retrieving the table list.
*/
exports.getTables = (dbName, generator) => {
	connection.getConnection(function(err, connectionInstance) {
		try {
			if (err) {
				console.error(err);
			} else {
				connectionInstance.query("SELECT table_name FROM information_schema.tables where table_schema='"+dbName+"'", function(err, results, fields){
					if (err == null) {
						var tableVar = fields[0].name;			
						var returnNames = new Array();
						for (var item in results) {
							var currentItem=results[item];
							returnNames.push(currentItem[tableVar]);
						}
						if (typeof(generator.next) == "function") {
							generator.next(returnNames);
						} else if (typeof(generator) == "function") {
							generator(returnNames);
						} else {
							console.error ("Could't invoke handler for result: " +JSON.stringify(returnNames));
						}
					}
				});
			}
		} catch (err) {
		} finally {
			try {
				connectionInstance.release();
			} catch (err) {
			}
		}
	});
}

/**
* Processes a supplied database query and returns the results to a generator.
* 
* @param dbName The name of the database for which to retrieve a list of available tables.
* @param generator The generator function to return query results to. If the referenced function is not a generator an attempt is made
* 			to invoke it in a standard way.
*/
exports.query = (queryStr, generator) => {
	connection.getConnection(function(err, connectionInstance) {
		try {
			if (err) {
				console.error(err);
			} else {
				connectionInstance.query(queryStr, function (error, rows, columns) {		
					var queryResultsObject = new Object();
					queryResultsObject.error = error;
					queryResultsObject.rows = rows;
					queryResultsObject.columns = columns;
					if (typeof(generator.next) == "function") {
						generator.next(queryResultsObject);
					} else if (typeof(generator) == "function") {
						generator(queryResultsObject);
					} else {
						console.error ("Could't invoke handler for result: " +JSON.stringify(queryResultsObject));
					}
				});
			}
		} catch (err) {
		} finally {
			try {
				connectionInstance.release();
			} catch (err) {
			}
		}
	});
	/*
	connection.query(queryStr, function (error, rows, columns) {		
		var queryResultsObject = new Object();
		queryResultsObject.error = error;
		queryResultsObject.rows = rows;
		queryResultsObject.columns = columns;
		if (typeof(generator.next) == "function") {
			generator.next(queryResultsObject);
		} else if (typeof(generator) == "function") {
			generator(queryResultsObject);
		} else {
			console.error ("Could't invoke handler for result: " +JSON.stringify(queryResultsObject));
		}
	});
	*/
}

/**
* Closes all pooled connections to the databse (use with caution).
*/
exports.closeAll = () => {
	/*
	connection.release(function(){
		console.log ("db.js: All pooled connections closed.");
	});
	*/
}