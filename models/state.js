var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var StateSchema = new Schema({
    user_id: {type: String},
    qid: {type: String},
    sid: {type: String}
});

module.exports = mongoose.model("State", StateSchema);
