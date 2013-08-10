var https = require('https'),
    querystring = require('querystring'),
    url = require('url');

function Server(minPing, maxPing, pingsPerChannel) {
    this.minPing = minPing;
    this.maxPing = maxPing;
    this.pingsPerChannel = pingsPerChannel;
}


Server.prototype.registerEndpoint = function(endpoint) {
    var self = this;
    console.log("Server Registered: %s", endpoint);
    this.sendPing(endpoint, 1, this.pingsPerChannel);
};

Server.prototype.sendPing = function(endpoint, version, remainingPings) {
    console.log("Sending ping: %s, %d", endpoint, version);
    var self = this;
    var u = url.parse(endpoint);
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

    var req = https.request(opts, function(res) {});
    req.write(data);
    req.end();

    version++;
    remainingPings--;
    if(remainingPings === 0) { 
        return;
    }
    var timeout = Math.floor(Math.random() * (self.maxPing - self.maxPing)) + self.minPing;
    setTimeout(function(e, v, r) { self.sendPing(e, v, r); }, timeout, endpoint, version, remainingPings);
};


module.exports = Server;
