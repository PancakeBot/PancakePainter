/**
 * @file This is the central application logic and window management src file.
 * This is the central render process main window JS, and has access to
 * the DOM and all node abilities.
 **/
"use strict";

// Libraries ==============================================---------------------
// Must use require syntax for including these libs because of node duality.
window.$ = window.jQuery = require('jquery');
window.toastr = require('toastr');
window._ = require('underscore');
var path = require('path');
// GCODE renderer (initialized after paper is setup)
var gcRender = require('./gcode.js');

// Main Process ===========================================---------------------
// Include global main process connector objects for the renderer (this window).
var remote = require('remote');
var mainWindow = remote.getCurrentWindow();
$.i18n = window.i18n = remote.require('i18next');
var app = remote.require('app');
require('../menus/menu-init')(app); // Initialize the menus
var fs = remote.require('fs-plus');
var dataURI = require('datauri');

// Bot specific configuration & state =====================---------------------
var scale = {};
var renderConfig = {
  flattenResolution: 15, // Flatten curve value (smaller value = more points)
  lineEndPreShutoff: 35, // Remaining line length threshold for pump shutoff
  startWait: 750, // Time to wait for batter flow begin
  endWait: 650, // Time to wait for batter flow end
  fillSpacing: 9, // Space between each trace fill line
  fillAngle: 23, // Angle of line for trace fill
  fillGroupThreshold: 25, // Threshold to group zig zags
  printArea: { // Print area limitations (in MM)
    x: 42,
    y: 210,
    l: 485,
    t: 0,
  },
  version: app.getVersion() // Application version written to GCODE header
};

// File management  =======================================---------------------
var currentFile = {
  name: "", // Name for the file (no path)
  path: path.join(app.getPath('userDesktop'), i18n.t('file.default')),
  changed: false // Can close app without making any changes
}

// Toastr notifications
toastr.options.positionClass = "toast-bottom-right";
toastr.options.preventDuplicates = true;
toastr.options.newestOnTop = true;


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
  $editor.pos = { // Relative position of paper.js canvas within the griddle
    left: 27,
    top: 24,
    right: 48,
    bottom: 52
  };

  var margin = { // Margin around griddle to restrict sizing
    l: 20,  // Buffer
    r: 20,  // Buffer
    t: 100, // Toolbar
    b: 90   // Logo & buffer
  };

  // Set maximum work area render size & manage dynamic sizing of elements not
  // handled via CSS only.
  $(window).on('resize', function(e){
    // Window Size (less the appropriate margins)
    var win = {
      w: $(window).width() - (margin.l + margin.r),
      h: $(window).height() - (margin.t + margin.b)
    };

    // Assume size to width
    $griddle.width(win.w);
    $griddle.height(win.w * $griddle.aspect);


    // If too large, size to height
    if ($griddle.height() > win.h) {
      $griddle.width(win.h / $griddle.aspect);
      $griddle.height(win.h);
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
  buildImageImporter();
  buildColorPicker();

  bindControls();

  // Load the renderer once paper is ready
  renderConfig.paper = paper;
  gcRender = gcRender(renderConfig);
}

function buildToolbar() {
  var $t = $('<ul>').appendTo('#tools');

  _.each(paper.tools, function(tool, index){
    if (tool.key) {
      $t.append($('<li>')
        .addClass('tool')
        .attr('id', 'tool-' + tool.key)
        .data('cursor-key', tool.key)
        .data('cursor-offset', tool.cursorOffset)
        .append(
        $('<img>').attr({
          src: 'images/icon-' + tool.key + '.svg',
          title: i18n.t(tool.name),
          draggable: 'false'
        })
      ).click(function(){
        tool.activate();
        activateToolItem(this);
      }));
    }
  });

  // Activate the first (default) tool.
  $t.find('li:first').click();
}

// Assigns the "active" class to tool items and sets editor cursor, nothing more
function activateToolItem(item) {
  $('#tools .tool.active').removeClass('active');
  $(item).addClass('active');

  var cursor = 'url("images/cursor-' + $(item).data('cursor-key') + '.png")';

  if ($(item).data('cursor-offset')) {
    cursor+= ' ' + $(item).data('cursor-offset');
  }

  $('#editor').css('cursor', cursor + ', auto');
  paper.deselect();
  paper.view.update();
}

// Build the elements for the colorpicker non-tool item
function buildColorPicker() {
  var $picker  = $('<div>').attr('id', 'picker');
  _.each(paper.pancakeShades, function(color, index) {
    $picker.append(
      $('<a>')
        .addClass('color' + index + (index === 0 ? ' active' : ''))
        .attr('href', '#')
        .attr('title', paper.pancakeShadeNames[index])
        .click(function(e){selectColor(index); e.preventDefault();})
        .css('background-color', color)
    );
  });

  var $color = $('<div>')
    .attr('id', 'color')
    .append($picker);

  $('#tools').append($color);
}

// Do everything required when a new color is selected
function selectColor(index) {
  paper.pancakeCurrentShade = index;
  $('#picker a.active').removeClass('active');
  $('#picker a.color' + index).addClass('active');

  if (paper.selectRect) {
    if (paper.selectRect.ppath) {
      if (paper.selectRect.ppath.data.fill === true) {
        paper.selectRect.ppath.fillColor = paper.pancakeShades[index];
      } else {
        paper.selectRect.ppath.strokeColor = paper.pancakeShades[index];
      }

      paper.selectRect.ppath.data.color = index;
      paper.view.update();
      currentFile.changed = true;
    }
  }
}

// Build the fake tool placeholder for image import
function buildImageImporter() {
  var $importButton = $('<div>')
    .addClass('tool')
    .attr('id', 'import')
    .data('cursor-key', 'select')
    .attr('title', i18n.t('import.title'));
  $importButton.append($('<img>').attr('src', 'images/icon-import.svg'));

  $importButton.click(function(){
    activateToolItem($importButton);
    paper.initImageImport();
  });

  $('#tools').append($importButton);
}

// When the page is done loading, all the controls in the page can be bound.
function bindControls() {
  // Callback/event for when any menu item is clicked
  app.menuClick = function(menu, callback) {
    switch (menu) {
      case 'file.export':
      case 'file.exportmirrored':
        mainWindow.dialog({
          type: 'SaveDialog',
          title: i18n.t('export.title'),
          filters: [
            { name: 'PancakeBot GCODE', extensions: ['gcode'] }
          ]
        }, function(filePath){
          if (!filePath) return; // Cancelled

          // Verify file extension
          if (filePath.split('.').pop().toLowerCase() !== 'gcode') filePath += '.gcode';
          fs.writeFileSync(filePath, gcRender(menu === 'file.exportmirrored')); // Write file!

          // Notify user
          toastr.success(i18n.t('export.note', {file: path.parse(filePath).base}));
        });
        break;
      case 'file.saveas':
        currentFile.name = "";
      case 'file.save':
        if (currentFile.name === "") {
          mainWindow.dialog({
            type: 'SaveDialog',
            title: i18n.t(menu), // Same app namespace i18n key for title :)
            defaultPath: currentFile.path,
            filters: [
              { name: i18n.t('file.type'), extensions: ['pbp'] }
            ]
          }, function(filePath){
            if (!filePath) return; // Cancelled

            // Verify file extension
            if (filePath.split('.').pop().toLowerCase() !== 'pbp') filePath += '.pbp';
            currentFile.path = filePath;
            currentFile.name = path.parse(filePath).base;

            try {
              fs.writeFileSync(currentFile.path, paper.getPBP()); // Write file!
              toastr.success(i18n.t('file.note', {file: currentFile.name}));
              currentFile.changed = false;
            } catch(e) {
              toastr.error(i18n.t('file.error', {file: currentFile.name}));
            }

            if (callback) callback();
          });
        } else {
          try {
            fs.writeFileSync(currentFile.path, paper.getPBP()); // Write file!
            toastr.success(i18n.t('file.note', {file: currentFile.name}));
            currentFile.changed = false;
          } catch(e) {
            toastr.error(i18n.t('file.error', {file: currentFile.name}));
          }
        }

        break;
      case 'file.open':
        if (!document.hasFocus()) return; // Triggered from devtools otherwise
        checkFileStatus(function() {
          mainWindow.dialog({
            type: 'OpenDialog',
            title: i18n.t(menu),
            filters: [
              { name: i18n.t('file.type'), extensions: ['pbp'] }
            ]
          }, function(filePath){
            if (!filePath) return; // Cancelled
            paper.loadPBP(filePath[0]);
          });
        });
        break;
      case 'file.new':
      case 'file.close':
        checkFileStatus(function(){
          toastr.info(i18n.t(menu));
          paper.newPBP();
        });
        break;
      default:
        console.log(menu);
    }
  };
}

window.onbeforeunload = function(e) {
  return checkFileStatus();
};

// Check the current file status and alert the user what to do before continuing
// This is pretty forceful and there's no way to back out.
function checkFileStatus(callback) {
  if (currentFile.changed) {
    if (currentFile.name === "") { // New file or existing?
      // Save new is asynch and needs to cancel the close and use a callback
      if (confirm(i18n.t('file.confirm.savenew'))) {
        app.menuClick('file.save', function(){
          if (callback) callback();
        });
        return false;
      } else {
        toastr.warning(i18n.t('file.discarded'));
      }
    } else {
      // Save in place is completely synchronus, so doesn't need to cancel close
      if (confirm(i18n.t('file.confirm.save', {file: currentFile.name}))) {
        app.menuClick('file.save');
      } else {
        toastr.warning(i18n.t('file.discarded'));
      }
    }
  }

  if (callback) callback();
  return true;
}


// Show/Hide the fosted glass overlay (disables non-overlay-wrapper controls)
function toggleOverlay(doShow, callback) {
  if (typeof doShow === 'undefined') {
    doShow = !$('#overlay').is(':visible');
  }

  if (doShow) {
    $('#overlay').fadeIn('slow');
    paper.deselect();
    updateFrosted(callback);
  } else {
    $('#overlay').fadeOut('slow');
    if (callback) callback();
  }
}

// Update the rendered HTML image and reblur it (when resizing the window)
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
