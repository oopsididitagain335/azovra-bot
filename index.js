const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const express = require('express');
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

// Database URL — trimmed and clean
const DB_URL = (process.env.DB_URL || 'https://web-production-c7de2.up.railway.app').trim();

// railwayDB object for database operations
const railwayDB = {
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

// DEBUG: Verify railwayDB.get is a function
console.log('🧪 DEBUG: railwayDB.get exists and is a function:', typeof railwayDB.get === 'function');

// Collections
client.commands = new Collection();
client.events = new Collection();
client.securityEvents = new Collection();

// Load Commands
async function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  if (!fs.existsSync(commandsPath)) {
    console.log('No commands directory found. Skipping command loading.');
    return;
  }
  const commandFiles = fs.readdirSync(commandsPath).filter(file =>
    file.endsWith('.js') ||
    (fs.statSync(path.join(commandsPath, file)).isDirectory() && fs.existsSync(path.join(commandsPath, file, 'index.js')))
  );
  for (const file of commandFiles) {
    let filePath = fs.statSync(path.join(commandsPath, file)).isDirectory()
      ? path.join(commandsPath, file, 'index.js')
      : path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`Loaded command: ${command.data.name}`);
    } else {
      console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }
}

// Load Events
async function loadEvents() {
  const eventsPath = path.join(__dirname, 'events');
  if (!fs.existsSync(eventsPath)) {
    console.log('❌ No events directory found. Skipping event loading.');
    return;
  }
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  if (eventFiles.length === 0) {
    console.log('❌ No .js files found in events directory.');
    return;
  }
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
      const event = require(filePath);
      if (!event.name || typeof event.execute !== 'function') {
        console.log(`[WARNING] Event at ${filePath} is missing required "name" or "execute" property.`);
        continue;
      }
      const handler = (...args) => {
        if (!railwayDB || typeof railwayDB.get !== 'function') {
          console.error(`❌ ERROR: railwayDB is invalid in event ${event.name}:`, railwayDB);
          return;
        }
        event.execute(...args, client, railwayDB);
      };
      if (event.once) {
        client.once(event.name, handler);
      } else {
        client.on(event.name, handler);
      }
      console.log(`✅ Loaded event: ${event.name}`);
    } catch (error) {
      console.error(`❌ Error loading event ${file}:`, error);
    }
  }
}

// Load Security Events
async function loadSecurityEvents() {
  const securityEventsPath = path.join(__dirname, 'sevents');
  if (!fs.existsSync(securityEventsPath)) {
    console.log('No security events directory found. Skipping security event loading.');
    return;
  }
  const securityEventFiles = fs.readdirSync(securityEventsPath).filter(file => file.endsWith('.js'));
  for (const file of securityEventFiles) {
    const filePath = path.join(securityEventsPath, file);
    try {
      const securityEvent = require(filePath);
      const handler = (...args) => {
        if (!railwayDB || typeof railwayDB.get !== 'function') {
          console.error(`❌ ERROR: railwayDB is invalid in security event ${securityEvent.name}:`, railwayDB);
          return;
        }
        securityEvent.execute(...args, client, railwayDB);
      };
      if (securityEvent.once) {
        client.once(securityEvent.name, handler);
      } else {
        client.on(securityEvent.name, handler);
      }
      console.log(`Loaded security event: ${securityEvent.name}`);
    } catch (error) {
      console.error(`❌ Error loading security event ${file}:`, error);
    }
  }
}

// Register slash commands
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const commands = [...client.commands.values()].map(cmd => cmd.data.toJSON());
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);
    const data = await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

// Initialize bot
async function init() {
  try {
    await loadCommands();
    await loadEvents();
    await loadSecurityEvents();
    await client.login(process.env.DISCORD_TOKEN);
    client.once('clientReady', async () => {
      console.log(`✅ Logged in as ${client.user.tag}!`);
      await registerCommands();
      // DB health check every 5 minutes
      setInterval(async () => {
        try {
          await railwayDB.health();
          console.log('✅ DB Health Check: OK');
        } catch (error) {
          console.error('❌ DB Health Check Failed:', error.message);
        }
      }, 300000);
      // Log DB size
      try {
        const size = await railwayDB.size();
        console.log(`📊 Database size: ${JSON.stringify(size)}`);
      } catch (error) {
        console.error('❌ Could not fetch DB size:', error.message);
      }
    });
    // Handle interactions
    client.on('interactionCreate', async interaction => {
      if (!interaction.isChatInputCommand()) return;
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.error(`❌ No command matching ${interaction.commandName} was found.`);
        return;
      }
      try {
        await command.execute(interaction, client, railwayDB);
      } catch (error) {
        console.error(`❌ Error executing ${interaction.commandName}:`, error);
        await interaction.reply({
          content: 'There was an error while executing this command!',
          ephemeral: true
        });
      }
    });
  } catch (error) {
    console.error('❌ Bot initialization error:', error);
    process.exit(1);
  }
}

// Start bot
init();

// HTTP Server for hosting platforms
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => {
  res.status(200).send(`Bot is online! Logged in as: ${client.user?.tag || 'Not ready yet'}`);
});
app.listen(PORT, () => {
  console.log(`✅ HTTP Server running on port ${PORT}`);
});

// Export
module.exports = { client, db: railwayDB };
