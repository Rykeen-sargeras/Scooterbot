const Discord = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');

const client = new Discord.Client({
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMembers,
        Discord.GatewayIntentBits.DirectMessages,
        Discord.GatewayIntentBits.MessageContent,
        Discord.GatewayIntentBits.GuildMessages,
    ],
    partials: [Discord.Partials.Channel, Discord.Partials.Message]
});

// Configuration - Set these in Railway environment variables
const CONFIG = {
    MAIN_CHAT_CHANNEL_ID: process.env.MAIN_CHAT_CHANNEL_ID || '',
    ANNOUNCEMENT_CHANNEL_ID: process.env.ANNOUNCEMENT_CHANNEL_ID || '',
    MOD_CHANNEL_ID: process.env.MOD_CHANNEL_ID || '',
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID || '',
    TICKET_CATEGORY_ID: process.env.TICKET_CATEGORY_ID || '',
    STAFF_ROLE_IDS: (process.env.STAFF_ROLE_IDS || '').split(',').filter(Boolean),
    WEB_DASHBOARD_PASSWORD: process.env.WEB_DASHBOARD_PASSWORD || 'admin123', // Set a secure password!
    ALT_DETECTION_ENABLED: process.env.ALT_DETECTION_ENABLED !== 'false', // Default enabled
    ALT_ACCOUNT_AGE_DAYS: parseInt(process.env.ALT_ACCOUNT_AGE_DAYS || '7'), // Flag accounts newer than 7 days
    PATROL_CHANNEL_ID: '1486376733413347358', // Self-promo channel with 16hr cooldown
};

// Patrol channel tracking
const patrolCooldowns = new Map(); // userId -> lastPostTimestamp
const PATROL_COOLDOWN = 16 * 60 * 60 * 1000; // 16 hours in milliseconds

// Fun features state
let triviaEnabled = false;
let triviaInterval = null;
let currentTrivia = null;
const triviaScores = new Map(); // userId -> score

// Birthday system
const birthdays = new Map(); // userId -> { month: 1-12, day: 1-31, username: string }
let birthdayCheckInterval = null;

// Message tracking for vibe check
const recentMessages = []; // { timestamp, userId, content, sentiment }
const MAX_MESSAGE_HISTORY = 1000;

// Trivia questions database (250 questions)
const triviaQuestions = [
    // General Knowledge (50)
    { question: "What year was Discord founded?", answer: "2015", category: "Discord" },
    { question: "What is the capital of Japan?", answer: "Tokyo", category: "Geography" },
    { question: "How many players are on a soccer team?", answer: "11", category: "Sports" },
    { question: "What is the largest planet in our solar system?", answer: "Jupiter", category: "Science" },
    { question: "Who painted the Mona Lisa?", answer: "Leonardo da Vinci", category: "Art" },
    { question: "What is the smallest country in the world?", answer: "Vatican City", category: "Geography" },
    { question: "In what year did World War II end?", answer: "1945", category: "History" },
    { question: "What is the speed of light in km/s?", answer: "300000", category: "Science" },
    { question: "What is the most popular programming language in 2024?", answer: "Python", category: "Tech" },
    { question: "How many continents are there?", answer: "7", category: "Geography" },
    { question: "What is the chemical symbol for gold?", answer: "Au", category: "Science" },
    { question: "Who wrote Romeo and Juliet?", answer: "Shakespeare", category: "Literature" },
    { question: "What is the tallest mountain in the world?", answer: "Mount Everest", category: "Geography" },
    { question: "How many bones are in the human body?", answer: "206", category: "Science" },
    { question: "What is the largest ocean on Earth?", answer: "Pacific", category: "Geography" },
    { question: "In what year was the first iPhone released?", answer: "2007", category: "Tech" },
    { question: "What planet is known as the Red Planet?", answer: "Mars", category: "Science" },
    { question: "How many strings does a guitar typically have?", answer: "6", category: "Music" },
    { question: "What is the hardest natural substance on Earth?", answer: "Diamond", category: "Science" },
    { question: "Who was the first person to walk on the moon?", answer: "Neil Armstrong", category: "History" },
    { question: "What is the capital of France?", answer: "Paris", category: "Geography" },
    { question: "How many sides does a hexagon have?", answer: "6", category: "Math" },
    { question: "What is the largest mammal on Earth?", answer: "Blue Whale", category: "Animals" },
    { question: "In what year did the Titanic sink?", answer: "1912", category: "History" },
    { question: "What is the boiling point of water in Celsius?", answer: "100", category: "Science" },
    { question: "Who invented the telephone?", answer: "Alexander Graham Bell", category: "History" },
    { question: "What is the capital of Australia?", answer: "Canberra", category: "Geography" },
    { question: "How many days are in a leap year?", answer: "366", category: "General" },
    { question: "What is the chemical symbol for water?", answer: "H2O", category: "Science" },
    { question: "Who wrote Harry Potter?", answer: "J.K. Rowling", category: "Literature" },
    { question: "What is the smallest planet in our solar system?", answer: "Mercury", category: "Science" },
    { question: "How many keys are on a standard piano?", answer: "88", category: "Music" },
    { question: "What is the longest river in the world?", answer: "Nile", category: "Geography" },
    { question: "In what year did humans first land on the moon?", answer: "1969", category: "History" },
    { question: "What is the freezing point of water in Fahrenheit?", answer: "32", category: "Science" },
    { question: "Who painted the Sistine Chapel?", answer: "Michelangelo", category: "Art" },
    { question: "What is the capital of Canada?", answer: "Ottawa", category: "Geography" },
    { question: "How many hours are in a week?", answer: "168", category: "Math" },
    { question: "What gas do plants absorb from the atmosphere?", answer: "Carbon Dioxide", category: "Science" },
    { question: "Who discovered penicillin?", answer: "Alexander Fleming", category: "Science" },
    { question: "What is the largest desert in the world?", answer: "Sahara", category: "Geography" },
    { question: "How many Olympic rings are there?", answer: "5", category: "Sports" },
    { question: "What is the capital of Italy?", answer: "Rome", category: "Geography" },
    { question: "In what year did World War I begin?", answer: "1914", category: "History" },
    { question: "What is the fastest land animal?", answer: "Cheetah", category: "Animals" },
    { question: "Who invented the light bulb?", answer: "Thomas Edison", category: "History" },
    { question: "What is the largest country by area?", answer: "Russia", category: "Geography" },
    { question: "How many teeth does an adult human have?", answer: "32", category: "Science" },
    { question: "What is the chemical symbol for oxygen?", answer: "O", category: "Science" },
    { question: "Who was the first President of the United States?", answer: "George Washington", category: "History" },
    
    // Pop Culture & Entertainment (50)
    { question: "What year did Minecraft release?", answer: "2011", category: "Gaming" },
    { question: "Who created SpongeBob SquarePants?", answer: "Stephen Hillenburg", category: "TV" },
    { question: "What is Mario's brother's name?", answer: "Luigi", category: "Gaming" },
    { question: "What movie won Best Picture in 2020?", answer: "Parasite", category: "Movies" },
    { question: "How many Infinity Stones are there?", answer: "6", category: "Marvel" },
    { question: "What is the highest-grossing film of all time?", answer: "Avatar", category: "Movies" },
    { question: "Who voices Woody in Toy Story?", answer: "Tom Hanks", category: "Movies" },
    { question: "What year did Fortnite release?", answer: "2017", category: "Gaming" },
    { question: "What is the name of Iron Man?", answer: "Tony Stark", category: "Marvel" },
    { question: "How many Harry Potter books are there?", answer: "7", category: "Literature" },
    { question: "What is the longest-running animated TV show?", answer: "The Simpsons", category: "TV" },
    { question: "Who directed Jurassic Park?", answer: "Steven Spielberg", category: "Movies" },
    { question: "What game is Pikachu from?", answer: "Pokemon", category: "Gaming" },
    { question: "How many Dragon Balls are there?", answer: "7", category: "Anime" },
    { question: "What is Batman's real name?", answer: "Bruce Wayne", category: "DC" },
    { question: "Who created The Simpsons?", answer: "Matt Groening", category: "TV" },
    { question: "What year did YouTube launch?", answer: "2005", category: "Tech" },
    { question: "How many Star Wars movies are there?", answer: "9", category: "Movies" },
    { question: "What is the name of Thor's hammer?", answer: "Mjolnir", category: "Marvel" },
    { question: "Who is the main character in The Legend of Zelda?", answer: "Link", category: "Gaming" },
    { question: "What streaming service created Stranger Things?", answer: "Netflix", category: "TV" },
    { question: "How many seasons of Breaking Bad are there?", answer: "5", category: "TV" },
    { question: "What is Superman's weakness?", answer: "Kryptonite", category: "DC" },
    { question: "Who directed The Dark Knight?", answer: "Christopher Nolan", category: "Movies" },
    { question: "What year did Roblox release?", answer: "2006", category: "Gaming" },
    { question: "How many Avengers movies are there?", answer: "4", category: "Marvel" },
    { question: "What is the name of the dog in The Simpsons?", answer: "Santa's Little Helper", category: "TV" },
    { question: "Who voices Elsa in Frozen?", answer: "Idina Menzel", category: "Movies" },
    { question: "What game features Steve as the main character?", answer: "Minecraft", category: "Gaming" },
    { question: "How many seasons of Game of Thrones are there?", answer: "8", category: "TV" },
    { question: "What is the name of Harry Potter's owl?", answer: "Hedwig", category: "Literature" },
    { question: "Who created Marvel Comics?", answer: "Stan Lee", category: "Marvel" },
    { question: "What year did Among Us release?", answer: "2018", category: "Gaming" },
    { question: "How many Lord of the Rings movies are there?", answer: "3", category: "Movies" },
    { question: "What is the Flash's real name?", answer: "Barry Allen", category: "DC" },
    { question: "Who directed Avatar?", answer: "James Cameron", category: "Movies" },
    { question: "What game series features Master Chief?", answer: "Halo", category: "Gaming" },
    { question: "How many episodes of Friends are there?", answer: "236", category: "TV" },
    { question: "What is Spider-Man's real name?", answer: "Peter Parker", category: "Marvel" },
    { question: "Who wrote The Hunger Games?", answer: "Suzanne Collins", category: "Literature" },
    { question: "What year did TikTok launch?", answer: "2016", category: "Tech" },
    { question: "How many seasons of The Office US are there?", answer: "9", category: "TV" },
    { question: "What is Wonder Woman's real name?", answer: "Diana Prince", category: "DC" },
    { question: "Who directed Inception?", answer: "Christopher Nolan", category: "Movies" },
    { question: "What game features the Victory Royale?", answer: "Fortnite", category: "Gaming" },
    { question: "How many seasons of Stranger Things are there?", answer: "4", category: "TV" },
    { question: "What is the name of the main character in Naruto?", answer: "Naruto Uzumaki", category: "Anime" },
    { question: "Who created Rick and Morty?", answer: "Justin Roiland", category: "TV" },
    { question: "What year did Instagram launch?", answer: "2010", category: "Tech" },
    { question: "How many Batman movies did Christopher Nolan direct?", answer: "3", category: "Movies" },
    
    // Science & Nature (50)
    { question: "What is the powerhouse of the cell?", answer: "Mitochondria", category: "Biology" },
    { question: "How many planets are in our solar system?", answer: "8", category: "Space" },
    { question: "What is the largest organ in the human body?", answer: "Skin", category: "Biology" },
    { question: "What gas do humans breathe out?", answer: "Carbon Dioxide", category: "Science" },
    { question: "How many elements are on the periodic table?", answer: "118", category: "Chemistry" },
    { question: "What is the closest star to Earth?", answer: "Sun", category: "Space" },
    { question: "How many chambers does the human heart have?", answer: "4", category: "Biology" },
    { question: "What is the chemical formula for salt?", answer: "NaCl", category: "Chemistry" },
    { question: "What planet is closest to the Sun?", answer: "Mercury", category: "Space" },
    { question: "How many legs does a spider have?", answer: "8", category: "Animals" },
    { question: "What is the study of earthquakes called?", answer: "Seismology", category: "Science" },
    { question: "How long does it take for light from the Sun to reach Earth?", answer: "8", category: "Space" },
    { question: "What is the smallest bone in the human body?", answer: "Stapes", category: "Biology" },
    { question: "What is the chemical symbol for sodium?", answer: "Na", category: "Chemistry" },
    { question: "How many moons does Mars have?", answer: "2", category: "Space" },
    { question: "What is the largest bird in the world?", answer: "Ostrich", category: "Animals" },
    { question: "What is the study of plants called?", answer: "Botany", category: "Science" },
    { question: "How many hearts does an octopus have?", answer: "3", category: "Animals" },
    { question: "What is the most abundant gas in Earth's atmosphere?", answer: "Nitrogen", category: "Science" },
    { question: "What planet has the most moons?", answer: "Saturn", category: "Space" },
    { question: "How many lungs do humans have?", answer: "2", category: "Biology" },
    { question: "What is the chemical symbol for carbon?", answer: "C", category: "Chemistry" },
    { question: "What is the largest star in our solar system?", answer: "Sun", category: "Space" },
    { question: "How many wings does a bee have?", answer: "4", category: "Animals" },
    { question: "What is the study of weather called?", answer: "Meteorology", category: "Science" },
    { question: "How many teeth do sharks regrow throughout life?", answer: "Unlimited", category: "Animals" },
    { question: "What is the pH of pure water?", answer: "7", category: "Chemistry" },
    { question: "What planet is known for its rings?", answer: "Saturn", category: "Space" },
    { question: "How many pairs of ribs do humans have?", answer: "12", category: "Biology" },
    { question: "What is the chemical formula for carbon dioxide?", answer: "CO2", category: "Chemistry" },
    { question: "How many Earths could fit inside the Sun?", answer: "1000000", category: "Space" },
    { question: "What is the fastest fish in the ocean?", answer: "Sailfish", category: "Animals" },
    { question: "What is the study of fungi called?", answer: "Mycology", category: "Science" },
    { question: "How many arms does a starfish have?", answer: "5", category: "Animals" },
    { question: "What is the most common element in the universe?", answer: "Hydrogen", category: "Science" },
    { question: "What is the hottest planet in our solar system?", answer: "Venus", category: "Space" },
    { question: "How many chromosomes do humans have?", answer: "46", category: "Biology" },
    { question: "What is the chemical symbol for iron?", answer: "Fe", category: "Chemistry" },
    { question: "How many light years away is the nearest star?", answer: "4", category: "Space" },
    { question: "What is the largest species of bear?", answer: "Polar Bear", category: "Animals" },
    { question: "What is the study of rocks called?", answer: "Geology", category: "Science" },
    { question: "How many legs does a lobster have?", answer: "10", category: "Animals" },
    { question: "What is the atomic number of hydrogen?", answer: "1", category: "Chemistry" },
    { question: "What galaxy is Earth in?", answer: "Milky Way", category: "Space" },
    { question: "How many vertebrae are in the human spine?", answer: "33", category: "Biology" },
    { question: "What is the rarest blood type?", answer: "AB Negative", category: "Biology" },
    { question: "How many legs does a centipede have?", answer: "100", category: "Animals" },
    { question: "What is the study of insects called?", answer: "Entomology", category: "Science" },
    { question: "What is the largest land animal?", answer: "African Elephant", category: "Animals" },
    { question: "How many moons does Jupiter have?", answer: "79", category: "Space" },
    
    // Technology & Internet (50)
    { question: "Who founded Microsoft?", answer: "Bill Gates", category: "Tech" },
    { question: "What does CPU stand for?", answer: "Central Processing Unit", category: "Tech" },
    { question: "Who founded Apple?", answer: "Steve Jobs", category: "Tech" },
    { question: "What year was Google founded?", answer: "1998", category: "Tech" },
    { question: "What does HTML stand for?", answer: "Hypertext Markup Language", category: "Tech" },
    { question: "Who founded Facebook?", answer: "Mark Zuckerberg", category: "Tech" },
    { question: "What does RAM stand for?", answer: "Random Access Memory", category: "Tech" },
    { question: "Who founded Amazon?", answer: "Jeff Bezos", category: "Tech" },
    { question: "What year was Twitter founded?", answer: "2006", category: "Tech" },
    { question: "What does USB stand for?", answer: "Universal Serial Bus", category: "Tech" },
    { question: "Who founded Tesla?", answer: "Elon Musk", category: "Tech" },
    { question: "What does Wi-Fi stand for?", answer: "Wireless Fidelity", category: "Tech" },
    { question: "Who created Linux?", answer: "Linus Torvalds", category: "Tech" },
    { question: "What year was Wikipedia founded?", answer: "2001", category: "Tech" },
    { question: "What does URL stand for?", answer: "Uniform Resource Locator", category: "Tech" },
    { question: "Who founded PayPal?", answer: "Elon Musk", category: "Tech" },
    { question: "What does GPU stand for?", answer: "Graphics Processing Unit", category: "Tech" },
    { question: "Who invented the World Wide Web?", answer: "Tim Berners-Lee", category: "Tech" },
    { question: "What year was Netflix founded?", answer: "1997", category: "Tech" },
    { question: "What does DNS stand for?", answer: "Domain Name System", category: "Tech" },
    { question: "Who founded Spotify?", answer: "Daniel Ek", category: "Tech" },
    { question: "What does SSD stand for?", answer: "Solid State Drive", category: "Tech" },
    { question: "Who created Python programming language?", answer: "Guido van Rossum", category: "Tech" },
    { question: "What year was Snapchat founded?", answer: "2011", category: "Tech" },
    { question: "What does VPN stand for?", answer: "Virtual Private Network", category: "Tech" },
    { question: "Who founded Reddit?", answer: "Steve Huffman", category: "Tech" },
    { question: "What does API stand for?", answer: "Application Programming Interface", category: "Tech" },
    { question: "Who created Java programming language?", answer: "James Gosling", category: "Tech" },
    { question: "What year was WhatsApp founded?", answer: "2009", category: "Tech" },
    { question: "What does ISP stand for?", answer: "Internet Service Provider", category: "Tech" },
    { question: "Who founded Uber?", answer: "Travis Kalanick", category: "Tech" },
    { question: "What does OS stand for?", answer: "Operating System", category: "Tech" },
    { question: "Who created the C programming language?", answer: "Dennis Ritchie", category: "Tech" },
    { question: "What year was Twitch founded?", answer: "2011", category: "Tech" },
    { question: "What does LAN stand for?", answer: "Local Area Network", category: "Tech" },
    { question: "Who founded Airbnb?", answer: "Brian Chesky", category: "Tech" },
    { question: "What does HTTP stand for?", answer: "Hypertext Transfer Protocol", category: "Tech" },
    { question: "Who created JavaScript?", answer: "Brendan Eich", category: "Tech" },
    { question: "What year was Slack founded?", answer: "2013", category: "Tech" },
    { question: "What does FPS stand for in gaming?", answer: "Frames Per Second", category: "Gaming" },
    { question: "Who founded Nvidia?", answer: "Jensen Huang", category: "Tech" },
    { question: "What does BIOS stand for?", answer: "Basic Input Output System", category: "Tech" },
    { question: "Who created Rust programming language?", answer: "Graydon Hoare", category: "Tech" },
    { question: "What year was Discord founded?", answer: "2015", category: "Tech" },
    { question: "What does SQL stand for?", answer: "Structured Query Language", category: "Tech" },
    { question: "Who founded Adobe?", answer: "John Warnock", category: "Tech" },
    { question: "What does AI stand for?", answer: "Artificial Intelligence", category: "Tech" },
    { question: "Who created Ruby programming language?", answer: "Yukihiro Matsumoto", category: "Tech" },
    { question: "What year was Zoom founded?", answer: "2011", category: "Tech" },
    { question: "What does IoT stand for?", answer: "Internet of Things", category: "Tech" },
    
    // Sports & Games (50)
    { question: "How many points is a touchdown worth?", answer: "6", category: "Sports" },
    { question: "How many players on a basketball team?", answer: "5", category: "Sports" },
    { question: "What sport is played at Wimbledon?", answer: "Tennis", category: "Sports" },
    { question: "How many holes are on a golf course?", answer: "18", category: "Sports" },
    { question: "How many innings in a baseball game?", answer: "9", category: "Sports" },
    { question: "What country hosted the 2016 Olympics?", answer: "Brazil", category: "Sports" },
    { question: "How many players on a hockey team?", answer: "6", category: "Sports" },
    { question: "Who has won the most Super Bowls?", answer: "Tom Brady", category: "Sports" },
    { question: "How many points is a 3-pointer in basketball?", answer: "3", category: "Sports" },
    { question: "What sport uses a shuttlecock?", answer: "Badminton", category: "Sports" },
    { question: "How many Grand Slams are in tennis?", answer: "4", category: "Sports" },
    { question: "What country won the 2018 World Cup?", answer: "France", category: "Sports" },
    { question: "How many periods in a hockey game?", answer: "3", category: "Sports" },
    { question: "Who holds the home run record?", answer: "Barry Bonds", category: "Sports" },
    { question: "How many points is a field goal in football?", answer: "3", category: "Sports" },
    { question: "What sport is played in the NBA?", answer: "Basketball", category: "Sports" },
    { question: "How many bases in baseball?", answer: "4", category: "Sports" },
    { question: "What country hosted the 2020 Olympics?", answer: "Japan", category: "Sports" },
    { question: "How many quarters in a football game?", answer: "4", category: "Sports" },
    { question: "Who has won the most NBA championships?", answer: "Bill Russell", category: "Sports" },
    { question: "How many strikes for a strikeout?", answer: "3", category: "Sports" },
    { question: "What sport is played in the NHL?", answer: "Hockey", category: "Sports" },
    { question: "How many yards is a football field?", answer: "100", category: "Sports" },
    { question: "What country hosted the 2014 World Cup?", answer: "Brazil", category: "Sports" },
    { question: "How many players on a volleyball team?", answer: "6", category: "Sports" },
    { question: "Who is the fastest man in the world?", answer: "Usain Bolt", category: "Sports" },
    { question: "How many sets in a tennis match?", answer: "3", category: "Sports" },
    { question: "What sport is played in the NFL?", answer: "Football", category: "Sports" },
    { question: "How many outs in an inning?", answer: "3", category: "Sports" },
    { question: "What country has won the most World Cups?", answer: "Brazil", category: "Sports" },
    { question: "How many points for a safety in football?", answer: "2", category: "Sports" },
    { question: "What sport is played in the MLB?", answer: "Baseball", category: "Sports" },
    { question: "How many fouls before fouling out in NBA?", answer: "6", category: "Sports" },
    { question: "What sport uses a puck?", answer: "Hockey", category: "Sports" },
    { question: "How many yards for a first down?", answer: "10", category: "Sports" },
    { question: "Who has the most Olympic gold medals?", answer: "Michael Phelps", category: "Sports" },
    { question: "How many players on a rugby team?", answer: "15", category: "Sports" },
    { question: "What sport is played at Augusta National?", answer: "Golf", category: "Sports" },
    { question: "How many pins in bowling?", answer: "10", category: "Sports" },
    { question: "What country hosted the first Olympics?", answer: "Greece", category: "Sports" },
    { question: "How many timeouts per half in NBA?", answer: "7", category: "Sports" },
    { question: "What sport uses a net and racket?", answer: "Tennis", category: "Sports" },
    { question: "How many players in a cricket team?", answer: "11", category: "Sports" },
    { question: "Who has the most Tour de France wins?", answer: "Lance Armstrong", category: "Sports" },
    { question: "How many rounds in a boxing match?", answer: "12", category: "Sports" },
    { question: "What sport is played at the Masters?", answer: "Golf", category: "Sports" },
    { question: "How many games in a set of tennis?", answer: "6", category: "Sports" },
    { question: "Who has the most career points in NBA?", answer: "LeBron James", category: "Sports" },
    { question: "How many arrows in archery round?", answer: "72", category: "Sports" },
    { question: "What sport uses a pommel horse?", answer: "Gymnastics", category: "Sports" },
];

// Store user states for interactive commands and tickets
const userStates = new Map();

// Audit log system
const auditLog = [];
const MAX_AUDIT_LOGS = 500; // Keep last 500 events

function addAuditLog(action, user, details, severity = 'info') {
    const logEntry = {
        timestamp: new Date().toISOString(),
        action,
        user: user ? `${user.tag} (${user.id})` : 'System',
        details,
        severity // info, warning, error, success
    };
    
    auditLog.unshift(logEntry); // Add to beginning
    
    // Keep only last MAX_AUDIT_LOGS entries
    if (auditLog.length > MAX_AUDIT_LOGS) {
        auditLog.pop();
    }
    
    console.log(`[AUDIT ${severity.toUpperCase()}] ${action} by ${logEntry.user}: ${details}`);
}


client.on('ready', () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    console.log(`📊 Dashboard available at: http://localhost:10000`);
    addAuditLog('Bot Started', client.user, `Bot logged in as ${client.user.tag}`, 'success');
    
    // Start birthday checking (every minute)
    setInterval(checkBirthdays, 60000);
    checkBirthdays(); // Check immediately on startup
    
    startKeepAliveServer();
});

// Alt account detection on member join
client.on('guildMemberAdd', async (member) => {
    if (!CONFIG.ALT_DETECTION_ENABLED) return;
    
    try {
        const accountAge = Date.now() - member.user.createdTimestamp;
        const accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));
        
        // Check if account is suspiciously new
        if (accountAgeDays < CONFIG.ALT_ACCOUNT_AGE_DAYS) {
            const modChannel = await client.channels.fetch(CONFIG.MOD_CHANNEL_ID);
            if (modChannel) {
                const embed = new Discord.EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('⚠️ Potential Alt Account Detected')
                    .setThumbnail(member.user.displayAvatarURL())
                    .addFields(
                        { name: 'User', value: `${member.user.tag} (${member.user.id})`, inline: true },
                        { name: 'Account Age', value: `${accountAgeDays} days old`, inline: true },
                        { name: 'Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                        { name: 'Joined', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                        { name: 'Default Avatar', value: member.user.avatar ? 'No' : '**Yes** ⚠️', inline: true },
                        { name: 'Status', value: '🔍 Review recommended', inline: true }
                    )
                    .setFooter({ text: 'Alt Detection System' })
                    .setTimestamp();
                
                await modChannel.send({ embeds: [embed] });
                addAuditLog('Alt Account Detected', member.user, `Account age: ${accountAgeDays} days`, 'warning');
            }
        }
        
        addAuditLog('Member Joined', member.user, `Account age: ${accountAgeDays} days`, 'info');
    } catch (error) {
        console.error('Error in alt detection:', error);
    }
});

// ======================
// YOUTUBE STREAM ALERTS
// ======================


// ======================
// MESSAGE MONITORING (Address Detection)
// ======================

client.on('messageCreate', async (message) => {
    // Ignore bots and DMs for address detection
    if (message.author.bot) return;
    if (!message.guild) {
        // Handle DM Ticket System
        await handleDMTicket(message);
        return;
    }
    
    
    // Patrol channel enforcement (16hr cooldown + link filtering)
    if (message.channel.id === CONFIG.PATROL_CHANNEL_ID) {
        const patrolResult = await enforcePatrolRules(message);
        if (patrolResult.violated) {
            return; // Stop processing if rules violated
        }
    }
    
    // Track message for vibe check (only in main chat)
    if (message.channel.id === CONFIG.MAIN_CHAT_CHANNEL_ID) {
        recentMessages.push({
            timestamp: Date.now(),
            userId: message.author.id,
            content: message.content
        });
        
        // Keep only last 1000 messages
        if (recentMessages.length > MAX_MESSAGE_HISTORY) {
            recentMessages.shift();
        }
    }
    
    // Trivia answer checking
    if (currentTrivia && message.channel.id === CONFIG.MAIN_CHAT_CHANNEL_ID) {
        const userAnswer = message.content.trim().toLowerCase();
        const correctAnswer = currentTrivia.answer.toLowerCase();
        
        if (userAnswer === correctAnswer || userAnswer.includes(correctAnswer)) {
            // Correct answer!
            const userId = message.author.id;
            const currentScore = triviaScores.get(userId) || 0;
            triviaScores.set(userId, currentScore + 100);
            
            const embed = new Discord.EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🎉 Correct Answer!')
                .setDescription(`${message.author} got it right!\n\n**Answer:** ${currentTrivia.answer}\n**Points:** +100 (Total: ${currentScore + 100})`)
                .setTimestamp();
            
            await message.channel.send({ embeds: [embed] });
            addAuditLog('Trivia Answered', message.author, `Correct answer! New score: ${currentScore + 100}`, 'success');
            currentTrivia = null;
            return;
        }
    }
    
    // Check if user is staff
    const isStaff = message.member.roles.cache.some(role => CONFIG.STAFF_ROLE_IDS.includes(role.id));
    
    // Address detection for non-staff only
    if (!isStaff) {
        const addressDetected = detectAddress(message.content);
        if (addressDetected) {
            await handleAddressDetection(message, addressDetected);
            return;
        }
    }
    
    // Commands (work in server channels)
    if (message.content.startsWith('!')) {
        const args = message.content.slice(1).trim().split(/ +/);
        const command = args[0].toLowerCase();
        
        // Public commands (everyone can use)
        if (command === 'birthday') {
            await handleBirthdayCommand(message);
            return;
        }
        
        if (command === 'vibecheck') {
            await performVibeCheck(message);
            return;
        }
        
        // Staff-only commands
        await handleStaffCommands(message);
    }
});

// Patrol channel enforcement
async function enforcePatrolRules(message) {
    // Staff are exempt from patrol rules
    const isStaff = message.member.roles.cache.some(role => CONFIG.STAFF_ROLE_IDS.includes(role.id));
    if (isStaff) {
        return { violated: false };
    }
    
    const now = Date.now();
    const userId = message.author.id;
    const lastPost = patrolCooldowns.get(userId);
    
    // Check cooldown (16 hours)
    if (lastPost) {
        const timeSince = now - lastPost;
        const timeRemaining = PATROL_COOLDOWN - timeSince;
        
        if (timeRemaining > 0) {
            // Still on cooldown
            const hoursRemaining = Math.floor(timeRemaining / (60 * 60 * 1000));
            const minutesRemaining = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
            
            try {
                await message.delete();
                
                const warningMsg = await message.channel.send(
                    `${message.author} ⚠️ **Cooldown Active!**\n\n` +
                    `You can only post once every **16 hours** in this channel.\n` +
                    `Time remaining: **${hoursRemaining}h ${minutesRemaining}m**\n\n` +
                    `*Your message has been removed.*`
                );
                
                // Delete warning after 10 seconds
                setTimeout(() => {
                    warningMsg.delete().catch(() => {});
                }, 10000);
                
                addAuditLog('Patrol Violation', message.author, `Cooldown violation - ${hoursRemaining}h ${minutesRemaining}m remaining`, 'warning');
                
            } catch (error) {
                console.error('Error enforcing patrol cooldown:', error);
            }
            
            return { violated: true };
        }
    }
    
    // Check for valid links (YouTube, Twitch, Kick.com only)
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = message.content.match(urlRegex);
    
    if (urls && urls.length > 0) {
        const allowedDomains = [
            'youtube.com',
            'youtu.be',
            'twitch.tv',
            'kick.com',
            'www.youtube.com',
            'www.twitch.tv',
            'www.kick.com'
        ];
        
        let hasInvalidLink = false;
        
        for (const url of urls) {
            const isAllowed = allowedDomains.some(domain => url.toLowerCase().includes(domain));
            if (!isAllowed) {
                hasInvalidLink = true;
                break;
            }
        }
        
        if (hasInvalidLink) {
            try {
                await message.delete();
                
                const warningMsg = await message.channel.send(
                    `${message.author} ⚠️ **Invalid Link!**\n\n` +
                    `Only **YouTube**, **Twitch**, and **Kick.com** links are allowed in this channel.\n\n` +
                    `*Your message has been removed.*`
                );
                
                // Delete warning after 10 seconds
                setTimeout(() => {
                    warningMsg.delete().catch(() => {});
                }, 10000);
                
                addAuditLog('Patrol Violation', message.author, `Invalid link posted`, 'warning');
                
            } catch (error) {
                console.error('Error enforcing patrol links:', error);
            }
            
            return { violated: true };
        }
    }
    
    // All checks passed - update cooldown
    patrolCooldowns.set(userId, now);
    addAuditLog('Patrol Post', message.author, `Post allowed in patrol channel`, 'info');
    
    return { violated: false };
}

// Address detection patterns - VERY strict to avoid false positives
const ADDRESS_PATTERNS = [
    // Full US street address (number + street name + street type + optional city/state/zip)
    /\b\d{1,5}\s+[\w\s]{3,30}(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|pl)\b[\s,]+[\w\s]+,?\s+(?:[A-Z]{2}|\w{4,})\s*\d{5}/i,
    
    // Address with apartment/unit AND street name
    /\b(?:apartment|apt|unit|suite|ste)\s*#?\d+[,\s]+\d{1,5}\s+[\w\s]{3,}(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)\b/i,
    
    // UK full address with postcode
    /\b\d{1,5}\s+[\w\s]{3,30}(?:street|road|lane|avenue|drive|way|close|court)\b.*\b[A-Z]{1,2}\d{1,2}[A-Z]?\s+\d[A-Z]{2}\b/i,
    
    // Australian address (street + suburb + state + postcode)
    /\b\d{1,5}\s+[\w\s]{3,30}(?:street|road|avenue|drive|st|rd|ave|dr)\b[\s,]+[\w\s]{3,20}[\s,]+(?:NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\s+\d{4}\b/i,
];

function detectAddress(text) {
    // Ignore if message is too short (likely not a real address)
    if (text.length < 20) return null;
    
    // Ignore if message contains whitelisted phrases (context that indicates not a real address)
    const whitelistPhrases = [
        'example', 'test', 'fake', 'sample', 'lorem ipsum',
        'http', 'https', 'www.', '.com', '.net', '.org',
        'discord.gg', 'youtube.com', 'twitter.com',
        'price', 'cost', '$', '€', '£', 'buy', 'sell',
        'code', 'error', 'line', 'function',
        'minute', 'hour', 'second', 'day', 'week', 'month', 'year',
        'until', 'in', 'ago', 'time', 'timer', 'clock',
        'stream', 'video', 'live', 'watch', 'tonight', 'today', 'tomorrow'
    ];
    
    const lowerText = text.toLowerCase();
    for (const phrase of whitelistPhrases) {
        if (lowerText.includes(phrase)) return null;
    }
    
    // Check patterns
    for (const pattern of ADDRESS_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            // Extra validation: make sure it looks like a real address
            const matchText = match[0];
            
            // Ignore if it's just numbers with no context
            if (/^\d+$/.test(matchText.trim())) return null;
            
            // Must contain multiple address components (not just street name)
            const hasNumber = /\d{1,5}/.test(matchText);
            const hasStreet = /(?:street|avenue|road|boulevard|lane|drive|st|ave|rd|blvd|ln|dr)/.test(matchText.toLowerCase());
            const hasCityOrZip = /(?:[A-Z]{2}\s+\d{5}|,\s*[A-Z][a-z]+)/.test(matchText);
            
            // Require all three components for a valid address
            if (!hasNumber || !hasStreet || !hasCityOrZip) return null;
            
            return matchText;
        }
    }
    return null;
}

async function handleAddressDetection(message, address) {
    try {
        console.log(`🚨 Address detected from ${message.author.tag} in #${message.channel.name}`);
        console.log(`MOD_CHANNEL_ID configured: ${CONFIG.MOD_CHANNEL_ID || 'NOT SET'}`);
        
        // Delete the message
        await message.delete();
        console.log('✅ Message deleted');
        
        // Timeout user for 12 hours
        await message.member.timeout(12 * 60 * 60 * 1000, 'Posted address in chat');
        console.log('✅ User timed out');
        
        // Add audit log entry
        addAuditLog(
            'Address Detected',
            message.author,
            `Detected in #${message.channel.name}: ${address.substring(0, 50)}... - User timed out 12hrs`,
            'warning'
        );
        
        // Alert mod channel
        if (!CONFIG.MOD_CHANNEL_ID) {
            console.error('❌ MOD_CHANNEL_ID not configured! Cannot send alert.');
            return;
        }
        
        try {
            const modChannel = await client.channels.fetch(CONFIG.MOD_CHANNEL_ID);
            console.log(`✅ Mod channel fetched: ${modChannel.name}`);
            
            const embed = new Discord.EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🚨 Address Detected and Removed')
                .addFields(
                    { name: 'User', value: `${message.author.tag} (${message.author.id})` },
                    { name: 'Channel', value: `<#${message.channelId}>` },
                    { name: 'Detected Address', value: `||${address}||` },
                    { name: 'Action Taken', value: 'Message deleted, user timed out for 12 hours' }
                )
                .setTimestamp();
            
            await modChannel.send({ embeds: [embed] });
            console.log('✅ Alert sent to mod channel');
        } catch (modError) {
            console.error('❌ Error sending to mod channel:', modError.message);
            console.error('Check that MOD_CHANNEL_ID is correct and bot has permissions');
        }
        
        // DM user
        try {
            await message.author.send('⚠️ Your message was removed for containing what appears to be a physical address. For your safety, please do not share personal information in public channels. You have been timed out for 12 hours.');
            console.log('✅ DM sent to user');
        } catch (e) {
            console.log('⚠️ Could not DM user about address detection');
        }
    } catch (error) {
        console.error('❌ Error handling address detection:', error);
    }
}

// ======================
// DM TICKET SYSTEM
// ======================

async function handleDMTicket(message) {
    const userId = message.author.id;
    const userState = userStates.get(userId);
    
    // Initial DM - show menu
    if (!userState) {
        const embed = new Discord.EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎫 Support Ticket System')
            .setDescription('Please select the type of ticket you want to create:')
            .addFields(
                { name: '💻 Tech Support', value: 'Type `tech` for technical issues or help' },
                { name: '🚨 Report', value: 'Type `report` to report a user or issue' }
            );
        
        await message.reply({ embeds: [embed] });
        
        userStates.set(userId, { step: 'ticket_type' });
        return;
    }
    
    // Handle ticket type selection
    if (userState.step === 'ticket_type') {
        const type = message.content.toLowerCase().trim();
        
        if (type === 'tech') {
            userState.ticketType = 'tech';
            userState.step = 'tech_description';
            await message.reply('📝 Please describe your technical issue in detail:');
        } else if (type === 'report') {
            userState.ticketType = 'report';
            userState.step = 'report_who';
            await message.reply('👤 Who are you reporting? (Username, ID, or @mention)');
        } else {
            await message.reply('❌ Invalid option. Please type `tech` or `report`');
        }
        return;
    }
    
    // Tech ticket flow
    if (userState.step === 'tech_description') {
        userState.description = message.content;
        await createTechTicket(message.author, userState);
        userStates.delete(userId);
        return;
    }
    
    // Report ticket flow
    if (userState.step === 'report_who') {
        userState.reportWho = message.content;
        userState.step = 'report_what';
        await message.reply('📄 What happened? Please describe the incident:');
        return;
    }
    
    if (userState.step === 'report_what') {
        userState.reportWhat = message.content;
        userState.step = 'report_proof';
        await message.reply('📸 Please provide proof (screenshots, message links, etc.):');
        return;
    }
    
    if (userState.step === 'report_proof') {
        userState.reportProof = message.content;
        await createReportTicket(message.author, userState);
        userStates.delete(userId);
        return;
    }
}

async function createTechTicket(user, state) {
    const guild = client.guilds.cache.first(); // Get the first guild
    if (!guild) return;
    
    const ticketNumber = Math.floor(Math.random() * 9999);
    const channelName = `tech-${ticketNumber}`;
    
    try {
        const channel = await guild.channels.create({
            name: channelName,
            type: Discord.ChannelType.GuildText,
            parent: CONFIG.TICKET_CATEGORY_ID || null,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [Discord.PermissionFlagsBits.ViewChannel],
                },
                {
                    id: user.id,
                    allow: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages],
                },
                ...CONFIG.STAFF_ROLE_IDS.map(roleId => ({
                    id: roleId,
                    allow: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages],
                })),
            ],
        });
        
        addAuditLog('Ticket Created', { tag: user.tag, id: user.id }, `Tech ticket #${ticketNumber} - ${state.description.substring(0, 50)}...`, 'info');
        
        const embed = new Discord.EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('💻 Tech Support Ticket')
            .addFields(
                { name: 'User', value: `${user.tag}` },
                { name: 'Issue Description', value: state.description }
            )
            .setFooter({ text: 'Staff: use !close to archive and close this ticket' })
            .setTimestamp();
        
        await channel.send({ content: `${user} - Support staff will assist you shortly!`, embeds: [embed] });
        
        await user.send(`✅ Your tech support ticket has been created: <#${channel.id}>`);
    } catch (error) {
        console.error('Error creating tech ticket:', error);
        await user.send('❌ There was an error creating your ticket. Please contact a staff member directly.');
    }
}

async function createReportTicket(user, state) {
    const guild = client.guilds.cache.first();
    if (!guild) return;
    
    const ticketNumber = Math.floor(Math.random() * 9999);
    const channelName = `report-${ticketNumber}`;
    
    try {
        const channel = await guild.channels.create({
            name: channelName,
            type: Discord.ChannelType.GuildText,
            parent: CONFIG.TICKET_CATEGORY_ID || null,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [Discord.PermissionFlagsBits.ViewChannel],
                },
                {
                    id: user.id,
                    allow: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages],
                },
                ...CONFIG.STAFF_ROLE_IDS.map(roleId => ({
                    id: roleId,
                    allow: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages],
                })),
            ],
        });
        
        const embed = new Discord.EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🚨 User Report')
            .addFields(
                { name: 'Reported By', value: `${user.tag}` },
                { name: 'Who', value: state.reportWho },
                { name: 'What Happened', value: state.reportWhat },
                { name: 'Proof', value: state.reportProof }
            )
            .setFooter({ text: 'Moderators: use !close to archive and close this ticket' })
            .setTimestamp();
        
        await channel.send({ content: `${user} - Moderators will review your report.`, embeds: [embed] });
        
        await user.send(`✅ Your report ticket has been created: <#${channel.id}>`);
    } catch (error) {
        console.error('Error creating report ticket:', error);
        await user.send('❌ There was an error creating your report. Please contact a moderator directly.');
    }
}

// ======================
// STAFF COMMANDS
// ======================

async function handleStaffCommands(message) {
    const isStaff = message.member.roles.cache.some(role => CONFIG.STAFF_ROLE_IDS.includes(role.id));
    if (!isStaff && !message.member.permissions.has(Discord.PermissionFlagsBits.Administrator)) return;
    
    const args = message.content.slice(1).trim().split(/ +/);
    const command = args[0].toLowerCase();
    
    if (command === 'config') {
        const configEmbed = new Discord.EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('⚙️ Bot Configuration Status')
            .addFields(
                { name: 'YouTube API Key', value: CONFIG.YOUTUBE_API_KEY ? '✅ Set' : '❌ Not set' },
                { name: 'YouTube Channel ID', value: CONFIG.YOUTUBE_CHANNEL_ID ? '✅ Set' : '❌ Not set' },
                { name: 'Main Chat Channel', value: CONFIG.MAIN_CHAT_CHANNEL_ID ? `✅ <#${CONFIG.MAIN_CHAT_CHANNEL_ID}>` : '❌ Not set' },
                { name: 'Announcement Channel', value: CONFIG.ANNOUNCEMENT_CHANNEL_ID ? `✅ <#${CONFIG.ANNOUNCEMENT_CHANNEL_ID}>` : '❌ Not set' },
                { name: 'Mod Channel', value: CONFIG.MOD_CHANNEL_ID ? `✅ <#${CONFIG.MOD_CHANNEL_ID}>` : '❌ Not set' },
                { name: 'Log Channel', value: CONFIG.LOG_CHANNEL_ID ? `✅ <#${CONFIG.LOG_CHANNEL_ID}>` : '❌ Not set' },
                { name: 'Ticket Category', value: CONFIG.TICKET_CATEGORY_ID ? '✅ Set' : '❌ Not set' },
                { name: 'Staff Role IDs', value: CONFIG.STAFF_ROLE_IDS.length > 0 ? `✅ ${CONFIG.STAFF_ROLE_IDS.length} role(s)` : '❌ Not set' }
            );
        await message.reply({ embeds: [configEmbed] });
        return;
    }
    
    
    if (command === 'close') {
        // Check if this is a ticket channel
        if (message.channel.name.startsWith('tech-') || message.channel.name.startsWith('report-')) {
            await closeTicket(message.channel);
        } else {
            await message.reply('❌ This command only works in ticket channels.');
        }
    }
    
    // Trivia commands
    if (command === 'trivia') {
        const subcommand = args[1]?.toLowerCase();
        
        if (subcommand === 'on') {
            if (triviaEnabled) {
                await message.reply('⚠️ Trivia is already enabled!');
                return;
            }
            triviaEnabled = true;
            startTriviaSystem();
            await message.reply('✅ Trivia system enabled! Questions will be posted every 25 minutes.');
            addAuditLog('Trivia Enabled', message.author, 'Trivia system started', 'success');
            
        } else if (subcommand === 'off') {
            if (!triviaEnabled) {
                await message.reply('⚠️ Trivia is already disabled!');
                return;
            }
            triviaEnabled = false;
            if (triviaInterval) {
                clearInterval(triviaInterval);
                triviaInterval = null;
            }
            currentTrivia = null;
            await message.reply('✅ Trivia system disabled.');
            addAuditLog('Trivia Disabled', message.author, 'Trivia system stopped', 'info');
            
        } else if (subcommand === 'scores') {
            if (triviaScores.size === 0) {
                await message.reply('📊 No trivia scores yet!');
                return;
            }
            
            const sortedScores = Array.from(triviaScores.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);
            
            const embed = new Discord.EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🏆 Trivia Leaderboard')
                .setDescription(
                    sortedScores.map((entry, index) => {
                        const userId = entry[0];
                        const score = entry[1];
                        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                        return `${medal} <@${userId}> - **${score}** points`;
                    }).join('\n')
                )
                .setTimestamp();
            
            await message.reply({ embeds: [embed] });
            
        } else if (subcommand === 'now') {
            await postTriviaQuestion();
            
        } else {
            await message.reply('**Trivia Commands:**\n`!trivia on` - Enable trivia\n`!trivia off` - Disable trivia\n`!trivia scores` - View leaderboard\n`!trivia now` - Post question now');
        }
        return;
    }
    
    // Mimic commands
    if (command === 'mimic') {
        const subcommand = args[1]?.toLowerCase();
        
        if (subcommand === 'on') {
            const userId = args[2]; // User ID or mention
            if (!userId) {
                await message.reply('❌ Usage: `!mimic on <user_id>` or `!mimic on @user`');
                return;
            }
            
            // Extract user ID from mention or use directly
            const targetId = userId.replace(/[<@!>]/g, '');
            
            try {
                const targetUser = await client.users.fetch(targetId);
                mimicEnabled = true;
                mimicTargetId = targetId;
                await message.reply(`🎭 **SECRET MODE ACTIVATED**\nMimicking: ${targetUser.tag}\n\n*This message will delete in 5 seconds...*`);
                addAuditLog('Mimic Enabled', message.author, `Mimicking ${targetUser.tag}`, 'warning');
                
                // Delete the command message and reply after 5 seconds
                setTimeout(async () => {
                    await message.delete().catch(() => {});
                }, 5000);
                
            } catch (error) {
                await message.reply('❌ Could not find that user!');
            }
            
        } else if (subcommand === 'off') {
            if (!mimicEnabled) {
                await message.reply('⚠️ Mimic is not active!');
                return;
            }
            
            const targetUser = await client.users.fetch(mimicTargetId);
            mimicEnabled = false;
            mimicTargetId = null;
            await message.reply(`✅ Mimic mode disabled. Stopped mimicking ${targetUser.tag}`);
            addAuditLog('Mimic Disabled', message.author, `Stopped mimicking ${targetUser.tag}`, 'info');
            
        } else {
            await message.reply('**Mimic Commands:**\n`!mimic on <user_id>` - Start mimicking a user\n`!mimic off` - Stop mimicking\n\n**Note:** Mimic is SECRET - the command message auto-deletes!');
        }
        return;
    }
    
    // Role management commands still work
    if (command === 'help') {
        await sendHelpMessage(message);
    }
    
    if (command === 'dashboard') {
        await generateDashboard(message);
    }
    
    if (command === 'role') {
        await startRoleSelection(message);
    }
    
    if (command === 'permission') {
        await handlePermissionCommand(message);
    }
}

// Birthday command handler - AVAILABLE TO EVERYONE
async function handleBirthdayCommand(message) {
    const args = message.content.slice(1).trim().split(/ +/);
    const input = args[1];
    
    if (!input) {
        // Show user's current birthday
        const userBirthday = birthdays.get(message.author.id);
        if (userBirthday) {
            await message.reply(`🎂 Your birthday is set to: **${userBirthday.month}/${userBirthday.day}**\n\nTo remove it, use: \`!birthday remove\``);
        } else {
            await message.reply(`🎂 You haven't set your birthday yet!\n\nUse: \`!birthday MM/DD\`\nExample: \`!birthday 12/25\``);
        }
        return;
    }
    
    if (input.toLowerCase() === 'remove') {
        birthdays.delete(message.author.id);
        await message.reply('🎂 Your birthday has been removed from the system.');
        addAuditLog('Birthday Removed', message.author, 'Birthday registration removed', 'info');
        return;
    }
    
    // Parse MM/DD format
    const parts = input.split('/');
    if (parts.length !== 2) {
        await message.reply('❌ Invalid format! Use: `!birthday MM/DD` (e.g., `!birthday 12/25`)');
        return;
    }
    
    const month = parseInt(parts[0]);
    const day = parseInt(parts[1]);
    
    // Validate
    if (month < 1 || month > 12 || day < 1 || day > 31) {
        await message.reply('❌ Invalid date! Month must be 1-12 and day must be 1-31.');
        return;
    }
    
    // Validate day for month
    const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day > daysInMonth[month - 1]) {
        await message.reply(`❌ Invalid day for month ${month}! Max day is ${daysInMonth[month - 1]}.`);
        return;
    }
    
    // Save birthday
    birthdays.set(message.author.id, {
        month,
        day,
        username: message.author.tag
    });
    
    await message.reply(`🎂 Birthday saved! I'll announce it on **${month}/${day}** at 8am and 8pm!`);
    addAuditLog('Birthday Set', message.author, `Birthday: ${month}/${day}`, 'success');
}

// Vibe check function - AVAILABLE TO EVERYONE
async function performVibeCheck(message) {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const twelveHoursAgo = now - (12 * 60 * 60 * 1000);
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
    
    const last1h = recentMessages.filter(m => m.timestamp > oneHourAgo);
    const last12h = recentMessages.filter(m => m.timestamp > twelveHoursAgo);
    const last24h = recentMessages.filter(m => m.timestamp > twentyFourHoursAgo);
    
    // Sentiment analysis (basic)
    function analyzeSentiment(messages) {
        if (messages.length === 0) return { positive: 0, negative: 0, neutral: 0, energy: 0 };
        
        const positive = ['lol', 'lmao', 'haha', 'gg', 'good', 'great', 'awesome', 'love', 'thanks', 'nice', 'poggers', 'pog', '😂', '🤣', '😄', '❤️', '💯', '🔥', '!', 'yes', 'yeah', 'yay'];
        const negative = ['bad', 'hate', 'stupid', 'dumb', 'wtf', 'bruh', 'cringe', 'rip', 'oof', 'sad', '😢', '😭', '💀', 'no', 'nah', 'nope', 'ugh'];
        
        let positiveCount = 0;
        let negativeCount = 0;
        let energyScore = 0;
        
        messages.forEach(msg => {
            const lower = msg.content.toLowerCase();
            
            // Check positive words
            positive.forEach(word => {
                if (lower.includes(word)) positiveCount++;
            });
            
            // Check negative words
            negative.forEach(word => {
                if (lower.includes(word)) negativeCount++;
            });
            
            // Energy from caps and punctuation
            const caps = (msg.content.match(/[A-Z]/g) || []).length;
            const exclamation = (msg.content.match(/!/g) || []).length;
            energyScore += caps + (exclamation * 2);
        });
        
        const total = positiveCount + negativeCount;
        return {
            positive: total > 0 ? Math.round((positiveCount / total) * 100) : 50,
            negative: total > 0 ? Math.round((negativeCount / total) * 100) : 50,
            neutral: total > 0 ? Math.round((1 - (positiveCount + negativeCount) / messages.length) * 100) : 0,
            energy: Math.min(100, Math.round((energyScore / messages.length) * 10))
        };
    }
    
    const vibe1h = analyzeSentiment(last1h);
    const vibe12h = analyzeSentiment(last12h);
    const vibe24h = analyzeSentiment(last24h);
    
    function getVibeEmoji(positive, negative, energy) {
        if (positive > 60 && energy > 50) return '🔥 HYPED';
        if (positive > 60) return '😊 POSITIVE';
        if (negative > 60) return '😤 SALTY';
        if (energy > 70) return '⚡ ENERGETIC';
        if (energy < 30) return '😴 CHILL';
        return '😐 NEUTRAL';
    }
    
    const embed = new Discord.EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('✨ Vibe Check')
        .setDescription('Current chat atmosphere analysis')
        .addFields(
            {
                name: '🕐 Last Hour',
                value: `${getVibeEmoji(vibe1h.positive, vibe1h.negative, vibe1h.energy)}\nPositive: ${vibe1h.positive}%\nNegative: ${vibe1h.negative}%\nEnergy: ${vibe1h.energy}%\nMessages: ${last1h.length}`,
                inline: true
            },
            {
                name: '🕛 Last 12 Hours',
                value: `${getVibeEmoji(vibe12h.positive, vibe12h.negative, vibe12h.energy)}\nPositive: ${vibe12h.positive}%\nNegative: ${vibe12h.negative}%\nEnergy: ${vibe12h.energy}%\nMessages: ${last12h.length}`,
                inline: true
            },
            {
                name: '📅 Last 24 Hours',
                value: `${getVibeEmoji(vibe24h.positive, vibe24h.negative, vibe24h.energy)}\nPositive: ${vibe24h.positive}%\nNegative: ${vibe24h.negative}%\nEnergy: ${vibe24h.energy}%\nMessages: ${last24h.length}`,
                inline: true
            }
        )
        .setFooter({ text: 'Vibe analysis based on message content and energy' })
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

// Birthday checking system
async function checkBirthdays() {
    if (!CONFIG.ANNOUNCEMENT_CHANNEL_ID) return;
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentMonth = now.getMonth() + 1; // 0-indexed
    const currentDay = now.getDate();
    
    // Only run at 8am (8:00) or 8pm (20:00)
    if ((currentHour === 8 || currentHour === 20) && currentMinute === 0) {
        // Find all birthdays today
        const birthdayPeople = [];
        
        for (const [userId, birthday] of birthdays.entries()) {
            if (birthday.month === currentMonth && birthday.day === currentDay) {
                birthdayPeople.push({ userId, username: birthday.username });
            }
        }
        
        if (birthdayPeople.length > 0) {
            try {
                const announcementChannel = await client.channels.fetch(CONFIG.ANNOUNCEMENT_CHANNEL_ID);
                
                // Create mentions list
                const mentions = birthdayPeople.map(p => `<@${p.userId}>`).join(', ');
                const names = birthdayPeople.map(p => p.username).join(', ');
                
                const embed = new Discord.EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('🎂 Happy Birthday! 🎉')
                    .setDescription(`Today's the special day for:\n\n${mentions}\n\nWishing you an amazing birthday! 🎈🎊`)
                    .setFooter({ text: `Birthday${birthdayPeople.length > 1 ? 's' : ''} on ${currentMonth}/${currentDay}` })
                    .setTimestamp();
                
                await announcementChannel.send({ content: mentions, embeds: [embed] });
                addAuditLog('Birthday Announced', { tag: 'System', id: 'system' }, `Birthday for: ${names}`, 'success');
                
            } catch (error) {
                console.error('Error announcing birthdays:', error);
            }
        }
    }
}

// Trivia System Functions
function startTriviaSystem() {
    // Clear any existing interval
    if (triviaInterval) {
        clearInterval(triviaInterval);
    }
    
    // Post first question immediately
    postTriviaQuestion();
    
    // Then post every 25 minutes
    triviaInterval = setInterval(() => {
        if (triviaEnabled) {
            postTriviaQuestion();
        }
    }, 25 * 60 * 1000); // 25 minutes
}

async function postTriviaQuestion() {
    if (!CONFIG.MAIN_CHAT_CHANNEL_ID) {
        console.log('Cannot post trivia: MAIN_CHAT_CHANNEL_ID not configured');
        return;
    }
    
    try {
        const mainChannel = await client.channels.fetch(CONFIG.MAIN_CHAT_CHANNEL_ID);
        
        // Select random question
        const randomIndex = Math.floor(Math.random() * triviaQuestions.length);
        currentTrivia = triviaQuestions[randomIndex];
        
        const embed = new Discord.EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🧠 Trivia Time!')
            .setDescription(`**Category:** ${currentTrivia.category}\n\n**Question:**\n${currentTrivia.question}`)
            .setFooter({ text: 'First correct answer wins 100 points!' })
            .setTimestamp();
        
        await mainChannel.send({ embeds: [embed] });
        addAuditLog('Trivia Posted', { tag: 'System', id: 'system' }, `Question: ${currentTrivia.question}`, 'info');
        
    } catch (error) {
        console.error('Error posting trivia:', error);
    }
}

async function closeTicket(channel) {
    try {
        // Fetch all messages to create transcript
        const messages = await channel.messages.fetch({ limit: 100 });
        const transcript = messages.reverse().map(msg => 
            `[${msg.createdAt.toISOString()}] ${msg.author.tag}: ${msg.content}`
        ).join('\n');
        
        // Send transcript to log channel
        const logChannel = await client.channels.fetch(CONFIG.LOG_CHANNEL_ID);
        if (logChannel) {
            const transcriptBuffer = Buffer.from(transcript, 'utf-8');
            const attachment = new Discord.AttachmentBuilder(transcriptBuffer, { name: `${channel.name}-transcript.txt` });
            
            const embed = new Discord.EmbedBuilder()
                .setColor('#FFA500')
                .setTitle(`🗃️ Ticket Closed: ${channel.name}`)
                .setDescription('Transcript attached below')
                .setTimestamp();
            
            await logChannel.send({ embeds: [embed], files: [attachment] });
        }
        
        await channel.send('🗃️ This ticket will be deleted in 5 seconds...');
        setTimeout(async () => {
            await channel.delete();
        }, 5000);
    } catch (error) {
        console.error('Error closing ticket:', error);
    }
}

// ======================
// ROLE MANAGEMENT (Original functionality)
// ======================

async function sendHelpMessage(message) {
    const embed = new Discord.EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🤖 Discord Bot Commands')
        .setDescription('Multi-function bot for role management, tickets, and stream alerts')
        .addFields(
            { name: '📊 Role Management', value: '`!dashboard` - Generate HTML permissions dashboard\n`!role` - Select role to manage\n`!permission` - Modify permissions' },
            { name: '🎫 Ticket System', value: 'DM the bot to create a ticket' },
            { name: '⚙️ Staff Commands', value: '`!config` - Check bot configuration\n`!checklive` - Check YouTube streams\n`!online` / `!offline` - Set bot status\n`!close` - Close ticket channel' }
        );

    await message.reply({ embeds: [embed] });
}

async function generateDashboard(message) {
    try {
        const guild = message.guild;
        if (!guild) {
            await message.reply('❌ This command must be used in a server!');
            return;
        }

        const data = await collectServerData(guild);
        const html = generateHTML(data);

        const filename = `dashboard_${guild.id}_${Date.now()}.html`;
        const outputDir = fs.existsSync('/mnt/user-data/outputs') ? '/mnt/user-data/outputs' : __dirname;
        const filepath = path.join(outputDir, filename);
        
        fs.writeFileSync(filepath, html);

        await message.reply({
            content: '✅ Dashboard generated!',
            files: [filepath]
        });
    } catch (error) {
        console.error(error);
        await message.reply('❌ Error generating dashboard: ' + error.message);
    }
}

async function startRoleSelection(message) {
    try {
        const guild = message.guild;
        if (!guild) return;

        const roles = guild.roles.cache
            .filter(role => role.id !== guild.id)
            .sort((a, b) => b.position - a.position)
            .map((role, index) => ({ index: index + 1, role }));

        let roleList = '**📋 Available Roles:**\n\n';
        roles.forEach(({ index, role }) => {
            roleList += `${index}. ${role.name} (${role.members.size} members)\n`;
        });
        roleList += '\n**Reply with the number of the role:**';

        await message.reply(roleList);

        const filter = m => m.author.id === message.author.id;
        const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
        
        if (collected.size === 0) {
            await message.reply('❌ Timed out.');
            return;
        }

        const roleIndex = parseInt(collected.first().content);
        if (isNaN(roleIndex) || roleIndex < 1 || roleIndex > roles.length) {
            await message.reply('❌ Invalid number.');
            return;
        }

        const selectedRole = roles[roleIndex - 1].role;
        userStates.set(message.author.id, { selectedRole, guild: guild.id });
        
        await message.reply(`✅ Selected role: **${selectedRole.name}**\n\nUse \`!permission\` to modify permissions.`);
    } catch (error) {
        console.error(error);
        await message.reply('❌ Error: ' + error.message);
    }
}

async function handlePermissionCommand(message) {
    const userState = userStates.get(message.author.id);
    if (!userState || !userState.selectedRole) {
        await message.reply('❌ Please select a role first using `!role`');
        return;
    }

    const role = message.guild.roles.cache.get(userState.selectedRole.id);
    if (!role) {
        await message.reply('❌ Role not found');
        return;
    }

    const permissions = [
        { name: 'Administrator', flag: Discord.PermissionFlagsBits.Administrator },
        { name: 'Manage Server', flag: Discord.PermissionFlagsBits.ManageGuild },
        { name: 'Manage Roles', flag: Discord.PermissionFlagsBits.ManageRoles },
        { name: 'Manage Channels', flag: Discord.PermissionFlagsBits.ManageChannels },
        { name: 'Kick Members', flag: Discord.PermissionFlagsBits.KickMembers },
        { name: 'Ban Members', flag: Discord.PermissionFlagsBits.BanMembers },
        { name: 'Send Messages', flag: Discord.PermissionFlagsBits.SendMessages },
        { name: 'Manage Messages', flag: Discord.PermissionFlagsBits.ManageMessages },
    ];

    let permList = `**🔐 Permissions for ${role.name}:**\n\n`;
    permissions.forEach((perm, index) => {
        const hasPermission = role.permissions.has(perm.flag);
        const status = hasPermission ? '✅' : '❌';
        permList += `${index + 1}. ${status} ${perm.name}\n`;
    });
    permList += '\n**Reply with permission number, then `enable` or `disable`**';

    await message.reply(permList);
}

async function collectServerData(guild) {
    // ... (same as before - keeping original functionality)
    const roles = guild.roles.cache
        .filter(role => role.id !== guild.id)
        .sort((a, b) => b.position - a.position);

    const channels = guild.channels.cache;
    const roleData = [];

    for (const [roleId, role] of roles) {
        const channelPermissions = [];

        for (const [channelId, channel] of channels) {
            if (channel.type === Discord.ChannelType.GuildCategory) continue;

            const permissions = channel.permissionsFor(role);
            if (!permissions) continue;

            const perms = {
                channelName: channel.name,
                channelType: channel.type,
                canView: permissions.has(Discord.PermissionFlagsBits.ViewChannel),
                canSend: channel.isTextBased() ? permissions.has(Discord.PermissionFlagsBits.SendMessages) : null,
                canConnect: channel.isVoiceBased() ? permissions.has(Discord.PermissionFlagsBits.Connect) : null,
                canSpeak: channel.isVoiceBased() ? permissions.has(Discord.PermissionFlagsBits.Speak) : null,
            };

            channelPermissions.push(perms);
        }

        roleData.push({
            id: role.id,
            name: role.name,
            color: role.hexColor,
            position: role.position,
            members: role.members.size,
            permissions: {
                administrator: role.permissions.has(Discord.PermissionFlagsBits.Administrator),
                manageGuild: role.permissions.has(Discord.PermissionFlagsBits.ManageGuild),
                manageRoles: role.permissions.has(Discord.PermissionFlagsBits.ManageRoles),
                manageChannels: role.permissions.has(Discord.PermissionFlagsBits.ManageChannels),
                kickMembers: role.permissions.has(Discord.PermissionFlagsBits.KickMembers),
                banMembers: role.permissions.has(Discord.PermissionFlagsBits.BanMembers),
                sendMessages: role.permissions.has(Discord.PermissionFlagsBits.SendMessages),
                manageMessages: role.permissions.has(Discord.PermissionFlagsBits.ManageMessages),
            },
            channelPermissions
        });
    }

    return {
        serverName: guild.name,
        serverIcon: guild.iconURL(),
        roles: roleData
    };
}

function generateHTML(data) {
    // ... (same HTML generation as before)
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${data.serverName} Dashboard</title></head><body><h1>${data.serverName} Role Permissions</h1><p>Dashboard generated on ${new Date().toLocaleString()}</p></body></html>`;
}

function startKeepAliveServer() {
    const server = http.createServer(async (req, res) => {
        // Parse URL and method
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;
        
        // CORS headers for API requests
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        
        // API: Get audit log
        if (pathname === '/api/audit-log' && req.method === 'GET') {
            const password = url.searchParams.get('password');
            if (password !== CONFIG.WEB_DASHBOARD_PASSWORD) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid password' }));
                return;
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                logs: auditLog.slice(0, 100), // Last 100 entries
                botStatus: client.user ? 'online' : 'offline',
                botTag: client.user?.tag || 'Not connected'
            }));
            return;
        }
        
        // API: Send message to main chat
        if (pathname === '/api/send-message' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    
                    if (data.password !== CONFIG.WEB_DASHBOARD_PASSWORD) {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid password' }));
                        return;
                    }
                    
                    if (!CONFIG.MAIN_CHAT_CHANNEL_ID) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'MAIN_CHAT_CHANNEL_ID not configured' }));
                        return;
                    }
                    
                    const mainChannel = await client.channels.fetch(CONFIG.MAIN_CHAT_CHANNEL_ID);
                    await mainChannel.send(data.message);
                    
                    addAuditLog('Message Sent', { tag: 'Web Dashboard', id: 'web' }, `Sent to main chat: ${data.message.substring(0, 50)}...`, 'success');
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Message sent!' }));
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: error.message }));
                }
            });
            return;
        }
        
        
        // API: Get role permissions
        if (pathname === '/api/roles' && req.method === 'GET') {
            const password = url.searchParams.get('password');
            if (password !== CONFIG.WEB_DASHBOARD_PASSWORD) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid password' }));
                return;
            }
            
            try {
                const guild = client.guilds.cache.first();
                if (!guild) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Bot not in any server' }));
                    return;
                }
                
                const rolesData = await collectServerData(guild);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(rolesData));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
            return;
        }
        
        // API: Search users
        if (pathname === '/api/users/search' && req.method === 'GET') {
            const password = url.searchParams.get('password');
            const query = url.searchParams.get('query');
            
            if (password !== CONFIG.WEB_DASHBOARD_PASSWORD) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid password' }));
                return;
            }
            
            try {
                const guild = client.guilds.cache.first();
                if (!guild) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Bot not in any server' }));
                    return;
                }
                
                await guild.members.fetch();
                
                let results = [];
                if (query) {
                    const lowerQuery = query.toLowerCase();
                    results = guild.members.cache.filter(member => {
                        return member.user.tag.toLowerCase().includes(lowerQuery) ||
                               member.user.id === query ||
                               member.displayName.toLowerCase().includes(lowerQuery);
                    }).map(member => ({
                        id: member.user.id,
                        tag: member.user.tag,
                        displayName: member.displayName,
                        avatar: member.user.displayAvatarURL(),
                        joinedAt: member.joinedTimestamp,
                        accountCreatedAt: member.user.createdTimestamp,
                        roles: member.roles.cache.map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
                        timedOut: member.communicationDisabledUntilTimestamp ? member.communicationDisabledUntilTimestamp > Date.now() : false,
                        timeoutUntil: member.communicationDisabledUntilTimestamp
                    })).slice(0, 20); // Limit to 20 results
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ users: results }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
            return;
        }
        
        // API: User action (timeout, kick, ban)
        if (pathname === '/api/users/action' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    
                    if (data.password !== CONFIG.WEB_DASHBOARD_PASSWORD) {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid password' }));
                        return;
                    }
                    
                    const guild = client.guilds.cache.first();
                    const member = await guild.members.fetch(data.userId);
                    
                    let result = '';
                    
                    switch(data.action) {
                        case 'timeout':
                            const duration = parseInt(data.duration) || 60; // minutes
                            await member.timeout(duration * 60 * 1000, data.reason || 'Timed out from web dashboard');
                            result = `Timed out for ${duration} minutes`;
                            addAuditLog('User Timed Out', { tag: 'Web Dashboard', id: 'web' }, `${member.user.tag} timed out for ${duration} minutes`, 'warning');
                            break;
                            
                        case 'untimeout':
                            await member.timeout(null);
                            result = 'Timeout removed';
                            addAuditLog('Timeout Removed', { tag: 'Web Dashboard', id: 'web' }, `${member.user.tag} timeout removed`, 'success');
                            break;
                            
                        case 'kick':
                            await member.kick(data.reason || 'Kicked from web dashboard');
                            result = 'User kicked';
                            addAuditLog('User Kicked', { tag: 'Web Dashboard', id: 'web' }, `${member.user.tag} kicked`, 'warning');
                            break;
                            
                        case 'ban':
                            await guild.members.ban(data.userId, { reason: data.reason || 'Banned from web dashboard' });
                            result = 'User banned';
                            addAuditLog('User Banned', { tag: 'Web Dashboard', id: 'web' }, `${member.user.tag} banned`, 'error');
                            break;
                            
                        default:
                            throw new Error('Invalid action');
                    }
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: result }));
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: error.message }));
                }
            });
            return;
        }
        
        // API: Quick actions
        if (pathname === '/api/quick-action' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    
                    if (data.password !== CONFIG.WEB_DASHBOARD_PASSWORD) {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid password' }));
                        return;
                    }
                    
                    let result = '';
                    
                    switch(data.action) {
                        case 'check-stream':
                            await checkYouTubeStreams();
                            result = 'Stream check completed';
                            addAuditLog('Stream Check', { tag: 'Web Dashboard', id: 'web' }, 'Manual stream check triggered', 'info');
                            break;
                            
                        case 'set-online':
                            await client.user.setStatus('online');
                            result = 'Bot status set to online';
                            addAuditLog('Status Changed', { tag: 'Web Dashboard', id: 'web' }, 'Bot status: online', 'info');
                            break;
                            
                        case 'set-offline':
                            await client.user.setStatus('invisible');
                            result = 'Bot status set to offline';
                            addAuditLog('Status Changed', { tag: 'Web Dashboard', id: 'web' }, 'Bot status: offline', 'info');
                            break;
                            
                        case 'clear-audit':
                            const count = auditLog.length;
                            auditLog.length = 0;
                            result = `Cleared ${count} audit entries`;
                            addAuditLog('Audit Log Cleared', { tag: 'Web Dashboard', id: 'web' }, `Cleared ${count} entries`, 'info');
                            break;
                            
                        case 'get-stats':
                            const guild = client.guilds.cache.first();
                            const stats = {
                                totalMembers: guild.memberCount,
                                onlineMembers: guild.members.cache.filter(m => m.presence?.status !== 'offline').size,
                                roles: guild.roles.cache.size,
                                channels: guild.channels.cache.size,
                                auditEntries: auditLog.length,
                                botUptime: Math.floor(process.uptime()),
                                triviaEnabled: triviaEnabled,
                                mimicEnabled: mimicEnabled,
                                mimicTarget: mimicTargetId ? (await client.users.fetch(mimicTargetId).catch(() => null))?.tag : null
                            };
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true, stats }));
                            return;
                            
                        case 'trivia-on':
                            if (triviaEnabled) {
                                result = 'Trivia is already enabled';
                            } else {
                                triviaEnabled = true;
                                startTriviaSystem();
                                result = 'Trivia enabled! Questions every 25 minutes';
                                addAuditLog('Trivia Enabled', { tag: 'Web Dashboard', id: 'web' }, 'Trivia system started', 'success');
                            }
                            break;
                            
                        case 'trivia-off':
                            if (!triviaEnabled) {
                                result = 'Trivia is already disabled';
                            } else {
                                triviaEnabled = false;
                                if (triviaInterval) {
                                    clearInterval(triviaInterval);
                                    triviaInterval = null;
                                }
                                currentTrivia = null;
                                result = 'Trivia disabled';
                                addAuditLog('Trivia Disabled', { tag: 'Web Dashboard', id: 'web' }, 'Trivia system stopped', 'info');
                            }
                            break;
                            
                        case 'trivia-now':
                            await postTriviaQuestion();
                            result = 'Trivia question posted!';
                            break;
                            
                        case 'trivia-scores':
                            if (triviaScores.size === 0) {
                                result = 'No trivia scores yet';
                            } else {
                                const sortedScores = Array.from(triviaScores.entries())
                                    .sort((a, b) => b[1] - a[1])
                                    .slice(0, 10);
                                
                                const scoresData = await Promise.all(sortedScores.map(async ([userId, score]) => {
                                    const user = await client.users.fetch(userId).catch(() => null);
                                    return { userId, tag: user?.tag || 'Unknown', score };
                                }));
                                
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ success: true, scores: scoresData }));
                                return;
                            }
                            break;
                            
                            
                        default:
                            throw new Error('Invalid action');
                    }
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: result }));
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: error.message }));
                }
            });
            return;
        }
        
        // Main dashboard HTML
        if (pathname === '/' || pathname === '/dashboard') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(generateDashboardHTML());
            return;
        }
        
        // Default: bot status
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`Bot Online: ${client.user?.tag || 'Starting...'}\nUptime: ${Math.floor(process.uptime())} seconds\nAudit Entries: ${auditLog.length}`);
    });

    const PORT = process.env.PORT || 10000;
    server.listen(PORT, () => {
        console.log(`✅ Web dashboard running on port ${PORT}`);
        console.log(`📊 Access at: http://localhost:${PORT}/dashboard`);
    });
}

// Dashboard HTML function starts here
function generateDashboardHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Discord Bot Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        :root {
            --bg-primary: #0f0f0f;
            --bg-secondary: #1a1a1a;
            --bg-tertiary: #242424;
            --bg-hover: #2a2a2a;
            --accent: #5865f2;
            --accent-hover: #4752c4;
            --success: #3ba55d;
            --warning: #faa81a;
            --danger: #ed4245;
            --text-primary: #ffffff;
            --text-secondary: #b9bbbe;
            --text-muted: #72767d;
            --border: #2f3136;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
        }
        
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        
        .login-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .login-box { background: var(--bg-secondary); border-radius: 16px; padding: 40px; width: 100%; max-width: 420px; border: 1px solid var(--border); }
        .login-box h1 { font-size: 28px; margin-bottom: 8px; font-weight: 700; }
        .login-box p { color: var(--text-secondary); margin-bottom: 24px; }
        
        .header { background: var(--bg-secondary); border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border); }
        .header-left { display: flex; align-items: center; gap: 16px; }
        .bot-status { display: flex; align-items: center; gap: 8px; background: var(--bg-tertiary); padding: 8px 16px; border-radius: 8px; }
        .status-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--success); animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        
        .tabs { display: flex; gap: 8px; margin-bottom: 24px; background: var(--bg-secondary); padding: 8px; border-radius: 12px; border: 1px solid var(--border); overflow-x: auto; }
        .tab { padding: 12px 24px; background: transparent; border: none; color: var(--text-secondary); cursor: pointer; border-radius: 8px; font-weight: 500; transition: all 0.2s; white-space: nowrap; font-size: 14px; }
        .tab:hover { background: var(--bg-hover); color: var(--text-primary); }
        .tab.active { background: var(--accent); color: white; }
        
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        
        .card { background: var(--bg-secondary); border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 1px solid var(--border); }
        .card h2 { font-size: 18px; margin-bottom: 16px; font-weight: 600; }
        
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 14px; font-weight: 500; }
        
        input[type="text"], input[type="password"], input[type="number"], textarea, select {
            width: 100%; padding: 12px 16px; background: var(--bg-tertiary); border: 1px solid var(--border);
            border-radius: 8px; color: var(--text-primary); font-family: inherit; font-size: 14px; transition: all 0.2s;
        }
        input:focus, textarea:focus, select:focus { outline: none; border-color: var(--accent); background: var(--bg-primary); }
        textarea { resize: vertical; min-height: 120px; }
        
        .btn { padding: 12px 24px; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; transition: all 0.2s; font-size: 14px; font-family: inherit; }
        .btn-primary { background: var(--accent); color: white; }
        .btn-primary:hover { background: var(--accent-hover); }
        .btn-success { background: var(--success); color: white; }
        .btn-warning { background: var(--warning); color: white; }
        .btn-danger { background: var(--danger); color: white; }
        .btn-secondary { background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border); }
        .btn-secondary:hover { background: var(--bg-hover); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .checkbox-group { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
        .checkbox-group input[type="checkbox"] { width: auto; }
        
        .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; display: none; }
        .alert.show { display: block; }
        .alert-success { background: rgba(59, 165, 93, 0.1); border: 1px solid var(--success); color: var(--success); }
        .alert-error { background: rgba(237, 66, 69, 0.1); border: 1px solid var(--danger); color: var(--danger); }
        
        .audit-entry { background: var(--bg-tertiary); padding: 16px; border-radius: 8px; margin-bottom: 12px; border-left: 3px solid var(--accent); }
        .audit-entry.warning { border-left-color: var(--warning); }
        .audit-entry.error { border-left-color: var(--danger); }
        .audit-entry.success { border-left-color: var(--success); }
        .audit-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .audit-time { color: var(--text-muted); font-size: 12px; }
        .audit-action { font-weight: 600; font-size: 14px; }
        .audit-user { color: var(--text-secondary); font-size: 13px; }
        .audit-details { color: var(--text-secondary); font-size: 13px; margin-top: 4px; }
        
        .user-card { background: var(--bg-tertiary); border-radius: 8px; padding: 16px; margin-bottom: 12px; display: flex; gap: 16px; align-items: flex-start; }
        .user-avatar { width: 64px; height: 64px; border-radius: 50%; flex-shrink: 0; }
        .user-info { flex: 1; }
        .user-tag { font-weight: 600; font-size: 16px; margin-bottom: 4px; }
        .user-id { color: var(--text-muted); font-size: 12px; margin-bottom: 8px; }
        .user-meta { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; }
        .user-meta-item { font-size: 13px; color: var(--text-secondary); }
        .user-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .user-actions .btn { padding: 8px 16px; font-size: 13px; }
        
        .quick-actions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        .quick-action-btn { background: var(--bg-tertiary); border: 1px solid var(--border); padding: 20px; border-radius: 8px; cursor: pointer; transition: all 0.2s; text-align: center; }
        .quick-action-btn:hover { background: var(--bg-hover); border-color: var(--accent); }
        .quick-action-icon { font-size: 32px; margin-bottom: 8px; }
        .quick-action-label { font-weight: 500; font-size: 14px; }
        
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-top: 20px; }
        .stat-card { background: var(--bg-tertiary); padding: 20px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 28px; font-weight: 700; color: var(--accent); }
        .stat-label { color: var(--text-secondary); font-size: 13px; margin-top: 4px; }
        
        .role-item { background: var(--bg-tertiary); padding: 16px; border-radius: 8px; margin-bottom: 12px; }
        .role-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .role-name { font-weight: 600; display: flex; align-items: center; gap: 8px; }
        .role-badge { width: 12px; height: 12px; border-radius: 50%; }
        .role-members { color: var(--text-muted); font-size: 13px; }
        .permissions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; margin-top: 12px; }
        .permission-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); }
        
        .hidden { display: none !important; }
        .text-success { color: var(--success); }
        .text-warning { color: var(--warning); }
        .text-danger { color: var(--danger); }
        .mt-2 { margin-top: 8px; }
        .mb-2 { margin-bottom: 8px; }
        
        .loading { text-align: center; padding: 40px; color: var(--text-muted); }
        
        @media (max-width: 768px) {
            .container { padding: 12px; }
            .header { flex-direction: column; gap: 12px; }
            .tabs { overflow-x: scroll; }
            .quick-actions-grid { grid-template-columns: 1fr 1fr; }
        }
    </style>
</head>
<body>
    <div id="loginScreen" class="login-screen">
        <div class="login-box">
            <h1>🤖 Bot Dashboard</h1>
            <p>Enter password to access dashboard</p>
            <div id="loginAlert" class="alert"></div>
            <div class="form-group">
                <label>Password</label>
                <input type="password" id="loginPassword" placeholder="Enter dashboard password">
            </div>
            <button class="btn btn-primary" onclick="login()" style="width: 100%;">Login</button>
        </div>
    </div>

    <div id="dashboard" class="hidden container">
        <div class="header">
            <div class="header-left">
                <h1>Discord Bot Dashboard</h1>
                <div class="bot-status">
                    <div class="status-dot"></div>
                    <span id="botStatus">Online</span>
                </div>
            </div>
            <button class="btn btn-secondary" onclick="logout()">Logout</button>
        </div>

        <div class="tabs">
            <button class="tab active" onclick="showTab('messages')">📨 Messages</button>
            <button class="tab" onclick="showTab('users')">👥 Users</button>
            <button class="tab" onclick="showTab('actions')">⚡ Quick Actions</button>
            <button class="tab" onclick="showTab('audit')">📋 Audit Log</button>
            <button class="tab" onclick="showTab('roles')">🔐 Roles</button>
        </div>

        <div id="tab-messages" class="tab-content active">
            <div class="card">
                <h2>Send Message to Main Chat</h2>
                <div id="messageAlert" class="alert"></div>
                <div class="form-group">
                    <label>Message</label>
                    <textarea id="messageText" placeholder="Type your message here..."></textarea>
                </div>
                <button class="btn btn-primary" onclick="sendMessage()">Send to Main Chat</button>
            </div>
        </div>

        <div id="tab-users" class="tab-content">
            <div class="card">
                <h2>User Management</h2>
                <div id="userAlert" class="alert"></div>
                <div class="form-group">
                    <label>Search Users</label>
                    <input type="text" id="userSearch" placeholder="Enter username, tag, or ID...">
                </div>
                <button class="btn btn-primary" onclick="searchUsers()">Search</button>
                <div id="userResults" class="mt-2"></div>
            </div>
        </div>

        <div id="tab-actions" class="tab-content">
            <div class="card">
                <h2>Quick Actions</h2>
                <div id="actionAlert" class="alert"></div>
                <div class="quick-actions-grid">
                    <div class="quick-action-btn" onclick="quickAction('check-stream')">
                        <div class="quick-action-icon">🔴</div>
                        <div class="quick-action-label">Check Stream</div>
                    </div>
                    <div class="quick-action-btn" onclick="quickAction('set-online')">
                        <div class="quick-action-icon">🟢</div>
                        <div class="quick-action-label">Set Online</div>
                    </div>
                    <div class="quick-action-btn" onclick="quickAction('set-offline')">
                        <div class="quick-action-icon">⚫</div>
                        <div class="quick-action-label">Set Offline</div>
                    </div>
                    <div class="quick-action-btn" onclick="quickAction('clear-audit')">
                        <div class="quick-action-icon">🗑️</div>
                        <div class="quick-action-label">Clear Audit</div>
                    </div>
                </div>
            </div>
            <div class="card">
                <h2>Server Statistics</h2>
                <button class="btn btn-secondary mb-2" onclick="loadStats()">Refresh Stats</button>
                <div id="statsContainer" class="stats-grid"></div>
            </div>
        </div>

        <!-- Fun Features Tab -->

        <div id="tab-audit" class="tab-content">
            <div class="card">
                <h2>Audit Log</h2>
                <button class="btn btn-secondary mb-2" onclick="loadAuditLog()">Refresh</button>
                <div id="auditLog"></div>
            </div>
        </div>

        <div id="tab-roles" class="tab-content">
            <div class="card">
                <h2>Server Roles & Permissions</h2>
                <button class="btn btn-secondary mb-2" onclick="loadRoles()">Refresh</button>
                <div id="rolesContainer"></div>
            </div>
        </div>
    </div>

    <script>
        let password = '';
        
        function login() {
            password = document.getElementById('loginPassword').value;
            if (!password) {
                showAlert('loginAlert', 'Please enter password', 'error');
                return;
            }
            fetch(\`/api/audit-log?password=\${password}\`)
                .then(r => r.json())
                .then(data => {
                    if (data.error) {
                        showAlert('loginAlert', 'Invalid password', 'error');
                    } else {
                        document.getElementById('loginScreen').classList.add('hidden');
                        document.getElementById('dashboard').classList.remove('hidden');
                        document.getElementById('botStatus').textContent = data.botTag || 'Online';
                        loadAuditLog();
                    }
                })
                .catch(err => showAlert('loginAlert', 'Error: ' + err.message, 'error'));
        }
        
        function logout() {
            password = '';
            document.getElementById('loginScreen').classList.remove('hidden');
            document.getElementById('dashboard').classList.add('hidden');
            document.getElementById('loginPassword').value = '';
        }
        
        function showTab(tabName) {
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.getElementById('tab-' + tabName).classList.add('active');
            event.target.classList.add('active');
            if (tabName === 'audit') loadAuditLog();
            if (tabName === 'roles') loadRoles();
            if (tabName === 'actions') loadStats();
            if (tabName === 'fun') loadStats();
        }
        
        function showAlert(id, message, type) {
            const alert = document.getElementById(id);
            alert.textContent = message;
            alert.className = 'alert alert-' + type + ' show';
            setTimeout(() => alert.classList.remove('show'), 5000);
        }
        
        async function sendMessage() {
            const message = document.getElementById('messageText').value;
            if (!message) return showAlert('messageAlert', 'Please enter a message', 'error');
            try {
                const res = await fetch('/api/send-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, message })
                });
                const data = await res.json();
                if (data.success) {
                    showAlert('messageAlert', 'Message sent!', 'success');
                    document.getElementById('messageText').value = '';
                } else {
                    showAlert('messageAlert', data.error || 'Error', 'error');
                }
            } catch (err) {
                showAlert('messageAlert', 'Error: ' + err.message, 'error');
            }
        }
        
        
        async function searchUsers() {
            const query = document.getElementById('userSearch').value;
            if (!query) return showAlert('userAlert', 'Enter search term', 'error');
            try {
                const res = await fetch(\`/api/users/search?password=\${password}&query=\${encodeURIComponent(query)}\`);
                const data = await res.json();
                if (data.error) return showAlert('userAlert', data.error, 'error');
                const container = document.getElementById('userResults');
                if (data.users.length === 0) {
                    container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No users found</p>';
                    return;
                }
                container.innerHTML = data.users.map(user => \`
                    <div class="user-card">
                        <img src="\${user.avatar}" class="user-avatar" alt="Avatar">
                        <div class="user-info">
                            <div class="user-tag">\${user.tag}</div>
                            <div class="user-id">ID: \${user.id}</div>
                            <div class="user-meta">
                                <span class="user-meta-item">Joined: \${new Date(user.joinedAt).toLocaleDateString()}</span>
                                <span class="user-meta-item">Account: \${new Date(user.accountCreatedAt).toLocaleDateString()}</span>
                                <span class="user-meta-item \${user.timedOut ? 'text-warning' : ''}">\${user.timedOut ? '⏱️ Timed Out' : '✅ Active'}</span>
                            </div>
                            <div class="user-actions">
                                <button class="btn btn-warning" onclick="timeoutUser('\${user.id}', '\${user.tag}')">Timeout</button>
                                \${user.timedOut ? '<button class="btn btn-success" onclick="untimeoutUser(\\''+user.id+'\\', \\''+user.tag+'\\')">Remove Timeout</button>' : ''}
                                <button class="btn btn-danger" onclick="kickUser('\${user.id}', '\${user.tag}')">Kick</button>
                                <button class="btn btn-danger" onclick="banUser('\${user.id}', '\${user.tag}')">Ban</button>
                            </div>
                        </div>
                    </div>
                \`).join('');
            } catch (err) {
                showAlert('userAlert', 'Error: ' + err.message, 'error');
            }
        }
        
        async function timeoutUser(userId, tag) {
            const duration = prompt('Timeout duration in minutes:', '60');
            if (!duration) return;
            const reason = prompt('Reason (optional):', '');
            try {
                const res = await fetch('/api/users/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, userId, action: 'timeout', duration, reason })
                });
                const data = await res.json();
                if (data.success) {
                    showAlert('userAlert', \`\${tag} timed out for \${duration} minutes\`, 'success');
                    searchUsers();
                } else {
                    showAlert('userAlert', data.error, 'error');
                }
            } catch (err) {
                showAlert('userAlert', 'Error: ' + err.message, 'error');
            }
        }
        
        async function untimeoutUser(userId, tag) {
            try {
                const res = await fetch('/api/users/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, userId, action: 'untimeout' })
                });
                const data = await res.json();
                if (data.success) {
                    showAlert('userAlert', \`\${tag} timeout removed\`, 'success');
                    searchUsers();
                } else {
                    showAlert('userAlert', data.error, 'error');
                }
            } catch (err) {
                showAlert('userAlert', 'Error: ' + err.message, 'error');
            }
        }
        
        async function kickUser(userId, tag) {
            if (!confirm(\`Kick \${tag}?\`)) return;
            const reason = prompt('Reason (optional):', '');
            try {
                const res = await fetch('/api/users/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, userId, action: 'kick', reason })
                });
                const data = await res.json();
                if (data.success) {
                    showAlert('userAlert', \`\${tag} kicked\`, 'success');
                    searchUsers();
                } else {
                    showAlert('userAlert', data.error, 'error');
                }
            } catch (err) {
                showAlert('userAlert', 'Error: ' + err.message, 'error');
            }
        }
        
        async function banUser(userId, tag) {
            if (!confirm(\`Ban \${tag}? This is permanent.\`)) return;
            const reason = prompt('Reason (optional):', '');
            try {
                const res = await fetch('/api/users/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, userId, action: 'ban', reason })
                });
                const data = await res.json();
                if (data.success) {
                    showAlert('userAlert', \`\${tag} banned\`, 'success');
                    searchUsers();
                } else {
                    showAlert('userAlert', data.error, 'error');
                }
            } catch (err) {
                showAlert('userAlert', 'Error: ' + err.message, 'error');
            }
        }
        
        async function quickAction(action) {
            try {
                const res = await fetch('/api/quick-action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, action })
                });
                const data = await res.json();
                if (data.success) {
                    showAlert('actionAlert', data.message || 'Action completed', 'success');
                    if (action === 'get-stats') displayStats(data.stats);
                } else {
                    showAlert('actionAlert', data.error, 'error');
                }
            } catch (err) {
                showAlert('actionAlert', 'Error: ' + err.message, 'error');
            }
        }
        
        async function loadStats() {
            try {
                const res = await fetch('/api/quick-action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, action: 'get-stats' })
                });
                const data = await res.json();
                if (data.success && data.stats) displayStats(data.stats);
            } catch (err) {
                console.error('Error loading stats:', err);
            }
        }
        
        function displayStats(stats) {
            const container = document.getElementById('statsContainer');
            const uptimeHours = Math.floor(stats.botUptime / 3600);
            const uptimeMins = Math.floor((stats.botUptime % 3600) / 60);
            container.innerHTML = \`
                <div class="stat-card"><div class="stat-value">\${stats.totalMembers}</div><div class="stat-label">Total Members</div></div>
                <div class="stat-card"><div class="stat-value">\${stats.onlineMembers}</div><div class="stat-label">Online Now</div></div>
                <div class="stat-card"><div class="stat-value">\${stats.roles}</div><div class="stat-label">Roles</div></div>
                <div class="stat-card"><div class="stat-value">\${stats.channels}</div><div class="stat-label">Channels</div></div>
                <div class="stat-card"><div class="stat-value">\${stats.auditEntries}</div><div class="stat-label">Audit Entries</div></div>
                <div class="stat-card"><div class="stat-value">\${uptimeHours}h \${uptimeMins}m</div><div class="stat-label">Bot Uptime</div></div>
                <div class="stat-card"><div class="stat-value">\${stats.triviaEnabled ? '✅ ON' : '❌ OFF'}</div><div class="stat-label">Trivia System</div></div>
                <div class="stat-card"><div class="stat-value">\${stats.mimicEnabled ? '🎭 ACTIVE' : '⚫ OFF'}</div><div class="stat-label">Mimic Mode</div></div>
            \`;
            
            // Update mimic status display
            if (stats.mimicEnabled && stats.mimicTarget) {
                document.getElementById('mimicStatus').style.display = 'block';
                document.getElementById('mimicTarget').textContent = stats.mimicTarget;
            } else {
                document.getElementById('mimicStatus').style.display = 'none';
            }
        }
        
        async function loadAuditLog() {
            try {
                const res = await fetch(\`/api/audit-log?password=\${password}\`);
                const data = await res.json();
                if (data.error) return;
                const container = document.getElementById('auditLog');
                if (data.logs.length === 0) {
                    container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No audit entries</p>';
                    return;
                }
                container.innerHTML = data.logs.map(log => {
                    const time = new Date(log.timestamp).toLocaleString();
                    const severity = log.severity || 'info';
                    return \`
                        <div class="audit-entry \${severity}">
                            <div class="audit-header">
                                <span class="audit-action">\${log.action}</span>
                                <span class="audit-time">\${time}</span>
                            </div>
                            <div class="audit-user">By: \${log.user}</div>
                            <div class="audit-details">\${log.details}</div>
                        </div>
                    \`;
                }).join('');
            } catch (err) {
                console.error('Error loading audit log:', err);
            }
        }
        
        async function loadRoles() {
            try {
                const res = await fetch(\`/api/roles?password=\${password}\`);
                const data = await res.json();
                if (data.error) {
                    document.getElementById('rolesContainer').innerHTML = '<p style="color: var(--text-danger);">' + data.error + '</p>';
                    return;
                }
                const container = document.getElementById('rolesContainer');
                if (!data.roles || data.roles.length === 0) {
                    container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No roles found</p>';
                    return;
                }
                container.innerHTML = data.roles.map(role => \`
                    <div class="role-item">
                        <div class="role-header">
                            <div class="role-name">
                                <span class="role-badge" style="background-color: \${role.color}"></span>
                                \${role.name}
                            </div>
                            <div class="role-members">\${role.members} members</div>
                        </div>
                        <div class="permissions-grid">
                            \${Object.entries(role.permissions).map(([key, value]) => \`
                                <div class="permission-item">
                                    <span>\${value ? '✅' : '❌'}</span>
                                    <span>\${formatPermissionName(key)}</span>
                                </div>
                            \`).join('')}
                        </div>
                    </div>
                \`).join('');
            } catch (err) {
                console.error('Error loading roles:', err);
            }
        }
        
        // Trivia Functions
        async function toggleTrivia(action) {
            try {
                const res = await fetch('/api/quick-action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, action: `trivia-${action}` })
                });
                const data = await res.json();
                if (data.success) {
                    showAlert('triviaAlert', data.message, 'success');
                    loadStats(); // Refresh to show trivia status
                } else {
                    showAlert('triviaAlert', data.error, 'error');
                }
            } catch (err) {
                showAlert('triviaAlert', 'Error: ' + err.message, 'error');
            }
        }
        
        async function postTriviaQuestion() {
            try {
                const res = await fetch('/api/quick-action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, action: 'trivia-now' })
                });
                const data = await res.json();
                if (data.success) {
                    showAlert('triviaAlert', 'Trivia question posted to main chat!', 'success');
                } else {
                    showAlert('triviaAlert', data.error, 'error');
                }
            } catch (err) {
                showAlert('triviaAlert', 'Error: ' + err.message, 'error');
            }
        }
        
        async function viewTriviaScores() {
            try {
                const res = await fetch('/api/quick-action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, action: 'trivia-scores' })
                });
                const data = await res.json();
                if (data.success && data.scores) {
                    const container = document.getElementById('triviaScoresContainer');
                    if (data.scores.length === 0) {
                        container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No scores yet!</p>';
                        return;
                    }
                    container.innerHTML = `
                        <div style="background: var(--bg-tertiary); border-radius: 8px; padding: 16px;">
                            <h3 style="margin-bottom: 12px; color: var(--accent);">🏆 Leaderboard</h3>
                            ${data.scores.map((entry, index) => {
                                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : (index + 1) + '.';
                                return `
                                    <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--bg-primary); border-radius: 6px; margin-bottom: 8px;">
                                        <span>${medal} ${entry.tag}</span>
                                        <span style="color: var(--accent); font-weight: 600;">${entry.score} pts</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                } else {
                    showAlert('triviaAlert', data.error || data.message, 'error');
                }
            } catch (err) {
                showAlert('triviaAlert', 'Error: ' + err.message, 'error');
            }
        }
        
        
        function formatPermissionName(key) {
            return key.replace(/([A-Z])/g, ' $1').trim().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        }
        
        setInterval(() => {
            if (document.getElementById('tab-audit').classList.contains('active')) loadAuditLog();
        }, 10000);
        
        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('loginPassword').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') login();
            });
        });
    </script>
</body>
</html>\`;
}

// Login
const TOKEN = process.env.DISCORD_TOKEN || 'YOUR_BOT_TOKEN_HERE';
client.login(TOKEN);
