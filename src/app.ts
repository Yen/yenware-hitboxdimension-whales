import * as Discord from "discord.js";
import * as https from "https";
import * as fs from "fs";
import fetch from "node-fetch";

const settings = JSON.parse(fs.readFileSync("./settings.json").toString());
const client = new Discord.Client();

async function update() {
	const guild = client.guilds.get(settings.guildId);
	if (!guild) {
		console.error("Could not find guild");
		return;
	}

	const clientGuildMember = guild.members.get(client.user.id);
	if (!clientGuildMember) {
		// how does this even happen?
		console.error("Client was not user in server");
		return;
	}

	if (!clientGuildMember.hasPermission("MANAGE_ROLES")) {
		console.error("No permissions to manage roles");
		return;
	}

	const whaleRole = guild.roles.get(settings.whaleRoleId);
	if (!whaleRole) {
		console.error("Could not find whale role");
		return;
	}

	const twitchSubRole = guild.roles.get(settings.twitchSubRoleId);
	if (!twitchSubRole) {
		console.error("Could not find twitch sub role");
		return;
	}

	const patreonRequest = await fetch("https://api.patreon.com/oauth2/api/current_user/campaigns?include=pledges", {
		headers: {
			"Authorization": `Bearer ${settings.patreonAccessToken}`
		}
	});
	const patreonData = await patreonRequest.json();
	const patreonBackersRaw = patreonData.included.filter((x: any) => x.type == "user") as any[];
	const patreonBackers = patreonBackersRaw
		.map(x => x.attributes.social_connections.discord)
		.filter(x => x != undefined)
		.map(x => x.user_id) as string[];
	const patronBackersMap = new Map(patreonBackers.map(b => [b, guild.members.get(b)!] as [string, Discord.GuildMember]));

	const updatedWhales = new Map<string, Discord.GuildMember>([
		...Array.from(twitchSubRole.members),
		...Array.from(patronBackersMap)
	]);
	const updatedWhalesArray = Array.from(updatedWhales.values());

	const whalesToAdd = updatedWhalesArray.filter(x => !x.roles.has(whaleRole.id));
	const whalesToRemove = whaleRole.members.array().filter(x => !updatedWhalesArray.includes(x));

	// process sequentially because discord.js complains
	for (const w of whalesToAdd) {
		console.log(`Adding "${w.displayName}" to whales`);
		await w.addRole(whaleRole);
	}
	for (const w of whalesToRemove) {
		console.log(`Removing "${w.displayName}" from whales`);
		await w.removeRole(whaleRole);
	}
}

client.on("ready", () => {
	console.log("Discord ready");

	function dontCareErrorWrapper() {
		try {
			update();
		} catch (err) {
			console.error(err);
		}
	}

	dontCareErrorWrapper();
	setInterval(dontCareErrorWrapper, 5 * 60 * 1000); // 5 minutes
});

client.login(settings.loginToken);