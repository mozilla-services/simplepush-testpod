var https = require('https'),
    querystring = require('querystring'),
    url = require('url'),
    debug = require('debug')('server'),
    events = require('events'),
    util = require('util');

function EndPoint(client, url, channelID) {
    this.client = client;
    this.url = url;
    this.channelID = channelID;
}

function Server(minPing, maxPing, pingsPerChannel) {
    this.minPing = minPing;
    this.maxPing = maxPing;
    this.pingsPerChannel = pingsPerChannel;
}

module.exports = Server;

util.inherits(Server, events.EventEmitter);

Server.prototype.registerEndpoint = function(client, endpoint, channelID) {
    var self = this;
    debug("Server Registered: %s", endpoint);
    endPoint = new EndPoint(client, endpoint, channelID);
    this.sendPing(endPoint, 1, this.pingsPerChannel);
};

Server.prototype.sendPing = function(endpoint, version, remainingPings) {
    // TODO: Keep track of pings sent, with uaid, endpoint, version, and time
    debug("Sending ping: %s, %d", endpoint.url, version);
    var self = this;
    var u = url.parse(endpoint.url);
    var data = querystring.stringify({'version': version.toString()});
    var opts = {
        hostname: u.hostname,
        port: u.port,
        method: 'PUT',
        path: u.path,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': data.length
        }
    };

    var req = https.request(opts, function(res) {
        self.emit('sentping', endpoint, version);
    });

    req.write(data);
    req.end();

    remainingPings--;
    if(remainingPings === 0) { 
        return;
    }
    var timeout = Math.floor(Math.random() * (self.maxPing - self.maxPing)) + self.minPing;

    setTimeout(self.sendPing.bind(self, endpoint, ++version, remainingPings), timeout);
};