/** @param {import(".").NS} ns */
export async function main(ns) {
	// General approach inspired by
	// https://www.reddit.com/r/Bitburner/comments/tuw2fc/comment/i366768/?utm_source=share&utm_medium=web2x&context=3
	// This script follows a pattern with 5 possible tasks for gang members. It is primarily expected to be used for
	// combat gangs and is largely untested/untweaked for hacking, but should work.
	//
	// Training: When a new member is hired, they go into a long training phase. The length of this training is determined
	// by the training phase constants defined below. A member in training will ascend each time their multipliers increase by
	// trainingAscentMultiplier, until their multipliers are above trainStatsToMultiplier. The logic will intentionally
	// overshoot this target, to provide a cushion so that if you happen to install augmentations a few times, you won't
	// throw everyone in your gang back into training.
	//
	// Development: Members who have completed training will the enter a 'Development' phase, intended to rapidly build their
	// reputation. This phase should be reasonably short, just long enough to ensure that the gang's overall reputation is a
	// healthy minimum, which ensures new members will be hired and keeps the wanted penalty low.
	//
	// Maturity: Members who have completed development enter their maturity phase, where they focus on bringing in money.
	// When the gang's wanted level goes above a threshold (wantedTolerance), mature members will work to reduce it. For a
	// combat gang, when the overall clash victory chance is below a threshold (clashTolerance, or absolutePowerMargin above
	// the power of the most powerful rival), mature members with good stats (minMemberCombatStatSumForWarfare) will engage
	// in warfare.
	//
	// Mature gang members will periodically ascend when their multipliers have increased by maturityAscentMultiplier, rising
	// back through training and development to maturity again. This process is obviously faster each time.
	//
	// Gang Equipment: This script is greedy when buying augments for gang members, as these are retained when ascending, and
	// is conservative about buying other equipment, especially for members in their training phase, who ascend frequently and
	// contribute no income.
	//
	// The logic for buying augments will simply buy the most expensive available augment that boosts any primary stat for any
	// gang member who can use it, all the time, regarless of the augment's benefits or cost. This will mean that, until
	// all 12 gang members are fully augmented, whenever your cash float gets to a few billion it will be spent by this script.
	// If you don't want this to happen, the relevant logic can be found under "Equipment and upgrades" and under
	// "Manage Equipment" below.
	//
	// Non-augment equipment, along with augments for non-primary stats, are purchased based on whether the gang's income makes
	// them a justifiable expense. The logic checks how many seconds of the gang's income it will take to pay for the upgrade.
	// For gang members out of training, equipment is bought if it takes less than buyUpgradesWorthSeconds (default 5 seconds)
	// for the gang to earn the cost. However, for gang members in training, this equipment is lost with each ascent, but can
	// speed or enhance their training progress; for these members, equipment is only bought if it costs less than
	// buyUpgradesWorthSecondsInTraining. Note that since this logic works from the gang's current total income, if for any
	// reason no gang members are currently generating income, all non-augment purchasing will halt.
	//
	// Customise your gang member names by changing this array. A name will be randomly selected every name.

	const memberNames = [
		"Brigitte", "Annabelle", "Clementine", "Eleanor", "Monique",
		"Augustine", "Earnest", "Eugene", "Ignatius", "Terrence",
	];
	const generateName = () => {
		const newName = memberNames[Math.floor(Math.random() * memberNames.length)];
		const number = ns.nFormat(ns.gang.getMemberNames().filter((name) => name.startsWith(newName)).length, "00");
		return newName + "_" + number;
	}

	ns.disableLog("sleep");
	ns.tail();

	// First, confirm we are in a gang. If we aren't, we will try to join and create any available gang.
	// This logic favours combat over hacking, from highest to lowest level faction. Reorder this array to change preferences.
	if (!ns.gang.inGang()) {
		const gangFactions = [
			// Combat
			"Speakers for the Dead", "The Dark Army", "The Syndicate", "Tetrads", "Slum Snakes",
			// Hacking
			"The Black Hand", "NiteSec"
		];
		if (!gangFactions
			.some((faction) => { ns.singularity.joinFaction(faction); return ns.gang.createGang(faction); })) {
			ns.tprint("Could not create gang for any faction.");
			ns.exit();
		}
	}
	
	const isHackingGang = ns.gang.getGangInformation().isHacking;
	const allStats = ["hack", "str", "def", "dex", "agi", "cha"];
	const combatStats = ["str", "def", "dex", "agi"];
	const primaryStats = isHackingGang ? ["hack"] : combatStats;
	const statAscMult = (stat) => stat + "_asc_mult";

	// Training phase constants and logic
	const trainingAscentMultiplier = 2; // When in training, new hires will ascend each time their multipliers increase by this much
	const trainStatsToMultiplier = 10; // New hires will be trained until their ascenscion multipliers are this much
	const trainStatsToLevel = 250; // After a member ascends, training will bring stats to this minimum level before other tasks
	const trainingTask = isHackingGang ? "Train Hacking" : "Train Combat";
	const isReadyToAscendRelative = function (name, multiplier, any = false) {
		const ascend = ns.gang.getAscensionResult(name);
		if (ascend === undefined) { return false; };
		const info = ns.gang.getMemberInformation(name);
		const condition = (stat) => info[statAscMult(stat)] * ascend[stat] - info[statAscMult(stat)] >= multiplier;
		return any ? allStats.some(condition) : primaryStats.every(condition);
	};
	const isReadyToAscendAbsolute = function (name, multiplier, any = false) {
		const ascend = ns.gang.getAscensionResult(name);
		if (ascend === undefined) { return false; };
		const info = ns.gang.getMemberInformation(name);
		const condition = (stat) => info[statAscMult(stat)] * ascend[stat] >= multiplier;
		return any ? allStats.some(condition) : primaryStats.every(condition);
	};
	const isTrainingComplete = function (name) {
		const info = ns.gang.getMemberInformation(name);
		return primaryStats.every((stat) => info[statAscMult(stat)] >= trainStatsToMultiplier && info[stat] >= trainStatsToLevel);
	};
	const ascendMe = function (name) {
		const info = ns.gang.getMemberInformation(name);
		const ascension = ns.gang.ascendMember(name);
		if (ascension === undefined) {
			ns.print("Ascension failed!");
		} else {
			ns.print(allStats.map((stat) => stat + ": x" + ns.nFormat(info[statAscMult(stat)] * ascension[stat], "0.00a")).join(", "));
			ns.gang.setMemberTask(name, trainingTask);
		}
	};

	// Development constants
	const developStatSumToLevel = 2500;
	const developmentTask = "Terrorism";
	const isMature = function (name) {
		const info = ns.gang.getMemberInformation(name);
		const totalLevels = primaryStats.map((stat) => info[stat]).reduce((tot, next) => tot + next, 0);
		return totalLevels > developStatSumToLevel;
	}

	// Maturity constants
	const maturityAscentMultiplier = 5;
	const matureTask = "Human Trafficking";

	// Wanted levels
	const wantedTolerance = 0.95;
	const respectThreshold = Math.ceil(-wantedTolerance / (wantedTolerance - 1)) * 10; // If respect is below this threshold, we don't bother with wanted level
	const wantedTask = ns.gang.getGangInformation().isHacking ? "Ethical Hacking" : "Vigilante Justice";

	// Clash and territory
	const clashTolerance = 2/3;
	const absolutePowerMargin = 100;
	const minMemberRespectForWarfare = (390625 / 3) * 1.02; // Ensures that a fourth gang member will be recruited before we get all gung-ho
	const minMemberCombatStatSumForWarfare = 1500 * 4;
	const clashTask = "Territory Warfare"; 
	const allOtherGangs = Object.keys(ns.gang.getOtherGangInformation())
			.filter((_gang) => _gang !== ns.gang.getGangInformation().faction);
	const warfareIsOkay = () => {
		const myGangInfo = ns.gang.getGangInformation();
		if (myGangInfo.isHacking) return false;
		const gangsWithTerritory = allOtherGangs.filter((_gang) => ns.gang.getOtherGangInformation()[_gang].territory > 0);
		const clashChance = gangsWithTerritory
			.map((_gang) => myGangInfo.power / (ns.gang.getOtherGangInformation()[_gang].power + myGangInfo.power))
			.reduce((tot, next) => tot + next, 0) / gangsWithTerritory.length;
		const maxOtherGangPower = Math.max(...gangsWithTerritory.map((_gang) => ns.gang.getOtherGangInformation()[_gang].power));
		const warfareOkay = clashChance >= clashTolerance || myGangInfo.power >= (maxOtherGangPower + absolutePowerMargin);
		return warfareOkay;
	}

	// Equipment and upgrades
	const buyUpgradesWorthSeconds = 5; // Buy any upgrade that's less than this * gang income
	const buyUpgradesWorthSecondsInTraining = 1; // Buy any upgrade that's less than this * gang income
	const canAffordUsefulAugment = (aug) => ns.gang.getEquipmentCost(aug) < (ns.getPlayer().money * 0.1);
	const usefulAugments = ns.gang.getEquipmentNames()
		.filter((equip) => ns.gang.getEquipmentType(equip) == "Augmentation")
		.filter((aug) => primaryStats.some((stat) => ns.gang.getEquipmentStats(aug)[stat] >= 0))
		.sort((prev, curr) => ns.gang.getEquipmentCost(curr) - ns.gang.getEquipmentCost(prev));
	const equipment = ns.gang.getEquipmentNames()
		.filter((equip) => ns.gang.getEquipmentType(equip) !== "Augmentation" || !usefulAugments.includes(equip))
		.sort((prev, curr) => ns.gang.getEquipmentCost(prev) - ns.gang.getEquipmentCost(curr));

	const confirmOrAssignTask = function (memberName, taskName) {
		if (ns.gang.getMemberInformation(memberName).task !== taskName) {
			ns.gang.setMemberTask(memberName, taskName);
		}
	};

	while (true) {
		// Recruit
		while (ns.gang.canRecruitMember()) {
			ns.gang.recruitMember(generateName());
		}

		const gangInfo = ns.gang.getGangInformation();

		// Manage warfare
		const warfare = warfareIsOkay();
		if (gangInfo.territoryWarfareEngaged != warfare) {
			ns.gang.setTerritoryWarfare(warfare);
		}

		// Manage upgrades
		// Buy all useful augments that we can afford, from most to least expensive, for anyone eligible.
		// if (ns.gang.getGangInformation().moneyGainRate > 0) {
		usefulAugments
			.filter((aug) => canAffordUsefulAugment(aug))
			.map((aug) => { return { name: aug, cost: ns.gang.getEquipmentCost(aug) } })
			.forEach((aug) => ns.gang.getMemberNames().forEach((person) => {
				if (aug.cost <= ns.getPlayer().money
					&& !ns.gang.getMemberInformation(person).augmentations.includes(aug.name)
				) {
					ns.gang.purchaseEquipment(person, aug.name);
				}
			}));
		// };
		// Buy upgrades that are cheap enough
		const memberUpgradeInfo = ns.gang.getMemberNames()
			.map((person) => {
				const memberInfo = ns.gang.getMemberInformation(person);
				return {
					name: person,
					maxSpend: gangInfo.moneyGainRate * 5 * ((memberInfo.task.startsWith("Train") || memberInfo.task == "Unassigned") ? buyUpgradesWorthSecondsInTraining : buyUpgradesWorthSeconds),
					upgrades: memberInfo.upgrades.concat(memberInfo.augmentations)
				}
			});
		equipment
			.map((equip) => { return { name: equip, cost: ns.gang.getEquipmentCost(equip) } })
			.forEach((equip) => memberUpgradeInfo.forEach((person) => {
				if (!(person.upgrades.includes(equip.name))
					&& equip.cost <= Math.min(person.maxSpend, ns.getPlayer().money)
				) {
					ns.gang.purchaseEquipment(person.name, equip.name);
				}
			}));

		// Manage members
		ns.gang.getMemberNames().forEach((name) => {
			const gangMemberInfo = ns.gang.getMemberInformation(name);
			if (isTrainingComplete(name)) {
				// Training complete

				if (isMature(name)) {
					// Development complete

					// Ascend if criteria met
					if (isReadyToAscendRelative(name, maturityAscentMultiplier, true)) {
						ascendMe(name);
						return;
					}

					// Check wanted tolerance
					if (gangInfo.clashChance == 0 && gangInfo.respect > respectThreshold && gangInfo.wantedPenalty < wantedTolerance) {
						confirmOrAssignTask(name, wantedTask);
						return;
					}

					// Check clash victory tolerance
					if (!gangInfo.isHacking && !gangInfo.territoryWarfareEngaged
						&& gangMemberInfo.earnedRespect >= minMemberRespectForWarfare
						&& combatStats.map((stat) => gangMemberInfo[stat]).reduce((a, b) => a + b, 0) >= minMemberCombatStatSumForWarfare
					) {
						confirmOrAssignTask(name, clashTask);
						return;
					}

					confirmOrAssignTask(name, matureTask);
				} else {
					confirmOrAssignTask(name, developmentTask);
				}
			} else {
				// Training in progress

				// Ascend if criteria met
				if (isReadyToAscendRelative(name, trainingAscentMultiplier) /*|| isReadyToAscendAbsolute(name, trainStatsToMultiplier)*/) {
					ascendMe(name);
					return;
				}

				confirmOrAssignTask(name, trainingTask);
			}
		});
		
		await ns.sleep(100);
	}
}