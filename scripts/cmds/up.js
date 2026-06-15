const os = require("os");
const path = require("path");
const fs = require("fs");
const { createCanvas, loadImage } = require("canvas");

process.stderr.clearLine = process.stderr.clearLine || function () {};
process.stdout.clearLine = process.stdout.clearLine || function () {};

module.exports = {
  config: {
    name: "uptime",
    aliases: ["runtime", "up"],
    version: "1.10",
    author: "MOSTAKIM",
    countDown: 5,
    role: 0,
    shortDescription: { en: "Check system uptime and status with image" },
    longDescription: { en: "Displays the system uptime, RAM usage, CPU load, and other server details on an image." },
    category: "SYSTEM",
    guide: { en: "{pn}" }
  },

  onStart: async function ({ api, event }) {
    const { threadID, messageID } = event;
    const cacheFolderPath = path.join(__dirname, "cache");
    if (!fs.existsSync(cacheFolderPath)) fs.mkdirSync(cacheFolderPath, { recursive: true });
    const imagePath = path.join(cacheFolderPath, `uptime_${Date.now()}.png`);

    try {
      api.setMessageReaction("📡", event.messageID, event.threadID, () => {}, true);

      const uptime  = process.uptime();
      const days    = Math.floor(uptime / 86400);
      const hours   = Math.floor((uptime % 86400) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);
      const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;

      const totalMem = os.totalmem();
      const freeMem  = os.freemem();
      const usedGB   = ((totalMem - freeMem) / 1024 ** 3).toFixed(2);
      const totalGB  = (totalMem / 1024 ** 3).toFixed(2);

      const cpus = os.cpus();
      let totalIdle = 0, totalTick = 0;
      cpus.forEach(cpu => {
        for (const type in cpu.times) totalTick += cpu.times[type];
        totalIdle += cpu.times.idle;
      });
      const avgCpuLoad = ((1 - totalIdle / totalTick) * 100).toFixed(2);

      const ping     = Date.now() - event.timestamp;
      const platform = `${os.platform()} (${os.arch()})`;
      const nodeVer  = process.version;
      const hostname = os.hostname();

      const info = [
        { label: "Uptime",   value: uptimeString },
        { label: "Ping",     value: `${ping} ms` },
        { label: "RAM",      value: `${usedGB} GB / ${totalGB} GB` },
        { label: "CPU Load", value: `${avgCpuLoad}%` },
        { label: "Platform", value: platform },
        { label: "Node.js",  value: nodeVer },
        { label: "Hostname", value: hostname }
      ];

      const W = 1280, H = 720;
      const canvas = createCanvas(W, H);
      const ctx    = canvas.getContext('2d');

      try {
        const bgImage = await loadImage('https://i.imgur.com/IoHRnHi.jpeg');
        ctx.drawImage(bgImage, 0, 0, W, H);
      } catch (_) {
        ctx.fillStyle = '#060e1c';
        ctx.fillRect(0, 0, W, H);
      }

      ctx.shadowBlur    = 0;
      ctx.shadowColor   = 'transparent';
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      const COL_LABEL = 130;
      const COL_COLON = 340;
      const COL_VALUE = 390;
      const ROW_START = 138;
      const ROW_GAP   = 72;

      const labelColors = [
        '#00eeff', '#00ffcc', '#55ddff',
        '#00ffaa', '#33ccff', '#aaeeff', '#00ccff'
      ];

      info.forEach((item, i) => {
        const y = ROW_START + i * ROW_GAP;

        ctx.font      = 'bold 27px monospace';
        ctx.fillStyle = labelColors[i];
        ctx.textAlign = 'left';
        ctx.fillText(item.label, COL_LABEL, y);

        ctx.font      = '27px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.textAlign = 'center';
        ctx.fillText(':', COL_COLON, y);

        ctx.font      = '27px monospace';
        ctx.fillStyle = '#dff8ff';
        ctx.textAlign = 'left';
        ctx.fillText(item.value, COL_VALUE, y);

        ctx.strokeStyle = 'rgba(0, 190, 255, 0.18)';
        ctx.lineWidth   = 1;
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.moveTo(COL_LABEL, y + 15);
        ctx.lineTo(820, y + 15);
        ctx.stroke();
        ctx.setLineDash([]);
      });


      const out = fs.createWriteStream(imagePath);
      canvas.createPNGStream().pipe(out);

      out.on('finish', () => {
        api.setMessageReaction("✅", event.messageID, event.threadID, () => {}, true);
        api.sendMessage(
          { attachment: fs.createReadStream(imagePath) },
          threadID,
          (err) => {
            if (!err) fs.unlink(imagePath, () => {});
            else if (fs.existsSync(imagePath)) fs.unlink(imagePath, () => {});
          },
          messageID
        );
      });

    } catch (error) {
      api.setMessageReaction("❌", event.messageID, event.threadID, () => {}, true);
      api.sendMessage(`❌ Error: ${error.message}`, threadID, null, messageID);
      if (fs.existsSync(imagePath)) fs.unlink(imagePath, () => {});
    }
  }
};