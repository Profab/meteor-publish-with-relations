Meteor.publishWithRelations = function (params) {
  var associations, collection, collectionHandle, doMapping, filter, options, pub, publishAssoc;
  pub = params.handle;
  collection = params.collection;
  associations = {};
  publishAssoc = function (collection, filter, options) {
    return collection.find(filter, options).observeChanges({
      added: (function (_this) {
        return function(id, fields) {
          return pub.added(collection._name, id, fields);
        };
      })(this),
      changed: (function (_this) {
        return function(id, fields) {
          return pub.changed(collection._name, id, fields);
        };
      })(this),
      removed: (function (_this) {
        return function(id) {
          return pub.removed(collection._name, id);
        };
      })(this)
    });
  };
  doMapping = function (id, obj, mappings) {
    var mapFilter, mapOptions, mapping, objKey, _i, _len, _ref, _results;
    if (!mappings) {
      return;
    }
    _results = [];
    for (_i = 0, _len = mappings.length; _i < _len; _i++) {
      mapping = mappings[_i];
      mapFilter = {};
      mapOptions = {};
      if (mapping.reverse) {
        objKey = mapping.collection._name;
        mapFilter[mapping.key] = id;
      } else {
        objKey = mapping.key;
        if (mapping.childKey) {
          var childKey = mapping.childKey;
          mapFilter[childKey] = obj[mapping.key];
          if (_.isArray(mapFilter[childKey])) {
            mapFilter[childKey] = {
              $in: mapFilter[childKey]
            };
          }
        } else {
          mapFilter._id = obj[mapping.key];
          if (_.isArray(mapFilter._id)) {
            mapFilter._id = {
              $in: mapFilter._id
            };
          }
        }
      }
      _.extend(mapFilter, mapping.filter);
      _.extend(mapOptions, mapping.options);
      if (mapping.mappings) {
        _results.push(Meteor.publishWithRelations({
          handle: pub,
          collection: mapping.collection,
          filter: mapFilter,
          options: mapOptions,
          mappings: mapping.mappings,
          _noReady: true
        }));
      } else {
        if ((_ref = associations[id][objKey]) != null) {
          _ref.stop();
        }
        _results.push(associations[id][objKey] = publishAssoc(mapping.collection, mapFilter, mapOptions));
      }
    }
    return _results;
  };
  filter = params.filter;
  options = params.options;
  collectionHandle = collection.find(filter, options).observeChanges({
    added: function (id, fields) {
      pub.added(collection._name, id, fields);
      if (associations[id] == null) {
        associations[id] = {};
      }
      return doMapping(id, fields, params.mappings);
    },
    changed: function (id, fields) {
      _.each(fields, function (value, key) {
        var changedMappings;
        changedMappings = _.where(params.mappings, {
          key: key,
          reverse: false
        });
        return doMapping(id, fields, changedMappings);
      });
      return pub.changed(collection._name, id, fields);
    },
    removed: function (id) {
      var handle, _i, _len, _ref;
      _ref = associations[id];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        handle = _ref[_i];
        handle.stop();
      }
      return pub.removed(collection._name, id);
    }
  });
  if (!params._noReady) {
    pub.ready();
  }
  return pub.onStop(function () {
    var association, handle, id, key;
    for (id in associations) {
      association = associations[id];
      for (key in association) {
        handle = association[key];
        handle.stop();
      }
    }
    return collectionHandle.stop();
  });
};
