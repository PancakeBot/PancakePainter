/*
 * @file Menu "module", provides menu for Windows/win32 only.
 */
"use strict";
module.exports = function applyTemplate() {
  var remote = require('electron').remote;
  var BrowserWindow = remote.BrowserWindow;

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
      key: 'edit.title',
      submenu: [
        {
          key: 'edit.undo',
          accelerator: 'Control+z'
        },
        {
          key: 'edit.redo',
          accelerator: 'Control+Shift+z'
        },
        {
          type: 'separator'
        },
        {
          key: 'edit.cut',
          accelerator: 'Control+x'
        },
        {
          key: 'edit.copy',
          accelerator: 'Control+c'
        },
        {
          key: 'edit.paste',
          accelerator: 'Control+v'
        },
        {
          key: 'edit.duplicate',
          accelerator: 'Control+d'
        },
        {
          type: 'separator'
        },
        {
          key: 'edit.selectall',
          accelerator: 'Control+a'
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
          key: 'view.devtools',
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
