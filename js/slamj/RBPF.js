define([
    'slam/Math',
    'slam/Map',
    'slam/MockServer'
], function(Math,
            Map,
            server) {

	function RBPF(problem) {
		this.problem = problem;
	};
	
	RBPF.prototype.rescale = function(samples) {
		var min_fitness   = samples.map(function(s) { return s[0]; })
								   .reduce( function(a, b) { return Math.min(a,b); });
		var max_fitness   = samples.map(function(s) { return s[0]; })
								   .reduce( function(a, b) { return Math.max(a,b); });								   
		var total_fitness = samples.reduce( function(a, b) {
			return a + b[0] - min_fitness + 1;
		}, 0);
		
		return samples.map(function(sample) {
			return [ (sample[0] - min_fitness) / (max_fitness - min_fitness), sample[1]];
		});
	};
	
	// Assumes a list of [ [<fitness>, <state>], ... ]
	RBPF.prototype.resampleF = function(samples) {
		var min_fitness   = samples.map(function(s) { return s[0]; })
								   .reduce( function(a, b) { return Math.min(a,b); }, 0);
		var total_fitness = samples.reduce( function(a, b) {
			return a + b[0] - min_fitness;
		}, 0);
		
		return function() {
			var score = Math.random() * total_fitness; 
			samples.sort(function(a, b) {
				return a[0] > b[0];
			});
			for(var i = 0;i < samples.length;i++) {
				score -= (samples[i][0] - min_fitness ); 
				if(score <= 0) {
					//console.log("Picked " + i + " / " + samples.length);
					return samples[i][1]; 
				}
			}			
		};
	};
	
	RBPF.prototype.resample = function(samples, newSampleCount) {
		newSampleCount = newSampleCount | samples.length; 
		var f = this.resampleF(samples); 
		
		var rtn = new Array(newSampleCount); 
		for(var i = 0;i < rtn.length;i++) {
			rtn[i] = f(); 
		}
		return rtn;
	};
			
	RBPF.prototype.applyMotion = function(samples, motionGuess) {
		var self = this;
		return samples.map(function(sample) {
			var movement = self.problem.RandomMovement(motionGuess); 
			return self.problem.Move(sample, movement);
		});
	};
	RBPF.prototype.init = function( initSample, numSamples, measurement ) {				
		var init = this.problem.Update(initSample);
		var rtn = new Array(numSamples);
		for(var i = 0;i < numSamples;i++) {
			rtn[i] = [1, init]; 
		}
		return rtn;
	};
	RBPF.prototype.step = function( ratedSamples, measurement, motionGuess ) {		
		var self = this;
		var resampled = this.resample(ratedSamples, 100); 
		var newParticles = this.applyMotion(resampled, motionGuess); 
		return newParticles.map(function(sample) {
			return [ self.problem.Fitness(sample, measurement), 
					 self.problem.Update(sample, measurement) ];
		}); 
	};
	
	return RBPF;
				  }
);