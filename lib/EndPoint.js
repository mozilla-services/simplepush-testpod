const
    events = require('events'),
    url = require('url'),
    querystring = require('querystring'),
    http = require('http'),
    https = require('http'),
    util = require('util'), 
    debug = require('debug')('EndPoint')
    ;

function EndPoint(client, url, channelID, startingVersion) {
    this.client = client;
    this.url = url;
    this.channelID = channelID;

    // startingVersion allows us to set a different version point for 
    // each channel endpoint. This helps detect dupes
    this.version = (typeof(startingVersion) != 'undefined') ? startingVersion : 0;
    
    // for keeping track 
    this.requestCount = 0;
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

        if (version === self.version) {
            // it's not really a dup, the protocol can send back 
            // the current version id of all channels so the 
            // proper? behaviour is to just ignore it
            return;
        } 

        if (version === self.expectedVersion) {
            self.emitResult('GOT_VERSION_OK');
            self.version = self.expectedVersion;
            return;
        }
        
        // finally ... we don't know what to do w/ it
        self.emitResult('ERR_VER_INVALID', {
            expected: self.expectedVersion,
            got: version
        });
    });
};
util.inherits(EndPoint, events.EventEmitter);

EndPoint.prototype.sendNextVersion = function(waitWSResponse) {
    waitWSResponse = waitWSResponse || 1000;
    var self = this;

    this.sentStartTime = Date.now();
    this.timedout = false;

    var u = url.parse(this.url);
    
    this.expectedVersion = this.version + 1;
    this.requestCount += 1;

    var requestID = this.requestCount;

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

    debug('Sending req #%d on %s, qs=%s', this.requestCount, this.channelID, data);
    var req = http.request(opts, function(res) {
        debug("got response %s", res.statusCode);

        var body = '';

        res.on('data', function(chunk) {
            body += chunk;
        });

        res.once('end', function() {
            if(res.statusCode !== 200) {
                self.emitResult('PUT_FAIL', {
                    id: requestID,
                    code: res.statusCode,
                    body: body
                });
            } else {
                self.emitResult('PUT_OK', {
                    id: requestID,
                    code: res.statusCode,
                    body: body
                });

                // set a timeout for the websocket to send our version 
                // back. This is to measure time it takes for go to 
                // process and send back through the ws
                self.timeoutID = setTimeout(function() {
                    self.timedout = true;
                    self.emitResult("TIMEOUT", waitWSResponse)
                }, waitWSResponse); // make this configurable
            }
        });
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
        , channelID: this.channelID
        , status: status
        , time: t
        , data: data
    });
}

module.exports = EndPoint;
