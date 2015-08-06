/**
 * @file This is the central "main process" node-only window/update manager
 * script file for PacnackeCreator. This is loaded first and is always running
 * as long as the application runs.
 **/
"use strict";

var app = require('app');  // Module to control application life.
var appPath = app.getAppPath() + '/';
var fs = require('fs-plus');
var _ = require('underscore');
var BrowserWindow = require('browser-window');  // Module to create native browser window.
var dialog = require('dialog');
var i18n = require('i18next');
require('electron-compile').initWithOptions({cacheDir: appPath + 'src/cache'});

// Report crashes to our server.
//require('crash-reporter').start();

// Handle app startup with command line arguments from squirrel (windows).
function start() {
  // Process squirrel update/install command line.
  if (process.platform === 'win32') {
    SquirrelUpdate = require('./squirrel-update');
    var squirrelCommand = process.argv[1];
    if (SquirrelUpdate.handleStartupEvent(app, squirrelCommand)) {
      // If we processed one, quit right after.
      return false;
    }
  }

  settingsInit();
  windowInit();
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the javascript object is GCed.
var mainWindow = null;

/**
 * Initialize the settings & defaults
 */
function settingsInit() {
  var settingsFile = appPath + 'settings.json';
  app.settings = {
    v: {}, // Values are saved to/from here
    defaults: {
      window: {
        width: 980,
        height: 600,
        y: 'center',
        x: 'center'
      },
      lastFile: ''
    },
    save: function() {
      fs.writeFileSync(settingsFile, JSON.stringify(this.v));
    },
    load: function() {
      this.v = {};
      try {
        if (fs.existsSync(settingsFile)) {
          this.v = JSON.parse(fs.readFileSync(settingsFile));
        }
      } catch(e) {}

      // Comb in defaults
      for(var i in this.defaults) {
        if (!_.has(this.v, i)) {
          this.v[i] = this.defaults[i];
        }
      }

      this.save(); // Resave when we're done loading.
    }
  };

  app.settings.load();
}


/**
 * Initialize the windows/attach menus
 */
function windowInit() {
  // Quit when all windows are closed (including OSX).
  app.on('window-all-closed', function() {
      app.quit();
  });

  // This method will be called when Electron has done all the initialization
  // and should be ready for creating menus & browser windows.
  app.on('ready', function() {
    i18n.init({
      ns: {
        namespaces: ['app', 'menus', 'buttons'],
        defaultNs: 'app'
      },
      resGetPath: appPath + 'locales/__lng__/__ns__-__lng__.json', // Path to find file
      resSetPath: appPath + 'locales/__lng__/__ns__-__lng__.json', // Path to store file
      sendMissingTo: 'fallback|current|all', // Send missing values to
      lng: 'en-US'
    }, function(){

      var windowSettings = {
        'min-width': 600,
        'min-height': 420,
        width: app.settings.v.window.width,
        height: app.settings.v.window.height,
        resizable: true,
        icon: appPath + "resources/app.png",
        title: "PancakeCreator"
      };

      // Centered or fixed window position?
      if (app.settings.v.window.y === 'center') {
        windowSettings.center = true;
      } else {
        windowSettings.x = app.settings.v.window.x;
        windowSettings.y = app.settings.v.window.y;
      }

      // Create the main application window.
      mainWindow = new BrowserWindow(windowSettings);

      // Window wrapper for dialog (can't include module outside of this) :P
      mainWindow.dialog = function(options, callback) {
        dialog['show' + options.type](mainWindow, options, callback);
      };

      // and load the index.html of the app.
      mainWindow.loadUrl('file://' + __dirname + '/index.html');


      // Save Move/Resize back to file
      mainWindow.on('move', function(){
        var b = this.getBounds();
        app.settings.v.window.x = b.x;
        app.settings.v.window.y = b.y;
        app.settings.v.window.width = b.width;
        app.settings.v.window.height = b.height;
        app.settings.save();
      });

      // Emitted when the window is closed.
      mainWindow.on('closed', function() {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
      });
    });
  });
}

// Actually start initializing. We do this here to ensure we can completely exit
// initialization without loading any windows during Squirrel updates.
start();
