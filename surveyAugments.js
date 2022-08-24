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

	const augmentationFilter = ns.singularity.getOwnedAugmentations(true);
	if (ns.gang.inGang()) {
		ns.singularity.getAugmentationsFromFaction(ns.gang.getGangInformation().faction).forEach((aug) => augmentationFilter.push(aug));
	}
	augmentationFilter.push("NeuroFlux Governor");
	const reallyUnique = (aug) => augmentationFilter.indexOf(aug) == -1;
	const myFaction = ns.gang.inGang() ? ns.gang.getGangInformation().faction : "";
	allFactions.filter((fac) => myFaction != fac)
		.filter((fac) => ns.singularity.getAugmentationsFromFaction(fac).some(reallyUnique))
		.map((fac) => {
			return {
				name: fac,
				uniqueAugments: ns.singularity.getAugmentationsFromFaction(fac)
					.filter(reallyUnique)
					.map((aug) => { return { augment: aug, stats: ns.singularity.getAugmentationStats(aug) } })
			}
		})
		.forEach((fac) => {
			ns.tprint(fac.name,
				ns.getPlayer().factions.includes(fac.name) ? " ⭐"
					: ns.singularity.checkFactionInvitations().includes(fac.name) ? " 📝" : ""
			);
			fac.uniqueAugments.forEach((aug) => {
				ns.tprint('\t', aug.augment, "\t$", ns.nFormat(ns.singularity.getAugmentationPrice(aug.augment), "0.000a"));
				ns.tprint("\t\t" + Object.entries(aug.stats).filter((stat) => stat[1] !== 1 && stat[0].includes(textFilter)).map((stat) => stat[0] + ": " + stat[1]).join(", "));
			});
		});
}