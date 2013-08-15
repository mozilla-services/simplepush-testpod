const
    events = require('events'),
    url = require('url'),
    querystring = require('querystring'),
    util = require('util'), 
    debug = require('debug')('EndPoint'),
    debugTimeout = require('debug')('EndPoint:timeout')
    ;

function EndPoint(http, client, url, channelID, startingVersion) {
    this.http = http;
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

    this.timeoutID = null;
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
            self.emitResult('GOT_VERSION_OK', Date.now() - self.serverPutTime);
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
    var req = this.http.request(opts, function(res) {
        debug("got response %s", res.statusCode);

        var body = '';

        res.on('data', function(chunk) {
            body += chunk;
        });

        res.once('end', function() {
            // these are inside the `end` event because we want the 
            // response body in the emitted event.
            if(res.statusCode !== 200) {
                self.emitResult('PUT_FAIL', {
                    id: requestID,
                    code: res.statusCode,
                    body: body
                });
            } else {
                self.serverPutTime = Date.now();
                self.emitResult('PUT_OK', {
                    id: requestID,
                    code: res.statusCode,
                    body: body
                });

                /**
                 * this guards against a possible race condition, where
                 * the version update comes *BACK* before 
                 * the response has finished sending.
                 *
                 * how can this happen? websocket notifications can
                 * carry multiple channel version updates. So the push server
                 * has already sent out notifications (and we got them) before
                 * `res.end` is emitted .
                 *
                 * In this rare case, < 0.02% of the time, we have a timeout
                 * that always triggers because the code that clears the timeout
                 * has already run before the timeout was created.
                 *
                 */
                if (self.version === self.expectedVersion) {
                    debugTimeout("Skip timeout creation, version already updated");
                    self.emitResult("SKIP_TIMEOUT_CREATE");
                } else {
                    // set a timeout for the websocket to send our version back.
                    // so we can test that messages are delivered within 
                    // under a specific time
                    self.timeoutID = setTimeout(function() {
                        debugTimeout("Timed out. ver: %d, expected: %d", 
                            self.version,
                            self.expectedVersion
                        );

                        self.timedout = true;
                        self.emitResult("TIMEOUT", waitWSResponse)
                    }, waitWSResponse); // make this configurable
                }
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
