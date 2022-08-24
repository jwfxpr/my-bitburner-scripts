/** @param {NS} ns */
export async function main(ns) {
	let hostname = ns.getHostname();
	let maxMoney = ns.getServerMaxMoney(hostname);
	let payload = "hacktarget.js";
	if (maxMoney == 0)
	{
		payload = "hackonlytarget.js";
	}
	await ns.scp([payload, "floodmem.js"], hostname, "home");
	
	ns.spawn("floodmem.js", 1, [payload, hostname]);
}