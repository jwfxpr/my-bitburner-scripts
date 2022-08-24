/** @param {NS} ns */
export async function main(ns) {
	if (ns.args.length < 1 || !ns.fileExists(ns.args[0] + ".js", "home")) {
		ns.tprint("You must provide an argument which is the name of a script (without '.js').");
		ns.tprint([ns.args.length < 2, ns.fileExists(ns.args[0] + ".js", "home")]);
		ns.exit();
	}

	const hostName = ns.args[0];
	const scriptName = ns.args[0] + ".js";
	const scriptReqRam = ns.getScriptRam(scriptName);
	let hostReqRam = 0;
	for (let i = 1; hostReqRam == 0; i++) {
		const pow = Math.pow(2, i);
		if (pow >= scriptReqRam) { hostReqRam = pow; }
	}

	// Purchase or discover host server
	let newHost = false;
	let provisionedHost = hostName;
	ns.tprint(hostName, " exists: ", ns.serverExists(hostName));
	if (!ns.serverExists(hostName)) {
		provisionedHost = tryPurchase(ns, hostName, hostReqRam);
		newHost = true;
	} else if (ns.getServerMaxRam(hostName) < hostReqRam) {
		// Not enough RAM; look for next option
		let foundHost = "";
		for (let i = 0; foundHost == "" && ns.serverExists(hostName + "-" + i); i++) {
			const thisHost = hostName + "-" + i;
			if (ns.getServerMaxRam(thisHost) >= hostReqRam) {
				foundHost = thisHost;
			}
		}
		if (foundHost == "") {
			provisionedHost = tryPurchase(ns, hostName, hostReqRam);
			newHost = true;
		} else {
			provisionedHost = foundHost;
		}
	}

	if (newHost) {
		ns.tprintf("Purchased new host %s for $%s, deploying %s.", provisionedHost, ns.getPurchasedServerCost(hostReqRam), scriptName);
	} else {
		ns.tprintf("Using existing host %s, redeploying %s.", provisionedHost, scriptName);
		ns.killall(provisionedHost);
	}

	await ns.scp(scriptName, provisionedHost);
	const pid = ns.exec(scriptName, provisionedHost, 1, ...ns.args.slice(1));
	if (pid == 0) {
		ns.tprintf("Remote exec failed (PID 0).");
	} else {
		ns.tprintf("Remote exec successful (PID %d).", pid);
	}
}

/** @param {NS} ns */
function tryPurchase(ns, baseName, ram) {
	if (ns.getPurchasedServerCost(ram) > ns.getPlayer().money) {
		ns.tprintf("Unable to purchase server for '%s', can't afford it ($%s)", baseName, ns.nFormat(ns.getPurchasedServerCost(ram), "0.000a"));
		ns.exit();
	}
	let purchasedName = ns.purchaseServer(baseName, ram);
	if (purchasedName == "") {
		ns.tprint("Unable to purchase server '%s', cannot afford or have hit the limit", baseName);
		ns.exit()
	}
	return purchasedName;
}