// A cross-browser requestAnimationFrame
// See https://hacks.mozilla.org/2011/08/animating-with-javascript-from-setinterval-to-requestanimationframe/
var requestAnimFrame = (function(){
    return window.requestAnimationFrame       ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame    ||
        window.oRequestAnimationFrame      ||
        window.msRequestAnimationFrame     ||
        function(callback){
            window.setTimeout(callback, 1000 / 60);
        };
})();


var mem64k = new DebugMemController();
var cpu = Cpu(mem64k);
var dis = new Disassembler(mem64k);
var mon = new Monitor(cpu);

var intervalId;	// id for interval timer

var print_flag = true;
var old_irq_pin;
var old_nmi_pin;

var statusElem;


// The main game loop
var lastTime;
function main() {
	console.log("Inside main");
    var now = Date.now();
    var dt = (now - lastTime) / 1000.0;

    runCPU(dt);
    render();

    lastTime = now;
    requestAnimFrame(main);
}

function init() {
	console.log("Inside init");
	// Create the canvas
	var canvas = document.createElement("canvas");
	var ctx = canvas.getContext("2d");
	canvas.width = 512;
	canvas.height = 480;
	document.getElementById("screen").appendChild(canvas);

	statusElem = document.getElementById("status");
	
	mem64k.loadData(0x0000, resources.get('test6502'));
	cpu.reset();

	old_irq_pin = (mem64k.getData(0xBFFC) & 0x01) > 0;
	old_nmi_pin = ((mem64k.getData(0xBFFC) & 0x02) >> 1) > 0;

	cpu.setPC(0x0400);

	console.log("Press keys to operate CPU:");
	console.log("0) reset");
	console.log("1) NMI");
	console.log("2) IRQ");
	console.log("3) end simulation");
			
	print_flag = false;
			
	statusElem.innerHTML = "Running";
	lastTime = Date.now;
	main();
}

function runCPU(dt) {
	var numCycles = dt*1022727;
    if (print_flag) {
        console.log(mon.getStatusStr());
        dis.disassemble(cpu.regPC());
    }
    cpu_start = Date.now();
    cpu.run(numCycles);
    cpu_dt = (Date.now() - cpu_start) / 1000.0;
	console.log('CPU time = ' + cpu_dt);
    
    var irq_pin = (mem64k.getData(0xBFFC) & 0x01) > 0;
    var nmi_pin = ((mem64k.getData(0xBFFC) & 0x02) >> 1) > 0;
    
    if (irq_pin != old_irq_pin) {
        console.log("Changed IRQ pin: " + old_irq_pin + " --> " + irq_pin);
        old_irq_pin = irq_pin;
        cpu.irq_pin = irq_pin;
    }
    if (nmi_pin != old_nmi_pin) {
        console.log("Changed NMI pin: " + old_nmi_pin + " --> " + nmi_pin);
        old_nmi_pin = nmi_pin;
        cpu.nmi_pin = nmi_pin;
    }
}

function render() {
	// Nothing yet
}

document.onkeypress = function (e) {
    e = e || window.event;
    if (e.keyCode === 51) { 
    	clearInterval(intervalId); 
    	console.log("STOPPED"); 
    	statusElem.innerHTML = "STOPPED";
    }
    else if (e.keyCode === 48) { cpu.reset(); statusElem.innerHTML = "Running (" + intervalId + "): ";}
    else if(e.keyCode === 49) { cpu.nmi(); statusElem.innerHTML += "1 ";}
    else if(e.keyCode === 50) { cpu.irq(); statusElem.innerHTML += "2 ";}
    else if(e.keyCode >= 0 && e.keyCode <= 255) {
    	mem64k.setData(mem64k.in_port, e.keyCode);
    }
};

$(document).ready(function() {
	console.log("Document ready");
	$.when(
		resources.loadBinary('/tests/6502_functional_test.bin', 'test6502')
		
	).then(function() {
		init();
	}, function() {
		console.log("Resource not available");
	}) ;
});
