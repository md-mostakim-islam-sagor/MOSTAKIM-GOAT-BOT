const fs = require("fs-extra");
const { utils } = global;

module.exports = {
        config: {
                name: "prefix",
                version: "1.5",
                author: "MOSTAKIM",
                countDown: 5,
                role: 0,
                description: "Check or change the bot prefix",
                category: "config",
                guide: {
                        en: "   {pn} <new prefix>   — Change prefix in this chat\n"
                                + "   {pn} reset         — Reset to default prefix\n"
                                + "   {pn} <prefix> -g   — Change global prefix (admin only)\n"
                                + "   prefix             — Show current prefix (no command prefix needed)"
                }
        },

        langs: {
                en: {
                        reset: "Prefix reset to default: %1",
                        onlyAdmin: "Only admin can change the global prefix",
                        confirmGlobal: "React to this message to confirm changing the GLOBAL bot prefix",
                        confirmThisThread: "React to this message to confirm changing the prefix in this chat",
                        successGlobal: "Global prefix changed to: %1",
                        successThisThread: "Prefix in this chat changed to: %1",
                        myPrefix: "👋 Hey %1!\n➥ 🌐 Global Prefix: %2\n➥ 💬 This Chat Prefix: %3\n🤖 I'm %4 at your service 🫡"
                }
        },

        onStart: async function ({ message, role, args, commandName, event, threadsData, getLang, usersData }) {
                const currentPrefix = global.GoatBot.config.prefix;
                const threadPrefix = utils.getPrefix(event.threadID);

                if (!args[0]) {
                        const userName = await usersData.getName(event.senderID);
                        const botName = global.GoatBot.config.nickNameBot || "Bot";
                        return message.reply(getLang("myPrefix", userName, currentPrefix, threadPrefix, botName));
                }

                if (args[0] === "reset") {
                        await threadsData.set(event.threadID, null, "data.prefix");
                        return message.reply(getLang("reset", currentPrefix));
                }

                const newPrefix = args[0];
                const formSet = { commandName, author: event.senderID, newPrefix };

                if (args[1] === "-g") {
                        if (role < 2) return message.reply(getLang("onlyAdmin"));
                        formSet.setGlobal = true;
                } else {
                        formSet.setGlobal = false;
                }

                return message.reply(
                        args[1] === "-g" ? getLang("confirmGlobal") : getLang("confirmThisThread"),
                        (err, info) => {
                                if (!err && info) {
                                        formSet.messageID = info.messageID;
                                        global.GoatBot.onReaction.set(info.messageID, formSet);
                                }
                        }
                );
        },

        onReaction: async function ({ message, threadsData, event, Reaction, getLang }) {
                const { author, newPrefix, setGlobal } = Reaction;
                if (event.userID !== author) return;

                if (setGlobal) {
                        global.GoatBot.config.prefix = newPrefix;
                        fs.writeFileSync(global.client.dirConfig, JSON.stringify(global.GoatBot.config, null, 2));
                        return message.reply(getLang("successGlobal", newPrefix));
                } else {
                        await threadsData.set(event.threadID, newPrefix, "data.prefix");
                        return message.reply(getLang("successThisThread", newPrefix));
                }
        },

        onChat: async function ({ event, message, getLang, usersData }) {
                if (!event.body) return;

                const body = event.body.toLowerCase().trim();
                if (body !== "prefix") return;

                const prefix = utils.getPrefix(event.threadID);
                if (event.body.startsWith(prefix)) return;

                const userName = await usersData.getName(event.senderID);
                const botName = global.GoatBot.config.nickNameBot || "Bot";
                return message.reply(getLang("myPrefix", userName, global.GoatBot.config.prefix, prefix, botName));
        }
};
