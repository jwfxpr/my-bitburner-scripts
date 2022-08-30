import { cityNames } from "database.js"

/**
 * @typedef {Object} SleeveData
 * @property {Number} index
 * @property {String} name
 * @property {SleeveInformation} info
 * @property {SleeveSkills} stats
 * @property {SleeveTask} task
 */

import { bestGym, bestUniversity } from "database.js"

/** @param {import(".").NS} ns */
export async function main(ns) {
	ns.disableLog("sleep");
	ns.tail();

	const sl = ns.sleeve;

	// Sync
	const syncThreshold = 100; // Sync up to this threshold before other activity. This should be skipped, assuming all memory at 100
	const doSync = (thisSleeve) => thisSleeve.stats.sync < syncThreshold;
	const shockThreshold = 85; // Recover down to this threshold before other activity
	const trainCombatSkillsTo = 60;
	const trainingInterval = trainCombatSkillsTo / 4;
	const trainHackingTo = 0;
	const trainCharismaTo = 0;

	const combatSkills = ["strength", "defense", "dexterity", "agility"];
	const allSkills = combatSkills.concat(["hacking", "charisma"]);

	// Local function to calculate a numerical index indicating an augment's net impact on interesting stats
	const mapAugToFactor = (augName, includeFilters) => Object.entries(ns.singularity.getAugmentationStats(augName))
		.filter((entry) => includeFilters.some((_filter) => entry[0].includes(_filter)) && (typeof entry[1] === "number"))
		.map((entry) => entry[1])
		.reduce((a, b) => a * b, 1);
	// Local function to determine if an aug is affordable.
	const canAffordAug = (aug) => aug.cost < (ns.getPlayer().money * 0.1 / sl.getNumSleeves());

	// Crime and murder
	const doMurderRampage = () => ns.heart.break() > -75 || (!ns.gang.inGang() && ns.heart.break() > -54000);

	if (sl.getNumSleeves() == 0) {
		const message = "ERROR: No sleeves found.";
		ns.tprint(message);
		ns.print(message);
		ns.exit();
	}

	const cities = cityNames;

	while (true) {
		// Join all available factions except city factions (unless we already joined one, so it doesn't matter)
		const hasJoinedCityFaction = ns.getPlayer().factions.some((fac) => cities.includes(fac));
		ns.singularity.checkFactionInvitations().filter((fac) => hasJoinedCityFaction || !cities.includes(fac))
			.forEach((fac) => ns.singularity.joinFaction(fac));

		const maxSleevesInRecovery = 2 + getSleeves(ns).filter((_sleeve) => _sleeve.stats.shock == 0).length; // Until all sleeves are at 0 shock, this many will be in recovery at once
		let sleevesInRecovery = 0;
		for (let thisSleeve of getSleeves(ns)) {
			// First up, manage sync. All sleeves should have memory 100, which should make this unneccessary, but still.
			if (doSync(thisSleeve)) {
				confirmOrAssignTask(ns, { type: "SYNCHRO" }, thisSleeve)
				continue;
			}

			// Consider augments
			if (thisSleeve.stats.shock == 0) {
				// Compile a list of interesting augs, sorted by value for money (best to worst)
				const augsToInclude = ["exp", "faction_rep"];
				if (doMurderRampage()) augsToInclude.push("crime");
				let interestingAugs = sl.getSleevePurchasableAugs(thisSleeve.index)
					.filter((aug) => canAffordAug(aug) && mapAugToFactor(aug.name, augsToInclude) > 1);
				if (interestingAugs.length == 0) {
					interestingAugs = sl.getSleevePurchasableAugs(thisSleeve.index)
						.filter((aug) => canAffordAug(aug) && mapAugToFactor(aug.name, allSkills) > 1);
				}

				
				if (interestingAugs.length > 0) {
					interestingAugs.sort((a, b) => mapAugToFactor(b.name, augsToInclude) / b.cost - mapAugToFactor(a.name, augsToInclude) / a.cost);
					const buyAug = interestingAugs[0];
					if (sl.purchaseSleeveAug(thisSleeve.index, buyAug.name)) {
						ns.printf("Purchased augmentation %s for %s, %s.", buyAug.name, thisSleeve.name, ns.nFormat(buyAug.cost, "$0.000a"));
						thisSleeve = getSleeveData(ns, thisSleeve.index);
					} else {
						ns.printf("WARNING: FAILED to purchase augmentation %s for %s, %s.", buyAug.name, thisSleeve.name, ns.nFormat(buyAug.cost, "$0.000a"));
					}
				}
			}

			// Manage shock
			if (thisSleeve.stats.shock > shockThreshold
				|| ((sleevesInRecovery < maxSleevesInRecovery) && (thisSleeve.stats.shock > 0))
			) {
				confirmOrAssignTask(ns, { type: "RECOVERY" }, thisSleeve);
				sleevesInRecovery++;
				continue;
			}

			// Training
			const unusableTrainingFactions = ["Bladeburners", "Shadows of Anarchy"];
			if (ns.gang.inGang()) { unusableTrainingFactions.push(ns.gang.getGangInformation().faction); }
			const otherSleeveFactions = getSleeves(ns).filter((otherSleeve) => otherSleeve.task?.type === "FACTION" && otherSleeve.index !== thisSleeve.index)
				.map((otherSleeve) => otherSleeve.task.factionName);
			const trainingFactions = ns.getPlayer().factions
				.filter((fac) => !otherSleeveFactions.includes(fac))
				.filter((fac) => !unusableTrainingFactions.some((_filter) => fac.includes(_filter)))
				.sort((a, b) => (ns.singularity.getAugmentationsFromFaction(b).map((aug) => ns.singularity.getAugmentationRepReq(aug)).reduce((a, b) => Math.max(a, b)) - ns.singularity.getFactionRep(b)) - (ns.singularity.getAugmentationsFromFaction(a).map((aug) => ns.singularity.getAugmentationRepReq(aug)).reduce((a, b) => Math.max(a, b)) - ns.singularity.getFactionRep(a)));

			const combatStatsToTrain = combatSkills.filter((stat) => thisSleeve.stats[stat] < trainCombatSkillsTo)
				.sort((a, b) => Math.floor(thisSleeve.stats[a] / trainingInterval) - Math.floor(thisSleeve.stats[b] / trainingInterval));
			if (combatStatsToTrain.length > 0) {
				if (["FIELD", "SECURITY"].some((workType) => trainingFactions.some((fac) => confirmOrAssignTask(ns, { type: "FACTION", factionWorkType: workType, factionName: fac }, thisSleeve, false)))) {
					continue;
				} else {
					const stat = combatStatsToTrain[0];
					travelTo(ns, bestGym.city, thisSleeve);
					confirmOrAssignTask(ns, { type: "CLASS", placeType: "GYM", stat: stat, classType: "GYM" + stat.toUpperCase(), location: bestGym.name }, thisSleeve);
					continue;
				}
			}
			if (thisSleeve.stats.hacking < trainHackingTo) {
				if (trainingFactions.some((fac) => confirmOrAssignTask(ns, { type: "FACTION", factionWorkType: "FIELD", factionName: fac }, thisSleeve))) {
					continue;
				} else {
					travelTo(ns, bestUniversity.city, thisSleeve);
					confirmOrAssignTask(ns, { type: "CLASS", placeType: "UNI", classType: "ALGORITHMS", location: bestUniversity.name }, thisSleeve);
					continue;
				}
			}
			if (thisSleeve.stats.charisma < trainCharismaTo) {
				if (trainingFactions.some((fac) => confirmOrAssignTask(ns, { type: "FACTION", factionWorkType: "FIELD", factionName: fac }, thisSleeve))) {
					continue;
				} else {
					travelTo(ns, bestUniversity.city, thisSleeve);
					confirmOrAssignTask(ns, { type: "CLASS", placeType: "UNI", classType: "LEADERSHIP", location: bestUniversity.name }, thisSleeve);
					continue;
				}
			}

			// Murder rampage
			if (doMurderRampage()) {
					confirmOrAssignTask(ns, { type: "CRIME", name: "Homicide" }, thisSleeve, false);
				continue;
			}

			// For lack of a better idea, I'll just train, cause I wanna go to bed and I'll think about it tomorrow.
			const workTypes = ["FIELD", "SECURITY", "HACKING"];
			if (workTypes.some((workType) => trainingFactions.some((fac) => confirmOrAssignTask(ns, { type: "FACTION", factionWorkType: workType, factionName: fac }, thisSleeve, false)))) {
				continue;
			} else {
				travelTo(ns, bestUniversity.city, thisSleeve);
				confirmOrAssignTask(ns, { type: "CLASS", placeType: "UNI", classType: "LEADERSHIP", location: bestUniversity.name }, thisSleeve);
			}
		}

		await ns.sleep(5000);
	}
}

/**
 *  @param {import(".").NS} ns
 *  @returns {SleeveData[]}
*/
export function getSleeves(ns) {
	const sleeves = [];
	for (let i = 0; i < ns.sleeve.getNumSleeves(); i++) {
		sleeves.push(getSleeveData(ns, i));
	}
	return sleeves;
}

/**
 *  @param {import(".").NS} ns 
 *  @param {Number} idx
 * 	@returns {SleeveData}
*/
export function getSleeveData(ns, idx) {
	const sl = ns.sleeve;
	if (idx >= sl.getNumSleeves()) return undefined;
	return { index: idx, name: sleeveName(idx), info: sl.getInformation(idx), stats: sl.getSleeveStats(idx), task: sl.getTask(idx) }
}

/**
 *  @param {import(".").NS} ns
 *  @param {SleeveTask} newTask
 *  @param {SleeveData} _sleeve
 *  @param {Boolean} logFailure
 *  @return {Boolean}
 */
function confirmOrAssignTask(ns, newTask, _sleeve, logFailure = true) {
	const sl = ns.sleeve;
	// If newTask matches _sleeve.task in every property, no change. newTask may have extra properties which are ignored.
	// For some tasks, like crime, this check is inadequate. We must assign regardless.
	const ambiguousTasks = ["CRIME"];
	if (_sleeve?.task !== null
		&& !ambiguousTasks.some((ambiguousType) => _sleeve.task?.type === ambiguousType)
		&& Object.keys(_sleeve.task).every((key) => _sleeve.task[key] === newTask[key])) {
		return true;
	}

	let success = false;
	switch (newTask.type) {
		case "RECOVERY":
			success = sl.setToShockRecovery(_sleeve.index);
			break;

		case "SYNCHRO":
			success = sl.setToSynchronize(_sleeve.index);
			break;

		case "CLASS":
			if (newTask.placeType === "GYM") {
				success = sl.setToGymWorkout(_sleeve.index, newTask.location, newTask.stat);
			} else {
				success = sl.setToUniversityCourse(_sleeve.index, newTask.location, newTask.classType);
			}
			break;

		case "CRIME":
			// Crime is a problem; which crime is not reported.
			// TODO github issue
			if (_sleeve.task?.type !== "CRIME") {
				success = sl.setToCommitCrime(_sleeve.index, newTask.name);
			}
			break;

		case "FACTION":
			success = sl.setToFactionWork(_sleeve.index, newTask.factionName, newTask.factionWorkType);
			break;
	}

	// Log task change
	const taskDetailArray = Object.keys(newTask).filter((key) => key !== "type");
	const details = taskDetailArray.length == 0 ? ""
		: " (" + taskDetailArray.map((key) => key + ": " + newTask[key]).join(", ") + ")";
	const message = success ? _sleeve.name + " assigned to " + newTask.type + details
		: "ERROR: FAILED to assign " + _sleeve.name + " to " + newTask.type + details;
	if (success || logFailure) {
		ns.print(message);
	}

	// Update object
	_sleeve.task = sl.getTask(_sleeve.index);
	return success;
}

/**
 *  @param {import(".").NS} ns
 *  @param {String} city
 *  @param {SleeveData} _sleeve
 */
function travelTo(ns, city, _sleeve) {
	const cities = ["Sector-12", "Chongqing", "New Tokyo", "Ishima", "Aevum", "Volhaven"];
	if (!cities.includes(city)) {
		ns.print("ERROR: Invalid city: ", city);
		return;
	}
	if (_sleeve.info.city == city) { return; }
	if (ns.sleeve.travel(_sleeve.index, city)) {
		_sleeve.info.city = city;
		ns.print(_sleeve.name + " travelled to " + city);
	} else {
		ns.print("ERROR: " + _sleeve.name + " FAILED to travel to " + city);
	}
}

/**
 *  @param {Number} idx
 *  @returns {String}
 */
function sleeveName(idx) {
	const names = ["Alice", "Beth", "Carol", "Diane", "Erin", "Faith", "Grace", "Heidi"];
	return names[idx] + "_" + idx;
}