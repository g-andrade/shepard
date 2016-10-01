/*jshint multistr: true */
/*jshint esnext: true */
var $ = require('jquery/dist/jquery');
var gaussian = require('gaussian');

//$(document).ready(init);

// from https://gist.github.com/wteuber/6241786
Math.fmod = function (a,b) { return Number((a - (Math.floor(a / b) * b)).toPrecision(8)); };

var AUDIO_CONTEXT;
var AUDIO_VCOS;
var AUDIO_VCAS;
var AUDIO_CLIMB_TIMER;
var AUDIO_CLIMB_TIMER_COUNTER;
var AUDIO_CLIMBERS_COUNT = 10;
var AUDIO_GAIN_GAUSSIAN;
var AUDIO_TONE_RANGE = AUDIO_CLIMBERS_COUNT * 12.0;
var AUDIO_HALF_TONE_RANGE = AUDIO_TONE_RANGE / 2.0;
var AUDIO_CLIMB_BASE_FREQUENCY = 440 * Math.pow(2.0, -AUDIO_HALF_TONE_RANGE / 12.0);

function init() {
    AUDIO_CONTEXT = new AudioContext();
    AUDIO_VCOS = [];
    AUDIO_VCAS = [];

    for (var i = 0; i < AUDIO_CLIMBERS_COUNT; i++) {
        // oscillator
        var vco = AUDIO_CONTEXT.createOscillator();
        vco.frequency.value = 0;
        vco.type = 'sine';
        vco.start(0);
        AUDIO_VCOS.push(vco);

        // gain
        vca = AUDIO_CONTEXT.createGain();
        vca.gain.value = 0;
        AUDIO_VCAS.push(vca);
   
        // patch through
        vco.connect(vca);
        vca.connect(AUDIO_CONTEXT.destination);
    }

    var gaussian_mean = 0.0;
    var gaussian_variance = AUDIO_HALF_TONE_RANGE;
    AUDIO_GAIN_GAUSSIAN = gaussian(gaussian_mean, gaussian_variance);
    
    window.start = start;
    window.stop = stop;
}

init();

function start() {
    for (var i = 0; i < AUDIO_CLIMBERS_COUNT; i++) {
        var vco = AUDIO_VCOS[i];
        var vca = AUDIO_VCAS[i];
        vco.frequency.value = AUDIO_CLIMB_BASE_FREQUENCY * Math.pow(2.0, i);
    }

    AUDIO_CLIMB_TIMER_COUNTER = 0;
    AUDIO_CLIMB_TIMER =
        setInterval(
                function () {
                    var target = AUDIO_CLIMB_BASE_FREQUENCY * 2.0;
                    var exponent_multipliers = [];
                    for (var i = 0; i < AUDIO_CLIMBERS_COUNT; i++) {
                        var exponent_multiplier = Math.fmod(
                            (AUDIO_CLIMB_TIMER_COUNTER  + (i * 12.0)), 
                            AUDIO_TONE_RANGE);
                        exponent_multipliers.push(exponent_multiplier);

                        var multiplier = Math.pow(2.0, exponent_multiplier / 12.0);
                        var freq = AUDIO_CLIMB_BASE_FREQUENCY * multiplier;
                        AUDIO_VCOS[i].frequency.value = freq;
                    }

                    var gain_values = calcGainValues(exponent_multipliers, AUDIO_HALF_TONE_RANGE);
                    for (var j = 0; j < AUDIO_CLIMBERS_COUNT; j++) {
                        AUDIO_VCAS[j].gain.value = gain_values[j];
                    }
                    AUDIO_CLIMB_TIMER_COUNTER += 0.02;
                },
                50);
}

function stop() {
    clearInterval(AUDIO_CLIMB_TIMER);
    for (var i = 0; i < AUDIO_CLIMBERS_COUNT; i++) {
        AUDIO_VCAS[i].gain.value = 0;
    }
}

function calcGainValues(exponent_multipliers, half_tone_range) {
    var min_val = exponent_multipliers[0];
    var min_pos = 0;
    for (var i = 1; i < exponent_multipliers.length; i++) {
        if (exponent_multipliers[i] < min_val) {
            min_val = exponent_multipliers[i];
            min_pos = i;
        }
    }

    var sorted_exponent_multipliers = [];
    for (var j = min_pos; j < exponent_multipliers.length; j++) {
        sorted_exponent_multipliers.push(exponent_multipliers[j]);
    }
    for (var k = 0; k < min_pos; k++) {
        sorted_exponent_multipliers.push(exponent_multipliers[k]);
    }

    var distances = [];
    for (var l = 0; l < (sorted_exponent_multipliers.length - 1); l++) {
        var left = sorted_exponent_multipliers[l];
        var right = sorted_exponent_multipliers[l + 1];
        var middle = left + ((right - left) / 2.0);
        distances.push(middle - half_tone_range);
    }


    var gains = [];

    if (exponent_multipliers.length < 2) {
        // single note
        gains.push(1.0);
    }
    else {
        // lowest note
        var lowest_cdf = AUDIO_GAIN_GAUSSIAN.cdf(distances[0]);
        gains.push(lowest_cdf);

        // note range in between
        for (var m = 0; m < (distances.length - 1); m++) {
            var left_distance = distances[m];
            var right_distance = distances[m + 1];
            var left_cdf = -AUDIO_GAIN_GAUSSIAN.cdf(left_distance);
            var right_cdf = -AUDIO_GAIN_GAUSSIAN.cdf(right_distance);
            gains.push(-(right_cdf - left_cdf));
        }

        // highest note
        var last_distance = distances[distances.length - 1];
        var cdf = AUDIO_GAIN_GAUSSIAN.cdf(last_distance);
        gains.push(1.0 - cdf);
    }


    var resorted_gains = [];
    for (var n = gains.length - min_pos - 1; n < gains.length; n++) {
        resorted_gains.push(gains[n]);
    }
    for (var o = 0; o < gains.length - min_pos - 1; o++) {
        resorted_gains.push(gains[o]);
    }
    var gains_sum = resorted_gains.reduce((a, b) => a + b, 0);
    return resorted_gains;
}
