/**
 * @file This is the window node module for the automatic tracing functionality
 * that supplies init and binding code for the PancakePainter window API.
 * Exports function returns a window control object that allows triggering on
 * init, show, and hide events.
 *
 * We have full access to globals loaded in the mainWindow as needed, just
 * reference them below.
 **/
 /*globals window, $, path, app, mainWindow, i18n, _, paper */

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
      cloneCount: 1, // Number of items to copy import/place.
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
    autoTraceLoaded: false, // Set to true when the webview is fully loaded.
    imageInitLoaded: false, // Whether we've initialized the current image.
    renderUpdateRunning: false, // Whether we're currently rendering an update.
    preset: 'simple', // Preset window opens with.
    intermediary: path.join(app.getPath('temp'), 'pp_tempraster.png'),
    $webview: {}, // Placeholder for jQuery object of webview DOM.
    exportJSON: "", // Placeholder string for the exported JSON from renderer.
    svgLayerBounds: {}, // Placeholder for data transfer of bounds.
  };

  // Switch for detecting if a setting was changed by preset or by hand.
  // Avoids update thrashing cause by mass updates.
  var setByPreset = false;

  var $loadingBar = $('.loader', context);

  /**
   * Apply a flat key:value object to the elements as input values.
   * @param  {Object} settings
   *   An object with keys matching the names and values matching the target
   *   values to set the elements to.
   */
  function applySettings(settings) {
    setByPreset = true; // Block updates.
    _.each(settings, function(value, name){
      var $elem = $('[name=' + name + ']', context);
      if ($elem.length) {
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
      }
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
   * Wrapper for utility for creating duplicate item layouts.
   * @return {Object}
   *   Contains array of positions (in x,y array format) and scale key.
   */
  autotrace.getCloneLayout = function() {
    return paper.utils.getDuplicationLayout(
      autotrace.settings.cloneCount,
      autotrace.svgLayerBounds,
      mainWindow.editorPaperScope.view.bounds
    );
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
   * Initialize the webview to run traces within to allow multiprocess rendering
   */
  function setupWebview() {
    autotrace.$webview = $('#autotrace-webview');
    var wv = autotrace.$webview[0];

    // FWD console messages & errors.
    wv.addEventListener('console-message', function(event) {
      console.log('AUTOTRACE:', event.message);
    });

    // Send message handlers TO app.
    autotrace.$webview.send = {
      //wv.send(channel, data);
      renderTrigger: function() {
        wv.send('renderTrigger', autotrace.settings);
      },

      loadTraceImage: function() {
        wv.send('loadTraceImage', autotrace.intermediary);
      },

      cleanup: function() {
        wv.send('cleanup');
      }
    };

    // Catch IPC messages FROM app.
    wv.addEventListener('ipc-message', function(event) {
      var data = event.args[0];
      switch (event.channel) {
        case 'paperReady':
          // Only run on first window init.
          autotrace.autoTraceLoaded = true;
          autotrace.$webview.send.loadTraceImage();
          autotrace.$webview.css('opacity', 1);
          break;
        case 'progress':
          $('progress', context).val(data);
          break;
        case 'initLoaded':
          autotrace.imageInitLoaded = true;
          autotrace.renderUpdate(); // Run Initial render.
          break;
        case 'renderComplete':
          renderUpdateComplete();
          /* falls through */
        case 'clonePreview':
          autotrace.exportJSON = data.exportJSON;
          autotrace.previewRasterData = data.previewRaster;
          autotrace.svgLayerBounds = data.svgLayerBounds;
          clonePreview();
          $('progress', context).val(0);
          break;
      }
    });

    wv.addEventListener('dom-ready', function(){
      //wv.openDevTools(); // DEBUG
    });
  }

  /**
   * Place/import the traced SVG data from the data to the editor.
   */
  function importTrace() {
    var json = autotrace.exportJSON;

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
      if (autotrace.settings.cloneCount === 1) {
        mainWindow.editorPaperScope.selectAll(items);
      }
      g.remove();
    });
    group.remove();

    // Trigger a history change state.
    mainWindow.editorPaperScope.fileChanged();
  }

  /**
   * Bind the buttons on the window.
   */
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
          autotrace.settings.cloneCount = parseInt(this.name.split('-')[1]);

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
    $(context).keydown(function(e){
      if (e.keyCode === 27) { // Global escape key exit window
        $('button[name=cancel]', context).click();
      }
    });

    // Bind special action on outline checkbox.
    $('input[name=outline]', context).change(function() {
      if ($(this).prop('checked')) {
        if (autotrace.settings.posterize === '5') {
          autotrace.settings.posterize = 4;
          applySettings(autotrace.settings);
        }
        $('#posterize-4').prop('disabled', true);
      } else {
        $('#posterize-4').prop('disabled', false);
      }
    });
  }


  // Trigger the normal trace render update.
  autotrace.renderUpdate = function () {
    if (!autotrace.renderUpdateRunning &&
        autotrace.imageInitLoaded) {
      autotrace.renderUpdateRunning = true;
      $loadingBar.css('opacity', 100);

      autotrace.$webview.send.renderTrigger();
    }
  };

  /**
   * Everything that has to happen to wrap up the render update.
   */
  function renderUpdateComplete() {
    autotrace.renderUpdateRunning = false;
    $loadingBar.css('opacity', 0);
  }

  /**
  * Window initialization callback, triggered on window import.
  */
  autotrace.init = function() {
    bindSettings();
    bindButtons();
    setupWebview();
  };

  /**
  * Window show event callback, triggered on window show.
  */
  autotrace.show = function() {
    // Apply given preset settings.
    applySettings(_.extend({},
      autotrace.defaults,
      autotrace.presets[autotrace.preset]
    ));

    // Default to 1x.
    $('button[name=clone-1]', context).click();
  };

  /**
   * Window hide event callback, triggered on window close.
   */
  autotrace.hide = function() {
    if (autotrace.autoTraceLoaded) {
      // Cleanup the window.
      autotrace.$webview.send.cleanup();
      $('div.trace-preview img.trace', context).remove();

      autotrace.renderUpdateRunning = false;
      autotrace.imageInitLoaded = false;
    }
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
      // Save the image out as a transfer PNG to get it to the second process.
      image
        .contain(512, 512)
        .write(autotrace.intermediary, function() {
          // Only try to run init if we're fully loaded.
          if (autotrace.autoTraceLoaded) {
            autotrace.$webview.send.loadTraceImage();
          }
          autotrace.preset = preset;
          mainWindow.overlay.toggleWindow('autotrace', true);
        });
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
    // Loading wait bar.
    $('.loader', context).css({
      width: previewWidth/2 - 50,
      left: previewWidth/2 + 30,
    });

    // Settings sidebar
    var prevHeight = $('.sidebar .preview', context).height();
    $('.sidebar .settings', context).css({
      height: $atWindow.height() - prevHeight - 80,
    });
  };

  return autotrace;
};
