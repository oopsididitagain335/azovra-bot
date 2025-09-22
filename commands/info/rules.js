const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rules')
        .setDescription('Displays the server rules')
        .addBooleanOption(option =>
            option.setName('ephemeral')
                .setDescription('Whether to show the rules only to you')
                .setRequired(false)),

    async execute(interaction) {
        const isEphemeral = interaction.options.getBoolean('ephemeral') || false;

        const rulesEmbed = new EmbedBuilder()
            .setTitle('📋 Server Rules')
            .setDescription('Please read and follow these rules to maintain a positive community environment.')
            .setColor(0x0099FF)
            .addFields(
                { name: '1. Be Respectful', value: 'Treat all members with kindness and respect.' },
                { name: '2. No Spamming', value: 'Avoid excessive messages or repetitive content.' },
                { name: '3. No NSFW Content', value: 'Keep all content appropriate for all ages.' },
                { name: '4. Follow Discord ToS', value: 'Adhere to Discord\'s Terms of Service.' },
                { name: '5. No Advertising', value: 'Do not promote other servers or services without permission.' },
                { name: '6. Use Appropriate Channels', value: 'Post in the correct channels to keep things organized.' },
                { name: '7. No Harassment', value: 'Harassment of any kind is strictly prohibited.' },
                { name: '8. Listen to Staff', value: 'Follow instructions from moderators and admins.' },
                { name: '9. No Impersonation', value: 'Do not pretend to be someone else.' },
                { name: '10. Have Fun!', value: 'Enjoy your time here and make friends!' }
            )
            .setFooter({ text: 'Please follow these rules to keep our community safe and welcoming!' })
            .setTimestamp();

        try {
            // Use reply instead of webhook to avoid token issues
            await interaction.reply({
                embeds: [rulesEmbed],
                ephemeral: isEphemeral
            });

            // Add a timeout to disable the help menu after 30 seconds
            setTimeout(async () => {
                try {
                    // Check if the original reply still exists before trying to edit
                    const message = await interaction.fetchReply();
                    if (message && message.deletable) {
                        // Remove the rules embed (by editing with empty content)
                        await interaction.editReply({
                            embeds: [],
                            content: 'Rules menu has been disabled due to timeout.'
                        });
                    }
                } catch (error) {
                    console.error('Could not disable help menu after timeout:', error);
                }
            }, 30000); // 30 seconds

        } catch (error) {
            console.error('Error executing rules command:', error);
            // Fallback reply in case of failure
            await interaction.reply({
                content: 'There was an error executing this command.',
                ephemeral: true
            });
        }
    },
};
