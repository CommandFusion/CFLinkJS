CF.userMain = function() {

	// Setup the CFLink comms to the system in guiDesigner
	CFL.connect("LAN Bridge", "LB_Feedback");

	// Watch incoming serial data
	CFL.watchSerial("20", "", function(watchID, module, origin, data) {
		CF.log("Incoming Serial Data: " + data); // The data will show in the debugger script log
	});

	// Watch relay state changes
	CFL.watchRelays("20", "", function(watchID, module, origin, data) {
		for (var port in data) {
			// Update the buttons that have tags "relay_P01", etc.
			CF.setJoin("relay_" + port, data[port]);
		}
	});
};