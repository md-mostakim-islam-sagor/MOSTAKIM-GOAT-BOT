const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { spotifySearch, spotifyDl } = require("mostakim-media-downloaders");

let createCanvas, loadImage;
try {
  const canvas = require("canvas");
  createCanvas = canvas.createCanvas;
  loadImage = canvas.loadImage;
} catch {
  createCanvas = null;
  loadImage = null;
}

module.exports = {
  config: {
    name: "spotify",
    aliases: ["sp", "spf"],
    version: "4.0",
    author: "MOSTAKIM",
    countDown: 5,
    role: 0,
    shortDescription: { en: "Search Spotify and download song" },
    category: "media",
    guide: { en: "{pn} <song name>\nReply 'next' to browse · 'download' to get MP3" }
  },

  onStart: async function ({ message, args, event, api, commandName }) {
    const query = args.join(" ");
    if (!query) return message.reply("🎵 Please provide a song name!\nExample: spotify Shape of You");

    try {
      message.reply(`🔎 Searching Spotify for: ${query}`);

      const spResult = await spotifySearch(query, 10);
      let results = [];

      if (spResult && spResult.status && Array.isArray(spResult.data) && spResult.data.length > 0) {
        results = spResult.data;
      } else {
        const itunesRes = await axios.get(
          `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=10`,
          { timeout: 10000 }
        );
        results = (itunesRes.data?.results || []).map(t => ({
          name: t.trackName,
          artist: t.artistName,
          album: t.collectionName,
          duration: formatDur(t.trackTimeMillis),
          cover: (t.artworkUrl100 || "").replace("100x100bb", "600x600bb"),
          url: null,
          _itunesData: t
        }));
      }

      if (!results.length) return message.reply("❌ No songs found.");

      const cacheDir = path.join(__dirname, "cache");
      await fs.ensureDir(cacheDir);
      const { imgPath, bodyText } = await buildReply(results[0], cacheDir, 0, results.length);
      const att = imgPath ? [fs.createReadStream(imgPath)] : [];

      message.reply({ body: bodyText, attachment: att }, (err, info) => {
        if (err || !info) return;
        global.GoatBot.onReply.set(info.messageID, {
          commandName,
          author: event.senderID,
          results,
          currentIndex: 0
        });
        if (imgPath) setTimeout(() => fs.remove(imgPath).catch(() => {}), 30000);
      });
    } catch (e) {
      console.error("[SPOTIFY ERROR]", e.message);
      message.reply("❌ Search error. Please try again later.");
    }
  },

  onReply: async function ({ message, event, Reply, api }) {
    if (Reply.author !== event.senderID) return;

    const body = event.body.trim().toLowerCase();
    const { results, currentIndex } = Reply;

    try { api.unsendMessage(event.messageReply.messageID); } catch {}

    if (body === "next") {
      const nextIndex = (currentIndex + 1) % results.length;
      Reply.currentIndex = nextIndex;

      const cacheDir = path.join(__dirname, "cache");
      await fs.ensureDir(cacheDir);

      try {
        try { api.setMessageReaction("⏳", event.messageID, event.threadID, () => {}, true); } catch {}
        const { imgPath, bodyText } = await buildReply(results[nextIndex], cacheDir, nextIndex, results.length);
        const att = imgPath ? [fs.createReadStream(imgPath)] : [];
        message.reply({ body: bodyText, attachment: att }, (err, info) => {
          if (err || !info) return;
          global.GoatBot.onReply.set(info.messageID, {
            commandName: Reply.commandName,
            author: event.senderID,
            results,
            currentIndex: nextIndex
          });
          if (imgPath) setTimeout(() => fs.remove(imgPath).catch(() => {}), 30000);
        });
        try { api.setMessageReaction("✅", event.messageID, event.threadID, () => {}, true); } catch {}
      } catch (e) {
        try { api.setMessageReaction("❌", event.messageID, event.threadID, () => {}, true); } catch {}
        message.reply("❌ Something went wrong. Please try again.");
      }

    } else if (body === "download") {
      const selected = results[currentIndex];
      try { api.setMessageReaction("⏳", event.messageID, event.threadID, () => {}, true); } catch {}

      const cacheDir = path.join(__dirname, "cache");
      await fs.ensureDir(cacheDir);
      const filePath = path.join(cacheDir, `spotify_dl_${Date.now()}.mp3`);

      try {
        let streamUrl = null;
        const title = selected.name || selected.title || "Unknown";
        const artist = selected.artist || selected.artists || "";

        if (selected.url) {
          const dlResult = await spotifyDl(selected.url);
          if (dlResult && dlResult.status) {
            const data = dlResult.data || dlResult;
            streamUrl = data.downloadUrl || data.url || data.audio || data.mp3;
            if (Array.isArray(streamUrl)) streamUrl = streamUrl[0];
          }
        }

        if (!streamUrl) {
          const searchQ = `${title} ${artist}`.trim();
          const { ytdown } = require("mostakim-media-downloaders");
          const searchRes = await axios.get(`https://nayan-video-downloader.vercel.app/ytsearch?query=${encodeURIComponent(searchQ)}`, { timeout: 15000 });
          const ytResults = (searchRes.data?.data || searchRes.data?.results || []);
          if (ytResults.length > 0) {
            const ytResult = await ytdown(ytResults[0].url || ytResults[0].link);
            if (ytResult && ytResult.status) {
              const data = ytResult.data || ytResult;
              streamUrl = data.audio || data.mp3;
              if (!streamUrl) {
                const urls = Array.isArray(data.url) ? data.url : (data.url ? [data.url] : []);
                streamUrl = urls[0];
              }
            }
          }
        }

        if (!streamUrl) throw new Error("No download URL found.");

        const fileRes = await axios.get(streamUrl, { responseType: "arraybuffer", timeout: 120000 });
        await fs.writeFile(filePath, Buffer.from(fileRes.data));

        const dur = selected.duration || (selected._itunesData ? formatDur(selected._itunesData.trackTimeMillis) : "N/A");
        const album = selected.album || selected.collection || (selected._itunesData?.collectionName) || "N/A";

        await message.reply({
          body: `🎵 ${title}\n👤 ${artist}\n💿 ${album}\n⏱ ${dur}`,
          attachment: fs.createReadStream(filePath)
        });

        try { api.setMessageReaction("✅", event.messageID, event.threadID, () => {}, true); } catch {}
        setTimeout(() => fs.remove(filePath).catch(() => {}), 60000);

      } catch (e) {
        console.error("[SPOTIFY DL ERROR]", e.message);
        try { api.setMessageReaction("❌", event.messageID, event.threadID, () => {}, true); } catch {}
        message.reply("❌ Download failed. Please try again.");
      }
    }
  }
};

function formatDur(ms) {
  if (!ms) return "N/A";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function getNickname() {
  try { return require("../../config.json").nickname || "GOAT BOT"; } catch { return "GOAT BOT"; }
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
}

function clipText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  while (text.length > 1 && ctx.measureText(text + "…").width > maxW)
    text = text.slice(0, -1);
  return text + "…";
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const THEMES = [
  ["#8B0000", "#1a0000"], ["#1a006e", "#000033"], ["#4B0082", "#1a0033"],
  ["#005580", "#001a2e"], ["#006400", "#001a00"], ["#800040", "#2e0015"],
  ["#8B4500", "#2e1a00"], ["#006666", "#001a1a"], ["#556B00", "#1a2200"],
  ["#3d0000", "#0a0000"]
];

async function generateCanvas(track, cacheDir) {
  const W = 900, H = 280;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const [fromHex, toHex] = THEMES[Math.floor(Math.random() * THEMES.length)];
  const c1 = hexToRgb(fromHex), c2 = hexToRgb(toHex);
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, `rgb(${c1.r},${c1.g},${c1.b})`);
  grad.addColorStop(1, `rgb(${c2.r},${c2.g},${c2.b})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, 0, W, H);

  const artSize = 210, artX = 32, artY = (H - artSize) / 2;
  const artUrl = track.cover || track.artwork || track.thumbnail || (track._itunesData?.artworkUrl100 || "").replace("100x100bb", "600x600bb");

  if (artUrl && loadImage) {
    try {
      const imgBuf = await axios.get(artUrl, { responseType: "arraybuffer" });
      const tmpArt = path.join(cacheDir, `_art_${Date.now()}.jpg`);
      await fs.writeFile(tmpArt, Buffer.from(imgBuf.data));
      const img = await loadImage(tmpArt);
      ctx.save();
      roundedRect(ctx, artX, artY, artSize, artSize, 18);
      ctx.clip();
      ctx.drawImage(img, artX, artY, artSize, artSize);
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 2;
      roundedRect(ctx, artX, artY, artSize, artSize, 18);
      ctx.stroke();
      setTimeout(() => fs.remove(tmpArt).catch(() => {}), 10000);
    } catch { drawPlaceholder(ctx, artX, artY, artSize); }
  } else {
    drawPlaceholder(ctx, artX, artY, artSize);
  }

  const nick = getNickname().toUpperCase();
  ctx.font = "bold 12px Arial"; ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.textAlign = "right"; ctx.fillText(nick, W - 18, 20);
  ctx.font = "20px Arial"; ctx.fillStyle = "rgba(255,80,80,0.75)";
  ctx.fillText("♪", W - 48, 36);

  const tx = artX + artSize + 36, maxW = W - tx - 24;
  ctx.textAlign = "left";

  ctx.font = "bold 13px Arial"; ctx.fillStyle = "#FF3C3C";
  ctx.fillText("° NOW PLAYING", tx, artY + 22);

  const title = track.name || track.title || "Unknown";
  const fontSize = title.length > 22 ? 28 : title.length > 16 ? 34 : 40;
  ctx.font = `bold ${fontSize}px Arial`; ctx.fillStyle = "#FFFFFF";
  ctx.fillText(clipText(ctx, title, maxW), tx, artY + 64);

  ctx.font = "bold 19px Arial"; ctx.fillStyle = "#FF3C3C";
  ctx.fillText(clipText(ctx, (track.artist || track.artists || "Unknown").toUpperCase(), maxW), tx, artY + 94);

  const albumLine = (track.album || track.collection || track._itunesData?.collectionName || "Unknown");
  ctx.font = "15px Arial"; ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.fillText(clipText(ctx, albumLine, maxW), tx, artY + 120);

  const dur = track.duration || (track._itunesData ? formatDur(track._itunesData.trackTimeMillis) : "N/A");
  ctx.font = "12px Arial"; ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillText(`⏱ ${dur}`, tx, artY + 144);

  const barY = artY + artSize - 26, barW = maxW, barH = 5;
  const progress = 0.2 + Math.random() * 0.5;
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  roundedRect(ctx, tx, barY, barW, barH, 3); ctx.fill();
  ctx.fillStyle = "#FF3C3C";
  roundedRect(ctx, tx, barY, Math.max(barW * progress, 10), barH, 3); ctx.fill();
  const dotX = tx + barW * progress;
  ctx.fillStyle = "#FFFFFF"; ctx.beginPath();
  ctx.arc(dotX, barY + barH / 2, 7, 0, Math.PI * 2); ctx.fill();

  const outPath = path.join(cacheDir, `spotify_card_${Date.now()}.png`);
  await fs.writeFile(outPath, canvas.toBuffer("image/png"));
  return outPath;
}

function drawPlaceholder(ctx, x, y, size) {
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  roundedRect(ctx, x, y, size, size, 18); ctx.fill();
  ctx.font = "64px Arial"; ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.textAlign = "center";
  ctx.fillText("♫", x + size / 2, y + size / 2 + 22);
  ctx.textAlign = "left";
}

async function buildReply(track, cacheDir, index, total) {
  const bodyText = `📌 Result ${index + 1}/${total}\n💬 Reply 'next' → Next song\n⬇️ Reply 'download' → Get MP3`;

  if (createCanvas) {
    try {
      const imgPath = await generateCanvas(track, cacheDir);
      return { imgPath, bodyText };
    } catch (e) {
      console.error("[CANVAS ERROR]", e.message);
    }
  }

  const artUrl = track.cover || track.artwork || track.thumbnail ||
    (track._itunesData?.artworkUrl100 || "").replace("100x100bb", "600x600bb");
  let imgPath = null;
  if (artUrl) {
    try {
      const imgBuf = await axios.get(artUrl, { responseType: "arraybuffer" });
      imgPath = path.join(cacheDir, `spotify_art_${Date.now()}.jpg`);
      await fs.writeFile(imgPath, Buffer.from(imgBuf.data));
    } catch {}
  }

  const title = track.name || track.title || "Unknown";
  const artist = track.artist || track.artists || "Unknown";
  const dur = track.duration || (track._itunesData ? formatDur(track._itunesData.trackTimeMillis) : "N/A");
  const album = track.album || track.collection || (track._itunesData?.collectionName) || "N/A";

  const fallbackText =
    `° NOW PLAYING\n🎵 ${title}\n🔴 ${artist.toUpperCase()}\n💿 ${album}\n⏱ ${dur}\n━━━━━━━━━━━━━━━━━━\n${bodyText}`;

  return { imgPath, bodyText: imgPath ? bodyText : fallbackText };
}
