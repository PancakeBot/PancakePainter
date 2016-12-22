/**
 * @file This is a helper include for adding base functionality surrounding auto
 * trace integration and handling import of autotrace data for printing.
 **/

module.exports = function(paper) {
  var app = require('electron').remote.app;
  var _ = require('underscore');
  var fs = require('fs-plus');
  var path = require('path');
  var autotracer = require('autotrace');
  var outFile =  path.join(app.getPath('temp'), 'pancakepainter_temptrace.svg');

  var autotrace = {
    settings: {
      backgroundColor: 'FFFFFF', // Color to ignore/make transparent.
      colorCount: 2, // Color simplification/Posterize amount.
      cornerAlwaysThreshold: 60, // Angle to make something alaways a corner.
      cornerSurround: 4, // Num of pixels to determine if a pixel is a corner.
      cornerThreshold: 100, // Angle for making corners depening on surrounding.
      despeckleLevel: 2,
      despeckleTightness: 2.0,
      dpi: 96, // Scaling size for output SVG
      errorThreshold: 2.0, // Subdivide fitted curves value
      filterIterations: 4, // Curve smoothing iterations.
      inputFormat: 'BMP', // Input image format, must be supported by bin.
      lineReversionThreshold: 0.1, // When to keep line straight when in curves.
      lineThreshold: 1, // Deviation in pixels to consider a line straight.
      outputFile: outFile,
      outputFormat: 'SVG',
      preserveWidth: true, // Preserve line width before thinning?
      removeAdjacentCorners: true,
      tangentSurround: 3, // Consider adjacent points when computing tangent.
    },

    /**
     * Get the centerline traced SVG string from a given raster image.
     *
     * @param  {String} img
     *   Path to raster image matching input format given in options/defaults.
     * @param  {Object} options
     *   Optional overrides for settings object.
     * @return {Promise}
     *   Resolved promise returns string data of completed SVG.
     */
    getImageLines: function(img, options) {
      options = _.extend({}, options, {centerline: true});
      return this.getImageFills(img, options);
    },

    /**
     * Get the fill only traced SVG string from a given raster image.
     *
     * @param  {String} img
     *   Path to raster image matching input format given in options/defaults.
     * @param  {Object} options
     *   Optional overrides for settings object.
     * @return {Promise}
     *   Resolved promise returns string data of completed SVG.
     */
    getImageFills: function(img, options) {
      var settings = _.extend({},
        this.settings,
        options // Pass along any customizations
      );

      return new Promise(function(resolve, reject) {
        autotracer(img, settings, function(err) {
          if (err) {
            reject(Error(err));
          } else {
            var data = paper.autotrace.getTraceData();
            if (data) {
              resolve(data);
            } else {
              reject(Error("Null result from autotrace"));
            }
          }
        });
      });
    },

    /**
     * Get the properly reformatted trace data from the output file.
     *
     * @return {String}
     *   SVG string from the file at settings.outputFile.
     */
    getTraceData: function() {
      // The SVG format from autotrace needs XML namespace before we can use it.
      var svgns = 'xmlns="http://www.w3.org/2000/svg" ' +
          'xmlns:xlink="http://www.w3.org/1999/xlink" ';
      var svg = fs.readFileSync(this.settings.outputFile, 'utf8');
      return svg.replace('<svg ', '<svg ' + svgns);
    }


  };



  // Give the main object back to the parent module.
  return autotrace;
};
