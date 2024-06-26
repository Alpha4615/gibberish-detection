"use strict";

const sanitizeText = (sample) =>{
	// remove all linebreaks, replace them with spaces
	sample = sample.split("\r\n").join(" ");
	sample = sample.split("\n").join(" ");
	sample = sample.split("\t").join(" ");

	// All sentence terminators (!,.,?,...) should be treated as whitespace
	// Here, we care about words and word boundaries, not sentence boundaries.
	// Put another way we want to see how often a letter might be the last letter of the word
	// This will essentially merge the count for "this letter at end of sentence" and "this letter at end of word" which serves the same effect.
	sample = sample.replace(/[!?.]/g, ' ');

	// convert double spaces to single spaces
	sample = sample.replace(/  +/g, ' ');

	// normalize the text to take care of non-latin characters
	sample = convertToLatinEquivalent(sample);

	// regex pattern to eliminate noise from the sample
	let pattern = /[0-9!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/g
	sample = sample.replace(pattern, '');

	return sample;
}

/**
 * Creates the training model using Markov Chaining that is later used to score suspect strings.
 * @param {String} sample A large block of "good" text where letter adjacency frequencies are calculated. This likely should be a long piece of literature
 * @param {String[]|String} goodLines A list of sentences that are example of "good" letter arrangements. These lines are individually scored to calculate a tolerance threshold. 
 * @param {String[]|String} badLines A list of sentences that are example of "bad" letter arrangements (e.g., letter mashing) These lines are individually scored to calculate a tolerance threshold.
 * @returns {{matrix: [{x: String, y: Number}], baseline: {good: {min: Number, max: Number, avg: Number}, bad: {min: Number, max: Number, avg: Number}}}} The training model containing the the letter adjacency frequencies amd the baseline calculations for goodLines and badLines
 */
const train = (sample, goodLines, badLines) => {
	sample = sanitizeText(sample);

	let split = sample.toLowerCase().split("");
	let analysis = [];
	let analysisCache = {};

	for (let x = 0; x < split.length; x++) {
		if (!split[x+1]) {
			break;
		}
		let letterPair = String(split[x])+String(split[x+1]);

		// have we discovered this pair before?
		let existingFind = analysisCache[letterPair];

		if (existingFind) {
			existingFind.y++;
		} else {
			let newEntry = {x: letterPair, y: 1};
			analysis.push(newEntry);
			analysisCache[letterPair] = newEntry;
		}
	}

	// sort the matrix by amount of hits descending. This should make searches against "good" samples complete a little faster than gibberish samples.
	analysis = analysis.sort((a,b) =>  b.y - a.y);

	let result = {matrix: analysis, baseline: {good:{}, bad:{}}};

	// convert a line-delimted string into an array
	if (!Array.isArray(goodLines))
		goodLines = goodLines.split("\n");
	if (!Array.isArray(badLines))
		badLines = badLines.split("\n");

	// get aggregate information about the good samples and bad samples to form the baselines (so threshold can later be calculated)
	result.baseline.good = scoreLines(goodLines, analysis)
	result.baseline.bad = scoreLines(badLines, analysis)
	
	return result;
}

const convertToLatinEquivalent = (inputString) => {
    // Remove diacritics using normalize
    const normalizedString = inputString.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Use a regular expression to replace non-Latin characters
    const latinEquivalentString = normalizedString.replace(/[^\x00-\x7F]/g, '');

    return latinEquivalentString;
};

/**
 * Returns the threshold that a test score must reach in order to determine that it's not likely gibberish
 * @param {{matrix: [{x: String, y: Number}], baseline: {good: {min: Number, max: Number, avg: Number}, bad: {min: Number, max: Number, avg: Number}}}} model The training model to score against
 * @returns {Number} The average of the "good minimum" and the "bad maximum"
 */
const calculateThreshold = (model) => (model.baseline.good.min + model.baseline.bad.max) / 2;

/**
 * Scores a series of lines against the model and returns an aggregate calculation of minimum score, maximum score, and average score.
 * @param {[String]} lines 
 * @param {*} model 
 */
const scoreLines = (lines, model) => {
	const scores = lines.map(line => assignScore(String(line).trim(), model));
	const min = Math.min(...scores);
	const max = Math.max(...scores);
	const average = scores.reduce((a,b) => a + b, 0) / scores.length;

	return {min, max, avg: average};
}

/**
 * Assesses a score of a suspect string
 * @param {String} test The string being scored 
 * @param {*} matrix The matrix aspect of the learning model that contains the letter adjacency frequencies
 * @param {Boolean} [useCache=true] Determines if caching should be used when a letter pair has been discovered from the training model. Setting to true is notably faster but could theoretically higher memory cost on tests against (much) longer strings
 * @returns {Number} The average letter-adjacency score of each letter pairing, derived from the training model
 */
const assignScore = (test, matrix, useCache = true) => {
	// Replace line breaks with spaces
	const sanitized = sanitizeText(test);
	test = String(sanitized).split("\n").join(" ");

	let split = test.toLowerCase().split("");
	let pairCount = 0;
	let totalScore = 0;

	for (let x = 0; x < split.length; x++) {
		// don't do anything if the letter is by itself (last letter of the sample)
		if (!split[x+1]) {
			break;
		}

		let modelFind;
		let letterPair = String(split[x])+String(split[x+1]);
		
		if (useCache) {
			if (modelCache[letterPair]) {
				modelFind = modelCache[letterPair];
			} else {
				modelFind = matrix.find(m => m.x == letterPair);
				modelCache[letterPair] = modelFind;
			}
		} else {
			modelFind = matrix.find(m => m.x == letterPair);
		}

		pairCount++;

		// if match was found, add it to total score count
		if (modelFind) {
			totalScore += modelFind.y;
		}
	}

	// return average
	return totalScore / pairCount;
}

/**
 * 
 * @param {String} test The suspect string
 * @param {*} model 
 * @param {function} thresholdFn The function that calculates the minimum score before gibberish is declared
 * @param {Boolean} [useCache=true] Determines if caching should be used when a letter pair has been discovered from the training model. Setting to true is notably faster but could theoretically higher memory cost on tests against (much) longer strings
 */
const testGibberish = (test,model, thresholdFn, useCache = true) => { 
	thresholdFn = thresholdFn || calculateThreshold;
	const score = assignScore(test, model.matrix, useCache);
	const threshold = thresholdFn(model);
	return score <= threshold;
}

const isValidMatrix = (matrix) => {

	if (!matrix || !Array.isArray(matrix))
		return false;

	let errorState = false;
	
	matrix.some(m => {
		if (typeof m !== "object" || Array.isArray(m))
			return errorState = true;
		
		if (typeof m.x != "string" || m.x.length != 2)
			return errorState = true;

		if (typeof m.y != "number" )
			return errorState = true;
	});

	return !errorState;
}
/**
 * Tests for valid structure of a learning model
 * @param {{}} model 
 */
const isValidModel = model => {
	if (!model || typeof model !== "object" || Array.isArray(model))
		return false;

	if (!isValidMatrix(model.matrix))
		return false;
	
	if (!model.baseline || typeof model.baseline !== "object" || Array.isArray(model.baseline))
		return false;
	
	if (!model.baseline.good || typeof model.baseline.good !== "object" || Array.isArray(model.baseline.good))
		return false;

	if (typeof model.baseline.good.min !== "number" || typeof model.baseline.good.max !== "number" || typeof model.baseline.good.avg !== "number")
		return false;

	if (!model.baseline.bad || typeof model.baseline.bad !== "object" || Array.isArray(model.baseline.bad))
		return false;

	if (typeof model.baseline.bad.min !== "number" || typeof model.baseline.bad.max !== "number" || typeof model.baseline.bad.avg !== "number")
		return false;

	return true;
}


const testConfig = config => {
	if (!isValidModel(config.model)) {
		throw new Error("model provided is not a valid structure.");
	}

	if (typeof config.thresholdFn !== 'function') {
		throw new Error("thresholdFn must be a function");
	}

	if (typeof config.useCache !== "boolean") {
		throw new Error("useCache must be a boolean");
	}
}

// exposes factory
module.exports = function(config) {
	if (config && typeof config !== "object" && !Array.isArray(config)) {
		throw new Error("config argument must be an object")
	}

	let	model = require("./data/model.json");

	let defaultConfig = {
		model: model,
		thresholdFn: calculateThreshold,
		useCache: true,
	}

	config = config ? Object.assign(defaultConfig, config) : defaultConfig;

	// do sanity tests on the config
	testConfig(config);

	let returnObj = {
		train: train,

		/**
		 * 
		 * @param {string} name The name of the configuration property being set 
		 * @param {*} value 
		 */
		set: function (name, value) {
			// create a config clone so we can make sure it's valid
			let cloneConfig = Object.assign({}, config);
			cloneConfig[name] = value;

			testConfig(cloneConfig);

			// no exceptions thrown, we actually set it
			config[name] = value;

			return this;
		},

		/**
		 * Retrieves a configuration value
		 * @param {string} name The configuration property being sought
		 */
		get: name => config[name],

		isValidModel: isValidModel,

		/**
		 * Provides a numerical score, averaging from the individual score of each letter-pair, based off the scores in the matrix  
		 * @param {string} testString 
		 * @param {[{x: String, y: Number}]} overrideMatrix Uses the matrix in the configuration model if non is provided
		 * @returns {number}
		 */
		assignScore: (testString, overrideMatrix = undefined) => {
			// are they providing own matrix?

			if (overrideMatrix) {
				// this is potentially confusing and one might pass a model here, so we'll automatically switch it to the actual matrix in that case.
				if (!isValidMatrix(overrideMatrix)) {
					if (isValidModel(overrideMatrix)) {
						overrideMatrix = overrideMatrix.matrix;
					} else {
						throw new Error("Malformed matrix provided")
					}
				}
			}

			return  assignScore(testString, overrideMatrix || config.model.matrix, config.useCache);		
		},

	/**
	 * @param {string} testString
	 * @param {{matrix: [{x: String, y: Number}], baseline: {good: {min: Number, max: Number, avg: Number}, bad: {min: Number, max: Number, avg: Number}}}} overrideModel The model to use when making the determine. If none is provided, the model in the configuration is used.
	 */
		detect: (testString, overrideModel = null) => {
			if (overrideModel && !isValidModel(overrideModel)) {
				throw new Error("Malformed learning model provided");
			}

			let useModel = overrideModel || config.model;

			return testGibberish(testString, useModel, config.thresholdFn, config.useCache);;
		}
	}

	returnObj.isGibberish = returnObj.detect;

	return returnObj;

}