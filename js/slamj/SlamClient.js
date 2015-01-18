define([
    'signals',
    'slam/Math',
    'slam/Robot',
    'slam/MockServer',
	'slamj/Robot1Problem',
	'slam/Map',
	'slamj/RBPF'
], function(signals,
			   Math,
			   Robot,
			   server,
			   ProblemClass,
			   Map,
			   RBPF) {
	
	var PX_PER_FT = 40; // TODO: Un hard code
	var IN_PER_FT = 12;
	var PX_PER_IN = PX_PER_FT / IN_PER_FT; // TODO: Sane scaling system
	
	function Client(width, height, imgData) {
		var self = this;
		this.map = new Map(width, height);
		this.map.fromImage(imgData.data);
		self.invalidate = new signals.Signal();
		
		this.width = width;
		this.height = height;
		var problem = this.problem = new ProblemClass([width, height], imgData); 
		var rbpf = this.rbpf = new RBPF(problem);
		
		var length = 500;
		
		this.groundTruth = new Array(length); 
		this.movements   = new Array(length - 1); 
		
		this.groundTruth[0] = [ width / 2. + 100, height / 2. + 100, 2 * Math.PI * Math.random() ];
		for(var i = 1;i < length;i++) {			
			var tries = 100; 
			do {
				var movement = problem.RandomMovement();
				this.movements[i-1] = movement;
				this.groundTruth[i] = problem.Move(this.groundTruth[i-1], movement); 			
			} while(tries-- && problem.IsValid(this.groundTruth[i]) == false);
			if(problem.IsValid(this.groundTruth[i]) == false)
				console.log(":(");
		}

		this.measurements = this.groundTruth.map(function(p) { return self.problem.GetMeasurement(p); });
		
		this.allRatedParticles = new Array(length); 
		this.allRatedParticles[0] = rbpf.init( self.groundTruth[0], 100, this.measurements[0] );
				
				
		self.currStep = 1;	
		function iterate() {
			self.allRatedParticles[self.currStep] = 
				rbpf.step(self.allRatedParticles[self.currStep-1], self.measurements[self.currStep], self.movements[self.currStep-1]);
			self.currStep++;		
			self.invalidate.dispatch();
			if(self.currStep < self.allRatedParticles.length)
				setTimeout(iterate, 1); 
		};		
		iterate();
	};
	
	
	Client.prototype.draw = function(ctx) {
		var self = this;

		this.allRatedParticles.forEach( 
			function(ratedParticles, i) {
				var scaled = self.rbpf.rescale(ratedParticles);
				scaled.sort(function(a, b) {
					return a[0] > b[0];
				});
				if(i == self.currStep - 1) {
					scaled.forEach(function(ratedState) {
						var state = ratedState[1]; 
						self.problem.DrawState( state, ctx, 'rgba(0, 0, 255, ' + Math.pow(ratedState[0],.5) + ')');
					});
				}
			}
		);

		this.groundTruth.forEach( function(state, i) {
			if(i === self.currStep - 1)
				self.problem.DrawState( state, ctx, 'rgba(255,0,0,.5)', i );
			if(i === self.currStep - 1)
				self.problem.DrawMeasurement(ctx, state, self.problem.GetMeasurement(state) ); 
		});
		
		/*
		for(var x = 0;x < this.width;x++) {
			for(var y = 0;y < this.width;y++) {									
					if(this.map.getPixel(x, y) > .5) {
						ctx.beginPath();					
						ctx.strokeStyle = '#0000ff';
						ctx.arc(x, y, .01 * PX_PER_IN, 0, 2 * Math.PI, false);
						ctx.stroke();
					}
			}
		}
		*/
	};
	
	return Client; 
});