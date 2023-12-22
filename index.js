const { Client, GatewayIntentBits } = require('discord.js');
const shell = require("shelljs");
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { clientId, guildId, token, walletName, walletPass, tokensAmount } = require('./config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

const lastRequestTime = {};
const rest = new REST({ version: '9' }).setToken(token);

const commands = [{
    name: 'faucet',
    description: 'REQUEST SOME USELF TOKENS',
    options: [{
        name: 'wallet',
        type: 3,
        description: 'ENTER SELFCHAIN ADDRESS',
        required: true,
    }],
}];

client.on("ready", function () {
    console.log(client.user.username + " is working!");
});

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'faucet') {
        const walletAddress = interaction.options.getString('wallet');
        const userId = interaction.user.id;

        const walletRegex = /^self1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{38}$/;
        if (!walletRegex.test(walletAddress)) {
            await interaction.reply(`<@${interaction.user.id}> \n\n:no_entry_sign: YOU ENTERED AN INCORRECT ADDRESS`);
            return;
        }

        const now = new Date();
        if (lastRequestTime[userId]) {
            const lastRequest = new Date(lastRequestTime[userId]);
            const differenceInHours = (now - lastRequest) / (1000 * 60 * 60);

            if (differenceInHours < 24) {
                await interaction.reply(`<@${interaction.user.id}> \n\n:no_entry_sign: COOLDOWN EXPIRES IN ${Math.trunc(24 - differenceInHours)} HOURS, PLEASE TRY AGAIN LATER`);
                return;
            }
        }

        lastRequestTime[userId] = now.toISOString();

        const cmdSendTokens = `echo -e "${walletPass}\\n${walletPass}\\n" | selfchaind tx bank send ${walletName} ${walletAddress} ${tokensAmount}uself --fees 10000uself --gas 400000 -y`
        const sendTokens = shell.exec(cmdSendTokens, { shell: '/bin/bash', silent: true });
        if (!sendTokens.stderr) {

            const transactionOutput = sendTokens.stdout;
            let txHash;

            const regex = /txhash:\s*([A-F0-9]+)/;
            const match = transactionOutput.match(regex);

            if (match && match[1]) {
                txHash = match[1];
                await interaction.reply(`<@${interaction.user.id}> \n\n:white_check_mark: TRANSACTION WAS SENT: [__${txHash}__](https://explorer-devnet.selfchain.xyz/self/transactions/${txHash} ) \n\n**${tokensAmount / 1000000}SELF** SUCCESSFULLY TRANSFERRED TO **${walletAddress}**`);
            } else {
                await interaction.reply('<@${interaction.user.id}> \n\n:no_entry_sign:FAILED TO GET TRANSACTION HASH');
            }
        } else {
            await interaction.reply('<@${interaction.user.id}> \n\n:no_entry_sign: TRANSACTION WAS FAILED');
        }
    }
});

client.login(token);