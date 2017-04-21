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

// Privacy Policy
app.get("/privacy", function (req, res) {
    res.send("JAMB Bot currently does NOT collect any information about users. You have nothing to fear. If anything changes with regards to this, you will be duely informed.");
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
    else if (payload.indexOf("QUESTION_EXPLAIN/") == 0) {
        //the format of payload is OPTION_A/eng/0
        var indexOfSlash = payload.indexOf('/');
        var qId = payload.substr(indexOfSlash + 1);

        function afterGettingQuestion(error, question) {
            if (question && question.solution) {
                sendMessage(senderId, {text: question.solution + "\n\nMoving on!"});
            }
            else {
                sendMessage(senderId, {text: "Oops! For some reason I can't find the explanation for this question at the moment. Sorry about that."});
            }

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

        utils.getQuestion(qId, afterGettingQuestion);
    }
    else if (payload.indexOf("QUESTION_NEXT/") == 0) {
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
        sendMessage(senderId, {text: "Wow! I will have to review this question later.\n\nMeanwhile let's continue."});

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
    else if (payload === "STOP") { //user wants to stop now
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

            if (formattedMsg.indexOf("hey") > -1 || formattedMsg.indexOf("hi") > -1 || formattedMsg.indexOf("good ") > -1 || //good morning, good day...
                formattedMsg.indexOf("start") > -1 || formattedMsg.indexOf("begin") > -1 ||
                formattedMsg.indexOf("subject") > -1 || formattedMsg.indexOf("course") > -1 || formattedMsg.indexOf("program") > -1) {
                //assume the user wants to change subjects
                sendMessage(senderId, {text: "What subject would you like to practice?"});
            }
            else if (formattedMsg.indexOf("bye") > -1 || formattedMsg.indexOf("later") > -1 || 
                    formattedMsg.indexOf("complete") > -1 || formattedMsg.indexOf("end") > -1 || formattedMsg.indexOf("finish") > -1 || formattedMsg.indexOf("stop") > -1) {
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
                    message = bye + "It was really nice practicing with you. Hope we chat again soon.";//TODO: put a button to link to examhub.com when it is ready
                    sendMessage(senderId, {text: message});
                });
            }
            else if (formattedMsg === "explain" || formattedMsg === "next" || formattedMsg === "wrong" ||
                     formattedMsg === "a" || formattedMsg === "b" || formattedMsg === "c" || formattedMsg === "d" || formattedMsg === "e" ||
                     formattedMsg === "no" || formattedMsg === "yes") {
                sendMessage(senderId, {text: "Sorry, do NOT type '" + message.text + "' directly. Instead, click on the '" + message.text + "' link/button above. Thanks."});
            }
            else {
                message = createMessageForConfirmSubject(formattedMsg);
                sendMessage(senderId, message);
            }
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

    if (subject.indexOf("acc") > -1) {
        subjName = "Accounting";
        subjCode = "acc";
    }
    else if (subject.indexOf("agr") > -1) {
        subjName = "Agricultural Science";
        subjCode = "agric";
    }
    else if (subject.indexOf("ara") > -1) {
        subjName = "Arabic";
        subjCode = "arab";
    }
    else if (subject.indexOf("bio") > -1) {
        subjName = "Biology";
        subjCode = "bio";
    }
    else if (subject.indexOf("che") > -1) {
        subjName = "Chemistry";
        subjCode = "chem";
    }
    else if (subject.indexOf("com") > -1) {
        subjName = "Commerce";
        subjCode = "comm";
    }
    else if (subject.indexOf("crs") > -1 || subject.indexOf("crk") > -1 || subject.indexOf("christ") > -1) {
        subjName = "Christian Religion Study";
        subjCode = "crs";
    }
    else if (subject.indexOf("eco") > -1) {
        subjName = "Economics";
        subjCode = "eco";
    }
    else if (subject.indexOf("eng") > -1) {
        subjName = "English Language";
        subjCode = "eng";
    }
    else if (subject.indexOf("geo") > -1) {
        subjName = "Geography";
        subjCode = "geo";
    }
    else if (subject.indexOf("gov") > -1) {
        subjName = "Government";
        subjCode = "gov";
    }
    else if (subject.indexOf("hau") > -1) {
        subjName = "Hausa";
        subjCode = "hau";
    }
    else if (subject.indexOf("his") > -1) {
        subjName = "History";
        subjCode = "hist";
    }
    else if (subject.indexOf("igbo") > -1 || subject.indexOf("ibo") > -1) {
        subjName = "Igbo";
        subjCode = "igbo";
    }
    else if (subject.indexOf("irs") > -1 || subject.indexOf("irk") > -1 || subject.indexOf("islam") > -1) {
        subjName = "Islamic Religion Knowledge";
        subjCode = "irk";
    }
    else if (subject.indexOf("mat") > -1) {
        subjName = "Mathematics";
        subjCode = "math";
    }
    else if (subject.indexOf("lit") > -1) {
        subjName = "Literature in English";
        subjCode = "litt";
    }
    else if (subject.indexOf("phy") > -1) {
        subjName = "Physics";
        subjCode = "phy";
    }
    else if (subject.indexOf("yor") > -1) {
        subjName = "Yoruba";
        subjCode = "yor";
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
