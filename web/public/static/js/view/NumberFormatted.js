define(['jquery', 'backbone', 'lib/number_format'], function($, Backbone, number_format) {
  return Backbone.View.extend({
    initialize: function(options) {
      var onChange;

      if ((options != null ? options.watch : void 0) == null) {
        throw "No attribute for NumberFormatted";
      }
      onChange = function(model, amount) {
        var out;

        if ((options.squish != null) && options.squish === true) {
          out = amount > 999999 ? "" + (Math.round(amount / 1000000 * 100) / 100) + "M" : amount > 999 ? "" + (Math.round(amount / 1000 * 100) / 100) + "K" : number_format(amount);
        } else {
          out = number_format(amount);
        }
        return this.$el.text(out);
      };
      this.listenTo(options.model, "change:" + options.watch, onChange, this);
      return onChange.call(this, options.model, options.model.get(options.watch));
    }
  });
});
