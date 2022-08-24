/** @param {NS} ns */
export async function main(ns) {
	// ns.disableLog("ALL");
	// ns.tail();
	const numFormat="0.000a";

	// How many simultaneous child processes to spawn per target
	let simultaneousGrows = 1;
	if (ns.args.length > 0) {
		simultaneousGrows = ns.args[0];
	}

	// When availableMoney/maxMoney is below this threshold, target will be grown
	let threshold = 0.95;
	if (ns.args.length > 1) {
		threshold = ns.args[1];
	}

	let threads = 4;
	if (ns.args.length > 2) {
		threads = ns.args[2];
	}

	ns.tprintf("simultaneousGrows: %d, threshold: %f, threads: %d", simultaneousGrows, threshold, threads);

	// Host discovery
	const allHostnames = ns.scan();
	for (let i = 0; i < allHostnames.length; i++) {
		recurseScan(ns, allHostnames[i], allHostnames);
	}
	ns.tprintf("%d hosts discovered.", allHostnames.length);

	// Get maxmoney
	const hostsMaxMoney = allHostnames.map(function (host) {
		return [host, ns.getServerMaxMoney(host)]
	});

	// hostsMaxMoney.forEach(function (host) { ns.tprint(host) });

	// Only servers with money, ordered by max
	const growTargets = hostsMaxMoney.filter(function (host) {
		return host[1] > 0
	}).sort(function (prev, curr) {
		return prev[1] - curr[1]
	}).reverse();
	ns.tprintf("%d hosts with money.", growTargets.length);

	const host = ns.getHostname();

	while (true) {
		await ns.sleep(1000); // 1sec

		for (const growTarget of growTargets) {
			const target = growTarget[0];
			const maxMoney = growTarget[1];

			// Skip if no root
			if (!ns.hasRootAccess(target)) {
				continue;
			}

			// Check threshold
			const ratio = ns.getServerMoneyAvailable(target) / maxMoney;
			// ns.printf("Host %s: Has $%s of max $%s, ratio %s (vs %f, %s)", target,
			// 	ns.nFormat(ns.getServerMoneyAvailable(target), numFormat),
			// 	ns.nFormat(maxMoney, numFormat),
			// 	ns.nFormat(ratio, numFormat),
			// 	threshold,
			// 	ratio > threshold ? "true" : "false");
			// continue;
			if (ratio > threshold) {
				continue;
			}

			// Spawn children
			for (let i = 0; i < simultaneousGrows; i++) {
				/*const pid = */ns.exec("growTargetOnce.js", host, threads, target, i);
				// ns.printf("Spawned growTargetOnce.js for %s with %d threads, PID %d", target, threads, pid);
			}
		}
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