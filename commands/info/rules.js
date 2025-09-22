const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('📜 Shows server guidelines.'),

  async execute(interaction, client, db) {
    // 👉 DEFER without "ephemeral" — use flags if needed
    await interaction.deferReply();

    try {
      let rules = await db.get(`server_rules_${interaction.guild.id}`);
      rules = String(rules || ""); // Coerce to string to avoid .split() error

      if (!rules || rules.trim() === "") {
        rules = `**📜 Server Rules & Guidelines**

Welcome! To keep this community safe and enjoyable for everyone, please follow these rules. Violations may result in warnings, mutes, kicks, or bans. Use \`/report\` to notify staff of issues.

---

### 1. ✨ Be Respectful & Kind
- Treat everyone with dignity — no harassment, hate speech, discrimination, or toxicity.
- Absolutely no bad manners. Treat others as you’d want to be treated.
- No drama or heated public arguments — take it to DMs or use the ticket system.
- Do not attempt to poach members or mass kick users — this is strictly forbidden.

Furthermore, **do not post or share content that is**:
- Political, abusive, or threatening;
- Obscene, defamatory, or libelous;
- Racist, sexist, religiously offensive;
- Or otherwise objectionable, harmful, or offensive in nature.

---

### 2. 🚫 No Spam or Disruptive Behavior
- Do not flood chats, rapidly send messages, overuse caps/emojis, or spam mentions.
- Do not abuse bots — including bypassing filters or misusing commands.
- Use the **ticket system** to contact staff for support — don’t spam channels or DMs.

---

### 3. 🔞 Keep It SFW & Private
- **All content must be Safe For Work** — no NSFW images, links, or discussions.
- **Never share personal information** — yours or others’ (real names, addresses, socials, etc.). Violation = permanent ban.
- This applies to **DMs too** — do not privately harass or doxx members.

---

### 4. 📢 No Advertising or Self-Promotion
- Do not advertise other servers, products, services, or content — **including in DMs**.
- Do not invite bots or attempt to modify server settings without staff permission.
- Found someone DM-advertising? **Screenshot it and report to staff immediately.**

---

### 5. 🎯 Stay On-Topic & Use Channels Properly
- Channel names indicate their purpose — keep discussions relevant.
- Off-topic posts may be removed; repeated violations may be moderated.

---

### 6. 🎧 Voice Chat Rules (Also Apply!)
- No excessively loud noises, screeching, or disruptive audio.
- Music bots must **not** play offensive, discriminatory, or mature content.
- If someone is streaming/recording, be mindful — assume you’re on mic!

---

### 7. ⚖️ Follow Platform & Game Terms
**Discord ToS**: You agree to follow Discord’s Terms of Service and Community Guidelines.

**Supercell Games (e.g., Clash of Clans, Brawl Stars, etc.)**:
- Do **not** discuss buying/selling/trading game accounts.
- Do **not** promote or discuss exploits, hacks, or unauthorized third-party software.
- Report cheaters/hackers to staff — don’t accuse publicly.

---

### 8. 🚨 Reporting & Enforcement
- Only submit **legitimate reports** — fake or frivolous reports may result in punishment.
- Staff decisions are final. Arguing with moderation = additional consequences.
- Repeated or severe violations = escalated penalties, up to permanent ban.

---

Thank you for helping us maintain a positive, safe, and fun community! 🙏`;

        await db.set(`server_rules_${interaction.guild.id}`, rules);
      }

      // Split into sections
      const sections = rules.split(/---\s*\n###/).map(s => s.trim());
      const [intro, ...rest] = sections;

      const embeds = [];

      // First embed
      embeds.push({
        title: '📜 Server Rules & Guidelines',
        description: `**Welcome!** To keep this community safe and enjoyable for everyone, please follow these rules. Violations may result in warnings, mutes, kicks, or bans. Use \`/report\` to notify staff of issues.\n\n${rest[0] ? `### ${rest[0]}` : ''}`,
        color: 0x5865F2,
        footer: { text: 'Page 1/8 — Use /report for issues' }
      });

      // Remaining sections
      rest.slice(1).forEach((section, i) => {
        const pageNum = i + 2;
        embeds.push({
          title: `📜 Section ${pageNum}/8`,
          description: `### ${section}`,
          color: 0x5865F2,
          footer: { text: `Page ${pageNum}/8` }
        });
      });

      // ✅ Use editReply (no ephemeral needed unless you want it)
      await interaction.editReply({ embeds: embeds.slice(0, 10) });

    } catch (error) {
      console.error('Error in /rules:', error);

      // ✅ Use flags: 64 instead of ephemeral: true
      await interaction.editReply({
        content: '❌ Could not load rules. Please try again later.',
        flags: 64 // = ephemeral
      });
    }
  }
};
