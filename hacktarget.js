/** @param {NS} ns */
export async function main(ns) {
	let target = ns.args[0];
	// let minMoney = ns.args[1];
	while (true) {
		let earnedMoney = await ns.hack(target);
		if (earnedMoney == 0) {
			await ns.weaken(target);
		}
		// else if (earnedMoney < minMoney)
		// {
		// 	await ns.grow(target);
		// }
	}
}