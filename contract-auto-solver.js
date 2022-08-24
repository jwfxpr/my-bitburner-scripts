import {solveContract} from "solve-contract.js"

/** @param {import(".").NS} ns **/
export async function main(ns) {
	ns.disableLog("sleep");
	// ns.tail();
	while (true) {
		await dfs(ns, null, "home", trySolveContracts, 0);
		await ns.sleep(1000 * 60 * 30); // 30 mins
	}
}

/** @param {import(".").NS} ns **/
async function dfs(ns, parent, current, f, depth, ...args) {
	var hosts = ns.scan(current);
	if (parent != null) {
		const index = hosts.indexOf(parent);
		if (index > -1) {
			hosts.splice(index, 1);
		}
	}

	await f(ns, current, depth, ...args);

	for (let index = 0, len = hosts.length; index < len; ++index) {
		const host = hosts[index];
		await dfs(ns, current, host, f, depth+1, ...args);
	}
}

/** @param {import(".").NS} ns **/
async function trySolveContracts(ns, host, depth) {
	var contracts = ns.ls(host, "cct");
	for (var contract of contracts) {
		solveContract(ns, host, contract, 0);
	}
}