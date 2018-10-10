/**
 * Unless explicitly stated otherwise all files in this repository are licensed
 * under the MIT License.
 *
 * This product includes software developed at Datadog
 * (https://www.datadoghq.com/).
 *
 * Copyright 2018 Datadog, Inc.
 */

const authChannel = process.env.AUTH_CHANNEL;

module.exports = (logger, Channel, slack) => {
    return {
        isUserAuthorized: async function(user) {
            let cursor = "";
            do {
                const res = await slack.user.users.conversations({
                    cursor,
                    exclude_archived: true,
                    types: "private_channel",
                    user: user
                });
                if (res.channels.find(c => authChannel == c.name)) {
                    return true;
                }

                cursor = res.response_metadata.next_cursor;
            } while (cursor);
            return false;
        },

        listChannels: async function(offset, searchTerms) {
            const query = (!searchTerms) ? {} : {
                $or: [
                    { name: { $regex: searchTerms, $options: "i" } },
                    { organization: { $regex: searchTerms, $options: "i" } }
                ]
            };

            let paginatedData;
            try {
                paginatedData = await Channel.paginate(query, { offset, limit: 5 });
            } catch (err) {
                logger.error(err);
                return {
                    text: ":heavy_exclamation_mark: An error occurred while trying to get a list of channels."
                };
            }

            const channels = paginatedData.docs;
            if (0 == channels.length) {
                return {
                    text: "There are no active private channels that match your query, " +
                    "type `help` if you would like to request one."
                };
            }

            let attachments = [];
            channels.forEach((channel) => {
                let text = "";
                if (channel.topic) {
                    text += `_${channel.topic}_`;
                }
                if (channel.purpose) {
                    text += "\n" + channel.purpose;
                }

                attachments.push({
                    title: `#${channel.name}`,
                    text,
                    callback_id: "join_channel_button",
                    actions: [
                        {
                            name: "join_channel",
                            text: "Join",
                            type: "button",
                            style: "primary",
                            value: channel.id
                        },
                        {
                            name: "archive_channel",
                            text: "Archive",
                            type: "button",
                            value: channel.id,
                            confirm: {
                                title: `Archive #${channel.name}`,
                                text: `Are you sure you want to archive ${channel.name}?`,
                                ok_text: "Yes",
                                dismiss_text: "No"
                            }
                        }],
                    footer: "Date created",
                    ts: channel.created,
                    mrkdwn: true
                });
            });

            let actions = [];
            if (offset >= 5) {
                actions.push({
                    name: "list_private_channels",
                    text: "Prev page",
                    type: "button",
                    value: JSON.stringify({
                        offset: offset - 5,
                        searchTerms
                    })
                });
            }
            if (offset + 5 < paginatedData.total) {
                actions.push({
                    name: "list_private_channels",
                    text: "Next page",
                    type: "button",
                    value: JSON.stringify({
                        offset: offset + 5,
                        searchTerms
                    })
                });
            }
            if (paginatedData.total > 5) {
                attachments.push({
                    text: "See more channels...",
                    callback_id: "menu_button",
                    actions
                });
            }

            return {
                text: "Here is a `list` of active private channels that match your query:",
                attachments
            };
        },

        requestChannelDialog: async function(trigger_id, data) {
            const { name, user, organization, expire_days, purpose } = data;
            return slack.bot.dialog.open({
                trigger_id,
                dialog: {
                    callback_id: "channel_request_dialog",
                    title: "Request private channel",
                    submit_label: "Submit",
                    elements: [
                        {
                            type: "text",
                            label: "Channel name",
                            name: "channel_name",
                            min_length: 1,
                            max_length: 21,
                            hint: "May only contain lowercase letters, numbers, hyphens, and underscores.",
                            value: name || ""
                        },
                        {
                            type: "select",
                            label: "Invite user",
                            name: "invitee",
                            data_source: "users",
                            value: user || ""
                        },
                        {
                            type: "text",
                            label: "Organization/Customer",
                            name: "organization",
                            optional: true,
                            value: organization || ""
                        },
                        {
                            type: "text",
                            subtype: "number",
                            label: "Days until expiry",
                            name: "expire_days",
                            hint: "Enter a positive integer.",
                            value: expire_days || 28
                        },
                        {
                            type: "textarea",
                            label: "Purpose of channel",
                            name: "purpose",
                            optional: true,
                            max_length: 250,
                            value: purpose || ""
                        }
                    ]
                }
            });
        }
    };
};

