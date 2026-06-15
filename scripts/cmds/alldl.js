const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { alldownV2, alldown, fbdown2, instagram, tikdown } = require("mostakim-media-downloaders");

module.exports = {
  config: {
    name: "alldl",
    aliases: ["fbdl", "igdl", "ttdl", "ytdl", "dl"],
    version: "3.0",
    author: "MOSTAKIM",
    countDown: 5,
    role: 0,
    shortDescription: { en: "Multi-platform video downloader" },
    longDescription: { en: "Download videos from FB, IG, TikTok, YT, Twitter, Pinterest, Likee and more via link." },
    category: "media",
    guide: { en: "{pn} <url> or reply to a message with a link. Use '{pn} auto' to toggle auto-download." }
  },

  onStart: async function ({ message, args, event, api }) {
    const input = args[0];

    if (input === "auto") {
      if (!global.alldl_auto) global.alldl_auto = {};
      const threadID = event.threadID;
      global.alldl_auto[threadID] = global.alldl_auto[threadID] === false ? true : false;
      return message.reply(`Auto-download is now ${global.alldl_auto[threadID] ? "ON ✅" : "OFF ❌"}.`);
    }

    let url = input;
    const { type, messageReply } = event;

    if (type === "message_reply") {
      const replyText = messageReply.body;
      const urlMatch = replyText.match(/https?:\/\/[^\s]+/);
      if (urlMatch) url = urlMatch[0];
    }

    if (!url || !url.startsWith("http")) {
      return message.reply("❌ Please provide a valid link or reply to a message with a link.");
    }

    return this.handleDownload({ message, event, api, url });
  },

  onChat: async function ({ message, event, api }) {
    const threadID = event.threadID;
    if (!global.alldl_auto) global.alldl_auto = {};
    if (global.alldl_auto[threadID] === false) return;
    if (!event.body || typeof event.body !== "string") return;

    const urlMatch = event.body.match(/https?:\/\/(www\.)?(facebook|fb|instagram|tiktok|youtube|youtu|shorts|twitter|x\.com|pinterest|likee)\.[^\s]+/);
    if (urlMatch && !event.body.startsWith(global.GoatBot.config.prefix)) {
      return this.handleDownload({ message, event, api, url: urlMatch[0] });
    }
  },

  handleDownload: async function ({ message, event, api, url }) {
    const { messageID, threadID } = event;
    try { api.setMessageReaction("⏳", messageID, threadID, () => {}, true); } catch {}

    const cacheDir = path.join(__dirname, "cache");
    await fs.ensureDir(cacheDir);
    const filePath = path.join(cacheDir, `dl_${Date.now()}.mp4`);

    try {
      let result = await alldownV2(url);
      if (!result || !result.status) result = await alldown(url);
      if (!result || !result.status) throw new Error(result?.msg || "Download failed from all sources");

      const data = result.data || result;
      let videoUrl = null;
      let title = data.title || data.name || "Downloaded Video";

      if (Array.isArray(data.url) && data.url.length > 0) {
        videoUrl = data.url[0];
      } else if (typeof data.url === "string") {
        videoUrl = data.url;
      } else if (data.downloadUrl) {
        videoUrl = data.downloadUrl;
      } else if (data.video) {
        videoUrl = data.video;
      } else if (data.hd) {
        videoUrl = data.hd;
      } else if (data.sd) {
        videoUrl = data.sd;
      }

      if (!videoUrl) throw new Error("No download URL in response.");

      const response = await axios({ method: "get", url: videoUrl, responseType: "stream", timeout: 120000 });
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => { writer.on("finish", resolve); writer.on("error", reject); });

      await message.reply({ body: `✅ ${title}`, attachment: fs.createReadStream(filePath) });
      try { api.setMessageReaction("✅", messageID, threadID, () => {}, true); } catch {}
    } catch (err) {
      console.error("[ALLDL ERROR]", err.message);
      try { api.setMessageReaction("❌", messageID, threadID, () => {}, true); } catch {}
      message.reply("❌ Failed to download. The link may be private or unsupported.");
    } finally {
      setTimeout(() => fs.remove(filePath).catch(() => {}), 15000);
    }
  }
};
