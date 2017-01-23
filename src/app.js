/**
 * @file This is the central application logic and window management src file.
 * This is the central render process main window JS, and has access to
 * the DOM and all node abilities.
 **/
/*globals
  document, window, $, _, toastr, paper, Promise
*/
"use strict";

// Add Promise done polyfill.
"function"!=typeof Promise.prototype.done&&(Promise.prototype.done=function(t,n){var o=arguments.length?this.then.apply(this,arguments):this;o.then(null,function(t){setTimeout(function(){throw t},0)})}); /* jshint ignore: line */

// Libraries ==============================================---------------------
// Must use require syntax for including these libs because of node duality.
window.$ = window.jQuery = require('jquery');
window.toastr = require('toastr');
window._ = require('underscore');
var path = require('path');

// Main Process ===========================================---------------------
// Include global main process connector objects for the renderer (this window).
var remote = require('electron').remote;
var mainWindow = remote.getCurrentWindow();
var i18n = remote.require('i18next');
var app = remote.app;
require('../menus/menu-init')(app); // Initialize the menus
var fs = remote.require('fs-plus');

// Bot specific configuration & state =====================---------------------
var scale = {};

// File management  =======================================---------------------
app.currentFile = {
  name: "", // Name for the file (no path)
  path: path.join(app.getPath('userDesktop'), i18n.t('file.default')),
  changed: false // Can close app without making any changes
};

// Toastr notifications
toastr.options.positionClass = "toast-bottom-right";
toastr.options.preventDuplicates = true;
toastr.options.newestOnTop = true;

// Page loaded
$(function(){
  // Set app version text
  $('#toolback .ver').text('v' + app.getVersion());

   // After page load, wait for the griddle image to finish before initializing.
  $('#griddle').load(initEditor);

  // Apply element translation
  i18n.translateElementsIn('body');
});

// Add translation element helper.
i18n.translateElementsIn = function(context) {
  // For data-i18n tagged elements with value set
  $('[data-i18n][data-i18n!=""]', context).each(function() {
    var $node = $(this);
    var data = $node.attr('data-i18n').replace('[title]', '');

    // TODO: This is a hack and should use native i18n translation utils :/
    $node.attr('title', i18n.t(data));
  });

  // For data-i18n tagged items without value set...
  $('[data-i18n=""]', context).each(function() {
    var $node = $(this);

    if ($node.text().indexOf('.') > -1 && $node.attr('data-i18n') === "") {
      var key = $node.text();
      $node.attr('data-i18n', key);
      $node.text(i18n.t(key));
    }
  });
};

function initEditor() {
  var $griddle = $('#editor-wrapper img');
  var $editor = $('#editor');
  var ac = app.constants;

  $griddle.aspect = ac.griddleSize.height / ac.griddleSize.width;
  $editor.aspect = ac.printableArea.height / ac.printableArea.width;

  var margin = { // Margin around griddle in absolute pixels to restrict sizing
    l: 10,  // Buffer
    r: 10,  // Buffer
    t: 110, // Toolbar
    b: 40   // Buffer & Text
  };

  // Set maximum work area render size & manage dynamic sizing of elements not
  // handled via CSS only.
  $(window).on('resize', function() {
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

    var mmPerPX = $griddle.width() / ac.griddleSize.width;

    var off = $griddle.offset();
    $editor.css({
      top: off.top + (mmPerPX * ac.printableArea.offset.top),
      left: off.left + (mmPerPX * ac.printableArea.offset.left),
      width: ac.printableArea.width * mmPerPX,
      height: ac.printableArea.height * mmPerPX
    });

    // Resize functionality for the autotrace window.
    if (mainWindow.overlay.currentWindow.resize) {
      mainWindow.overlay.currentWindow.resize();
    }

    editorLoad(); // Load the editor (if it hasn't already been loaded)
    // This must happen after the very first resize, otherwise the canvas
    // doesn't have the correct dimensions for Paper to size to.
    $(mainWindow).trigger('move');
  }).resize();
}

// Load the actual editor PaperScript (only when the canvas is ready).
var editorLoaded = false;
function editorLoad() {
  if (!editorLoaded) {
    editorLoaded = true;
    mainWindow.editorPaperScope = paper.PaperScript.load($('<script>').attr({
      type:"text/paperscript",
      src: "editor.ps.js",
      canvas: "editor"
    })[0]);
  }
}

// Trigger load init resize only after editor has called this function.
function editorLoadedInit() { /* jshint ignore:line */
  $(window).resize();
  buildToolbar();
  buildImageImporter();
  buildColorPicker();

  // Initialize overlay modal windows.
  mainWindow.overlay.initWindows();

  // Bind remaining controls.
  bindControls();
}

// Build the toolbar DOM dynamically.
function buildToolbar() {
  var $t = $('<ul>').appendTo('#tools');

  _.each(paper.tools, function(tool){
    var colorID = '';
    if (tool.cursorColors === true) {
      colorID = "-" + paper.pancakeCurrentShade;
    }

    if (tool.key) {
      $t.append($('<li>')
        .addClass('tool' +  (tool.cursorColors === true ? ' color-change' : ''))
        .attr('id', 'tool-' + tool.key)
        .data('cursor-key', tool.key)
        .data('cursor-offset', tool.cursorOffset)
        .data('cursor-colors', tool.cursorColors)
        .append(
        $('<div>').attr({
          title: i18n.t(tool.name),
          draggable: 'false'
        }).css('background-image', 'url(images/icon-' + tool.key + '.png)')
      ).click(function(){
        // Complete polygon draw no matter what.
        // TODO: Make all tools expose a "clear all" reset for other tools.
        if (paper.tool.polygonDrawComplete) {
          paper.tool.polygonDrawComplete();
        }

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

  var cursor = '';
  if ($(item).data('cursor-colors')) {
    cursor = 'url("images/cursor-' +
      $(item).data('cursor-key') + '-' + paper.pancakeCurrentShade + '.png")';
  } else {
    cursor = 'url("images/cursor-' + $(item).data('cursor-key') + '.png")';
  }

  if ($(item).data('cursor-offset')) {
    cursor+= ' ' + $(item).data('cursor-offset');
  }

  $('#editor').css('cursor', cursor + ', auto');
  paper.project.activeLayer.selected = false;
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

  $('#tools #tool-fill').after($color);
}

// Do everything required when a new color is selected
function selectColor(index) {
  paper.pancakeCurrentShade = index;
  $('#picker a.active').removeClass('active');
  $('#picker a.color' + index).addClass('active');
  $('#tools').attr('class', 'color-' + index);

  // Swap out color cursor (if any)
  var cursor = '';
  var $item = $('#tools .active');
  if ($item.data('cursor-colors')) {
    cursor = 'url("images/cursor-' +
      $item.data('cursor-key') + '-' + paper.pancakeCurrentShade + '.png")';
    if ($item.data('cursor-offset')) {
      cursor+= ' ' + $item.data('cursor-offset');
    }
    $('#editor').css('cursor', cursor + ', auto');
  }

  // Change selected path's color
  if (paper.selectRect) {
    if (paper.selectRect.ppaths.length) {
      _.each(paper.selectRect.ppaths, function(path){
        if (path.data.fill === true) {
          path.fillColor = paper.pancakeShades[index];
        } else {
          path.strokeColor = paper.pancakeShades[index];
        }

        path.data.color = index;
      });

      paper.view.update();
      app.currentFile.changed = true;
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

  $importButton.append(
    $('<nav>')
    .on('mouseout click', function(e){
      // Hide when mouseout on anything but a child element, or itself.
      var doHide = !$(this).has(e.toElement).length && e.toElement !== this;

      // Hide on click when clicking only the element.
      if (e.type === 'click') {
        doHide = e.toElement === this;
      }

      // Hide menu when mouse moves outside nav box.
      if (doHide) {
        $(this).removeClass('nav-open').find('input').prop('checked', false);
      }
    })
    .addClass('menu').append(
      $('<input>')
        .attr({
          type: 'checkbox',
          href: '#',
          class: 'menu-open',
          name: 'menu-open',
          id: 'menu-open',
        }),
      $('<label>')
        .addClass('menu-open-button').attr('for', 'menu-open')
        .click(function() { $('#import nav.menu').addClass('nav-open'); }),
      $('<a>')
        .attr('title', i18n.t('import.auto.options.complex'))
        .addClass('menu-item').append($('<i>').addClass('complex')),
      $('<a>')
        .attr('title', i18n.t('import.auto.options.simple'))
        .addClass('menu-item').append($('<i>').addClass('simple')),
      $('<a>')
        .attr('title', i18n.t('import.auto.options.manual'))
        .addClass('menu-item').append($('<i>').addClass('manual'))
    )
  );

  $importButton.find('a').click(function(){
    var option = $('i', this).attr('class');
    setImageImport(option);
  });

  $('#tools #tool-select').before($importButton);
}

function setImageImport(option) {
  var $importButton = $('#import');

  switch (option) {
    case 'manual':
      activateToolItem($importButton);
      paper.initImageImport();
      break;
    case 'simple':
    case 'complex':
      $importButton.find('input').prop('checked', false); // Hide the menu.
      mainWindow.dialog({
        t: 'OpenDialog',
        title: i18n.t('import.autotitle.' + option),
        filters: [{
          name: i18n.t('import.files'),
          extensions: ['jpg', 'jpeg', 'gif', 'png', 'bmp']
        }]
      }, function(filePath){
        if (!filePath) {  // Open cancelled
          return;
        }

        // Convert array of files to just the first one.
        filePath = filePath[0];
        var autotrace = mainWindow.overlay.windows.autotrace;

        // Gifs must be converted as JIMP doesn't have support for them :(
        if (path.parse(filePath).ext.toLowerCase() === '.gif') {
          var img = new paper.Raster(filePath);
          img.onLoad = function() {
            var temp = path.join(app.getPath('temp'), 'pp_tempconvert.png');
            paper.utils.saveRasterImage(img, 72, temp).then(function() {
              img.remove();
              autotrace.imageTransfer(temp, option);
            });
          };
        } else {
          autotrace.imageTransfer(filePath, option);
        }
      });
  }
}



// When the page is done loading, all the controls in the page can be bound.
function bindControls() {
  // Bind cut/copy/paste controls... Cause they're not always caught.
  $(window).keydown(paper.handleClipboard);

  // Callback/event for when any menu item is clicked
  app.menuClick = function(menu, callback) {
    switch (menu) {
      case 'file.export':
        mainWindow.overlay.windows.export.pickFile(function(filePath) {
          if (!filePath) return; // Cancelled

          // Verify file extension
          if (filePath.split('.').pop().toLowerCase() !== 'gcode') {
            filePath += '.gcode';
          }

          mainWindow.overlay.toggleWindow('overlay', true);
        });

        break;
      case 'file.saveas':
        app.currentFile.name = "";
        /* falls through */
      case 'file.save':
        if (app.currentFile.name === "") {
          mainWindow.dialog({
            t: 'SaveDialog',
            title: i18n.t(menu), // Same app namespace i18n key for title :)
            defaultPath: app.currentFile.path,
            filters: [
              { name: i18n.t('file.type'), extensions: ['pbp'] }
            ]
          }, function(filePath){
            if (!filePath) return; // Cancelled

            // Verify file extension
            if (filePath.split('.').pop().toLowerCase() !== 'pbp') {
              filePath += '.pbp';
            }
            app.currentFile.path = filePath;
            app.currentFile.name = path.parse(filePath).base;

            try {
              fs.writeFileSync(app.currentFile.path, paper.getPBP()); // Write file!
              toastr.success(i18n.t('file.note', {file: app.currentFile.name}));
              app.currentFile.changed = false;
            } catch(e) {
              toastr.error(i18n.t('file.error', {file: app.currentFile.name}));
            }

            if (callback) callback();
          });
        } else {
          try {
            fs.writeFileSync(app.currentFile.path, paper.getPBP()); // Write file!
            toastr.success(i18n.t('file.note', {file: app.currentFile.name}));
            app.currentFile.changed = false;
          } catch(e) {
            toastr.error(i18n.t('file.error', {file: app.currentFile.name}));
          }
        }

        break;
      case 'file.open':
        if (!document.hasFocus()) return; // Triggered from devtools otherwise
        checkFileStatus(function() {
          mainWindow.dialog({
            t: 'OpenDialog',
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
      case 'edit.selectall':
        paper.selectAll();
        break;
      case 'edit.undo':
      case 'edit.redo':
        paper.handleUndo(menu === 'edit.undo' ? 'undo': 'redo');
        break;
      case 'edit.copy':
      case 'edit.cut':
      case 'edit.paste':
      case 'edit.duplicate':
        paper.handleClipboard(menu.split('.')[1]);
        break;
      case 'view.settings':
        mainWindow.overlay.toggleWindow('settings', true);
        break;
      default:
        console.log(menu);
    }
  };

  // Settings form fields management & done/reset
  $(window).keydown(function(e){
    if (e.keyCode === 27) { // Global escape key exit settings
      $('#done').click();
    }
  });

  // Setup rangeslider overlay and preview everywhere used.
  $('input[type="range"]').on('input', function(){
    var e = $(this).siblings('b');
    if ($(this).attr('data-unit')) {
      var u = 'settings.units.' + $(this).attr('data-unit');
      e.attr('title', this.value + ' ' + i18n.t(u + '.title'))
        .text(this.value + i18n.t(u + '.label'));
    } else {
      e.text(this.value);
    }
  }).rangeslider({
    polyfill: false
  });

  // Setup fancy checkbox everywhere used.
  $('input[type="checkbox"].fancy').after($('<div>').click(function(){
    $(this).siblings('input[type="checkbox"]').click();
  }));

  // Input based Settings management I/O.
  $('.settings-managed').each(function(){
    var key = this.id; // IDs required!
    var v = app.settings.v;

    // Set loaded value (if any)
    if (typeof v[key] !== 'undefined') {
      if (this.type === "checkbox") {
        $(this).prop('checked', v[key]);
      } else {
        $(this).val(v[key]);
      }
    }

    $('input[type="range"]').trigger('input');

    // Bind to catch change
    $(this).change(function(){
      if (this.type === 'checkbox') {
        app.settings.v[key] = $(this).prop('checked');
      } else {
        app.settings.v[key] = parseFloat(this.value);
      }

      app.settings.save();

      if ($('#overlay').is(':visible')) {
        mainWindow.overlay.windows.export.setRenderSettings();
      }
    }).change();

    // Force default value on blur invalidation.
    $(this).blur(function(){
      if (!this.checkValidity()) {
        this.value = $(this).attr('default');
        $(this).change();
      }
    });
  });
}

window.onbeforeunload = function() {
  return checkFileStatus();
};

// Overlay modal internal "window" management API ==============================
mainWindow.overlay = {
  windowNames: ['export', 'autotrace', 'settings'], // TODO: load automatically.
  windows: {}, // Placeholder for window module code.
  toggleWindow: function(name, toggle) {
    if (this.windowNames.indexOf(name) !== -1) {
      var $elem = $('#overlay #' + name);
      if (typeof toggle === 'undefined') {
        toggle = !$elem.is(':visible');
      }

      // Show or hide?
      if (toggle) {
        mainWindow.overlay.currentWindow = mainWindow.overlay.windows[name];
        this.toggleFrostedOverlay(true, function(){
          $elem.fadeIn('slow');
          $(window).resize();
          mainWindow.overlay.windows[name].isOpen = true;

          // Show window code trigger.
          if (mainWindow.overlay.windows[name].show) {
            mainWindow.overlay.windows[name].show();
          }
        });
      } else {
        $elem.fadeOut('slow', function() {
          mainWindow.overlay.windows[name].isOpen = false;

          // Hide window code trigger.
          if (mainWindow.overlay.windows[name].hide) {
            mainWindow.overlay.windows[name].hide();
          }
        });
        this.toggleFrostedOverlay(false);

      }

    }
  },

  // Initialize the window content.
  initWindows: function() {
    _.each(mainWindow.overlay.windowNames, function(name) {
      // Append the actual HTML include into the DOM.
      var htmlFile = path.join(
        app.getAppPath(), 'src', 'windows', 'window.' + name + '.html'
      );
      var context; // Placeholder for context of newly added element.
      if (fs.existsSync(htmlFile)) {
        $('#overlay').append(
          $('<div>')
            .attr('id', name)
            .addClass('overlay-window')
            .html(fs.readFileSync(htmlFile, 'utf8'))
        );

        context = $('#overlay > div:last');
        i18n.translateElementsIn(context);
      }

      // Load the window specific code into the overlay.windows object.
      var jsFile = path.join(
        app.getAppPath(), 'src', 'windows', 'window.' + name + '.js'
      );
      if (fs.existsSync(jsFile)) {
        jsFile = path.join(__dirname, 'windows', 'window.' + name);
        mainWindow.overlay.windows[name] = require(jsFile)(context);

        // Initialize code trigger for window.
        if (mainWindow.overlay.windows[name].init) {
          mainWindow.overlay.windows[name].init();
        }
      } else {
        mainWindow.overlay.windows[name] = {}; // Empty object if not provided.
      }
    });
  },

  // Show/Hide the fosted glass overlay (disables non-overlay-wrapper controls)
  toggleFrostedOverlay: function (doShow, callback) {
    if (typeof doShow === 'undefined') {
      doShow = !$('#overlay').is(':visible');
    }

    // Blur (or unblur) the non-overlay content.
    var blur = doShow ? 'blur(20px)' : 'blur(0)';
    $('#non-overlay-wrapper').css('-webkit-filter', blur);

    if (doShow) {
      $('#overlay').fadeIn('slow');
      paper.deselect();
      if (callback) callback();
    } else {
      $('#overlay').fadeOut('slow');
      if (callback) callback();
    }
  },

  currentWindow: {}
};

// Check the current file status and alert the user what to do before continuing
// This is pretty forceful and there's no way to back out.
function checkFileStatus(callback) {
  if (app.currentFile.changed) {
    var doSave = 0;
    if (app.currentFile.name === "") { // New file or existing?
      // Save new is async and needs to cancel the close and use a callback
      doSave = mainWindow.dialog({
        t: 'MessageBox',
        type: 'warning',
        message: i18n.t('file.confirm.notsaved'),
        detail: i18n.t('file.confirm.savenew'),
        buttons:[i18n.t('file.button.discard'), i18n.t('file.button.savenew')]
      });

      if (doSave) {
        app.menuClick('file.save', function(){
          if (callback) callback();
        });
        return false;
      } else {
        toastr.warning(i18n.t('file.discarded'));
      }

    } else {
      doSave = mainWindow.dialog({
        t: 'MessageBox',
        type: 'warning',
        message: i18n.t('file.confirm.changed'),
        detail: i18n.t('file.confirm.save', {file: app.currentFile.name}),
        buttons:[
          i18n.t('file.button.discard'),
          i18n.t('file.button.save'),
          i18n.t('file.button.savenew')
        ]
      });

      if (doSave) {
        if (doSave === 1) { // Save current file
          // Save in place is sync, so doesn't need to cancel close
          app.menuClick('file.save');
        } else { // Save new file
          app.menuClick('file.saveas', function(){
            if (callback) callback();
          });
          return false;
        }
      } else {
        toastr.warning(i18n.t('file.discarded'));
      }
    }
  }

  if (callback) callback();
  return true;
}


// Prevent drag/dropping onto the window (it's really bad!)
document.addEventListener('drop', function(e) {
  e.preventDefault();
  e.stopPropagation();
});
document.addEventListener('dragover', function(e) {
  e.preventDefault();
  e.stopPropagation();
});
