var audioContext = new webkitAudioContext();
var audioInput = null,
    effectInput = null,
    wetGain = null,
    dryGain = null,
    currentEffectNode = null,
    reverbBuffer = null,
    dtime = null,
    dregen = null,
    lfo = null,
    cspeed = null,
    cdelay = null,
    cdepth = null,
    fldelay = null,
    flspeed = null,
    fldepth = null,
    flfb = null,
    rmod = null;

var rafID = null;
var analyser1;
var analyserView1;

function cancelAnalyserUpdates() {
    window.webkitCancelAnimationFrame( rafID );
    rafID = null;
}

function updateAnalysers(time) {
    analyserView1.doFrequencyAnalysis( analyser1 );
    analyserView2.doFrequencyAnalysis( analyser2 );
    
    rafID = window.webkitRequestAnimationFrame( updateAnalysers );
}

function gotStream(stream) {
    // Create an AudioNode from the stream.
    audioInput = audioContext.createMediaStreamSource(stream);

    analyser1 = audioContext.createAnalyser();
    analyser1.fftSize = 1024;
    analyser2 = audioContext.createAnalyser();
    analyser2.fftSize = 1024;

    analyserView1 = new AnalyserView("view1");
    analyserView1.initByteBuffer( analyser1 );
    analyserView2 = new AnalyserView("view2");
    analyserView2.initByteBuffer( analyser2 );

    // create mix gain nodes
    dryGain = audioContext.createGainNode();
    wetGain = audioContext.createGainNode();
    effectInput = audioContext.createGainNode();
    audioInput.connect(dryGain);
    audioInput.connect(analyser1);
    audioInput.connect(effectInput);
    dryGain.connect(audioContext.destination);
    wetGain.connect(audioContext.destination);
    wetGain.connect(analyser2);
    crossfade(1.0);
    changeEffect(0);
    updateAnalysers();
}

function initAudio() {
    var irRRequest = new XMLHttpRequest();
    irRRequest.open("GET", "sounds/cardiod-rear-levelled.wav", true);
    irRRequest.responseType = "arraybuffer";
    irRRequest.onload = function() {
        audioContext.decodeAudioData( irRRequest.response, 
            function(buffer) { reverbBuffer = buffer; } );
    }
    irRRequest.send();


    o3djs.require('o3djs.shader');

    if (!navigator.webkitGetUserMedia)
        return(alert("Error: getUserMedia not supported!"));

    navigator.webkitGetUserMedia({audio:true}, gotStream, function(e) {
            alert('Error getting audio');
            console.log(e);
        });
}

window.addEventListener('load', initAudio );


function crossfade(value) {
  // equal-power crossfade
  var gain1 = Math.cos(value * 0.5*Math.PI);
  var gain2 = Math.cos((1.0-value) * 0.5*Math.PI);

  dryGain.gain.value = gain1;
  wetGain.gain.value = gain2;
}

var lastEffect = -1;

function changeEffect(effect) {
    lfo = null;
    dtime = null;
    dregen = null;
    cspeed = null;
    cdelay = null;
    cdepth = null;
    rmod = null;
    fldelay = null;
    flspeed = null;
    fldepth = null;
    flfb = null;

    if (currentEffectNode) 
        currentEffectNode.disconnect();
    if (effectInput)
        effectInput.disconnect();

    var effectControls = document.getElementById("controls");
    if (lastEffect > -1)
        effectControls.children[lastEffect].classList.remove("display");
    lastEffect = effect;
    effectControls.children[effect].classList.add("display");

    switch (effect) {
        case 0: // Delay
            currentEffectNode = createDelay();
            break;
        case 1: // Reverb
            currentEffectNode = createReverb();
            break;
        case 2: // Distortion
            currentEffectNode = createDistortion();
            break;
        case 3: // Telephone
            currentEffectNode = createTelephonizer();
            break;
        case 4: // GainLFO
            currentEffectNode = createGainLFO();
            break;
        case 5: // Chorus
            currentEffectNode = createChorus();
            break;
        case 6: // Flange
            currentEffectNode = createFlange();
            break;
        case 7: // Ringmod
            currentEffectNode = createRingmod();
            break;
        case 8: // LPF LFO
            currentEffectNode = createFilterLFO();
            break;
        case 9: // Autowah
            currentEffectNode = createAutowah();
            break;
        default:
    }
    audioInput.connect( currentEffectNode );
}




function createTelephonizer() {
    // I double up the filters to get a 4th-order filter = faster fall-off
    var lpf1 = audioContext.createBiquadFilter();
    lpf1.type = lpf1.LOWPASS;
    lpf1.frequency.value = 2000.0;
    var lpf2 = audioContext.createBiquadFilter();
    lpf2.type = lpf2.LOWPASS;
    lpf2.frequency.value = 2000.0;
    var hpf1 = audioContext.createBiquadFilter();
    hpf1.type = hpf1.HIGHPASS;
    hpf1.frequency.value = 500.0;
    var hpf2 = audioContext.createBiquadFilter();
    hpf2.type = hpf2.HIGHPASS;
    hpf2.frequency.value = 500.0;
    lpf1.connect( lpf2 );
    lpf2.connect( hpf1 );
    hpf1.connect( hpf2 );
    hpf2.connect( wetGain );
    currentEffectNode = lpf1;
    return( lpf1 );
}

function createDelay() {
    var delayNode = audioContext.createDelayNode();
    delayNode.delayTime.value = parseFloat( document.getElementById("dtime").value );
    dtime = delayNode;

    var gainNode = audioContext.createGainNode();
    gainNode.gain.value = parseFloat( document.getElementById("dregen").value );
    dregen = gainNode;

    gainNode.connect( delayNode );
    delayNode.connect( gainNode );
    delayNode.connect( wetGain );

    return delayNode;
}

function createReverb() {
    var convolver = audioContext.createConvolver();
    convolver.buffer = reverbBuffer;
    convolver.connect( wetGain );
    return convolver;
}

var waveshaper = null;

function createDistortion() {
    if (!waveshaper)
        waveshaper = new WaveShaper( audioContext );

    waveshaper.output.connect( wetGain );
    waveshaper.setDrive(5.0);
    return waveshaper.input;
}

function createGainLFO() {
    var osc = audioContext.createOscillator();
    var gain = audioContext.createGainNode();

    osc.type = osc.SINE;
    osc.frequency.value = parseFloat( document.getElementById("lfo").value );

    gain.gain.value = 1.0; // to offset 
    osc.connect(gain.gain);
    gain.connect( wetGain );
    lfo = osc;

    osc.noteOn(0);
    return gain;
}

function createFilterLFO() {
    var osc = audioContext.createOscillator();
    var gainMult = audioContext.createGainNode();
    var gain = audioContext.createGainNode();
    var filter = audioContext.createBiquadFilter();

    filter.type = filter.LOWPASS;
    filter.Q.value = 5;

    osc.type = osc.SINE;
    osc.frequency.value = parseFloat( document.getElementById("lfo").value );
    osc.connect( gain );

    filter.frequency.value = 2500;
    gain.gain.value = 2500;  // this should make the -1 - +1 range of the osc translate to 
    gain.connect( filter.frequency ); // 0 - 5000Hz
    filter.connect( wetGain );
    lfo = osc;

    osc.noteOn(0);
    return filter;
}

function createRingmod() {
    var gain = audioContext.createGainNode();
    var ring = audioContext.createGainNode();
    var osc = audioContext.createOscillator();

    osc.type = osc.SINE;
    rmod = osc;
    osc.frequency.value = Math.pow( 2, parseFloat( document.getElementById("rmfreq").value ) );
    osc.connect(ring.gain);

    gain.connect(ring);
    ring.connect(wetGain);
    osc.noteOn(0);
    return gain;
}

var awg = null;

function createAutowah() {
    var dyn = audioContext.createDynamicsCompressor();
    var gain = audioContext.createGainNode();
    var gain2 = audioContext.createGainNode();
    var filter = audioContext.createBiquadFilter();
    var input = audioContext.createGainNode();

    dyn.threshold.value = -36.0;
    dyn.knee.value = 0.0;
    dyn.ratio.value = 20.0;
    dyn.attack.value = 0.0;
    dyn.release.value = 0.01;

    gain2.gain.value = -70;
    gain.gain = dyn.reduction;  // will go 0 - -36
    gain.connect( gain2 );

    filter.type = filter.LOWPASS;
    filter.Q.value = 5;
    filter.frequency.value = 2500;

    gain2.connect( filter.frequency ); // 0 - 5000Hz
    awg = gain;

    filter.connect( wetGain );
    input.connect( filter );
    input.connect( dyn );

    return input;
}


function createChorus() {
    var delayNode = audioContext.createDelayNode();
    delayNode.delayTime.value = parseFloat( document.getElementById("cdelay").value );
    cdelay = delayNode;

    var inputNode = audioContext.createGainNode();

    var osc = audioContext.createOscillator();
    var gain = audioContext.createGainNode();

    gain.gain.value = parseFloat( document.getElementById("cdepth").value ); // depth of change to the delay:
    cdepth = gain;

    osc.type = osc.SINE;
    osc.frequency.value = parseFloat( document.getElementById("cspeed").value );
    cspeed = osc;

    osc.connect(gain);
    gain.connect(delayNode.delayTime);

    inputNode.connect( wetGain );
    inputNode.connect( delayNode );
    delayNode.connect( wetGain );


    osc.noteOn(0);

    return inputNode;
}

function createFlange() {
    var delayNode = audioContext.createDelayNode();
    delayNode.delayTime.value = parseFloat( document.getElementById("fldelay").value );
    fldelay = delayNode;

    var inputNode = audioContext.createGainNode();
    var feedback = audioContext.createGainNode();
    var osc = audioContext.createOscillator();
    var gain = audioContext.createGainNode();
    gain.gain.value = parseFloat( document.getElementById("fldepth").value );
    fldepth = gain;

    feedback.gain.value = parseFloat( document.getElementById("flfb").value );
    flfb = feedback;

    osc.type = osc.SINE;
    osc.frequency.value = parseFloat( document.getElementById("flspeed").value );
    flspeed = osc;

    osc.connect(gain);
    gain.connect(delayNode.delayTime);

    inputNode.connect( wetGain );
    inputNode.connect( delayNode );
    delayNode.connect( wetGain );
    delayNode.connect( feedback );
    feedback.connect( inputNode );

    osc.noteOn(0);

    return inputNode;
}
















// Visualizer stuff here
var analyser1;
var analyserCanvas1;

var rafID = null;

function cancelVisualizerUpdates() {
  window.webkitCancelAnimationFrame( rafID );
}

function updateAnalyser( analyserNode, drawContext ) {
    var SPACER_WIDTH = 3;
    var BAR_WIDTH = 1;
    var OFFSET = 100;
    var CUTOFF = 23;
    var CANVAS_WIDTH = 800;
    var CANVAS_HEIGHT = 120;
    var numBars = Math.round(CANVAS_WIDTH / SPACER_WIDTH);
    var freqByteData = new Uint8Array(analyserNode.frequencyBinCount);

    analyserNode.getByteFrequencyData(freqByteData); 

    drawContext.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawContext.fillStyle = '#F6D565';
    drawContext.lineCap = 'round';
    var multiplier = analyserNode.frequencyBinCount / numBars;

    // Draw rectangle for each frequency bin.
    for (var i = 0; i < numBars; ++i) {
        var magnitude = 0;
        var offset = Math.floor( i * multiplier );
        // gotta sum/average the block, or we miss narrow-bandwidth spikes
        for (var j = 0; j< multiplier; j++)
            magnitude += freqByteData[offset + j];
        magnitude = magnitude / multiplier;
        var magnitude2 = freqByteData[i * multiplier];
        drawContext.fillStyle = "hsl( " + Math.round((i*360)/numBars) + ", 100%, 50%)";
        drawContext.fillRect(i * SPACER_WIDTH, CANVAS_HEIGHT, BAR_WIDTH, -magnitude);
    }
}


function updateVisualizer(time) {
    updateAnalyser( analyser1, analyserCanvas1 );
    rafID = window.webkitRequestAnimationFrame( updateVisualizer );
}

var visualizerActive = false;
var visualizerNode = null;

function visualizeDrums(canvasElement) {
    if ( visualizerActive ) {
        cancelVisualizerUpdates();
        visualizerNode.noteOff(0);
        visualizerNode = null;
        analyser1 = null;
        analyserCanvas1 = null;
        visualizerActive = false;
        return "visualize!";
    }

    visualizerActive = true;
    visualizerNode = audioContext.createBufferSource();
    visualizerNode.buffer = drumsBuffer;
    visualizerNode.loop = true;

    analyser1 = audioContext.createAnalyser();
    analyser1.fftSize = 2048;
    analyser1.maxDecibels = 0;

    analyserCanvas1 = canvasElement.getContext('2d');
  
    visualizerNode.connect( audioContext.destination );
    visualizerNode.connect( analyser1 );

    visualizerNode.noteOn(0);
    updateVisualizer(0);
    return "stop!";
}

var ppDemo = null;
var isPingPongPlaying = false;

function playPingPong() {
    if (isPingPongPlaying) {
        ppDemo.noteOff(0);
        ppDemo = null;
        isPingPongPlaying = false;
        return "play";
    }

    ppDemo = audioContext.createBufferSource();
    ppDemo.buffer = glassBuffer;
    ppDemo.loop = true;
    
    var ppMerger = audioContext.createChannelMerger();
    var ppLeftDelay = audioContext.createDelayNode();
    var ppRightDelay = audioContext.createDelayNode();

    ppLeftDelay.delayTime.value = 0.3;
    ppRightDelay.delayTime.value = 0.3;
    
    var ppLeftFeedback = audioContext.createGainNode();
    ppLeftFeedback.gain.value = 0.65;
    
    var ppRightFeedback = audioContext.createGainNode();
    ppRightFeedback.gain.value = 0.65;

    ppLeftDelay.connect(ppLeftFeedback);
    ppLeftFeedback.connect(ppRightDelay);
    
    ppRightDelay.connect(ppRightFeedback);
    ppRightFeedback.connect(ppLeftDelay);
    
    // Re-merge the two delay channels into stereo L/R
    ppLeftFeedback.connect(ppMerger, 0, 0);
    ppRightFeedback.connect(ppMerger, 0, 1);
    
    ppDemo.connect( audioContext.destination );
    ppDemo.connect( ppLeftDelay );

    ppMerger.connect( audioContext.destination);
    ppDemo.noteOn(0);
    isPingPongPlaying = true;

    return "stop";
}
