mkdir -p data
docker run -d -p 27017:27017 -v data:/data/db mongo
rm /tmp/server-output.log
nohup node server/server.js > /tmp/server-output.log &
npm run serve
