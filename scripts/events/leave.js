const { getTime, drive } = global.utils;

module.exports = {
	config: {
		name: "leave",
		version: "1.5",
		author: "MOSTAKIM",
		category: "events"
	},

	langs: {
		en: {
			session1: "morning",
			session2: "noon",
			session3: "afternoon",
			session4: "evening",
			leaveType1: "left",
			leaveType2: "was kicked from",
			defaultLeaveMessage: "{userName} {type} the group"
		}
	},

	onStart: async ({ threadsData, message, event, api, usersData, getLang }) => {
		if (event.logMessageType == "log:unsubscribe")
			return async function () {

				const { threadID } = event;
				const threadData = await threadsData.get(threadID);

				if (!threadData.settings.sendLeaveMessage)
					return;

				const { leftParticipantFbId } = event.logMessageData;

				// bot leave ignore
				if (leftParticipantFbId == api.getCurrentUserID())
					return;

				const hours = getTime("HH");

				const threadName = threadData.threadName;
				const userName = await usersData.getName(leftParticipantFbId);

				let { leaveMessage = getLang("defaultLeaveMessage") } = threadData.data;

				leaveMessage = leaveMessage
					.replace(/\{userName\}|\{userNameTag\}/g, userName)
					.replace(/\{type\}/g,
						leftParticipantFbId == event.author
							? getLang("leaveType1")
							: getLang("leaveType2")
					)
					.replace(/\{threadName\}|\{boxName\}/g, threadName)
					.replace(/\{time\}/g, hours)
					.replace(/\{session\}/g,
						hours <= 10 ? getLang("session1") :
						hours <= 12 ? getLang("session2") :
						hours <= 18 ? getLang("session3") :
						getLang("session4")
					);

				// 🔥 SHARE CONTACT INSTEAD OF NORMAL MESSAGE
				const messageText = leaveMessage;
				const leftID = leftParticipantFbId;

				api.shareContact(messageText, leftID, threadID, (err, info) => {
					if (err) return console.log(err);

					// ⏳ Auto unsend after 20 sec
					setTimeout(() => {
						api.unsendMessage(info.messageID);
					}, 20000);
				});

			};
	}
};