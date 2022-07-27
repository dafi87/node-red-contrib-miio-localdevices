const MIIOpropsVocabulary = require('../lib/propsLib.js');
const mihome = require('node-mihome');

module.exports = function(RED) {
  function MIIOgetdataNode(config) {
    RED.nodes.createNode(this,config);
    
    var node = this;
    node.config = config;
    node.MIdevice = RED.nodes.getNode(config.devices);
    
    node.status({}); //cleaning status
    
    node.on('input', function(msg) {
      node.status({fill:"gray",shape:"dot",text:"Connecting..."});
      
      // 1) initialization of local MIIO Protocol
      mihome.miioProtocol.init();

      // 2) working with current device
      if (node.MIdevice) {                
        // 2.1) defining outgoing msg structure
        msg.name = node.MIdevice.name + " - " + node.MIdevice.room;
        msg.address = node.MIdevice.address;
        msg.model = node.MIdevice.model;
        
        node.MIdevice.emit('onGetDeviceData');
        
        node.status({fill:"green",shape:"dot",text:"Command: sent"});
        
        node.MIdevice.on('onGetDeviceDataError', (SingleCMDErrorMsg) => {
          node.warn(`Mihome Exception. IP: ${node.MIdevice.address} -> ${SingleCMDErrorMsg}`);
          node.status({fill:"red",shape:"ring",text:"Command: error"});
        });
        
        setTimeout(() => {
          node.status({});
        }, 3000);
        
      };  
      
    });
    
    
    var msg = {};

    if (node.MIdevice) {                
      
      // 2) Defining outgoing msg structure
      msg.name = node.MIdevice.name + " - " + node.MIdevice.room;
      msg.address = node.MIdevice.address;
      msg.model = node.MIdevice.model;
      
      // 3) Main Functions - Sending outgoing msg on start, on change, on error
      SendOnStart ();
      SendOnChange ();
      SendOnError ();
    };


    // functions in USE
    // A) send msg on Initialization of the device
    function SendOnStart () {
      node.MIdevice.on('onInit', (data) => {
        node.status({fill:"green",shape:"dot",text:"Connection: OK"});
        
        DataAsIS = data;
        ConvertObj();
        msg.payload = DataToBe;
        node.send(msg);

        setTimeout(() => {
          node.status({});
        }, 2000);
      });
    };
    // B) send msg on Change in properties' value
    function SendOnChange () {
      node.MIdevice.on('onChange', (data) => {
        node.status({fill:"green",shape:"dot",text:"State: changed"});
        
        DataAsIS = data;
        ConvertObj ();
        msg.payload = DataToBe;
        node.send(msg);

        setTimeout(() => {
          node.status({});
        }, 2000);
      });
    };
    // C) send msg on Errors accured during polling
    function SendOnError () {
      node.MIdevice.on('onError', (PollError) => {
        node.status({fill:"red",shape:"ring",text:"Connection: error"});
        node.warn(PollError);
      });
    };
    // D) conversion JSON with properties to friendly names as per Vocabulary
    function ConvertObj () {
      DataToBe = {};
      if (node.config.prop_type == "Friendly") {
        var FriendlyKeys = MIIOpropsVocabulary.properties_list(node.MIdevice.model);
        let mapped = Object.keys(DataAsIS).map(OldKey => {
          let NewKey = FriendlyKeys[OldKey];
          DataToBe[NewKey] = DataAsIS[OldKey];
          return DataToBe;
        });
      } else {
        DataToBe = DataAsIS;
      };
    };
  };

  RED.nodes.registerType("MIIOgetdata",MIIOgetdataNode);
}
