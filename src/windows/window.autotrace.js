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
  // Central window detail object returned for windows[autotrace] object.
  var autotrace = {
    settings: {},
    defaults: {
      tracetype: 'mixed',
      posterize: 2,
      transparent: '#FFFFFF',
      blur: 0,
      outline: false,
      invert: false,
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
    paper: {}, // PaperScope for auto trace preview
    preset: 'simple', // Preset window opens with.
    source: '', // Source file to be loaded.
    intermediary: path.join(app.getPath('temp'), 'pp_tempraster.png'),
    tracebmp: path.join(app.getPath('temp'), 'pp_tracesource.bmp'),
  };

  // Switch for detecting if a setting was changed by preset or by hand.
  // Avoids update thrashing cause by mass updates.
  var setByPreset = false;

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
        autotrace.paper.renderTraceImage()
          .then(autotrace.paper.renderTraceVector);
      }
    }).change(); // Trigger initial change to save data.

    setByPreset = false; // Ready for updates.
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

        case 'cancel':
          mainWindow.overlay.toggleWindow('autotrace', false);
          break;

        case 'import':
          // TODO: Import content into main paper context.
          break;

        case 'transparent-pick':
          // TODO: add colorpicker
          break;
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
    // Init load and build the images
    autotrace.paper.loadTraceImage()
      .then(autotrace.paper.renderTraceImage)
      .then(autotrace.paper.renderTraceVector);
  };

  // Window hide event.
  autotrace.hide = function() {
    // Re-activate the default editor paperscope .
    mainWindow.editorPaperScope.activate();
  };

  return autotrace;
};
