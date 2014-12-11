var util = require('util');
var format = require('util').format;
var url = require('url');
var crypto = require('crypto');
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var dbUrl = format("mongodb://%s:%s@%s:%s/%s", 'user', 'password', 'url', 27017, 'dbname');

const playersCollection = 'players';
const gamesCollection = 'games';

var playersMongoCollection = null;
var gamesMongoCollection = null;

MongoClient.connect(dbUrl, {server : {auto_reconnect : true}}, 
	function(err, db) {
		if (!err) {
			if (db !== null) {
				playersMongoCollection = db.collection(playersCollection);
			} else
				console.log(dbUrl + ' not found.');
		} else
			console.log(dbUrl + ' connect fail ' + err);
	});

MongoClient.connect(dbUrl, {server : {auto_reconnect : true}}, 
	function(err, db) {
		if (!err) {
			if (db !== null) {
				gamesMongoCollection = db.collection(gamesCollection);
			} else
				console.log(dbUrl + ' not found.');
		} else
			console.log(dbUrl + ' connect fail ' + err);
	});

function getCollection(collectionName) {
	if (collectionName == playersCollection) {
		if (playersMongoCollection !== null) 
			return playersMongoCollection;
	} else
	if (collectionName == gamesCollection) {		
		if (gamesMongoCollection !== null) 
			return gamesMongoCollection;
	}
		
	return null;
}

function dbUpdate(collectionName, query, doc, callback) {

	function updateCallback(err) {
		if (!err) {
			console.log(collectionName + ' update success');
		} else {
			console.log(collectionName + ' update fail ' + err);
		}
	}
	
	var collection = getCollection(collectionName);
	if (collection !== null) {
		if (callback)
			collection.update(query, doc, {upsert : true}, callback);
		else
			collection.update(query, doc, {upsert : true}, updateCallback);
	} else
		console.log(collectionName + ' not found');
}

exports.dbUpdate = function (collectionName, query, doc, callback) {
	dbUpdate(collectionName, query, doc, callback);
}

function dbFind(collectionName, query, fields, sortParam, min, page, callback) {
	var collection = getCollection(collectionName);
	if (collection !== null) {
		var myCursor = null;
		
		if(page > 0){
			if (min > 0)
				myCursor = collection.find(query, fields).skip(min * (page -1)).sort(sortParam).limit(min);
			else
				myCursor = collection.find(query, fields).sort(sortParam);
		}
		else{
			if (min > 0)
				myCursor = collection.find(query, fields).sort(sortParam).limit(min);
			else
				myCursor = collection.find(query, fields).sort(sortParam);	
		}

		if (myCursor != null) {
			myCursor.toArray(function(err, docs) {
				callback(err, docs);
			});
		} else
			console.log(collectionName + ' myCursor not found.');
	} else
		console.log(collectionName + ' not found.');
}

exports.dbFind = function (collectionName, query, fields, sortParam, min, page, callback) {
	dbFind(collectionName, query, fields, sortParam, min, page, callback);
}

function dbFindOne(collectionName, query, fields, callBack) {
	var collection = getCollection(collectionName);
	if (collection !== null) {
		collection.findOne(query, fields, callBack);
	} else
		console.log(collectionName + ' not found');
};

exports.DBFindOne = function (collectionName, query, fields, callBack) {
	dbFindOne(collectionName, query, fields, callBack);
}

function dbFindCount(collectionName, callback) {
	var collection = getCollection(collectionName);
	if (collection !== null) {
		collection.find().count(function(err, count){
			callback(err, count);
		});
	} else
		console.log(collectionName + ' not found.');
}

exports.dbFindCount = function (collectionName, callback) {
	dbFindCount(collectionName, callback);
}

function dbRemove(collectionName, query, removeCallback) {
	var collection = getCollection(collectionName);
	if (collection !== null) {
		collection.remove(query, true, removeCallback);
	} else
		console.log(collectionName + ' not found');
};

exports.dbRemove = function (collectionName, query, removeCallback) {
	dbRemove(collectionName, query, removeCallback);
}
