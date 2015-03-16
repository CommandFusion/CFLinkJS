var CFL = {
	system: null,
	feedback: null,
	watches: [],
	watchid: 1,
	monitorNetwork: null,

	/*-----------------------------------------------
	 * General
	 *-----------------------------------------------
	 */
	make: function (systemName, feedbackItem) {
		var obj = Object.create(this);
		obj.disconnect();
		obj.connect(systemName, feedbackItem);
		return obj;
	},

	connect: function (sys, fb) {
		this.system = sys;
		this.feedback = fb;
		var self = this;
		CF.watch(CF.FeedbackMatchedEvent, sys, fb, function (item, data) {
			self.process(data);
		});
	},

	process: function(data) {
		// separate to be replaceable / overridable
		if (this.monitorNetwork)
			this.monitorNetwork(true, data);
		this.watches.forEach(function (w, watchID) {
			if (w[1].test(data)) {
				w[0].apply(this, [watchID, data]);
			}
		});
	},

	send: function(data) {
		if (this.system != null)
			CF.send(this.system, data);
	},

	disconnect: function () {
		if (this.system != null && this.feedback != null)
			CF.unwatch(CF.FeedbackMatchedEvent, this.system, this.feedback);
		this.watches = [];
		this.watchid = 1;
		//this.system = "";
		//this.feedback = "";
	},

	watch: function (array) {
		var id = this.watchid++;
		this.watches[id] = array;
		return id;
	},

	unwatch: function (watchID) {
		if (this.watches[watchID]) {
			delete this.watches[watchID];
		}
	},

	message: function (id, cmd, payload, send) {
		var d = "\xF2" + String.fromCharCode(parseInt(id,16)) + "\xF3" + cmd + "\xF4" + (payload || "") + "\xF5\xF5";
		if (send !== false) {
			if (this.monitorNetwork)
				this.monitorNetwork(false, d);
			this.send(d);
		}
		return d;
	},

	unpack: function (msg) {
		// id,type,dev,cmd,payload
		return [("0"+msg.charCodeAt(1).toString(16)).substr(-2), msg.charAt(3), msg.substr(4, 3), msg.substr(7, 3), msg.substring(11, msg.length-2)];
	},

	port: function (port) {
		if (arguments.length == 2) port = [arguments[0], arguments[1]];
		if (port instanceof Array) return "M" + port[0] + "|P0" + port[1];
		if (port instanceof Number) return ("P0" + port).substr(0, 3);
		var a = port.split('|');
		if (a.length === 1) return parseInt(port.substring(1), 10);	// "P01" -> 1
		return [parseInt(a[0].substring(1), 10), parseInt(a[1].substring(1), 10)];
	},

	_packetRegex: function(id,cmd,payload) {
		id = (id == null || id === "") ? "[\\s\\S]" : "\\"+String.fromCharCode(parseInt(id,16));
		payload = (payload == null || payload === "") ? "" : payload.replace("|","\\|");
		return new RegExp("^\xF2" + id + "\xF3" + cmd + "\xF4" + payload);
	},

	/*-----------------------------------------------
	 * Serial ports
	 *-----------------------------------------------
	 */
	sendSerial: function (id, target, data) {
		if (target == null || target === "") {
			this.message(id, "TCFXSPW", data);
		} else if (target.length === 3) {
			this.message(id, "TCFXSPW", target + ":" + data);
		} else {
			this.message(id, "TCOMSPW", target + ":" + data);
		}
	},

	watchSerial: function (id, module, callback) {
		var orig = "COM";
		if (module == null || module === "") {
			orig = "(?!COM)(...)";
			module = "";
		}
		var self = this;
		return this.watch([ function (watchID, message) {
			var m = self.unpack(message), origin = "", data = m[4];
			if (m[2] == "COM") {
				var idx = data.indexOf(':');
				origin = data.substr(0, idx);
				data = data.substr(idx + 1);
			}
			callback(watchID, m[0], origin, data);
		}, this._packetRegex(id, "R"+orig+"SPR", module)]);
	},

	/*-----------------------------------------------
	 * Relays
	 *-----------------------------------------------
	 */
	unpackRelayStates: function (message) {
		var rly = message.substring(11, message.length-2).split('|'), n = rly.length, i, state = {};
		for (i = 1; i < n; i++) {
			state[rly[i].substr(0, 3)] = rly[i].substr(4);
		}
		return state;
	},

	queryRelays: function (id, module, callback) {
		if (callback != null) {
			var self = this;
			this.watch([ function (watchID, message) {
				self.unwatch(watchID);
				callback(watchID, id, module, self.unpackRelayStates(message));
			}, this._packetRegex(id,"RRLYSTA", module||"")]);
		}
		this.message(id, "QRLYSTA", module || "");
	},

	watchRelays: function (id, module, callback) {
		var self = this;
		return this.watch([ function (watchID, message) {
			callback(watchID, self.unpack(message)[0], module, self.unpackRelayStates(message));
		}, this._packetRegex(id,"RRLYSTA",module)]);
	},

	setRelay: function (id, module, port, state, duration) {
		state = ":" + ((state === 0) ? "0" :
			(state instanceof Number) ? "1" :
				(state === "P") ? state + ":" + ("0000" + (duration || "0")).slice(-5) :
					state || "0");
		module = (!module ? "" :
			(!isNaN(module)) ? "M" + module + "|" :
				module + "|");
		if (port instanceof Array) {
			var s=null;
			for (var i=0,n=port.length; i<n; i++)
				s = (s ? s + ",":"") + port[i] + state;
			this.message(id, "TRLYSET", module + s);
		} else {
			this.message(id, "TRLYSET", module + port + state);
		}
	},

	/*-----------------------------------------------
	 * I/O
	 *-----------------------------------------------
	 */
	setIO: function (id, module, port, state) {
		if (!(port instanceof Array)) port = [ port ];
		var s = module || "";
		state = (state === 0) ? ":0" : (state instanceof Number) ? ":1" : (state==null || !state.length) ? "" : ":"+state;
		port.forEach(function (p) {
			s += (s.length ? "|":"") + p + state;
		});
		this.message(id, "TIOXSET", s);
	},

	unpackIOStates: function (data) {
		var io = data.split('|'), n = io.length, i, states = {}, modes = {}, info, port;
		for (i = 1; i < n; i++) {
			// Example state string = P01:D:0
			info = io[i];
			port = info.substr(0, 3);
			states[port] = info.substr(6);
			modes[port] = info.substr(4, 1);
		}
		return [states, modes];
	},

	queryIO: function (id, module, callback) {
		if (callback != null) {
			var self = this;
			this.watch([ function (watchID, message) {
				self.unwatch(watchID);
				var m = self.unpack(message), sm = self.unpackIOStates(m[4]);
				callback(watchID, m[0], module, sm[0], sm[1]);
			}, this._packetRegex(id,"RIOXSTA", module)]);
		}
		this.message(id, "QIOXSTA", module || "");
	},

	watchIO: function (id, module, callback) {
		var self = this;
		return this.watch([ function (watchID, message) {
			var m = self.unpack(message), sm = self.unpackIOStates(m[4]);
			callback(watchID, m[0], module, sm[0], sm[1]);
		}, this._packetRegex(id,"RIOX...", module)]);
	},

	/*-----------------------------------------------
	 * Dry Contact Input Only ports (Solo, Nano, etc)
	 *-----------------------------------------------
	 */
	unpackInputStates: function (data) {
		var io = data.split('|'), n = io.length, i, states = {};
		for (i = 0; i < n; i++) {
			states[io[i].substr(0,3)] = io[i].substr(4);
		}
		return states;
	},

	queryInputs: function (id, module, callback) {
		if (callback != null) {
			var self = this;
			this.watch([ function (watchID, message) {
				self.unwatch(watchID);
				var m = self.unpack(message);
				callback(watchID, m[0], module, m[2], self.unpackInputStates(m[4]));
			}, this._packetRegex(id, "R(SOL|NAN)STA", module)]);
		}
		this.message(id, "QCFXSTA", module || "");
	},

	watchInputs: function (id, module, callback) {
		var self = this;
		return this.watch([ function (watchID, message) {
			var m = self.unpack(message);
			callback(watchID, m[0], module, self.unpackInputStates(m[4]));
		}, this._packetRegex(id, "R(SOL|NAN)CHA", module)]);
	},

	/*-----------------------------------------------
	 * IR
	 *-----------------------------------------------
	 */
	sendIR: function (id, port, format, data) {
		//CF.log(id + " TIRXSND" + port + ":" + format + ":" + data);
		this.message(id, "TIRXSND", port + ":" + format + ":" + data);
	},

	watchIR: function (id, port, callback) {
		var self = this;
		return this.watch([ function (watchID, message) {
			var m = self.unpack(message);
			callback(watchID, m[0], m[4].substr(0,3), m[4].substr(4));
		}, this._packetRegex(id, "RIRBRCV", port)]);
	},

	/*-----------------------------------------------
	 * LAN Bridge
	 *-----------------------------------------------
	 */
	sendLAN: function (id, slot, data) {
		this.message(id, "TLANSND", slot + ":" + data);
	}
};