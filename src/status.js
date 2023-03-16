const Gpio = require('onoff').Gpio;

let status = 'started';
let statusTS = Date.now();

const ledRed = new Gpio(2, 'out');
const ledGreen = new Gpio(3, 'out');
const ledBlue = new Gpio(4, 'out');

function setRGB(red, green, blue) {
  ledRed.write(red);
  ledGreen.write(green);
  ledBlue.write(blue);
}

function getStatus() {
  return status;
}

function setStatus(newStatus) {
  if (newStatus === status) {
    return;
  }
  newStatusTS = Date.now();
  console.log(`Status changed from ${status} to ${newStatus} (${(newStatusTS - statusTS)/1000}s)`);
  status = newStatus;
  statusTS = newStatusTS;

  if (status.startsWith('waiting')) {
    setRGB(0, 0, 1); // blue
  } else if (status === 'error') {
    setRGB(1, 0, 1); // pink
    setTimeout(() => {
      setStatus('idle');
    }, 10*1000);
  } else if (status === 'idle') {
    setRGB(0, 1, 0); // green
  } else if (status === 'recording') {
    setRGB(1, 0, 0); // red
  } else if (status === 'playing') {
    setRGB(1, 1, 1); // white
  } else {
    setRGB(0, 0, 0); // off
  }
}

process.on('SIGINT', () => {
  setRGB(0, 0, 0);
  ledRed.unexport();
  ledGreen.unexport();
  ledBlue.unexport();
});

module.exports = { getStatus, setStatus }
