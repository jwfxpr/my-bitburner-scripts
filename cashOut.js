/** @param {NS} ns */
export async function main(ns) {
	while (ns.hacknet.numHashes() > 50) {
		ns.hacknet.spendHashes("Sell for Money");
	}
}