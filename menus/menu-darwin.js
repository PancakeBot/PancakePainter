/*
 * @file Menu "module", provides menu for Mac/darwin only.
 */
"use strict";
var app = require('app');
var BrowserWindow = require('browser-window');
var Menu = require('menu');
var path = require("path");
var packageData = require(path.join(app.getAppPath(), 'package.json'));
var appName = packageData.name;

var template = [
  {
    label: appName,
    submenu: [
      {
        label: 'About ' + appName,
        selector: 'orderFrontStandardAboutPanel:'
      },
      {
        type: 'separator'
      },
      {
        label: 'Services',
        submenu: []
      },
      {
        type: 'separator'
      },
      {
        label: 'Hide ' + appName,
        accelerator: 'Command+H',
        selector: 'hide:'
      },
      {
        label: 'Hide Others',
        accelerator: 'Command+Shift+H',
        selector: 'hideOtherApplications:'
      },
      {
        label: 'Show All',
        selector: 'unhideAllApplications:'
      },
      {
        type: 'separator'
      },
      {
        label: 'Quit',
        accelerator: 'Command+Q',
        click: function () {
          app.quit();
        }
      }

    ]
  },
  {
    label: 'File',
    submenu: [
      {
        label: 'New Project',
        accelerator: 'Command+N',
        click: function () {
          // TODO: Add this
        }
      },
      {
        label: 'Open Project',
        accelerator: 'o',
        click: function () {
          // TODO: Add this
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Close Project',
        accelerator: 'Command+W',
        click: function () {
          // TODO: Add this
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Save Project',
        accelerator: 'Command+S',
        click: function () {
          // TODO: Add this
        }
      },
      {
        label: 'Save Project as',
        accelerator: 'Command+Shift+S',
        click: function () {
          // TODO: Add this
        }
      }
    ]
  },
  {
    label: 'View',
    submenu: [
      {
        label: 'Reload',
        accelerator: 'Command+R',
        click: function () {
          BrowserWindow.getFocusedWindow().reloadIgnoringCache();
        }
      },
      {
        label: 'Toggle DevTools',
        accelerator: 'Alt+Command+I',
        click: function () {
          BrowserWindow.getFocusedWindow().toggleDevTools();
        }
      }
    ]
  },
  {
    label: 'Window',
    submenu: [
      {
        label: 'Minimize',
        accelerator: 'Command+M',
        selector: 'performMiniaturize:'
      },
      {
        label: 'Close',
        accelerator: 'Command+W',
        selector: 'performClose:'
      }
    ]
  },
  {
    label: 'Help',
    submenu: []
  }
];

module.exports = function applyTemplate() {
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  return template;
};
