/** 
* @description MeshCentral event log plugin
* @author Ryan Blenis
* @copyright 
* @license Apache-2.0
*/

"use strict";

module.exports.eventlog = function (parent) {
    var obj = {};
    
    obj.parent = parent;
    obj.meshServer = parent.parent;
    obj.db = null;
    
    // This should be updated to contain functions that need to be brought to the
    //   front end for processing. (If they need to be accessed in the GUI, they should be here)
    obj.exports = [
      'registerPluginTab',
      'on_device_page',
      'fe_on_message',
      'onRemoteEventLogStateChange',
      'createRemoteEventLog',
      'onDeviceRefreshEnd',
      'showLog',
      'loadLogs',
      'eventLogTab',
      'onLoadHistory',
      'loadEventLogMain',
      'filterLog',
      '_pluginPermissions',
      'loadButtons'
    ];
    
    obj._pluginPermissions = function() {
        return {
            "deviceLiveTab": "Event Log: Live Tab",
            "deviceHistoryTab": "Event Log: History Tab"
        };
    };
    
    obj.server_startup = function() {
        // obj.parent.parent.debug('plugin:eventlog', 'Starting eventlog plugin with server');
        //console.log(Object.keys(obj.meshServer.pluginHandler));
        // hack a persistent db here
        obj.meshServer.pluginHandler.eventlog_db = require (__dirname + '/db.js').CreateDB(obj.meshServer);
        obj.db = obj.meshServer.pluginHandler.eventlog_db;
    };
    
    obj.consoleaction = function() {
        // due to this code running on the client side, this hook is actually contained 
        //   in the ./modules_meshcore/eventlog.js (note kept here for informational purposes)
    };
    
    obj.handleAdminReq = function(req, res, user) {
        require(__dirname + '/admin.js').admin(obj).req(req, res, user);
    }
    
    // called to notify the web server that there is a new tab in town
    obj.registerPluginTab = function() {
      if (currentNode.osdesc.toLowerCase().indexOf('windows') === -1) return { tabId: null, tabTitle: null };
      
      return {
        tabTitle: "Event Log",
        tabId: "pluginEventLog"
      };
    };
    
    // called to get the content for that tabs data
    obj.on_device_page = function() {
      return '<div id=pluginEventLog></div>';
    };
    
    obj.filterLog = function(el) {
        var x = Q('pluginEventLog').querySelectorAll(".eventLogRow");
        if (x.length) {
            //reorder by time
            var times  = new Array();
            for (const i in Object.values(x)) {
                times.push([i, x[i].getAttribute('data-time')]);
            }
            times.sort(function(a, b) { if (a[1] === b[1]) { return 0; } else { return (a[1] < b[1]) ? -1 : 1; }});
            for (const i in Object.values(times)) {
                x[times[i][0]].parentNode.prepend(x[times[i][0]]);
            }
            for (const i in Object.values(x)) {
                if (x[i].textContent.toLowerCase().indexOf(el.value.toLowerCase()) === -1) {
                    x[i].classList.add('eventLogFilterHide');
                    x[i].parentNode.appendChild(x[i]);
                } else {
                    x[i].classList.remove('eventLogFilterHide');
                    x[i].parentNode.appendChild(x[i]);
                }
            }
        }
        x = Q('pluginEventLog').querySelectorAll(".eventLogFilterHide, .eventLogHide");
        if (x.length) {
            for (const i in Object.values(x)) {
                x[i].parentNode.appendChild(x[i]);
            }
        }
    };
    
    obj.showLog = function(logOption) {
        var parent = logOption.parentElement;
        var children = parent.querySelectorAll("button");
        for (const i in Object.values(children)) {
              children[i].className = '';
        }
        logOption.className = 'eventLogTabActive';
        var which = logOption.innerHTML;
        var x = parent.parentElement.querySelectorAll(".eventLogRow");
        
        if (x.length)
        for (const i in Object.values(x)) {
            if (!x[i].classList.contains('logType'+which)) {
                x[i].classList.add('eventLogHide');
            } else {
                x[i].classList.remove('eventLogHide');
                x[i].parentNode.appendChild(x[i]);
            }
        }
    };
    
    obj.eventLogTab = function(tabOption, contentId) {
        var parent = tabOption.parentElement;
        var children = parent.querySelectorAll("button");
        for (const i in Object.values(children)) {
              children[i].className = '';
        }
        tabOption.className = 'eventLogTabActive';
        var which = tabOption.innerHTML;
        var x = Q('pluginEventLog').querySelectorAll(".eventLogPage");
        
        if (x.length)
        for (const i in Object.values(x)) {
              x[i].style.display = 'none';
        }
        QS(contentId).display = '';
    };
    
    obj.loadLogs = function(data, container) {
      if (Array.isArray(data)) {
          var tmp = { data: []}
          for (var i in data) {
              tmp.data.push(data[i]);
          }
          data = tmp;
      }
      var etsi = ['LogAlways', 'Critical', 'Error', 'Warning', 'Info', 'Verbose'];
      for (var i in data) {
        var skip = false;
        for (const e of data[i]) {
          var div = document.createElement('div');
          div.classList.add('eventLogRow');
          div.classList.add('logType'+e.LogName);
          const eo = {
            'Level': e.Level,
            'TimeCreated': e.TimeCreated,
            'ProviderName': e.ProviderName,
            'Message': e.Message,
            'Id': e.Id
          }
          for (let [k, v] of Object.entries(eo)) {
            skip = false;
            switch (k) {
              case 'nodeid':
              case '_id':
              case 'time':
              case 'LogName': {
                  skip = true;
              break;
              }
              case 'TimeCreated': {
                if (Array.isArray(v)) {
                  v = v[0];
                }
                v = v.match(/\d+/g);
                div.setAttribute('data-time', v);
                v = new Date(Number(v)).toLocaleDateString() +' '+ new Date(Number(v)).toLocaleTimeString();
              break;
              }
              case 'Level': {
                v = etsi[v];
                break;
              }
              case 'LevelDisplayName': {
                  if (v == 'null' || v == null) {
                      v = 'Error';
                  }
              break;
              }
              default: { break; }
            }
            if (!skip) {
               var span = document.createElement('span');
               span.classList.add('eventlogc'+k);
               span.setAttribute('title', v);
               span.innerHTML = v;
               div.appendChild(span);
            }
          }
          Q(container).appendChild(div);
        }
      }
    };
    
    obj.loadButtons = function(config) {
        if (config.historyEnabled === true) {
          config.historyLogs.split(',').forEach((l) => {
            let tpl = `<button class="" onclick="return pluginHandler.eventlog.showLog(this);">${l}</button>`;
            Q('eventLogHistNav').insertAdjacentHTML('beforeend', tpl);
          });
        }
        config.liveLogs.split(',').forEach((l) => {
          let tpl = `<button class="" onclick="return pluginHandler.eventlog.showLog(this);">${l}</button>`;
          Q('eventLogLogNav').insertAdjacentHTML('beforeend', tpl);
        });
    };
    
    obj.onLoadHistory = function(server, message) {
        if (currentNode.osdesc.toLowerCase().indexOf('windows') === -1) return;
        pluginHandler.eventlog.loadEventLogMain();
        pluginHandler.eventlog.loadButtons(message.config);
        pluginHandler.eventlog.loadLogs(message.events, 'eventLogHistory');
    };
    
    obj.loadEventLogMain = function() {
      if (!Q('eventlogentry')) {
            var cstr = `<div class=eventLogNavClass id=eventLogMainNav>
            <button class=eventLogTabActive onclick="return pluginHandler.eventlog.eventLogTab(this, 'eventlogentry');">Live</button>
            <button onclick="return pluginHandler.eventlog.eventLogTab(this, 'eventLogHistoryContainer');">History</button>
            <span id=eventLogFilter>Filter: <input type="text" onkeyup="return pluginHandler.eventlog.filterLog(this)"></span>
            </div><div id=eventLogHistoryContainer class=eventLogPage style="display:none;">
            <div class=eventLogNavClass id=eventLogHistNav>
              
            </div><div style="clear: both;"></div><div id=eventLogHistory></div></div><div class=eventLogPage id=eventlogentry>
                <style>
                #pluginEventLog .eventLogRow > span {
                  width: 150px;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  float:left;
                  padding: 2px;
                  margin: 0;
                  display: inline-block;
                }
                #pluginEventLog #eventLogFilter {
                      padding: 10px 12px;
                }
                #pluginEventLog .eventLogRow {
                      padding: 2px;
                      display: inline-block;
                }
                #pluginEventLog .eventLogHide {
                    display: none;
                }
                #pluginEventLog .eventLogFilterHide {
                    display: none;
                }
                #pluginEventLog .eventLogRow:nth-child(odd) {
                      background-color: #CCC;
                }
                #pluginEventLog .eventLogRow > span.eventlogcLevel {
                    width: 100px;
                }
                #pluginEventLog .eventLogRow > span.eventlogcTimeCreated {
                    width: 150px;
                }
                #pluginEventLog .eventLogRow > span.eventlogcProviderName {
                    width: 200px;
                }
                #pluginEventLog .eventLogRow > span.eventlogcMessage {
                    width: 400px;
                }
                #pluginEventLog .eventLogRow > span.eventlogcId {
                    width: 50px;
                }
                #eventLogMainNav {
                  overflow: hidden;
                  border: 1px solid #ccc;
                  background-color: #f1f1f1;
                }
                .eventLogNavClass button {
                  background-color: inherit;
                  float: left;
                  border: none;
                  outline: none;
                  cursor: pointer;
                  padding: 10px 12px;
                  transition: 0.3s;
                }
                .eventLogNavClass button:hover {
                  background-color: #ddd;
                }
                .eventLogNavClass button.eventLogTabActive {
                  background-color: #ccc;
                }
                .eventLogPage {
                  padding: 6px 12px;
                  border: 1px solid #ccc;
                  border-top: none;
                }
                </style>
                <div class=eventLogNavClass id=eventLogLogNav>
                </div>
                <div style="clear: both;"></div>
                <div id=eventLogLive></div>`;
                QH('pluginEventLog', cstr);
      }
    };
    
    // called when a new plugin message is received on the front end
    obj.fe_on_message = function(server, message) {
      var data = JSON.parse(message);
      if (data.type == 'close') {
        pluginHandler.eventlog.livelog.Stop();
        pluginHandler.eventlog.livelog = null;
        return;
      }
      pluginHandler.eventlog.loadEventLogMain();
      pluginHandler.eventlog.loadLogs(data.data, 'eventLogLive');
    };
    
    obj.onRemoteEventLogStateChange = function(xdata, state) {
        var str = StatusStrs[state];
        if (pluginHandler.eventlog.webRtcActive == true) { str += ', WebRTC'; }
        switch (state) {
            case 0:
                if (pluginHandler.eventlog.livelog != null) {
                  pluginHandler.eventlog.livelog.Stop(); 
                  pluginHandler.eventlog.livelog = null; 
                  try { QH('pluginEventLog', ''); } catch(e) { }
                }
                break;
            case 3:
                if (pluginHandler.eventlog.livelog) {
                  pluginHandler.eventlog.livelog.sendText({ action: 'plugin', plugin: 'eventlog', pluginaction: 'getlivelogs' });
                }
                break;
            default:
                //console.log('unknown state change', state);
            break;
        }
    }
    
    obj.createRemoteEventLog = function(onEventLogUpdate) {
        var myobj = { protocol: 7 }; // we're a plugin
        myobj.onEventLogUpdate = onEventLogUpdate;
        myobj.xxStateChange = function(state) { }
        myobj.ProcessData = function(data) { onEventLogUpdate(null, data); }
        return myobj;
    }
    
    obj.onDeviceRefreshEnd = function(nodeid, panel, refresh, event) {
      pluginHandler.registerPluginTab(pluginHandler.eventlog.registerPluginTab());
      if (typeof pluginHandler.eventlog.livelog == 'undefined') { pluginHandler.eventlog.livelog = null; }
      if (pluginHandler.eventlog.livelog != null) { pluginHandler.eventlog.livelog.Stop(); pluginHandler.eventlog.livelog = null; }
      try { QH('pluginEventLog', ''); } catch(e) { } pluginHandler.eventlog.livelog = null;
      if (!pluginHandler.eventlog.livelog) {
          pluginHandler.eventlog.livelognode = currentNode;
          // Setup a mesh agent files
          if (pluginHandler.eventlog.livelognode.conn) {
              pluginHandler.eventlog.livelog = CreateAgentRedirect(meshserver, pluginHandler.eventlog.createRemoteEventLog(pluginHandler.eventlog.fe_on_message), serverPublicNamePort, authCookie, authRelayCookie, domainUrl);
              pluginHandler.eventlog.livelog.attemptWebRTC = attemptWebRTC;
              pluginHandler.eventlog.livelog.onStateChanged = pluginHandler.eventlog.onRemoteEventLogStateChange;
              pluginHandler.eventlog.livelog.onConsoleMessageChange = function () {
                  if (pluginHandler.eventlog.livelog.consoleMessage) {
                      console.log('console message available. ', pluginHandler.eventlog.livelog.consoleMessage)
                  }
              }
              pluginHandler.eventlog.livelog.Start(pluginHandler.eventlog.livelognode._id);
          }
      } else {
          //QH('Term', '');
          pluginHandler.eventlog.livelog.Stop();
          pluginHandler.eventlog.livelog = null;
      }
      // get node historical events
      let meshid = null;
      nodes.forEach(function(n, i) {
          if (n._id == nodeid) meshid = n.meshid;
      });
      meshserver.send({ action: 'plugin', plugin: 'eventlog', pluginaction: 'getNodeHistory', nodeid: nodeid, meshid: meshid });
    };
    
    obj.hook_agentCoreIsStable = function(myparent, grandparent) {
        //console.log(new Date().toLocaleString()+' PLUGIN: eventlog: Running hook_agentCoreIsStable', myparent.dbNodeKey);
        if (grandparent == null) { // detect old style call with single argument, backward compat, to be removed in the future.
            grandparent = myparent[1];
            myparent = myparent[0];
        }
        myparent.send(JSON.stringify({ 
            action: 'plugin', 
            pluginaction: 'serviceCheck', 
            plugin: 'eventlog',
            nodeid: myparent.dbNodeKey, 
            rights: true,
            sessionid: true
        }));
        obj.db.getConfigFor(myparent.dbNodeKey, myparent.dbMeshKey)
        .then((cfgBlob) => {
            myparent.send(JSON.stringify({ 
                action: 'plugin', 
                pluginaction: 'setConfigBlob', 
                plugin: 'eventlog',
                nodeid: myparent.dbNodeKey, 
                rights: true,
                sessionid: true,
                cfg: cfgBlob
            }));
        });
    };
    
    // data was sent to server from the client. do something with it.
    obj.serveraction = function(command, myparent, grandparent) {
      var myobj = {};
      myobj.parent = myparent;

      if (command.uid) { // check to see if config is valid/current, if not, send update
        obj.db.checkConfigAuth(command.uid)
        .then((cnt) => {
          if (cnt == 0) {
              obj.db.getConfigFor(myparent.dbNodeKey, myparent.dbMeshKey)
              .then((cfgBlob) => {
                myparent.send(JSON.stringify({ 
                    action: 'plugin', 
                    pluginaction: 'setConfigBlob', 
                    plugin: 'eventlog',
                    nodeid: myparent.dbNodeKey, 
                    rights: true,
                    sessionid: true,
                    cfg: cfgBlob
                }));
              });
          }
        });
      }
      
      switch (command.pluginaction) {
        case 'sendlog': {
          command.method = 'fe_on_message';
          if (command.sessionid != null) {
              if (typeof command.sessionid != 'string') break;
              var splitsessionid = command.sessionid.split('/');
              // Check that we are in the same domain and the user has rights over this node.
              if ((splitsessionid[0] == 'user') && (splitsessionid[1] == myobj.parent.domain.id)) {
                  // Check if this user has rights to get this message
                  //if (mesh.links[user._id] == null || ((mesh.links[user._id].rights & 16) == 0)) return; // TODO!!!!!!!!!!!!!!!!!!!!!
                  
                  // See if the session is connected. If so, go ahead and send this message to the target node
                  var ws = grandparent.wssessions2[command.sessionid];
                  if (ws != null) {
                      command.nodeid = parent.dbNodeKey; // Set the nodeid, required for responses.
                      delete command.sessionid;       // Remove the sessionid, since we are sending to that sessionid, so it's implyed.
                      try { ws.send(JSON.stringify(command)); } catch (ex) { }
                  }
              }
          } else {
            
          }
          
          break;
        }
        case 'gatherlogs': { // submit logs to server db
            try {
                //console.log('Gathering logs for: '+myparent.dbNodeKey+' with data', command.data);
                obj.meshServer.pluginHandler.eventlog_db.addEventsFor(myparent.dbNodeKey, JSON.parse(command.data));
                obj.meshServer.pluginHandler.eventlog_db.getLastEventFor(myparent.dbNodeKey, function (rec) {
                    // send a message to the endpoint verifying receipt
                    // temp: fake a console message until the below makes it into master project

                    myparent.send(JSON.stringify({ 
                        action: 'plugin', 
                        pluginaction: 'setLVDOC', 
                        plugin: 'eventlog',
                        nodeid: myparent.dbNodeKey, 
                        rights: true,
                        sessionid: true,
                        value: rec[0].TimeCreated[0]
                    }));
                
                });
              } catch (e) { console.log('Error gathering logs: ', e.stack); } 
            //console.log(new Date().toLocaleString()+' PLUGIN: eventlog: Running gatherlogs')
        }
        case 'getNodeHistory': {
            try {
                obj.db.getConfigFor(command.nodeid, command.meshid)
                .then((cfg) => {
                  obj.db.getEventsFor(command.nodeid, cfg, function(events){
                    if (myobj.parent.ws != null) {
                        myobj.parent.ws.send(JSON.stringify({ action: 'plugin', plugin: 'eventlog', method: 'onLoadHistory', events: events, config: cfg }));
                    }
                  });
                });
            } catch (e) { console.log('PLUGIN: eventlog: getNodeHistory error: ', e); }
          break;
        }
        case 'adminSaveConfig': {
            let opts = {...command.opts, ...{}};
            var selected = null;
            if (command.id == '_default') {
                obj.db.updateDefaultConfig(opts)
                .catch((e) => console.log('EVENTLOG: Something went wrong saving the config'));
            } else {
                obj.db.updateConfig(command.id, opts)
                .then((d) => {
                  selected = d.insertedId || command.id;
                  return obj.db.getAllConfigSets();
                })
                .then((d) => {
                  var x = { action: "plugin", plugin: "eventlog", method: "adminUpdateConfigSets", sets: d };
                  x.selected = selected;
                  myobj.parent.ws.send(JSON.stringify(x));
                })
                .catch((e) => console.log('EVENTLOG: Something went wrong saving the config', e));
            }
            break;
        }
        case 'adminDeleteConfig': {
            let id = command.id;
            obj.db.deleteConfigSet(command.id)
            .then((d) => {
              var x = { action: "plugin", plugin: "eventlog", method: "adminConfigDeleted", id: command.id };
              myobj.parent.ws.send(JSON.stringify(x));
            })
            .catch((e) => console.log('EVENTLOG: Something went wrong deleting the config'));
            break;
        }
        case 'adminAssignConfig': { // configId, nodes, meshes
            obj.db.assignConfig(command.configId, command.selection)
            .then(obj.db.getConfigAssignments)
            .then((d) => {
              var configAssignments = [];
              d.forEach((s) => {
                configAssignments.push({ asset: s.asset, configId: s.configId });
              });
              var x = { action: "plugin", plugin: "eventlog", method: "setsAssigned", data: configAssignments};
              myobj.parent.ws.send(JSON.stringify(x));
            })
            .catch((e) => console.log('EVENTLOG: Something went wrong assigning the config: ', e));
            break;
        }
        default: {
          break;
        }
      }
    }
    
    return obj;
};
