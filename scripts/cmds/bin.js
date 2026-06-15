const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

const API_SOURCE = "https://raw.githubusercontent.com/Ayan-alt-deep/xyc/main/baseApiurl.json";

module.exports = {
  config: {
    name: "bin",
    aliases: ["pastebin", "upload"],
    version: "4.0",
    author: "MOSTAKIM",
    countDown: 5,
    role: 4,
    shortDescription: {
      en: "Upload a file or attachment to APIbin"
    },
    longDescription: {
      en: "Upload a bot script file or replied attachment to APIbin and get a raw URL."
    },
    category: "utility",
    guide: {
      en: "{pn} <filename>     — Upload a script file by name\n{pn} (reply to file) — Upload the replied attachment\n{pn} list           — List all command script names"
    }
  },

  onStart: async function ({ api, event, args, message }) {
    try {
      const input = args[0];

      if (input === "list") {
        const cmdsDir = path.join(process.cwd(), "scripts", "cmds");
        const files = fs.readdirSync(cmdsDir)
          .filter(f => f.endsWith(".js") && !f.endsWith(".eg.js"))
          .map(f => f.replace(".js", ""));
        return message.reply(`📦 Available scripts (${files.length}):\n\n${files.join(", ")}`);
      }

      const baseApiUrl = await getApiBinUrl();
      if (!baseApiUrl) return message.reply("❌ Failed to fetch API base URL.");

      if (event.type === "message_reply" && event.messageReply?.attachments?.length > 0) {
        return this.uploadAttachment(api, event, message, baseApiUrl);
      }

      if (!input) {
        return message.reply("📝 Please provide a filename or reply to a file.\nUse bin list to see all scripts.");
      }

      await this.uploadFile(api, event, message, input, baseApiUrl);
    } catch (error) {
      console.error("[BIN ERROR]", error.message);
      message.reply("❌ Error: " + error.message);
    }
  },

  uploadFile: async function (api, event, message, fileName, baseApiUrl) {
    const filePath = this.findFilePath(fileName);
    if (!filePath) {
      return message.reply(`🔍 File "${fileName}" not found in scripts/cmds or scripts/events.\nUse bin list to see available files.`);
    }

    try {
      const form = new FormData();
      form.append("file", fs.createReadStream(filePath));

      const { data } = await axios.post(`${baseApiUrl}/upload`, form, {
        headers: form.getHeaders(),
        timeout: 30000
      });

      message.reply(`✅ File uploaded!\n📄 Name: ${path.basename(filePath)}\n🔗 Raw: ${data.raw || data.url || JSON.stringify(data)}`);
    } catch (err) {
      message.reply("❌ Upload failed: " + err.message);
    }
  },

  uploadAttachment: async function (api, event, message, baseApiUrl) {
    const attachment = event.messageReply.attachments[0];
    if (!attachment?.url) return message.reply("❌ No valid attachment found.");

    try {
      const response = await axios.get(attachment.url, { responseType: "stream", timeout: 30000 });

      const form = new FormData();
      form.append("file", response.data, attachment.filename || attachment.name || "attachment.bin");

      const { data } = await axios.post(`${baseApiUrl}/upload`, form, {
        headers: form.getHeaders(),
        timeout: 30000
      });

      message.reply(`✅ Attachment uploaded!\n📄 Name: ${attachment.filename || attachment.name || "file"}\n🔗 Raw: ${data.raw || data.url || JSON.stringify(data)}`);
    } catch (err) {
      message.reply("❌ Upload failed: " + err.message);
    }
  },

  findFilePath: function (fileName) {
    const searchDirs = [
      path.join(process.cwd(), "scripts", "cmds"),
      path.join(process.cwd(), "scripts", "events")
    ];
    const extensions = ["", ".js", ".txt", ".json"];

    for (const dir of searchDirs) {
      for (const ext of extensions) {
        const fullPath = path.join(dir, fileName + ext);
        if (fs.existsSync(fullPath)) return fullPath;
      }
    }
    return null;
  }
};

async function getApiBinUrl() {
  try {
    const { data } = await axios.get(API_SOURCE, { timeout: 10000 });
    return data.uploadApi || data.url || null;
  } catch (err) {
    console.error("[BIN] Failed to fetch API URL:", err.message);
    return null;
  }
}
