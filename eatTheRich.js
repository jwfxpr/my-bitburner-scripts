/** @param {import(".").NS} ns */
export async function main(ns) {
	ns.disableLog("sleep");
	ns.disableLog("getServerMoneyAvailable");
	ns.tail();
	const numFormat="0.000a";

	// Host discovery
	const allHostnames = ns.scan();
	for (let i = 0; i < allHostnames.length; i++) {
		recurseScan(ns, allHostnames[i], allHostnames);
	}
	ns.tprintf("%d hosts discovered.", allHostnames.length);

	// Only servers with money
	const hackTargets = allHostnames.filter((host) => ns.getServerMaxMoney(host) > 0); // Reverse order (max to min, descending)
	ns.tprintf("%d hosts with money.", hackTargets.length);

	// Wait for a valid target
	while (hackTargets.every((target) => !ns.hasRootAccess(target))) {
		await ns.sleep(1000);
	}

	const hackOutcome = (host) => ns.hackAnalyzeChance(host) * ns.getServerMoneyAvailable(host) / ns.getHackTime(host);

	while (true) {
		const richestTarget = hackTargets
			.filter((target) => ns.hasRootAccess(target) && ns.getServer(target).requiredHackingSkill <= ns.getPlayer().skills.hacking)
			.sort((prev, curr) => hackOutcome(curr) - hackOutcome(prev))
			[0];

		const gain = await ns.hack(richestTarget);
		if (gain == 0 && ns.getServerSecurityLevel(richestTarget) > ns.getServerMinSecurityLevel(richestTarget)) {
			await ns.weaken(richestTarget);
		}
	}
}

/**
 *  @param {import(".").NS} ns
  * @param {string} target
  * @param {string[]} allHosts */
function recurseScan(ns, target, allHosts) {
	let hosts = ns.scan(target);
	for (let i = 0; i < hosts.length; i++) {
		if (allHosts.includes(hosts[i])) {
			continue;
		}
		allHosts.push(hosts[i]);
		recurseScan(ns, hosts[i], allHosts);
	}
}