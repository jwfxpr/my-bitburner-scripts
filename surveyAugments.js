/** @param {import(".").NS} ns */
export async function main(ns) {
	// If a first argument is given, only bonuses with matching text in the property name will be shown. E.g. 'str'
	const textFilter = ns.args.length > 0 ? ns.args[0] : "" /*String.includes("") always matches*/;
	const allFactions = [
		// Early game factions
		"CyberSec", "Tian Di Hui", "Netburners",
		// City Factions
		"Sector-12", "Chongqing", "New Tokyo", "Ishima", "Aevum", "Volhaven",
		// Hacking factions
		"NiteSec", "The Black Hand", "BitRunners",
		// Megacorporations
		"ECorp", "MegaCorp", "KuaiGong International", "Four Sigma", "NWO",
		"Blade Industries", "OmniTek Incorporated", "Bachman & Associates",
		"Clarke Incorporated", "Fulcrum Secret Technologies",
		// Criminal organisations
		"Slum Snakes", "Tetrads", "Silhouette", "Speakers for the Dead",
		"The Dark Army", "The Syndicate",
		// Endgame factions
		"The Covenant", "Daedalus", "Illuminati",
		// Special factions
		// "Shadows of Anarchy",
		// "Bladeburners",
	];
	const numFmt = "0.000a";

	const augmentationFilter = new Set(ns.singularity.getOwnedAugmentations(true));
	if (ns.gang.inGang() && textFilter === "") {
		ns.singularity.getAugmentationsFromFaction(ns.gang.getGangInformation().faction).forEach((aug) => augmentationFilter.add(aug));
	}
	augmentationFilter.add("NeuroFlux Governor");
	const reallyUnique = (aug) => !augmentationFilter.has(aug);
	const myFaction = ns.gang.inGang() && textFilter === "" ? ns.gang.getGangInformation().faction : "";
	let factionAugs = allFactions.filter((fac) => myFaction != fac)
		.filter((fac) => ns.singularity.getAugmentationsFromFaction(fac).some(reallyUnique))
		.map((fac) => {
			return {
				name: fac,
				uniqueAugments: ns.singularity.getAugmentationsFromFaction(fac)
					.filter(reallyUnique)
					.map((aug) => { return { augment: aug, stats: ns.singularity.getAugmentationStats(aug) } })
			}
		});
	// Apply text filter and reduce list
	if (textFilter !== "") {
		factionAugs.forEach((fac, facIdx) => {
			fac.uniqueAugments.forEach((aug, augIdx) => {
				const newStats = aug.stats;
				Object.entries(aug.stats).filter((stat) => stat[1] === 1 || !stat[0].includes(textFilter)).forEach((stat) => delete newStats[stat[0]]);
				factionAugs[facIdx].uniqueAugments[augIdx].stats = newStats;
			});
			fac.uniqueAugments = fac.uniqueAugments.filter((aug) => Object.entries(aug.stats).length > 0);
		})
		factionAugs = factionAugs.filter((fac) => fac.uniqueAugments.length > 0);
	}
	// Print list
	factionAugs.forEach((fac) => {
			ns.tprint(fac.name,
				ns.getPlayer().factions.includes(fac.name) ? (ns.gang.getGangInformation().faction === fac.name ? " 🥊" : " ⭐") + " " + ns.nFormat(ns.singularity.getFactionRep(fac.name), numFmt)
					: ns.singularity.checkFactionInvitations().includes(fac.name) ? " 📝" : ""
			);
		fac.uniqueAugments
			.sort((a, b) => ns.singularity.getAugmentationRepReq(a.augment) - ns.singularity.getAugmentationRepReq(b.augment))
			.forEach((aug) => {
				ns.tprint('\t', aug.augment, "\t$", ns.nFormat(ns.singularity.getAugmentationPrice(aug.augment), numFmt), ", ", ns.nFormat(ns.singularity.getAugmentationRepReq(aug.augment), numFmt));
				ns.tprint("\t\t" + Object.entries(aug.stats).filter((stat) => stat[1] !== 1 /*&& stat[0].includes(textFilter)*/).map((stat) => stat[0] + ": " + stat[1]).join(", "));
			});
		});
}