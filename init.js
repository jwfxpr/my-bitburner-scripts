/** @param {NS} ns */
export async function main(ns) {
	const growThreads = 2;
	const megalithThreads = 20;
	const runScripts = [
		// Script, threads, args
		// ["infiltration.js", 1, "--start"],
		["contract-auto-solver.js", 1],
		["pierceTheVeil.js", 1],
		["plantTheSeeds.js", 1],
		["reapTheHarvest.js", 1],
		["cryHavoc.js", 1],
		["pumpItUp.js", 1],
		// ["recidivist.js", 1, "karma"],
	];

	if (ns.sleeve.getNumSleeves() > 0 && ns.getPlayer().bitNodeN != 10) // NextBN10 attempt should be without sleeves, for achievement
		runScripts.push(["alterCarbon.js", 1]);

	if (ns.singularity.getOwnedAugmentations().includes("The Blade's Simulacrum"))
		runScripts.push(["burnTheBlade.js", 1]);

	if (ns.gang.inGang())
		runScripts.push(["craveChaos.js", 1]);
		
	if (ns.getPlayer().bitNodeN == 8) {
		runScripts.push(["invest.js", 1]);
	} else if (ns.stock.hasTIXAPIAccess()) {
		runScripts.push(["divest.js", 1]);
	}

	if (ns.getPlayer().hasCorporation) {
		runScripts.push(["crushMondays.js", 1]);
	}

	[
		["eatTheRich.js", megalithThreads],
		["fightThePower.js", megalithThreads],
		["barbaricYawp.js", 1, 1, 0.975, growThreads],
		["barbaricYawp.js", 1, 2, 0.95, growThreads],
		["barbaricYawp.js", 1, 3, 0.9, growThreads],
	].forEach((scr) => runScripts.push(scr));

	for (const script of runScripts) {
		const pid = ns.run(...script);
		ns.tprintf("%s launched with PID %d", script[0], pid);
	}
	
}