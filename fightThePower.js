/** @param {NS} ns */
export async function main(ns) {
	ns.disableLog("sleep");
	ns.disableLog("getServerSecurityLevel");
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

	while (true) {
		const hardestTarget = hackTargets.filter((target) => ns.hasRootAccess(target))
			.sort((prev, curr) => ns.getServerSecurityLevel(curr) - ns.getServerSecurityLevel(prev))
			[0];
		await ns.weaken(hardestTarget);
	}
}

/** @param {NS} ns
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