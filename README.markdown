# CommandFusion CFLink JavaScript API - BETA

Our [CommandFusion hardware](http://www.commandfusion.com/hardware.html) is powerful and easy to work with. To make it even easier, we are providing a JavaScript API for [iViewer](http://www.commandfusion.com/iviewer.html) so you can talk to CFLink devices and get notified of incoming data very easily.

Our JavaScript code handles the [low-level CFLink protocol](http://www.commandfusion.com/docs/cflink), providing you with high-level interfaces for your code to drive the CFLink network.

**CFLink JavaScript API is still in beta!** Please report issues and feature requests via the [issue tracker](https://github.com/CommandFusion/CFLinkJS/issues).

## Downloads & Documentation

You can view the CFLink JavaScript API documentation [online](http://www.commandfusion.com/docs/cflinkjs/CFLink.html), or [download](https://github.com/CommandFusion/CFLinkJS/zipball/master) the documentation and example guiDesigner project directly from this github repo.

## Usage

To use the CFLink JS API, you need to include the [cflink.js](https://raw.github.com/CommandFusion/CFLinkJS/master/cflink.js) file into your guiDesigner project via Edit > Project Properties > Script Manager.

Then you create your own JavaScript file for your iViewer programming, and add it to the Script Manager also.

## Quick Start Example

Here is a very basic example of the JavaScript required to communicate with a [CF Mini](http://www.commandfusion.com/cfmini.html) device:

```javascript
var devices = CFLink.getDevices({
  mini: {
    id: "20",
    type: CFLink.model.CFMini
  }
}, "CFLINK");

// pulse relay #3 for 0.5 second
devices.mini.pulseRelayState(3, 5);

// be notified of IO changes
devices.mini.watchIOPorts(null, function(mini, port, previousValue, newValue) {
  // we are called when one of the IO ports 1-4 changes state
  CF.log("IO Port " + port + " changed from " + previousValue + " to " + newValue);
});
```