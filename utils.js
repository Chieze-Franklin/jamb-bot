var fs = require("fs");
var path = require("path");

module.exports = {
	getCurrentQuestion: function(userid, callback) {
		//
	},
	getRandomQuestion: function(subjid, callback) {
		fs.readFile(path.join(__dirname, 'data', subjid + '.json'), function (err, data) {
			if(err){
				callback(err);
			}
			
			var paper = JSON.parse(data);
			//get a random number btwn 0 and (paper.length+1)
			var index = Math.floor(Math.random() * paper.length);
			var q = paper[index];

			callback(null, q);
		});
	},
	setCurrentSubject: function(userid, subjectid, callback) {
		//
	}
};