// src/index.js

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
const DB_URL = (process.env.DB_URL || '').trim();

if (!DB_URL) {
  console.error('❌ DB_URL is not set in environment variables!');
  process.exit(1);
}

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
    console.log('⚠️ No commands directory found. Skipping command loading.');
    return;
  }

  // Recursive function to find all .js files in directories and subdirectories
  function getAllJsFiles(dirPath, files = []) {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      if (item.isDirectory()) {
        getAllJsFiles(fullPath, files);
      } else if (item.isFile() && item.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const commandFiles = getAllJsFiles(commandsPath);
  console.log(`📂 Found ${commandFiles.length} command files.`);

  for (const filePath of commandFiles) {
    try {
      delete require.cache[require.resolve(filePath)];
      const command = require(filePath);

      if (!command.data?.name || typeof command.execute !== 'function') {
        console.warn(`[⚠️] Skipping invalid command at ${filePath}`);
        continue;
      }

      client.commands.set(command.data.name, command);
      console.log(`✅ Loaded command: ${command.data.name} from ${filePath}`);

    } catch (error) {
      console.error(`❌ Failed to load command at ${filePath}:`, error.message);
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
        console.warn(`[⚠️] Skipping invalid event at ${filePath}`);
        continue;
      }

      const handler = (...args) => {
        if (!railwayDB || typeof railwayDB.get !== 'function') {
          console.error(`❌ railwayDB broken in event ${event.name}`);
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
      console.error(`❌ Error loading event ${file}:`, error.message);
    }
  }
}

// Load Security Events
async function loadSecurityEvents() {
  const securityEventsPath = path.join(__dirname, 'sevents');
  if (!fs.existsSync(securityEventsPath)) {
    console.log('⚠️ No security events directory found. Skipping.');
    return;
  }

  const securityEventFiles = fs.readdirSync(securityEventsPath).filter(file => file.endsWith('.js'));

  for (const file of securityEventFiles) {
    const filePath = path.join(securityEventsPath, file);
    try {
      const securityEvent = require(filePath);

      if (!securityEvent.name || typeof securityEvent.execute !== 'function') {
        console.warn(`[⚠️] Skipping invalid security event at ${filePath}`);
        continue;
      }

      const handler = (...args) => {
        if (!railwayDB || typeof railwayDB.get !== 'function') {
          console.error(`❌ railwayDB broken in security event ${securityEvent.name}`);
          return;
        }
        securityEvent.execute(...args, client, railwayDB);
      };

      if (securityEvent.once) {
        client.once(securityEvent.name, handler);
      } else {
        client.on(securityEvent.name, handler);
      }

      console.log(`✅ Loaded security event: ${securityEvent.name}`);
    } catch (error) {
      console.error(`❌ Error loading security event ${file}:`, error.message);
    }
  }
}

// Register slash commands
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const commands = [...client.commands.values()].map(cmd => cmd.data.toJSON());

  try {
    console.log(`🔄 Registering ${commands.length} slash commands...`);
    const data = await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`✅ Successfully registered ${data.length} application commands.`);
  } catch (error) {
    console.error('❌ Error registering slash commands:', error);
  }
}

// Initialize bot
async function init() {
  try {
    await loadCommands();
    await loadEvents();
    await loadSecurityEvents();

    client.once('ready', async () => {
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

    // Handle interactions (slash commands)
    client.on('interactionCreate', async interaction => {
      if (!interaction.isChatInputCommand()) return;

      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.warn(`⚠️ No command found for: ${interaction.commandName}`);
        return;
      }

      try {
        await command.execute(interaction, client, railwayDB);
      } catch (error) {
        console.error(`❌ Error executing ${interaction.commandName}:`, error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '⚠️ There was an error while executing this command!',
            ephemeral: true
          });
        } else {
          await interaction.followUp({
            content: '⚠️ There was an error while executing this command!',
            ephemeral: true
          });
        }
      }
    });

    // 👇 TEXT COMMAND HANDLER FOR `.purge`
    client.on('messageCreate', async message => {
      // Ignore bots, DMs, or messages that don't start with '.'
      if (message.author.bot || !message.guild || !message.content.startsWith('.')) return;

      const args = message.content.slice(1).trim().split(/ +/);
      const command = args.shift()?.toLowerCase();

      if (command === 'purge') {
        // Only allow specific user
        if (message.author.id !== '1400281740978815118') {
          const reply = await message.reply('❌ You are not authorized to use this command.');
          setTimeout(() => reply.delete().catch(() => {}), 5000);
          return;
        }

        // Check bot permissions
        if (!message.channel.permissionsFor(message.guild.members.me)?.has('ManageMessages')) {
          const reply = await message.reply('❌ I need **Manage Messages** permission to purge.');
          setTimeout(() => reply.delete().catch(() => {}), 5000);
          return;
        }

        const amount = parseInt(args[0]);
        if (!amount || amount < 1 || amount > 100) {
          const reply = await message.reply('❌ Please provide a number between **1 and 100**.');
          setTimeout(() => reply.delete().catch(() => {}), 5000);
          return;
        }

        try {
          // Fetch messages (including the command message)
          const messages = await message.channel.messages.fetch({ limit: amount + 1 });
          const filtered = messages.filter(msg => !msg.pinned); // don't delete pinned

          if (filtered.size < 2) {
            // If only 1 message (or none) to delete, delete individually
            await message.delete().catch(() => {});
            if (filtered.size === 1) {
              const msgToDelete = filtered.first();
              if (msgToDelete.id !== message.id) await msgToDelete.delete().catch(() => {});
            }
            const reply = await message.channel.send(`✅ Deleted **${filtered.size - 1}** message(s).`);
            setTimeout(() => reply.delete().catch(() => {}), 3000);
          } else {
            // Bulk delete (2–100 messages)
            await message.channel.bulkDelete(filtered, true).catch(() => {});
            const reply = await message.channel.send(`✅ Deleted **${filtered.size - 1}** message(s).`);
            setTimeout(() => reply.delete().catch(() => {}), 3000);
          }
        } catch (error) {
          console.error('Purge error:', error);
          const reply = await message.reply('❌ Failed to purge messages.');
          setTimeout(() => reply.delete().catch(() => {}), 5000);
        }
      }
    });

    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error('❌ Bot initialization failed:', error);
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

// Export for testing or modularity
module.exports = { client, db: railwayDB };
