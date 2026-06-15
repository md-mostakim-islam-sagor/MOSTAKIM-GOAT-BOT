// web/status.js
// Place this file in your bot's web/ folder
// Then in your main bot file add: require("./web/status")(app);

const os   = require("os");
const path = require("path");
const fs   = require("fs");

module.exports = function (app) {

  // ── Read config.json once ──
  let cfg = {};
  try {
    const cfgPath = path.join(__dirname, "../../../config.json");
    cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  } catch (e) {}

  // ── Bot start time (real process start) ──
  const BOT_START_MS = Date.now() - Math.floor(process.uptime() * 1000);

  app.get("/status", (req, res) => {

    // ── UPTIME — same logic as uptime.js ──
    const uptime   = process.uptime(); // seconds (real)
    const days     = Math.floor(uptime / 86400);
    const hours    = Math.floor((uptime % 86400) / 3600);
    const minutes  = Math.floor((uptime % 3600) / 60);
    const seconds  = Math.floor(uptime % 60);
    const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;

    // ── RAM — same logic as uptime.js ──
    const totalMem = os.totalmem();
    const freeMem  = os.freemem();
    const usedMem  = totalMem - freeMem;
    const usedGB   = (usedMem / 1024 / 1024 / 1024).toFixed(2);
    const totalGB  = (totalMem / 1024 / 1024 / 1024).toFixed(2);
    const ramPct   = ((usedMem / totalMem) * 100).toFixed(1);

    // ── CPU — same logic as uptime.js ──
    const cpus = os.cpus();
    let totalIdle = 0, totalTick = 0;
    cpus.forEach(cpu => {
      for (const type in cpu.times) totalTick += cpu.times[type];
      totalIdle += cpu.times.idle;
    });
    const cpuPct = ((1 - totalIdle / totalTick) * 100).toFixed(2);

    // ── Bot name from config.json → nickNameBot ──
    const botName = (cfg.nickNameBot || "GOAT BOT")
      .replace(/[^\x20-\x7E]/g, "").trim() || "MOSTAKIM GOAT BOT";

    // ── Owner — first adminBot ID (you can map ID→name here) ──
    const adminIds  = cfg.adminBot || [];
    const ownerName = cfg.ownerName || "MOSTAKIM"; // add "ownerName" to config.json, or hardcode

    // ── Ping ──
    const ping = Date.now() - (req.headers["x-request-time"]
      ? parseInt(req.headers["x-request-time"])
      : Date.now());

    res.json({
      // Bot info — from config.json
      botName:        botName,
      ownerName:      ownerName,
      adminIds:       adminIds,
      prefix:         cfg.prefix        || ".",
      language:       (cfg.language     || "en").toUpperCase(),
      timeZone:       cfg.timeZone      || "Asia/Dhaka",
      database:       cfg.database?.type?.toUpperCase() || "SQLITE",
      dashPort:       cfg.dashBoard?.port || 5000,

      // System info — from process + os (same as uptime.js)
      uptime_seconds: Math.floor(uptime),
      uptimeStr:      uptimeStr,
      botStartMs:     BOT_START_MS,
      node:           process.version,
      platform:       `${os.platform()} (${os.arch()})`,
      hostname:       os.hostname(),
      cores:          cpus.length,
      ping:           Math.abs(ping) < 5000 ? Math.abs(ping) : 1,

      // Resources — from os (same as uptime.js)
      ram: {
        used:    usedGB,
        total:   totalGB,
        percent: ramPct
      },
      cpu_percent: cpuPct
    });
  });

};