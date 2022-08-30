import {decimalStringToNumber, requireBitNodeOrSource} from "helperlib.js"

/**
 *  @typedef {Object} Position
 *  @property {Number} longShares
 *  @property {Number} longAvgPrice
 *  @property {Number} shortShares
 *  @property {Number} shortAvgPrice
 *  @property {Number} maxShares
 *  @property {Number} remainingShares
 */

/**
 *  @typedef {Object} StockInfo
 *  @property {String} sym
 *  @property {Position} position
 *  @property {Number} forecast
 *  @property {Number} volatility
 *  @property {Number} bidPrice
 *  @property {Number} askPrice
 */

/** @param {import(".").NS} ns */
export async function main(ns) {
	ns.disableLog("sleep");
	ns.tail();
	if (!checkTix(ns)) return;
	ns.scriptKill("divest.js", "home");

	const canShort = requireBitNodeOrSource(ns, 8, 2);

	let wallet = 0;
	if (ns.args.length > 0) {
		wallet = decimalStringToNumber(ns.args[0]);
		if (isNaN(wallet)) {
			const message = "ERROR: First argument '" + ns.args[0] + "' should be a number (format 0.0*a), or omitted to use all funds.";
			ns.print(message);
			ns.tprint(message);
			ns.exit();
		}
	} else {
		wallet = ns.getPlayer().money;
	}

	// Starting wealth is new newly invested money plus total of stock currently held
	// const startingWealth = wallet + ns.stock.getSymbols()
	// 	.map((sym) => symbolToInfo(ns, sym))
	// 	.map((info) => info.position.longShares * info.position.longAvgPrice + info.position.shortShares * info.position.shortAvgPrice)
	// 	.reduce((a, b) => a + b, 0);
	const commission = 100000; // $100,000 brokerage fee on all buy and sell actions
	const safeForecastMargin = 0.1; // Only consider stocks at least this much either side of 0.5 forecast. This value is adjusted based on the remaining shares.
	const minTransactionValue = 10000000;

	
	while (true) {
		const allSymbols = ns.stock.getSymbols();//ns.read("stockSymbols.txt").split(",");

		// Sell phase
		const portfolio = allSymbols
			.map((sym) => symbolToInfo(ns, sym))
			.filter((info) => (info.position.longShares + info.position.shortShares) > 0);
		// Sell long
		portfolio
			.filter((info) => info.position.longShares > 0 && info.forecast < (0.5 - (info.volatility / 2)))
			.forEach((info) => wallet += info.position.longShares * ns.stock.sellStock(info.sym, info.position.longShares) - commission);
		// Sell short
		portfolio
			.filter((info) => info.position.shortShares > 0 && info.forecast > (0.5 + (info.volatility / 2)))
			.forEach((info) => wallet += info.position.shortShares * ns.stock.sellShort(info.sym, info.position.shortShares) - commission);

		const opportunities = allSymbols
			.map((sym) => symbolToInfo(ns, sym))
			.filter((info) => info.position.remainingShares > 0)
			// Exclude stocks with a marginal forecast
			.filter((info) => Math.abs(info.forecast - 0.5) >= (safeForecastMargin - (safeForecastMargin * info.position.remainingShares / info.position.maxShares / 2)))
			// Sort by magnitude of forecast
			.sort((a, b) => Math.abs(b.forecast - 0.5) - Math.abs(a.forecast - 0.5));
		opportunities.forEach((info) => {
			const shortOpportunity = info.forecast < 0.5;
			if (!canShort && shortOpportunity) return;
			const askOrBidPrice = shortOpportunity ? info.bidPrice : info.askPrice;
			const sharesToBuy = Math.min(info.position.remainingShares, Math.floor((/*wallet*/ ns.getPlayer().money - commission) / askOrBidPrice));
			if (sharesToBuy * askOrBidPrice < minTransactionValue) return;
			const buyFunc = shortOpportunity ? ns.stock.buyShort : ns.stock.buyStock;
			wallet -= sharesToBuy * buyFunc(info.sym, sharesToBuy) + commission; // TODO fix commission leak from wallet
		});

		await ns.sleep(250);
	}
}

export function divestAll(ns) {
	const allStock = ns.stock.getSymbols() // ns.read("stockSymbols.txt").split(",")
		.map((sym) => symbolToInfo(ns, sym));
	// Sell long
	allStock
		.filter((info) => info.position.longShares > 0)
		.forEach((info) => ns.stock.sellStock(info.sym, info.position.longShares));
	// Sell short
	allStock
		.filter((info) => info.position.shortShares > 0)
		.forEach((info) => ns.stock.sellShort(info.sym, info.position.shortShares));
}

/**
 *  @param {import(".").NS} ns
 *  @param {String} sym
 *  @returns {Position}
 */
function getStockPosition(ns, sym) {
	const [_longShares, _longAvgPrice, _shortShares, _shortAvgPrice] = ns.stock.getPosition(sym);
	const _maxShares = ns.stock.getMaxShares(sym);
	return {
		longShares: _longShares, longAvgPrice: _longAvgPrice,
		shortShares: _shortShares, shortAvgPrice: _shortAvgPrice,
		maxShares: _maxShares,
		remainingShares: _maxShares - _longShares - _shortShares,
	};
}

/**
 *  @param {import(".").NS} ns
 *  @param {String} sym
 *  @returns {StockInfo}
 */
export function symbolToInfo(ns, sym) {
	return {
		sym: sym,
		position: getStockPosition(ns, sym),
		forecast: ns.stock.getForecast(sym),
		volatility: ns.stock.getVolatility(sym),
		bidPrice: ns.stock.getBidPrice(sym),
		askPrice: ns.stock.getAskPrice(sym),
	};
}

/**
 *  @param {import(".").NS} ns
 *  @returns {Boolean}
 */
export function checkTix(ns, report = true) {
	const access = ns.stock.has4SDataTIXAPI();
	if (report)	ns.print(access ? "TIX API access confirmed." : "ERROR: No TIX API access.");
	return access;
}