const schedule = require("node-schedule");
const moment = require("moment-timezone");
const chalk = require("chalk");

module.exports.config = {
  name: "autosent",
        author: "MOSTAKIM",
  version: "27.0.0",
  hasPermssion: 1,
  credits: "MOSTAKIM",
  description: "Auto Time with ON/OFF",
  category: "system",
  commandCategory: "system",
  usages: "[on/off]",
  cooldowns: 3
};

// ===== MESSAGE =====
async function getMessage(api, threadID) {
  const now = moment().tz("Asia/Dhaka");

  let botName = "BOT";

  try {
    const info = await api.getThreadInfo(threadID);
    const botID = api.getCurrentUserID();
    botName = info.nicknames?.[botID] || global.GoatBot?.config?.nickNameBot || "BOT";
  } catch {}

  return `
╔═══════════════════════╗
   ⏰ 𝗧𝗜𝗠𝗘 𝗨𝗣𝗗𝗔𝗧𝗘
╚═══════════════════════╝

┃ 🕒 𝗧𝗶𝗺𝗲 : ${now.format("hh:mm A")}
┃ 📅 𝗗𝗮𝘁𝗲 : ${now.format("DD MMM YYYY")}
┃ 📌 𝗗𝗮𝘆  : ${now.format("dddd")}

╔═══════════════════════╗
   🤖 𝗕𝗢𝗧 : ${botName}
╚═══════════════════════╝
`;
}

// ===== SEND =====
async function scheduleSend(api, threadsData) {
  const threads = await threadsData.getAll();

  for (const thread of threads) {
    try {
      if (!thread.data.autosent) continue; // ❌ OFF হলে skip

      const threadID = thread.threadID;
      const msg = await getMessage(api, threadID);

      await api.sendMessage(msg, threadID);
      await new Promise(r => setTimeout(r, 500));
    } catch {}
  }
}

// ===== COMMAND =====
module.exports.onStart = async function ({ message, event, args, threadsData }) {
  const { threadID } = event;

  if (!args[0]) {
    return message.reply("Use:\n/autosent on\n/autosent off");
  }

  if (args[0] == "on") {
    await threadsData.set(threadID, {
      data: { autosent: true }
    });
    return message.reply("✅ Auto time update ON");
  }

  if (args[0] == "off") {
    await threadsData.set(threadID, {
      data: { autosent: false }
    });
    return message.reply("❌ Auto time update OFF");
  }
};

// ===== ONLOAD =====
module.exports.onLoad = ({ api, threadsData }) => {
  console.log(chalk.green("✅ AUTO TIME WITH CONTROL STARTED"));

  setTimeout(() => {
    schedule.scheduleJob("*/30 * * * *", async () => {
      await scheduleSend(api, threadsData);
    });
  }, 10000);
};