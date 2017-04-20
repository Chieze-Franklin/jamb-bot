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
    else if (payload.indexOf("OPTION_") == 0) {
        //the format of payload is OPTION_A/eng/0
        var indexOfSlash = payload.indexOf('/');
        var qId = payload.substr(indexOfSlash + 1);

        function afterGettingQuestion(error, question) {
            if (question) {
                var indexOf_ = payload.indexOf('_');
                var option = payload.substring(indexOf_ + 1, indexOfSlash);
                if (question.answer.toLowerCase() == option.toLowerCase()) { //correct answer
                    var message = createMessageForAnswer(question, "Yayy, nice job!");
                    sendMessage(senderId, message);
                } else {
                    var message = createMessageForAnswer(question, "Nope, wrong answer!");
                    sendMessage(senderId, message);
                }
            }
            else {
                sendMessage(senderId, {text: "Oops! For some reason I can't find the question for you at the moment. Sorry about that."});
            }
        }

        utils.getQuestion(qId, afterGettingQuestion);
    }
    else if (payload.indexOf("QUESTION_NEXT/") == 0) {
        //the format of payload is OPTION_A/eng/0
        var indexOfSlash = payload.indexOf('/');
        var qId = payload.substr(indexOfSlash + 1);
        indexOfSlash = qId.indexOf('/');
        var subjid = qId.substring(0, indexOfSlash);

        function afterGettingQuestion(error, question) {
            if (question) {
                //if question has more than 3 options, Facebook doesn't let us create more than 3 buttons at once
                if (question.options.D) {
                    sendMessage(senderId, {text: question.text}); //send question
                    var messages = createMessagesForOptions(question);
                    messages.forEach(function(message){
                        sendMessage(senderId, message); //send options
                    });
                } else {
                    var message = createMessageForQuestion(question);
                    sendMessage(senderId, message);
                }
            }
            else {
                sendMessage(senderId, {text: "Oops! For some reason I can't find a random question for you at the moment. Sorry about that."});
            }
        }

        utils.getRandomQuestion(subjid, afterGettingQuestion);
    }
    else if (payload.indexOf("QUESTION_REPORT/") == 0) {
        sendMessage(senderId, {text: "Wow! I will have to review this question later."});

        //the format of payload is OPTION_A/eng/0
        var indexOfSlash = payload.indexOf('/');
        var qId = payload.substr(indexOfSlash + 1);
        indexOfSlash = qId.indexOf('/');
        var subjid = qId.substring(0, indexOfSlash);

        function afterGettingQuestion(error, question) {
            if (question) {
                //if question has more than 3 options, Facebook doesn't let us create more than 3 buttons at once
                if (question.options.D) {
                    sendMessage(senderId, {text: question.text}); //send question
                    var messages = createMessagesForOptions(question);
                    messages.forEach(function(message){
                        sendMessage(senderId, message); //send options
                    });
                } else {
                    var message = createMessageForQuestion(question);
                    sendMessage(senderId, message);
                }
            }
            else {
                sendMessage(senderId, {text: "Oops! For some reason I can't find a random question for you at the moment. Sorry about that."});
            }
        }

        utils.getRandomQuestion(subjid, afterGettingQuestion);
    }
    else if (payload.indexOf("SUBJECT/") == 0) {
        var indexOfSlash = payload.indexOf('/');
        var subjId = payload.substr(indexOfSlash + 1);

        function afterGettingQuestion(error, question) {
            if (question) {
                //if question has more than 3 options, Facebook doesn't let us create more than 3 buttons at once
                if (question.options.D) {
                    sendMessage(senderId, {text: question.text}); //send question
                    var messages = createMessagesForOptions(question);
                    messages.forEach(function(message){
                        sendMessage(senderId, message); //send options
                    });
                } else {
                    var message = createMessageForQuestion(question);
                    sendMessage(senderId, message);
                }
            }
            else {
                sendMessage(senderId, {text: "Oops! For some reason I can't find a random question for you at the moment. Sorry about that."});
            }
        }

        utils.getRandomQuestion(subjId, afterGettingQuestion);
    }
    else if (payload.indexOf("SUBJECT_WRONG") == 0) {
        sendMessage(senderId, {text: "Ok. Sorry about that. What subject would you like to practice?"});
    } 
    else if (payload === "Explain") { //user wants you to explain how the answer was gotten
        utils.getCurrentQuestion(senderId, function(error, question){
            if(question && question.solution) {
                sendMessage(senderId, {text: question.solution});
            } else {
                sendMessage(senderId, {text: "Oops! I can't seem to remember how this question was solved. Sorry about that."});
            }
        });
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

function createMessageForAnswer(question, remark) {
    var buttons = [];
    buttons.push({type: "postback", title: "Next", payload: "QUESTION_NEXT/" + question.id});
    if (question.solution) {
        buttons.push({type: "postback", title: "Explain", payload: "QUESTION_EXPLAIN/" + question.id});
    }
    buttons.push({type: "postback", title: "Wrong", payload: "QUESTION_REPORT/" + question.id});
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
            text += "\n\nA: " + question.options.A;
            buttons.push({type: "postback", title: "A", payload: "OPTION_A/" + question.id});
        }
        if (question.options.B) {
            text += "\nB: " + question.options.B;
            buttons.push({type: "postback", title: "B", payload: "OPTION_B/" + question.id});
        }
        if (question.options.C) {
            text += "\nC: " + question.options.C;
            buttons.push({type: "postback", title: "C", payload: "OPTION_C/" + question.id});
        }
        if (question.options.D) {
            text += "\nD: " + question.options.D;
            buttons.push({type: "postback", title: "D", payload: "OPTION_D/" + question.id});
        }
        if (question.options.E) {
            text += "\nE: " + question.options.E;
            //buttons.push({type: "postback", title: "E", payload: "OPTION_E/" + question.id});
        }
    }
    var message = {
        attachment: {
            type: "template",
            payload: {
                template_type: "button",
                text: text,
                buttons: buttons
            }
        }
    };

    return message;
}

function createMessagesForOptions(question) {
    var messages = [];
    if (question.options) {
        if (question.options.A) {
            messages.push({
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "button",
                        text: "A: " + question.options.A,
                        buttons: [{type: "postback", title: "A", payload: "OPTION_A/" + question.id}]
                    }
                }
            });
        }
        if (question.options.B) {
            messages.push({
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "button",
                        text: "B: " + question.options.B,
                        buttons: [{type: "postback", title: "B", payload: "OPTION_B/" + question.id}]
                    }
                }
            });
        }
        if (question.options.C) {
            messages.push({
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "button",
                        text: "C: " + question.options.C,
                        buttons: [{type: "postback", title: "C", payload: "OPTION_C/" + question.id}]
                    }
                }
            });
        }
        if (question.options.D) {
            messages.push({
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "button",
                        text: "D: " + question.options.D,
                        buttons: [{type: "postback", title: "D", payload: "OPTION_D/" + question.id}]
                    }
                }
            });
        }
        if (question.options.E) {
            messages.push({
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "button",
                        text: "E: " + question.options.E,
                        buttons: [{type: "postback", title: "E", payload: "OPTION_E/" + question.id}]
                    }
                }
            });
        }
    }

    return messages;
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
