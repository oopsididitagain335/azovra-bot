const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ]
});

// Database configuration — NO API KEY NEEDED
const DB_URL = process.env.DB_URL || 'https://web-production-c7de2.up.railway.app';

// Database helper functions — NO AUTH HEADER
const db = {
  async set(key, value) {
    try {
      const response = await axios.post(`${DB_URL}/set`, { key, value });
      return response.data;
    } catch (error) {
      console.error('DB Set Error:', error.message);
      throw error;
    }
  },
  
  async get(key) {
    try {
      const response = await axios.get(`${DB_URL}/get/${key}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error('DB Get Error:', error.message);
      throw error;
    }
  },
  
  async delete(key) {
    return await this.set(key, "");
  },
  
  async size() {
    try {
      const response = await axios.get(`${DB_URL}/size`);
      return response.data;
    } catch (error) {
      console.error('DB Size Error:', error.message);
      throw error;
    }
  },
  
  async health() {
    try {
      const response = await axios.get(`${DB_URL}/health`);
      return response.data;
    } catch (error) {
      console.error('DB Health Check Error:', error.message);
      throw error;
    }
  }
};

// Collections for commands and events
client.commands = new Collection();
client.events = new Collection();
client.securityEvents = new Collection();

// Function to load commands
async function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  
  // Check if commands directory exists
  if (!fs.existsSync(commandsPath)) {
    console.log('No commands directory found. Skipping command loading.');
    return;
  }
  
  // Get all command files
  const commandFiles = fs.readdirSync(commandsPath).filter(file => 
    file.endsWith('.js') || 
    (fs.statSync(path.join(commandsPath, file)).isDirectory() && fs.existsSync(path.join(commandsPath, file, 'index.js')))
  );
  
  for (const file of commandFiles) {
    let filePath;
    
    // Handle folder-based commands
    if (fs.statSync(path.join(commandsPath, file)).isDirectory()) {
      filePath = path.join(commandsPath, file, 'index.js');
    } else {
      filePath = path.join(commandsPath, file);
    }
    
    // Load the command
    const command = require(filePath);
    
    // Set a collection of command properties
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`Loaded command: ${command.data.name}`);
    } else {
      console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }
}

// Function to load events
async function loadEvents() {
  const eventsPath = path.join(__dirname, 'events');
  
  // Check if events directory exists
  if (!fs.existsSync(eventsPath)) {
    console.log('No events directory found. Skipping event loading.');
    return;
  }
  
  // Get all event files
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client, db));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client, db));
    }
    
    console.log(`Loaded event: ${event.name}`);
  }
}

// Function to load security events
async function loadSecurityEvents() {
  const securityEventsPath = path.join(__dirname, 'sevents');
  
  // Check if security events directory exists
  if (!fs.existsSync(securityEventsPath)) {
    console.log('No security events directory found. Skipping security event loading.');
    return;
  }
  
  // Get all security event files
  const securityEventFiles = fs.readdirSync(securityEventsPath).filter(file => file.endsWith('.js'));
  
  for (const file of securityEventFiles) {
    const filePath = path.join(securityEventsPath, file);
    const securityEvent = require(filePath);
    
    if (securityEvent.once) {
      client.once(securityEvent.name, (...args) => securityEvent.execute(...args, client, db));
    } else {
      client.on(securityEvent.name, (...args) => securityEvent.execute(...args, client, db));
    }
    
    console.log(`Loaded security event: ${securityEvent.name}`);
  }
}

// Register slash commands
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  
  const commands = [];
  for (const [name, command] of client.commands) {
    commands.push(command.data.toJSON());
  }
  
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);
    
    // Refresh all commands
    const data = await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    
    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

// Initialize bot
async function init() {
  try {
    // Load all components
    await loadCommands();
    await loadEvents();
    await loadSecurityEvents();
    
    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);
    
    // Register commands after login
    client.once('ready', async () => {
      console.log(`Logged in as ${client.user.tag}!`);
      
      // Register slash commands
      await registerCommands();
      
      // Start health check interval for DB (for UptimeRobot)
      setInterval(async () => {
        try {
          await db.health();
          console.log('DB Health Check: OK');
        } catch (error) {
          console.error('DB Health Check Failed:', error.message);
        }
      }, 300000); // Every 5 minutes
      
      // Log DB size on startup
      try {
        const size = await db.size();
        console.log(`Database size: ${JSON.stringify(size)}`);
      } catch (error) {
        console.error('Could not fetch DB size:', error.message);
      }
    });
    
    // Handle slash command interactions
    client.on('interactionCreate', async interaction => {
      if (!interaction.isChatInputCommand()) return;
      
      const command = client.commands.get(interaction.commandName);
      
      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }
      
      try {
        await command.execute(interaction, client, db);
      } catch (error) {
        console.error(`Error executing ${interaction.commandName}:`, error);
        await interaction.reply({ 
          content: 'There was an error while executing this command!', 
          ephemeral: true 
        });
      }
    });
    
  } catch (error) {
    console.error('Bot initialization error:', error);
    process.exit(1);
  }
}

// Start the bot
init();

// Export client and db for use in commands/events
module.exports = { client, db };
