# Speaker-GPT

## Configuration

Copy `.env.default` to `.env`.

```
cp .env.default .env
```

### OpenAI API key

After registration on [OpenAI API](https://platform.openai.com/signup) go to
[API Keys](https://platform.openai.com/account/api-keys) page and create new secret key.

New key paste in `.env` file (`OPENAI_API_KEY` variable name).

### Google Cloud

Setup Google Cloud account. As a result you should get `~/.config/gcloud/application_default_credentials.json` file.

### GPIO

Append to `/boot/config.txt`:
```
gpio=2=op,dl
gpio=3=op,dl
gpio=4=op,dl
gpio=26=ip,pu
```

Reboot, so that gpio is set properly:
```
sudo reboot
```

## Installation

Install Speaker-GPT:
```
sudo apt-get install nodejs npm
sudo apt-get install sox libsox-fmt-all libasound2-dev

git clone https://github.com/sargo/speaker-gpt.git
cd speaker-gpt
npm install
```

Check is it starting up properly:
```
npm run debug
```

### Start on boot

```
sudo npm install pm2 -g
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```
