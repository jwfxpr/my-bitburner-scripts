/** @param {import(".").NS} ns */
export async function main(ns) {
	ns.disableLog("sleep");
	ns.disableLog("bladeburner.setTeamSize");
	ns.tail();
	const bb = ns.bladeburner;

	while (!bb.joinBladeburnerDivision()) {
		// Wait for eligibility
		const combatSkills = ["strength", "defense", "dexterity", "agility"];
		while (combatSkills.some((skill) => ns.getPlayer().skills[skill] < 100)) {
			await ns.sleep(30000);
		}
	}

	// Get to a minimum stamina
	while (bb.getStamina()[1] < 50) {
		if (bb.getCurrentAction().name != "Training") {
			bb.startAction("General", "Training");
		}
		await ns.sleep(30000);
	}

	const highStaminaThreshold = 0.99;
	const lowStaminaThreshold = 0.5;
	let staminaHigh = true;
	while (true) {
		// Handle skills
		const bestSkill = chooseBestSkill(ns);
		if (bb.getSkillUpgradeCost(bestSkill) <= bb.getSkillPoints()) {
			bb.upgradeSkill(bestSkill);
		}

		// Handle city
		const cities = ["Sector-12", "Chongqing", "New Tokyo", "Ishima", "Aevum", "Volhaven"];
		const currentCity = bb.getCity();
		const minCityPop = 1e9; // 1 billion
		const maxCityChaos = 50;
		// If inciting violence, move to an unimportant city
		if (bb.getCurrentAction().name == "Incite Violence") {
			const bestCity = cities.sort((a, b) => bb.getCityEstimatedPopulation(a) - bb.getCityEstimatedPopulation(b))[0];
			if (bestCity != currentCity) {
				bb.switchCity(bestCity);
			}
		// Otherwise, consider a move if the current city is too small or too chaotic
		} else if (bb.getCityEstimatedPopulation(currentCity) < 1e9 || bb.getCityChaos(currentCity) > maxCityChaos) {
			const sortedCities = cities.sort((a, b) => bb.getCityEstimatedPopulation(b) - bb.getCityEstimatedPopulation(a));
			const filteredCities = sortedCities.filter((city) => bb.getCityEstimatedPopulation(city) > minCityPop)
				.sort((a, b) => bb.getCityChaos(a) - bb.getCityChaos(b));
			const bestCity = filteredCities.length > 0 ? filteredCities[0] : sortedCities[0];
			if (bestCity != currentCity) {
				bb.switchCity(bestCity);
			}
		}

		// Handle stamina
		const stamina = bb.getStamina()[0];
		const maxStamina = bb.getStamina()[1];
		if (staminaHigh) {
			if (stamina < Math.ceil(maxStamina * lowStaminaThreshold)) {
				staminaHigh = false;
			}
		} else {
			if (stamina > Math.floor(maxStamina * highStaminaThreshold))
				staminaHigh = true;
		}

		// Handle action
		const bestAction = staminaHigh ? chooseHighStaminaTask(ns) : chooseLowStaminaTask(ns);
		if (shouldChangeAction(ns, bb.getCurrentAction(), bestAction)) {
			bb.startAction(bestAction.type, bestAction.name);
		}

		await ns.sleep(250);
	}
}

/** @param {import(".").NS} ns
 *  @param {BladeburnerCurAction} oldAction
 *  @param {BladeburnerCurAction} newAction
 *  @return {Boolean}
*/
function shouldChangeAction(ns, oldAction, newAction) {
	if (oldAction.type == "Idle") return true;
	if (oldAction.type == "BlackOp") return false; // Always finish blops
	if (oldAction.name == newAction.name) return false; // No change
	// if (oldAction.type == "General") return true; // Don't respect general actions

	const bb = ns.bladeburner;
	const actionTime = bb.getActionTime(oldAction.type, oldAction.name);
	const currentTime = bb.getActionCurrentTime();
	if (actionTime <= 30000) return true; // 30 secs
	return (currentTime < (actionTime * 0.5)); // Change if in first half
}

/** @param {import(".").NS} ns
 *  @return {String}
*/
function chooseBestSkill(ns) {
	const bb = ns.bladeburner;
	// const allSkills = bb.getSkillNames();
	if (bb.getSkillLevel("Overclock") < 90 && bb.getActionEstimatedSuccessChance("Operation", "Assassination")[0] == 1.0) {
		return "Overclock";
	}

	const highSkills = ["Blade's Intuition", "Digital Observer", "Reaper", "Evasive System"];
	const halfSkills = ["Cloak", "Short-Circuit", "Tracer", "Datamancer"];
	if (typeof getCurrentBlackOp(ns) === "string") {
		["Hands of Midas", "Hyperdrive"].forEach((sk) => halfSkills.push(sk));
	} else {
		["Hands of Midas", "Hyperdrive"].forEach((sk) => highSkills.push(sk));
	}
	const highWaterMark = Math.max(...highSkills.map((skill) => bb.getSkillLevel(skill)));

	const highSkillsBelowWatermark = highSkills.filter((skill) => bb.getSkillLevel(skill) < highWaterMark);
	if (highSkillsBelowWatermark.length > 0) {
		return highSkillsBelowWatermark.sort((a, b) => bb.getSkillUpgradeCost(a) - bb.getSkillUpgradeCost(b))[0];
	}
	const halfSkillsBelowWatermark = halfSkills.filter((skill) => bb.getSkillLevel(skill) < Math.floor(highWaterMark / 2));
	if (halfSkillsBelowWatermark.length > 0) {
		return halfSkillsBelowWatermark.sort((a, b) => bb.getSkillUpgradeCost(a) - bb.getSkillUpgradeCost(b))[0];
	}

	return highSkills.sort((a, b) => bb.getSkillUpgradeCost(a) - bb.getSkillUpgradeCost(b))[0]
}

/** @param {import(".").NS} ns
 *  @return {BladeburnerCurAction}
*/
function chooseLowStaminaTask(ns) {
	const bb = ns.bladeburner;
	if (getCurrentUncertainty(ns) > 0) {
		return {name: "Field Analysis", type: "General"}; 
	}
	const blop = getCurrentBlackOp(ns);
	const blopChance = typeof blop === "string" ? bb.getActionEstimatedSuccessChance("BlackOps", blop)[0] : 1;
	const assassinationChance = bb.getActionEstimatedSuccessChance("Operation", "Assassination")[0];

	if ((assassinationChance < 1 || blopChance < 1) && bb.getCityChaos(bb.getCity()) > 50) {
		return {name: "Diplomacy", type: "General"}; 
	}

	return { name: "Hyperbolic Regeneration Chamber", type: "General" };
}

/** @param {import(".").NS} ns
 *  @return {BladeburnerCurAction}
*/
function chooseHighStaminaTask(ns) {
	const bb = ns.bladeburner;
	const actionAttemptThreshold = 0.95;
	const blackOpAttemptThreshold = 0.85;

	// Make a list of valid ops; currently, we always ignore Raid, as we don't yet have good logic for communities.
	// We also save Investigation for when we need intel.
	const opsNames = getOpsNames(ns);

	// Get current blop
	const blop = getCurrentBlackOp(ns);
	if (typeof blop === "string") {
		// Allocate team to blop
		// First, remove any misallocated team members
		bb.getBlackOpNames().forEach((op) => {
			if (bb.getTeamSize("BlackOp", op) != 0 && blop != op) {
				bb.setTeamSize("BlackOp", op, 0);
			}
		});
		const blopTeamSize = bb.getTeamSize("BlackOp", blop);
		const newBlopTeamSize = bb.setTeamSize("BlackOp", blop, Infinity);
		if (blopTeamSize != newBlopTeamSize) {
			ns.print("bladeburner.setTeamSize: Team size for '", blop, "' set to ", newBlopTeamSize, ".");
		}

		// Black Ops
		const blopChance = bb.getActionEstimatedSuccessChance("BlackOps", blop)[0];
		if (bb.getBlackOpRank(blop) <= bb.getRank()
			&& blopChance >= blackOpAttemptThreshold) {
			return { type: "BlackOp", name: blop };
		}
	}

	// Intelligence
	if (getCurrentUncertainty(ns) > 0 && bb.getCurrentAction().name != "Incite Violence") {
		const intelligenceActions = [
			{ type: "Operation", name: "Undercover Operation" },
			{ type: "Operation", name: "Investigation" },
			{ type: "Contract", name: "Tracking" },
			{ type: "General", name: "Field Analysis" },
			].filter((action) => bb.getActionCountRemaining(action.type, action.name) > 0)
			.sort((a, b) => bb.getActionEstimatedSuccessChance(b.type, b.name)[0] - bb.getActionEstimatedSuccessChance(a.type, a.name)[0]);
		return intelligenceActions[0];
	}

	// Diplomacy
	const chaosThreshold = 50;
	const maxOpsChance = Math.max(...opsNames.filter((op) => bb.getActionCountRemaining("Operation", op) > 0).map((op) => bb.getActionEstimatedSuccessChance("Operation", op)[0]));
	const blopChance = (typeof blop === "string") ? bb.getActionEstimatedSuccessChance("BlackOps", blop)[0] : 1;
	if (((maxOpsChance != -Infinity && maxOpsChance < actionAttemptThreshold) || blopChance < blackOpAttemptThreshold) && bb.getCityChaos(bb.getCity()) > chaosThreshold) {
		return {name: "Diplomacy", type: "General"}; 
	}

	// Make a list, in order of preference (most to least), of actions to do
	// Ops first
	const allTheActions = opsNames.map((op) => { return { type: "Operation", name: op } });
	// if (allTheActions.every((action) => bb.getActionCountRemaining(action.type, action.name) == 0)) {
	// 	// There are no more operation actions. Reluctantly, we will incite violence.
	// 	allTheActions.push({ type: "General", name: "Incite Violence" });
	// }
	// Contracts
	const contractNames = bb.getContractNames().reverse();
	const ignoreContracts = ["Tracking"]; // Save tracking for intelligence
	ignoreContracts.forEach((badCt) => contractNames.splice(contractNames.indexOf(badCt), 1));
	contractNames.forEach((ct) => allTheActions.push({ type: "Contract", name: ct }));
	// If all else fails, we'll resort to violence, recruit or train.
	allTheActions.push({ type: "General", name: "Incite Violence" });
	// allTheActions.push({ type: "General", name: "Recruitment" });
	// allTheActions.push({ type: "General", name: "Training" });

	// Before we consider 

	// Narrow down choice
	const filteredActions = allTheActions.filter((action) => bb.getActionCountRemaining(action.type, action.name) > 0)
		.filter((action) => bb.getActionEstimatedSuccessChance(action.type, action.name)[0] > actionAttemptThreshold);
	// At worst, we will now have at least one "General" action remaining.
	return filteredActions[0];
}

/** @param {import(".").NS} ns
 *  @return {Number}
*/
function getCurrentUncertainty(ns) {
	const bb = ns.bladeburner;
	// Find uncertainty
	const diff = (a, b) => Math.abs(a - b);
	const blop = getCurrentBlackOp(ns);
	const blopUncertainty = typeof blop === "string" && bb.getBlackOpRank(blop) <= bb.getRank()
		? /*Eligible, consider*/ diff(...bb.getActionEstimatedSuccessChance("BlackOps", blop))
		: /*Not eligible, ignore*/ 0;
	const maxOpsUncertainty = Math.max(...getOps(ns).map((action) => diff(...bb.getActionEstimatedSuccessChance(action.type, action.name))));
	return Math.max(maxOpsUncertainty, blopUncertainty);
}

/** @param {import(".").NS} ns
 *  @return {String|undefined}
*/
export function getCurrentBlackOp(ns) {
	const remainingBlops =  ns.bladeburner.getBlackOpNames().filter((op) => ns.bladeburner.getActionCountRemaining("BlackOps", op) > 0);
	if (remainingBlops.length == 0) {
		// const message = "We're done here. Destroy the world demon.";
		// ns.print(message);
		// ns.tprint(message);
		// We won't exit now; we might have other goals, and bb still generates money and xp
		// ns.exit();
	}
	return remainingBlops[0];
}

/** @param {import(".").NS} ns
 *  @return {BladeburnerCurAction[]}
*/
function getOps(ns) {
	const bb = ns.bladeburner;
	return getOpsNames(ns).map((op) => { return { type: "Operation", name: op } });
}

/** @param {import(".").NS} ns
 *  @return {String[]}
*/
function getOpsNames(ns) {
	const bb = ns.bladeburner;
	const ignoreOps = ["Raid"/*, "Investigation"*/];
	const opsNames = bb.getOperationNames().reverse();
	ignoreOps.forEach((badOp) => opsNames.splice(opsNames.indexOf(badOp), 1));
	return opsNames;
}