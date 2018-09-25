const fs = require("fs");
const lockFile = require("lockfile");
const botId = process.env.SLACK_BOT_ID;
const dbFile = "db.json";
const lock = "db.lock";
const helpCommandRegex = new RegExp([
    "help", "option", "action", "command", "menu"
].join("|"));

module.exports = (slack, slackEvents) => {
    slackEvents.on("message", (event) => {
        // ignore events generated by this bot's responses
        if (event.bot_id && event.bot_id == botId) {
            return;
        }
        if (event.message && event.message.bot_id &&
            (event.message.bot_id == botId)) {
            return;
        }

        const message = event.text.trim().toLowerCase();
        if (helpCommandRegex.test(message)) {
            slack.chat.postMessage({
                channel: event.channel,
                text: "Welcome to the private channel manager!",
                attachments: [
                    {
                        text: "Choose an option:",
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
                                type: "button"
                            }
                        ]
                    }
                ]
            }).catch(console.error);
        } else {
            slack.chat.postMessage({
                channel: event.channel,
                text: "Hello there, I don't recognize your command. Try typing `help` for more options.",
            }).catch(console.error);
        }
    });

    slackEvents.on("group_archive", (event) => {
        lockFile.lockSync(lock);
        if (!fs.existsSync(dbFile)) {
            lockFile.unlockSync(lock);
            return;
        }

        let channels = JSON.parse(fs.readFileSync(dbFile));
        for (let i = 0; i < channels.length; ++i) {
            if (channels[i].id == event.channel) {
                channels.splice(i, 1);
                break;
            }
        }

        fs.writeFileSync(dbFile, JSON.stringify(channels));
        lockFile.unlockSync(lock);
    });

    slackEvents.on("error", console.error);
};