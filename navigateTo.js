// TODO this is currently completely broken, delete or fix

/** @param {NS} ns */
export async function main(ns) {
	if (ns.args.length < 1) {
		ns.tprint("Target required.");
		return;
	}
	const target = ns.args[0];

	// Find path. Recursion limit means looping is it.
	let path = [["home"]];
	path.push(ns.scan("home"));
	let thisHost = path[1][path.length - 1];
	while (path.length > 1 && thisHost != target) {
		await ns.sleep(1);
		const lastHost = path[path.length - 2][path.length - 1];
		const thisHostChildren = ns.scan(thisHost).filter(function(host) { return host != lastHost });
		if (thisHostChildren.length == 0) {
			// Dead end
			path[path.length - 1].pop();
			if (path[path.length - 1].length == 0) {
				// No more hosts to check at this node
				path.pop();
			}
		} else {
			path.push(thisHostChildren);
		}

		thisHost = path[path.length - 1][path.length - 1];
	}

	// Resolve success, flatten path
	if (path.length <= 1) {
		// No success
		ns.tprintf("Could not find path to host '%s', check spelling.", target);
		return;
	}
	const foundPath = path.map(function (step) { return step[step.length - 1] });
	ns.tprintf("Path found, traversing: %s", foundPath.join(", "));
	return;
	foundPath.forEach(function(step) { ns.singularity.connect(step) });
}