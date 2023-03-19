require('dotenv').config()

const { getStatus, setStatus } = require('./status');

setStatus('initializing');

const fs = require('fs');
const path = require('path');
const Gpio = require('onoff').Gpio;
const AudioRecorder = require('node-audiorecorder');
const speechToText = require('@google-cloud/speech');
const textToSpeech = require('@google-cloud/text-to-speech');
const { Configuration, OpenAIApi } = require('openai');
const Readable = require('stream').Readable
const Speaker = require('speaker');

const button = new Gpio(26, 'in', 'falling', {debounceTimeout: 50});

const audioRecorderOptions = {
  program: 'sox',
  silence: 2.5,
  device: 'hw:1,0',
};
const audioRecorder = new AudioRecorder(audioRecorderOptions)

const speakerConfig = {
 channels: 1,
 bitDepth: 16,
 sampleRate: 22050,
 device: 'hw:1,0',
};
let speaker = null;

const sttRequest = {
  config: {
    encoding: 'LINEAR16',
    sampleRateHertz: 16000,
    languageCode: 'pl-PL',
  },
  interimResults: false
};
const sttClient = new speechToText.SpeechClient({projectId: 'speaker-gpt', keyFilename: '.gcloud_key'});

const ttsRequest = {
  voice: {languageCode: 'pl-PL', ssmlGender: 'NEUTRAL'},
  audioConfig: {audioEncoding: 'LINEAR16', sampleRateHertz: 22050},
};
const ttsClient = new textToSpeech.TextToSpeechClient({projectId: 'speaker-gpt', keyFilename: '.gcloud_key'});

const opneaiConfig = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(opneaiConfig);


function startRecord() {
  setStatus('recording');

  let sttStream = sttClient.streamingRecognize(sttRequest)
    .on('error', (err) => {
      setStatus('error');
      console.error(err);
    })
    .on('data', async (data) => {
      const transcript = data.results[0].alternatives[0].transcript;
      console.log(`Input: '${transcript}'.`);

      setStatus('waiting-gpt');
      try {
        const completion = await openai.createChatCompletion({
          model: 'gpt-3.5-turbo',
          messages: [{role: 'user', content: transcript}],
        });

        const gptResponse = completion.data.choices[0].message.content;
        console.log(`Output: ${gptResponse}`);

        setStatus('waiting-tts');
        const [ttsResponse] = await ttsClient.synthesizeSpeech({input: {text: gptResponse}, ...ttsRequest});

        setStatus('playing');
        const ttsStream = Readable.from(ttsResponse.audioContent);
        speaker = new Speaker(speakerConfig);
        speaker.on('error', (err) => {
          setStatus('error');
          console.error(err);
          speaker = null;
        });
        speaker.on('close', () => {
          setStatus('idle');
          speaker = null;
        });

        ttsStream.pipe(speaker);

      } catch (error) {
        setStatus('error');
        if (error.response) {
          console.error(error.response.status);
          console.error(error.response.data);
        } else {
          console.error(error.message);
        }
      }
    });


  audioRecorder.start().stream().pipe(sttStream);
  audioRecorder.on('close', () => {
    setStatus('waiting-stt');
  });
  // avoid recording for too long in a noisy environment
  setTimeout(() => {
    if(getStatus() === 'recording') {
      audioRecorder.stop();
    }
  }, 10*1000); // 10s
}

button.watch((err, value) => {
  if (err) {
    setStatus('error');
    throw err;
  }
  const status = getStatus();
  if (status === 'playing' && speaker) {
    // speaker.close will throw error so let's disable event handler first
    speaker.removeAllListeners('error');
    speaker.on('error', () => {});
    speaker.close(true);
  }
  else if (status === 'idle') {
    startRecord();
  }
});

process.on('SIGINT', _ => {
  button.unexport();
});

console.log('Started, press button to start recording');

setStatus('idle');
