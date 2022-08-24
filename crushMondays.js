import { cityNames } from "database.js"

/** @typedef {Object} EmployeeProductivity
 *  @property {Number} operations
 *  @property {Number} engineer
 *  @property {Number} business
 *  @property {Number} management
 *  @property {Number} "research & development"
 */

/** @typedef {Object} Industry
 *  @property {Number} reFac
 *  @property {Number} sciFac
 *  @property {Number} robFac
 *  @property {Number} aiFac
 *  @property {Number} advFac
 */
//  *  @property {Number} 

/** @param {import(".").NS} ns */
export async function main(ns) {
	ns.disableLog("sleep");
	ns.tail();
	const toastTime = 1000 * 60 * 60 * 24 * 7; // 1 week, until permanent toast 'null' fix (expected in bitburner 2.0.3 or higher)

	// Stateful cache of queued employee job allocations
	let employeeJobsInQueue = [];
	// Stateful cache to watch for product completion
	let productsInDevelopment = { division: new Set("") };
	delete productsInDevelopment.division;

	// Churn (fire and hire) this fraction (floored) of any office's total workforce.
	const employeeTrainingFraction = 0.02;

	while (true) {
		const hasOfficeAPI = ns.corporation.hasUnlockUpgrade("Office API");
		const hasWarehouseAPI = ns.corporation.hasUnlockUpgrade("Warehouse API");

		for (const div of ns.corporation.getCorporation().divisions) {
			// TODO
			if (hasWarehouseAPI) {
				// Initialise division in cache object if necessary
				if (!Object.keys(productsInDevelopment).includes(div.name)) { productsInDevelopment[div.name] = new Set(); }

				// Check watched products
				div.products.map((productName) => ns.corporation.getProduct(div.name, productName)).forEach((product) => {
					if (product.developmentProgress < 100) {
						productsInDevelopment[div.name].add(product.name);
					} else if (productsInDevelopment[div.name].has(product.name)) {
						if (ns.corporation.hasResearched(div.name, "Market-TA.II")) {
							ns.corporation.setProductMarketTA2(div.name, product.name, true);
							ns.toast(product.name + " completed: rating " + ns.nFormat(product.rat, "0.00a") + ", Market-TA.II enabled.", ns.enums.toast.SUCCESS, toastTime);
						} else {
							const bestOtherProduct = div.products.filter((otherProduct) => product.name !== otherProduct)
								.map((otherProduct) => ns.corporation.getProduct(div.name, otherProduct))
								.filter((otherProduct) => otherProduct.cityData["Aevum"][2] > 0) // Only products currently selling
								.sort((a, b) => b.rat - a.rat)[0];
							let mpCoeff = 1;
							if (bestOtherProduct !== undefined) {
								const otherCoeff = bestOtherProduct.sCost.split('*')[1];
								if (typeof otherCoeff === "string") {
									mpCoeff = Math.floor(parseFloat(otherCoeff) * product.rat / bestOtherProduct.rat);
								}
							}
							const price = "MP*" + mpCoeff;
							ns.corporation.sellProduct(div.name, "Aevum", product.name, "MAX", price, true);

							ns.toast(product.name + " completed: rating " + ns.nFormat(product.rat, "0.00a") + ", selling for " + price, ns.enums.toast.WARNING, toastTime);
						}
						productsInDevelopment[div.name].delete(product.name);
					}
				})
			}

			// Ensure division has expanded into all cities
			cityNames.filter((city) => !div.cities.includes(city))
				.forEach((cityName) => {
					if (ns.corporation.getExpandCityCost() <= ns.corporation.getCorporation().funds) {
						const parameters = [div.name, cityName];
						ns.print("Expanding division into city: ", parameters.join(", "));
						ns.corporation.expandCity(...parameters);
					}
				});

			// Ensure all cities have a warehouse
			if (hasWarehouseAPI) {
				cityNames.filter((cityName) => !ns.corporation.hasWarehouse(div.name, cityName))
					.forEach((cityName) => {
						if (ns.corporation.getPurchaseWarehouseCost() <= ns.corporation.getCorporation().funds) {
							const parameters = [div.name, cityName];
							ns.print("Purchasing warehouse: ", parameters.join(", "));
							ns.corporation.purchaseWarehouse(...parameters);
						}
					})
			}

			// Manage existing offices and employees
			if (hasOfficeAPI && ns.corporation.getCorporation().state === "EXPORT") {
				const rolePriorities = div.makesProducts ?
					[     // Priorities for product divisions
						// Role, Allocation weight
						["Operations", 1],
						["Engineer", 1],
						["Research & Development", 1],
						["Management", 1],
						["Business", 1],
						["Training", 0],
					] : [ // Priorities for non-product divisions
						["Operations", 1],
						["Engineer", 1],
						["Research & Development", 1],
						["Business", 0.5],
						["Management", 1],
						["Training", 0],
					];

				// First, maintain queued job allocations cache
				employeeJobsInQueue = employeeJobsInQueue.filter((cachedParameters) => {
					const [divName, cityName, employeeName, job] = cachedParameters;
					return ns.corporation.getEmployee(divName, cityName, employeeName).pos !== job;
				});

				div.cities.map((cityName) => { return { name: cityName, office: ns.corporation.getOffice(div.name, cityName) } }).forEach((city) => {
					// Hire for all vacant positions
					while (ns.corporation.hireEmployee(div.name, city.name) !== undefined) { }

					// Initialise untyped object to use as a dict for storing staff allocations.
					// Each priority will have an empty array ready to push staff into.
					const allocations = {};
					rolePriorities.forEach((priority) => allocations[priority[0]] = []);

					const officeStaff = city.office.employees.map((employeeName) => {
						const _emp = ns.corporation.getEmployee(div.name, city.name, employeeName);
						return { info: _emp, prod: calculateProductivity(ns, _emp, div) }
					});
					// Allocate our list of office staff according to priorities
					const barrelBottom = Math.floor(employeeTrainingFraction * officeStaff.length);
					let n = 0;
					while (officeStaff.length > barrelBottom) {
						const iteration = Math.ceil((n + 1) / rolePriorities.length);
						const priority = rolePriorities[n % rolePriorities.length];
						const jobAllocationTotal = Math.floor(iteration * priority[1]);
						const takePeople = Math.min(jobAllocationTotal - allocations[priority[0]].length, officeStaff.length - barrelBottom);
						if (takePeople > 0) {
							// Sort available staff, best candidates at end
							officeStaff.sort((a, b) => a.prod[priority[0].toLowerCase()] - b.prod[priority[0].toLowerCase()]);
							for (let j = 0; j < takePeople; j++) {
								allocations[priority[0]].push(officeStaff.pop());
							}
						}
						n++; // Next priority
					}

					// Train the dregs
					while (officeStaff.length > 0) {
						allocations["Training"].push(officeStaff.pop());
					}

					// Ensure every staff member is allocated to their optimised position.
					Object.entries(allocations)
						.map((jobAllocation) => { return { job: jobAllocation[0], staff: jobAllocation[1] } })
						.forEach((alloc) => alloc.staff
							.filter((_emp) => _emp.info.pos !== alloc.job
								// && !employeeJobsInQueue.some((cache) => _emp.info.name !== cache[2] && alloc.job !== cache[3])
							)
							.forEach((_emp) => {
								const parameters = [div.name, city.name, _emp.info.name, alloc.job];
								if (!employeeJobsInQueue.some((cache) => cache.every((item) => parameters.includes(item)))) {
									ns.print("Assigning job: ", parameters.join(", "));
									ns.corporation.assignJob(...parameters);
									employeeJobsInQueue.push(parameters);
								}
							})
						);
				});

				// Manage division research
				const researchPriorities = div.makesProducts ?
					[     // Priorities for product divisions
						// Research, Threshold to purchase
						["Hi-Tech R&D Laboratory", 10000],
						["Overclock", 40000],

						["Market-TA.I", 140000],
						["Market-TA.II", 120000],

						["uPgrade: Fulcrum", 90000],
						["uPgrade: Capacity.I", 120000],
						["uPgrade: Capacity.II", 130000],
						["Self-Correcting Assemblers", 125000],

						["JoyWire", 120000],
						["Automatic Drug Administration", 135000],
						["CPH4 Injections", 125000],
						["Go-Juice", 125000],
						["AutoBrew", 112000],
						["AutoPartyManager", 115000],
						["Sti.mu", 130000],

					] : [ // Priorities for non-product divisions
						// Research, Threshold to purchase
						["Hi-Tech R&D Laboratory", 5000],
						["Overclock", 15000],

						["Drones", 30000],
						["Drones - Assembly", 25000],
						["Self-Correcting Assemblers", 25000],

						["Joywire", 20000],
						["Automatic Drug Administration", 35000],
						["CPH4 Injections", 25000],
						["Go-Juice", 25000],

						["Market-TA.I", 70000],
						["Market-TA.II", 50000],
					];
				const nextPriority = researchPriorities.find((priority) => !ns.corporation.hasResearched(div.name, priority[0]));
				if (nextPriority !== undefined && div.research >= nextPriority[1]) {
					const parameters = [div.name, nextPriority[0]];
					ns.corporation.research(...parameters);
					const message = "Research bought: " + parameters.join(", ");
					ns.print(message);
					ns.toast(message, ns.enums.toast.INFO, toastTime);

					// Enable Market-TAs on mats immediately
					switch (nextPriority[0]) {
						case "Market-TA.I":
							div.cities.forEach((cityName) => ns.corporation.getMaterialNames().forEach((materialName) => {
								const parameters = [div.name, cityName, materialName, true];
								ns.print("Setting material Market-TA.I: ", parameters.join(", "));
								ns.corporation.setMaterialMarketTA1(...parameters);
							}));
							break;

						case "Market-TA.II":
							div.cities.forEach((cityName) => ns.corporation.getMaterialNames().forEach((materialName) => {
								const parameters = [div.name, cityName, materialName, true];
								ns.print("Setting material Market-TA.II: ", parameters.join(", "));
								ns.corporation.setMaterialMarketTA2(...parameters);
							}));
							break;
					}
				}

				// Enforce M-TA2 for applicable divisions
				if (div.makesProducts && ns.corporation.hasResearched(div.name, "Market-TA.II")) {
					// Ensure all products are selling at MAX
					// This ensures new products will sell immediately at launch
					div.products.map((productName) => ns.corporation.getProduct(div.name, productName))
						.filter((prod) => prod.developmentProgress == 100)
						.forEach((prod) => ns.corporation.sellProduct(div.name, "Sector-12", prod.name, "MAX", "MP", true))
					// Ensure all products have MTA2 enabled
					// This ensures new products will be priced correctly at launch
					div.products.forEach((productName) => ns.corporation.setProductMarketTA2(div.name, productName, true));
				}
			}

		}

		await ns.sleep(750);
	}
}

/** @param {import(".").NS} ns
 *  @param {Employee} emp
 *  @param {Division} division
 *  @returns {EmployeeProductivity}
 */
function calculateProductivity(ns, emp, division) {
	// "CPH4 Injections": Increases all stats _except_ exp by 10%
	const cph4 = ns.corporation.hasResearched(division.name, "CPH4 Injections") ? 1.1 : 1;
	// "Overlock": Increases int & eff by 25%
	const overclock = ns.corporation.hasResearched(division.name, "Overlock") ? 1.25 : 1;

	const effCre = emp.cre * (1 + 0.1 * ns.corporation.getUpgradeLevel("Nuoptimal Nootropic Injector Implants")) * cph4;
	const effCha = emp.cha * (1 + 0.1 * ns.corporation.getUpgradeLevel("Speech Processor Implants")) * cph4;
	const effInt = emp.int * (1 + 0.1 * ns.corporation.getUpgradeLevel("Neural Accelerators")) * cph4 * overclock;
	const effEff = emp.eff * (1 + 0.1 * ns.corporation.getUpgradeLevel("FocusWires")) * cph4 * overclock;
	const prodBase = 1;//emp.mor * emp.hap * emp.ene * 1e-6; // These factors are not relevant to my logic
	return {
		operations: prodBase * (0.6 * effInt + 0.1 * effCha + emp.exp + 0.5 * effCre + effEff),
		engineer: prodBase * (effInt + 0.1 * effCha + 1.5 * emp.exp + effEff),
		business: prodBase * (0.4 * effInt + effCha + 0.5 * emp.exp),
		management: prodBase * (2.0 * effCha + emp.exp + 0.2 * effCre + 0.7 * effEff),
		"research & development": prodBase * (1.5 * effInt + 0.8 * emp.exp + effCre + 0.5 * effEff),
	}
}

/** @param {import(".").NS} ns
 *  @param {String} divisionName
 *  @returns {Boolean}
 */
function manageAgriculture(ns, divisionName) {
	// if (!ns.corporation.hasUnlockUpgrade("Smart Supply")) ns.corporation.unlockUpgrade("Smart Supply");
	// ns.corporation.setSmartSupply(division.name, "Sector-12", true);
	// cityNames.reduce((cityName) => !ns.corporation.getDivision(divisionName).cities.includes(cityName)).forEach((cityName) =>
	// {
	// 	ns.corporation.expandCity(divisionName, cityName);
	// 	ns.corporation.
	// })
}