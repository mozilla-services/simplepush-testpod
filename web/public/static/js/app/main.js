/*
 * Main Application ... 
 */
define([
    'jquery'
    , "model/Stats"
    , "view/NumberFormatted"
], function(
    $

    // models
    , StatsModel

    // views
    , NumberFormattedView
) {
    var statsModel = new StatsModel()

    // inject some fake data...
    /*
    var i = setInterval(function() {
        statsModel.set('conn_current', statsModel.get('conn_current') + 37)
        var pSent = statsModel.get('ping_sent') + Math.round(Math.random(1));

        statsModel.set('conn_attempted', statsModel.get('conn_attempted') + 1)
        if (Math.round(Math.random(1)) === 0) {
            statsModel.set('conn_fail', statsModel.get('conn_fail') + 1)
        } else {
            statsModel.set('conn_ok', statsModel.get('conn_ok') + 1)
        }

        statsModel.set('ping_sent', statsModel.get('ping_sent') + 1)
        if (Math.round(Math.random(1)) === 0) {
            statsModel.set('ping_timeout', statsModel.get('ping_timeout') + 1)
        } else {
            statsModel.set('ping_received', statsModel.get('ping_received') + 1)
        }

    }, 250);
    */

    $(function() {
        // update the UI when the stats model changes
        for(k in statsModel.defaults) {
            new NumberFormattedView({
                model: statsModel
                , watch: k
                , el : "#" + k
            });

        }
    });


    // startup a websocket connection
    var ws;
    var connectInterval = 1000;

    function startWS() {
        ws = new WebSocket("ws://"+window.location.hostname + ":" + window.location.port);
        ws.onerror = function(e) {
            $('#connectionStatus')
                .text('Error: ' + e)
                .attr('class', '')
                .addClass('disconnected');
        };

        ws.onopen = function(e) {
            $('#connectionStatus')
                .text('open')
                .attr('class', '')
                .addClass('connected');

            connectInterval = 1000;
        };

        ws.onmessage = function(e) {
            try {
                var data = JSON.parse(e.data);
                if (data.connections) statsModel.set('conn_current', data.connections);
                if (data.pings) {
                    if (data.pings.sent) statsModel.set('ping_sent', data.pings.sent);
                    if (data.pings.received) statsModel.set('ping_received', data.pings.received);
                    if (data.pings.avg) statsModel.set('ping_avg', data.pings.avg);
                    if (data.pings.median) statsModel.set('ping_median', data.pings.median);
                }

            } catch(e) {
                console.log("ERROR", e);
            }
        };

        ws.onclose = function() {
            console.log("WS Waiting ", connectInterval, " before reconnecting");
            $('#connectionStatus')
                .text('Waiting ' + connectInterval + ' to retry')
                .attr('class', '')
                .addClass('disconnected');

            setTimeout(startWS, connectInterval);
        }
        connectInterval = Math.floor((connectInterval*1.5));
    }

    startWS();
});
