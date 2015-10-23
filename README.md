# PancakePainter!
#### The super-simple drawing software for your PancakeBot.

![PancakePainter](https://cloud.githubusercontent.com/assets/320747/10681916/96629bc8-78e3-11e5-99e6-4f6c3e13cc86.png)

### Download/Install
 * *Windows 7-10* ➤ [32bit](https://github.com/PancakeBot/PancakePainter/releases/download/v1.0.0-Beta1/Install_PancakePainter_Win_v1.0.0-Beta1.exe)
 * *Mac OSX 10.7+* ➤ [x64](https://github.com/PancakeBot/PancakePainter/releases/download/v1.0.0-Beta1/PancakePainter_Mac_v1.0.0-Beta1.zip)
 * *Linux:* No build supported yet,  can run from source. Vote here: #39

#### Check the [latest release page](https://github.com/PancakeBot/PancakePainter/releases/latest) for feature notes, known issues, and other details.


### User Documentation
 0. **Using the drawing tool:**
   * Click and drag to draw pancake lines freehand
   * Click single points to draw polygonal shapes, press right click or
   ESC/Enter to complete drawing.
 0. **Using the selection tool:**
   * Click the center or near a line to select it.
   * Once selected, click and drag the corner handles to scale the object, or
the top rotation handle to rotate it.
   * Click and drag points on the line to move them, shift-click to remove, or
click an area on the line without any points to add a new point.
   * Click and drag the selected object anywhere else to move it to a new
position.
 0. **Using the trace image import tool:**
   * To import an image to trace by hand, click the image import icon, select
   your image (in any standard web format, GIF, JPG, PNG), and it will be placed
   on the canvas.
   * Once imported, you can move the image around and scale/rotate it as needed.
   * When done, click outside the image, press ESC, or select the drawing
   tool.
   * To adjust the image position, just click the image import button again. To
   choose a new image, press the Delete key when in edit mode then click import
   again.
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
and npm to manage running and packages. See [nodejs.org](http://iojs.org) for
installation for your operating system. `npm` is installed along with it. If you
already have node installed, you can probably go without upgrading as Electron
provides its own node.js implementation built in.

#### Electron (v0.30.x)
Though the `src/index.html` may somewhat render in a regular browser, you're
going to need to run it inside of Electron before it all works. After node
is installed, just run from your terminal/console
`npm install -g electron-prebuilt` to install Electron on your path. When
complete, just run `electron -v` to see the installed app version.

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

#### Install PancakePainter run resources
To get the local code running, be sure to run `npm install --force` from the
repo root, this will give you the third party resources needed to run. The
`--force` is unfortunately required to pass install of Paper.js as a node
module, even though we only use it as a clientside library, so we can ignore the
errors. See the tracking [issue here](https://github.com/paperjs/paper.js/issues/739).

### Running from source
* Once Electron prebuilt is installed, just run `electron path/to/pancakepainter`,
or `electron ./` if you're working directory is the root of the repo.
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
