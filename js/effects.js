window.AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext = new AudioContext();
var audioInput = null,
    realAudioInput = null,
    effectInput = null,
    wetGain = null,
    dryGain = null,
    outputMix = null,
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
    rmod = null,
    mddelay = null,
    mddepth = null,
    mdspeed = null,
    lplfo = null,
    lplfodepth = null,
    lplfofilter = null,
    awFollower = null,
    awDepth = null,
    awFilter = null,
    ngFollower = null,
    ngGate = null,
    bitCrusher = null,
    btcrBits = 16,   // between 1 and 16
    btcrNormFreq = 1; // between 0.0 and 1.0

var rafID = null;
var analyser1;
var analyserView1;
var constraints = 
{
  audio: {
      optional: [{ echoCancellation: false }]
  }
};

function convertToMono( input ) {
    var splitter = audioContext.createChannelSplitter(2);
    var merger = audioContext.createChannelMerger(2);

    input.connect( splitter );
    splitter.connect( merger, 0, 0 );
    splitter.connect( merger, 0, 1 );
    return merger;
}

window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
window.cancelAnimationFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame;

function cancelAnalyserUpdates() {
    if (rafID)
        window.cancelAnimationFrame( rafID );
    rafID = null;
}

function updateAnalysers(time) {
    analyserView1.doFrequencyAnalysis( analyser1 );
    analyserView2.doFrequencyAnalysis( analyser2 );
    
    rafID = window.requestAnimationFrame( updateAnalysers );
}

var lpInputFilter=null;

// this is ONLY because we have massive feedback without filtering out
// the top end in live speaker scenarios.
function createLPInputFilter() {
    lpInputFilter = audioContext.createBiquadFilter();
    lpInputFilter.frequency.value = 2048;
    return lpInputFilter;
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

    createLPInputFilter();
    lpInputFilter.connect(dryGain);
    lpInputFilter.connect(analyser1);
    lpInputFilter.connect(effectInput);
}

var useFeedbackReduction = true;

function gotStream(stream) {
    // Create an AudioNode from the stream.
//    realAudioInput = audioContext.createMediaStreamSource(stream);
    var input = audioContext.createMediaStreamSource(stream);

/*
    realAudioInput = audioContext.createBiquadFilter();
    realAudioInput.frequency.value = 60.0;
    realAudioInput.type = realAudioInput.NOTCH;
    realAudioInput.Q = 10.0;

    input.connect( realAudioInput );
*/
    audioInput = convertToMono( input );

    if (useFeedbackReduction) {
        audioInput.connect( createLPInputFilter() );
        audioInput = lpInputFilter;
        
    }
    // create mix gain nodes
    outputMix = audioContext.createGain();
    dryGain = audioContext.createGain();
    wetGain = audioContext.createGain();
    effectInput = audioContext.createGain();
    audioInput.connect(dryGain);
    audioInput.connect(analyser1);
    audioInput.connect(effectInput);
    dryGain.connect(outputMix);
    wetGain.connect(outputMix);
    outputMix.connect( audioContext.destination);
    outputMix.connect(analyser2);
    crossfade(1.0);
    changeEffect();
    cancelAnalyserUpdates();
    updateAnalysers();
}

function changeInput(){
  if (!!window.stream) {
    window.stream.stop();
  }
  var audioSelect = document.getElementById("audioinput");
  var audioSource = audioSelect.value;
  constraints.audio.optional.push({sourceId: audioSource});

  navigator.getUserMedia(constraints, gotStream, function(e) {
            alert('Error getting audio');
            console.log(e);
        });
}

function gotSources(sourceInfos) {
    var audioSelect = document.getElementById("audioinput");
    while (audioSelect.firstChild)
        audioSelect.removeChild(audioSelect.firstChild);

    for (var i = 0; i != sourceInfos.length; ++i) {
        var sourceInfo = sourceInfos[i];
        if (sourceInfo.kind === 'audio') {
            var option = document.createElement("option");
            option.value = sourceInfo.id;
            option.text = sourceInfo.label || 'input ' + (audioSelect.length + 1);
            audioSelect.appendChild(option);
        }
    }
    audioSelect.onchange = changeInput;
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

    analyser1 = audioContext.createAnalyser();
    analyser1.fftSize = 1024;
    analyser2 = audioContext.createAnalyser();
    analyser2.fftSize = 1024;

    analyserView1 = new AnalyserView("view1");
    analyserView1.initByteBuffer( analyser1 );
    analyserView2 = new AnalyserView("view2");
    analyserView2.initByteBuffer( analyser2 );

    if (!navigator.getUserMedia)
        navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

    if (!navigator.getUserMedia)
        return(alert("Error: getUserMedia not supported!"));

    navigator.getUserMedia(constraints, gotStream, function(e) {
            alert('Error getting audio');
            console.log(e);
        });

    if ((typeof MediaStreamTrack === 'undefined')||(!MediaStreamTrack.getSources)){
        console.log("This browser does not support MediaStreamTrack, so doesn't support selecting sources.\n\nTry Chrome Canary.");
    } else {
        MediaStreamTrack.getSources(gotSources);
    }

    document.getElementById("effect").onchange=changeEffect;
}

function keyPress(ev) {
    var oldEffect = document.getElementById("effect").selectedIndex;
    var newEffect = oldEffect;
    switch (ev.keyCode) {
      case 50: // 'r'
        newEffect = 1;
        break;
      case 49: // 'c'
        newEffect = 8;
        break;
      case 51: // 'p'
        newEffect = 10;
        break;
      default:
        console.log(ev.keyCode);
    }
    if (newEffect != oldEffect) {
        document.getElementById("effect").selectedIndex = newEffect;
        changeEffect();
    }
}

window.addEventListener('load', initAudio );

window.addEventListener('keydown', keyPress );

function crossfade(value) {
  // equal-power crossfade
  var gain1 = Math.cos(value * 0.5*Math.PI);
  var gain2 = Math.cos((1.0-value) * 0.5*Math.PI);

  dryGain.gain.value = gain1;
  wetGain.gain.value = gain2;
}

var lastEffect = -1;

function changeEffect() {
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
    rmod = null;
    mddelay = null;
    mddepth = null;
    mdspeed = null;
    lplfo = null;
    lplfodepth = null;
    lplfofilter = null;
    awFollower = null;
    awDepth = null;
    awFilter = null;
    ngFollower = null;
    ngGate = null;
    bitCrusher = null;

    if (currentEffectNode) 
        currentEffectNode.disconnect();
    if (effectInput)
        effectInput.disconnect();

    var effect = document.getElementById("effect").selectedIndex;
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
        case 10: // Pitch shifting
            currentEffectNode = createPitchShifter();
            break;
        case 11: // Mod Delay 
            currentEffectNode = createModDelay();
            break;
        case 12: // Ping-pong delay
            var pingPong = createPingPongDelay(audioContext, (audioInput == realAudioInput), 0.3, 0.4 );
            pingPong.output.connect( wetGain );
            currentEffectNode = pingPong.input;
            break;
        case 13: // LPF LFO
            currentEffectNode = createFilterLFO();
            break;
        case 14: // Envelope Follower
            currentEffectNode = createEnvelopeFollower();
            break;
        case 15: // Autowah
            currentEffectNode = createAutowah();
            break;
        case 16: // Noise gate
            currentEffectNode = createNoiseGate();
            break;
        case 17: // Wah Bass
            var pingPong = createPingPongDelay(audioContext, (audioInput == realAudioInput), 0.5, 0.5 );
            pingPong.output.connect( wetGain );
            pingPong.input.connect(wetGain);
            var tempWetGain = wetGain;
            wetGain = pingPong.input;
            wetGain = createAutowah();
            currentEffectNode = createPitchShifter();
            wetGain = tempWetGain;
            break;
        case 18: // Distorted Wah Chorus
            var tempWetGain = wetGain;
            wetGain = createStereoChorus();
            wetGain = createDistortion();
            currentEffectNode = createAutowah();
            wetGain = tempWetGain;
            waveshaper.setDrive(20);
            break;
        case 19: // Vibrato
            currentEffectNode = createVibrato();
            break;
        case 20: // BitCrusher
            currentEffectNode = createBitCrusher();
            break;
        case 21: // Apollo effect
            currentEffectNode = createApolloEffect();
            break;
        default:
            break;
    }
    audioInput.connect( currentEffectNode );
}




function createTelephonizer() {
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
    hpf2.connect( wetGain );
    currentEffectNode = lpf1;
    return( lpf1 );
}

function createDelay() {
    var delayNode = audioContext.createDelay();

    delayNode.delayTime.value = parseFloat( document.getElementById("dtime").value );
    dtime = delayNode;

    var gainNode = audioContext.createGain();
    gainNode.gain.value = parseFloat( document.getElementById("dregen").value );
    dregen = gainNode;

    gainNode.connect( delayNode );
    delayNode.connect( gainNode );
    delayNode.connect( wetGain );

    return delayNode;
}

function createReverb() {
    var convolver = audioContext.createConvolver();
    convolver.buffer = reverbBuffer; // impulseResponse( 2.5, 2.0 );  // reverbBuffer;
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
    var gain = audioContext.createGain();
    var depth = audioContext.createGain();

    osc.type = document.getElementById("lfotype").value;
    osc.frequency.value = parseFloat( document.getElementById("lfo").value );

    gain.gain.value = 1.0; // to offset
    depth.gain.value = 1.0;
    osc.connect(depth); // scales the range of the lfo


    depth.connect(gain.gain);
    gain.connect( wetGain );
    lfo = osc;
    lfotype = osc;
    lfodepth = depth;


    osc.start(0);
    return gain;
}

function createFilterLFO() {
    var osc = audioContext.createOscillator();
    var gainMult = audioContext.createGain();
    var gain = audioContext.createGain();
    var filter = audioContext.createBiquadFilter();

    filter.type = "lowpass";
    filter.Q.value = parseFloat( document.getElementById("lplfoq").value );
    lplfofilter = filter;

    osc.type = 'sine';
    osc.frequency.value = parseFloat( document.getElementById("lplfo").value );
    osc.connect( gain );

    filter.frequency.value = 2500;  // center frequency - this is kinda arbitrary.
    gain.gain.value = 2500 * parseFloat( document.getElementById("lplfodepth").value );
    // this should make the -1 - +1 range of the osc translate to 0 - 5000Hz, if
    // depth == 1.

    gain.connect( filter.frequency );
    filter.connect( wetGain );
    lplfo = osc;
    lplfodepth = gain;

    osc.start(0);
    return filter;
}

function createRingmod() {
    var gain = audioContext.createGain();
    var ring = audioContext.createGain();
    var osc = audioContext.createOscillator();

    osc.type = 'sine';
    rmod = osc;
    osc.frequency.value = Math.pow( 2, parseFloat( document.getElementById("rmfreq").value ) );
    osc.connect(ring.gain);

    ring.gain.value = 0.0;
    gain.connect(ring);
    ring.connect(wetGain);
    osc.start(0);
    return gain;
}

var awg = null;

function createChorus() {
    var delayNode = audioContext.createDelay();
    delayNode.delayTime.value = parseFloat( document.getElementById("cdelay").value );
    cdelay = delayNode;

    var inputNode = audioContext.createGain();

    var osc = audioContext.createOscillator();
    var gain = audioContext.createGain();

    gain.gain.value = parseFloat( document.getElementById("cdepth").value ); // depth of change to the delay:
    cdepth = gain;

    osc.type = 'sine';
    osc.frequency.value = parseFloat( document.getElementById("cspeed").value );
    cspeed = osc;

    osc.connect(gain);
    gain.connect(delayNode.delayTime);

    inputNode.connect( wetGain );
    inputNode.connect( delayNode );
    delayNode.connect( wetGain );


    osc.start(0);

    return inputNode;
}

function createVibrato() {
    var delayNode = audioContext.createDelay();
    delayNode.delayTime.value = parseFloat( document.getElementById("vdelay").value );
    cdelay = delayNode;

    var inputNode = audioContext.createGain();

    var osc = audioContext.createOscillator();
    var gain = audioContext.createGain();

    gain.gain.value = parseFloat( document.getElementById("vdepth").value ); // depth of change to the delay:
    cdepth = gain;

    osc.type = 'sine';
    osc.frequency.value = parseFloat( document.getElementById("vspeed").value );
    cspeed = osc;

    osc.connect(gain);
    gain.connect(delayNode.delayTime);
    inputNode.connect( delayNode );
    delayNode.connect( wetGain );
    osc.start(0);

    return inputNode;
}

function createFlange() {
    var delayNode = audioContext.createDelay();
    delayNode.delayTime.value = parseFloat( document.getElementById("fldelay").value );
    fldelay = delayNode;

    var inputNode = audioContext.createGain();
    var feedback = audioContext.createGain();
    var osc = audioContext.createOscillator();
    var gain = audioContext.createGain();
    gain.gain.value = parseFloat( document.getElementById("fldepth").value );
    fldepth = gain;

    feedback.gain.value = parseFloat( document.getElementById("flfb").value );
    flfb = feedback;

    osc.type = 'sine';
    osc.frequency.value = parseFloat( document.getElementById("flspeed").value );
    flspeed = osc;

    osc.connect(gain);
    gain.connect(delayNode.delayTime);

    inputNode.connect( wetGain );
    inputNode.connect( delayNode );
    delayNode.connect( wetGain );
    delayNode.connect( feedback );
    feedback.connect( inputNode );

    osc.start(0);

    return inputNode;
}

function createStereoChorus() {
    var splitter = audioContext.createChannelSplitter(2);
    var merger = audioContext.createChannelMerger(2);
    var inputNode = audioContext.createGain();

    inputNode.connect( splitter );
    inputNode.connect( wetGain );

    var delayLNode = audioContext.createDelay();
    var delayRNode = audioContext.createDelay();
    delayLNode.delayTime.value = parseFloat( document.getElementById("scdelay").value );
    delayRNode.delayTime.value = parseFloat( document.getElementById("scdelay").value );
    scldelay = delayLNode;
    scrdelay = delayRNode;
    splitter.connect( delayLNode, 0 );
    splitter.connect( delayRNode, 1 );

    var osc = audioContext.createOscillator();
    scldepth = audioContext.createGain();
    scrdepth = audioContext.createGain();

    scldepth.gain.value = parseFloat( document.getElementById("scdepth").value ); // depth of change to the delay:
    scrdepth.gain.value = - parseFloat( document.getElementById("scdepth").value ); // depth of change to the delay:

    osc.type = 'triangle';
    osc.frequency.value = parseFloat( document.getElementById("scspeed").value );
    scspeed = osc;

    osc.connect(scldepth);
    osc.connect(scrdepth);

    scldepth.connect(delayLNode.delayTime);
    scrdepth.connect(delayRNode.delayTime);

    delayLNode.connect( merger, 0, 0 );
    delayRNode.connect( merger, 0, 1 );
    merger.connect( wetGain );

    osc.start(0);

    return inputNode;
}

/*
    Add modulation to delayed signal akin to ElectroHarmonix MemoryMan Guitar Pedal.
    Simple combination of effects with great output hear on lots of records.
    
    FX Chain ASCII PIC:
                v- FEEDBACK -|
    INPUT -> DELAY -> CHORUS -> OUTPUT
*/
function createModDelay() {
    // Create input node for incoming audio
    var inputNode = audioContext.createGain();

    // SET UP DELAY NODE
    var delayNode = audioContext.createDelay();
    delayNode.delayTime.value = parseFloat( document.getElementById("mdtime").value );
    mdtime = delayNode;

    var feedbackGainNode = audioContext.createGain();
    feedbackGainNode.gain.value = parseFloat( document.getElementById("mdfeedback").value );
    mdfeedback = feedbackGainNode;


    // SET UP CHORUS NODE
    var chorus = audioContext.createDelay();
    chorus.delayTime.value = parseFloat( document.getElementById("mddelay").value );
    mddelay = chorus;

    var osc  = audioContext.createOscillator();
    var chorusRateGainNode = audioContext.createGain();
    chorusRateGainNode.gain.value = parseFloat( document.getElementById("mddepth").value ); // depth of change to the delay:
    mddepth = chorusRateGainNode;

    osc.type = 'sine';
    osc.frequency.value = parseFloat( document.getElementById("mdspeed").value );
    mdspeed = osc;

    osc.connect(chorusRateGainNode);
    chorusRateGainNode.connect(chorus.delayTime);

    // Connect the FX chain together
    // create circular chain for delay to "feedback" to itself
    inputNode.connect( delayNode );
    delayNode.connect( chorus );
    delayNode.connect( feedbackGainNode );
    chorus.connect(feedbackGainNode);
    feedbackGainNode.connect( delayNode );
    feedbackGainNode.connect( wetGain );


    osc.start(0);

    return inputNode;
}

function createStereoFlange() {
    var splitter = audioContext.createChannelSplitter(2);
    var merger = audioContext.createChannelMerger(2);
    var inputNode = audioContext.createGain();
    sfllfb = audioContext.createGain();
    sflrfb = audioContext.createGain();
    sflspeed = audioContext.createOscillator();
    sflldepth = audioContext.createGain();
    sflrdepth = audioContext.createGain();
    sflldelay = audioContext.createDelay();
    sflrdelay = audioContext.createDelay();


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

    sflspeed.type = 'triangle';
    sflspeed.frequency.value = parseFloat( document.getElementById("sflspeed").value );

    sflspeed.connect( sflldepth );
    sflspeed.connect( sflrdepth );

    sflldepth.connect( sflldelay.delayTime );
    sflrdepth.connect( sflrdelay.delayTime );

    sflldelay.connect( merger, 0, 0 );
    sflrdelay.connect( merger, 0, 1 );
    merger.connect( wetGain );

    sflspeed.start(0);

    return inputNode;
}

function createPitchShifter() {
    effect = new Jungle( audioContext );
    effect.output.connect( wetGain );
    return effect.input;
}

function createEnvelopeFollower() {
    var waveshaper = audioContext.createWaveShaper();
    var lpf1 = audioContext.createBiquadFilter();
    lpf1.type = "lowpass";
    lpf1.frequency.value = 10.0;

    var curve = new Float32Array(65536);
    for (var i=-32768; i<32768; i++)
        curve[i+32768] = ((i>0)?i:-i)/32768;
    waveshaper.curve = curve;
    waveshaper.connect(lpf1);
    lpf1.connect(wetGain);
    return waveshaper;
}

function createAutowah() {
    var inputNode = audioContext.createGain();
    var waveshaper = audioContext.createWaveShaper();
    awFollower = audioContext.createBiquadFilter();
    awFollower.type = "lowpass";
    awFollower.frequency.value = 10.0;

    var curve = new Float32Array(65536);
    for (var i=-32768; i<32768; i++)
        curve[i+32768] = ((i>0)?i:-i)/32768;
    waveshaper.curve = curve;
    waveshaper.connect(awFollower);

    awDepth = audioContext.createGain();
    awDepth.gain.value = 11585;
    awFollower.connect(awDepth);

    awFilter = audioContext.createBiquadFilter();
    awFilter.type = "lowpass";
    awFilter.Q.value = 15;
    awFilter.frequency.value = 50;
    awDepth.connect(awFilter.frequency);
    awFilter.connect(wetGain);

    inputNode.connect(waveshaper);
    inputNode.connect(awFilter);
    return inputNode;
}

function createNoiseGate() {
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

    ngGate = audioContext.createWaveShaper();
    ngGate.curve = generateNoiseFloorCurve(parseFloat(document.getElementById("ngFloor").value));

    ngFollower.connect(ngGate);

    var gateGain = audioContext.createGain();
    gateGain.gain.value = 0.0;
    ngGate.connect( gateGain.gain );

    gateGain.connect( wetGain);

    inputNode.connect(rectifier);
    inputNode.connect(gateGain);
    return inputNode;
}

function generateNoiseFloorCurve( floor ) {
    // "floor" is 0...1

    var curve = new Float32Array(65536);
    var mappedFloor = floor * 32768;

    for (var i=0; i<32768; i++) {
        var value = (i<mappedFloor) ? 0 : 1;

        curve[32768-i] = -value;
        curve[32768+i] = value;
    }
    curve[0] = curve[1]; // fixing up the end.

    return curve;
}

function setBitCrusherDepth( bits ) {
    var length = Math.pow(2, bits);
    console.log("setting bitcrusher depth to " + bits + " bits, length = " + length );
    var curve = new Float32Array( length );

    var lengthMinusOne = length - 1;

    for (var i=0; i<length; i++)
        curve[i] = (2 * i / lengthMinusOne) - 1;

    if (bitCrusher)
        bitCrusher.curve = curve;
}

var btcrBufferSize = 4096;

function createBitCrusher() {
    var bitCrusher = audioContext.createScriptProcessor(btcrBufferSize, 1, 1);
    var phaser = 0;
    var last = 0;

    bitCrusher.onaudioprocess = function(e) {
        var step = Math.pow(1/2, btcrBits);
        for (var channel=0; channel<e.inputBuffer.numberOfChannels; channel++) {
            var input = e.inputBuffer.getChannelData(channel);
            var output = e.outputBuffer.getChannelData(channel);
            for (var i = 0; i < btcrBufferSize; i++) {
                phaser += btcrNormFreq;
                if (phaser >= 1.0) {
                    phaser -= 1.0;
                    last = step * Math.floor(input[i] / step + 0.5);
                }
                output[i] = last;
            }
        }
    };
    bitCrusher.connect( wetGain );
    return bitCrusher;
}

btcrBits = 16,
    btcrNormFreq

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
