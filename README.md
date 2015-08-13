# PancakeCreator!
#### The super-simple drawing software for your PancakeBot.

### Download/Install
**** _We're currently in the Alpha phase and have no official releases yet. Check
back soon for updates. If you're a hardcore tester, you can follow the roadmap
through the issue queue and the milestones page._ ****


### User Documentation
 0. Using the drawing tool:
   * Click and drag to draw pancake lines freehand
   * Click single points to draw polygonal shapes, double-click or press
ESC/Enter to complete drawing.
 0. Using the selection tool:
   * Click the center or near a line to select it.
   * Once selected, click and drag the corner handles to scale the object, or
the top rotation handle to rotate it.
   * Click and drag points on the line to move them, shift-click to remove, or
click an area on the line without any points to add a new point.
   * Click and drag the selected object anywhere else to move it to a new
position.
 0. Export your drawing for printing:
   * Your PancakeBot uses a almost readable text format for input called GCODE
unique to each drawing and setup that tells your bot how to move and when to
extrude batter to make your drawing.
   * To generate the file you need, use the menu "File > Export for printing..."
and select a location to save the file. You can then place this on your bot's
SD card and print at your leisure.


_More details coming soon!_

Official support will eventually be found @
[PancakeBot.com](http://www.pancakebot.com)

## Problems?
***Stuck on something?*** Submit an issue! Click the
[issues tab](https://github.com/PancakeBot/PancakeCreator/issues) and see if
someone is covering your question or problem, if not, ask away! Someone will be
around to help soon.

***Know how to fix a problem? Or want to add a new feature??*** Submit a pull
request! Just fork the repo using the button on the
[github homepage](https://github.com/PancakeBot/PancakeCreator), and
this will give you your own version of PancakeCreator. Make your change in a few
commits to a new branch, then click the pull request button at the top! Talk
about what changes you made and submit. A maintainer of the project will check
your work, possibly ask you to fix a few more things, and then if all is well,
your work will be merged into the project. It's that easy, really.

### Contributing to the Project
PancakeCreator uses Github's [Electron application shell](http://electron.atom.io)
as a cross platform wrapper, and to create the application logic everything is
written in plain JavaScript. If you know how to mess with websites, HTML, CSS or
jQuery, you can bend PancakeCreator to your whim! Read on to get your own dev
environment setup to start hacking.

### Local Run Prerequisites

#### Io.js (2.4.x+) for node & npm
Required for automated builds and node module install. Electron uses Node.js'
little brother fork, io.js. See [iojs.org](http://iojs.org) for installation for
your operating system. `npm` is installed along with it. If you already have
node installed, you can probably go without switching to io.js as electron
provides its own io.js implementation built in.

#### Electron (v0.30.x)
Though the `src/index.html` may somewhat render in a regular browser, you're
going to need to run it inside of Electron before it all works. After node/io.js
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

#### Install PancakeCreator run resources
To get the local code running, be sure to run `npm install --force` from the
repo root, this will give you the third party resources needed to run. The
`--force` is unfortunately required to pass install of Paper.js as a node
module, even though we only use it as a clientside library, so we can ignore the
errors. See the tracking [issue here](https://github.com/paperjs/paper.js/issues/739).

### Running from source
* Once Electron prebuilt is installed, just run `electron path/to/pancakecreator`,
or `electron ./` if you're working directory is the root of the repo.
* Remember: Alt+Ctrl+I to open the debug console, Ctl+R will reload if the
console is open, and a reload _only_ reloads the contents of the window, and
will _**not**_ reload the application main process.


## ETC.
This open source project has been built with love by
[TechNinja](https://github.com/techninja), made possible though direct support
from [Storebound](http://storebound.com),
[PancakeBot](https://github.com/PancakeBot), and Kickstarter Backers like _you_!

All code licensed under Apache v2.0
