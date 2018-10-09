# ref-binder

little data-structure for managing event-oriented relationships

API likely to change. :)

## Example Usage

````javascript

var RefBinder = require('ref-binder');

// currently assumes you are using backbone
var model = new Backbone.Model();
var view = new Backbone.View();

// create a set of references for a view
var refs = new RefBinder(view);

// bind model events to view methods
refs.set('item1',model,{
  'change': 'render',
  'fetch': 'showLoader',
  'sync': 'hideLoader'
});

// get a reference to the bound model object
var item1 = refs.get('item1');

// properly de-reference and unbind the model
refs.unset('item1');

// dereference everything when you are ready to destroy the view
refs.unsetAll();


````
