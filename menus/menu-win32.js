/*
 * @file Menu "module", provides menu for Windows/win32 only.
 */
"use strict";
module.exports = function applyTemplate() {
  var remote = require('remote');
  var BrowserWindow = remote.require('browser-window');

  var template = [
    {
      key: 'file.title',
      submenu: [
        {
          key: 'file.new',
          accelerator: 'Control+N'
        },
        {
          key: 'file.open',
          accelerator: 'o'
        },
        {
          type: 'separator'
        },
        {
          key: 'file.close',
          accelerator: 'Control+W'
        },
        {
          type: 'separator'
        },
        {
          key: 'file.export',
          accelerator: 'Control+E'
        },
        {
          key: 'file.save',
          accelerator: 'Control+S'
        },
        {
          key: 'file.saveas',
          accelerator: 'Control+Shift+S'
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
    }
  ];

  return template;
};
