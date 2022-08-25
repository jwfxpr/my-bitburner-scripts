// import {getCurrentBlackOp} from "burnTheBlade.js";
// import {requireBitNodeOrSource} from "helperlib"
// import {symbolToInfo} from "chaseAlpha.js"
// import {cityNames} from "database.js"

/** @param {import(".").NS} ns */
export async function main(ns) {
	ns.tprint(ns.corporation.getResearchNames());
	// const seconds = [60*60, 60, 59];
	// const secondsFmt = (secs) => (secs >= (60*60) ? "0:" : "") + (secs >= 60 ? "00:" : "") + "00 s";
	// seconds.forEach((s) => ns.tprint(ns.nFormat(s, secondsFmt(s))));

	// const nfg = ns.singularity.getAugmentationStats("NeuroFlux Governor");
	// Object.entries(nfg).forEach((entry) => ns.tprint(entry[0], ": ", entry[1]));

	// ns.tprint(ns.sleeve.getTask(0));

	// ns.tprint(ns.singularity.getCurrentWork());
	
	// ns.tprint(ns.singularity.getCurrentWork());
	// ns.tprint(ns.getPlayer().currentWork);
	// ns.tprint(ns.getPlayer().skills);
	// ns.tprint(ns.getPlayer().exp);
	// ns.tprint(ns.getPlayer().hp);
}