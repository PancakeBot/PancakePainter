/*
 * @file This is the central application logic and window management src file.
 * This is the central render process main window JS, and has access to
 * the DOM and all node abilities.
 */
"use strict";

// Libraries ==============================================---------------------
// Must use require syntax for including these libs because of node duality.
window.$ = window.jQuery = require('jquery');
window._ = require('underscore');
window.$.i18n = window.i18n = require('i18next');

// Main Process ===========================================---------------------
// Include global main process connector objects for the renderer (this window).
var remote = require('remote');
var mainWindow = remote.getCurrentWindow();
var app = remote.require('app');
