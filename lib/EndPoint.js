const
    events = require('events'),
    url = require('url'),
    querystring = require('querystring'),
    http = require('http'),
    https = require('http'),
    util = require('util'), 
    debug = require('debug')('EndPoint')
    ;

function EndPoint(client, url, channelID) {
    this.client = client;
    this.url = url;
    this.channelID = channelID;
    this.version = 0;
    
    // for keeping track 
    this.sentStartTime = 0;

    this.expectedVersion = 0;

    this.timeoutID = -1;
    this.timedout = false;

    var self = this;

    client.on(channelID, function(version) {

        // timedout is set when we send the initial request
        if (self.timedout === true) return;

        // no need to timeout anymore
        clearTimeout(self.timeoutID);
        debug("Cleared Timeout");

        if (version === self.expectedVersion) {
            self.emitResult('GOT_VERSION_OK');
            self.version = self.expectedVersion;
        } else {
            self.emitResult('ERR_VER_MISMATCH');
        }
    });
};
util.inherits(EndPoint, events.EventEmitter);

EndPoint.prototype.sendNextVersion = function() {
    var self = this;

    this.sentStartTime = Date.now();
    this.timedout = false;

    var u = url.parse(this.url);
    
    this.expectedVersion = this.version + 1;
    var data = querystring.stringify({'version': this.expectedVersion.toString()});
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

    debug('Sent New Version %d', this.expectedVersion);
    var req = http.request(opts, function(res) {
        debug("got response %s", res.statusCode);
        if(res.statusCode !== 200) {
            self.emitResult('ERR_SERVER', res.statusCode);
        } else {
            self.emitResult('SERVER_OK', res.statusCode);

            // set a timeout for the websocket to send our version 
            // back. This is to measure time it takes for go to 
            // process and send back through the ws
            self.timeoutID = setTimeout(function() {
                self.timedout = true;
                self.emitResult("TIMEOUT")
            }, 1000); // make this configurable
        }


        res.on('data', function() {});
    });

    req.on('error', function(e) {
        self.emitResult('ERR_NETWORK', e);
        debug('Request Error: %s', e);
    });

    req.write(data);
    req.end();
};

EndPoint.prototype.emitResult = function(status, data) {
    data = data || false;

    var t = Date.now() - this.sentStartTime;

    this.emit('result', {
        endpoint: this
        , status: status
        , time: t
        , data: data
    });
}

module.exports = EndPoint;
