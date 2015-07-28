/*
 * @file Menu "module", provides menu for Windows/win32 only.
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
    label: '&File',
    submenu: [
      {
        label: '&New Project',
        accelerator: 'Control+N',
        click: function () {
          // TODO: Add this
        }
      },
      {
        label: '&Open Project',
        accelerator: 'o',
        click: function () {
          // TODO: Add this
        }
      },
      {
        type: 'separator'
      },
      {
        label: '&Close Project',
        accelerator: 'Control+W',
        click: function () {
          // TODO: Add this
        }
      },
      {
        type: 'separator'
      },
      {
        label: '&Save Project',
        accelerator: 'Control+S',
        click: function () {
          // TODO: Add this
        }
      },
      {
        label: 'Save Project &as',
        accelerator: 'Control+Shift+S',
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
        accelerator: 'Control+R',
        click: function () {
          BrowserWindow.getFocusedWindow().reloadIgnoringCache();
        }
      },
      {
        label: 'Toggle DevTools',
        accelerator: 'Alt+Control+I',
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
        accelerator: 'Control+M',
        selector: 'performMiniaturize:'
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
