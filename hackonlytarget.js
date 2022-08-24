/** @param {import(".").NS} ns */
export async function main(ns) {
	let target = ns.args[0];
	while (true) {
		for (let i = 0; i < 10; i++) {
			await ns.hack(target);
		}
		await ns.weaken(target);
	}
}