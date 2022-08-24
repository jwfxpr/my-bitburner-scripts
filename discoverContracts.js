/** @param {NS} ns */
export async function main(ns) {
	// Host discovery
	let allHostnames = ns.scan();
	for (let i = 0; i < allHostnames.length; i++) {
		recurseScan(ns, allHostnames[i], allHostnames);
	}
	ns.tprintf("%d hosts discovered.", allHostnames.length);

	let files = allHostnames.map(
		function (host) {
			return [host, ns.ls(host, ".cct")]
		});
	
	files = files.filter(function (hostFiles) { return hostFiles[1].length > 0 });
	ns.tprint(files);
	files.forEach(
			function (hostFiles) {
				ns.tprintf("Contract(s) '%s' discovered on host '%s'", hostFiles[1].join(", "), hostFiles[0])
			});
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