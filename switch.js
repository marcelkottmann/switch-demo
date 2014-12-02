var sys = require('util');
var net = require('net');
var repl = require("repl");
var dgram = require('dgram');

function SW(sys, net, repl, dgram, myMac) {

    var arp = {};
    var sw = {

        numberOfPorts: 6,

        myMac: myMac,

        getIncomingPort: function(mac) {
            return (mac.charCodeAt(mac.length - 1)) % this.numberOfPorts + 2;
        },

        deliverFrame: function(port, frame) {
            frame.port = port;
            var message = new Buffer(JSON.stringify(frame));
            server.send(message, 0, message.length, 24000, "172.16.255.255", function(err, bytes) {});
        },

        findPort: function(mac) {
            return typeof arp[mac] == "undefined" ? null : arp[mac];
        },

        savePort: function(mac, port) {
            arp[mac] = port;
        },

        arp: function() {
            return arp;
        }
    }

    server = dgram.createSocket("udp4");
    sw.server = server;

    server.on("error", function(err) {
        console.log("server error:\n" + err.stack);
        server.close();
    });

    server.on("listening", function() {
        var address = server.address();
        console.log("server listening " +
            address.address + ":" + address.port);
    });

    server.bind(24000, null, function() {
        server.setBroadcast(true);
    });

    server.on("message", function(message, rinfo) {
        // console.log("server got: " + message + " from " + rinfo.address + ":" + rinfo.port);
        var frame = JSON.parse(message);
        if (frame.port == "all" || frame.port == sw.getIncomingPort(myMac) && frame.dst_mac == myMac) {
            delete frame.port;
            sw.receive(sw.getIncomingPort(frame.src_mac), frame);
        }
    });

    sw.savePort(myMac, sw.getIncomingPort(myMac));
    return sw;
}


if (typeof process.argv[2] == "undefined") {
    console.log("usage: switch {myMAC}")
    process.exit();
}
sw = SW(sys, net, repl, dgram, process.argv[2]);


var send = function(dst_mac, message) {
    var frame = {
        "src_mac": this.myMac,
        "dst_mac": dst_mac,
        "message": message
    }
    var port = this.findPort(frame.dst_mac);
    if (port == null) {
        port = "all";
    }
    this.deliverFrame(port, frame);
    return "==> success"
}

sw.receive = function(port, frame) {
    this.savePort(frame.src_mac, port);
    this.log("message from " + frame.src_mac + " to " + frame.dst_mac + " on interface port " + port + ": \"" + frame.message + "\"", frame.dst_mac == this.myMac);
}


var replServer = repl.start({
    prompt: sw.myMac + " > ",
});
replServer.context.send = function() {
    return send.apply(sw, arguments)
}
replServer.context.arp = function() {
    return sw.arp.apply(sw, arguments)
}

replServer.log = function(text, color) {
    console.log(color == 0 ? "\u001b[1;31m" : "\u001b[1;32m")
    console.log(text);
    console.log("\u001b[0m");
}
sw.log = function() {
    return replServer.log.apply(replServer, arguments);
}
