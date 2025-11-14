// AudioWorklet processor for capturing microphone input
// This replaces the deprecated ScriptProcessorNode

class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];

    if (input && input.length > 0) {
      const inputChannel = input[0];

      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex++] = inputChannel[i];

        // When buffer is full, send it to the main thread
        if (this.bufferIndex >= this.bufferSize) {
          // Convert to Int16Array for PCM encoding
          const int16Buffer = new Int16Array(this.bufferSize);
          for (let j = 0; j < this.bufferSize; j++) {
            int16Buffer[j] = Math.max(-1, Math.min(1, this.buffer[j])) * 32768;
          }

          // Send to main thread
          this.port.postMessage({
            type: 'audioData',
            data: int16Buffer.buffer,
          }, [int16Buffer.buffer]); // Transfer ownership for performance

          // Reset buffer
          this.buffer = new Float32Array(this.bufferSize);
          this.bufferIndex = 0;
        }
      }
    }

    // Return true to keep the processor alive
    return true;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
