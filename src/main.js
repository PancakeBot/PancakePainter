/**
 * @file This is the central "main process" node-only window/update manager
 * script file for PacnackePainter. This is loaded first and is always running
 * as long as the application runs.
 **/
"use strict";
if (require('electron-squirrel-startup')) return;
const path = require('path');

var app = require('electron').app;  // Module to control application life.
var appPath = app.getAppPath();
var fs = require('fs-plus');
var _ = require('underscore');

// Module to create native browser window.
var BrowserWindow = require('electron').BrowserWindow;
var dialog = require('electron').dialog;
var i18n = require('i18next');

// Report crashes to our server.
//require('crash-reporter').start();

// Handle app startup with command line arguments from squirrel (windows).
function start() {
  // Process squirrel update/install command line.
  if (process.platform === 'win32') {
    var SquirrelUpdate = require('./squirrel-update');
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
 * Initialize the settings, constants & defaults
 */
function settingsInit() {
  // Global application constants (set and referenced from here only!)
  // TODO: Gather more of these from around the app.
  app.constants = {
    pancakeShades: [
      '#ffea7e',
      '#e2bc15',
      '#a6720e',
      '#714a00'
    ],
    botSpeedMax: 6600, // Real world PancakeBot speed maximum.

    // Real world measurement of the griddle maximum dimensions in MM
    griddleSize: {
      width: 507.5,
      height: 267.7,
    },

    // Printable/drawable area in MM from furthest griddle edge.
    printableArea: {
      offset: {
        left: 36.22,
        top: 34.77,
        right: 42, // Used exclusively for GCODE X offset
      },
      width: 443,
      height: 210,
    },
  };

  // Global user configurable settings.
  var settingsFile = path.join(appPath, 'settings.json');
  var userSettingsFile = path.join(app.getPath('userData'), 'config.json');
  app.settings = {
    v: {}, // Values are saved to/from here
    defaults: {
      window: {
        width: 980,
        height: 600,
        y: 'center',
        x: 'center'
      },
      lastFile: '',
      flatten: 2,          // Flatten curve value (smaller value = more points)
      shutoff: 25,          // Remaining line length threshold for pump shutoff
      startwait: 350,       // Time to wait for batter flow begin
      endwait: 250,         // Time to wait for batter flow at end of line
      changewait: 15,       // Number of seconds to wait between shade changes.
      botspeed: 70,         // Locked stepper speed percentage written to GCODE
      usecolorspeed: false, // Whether to use different speeds for colors.
      useshortest: true,   // Whether to travel sort the final layer.
      botspeedcolor1: 100,  // Light speed.
      botspeedcolor2: 80,   // Medium speed.
      botspeedcolor3: 80,   // Medium Dark speed.
      botspeedcolor4: 50,   // Dark speed.
      uselinefill: false,   // Whether to use line fill over shape fill.
      fillspacing: 10,      // Space between each trace fill line
      fillangle: 23,        // Angle of line for trace fill
      fillthresh: 27,       // Threshold to group zig zags
      shapefillwidth: 3     // Effective fill space.
    },
    clear: function() {
      fs.removeSync(settingsFile);
    },
    save: function() {
      try {
        fs.writeFileSync(settingsFile, JSON.stringify(this.v));
      } catch (e) {
        fs.writeFileSync(userSettingsFile, JSON.stringify(this.v));
      }
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

      // Load user config.
      var user_config = {};
      try {
        if (fs.existsSync(userSettingsFile)) {
          user_config = require(userSettingsFile);
        }
      } catch(e) {}
      
      for(var i in user_config) {
        this.v[i] = user_config[i];
      }

      this.save(); // Resave when we're done loading.
    },
    reset: function() {
      this.clear();
      this.load();
    },
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
        namespaces: ['app', 'menus'],
        defaultNs: 'app'
      },
      // Path to find file
      resGetPath: path.join(appPath, 'locales', '__lng__', '__ns__-__lng__.json'),
      // Path to store file
      resSetPath: path.join(appPath, 'locales', '__lng__', '__ns__-__lng__.json'),
      sendMissingTo: 'fallback|current|all', // Send missing values to
      lng: 'en-US'
    }, function(){
      // Setup main window.
      var windowSettings = {
        minWidth: 680,
        minHeight: 420,
        width: app.settings.v.window.width,
        height: app.settings.v.window.height,
        resizable: true,
        icon: path.join(appPath, 'resources', 'app.png'),
        title: "PancakePainter",
        fullscreenable: false // Workaround for fullscreen OSX bug :'(
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
        return dialog['show' + options.t](mainWindow, options, callback);
      };

      // and load the index.html of the app.
      mainWindow.loadURL('file://' + __dirname + '/index.html');


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
