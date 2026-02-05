const { Expo } = require('expo-server-sdk');

// Create a new Expo SDK client
let expo = new Expo();

const sendPushNotification = async (pushTokens, title, body, data = {}, imageUrl = null) => {
    // Filter out invalid tokens
    let messages = [];
    for (let pushToken of pushTokens) {
        if (!Expo.isExpoPushToken(pushToken)) {
            console.error(`Push token ${pushToken} is not a valid Expo push token`);
            continue;
        }

        messages.push({
            to: pushToken,
            sound: 'default',
            title: title || 'Dorm Notification',
            body: body,
            data: { ...data, imageUrl },
            image: imageUrl, // Supported by Android
            mutableContent: !!imageUrl, // Requirement for iOS image attachments
        });
    }

    let chunks = expo.chunkPushNotifications(messages);
    let tickets = [];

    (async () => {
        for (let chunk of chunks) {
            try {
                let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                console.error('Error sending push chunk:', error);
            }
        }
    })();

    // Ideally, we should check receipts later to remove invalid tokens
};

module.exports = { sendPushNotification };
