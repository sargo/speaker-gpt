const fs = require('fs');
const path = require('path');
const Gpio = require('onoff').Gpio;
const AudioRecorder = require('node-audiorecorder');
const speechToText = require('@google-cloud/speech');
const textToSpeech = require('@google-cloud/text-to-speech');
const { Configuration, OpenAIApi } = require("openai");
const Readable = require('stream').Readable
const Speaker = require('speaker');


require('dotenv').config()

const audioRecorderOptions = {
  program: 'sox',
  silence: 5,
  device: 'hw:1,0',
};
const audioRecorder = new AudioRecorder(audioRecorderOptions)

const sttRequest = {
  config: {
    encoding: 'LINEAR16',
    sampleRateHertz: 16000,
    languageCode: 'pl-PL',
  },
  interimResults: false
};
const sttClient = new speechToText.SpeechClient({projectId: 'speaker-gpt', keyFilename: '.gcloud_key'});
const ttsClient = new textToSpeech.TextToSpeechClient({projectId: 'speaker-gpt', keyFilename: '.gcloud_key'});

const opneaiConfig = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(opneaiConfig);

const button = new Gpio(18, 'in', 'both', {debounceTimeout: 50});


let recordStartTS;
let recordStopTS;


function startRecord() {
  console.log('recording started');
  recordStartTS = Date.now();

  let sttStream = sttClient.streamingRecognize(sttRequest)
    .on(`error`, console.error)
    .on(`data`, async function(data) {
      const transcript = data.results[0].alternatives[0].transcript;
      console.log(`Transcript: '${transcript}'.`);

      try {
        const completion = await openai.createChatCompletion({
          model: "gpt-3.5-turbo",
          messages: [{role: "user", content: transcript}],
        });

        const gptResponse = completion.data.choices[0].message.content;
        console.log(`ChatGPT: ${gptResponse}`);

        const ttsRequest = {
          input: {text: gptResponse},
          voice: {languageCode: 'pl-PL', ssmlGender: 'NEUTRAL'},
          audioConfig: {audioEncoding: 'LINEAR16'},
        };

        const [ttsResponse] = await ttsClient.synthesizeSpeech(ttsRequest);

        const speaker = new Speaker({
          channels: 1,
          bitDepth: 16,
          sampleRate: 24000,
          device: 'hw:1,0',
        });

        const ttsStream = Readable.from(ttsResponse.audioContent);
        ttsStream.pipe(speaker);

      } catch (error) {
        if (error.response) {
          console.log(error.response.status);
          console.log(error.response.data);
        } else {
          console.log(error.message);
        }
      }
    });


  audioRecorder.start().stream().pipe(sttStream);
}

function stopRecord() {
  audioRecorder.stop();
  recordStopTS = Date.now();
  console.log(`recorded ${Math.floor((recordStopTS - recordStartTS) / 1000)}s`);
}

button.watch((err, value) => {
  if (err) {
    throw err;
  }
  if (value === Gpio.LOW) {
    startRecord();
  } else {
    stopRecord();
  }

});

process.on('SIGINT', _ => {
  button.unexport();
});

console.log('Started, press and hold button to start recording');
