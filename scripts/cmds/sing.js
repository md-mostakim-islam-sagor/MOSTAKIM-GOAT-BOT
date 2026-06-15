const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { soundcloudSearch, soundcloud, ytdown } = require("mostakim-media-downloaders");

module.exports = {
  config: {
    name: "sing",
    aliases: ["song", "music", "audio"],
    version: "2.0",
    author: "MOSTAKIM",
    countDown: 5,
    role: 0,
    shortDescription: { en: "Search and download song (SoundCloud / YouTube audio)" },
    category: "media",
    guide: { en: "{pn} <song name>" }
  },

  onStart: async function ({ message, args, event, api, commandName }) {
    const query = args.join(" ");
    if (!query) return message.reply("🎵 Please provide a song name.\nExample: sing Shape of You");

    try {
      message.reply(`🔎 Searching for: ${query}`);

      let results = [];
      let source = "soundcloud";

      const scResult = await soundcloudSearch(query, 6);
      if (scResult && scResult.status && Array.isArray(scResult.data) && scResult.data.length > 0) {
        results = scResult.data;
        source = "soundcloud";
      } else {
        const res = await axios.get(`https://nayan-video-downloader.vercel.app/ytsearch?query=${encodeURIComponent(query)}`, { timeout: 15000 });
        results = (res.data?.data || res.data?.results || []).slice(0, 6);
        source = "youtube";
      }

      if (!results.length) return message.reply("❌ No songs found.");

      const cacheDir = path.join(__dirname, "cache");
      await fs.ensureDir(cacheDir);

      let msg = "";
      const attachments = [];

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const title = r.title || r.name || r.song || "Unknown";
        const artist = r.artist || r.author || r.uploader || "";
        const dur = r.duration || r.length || "";
        msg += `${i + 1}. ${title}${artist ? ` - ${artist}` : ""}${dur ? ` [${dur}]` : ""}\n\n`;

        const thumb = r.thumbnail || r.cover || r.image || r.artwork;
        if (thumb) {
          try {
            const imgPath = path.join(cacheDir, `sing_${Date.now()}_${i}.jpg`);
            const imgRes = await axios.get(thumb, { responseType: "arraybuffer", timeout: 10000 });
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
          source
        });
        attachments.forEach(s => setTimeout(() => fs.remove(s.path).catch(() => {}), 15000));
      });
    } catch (e) {
      console.error("[SING SEARCH ERROR]", e.message);
      message.reply("❌ Search failed. Please try again.");
    }
  },

  onReply: async function ({ message, event, Reply, api }) {
    const choice = parseInt(event.body);
    if (isNaN(choice) || choice < 1 || choice > Reply.results.length) return;
    if (Reply.author !== event.senderID) return;

    const selected = Reply.results[choice - 1];
    try { api.unsendMessage(event.messageReply.messageID); } catch {}
    try { api.setMessageReaction("⏳", event.messageID, event.threadID, () => {}, true); } catch {}

    const cacheDir = path.join(__dirname, "cache");
    const filePath = path.join(cacheDir, `sing_dl_${Date.now()}.mp3`);

    try {
      let streamUrl = null;
      const title = selected.title || selected.name || selected.song || "Song";
      const trackUrl = selected.url || selected.link || selected.permalink;

      if (Reply.source === "soundcloud" && trackUrl) {
        const result = await soundcloud(trackUrl);
        if (result && result.status) {
          const data = result.data || result;
          streamUrl = data.downloadUrl || data.url || data.audio;
          if (Array.isArray(streamUrl)) streamUrl = streamUrl[0];
        }
      }

      if (!streamUrl && trackUrl) {
        const result = await ytdown(trackUrl);
        if (result && result.status) {
          const data = result.data || result;
          streamUrl = data.audio || data.mp3;
          if (!streamUrl) {
            const urls = Array.isArray(data.url) ? data.url : (data.url ? [data.url] : []);
            streamUrl = urls[0];
          }
        }
      }

      if (!streamUrl) throw new Error("No download URL found.");

      const fileRes = await axios.get(streamUrl, { responseType: "arraybuffer", timeout: 120000 });
      await fs.writeFile(filePath, Buffer.from(fileRes.data));

      await message.reply({ body: `🎵 ${title}`, attachment: fs.createReadStream(filePath) });
      try { api.setMessageReaction("✅", event.messageID, event.threadID, () => {}, true); } catch {}
    } catch (err) {
      console.error("[SING DOWNLOAD ERROR]", err.message);
      try { api.setMessageReaction("❌", event.messageID, event.threadID, () => {}, true); } catch {}
      message.reply("❌ Download failed. Please try another song.");
    } finally {
      setTimeout(() => fs.remove(filePath).catch(() => {}), 30000);
    }
  }
};
