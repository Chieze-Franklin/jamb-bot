var express = require("express");
var request = require("request");
var bodyParser = require("body-parser");

var utils = require("./utils");

var app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use('/public', express.static(__dirname + "/public"));
app.listen((process.env.PORT || 5000));

var BASE_URL = "https://jamb-bot.herokuapp.com/";

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

            sendMessage(senderId, {text: "What subject would you like to practise?"});
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
        var indexOfSlash = payload.indexOf('/');
        var qId = payload.substr(indexOfSlash + 1);

        sendExplanation(senderId, qId);
    }
    else if (payload.indexOf("QUESTION_NEXT/") == 0) {
        var indexOfSlash = payload.indexOf('/');
        var qId = payload.substr(indexOfSlash + 1);

        sendNextQuestion(senderId, qId);
    }
    else if (payload.indexOf("QUESTION_REPORT/") == 0) {
        var indexOfSlash = payload.indexOf('/');
        var qId = payload.substr(indexOfSlash + 1);
        var message = createTextWithButtonsMessage("Wow! I will have to review this question later.", 
            [{type: "postback", title: "Next", payload: "QUESTION_NEXT/" + qId}]);
        sendMessage(senderId, message);
    }
    else if (payload.indexOf("SUBJECT/") == 0) {
        var indexOfSlash = payload.indexOf('/');
        var subjId = payload.substr(indexOfSlash + 1);

        function afterGettingQuestion(error, question) {
            if (question) {
                sendQuestion(senderId, question);
            }
            else {
                sendMessage(senderId, {text: "Oops! For some reason I can't find a random question for you at the moment. Sorry about that."});
            }
        }

        utils.getRandomQuestion(subjId, afterGettingQuestion);
    }
    else if (payload.indexOf("SUBJECT_WRONG") == 0) {
        sendMessage(senderId, {text: "OK. Sorry about that. What subject would you like to practise?"});
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
            var message = bye + "It was really nice practising with you. Hope we chat again soon.";//TODO: put a button to link to examhub.com when it is ready
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

            if (formattedMsg.indexOf("hello") > -1 || formattedMsg.indexOf("hey") > -1 || formattedMsg.indexOf("hi") > -1 || formattedMsg.indexOf("good ") > -1 || //good morning, good day...
                formattedMsg.indexOf("start") > -1 || formattedMsg.indexOf("begin") > -1 ||
                formattedMsg.indexOf("subject") > -1 || formattedMsg.indexOf("course") > -1 || formattedMsg.indexOf("program") > -1) {
                //assume the user wants to change subjects
                sendMessage(senderId, {text: "What subject would you like to practise?"});
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
                    message = bye + "It was really nice practising with you. Hope we chat again soon.";//TODO: put a button to link to examhub.com when it is ready
                    sendMessage(senderId, {text: message});
                });
            }
            else if (formattedMsg === "explain") {
                utils.getUserQuestionId(senderId, function(error, qid) {
                    if (qid) {
                        sendExplanation(senderId, qid);
                    }
                    else {
                        sendMessage(senderId, {text: "Oops! For some reason I can't find the question for you at the moment. Sorry about that."});
                    }
                });
            }
            else if (formattedMsg === "next") {
                utils.getUserQuestionId(senderId, function(error, qid) {
                    if (qid) {
                        sendNextQuestion(senderId, qid);
                    }
                    else {
                        sendMessage(senderId, {text: "Oops! For some reason I can't find the question for you at the moment. Sorry about that."});
                    }
                });
            }
            else if (formattedMsg === "wrong" ||
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
                text: "OK. Shall we begin practising " + subjName + "?",
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
    if (question.explanation) {
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
    var text = question.body;
    var buttons = [];
    if (question.options) {
        if (question.options.a) {
            text += "\n\nA: " + question.options.a;
            buttons.push({type: "postback", title: "A", payload: "OPTION_A/" + question.id});
        }
        if (question.options.b) {
            text += "\nB: " + question.options.b;
            buttons.push({type: "postback", title: "B", payload: "OPTION_B/" + question.id});
        }
        if (question.options.c) {
            text += "\nC: " + question.options.c;
            buttons.push({type: "postback", title: "C", payload: "OPTION_C/" + question.id});
        }
        if (question.options.d) {
            text += "\nD: " + question.options.d;
            buttons.push({type: "postback", title: "D", payload: "OPTION_D/" + question.id});
        }
        if (question.options.e) {
            text += "\nE: " + question.options.e;
            buttons.push({type: "postback", title: "E", payload: "OPTION_E/" + question.id});
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
        if (question.options.a) {
            messages.push(createTextWithButtonsMessage("A: " + question.options.a, [{type: "postback", title: "A", payload: "OPTION_A/" + question.id}]));
        }
        else if (question.options.a_image) {
            messages.push(createImageWithButtonsMessage("A", "option a", BASE_URL + question.options.a_image, [{type: "postback", title: "A", payload: "OPTION_A/" + question.id}]));
        }

        if (question.options.b) {
            messages.push(createTextWithButtonsMessage("B: " + question.options.b, [{type: "postback", title: "B", payload: "OPTION_B/" + question.id}]));
        }
        else if (question.options.b_image) {
            messages.push(createImageWithButtonsMessage("B", "option b", BASE_URL + question.options.b_image, [{type: "postback", title: "B", payload: "OPTION_B/" + question.id}]));
        }

        if (question.options.c) {
            messages.push(createTextWithButtonsMessage("C: " + question.options.c, [{type: "postback", title: "C", payload: "OPTION_C/" + question.id}]));
        }
        else if (question.options.c_image) {
            messages.push(createImageWithButtonsMessage("C", "option c", BASE_URL + question.options.c_image, [{type: "postback", title: "C", payload: "OPTION_C/" + question.id}]));
        }

        if (question.options.d) {
            messages.push(createTextWithButtonsMessage("D: " + question.options.d, [{type: "postback", title: "D", payload: "OPTION_D/" + question.id}]));
        }
        else if (question.options.d_image) {
            messages.push(createImageWithButtonsMessage("D", "option d", BASE_URL + question.options.d_image, [{type: "postback", title: "D", payload: "OPTION_D/" + question.id}]));
        }

        if (question.options.e) {
            messages.push(createTextWithButtonsMessage("E: " + question.options.e, [{type: "postback", title: "E", payload: "OPTION_E/" + question.id}]));
        }
        else if (question.options.e_image) {
            messages.push(createImageWithButtonsMessage("E", "option e", BASE_URL + question.options.e_image, [{type: "postback", title: "E", payload: "OPTION_E/" + question.id}]));
        }
    }

    return messages;
}

function createImageMessage(url) {
    var message = {
        attachment: {
            type: "image",
            payload: {
                url: url
            }
        }
    };

    return message;
}
function createImageWithButtonsMessage(title, subtitle, url, buttons) {
    var message = {
        attachment: {
            type: "template",
            payload: {
                template_type: "generic",
                elements: [{
                    title: title,
                    subtitle: subtitle,
                    image_url: url,
                    buttons: buttons
                }]
            }
        }
    };

    return message;
}
function createTextWithButtonsMessage(text, buttons) {
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

function sendExplanation(recipientId, qId) {
    function afterGettingQuestion(error, question) {
        if (question && question.explanation) {
            if (question.explanation) {
                var message = createTextWithButtonsMessage(question.explanation, [{type: "postback", title: "Next", payload: "QUESTION_NEXT/" + qId}]);
                sendMessage(recipientId, message);
            }
            else if (question.explanation_image) {
                var message = createImageWithButtonsMessage("Explanation", "how the answer was gotten", 
                    BASE_URL + question.explanation_image, [{type: "postback", title: "Next", payload: "QUESTION_NEXT/" + qId}]);
                sendMessage(recipientId, message);
            }
        }
        else {
            sendMessage(recipientId, {text: "Oops! For some reason I can't find the explanation for this question at the moment. Sorry about that."});
        }
    }

    utils.getQuestion(qId, afterGettingQuestion);
}

function sendNextQuestion(recipientId, qId) {
    var indexOfSlash = qId.indexOf('/');
    var subjid = qId.substring(0, indexOfSlash);

    function afterGettingQuestion(error, question) {
        if (question) {
            sendQuestion(senderId, question);
        }
        else {
            sendMessage(senderId, {text: "Oops! For some reason I can't find a random question for you at the moment. Sorry about that."});
        }
    }

    utils.getRandomQuestion(subjid, afterGettingQuestion);
}

function sendQuestion(recipientId, question) {
    utils.setUserQuestionId(recipientId, question.id, function(error, data) {});

    if (question.preamble) {
        sendMessage(recipientId, {text: question.preamble});
    }
    else if (question.preamble_image) {
        var message = createImageMessage(BASE_URL + question.preamble_image);
        sendMessage(recipientId, message);
    }

    //if the question has body_image or
    //if question has more than 3 options (Facebook doesn't let us create more than 3 buttons at once) or
    //if the question has an option that is not a text (like a_image)
    if (question.body_image ||
        question.options.d || 
        question.options.a_image || question.options.b_image || question.options.c_image || question.options.d_image || question.options.e_image) {
        if (question.body) {
            sendMessage(recipientId, {text: question.body});
        }
        else if (question.body_image) {
            var message = createImageMessage(BASE_URL + question.body_image);
            sendMessage(recipientId, message);
        }

        var messages = createMessagesForOptions(question);
        messages.forEach(function(message){
            sendMessage(recipientId, message); //send options
        });
    } else {
        var message = createMessageForQuestion(question);
        sendMessage(recipientId, message);
    }
}

//====================================

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
