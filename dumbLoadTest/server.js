var WebSocketServer = require('ws').Server
  , http = require('http')
  , express = require('express')
  , app = express()
  , debug = require('debug')
  , debugServer = debug('server')
  , debugWS = debug("ws");

app.use(express.static(__dirname + '/web/public'));

var server = http.createServer(app);
var port = process.env.PORT || 4000
server.listen(port);
debugServer("Listening on: " + port);

var wss = new WebSocketServer({server: server});
var clients = 0;
wss.on('connection', function(ws) {
  clients += 1;

  var cid = clients;

  var id = setInterval(function() {
    ws.send(JSON.stringify({t: Date.now()}));
  }, 1500);

  debugWS('#%d connected', cid);

  ws.on('close', function() {
    debugWS('#%d disconnected', cid);
    clearInterval(id);
  });
});
