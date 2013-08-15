define(['jquery', 'backbone'], function($, Backbone) {
    return Backbone.View.extend({
        initialize: function(options) {
            if (!options || !options.watch) {
                throw new Error("missing an option");
            }

            var evt = "change:"+options.watch;
            var self = this;
            options.model.listenTo(options.model, evt, function(m, v) {
                self.$el.text(v);
            });
        }
    });
});
