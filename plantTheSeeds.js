/**
 *  @typedef {Object} NodeUpgradeInfo
 *  @property {String} target
 *  @property {Number} cost
 *  @property {Number} roi
 *  @property {Number} newGainRate
 */

/**
 *  @typedef {Object} NodeUpgrade
 *  @property {Number} index
 *  @property {NodeStats} node
 *  @property {NodeUpgradeInfo} info
 */

/** @param {import(".").NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");
	ns.tail();
	// To have anything to do, we must have at least one node.
	if (ns.hacknet.numNodes() == 0) {
		ns.print("Purchasing first node.");
		if (ns.hacknet.purchaseNode() == -1) {
			ns.print("Can't afford first node, need $", ns.nFormat(ns.hacknet.getPurchaseNodeCost(), "0.000a"));
			ns.exit();
		}
	}

	while (true) {
		const currentNodes = getCurrentNodes(ns);
		ns.printf("\nThere are currently %d nodes.", currentNodes.length);
		// ns.print("All nodes:");
		// ns.print(currentNodes);

		const bestUpgrade = getBestUpgradeAllNodes(ns);
		ns.print("\nBest upgrade determined:");
		ns.print(bestUpgrade);
		// return;

		if (await waitForBudget(ns, bestUpgrade.info.cost)) {
			doUpgrade(ns, bestUpgrade);
		}


		// const upgradeMaps = await Promise.all(currentNodes.map(async function (node, i) { return [i, node, await calculateBestUpgradeForNode(ns, node)] }));
		// // ns.print("Upgrade maps:");
		// // upgradeMaps.forEach(function (upgrade) {ns.print(upgrade)});
		// // ns.print(upgradeMaps[0]);
		// // return;

		// // Assume buying new node is best, in case no usable upgrades returned
		// let bestUpgrade = newNodeUpgrade(ns);
		// // Search upgrades for best ROI
		// if (upgradeMaps.length > 0) {
		// 	bestUpgrade = upgradeMaps
		// 		.reduce(function (prev, next) {
		// 			const precision = 1e9;
		// 			const compare = Math.round(prev[2][2] * precision) - Math.round(next[2][2] * precision);
		// 			if (compare == 0) {
		// 				// Equal ROI, prefer cheapest
		// 				return prev[2][1] <= next[2][1] ? prev : next;
		// 			}
		// 			return compare > 0 ? prev : next;
		// 		}, [-1, "none", ["none", Infinity, -1, -1]]);
		// }

		// if (bestUpgrade[1] === "none") {
		// 	ns.print("No upgrades left to make, exiting.");
		// 	ns.exit();
		// }

		// // If a new node is cheaper, we're going to do that instead
		// if (bestUpgrade[2][1] > ns.hacknet.getPurchaseNodeCost()) {
		// 	bestUpgrade[2][0] = "new";
		// }

		// ns.print("\nBest upgrade determined:");
		// ns.print(bestUpgrade);
		// // return;

		// switch (bestUpgrade[2][0]) {
		// 	case "level": // Level
		// 		if (await waitForBudget(ns, bestUpgrade[2][1])) {
		// 			ns.hacknet.upgradeLevel(bestUpgrade[0], 1);
		// 			ns.printf("Bought %s %d on %s for %s.", bestUpgrade[2][0], bestUpgrade[1].level + 1, bestUpgrade[1].name, ppMoney(bestUpgrade[2][1]))
		// 		}
		// 		break;

		// 	case "ram": // Ram
		// 		if (await waitForBudget(ns, bestUpgrade[2][1])) {
		// 			ns.hacknet.upgradeRam(bestUpgrade[0], 1);
		// 			ns.printf("Bought %s %d on %s for %s.", bestUpgrade[2][0], bestUpgrade[1].ram * 2, bestUpgrade[1].name, ppMoney(bestUpgrade[2][1]))
		// 		}
		// 		break;

		// 	case "core": // Core
		// 		if (await waitForBudget(ns, bestUpgrade[2][1])) {
		// 			ns.hacknet.upgradeCore(bestUpgrade[0], 1);
		// 			ns.printf("Bought %s %d on %s for %s.", bestUpgrade[2][0], bestUpgrade[1].cores + 1, bestUpgrade[1].name, ppMoney(bestUpgrade[2][1]))
		// 		}
		// 		break;

		// 	default: // Buy node
		// 		const price = ns.hacknet.getPurchaseNodeCost();
		// 		if (await waitForBudget(ns, price)) {
		// 			const idx = ns.hacknet.purchaseNode();
		// 			ns.printf("Bought new node (%d) for %s.", idx, ppMoney(price))
		// 		}
		// }

		await ns.sleep(1000 / 5);
	}
}

/**
 *  @param {import(".").NS} ns
 *  @returns {Number}
 */
function getCashFloat(ns) {
	const level = ns.getHackingLevel();
	// Keep at least this much cash available no matter what
	const cashFloatMin = 1500000;//ns.fileExists("SQLInject.exe") ? 0 : 250000000;
	// Base cash float
	const cashFloatBase = 0;//function () {
	// 	if (ns.fileExists("FTPCrack.exe")) {
	// 		return 0;
	// 	} else {
	// 		ns.singularity.getOwnedAugmentations().indexOf("CashRoot Starter Kit") < 0 ? 0 : 1000000
	// 	};
	// }
	// Increase cash float by this much per level
	const cashFloatPerLevel = ((ns.getPlayer().playtimeSinceLastAug / 1000 /*sec*/ / 60 /*m*/ / 60 /*hr*/  * 0.3) * level) * level;

	return Math.max(cashFloatMin, cashFloatPerLevel * level + cashFloatBase);
}

/**
 *  @param {number} num 
 *  @returns {string}
*/
function ppMoney(num) {
	return '$' + ppNum(num);
}

/**
 *  @param {number} num 
 *  @returns {string}
*/
function ppNum(num) {
	if (num > 1e9) {
		return (num / 1e9).toFixed(3) + 'b';
	} else if (num > 1e6) {
		return (num / 1e6).toFixed(3) + 'm';
	} else if (num > 1e3) {
		return (num / 1e3).toFixed(3) + 'k';
	} else {
		return num.toFixed(3);
	}
}

/**
 *  @param {import(".").NS} ns
 *  @param {Number} maxLevel
 *  @param {Number} maxRam
 *  @param {Number} maxCores
 *  @returns {Promise<Number[]>}
 * */
async function findNewNodeSweetSpot(ns, maxLevel, maxRam, maxCores) {
	let totalCost = ns.formulas.hacknetServers.hacknetServerCost(ns.hacknet.numNodes() + 1);
	let level = 1;
	let ram = 1;
	let cores = 1;
	let currentROI = 0;
	let nextROI = calcHashGainRate(ns, 1, 1, 1) / totalCost;
	while (nextROI > currentROI) {
		// await ns.sleep(1);
		currentROI = nextROI;

		const bestUpgrade = await calculateBestUpgradeForStats(ns, level, ram, cores, false, level < maxLevel, ram < maxRam, cores < maxCores);
		switch (bestUpgrade[0]) {
			case "level":
				totalCost += calcLevelUpgradeCost(ns, level);
				level++;
				break;

			case "ram":
				totalCost += calcRamUpgradeCost(ns, ram);
				ram += ram;
				break;

			case "cores":
				totalCost += calcCoreUpgradeCost(ns, cores);
				cores++;
				break;

			default:
				// Past sweetspot or limits hit
				nextROI = 0;
				continue;
		}
		let gainRate = calcHashGainRate(ns, level, ram, cores);
		nextROI = gainRate / totalCost;
	}
	
	return {level: level, ram: ram, cores: cores, cost: totalCost, roi: currentROI, gainRate: calcHashGainRate(ns, level, ram, cores)};
}

/**
 *  @param {import(".").NS} ns
 *  @param {Number} level
 *  @param {Number} ram
 *  @param {Number} cores
 * */
function calculateNewNodeCostWithConfig(ns, level, ram, cores) {
	return ns.hacknet.getPurchaseNodeCost()
				+ calcLevelUpgradeCost(ns, 1, level - 1)
				+ calcRamUpgradeCost(ns, 1, ram - 1)
				+ calcCoreUpgradeCost(ns, 1, cores - 1);
}

/**
 *  @param {import(".").NS} ns
 *  @param {Number} requiredMoney
 *  @returns {Promise<Boolean>}
 * */
async function waitForBudget(ns, requiredMoney) {
	let currentBudget = getBudget(ns);
	while (requiredMoney > currentBudget) {
		await ns.sleep(1);
		ns.printf("Waiting for budget: need %s, have %s (float %s)",
			ppMoney(requiredMoney), ppMoney(currentBudget), ppMoney(getCashFloat(ns)));
		let level = ns.getHackingLevel();
		while (level == ns.getHackingLevel() && requiredMoney > getBudget(ns)) {
			await ns.sleep(1000);
		}
		currentBudget = getBudget(ns);
	}
	return true;
}

/**
 *  @param {import(".").NS} ns
 *  @param {NodeStats} node
 *  @returns {NodeUpgrade}
 * */
async function calculateBestUpgradeForNode(ns, node) {
	return await calculateBestUpgradeForStats(ns, node.level, node.ram, node.cores);
}

/**
 *  @param {import(".").NS} ns
 *  @param {Number} level
 *  @param {Number} ram
 *  @param {Number} cores
 *  @param {Boolean} considerSweetSpot
 *  @param {Boolean} considerLevel
 *  @param {Boolean} considerRam
 *  @param {Boolean} considerCores
 *  @returns {Promise<(String | Number)[]>}
 * */
async function calculateBestUpgradeForStats(ns, level, ram, cores, considerSweetSpot = true, considerLevel = true, considerRam = true, considerCores = true) {
	// ns.print("Calculating best upgrade for node:");
	// ns.print(node);

	const baseProductivity = calcHashGainRate(ns, level, ram, cores);
	// ns.printf("baseProductivity: %f", baseProductivity);
	
	// Start with value of new node with matching config
	let newGainRate = calcHashGainRate(ns, 1, 1, 1);
	const newPurchaseCost = ns.formulas.hacknetServers.hacknetServerCost(ns.hacknet.numNodes() + 1);
	let newROI = newPurchaseCost / newGainRate;
	let newNodeSweetSpot = {level: 1, ram: 1, cores: 1, cost: newPurchaseCost, roi: newROI, gainRate: newGainRate};
	if (considerSweetSpot) {
		newNodeSweetSpot = await findNewNodeSweetSpot(ns, level, ram, cores);
		newROI = newNodeSweetSpot.roi;
		newGainRate = newNodeSweetSpot.gainRate;
	}
	let upgrades = [
		["new", newPurchaseCost, newROI, newGainRate]
	];

	if (considerLevel) {
		const levelCost = calcLevelUpgradeCost(ns, level);
		// ns.printf("levelCost: %f", levelCost);
		if (levelCost != Infinity) {
			const levelProductivityGained = calcHashGainRate(ns, level + 1, ram, cores) - baseProductivity;
			// ns.printf("levelProductivityGained: %f", levelProductivityGained);
			const levelROI = levelProductivityGained / levelCost;
			// ns.printf("levelROI: %f", levelROI);
			upgrades.push(["level", levelCost, levelROI, levelProductivityGained]);
		}
	}

	if (considerRam) {
		const ramCost = calcRamUpgradeCost(ns, ram);
		// ns.printf("ramCost: %f", ramCost);
		if (ramCost != Infinity) {
			const ramProductivityGained = calcHashGainRate(ns, level, 2 * ram, cores) - baseProductivity;
			const ramROI = ramProductivityGained / ramCost;
			upgrades.push(["ram", ramCost, ramROI, ramProductivityGained]);
		}
	}

	if (considerCores) {
		const coreCost = calcCoreUpgradeCost(ns, cores);
		// ns.printf("coreCost: %f", coreCost);
		if (coreCost != Infinity) {
			const coreProductivityGained = calcHashGainRate(ns, level, ram, cores + 1) - baseProductivity;
			// ns.printf("coreProductivityGained: %f", coreProductivityGained);
			const coreROI = coreProductivityGained / coreCost;
			upgrades.push(["core", coreCost, coreROI, coreProductivityGained]);
		}
	}

	// if (upgrades.length > 1) {
	// 	ns.print("Calculated upgrades for node.");
	// 	upgrades.forEach(function (upgrade) { ns.print(upgrade) });
	// }

	// Select best upgrade
	const bestUpgrade = upgrades.reduce((prev, next) => prev[2] > next[2] ? prev : next);
	return bestUpgrade;
}

/**
 *  @param {import(".").NS} ns
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

/**
 *  @param {import(".").NS} ns
 *  @returns {Number}
 */
function getBudget(ns) {
	return Math.max(0, ns.getPlayer().money - getCashFloat(ns));
}

/**
 *  @param {import(".").NS} ns 
 *  @param {number} level
 *  @param {number} ram
 *  @param {number} cores
 *  @returns {Number}
 */
function calcHashGainRate(ns, level, ram, cores) {
	return ns.formulas.hacknetServers.hashGainRate(level, 0, ram, cores);
}

/**
 *  @param {import(".").NS} ns 
 *  @param {number} startingLevel
 *  @param {number} extraLevels
 *  @returns {Number}
 */
function calcLevelUpgradeCost(ns, startingLevel, extraLevels = 1) {
	return ns.formulas.hacknetServers.levelUpgradeCost(startingLevel, extraLevels);
}

/**
 *  @param {import(".").NS} ns 
 *  @param {number} startingRam
 *  @param {number} extraRam
 *  @returns {Number}
 */
function calcRamUpgradeCost(ns, startingRam, extraRam = 1) {
	return ns.formulas.hacknetServers.ramUpgradeCost(startingRam, extraRam);
}

/**
 *  @param {import(".").NS} ns 
 *  @param {number} startingCores
 *  @param {number} extraCores
 *  @returns {Number}
 */
function calcCoreUpgradeCost(ns, startingCores, extraCores = 1) {
	return ns.formulas.hacknetServers.coreUpgradeCost(startingCores, extraCores);
}

/**
 *  @param {import(".").NS} ns
 *  @param {number} startingCache
 *  @param {number} extraCache
 *  @returns {Number}
 */
function calcCacheUpgradeCost(ns, startingCache, extraCache = 1) {
	return ns.formulas.hacknetServers.cacheUpgradeCost(startingCache, extraCache);
}

/**
 *  @param {import(".").NS} ns
 *  @returns {NodeUpgrade} */
function newNodeUpgrade(ns) {
	const cost = ns.hacknet.getPurchaseNodeCost();
	const gainRate = ns.formulas.hacknetServers.hashGainRate(1, 0, 1, 1);
	return {
		index: -1,
		node: null,
		info: {
			target: "new",
			cost: cost,
			newGainRate: gainRate,
			roi: cost / gainRate,
		}
	}
}

/**
 *  @param {import(".").NS} ns
 *  @returns {NodeUpgrade} */
export function getBestUpgradeAllNodes(ns) {
	const newNode = newNodeUpgrade(ns);
	const allNodes = getCurrentNodes(ns);
	if (allNodes.length == 0) return newNode;
	const bestUpgrades = allNodes.map((node) => getBestUpgradeForNode(ns, node));
	const bestUpgrade = bestUpgrades.sort((a, b) => b.info.roi - a.info.roi)[0];
	return bestUpgrade.info.cost >= newNode.info.cost ? newNode : bestUpgrade;
}

/**
 *  @param {import(".").NS} ns
 *  @param {NodeStats} node
 *  @returns {NodeUpgrade} */
export function getBestUpgradeForNode(ns, node) {
		const index = nodeNameToIndex(node.name);
		const currentHashRate = ns.formulas.hacknetServers.hashGainRate(node.level, 0, node.ram, node.cores);

		// Level
		const lvlCost = ns.hacknet.getLevelUpgradeCost(index, 1);
		const lvlHashRate = ns.formulas.hacknetServers.hashGainRate(node.level + 1, 0, node.ram, node.cores);
		const lvlUpgrade = {
			index: index,
			node: node,
			info: {
				target: "level",
				cost: lvlCost,
				newGainRate: lvlHashRate,
				roi: (lvlHashRate - currentHashRate) / lvlCost,
			}
		};

		// Ram
		const ramCost = ns.hacknet.getRamUpgradeCost(index, 1);
		const ramHashRate = ns.formulas.hacknetServers.hashGainRate(node.level, 0, node.ram + 1, node.cores);
		const ramUpgrade = {
			index: index,
			node: node,
			info: {
				target: "ram",
				cost: ramCost,
				newGainRate: ramHashRate,
				roi: (ramHashRate - currentHashRate) / ramCost,
			}
		};

		// Core
		const coreCost = ns.hacknet.getCoreUpgradeCost(index, 1);
		const coreHashRate = ns.formulas.hacknetServers.hashGainRate(node.level, 0, node.ram, node.cores + 1);
		const coreUpgrade = {
			index: index,
			node: node,
			info: {
				target: "core",
				cost: coreCost,
				newGainRate: coreHashRate,
				roi: (coreHashRate - currentHashRate) / coreCost,
			}
		};

		return [lvlUpgrade, ramUpgrade, coreUpgrade].sort((a, b) => b.info.roi - a.info.roi)[0];
}

/**
 *  @param {import(".").NS} ns
 *  @param {NodeUpgrade} upgrade
 *  @returns {Boolean} */
export function doUpgrade(ns, upgrade) {
	const upgradeMap = {
		level: ns.hacknet.upgradeLevel,
		ram: ns.hacknet.upgradeRam,
		core: ns.hacknet.upgradeCore,
		cache: ns.hacknet.upgradeCache,
	};
	if (Object.keys(upgradeMap).includes(upgrade.info.target)) {
		if (upgradeMap[upgrade.info.target](upgrade.index, 1)) {
			// Success
			const targetVal = upgrade.info.target == "ram" ? 2 * upgrade.node.ram : upgrade.node[upgrade.info.target] + 1;
			ns.printf("Bought %s %d on %s for %s.", upgrade.info.target, targetVal, upgrade.node.name, ns.nFormat(upgrade.info.cost, "$0.000a"));
		} else {
			// Failure
			const targetVal = upgrade.info.target == "ram" ? 2 * upgrade.node.ram : upgrade.node[upgrade.info.target] + 1;
			ns.printf("WARNING: FAILED to buy %s %d on %s for %s.", upgrade.info.target, targetVal, upgrade.node.name, ns.nFormat(upgrade.info.cost, "$0.000a"));
		}
	} else {
		// New node
		const newNodeIdx = ns.hacknet.purchaseNode();
		if (newNodeIdx != -1) {
			// Success
			ns.printf("Bought new node %d for %s.", newNodeIdx, ns.nFormat(upgrade.info.cost, "$0.000a"));
		} else {
			// Failure
			ns.printf("WARNING: FAILED to buy new node for %s.", ns.nFormat(upgrade.info.cost, "$0.000a"));
		}
	}
}

/**
 *  @param {String} name
 *  @returns {Number}
 */
export function nodeNameToIndex(name) {
	return parseInt(name.split("-")[2]);
}