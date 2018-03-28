/**
* Creates or updates required MySQL databases and tables for the slots server engine. 
*/
var db = require("./db.js");

var execPath = [createDatabase, createTables]; //function to invoke,in orderm by 'execNext' during the database setup process
var execIndex = 0; //the current invocation index within 'execPath'
var incompleteActions = execPath.length; //number of setup actions to complete (at least the number of items in execPath).
var setupAutoStart = true; //automatically start install of ./db_info.js? (this allows external sripts to override default behaviour)
var setupPostInstall = null; //function to invoke when install completes

require("./db_info.js"); //load global database info

function startConnection() {
	if (setupAutoStart) {
		//Start the connection!
		db.connect(onConnect, onConnectFail);
	}
}

setTimeout(startConnection, 1000);

/**
* Main function invoked when the dabase connector (db), successfully connects.
*
* @param connection The main connection object provided by the database connector.
*
*/
function onConnect(connection) {
	console.log("Connection established on thread: "+connection.threadId);	
	console.log ("Database setup is starting...");
	setTimeout(monitorCompletion, 500);
	execNext(connection);
}

/**
* Main function invoked when the dabase connector (db), fails to connect.
*
* @param connection The main connection object provided by the database connector that could not establish a connection.
*
*/
function onConnectFail(connection) {
	console.log("db_setup: Database connection failed! Is MySQL daemon running?");
}

/**
* Executes the next function inn the 'execPath' array and passes it the connection paramater.
*
* @param	connection	The database connection to pass to the next function.
*/
function execNext(connection) {
	execIndex++;
	if ((execPath[execIndex-1] != null) && (execPath[execIndex-1] != undefined)) {
		execPath[execIndex-1](connection);		
	} else {
		
	}
}

/**
* Timer function used to check for the completion of all actions raised in the script. When all actions have completed, the 
* database connection(s) being used is closed.
*/
function monitorCompletion() {
	if (allActionsComplete()) {
		console.log("All actions have completed.");
		db.closeAll();
		if (setupPostInstall != null) {
			setupPostInstall();
		}		
	} else {
		setTimeout(monitorCompletion, 500);
	}
}

/**
* Returns true if all database setup routines have reported completion, false otherwise.
*/
function allActionsComplete() {
	if (incompleteActions <= 0) {
		return (true);
	}
	return (false);
}

/**
* Attempts to create a database using the 'database_name` property to create a new database.
*
* @param connection	The database connection to be used to communicate with the database.
*/
function createDatabase(connection) {
	console.log ("db_setup.createDatabase("+connection+")");
	db.query("CREATE DATABASE `"+database_name+"`", function(error, result, fields) {
		if (error==null) {
			console.log ("   Database \""+database_name+"\" successfully created.");
		} else if (error.toString().indexOf("ER_DB_CREATE_EXISTS") > -1) {
			console.log ("   Database \""+database_name+"\" already exists. Skipping.");
		} else {
			console.log ("   Error creating \""+database_name+"\": "+error);
		}
		incompleteActions--;
		execNext(connection);
	});
}


/**
* Attempts to create database tables using the 'database_name' property and 'tables' schema definition.
*
* @param connection	The database connection to be used to communicate with the database.
*/
function createTables(connection) {
	console.log ("db_setup.createTables("+connection+")");
	for (var item in tables) {
		var tableName = item;
		var primaryKeyObj = getPrimaryKeyForCreate(tables[item], tableName);
		if (primaryKeyObj == null) {
			console.log ("   Table \""+tableName+"\" does not define a primary key. Can't create!");
			execNext(connection);
			return;
		}
		//first attempt to create table with primary key
		db.query("CREATE TABLE `"+database_name+"`.`"+tableName+"` "+primaryKeyObj.SQLInsert+"", function(error, result, fields) {
			if (error==null) {
				console.log ("   Table \""+tableName+"\" successfully created.");
			} else if (error.toString().indexOf("ER_TABLE_EXISTS_ERROR") > -1) {
				console.log ("   Table \""+tableName+"\" already exists. Skipping.");
			} else {
				console.log ("   Error creating \""+tableName+"\": "+error);
			}		
		});
		//next add additional columns
		for (var column in tables[item]) {
			incompleteActions++;
			createColumn(column, tables[item][column], connection, database_name, tableName);
		}
		incompleteActions--;
	}
	execNext(connection);
}

/**
* Creates an SQL statement inserting a primary key when creaing a table.
*
* @param	tableSchema An object containing the schema for the table to create.
* @param	tableName The name of the table for which the primary key is being retrieved.
*/
function getPrimaryKeyForCreate(tableSchema, tableName) {	
	for (var column in tableSchema) {
		var currentColumn = tableSchema[column];		
		if (columnIsPrimaryKey(currentColumn)) {
			var returnObj = new Object();
			returnObj.SQLInsert = "(`"+tableName+"`.`"+column+"` BIGINT NOT NULL AUTO_INCREMENT, PRIMARY KEY (`"+column+"`));";
			returnObj.column = column;
			returnObj.type = "BIGINT NOT NULL AUTO_INCREMENT";
			return (returnObj);
		}
	}	
	return (null);
}

/**
* Checks if a specified column schema defined a primary key.
*
* @param columnSchema	The schema object for the column.
*
* @return True if the columnSchema supplied is for a primary key, false otherwise.
*/
function columnIsPrimaryKey(columnSchema) {
	try {
		if (columnSchema.primary_key == true) {
			return (true);
		}
	} catch (err) {
	}
	return (false);
}

/**
* Attempts to create a oolumn from a schema on a specific table. If the schema is defined as
* a primary key (columnSchema.primary_key == true), it is rejected.
* 
* @param columnName		The name of the column to create.
* @param columnSchema	The column schema defining the column type. May be a string or an object with sub-properties such as "primary_key".
* @param connection		The connection on which the update will take place.
* @param databaseName	The database name on which the update will take place.
* @param tableName		The table name on which the update will take place.
*/
function createColumn(columnName, columnSchema, connection, databaseName, tableName) {
	console.log("db_setup.createColumn(\""+columnName+"\", "+JSON.stringify(columnSchema)+", ...");
	if (columnIsPrimaryKey(columnSchema) == false) {
		db.query("ALTER TABLE `"+databaseName+"`.`"+tableName+"` ADD `"+columnName+"` " + columnSchema.toString(), function(error, result, fields) {
			if (error==null) {
				console.log ("      Column \"" + columnName + "\" successfully created on table \"" + tableName + "\".");
			} else if (error.toString().indexOf("ER_DUP_FIELDNAME") > -1) {
				console.log ("      Column \"" + columnName + "\" already exists on table \"" + tableName + "\". Skipping.");
			} else {
				console.log ("      Error creating column \""+columnName+"\" on table \"" + tableName + " \": "+error);
			}
			incompleteActions--;
		});
	} else {
		incompleteActions--;
	}
}
