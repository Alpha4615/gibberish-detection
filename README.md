# Gibberish Detector

This utility is used to identify if a string of text contains gibberish, using a relatively simple implementation of Machine Learning and Markov Chaining. The utility is trained with a large sample of legitimate sentences with which it builds a model to determine the probability that any two characters would be found adjacently.

# Configuration
Options can be set during or after initialization:

    const gibberish = require("gibberish-detective")({useCache: false});
    gibberish.set("useCache", true)

## Options
|Name|Type  | Default | Description
|--|--|--|--
|useCache  | bool  | true | Use cache during matrix querying
|model     | obj | *shipped model* | A learning model outputted from `.train()`that is used to calculate letter pairing frequencies
|thresholdFn | fn(*model*) | avg(baseline.good.min, baseline.bad.max) | A function that outputs a number to determine the minimum value that an `.assignScore()` output can be before it is considered to be gibberish

# Detection
The `.detect()`(`.isGibberish()` is an alias) function takes a string and returns a boolean on whether or not it detects the string as gibberish.

    gibberish.detect('Luke, I am your second cousin!'); // returns false
    gibberish.detect('fasdfhaiufaewroawifasdaeta'); // returns true 

You may override the training model it is testing against by passing it in as the second (and optional) argument.


# Training

This package is shipped with a default model that was trained against a Sherlock Holmes novel.  If necessary, a new model can be generated. As an example, if someone wishes to use this with another language, it might be prudent to generate a model based off of this language.

For best results the training text used should be decently long (at least few megabytes) with diverse and legitimate words. It is not recommended that it be trained using literature from the science fiction and fantasy genres because those selections often contain unusual word formations.

To create a new learning model, you must provide it with the aforementioned large sample of text to build the learning matrix, a sample of short lines of sentences that make sense, and a sample of lines made up of gibberish. It uses the last two data sets to form a threshold between gibberish and non-gibberish text.

    let gibberish = require("gibberish-detective")();
    let fs = require('fs');
    let sample = fs.readFileSync('./data/good.txt', 'utf-8');
    let sample_good_small = fs.readFileSync('./data/good_sm.txt', 'utf-8');
    let sample_bad = fs.readFileSync('./data/bad.txt', 'utf-8');
    
    let newModel = gibberish.train(sample, sample_good_small, sample_bad);
    
    gibberish.set("model", newModel);

It is recommended that if re-training is necessary that this process only be done once and the resultant model be saved to a file and then thereafter that file is loaded into into the module at init-time:

At train time:

    let fs = require('fs');
    let newModel = gibberish.train(sample, sample_good_small, sample_bad);
    fs.writeFileSync("mymodel.json", JSON.stringify(newModel))

At run-time

    let myLearningModel = require('mymodel.json');
    let gibberish = require("gibberish-detector")({model: myLearningModel});

# Attributions
 rrenaud originally created a projected similar to this in python, called [Gibberish-Detector](https://github.com/rrenaud/Gibberish-Detector).