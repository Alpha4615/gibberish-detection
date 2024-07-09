const fs = require('fs');
const expect = require("chai").expect;
const R = require('../index.js');

const detector = R();

const testModel = (name, model) => {
	it("Valid JSON", function() {
		expect(model).to.be.an('object');
	});

	it("Expected Structure", function() {
		expect(detector.isValidModel(model)).to.be.true;
	});

	describe(name+" - Baselines", function() {
		it("Is Valid", function() {
			expect(model.baseline).to.be.an('object');
		});

		it("Baseline.good.min exceeds Baseline.bad.maximum", function () {
			expect(model.baseline.good.min > model.baseline.bad.max).to.be.true;
		})

	})
}

describe("Gibberish-Detector Tests", () => {
	describe("Built-In Data Model", function() {
		let builtInModel = require('../data/model.json');
		testModel("Built in Model", builtInModel);

		let NGsentences = [
			"Hello, how are you? it is nice to meet you.",
			"Hi",
			"Hey, wassup?",
		];

		testGibString = "nakjsfnzgfaekjajdgli";
		NGsentences.forEach(s => it("Detect As Non-Gibberish: "+s, () => expect(detector.detect(s)).to.be.false));
		it("Detect As Gibberish: "+testGibString, () => expect(detector.detect(testGibString)).to.be.true)
	});

	describe("Input Validity", function() {
		let theseShouldntThrow = ['hello', '', false, null, undefined]
		let theseShouldThrow = [[], {}, ()=>{}];

		theseShouldntThrow.forEach(s => it(`Should not throw exception: ${JSON.stringify(s)}:${typeof s}`, () => expect(() => detector.detect(s)).to.not.throw()));
		theseShouldThrow.forEach(s => it(`Should throw exception: ${JSON.stringify(s)}:${typeof s}`, () => expect(() => detector.detect(s)).to.throw()));

	});

	describe("OTF model training", function() {
		let trainingString = "Hello, I am a programmer that enjoys coding and doing cool things. On Saturdays, especially, I do go to the beach and run some laps along the shore. It is a thoroughly entertaining thing to do. I don't particular enjoy horror moves and I'm not a fan of typing long boilerplate sentences. In normal situations, you would use a few megabytes worth of text, you see. But for the purposes of unit testing, I just need to it to be long enough to get a good separation between the good and base baselines. Ya know?"
		let badSamples = ['xcxmxnfzxdzxdfmahtuaewitsp', 'kjaanbcasofwetoaretioafsaio', 'xtiamnadmgtae'];
		let goodSamples = ["I have been a programmer since I was about eleven years old", "I started my actual career of programming at seventeen", "I do believe robots rock", "Please exhibit gracious professionalism to all that you encounter."]
		testModel("On-the-fly Trained Model", R().train(trainingString, goodSamples, badSamples));
	});

	describe("Configuration", function() {
		let goodThresholdFn = (model) => 42;
		let badThresholdFn = true;

		let goodModel = detector.get('model');
		let badModel = {cowsGo: "moo"}

		let goodUseCache = true;
		let badUseCache = "What?";

		let goodConfig = {thresholdFn: goodThresholdFn, model: goodModel, useCache: goodUseCache}

		it("Default configuration initializes", () => {
			expect(() => R()).to.not.throw();
		})
		it("Well-formed configuration initializes", () => {
			expect(() => R(goodConfig)).to.not.throw();
		})


		it("Run-time set of thresholdFn carries through", () => {
			expect(R().set('thresholdFn', goodThresholdFn).get("thresholdFn")).to.equal(goodThresholdFn);
		})

		it("Run-time set of model carries through", () => {
			expect(R().set('model', goodModel).get("model")).to.eql(goodModel);
		})

		it("Run-time set of useCache carries through", () => {
			expect(R().set('useCache', goodUseCache).get("useCache")).to.equal(goodUseCache);
		})

		it("Bad thresholdFn during initialization is caught", () => {
			expect(() => R({thresholdFn: badThresholdFn})).to.throw();
		})
		it("Bad thresholdFn during runtime set is caught", () => {
			expect(() => R().set('thresholdFn', badThresholdFn)).to.throw();
		})

		it("Bad model during initialization is caught", () => {
			expect(() => R({model: badModel})).to.throw();
		})
		it("Bad model during runtime set is caught", () => {
			expect(() => R().set('model', badModel)).to.throw();
		})

		it("Bad useCache during initialization is caught", () => {
			expect(() => R({useCache: badUseCache})).to.throw();
		})
		it("Bad useCache during runtime set is caught", () => {
			expect(() => R().set('useCache', badUseCache)).to.throw();
		})

	})
});

