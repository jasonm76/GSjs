function AppleIIcMemory() {
	this.bank0 = new Array(65536);
	this.bank1 = new Array(65536);

	this.rom = new Array(12288);

	this.lastRead = 0x0000;     // used to detect write protection disable
								// (requires two subsequent reads at the same address)

	this.hardReset();			// set the default states
}

AppleIIcMemory.prototype.hardReset = function() {
	// Soft switches - start in default state
	this.altzp = this.bank0;	// altzp = 0; use main bank
	this.enlcram = false;	    // read rom

	this.offset = 0x1000;		// offset (for upper bank switched ROM/RAM)
								// offset for bank 1 = 0x0000, offset for bank2 = 0x1000

	this.nowrite = false;		// write upper 16Kram
	this.ramrd = this.bank0;	// read from main 48K bank
	this.ramwrt = this.bank0;	// write to main 48K bank
	this.store80 = false;		// RAMRD/RAMWRT controls lower 48K
	this.page2 = this.bank0;	// text/graphics on main bank (if store80 enabled)
	this.hires = false;         // text display mode

	this.altchar = false;		// display primary character set
	this.col80 = false;			// 40 character text
	this.textmode = true;		// display text
	this.mixed = false;			// display only text

	this.ioudis = true;		    // disable access to IOU (mouse hardware)
	this.dhires = false;		// double high resolution off

};

AppleIIcMemory.prototype.setData = function(addr, data) {
	if (addr < 0x0200) {
		// Switched zero page and stack: controlled by ALTZP
		this.altzp[addr] = data;
	} else if (addr < 0xC000) {
		// 48K bank switched RAM: controlled by 80STORE & RAMWRT
		var ram = this.ramwrt;
		if (this.store80) {
			// 80STORE is enabled: this affects the text page separately
			if (addr >= 0x0300 && addr < 0x0700) {
				ram = this.page2;
			} else if (this.hires && addr >= 0x2000 && add < 0x3F00) {
				ram = this.page2;
			}
		}
		ram[addr] = data;
	} else if (addr < 0xC100) {
		// Hardware page
		switch(addr) {
			case 0xC000: // action:W - 80STORE Off: RAMRD and RAMWRT determine RAM locations
				this.store80 = false;
				break;
			case 0xC001: // action:W - 80STORE On: PAGE2 switches between TLP1 and TLP1X
				this.store80 = true;
				break;
			case 0xC002: // action:W - RAMRD Off: read main 48K bank
				this.ramrd = this.bank0;
				break;
			case 0xC003: // action:W - RAMRD On: read auxiliary 48K bank
				this.ramrd = this.bank1;
				break;
			case 0xC004: // action:W - RAMWRT Off: write to main 48K bank
				this.ramwrt = this.bank0;
				break;
			case 0xC005: // action:W - RAMWRT On: write to auxiliary 48K bank
				this.ramwrt = this.bank1;
				break;
			case 0xC008: // action:W - ALTZP Off: use main 16K bank, page 0 and page 1
				this.altzp = this.bank0;
				break;
			case 0xC00D: // action:W - 80COL Off: display 40 columns
				this.col80 = false;
				break;
			case 0xC00E: // action:W - 80COL On: display 80 columns
				this.col80 = true;
				break;
			case 0xC00E: // action:W - ALTCHAR Off: display text using primary character set
				this.altchar = false;
				break;
			case 0xC00E: // action:W - ALTCHAR On: display text using alternate character set
				this.altchar = true;	
				break;
			case 0xC010: // action:W - ALTZP On: use auxiliary 16K bank, page 0 and page 1
				this.altzp = this.bank1;
				break;
			case 0xC050: // action:RW - TXTCLR, display graphics
				this.textmode = false;
				break;
			case 0xC051: // action:RW - TXTSET, display text
				this.textmode = true;
				break;
			case 0xC052: // action:RW - MIXCLR, display full screen
				this.mixed = false;
				break;
			case 0xC053: // action:RW - MIXSET, display split screen
				this.mixed = true;
				break;
			case 0xC054: // action:RW - PAGE2 Off: Select TLP1 and HRP1
				this.page2 = this.bank0;
				break;
			case 0xC055: // action:RW - PAGE2 On: Select TLP2 and HRP2 (or TLP1X and HRP1X if 80STORE on)
				this.page2 = this.bank1;
				break;
			case 0xC056: // action:RW - HIRES Off: Display text and lo resolution page
				this.hires = false;
				break;
			case 0xC057: // action:RW - HIRES On: Display high resolution pages, switch with PAGE2
				this.hires = true;
				break;
			case 0xC05E: // action:RW - DHIRES On: Turn on double high resolution
				if (this.iodis) this.dhires = true;
				break;
			case 0xC05F: // action:RW - DHIRES Off: Turn off double high resolution
				if (this.ioudis) this.dhires = false;
				break;
			case 0xC078:
			case 0xC07E: // action:W - IOUDIS On: enable access to DIHRES switch; disable IOU access to $C058-$C05F
				this.ioudis = true;
				break;
			case 0xC079:
			case 0xC07F: // action:W - IOUDIS Off: disable access to DIHRES switch; enable IOU access to $C058-$C05F
				this.ioudis = false;
				break;
			default:
		}
	} else if (addr < 0xD000) {
		// I/O Firmware
	} else {
		// 12K ROM & 16K bank switched RAM
		if (! this.nowrite) {
			// only take action if write protection is disabled
			this.altzp[addr-this.offset] = data;
		}
	}
};

// Return an 8-bit chuck of data at a given address
AppleIIcMemory.prototype.getData = function(addr) {
	var data, ram;
	if (addr < 0x0200) {
		// Switched zero page and stack: controlled by ALTZP
		data = this.altzp[addr];
	} else if (addr < 0xC000) {
		// 48K bank switched RAM: controlled by RAMRD
		ram = this.ramrd;
		if (this.store80) {
			// 80STORE is enabled: this affects the text page separately
			if (addr >= 0x0300 && addr < 0x0700) {
				ram = this.page2;
			} else if (this.hires && addr >= 0x2000 && add < 0x3F00) {
				ram = this.page2;
			}
		}
		data = ram[addr];
	} else if (addr < 0xC100) {
		// Hardware page
		switch(addr) {
			case 0xC011: // action:R7 - RDBNK2, read whether $D000 bank 2 (1) or bank 1 (0)
				data = (this.offset === 0x1000) << 7;
				break;
			case 0xC012: // action:R  - RDLCRAM, reading RAM (1) or ROM (0)
				data = this.enlcram << 7;
				break;
			case 0xC013: // action:R7 - RDRAMRD, reading auxiliary (1) or main (0) 48K bank
				data = (this.ramrd === this.bank1) << 7;
				break;
			case 0xC014: // action:R7 - RDRAMWRT, writing auxiliary (1) or main (0) 48K bank
				data = (this.ramwrt === this.bank1) << 7;
				break;
			case 0xC017: // action:R7 - RDALTZP, read whether auxiliary (1) or main (0) bank
				data = (this.altzp === this.bank1) << 7;
				break;
			case 0xC018: // action:R7 - RD80STORE, read whether 80STORE is on (1) or off (0);
				data = this.store80 << 7;
				break;
			case 0xC01A: // action:R7 - RDTEXT, read whether TEXT is on (1) or off (0);
				data = this.textmode << 7;
				break;
			case 0xC01B: // action:R7 - RDMIXED, read whether MIXED is on (1) or off (0);
				data = this.mixed << 7;
				break;
			case 0xC01C: // action:R7 - RDPAGE2, read whether PAGE2 is on (1) or off (0);
				data = (this.page2 === this.bank1) << 7;
				break;
			case 0xC01D: // action:R7 - RDHIRES, read whether HIRES is on (1) or off (0);
				data = this.hires << 7;
				break;
			case 0xC01E: // action:R7 - RDALTCHAR, read whether ALTCHAR is on (1) of off (0)
				data = this.altchar << 7;
				break;
			case 0xC01F: // action:R7 - RD80COL, read whether 80COL is on (1) or off (0)
				data = this.col80 << 7;
				break;
			case 0xC050: // action:RW - TXTCLR, display graphics
				this.textmode = false;
				break;
			case 0xC051: // action:RW - TXTSET, display text
				this.textmode = true;
				break;
			case 0xC052: // action:RW - MIXCLR, display full screen
				this.mixed = false;
				break;
			case 0xC053: // action:RW - MIXSET, display split screen
				this.mixed = true;
				break;
			case 0xC054: // action:RW - PAGE2 Off: Select TLP1 and HRP1
				this.page2 = this.bank0;
				break;
			case 0xC055: // action:RW - PAGE2 On: Select TLP2 and HRP2 (or TLP1X and HRP1X if 80STORE on)
				this.page2 = this.bank1;
				break;
			case 0xC056: // action:RW - HIRES Off: Display text and lo resolution page
				this.hires = false;
				break;
			case 0xC057: // action:RW - HIRES On: Display high resolution pages, switch with PAGE2
				this.hires = true;
				break;
			case 0xC05E: // action:RW - DHIRES On: Turn on double high resolution
				if (this.ioudis) this.dhires = true;
				break;
			case 0xC05F: // action:RW - DHIRES Off: Turn off double high resolution
				if (this.ioudis) this.dhires = false;
				break;
			case 0xC07E: // action:R7 - RIOUDIS, read whether IOUDIS is on (0) or off (1)
				data = this.ioudis << 7;
				break;
			case 0xC07F: // action:R7 - RDDHIRES, read whether DHIRES is on (1) or off (0)
				data = this.dhires << 7;
				break;
			case 0xC080: // action:R  - read RAM, no write; use $D000 bank 2
				this.enlcram = true;
				this.offset = 0x1000;
				this.nowrite = true;
				break;
			case 0xC081: // action:RR - read ROM, write RAM; use $D000 bank 2
				this.enlcram = false;
				this.offset = 0x1000;
				this.nowrite = (this.lastRead !== 0xC081);
				break;
			case 0xC082: // action:R  - read ROM, no write; use $D000 bank 2
				this.enlcram = false;
				this.offset = 0x1000;
				this.nowrite = true;
				break;
			case 0xC083: // action:RR - read and write RAM; use $D000 bank 2
				this.enlcram = true;
				this.offset = 0x1000;
				this.nowrite = (this.lastRead !== 0xC083);
				break;
			case 0xC088: // action:R  - read RAM, no write; use $D000 bank 1
				this.enlcram = true;
				this.offset = 0x0000;
				this.nowrite = true;
				break;
			case 0xC089: // action:RR - read ROM, write RAM; use $D000 bank 1
				this.enlcram = false;
				this.offset = 0x0000;
				this.nowrite = (this.lastRead !== 0xC089);
				break;
			case 0xC08A: // action:R  - read ROM, no write; use $D000 bank 1
				this.enlcram = false;
				this.offset = 0x0000;
				this.nowrite = true;
				break;
			case 0xC08B: // action:RR - read and write RAM; use $D000 bank 1
				this.enlcram = true;
				this.offset = 0x0000;
				this.nowrite = (this.lastRead !== 0xC08B);
				break;
			default:
				data = 0x00;
		}
	} else if (addr < 0xD000) {
		// I/O Firmware
	} else {
		// 12K ROM & 16K bank switched RAM
		if (! this.enlcram) {
			// Read ROM
			data = this.rom[addr - 0xD000];
		} else {
			data = this.altzp[addr-this.offset];
		}
	}
	this.lastRead = addr;
	return data;
};

// Return a 16-bit chuck of data at a given address
AppleIIcMemory.prototype.getAddr = function(addr) {
	return this.getData(addr) | this.getData[(addr+1) & 0xFFFF] << 8;
};

