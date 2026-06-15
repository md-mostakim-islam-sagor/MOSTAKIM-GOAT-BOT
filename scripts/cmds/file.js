const fs = require("fs-extra");
const path = require("path");

module.exports = {
        config: {
                name: "file",
                aliases: ["source", "src", "code"],
                version: "2.0",
                author: "MOSTAKIM",
                countDown: 5,
                role: 4,
                description: {
                        en: "View the source code of any command or event script"
                },
                category: "system",
                guide: {
                        en: "{pn} <command name>  — View source code of a command\n{pn} -e <event name> — View source code of an event script\n{pn} list            — List all available commands"
                }
        },

        onStart: async function ({ args, message, event, api }) {
                if (!args.length) {
                        return message.reply(
                                "❓ Usage:\n" +
                                "• file <command>   — View command source\n" +
                                "• file -e <event>  — View event script source\n" +
                                "• file list        — List all commands"
                        );
                }

                if (args[0].toLowerCase() === "list") {
                        const allCommands = global.GoatBot.commands;
                        const names = [...allCommands.keys()].sort().join(", ");
                        return message.reply(`📦 All commands (${allCommands.size}):\n\n${names}`);
                }

                let scriptType = "cmds";
                let inputName = args[0].toLowerCase();

                if (inputName === "-e") {
                        scriptType = "events";
                        inputName = (args[1] || "").toLowerCase();
                        if (!inputName) return message.reply("❌ Please provide an event script name.");
                }

                const scriptDir = path.join(process.cwd(), "scripts", scriptType);
                const allCommands = global.GoatBot.commands;

                let resolvedName = inputName;

                if (scriptType === "cmds") {
                        let command = allCommands.get(inputName);
                        if (!command) {
                                command = [...allCommands.values()].find(c =>
                                        (c.config.aliases || []).includes(inputName)
                                );
                        }
                        if (!command) return message.reply(`❌ Command "${inputName}" not found.`);
                        resolvedName = command.config.name;
                }

                if (!/^[a-zA-Z0-9_\-]+$/.test(resolvedName)) {
                        return message.reply("❌ Invalid name — only letters, numbers, - and _ are allowed.");
                }

                const allowedDir = path.resolve(scriptDir);
                const filePath = path.resolve(scriptDir, `${resolvedName}.js`);

                if (!filePath.startsWith(allowedDir)) {
                        return message.reply("⛔ Access denied: path traversal detected.");
                }

                if (!fs.existsSync(filePath)) {
                        return message.reply(`❌ File not found: ${resolvedName}.js`);
                }

                try {
                        const content = fs.readFileSync(filePath, "utf-8");
                        const lines = content.split("\n").length;
                        const size = Buffer.byteLength(content, "utf8");

                        const header = `📄 ${resolvedName}.js  |  ${lines} lines  |  ${(size / 1024).toFixed(1)} KB\n${"─".repeat(40)}\n`;

                        if (content.length > 3800) {
                                const truncated = content.substring(0, 3750);
                                return message.reply(`${header}${truncated}\n...[truncated, file too large]`);
                        }

                        return message.reply(`${header}${content}`);
                } catch (err) {
                        return message.reply(`❌ Error reading file: ${err.message}`);
                }
        }
};
