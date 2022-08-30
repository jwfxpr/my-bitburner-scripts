import { getCurrentBlackOp } from "burnTheBlade.js";
import { bigFormat, corruptText } from "helperlib.js"
import { symbolToInfo, checkTix } from "chaseAlpha.js"

/** @param {import(".").NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");

	// Color and formatting literals
	const moneyColour = 'color: #ffd700; ';
	const whiteColour = 'color: #faffdf; ';
	const redColour = 'color: #dd3434; ';
	const noColour = '';
	const numFmt = "0,0.00a";
	const pctFmt = "0,0.00%";
	const moneyFmt = "$0,0.00a";
	const secondsFmt = "[0:0]0:00";

	const bonusTimeThreshold = 5000;

	// Formatting functions
	const span = function (innerText, style = "", title = "") {
		const styleElement = style === "" ? "" : ' style="' + style + '"';
		const titleElement = title === "" ? "" : ' title="' + title + '"';
		return '<span' + styleElement + titleElement + '>' + innerText + '</span>';
	}
	const money = (value) => span(ns.nFormat(value, moneyFmt), moneyColour);
	const moneyOrRed = (value, isYellow = true) => span(ns.nFormat(value, moneyFmt), (isYellow ? moneyColour : redColour));
	const metricSpace = (value) => value < 1000 ? '&nbsp' : '';

	// Host discovery
	const allHostnames = ns.scan();
	for (let i = 0; i < allHostnames.length; i++) {
		recurseScan(ns, allHostnames[i], allHostnames);
	}
	const w0rld_d34mon = allHostnames.includes("w0rld_d34mon");

	// Bitnode
	const bnMultipliers = ns.getBitNodeMultipliers();
	const baseNFGCost = 500 * bnMultipliers.AugmentationRepCost;

	// Bladeburner
	const blopsHeaderColour = ns.singularity.getOwnedAugmentations().includes("The Blade's Simulacrum") ? noColour : redColour;

	let doc = eval("document");
	const hook0 = doc.getElementById('overview-extra-hook-0');
	const hook1 = doc.getElementById('overview-extra-hook-1');
	while (true) {
		try {
			const player = ns.getPlayer();
			const headers = []
			const values = [];
			const addStat = function (header, value) {
				headers.push(header);
				values.push(value);
			}

			// w0rld_d34mon notification
			if (w0rld_d34mon) {
				const server = ns.getServer("w0rld_d34mon");
				const color = server.hasAdminRights ? redColour
					: server.hackDifficulty <= player.skills.hacking ? whiteColour : noColour;
				const text = server.hasAdminRights ? corruptText("w0rld_d34mon") : "" + server.hackDifficulty;
				addStat(
					"TRP",
					span(text, color)
				);
			}

			// RAM usage
			addStat(
				"RAM",
				ns.nFormat((ns.getServerUsedRam("home") / ns.getServerMaxRam("home")), pctFmt)
			);

			// Stock
			if (checkTix(ns, false)) {
				const stockValues = ns.stock.getSymbols().map((sym) => symbolToInfo(ns, sym))
					.map((info) => info.position.longShares * info.bidPrice + info.position.shortShares * info.askPrice)
					.filter((val) => val !== 0);
				if (stockValues.length > 0) {
					const netWorth = stockValues.reduce((a, b) => a + b, 0);
					addStat(
						"Pfolio",
						moneyOrRed(netWorth, netWorth > 0)
					);
				}

			}

			//Script income per second
			const scriptIncome = ns.getTotalScriptIncome()[0];
			addStat(
				"Scripts",
				money(scriptIncome) + metricSpace(scriptIncome) + '/s'
			);

			// Script exp gain rate per second
			const scriptXp = ns.getTotalScriptExpGain();
			addStat(
				"&nbsp;",
				ns.nFormat(scriptXp, numFmt) + metricSpace(scriptXp) + '/s'
			);

			//Nodes income per second
			if (ns.hacknet.numNodes() > 0) {
				const isHashing = ns.hacknet.hashCapacity() !== 0
				const nodeCount = ns.hacknet.numNodes();
				let nodesIncome = 0.0;
				for (let i = 0; i < nodeCount; i++) {
					nodesIncome += ns.hacknet.getNodeStats(i).production;
				}
				const incomePrefix = isHashing ? "" : "$";
				const incomeColor = !isHashing ? moneyColour :
					(!ns.scriptRunning("reapTheHarvest.js", "home") ? redColour
						: (ns.scriptRunning("plantTheSeeds.js", "home") ? whiteColour : noColour));
				addStat(
					"Nodes",
					span(incomePrefix + ns.nFormat(nodesIncome, numFmt) + metricSpace(nodesIncome) + '/s', incomeColor)
					// money(nodesIncome) + metricSpace(nodesIncome) + '/s'
				);
			}

			//Gang
			if (ns.gang.inGang()) {
				const myGang = ns.gang.getGangInformation();
				const gangMoney = myGang.moneyGainRate * 5;
				addStat(
					"Gang" + (ns.gang.getBonusTime() < bonusTimeThreshold ? "" : " ⏳"),
					moneyOrRed(gangMoney, !ns.gang.canRecruitMember()) + metricSpace(gangMoney) + '/s'
				);

				const penalty = 1 - myGang.wantedPenalty;
				if (penalty > 0.00005) {
					const penaltyColour = ns.gang.getMemberNames().some((name) => {
						const task = ns.gang.getMemberInformation(name).task;
						return task === "Ethical Hacking" || task === "Vigilante Justice";
					})
						? whiteColour : noColour;
					addStat(
						"&nbsp;Pen",
						span('-' + ns.nFormat(penalty, pctFmt), penaltyColour)
					)
				}

				if (myGang.territory < 1) {
					const otherGangs = Object.keys(ns.gang.getOtherGangInformation()).filter((_gang) => _gang !== myGang.faction);
					const gangsWithTerritory = otherGangs.filter((_gang) => ns.gang.getOtherGangInformation()[_gang].territory > 0);
					const clashChance = gangsWithTerritory
						.map((_gang) => myGang.power / (ns.gang.getOtherGangInformation()[_gang].power + myGang.power))
						.reduce((tot, next) => tot + next, 0) / gangsWithTerritory.length;
					const territoryColour = ns.gang.getGangInformation().territoryWarfareEngaged ? whiteColour : "";
					addStat(
						"&nbsp;Terr",
						span(ns.nFormat(myGang.territory, pctFmt), territoryColour)
					);
					const clashChanceColour = ns.gang.getMemberNames().some((name) => ns.gang.getMemberInformation(name).task == "Territory Warfare")
						? whiteColour : noColour;
					addStat(
						"&nbsp;vs " + gangsWithTerritory.length,
						span(ns.nFormat(clashChance, pctFmt), clashChanceColour)
					);
				}
			}

			//Crime
			if (!ns.gang.inGang() && ns.heart.break() != 0) {
				addStat(
					"Karma",
					ns.nFormat(ns.heart.break(), numFmt) + ", " + ns.nFormat(player.numPeopleKilled, "0,0a")
				);
			} else if (player.numPeopleKilled > 0 && !player.factions.includes("Speakers for the Dead")) {
				addStat(
					"Kills",
					span(ns.nFormat(player.numPeopleKilled, "0,0a"), player.numPeopleKilled >= 30 ? whiteColour : noColour)
				);
			}

			if (ns.getPlayer().hasCorporation) {
				const corp = ns.corporation.getCorporation();
				const data = corp.public ? span("$" + bigFormat(corp.dividendEarnings, 2), moneyColour) + metricSpace(corp.dividendEarnings) + "/s"
					: span("$" + bigFormat(ns.corporation.getInvestmentOffer().funds, 2), moneyColour);
				addStat(
					"Corp",
					data
				)
			}

			//Work rep
			const currentWork = ns.singularity.getCurrentWork();
			switch (currentWork?.type) {
				case "COMPANY":
					const company = currentWork.companyName;
					const companyRep = ns.singularity.getCompanyRep(company);
					if (companyRep < 400000) {
						const companyServer = allHostnames.find((host) => ns.getServer(host).organizationName == company);
						const repColour = ns.getServer(companyServer).backdoorInstalled ? whiteColour : redColour;
						addStat(
							"WorkRep",
							span(ns.nFormat(companyRep, numFmt), repColour)
						);
					}
					break;

				case "FACTION":
					const faction = currentWork.factionName;
					const myOwnedAugments = ns.singularity.getOwnedAugmentations(true);
					const augmentsAvailable = ns.singularity.getAugmentationsFromFaction(faction)
						.filter((aug) => !myOwnedAugments.includes(aug))
						// .map((aug) => ns.singularity.getAugmentationStats(aug))
						.sort((prev, curr) => ns.singularity.getAugmentationRepReq(prev) - ns.singularity.getAugmentationRepReq(curr));
					const totalFactionRep = ns.singularity.getFactionRep(faction);
					const augmentsInReach = augmentsAvailable.filter((aug) => ns.singularity.getAugmentationRepReq(aug) < totalFactionRep);

					// NeuroFlux Governor level
					// const nextNFGCost = ns.singularity.getAugmentationRepReq("NeuroFlux Governor");
					// const nfgLevel = -Math.round(Math.log(baseNFGCost / ns.singularity.getAugmentationRepReq("NeuroFlux Governor")) / (-Math.log(2) + Math.log(3) - 2 * Math.log(5) + Math.log(19)));
					// const nextNFGLevel = function () {
					// 	let i = 0;
					// 	while ((baseNFGCost * 1.14 ^ i) <= totalFactionRep) { i++; }
					// 	return i;
					// }
					// const nextNFGCost = function () {
					// 	return baseNFGCost * 1.14 ^ nextNFGLevel();
					// }

					addStat(
						"Augs",
						span(augmentsInReach.length + "/" + augmentsAvailable.length /* + "+" + (Math.max(0, nextNFGLevel() - nfgLevel - 1) > 99 ? "+" : Math.max(0, nextNFGLevel() - nfgLevel - 1))*/, (augmentsInReach.length < augmentsAvailable.length ? whiteColour : noColour))
					);

					const nextAug = augmentsAvailable.find((aug) => ns.singularity.getAugmentationRepReq(aug) > totalFactionRep);
					if (nextAug !== undefined) {
						const workStats = ns.formulas.work.factionGains(ns.getPlayer(), currentWork.factionWorkType, ns.singularity.getFactionFavor(currentWork.factionName))
						const remainingRep = //nextAug === undefined
							//? nextNFGCost() :
							ns.singularity.getAugmentationRepReq(nextAug) - totalFactionRep;
						const nextAugSecs = remainingRep / (workStats.reputation * 5);
						addStat(
							"&nbsp;Next",
							span(ns.nFormat(nextAugSecs, secondsFmt), noColour, nextAug)
						);
					}
					break;

				case "CRIME":
					//{"type":"CRIME","cyclesWorked":238881,"crimeType":"HOMICIDE"}
					addStat(
						"Crime",
						ns.nFormat(ns.singularity.getCrimeChance(currentWork.crimeType), pctFmt)
					);
					break;

				case "CLASS":
					//{"type":"CLASS","cyclesWorked":41522,"classType":"LEADERSHIP","location":"ZB Institute of Technology"}
					//{"type":"CLASS","cyclesWorked":43,"classType":"GYMAGILITY","location":"Millenium Fitness Gym"}
					break;
				case null:
				case undefined:
					if (ns.bladeburner.getCurrentAction().type === "Idle" || ns.singularity.getOwnedAugmentations().includes("The Blade's Simulacrum")) {
						addStat(span("Idle", redColour));
					}
					break;
				default: // Print unknown work types for investigation
					addStat(currentWork.type, "&nbsp;");
					break;
			}

			// Bladeburner
			if (player.inBladeburner) {
				const bb = ns.bladeburner;
				const blops = bb.getBlackOpNames();
				const blopsRemaining = blops.filter((op) => bb.getActionCountRemaining("BlackOp", op) > 0).length;
				const doingBlop = blops.includes(bb.getCurrentAction().name);
				const currentBlop = getCurrentBlackOp(ns);
				const canDoBlop = typeof currentBlop === "string" && bb.getBlackOpRank(currentBlop) <= bb.getRank();
				const blopDetail = canDoBlop ? ns.nFormat(bb.getActionEstimatedSuccessChance("BlackOp", currentBlop)[0], pctFmt)
					: ns.nFormat(bb.getRank(), numFmt);
				const dataColour = blopsRemaining == 0 ? redColour :
					(doingBlop ? whiteColour : noColour);
				const data = blopsRemaining == 0 ? corruptText("w0rld_d34mon") : (blopsRemaining + ": " + blopDetail);
				addStat(
					span("BlOp", blopsHeaderColour) + (bb.getBonusTime() < bonusTimeThreshold ? "" : " ⏳"),
					span(data, dataColour)
				);
			}

			// Now drop it into the placeholder elements
			hook0.innerHTML = headers.join("&nbsp;<br />");
			hook1.innerHTML = values.join("<br />");
		} catch (err) { // This might come in handy later
			ns.print("ERROR: Update Skipped: " + String(err));
		}
		await ns.sleep(1000);
	}
}

/**
 *  @param {import(".").NS} ns
  * @param {string} target
  * @param {string[]} allHosts */
function recurseScan(ns, target, allHosts) {
	let hosts = ns.scan(target);
	for (let i = 0; i < hosts.length; i++) {
		if (allHosts.includes(hosts[i])) {
			continue;
		}
		allHosts.push(hosts[i]);
		recurseScan(ns, hosts[i], allHosts);
	}
}

/**
 *  @param {import(".").NS} ns
  * @param {Number} seconds
  * @return {String} */
function secondsToShortTime(ns, seconds) {
	const fmt = "0.0a";
	if (seconds > 60 * 60) {
		return ns.nFormat(seconds / (60 * 60), fmt) + " hr";
	} else if (seconds > 60) {
		return ns.nFormat(seconds / 60, fmt) + " min";
	} else {
		return ns.nFormat(seconds, fmt) + " sec";
	}
}