/**
 * Server Economy System for Pokémon Showdown
 * Old Version: 1.0 Taken From Wavelength Server Repository
 * Version 2.0 By Clark Jones (@smoothopetator07)
 * Version: 2.0 Includes Custom Commands And
 * Compatibility Wit Latest pokemon-showdown files
 * With Latest PokemonShowdown Files And Custom Commands 
 * Description: Implements an economy system with Pokédollars.
 * Compatible with Pokémon Showdown TypeScript system.
 */

'use strict';

import { FS } from '../../lib';

global.ServerName = 'Impulse';
global.currencyName = 'Pokédollar';
global.currencyPlural = 'Pokédollars';

export class Economy {
	constructor() {}

	/**
	 * Reads the specified user's money.
	 */
	readMoney(userid: string): number {
		userid = toID(userid);
		if (userid.startsWith('guest')) return 0;
		return Db.currency.get(userid, 0);
	}

	/**
	 * Writes the specified amount of money to the user's "bank."
	 */
	writeMoney(userid: string, amount: number): void {
		userid = toID(userid);
		if (userid.startsWith('guest')) return;
		amount = Number(amount);
		if (isNaN(amount)) {
			throw new Error(`Economy.writeMoney: Expected a number, received ${typeof amount}`);
		}
		const curTotal = this.readMoney(userid);
		Db.currency.set(userid, curTotal + amount);
	}

	logTransaction(message: string): void {
		if (!message) return;
		FS('logs/transactions.log').append(`[${new Date().toUTCString()}] ${message}\n`);
	}
}

const economy = new Economy();

export const commands: Chat.ChatCommands = {
	wallet(target, room, user) {
		if (!target) target = user.name;
		if (!this.runBroadcast()) return;
		const userid = toID(target);
		if (!userid) return this.errorReply('Invalid username.');

		const money = economy.readMoney(userid);
		this.sendReplyBox(`${target} has ${money} ${money === 1 ? global.currencyName : global.currencyPlural}.`);
	},
	
	richestuser(target, room, user) {
	if (!this.runBroadcast()) return;
	const limit = Math.max(1, Math.min(Number(target) || 10, 100)); // Ensures limit is between 1-100
		const users = Db.currency.keys().map(name => ({ name: toID(name), money: economy.readMoney(name) })).filter(user => user.money > 0).sort((a, b) => b.money - a.money).slice(0, limit);
		if (!users.length) return this.sendReplyBox(`<div style="background: linear-gradient(135deg, #1e1f22, #2b2e35); padding: 15px; border-radius: 12px; border: 3px solid #ffd700; box-shadow: 0 5px 15px rgba(0,0,0,0.3); text-align: center; color: #f8f8f8; font-family: Arial, sans-serif;"><h3 style="color:#ffd700;">💰 Richest Trainers in ${global.ServerName} 💰</h3><hr style="border: 1px solid #ffd700;"><p>No rich trainers found.</p></div>`);
		let output = `<div style="background: linear-gradient(135deg, #1e1f22, #2b2e35); padding: 15px; border-radius: 12px; border: 3px solid #ffd700; box-shadow: 0 5px 15px rgba(0,0,0,0.3); text-align: center; color: #f8f8f8; font-family: Arial, sans-serif;"><h3 style="color:#ffd700; text-shadow: 1px 1px 3px rgba(0,0,0,0.4);">💰 Richest Trainers in ${global.ServerName} 💰</h3><hr style="border: 1px solid #ffd700;"><table style="width: 90%; max-width: 450px; margin: auto; border-collapse: collapse; text-align: left;"><tr style="background: #ffd700; color: #222; font-weight: bold;"><th style="padding: 10px; border-bottom: 2px solid #444;">#</th><th style="padding: 10px; border-bottom: 2px solid #444;">Trainer</th><th style="padding: 10px; border-bottom: 2px solid #444;">${global.currencyPlural}</th></tr>`;
		users.forEach((entry, index) => {
			const rowStyle = index % 2 === 0 ? "background: rgba(255,255,255,0.1);" : "background: rgba(0,0,0,0.2);";
			output += `<tr style="${rowStyle}"><td style="padding: 10px; border-bottom: 1px solid #444;">${index + 1}</td><td style="padding: 10px; border-bottom: 1px solid #444;">${entry.name}</td><td style="padding: 10px; border-bottom: 1px solid #444;">${entry.money}</td></tr>`;
		});
		output += `</table><hr style="border: 1px solid #ffd700;"><p style="color: #f8f8f8; font-size: 14px; font-weight: bold;">✨ <i>Can you become the richest Trainer?</i> ✨</p></div>`;
		this.sendReplyBox(output);
	},

	economy: {
		give(target, room, user) {
			this.checkCan('globalban');
			const [targetUser, amountStr, reason] = target.split(',').map(part => part.trim());
			if (!targetUser || !amountStr || !reason) return this.errorReply("Usage: /economy give [user], [amount], [reason]");
			
			const amount = Math.round(Number(amountStr));
			if (isNaN(amount) || amount < 1 || amount > 1000) return this.errorReply("Amount must be a number between 1 and 1000.");

			economy.writeMoney(targetUser, amount);
			this.sendReply(`${targetUser} has received ${amount} ${global.currencyPlural}.`);
			economy.logTransaction(`${user.name} gave ${amount} ${global.currencyPlural} to ${targetUser}. Reason: ${reason}`);
		},

		take(target, room, user) {
			this.checkCan('globalban');
			const [targetUser, amountStr, reason] = target.split(',').map(part => part.trim());
			if (!targetUser || !amountStr || !reason) return this.errorReply("Usage: /economy take [user], [amount], [reason]");
			
			const amount = Math.round(Number(amountStr));
			if (isNaN(amount) || amount < 1 || amount > 1000) return this.errorReply("Amount must be a number between 1 and 1000.");

			economy.writeMoney(targetUser, -amount);
			this.sendReply(`You removed ${amount} ${global.currencyPlural} from ${targetUser}.`);
			economy.logTransaction(`${user.name} took ${amount} ${global.currencyPlural} from ${targetUser}. Reason: ${reason}`);
		},

		transfer(target, room, user) {
			const [targetUser, amountStr] = target.split(',').map(part => part.trim());
			if (!targetUser || !amountStr) return this.errorReply("Usage: /economy transfer [user], [amount]");

			const amount = Math.round(Number(amountStr));
			if (isNaN(amount) || amount < 1 || amount > 1000) return this.errorReply("Amount must be a number between 1 and 1000.");

			const userMoney = economy.readMoney(user.id);
			if (userMoney < amount) return this.errorReply(`You don't have enough ${global.currencyPlural}.`);

			economy.writeMoney(user.id, -amount);
			economy.writeMoney(targetUser, amount);

			this.sendReply(`You transferred ${amount} ${global.currencyPlural} to ${targetUser}.`);
			economy.logTransaction(`${user.name} transferred ${amount} ${global.currencyPlural} to ${targetUser}.`);
		},

		reset(target, room, user) {
			this.checkCan('globalban');
			const userid = toID(target);
			if (!userid) return this.errorReply("Invalid username.");
			Db.currency.set(userid, 0);
			this.sendReply(`${userid} now has 0 ${global.currencyPlural}.`);
		},

		log(target, room, user) {
			if (!this.can('mod')) return false;
			const logs = FS('logs/transactions.log').readIfExistsSync().split('\n').reverse();
			const count = Number(target) || 10;
			const output = logs.slice(0, count).join('\n');
			user.popup("|wide|" + output);
		},
		
		giveaway(target, room, user) {
		room = this.requireRoom();
		this.checkCan('declare', null, room);

		const [amountStr, timeStr] = target.split(',').map(part => part.trim());
		const amount = Math.round(Number(amountStr));
		let timeLeft = Math.round(Number(timeStr));

		if (isNaN(amount) || amount < 1) return this.errorReply("Usage: /economy giveaway [amount], [time in seconds]");
		if (isNaN(timeLeft) || timeLeft < 30 || timeLeft > 300) return this.errorReply("Time must be between 30 and 300 seconds.");

		const userBalance = economy.readMoney(user.id);
		if (userBalance < amount) return this.errorReply(`You don't have enough ${global.currencyPlural} to give away.`);

		const onlineUsers = [...Users.users.values()]
			.filter(u => u.connected && u.id !== user.id)
			.map(u => u.id);

		if (onlineUsers.length < 1) return this.errorReply("At least two users must be online to start a giveaway.");

		economy.writeMoney(user.id, -amount);
		economy.logTransaction(`${user.name} started a giveaway of ${amount} ${global.currencyPlural}.`);

		const giveawayId = `giveaway-${room.roomid}-${Date.now()}`;
		const style = "background:linear-gradient(135deg,#2c2f36,#3b3f47);padding:15px;border-radius:12px;border:3px solid #ffd700;text-align:center;color:#f8f8f8;";
		room.add(`|uhtml|${giveawayId}|<div style="${style}"><h3 style="color:#ffd700;">🎁 A Giveaway Has Started! 🎁</h3><p><b>${user.name}</b> is giving away <b>${amount} ${global.currencyPlural}</b>!</p><p>The winner will be chosen in <b>${timeLeft} seconds</b>. Stay online for a chance to win!</p></div>`).update();

		const updateCountdown = setInterval(() => {
			timeLeft -= 10;
			if (timeLeft <= 0) {
				clearInterval(updateCountdown);
				return;
			}
			room.add(`|uhtmlchange|${giveawayId}|<div style="${style}"><h3 style="color:#ffd700;">🎁 A Giveaway Is Ongoing! 🎁</h3><p><b>${user.name}</b> is giving away <b>${amount} ${global.currencyPlural}</b>!</p><p>Time left: <b>${timeLeft} seconds</b>. Stay online for a chance to win!</p></div>`).update();
		}, 10000);

		setTimeout(() => {
			clearInterval(updateCountdown);

			const winnerId = onlineUsers[Math.floor(Math.random() * onlineUsers.length)];
			const winner = Users.get(winnerId);

			if (!winner) {
				room.add(`|uhtmlchange|${giveawayId}|<div style="${style}"><h3 style="color:#ffd700;">⚠ Giveaway Canceled ⚠</h3><p>No eligible users were online. The giveaway has been canceled.</p></div>`).update();
				return;
			}

			economy.writeMoney(winner.id, amount);
			economy.logTransaction(`${winner.name} won a giveaway of ${amount} ${global.currencyPlural}.`);

			room.add(`|uhtmlchange|${giveawayId}|<div style="${style}"><h3 style="color:#ffd700;">🎉 Giveaway Winner! 🎉</h3><p>Congratulations, <b>${winner.name}</b>! You have won <b>${amount} ${global.currencyPlural}</b> from ${user.name}!</p></div>`).update();

			winner.send(`🎉 You have won the giveaway of **${amount} ${global.currencyPlural}**!`);
			user.send(`Your giveaway has ended! The winner is **${winner.name}**, and they have received **${amount} ${global.currencyPlural}**.`);
		}, timeLeft * 1000);
	},
			
		help(target, room, user) {
			if (!this.runBroadcast()) return;
			let helpHTML = getModernEconomyHelpHTML();
			// Check if the user is at least a Moderator (%) or higher
			if (!user.can('lock')) {
				// Remove the staff commands section for regular trainers
				helpHTML = helpHTML.replace(/<div style="[^>]+">.*?<h4 style="color:#B22222;">🔱 Staff Commands<\/h4>.*?<\/div>/s, '');
			}
			this.sendReplyBox(helpHTML);
		},
	},
};

function getModernEconomyHelpHTML(): string { 
	return `<div style="background:linear-gradient(135deg,#2c2f36,#3b3f47);padding:15px;border-radius:12px;border:3px solid #ffd700;text-align:center;color:#f8f8f8;"><h3 style="color:#ffd700;">💰 ${global.ServerName} Economy System 💰</h3><div style="margin-top:10px;padding:10px;border-radius:8px;background:rgba(70,130,180,0.3);border-left:5px solid #4a90e2;"><h4 style="color:#4a90e2;">⚡ Trainer Commands</h4><b>/wallet [user]</b> - Check balance.<br><b>/richestuser [limit]</b> - View top trainers.<br><b>/economy transfer [user], [amount]</b> - Send ${global.currencyPlural}.<br><b>/economy giveaway [amount], [time]</b> - Start a giveaway (Room Owners #+ only).<br><b>/economy help</b> - View this help menu.<br></div><div style="margin-top:10px;padding:10px;border-radius:8px;background:rgba(220,20,60,0.3);border-left:5px solid #e63946;"><h4 style="color:#e63946;">🔱 Staff Commands</h4><b>/economy give [user], [amount]</b> - Give ${global.currencyPlural}.<br><b>/economy take [user], [amount]</b> - Remove ${global.currencyPlural}.<br><b>/economy reset [user]</b> - Reset a trainer’s balance.<br><b>/economy log</b> - View logs.<br></div></div>`; 
}
