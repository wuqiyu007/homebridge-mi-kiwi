const DeviceParser = require('./DeviceParser');
const AccessoryParser = require('./AccessoryParser');

class PlugBaseParser extends DeviceParser {
    constructor(model, platform) {
        super(model, platform);
    }
    
    getAccessoriesParserInfo() {
        return {
            'PlugBase_Outlet': PlugBaseOutletParser
        }
    }
}

// 支持的设备：智能插座，86型墙壁插座
PlugBaseParser.modelName = ['plug', '86plug', 'ctrl_86plug', 'ctrl_86plug.aq1'];
module.exports = PlugBaseParser;

class PlugBaseOutletParser extends AccessoryParser {
    constructor(model, platform, accessoryType) {
        super(model, platform, accessoryType)
    }
    
    getAccessoryCategory(deviceSid) {
        return this.Accessory.Categories.OUTLET;
    }
    
    getAccessoryInformation(deviceSid) {
        return {
            'Manufacturer': 'Aqara',
            'Model': 'Plug Base',
            'SerialNumber': deviceSid
        };
    }

    getServices(jsonObj, accessoryName) {
        var that = this;
        var result = [];
        
        var service = new that.Service.Outlet(accessoryName);
        service.getCharacteristic(that.Characteristic.On);
        service.getCharacteristic(that.Characteristic.OutletInUse);
        result.push(service);
        
        return result;
    }
    
    parserAccessories(jsonObj) {
        var that = this;
        var deviceSid = jsonObj['sid'];
        var uuid = that.getAccessoryUUID(deviceSid);
        var accessory = that.platform.AccessoryUtil.getByUUID(uuid);
        if(accessory) {
            var service = accessory.getService(that.Service.Outlet);
            var onCharacteristic = service.getCharacteristic(that.Characteristic.On);
            var outletInUseCharacteristic = service.getCharacteristic(that.Characteristic.OutletInUse);
            var value = that.getOnCharacteristicValue(jsonObj, null);
            if(null != value) {
                onCharacteristic.updateValue(value);
                outletInUseCharacteristic.updateValue(value);
            }
            
            if(that.platform.ConfigUtil.getAccessorySyncValue(deviceSid, that.accessoryType)) {
                if (onCharacteristic.listeners('get').length == 0) {
                    onCharacteristic.on("get", function(callback) {
                        var command = '{"cmd":"read", "sid":"' + deviceSid + '"}';
                        that.platform.sendReadCommand(deviceSid, command).then(result => {
                            var value = that.getOnCharacteristicValue(result, null);
                            if(null != value) {
                                outletInUseCharacteristic.updateValue(value);
                                callback(null, value);
                            } else {
                                callback(new Error('get value fail: ' + result));
                            }
                        }).catch(function(err) {
                            that.platform.log.error(err);
                            callback(err);
                        });
                    });
                }
            }
            
            if (onCharacteristic.listeners('set').length == 0) {
                onCharacteristic.on("set", function(value, callback) {
                    var valueStr = (value ? 'on' : 'off');
                    var data = that.platform.isProtoVersionByDid(deviceSid, 2) ? {channel_0: valueStr} : {status: valueStr};
                    var command = {cmd:"write",model:that.model,sid:deviceSid,data:data};
                    if(that.platform.ConfigUtil.getAccessoryIgnoreWriteResult(deviceSid, that.accessoryType)) {
                        that.platform.sendWriteCommandWithoutFeedback(deviceSid, command);
                        that.callback2HB(deviceSid, this, callback, null);
                    } else {
                        that.platform.sendWriteCommand(deviceSid, command).then(result => {
                            that.callback2HB(deviceSid, this, callback, null);
                        }).catch(function(err) {
                            that.platform.log.error(err);
                            that.callback2HB(deviceSid, this, callback, err);
                        });
                    }
                });
            }
        }
    }
    
    getOnCharacteristicValue(jsonObj, defaultValue) {
        var value = this.getValueFrJsonObjData(jsonObj, this.platform.isProtoVersionByDid(jsonObj['sid'], 2) ? 'channel_0' : 'status');
        if(value === 'on') {
            return true;
        } else if(value === 'off') {
            return false;
        } else {
            return defaultValue;
        }
    }
}
