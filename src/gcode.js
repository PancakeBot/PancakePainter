/**
 * @file This file contains the abstractions required for rendering the Paper.js
 * paths into GCODE compatible with the PancakeBot.
 **/
"use strict";

module.exports = function(config) {
  var paper = config.paper;
  var returnRenderer = {}; // The function/object returned by this module

  // Create gcode from current project
  returnRenderer = function generateGcode() {
    var workLayer = paper.project.getActiveLayer().clone();
    var out = getCodeHeader();

    _.each(workLayer.children, function(path, pathIndex){
      if (!path.data.isPolygonal) {
        path.flatten(config.flattenResolution);
      }

      var pumpOff = false;

      // Create an artificial move to the exact point where the pump should turn
      // off, before the next move occurs to ensure correct drip timing.
      var offset = Math.min(path.length, path.length - config.lineEndPreShutoff);
      var gcPreShutoff = gc('note', 'Nearing path end, moving to preshutoff');
      gcPreShutoff+= gc('move', reMap(path.getPointAt(offset)));
      gcPreShutoff+= gc('pumpoff');


      out+= gc('note', 'Starting path #' + (pathIndex+1) + '/' + workLayer.children.length);
      // Render segment points to Gcode movements
      _.each(path.segments, function(segment, index){

        // If the remaining length of the line is less than the shutoff value,
        // throw in the early shutoff.
        if (path.length - path.getOffsetOf(segment.point) <= config.lineEndPreShutoff && !pumpOff) {
          pumpOff = true;
          out+= gcPreShutoff;
        }

        out+= gc('move', reMap(segment.point));

        // This is the first segment of the path! After we've moved to the point,
        // start the pump and wait for it to warm up
        if (index === 0) {
          out+= [gc('pumpon'), gc('wait', config.startWait), ''].join('');
        } else if (index === path.segments.length-1) {
          // When the path is closed, we're actually missing the last point,
          // so we need to add it manually
          if (path.closed) {
            // If we haven't shut off the pump yet, we need to do that
            if (!pumpOff) {
              pumpOff = true;
              out+= gcPreShutoff;
            }

            // Move to last position on the path
            out+= gc('move', reMap(path.getPointAt(path.length)));
          }

          // Last segment/movement, dwell on the last point
          out+= gc('wait', config.endWait);
          out+= gc('note', 'Completed path #' + (pathIndex+1) + '/' + workLayer.children.length);
        }
      });

      // Ready move to next position
    });

    out += getCodeFooter();

    workLayer.remove();
    return out;
  };

  // Generate Gcode Header
  function getCodeHeader() {
    return [
      gc('note', 'PancakeCreator v' + config.version + ' GCODE header start'),
      gc('units'),
      gc('rate', 6600),
      gc('pumpoff'),
      gc('wait', 1),
      gc('off'),
      gc('home'),
      gc('note', 'PancakeCreator header complete'),
    ].join('');
  }

  // Generate Gcode footer
  function getCodeFooter() {
    return [
      gc('note', 'PancakeCreator footer start'),
      gc('wait', 1),
      gc('home'),
      gc('off'),
      gc('note', 'PancakeCreator Footer Complete'),
    ].join('');
  }

  /**
   * Create a serial command string from a key:value object
   *
   * @param {string} name
   *   Key in cmds object to find the command string
   * @param {object|string|integer} values
   *   Object containing the keys of placeholders to find in command string, with
   *   value to replace placeholder. If not an object, treated as single value to
   *   replace "%%" in command string.
   * @returns {string}
   *   Serial command string intended to be outputted directly, empty string
   *   if error.
   */
  function gc(name, values) {
    var cmds = {
      units: 'G21 ;Set units to MM',
      abs: 'G90 ;Use Absolute units',
      home: 'G28 ;Home All Axis',
      move: 'G1 X%x Y%y',
      rate: 'G1 F%% ;Set Feedrate',
      pumpon: 'M106 ;Pump on',
      note: ';%%',
      pumpoff: 'M107 ;Pump off',
      wait: 'M84 S%% ;Pause for %% second(s)',
      off: 'M84 ;Motors off'
    };
    if (!name || !cmds[name]) return ''; // Sanity check
    var out = cmds[name];

    if (typeof values === 'object') {
      for(var v in values) {
        out = out.replace(new RegExp('%' + v, 'g'), values[v]);
      }
    } else if (typeof values !== 'object') { // Single item replace
      out = out.replace(new RegExp('%%', 'g'), values);
    }

    return out + "\n";
  }

  // Convert an input Paper.js coordinate to an output bot mapped coordinate
  function reMap(p) {
    if (!p) {
      return {x: 0, y:0};
      console.error('Null Point given for remap!');
    }

    var b = paper.view.bounds;
    var pa = config.printArea;
    return {
      x: Math.round(map(b.width - (p.x - b.x), 0, b.width, pa.x[0], pa.x[1]) * 1000) / 1000,
      y: Math.round(map(p.y - b.y, 0, b.height, pa.y[0], pa.y[1]) * 1000) / 1000
    };
  }

  // Map a value in a given range to a new range
  function map(x, inMin, inMax, outMin, outMax) {
    return (x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
  }

  return returnRenderer;
};
