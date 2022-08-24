/** @param {NS} ns */
export async function main(ns) {
	const numFormat = "0.000a";
	ns.disableLog('ALL');
	ns.tail();

	// Host discovery
	let allHostnames = ns.scan();
	for (let i = 0; i < allHostnames.length; i++) {
		recurseScan(ns, allHostnames[i], allHostnames);
	}
	report(ns, "%d hosts discovered.", allHostnames.length);

	// Prune ignored hosts
	const ignoredHosts = ["darkweb", "hacknet-node"];
	const validHostnames = allHostnames
		.filter((host) => ignoredHosts.every((badHost) => !host.startsWith(badHost)))
		.sort((host1, host2) => ns.getServerRequiredHackingLevel(host1) - ns.getServerRequiredHackingLevel(host2));

	// Create capability set
	const capabilityDefs = [
		["BruteSSH.exe", ns.brutessh],
		["FTPCrack.exe", ns.ftpcrack],
		["relaySMTP.exe", ns.relaysmtp],
		["HTTPWorm.exe", ns.httpworm],
		["SQLInject.exe", ns.sqlinject]
	];

	// Main loop
	while (validHostnames.length > 0) {
		// Init hosts lists
		let hostsToRemove = [0];
		hostsToRemove.pop();
		let hostsAwaitingCapability = [0];
		hostsAwaitingCapability.pop();

		// Check capabilities
		let capabilities = capabilityDefs.filter(function(def) { return ns.fileExists(def[0], "home")});
		let capabilityCount = capabilities.length;

		// Loop over hosts
		for (/*const target of allHostnames*/ let i = 0; i < validHostnames.length; i++) {
			let target = validHostnames[i];

			// Check if target is eligible to hack
			let hackReq = ns.getServerRequiredHackingLevel(target);
			if (hackReq > ns.getHackingLevel()) {
				// Too hard; skip
				continue;
			}

			if (ns.hasRootAccess(target)) {
				// Already acquired by other means; filter
				report(ns, "Host %s already has root, deploying.", target);
				// ns.killall(target);
				await payload(ns, target);
				hostsToRemove.push(i);
				continue;
			}

			// Eligible target, assess
			let portsReq = ns.getServerNumPortsRequired(target);
			if (portsReq <= capabilityCount) {
				// We have capabilities, aquire ports
				for (let j = 0; j < capabilityCount; j++) {
					capabilities[j][1](target);
				}
				ns.nuke(target);
				report(ns, "Host %s nuked, deploying.", target);
				await payload(ns, target);
				hostsToRemove.push(i);
			}
			else if (portsReq == capabilityCount + 1) {
				// One additional capability is required; report.
				hostsAwaitingCapability.push(i);
			}
		}

		if (hostsAwaitingCapability.length > 0) {
			const nextCapability = capabilityDefs.find((definition) => capabilities.indexOf(definition) == -1);
			const purchaseCost = (ns.getPlayer().tor ? 0 : 200000) + ns.singularity.getDarkwebProgramCost(nextCapability[0]);
			if (ns.getPlayer().money > purchaseCost) {
				if (ns.singularity.purchaseTor() && ns.singularity.purchaseProgram(nextCapability[0])) {
					report(ns, "Purchased capability: %s, $%s", nextCapability[0], ns.nFormat(purchaseCost, numFormat));
				}
			} else {
				report(ns, "%d hosts are awaiting capabilities: %s", hostsAwaitingCapability.length, hostsAwaitingCapability.map(function (i) { return validHostnames[i] }).join(", "));
			}
		}

		hostsToRemove.reverse();
		for (let j = 0; j < hostsToRemove.length; j++) {
			validHostnames.splice(hostsToRemove[j], 1);
		}
		
		if (hostsToRemove.length > 0 && validHostnames.length > 0) {
			const next = validHostnames.find(function (host) { return ns.getServerRequiredHackingLevel(host) > ns.getHackingLevel() });
			if (next != undefined) {
				report(ns, "Next target: %s at level %d (%d), ports %d (%d)",
					next,
					ns.getServerRequiredHackingLevel(next), ns.getHackingLevel(),
					ns.getServerNumPortsRequired(next), capabilities.length
				);
			}
		}

		await ns.sleep(10000);
	}

	report(ns, "He wept, for there were no more worlds to conquer.");
}

/** @param {NS} ns
  *  */
function report(ns, ...args) {
	ns.printf(...args);
	ns.tprintf(...args);
}

/** @param {NS} ns
  * @param {string} target */
async function payload(ns, target) {
	const maxMoney = ns.getServerMaxMoney(target);
	let payload = "hacktarget.js";
	if (maxMoney == 0)
	{
		payload = "hackonlytarget.js";
	}
	await ns.scp(payload, target, "home");
	// const count = Math.floor(ns.getServerMaxRam(target) / (ns.getScriptRam(payload) * 2));
	// for (let i = 0; i < count; i++) {
	// 	ns.exec(payload, target, threads, target, i);
	// }
	// Flood memory
	const minMoney = maxMoney *  0.25;
	let i = 0;
	[8, 4, 1].forEach((threads) => { while (ns.exec(payload, target, threads, target, minMoney * threads, i++) > 0) { } })
}

/** @param {NS} ns
  * @param {string} target
  * @param {string[]} allHosts */
function recurseScan(ns, target, allHosts) {
	let hosts = ns.scan(target);
	for (let i = 0; i < hosts.length; i++) {
		if (hosts[i] == "home" || allHosts.includes(hosts[i])) {
			continue;
		}
		allHosts.push(hosts[i]);
		recurseScan(ns, hosts[i], allHosts);
	}
}