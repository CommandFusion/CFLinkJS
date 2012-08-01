var dev;
var watchid = [];

CF.userMain = function() {

	// Watch the data coming from CFLink in JavaScript
	// Without this, the whole CFLink JS API won't be able to fire events or parse incoming data
	CF.watch(CF.FeedbackMatchedEvent, "CFLINK", "IncomingData", CFLink.incomingData)

	// Delay sending data to systems until all JavaScript is loaded
	setTimeout(function() {

		// Define the devices we want to talk to throughout our project
		// Documentation: CFLink.html#getDevices
		dev = CFLink.getDevices({
			"mini": {
				id: "20",
				type: CFLink.model.CFMini
			},
			"bridge": {
				id: "02",
				type: CFLink.model.LANBridge
			}
		}, "CFLINK");

		// Once info about our CF Mini has been received, start watching relays
		watchid[0] = CFLink.watch(CFLink.Device.INFO_RECEIVED, dev.mini, function(event, device) {
			CF.log("CF Mini Info Received.");
			
			// Watch relay ports for changes in its state
			// Documentation: CFLink.CFMini.html
			dev.mini.watchRelays([1,2,3,4], function(cfmini, relayNumber, oldValue, value) {
				CF.log("Mini Relay Changed: " + relayNumber)
				CF.setJoin("d"+relayNumber, value);
			});

			// Watch IO port changes
			// Documentation: CFLink.CFMini.html
			dev.mini.watchIOPorts([1,2,3,4], function(cfmini, ioPortNumber, previousValue, newValue) {
				CF.log("Mini IO Changed: " + ioPortNumber + ", " + newValue);
				CF.setJoin("s"+ioPortNumber, newValue);
			});

			// Watch incoming data on the RS232 port of the CF Mini
			// Documentation: CFLink.Device.html
			dev.mini.watchCOMPort(function(cfmini, data) {
				CF.log("RS232 device says: " + data);
				CF.setJoin("s5", data);
			});

			// Watch the input field editing is finished (keyboard is hidden)
			// Documentation: http://www.commandfusion.com/docs/scripting/gui.html#cF.KeyboardDownEvent
			CF.watch(CF.KeyboardDownEvent, function(join, fieldText){
				// Send the data to the on-board RS232 port
				// Documentation: CFLink.Device.html
				dev.mini.sendCOMData(fieldText);
			});
			
			// Dont care about this INFO_RECEIVED event anymore, so free up memory and unwatch it
			CFLink.unwatch(watchid[0]);

		});

	}, 500);

};