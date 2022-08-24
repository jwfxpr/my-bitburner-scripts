/** @typedef {Object} City
 *  @property {String[]} gyms
 *  @property {String[]} universities
 */

/** @typedef {Object} Cities
 *  @property {City} Sector-12
 *  @property {City} Aevum
 *  @property {City} Chongqing
 *  @property {City} "New Tokyo"
 *  @property {City} Ishima
 *  @property {City} Volhaven
 */

/** @typedef {Object} Location
 *  @property {String} city
 *  @property {String} name
 */

/** @param {import(".").NS} ns */
export async function main(ns) {
	const message = "This is a library module, not a script. Do not run directly; rather, import functions into other scripts as needed.";
	ns.tprint(message);
	ns.print(message);
}

/** @returns {Cities} */
function makeCities() {
	return {
		"Sector-12": { gyms: ["Powerhouse Gym", "Iron Gym"], universities: ["Rothman University"] },
		"Aevum": { gyms: ["Snap Fitness Gym", "Crush Fitness Gym"], universities: ["Summit University"] },
		"Chongqing": { gyms: [], universities: [] },
		"New Tokyo": { gyms: [], universities: [] },
		"Ishima": { gyms: [], universities: [] },
		"Volhaven": { gyms: ["Millenium Fitness Gym"], universities: ["ZB Institute of Technology"] },
	};
}

/** @constant
 *  @type {Cities} */
export const cities = makeCities();

/** @constant
 *  @type {String[]}
 */
export const cityNames = Object.keys(makeCities());

/** @constant
 *  @type {Location} */
export const bestGym = { city: "Sector-12", name: "Powerhouse Gym" };

/** @type {Location} */
export const bestUniversity = { city: "Volhaven", name: "ZB Institute of Technology" };