const MIIOcommandsVocabulary = require('../lib/commandsLib.js');
const MIIOdevtypesVocabulary = require('../lib/devtypesLib.js');
const EventEmitter = require('events');
const mihome = require('node-mihome');

module.exports = function(RED) {
  function MIIOdevicesNode(n) {
    RED.nodes.createNode(this,n);
    let node = this;

    node.name = n.name;
    node.room = n.room;
    node.MI_id = n.MI_id;
    node.device_type = n.device_type;
    node.model = n.model;

    node.address = n.address;
    node.token = n.token;
    
    node.isMIOT = n.isMIOT;
    node.username = n.username;
    node.password = n.password
    

    // 0) Transfering data from runtime to filter commands CONFIG-node and commands in SEND-node
    var NODE_PATH = '/node-red-contrib-miio-localdevices/nodes/';
    
    RED.httpAdmin.get(NODE_PATH + 'getHumidList/', function (req, res) {
      var ImportedHumidList = MIIOdevtypesVocabulary.humid_list();
      res.json(ImportedHumidList);
    });
    RED.httpAdmin.get(NODE_PATH + 'getPurifList/', function (req, res) {
      var ImportedPurifList = MIIOdevtypesVocabulary.purif_list();
      res.json(ImportedPurifList);
    });
    RED.httpAdmin.get(NODE_PATH + 'getHeatFanList/', function (req, res) {
      var ImportedHeatFanList = MIIOdevtypesVocabulary.heatfan_list();
      res.json(ImportedHeatFanList);
    });
    RED.httpAdmin.get(NODE_PATH + 'getVacuumList/', function (req, res) {
      var ImportedVacuumList = MIIOdevtypesVocabulary.vacuum_list();
      res.json(ImportedVacuumList);
    });
    RED.httpAdmin.get(NODE_PATH + 'getLightsList/', function (req, res) {
      var ImportedLightsList = MIIOdevtypesVocabulary.light_list();
      res.json(ImportedLightsList);
    });

    RED.httpAdmin.get(NODE_PATH + 'getCommands/' + node.id, function (req, res) {
      var ModelForCommand = node.model;
      var ImportedJSON = MIIOcommandsVocabulary.command_list(ModelForCommand);
      res.json(ImportedJSON);
    });

    // 1) Initialization of MI Protocols
    MiioConnect ();
    MiotConnect ();

    // 2) Setting up the device
    const device = mihome.device({
      id: node.MI_id,
      model: node.model,
      address: node.address,
      token: node.token,
      refresh: 0
    });

    // 4) Tiding Up after device is destroyed
    node.on('close', () => OnClose());
    
    device.on('properties', (data) => {
      NewData = data;
      // D.1.1) check for any changes in properties
      for (var key in NewData) {
        var value = NewData[key];
        if (key in OldData) {
          if (OldData[key] !== value) {
            node.emit('onChange', data);
            OldData = data;
            break;
          }
        }
      };
      // D.1.2) case with no changes in properties
      OldData = data;                   
    });

    // 5) Main Function - Polling the device
    OldData = {};
    ConnDevice().then((data) => {
      data = OldData;    
      node.emit('onInit', data);
    });
    
    // 6) Commands from nodes
    ExecuteSingleCMD ();
    ExecuteJsonCMD ();
    getDeviceData ();


    // functions in USE:
    // A) Initializing MiLocal
    function MiioConnect () {
      mihome.miioProtocol.init();
    };
    // B) Logging into MiCloud if needed
    async function MiotConnect () {
      MIOT_login = node.isMIOT;
      if (MIOT_login == true) {
        await mihome.miCloudProtocol.login(node.username, node.password);
      } else {return};
    };
    // C) OnClose Destroying
    function OnClose () {
      device.destroy();
    };
    
    // D) Main Function - Polling the device
    async function ConnDevice () {
      try {
        await device.init();
        
      } catch (exception) {
        // D.2) catching errors from MIHOME Protocol
        PollError = `Mihome Exception. IP: ${node.address} -> ${exception.message}`;
        node.emit('onError', PollError);
      }
    };
    
    function getDeviceData () {
      node.on('onGetDeviceData', async function () {
        try {
          // E.1) Initializing device if MIOT
          if (device._miotSpecType) {
            await device.init();
          };
          
          ConnDevice();
          device.destroy();
        } catch(exception) {
          node.emit('onGetDeviceDataError', exception.message);
        };
      })
    };
    
    
    // E) Executing single command from send-node 
    function ExecuteSingleCMD () {
      node.on('onSingleCommand', async function (SingleCMD, SinglePayload) {
        try {
          // E.1) Initializing device if MIOT
          if (device._miotSpecType) {
            await device.init();
          };
          // E.2) transfer command from input into device (in AWAIT mode)
          await eval("device.set" + SingleCMD + "(" + SinglePayload + ")");
          device.destroy();
        } catch(exception) {
          // E.3) catching errors from MIIO Protocol and sending back to send-node
          SingleCMDErrorMsg = exception.message;
          SingleCMDErrorCube = SingleCMD;
          node.emit('onSingleCMDSentError', SingleCMDErrorMsg, SingleCMDErrorCube);
        };
      })
    };
    // F) Executing JSON command from send-node (for each Item in JSON asynchronously)
    function ExecuteJsonCMD () {
      node.on('onJsonCommand', async function (CustomJsonCMD) {
        for (let key of Object.keys(CustomJsonCMD)) {
          try {
            // F.1) Initializing device if MIOT
            if (device._miotSpecType) {
              await device.init();
            };
            // F.2) transfer command from input into device (in AWAIT mode)
            JsonItemX = [key] + "(" + CustomJsonCMD[key] + ")";
            await eval("device.set" + JsonItemX);
            device.destroy();  
          } catch(exception) {
            // F.3) catching errors from MIIO Protocol and sending back to send-node
            JsonCMDErrorMsg = exception.message;
            JsonCMDErrorCube = CustomJsonCMD;
            node.emit('onJsonCMDSentError', JsonCMDErrorMsg, JsonCMDErrorCube);
          };
        };
      });
    };
  };

  RED.nodes.registerType("MIIOdevices",MIIOdevicesNode);
}
