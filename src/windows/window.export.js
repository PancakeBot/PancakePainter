/**
 * @file This is the window node module for the export/settings window
 * that supplies init and binding code for the PancakePainter window API.
 * Exports function returns a window control object that allows triggering on
 * init, show, and hide events.
 * We have full access to globals loaded in the mainWindow as needed, just
 * reference them below.
 **/
/* globals window, mainWindow, app, $, paper, i18n, fs, toastr, path */

module.exports = function(context) {
  var exportData = {
    simulatorLoaded: false, // Sets to true when the simulator is ready.
    initLoaded: false, // Sets to true when the path data has been imported.
    renderUpdateRunning: false, // Whether we're currently rendering an update.
    renderConfig: {}, // Placeholder for render config passover from settings.
    gcode: "", // Placeholder for exported GCODE.
    filePath: "", // Export final data write path.
  };

  var $loadingBar = $('.loader', context);

  /**
   * Initialize the renderConfig object for GCODE export with static constants.
   */
  function initRenderConfig() {
    var ac = app.constants;
    exportData.renderConfig = {
      printArea: { // Print area limitations (in 1 MM increments)
        x: ac.printableArea.offset.right,
        t: 0,
        l: ac.printableArea.width + ac.printableArea.offset.right,
        y: ac.printableArea.height
      },
      version: app.getVersion() // Application version written to GCODE header
    };
  }

  /**
   * Bind change on the non-managed inputs to trigger setRenderSettings.
   */
  function bindSettings() {
    $('input:not(.settings-managed)', context).change(function() {
      exportData.setRenderSettings();
    });
  }

  /**
   * Bind the various buttons on the window.
   */
  function bindButtons() {
    $('button', context).click(function() {
      switch(this.name) {
        case 'cancel':
          mainWindow.overlay.toggleWindow('export', false);
          break;

        case 'reset':
          mainWindow.resetSettings();
          break;

        case 'reselect':
          exportData.pickFile(function(filePath) {
            if (filePath) {
              exportData.filePath = filePath;
              mainWindow.overlay.toggleWindow('overlay', true);
            }
          });
          break;

        case 'export':
          exportData.saveData();
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
  }

  /**
   * Initialize the webview allowing multiprocess rendering.
   */
  function setupWebview() {
    exportData.$webview = $('#simulator-webview');
    var wv = exportData.$webview[0];

    // FWD console messages & errors.
    wv.addEventListener('console-message', function(event) {
      console.log('SIMULATOR:', event.message);
    });

    // Send message handlers TO app.
    exportData.$webview.send = {
      loadInit: function() {
        wv.send('loadInit', paper.mainLayer.exportJSON());
      },
      renderTrigger: function() {
        wv.send('renderTrigger', exportData.renderConfig);
      },
      cleanup: function() {
        wv.send('cleanup');
      }
    };

    // Catch IPC messages FROM app.
    wv.addEventListener('ipc-message', function(event) {
      //console.log('RECV ', event.channel); // DEBUG
      var data = event.args[0];
      switch (event.channel) {
        case 'paperReady':
          // Only run on first window init.
          exportData.simulatorLoaded = true;
          exportData.$webview.send.loadInit();
          exportData.$webview.css('opacity', 1);
          break;
        case 'initLoaded':
          exportData.initLoaded = true;
          exportData.renderUpdate(); // Run Initial render.
          break;
        case 'renderComplete':
          renderUpdateComplete();
          exportData.gcode = data;
          break;
      }
    });

    wv.addEventListener('dom-ready', function(){
      //wv.openDevTools(); // DEBUG
    });
  }

  // Map the settings to the renderConfig object.
  // @see: main.js settings init default for explanations and default values.
  exportData.setRenderSettings = function() {
    var rc = exportData.renderConfig;
    rc.flattenResolution = app.settings.v.flatten;
    rc.lineEndPreShutoff = app.settings.v.shutoff;
    rc.startWait = app.settings.v.startwait;
    rc.endWait = app.settings.v.endwait;
    rc.shadeChangeWait = app.settings.v.changewait;
    rc.useLineFill = app.settings.v.uselinefill;
    rc.useShortest = app.settings.v.useshortest;
    rc.fillSpacing = app.settings.v.fillspacing;
    rc.fillAngle = app.settings.v.fillangle;
    rc.fillGroupThreshold = app.settings.v.fillthresh;
    rc.shapeFillWidth = app.settings.v.shapefillwidth;
    rc.botSpeed = parseInt(
      (app.settings.v.botspeed / 100) * app.constants.botSpeedMax,
      10
    );

    // Capture editor view bounds and pass along for conversion as source.
    rc.sourceBounds = paper.view.bounds;

    // Mirroring swap.
    rc.noMirror = !$('#mirrorexport', context).prop('checked');

    rc.useColorSpeed = app.settings.v.usecolorspeed;
    rc.botColorSpeed = [
      parseInt(
        (app.settings.v.botspeedcolor1 / 100) * app.constants.botSpeedMax, 10
      ),
      parseInt(
        (app.settings.v.botspeedcolor2 / 100) * app.constants.botSpeedMax, 10
      ),
      parseInt(
        (app.settings.v.botspeedcolor3 / 100) * app.constants.botSpeedMax, 10
      ),
      parseInt(
        (app.settings.v.botspeedcolor4 / 100) * app.constants.botSpeedMax, 10
      ),
    ];

    exportData.renderUpdate();
  };

  /**
   * Save rendered GCODE data to the given initialized filePath.
   */
  exportData.saveData = function() {
    try {
      fs.writeFileSync(exportData.filePath, exportData.gcode); // Write file!

      // Notify user
      toastr.success(
        i18n.t('export.note', {file: path.parse(exportData.filePath).base})
      );
      mainWindow.overlay.toggleWindow('export', false); // Hide window.
    } catch(e) {
      console.error(e);
      // Notify user
      toastr.error(
        i18n.t('export.err', {file: path.parse(exportData.filePath).base})
      );
    }

  };

  /**
   * Spawn the file save dialog for GCODE export, returns filePath in callback.
   * @param  {Function} callback
   *   Function to call back when the user is done picking the file.
   */
  exportData.pickFile = function(callback) {
    mainWindow.dialog({
      t: 'SaveDialog',
      title: i18n.t('export.title'),
      defaultPath: path.join(
        app.getPath('userDesktop'),
        app.currentFile.name.split('.')[0]
      ),
      filters: [
        { name: 'PancakeBot GCODE', extensions: ['gcode'] }
      ]
    }, function(filePath) {
      // Verify file extension
      if (filePath && filePath.split('.').pop().toLowerCase() !== 'gcode') {
        filePath += '.gcode';
      }

      callback(filePath);
    });
  };

  /**
   * Run a render multiprocess render update.
   */
  exportData.renderUpdate = function () {
    if (!exportData.renderUpdateRunning && exportData.initLoaded) {
      exportData.renderUpdateRunning = true;
      $loadingBar.css('opacity', 100);

      exportData.$webview.send.renderTrigger();
    }
  };

  /**
   * Everything that has to happen to wrap up the render update.
   */
  function renderUpdateComplete() {
    exportData.renderUpdateRunning = false;
    $loadingBar.css('opacity', 0);
  }

  /**
   * Window initialization callback, triggered on window import.
   */
  exportData.init = function() {
    $(window).on('settingsChanged', exportData.setRenderSettings);
    setupWebview();
    initRenderConfig();
    bindSettings();
    bindButtons();
  };

  /**
   * Window show event callback, triggered on window show.
   */
  exportData.show = function() {
    if (exportData.simulatorLoaded) {
      exportData.$webview.send.loadInit();
    }
    exportData.setRenderSettings();
  };

  /**
   * Window hide event callback, triggered on window close.
   */
  exportData.hide = function() {
    exportData.$webview.send.cleanup();
    exportData.initLoaded = false;
  };

  /**
   * Window resize event callback, triggered on window resize.
   */
  exportData.resize = function() {
    var h = $('.overlay-content > fieldset', context).height();
    $('div.flex-wrapper', context).height(h - 18);
  };

  return exportData;
};
