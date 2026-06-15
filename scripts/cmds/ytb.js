const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { ytdown } = require("mostakim-media-downloaders");

module.exports = {
  config: {
    name: "ytb",
    aliases: ["yt", "youtube"],
    version: "2.0",
    author: "MOSTAKIM",
    countDown: 5,
    role: 0,
    shortDescription: { en: "YouTube search & downloader" },
    category: "media",
    guide: { en: "{pn} -a <song/query>  → audio (mp3)\n{pn} -v <video/query> → video (mp4)" }
  },

  onStart: async function ({ message, args, event, api, commandName }) {
    const type = args[0];
    const query = args.slice(1).join(" ");

    if (!["-a", "-v"].includes(type) || !query) {
      return message.reply(`❌ Usage:\n${this.config.name} -a <song name>  → MP3\n${this.config.name} -v <video name> → MP4`);
    }

    try {
      message.reply(`🔎 Searching YouTube for: ${query}`);
      const res = await axios.get(`https://nayan-video-downloader.vercel.app/ytsearch?query=${encodeURIComponent(query)}`, { timeout: 15000 });
      const results = (res.data?.data || res.data?.results || []).slice(0, 6);

      if (!results.length) return message.reply("❌ No results found.");

      const cacheDir = path.join(__dirname, "cache");
      await fs.ensureDir(cacheDir);

      let msg = "";
      const attachments = [];

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        msg += `${i + 1}. ${r.title || r.name}\n[${r.duration || "N/A"}]\n\n`;
        if (r.thumbnail || r.image) {
          try {
            const imgPath = path.join(cacheDir, `yt_${Date.now()}_${i}.jpg`);
            const imgRes = await axios.get(r.thumbnail || r.image, { responseType: "arraybuffer", timeout: 10000 });
            await fs.writeFile(imgPath, Buffer.from(imgRes.data));
            attachments.push(fs.createReadStream(imgPath));
          } catch {}
        }
      }

      message.reply({ body: `${msg.trim()}\n\nReply with 1-${results.length} to download.`, attachment: attachments }, (err, info) => {
        if (err || !info) return;
        global.GoatBot.onReply.set(info.messageID, {
          commandName,
          author: event.senderID,
          results,
          downloadType: type === "-a" ? "audio" : "video"
        });
        attachments.forEach(s => setTimeout(() => fs.remove(s.path).catch(() => {}), 15000));
      });
    } catch (e) {
      console.error("[YTB SEARCH ERROR]", e.message);
      message.reply("❌ Search failed. Please try again.");
    }
  },

  onReply: async function ({ message, event, Reply, api }) {
    const choice = parseInt(event.body);
    if (isNaN(choice) || choice < 1 || choice > Reply.results.length) return;
    if (Reply.author !== event.senderID) return;

    const selected = Reply.results[choice - 1];
    const ytUrl = selected.url || selected.link;
    try { api.unsendMessage(event.messageReply.messageID); } catch {}
    try { api.setMessageReaction("⏳", event.messageID, event.threadID, () => {}, true); } catch {}

    const cacheDir = path.join(__dirname, "cache");
    const ext = Reply.downloadType === "audio" ? "mp3" : "mp4";
    const filePath = path.join(cacheDir, `yt_dl_${Date.now()}.${ext}`);

    try {
      const result = await ytdown(ytUrl);
      if (!result || !result.status) throw new Error(result?.msg || "Download failed");

      const data = result.data || result;
      let streamUrl = null;

      if (Reply.downloadType === "audio") {
        streamUrl = data.audio || data.mp3 || data.audioUrl;
        if (Array.isArray(streamUrl)) streamUrl = streamUrl[0];
      } else {
        streamUrl = data.video || data.mp4 || data.hd || data.sd;
        if (Array.isArray(streamUrl)) streamUrl = streamUrl[0];
      }

      if (!streamUrl) {
        const allUrls = Array.isArray(data.url) ? data.url : (data.url ? [data.url] : []);
        streamUrl = allUrls[0];
      }

      if (!streamUrl) throw new Error("No download URL in response.");

      const fileRes = await axios.get(streamUrl, { responseType: "arraybuffer", timeout: 120000 });
      await fs.writeFile(filePath, Buffer.from(fileRes.data));

      const title = selected.title || selected.name || "YouTube";
      await message.reply({ body: `✅ ${title}`, attachment: fs.createReadStream(filePath) });
      try { api.setMessageReaction("✅", event.messageID, event.threadID, () => {}, true); } catch {}
    } catch (err) {
      console.error("[YTB DOWNLOAD ERROR]", err.message);
      try { api.setMessageReaction("❌", event.messageID, event.threadID, () => {}, true); } catch {}
      message.reply("❌ Download failed. Please try again.");
    } finally {
      setTimeout(() => fs.remove(filePath).catch(() => {}), 30000);
    }
  }
};
