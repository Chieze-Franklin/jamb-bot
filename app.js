var express = require("express");
var request = require("request");
var bodyParser = require("body-parser");

var utils = require("./utils");

var app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.listen((process.env.PORT || 5000));

// Server index page
app.get("/", function (req, res) {
    res.send("JAMB Bot up and running!");
});

// Facebook Webhook
// Used for verification
app.get("/webhook", function (req, res) {
    if (req.query["hub.verify_token"] === process.env.VERIFICATION_TOKEN) {
        console.log("Verified webhook");
        res.status(200).send(req.query["hub.challenge"]);
    } else {
        console.error("Verification failed. The tokens do not match.");
        res.sendStatus(403);
    }
});

// All callbacks for Messenger will be POST-ed here
app.post("/webhook", function (req, res) {
    // Make sure this is a page subscription
    if (req.body.object == "page") {
        // Iterate over each entry
        // There may be multiple entries if batched
        req.body.entry.forEach(function(entry) {
            // Iterate over each messaging event
            entry.messaging.forEach(function(event) {
                if (event.postback) {
                    processPostback(event);
                } else if (event.message) {
                    processMessage(event);
                }
            });
        });

        res.sendStatus(200);
    }
});

function processPostback(event) {
    var senderId = event.sender.id;
    var payload = event.postback.payload;

    if (payload === "Greeting") {
        // Get user's first name from the User Profile API
        // and include it in the greeting
        request({
            url: "https://graph.facebook.com/v2.6/" + senderId,
            qs: {
                access_token: process.env.PAGE_ACCESS_TOKEN,
                fields: "first_name"
            },
            method: "GET"
        }, function(error, response, body) {
            var greeting = "";
            if (error) {
                console.log("Error getting user's name: " +  error);
            } else {
                var bodyObj = JSON.parse(body);
                greeting = "Hi " + bodyObj.first_name + ". ";
            }
            var message = greeting + "I am your JAMB buddy. I am here to help you prepare for JAMB.";
            sendMessage(senderId, {text: message});

            sendMessage(senderId, {text: "What subject would you like to practice?"});
        });
    }
    else if (payload.indexOf("SUBJECT/") == 0) {
        var indexOf_ = payload.indexOf('/');
        var subjId = payload.substr(indexOf_ + 1);

        function afterGettingRandomQuestion(error, question) {
            if (question) {
                var message = createMessageForQuestion(question);
                sendMessage(senderId, message);
            }
            else {
                sendMessage(senderId, {text: "Oops! For some reason I can't find a random question for you at the moment. Sorry about that."});
            }
        }

        utils.getRandomQuestion(subjId, afterGettingRandomQuestion);
    }
    else if (payload.indexOf("SUBJECT_WRONG") == 0) {
        sendMessage(senderId, {text: "Ok. Sorry about that. What subject would you like to practice?"});
    } else if (payload === "Explain") { //user wants you to explain how the answer was gotten
        utils.getCurrentQuestion(senderId, function(error, question){
            if(question && question.solution) {
                sendMessage(senderId, {text: question.solution});
            } else {
                sendMessage(senderId, {text: "Oops! I can't seem to remember how this question was solved. Sorry about that."});
            }
        });
    } else if (payload === "Next") { //user wants next question
        sendMessage(senderId, {text: "Oops! Sorry about that. Try using the exact title of the movie"});
    } else if (payload === "Stop") { //user wants to stop now
        // Get user's first name from the User Profile API
        // and include it in the goodbye
        request({
            url: "https://graph.facebook.com/v2.6/" + senderId,
            qs: {
                access_token: process.env.PAGE_ACCESS_TOKEN,
                fields: "first_name"
            },
            method: "GET"
        }, function(error, response, body) {
            var bye = "";
            if (error) {
                console.log("Error getting user's name: " +  error);
            } else {
                var bodyObj = JSON.parse(body);
                bye = "Bye " + bodyObj.first_name + ". ";
            }
            var message = bye + "It was really nice practicing with you. Hope we chat again soon.";//TODO: put a button to link to examhub.com when it is ready
            sendMessage(senderId, {text: message});
        });
    } else if (payload === "Report") { //user feels answer is wrongs
        sendMessage(senderId, {text: "Thanks for your feedback. This question will be crosschecked."});
    } else if (payload === "Change") { //user wants another subject
        sendMessage(senderId, {text: "What subject would you like to practice?"});
    }
}

function processMessage(event) {
    if (!event.message.is_echo) {
        var message = event.message;
        var senderId = event.sender.id;

        console.log("Received message from senderId: " + senderId);
        console.log("Message is: " + JSON.stringify(message));

        // You may get a text or attachment but not both
        if (message.text) {
            var formattedMsg = message.text.toLowerCase().trim();

            if (formattedMsg.indexOf("start") > -1 || formattedMsg.indexOf("begin") > -1 ||
                formattedMsg.indexOf("subject") > -1 || formattedMsg.indexOf("course") > -1 || formattedMsg.indexOf("program") > -1) {
                //assume the user wants to change subjects
                sendMessage(senderId, {text: "What subject would you like to practice?"});
            }
            else {
                message = createMessageForConfirmSubject(formattedMsg);
                sendMessage(senderId, message);
            }

            /* If we receive a text message, check to see if it matches any option
            // Otherwise consider it to be a subject.
            switch (formattedMsg) {
                case "A":
                case "B":
                case "C":
                case "D":
                case "E":
                    //evaluate the supplied option, return an answer with post back buttons
                    //button for explain shud show only if there is a solution for the question
                    message = {
                        attachment: {
                            type: "template",
                            payload: {
                                template_type: "button",
                                text: "<<respond to the user's option here>>",
                                buttons: [
                                {
                                    type: "postback",
                                    title: "Next question",
                                    payload: "Next"
                                }, 
                                {
                                    type: "postback",
                                    title: "Explain the answer",
                                    payload: "Explain"
                                }, 
                                {
                                    type: "postback",
                                    title: "Let's stop here for now",
                                    payload: "Stop"
                                }, 
                                {
                                    type: "postback",
                                    title: "Let's try another subject",
                                    payload: "Change"
                                }, 
                                {
                                    type: "postback",
                                    title: "I don't agree with this answer",
                                    payload: "Report"
                                }]
                            }
                        }
                    };
                    sendMessage(senderId, message);
                    break;

                default:
                    //search for a new subject
                    message = createMessageForSubjects();
                    sendMessage(senderId, {text: "What subject would you like to practice?"});
            }*/
        } else if (message.attachments) {
            // Get user's first name from the User Profile API
            // and include it in the warning
            request({
                url: "https://graph.facebook.com/v2.6/" + senderId,
                qs: {
                    access_token: process.env.PAGE_ACCESS_TOKEN,
                    fields: "first_name"
                },
                method: "GET"
            }, function(error, response, body) {
                var name = "Come on. ";
                if (error) {
                    console.log("Error getting user's name: " +  error);
                } else {
                    var bodyObj = JSON.parse(body);
                    name = "Come on " + bodyObj.first_name + ". ";
                }
                var message = name + "Don't send any files to me. Let's focus.";
                sendMessage(senderId, {text: message});
            });
        }
    }
}

function createMessageForConfirmSubject(subject) {
    var subjName = "any subject", subjCode = "*";
    if (subject.indexOf("eng") > -1) {
        subjName = "English";
        subjCode = "eng";
    }
    var message = {
        attachment: {
            type: "template",
            payload: {
                template_type: "button",
                text: "Ok. Shall we begin practicing " + subjName + "?",
                buttons: [
                {
                    type: "postback",
                    title: "Yes",
                    payload: "SUBJECT/" + subjCode
                },
                {
                    type: "postback",
                    title: "No",
                    payload: "SUBJECT_WRONG"
                }]
            }
        }
    };

    return message;
}

function createMessageForOption(question, remark) {
    var buttons = [];
    buttons.push({type: "postback", title: "Next question", payload: "ACTION_NEXT"});
    if (question.solution) {
        buttons.push({type: "postback", title: "Explain the answer", payload: "ACTION_EXPLAIN"});
    }
    buttons.push({type: "postback", title: "Let's stop here for now", payload: "ACTION_STOP"});
    buttons.push({type: "postback", title: "Let's try another subject", payload: "ACTION_SUBJECT"});
    buttons.push({type: "postback", title: "I don't agree with this answer", payload: "ACTION_REPORT"});
    var message = {
        attachment: {
            type: "template",
            payload: {
                template_type: "button",
                text: remark,
                buttons: buttons
            }
        }
    };

    return message;
}

function createMessageForQuestion(question) {
    var text = question.text;
    var buttons = [];
    if (question.options) {
        if (question.options.A) {
            text + "\nA: " + question.options.A;
            buttons.push({type: "postback", title: "A", payload: "OPTION_A/" + question.id});
        }
        if (question.options.B) {
            text + "\nB: " + question.options.B;
            buttons.push({type: "postback", title: "B", payload: "OPTION_B/" + question.id});
        }
        if (question.options.C) {
            text + "\nC: " + question.options.C;
            buttons.push({type: "postback", title: "C", payload: "OPTION_C/" + question.id});
        }
        if (question.options.D) {
            text + "\nD: " + question.options.D;
            buttons.push({type: "postback", title: "D", payload: "OPTION_D/" + question.id});
        }
        if (question.options.E) {
            text + "\nE: " + question.options.E;
            buttons.push({type: "postback", title: "E", payload: "OPTION_E/" + question.id});
        }
    }
    var message = {
        attachment: {
            type: "template",
            payload: {
                template_type: "button",
                text: question.text,
                buttons: buttons
            }
        }
    };

    return message;
}

function createMessageForSubjects() {
    var message = {
        attachment: {
            type: "template",
            payload: {
                template_type: "button",
                text: "What subject would you like to practice?",
                buttons: [
                {
                    type: "postback",
                    title: "Freestyle",
                    payload: "SUBJECT/*"
                }]
            }
        }
    };

    return message;
}

// sends message to user
function sendMessage(recipientId, message) {
    request({
        url: "https://graph.facebook.com/v2.6/me/messages",
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: "POST",
        json: {
            recipient: {id: recipientId},
            message: message,
        }
    }, function(error, response, body) {
        if (error) {
            console.log("Error sending message: " + response.error);
        }
    });
}
