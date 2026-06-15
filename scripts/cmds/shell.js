const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

const SHELL_INFO = `╔══════════════════════════════════════════╗
║         SHELL COMMAND REFERENCE          ║
╠══════════════════════════════════════════╣
║  📁 FILE & DIRECTORY                     ║
║  ls           - List files/folders       ║
║  ls -la       - List with details        ║
║  pwd          - Current directory        ║
║  cat <file>   - Read file content        ║
║  mkdir <dir>  - Create directory         ║
║  rm <file>    - Delete file              ║
║  cp <src> <dst> - Copy file              ║
║  mv <src> <dst> - Move/rename file       ║
╠══════════════════════════════════════════╣
║  🤖 BOT & NODE                           ║
║  node -v       - Node.js version         ║
║  npm -v        - NPM version             ║
║  npm list --depth=0 - Installed packages ║
║  npm install <pkg>  - Install package    ║
║  npm uninstall <pkg> - Remove package    ║
╠══════════════════════════════════════════╣
║  📊 SYSTEM INFO                          ║
║  ps aux        - Running processes       ║
║  top -bn1      - CPU/memory usage        ║
║  df -h         - Disk space              ║
║  free -h       - RAM usage               ║
║  uptime        - System uptime           ║
║  uname -a      - OS info                 ║
╠══════════════════════════════════════════╣
║  🌐 NETWORK                              ║
║  ping -c3 google.com - Ping test         ║
║  curl <url>    - HTTP request            ║
║  wget <url>    - Download file           ║
╠══════════════════════════════════════════╣
║  📦 SCRIPTS DIR                          ║
║  ls scripts/cmds  - List commands        ║
║  ls scripts/events - List events         ║
╚══════════════════════════════════════════╝
💡 Usage: shell <command>
💡 Example: shell ls -la scripts/cmds`;

module.exports = {
        config: {
                name: "shell",
                aliases: ["sh", "cmd", "exec"],
                version: "2.0",
                author: "MOSTAKIM",
                countDown: 5,
                role: 4,
                description: {
                        en: "Execute shell commands on the server"
                },
                category: "owner",
                guide: {
                        en: "{pn} <command>  — Execute any shell command\n{pn} info        — Show all available commands"
                }
        },

        langs: {
                en: {
                        missingCommand: "⚠️ Please enter a shell command.\n\nType shell info to see available commands.",
                        executing: "⚙️ Executing...",
                        output: "✅ Output:\n\n%1",
                        error: "❌ Error:\n\n%1",
                        timeout: "⏱️ Command timed out (30s limit)."
                }
        },

        onStart: async function ({ message, args, getLang }) {
                const command = args.join(" ").trim();

                if (!command) return message.reply(getLang("missingCommand"));

                if (command.toLowerCase() === "info") {
                        return message.reply(SHELL_INFO);
                }

                await message.reply(getLang("executing"));

                try {
                        const { stdout, stderr } = await execPromise(command, {
                                timeout: 30000,
                                maxBuffer: 1024 * 1024 * 10
                        });

                        let output = "";
                        if (stdout) output += stdout;
                        if (stderr) output += `[stderr]\n${stderr}`;
                        if (!output) output = "Command executed successfully (no output).";
                        if (output.length > 2000) output = output.substring(0, 1997) + "...";

                        return message.reply(getLang("output", output));
                } catch (error) {
                        let errorMsg = error.message || String(error);
                        if (errorMsg.includes("ETIMEDOUT") || errorMsg.includes("timeout"))
                                return message.reply(getLang("timeout"));
                        if (errorMsg.length > 2000) errorMsg = errorMsg.substring(0, 1997) + "...";
                        return message.reply(getLang("error", errorMsg));
                }
        }
};
