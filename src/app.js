/**
 * @file This is the central application logic and window management src file.
 * This is the central render process main window JS, and has access to
 * the DOM and all node abilities.
 **/
"use strict";

// Libraries ==============================================---------------------
// Must use require syntax for including these libs because of node duality.
window.$ = window.jQuery = require('jquery');
window._ = require('underscore');

// Main Process ===========================================---------------------
// Include global main process connector objects for the renderer (this window).
var remote = require('remote');
var mainWindow = remote.getCurrentWindow();
$.i18n = window.i18n = remote.require('i18next');
var app = remote.require('app');
require('../menus/menu-init')(app); // Initialize the menus

var scale = {};
var flattenResolution = 15; // Flatten curve value (smaller value = more points)
var lineEndPreShutoff = 35; // Remaining line length threshold for pump shutoff
var startWait = 0.75; // Time to wait for batter flow
var endWait = 0.65; // Time to wait for batter flow
var printArea = { // Print area limitations (in MM)
  x: [42, 485],
  y: [0, 210]
};

// Page loaded
$(function(){
   // After page load, wait for the griddle image to finish before initializing.
  $('#griddle').load(initEditor);

  // Apply element translation
  $('[data-i18n=""]').each(function() {
    var $node = $(this);

    if ($node.text().indexOf('.') > -1 && $node.attr('data-i18n') == "") {
      var key = $node.text();
      $node.attr('data-i18n', key);
      $node.text(i18n.t(key));
    }
  });

});

function initEditor() {
  var $griddle = $('#editor-wrapper img');
  var $editor = $('#editor');

  $griddle.aspect = 0.5390;
  $editor.aspect = 0.4717;
  $editor.pos = {
    left: 27,
    top: 24,
    right: 48,
    bottom: 52
  };

  var margin = [160, 100];

  // Set maximum work area render size
  $(window).on('resize', function(e){
    var win = [$(window).width(), $(window).height()];

    // Assume size to width
    $griddle.width(win[0] - margin[0]);
    $griddle.height((win[0] - margin[0]) * $griddle.aspect);


    // If too large, size to height
    if ($griddle.height() > win[1] - margin[1]) {
      $griddle.width((win[1] - margin[1]) / $griddle.aspect);
      $griddle.height((win[1] - margin[1]));
    }

    scale = {};
    scale.x = ($griddle.width()) / $griddle[0].naturalWidth;
    scale.y = ($griddle.height()) / $griddle[0].naturalHeight;

    scale = (scale.x < scale.y ? scale.x : scale.y);

    var off = $griddle.offset();
    $editor.css({
      top: off.top + (scale * $editor.pos.top),
      left: off.left + (scale * $editor.pos.left),
      width: $griddle.width() - ($editor.pos.right * scale),
      height: $griddle.height() - ($editor.pos.bottom * scale)
    });

    editorLoad(); // Load the editor (if it hasn't already been loaded)
    // This must happen after the very first resize, otherwise the canvas doesn't
    // have the correct dimensions for Paper to size to.
    $(mainWindow).trigger('move');

    updateFrosted();
  }).resize();
}

// Load the actual editor PaperScript (only when the canvas is ready).
var editorLoaded = false;
function editorLoad() {
  if (!editorLoaded) {
    editorLoaded = true;
    paper.PaperScript.load($('<script>').attr({
      type:"text/paperscript",
      src: "editor.ps.js",
      canvas: "editor"
    })[0]);
  }
}

// Trigger load init resize only after editor has called this function.
function editorLoadedInit() {
  $(window).resize();
  buildToolbar();
  buildColorPicker();
  bindControls();
}

function buildToolbar() {
  var $t = $('<ul>').appendTo('#tools');

  _.each(paper.tools, function(tool, index){
    if (tool.key) {
      $t.append($('<li>').append(
        $('<img>').attr({
          src: 'images/icon-' + tool.key + '.png',
          title: i18n.t(tool.name),
          draggable: 'false'
        })
      ).click(function(){
        $('#tools li.active').removeClass('active');
        $(this).addClass('active');
        tool.activate();
        $('#editor').css('cursor', 'url("images/cursor-' + tool.key + '.png"), move');
      }));
    }
  });

  // Activate the first (default) tool.
  $t.find('li:first').click();
}

function buildColorPicker() {
  var $picker  = $('<div>').attr('id', 'picker');
  _.each(paper.pancakeShades, function(color, index) {
    $picker.append(
      $('<a>')
        .addClass('color' + index + (index === 0 ? ' active' : ''))
        .attr('href', '#')
        .attr('title', i18n.t('color.color' + index))
        .click(function(e){selectColor(index); e.preventDefault();})
        .css('background-color', color)
    );
  });

  var $color = $('<div>')
    .attr('id', 'color')
    .attr('title', i18n.t('color.title'))
    .css('background-color', paper.pancakeShades[0])
    .append($picker);

  $('#tools').append($color);
}

function selectColor(index) {
  paper.pancakeCurrentShade = index;
  $('#picker a.active').removeClass('active');
  $('#picker a.color' + index).addClass('active');
  $('#color').css('background-color', paper.pancakeShades[index]);

  if (paper.selectRect) {
    if (paper.selectRect.ppath) {
      paper.selectRect.ppath.strokeColor = paper.pancakeShades[index];
      paper.selectRect.ppath.data.color = index;
      paper.view.update();
    }
  }
}

function toggleExport(doShow) {
  if (typeof doShow === 'undefined') {
    doShow = !$('#overlay').is(':visible');
  }

  if (doShow) {
    $('#overlay').fadeIn('slow');
    paper.deselect();
    updateFrosted(function(){
      $('#export').fadeIn('slow');
    });
  } else {
    $('#overlay').fadeOut('slow');
    $('#export').fadeOut('slow');
  }
}

// When the page is done loading, all the controls in the page can be bound.
function bindControls() {
  // Export window
  $('#export button').click(function(e){
    switch ($(this).attr('class')) {
      case 'done':
        toggleExport();
        break;
      case 'start':
        generateGcode();
        break;
    }
  });

  // Catch all keystrokes
  $(document).keyup(function(e){
    if (e.keyCode === 27) {
      toggleExport(false);
    }
  });

  // Callback/event for when any menu item is clicked
  app.menuClick = function(menu) {
    switch (menu) {
      case 'file.export':
        toggleExport(true);
        break;
      default:
        console.log(menu);
    }
  };
}


function updateFrosted(callback) {
  if ($('#overlay').is(':visible')) {
    html2canvas($("#non-overlay-wrapper")).then(function(canvas) {
      $("#frosted").remove();
      $("#overlay").append(canvas);
      $("#overlay canvas").attr('id', 'frosted');
      stackBlurCanvasRGB('frosted', 0, 0, $("#frosted").width(), $("#frosted").height(), 20);
      if (callback) callback();
    });
  }
}

// Create gcode from current project
function generateGcode(callback) {
  var workLayer = paper.project.getActiveLayer().clone();
  var out = getCodeHeader();

  _.each(workLayer.children, function(path, pathIndex){
    if (!path.data.isPolygonal) {
      path.flatten(flattenResolution);
    }

    var pumpOff = false;

    // Create an artificial move to the exact point where the pump should turn
    // off, before the next move occurs to ensure correct drip timing.
    var offset = Math.min(path.length, path.length - lineEndPreShutoff);
    var gcPreShutoff = gc('note', 'Nearing path end, moving to preshutoff');
    gcPreShutoff+= gc('move', reMap(path.getPointAt(offset)));
    gcPreShutoff+= gc('pumpoff');


    out+= gc('note', 'Starting path #' + (pathIndex+1) + '/' + workLayer.children.length);
    // Render segment points to Gcode movements
    _.each(path.segments, function(segment, index){

      // If the remaining length of the line is less than the shutoff value,
      // throw in the early shutoff.
      if (path.length - path.getOffsetOf(segment.point) <= lineEndPreShutoff && !pumpOff) {
        pumpOff = true;
        out+= gcPreShutoff;
      }

      out+= gc('move', reMap(segment.point));

      // This is the first segment of the path! After we've moved to the point,
      // start the pump and wait for it to warm up
      if (index === 0) {
        out+= [gc('pumpon'), gc('wait', startWait), ''].join('');
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
        out+= gc('wait', endWait);
        out+= gc('note', 'Completed path #' + (pathIndex+1) + '/' + workLayer.children.length);
      }
    })

    // Ready move to next position
  });

  out += getCodeFooter();

  $('#export textarea').val(out);
  workLayer.remove();
  if (callback) callback();
}

function getCodeHeader() {
  return [
    gc('note', 'PancakeCreator v' + app.getVersion() + ' GCODE header start'),
    gc('units'),
    gc('rate', 6600),
    gc('pumpoff'),
    gc('wait', 1),
    gc('off'),
    gc('home'),
    gc('note', 'PancakeCreator header complete'),
  ].join('');
}

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
  return {
    x: Math.round(map(b.width - (p.x - b.x), 0, b.width, printArea.x[0], printArea.x[1]) * 1000) / 1000,
    y: Math.round(map(p.y - b.y, 0, b.height, printArea.y[0], printArea.y[1]) * 1000) / 1000
  };
}

// Map a value in a given range to a new range
function map(x, inMin, inMax, outMin, outMax) {
  return (x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}
