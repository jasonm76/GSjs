
function DebugMemController() {
	this.in_port = 0xBFF0;
	this.out_port = 0xBFF0;

	// Create the memory bank and fill it with 0's
	this.bank0 = new Array(65536);
	var i = 0;
	while (i < 65536) { this.bank0[i] = 0x00; i++; }
}

// Return an 8-bit chuck of data at a given address
DebugMemController.prototype.getData = function(addr) {
	return this.bank0[addr];
};

// Return a 16-bit chuck of data at a given address
DebugMemController.prototype.getAddr = function(addr) {
	return this.bank0[addr] | this.bank0[(addr+1) & 0xFFFF] << 8;
};

// Assign an 8-bit value to a given address
DebugMemController.prototype.setData = function(addr, value) {
	this.bank0[addr] = value;
    if (addr === this.out_port) {
    	if (value !== 10 && value !== 13) {
     		document.getElementById("output").innerHTML += String.fromCharCode(value);
     	} else {
     		document.getElementById("output").innerHTML += '<br />';
     	}
    }
};

// Load a block of data in memory starting at addr
DebugMemController.prototype.loadData = function(addr, data) {
	var end_data = data.length;
	if (end_data > (65536 - addr)) {
		end_data = 65536 - addr;
	}

	// Copy the data into bank 0
	var isrc = 0;
	while(isrc < end_data) { this.bank0[addr+isrc] = data[isrc]; isrc++; }
};

// Return an array specified number of bytes starting at addr
DebugMemController.prototype.dumpData = function(addr, nbytes) {
	var end_addr = addr + nbytes;
	if (end_addr > 65536) {
		// truncate the data
		end_addr = 65536;
	}
	
	return this.bank0.slice(addr, end_addr);
};