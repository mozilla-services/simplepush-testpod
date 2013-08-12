define([
    "_"
    , "backbone"
], function(
    _
    , Backbone
) {
    return Backbone.Model.extend({
        defaults: {
            // current connections
            conn_current: 0

            // Connection Stats
            , conn_attempted : 0
            , conn_ok        : 0
            , conn_fail      : 0
            , conn_rate      : 100

            // Ping Stats
            , ping_sent     : 0
            , ping_received : 0
            , ping_timeout  : 0
            , ping_rate     : 12

            // Response Time
            , response_avg : 0
            , response_med : 0
        }

        , initialize: function(options) {

            this.on('change:conn_attempted, change:conn_ok', function(m) {
                var rate = Math.round(m.get('conn_ok')/m.get('conn_attempted')*100);
                m.set('conn_rate', rate);
            });

            this.on('change:ping_sent, change:ping_received', function(m) {
                var rate = Math.round(m.get('ping_received')/m.get('ping_sent')*100);
                m.set('ping_rate', rate);
            });
        }
    });
});
