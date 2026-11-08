module.exports = {
  config: {
    name: "fork",
    version: "2.0",
    author: "Saan",
    countDown: 5,
    role: 0,
    shortDescription: "Show github repository link ",
    category: "utility",
    guide: {
      en: "{p}fork"
    }
  },

  langs: {
    en: {
      current: `🌑 𝐒𝐀𝐀𝐍 𝐄𝐗𝐇𝐀𝐔𝐒𝐓𝐄𝐃 𝐁𝐎𝐓 🌑
━━━━━━━━━━━━━━━━━━━━
👤 𝐎𝐰𝐧𝐞𝐫 : 𝐒𝐈𝐀𝐌 𝐀𝐇𝐌𝐄𝐃 𝐒𝐀𝐀𝐍
🔗 𝐑𝐞𝐩𝐨   : %1
💎 𝐒𝐭𝐚𝐭𝐮𝐬 : 𝐀𝐥𝐰𝐚𝐲𝐬 𝐔𝐩𝐝𝐚𝐭𝐢𝐧𝐠
━━━━━━━━━━━━━━━━━━━━
⭐ 𝐅𝐨𝐫𝐤 • 𝐒𝐭𝐚𝐫 • 𝐄𝐧𝐣𝐨𝐲 ⭐`
    }
  },

  onStart: async function ({ message, getLang }) {
    const link = "https://github.com/7383739393837636363/Enyo-Stfu/";
    return message.reply(getLang("current", link));
  },

  onChat: async function ({ message, getLang, event }) {
    if (event.body && event.body.toLowerCase() === "fork") {
      const link = "https://github.com/7383739393837636363/Enyo-Stfu/";
      return message.reply(getLang("current", link));
    }
  }
};
