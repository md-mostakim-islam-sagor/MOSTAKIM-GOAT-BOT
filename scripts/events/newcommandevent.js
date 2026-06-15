module.exports = {
  config: {
    name: "newcommandevent",
    version: "1.0",
    author: "MOSTAKIM",
    category: "events"
  },

  langs: {
    en: {
      hiReply: "👋 Hello {name}!\nI'm {botName}.\nType {prefix}help to see all commands.",
      helloReply: "Hi {name}! 😊 Need help? Type {prefix}help"
    }
  },

  onStart: async function ({ api, event, message, usersData, getLang }) {
    if (event.type !== "message") return;
    if (!event.body) return;

    const body = event.body.trim().toLowerCase();
    if (body.length > 20) return;

    const hiTriggers = ["hi", "hello", "helo", "hii", "hiii", "hay", "hey"];
    const botTriggers = ["bot", "hi bot", "hello bot", "hey bot", "hey goat", "goat bot", "goatbot"];

    const isHi = hiTriggers.includes(body);
    const isBot = botTriggers.includes(body);

    if (!isHi && !isBot) return;

    const threadID = event.threadID;
    const prefix = global.utils.getPrefix(threadID);
    const botName = global.GoatBot?.config?.nickNameBot || "MOSTAKIM GOAT BOT";

    let senderName = "friend";
    try {
      const userData = await usersData.get(event.senderID);
      senderName = userData?.name || "friend";
    } catch {}

    const msg = isHi
      ? getLang("hiReply")
          .replace("{name}", senderName)
          .replace("{botName}", botName)
          .replace("{prefix}", prefix)
      : getLang("helloReply")
          .replace("{name}", senderName)
          .replace("{prefix}", prefix);

    message.reply(msg);
  }
};
