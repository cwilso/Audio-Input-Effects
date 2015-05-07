var beepGain = null;
var apolloGate = null;

/*function introQuindar(){ playQuindarTone( true );}
function outroQuindar(){ playQuindarTone( false );}

window.addEventListener('load', function() {
	document.getElementById("apollo").addEventListener('mousedown', introQuindar );
	document.getElementById("apollo").addEventListener('mouseup', outroQuindar );
} );
*/
function createApolloEffect() {
	// Step 1: create band limiter with output delay
    // I double up the filters to get a 4th-order filter = faster fall-off
    var lpf1 = audioContext.createBiquadFilter();
    lpf1.type = "lowpass";
    lpf1.frequency.value = 2000.0;
    var lpf2 = audioContext.createBiquadFilter();
    lpf2.type = "lowpass";
    lpf2.frequency.value = 2000.0;
    var hpf1 = audioContext.createBiquadFilter();
    hpf1.type = "highpass";
    hpf1.frequency.value = 500.0;
    var hpf2 = audioContext.createBiquadFilter();
    hpf2.type = "highpass";
    hpf2.frequency.value = 500.0;
    lpf1.connect( lpf2 );
    lpf2.connect( hpf1 );
    hpf1.connect( hpf2 );

    // create delay to make room for the intro beep
    var delay = audioContext.createDelay();
    delay.delayTime.setValueAtTime(0.100, 0);
    delay.connect( wetGain );
    hpf2.connect( delay );

    //Step 2: create the volume tracker to connect to the beeper
	var volumeprocessor = audioContext.createScriptProcessor(512);
	volumeprocessor.onaudioprocess = volumeAudioProcess;

	var zeroGain = audioContext.createGain();
	zeroGain.gain.setValueAtTime(0,0);
	zeroGain.connect(audioContext.destination);
	volumeprocessor.connect(zeroGain);

    //Step 3: create the noise gate
    var inputNode = audioContext.createGain();
    var rectifier = audioContext.createWaveShaper();
    ngFollower = audioContext.createBiquadFilter();
    ngFollower.type = "lowpass";
    ngFollower.frequency.value = 10.0;

    var curve = new Float32Array(65536);
    for (var i=-32768; i<32768; i++)
        curve[i+32768] = ((i>0)?i:-i)/32768;
    rectifier.curve = curve;
    rectifier.connect(ngFollower);
    apolloGate = audioContext.createWaveShaper();
    apolloGate.curve = generateNoiseFloorCurve( 0.02 );
    ngFollower.connect(apolloGate);

    var gateGain = audioContext.createGain();
    gateGain.gain.value = 0.0;
    apolloGate.connect( gateGain.gain );
    gateGain.connect( lpf1 );
    gateGain.connect( volumeprocessor );
    inputNode.connect(rectifier);
    inputNode.connect(gateGain);

    return( inputNode );
}


function playQuindarTone( intro ) {
	if (!beepGain) {
		beepGain=audioContext.createGain();
		beepGain.gain.value = 0.25;
		beepGain.connect(audioContext.destination);
	}
	var osc=audioContext.createOscillator();
	osc.frequency.setValueAtTime( intro ? 2525 : 2475, 0);
	osc.connect(beepGain);
	osc.start(0);
	osc.stop(audioContext.currentTime+0.25);
}

var wasSilent=true;
var lastNoise = 0;
var waitingForOutro=false;
var OUTRODELAY=0.5;  // trailing edge delay, in seconds

function volumeAudioProcess( event ) {
	var buf = event.inputBuffer.getChannelData(0);
    var bufLength = buf.length;
	var sum = 0;
    var x;
    var currentlySilent = true;

	// Do a root-mean-square on the samples: sum up the squares...
    for (var i=0; i<bufLength; i++) {
    	currentlySilent = currentlySilent && (buf[i]==0.0);
    }

    if (wasSilent&&currentlySilent) {
    	if (waitingForOutro) {
    		if ((lastNoise+OUTRODELAY)<event.playbackTime) {
	    		playQuindarTone(false);
		    	waitingForOutro=false;
		    }
    	}
    	return;
    }
    if (wasSilent) { // but not currently silent - leading edge
    	if (!waitingForOutro) {
    		playQuindarTone(true);
    		waitingForOutro=true;
    	}
    	wasSilent=false;
    	return;
    }
    if (currentlySilent) {  // but wasn't silent - trailing edge
    	lastNoise=event.playbackTime;
    	wasSilent=true;
    }
}

