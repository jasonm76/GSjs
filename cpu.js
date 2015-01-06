function StatusRegister()  {
	this.N = false;					 	// bit 7: Negative flag
	this.V = false;						// bit 6: oVerflow flag
	this.R = true;						// bit 5: Reserved flag: hardwired to '1'
	this.B = false;						// bit 4: Break flag
	this.D = false;                     // bit 3: Decimal flag
	this.I = false;		                // bit 2: Interrupt flag
	this.Z = false;						// bit 1: Zero flag
	this.C = false;						// bit 0: Carry flag
}

StatusRegister.prototype.get = function() {
	return (this.N<<7) + (this.V<<6) + 32  + (this.B<<4) + 
		   (this.D<<3) + (this.I<<2) + (this.Z<<1) +  this.C;
};

StatusRegister.prototype.set= function(value) {
	this.N = (value & (1<<7)) > 0; 
	this.V = (value & (1<<6)) > 0; 
	this.B = (value & (1<<4)) > 0;
	this.D = (value & (1<<3)) > 0; 
	this.I = (value & (1<<2)) > 0; 
	this.Z = (value & (1<<1)) > 0;
	this.C = (value & 1) > 0;
};


function Cpu(memCtrl) {
	// Simulates connections to the IRQ and NMI pins. If set to true (HIGH), then
	// IRQ or NMI interrupts will be triggered
	this.irq_pin = false;
	this.nmi_pin = false;

	// Interrupt vector addresses; these are hardwired in the CPU
	var VECTOR_NMI = 0xFFFA;	       // non-maskable interrupt
	var VECTOR_RST = 0xFFFC;	       // reset
	var VECTOR_IRQ = 0xFFFE;	       // interrupt request

	// Registers
	var regA = 0x00;			       // Accumulator
	var regX = 0x00;			       // X-index register
	var regY = 0x00;		           // Y-index register
	var regSP = 0xFF;			       // Stack pointer
	var regPC = 0x00;			       // Program counter
	regSR = new StatusRegister(); // Status register

	// State information
	var cycle = 0;					   // CPU cycle counter
	var opcode = 0x00;                 // current opcode
	var PCinc = 0x00;				   // amount to increase PC at end of cycle
	var waiting = false;			   // CPU waiting (due to WAI)
	var stopped = false;               // CPU halted (due to STP)

	// Helper functions
	function operandAddr() {    // Address of LSB of operand
		return (regPC + 1) & 0xFFFF;	
	}
	function updateNZ(data) {   // Update the N and Z flags
		regSR.Z = (data === 0);        // Z flag true if data == 0
    	regSR.N = (data & 0x80) > 0;   // N flag true if bit 7 = 1;
	} 
	function pushStack(data) {  // Push data onto stack
		var addr = (0x01 << 8) | regSP;
    	memCtrl.setData(addr, data);
    	regSP = (regSP - 1) & 0xFF;
	}
	function pullStack() {	   // Pull data from stack
		regSP = (regSP + 1) & 0xFF;
    	var addr = (0x01 << 8) | regSP;
    	return memCtrl.getData(addr);
	}
	function pushStackAddr(addr) { // Push 16-bit address onto stack
		pushStack((addr & 0xFF00) >> 8);    // push high byte
    	pushStack(addr & 0x00FF);           // push low byte
	}
	function pullStackAddr() {  // Pull 16-bit address from stack
		var lo = pullStack();          // pull low byte
    	var hi = pullStack();          // pull high byte
    	return lo + (hi << 8);
	}
	function checkBranch(addr, condition) { // check if we can do a branch
		if (condition) {
	        // do the branch
	        cycle++;
	        if ((regPC & 0xFF00) != (addr & 0xFF00))
	            cycle++;    // add a cycle if PB crossed
	        regPC = addr;
    	}
	}

	// Cycle lookup table
	var opcycles =
       [7,	6,	2,	1,	5,	3,	5,	5,	3,	2,	2,	1,	6,	4,	6,	5,
        2,	5,	5,	1,	5,	4,	6,	5,	2,	4,	2,	1,	6,	4,	6,	5,
        6,	6,	2,	1,	3,	3,	5,	5,	4,	2,	2,	1,	4,	4,	6,	5,
        2,	5,	5,	1,	4,	4,	6,	5,	2,	4,	2,	1,	4,	4,	6,	5,
        6,	6,	2,	1,	3,	3,	5,	5,	3,	2,	2,	1,	3,	4,	6,	5,
        2,	5,	5,	1,	4,	4,	6,	5,	2,	4,	3,	1,	8,	4,	6,	5,
        6,	6,	2,	1,	3,	3,	5,	5,	4,	2,	2,	1,	6,	4,	6,	5,
        2,	5,	5,	1,	4,	4,	6,	5,	2,	4,	4,	1,	6,	4,	6,	5,
        3,	6,	2,	1,	3,	3,	3,	5,	2,	2,	2,	1,	4,	4,	4,	5,
        2,	6,	5,	1,	4,	4,	4,	5,	2,	5,	2,	1,	4,	5,	5,	5,
        2,	6,	2,	1,	3,	3,	3,	5,	2,	2,	2,	1,	4,	4,	4,	5,
        2,	5,	5,	1,	4,	4,	4,	5,	2,	4,	2,	1,	4,	4,	4,	5,
        2,	6,	2,	1,	3,	3,	5,	5,	2,	2,	2,	3,	4,	4,	6,	5,
        2,	5,	5,	1,	4,	4,	6,	5,	2,	4,	3,	3,	4,	4,	7,	5,
        2,	6,	2,	1,	3,	3,	5,	5,	2,	2,	2,	1,	4,	4,	6,	5,
        2,	5,	5,	1,	4,	4,	6,	5,	2,	4,	4,	1,	4,	4,	7,	5];


    /** Implicit addressing
	 * Address is implicit in operand
	 * e.g. RTS
	 * 0 bytes
	 */
	var amImplicit = function() {
	    return regPC;
	};

	/** Accumulator addressing
	 * Use accumulator for data
	 * e.g. ASL A
	 * 0 bytes
	 */
	var amAccumulator = function() {
	    return regPC;
	};

	/** Immediate Mode addressing
	 * Address immediately follows opcode
	 * e.g. LDA #$65
	 * 1 byte
	 */
	var amImmediate = function() {
	    PCinc++;
	    return (regPC + 1) & 0xFFFF;
	};

	/** Zero Page addressing
	 * Zero page address is formed by taking next 8-bit value
	 * e.g. LDA $4F
	 * 1 byte
	 */
	var amZeroPage = function() {
	    PCinc++;
	    return memCtrl.getData(operandAddr());
	};

	/** Zero Page, X addressing
	 * Zero page address is formed by taking next 8-bit value and
	 * adding X to it. Address wraps around page $00
	 * e.g. LDA $65,X
	 * 1 byte
	 */
	var amZeroPageX = function() {
	    PCinc++;
	    return (memCtrl.getData(operandAddr()) + regX) & 0x00FF;
	};

	/** Zero Page, Y addressing
	 * Zero page address is formed by taking next 8-bit value and
	 * adding Y to it. Address wraps around page $00
	 * e.g. LDA $5C,Y
	 * 1 byte
	 */
	var amZeroPageY = function() {
	    PCinc++;
	    return (memCtrl.getData(operandAddr()) + regY) & 0x00FF;
	};


	/** Zero Page Indirect addressing
	 * Address is formed by taking zero page address from next 8-bit value
	 * Zero page location is LSB of 16-bit address. Wrap around occurs.
	 * e.g. LDA ($23)
	 * 1 byte
	 */
	var amZPIndirect = function() {
	    PCinc++;
	    var addr = memCtrl.getData(operandAddr());
	    return memCtrl.getData(addr) + (memCtrl.getData(addr+1 & 0x00FF) << 8);
	};

	/** Zero Page Indirect, X addressing
	 * Address is formed by taking zero page address from next 8-bit value
	 * and adding X to it (with wrap around).
	 * Zero page location is LSB of 16-bit address. Wrap around occurs.
	 * e.g. LDA ($D2,X)
	 * 1 byte
	 */
	var amZPIndirectX = function() {
	    PCinc++;
	    var addr = (memCtrl.getData(operandAddr()) + regX) & 0x00FF;
	    return memCtrl.getData(addr) + (memCtrl.getData(addr+1 & 0x00FF) << 8);
	};

	/** Zero Page Indirect, Y addressing
	 * Address is formed by taking zero page address from next 8-bit value
	 * Zero page location is LSB of 16-bit address. Y is added to this value
	 * e.g. LDA ($C1),Y
	 * 1 byte, +1 cycle if PB crossed
	 */
	var amZPIndirectY = function() {
	    PCinc++;
	    var zp_addr = memCtrl.getData(operandAddr());
	    var ind_addr = memCtrl.getData(zp_addr) + (memCtrl.getData((zp_addr+1) & 0x00FF) << 8);
	    var addr = (ind_addr + regY) & 0xFFFF;
	    // check if PB is crossed
	    if ((addr & 0xFF00) != (ind_addr & 0xFF00)) { cycle++; }  
	    return addr;
	};

	/** Zero Page Relative addressing
	 * Zero page address is given by the next 8-bit value, and the 8-bit value
	 * that follows is a signed offset (-128 -> +127)
	 * e.g. BBR0 $23,12
	 * 2 bytes
	 */
	var amZPRelative = function() {
	    PCinc += 2;
	    return memCtrl.getData(operandAddr());
	};

	/** Relative addressing
	 * Signed offset (-128 -> +127) is given by the next 8-bit value
	 * e.g. BEQ -34
	 * 1 byte
	 */
	var amRelative = function() {
	    PCinc++;
	    var offset = memCtrl.getData(operandAddr());
	    if (offset > 127) {
	        return (regPC + (offset - 256)) & 0xFFFF;
	    } else {
	        return (regPC + offset) & 0xFFFF;
	    }
	};

	/** Absolute addressing
	 * Located at address pointed to by next 16-bit memory value
	 * e.g. JMP $872F
	 * 2 bytes
	 */
	var amAbsolute = function() {
	    PCinc += 2;
	    return memCtrl.getAddr(operandAddr());
	};

	/** Absolute, X addressing
	 * Address is formed by taking next 16-bit memory value, and
	 * adding X to it
	 * e.g. JMP $1291,X
	 * 2 bytes, +1 cycle if PB crossed
	 */
	var amAbsoluteX = function() {
	    PCinc += 2;
	    var base_addr = memCtrl.getAddr(operandAddr());
	    var addr = (base_addr + regX) & 0xFFFF;
	    // check if PB is crossed (except for DEC and INC - new for 65C02)
	    if (((addr & 0xFF00) != (base_addr & 0xFF00)) &&
	        (opcode != 0xDE && 0xFE)) { cycle++; }
	    return addr;
	};

	/** Absolute, Y addressing
	 * Address is formed by taking next 16-bit memory value, and
	 * adding Y to it
	 * e.g. JMP $C123,Y
	 * 2 bytes, +1 cycle if PB crossed
	 */
	var amAbsoluteY = function() {
	    PCinc += 2;
	    var base_addr = memCtrl.getAddr(operandAddr());
	    var addr = (base_addr + regY) & 0xFFFF;
	    // check if PB is crossed
	    if ((addr & 0xFF00) != (base_addr & 0xFF00)) { cycle++; }    
	    return addr;
	};

	/** Absolute Indirect addressing
	 * Next 16-bits are the address of another address
	 * e.g. JMP ($4C21)
	 * 2 bytes
	 */
	var amIndirect = function() {
	    PCinc += 2;
	    var addr = memCtrl.getAddr(operandAddr());
	    return memCtrl.getAddr(addr);
	};

	/** Absolute Indirect Indexed addressing
	 * Next 16-bits are added to X, which point to another address
	 * e.g. JMP ($0823,X)
	 * 2 bytes
	 */
	var amAbsIndIndx = function() {
	    PCinc += 2; cycle += 5;
	    var addr = (memCtrl.getAddr(operandAddr()) + regX) & 0xFFFF;
	    return memCtrl.getAddr(addr);
	};

	// Opcode functions
	var opLDA = function(amFn) { regA = memCtrl.getData(amFn()); updateNZ(regA); };
	var opLDX = function(amFn) { regX = memCtrl.getData(amFn()); updateNZ(regX); };
	var opLDY = function(amFn) { regY = memCtrl.getData(amFn()); updateNZ(regY); };
	var opSTA = function(amFn) { memCtrl.setData(amFn(), regA); };
	var opSTX = function(amFn) { memCtrl.setData(amFn(), regX); };
	var opSTY = function(amFn) { memCtrl.setData(amFn(), regY); };
	var opSTZ = function(amFn) { memCtrl.setData(amFn(), 0x00); };
	var opPHA = function(amFn) { pushStack(regA); };
	var opPHX = function(amFn) { pushStack(regX); };
	var opPHY = function(amFn) { pushStack(regY); };
	var opPHP = function(amFn) { regSR.B = true; pushStack(regSR.get()); };
	var opPLA = function(amFn) { regA = pullStack(); updateNZ(regA); };
	var opPLX = function(amFn) { regX = pullStack(); updateNZ(regX); };
	var opPLY = function(amFn) { regY = pullStack(); updateNZ(regY); };
	var opPLP = function(amFn) { regSR.set(pullStack()); regSR.B = true; };
	var opTSX = function(amFn) { regX = regSP; updateNZ(regX); };
	var opTXS = function(amFn) { regSP = regX; };
	var opINA = function(amFn) { regA = (regA+1) & 0xFF; updateNZ(regA); };
	var opINX = function(amFn) { regX = (regX+1) & 0xFF; updateNZ(regX); };
	var opINY = function(amFn) { regY = (regY+1) & 0xFF; updateNZ(regY); };
	var opDEA = function(amFn) { regA = (regA-1) & 0xFF; updateNZ(regA); };
	var opDEX = function(amFn) { regX = (regX-1) & 0xFF; updateNZ(regX); };
	var opDEY = function(amFn) { regY = (regY-1) & 0xFF; updateNZ(regY); };

	var opINC = function(amFn) {
		var addr = amFn();
	    var data = memCtrl.getData(addr);      // retrieve data from memory
	    data = memCtrl.getData(addr);          // 2nd mem read (new for 65C02)
	    data = (data + 1) & 0xFF;
	    memCtrl.setData(addr, data);
	    updateNZ(data);
	};
	var opDEC = function(amFn) {
		var addr = amFn();
	    var data = memCtrl.getData(addr); 	    // retrieve data from memory
	    data = memCtrl.getData(addr);          // 2nd mem read (new for 65C02)
	    data = (data - 1) & 0xFF;
	    memCtrl.setData(addr, data);
	    updateNZ(data);
	};
	var opASL = function(amFn) {
		var addr = amFn();
	    var data = memCtrl.getData(addr);      // retrieve data from memory
	    data = memCtrl.getData(addr);          // 2nd mem read (new for 65C02)
	    regSR.C = (data & 0x80) > 0;           // Get the high bit and put it in the carry flag
	    data = (data << 1) & 0xFF;                  // shift left and mask
	    memCtrl.setData(addr, data);
	    updateNZ(data);
	};
	var opASL_A = function(amFn) {
	    regSR.C = (regA & 0x80) > 0;
	    regA = (regA << 1) & 0xFF;
	    updateNZ(regA);
	};
    var opLSR = function(amFn) {
    	var addr = amFn();
	    var data = memCtrl.getData(addr);      // retrieve data from memory
	    data = memCtrl.getData(addr);          // 2nd mem read (new for 65C02)
	    regSR.C = (data & 0x01) > 0;           // get the low bit and put it in the carry flag
	    data = (data >> 1) & 0xFF;                  // shift right and mask
	    memCtrl.setData(addr, data);
	    updateNZ(data);
	};
	var opLSR_A = function(amFn) {
	    regSR.C = (regA & 0x01) > 0;
	    regA = (regA >> 1) & 0xFF;
	    updateNZ(regA);
	};
	var opROL = function(amFn) {
		var addr = amFn();
	    var data = memCtrl.getData(addr);      // retrieve data from memory
	    data = memCtrl.getData(addr);          // 2nd mem read (new for 65C02)
	    data = (data << 1) | regSR.C;          // shift left and add the carry bit
	    regSR.C = (data & 0x100) > 0;          // get bit-8 and put it in the carry flag
	    data &= 0xFF;                               // mask the data
	    memCtrl.setData(addr, data);
	    updateNZ(data);
	};
	var opROL_A = function(amFn) {
	    regA = (regA << 1) | regSR.C;
	    regSR.C = (regA & 0x100) > 0;
	    regA &= 0xFF;
	    updateNZ(regA);
	};
	var opROR = function(amFn) {
		var addr = amFn();
	    var data = memCtrl.getData(addr);      // retrieve data from memory
	    data = memCtrl.getData(addr);          // 2nd mem read (new for 65C02)
	    var newC = (data & 0x01) > 0;          // get new Carry flag from bit 1
	    data = (data | (regSR.C << 8)) >> 1;   // add existing Carry flag and shift right
	    data &= 0xFF;                          // mask the data
	    regSR.C = newC;                        // set the Carry flag
	    memCtrl.setData(addr, data);
	    updateNZ(data);
	};
	var opROR_A = function(amFn) {
	    var newC = (regA & 0x01) > 0;
	    regA = (regA | (regSR.C << 8)) >> 1;
	    regA &= 0xFF;
	    regSR.C = newC;
	    updateNZ(regA);
	};
	var opAND = function(amFn) { regA = (regA & memCtrl.getData(amFn())) & 0xFF; updateNZ(regA); };
	var opORA = function(amFn) { regA = (regA | memCtrl.getData(amFn())) & 0xFF; updateNZ(regA); };
	var opEOR = function(amFn) { regA = (regA ^ memCtrl.getData(amFn())) & 0xFF; updateNZ(regA); };
	var opBIT = function(amFn) {
	    var data = memCtrl.getData(amFn());
	    var result = data & regA;
	    regSR.Z = (result === 0x00);
	    if (opcode != 0x89) {       // new for 65C02: immediate mode does not affect V and N flags
	        regSR.V = (data & 0x40) > 0;
	        regSR.N = (data & 0x80) > 0;
	    }
	};
	var opCMP = function(amFn) {
	    var data = memCtrl.getData(amFn());
	    regSR.C = (regA >= data);
	    updateNZ((regA - data) & 0xFF);
	};
	var opCPX = function(amFn) {
	    var data = memCtrl.getData(amFn());
	    regSR.C = (regX >= data);
	    updateNZ((regX - data) & 0xFF);
	};
	var opCPY = function(amFn) {
	    var data = memCtrl.getData(amFn());
	    regSR.C = (regY >= data);
	    updateNZ((regY - data) & 0xFF);
	};
	var opTRB = function(amFn) {
		var addr = amFn();
	    var data = memCtrl.getData(addr);
	    var result = data & (regA ^ 0xFF);
	    regSR.Z = (regA & data) === 0;
	    memCtrl.setData(addr, result);
	};
	var opTSB = function(amFn) {
		var addr = amFn();
	    var data = memCtrl.getData(addr);
	    var result = data | regA;
	    regSR.Z = (regA & data) === 0;
	    memCtrl.setData(addr, result);
	};
	var opRMB = function(amFn) {
		var addr = amFn();
	    var bitmask = 1 << (opcode >> 4);
	    var result = memCtrl.getData(addr) & (bitmask ^ 0xFF);
	    memCtrl.setData(addr, result);
	};
	var opSMB = function(amFn) {
		var addr = amFn();
	    var bitmask = 1 << ((opcode >> 4) - 8);
	    var result = memCtrl.getData(addr) | bitmask;
	    memCtrl.setData(addr, result);
	};
	var opADC = function(amFn) {
	    var data = memCtrl.getData(amFn());
	    var result;
	    if (!regSR.D) {
	        result = regA + data + regSR.C;
	    } else {
	        cycle++;    // new for 65C02 to make flags in D mode correct
	        result = (regA & 0x0F) + (data & 0x0F) + regSR.C;
	        if (result >= 0x0A) { result = ((result + 0x06) & 0x0F) + 0x10; }
	        result = (regA & 0xF0) + (data & 0xF0) + result;
	        if (result >= 0xA0) { result += 0x60; }
	    }
	    regSR.C = (result & 0x100) > 0;
	    result &= 0xFF;
	    regSR.V = ((regA^result)&(data^result)&0x80) > 0;
	    regA = result;
	    updateNZ(regA);
	};
	var opSBC = function(amFn) {
	    var data = memCtrl.getData(amFn());
	    var result;
	    if (!regSR.D) {
	        result = regA - data - (1 - regSR.C);
	    } else {
	        cycle++;    // new for 65C02 to make flags in D mode correct
	        result = (regA & 0x0F) - (data & 0x0F) - (1 - regSR.C);
	        if (result < 0) {result = ((result - 0x06) & 0x0F) - 0x10; }
	        result = (regA & 0xF0) - (data & 0xF0) + result;
	        if (result < 0) {result -= 0x60; }
	    }
	    regSR.C = (result >= 0);
	    result &= 0xFF;
	    regSR.V = ((regA^result)&((255-data)^result)&0x80) > 0;
	    regA = result;
	    updateNZ(regA);
	};
	var opJMP = function(amFn) { regPC = amFn(); PCinc = 0; };
	var opJSR = function(amFn) { pushStackAddr((regPC+2) & 0xFFFF); regPC = amFn(); PCinc = 0;};
	var opRTS = function(amFn) { regPC = pullStackAddr(); };
	var opRTI = function(amFn) { this.regSR.set(pullStack()); regSR.B = true; regPC = pullStackAddr(); PCinc = 0;};
	var opBRA = function(amFn) { regPC = amFn(); };
	var opBEQ = function(amFn) { checkBranch(amFn(), regSR.Z); };
	var opBNE = function(amFn) { checkBranch(amFn(), !regSR.Z); };
	var opBCC = function(amFn) { checkBranch(amFn(), !regSR.C); };
	var opBCS = function(amFn) { checkBranch(amFn(), regSR.C); };
	var opBVC = function(amFn) { checkBranch(amFn(), !regSR.V); };
	var opBVS = function(amFn) { checkBranch(amFn(), regSR.V); };
	var opBMI = function(amFn) { checkBranch(amFn(), regSR.N); };
	var opBPL = function(amFn) { checkBranch(amFn(), !regSR.N); };
	var opBBR = function(amFn) {
	    var bitmask = 1 << (opcode >> 4);
	    if ((memCtrl.getData(amFn()) & bitmask) === 0) {
	        var offset = memCtrl.getData((regPC+2) & 0xFFFF);
	        if (offset > 127) {
	            regPC = (regPC + (offset - 256)) & 0xFFFF;
	        } else {
	            regPC = (regPC + offset) & 0xFFFF;
	        }
	    }
	};
	var opBBS = function(amFn) {
	    var bitmask = 1 << ((opcode >> 4) - 8);
	    if ((memCtrl.getData(amFn()) & bitmask) > 0) {
	        var offset = memCtrl.getData((regPC+2) & 0xFFFF);
	        if (offset > 127) {
	            regPC = (regPC + (offset - 256)) & 0xFFFF;
	        } else {
	            regPC = (regPC + offset) & 0xFFFF;
	        }
	    }
	};

	var opCLC = function(amFn) { regSR.C = false; };
	var opCLD = function(amFn) { regSR.D = false; };
	var opCLI = function(amFn) { regSR.I = false; };
	var opCLV = function(amFn) { regSR.V = false; };
	var opSEC = function(amFn) { regSR.C = true; };
	var opSED = function(amFn) { regSR.D = true; };
	var opSEI = function(amFn) { regSR.I = true; };
	var opTAX = function(amFn) { regX = regA; updateNZ(regX); };
	var opTAY = function(amFn) { regY = regA; updateNZ(regY); };
	var opTXA = function(amFn) { regA = regX; updateNZ(regA); };
	var opTYA = function(amFn) { regA = regY; updateNZ(regA); };
	var opNOP = function(amFn) {
	    // Different NOP instructions have different byte sizes
	    // PCinc = 1 by default. This switch statements targets NOPs
	    // with byte sizes greater than 1
	    switch (opcode & 0x0F) {
	        case 0x02:
	        case 0x04:
	            PCinc = 2;
	            break;
	        case 0x0C:
	            PCinc = 3;
	            break;
	        default:
	            PCinc = 1;
	    }
	};

	var opBRK = function(amFn) {
	    pushStackAddr(regPC+2);        // push PC plus 2 (making BRK a 2-byte instruction)
	    regSR.B = true;                     
	    pushStack(regSR.get());        // push SR with B flag set
	    regSR.I = true;                     // set I flag
	    regSR.D = false;                    // clear D flag before jumping (new for 65C02)
	    regPC = memCtrl.getAddr(VECTOR_IRQ);
	    PCinc = 0;
	};

	var opWAI = function(amFn) {
	    regSR.B = true;
	    waiting = true;
	};

	var opSTP = function(amFn) {
	    stopped = true;
	    waiting = true;
	};

	// opcode <-> address mode lookup table
	this.optable = new Array(256);
	this.optable[0x00] = function() {opBRK(amImplicit);};
    this.optable[0x01] = function() {opORA(amZPIndirectX);};
    this.optable[0x02] = function() {opNOP(amImplicit);};
    this.optable[0x03] = function() {opNOP(amImplicit);};
    this.optable[0x04] = function() {opTSB(amZeroPage);};
    this.optable[0x05] = function() {opORA(amZeroPage);};
    this.optable[0x06] = function() {opASL(amZeroPage);};
    this.optable[0x07] = function() {opRMB(amZeroPage);};
    this.optable[0x08] = function() {opPHP(amImplicit);};
    this.optable[0x09] = function() {opORA(amImmediate);};
    this.optable[0x0A] = function() {opASL_A(amAccumulator);};
    this.optable[0x0B] = function() {opNOP(amImplicit);};
    this.optable[0x0C] = function() {opTSB(amAbsolute);};
    this.optable[0x0D] = function() {opORA(amAbsolute);};
    this.optable[0x0E] = function() {opASL(amAbsolute);};
    this.optable[0x0F] = function() {opBBR(amZPRelative);};
    this.optable[0x10] = function() {opBPL(amRelative);};
    this.optable[0x11] = function() {opORA(amZPIndirectY);};
    this.optable[0x12] = function() {opORA(amZPIndirect);};
    this.optable[0x13] = function() {opNOP(amImplicit);};
    this.optable[0x14] = function() {opTRB(amZeroPage);};
    this.optable[0x15] = function() {opORA(amZeroPageX);};
    this.optable[0x16] = function() {opASL(amZeroPageX);};
    this.optable[0x17] = function() {opRMB(amZeroPage);};
    this.optable[0x18] = function() {opCLC(amImplicit);};
    this.optable[0x19] = function() {opORA(amAbsoluteY);};
    this.optable[0x1A] = function() {opINA(amImplicit);};
    this.optable[0x1B] = function() {opNOP(amImplicit);};
    this.optable[0x1C] = function() {opTRB(amAbsolute);};
    this.optable[0x1D] = function() {opORA(amAbsoluteX);};
    this.optable[0x1E] = function() {opASL(amAbsoluteX);};
    this.optable[0x1F] = function() {opBBR(amZPRelative);};
    this.optable[0x20] = function() {opJSR(amAbsolute);};
    this.optable[0x21] = function() {opAND(amZPIndirectX);};
    this.optable[0x22] = function() {opNOP(amImplicit);};
    this.optable[0x23] = function() {opNOP(amImplicit);};
    this.optable[0x24] = function() {opBIT(amZeroPage);};
    this.optable[0x25] = function() {opAND(amZeroPage);};
    this.optable[0x26] = function() {opROL(amZeroPage);};
    this.optable[0x27] = function() {opRMB(amZeroPage);};
    this.optable[0x28] = function() {opPLP(amImplicit);};
    this.optable[0x29] = function() {opAND(amImmediate);};
    this.optable[0x2A] = function() {opROL_A(amAccumulator);};
    this.optable[0x2B] = function() {opNOP(amImplicit);};
    this.optable[0x2C] = function() {opBIT(amAbsolute);};
    this.optable[0x2D] = function() {opAND(amAbsolute);};
    this.optable[0x2E] = function() {opROL(amAbsolute);};
    this.optable[0x2F] = function() {opBBR(amZPRelative);};
    this.optable[0x30] = function() {opBMI(amRelative);};
    this.optable[0x31] = function() {opAND(amZPIndirectY);};
    this.optable[0x32] = function() {opAND(amZPIndirect);};
    this.optable[0x33] = function() {opNOP(amImplicit);};
    this.optable[0x34] = function() {opBIT(amZeroPageX);};
    this.optable[0x35] = function() {opAND(amZeroPageX);};
    this.optable[0x36] = function() {opROL(amZeroPageX);};
    this.optable[0x37] = function() {opRMB(amZeroPage);};
    this.optable[0x38] = function() {opSEC(amImplicit);};
    this.optable[0x39] = function() {opAND(amAbsoluteY);};
    this.optable[0x3A] = function() {opDEA(amImplicit);};
    this.optable[0x3B] = function() {opNOP(amImplicit);};
    this.optable[0x3C] = function() {opBIT(amAbsoluteX);};
    this.optable[0x3D] = function() {opAND(amAbsoluteX);};
    this.optable[0x3E] = function() {opROL(amAbsoluteX);};
    this.optable[0x3F] = function() {opBBR(amZPRelative);};
    this.optable[0x40] = function() {opRTI(amImplicit);};
    this.optable[0x41] = function() {opEOR(amZPIndirectX);};
    this.optable[0x42] = function() {opNOP(amImplicit);};
    this.optable[0x43] = function() {opNOP(amImplicit);};
    this.optable[0x44] = function() {opNOP(amImplicit);};
    this.optable[0x45] = function() {opEOR(amZeroPage);};
    this.optable[0x46] = function() {opLSR(amZeroPage);};
    this.optable[0x47] = function() {opRMB(amZeroPage);};
    this.optable[0x48] = function() {opPHA(amImplicit);};
    this.optable[0x49] = function() {opEOR(amImmediate);};
    this.optable[0x4A] = function() {opLSR_A(amAccumulator);};
    this.optable[0x4B] = function() {opNOP(amImplicit);};
    this.optable[0x4C] = function() {opJMP(amAbsolute);};
    this.optable[0x4D] = function() {opEOR(amAbsolute);};
    this.optable[0x4E] = function() {opLSR(amAbsolute);};
    this.optable[0x4F] = function() {opBBR(amZPRelative);};
    this.optable[0x50] = function() {opBVC(amRelative);};
    this.optable[0x51] = function() {opEOR(amZPIndirectY);};
    this.optable[0x52] = function() {opEOR(amZPIndirect);};
    this.optable[0x53] = function() {opNOP(amImplicit);};
    this.optable[0x54] = function() {opNOP(amImplicit);};
    this.optable[0x55] = function() {opEOR(amZeroPageX);};
    this.optable[0x56] = function() {opLSR(amZeroPageX);};
    this.optable[0x57] = function() {opRMB(amZeroPage);};
    this.optable[0x58] = function() {opCLI(amImplicit);};
    this.optable[0x59] = function() {opEOR(amAbsoluteY);};
    this.optable[0x5A] = function() {opPHY(amImplicit);};
    this.optable[0x5B] = function() {opNOP(amImplicit);};
    this.optable[0x5C] = function() {opNOP(amImplicit);};
    this.optable[0x5D] = function() {opEOR(amAbsoluteX);};
    this.optable[0x5E] = function() {opLSR(amAbsoluteX);};
    this.optable[0x5F] = function() {opBBR(amZPRelative);};
    this.optable[0x60] = function() {opRTS(amImplicit);};
    this.optable[0x61] = function() {opADC(amZPIndirectX);};
    this.optable[0x62] = function() {opNOP(amImplicit);};
    this.optable[0x63] = function() {opNOP(amImplicit);};
    this.optable[0x64] = function() {opSTZ(amZeroPage);};
    this.optable[0x65] = function() {opADC(amZeroPage);};
    this.optable[0x66] = function() {opROR(amZeroPage);};
    this.optable[0x67] = function() {opRMB(amZeroPage);};
    this.optable[0x68] = function() {opPLA(amImplicit);};
    this.optable[0x69] = function() {opADC(amImmediate);};
    this.optable[0x6A] = function() {opROR_A(amAccumulator);};
    this.optable[0x6B] = function() {opNOP(amImplicit);};
    this.optable[0x6C] = function() {opJMP(amIndirect);};
    this.optable[0x6D] = function() {opADC(amAbsolute);};
    this.optable[0x6E] = function() {opROR(amAbsolute);};
    this.optable[0x6F] = function() {opBBR(amZPRelative);};
    this.optable[0x70] = function() {opBVS(amRelative);};
    this.optable[0x71] = function() {opADC(amZPIndirectY);};
    this.optable[0x72] = function() {opADC(amZPIndirect);};
    this.optable[0x73] = function() {opNOP(amImplicit);};
    this.optable[0x74] = function() {opSTZ(amZeroPageX);};
    this.optable[0x75] = function() {opADC(amZeroPageX);};
    this.optable[0x76] = function() {opROR(amZeroPageX);};
    this.optable[0x77] = function() {opRMB(amZeroPage);};
    this.optable[0x78] = function() {opSEI(amImplicit);};
    this.optable[0x79] = function() {opADC(amAbsoluteY);};
    this.optable[0x7A] = function() {opPLY(amImplicit);};
    this.optable[0x7B] = function() {opNOP(amImplicit);};
    this.optable[0x7C] = function() {opJMP(amAbsIndIndx);};
    this.optable[0x7D] = function() {opADC(amAbsoluteX);};
    this.optable[0x7E] = function() {opROR(amAbsoluteX);};
    this.optable[0x7F] = function() {opBBR(amZPRelative);};
    this.optable[0x80] = function() {opBRA(amRelative);};
    this.optable[0x81] = function() {opSTA(amZPIndirectX);};
    this.optable[0x82] = function() {opNOP(amImplicit);};
    this.optable[0x83] = function() {opNOP(amImplicit);};
    this.optable[0x84] = function() {opSTY(amZeroPage);};
    this.optable[0x85] = function() {opSTA(amZeroPage);};
    this.optable[0x86] = function() {opSTX(amZeroPage);};
    this.optable[0x87] = function() {opSMB(amZeroPage);};
    this.optable[0x88] = function() {opDEY(amImplicit);};
    this.optable[0x89] = function() {opBIT(amImmediate);};
    this.optable[0x8A] = function() {opTXA(amImplicit);};
    this.optable[0x8B] = function() {opNOP(amImplicit);};
    this.optable[0x8C] = function() {opSTY(amAbsolute);};
    this.optable[0x8D] = function() {opSTA(amAbsolute);};
    this.optable[0x8E] = function() {opSTX(amAbsolute);};
    this.optable[0x8F] = function() {opBBS(amZPRelative);};
    this.optable[0x90] = function() {opBCC(amRelative);};
    this.optable[0x91] = function() {opSTA(amZPIndirectY);};
    this.optable[0x92] = function() {opSTA(amZPIndirect);};
    this.optable[0x93] = function() {opNOP(amImplicit);};
    this.optable[0x94] = function() {opSTY(amZeroPageX);};
    this.optable[0x95] = function() {opSTA(amZeroPageX);};
    this.optable[0x96] = function() {opSTX(amZeroPageY);};
    this.optable[0x97] = function() {opSMB(amZeroPage);};
    this.optable[0x98] = function() {opTYA(amImplicit);};
    this.optable[0x99] = function() {opSTA(amAbsoluteY);};
    this.optable[0x9A] = function() {opTXS(amImplicit);};
    this.optable[0x9B] = function() {opNOP(amImplicit);};
    this.optable[0x9C] = function() {opSTZ(amAbsolute);};
    this.optable[0x9D] = function() {opSTA(amAbsoluteX);};
    this.optable[0x9E] = function() {opSTZ(amAbsoluteX);};
    this.optable[0x9F] = function() {opBBS(amZPRelative);};
    this.optable[0xA0] = function() {opLDY(amImmediate);};
    this.optable[0xA1] = function() {opLDA(amZPIndirectX);};
    this.optable[0xA2] = function() {opLDX(amImmediate);};
    this.optable[0xA3] = function() {opNOP(amImplicit);};
    this.optable[0xA4] = function() {opLDY(amZeroPage);};
    this.optable[0xA5] = function() {opLDA(amZeroPage);};
    this.optable[0xA6] = function() {opLDX(amZeroPage);};
    this.optable[0xA7] = function() {opSMB(amZeroPage);};
    this.optable[0xA8] = function() {opTAY(amImplicit);};
    this.optable[0xA9] = function() {opLDA(amImmediate);};
    this.optable[0xAA] = function() {opTAX(amImplicit);};
    this.optable[0xAB] = function() {opNOP(amImplicit);};
    this.optable[0xAC] = function() {opLDY(amAbsolute);};
    this.optable[0xAD] = function() {opLDA(amAbsolute);};
    this.optable[0xAE] = function() {opLDX(amAbsolute);};
    this.optable[0xAF] = function() {opBBS(amZPRelative);};
    this.optable[0xB0] = function() {opBCS(amRelative);};
    this.optable[0xB1] = function() {opLDA(amZPIndirectY);};
    this.optable[0xB2] = function() {opLDA(amZPIndirect);};
    this.optable[0xB3] = function() {opNOP(amImplicit);};
    this.optable[0xB4] = function() {opLDY(amZeroPageX);};
    this.optable[0xB5] = function() {opLDA(amZeroPageX);};
    this.optable[0xB6] = function() {opLDX(amZeroPageY);};
    this.optable[0xB7] = function() {opSMB(amZeroPage);};
    this.optable[0xB8] = function() {opCLV(amImplicit);};
    this.optable[0xB9] = function() {opLDA(amAbsoluteY);};
    this.optable[0xBA] = function() {opTSX(amImplicit);};
    this.optable[0xBB] = function() {opNOP(amImplicit);};
    this.optable[0xBC] = function() {opLDY(amAbsoluteX);};
    this.optable[0xBD] = function() {opLDA(amAbsoluteX);};
    this.optable[0xBE] = function() {opLDX(amAbsoluteY);};
    this.optable[0xBF] = function() {opBBS(amZPRelative);};
    this.optable[0xC0] = function() {opCPY(amImmediate);};
    this.optable[0xC1] = function() {opCMP(amZPIndirectX);};
    this.optable[0xC2] = function() {opNOP(amImplicit);};
    this.optable[0xC3] = function() {opNOP(amImplicit);};
    this.optable[0xC4] = function() {opCPY(amZeroPage);};
    this.optable[0xC5] = function() {opCMP(amZeroPage);};
    this.optable[0xC6] = function() {opDEC(amZeroPage);};
    this.optable[0xC7] = function() {opSMB(amZeroPage);};
    this.optable[0xC8] = function() {opINY(amImplicit);};
    this.optable[0xC9] = function() {opCMP(amImmediate);};
    this.optable[0xCA] = function() {opDEX(amImplicit);};
    this.optable[0xCB] = function() {opWAI(amImplicit);};
    this.optable[0xCC] = function() {opCPY(amAbsolute);};
    this.optable[0xCD] = function() {opCMP(amAbsolute);};
    this.optable[0xCE] = function() {opDEC(amAbsolute);};
    this.optable[0xCF] = function() {opBBS(amZPRelative);};
    this.optable[0xD0] = function() {opBNE(amRelative);};
    this.optable[0xD1] = function() {opCMP(amZPIndirectY);};
    this.optable[0xD2] = function() {opCMP(amZPIndirect);};
    this.optable[0xD3] = function() {opNOP(amImplicit);};
    this.optable[0xD4] = function() {opNOP(amImplicit);};
    this.optable[0xD5] = function() {opCMP(amZeroPageX);};
    this.optable[0xD6] = function() {opDEC(amZeroPageX);};
    this.optable[0xD7] = function() {opSMB(amZeroPage);};
    this.optable[0xD8] = function() {opCLD(amImplicit);};
    this.optable[0xD9] = function() {opCMP(amAbsoluteY);};
    this.optable[0xDA] = function() {opPHX(amImplicit);};
    this.optable[0xDB] = function() {opSTP(amImplicit);};
    this.optable[0xDC] = function() {opNOP(amImplicit);};
    this.optable[0xDD] = function() {opCMP(amAbsoluteX);};
    this.optable[0xDE] = function() {opDEC(amAbsoluteX);};
    this.optable[0xDF] = function() {opBBS(amZPRelative);};
    this.optable[0xE0] = function() {opCPX(amImmediate);};
    this.optable[0xE1] = function() {opSBC(amZPIndirectX);};
    this.optable[0xE2] = function() {opNOP(amImplicit);};
    this.optable[0xE3] = function() {opNOP(amImplicit);};
    this.optable[0xE4] = function() {opCPX(amZeroPage);};
    this.optable[0xE5] = function() {opSBC(amZeroPage);};
    this.optable[0xE6] = function() {opINC(amZeroPage);};
    this.optable[0xE7] = function() {opSMB(amZeroPage);};
    this.optable[0xE8] = function() {opINX(amImplicit);};
    this.optable[0xE9] = function() {opSBC(amImmediate);};
    this.optable[0xEA] = function() {opNOP(amImplicit);};
    this.optable[0xEB] = function() {opNOP(amImplicit);};
    this.optable[0xEC] = function() {opCPX(amAbsolute);};
    this.optable[0xED] = function() {opSBC(amAbsolute);};
    this.optable[0xEE] = function() {opINC(amAbsolute);};
    this.optable[0xEF] = function() {opBBS(amZPRelative);};
    this.optable[0xF0] = function() {opBEQ(amRelative);};
    this.optable[0xF1] = function() {opSBC(amZPIndirectY);};
    this.optable[0xF2] = function() {opSBC(amZPIndirect);};
    this.optable[0xF3] = function() {opNOP(amImplicit);};
    this.optable[0xF4] = function() {opNOP(amImplicit);};
    this.optable[0xF5] = function() {opSBC(amZeroPageX);};
    this.optable[0xF6] = function() {opINC(amZeroPageX);};
    this.optable[0xF7] = function() {opSMB(amZeroPage);};
    this.optable[0xF8] = function() {opSED(amImplicit);};
    this.optable[0xF9] = function() {opSBC(amAbsoluteY);};
    this.optable[0xFA] = function() {opPLX(amImplicit);};
    this.optable[0xFB] = function() {opNOP(amImplicit);};
    this.optable[0xFC] = function() {opNOP(amImplicit);};
    this.optable[0xFD] = function() {opSBC(amAbsoluteX);};
    this.optable[0xFE] = function() {opINC(amAbsoluteX);};
    this.optable[0xFF] = function() {opBBS(amZPRelative);};

    // CPU Execution Functions

	// Run the CPU for a given number of cycles
	var run = function(num_cycles) {
		var final_cycle = cycle + num_cycles;
    	// Check for overflow
    	if (final_cycle < cycle) {
        	cycle = 0;
        	final_cycle = num_cycles;
    	}
    
    	while (cycle <= final_cycle && !stopped) {
        	// handle interrupts
        	if (this.irq_pin) { this.irq(); if (cycle > final_cycle) return; }
        	if (this.nmi_pin) { this.nmi(); if (cycle > final_cycle) return; }
        	if (waiting) return;
        
        	opcode = memCtrl.getData(regPC);
        	PCinc = 1; 
        	cycle += opcycles[opcode];
        	
        	// Get the opcode function and addressing mode function from the lookup table
        	optable[opcode]();
        
        	regPC = (regPC + PCinc) & 0xFFFF;
    	}
	};

	// Reset the CPU
	var reset = function() {
		regSR.D = false;
		regSR.I = true;
		regSR.B = true;
		    
		stopped = false;
		waiting = false;
		    
		regPC = memCtrl.getAddr(VECTOR_RST);
		cycle += 7;
	};

	// Interrupt request (via the IRQ pin)
	this.irq = function() {
		// Only do an IRQ interrupt if I flag is clear and the processor isn't stopped
	    // Also, NMI interrupts have priority over IRQ
	    if (! stopped) {
	        waiting = false;                   // Allow execution to continue past WAI, even if the IRQ isn't taken
	        if (!regSR.I && !this.nmi_pin) {
	            pushStackAddr(regPC);     // push PC
	            regSR.B = false;
	            pushStack(regSR.get());   // push SR with B flag clear
	            regSR.I = true;                // set interrupt disable flag
	            regSR.D = false;               // clear D flag before jumping (new for 65C02)
	            regPC = memCtrl.getAddr(VECTOR_IRQ);
	            PCinc = 0;
	            cycle += 7;
	        }
	    }
	};

	// Non-maskable interrupt request (via the NMI pin)
	var nmi = function() {
	// Alway do an IRQ interrupt unless the processor is stopeed
	    if (!stopped) {
	        this.nmi_pin = false;                   // NMI is edge sensitive interrupt
	        waiting = false;
	        pushStackAddr(regPC);         // push PC
	        regSR.B = false;
	        pushStack(regSR.get());        // push SR with B flag clear
	        regSR.I = true;                     // set interrupt disable flag
	        regSR.D = false;                    // clear D flag before jumping (new for 65C02)
	        regPC = memCtrl.getAddr(VECTOR_NMI);
	        PCinc = 0;
	        cycle += 7;
	    }
	};

    return {
		irq_pin: this.irq_pin,
		nmi_pin: this.nmi_pin,

		regA: function() {return regA;},
		regX: function() {return regX;},
		regY: function() {return regY;},
		regSP: function() {return regSP;},
		regPC: function() {return regPC;},
		regSR: function() {return regSR;},

		setA: function(value) {regA = value & 0xFF; },
		setX: function(value) {regX = value & 0xFF; },
		setY: function(value) {regY = value & 0xFF; },
		setSP: function(value) {regSP = value & 0xFF; },
		setPC: function(value) {regPC = value & 0xFFFF; },
		setSR: function(value) {regSR.set(value); },

		cycle: function() {return cycle;},

		run: run,
		reset: reset,
		irq: irq,
		nmi: nmi
	};
}