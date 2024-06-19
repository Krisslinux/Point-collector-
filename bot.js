const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
require('dotenv').config(); // Load environment variables from .env file

// Get the bot token and MongoDB URI from environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;
const mongoUri = process.env.MONGODB_URI;

const bot = new TelegramBot(token, { polling: true });

// Connect to MongoDB
mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('Failed to connect to MongoDB', err);
});

// Define a schema and model for user points
const userSchema = new mongoose.Schema({
    userId: {
        type: Number,
        required: true,
        unique: true
    },
    username: String,
    points: {
        type: Number,
        default: 0
    }
});

const User = mongoose.model('User', userSchema);

// Function to check if a user is an admin
const isAdmin = async (chatId, userId) => {
    try {
        const member = await bot.getChatMember(chatId, userId);
        return ['administrator', 'creator'].includes(member.status);
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
};

// Command: Start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const startMessage = `
Welcome to the Points Bot! Here are the available commands:

/addpoints <user_id> <points> - Add points to a user (admin only)
/checkpoints <user_id> - Check points for a user
/leaderboard - Display the top users by points
    `;
    bot.sendMessage(chatId, startMessage);
});

// Command: Add points
bot.onText(/\/addpoints (\d+) (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const fromUserId = msg.from.id;
    const userId = parseInt(match[1]);
    const points = parseInt(match[2]);

    if (await isAdmin(chatId, fromUserId)) {
        let user = await User.findOne({ userId });

        if (!user) {
            user = new User({
                userId,
                username: msg.from.username,
                points: 0
            });
        }

        user.points += points;
        await user.save();

        bot.sendMessage(chatId, `Added ${points} points to user with ID ${userId}. Total points: ${user.points}`);
    } else {
        bot.sendMessage(chatId, 'You must be an admin to use this command.');
    }
});

// Command: Check points
bot.onText(/\/checkpoints (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = parseInt(match[1]);

    const user = await User.findOne({ userId });

    if (!user) {
        bot.sendMessage(chatId, `User with ID ${userId} not found.`);
    } else {
        bot.sendMessage(chatId, `User with ID ${userId} has ${user.points} points.`);
    }
});

// Command: Leaderboard
bot.onText(/\/leaderboard/, async (msg) => {
    const chatId = msg.chat.id;
    const users = await User.find().sort({ points: -1 }).limit(10);

    if (users.length === 0) {
        bot.sendMessage(chatId, 'Leaderboard is empty.');
    } else {
        let leaderboard = '🏆 Leaderboard 🏆\n';
        users.forEach((user, index) => {
            leaderboard += `${index + 1}. ${user.username} - ${user.points} points\n`;
        });
        bot.sendMessage(chatId, leaderboard);
    }
});

// Catch-all for other messages
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    console.log(msg);
});
         
