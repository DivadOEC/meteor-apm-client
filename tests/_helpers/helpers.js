var Future = Npm.require('fibers/future');

GetMeteorClient = function (_url) {
  var url = _url || Meteor.absoluteUrl();
  return DDP.connect(url, {retry: false});
}

RegisterMethod = function (F) {
  var id = 'test_' + Random.id();
  var methods = {};
  methods[id] = F;
  Meteor.methods(methods);
  return id;
}

RegisterPublication = function (F) {
  var id = 'test_' + Random.id();
  Meteor.publish(id, F);
  return id;
}

EnableTrackingMethods = function () {
  // var original = Apm.models.methods.processMethod;
  // Apm.models.methods.processMethod = function(method) {
  //   MethodStore.push(method);
  //   original.call(Apm.models.methods, method);
  // };
}

GetLastMethodEvents = function (_indices) {
  if (MethodStore.length < 1) return [];
  var indices = _indices || [0];
  var events = MethodStore[MethodStore.length - 1].events;
  events = Array.prototype.slice.call(events, 0);
  events = events.filter(isNotCompute);
  events = events.map(filterFields);
  return events;

  function isNotCompute (event) {
    return event[0] !== 'compute';
  }

  function filterFields (event) {
    var filteredEvent = [];
    indices.forEach(function (index) {
      if (event[index]) filteredEvent[index] = event[index];
    });
    return filteredEvent;
  }
}

GetPubSubMetrics = function () {
  var metricsArr = [];
  for(var dateId in Apm.models.pubsub.metricsByMinute) {
    metricsArr.push(Apm.models.pubsub.metricsByMinute[dateId]);
  }
  return metricsArr;
}

FindMetricsForPub = function (pubname) {
  var metrics = GetPubSubMetrics();
  var candidates = [];
  for(var lc=0; lc < metrics.length; lc++) {
    var pm = metrics[lc].pubs[pubname];
    if(pm) {
      candidates.push(pm);
    }
  }

  return candidates[candidates.length - 1];
}

GetPubSubPayload = function (detailInfoNeeded) {
  return Apm.models.pubsub.buildPayload(detailInfoNeeded).pubMetrics;
}

Wait = function (time) {
  var f = new Future();
  Meteor.setTimeout(function () {
    f.return();
  }, time);
  f.wait();
  return;
}

GetDataSize = function (docs) {
  if(!(docs instanceof Array)) {
    docs = [docs];
  }
  var size = 0;
  docs.forEach(function(doc) {
    size+= Buffer.byteLength(JSON.stringify(doc));
  });
  return size;
}

CleanTestData = function () {
  MethodStore = [];
  TestData.remove({});
  Apm.models.pubsub.metricsByMinute
  Apm.models.pubsub.metricsByMinute = {};
  Apm.models.pubsub.subscriptions = {};
}

SubscribeAndWait = function(client, name, args) {
  var f = new Future();
  var args = Array.prototype.splice.call(arguments, 1);
  args.push({
    onError: function(err) {
      f.return(err);
    },
    onReady: function() {
      f.return();
    }
  });

  var handler = client.subscribe.apply(client, args);
  var error = f.wait();

  if(error) {
    throw error;
  } else {
    return handler;
  }
};

CompareNear = function(v1, v2, maxDifference) {
  maxDifference = maxDifference || 30;
  var diff = Math.abs(v1 - v2);
  return diff < maxDifference;
};

CloseClient = function(client) {
  var sessionId = client._lastSessionId;
  client.disconnect();
  var f = new Future();
  function checkClientExtence(sessionId) {
    var sessionExists = Meteor.default_server.sessions[sessionId];
    if(sessionExists) {
      setTimeout(function() {
        checkClientExtence(sessionId);
      }, 20);
    } else {
      f.return();
    }
  }
  checkClientExtence(sessionId);
  return f.wait();
};