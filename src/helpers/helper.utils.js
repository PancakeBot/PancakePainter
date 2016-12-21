/**
 * @file This is a helper include for adding various utility methods for paper.
 **/

module.exports = function(paper) {
  var utils = {};
  var _ = require('underscore');
  var canvasBuffer = require('electron-canvas-to-buffer');
  var fs = require('fs-plus');

  utils = {
    /**
     * Offset a paper path a given amount, either in or out. Returns a reference
     * given to the output polygonal path created.
     *
     * @param {Path} inPath
     *   Paper Path object to be converted to polygon and offsetted.
     * @param {Number} amount
     *   The amount to offset by.
     * @param {Number} flattenResolution
     *   Resolution to flatten to polygons.
     * @return {Path}
     *   Reference to the path object created, false if the output of the path
     *   resulted in the eradication of the path.
     */
    offsetPath: function(inPath, amount, flattenResolution) {
      var ClipperLib = require('../libs/clipper');
      var scale = 100;
      if (!amount) amount = 0;

      // 1. Copy the input path & make it flatten to a polygon/multiple gons.
      // 2. Convert the polygon(s) points into the clipper array format.
      // 3. Delete the temp path.
      // 4. Run the paths array through the clipper offset.
      // 5. Output and descale the paths as single compound path.

      var p = inPath.clone();
      var paths = [];

      // Is this a compound path?
      try {
        if (p.children) {
          _.each(p.children, function(c, pathIndex) {
            if (c.segments.length <= 1 && c.closed) {
              c.closed = false;
            }
            c.flatten(flattenResolution);
            paths[pathIndex] = [];
            _.each(c.segments, function(s){
              paths[pathIndex].push({
                X: s.point.x,
                Y: s.point.y,
              });
            });
          });
        } else { // Single path
          paths[0] = [];
          p.flatten(flattenResolution);
          _.each(p.segments, function(s){
            paths[0].push({
              X: s.point.x,
              Y: s.point.y,
            });
          });
        }
      } catch(e) {
        console.error('Error flattening path for offset:', inPath.data.name, e);
        p.remove();
        return inPath;
      }

      // Get rid of our temporary poly path
      p.remove();

      ClipperLib.JS.ScaleUpPaths(paths, scale);
      // Possibly ClipperLib.Clipper.SimplifyPolygons() here
      // Possibly ClipperLib.Clipper.CleanPolygons() here

      // 0.1 should be an appropriate delta for most cases.
      var cleanDelta = 0.1;
      paths = ClipperLib.JS.Clean(paths, cleanDelta * scale);

      var miterLimit = 2;
      var arcTolerance = 0.25;
      var co = new ClipperLib.ClipperOffset(miterLimit, arcTolerance);

      co.AddPaths(
        paths,
        ClipperLib.JoinType.jtRound,
        ClipperLib.EndType.etClosedPolygon
      );
      var offsettedPaths = new ClipperLib.Paths();
      co.Execute(offsettedPaths, amount * scale);

      // Scale down coordinates and draw ...
      var pathString = this.paths2string(offsettedPaths, scale);
      if (pathString) {
        var inset = new paper.CompoundPath(pathString);
        inset.data = _.extend({}, inPath.data);
        inset.set({
          strokeColor: inPath.strokeColor,
          strokeWidth: inPath.strokeWidth,
          fillColor: inPath.fillColor
        });

        inPath.remove();
        return inset;
      } else {
        inPath.remove();
        return false;
      }
    },

    /**
     * Convert a ClipperLib paths array into an SVG path string.
     * @param  {Array} paths
     *   A Nested ClipperLib Paths array of point objects
     * @param  {[type]} scale
     *   The amount to scale the values back down from.
     * @return {String}
     *   A properly formatted SVG path "d" string.
     */
    paths2string: function(paths, scale) {
      var svgpath = "", i, j;
      if (!scale) scale = 1;
      for(i = 0; i < paths.length; i++) {
        for(j = 0; j < paths[i].length; j++){
          if (!j) svgpath += "M";
          else svgpath += "L";
          svgpath += (paths[i][j].X / scale) + ", " + (paths[i][j].Y / scale);
        }
        svgpath += "Z";
      }
      return svgpath;
    },

    /**
     * Save a raster image directly as a local file (PNG).
     *
     * @param  {Paper.Raster} raster
     *   Raster object to be saved
     * @param {Number} dpi
     *   DPI to rasterize to.
     * @param  {String} dest
     *   Destination file to be saved.
     * @return {Promise}
     *   Fulfilled promise returns fs.stat (size, name, etc).
     */
    saveRasterImage: function(raster, dpi, dest) {
      var exportRaster = raster.rasterize(dpi);
      return new Promise(function(resolve, reject) {
        var b = canvasBuffer(exportRaster.canvas, 'image/png');
        fs.writeFile(dest, b, function(err) {
          exportRaster.remove();
          if (err) {
            reject(Error(err));
          } else {
            resolve(fs.statSync(dest));
          }
        });
      });
    },

  };

  // Give the main object back to the parent module.
  return utils;
};
