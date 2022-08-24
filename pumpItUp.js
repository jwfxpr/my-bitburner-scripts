/** @param {import(".").NS} ns */
export async function main(ns) {
	ns.disableLog("sleep");
	ns.tail();

	const loopSleep = 2000;
	const stats = ["strength", "defense", "dexterity", "agility"];
	let level = Math.min(...stats.map((stat) => ns.getPlayer().skills[stat]));

	while (true) {
		level++;
		for (const stat of stats) {
			if (ns.getPlayer().skills[stat] < level) {
				ns.singularity.gymWorkout(getGym(ns), stat, false);
				while (ns.getPlayer().skills[stat] < level) {
					await ns.sleep(loopSleep);
				}
			}
		}

		await ns.sleep(1);
	}
}

/** @param {import(".").NS} ns
 *  @return {String}
 */
function getGym(ns) {
	switch (ns.getPlayer().city) {
		case "Sector-12":
			return "Powerhouse Gym";
		case "Aevum":
			return "Snap Fitness Gym";
		case "Volhaven":
			return "Millenium Fitness Gym";
		default:
			const message = "No gym in " + ns.getPlayer().city + ", dumdum.";
			ns.print(message);
			ns.tprint(message);
			ns.exit();
			break;
	}
}