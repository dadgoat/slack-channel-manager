/**
 * Unless explicitly stated otherwise all files in this repository are licensed
 * under the MIT License.
 *
 * This product includes software developed at Datadog
 * (https://www.datadoghq.com/).
 *
 * Copyright 2018 Datadog, Inc.
 */

const helpCommandRegex = /help|option|action|command|menu/i;
const requestCommandRegex = /request|create|private/i;
const authChannel = process.env.AUTH_CHANNEL;

module.exports = (shared, logger, Channel, slack, slackEvents) => {
    slackEvents.on("message", async (event) => {
        // ignore events generated by this bot's responses
        if (event.bot_id) {
            return;
        }
        if (event.message && event.message.bot_id) {
            return;
        }

        if (!(await shared.isUserAuthorized(event.user))) {
            logger.info("Unauthorized user trying to use channel manager", {
                user: event.user,
                message: event.text
            });
            return slack.bot.chat.postMessage({
                channel: event.channel,
                text: ":no_entry_sign: *Oops, looks like you're not authorized to use this app.*\n" + 
                "Currently, only Datadog employees are allowed to use this app. " + 
                "If you are one and would like access, please contact the administrators."
            }).catch(logger.error);
        }

        const message = event.text.trim().toLowerCase();
        if (helpCommandRegex.test(message)) {
            logger.info("Recognized command", {
                user: event.user,
                command: "help"
            });
            return slack.bot.chat.postMessage({
                channel: event.channel,
                text: "Here are your options. Type:\n" +
                "- :information_source: | `help`: Print this help message\n" +
                "- :scroll: | `list [keywords ...]`: List active private channels that match your query\n\n" +
                "You can also click on the following options:",
                attachments: [{
                    text: "",
                    fallback: "You are unable to choose an option",
                    callback_id: "menu_button",
                    color: "#3AA3E3",
                    attachment_type: "default",
                    actions: [
                        {
                            name: "request_private_channel",
                            text: "Request a private channel",
                            type: "button"
                        },
                        {
                            name: "list_private_channels",
                            text: "List active private channels",
                            type: "button",
                            value: JSON.stringify({
                                cursor: 0,
                                searchTerms: ""
                            })
                        }
                    ]
                }]
            }).catch(logger.error);
        } else if (message.startsWith("list")) {
            logger.info("Recognized command", {
                user: event.user,
                command: "list"
            });
            const searchTerms = message.replace("list", "").trim().replace(/ /g, "|");
            const reply = await shared.listChannels(0, searchTerms);
            reply.channel = event.channel;
            return slack.bot.chat.postMessage(reply);
        } else {
            return slack.bot.chat.postMessage({
                channel: event.channel,
                text: "Hello there, I don't recognize your command. Try typing `help` for more options.",
            });
        }
    });

    slackEvents.on("group_rename", async (event) => {
        logger.info("Private channel renamed", { channel: event.channel, new_name: event.name });
        return Channel.findByIdAndUpdate(event.channel, { name: event.name })
            .exec()
            .catch(logger.error);
    });

    slackEvents.on("group_archive", async (event) => {
        logger.info("Private channel archived, removing from DB", { channel: event.channel });
        return Channel.findByIdAndRemove(event.channel).catch(logger.error);
    });
    slackEvents.on("group_deleted", async (event) => {
        logger.info("Private channel deleted, removing from DB", { channel: event.channel });
        return Channel.findByIdAndRemove(event.channel).catch(logger.error);
    });

    slackEvents.on("error", logger.error);
};
