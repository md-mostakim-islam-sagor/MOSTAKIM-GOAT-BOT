const moment = require('moment-timezone');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

module.exports.config = {
  name: 'autotime',
        author: "MOSTAKIM",
  version: '14.0.0',
  hasPermssion: 0,
  credits: 'MOSTAKIM',
  description: 'Stylish Auto Time & Date Sender',
  category: 'system',
  commandCategory: 'system',
  usages: '[]',
  cooldowns: 3
};

function getTimeMessage() {
  const now = moment().tz("Asia/Dhaka");
  const time = now.format("hh:mm A");
  const date = now.format("DD MMMM YYYY");
  const day  = now.format("dddd");

  return `✦••┈┈┈  𝗧𝗜𝗠𝗘  ┈┈┈••✦

✰ 𝗧𝗜𝗠𝗘 ➪ ${time}
✰ 𝗗𝗔𝗧𝗘 ➪ ${date}
✰ 𝗗𝗔𝗬 ➪ ${day}

✦••★ ! 𝐌𝐎𝐒𝐓𝐀𝐊𝐈𝐌 𝐆𝐎𝐀𝐓 𝐁𝐎𝐓 ! ★••✦`;
}

module.exports.onLoad = async ({ api }) => {
  console.log(chalk.bold.green("====== STYLISH AUTO TIME SYSTEM LOADED ======"));

  let lastSentHour = -1;

  setInterval(() => {
    const now = moment().tz("Asia/Dhaka");
    const currentHour = parseInt(now.format("HH"));
    const currentMin  = parseInt(now.format("mm"));

    if (currentMin <= 2 && currentHour !== lastSentHour) {
      lastSentHour = currentHour;

      const msg = getTimeMessage();

      const folder = path.join(__dirname, "MOSTAKIM");
      const supported = [".png", ".jpg", ".jpeg", ".gif", ".mp4", ".webp"];
      let filePath = null;

      if (fs.existsSync(folder)) {
        const files = fs.readdirSync(folder).filter(f =>
          supported.includes(path.extname(f).toLowerCase())
        );
        if (files.length > 0) {
          const randomFile = files[Math.floor(Math.random() * files.length)];
          filePath = path.join(folder, randomFile);
        }
      }

      const threadIDs = global.data?.allThreadID
        || (global.db?.allThreadData || []).map(t => t.threadID).filter(Boolean);
      if (!threadIDs || threadIDs.length === 0) return;
      threadIDs.forEach(threadID => {
        const messageData = { body: msg };
        if (filePath) messageData.attachment = fs.createReadStream(filePath);
        api.sendMessage(messageData, threadID);
      });
    }

  }, 30 * 1000);
};

module.exports.onStart = async ({ api, event }) => {};