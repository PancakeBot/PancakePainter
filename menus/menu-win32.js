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
          key: 'file.exportmirrored',
          accelerator: 'Control+Shift+E'
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
      key: 'view.title',
      submenu: [
        {
          key: 'view.settings',
          accelerator: 'Shift+Alt+S'
        },
        {
          key: 'view.reload',
          accelerator: 'Control+R',
          click: function () {
            BrowserWindow.getFocusedWindow().reloadIgnoringCache();
          }
        },
        {
          key: 'view.toggle',
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
