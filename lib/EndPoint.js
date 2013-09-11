const
    events = require('events'),
    url = require('url'),
    querystring = require('querystring'),
    util = require('util'), 
    debug = require('debug')('EndPoint'),
    debugTimeout = require('debug')('EndPoint:timeout')
    ;

var DOUT = (typeof(process.env.NODEBUG) == 'undefined');

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

    this.timeoutID = null;
    this.timedout = false;

    // when the next version update should be
    // mostly used by lib/Server.js
    this.updateCount = 0;  // num. updates we've got
    this.expectingUpdate = false;
    this.nextVersionRequest = 0;
    this.queued = false; /// for controlling the send queue in Server
};

util.inherits(EndPoint, events.EventEmitter);

EndPoint.prototype.updateVersion = function(version) {

    if (this.expectingUpdate === false) {
        // this is to control a race condition w/ requests that 
        // timeout and then we eventually get them
        return;
    }

    debug("Got Version (%s): %d", this.channelID, version);
    if (version === this.version) {
        // it's not really a dup, the protocol can send back 
        // the current version id of all channels so the 
        // proper? behaviour is to just ignore it
        return;
    } 

    // update our semaphores, so the server process can schedule new in the future
    this.expectingUpdate = false;
    this.nextVersionRequest = 0;

    if (version === this.expectedVersion) {
        this.version = this.expectedVersion;
        this.emitResult('GOT_VERSION_OK', Date.now() - this.serverPutTime);
        return;
    }
    
    // finally ... we don't know what to do w/ it
    this.emitResult('ERR_VER_INVALID', {
        expected: this.expectedVersion,
        got: version
    });
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
