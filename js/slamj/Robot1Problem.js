define([
    'slam/Math',
    'slam/Map',
    'slam/MockServer'
], function(Math,
            Map,
            server) {
		
		var PX_PER_FT = 40; // TODO: Un hard code
        var IN_PER_FT = 12;
        var PX_PER_IN = PX_PER_FT / IN_PER_FT; // TODO: Sane scaling system
		
		var RobotSizeInInches = [ 8, 8 ]; 
				
		function R1( Size, imgData ) {
			this.Size = Size; 			
			this.SAMPLE_RAD = Math.PI / 100; 
			this.map = new Map(imgData.width, imgData.height);
            this.map.fromImage(imgData.data);
			
			this.SIZE = [6, 6];      // Inches
			this.SENSOR_RANGE_MIN = 6;  // Inches
			this.SENSOR_RANGE_MAX = 36;  // Inches

			this.SAMPLE_COUNT = 2 * Math.PI * this.SENSOR_RANGE_MAX; // Take a sample every inch at worst
			this.SAMPLE_RAD = 2 * Math.PI / this.SAMPLE_COUNT;

		};
		
		R1.prototype.RandomState = function() {
			return [ Math.random() * this.Size[0], 
					 Math.random() * this.Size[1], 
					 Math.random() * Math.PI * 2, 
					 new Map(this.Size[0], this.Size[1]) ];
		};
		R1.prototype.Outline = function(state) {
			var rtn = [];
			var w = RobotSizeInInches[0] * PX_PER_IN;
			for(var p = 0; p < 4 * w;p++) {
				var x, y;
				var i = Math.floor(p / w);
				if(i === 0) {
					x = p % w; y = 0; 
				} else if(i === 1) {
					x = p % w; y = w;
				} else if(i === 2) {
					y = p % w; x = 0;
				} else if(i === 3) {
					y = p % w; x = w;
				}
				rtn.push([x + state[0] - w/2, 
						  y + state[1] - w/2]);
			}
			return rtn;
		};
		R1.prototype.IsValid = function(state) {
			var inBounds = state[0] > 0 && state[0] < this.Size[0] &&
						   state[1] > 0 && state[1] < this.Size[1];
			if(inBounds === false)
				return false;
			var outline = this.Outline(state);
			for(var i = 0;i < outline.length;i++) {
				var pt = outline[i];
				if(this.map.getPixel(pt[0], pt[1]) > 0)
					return false;				
			}
			return true;
		};
		R1.prototype.RandomMovement = function(m) {
			if(m) {				
				return [m[0] + (Math.random()-.5) * 10 * PX_PER_IN,
						0,
					    m[2] + (Math.random() * Math.PI / 8) - (Math.PI / 16) ];
			}
			var reverse = Math.random() < .05; 
			return [ (reverse ? -1 : 1) * Math.random() * 6 * PX_PER_IN, 
					 0 ,
					 (Math.random() * Math.PI / 2) - (Math.PI / 4)]; 
		};
		
		R1.prototype.Move = function(state, moveState) {
			return [ state[0] + moveState[0] * Math.cos(state[2] + moveState[2]) + 
								moveState[1] * Math.sin(state[2] + moveState[2]),
					 state[1] + moveState[1] * Math.cos(state[2] + moveState[2]) + 
								moveState[0] * Math.sin(state[2] + moveState[2]),
				     state[2] + moveState[2] ];
		};
		
		R1.prototype.GetMeasurement = function(state) {
			var pos = state;
			var dir = state[2];
            var samples = [];
			var map = this.map;
            for(var mastRad = -Math.PI; mastRad <= Math.PI; mastRad += this.SAMPLE_RAD) {
                var absRad = mastRad + dir;
                var vec = [Math.cos(absRad), Math.sin(absRad)];
                var dist = undefined;
                for(var d = 0; d < this.SENSOR_RANGE_MAX; d += 0.5) {
                    var x = Math.floor(pos[0] + vec[0] * d * PX_PER_IN);
                    var y = Math.floor(pos[1] + vec[1] * d * PX_PER_IN);					
                    if(map.getPixel(x, y) > .5) {
                        dist = d;						
                        break;
                    }
                }				
                samples.push({radians: mastRad, inches: dist});
            }            			
			return samples;
		};	
		
		R1.prototype.Fitness = function(state, measurement) {
			var gtMeasurement = this.GetMeasurement(state); 
			var rtn = 0;
			var s = 0;
			for(var i = 0;i < measurement.length;i++) {
				var a =   measurement[i].inches === undefined ? this.SENSOR_RANGE_MAX * 2 :   measurement[i].inches; 
				var b = gtMeasurement[i].inches === undefined ? this.SENSOR_RANGE_MAX * 2 : gtMeasurement[i].inches; 
				
				rtn += Math.pow(2, -(Math.sq(a - b)) );
			}
			return Math.pow(2, rtn);
			//return 1;
		};
		R1.prototype.Update = function(state, measurement) {
			return state; 
		};
		R1.prototype.MLE = function(states) {
			return states[0];
		};
		R1.prototype.DrawMeasurement = function(ctx, state, measurement) {
			for(var i = 0;i < measurement.length;i++) {
				if(measurement[i].inches) {
					ctx.beginPath();					
					ctx.strokeStyle = '#00ff00';
					var dx = Math.cos(measurement[i].radians + state[2]) * measurement[i].inches * PX_PER_IN; 
					var dy = Math.sin(measurement[i].radians + state[2]) * measurement[i].inches * PX_PER_IN; 
					ctx.arc(state[0] + dx, 
							state[1] + dy, .01 * PX_PER_IN, 0, 2 * Math.PI, false);
					ctx.stroke();
				}
			}
		};
		
		R1.prototype.DrawState = function(pos, ctx, color, label) {
			var oldStroke = ctx.strokeStyle;
			
            ctx.beginPath();
			ctx.strokeStyle = color;// ? color : '#000000';
			
			ctx.arc(pos[0], pos[1], 4 * PX_PER_IN, 0, 2 * Math.PI, false);			
			ctx.moveTo(pos[0], pos[1]);
			ctx.lineTo(pos[0] + Math.cos(pos[2]) * 8 * PX_PER_IN, pos[1] + Math.sin(pos[2]) * 8 * PX_PER_IN);
			
			ctx.stroke();
			if(label)
				ctx.fillText(label, pos[0], pos[1]); 
			ctx.strokeStyle = oldStroke;
		}
	
		return R1; 
	}
);