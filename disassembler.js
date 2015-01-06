var STR_PAD_LEFT = 1;
var STR_PAD_RIGHT = 2;
var STR_PAD_BOTH = 3;

function pad(str, len, pad, dir) {

    if (typeof(len) == "undefined") { var len = 0; }
    if (typeof(pad) == "undefined") { var pad = ' '; }
    if (typeof(dir) == "undefined") { var dir = STR_PAD_RIGHT; }

    if (len + 1 >= str.length) {

        switch (dir){

            case STR_PAD_LEFT:
                str = Array(len + 1 - str.length).join(pad) + str;
            break;

            case STR_PAD_BOTH:
                var right = Math.ceil((padlen = len - str.length) / 2);
                var left = padlen - right;
                str = Array(left+1).join(pad) + str + Array(right+1).join(pad);
            break;

            default:
                str = str + Array(len + 1 - str.length).join(pad);
            break;

        } // switch

    }

    return str;

}

function Disassembler(memCtrl) {
	this.memCtrl = memCtrl;
	this.regPC = 0x0000;	// program counter

	this.disassemble = function(startloc, nbytes) {
		var bytecount = 0;
    	this.regPC = startloc;
    
    	do {
    		dissambly = this.opToStr();
    		bytecount += dissambly.numBytes;

        	console.log(dissambly.text);
    	} while (bytecount < nbytes);
	};

	this.opToStr = function() {
    	var numbytes = 0;
    	var startpos = 0;
    	var mem_dump;
    	var opcode = this.memCtrl.getData(this.regPC);
    	var am_string = this.optable[opcode][1];
    
    	// Get the hex address of the opcode and the opcode hex code
    	mem_dump = "$" + this.regPC.toString(16) + ": " + opcode.toString(16);
    	this.regPC = (this.regPC + 1) & 0xFFFF;
    	numbytes++;
    
    	var pos = am_string.indexOf("ADDR", startpos);
    	if (pos != -1) {
        	mem_dump += " " + this.memCtrl.getData(this.regPC).toString(16);
        	mem_dump += " " + this.memCtrl.getData((this.regPC + 1) & 0xFFFF).toString(16);
        	am_string = am_string.replace("ADDR", this.memCtrl.getAddr(this.regPC).toString(16));
        	startpos += 4;
        	this.regPC = (this.regPC + 2) & 0xFFFF;
        	numbytes += 2;
    	}
    	pos = am_string.indexOf("BIT", startpos);
    	if (pos != -1) {
	        var bitStr = (((opcode & 0xF0) >> 4) % 8).toString();
	        am_string = am_string.replace("BIT", bitStr);
	        startpos += 1;
    	}
    	pos = am_string.indexOf("BYTE", startpos);
	    if (pos != -1) {
	        mem_dump +=  " " + this.memCtrl.getData(this.regPC).toString(16);
	        am_string = am_string.replace("BYTE", this.memCtrl.getData(this.regPC).toString(16));
	        startpos += 2;
	        this.regPC = (this.regPC + 1) & 0xFFFF;
	        numbytes++;
	    }
    	pos = am_string.indexOf("BYTE", startpos);
    	if (pos != -1) {
	        mem_dump += " " + this.memCtrl.getData(this.regPC).toString(16);
	        am_string = am_string.replace("BYTE", this.memCtrl.getData(this.regPC).toString(16));
	        this.regPC += (this.regPC + 1) & 0xFFFF;
	        numbytes++;
    	}
    
    	mem_dump = pad(mem_dump, 20, ' ', STR_PAD_RIGHT).toUpperCase();
    	var finalStr = mem_dump + this.optable[opcode][0] + " " + am_string.toUpperCase();
    
    	return {numBytes: numbytes, text: finalStr};
	};

	this.optable = new Array(256);
	this.optable[0x00] = ["BRK", ""];
    this.optable[0x01] = ["ORA", "($BYTE,X)"];
    this.optable[0x02] = ["NOP", ""];
    this.optable[0x03] = ["NOP", ""];
    this.optable[0x04] = ["TSB", "$BYTE"];
    this.optable[0x05] = ["ORA", "$BYTE"];
    this.optable[0x06] = ["ASL", "$BYTE"];
    this.optable[0x07] = ["RMB", "BIT,$BYTE"];
    this.optable[0x08] = ["PHP", ""];
    this.optable[0x09] = ["ORA", "#BYTE"];
    this.optable[0x0A] = ["ASL", "A"];
    this.optable[0x0B] = ["NOP", ""];
    this.optable[0x0C] = ["TSB", "$ADDR"];
    this.optable[0x0D] = ["ORA", "$ADDR"];
    this.optable[0x0E] = ["ASL", "$ADDR"];
    this.optable[0x0F] = ["BBR", "BIT,$BYTE,BYTE"];
    this.optable[0x10] = ["BPL", "BYTE"];
    this.optable[0x11] = ["ORA", "($BYTE),Y"];
    this.optable[0x12] = ["ORA", "($BYTE)"];
    this.optable[0x13] = ["NOP", ""];
    this.optable[0x14] = ["TRB", "$BYTE"];
    this.optable[0x15] = ["ORA", "$BYTE,X"];
    this.optable[0x16] = ["ASL", "$BYTE,X"];
    this.optable[0x17] = ["RMB", "BIT,$BYTE"];
    this.optable[0x18] = ["CLC", ""];
    this.optable[0x19] = ["ORA", "$ADDR,Y"];
    this.optable[0x1A] = ["INA", "A"];
    this.optable[0x1B] = ["NOP", ""];
    this.optable[0x1C] = ["TRB", "$ADDR"];
    this.optable[0x1D] = ["ORA", "$ADDR,X"];
    this.optable[0x1E] = ["ASL", "$ADDR,X"];
    this.optable[0x1F] = ["BBR", "BIT,$BYTE,BYTE"];
    this.optable[0x20] = ["JSR", "$ADDR"];
    this.optable[0x21] = ["AND", "($BYTE,X)"];
    this.optable[0x22] = ["NOP", ""];
    this.optable[0x23] = ["NOP", ""];
    this.optable[0x24] = ["BIT", "$BYTE"];
    this.optable[0x25] = ["AND", "$BYTE"];
    this.optable[0x26] = ["ROL", "$BYTE"];
    this.optable[0x27] = ["RMB", "BIT,$BYTE"];
    this.optable[0x28] = ["PLP", ""];
    this.optable[0x29] = ["AND", "#BYTE"];
    this.optable[0x2A] = ["ROL", "A"];
    this.optable[0x2B] = ["NOP", ""];
    this.optable[0x2C] = ["BIT", "$ADDR"];
    this.optable[0x2D] = ["AND", "$ADDR"];
    this.optable[0x2E] = ["ROL", "$ADDR"];
    this.optable[0x2F] = ["BBR", "BIT,$BYTE,BYTE"];
    this.optable[0x30] = ["BMI", "BYTE"];
    this.optable[0x31] = ["AND", "($BYTE),Y"];
    this.optable[0x32] = ["AND", "($BYTE)"];
    this.optable[0x33] = ["NOP", ""];
    this.optable[0x34] = ["BIT", "$BYTE,X"];
    this.optable[0x35] = ["AND", "$BYTE,X"];
    this.optable[0x36] = ["ROL", "$BYTE,X"];
    this.optable[0x37] = ["RMB", "BIT,$BYTE"];
    this.optable[0x38] = ["SEC", ""];
    this.optable[0x39] = ["AND", "$ADDR,Y"];
    this.optable[0x3A] = ["DEA", "A"];
    this.optable[0x3B] = ["NOP", ""];
    this.optable[0x3C] = ["BIT", "$ADDR,X"];
    this.optable[0x3D] = ["AND", "$ADDR,X"];
    this.optable[0x3E] = ["ROL", "$ADDR,X"];
    this.optable[0x3F] = ["BBR", "BIT,$BYTE,BYTE"];
    this.optable[0x40] = ["RTI", ""];
    this.optable[0x41] = ["EOR", "($BYTE,X)"];
    this.optable[0x42] = ["NOP", ""];
    this.optable[0x43] = ["NOP", ""];
    this.optable[0x44] = ["NOP", ""];
    this.optable[0x45] = ["EOR", "$BYTE"];
    this.optable[0x46] = ["LSR", "$BYTE"];
    this.optable[0x47] = ["RMB", "BIT,$BYTE"];
    this.optable[0x48] = ["PHA", ""];
    this.optable[0x49] = ["EOR", "#BYTE"];
    this.optable[0x4A] = ["LSR", "A"];
    this.optable[0x4B] = ["NOP", ""];
    this.optable[0x4C] = ["JMP", "$ADDR"];
    this.optable[0x4D] = ["EOR", "$ADDR"];
    this.optable[0x4E] = ["LSR", "$ADDR"];
    this.optable[0x4F] = ["BBR", "BIT,$BYTE,BYTE"];
    this.optable[0x50] = ["BVC", "BYTE"];
    this.optable[0x51] = ["EOR", "($BYTE),Y"];
    this.optable[0x52] = ["EOR", "($BYTE)"];
    this.optable[0x53] = ["NOP", ""];
    this.optable[0x54] = ["NOP", ""];
    this.optable[0x55] = ["EOR", "$BYTE,X"];
    this.optable[0x56] = ["LSR", "$BYTE,X"];
    this.optable[0x57] = ["RMB", "BIT,$BYTE"];
    this.optable[0x58] = ["CLI", ""];
    this.optable[0x59] = ["EOR", "$ADDR,Y"];
    this.optable[0x5A] = ["PHY", ""];
    this.optable[0x5B] = ["NOP", ""];
    this.optable[0x5C] = ["NOP", ""];
    this.optable[0x5D] = ["EOR", "$ADDR,X"];
    this.optable[0x5E] = ["LSR", "$ADDR,X"];
    this.optable[0x5F] = ["BBR", "BIT,$BYTE,BYTE"];
    this.optable[0x60] = ["RTS", ""];
    this.optable[0x61] = ["ADC", "($BYTE,X)"];
    this.optable[0x62] = ["NOP", ""];
    this.optable[0x63] = ["NOP", ""];
    this.optable[0x64] = ["STZ", "$BYTE"];
    this.optable[0x65] = ["ADC", "$BYTE"];
    this.optable[0x66] = ["ROR", "$BYTE"];
    this.optable[0x67] = ["RMB", "BIT,$BYTE"];
    this.optable[0x68] = ["PLA", ""];
    this.optable[0x69] = ["ADC", "#BYTE"];
    this.optable[0x6A] = ["ROR", "A"];
    this.optable[0x6B] = ["NOP", ""];
    this.optable[0x6C] = ["JMP", "($ADDR)"];
    this.optable[0x6D] = ["ADC", "$ADDR"];
    this.optable[0x6E] = ["ROR", "$ADDR"];
    this.optable[0x6F] = ["BBR", "BIT,$BYTE,BYTE"];
    this.optable[0x70] = ["BVS", "BYTE"];
    this.optable[0x71] = ["ADC", "($BYTE),Y"];
    this.optable[0x72] = ["ADC", "($BYTE)"];
    this.optable[0x73] = ["NOP", ""];
    this.optable[0x74] = ["STZ", "$BYTE,X"];
    this.optable[0x75] = ["ADC", "$BYTE,X"];
    this.optable[0x76] = ["ROR", "$BYTE,X"];
    this.optable[0x77] = ["RMB", "BIT,$BYTE"];
    this.optable[0x78] = ["SEI", ""];
    this.optable[0x79] = ["ADC", "$ADDR,Y"];
    this.optable[0x7A] = ["PLY", ""];
    this.optable[0x7B] = ["NOP", ""];
    this.optable[0x7C] = ["JMP", "($ADDR,X)"];
    this.optable[0x7D] = ["ADC", "$ADDR,X"];
    this.optable[0x7E] = ["ROR", "$ADDR,X"];
    this.optable[0x7F] = ["BBR", "BIT,$BYTE,BYTE"];
    this.optable[0x80] = ["BRA", "BYTE"];
    this.optable[0x81] = ["STA", "($BYTE,X)"];
    this.optable[0x82] = ["NOP", ""];
    this.optable[0x83] = ["NOP", ""];
    this.optable[0x84] = ["STY", "$BYTE"];
    this.optable[0x85] = ["STA", "$BYTE"];
    this.optable[0x86] = ["STX", "$BYTE"];
    this.optable[0x87] = ["SMB", "BIT,$BYTE"];
    this.optable[0x88] = ["DEY", ""];
    this.optable[0x89] = ["BIT", "#BYTE"];
    this.optable[0x8A] = ["TXA", ""];
    this.optable[0x8B] = ["NOP", ""];
    this.optable[0x8C] = ["STY", "$ADDR"];
    this.optable[0x8D] = ["STA", "$ADDR"];
    this.optable[0x8E] = ["STX", "$ADDR"];
    this.optable[0x8F] = ["BBS", "BIT,$BYTE,BYTE"];
    this.optable[0x90] = ["BCC", "BYTE"];
    this.optable[0x91] = ["STA", "($BYTE),Y"];
    this.optable[0x92] = ["STA", "($BYTE)"];
    this.optable[0x93] = ["NOP", ""];
    this.optable[0x94] = ["STY", "$BYTE,X"];
    this.optable[0x95] = ["STA", "$BYTE,X"];
    this.optable[0x96] = ["STX", "$BYTE,Y"];
    this.optable[0x97] = ["SMB", "BIT,$BYTE"];
    this.optable[0x98] = ["TYA", ""];
    this.optable[0x99] = ["STA", "$ADDR,Y"];
    this.optable[0x9A] = ["TXS", ""];
    this.optable[0x9B] = ["NOP", ""];
    this.optable[0x9C] = ["STZ", "$ADDR"];
    this.optable[0x9D] = ["STA", "$ADDR,X"];
    this.optable[0x9E] = ["STZ", "$ADDR,X"];
    this.optable[0x9F] = ["BBS", "BIT,$BYTE,BYTE"];
    this.optable[0xA0] = ["LDY", "#BYTE"];
    this.optable[0xA1] = ["LDA", "($BYTE,X)"];
    this.optable[0xA2] = ["LDX", "#BYTE"];
    this.optable[0xA3] = ["NOP", ""];
    this.optable[0xA4] = ["LDY", "$BYTE"];
    this.optable[0xA5] = ["LDA", "$BYTE"];
    this.optable[0xA6] = ["LDX", "$BYTE"];
    this.optable[0xA7] = ["SMB", "BIT,$BYTE"];
    this.optable[0xA8] = ["TAY", ""];
    this.optable[0xA9] = ["LDA", "#BYTE"];
    this.optable[0xAA] = ["TAX", ""];
    this.optable[0xAB] = ["NOP", ""];
    this.optable[0xAC] = ["LDY", "$ADDR"];
    this.optable[0xAD] = ["LDA", "$ADDR"];
    this.optable[0xAE] = ["LDX", "$ADDR"];
    this.optable[0xAF] = ["BBS", "BIT,$BYTE,BYTE"];
    this.optable[0xB0] = ["BCS", "BYTE"];
    this.optable[0xB1] = ["LDA", "($BYTE),Y"];
    this.optable[0xB2] = ["LDA", "($BYTE)"];
    this.optable[0xB3] = ["NOP", ""];
    this.optable[0xB4] = ["LDY", "$BYTE,X"];
    this.optable[0xB5] = ["LDA", "$BYTE,X"];
    this.optable[0xB6] = ["LDX", "$BYTE,Y"];
    this.optable[0xB7] = ["SMB", "BIT,$BYTE"];
    this.optable[0xB8] = ["CLV", ""];
    this.optable[0xB9] = ["LDA", "$ADDR,Y"];
    this.optable[0xBA] = ["TSX", ""];
    this.optable[0xBB] = ["NOP", ""];
    this.optable[0xBC] = ["LDY", "$ADDR,X"];
    this.optable[0xBD] = ["LDA", "$ADDR,X"];
    this.optable[0xBE] = ["LDX", "$ADDR,Y"];
    this.optable[0xBF] = ["BBS", "BIT,$BYTE,BYTE"];
    this.optable[0xC0] = ["CPY", "#BYTE"];
    this.optable[0xC1] = ["CMP", "($BYTE,X)"];
    this.optable[0xC2] = ["NOP", ""];
    this.optable[0xC3] = ["NOP", ""];
    this.optable[0xC4] = ["CPY", "$BYTE"];
    this.optable[0xC5] = ["CMP", "$BYTE"];
    this.optable[0xC6] = ["DEC", "$BYTE"];
    this.optable[0xC7] = ["SMB", "BIT,$BYTE"];
    this.optable[0xC8] = ["INY", ""];
    this.optable[0xC9] = ["CMP", "#BYTE"];
    this.optable[0xCA] = ["DEX", ""];
    this.optable[0xCB] = ["WAI", ""];
    this.optable[0xCC] = ["CPY", "$ADDR"];
    this.optable[0xCD] = ["CMP", "$ADDR"];
    this.optable[0xCE] = ["DEC", "$ADDR"];
    this.optable[0xCF] = ["BBS", "BIT,$BYTE,BYTE"];
    this.optable[0xD0] = ["BNE", "BYTE"];
    this.optable[0xD1] = ["CMP", "($BYTE),Y"];
    this.optable[0xD2] = ["CMP", "($BYTE)"];
    this.optable[0xD3] = ["NOP", ""];
    this.optable[0xD4] = ["NOP", ""];
    this.optable[0xD5] = ["CMP", "$BYTE,X"];
    this.optable[0xD6] = ["DEC", "$BYTE,X"];
    this.optable[0xD7] = ["SMB", "BIT,$BYTE"];
    this.optable[0xD8] = ["CLD", ""];
    this.optable[0xD9] = ["CMP", "$ADDR,Y"];
    this.optable[0xDA] = ["PHX", ""];
    this.optable[0xDB] = ["STP", ""];
    this.optable[0xDC] = ["NOP", ""];
    this.optable[0xDD] = ["CMP", "$ADDR,X"];
    this.optable[0xDE] = ["DEC", "$ADDR,X"];
    this.optable[0xDF] = ["BBS", "BIT,$BYTE,BYTE"];
    this.optable[0xE0] = ["CPX", "#BYTE"];
    this.optable[0xE1] = ["SBC", "($BYTE,X)"];
    this.optable[0xE2] = ["NOP", ""];
    this.optable[0xE3] = ["NOP", ""];
    this.optable[0xE4] = ["CPX", "$BYTE"];
    this.optable[0xE5] = ["SBC", "$BYTE"];
    this.optable[0xE6] = ["INC", "$BYTE"];
    this.optable[0xE7] = ["SMB", "BIT,$BYTE"];
    this.optable[0xE8] = ["INX", ""];
    this.optable[0xE9] = ["SBC", "#BYTE"];
    this.optable[0xEA] = ["NOP", ""];
    this.optable[0xEB] = ["NOP", ""];
    this.optable[0xEC] = ["CPX", "$ADDR"];
    this.optable[0xED] = ["SBC", "$ADDR"];
    this.optable[0xEE] = ["INC", "$ADDR"];
    this.optable[0xEF] = ["BBS", "BIT,$BYTE,BYTE"];
    this.optable[0xF0] = ["BEQ", "BYTE"];
    this.optable[0xF1] = ["SBC", "($BYTE),Y"];
    this.optable[0xF2] = ["SBC", "($BYTE)"];
    this.optable[0xF3] = ["NOP", ""];
    this.optable[0xF4] = ["NOP", ""];
    this.optable[0xF5] = ["SBC", "$BYTE,X"];
    this.optable[0xF6] = ["INC", "$BYTE,X"];
    this.optable[0xF7] = ["SMB", "BIT,$BYTE"];
    this.optable[0xF8] = ["SED", ""];
    this.optable[0xF9] = ["SBC", "$ADDR,Y"];
    this.optable[0xFA] = ["PLX", ""];
    this.optable[0xFB] = ["NOP", ""];
    this.optable[0xFC] = ["NOP", ""];
    this.optable[0xFD] = ["SBC", "$ADDR,X"];
    this.optable[0xFE] = ["INC", "$ADDR,X"];
    this.optable[0xFF] = ["BBS", "BIT,$BYTE,BYTE"];
}