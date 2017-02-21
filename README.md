# PancakePainter!
#### The super-simple drawing software for your PancakeBot.

[![Join the chat at https://gitter.im/PancakePainter/Lobby](https://badges.gitter.im/PancakePainter/Lobby.svg)](https://gitter.im/PancakePainter/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

### Download/Install [Latest release] - v1.2.0
 * *Windows 7-10* ➤ [x32](https://github.com/PancakeBot/PancakePainter/releases/download/v1.2.0-Beta/Install_PancakePainter_Win_32bit_v1.2.0-beta.exe) / [x64](https://github.com/PancakeBot/PancakePainter/releases/download/v1.2.0-Beta/Install_PancakePainter_Win_64bit_v1.2.0-beta.exe)
 * *Mac OSX 10.7+* ➤ [x64](https://github.com/PancakeBot/PancakePainter/releases/download/v1.2.0-Beta/PancakePainter_Mac_v1.2.0-Beta.zip)
 * *Linux:* No build, can run from source.

#### Check the [latest release page](https://github.com/PancakeBot/PancakePainter/releases/latest) for feature notes, known issues, and other details.

![PancakePainter](https://cloud.githubusercontent.com/assets/320747/10681916/96629bc8-78e3-11e5-99e6-4f6c3e13cc86.png)

----

#### PancakeBot is proud to present the latest pre-release version of Pancake Painter!
Featuring a new automatic tracing functionality that makes drawing pancakes from
pre-existing art much easier. Take your favorite cartoon, logo or photo, and
turn them into tasty pancake art! Other new features include marquee selection
& print preview. Give it a try at it and tell us what you think! We always are
happy to hear your comments on how to improve the software and make your pancake
art experience even better!

![PancakePainter 1.3.0 Beta](https://cloud.githubusercontent.com/assets/320747/23157197/f7b6226c-f7ce-11e6-9cab-1eaacc071950.png)

### Download/Install ***[Pre-release]*** - v1.3.0 Beta
 * *Windows 7-10* ➤ [x32](https://github.com/PancakeBot/PancakePainter/releases/download/v1.3.0-Beta/Install_PancakePainter_Win_32bit_v1.3.0-beta.exe) / [x64](https://github.com/PancakeBot/PancakePainter/releases/download/v1.3.0-Beta/Install_PancakePainter_Win_64bit_v1.3.0-beta.exe)
 * *Mac OSX 10.7+* ➤ [x64](https://github.com/PancakeBot/PancakePainter/releases/download/v1.3.0-Beta/PancakePainter_Mac_v1.3.0-Beta.dmg)
 * *Linux (requires [`autotrace`](http://packages.ubuntu.com/xenial/autotrace) system package)* ➤ [x64 Ubuntu/Debian DEB](https://github.com/PancakeBot/PancakePainter/releases/download/v1.3.0-Beta/PancakePainter_1.3.0_amd64.deb) / [x64 Redhat RPM](https://github.com/PancakeBot/PancakePainter/releases/download/v1.3.0-Beta/PancakePainter-1.3.0.x86_64.rpm)

----

### User Documentation
 0. **Using the drawing tool:**
   * Click and drag to draw pancake lines freehand
   * Click single points to draw polygonal shapes, press right click or
   ESC/Enter to complete drawing.
 0. **Using the selection tool:**
   * Click the center or near a line to select it, shift click to add to
   selection.
   * Alternate selection: Click and drag to create a selection marquee to fully
   encompass any objects you'd like to select _(v1.3.0)_.
   * Once selected, click and drag the corner handles to scale the object, or
the top rotation handle to rotate it.
   * Click and drag points on the line to move them, shift-click to remove, or
click an area on the line without any points to add a new point.
   * Click and drag the selected object anywhere else to move it to a new
position.
 0. **Manual image trace import tool:**
   * To import an image to trace by hand, click the image import icon, then
   select the manual import icon on the left. Select your image (in any standard
   web format, GIF, JPG, PNG), and it will be placed on the canvas.
   * Once imported, you can move the image around and scale/rotate it as needed.
   * When done, click outside the image, press ESC, or select the drawing
   tool.
   * To adjust the image position, just click the image import button again. To
   choose a new image, press the Delete key when in edit mode then click import
   again.
 0. **Automatic image trace import tool _(v1.3.0)_:**
   * Click the image import icon and select either of the two automatic trace
   presets.
   * Within the automatic trace window, adjust the settings to your liking.
   * When complete, select how many copies you want & click the "Place" button.
   * You now should have fills and strokes as if you had drawn them yourself.
 0. **Using the fill tool:**
   * The fill tool is used to visually fill an area with a specific shade, which
   will then be used to create a zig-zag fill pattern used by the PancakeBot.
   * Click inside an empty area enclosed on all sides by drawn lines to fill
   that space. Large or complex fills may take some time.
   * Only drawn lines define what can be filled, not imported images or the
   drawable boundary.
   * If the algorithm cannot fill what you've drawn, you will be notified with a
   reason why.
   * If a complex fill ends up with triangles across it or doesn't look right,
   select and delete it, then adjust the surrounding shapes and try again.
 0. **Export your drawing for printing:**
   * Your PancakeBot uses a readable text format for input called GCODE to
   create your pancake art. Unique to each drawing and configuration, they tell
   your bot how to move and when to extrude batter to make your drawing.
   * To generate the file you need, use the menu "File > Export for printing..."
and select a location to save the file. You can then place this on your bot's
SD card and print at your leisure.

Official support will eventually be found @
[PancakeBot.com](http://www.pancakebot.com)

## Problems?
***Stuck on something?*** Submit an issue! Click the
[issues tab](https://github.com/PancakeBot/PancakePainter/issues) and see if
someone is covering your question or problem, if not, ask away! Someone will be
around to help soon.

***Know how to fix a problem? Or want to add a new feature??*** Submit a pull
request! Just fork the repo using the button on the
[github homepage](https://github.com/PancakeBot/PancakePainter), and
this will give you your own version of PancakePainter. Make your change in a few
commits to a new branch, then click the pull request button at the top! Talk
about what changes you made and submit. A maintainer of the project will check
your work, possibly ask you to fix a few more things, and then if all is well,
your work will be merged into the project. It's that easy, really.

## Contributing to the Project
PancakePainter uses Github's [Electron application shell](http://electron.atom.io)
as a cross platform wrapper, and to create the application logic everything is
written in plain JavaScript. If you know how to mess with websites, HTML, CSS or
jQuery, you can bend PancakePainter to your whim! Read on to get your own dev
environment setup to start hacking.

### Local Run Prerequisites

#### Node.js (4.x+) & npm
Required for automated builds and node module install. Electron uses Node.js
and npm to manage running and packages. See [nodejs.org](http://nodejs.org) for
installation for your operating system. `npm` is installed along with it. If you
already have node installed, you can probably go without upgrading as Electron
provides its own node.js implementation built in.

#### Install PancakePainter run resources
Though the `src/index.html` may somewhat render in a regular browser, you're
going to need to run it inside of Electron before it all works. To get the local
code running, be sure to run `npm install --force` from the repository root,
this will give you the third party resources needed to run. The `--force` is
unfortunately required to pass install of Paper.js as a node module, even
though we only use it as a clientside library, so we can ignore the
errors. See the tracking [issue here](https://github.com/paperjs/paper.js/issues/739).

#### Build Tools
Various node modules require builds and may complain if you don't have the right
build tools. These are great to have regardless on any OS you use.

##### Windows
* You'll need the free download version of
[Visual Studio Express 2013](http://www.microsoft.com/visualstudio/eng/2013-downloads#d-2013-express)
which will have the command line tools required for builds.

##### Mac OSX
* Install Xcode and the CLI Developer tools.
* You _might_ be able to [skip installing Xcode to get the GCC tools alone](http://osxdaily.com/2012/07/06/install-gcc-without-xcode-in-mac-os-x/).

##### Linux
* This is the easiest, as most [FOSS](http://en.wikipedia.org/wiki/FOSS) ships
as source to be built on the target machines, so you shouldn't have to install
anything new for this at all.
* Note there is currently no officially supported Linux release, but the app
should run fine there. If there is call for support, it can be added (or submit
a Pull Request!)

### Running from source
* Once `npm install` has run, just run `npm start` from the repository root.
* Remember: Alt+Ctrl+I to open the debug console, Ctl+R will reload if the
console is open, and a reload _only_ reloads the contents of the window, and
will _**not**_ reload the application main process.

## ETC.
This open source project has been built with love by
[TechNinja](https://github.com/techninja), made possible though direct support
from [Storebound](http://storebound.com),
[PancakeBot](https://github.com/PancakeBot), and Kickstarter Backers like _you_!

[Windows installation GIF](https://github.com/PancakeBot/PancakePainter/blob/master/resources/win32/install_anim.gif)
made with permission from animation work done by
the incredible [Orbo](https://www.reddit.com/r/orbo).

All code licensed under Apache v2.0
