/**
 * @file This is the window node module for the automatic tracing functionality
 * that supplies init and binding code for the PancakePainter window API.
 * Exports function returns a window control object that allows triggering on
 * init, show, and hide events.
 *
 * We have full access to globals loaded in the mainWindow as needed, just
 * reference them below.
 **/
 /*globals window, paper, $, path, app, mainWindow, i18n, _ */

module.exports = function(context) {
  var jimp = require('jimp');

  // Central window detail object returned for windows[autotrace] object.
  var autotrace = {
    settings: {},
    defaults: {
      tracetype: 'mixed',
      posterize: 2,
      transparent: "#00FF00",
      blur: 0,
      outline: false,
      invert: false,
      contrast: 0,
      brightness: 0,
    },
    presets: { // Applied over the top of defaults
      simple: {},
      complex: {
        tracetype: "fills",
        blur: 3,
        posterize: 5,
        transparent: "#00FF00",
      },
    },
    offset: 3, // Amount to offset paths for line conversion.
    cloneCount: 1, // Number of items to copy import/place.
    renderUpdateRunning: false, // Whether we're currently rendering an update.
    imageInitLoaded: false, // Whether we've initialized the current image.
    paper: {}, // PaperScope for auto trace preview
    preset: 'simple', // Preset window opens with.
    sourceImage: {}, // Source file image (passed by app.js).
    intermediary: path.join(app.getPath('temp'), 'pp_tempraster.png'),
    tracebmp: path.join(app.getPath('temp'), 'pp_tracesource.bmp'),
  };

  // Switch for detecting if a setting was changed by preset or by hand.
  // Avoids update thrashing cause by mass updates.
  var setByPreset = false;

  var $loadingBar = $('.bar-loader', context);

  // Load the auto trace PaperScript (only when the canvas is ready).
  var autoTraceLoaded = false;
  function autoTraceLoad() {
    if (!autoTraceLoaded) {
      autoTraceLoaded = true;
      autotrace.paper = paper.PaperScript.load($('<script>').attr({
        type:"text/paperscript",
        src: "autotrace.ps.js",
        canvas: "autotrace-preview"
      })[0]);
    }
  }

  /**
   * Apply a flat key:value object to the elements as input values.
   * @param  {Object} settings
   *   An object with keys matching the names and values matching the target
   *   values to set the elements to.
   */
  function applySettings(settings) {
    setByPreset = true; // Block updates.
    _.each(settings, function(value, name){
      var $elem = $('[name=' + name + ']');
      var type = $elem.attr('type') || $elem.prop('tagName').toLowerCase();
      switch (type) {
        case 'color':
        case 'range':
        case 'select':
          $elem.val(value);
          break;
        case 'checkbox':
          $elem.prop('checked', value);
          break;
        case 'radio':
          $elem.filter('[value=' + value + ']').prop('checked', true);
          break;
        default:
      }
      $elem.change();
    });

    // Force update here.
    autotrace.renderUpdate();
    setByPreset = false; // Ready for updates.
  }


  /**
   * Display the current clone setup with live preview image.
   */
  autotrace.clonePreview = clonePreview;
  function clonePreview() {
    var $tp = $('div.trace-preview');

    // Clear out any trace images at start.
    $tp.find('img.trace').remove();

    var zoom = 7.5;
    var layout = autotrace.getCloneLayout();
    _.each(layout.positions, function(pos) {
      var $t = $('<img>', {class: 'trace', src: autotrace.previewRasterData});
      $t.css({
        left: (pos[0] / zoom) + 14,
        top: (pos[1] / zoom) + 14,
        transform: "translate(-50%, -50%) scale(" + (layout.scale / zoom) + ")",
      });
      $tp.append($t);
    });
  }


  /**
   * Figure out what the center positions and scales should be for cloneCount
   * and the currently traced image dimensions.
   * @return {Object}
   *   Contains array of positions (in x,y array format) and scale key.
   */
  autotrace.getCloneLayout = function() {
    var out = {scale: 1, positions: []};
    var count = autotrace.cloneCount;
    var traceBounds = autotrace.paper.svgLayer.bounds;

    if (!traceBounds.width) return out;

    var griddleBounds = mainWindow.editorPaperScope.view.bounds;
    var griddleAspect = griddleBounds.height / griddleBounds.width;
    var traceAspect = traceBounds.height / traceBounds.width;
    var landscape = traceAspect < griddleAspect;

    // Every cloned item has the same size regardless of count.
    var fillPercent;
    var q = {width: griddleBounds.width / 4, height: griddleBounds.height / 4};

    // How many?
    switch (count) {
      case 1: // 1 item, center, 80% fill.
        fillPercent = 80;
        out.positions = [[q.width * 2, q.height * 2]];
        break;
      case 2: // 2 items, 90% of 50% width/height. SBS or TB
        fillPercent = 50;

        if (landscape) { // SBS
          out.positions = [
            [q.width * 2, q.height],     // Center Top.
            [q.width * 2, q.height * 3], // Center Bottom.
          ];
        } else { // Top/Bottom
          out.positions = [
            [q.width, q.height * 2],     // Left Middle.
            [q.width * 3, q.height * 2], // Right Middle.
          ];
        }
        break;
      case 4: // 4 items, 92% of 25% width/height. Simple Quadrant
        fillPercent = 35;
        out.positions = [
          [q.width, q.height],         // Top Left.
          [q.width * 3, q.height],     // Top Right.
          [q.width, q.height * 3],     // Bottom Left.
          [q.width * 3, q.height * 3], // Bottom Right.
        ];
        break;
      case 8: // 8 items, 95% of 12.5% width/height. SBS or TB 4x grouping.
        fillPercent = 25;
        // Eighth measurement.
        var e = {width: q.width / 2, height: q.height / 2};

        if (landscape) { // SBS 4 rows of 2.
          out.positions = [
            [q.width, e.height],         // A Left.
            [q.width * 3, e.height],     // A Right.

            [q.width, e.height * 3],     // B Left.
            [q.width * 3, e.height * 3], // B Right.

            [q.width, e.height * 5],     // C Left.
            [q.width * 3, e.height * 5], // C Right.

            [q.width, e.height * 7],     // D Left.
            [q.width * 3, e.height * 7], // D Right.
          ];
        } else { // Top/Bottom 2 rows of 4.
          out.positions = [
            [e.width, q.height],         // Top Left a.
            [e.width * 3, q.height],     // Top Left b.
            [e.width * 5, q.height],     // Top Right a.
            [e.width * 7, q.height],     // Top Right b.

            [e.width, q.height * 3],     // Bottom Left a.
            [e.width * 3, q.height * 3], // Bottom Left b.
            [e.width * 5, q.height * 3], // Bottom Right a.
            [e.width * 7, q.height * 3], // Bottom Right b.
          ];
        }
        break;
    }

    fillPercent /= 100;
    var scale = {
      x: (griddleBounds.width * fillPercent) / traceBounds.width,
      y: (griddleBounds.height * fillPercent) / traceBounds.height
    };

    out.scale = (scale.x < scale.y ? scale.x : scale.y);
    return out;
  };


  // Bind the window's settings inputs into a single object on change.
  function bindSettings() {
    setByPreset = true; // Ignore updates for initial bind.
    $('input, select', context).change(function() {
      // Save each setting based on name attribute.
      if (this.type === 'checkbox') {
        autotrace.settings[this.name] = $(this).prop('checked');
      } else {
        if (this.type === 'radio') {
          if ($(this).prop('checked')) {
            autotrace.settings[this.name] = $(this).val();
          }
        } else {
          autotrace.settings[this.name] = $(this).val();
        }
      }

      if (!setByPreset) {
        autotrace.renderUpdate();
      }
    }).change(); // Trigger initial change to save data.

    // Bind change for changing type description.
    $('select[name=tracetype]', context).change(function() {
      $(this).siblings('aside').text(
        i18n.t('import.auto.settings.types.options.' + $(this).val() + '.desc')
      );
    });

    setByPreset = false; // Ready for updates.
  }


  /**
   * Place/import the traced SVG data from this paperscope to the editor.
   */
  function importTrace() {
    var json = autotrace.paper.svgLayer.exportJSON();
    mainWindow.editorPaperScope.activate();

    // Import the JSON of the SVG trace layer into a temporary layer,
    // then group the contents of that layer, and ditch the layer.
    var tmpLayer = new mainWindow.editorPaperScope.Layer();
    var group = new mainWindow.editorPaperScope.Group(
      tmpLayer.importJSON(json).removeChildren()
    );
    tmpLayer.remove();

    // Position each group into the correct clone layout position, then remove
    // it from its group (just used for positioning).
    var layout = autotrace.getCloneLayout();
    _.each(layout.positions, function(pos) {
      var g = group.clone();
      g.scale(layout.scale);
      g.position = new mainWindow.editorPaperScope.Point(pos);
      var items = g.removeChildren();
      mainWindow.editorPaperScope.mainLayer.addChildren(items);

      // Select added items if only one being cloned.
      if (autotrace.cloneCount === 1) {
        mainWindow.editorPaperScope.selectAll(items);
      }
      g.remove();
    });
    group.remove();

    // Trigger a history change state.
    mainWindow.editorPaperScope.fileChanged();
  }

  // Bind the buttons on the window.
  function bindButtons() {
    $('button', context).click(function() {
      switch(this.name) {
        case 'simple':
        case 'complex':
          applySettings(_.extend({},
            autotrace.defaults,
            autotrace.presets[this.name]
          ));
          break;

        case 'import':
          importTrace();
          /* falls through */

        case 'cancel':
          mainWindow.overlay.toggleWindow('autotrace', false);
          break;

        case 'transparent-pick':
          // TODO: add colorpicker
          break;

        case 'clone-1':
        case 'clone-2':
        case 'clone-4':
        case 'clone-8':
          autotrace.cloneCount = parseInt(this.name.split('-')[1]);

          // Only mixed tracetype needs to re-render the trace.
          if (autotrace.settings.tracetype === 'mixed') {
            autotrace.renderUpdate();
          } else {
            clonePreview();
          }
          break;
      }
    });

    // Bind ESC key exit.
    // TODO: Build this off data attr global bind thing.
    $(window).keydown(function(e){
      if (e.keyCode === 27) { // Global escape key exit window
        $('button[name=cancel]', context).click();
      }
    });
  }

  // Init after build event.
  autotrace.init = function() {
    bindSettings();
    bindButtons();
  };

  // Window show event.
  autotrace.show = function() {
    autoTraceLoad();

    // Activate the trace preview paperscope.
    autotrace.paper.activate();

    // Apply given preset settings.
    applySettings(_.extend({},
      autotrace.defaults,
      autotrace.presets[autotrace.preset]
    ));

    // Default to 1x.
    $('button[name=clone-1]').click();

    // Init load and build the images
    autotrace.paper.loadTraceImage().then(function() {
      autotrace.imageInitLoaded = true;
      autotrace.renderUpdate();
    });
  };

  // Trigger the normal trace render update.
  autotrace.renderUpdate = function () {
    if (autoTraceLoaded &&
        !autotrace.renderUpdateRunning &&
        autotrace.imageInitLoaded) {
      autotrace.renderUpdateRunning = true;
      $loadingBar.css('opacity', 100);

      autotrace.paper.renderTraceImage()
      .then(autotrace.paper.renderTraceVector)
      .then(clonePreview)
      .then(function() {
        autotrace.renderUpdateRunning = false;
        $loadingBar.css('opacity', 0);
      }).catch(function() {
        // Catch any errors in the process.
        autotrace.renderUpdateRunning = false;
        $loadingBar.css('opacity', 0);
      });
    }
  };

  // Window hide event.
  autotrace.hide = function() {
    if (autoTraceLoaded) {
      // Cleanup the window.
      autotrace.paper.cleanup();
      autotrace.renderUpdateRunning = false;
      autotrace.imageInitLoaded = false;
    }

    // Re-activate the default editor paperscope .
    mainWindow.editorPaperScope.activate();
  };

  /**
   * Transfer an image path to the autotraceWindow and open the window.
   * This is how the autotrace window is technically opened.
   * @param  {String} filePath
   *   Full path string of image file to load.
   * @param  {String} preset
   *   Option for loading a preset on window show.
   */
  autotrace.imageTransfer = function(file, preset) {
    // Load the image, if good, open the window. Otherwise, fail out!
    jimp.read(file).then(function(image) {
      autotrace.sourceImage = image;
      autotrace.preset = preset;
      mainWindow.overlay.toggleWindow('autotrace', true);
    }).catch(function (err) {
      var tryAgain = mainWindow.dialog({
        t: 'MessageBox',
        type: 'error',
        title: i18n.t('import.err.title'),
        message: i18n.t('import.err.message', {file: path.parse(file).base}),
        detail: i18n.t('import.err.desc', {err: err.toString()}),
        buttons: [
          i18n.t('common.button.cancel'),
          i18n.t('import.err.button'),
        ],
      });

      // Try to find another file?
      if (tryAgain !== 0) {
        window.setImageImport(preset);
      }
    });
  };

  // Window resize event.
  var $atWindow = $('#autotrace');
  autotrace.resize = function() {
    var sidebarWidth = 230;
    var previewWidth = $atWindow.width() - sidebarWidth - 20;
    $('#autotrace-preview').css({
      width: previewWidth,
      height: $atWindow.height() - 40,
    });

    // Loading wait bar.
    $('.loader', context).css({
      width: previewWidth/2 - 50,
      left: previewWidth/2 + 30,
    });

    // Settings sidebar
    var prevHeight = $('.sidebar .preview', context).height();
    $('.sidebar .settings').css({
      height: $atWindow.height() - prevHeight - 80,
    });
  };

  return autotrace;
};
