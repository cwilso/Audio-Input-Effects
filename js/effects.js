var audioContext = new webkitAudioContext();
var audioInput = null,
    realAudioInput = null,
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
    scspeed = null,
    scldelay = null,
    scrdelay = null,
    scldepth = null,
    scrdepth = null,
    fldelay = null,
    flspeed = null,
    fldepth = null,
    flfb = null,
    sflldelay = null,
    sflrdelay = null,
    sflspeed = null,
    sflldepth = null,
    sflrdepth = null,
    sfllfb = null,
    sflrfb = null,
    rmod = null;

var rafID = null;
var analyser1;
var analyserView1;

function convertToMono( input ) {
    var splitter = audioContext.createChannelSplitter(2);
    var merger = audioContext.createChannelMerger(2);

    input.connect( splitter );
    splitter.connect( merger, 0, 0 );
    splitter.connect( merger, 0, 1 );
    return merger;
}

function cancelAnalyserUpdates() {
    window.webkitCancelAnimationFrame( rafID );
    rafID = null;
}

function updateAnalysers(time) {
    analyserView1.doFrequencyAnalysis( analyser1 );
    analyserView2.doFrequencyAnalysis( analyser2 );
    
    rafID = window.webkitRequestAnimationFrame( updateAnalysers );
}

function toggleMono() {
    if (audioInput != realAudioInput) {
        audioInput.disconnect();
        realAudioInput.disconnect();
        audioInput = realAudioInput;
    } else {
        realAudioInput.disconnect();
        audioInput = convertToMono( realAudioInput );
    }

    audioInput.connect(dryGain);
    audioInput.connect(analyser1);
    audioInput.connect(effectInput);
}

function gotStream(stream) {
    // Create an AudioNode from the stream.
//    realAudioInput = audioContext.createMediaStreamSource(stream);
    var input = audioContext.createMediaStreamSource(stream);

    realAudioInput = audioContext.createBiquadFilter();
    realAudioInput.frequency.value = 60.0;
    realAudioInput.type = realAudioInput.NOTCH;
    realAudioInput.Q = 10.0;

    input.connect( realAudioInput );

    audioInput = convertToMono( realAudioInput );

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
    scspeed = null;
    scldelay = null;
    scrdelay = null;
    scldepth = null;
    scrdepth = null;
    sflldelay = null;
    sflrdelay = null;
    sflspeed = null;
    sflldepth = null;
    sflrdepth = null;
    sfllfb = null;
    sflrfb = null;

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
        case 8: // Stereo Chorus
            currentEffectNode = createStereoChorus();
            break;
        case 9: // Stereo Flange
            currentEffectNode = createStereoFlange();
            break;
        case 10: // LPF LFO
            currentEffectNode = createFilterLFO();
            break;
        case 11: // Autowah
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
    convolver.buffer = impulseResponse( 2.5, 2.0 );  // reverbBuffer;
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

function createStereoChorus() {
    var splitter = audioContext.createChannelSplitter(2);
    var merger = audioContext.createChannelMerger(2);
    var inputNode = audioContext.createGainNode();

    inputNode.connect( splitter );
    inputNode.connect( wetGain );

    var delayLNode = audioContext.createDelayNode();
    var delayRNode = audioContext.createDelayNode();
    delayLNode.delayTime.value = parseFloat( document.getElementById("scdelay").value );
    delayRNode.delayTime.value = parseFloat( document.getElementById("scdelay").value );
    scldelay = delayLNode;
    scrdelay = delayRNode;
    splitter.connect( delayLNode, 0 );
    splitter.connect( delayRNode, 1 );

    var osc = audioContext.createOscillator();
    scldepth = audioContext.createGainNode();
    scrdepth = audioContext.createGainNode();

    scldepth.gain.value = parseFloat( document.getElementById("scdepth").value ); // depth of change to the delay:
    scrdepth.gain.value = - parseFloat( document.getElementById("scdepth").value ); // depth of change to the delay:

    osc.type = osc.TRIANGLE;
    osc.frequency.value = parseFloat( document.getElementById("scspeed").value );
    scspeed = osc;

    osc.connect(scldepth);
    osc.connect(scrdepth);

    scldepth.connect(delayLNode.delayTime);
    scrdepth.connect(delayRNode.delayTime);

    delayLNode.connect( merger, 0, 0 );
    delayRNode.connect( merger, 0, 1 );
    merger.connect( wetGain );

    osc.noteOn(0);

    return inputNode;
}


function createStereoFlange() {
    var splitter = audioContext.createChannelSplitter(2);
    var merger = audioContext.createChannelMerger(2);
    var inputNode = audioContext.createGainNode();
    sfllfb = audioContext.createGainNode();
    sflrfb = audioContext.createGainNode();
    sflspeed = audioContext.createOscillator();
    sflldepth = audioContext.createGainNode();
    sflrdepth = audioContext.createGainNode();
    sflldelay = audioContext.createDelayNode();
    sflrdelay = audioContext.createDelayNode();


    sfllfb.gain.value = sflrfb.gain.value = parseFloat( document.getElementById("sflfb").value );

    inputNode.connect( splitter );
    inputNode.connect( wetGain );

    sflldelay.delayTime.value = parseFloat( document.getElementById("sfldelay").value );
    sflrdelay.delayTime.value = parseFloat( document.getElementById("sfldelay").value );

    splitter.connect( sflldelay, 0 );
    splitter.connect( sflrdelay, 1 );
    sflldelay.connect( sfllfb );
    sflrdelay.connect( sflrfb );
    sfllfb.connect( sflrdelay );
    sflrfb.connect( sflldelay );

    sflldepth.gain.value = parseFloat( document.getElementById("sfldepth").value ); // depth of change to the delay:
    sflrdepth.gain.value = - parseFloat( document.getElementById("sfldepth").value ); // depth of change to the delay:

    sflspeed.type = sflspeed.TRIANGLE;
    sflspeed.frequency.value = parseFloat( document.getElementById("sflspeed").value );

    sflspeed.connect( sflldepth );
    sflspeed.connect( sflrdepth );

    sflldepth.connect( sflldelay.delayTime );
    sflrdepth.connect( sflrdelay.delayTime );

    sflldelay.connect( merger, 0, 0 );
    sflrdelay.connect( merger, 0, 1 );
    merger.connect( wetGain );

    sflspeed.noteOn(0);

    return inputNode;
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

function impulseResponse( duration, decay, reverse ) {
    var sampleRate = audioContext.sampleRate;
    var length = sampleRate * duration;
    var impulse = audioContext.createBuffer(2, length, sampleRate);
    var impulseL = impulse.getChannelData(0);
    var impulseR = impulse.getChannelData(1);

    if (!decay)
        decay = 2.0;
    for (var i = 0; i < length; i++){
      var n = reverse ? length - i : i;
      impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
      impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    }
    return impulse;
}
