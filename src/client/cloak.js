/* cloak client */
/* global cloak:true,module,io:true,console,_:true */

(function() {

  var removeKey = function(val, key, obj) {
    delete obj[key];
  };

  var createCloak = function() {

    var uid;
    var socket;
    var url;
    var events = {};
    var config = {};
    var timerEvents = {};
    var serverConfig;
    var callbacks = {};

    var cloak = {

      _setLibs: function(a, b) {
        _ = a;
        io = b;
      },

      /**
       * Set configuration options for Cloak. These options will be applied
       * immediately if Cloak has already been started (see `cloak.run`), and
       * they will be referenced in all future calls to `clock.run` until
       * overwritten.
       */
      configure: function(configArg) {

        // When specified, the `messages` option should trigger the complete
        // removal of any previously-bound message handlers.
        if (socket && configArg.messages) {
          _(config.messages).forEach(function(handler, name, messageHandlers) {
            socket.removeListener('message-' + name);
            cloak._off('message-' + name, handler);
          });
        }

        _.extend(config, configArg);

        if (socket) {
          cloak._applyConfig(config);
        }
      },

      _applyConfig: function(toApply) {

        _(toApply.messages).forEach(function(handler, name) {
          socket.on('message-' + name, function(data) {
            cloak._trigger('message-' + name, data);
          });
          cloak._on('message-' + name, handler);
        });

        _(toApply.serverEvents).forEach(function(eventHandler, eventName) {
          cloak._on('cloak-' + eventName, eventHandler);
        });

        _.extend(timerEvents, toApply.timerEvents);
      },

      _on: function(event, handler) {
        if (events[event] === undefined) {
          events[event] = [];
        }
        events[event].push(handler);
      },

      _off: function(event, handler) {
        events[event] = _(events[event]).without(handler);
      },

      _trigger: function(event, arg) {
        if (events[event] !== undefined) {
          _.forEach(events[event], function(handler) {
            handler(arg);
          });
        }
      },

      run: function(urlArg) {

        url = urlArg;
        socket = io.connect(url, {
          'force new connection': true
        });

        socket.on('error', function(data) {
          cloak._trigger('cloak-error', data);
        });

        socket.on('connect_error', function(data) {
          cloak._trigger('cloak-error', 'Connect error');
        });

        socket.on('connect_timeout', function(data) {
          cloak._trigger('cloak-error', 'Connect timeout');
        });

        socket.on('connect', function() {
          if (uid === undefined) {
            socket.emit('cloak-begin', {});
          }
          else {
            socket.emit('cloak-resume', {uid: uid});
          }
        });

        socket.on('disconnect', function() {
          cloak._trigger('cloak-disconnect');
        });

        socket.on('connecting', function() {
          cloak._trigger('cloak-connecting');
        });

        socket.on('cloak-roomMemberJoined', function(user) {
          cloak._trigger('cloak-roomMemberJoined', user);
        });

        socket.on('cloak-roomMemberLeft', function(user) {
          cloak._trigger('cloak-roomMemberLeft', user);
        });

        socket.on('cloak-lobbyMemberJoined', function(user) {
          cloak._trigger('cloak-lobbyMemberJoined', user);
        });

        socket.on('cloak-lobbyMemberLeft', function(user) {
          cloak._trigger('cloak-lobbyMemberLeft', user);
        });

        socket.on('cloak-joinedRoom', function(room) {
          cloak._trigger('cloak-joinedRoom', room);
        });

        socket.on('cloak-leftRoom', function(room) {
          cloak._trigger('cloak-leftRoom', room);
        });

        socket.on('cloak-roomCreated', function(rooms) {
          cloak._trigger('cloak-roomCreated', rooms);
        });

        socket.on('cloak-roomDeleted', function(rooms) {
          cloak._trigger('cloak-roomDeleted', rooms);
        });

        socket.on('cloak-beginResponse', function(data) {
          uid = data.uid;
          serverConfig = data.config;
          cloak._trigger('cloak-begin');
        });

        socket.on('cloak-resumeResponse', function(data) {
          if (data.valid) {
            serverConfig = data.config;
            cloak._trigger('cloak-resume');
          }
          else {
            cloak._trigger('cloak-error', 'Could not resume.');
            cloak.stop();
          }
        });

        socket.on('cloak-syncTimer', function(data) {
          var handler = timerEvents[data.name];
          if (handler !== undefined) {
            var val = data.value;

            // compensate for network latency
            if (data.running && data.descending) {
              val -= new Date().getTime() - data.sent;
            }
            else if (data.running) {
              val += new Date().getTime() - data.sent;
            }

            handler(val);
          }
        });

        cloak._applyConfig(config);
      },

      stop: function() {
        this._disconnect();
        cloak._trigger('cloak-end');
        socket.removeAllListeners();
        _.forEach(events, removeKey);
        _.forEach(timerEvents, removeKey);
        socket = null;
      },

      _disconnect: function() {
        socket.disconnect();
      },

      _connect: function() {
        socket.socket.connect();
      },

      connected: function() {
        return socket && socket.socket.connected;
      },

      _callback: function(name, callback) {
        if (callbacks[name] === undefined) {
          callbacks[name] = [];
        }
        callbacks[name].push(callback);
      },

      currentUser: function() {
        return uid;
      },

      message: function(name, arg) {
        if (this.connected()) {
          socket.emit('message-' + name, arg);
        }
        else {
          throw 'Not connected.';
        }
      }

    };

    return cloak;

  };

  if (typeof window === 'undefined') {
    module.exports = createCloak;
  }
  else {
    cloak = createCloak();
  }

}());
