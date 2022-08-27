import { cityNames } from "database.js"

/**
 *  @typedef {Object} EmployeeProductivity
 *  @property {Number} operations
 *  @property {Number} engineer
 *  @property {Number} business
 *  @property {Number} management
 *  @property {Number} "research & development"
 */

/**
 *  @typedef {Object} Industry
 *  @property {Number} reFac
 *  @property {Number} sciFac
 *  @property {Number} robFac
 *  @property {Number} aiFac
 *  @property {Number} advFac
 */
//  *  @property {Number}

const industryDivisions = [
	["Agriculture", "Aggro"],
	["Tobacco", "Bacco"],
];

const taxBreaks = ["Shady Accounting", "Government Partnership"];

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

	// Relegate this fraction (floored) of any office's total workforce to training.
	const employeeTrainingFraction = 0.02;

	const hasAtLeastOneDivision = tryMeetCondition(() => ns.corporation.getCorporation().divisions.length >= 1,
		() => {
			const [industryType, divisionName] = industryDivisions[0];
			// Establish our first industry
			ns.corporation.expandIndustry(industryType, divisionName);
		}
	);
	if (!hasAtLeastOneDivision)
		ns.exit();

	while (true) {
		await ns.sleep(750);

		const hasOfficeAPI = tryMeetCondition(() => ns.corporation.hasUnlockUpgrade("Office API"),
			() => {
				if (canAfford(ns, ns.corporation.getUnlockUpgradeCost("Office API"))) {
					ns.corporation.unlockUpgrade("Office API");
				}
			}
		);
		const hasWarehouseAPI = tryMeetCondition(() => ns.corporation.hasUnlockUpgrade("Warehouse API"),
			() => {
				if (canAfford(ns, ns.corporation.getUnlockUpgradeCost("Warehouse API"))) {
					ns.corporation.unlockUpgrade("Warehouse API");
				}
			}
		);

		// Tax breaks
		if (ns.corporation.getCorporation().dividendEarnings > 0) {
			taxBreaks.forEach((taxBreak) => {
				if (!ns.corporation.hasUnlockUpgrade(taxBreak)
					&& canAfford(ns, ns.corporation.getUnlockUpgradeCost(taxBreak))
				) {
					ns.corporation.unlockUpgrade(taxBreak);
					ns.toast("Corp: " + taxBreak, ns.enums.toast.INFO, 10000);
				}
			});
		}

		const hasAtLeastOneDivision = tryMeetCondition(() => ns.corporation.getCorporation().divisions.length >= 1,
			() => {
				const [industryType, divisionName] = industryDivisions[0];
				// Establish our first industry
				ns.corporation.expandIndustry(industryType, divisionName);
			}
		);
		if (!hasAtLeastOneDivision)
			continue;

		for (const div of ns.corporation.getCorporation().divisions) {
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
							officeStaff.sort((a, b) => a.prod[priority[0]] - b.prod[priority[0]]);
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
						["Bulk Purchasing", 5000],
						["Overclock", 15000],

						["Drones", 30000],
						["Drones - Assembly", 25000],
						["Self-Correcting Assemblers", 25000],

						["JoyWire", 20000],
						["Automatic Drug Administration", 35000],
						["CPH4 Injections", 25000],
						["Go-Juice", 25000],

						["Market-TA.I", 20000],
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

			switch (div.type) {
				case "Agriculture":
					const aggEstablished = manageAgriculture(ns, div.name);
					if (aggEstablished&& !(ns.corporation.getCorporation().divisions.length >= 2)) {
						const [industryType, divisionName] = industryDivisions[1];
						if (canAfford(ns, ns.corporation.getExpandIndustryCost(industryType))) {
							ns.corporation.expandIndustry(industryType, divisionName);
						}
					}
					break;
				case "Tobacco":
					manageTobacco(ns, div.name);
					break;
			}

			if (div.makesProducts) {
				manageProductPricing(ns, div.name);
			}

			// Manage storage
			ns.corporation.getDivision(div.name).cities
				.filter((cityName) => ns.corporation.hasWarehouse(div.name, cityName))
				.forEach((cityName) => {
					const warehouse = ns.corporation.getWarehouse(div.name, cityName);
					if (warehouse.sizeUsed >= warehouse.size * 0.98
						&& canAfford(ns, ns.corporation.getUpgradeWarehouseCost(div.name, cityName))
					) {
						ns.corporation.upgradeWarehouse(div.name, cityName);
					}
				});
		}

	}
}

/**
 *  @param {import(".").NS} ns
 *  @param {Number} amount
 */
function canAfford(ns, amount) {
	return amount <= ns.corporation.getCorporation().funds;
}

/**
 *  @param {import(".").NS} ns
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
		"Operations": prodBase * (0.6 * effInt + 0.1 * effCha + emp.exp + 0.5 * effCre + effEff),
		"Engineer": prodBase * (effInt + 0.1 * effCha + 1.5 * emp.exp + effEff),
		"Business": prodBase * (0.4 * effInt + effCha + 0.5 * emp.exp),
		"Management": prodBase * (2.0 * effCha + emp.exp + 0.2 * effCre + 0.7 * effEff),
		"Research & Development": prodBase * (1.5 * effInt + 0.8 * emp.exp + effCre + 0.5 * effEff),
	}
}

/**
 *  @param {import(".").NS} ns
 *  @param {String} divisionName
 *  @returns {Boolean} Is division "established", ready for next industry in queue
 */
function manageAgriculture(ns, divisionName) {
	let _continue = tryMeetCondition(() => ns.corporation.hasUnlockUpgrade("Smart Supply"),
		() => {
			if (canAfford(ns, ns.corporation.getUnlockUpgradeCost("Smart Supply"))) {
				ns.corporation.unlockUpgrade("Smart Supply");
			}
		}
	);
	if (!_continue) return false;

	ns.corporation.setSmartSupply(divisionName, "Sector-12", true);

	const hasOfficeAPI = tryMeetCondition(() => ns.corporation.hasUnlockUpgrade("Office API"),
		() => {
			if (canAfford(ns, ns.corporation.getUnlockUpgradeCost("Office API"))) {
				ns.corporation.unlockUpgrade("Office API");
			}
		}
	);
	if (!hasOfficeAPI) return false;
	const hasWarehouseAPI = tryMeetCondition(() => ns.corporation.hasUnlockUpgrade("Warehouse API"),
		() => {
			if (canAfford(ns, ns.corporation.getUnlockUpgradeCost("Warehouse API"))) {
				ns.corporation.unlockUpgrade("Warehouse API");
			}
		}
	);
	if (!hasWarehouseAPI) return false;

	// Expand division into all cities, plus warehouses
	const allCities = cityNames;
	_continue = tryMeetCondition(() => ns.corporation.getDivision(divisionName).cities.length == allCities.length,
		() => {
			const div = ns.corporation.getDivision(divisionName);
			allCities.filter((cityName) => !div.cities.includes(cityName))
				.forEach((cityName) => {
					if (canAfford(ns, ns.corporation.getExpandCityCost() /*+ ns.corporation.getPurchaseWarehouseCost()*/)) {
						doAndLog(ns, "Expanding into city", ns.corporation.expandCity, [divisionName, cityName]);
						// doAndLog(ns, "Purchasing warehouse", ns.corporation.purchaseWarehouse, [divisionName, cityName]);
					}
				});
		}
	);
	
	const fieldOffices = ns.corporation.getDivision(divisionName).cities;

	// Ensure warehouses in all division cities
	_continue = tryMeetCondition(
		() => fieldOffices.every((cityName) => ns.corporation.hasWarehouse(divisionName, cityName)),
		() => fieldOffices.filter((cityName) => !ns.corporation.hasWarehouse(divisionName, cityName))
			.forEach((cityName) => {
			if (canAfford(ns, ns.corporation.getPurchaseWarehouseCost())) {
				doAndLog(ns, "Purchasing warehouse", ns.corporation.purchaseWarehouse, [divisionName, cityName]);
			}
		})
	) && _continue;
	
	// Ensure all materials are being sold before checking continue state
	const matsProduced = ["Plants", "Food"];
	const hasMTA1 = ns.corporation.hasResearched(divisionName, "Market-TA.I");
	const hasMTA2 = ns.corporation.hasResearched(divisionName, "Market-TA.II");
	ns.corporation.getDivision(divisionName).cities
		.filter((cityName) => ns.corporation.hasWarehouse(divisionName, cityName))
		// .filter((cityName) => matsProduced.some((materialName) => ns.corporation.getMaterial(divisionName, cityName, materialName).sCost !== 0))
		.forEach((cityName) => {
			matsProduced.filter((materialName) => ns.corporation.getMaterial(divisionName, cityName, materialName).sCost === 0)
				.forEach((materialName) => {
					ns.corporation.sellMaterial(divisionName, cityName, materialName, "MAX", "MP");
					if (hasMTA2) {
						ns.corporation.setMaterialMarketTA2(divisionName, cityName, materialName, true);
					} else if (hasMTA1) {
						ns.corporation.setMaterialMarketTA1(divisionName, cityName, materialName, true);
					}
				})
		});
	
	// if (!_continue) return false;


	// Ensure all existing warehouses have at least 300 storage, and fill that space with boosting materials
	let minStorage = 300;
	{
		_continue = tryMeetCondition(
			() => fieldOffices
				.filter((cityName) => ns.corporation.hasWarehouse(divisionName, cityName))
				.every((cityName) => ns.corporation.getWarehouse(divisionName, cityName).size >= minStorage),
			() => fieldOffices
				.filter((cityName) => ns.corporation.hasWarehouse(divisionName, cityName)
					&& ns.corporation.getWarehouse(divisionName, cityName).size < minStorage)
				.forEach((cityName) => {
					while (ns.corporation.getWarehouse(divisionName, cityName).size < minStorage
						&& canAfford(ns, ns.corporation.getUpgradeWarehouseCost(divisionName, cityName))
					) {
						ns.corporation.upgradeWarehouse(divisionName, cityName);
					}
				})
		) && _continue;

		// Ensure bulk purchase researched
		// TODO this needs work, bulk purchase requirement is onerous. Need logic for cyclic purchasing.
		const hasBulkPurchase = ns.corporation.hasResearched(divisionName, "Bulk Purchasing");
		if (!hasBulkPurchase) return false;

		// First round of materials purchase
		{
			const materialsExpected = [
				["Real Estate", 2700],
				["Hardware", 125],
				["AI Cores", 75],
			];
			_continue = tryMeetCondition(
				() => fieldOffices
					.filter((cityName) => ns.corporation.hasWarehouse(divisionName, cityName)
						&& ns.corporation.getWarehouse(divisionName, cityName).size >= minStorage)
					.every((cityName) => materialsExpected.every((mat) => ns.corporation.getMaterial(divisionName, cityName, mat[0]).qty >= mat[1])),
				() => {
					materialsExpected.forEach((purchaseOrder) => {
						fieldOffices
							.filter((cityName) => ns.corporation.hasWarehouse(divisionName, cityName)
								&& ns.corporation.getWarehouse(divisionName, cityName).size >= minStorage)
							.forEach((cityName) => {
								const material = ns.corporation.getMaterial(divisionName, cityName, purchaseOrder[0]);
								const shortfall = purchaseOrder[1] - material.qty;
								if (shortfall > 0 && canAfford(ns, material.cost * shortfall))
									ns.corporation.bulkPurchase(divisionName, cityName, purchaseOrder[0], shortfall);
							});
					});
				}
			) && _continue;
		}

		// if (!_continue) return false;
	}

	// Ensure at least on AdVert bought. (Is this a continuation condition? Are we okay without this if necessary?)
	_continue = tryMeetCondition(() => ns.corporation.getHireAdVertCount(divisionName) >= 1,
		() => {
			if (canAfford(ns, ns.corporation.getHireAdVertCost(divisionName))) {
				ns.corporation.hireAdVert(divisionName);
			}
		}
	) && _continue;
	if (!_continue) return false;

	// Apply selected upgrades up to level 2
	{
		const selectedUpgrades = [
			"FocusWires",
			"Neural Accelerators",
			"Speech Processor Implants",
			"Nuoptimal Nootropic Injector Implants",
			"Smart Factories",
		];
		const toLevel = 2;
		_continue = tryMeetCondition(() => selectedUpgrades.every((upg) => ns.corporation.getUpgradeLevel(upg) >= toLevel),
			() => {
				const firstRound = selectedUpgrades.filter((upg) => ns.corporation.getUpgradeLevel(upg) < toLevel);
				firstRound.forEach((upg) => {
					if (canAfford(ns, ns.corporation.getUpgradeLevelCost(upg))) {
						ns.corporation.levelUpgrade(upg);
					}
				});
				firstRound.filter((upg) => ns.corporation.getUpgradeLevel(upg) < toLevel)
					.forEach((upg) => {
						if (canAfford(ns, ns.corporation.getUpgradeLevelCost(upg))) {
							ns.corporation.levelUpgrade(upg);
						}
					});
			}
		) && _continue;
		// if (!_continue) return false;
	}

	// Investment round 1 checkpoint
	const spiritStats = ["mor", "hap", "ene"];
	const spiritThreshold = 0.99;
	{
		const thisRound = 1;
		const minimumAcceptableOffer = 210e9; // $210b
		const offer = ns.corporation.getInvestmentOffer();
		if (offer?.round === thisRound // This is the first round
			&& offer.funds >= minimumAcceptableOffer // Our expectations are met
			&& fieldOffices.length == allCities.length // We have fully expanded
			// Before accepting offer, check team spirit. No reason to leave money on the table.
			&& fieldOffices.every((cityName) => ns.corporation.getOffice(divisionName, cityName).employees.every((employeeName) => {
				const employee = ns.corporation.getEmployee(divisionName, cityName, employeeName);
				return spiritStats.every((stat) => employee[stat] > spiritThreshold);
			}))
		) {
			// Okay, it looks like we can procedurally accept this offer.
			ns.corporation.acceptInvestmentOffer();
		}
	}

	// Office expansion to 9 staff
	{
		const minStaff = 9;
		_continue = tryMeetCondition(() => fieldOffices
			.filter((cityName) => ns.corporation.hasWarehouse(divisionName, cityName)
				&& ns.corporation.getWarehouse(divisionName, cityName).size >= minStorage)
			.every((cityName) => ns.corporation.getOffice(divisionName, cityName).size >= minStaff),
			() => {
				const hirePerRound = 3;
				const firstRound = fieldOffices.filter((cityName) => ns.corporation.getOffice(divisionName, cityName).size < minStaff);
				firstRound.forEach((cityName) => ns.corporation.upgradeOfficeSize(divisionName, cityName, hirePerRound));
				firstRound.filter((cityName) => ns.corporation.getOffice(divisionName, cityName).size < minStaff)
					.forEach((cityName) => ns.corporation.upgradeOfficeSize(divisionName, cityName, hirePerRound));
			}
		) && _continue;
	}
	
	// Okay, at this point, if we aren't fully expanded, we're done for now.
	if (!_continue) return false;

	// Apply selected upgrades up to level 10
	{
		const selectedUpgrades = [
			"Smart Factories",
			"Smart Storage",
		];
		const toLevel = 10;
		_continue = tryMeetCondition(() => selectedUpgrades.every((upg) => ns.corporation.getUpgradeLevel(upg) >= toLevel),
			() => {
				const firstRound = selectedUpgrades.filter((upg) => ns.corporation.getUpgradeLevel(upg) < toLevel);
				firstRound.forEach((upg) => {
					if (canAfford(ns, ns.corporation.getUpgradeLevelCost(upg))) {
						ns.corporation.levelUpgrade(upg);
					}
				});
				firstRound.filter((upg) => ns.corporation.getUpgradeLevel(upg) < toLevel)
					.forEach((upg) => {
						if (canAfford(ns, ns.corporation.getUpgradeLevelCost(upg))) {
							ns.corporation.levelUpgrade(upg);
						}
					});
			}
		);
	}

	// Ensure all warehouses have at least 2000 storage, with support mats
	minStorage = 2000;
	{
		_continue = tryMeetCondition(() => fieldOffices.every((cityName) => ns.corporation.getWarehouse(divisionName, cityName).size >= minStorage),
			() => fieldOffices.filter((cityName) => ns.corporation.getWarehouse(divisionName, cityName).size < minStorage).forEach((cityName) => {
				while (ns.corporation.getWarehouse(divisionName, cityName).size < minStorage
					&& canAfford(ns, ns.corporation.getUpgradeWarehouseCost(divisionName, cityName))
				) {
					ns.corporation.upgradeWarehouse(divisionName, cityName);
				}
			})
		);

		// For all qualifying warehouses, invest in materials
		const warehousesToFill = fieldOffices.filter((cityName) => ns.corporation.getWarehouse(divisionName, cityName).size >= minStorage);
		const materialsExpected = [
			["Real Estate", 146400],
			["Hardware", 2800],
			["AI Cores", 2520],
			["Robots", 96],
		];
		const allFull = tryMeetCondition(
			() => warehousesToFill.every((cityName) => materialsExpected.every((mat) => ns.corporation.getMaterial(divisionName, cityName, mat[0]).qty >= mat[1])),
			() => {
				materialsExpected.forEach((mat) => {
					warehousesToFill.forEach((cityName) => {
						const shortfall = mat[1] - ns.corporation.getMaterial(divisionName, cityName, mat[0]).qty;
						if (shortfall > 0)
							ns.corporation.bulkPurchase(divisionName, cityName, mat[0], shortfall);
					});
				});
			}
		);

		if (!(_continue && allFull)) return false;
	}

	// Investment round 2 checkpoint
	{
		const thisRound = 2;
		const minimumAcceptableOffer = 5.1e12; // $5.1t
		const offer = ns.corporation.getInvestmentOffer();
		if (offer?.round === thisRound // This is the expected round
			&& offer.funds >= minimumAcceptableOffer // Our expectations are met
			&& fieldOffices.length == allCities.length // We have fully expanded
			// Before accepting offer, check team spirit. No reason to leave money on the table.
			&& fieldOffices.every((cityName) => ns.corporation.getOffice(divisionName, cityName).employees.every((employeeName) => {
				const employee = ns.corporation.getEmployee(divisionName, cityName, employeeName);
				return spiritStats.every((stat) => employee[stat] > spiritThreshold);
			}))
		) {
			// Okay, it looks like we can procedurally accept this offer.
			ns.corporation.acceptInvestmentOffer();
		}
	}

	// Ensure all warehouses have at least 3800 storage, with support mats
	minStorage = 3800;
	{
		_continue = tryMeetCondition(() => fieldOffices.every((cityName) => ns.corporation.getWarehouse(divisionName, cityName).size >= minStorage),
			() => fieldOffices.filter((cityName) => ns.corporation.getWarehouse(divisionName, cityName).size < minStorage).forEach((cityName) => {
				while (ns.corporation.getWarehouse(divisionName, cityName).size < minStorage
					&& canAfford(ns, ns.corporation.getUpgradeWarehouseCost(divisionName, cityName))
				) {
					ns.corporation.upgradeWarehouse(divisionName, cityName);
				}
			})
		);

		// For all qualifying warehouses, invest in materials
		const warehousesToFill = fieldOffices.filter((cityName) => ns.corporation.getWarehouse(divisionName, cityName).size >= minStorage);
		const materialsExpected = [
			["Real Estate", 230400],
			["Hardware", 9300],
			["AI Cores", 6270],
			["Robots", 726],
		];
		const allFull = tryMeetCondition(
			() => warehousesToFill.every((cityName) => materialsExpected.every((mat) => ns.corporation.getMaterial(divisionName, cityName, mat[0]).qty >= mat[1])),
			() => {
				materialsExpected.forEach((mat) => {
					warehousesToFill.forEach((cityName) => {
						const shortfall = mat[1] - ns.corporation.getMaterial(divisionName, cityName, mat[0]).qty;
						if (shortfall > 0)
							ns.corporation.bulkPurchase(divisionName, cityName, mat[0], shortfall);
					});
				});
			}
		);

		if (!(_continue && allFull)) return false;
	}

	// We are officially established and ready to begin tobacco.
	return true;
}

/**
 *  @param {import(".").NS} ns
 *  @param {String} divisionName
 *  @returns {Boolean} Is division "established", ready for next industry in queue
 */
function manageTobacco(ns, divisionName) {
	const hasOfficeAPI = tryMeetCondition(() => ns.corporation.hasUnlockUpgrade("Office API"),
		() => {
			if (canAfford(ns, ns.corporation.getUnlockUpgradeCost("Office API"))) {
				ns.corporation.unlockUpgrade("Office API");
			}
		}
	);
	if (!hasOfficeAPI) return false;
	const hasWarehouseAPI = tryMeetCondition(() => ns.corporation.hasUnlockUpgrade("Warehouse API"),
		() => {
			if (canAfford(ns, ns.corporation.getUnlockUpgradeCost("Warehouse API"))) {
				ns.corporation.unlockUpgrade("Warehouse API");
			}
		}
	);

	const mainCity = "Sector-12";
	const productNames = ["Menthols", "Slims", "E-Cigs", "Golden Bats", "Water Pipe"];


	let mainOffice = ns.corporation.getOffice(divisionName, mainCity);

	// First, hire up to 30 in main city
	let _continue = tryMeetCondition(() => mainOffice.size >= 30,
		() => {
			const addSize = 30 - mainOffice.size;
			const cost = ns.corporation.getOfficeSizeUpgradeCost(divisionName, mainCity, addSize);
			if (ns.corporation.getCorporation().funds >= cost) {
				ns.corporation.upgradeOfficeSize(divisionName, mainCity, addSize)
			}
		}
	);
	if (!_continue) return false;

	// At least one product in development
	if (!hasWarehouseAPI) return false;
	_continue = tryMeetCondition(() => ns.corporation.getDivision(divisionName).products.length > 0,
		() => {
			const newProductInvestment = 1000000000; // $1b
			if (ns.corporation.getCorporation().funds >= 2 * newProductInvestment) {
				ns.corporation.makeProduct(divisionName, mainCity, productNames[0] + " v0.1", newProductInvestment, newProductInvestment);
			}
		}
	);
	if (!_continue) return false;

	// At least one product must have completed development before continuing
	_continue = ns.corporation.getDivision(divisionName).products
		.map((productName) => ns.corporation.getProduct(divisionName, productName))
		.filter((prod) => prod.developmentProgress >= 100).length > 0;
	if (!_continue) return false;

	// Expand division into all cities, plus warehouses
	const allCities = cityNames;
	_continue = tryMeetCondition(() => ns.corporation.getDivision(divisionName).cities.length == allCities.length,
		() => {
			const div = ns.corporation.getDivision(divisionName);
			allCities.filter((cityName) => !div.cities.includes(cityName))
				.forEach((cityName) => {
					if (canAfford(ns, ns.corporation.getExpandCityCost() + ns.corporation.getPurchaseWarehouseCost())) {
						doAndLog(ns, "Expanding into city", ns.corporation.expandCity, [divisionName, cityName]);
						doAndLog(ns, "Purchasing warehouse", ns.corporation.purchaseWarehouse, [divisionName, cityName]);
					}
				});
		}
	);
	if (!_continue) return false;

	// Ensure warehouses in all division cities, just in case
	_continue = tryMeetCondition(
		() => ns.corporation.getDivision(divisionName).cities.every((cityName) => ns.corporation.hasWarehouse(divisionName, cityName)),
		() => ns.corporation.getDivision(divisionName).cities.forEach((cityName) => {
			if (canAfford(ns, ns.corporation.getPurchaseWarehouseCost())) {
				doAndLog(ns, "Purchasing warehouse", ns.corporation.purchaseWarehouse, [divisionName, cityName]);
			}
		})
	);
	if (!_continue) return false;

	// Every city has 9 staff
	_continue = tryMeetCondition(
		() => ns.corporation.getDivision(divisionName).cities.every((cityName) => ns.corporation.getOffice(divisionName, cityName).size >= 9),
		() => {
			ns.corporation.getDivision(divisionName).cities.filter((cityName) => ns.corporation.getOffice(divisionName, cityName).size >= 9)
				.forEach((cityName) => {
					const office = ns.corporation.getOffice(divisionName, cityName);
					if (office.size < 9) {
						const hireSize = 9 - office.size;
						if (canAfford(ns, ns.corporation.getOfficeSizeUpgradeCost(divisionName, cityName, hireSize))) {
							doAndLog(ns, "Upgrading office size", ns.corporation.upgradeOfficeSize, [divisionName, cityName, hireSize]);
						}
					}
				});
		}
	)
	if (!_continue) return false;

	// Fill any empty product slots
	const productSlotUpgrades = ["uPgrade: Capacity.I", "uPgrade: Capacity.II"];
	const productSlots = 3 + productSlotUpgrades.map((upg) => ns.corporation.hasResearched(divisionName, upg) ? 1 : 0)
		.reduce((a, b) => a + b, 0);
	while (ns.corporation.getDivision(divisionName).products.length < productSlots) {
		const newProductInvestment = 1000000000; // $1b
		if (ns.corporation.getCorporation().funds >= 2 * newProductInvestment) {
			doAndLog(ns, "Creating new product", ns.corporation.makeProduct, [divisionName, mainCity, productNames[ns.corporation.getDivision(divisionName).products.length] + " v0.1", newProductInvestment, newProductInvestment]);
		}
	}

	// If all products slots are full and completed, discontinue and replace worst product
	// This is not a continuation condition
	{
		const products = ns.corporation.getDivision(divisionName).products.map((productName) => ns.corporation.getProduct(divisionName, productName));
		if (products.length == productSlots && products.every((prod) => prod.developmentProgress == 100)) {
			const worstProduct = products.sort((a, b) => a.rat - b.rat)[0];
			const productName = worstProduct.name.split("v")[0];
			const newVersion = ns.nFormat(Math.log10(worstProduct.rat), "0.00")
			const newName = productName + "v" + newVersion;
			const newProductInvestment = Math.max(1000000000, Math.floor(ns.corporation.getCorporation().revenue / 4)); // $1b, or a quarter of per-second revenue
			if (ns.corporation.getCorporation().funds >= 2 * newProductInvestment) {
				doAndLog(ns, "Discontinuing product", ns.corporation.discontinueProduct, [divisionName, worstProduct.name]);
				doAndLog(ns, "Creating new product", ns.corporation.makeProduct, [divisionName, mainCity, newName, newProductInvestment, newProductInvestment]);
			}
		}
	}

	// Hire main city up to full staff
	const mainCityFullOfficeSize = 75;
	_continue = tryMeetCondition(
		() => ns.corporation.getOffice(divisionName, mainCity).size >= mainCityFullOfficeSize,
		() => {
			// Hire in chunks this size
			const startSize = ns.corporation.getOffice(divisionName, mainCity).size;
			const chunk = 3;
			while (ns.corporation.getOffice(divisionName, mainCity).size < mainCityFullOfficeSize && canAfford(ns, ns.corporation.getOfficeSizeUpgradeCost(divisionName, mainCity, chunk))) {
				ns.corporation.upgradeOfficeSize(divisionName, mainCity, chunk);
			}
			const endSize = ns.corporation.getOffice(divisionName, mainCity).size;
			if (endSize > startSize) {
				ns.print("Upgraded ", mainCity, " office size to ", endSize);
			}
		}
	)
	if (!_continue) return false;

	// Hereafter is maintenance mode, we could consider this industry established, if still nascent.
	// 1. Wilson analytics and corp-wide upgrades
	_continue = manageCorporationUpgrades(ns);
	if (!_continue) return false; // Though established, we must curtail spending to save for Wilson

	// 2. AdVert or +15 employees at main city
	const hireChunk = 15;
	{
		const adVertOrHireCost = Math.min(ns.corporation.getHireAdVertCost(divisionName), ns.corporation.getOfficeSizeUpgradeCost(divisionName, mainCity, hireChunk));
		if (canAfford(ns, adVertOrHireCost)) {
			if (adVertOrHireCost == ns.corporation.getHireAdVertCost(divisionName)) {
				ns.corporation.hireAdVert(divisionName);
			} else {
				ns.corporation.upgradeOfficeSize(divisionName, mainCity, hireChunk);
			}
		}
	}

	// 3. Hiring across other cities if needed (60 behind main city? Sliding?)
	{
		const headOfficeSize = ns.corporation.getOffice(divisionName, mainCity).size;
		const headOfficeSizeAdvantage = 60;//Math.max(60, Math.ceil(ns.corporation.getOffice(divisionName, mainCity).size * 2 / 3));
		const fieldOffices = ns.corporation.getDivision(divisionName).cities.filter((cityName) => ns.corporation.getOffice(divisionName, cityName).size + 60 < headOfficeSize);
		fieldOffices.forEach((cityName) => {
			const targetSize = headOfficeSize - headOfficeSizeAdvantage;
			const officeSize = ns.corporation.getOffice(divisionName, cityName).size;
			const hiringRound = Math.min(targetSize - officeSize, hireChunk);
			if (canAfford(ns, hiringRound > 0 && ns.corporation.getOfficeSizeUpgradeCost(divisionName, cityName, hiringRound))) {
				ns.corporation.upgradeOfficeSize(divisionName, cityName, hiringRound);
			}
		});
	}

	return true; // Tobacco's in maintenance mode
}

/**
 *  @param {import(".").NS} ns
 *  @returns {Boolean} True, continued spending okay; false, halt continued spending.
 */
function manageCorporationUpgrades(ns) {
	const wilson = "Wilson Analytics";
	while (canAfford(ns, ns.corporation.getUpgradeLevelCost(wilson))) {
		const oldLevel = ns.corporation.getUpgradeLevel(wilson);
		ns.corporation.levelUpgrade(wilson);
		const newLevel = ns.corporation.getUpgradeLevel(wilson);
		ns.print("Upgraded ", wilson, " from level ", oldLevel, " to ", newLevel);
		ns.toast(wilson + " -> " + newLevel, (oldLevel < newLevel ? ns.enums.toast.SUCCESS : ns.enums.toast.ERROR), 10000);
	}

	const wilsonWaitSeconds = 60; // If wilson is affordable within this many seconds, wait and buy wilson.
	if (ns.corporation.getCorporation().revenue * wilsonWaitSeconds >= ns.corporation.getUpgradeLevelCost(wilson))
		return false;

	// Further upgrades are pegged again Wilson level according to a schema
	const wilsonLevel = ns.corporation.getUpgradeLevel(wilson);
	const upgradeLevelsPerWilson = [
		// Skill bumps
		["FocusWires", 2],
		["Neural Accelerators", 2],
		["Nuoptimal Nootropic Injector Implants", 2],
		["Speech Processor Implants", 2],

		// Research and sales
		["Project Insight", 1.5],
		["ABC SalesBots", 2],

		// Productivity and storage
		["Smart Factories", 1],
		["Smart Storage", 1],

		// Dreamsense has almost no impact on product industries; this is entirely for agriculture's benefit
		["DreamSense", 0.5],
	];
	upgradeLevelsPerWilson.forEach((upgradePriority) => {
		const [upg, wilsonCoefficient] = upgradePriority;
		const upgLevel = Math.round(wilsonCoefficient * wilsonLevel);
		// Only consider one upgrade per iteration, to smooth spending across many priorities
		if (canAfford(ns, ns.corporation.getUpgradeLevel(upg) < upgLevel && ns.corporation.getUpgradeLevelCost(upg))) {
			const newLvl = ns.corporation.getUpgradeLevel(upg);
			ns.corporation.levelUpgrade(upg);
			ns.print("Upgraded ", upg, " to level ", newLvl);
		}
	})

	return true;
}

/**
 * 
 * @param {import(".").NS} ns
 * @param {string} divisionName
 */
function manageProductPricing(ns, divisionName) {
	if (ns.corporation.hasResearched(divisionName, "Market-TA.II")) return;
	if (ns.corporation.getCorporation().state !== "START") return;
	// ns.print("squirgle");
	ns.corporation.getDivision(divisionName).products
		.map((productName) => ns.corporation.getProduct(divisionName, productName))
		.filter((product) => product.developmentProgress == 100)
		.forEach(product => {
			// const oldSellCost = product.sCost;
			const oldMPCoeff = product.sCost === 0 ? 10 : parseFloat(product.sCost.split("*")[1] ?? "10");
			if (Object.entries(product.cityData).every((cityEntry) => cityEntry[1][0] == 0)) {
				// All cities storage empty; bump up cost a smidge
				const smidge = 1.05; // 2%
				const newMPCoeff = oldMPCoeff * smidge;
				ns.corporation.sellProduct(divisionName, "Sector-12", product.name, "MAX", "MP*" + newMPCoeff, true);
				// ns.print("beep: " + newMPCoeff);
			} else if (Object.entries(product.cityData).some((cityEntry) => cityEntry[1][1] > cityEntry[1][2])) {
				// Some city making more than it's selling; bump down cost a floored smidge
				const smidge = 0.98;
				const newMPCoeff = Math.floor(oldMPCoeff * smidge);
				ns.corporation.sellProduct(divisionName, "Sector-12", product.name, "MAX", "MP*" + newMPCoeff, true);
				// ns.print("boop: " + newMPCoeff);
			}
		});
	const thing = { "name": "Menthols v4.54", "cmp": 20.144400000000072, "rat": 108422.05294502684, "properties": { "qlt": 112669.48891282447, "per": 103515.25519901817, "dur": 111904.86658790875, "rel": 102751.32990383038, "aes": 102115.09040774613, "fea": 107438.61756174937 }, "pCost": 13972.172488073076, "sCost": "MP*1.53", "cityData": { "Aevum": [0, 22.79332405697984, 22.79332405697984], "Chongqing": [0, 22.65040128114863, 22.65040128114863], "Ishima": [0, 22.624885367528865, 22.624885367528865], "New Tokyo": [0, 22.914679048178073, 22.914679048178073], "Sector-12": [0, 32.36594939022537, 32.36594939022537], "Volhaven": [0, 22.850919032989438, 22.850919032989438] }, "developmentProgress": 100 }
}

/**
 * 
 * @param {function():boolean} conditionFunc If this predicate is false, run the execFunc
 * @param {function():void} failConditionFunc This is executed if the condition is false on entry
 * @returns {Boolean} True if the conditionFunc is true before or after failConditionFunc, false if the condition remains false after failConditionFunc
 */
function tryMeetCondition(conditionFunc, failConditionFunc) {
	if (conditionFunc()) return true;
	failConditionFunc();
	return conditionFunc();
}

/**
 * 
 * @param {import(".").NS} ns
 * @param {string} label
 * @param {function()} doFunction 
 * @param {any[]} parameters 
 */
function doAndLog(ns, label, doFunction, parameters) {
	ns.print(label, ": ", parameters.join(", "));
	doFunction(...parameters);
}

// /**
//  * 
//  * @typedef {Object} EmployeeSpirit
//  * @property {Number} morale
//  * @property {Number} happiness
//  * @property {Number} energy
//  */

// /**
//  * 
//  * @param {import(".").NS} ns
//  * @param {string} divisionName
//  * @returns {EmployeeSpirit} Average employee spirit across whole division
//  */
// function calculateTeamSpirit(ns, divisionName) {
// 	const fieldOffices = ns.corporation.getDivision(ns, divisionName).cities.map((cityName) => ns.corporation.getOffice(divisionName, cityName));
// 	const rosters = fieldOffices.map((office) => {
// 		return { city: office.loc, roster: office.employees.map((employeeName) => ns.corporation.getEmployee(divisionName, office.loc, employeeName)) };
// 	});

// }