
function Monitor(cpu) {
	this.cpu = cpu;

	this.getStatusStr = function() {
		var status;
		status  = "PC=" + this.cpu.regPC().toString(16);
	    status += "  A=" + this.cpu.regA().toString(16);
	    status += "  X=" + this.cpu.regX().toString(16);
	    status += "  Y=" + this.cpu.regY().toString(16);
	    status += "  SP=01" + this.cpu.regSP().toString(16);
	    status += "  SR=";
	    status = status.toUpperCase();

	    if (this.cpu.regSR().N) { status += "N"; } else { status += "n"; }
	    if (this.cpu.regSR().V) { status += "V1"; } else { status += "v1"; }
	    if (this.cpu.regSR().B) { status += "B"; } else { status += "b"; }
	    if (this.cpu.regSR().D) { status += "D"; } else { status += "d"; }
	    if (this.cpu.regSR().I) { status += "I"; } else { status += "i"; }
	    if (this.cpu.regSR().Z) { status += "Z"; } else { status += "z"; }
	    if (this.cpu.regSR().C) { status += "C"; } else { status += "c"; }
	    
	    status += " (" + this.cpu.regSR().get().toString(16).toUpperCase() + ")";
	    status += ", cycle = " + this.cpu.cycle().toString();

	    return status;	
	};
}