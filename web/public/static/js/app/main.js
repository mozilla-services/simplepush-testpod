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
});
