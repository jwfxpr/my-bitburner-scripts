// TODO allServers

/** @param {import(".").NS} ns */
export async function main(ns) {
	const message = "This is a library module, not a script. Do not run directly; rather, import functions into other scripts as needed.";
	ns.tprint(message);
	ns.print(message);
}

/** @param {String} text */
export function corruptText(text, chance = 1/7) {
	const randFrom = (str) => str[Math.floor(Math.random() * str.length)];
	const classes = ["abcdefghijklmnopqrstuvwxyz", "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "1234567890", " _", "()[]{}<>"];
	const other = `!@#$%^&*()_+|\\';"/.,?\`~`;

	const randomise = (char) => {
		for (const c of classes) {
			if (c.includes(char)) return randFrom(c);
		}
		return randFrom(other);
	}

	let newText = text;
	for (let i = 0; i < text.length; i++) {
		if (Math.random() <= chance) {
			newText = newText.substring(0, i) + randomise(newText[i]) + newText.substring(i + 1);
		}
	}
	return newText;
}

/**
 *  @param {String} decimalString
 *  @returns {Number}
 */
export function decimalStringToNumber(decimalString) {
	const lastChar = decimalString[decimalString.length - 1];
	if (isNaN(parseInt(lastChar))) {
		return parseFloat(decimalString.substring(0, decimalString.length - 1) * charToMagnitude(lastChar));
	} else {
		return parseFloat(decimalString);
	}
}

/**
 *  @param {String} char
 *  @returns {Number}
 */
export function charToMagnitude(char) {
		const magnitudes = "kmbtqQ";
		return Math.pow(1000, magnitudes.indexOf(char) + 1);
}

/**
 *  @param {String} char
 *  @param {Number} bn
 *  @param {Number} minSource
 *  @returns {Boolean}
 */
export function requireBitNodeOrSource(ns, bn, minSource = 1) {
	return ns.getPlayer().bitNodeN === bn 
		|| ns.singularity.getOwnedSourceFiles().some((source) => source.n === bn && source.lvl >= minSource);
}

const decimalNumberSuffixes = ["", "k", "m", "b", "t", "q", "Q", "s", "S", "o", "n", "D", "uD", "dD", "tD", "qD", "QD", "sD"];


/**
 * Format a large number (> trillions) into `0.000a` format.
 * @param {Number} number Number to format
 * @param {Number} precision How many digits after the decimal point to print
 * @returns {String}
 */
export function bigFormat(number, precision = 3) {
	const magnitude = Math.floor(Math.log10(number) / 3);
	if (magnitude <= 0)
		return number.toString();
	const magnitudeValue = number / (10 ** (3 * magnitude));
	const valueFixed = magnitudeValue.toFixed(precision);
	return `${valueFixed}${decimalNumberSuffixes[magnitude]}`;
}