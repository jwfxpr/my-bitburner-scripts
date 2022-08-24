import {getBestUpgradeAllNodes, nodeNameToIndex, doUpgrade} from "plantTheSeeds.js"

/** @param {import(".").NS} ns */
export async function main(ns) {
	// ns.disableLog("ALL");
	ns.disableLog("sleep");
	ns.disableLog("scan");
	ns.disableLog("getServerMinSecurityLevel");
	ns.disableLog("getServerMaxMoney");
	ns.disableLog("getHackingLevel");

	ns.tail();

	while (true) {
		
		if (ns.getPlayer().inBladeburner) {
			burnTheBlade(ns);
		}
		if (ns.singularity.getCurrentWork()?.type === "CLASS") {
			pushItRealGood(ns);
		}
		moreCashLessDash(ns);
		if (ns.getPlayer().hasCorporation) {
			buyASuit(ns);
		}

		// Reinvest in hash rate
		if (!ns.scriptRunning("plantTheSeeds.js", "home")) {
			const bestUpgrade = getBestUpgradeAllNodes(ns);
			if (tryWithdrawal(ns, bestUpgrade.info.cost)) {
				doUpgrade(ns, bestUpgrade);
			}
		}

		// Expand cache if required.
		const maxCacheLevel = 0.98;
		if (ns.hacknet.numHashes() / ns.hacknet.hashCapacity() >= maxCacheLevel) {
			const leastCache = getCurrentNodes(ns).reduce((prev, next) => prev.cache <= next.cache ? prev : next);
			const nextCacheCost = ns.formulas.hacknetServers.cacheUpgradeCost(leastCache.cache, 1);
			if (tryWithdrawal(ns, nextCacheCost)) {
				ns.hacknet.upgradeCache(nodeNameToIndex(leastCache.name), 1);
			}
		}

		await ns.sleep(1000 / 5);
	}
}

/** @param {import(".").NS} ns
 *  @param {Number} money
 *  @return {Boolean}
 */
export function tryWithdrawal(ns, money) {
	const moneyUpg = "Sell for Money";
	const moneyPerUpg = 1000000; //1mill
	const hashesPerUpg = 4;

	const upgCount = Math.ceil(money / moneyPerUpg);
	const totalHashCost = upgCount * hashesPerUpg;
	if (totalHashCost > ns.hacknet.numHashes()) return false;
	for (let i = 0; i < upgCount; i++) {
		if (!ns.hacknet.spendHashes(moneyUpg)) return false;
	}
	return true;
}

/** @param {import(".").NS} ns
 */
function moreCashLessDash(ns) {
	const allHostnames = ns.scan();
	for (let i = 0; i < allHostnames.length; i++) {
		recurseScan(ns, allHostnames[i], allHostnames);
	}
	const ignoredHosts = ["darkweb", "hacknet-node"];
	const validHostnames = allHostnames
		.filter((host) => ns.hasRootAccess(host))
		.filter((host) => ignoredHosts.every((badHost) => !host.startsWith(badHost)));

	// Upgrade max money on most profitable server
	const moneyUpg = "Increase Maximum Money";
	const hostsWithMoney = validHostnames
		.filter((host) => ns.getServerMaxMoney(host) > 0)
		.sort((a, b) => ns.getServerMaxMoney(a) - ns.getServerMaxMoney(b));
	if (hostsWithMoney.length > 0) {
		buyIfAffordable(ns, moneyUpg, hostsWithMoney[0]);
	}

	// Reduce security on most secure server with money
	const securityUpg = "Reduce Minimum Security";
	const minimumAllowedSecurity = 5;
	const hostsWithSecurity = hostsWithMoney
		.filter((host) => ns.getServerMinSecurityLevel(host) > minimumAllowedSecurity)
		.sort((a, b) => ns.getServerMinSecurityLevel(b) - ns.getServerMinSecurityLevel(a));
	if (hostsWithSecurity.length > 0) {
		buyIfAffordable(ns, securityUpg, hostsWithSecurity[0]);
	}
}

/** @param {import(".").NS} ns
 */
function pushItRealGood(ns, limit = 40) {
	[
		"Improve Gym Training",
		"Improve Studying",
	].forEach((upg) => {
		if (ns.hacknet.getHashUpgradeLevel(upg) <= limit) buyIfAffordable(ns, upg);
	});
}

/** @param {import(".").NS} ns
 */
function burnTheBlade(ns) {
	[
		"Exchange for Bladeburner Rank",
		"Exchange for Bladeburner SP"
	].forEach((upg) => buyIfAffordable(ns, upg));
}

/** @param {import(".").NS} ns
 */
function buyASuit(ns, threshold = 50e9) {
	if (ns.corporation.getCorporation().funds <= threshold)
		buyIfAffordable(ns, "Sell for Corporation Funds");
}

/** @param {import(".").NS} ns
  * @param {string} upgrade
  * @param {string} detail */
function buyIfAffordable(ns, upgrade, detail = "") {
	const hashNumFmt = "0.000a";
	const hn = ns.hacknet;
	const cost = hn.hashCost(upgrade);
	if (hn.numHashes() >= cost) {
		const upgradeDetail = upgrade + (detail == "" ? "" : " (" + detail + ")");
		if (hn.spendHashes(upgrade, detail)) {
			// success
			ns.print("Purchased: " + upgradeDetail + "; " + ns.nFormat(cost, hashNumFmt));
		} else {
			ns.print("WARNING: Failed to purchase: " + upgradeDetail + "; " + ns.nFormat(cost, hashNumFmt) + " (balance " + ns.nFormat(hn.numHashes(), hashNumFmt) + ")")
		}

	}
}

/** @param {import(".").NS} ns
 *  @returns {NodeStats[]}
 */
function getCurrentNodes(ns) {
	let nodeCount = ns.hacknet.numNodes();
	if (nodeCount == 0) {
		ns.hacknet.purchaseNode();
		nodeCount = 1;
	}
	let nodes = [ns.hacknet.getNodeStats(0)];
	for (let i = 1; i < nodeCount; i++) {
		nodes.push(ns.hacknet.getNodeStats(i));
	}
	return nodes;
}

/** @param {import(".").NS} ns
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