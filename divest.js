/** @param {import(".").NS} ns */
export async function main(ns) {
	ns.disableLog("sleep");
	ns.tail();

	const symbols = ns.stock.getSymbols();
	
	while (true) {
        const stockHeldLong = symbols.map(function(sym) {return [sym, ns.stock.getPosition(sym)]}).filter(function(symPos) {return symPos[1][0] > 0});
		for (const symPos of stockHeldLong) {
            const sym = symPos[0];
			const sharesLong = symPos[1][0];
			if (ns.stock.getForecast(sym) < 0.5 /* && ns.stock.getSaleGain(sym, sharesLong, "Long") > 0*/) {
                ns.stock.sellStock(sym, sharesLong);
			}
        }
        
        await ns.sleep(250);
	}

}