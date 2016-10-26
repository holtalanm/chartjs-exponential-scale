var helpers = Chart.helpers;

Chart.Ticks.generators.exponential = function(generationOptions, dataRange) {
  var ticks = [];
  // To get a "nice" value for the tick spacing, we will use the appropriately named
  // "nice number" algorithm. See http://stackoverflow.com/questions/8506881/nice-label-algorithm-for-charts-with-minimum-ticks
  // for details

  var totalTicks = 0, niceMin = 2, niceMax = 10, niceExp = 2;

  if(dataRange.min && dataRange.min >= niceMin) {
    niceMin = dataRange.min;
  }
  if(dataRange.max && dataRange.max >= niceMax) {
    niceMax = dataRange.max;
  }
  if(generationOptions.exponent && generationOptions.exponent >= 2) {
    niceExp = generationOptions.exponent;
  }

  for(var i = niceMin; i <= niceMax; i = Math.pow(i, niceExp)) {
    totalTicks++;
  }

  console.log(totalTicks);
  console.log(niceMin);
  console.log(niceMax);

  ticks.push(0)
  ticks.push(niceMin);
  for(var j = 1; j < totalTicks; j++) {
    var lastTick = ticks[j];
    ticks.push(Math.pow(lastTick, niceExp));
  }
  if(ticks[ticks.length - 1] < niceMax) {
    ticks.push(niceMax);
  }

  console.log(ticks);

  return ticks;
};

var defaultConfig = {
	position: 'left',
	ticks: {
		callback: Chart.Ticks.formatters.linear
	}
};

var ExponentialScale = Chart.LinearScaleBase.extend({
  buildTicks: function() {
		var me = this;
		var opts = me.options;
		var tickOpts = opts.ticks;

		// Figure out what the max number of ticks we can support it is based on the size of
		// the axis area. For now, we say that the minimum tick spacing in pixels must be 50
		// We also limit the maximum number of ticks to 11 which gives a nice 10 squares on
		// the graph. Make sure we always have at least 2 ticks
		var maxTicks = me.getTickLimit();
		maxTicks = Math.max(2, maxTicks);

		var numericGeneratorOptions = {
			maxTicks: maxTicks,
			min: tickOpts.min,
			max: tickOpts.max,
      exponent: tickOpts.exponent
		};
		var ticks = me.ticks = Chart.Ticks.generators.exponential(numericGeneratorOptions, me);

		me.handleDirectionalChanges();

		// At this point, we need to update our max and min given the tick values since we have expanded the
		// range of the scale
		me.max = helpers.max(ticks);
		me.min = helpers.min(ticks);

		if (tickOpts.reverse) {
			ticks.reverse();

			me.start = me.max;
			me.end = me.min;
		} else {
			me.start = me.min;
			me.end = me.max;
		}
	},
	determineDataLimits: function() {
		var me = this;
		var opts = me.options;
		var chart = me.chart;
		var data = chart.data;
		var datasets = data.datasets;
		var isHorizontal = me.isHorizontal();

		function IDMatches(meta) {
			return isHorizontal ? meta.xAxisID === me.id : meta.yAxisID === me.id;
		}

		// First Calculate the range
		me.min = null;
		me.max = null;

		if (opts.stacked) {
			var valuesPerType = {};

			helpers.each(datasets, function(dataset, datasetIndex) {
				var meta = chart.getDatasetMeta(datasetIndex);
				if (valuesPerType[meta.type] === undefined) {
					valuesPerType[meta.type] = {
						positiveValues: [],
						negativeValues: []
					};
				}

				// Store these per type
				var positiveValues = valuesPerType[meta.type].positiveValues;
				var negativeValues = valuesPerType[meta.type].negativeValues;

				if (chart.isDatasetVisible(datasetIndex) && IDMatches(meta)) {
					helpers.each(dataset.data, function(rawValue, index) {
						var value = +me.getRightValue(rawValue);
						if (isNaN(value) || meta.data[index].hidden) {
							return;
						}

						positiveValues[index] = positiveValues[index] || 0;
						negativeValues[index] = negativeValues[index] || 0;

						if (opts.relativePoints) {
							positiveValues[index] = 100;
						} else if (value < 0) {
							negativeValues[index] += value;
						} else {
							positiveValues[index] += value;
						}
					});
				}
			});

			helpers.each(valuesPerType, function(valuesForType) {
				var values = valuesForType.positiveValues.concat(valuesForType.negativeValues);
				var minVal = helpers.min(values);
				var maxVal = helpers.max(values);
				me.min = me.min === null ? minVal : Math.min(me.min, minVal);
				me.max = me.max === null ? maxVal : Math.max(me.max, maxVal);
			});

		} else {
			helpers.each(datasets, function(dataset, datasetIndex) {
				var meta = chart.getDatasetMeta(datasetIndex);
				if (chart.isDatasetVisible(datasetIndex) && IDMatches(meta)) {
					helpers.each(dataset.data, function(rawValue, index) {
						var value = +me.getRightValue(rawValue);
						if (isNaN(value) || meta.data[index].hidden) {
							return;
						}

						if (me.min === null) {
							me.min = value;
						} else if (value < me.min) {
							me.min = value;
						}

						if (me.max === null) {
							me.max = value;
						} else if (value > me.max) {
							me.max = value;
						}
					});
				}
			});
		}

		// Common base implementation to handle ticks.min, ticks.max, ticks.beginAtZero
		this.handleTickRangeOptions();
	},
	getTickLimit: function() {
		var maxTicks;
		var me = this;
		var tickOpts = me.options.ticks;

		if (me.isHorizontal()) {
			maxTicks = Math.min(tickOpts.maxTicksLimit ? tickOpts.maxTicksLimit : 11, Math.ceil(me.width / 50));
		} else {
			// The factor of 2 used to scale the font size has been experimentally determined.
			var tickFontSize = helpers.getValueOrDefault(tickOpts.fontSize, Chart.defaults.global.defaultFontSize);
			maxTicks = Math.min(tickOpts.maxTicksLimit ? tickOpts.maxTicksLimit : 11, Math.ceil(me.height / (2 * tickFontSize)));
		}

		return maxTicks;
	},
	// Called after the ticks are built. We need
	handleDirectionalChanges: function() {
		if (!this.isHorizontal()) {
			// We are in a vertical orientation. The top value is the highest. So reverse the array
			this.ticks.reverse();
		}
	},
	getLabelForIndex: function(index, datasetIndex) {
		return +this.getRightValue(this.chart.data.datasets[datasetIndex].data[index]);
	},
	// Utils
	getPixelForValue: function(value) {
		// This must be called after fit has been run so that
		// this.left, this.top, this.right, and this.bottom have been defined
		var me = this;
		var paddingLeft = me.paddingLeft;
		var paddingBottom = me.paddingBottom;
		var start = me.start;

		var rightValue = +me.getRightValue(value);
		var pixel;
		var innerDimension;
		var range = me.end - start;

		if (me.isHorizontal()) {
			innerDimension = me.width - (paddingLeft + me.paddingRight);
			pixel = me.left + (innerDimension / range * (rightValue - start));
			return Math.round(pixel + paddingLeft);
		}
		innerDimension = me.height - (me.paddingTop + paddingBottom);
		pixel = (me.bottom - paddingBottom) - (innerDimension / range * (rightValue - start));
		return Math.round(pixel);
	},
	getValueForPixel: function(pixel) {
		var me = this;
		var isHorizontal = me.isHorizontal();
		var paddingLeft = me.paddingLeft;
		var paddingBottom = me.paddingBottom;
		var innerDimension = isHorizontal ? me.width - (paddingLeft + me.paddingRight) : me.height - (me.paddingTop + paddingBottom);
		var offset = (isHorizontal ? pixel - me.left - paddingLeft : me.bottom - paddingBottom - pixel) / innerDimension;
		return me.start + ((me.end - me.start) * offset);
	},
	getPixelForTick: function(index) {
		return this.getPixelForValue(this.ticksAsNumbers[index]);
	}
});
Chart.scaleService.registerScaleType('exponential', ExponentialScale, defaultConfig);
