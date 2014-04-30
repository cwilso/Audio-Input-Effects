function createPingPongDelay(context, isTrueStereo, delayTime, feedback) {
    var effect = new Effect();
    var merger = context.createChannelMerger(2);
    var leftDelay = context.createDelay();
    var rightDelay = context.createDelay();
    var leftFeedback = audioContext.createGain();
    var rightFeedback = audioContext.createGain();
    var splitter = context.createChannelSplitter(2);

    // Split the stereo signal.
    splitter.connect( leftDelay, 0 );

    // If the signal is dual copies of a mono signal, we don't want the right channel - 
    // it will just sound like a mono delay.  If it was a real stereo signal, we do want
    // it to just mirror the channels.
    if (isTrueStereo)
        splitter.connect( rightDelay, 1 );

    leftDelay.delayTime.value = delayTime;
    rightDelay.delayTime.value = delayTime;
    
    leftFeedback.gain.value = feedback;
    rightFeedback.gain.value = feedback;

    // Connect the routing - left bounces to right, right bounces to left.
    leftDelay.connect(leftFeedback);
    leftFeedback.connect(rightDelay);
    
    rightDelay.connect(rightFeedback);
    rightFeedback.connect(leftDelay);
    
    // Re-merge the two delay channels into stereo L/R
    leftFeedback.connect(merger, 0, 0);
    rightFeedback.connect(merger, 0, 1);
    
    effect.addLinearControls( [leftDelay.delayTime, rightDelay.delayTime], "Delay", 0.01, 2.0, 0.01, delayTime );
    effect.addLinearControls( [leftFeedback.gain, rightFeedback.gain], "Feedback", 0.01, 1.0, 0.01, feedback );

    effect.input = splitter;
    effect.output = merger;
    return effect;
}
