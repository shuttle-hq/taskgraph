mkdir -p ~/.taskgraph
docker run -d -p 27017:27017 -v ~/.taskgraph/data:/data/db mongo
rm /tmp/server-output.log
nohup node server/server.js > /tmp/server-output.log &
npm run serve
