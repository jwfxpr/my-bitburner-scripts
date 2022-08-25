import {divestAll, checkTix} from "chaseAlpha.js"

/** @param {import(".").NS} ns */
export async function main(ns) {
	ns.killall("home", true);

	// Cash out remaining illiquid assets
	if (ns.hacknet.hashCapacity() > 0) {
		while (ns.hacknet.numHashes() > ns.hacknet.hashCost("Sell for Corporation Funds")) {
			ns.hacknet.spendHashes("Sell for Corporation Funds");
		}
		ns.hacknet.spendHashes("Sell for Money", "", Math.floor(ns.hacknet.numHashes() / 4));
	}
	if (checkTix(ns, false)) divestAll(ns);
	
	// Spend remaining eddies on ram & cores
	while (ns.getPlayer().money >= Math.min(ns.singularity.getUpgradeHomeCoresCost(), ns.singularity.getUpgradeHomeRamCost())) {
		if (ns.singularity.getUpgradeHomeCoresCost() < ns.singularity.getUpgradeHomeRamCost()) {
			ns.singularity.upgradeHomeCores();
		} else {
			ns.singularity.upgradeHomeRam();
		}
	}

	// Final ascent for all gang members
	if (ns.gang.inGang())
		ns.gang.getMemberNames().forEach((name) => ns.gang.ascendMember(name));

	ns.singularity.installAugmentations("init.js");
}