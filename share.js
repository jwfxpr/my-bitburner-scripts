/** @param {NS} ns */
export async function main(ns) {
	ns.tail();
	while (true) { await ns.share(); }
}