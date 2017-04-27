var fs = require("fs");
var mongoose = require("mongoose");
var path = require("path");

var db = mongoose.connect(process.env.MONGODB_URI);
var State = require("./models/state");

module.exports = {
	getQuestion: function(qId, callback) {
		if(!qId) {
			callback({message: "No question ID specified!"});
			return;
		}

		var indexOfSlash = qId.indexOf('/');
        var subjid = qId.substring(0, indexOfSlash);
        var index = parseInt(qId.substr(indexOfSlash + 1));
        fs.readFile(path.join(__dirname, 'data', subjid + '.json'), function (err, data) {
			if(err){
				callback(err);
				return;
			}
			
			var paper = JSON.parse(data);
			var q = paper[index];

			callback(null, q);
		});
	},
	getRandomQuestion: function(subjid, callback) {
		if(!subjid) {
			callback({message: "No subject ID specified!"});
			return;
		}

		fs.readFile(path.join(__dirname, 'data', subjid + '.json'), function (err, data) {
			if(err){
				callback(err);
				return;
			}
			
			var paper = JSON.parse(data);
			//get a random number btwn 0 and (paper.length+1)
			var index = Math.floor(Math.random() * paper.length);
			var q = paper[index];

			callback(null, q);
		});
	},
	getUserQuestionId: function(userId, callback) {
		if(!userId) {
			callback({message: "No user ID specified!"});
			return;
		}

		/*fs.readFile(path.join(__dirname, 'users', userId + '.json'), function (err, data) {
			if(err){
				callback(err);
				return;
			}
			
			var user = JSON.parse(data);
			if (user.qid) {
				callback(null, user.qid);
			}
			else {
				callback({message: "Cannot find question ID for specified user!"});
			}
		});*/

		State.findOne({user_id: userId}, function (err, state) {
			if(err){
				callback(err);
				return;
			}
			
			if (state.qid) {
				callback(null, state.qid);
			}
			else {
				callback({message: "Cannot find question ID for specified user!"});
			}
		});
	},
	setUserQuestionId: function(userId, qId, callback) {
		if(!userId) {
			callback({message: "No user ID specified!"});
			return;
		}
		if(!qId) {
			callback({message: "No question ID specified!"});
			return;
		}

		/*fs.readFile(path.join(__dirname, 'users', userId + '.json'), function (err, data) {
			var user = {};

			if(err){
				user.qid = qId;
			}
			else {
				user = JSON.parse(data);
				user.qid = qId;
			}
			
			fs.writeFile(path.join(__dirname, 'users', userId + '.json'), JSON.stringify(user), function(err2, data2) {
				callback(err2, data2);
			});
		});*/
		State.findOneAndUpdate({user_id: userId}, {user_id: userId, qid: qId}, {upsert: true}, function (err, data) {
			callback(err, data);
		});
	}
};