const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { tikdown } = require("mostakim-media-downloaders");

const CACHE_DIR = path.join(__dirname, "tiktok_cache");

module.exports = {
  config: {
    name: "tiktok",
    aliases: ["tt", "ttdl"],
    version: "2.0",
    author: "MOSTAKIM",
    countDown: 5,
    role: 0,
    description: { en: "Download TikTok video by URL (no watermark)" },
    category: "media",
    guide: { en: "{pn} <tiktok video url>" }
  },

  onStart: async function ({ api, args, event, message }) {
    const url = args.join(" ").trim();

    if (!url || !url.startsWith("http")) {
      return message.reply("❌ Please provide a TikTok video URL.\nExample: tiktok https://www.tiktok.com/@user/video/123");
    }

    if (!url.includes("tiktok.com") && !url.includes("vm.tiktok.com") && !url.includes("vt.tiktok.com")) {
      return message.reply("❌ That doesn't look like a TikTok URL.");
    }

    const { messageID, threadID } = event;
    try { api.setMessageReaction("⏳", messageID, threadID, () => {}, true); } catch {}

    await fs.ensureDir(CACHE_DIR);
    const filePath = path.join(CACHE_DIR, `tt_${Date.now()}.mp4`);

    try {
      const result = await tikdown(url);

      if (!result || !result.status) throw new Error(result?.msg || "TikTok download failed");

      const data = result.data || result;
      const title = data.title || data.name || "TikTok Video";

      let videoUrl = null;
      if (Array.isArray(data.url) && data.url.length > 0) {
        videoUrl = data.url[0];
      } else if (typeof data.url === "string") {
        videoUrl = data.url;
      } else if (data.downloadUrl) {
        videoUrl = data.downloadUrl;
      } else if (data.video) {
        videoUrl = data.video;
      } else if (data.nwm) {
        videoUrl = data.nwm;
      } else if (data.wm) {
        videoUrl = data.wm;
      }

      if (!videoUrl) throw new Error("No video URL in response.");

      const response = await axios({ method: "get", url: videoUrl, responseType: "stream", timeout: 120000 });
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => { writer.on("finish", resolve); writer.on("error", reject); });

      await message.reply({ body: `🎵 ${title}`, attachment: fs.createReadStream(filePath) });
      try { api.setMessageReaction("✅", messageID, threadID, () => {}, true); } catch {}
    } catch (err) {
      console.error("[TIKTOK ERROR]", err.message);
      try { api.setMessageReaction("❌", messageID, threadID, () => {}, true); } catch {}
      message.reply("❌ Failed to download the TikTok video. Make sure the URL is correct and the video is public.");
    } finally {
      setTimeout(() => fs.remove(filePath).catch(() => {}), 15000);
    }
  }
};
