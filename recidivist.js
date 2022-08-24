export function autocomplete(data, args) {
	return ["money", "karma", "hacking_exp", "strength_exp", "defense_exp",
		"dexterity_exp", "agility_exp", "charisma_exp", "intelligence_exp", "kills"];
}

/** @param {import(".").NS} ns */
export async function main(ns) {
	ns.disableLog("sleep");
	
	const defaultGoal = "money";
	const validGoals = ["money", "karma", "hacking_exp", "strength_exp", "defense_exp",
		"dexterity_exp", "agility_exp", "charisma_exp", "intelligence_exp", "kills"];

	let incomingGoal = (ns.args.length > 0) ? ns.args[0] : defaultGoal;
	const matchingGoals = validGoals.filter((goal) => goal.startsWith(incomingGoal));
	if (matchingGoals.length == 0) {
		ns.tprintf("Arg 1 '%s' is not a valid goal. Leave blank for the default goal '%s', or provide a valid goal:", incomingGoal, defaultGoal);
		ns.tprint(validGoals.join(", "));
		ns.exit();
	}
	if (matchingGoals.length > 1) {
		ns.tprintf("Arg 1 '%s' matches more than one goal. Did you mean:", incomingGoal);
		ns.tprint(matchingGoals.join(", "));
		ns.exit();
	}
	const goal = matchingGoals[0];

	const failScale = getFailureScale(goal);
	const shouldFocus = !ns.singularity.getOwnedAugmentations().includes("Neuroreceptor Management Implant");
	const shouldContinue = goal == "karma" ? (() => ns.heart.break() > -54000) : (() => true);

	const crimeNames = ["shoplift", "rob store", "mug", "larceny", "drugs", "bond forgery",
		"traffic arms", "homicide", "grand auto", "kidnap", "assassinate", "heist"];
	const crimes = crimeNames.map((name) => ns.singularity.getCrimeStats(name));

	ns.tail();
	while (shouldContinue()) {
		const crimeChances = crimes
			.map((crime) => {
				crime.chance = ns.singularity.getCrimeChance(crime.name);
				crime.goalRate = crime[goal] / crime.time;
				crime.expectedOutcome = crime.goalRate * crime.chance + failScale * crime.goalRate * (1 - crime.chance);
				return crime;
			}).sort((a, b) => b.goalRate - a.goalRate);
		const idealCrime = crimeChances[0];
		crimeChances.sort((a, b) => b.expectedOutcome - a.expectedOutcome);

		// Check for murder spree
		// const player = ns.getPlayer();
		// if (["strength", "defense", "dexterity", "agility"].every((stat) =>player.skills[stat] > 300)
		// && player.numPeopleKilled < 30)
		// {
		// 	crimeChances = crimeChances.filter((crime) => crime.kills > 0);
		// }

		// Filter for chance
		const crimeFiltered = crimeChances;//.filter((crime) => crime.chance > 0.2);

		const bestCrime = crimeFiltered.length > 1 ? crimeFiltered[0] : crimeChances[0];
		ns.printf('Best crime: %s, $%s @ %s%% / %s', bestCrime.name, ns.nFormat(bestCrime.money, "0.000a"), ns.nFormat(bestCrime.chance * 100, "0.00a"), ns.tFormat(bestCrime.time));
		const currentWork = ns.singularity.getCurrentWork();
		if (currentWork === null || currentWork.type !== "CRIME" || currentWork.crimeType !== bestCrime.name.toUpperCase()) {
			if (goal !== "karma" && idealCrime.name == bestCrime.name && bestCrime.chance == 1) {
				// We are committing the ideal crime for this goal; our work here is done.
				ns.singularity.commitCrime(bestCrime.name, shouldFocus);
				ns.closeTail();
				ns.exit();
			}
			await ns.sleep(ns.singularity.commitCrime(bestCrime.name, shouldFocus));
		}
		await ns.sleep(20000);
	}

	if (goal == "karma") {
		ns.run("craveChaos.js");
		ns.spawn("recidivist.js");
	}
}

/** @param {string} goal */
function getFailureScale(goal) {
	switch (goal) {
		case "money":
		case "intelligence_exp":
		case "kills":
			return 0;
		default:
			return 0.25;
	}
}