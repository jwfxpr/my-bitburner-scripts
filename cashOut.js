import {checkTix, divestAll} from "chaseAlpha.js"

/** @param {import(".").NS} ns */
export async function main(ns) {
	const moolah = Math.floor(ns.hacknet.numHashes() / 4);
	ns.hacknet.spendHashes("Sell for Money", "", moolah);
	if (checkTix(ns, false)) divestAll(ns);
}